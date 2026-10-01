-- B5 membership termination: external role provisioning, retained history, no login credentials.
DO $b5_preflight$
DECLARE owner_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'B5_MIGRATOR_CONTRACT_INVALID';
  END IF;
  FOREACH owner_name IN ARRAY ARRAY['bm_b5_membership_owner','bm_b5_effective_admin_probe_owner'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=owner_name
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit) THEN
      RAISE EXCEPTION 'B5_ROLE_CONTRACT_INVALID';
    END IF;
    IF (SELECT count(*) FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member
      WHERE r.rolname=owner_name OR u.rolname=owner_name) <> 1
      OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
        JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member
        WHERE r.rolname=owner_name AND u.rolname=current_user
        AND NOT m.inherit_option AND m.set_option AND NOT m.admin_option) THEN
      RAISE EXCEPTION 'B5_MEMBERSHIP_CONTRACT_INVALID';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid IN
    ('app.organization'::regclass,'app.organization_membership'::regclass)
    AND (relowner<>current_user::regrole OR NOT relrowsecurity OR NOT relforcerowsecurity)) THEN
    RAISE EXCEPTION 'B5_TABLE_CONTRACT_INVALID';
  END IF;
END
$b5_preflight$;

GRANT USAGE ON SCHEMA app,authn TO bm_b5_membership_owner,bm_b5_effective_admin_probe_owner;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_b5_membership_owner,bm_b5_effective_admin_probe_owner;
GRANT SELECT(id,status),UPDATE(id) ON app.organization TO bm_b5_membership_owner;
GRANT SELECT(id,org_id,role,status,version),UPDATE(status,version,ended_at)
  ON app.organization_membership TO bm_b5_membership_owner;
GRANT SELECT(id,org_id,user_id,role,status) ON app.organization_membership TO bm_b5_effective_admin_probe_owner;
GRANT SELECT(id,status) ON app.app_user TO bm_b5_effective_admin_probe_owner;

CREATE POLICY b5_org_select_ceiling ON app.organization AS RESTRICTIVE FOR SELECT TO bm_b5_membership_owner
  USING (id=app.current_org_id() AND status='ACTIVE');
CREATE POLICY b5_org_update_ceiling ON app.organization AS RESTRICTIVE FOR UPDATE TO bm_b5_membership_owner
  USING (id=app.current_org_id() AND status='ACTIVE') WITH CHECK (id=app.current_org_id() AND status='ACTIVE');
CREATE POLICY b5_member_select_ceiling ON app.organization_membership AS RESTRICTIVE FOR SELECT TO bm_b5_membership_owner
  USING (org_id=app.current_org_id());
CREATE POLICY b5_member_update_ceiling ON app.organization_membership AS RESTRICTIVE FOR UPDATE TO bm_b5_membership_owner
  USING (org_id=app.current_org_id() AND status='ACTIVE')
  WITH CHECK (org_id=app.current_org_id() AND status='ENDED' AND ended_at IS NOT NULL);
CREATE POLICY b5_probe_member_ceiling ON app.organization_membership AS RESTRICTIVE FOR SELECT TO bm_b5_effective_admin_probe_owner
  USING (org_id=app.current_org_id() AND status='ACTIVE' AND role='ORG_ADMIN');

GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;
SET LOCAL ROLE bm_b1_capability_owner;
CREATE FUNCTION authn.b5_classify_caller(p_digest bytea,p_org uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT CASE WHEN COALESCE(p_digest=authn.context_session_digest() AND p_org=app.current_org_id(),false)
    AND authn.current_actor(p_digest) IS NOT NULL
    AND EXISTS (SELECT 1 FROM app.organization o JOIN app.organization_membership m ON m.org_id=o.id
      WHERE o.id=p_org AND o.status='ACTIVE' AND m.user_id=authn.current_actor(p_digest)
        AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','PROPERTY_STAFF'))
    THEN CASE WHEN authn.can_administer_org(p_digest,p_org) THEN 'ALLOWED' ELSE 'FORBIDDEN' END
    ELSE 'NOT_FOUND' END
$$;
REVOKE ALL ON FUNCTION authn.b5_classify_caller(bytea,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.b5_classify_caller(bytea,uuid) TO bm_b5_membership_owner;
RESET ROLE;
REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;

GRANT CREATE ON SCHEMA authn TO bm_b5_effective_admin_probe_owner;
SET LOCAL ROLE bm_b5_effective_admin_probe_owner;
CREATE FUNCTION authn.b5_has_other_effective_admin(p_org uuid,p_target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT COALESCE(p_org=app.current_org_id(),false) AND EXISTS (
    SELECT 1 FROM app.organization_membership m JOIN app.app_user u ON u.id=m.user_id
    WHERE m.org_id=p_org AND m.id<>p_target AND m.status='ACTIVE' AND m.role='ORG_ADMIN' AND u.status='ACTIVE')
$$;
REVOKE ALL ON FUNCTION authn.b5_has_other_effective_admin(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.b5_has_other_effective_admin(uuid,uuid) TO bm_b5_membership_owner;
RESET ROLE;
REVOKE CREATE ON SCHEMA authn FROM bm_b5_effective_admin_probe_owner;

GRANT CREATE ON SCHEMA authn TO bm_b5_membership_owner;
SET LOCAL ROLE bm_b5_membership_owner;
CREATE FUNCTION authn.b5_end_organization_membership(p_digest bytea,p_org uuid,p_membership uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE caller_state text; locked record; target_role text; changed integer;
BEGIN
  caller_state := authn.b5_classify_caller(p_digest,p_org);
  IF caller_state <> 'ALLOWED' THEN RETURN caller_state; END IF;
  PERFORM o.id FROM app.organization o WHERE o.id=p_org AND o.status='ACTIVE' FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN 'NOT_FOUND'; END IF;
  caller_state := authn.b5_classify_caller(p_digest,p_org);
  IF caller_state <> 'ALLOWED' THEN RETURN caller_state; END IF;
  FOR locked IN
    SELECT m.id,m.role FROM app.organization_membership m
    WHERE m.org_id=p_org AND m.status='ACTIVE' AND (m.role='ORG_ADMIN' OR m.id=p_membership)
    ORDER BY m.id FOR NO KEY UPDATE
  LOOP
    IF locked.id=p_membership THEN target_role := locked.role; END IF;
  END LOOP;
  caller_state := authn.b5_classify_caller(p_digest,p_org);
  IF caller_state <> 'ALLOWED' THEN RETURN caller_state; END IF;
  IF target_role IS NULL THEN RETURN 'NOT_FOUND'; END IF;
  IF target_role='ORG_ADMIN' AND NOT authn.b5_has_other_effective_admin(p_org,p_membership) THEN
    RETURN 'LAST_ADMIN';
  END IF;
  UPDATE app.organization_membership m SET status='ENDED',ended_at=clock_timestamp(),version=m.version+1
    WHERE m.id=p_membership AND m.org_id=p_org AND m.status='ACTIVE'
      AND authn.b5_classify_caller(p_digest,p_org)='ALLOWED'
      AND (m.role<>'ORG_ADMIN' OR authn.b5_has_other_effective_admin(p_org,p_membership));
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed=1 THEN RETURN 'ENDED'; END IF;
  caller_state := authn.b5_classify_caller(p_digest,p_org);
  IF caller_state <> 'ALLOWED' THEN RETURN caller_state; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.organization_membership m WHERE m.id=p_membership AND m.org_id=p_org AND m.status='ACTIVE') THEN
    RETURN 'NOT_FOUND';
  END IF;
  RETURN 'LAST_ADMIN';
END
$$;
REVOKE ALL ON FUNCTION authn.b5_end_organization_membership(bytea,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.b5_end_organization_membership(bytea,uuid,uuid) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA authn FROM bm_b5_membership_owner;

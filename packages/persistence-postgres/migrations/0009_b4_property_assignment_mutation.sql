-- PF02-B/B4: exact relationship commands; credentials and lifecycle are external.
DO $b4_preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND NOT rolsuper AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='bm_b4_assignment_owner'
       AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit) THEN
    RAISE EXCEPTION 'B4_ROLE_CONTRACT_INVALID';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
      WHERE r.rolname='bm_b4_assignment_owner' OR member_role.rolname='bm_b4_assignment_owner') <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
      WHERE r.rolname='bm_b4_assignment_owner' AND member_role.rolname=current_user
        AND NOT m.inherit_option AND m.set_option AND NOT m.admin_option) THEN
    RAISE EXCEPTION 'B4_MEMBERSHIP_CONTRACT_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid IN
      ('app.property_assignment'::regclass,'app.organization_membership'::regclass)
      AND (relowner<>current_user::regrole OR NOT relrowsecurity OR NOT relforcerowsecurity)) THEN
    RAISE EXCEPTION 'B4_TABLE_CONTRACT_INVALID';
  END IF;
END
$b4_preflight$;

GRANT USAGE ON SCHEMA app,authn TO bm_b4_assignment_owner;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_b4_assignment_owner;
SET LOCAL ROLE bm_b1_capability_owner;
GRANT EXECUTE ON FUNCTION authn.can_administer_org(bytea,uuid),authn.can_read_property(bytea,uuid,uuid) TO bm_b4_assignment_owner;
RESET ROLE;

GRANT SELECT(id,org_id,role,status) ON app.organization_membership TO bm_b4_assignment_owner;
GRANT SELECT(org_id,membership_id,property_id,status),INSERT(org_id,membership_id,property_id,status),UPDATE(status,ended_at)
  ON app.property_assignment TO bm_b4_assignment_owner;

CREATE POLICY b4_member_target_ceiling ON app.organization_membership AS RESTRICTIVE FOR SELECT TO bm_b4_assignment_owner
  USING (org_id=app.current_org_id() AND status='ACTIVE' AND role='PROPERTY_STAFF');
CREATE POLICY b4_assignment_select_scope ON app.property_assignment AS PERMISSIVE FOR SELECT TO bm_b4_assignment_owner
  USING (org_id=app.current_org_id());
CREATE POLICY b4_assignment_insert_scope ON app.property_assignment AS PERMISSIVE FOR INSERT TO bm_b4_assignment_owner
  WITH CHECK (org_id=app.current_org_id());
CREATE POLICY b4_assignment_update_scope ON app.property_assignment AS PERMISSIVE FOR UPDATE TO bm_b4_assignment_owner
  USING (org_id=app.current_org_id()) WITH CHECK (org_id=app.current_org_id());
CREATE POLICY b4_assignment_insert_ceiling ON app.property_assignment AS RESTRICTIVE FOR INSERT TO bm_b4_assignment_owner
  WITH CHECK (status='ACTIVE' AND ended_at IS NULL);
CREATE POLICY b4_assignment_update_ceiling ON app.property_assignment AS RESTRICTIVE FOR UPDATE TO bm_b4_assignment_owner
  USING (status='ACTIVE') WITH CHECK (status='ENDED' AND ended_at IS NOT NULL);

GRANT CREATE ON SCHEMA authn TO bm_b4_assignment_owner;
SET LOCAL ROLE bm_b4_assignment_owner;

CREATE FUNCTION authn.b4_get_property_staff_assignment(p_digest bytea,p_org uuid,p_property uuid,p_membership uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF NOT authn.can_read_property(p_digest,p_org,p_property) THEN RETURN 'NOT_FOUND'; END IF;
  IF NOT authn.can_administer_org(p_digest,p_org) THEN RETURN 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.organization_membership m WHERE m.id=p_membership AND m.org_id=p_org
    AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF') THEN RETURN 'NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM app.property_assignment a WHERE a.org_id=p_org AND a.property_id=p_property
    AND a.membership_id=p_membership AND a.status='ACTIVE') THEN RETURN 'ACTIVE'; END IF;
  RETURN 'ABSENT';
END
$$;

CREATE FUNCTION authn.b4_ensure_property_staff_assignment(p_digest bytea,p_org uuid,p_property uuid,p_membership uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF NOT authn.can_read_property(p_digest,p_org,p_property) THEN RETURN 'NOT_FOUND'; END IF;
  IF NOT authn.can_administer_org(p_digest,p_org) THEN RETURN 'FORBIDDEN'; END IF;
  INSERT INTO app.property_assignment(org_id,membership_id,property_id,status)
    SELECT p_org,p_membership,p_property,'ACTIVE'
    WHERE authn.can_read_property(p_digest,p_org,p_property) AND authn.can_administer_org(p_digest,p_org)
      AND EXISTS (SELECT 1 FROM app.organization_membership m WHERE m.id=p_membership AND m.org_id=p_org
        AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF')
    ON CONFLICT (org_id,membership_id,property_id) WHERE status='ACTIVE' DO NOTHING;
  IF FOUND THEN RETURN 'CREATED'; END IF;
  -- Fresh read classification after contention/denial; never reissue the write.
  IF NOT authn.can_read_property(p_digest,p_org,p_property) THEN RETURN 'NOT_FOUND'; END IF;
  IF NOT authn.can_administer_org(p_digest,p_org) THEN RETURN 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.organization_membership m WHERE m.id=p_membership AND m.org_id=p_org
    AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF') THEN RETURN 'NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM app.property_assignment a WHERE a.org_id=p_org AND a.property_id=p_property
    AND a.membership_id=p_membership AND a.status='ACTIVE') THEN RETURN 'EXISTS'; END IF;
  RETURN 'NOT_FOUND';
END
$$;

CREATE FUNCTION authn.b4_end_property_staff_assignment(p_digest bytea,p_org uuid,p_property uuid,p_membership uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF NOT authn.can_read_property(p_digest,p_org,p_property) THEN RETURN 'NOT_FOUND'; END IF;
  IF NOT authn.can_administer_org(p_digest,p_org) THEN RETURN 'FORBIDDEN'; END IF;
  UPDATE app.property_assignment a SET status='ENDED',ended_at=clock_timestamp()
    WHERE a.org_id=p_org AND a.property_id=p_property AND a.membership_id=p_membership AND a.status='ACTIVE'
      AND authn.can_read_property(p_digest,p_org,p_property) AND authn.can_administer_org(p_digest,p_org)
      AND EXISTS (SELECT 1 FROM app.organization_membership m WHERE m.id=p_membership AND m.org_id=p_org
        AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF');
  IF FOUND THEN RETURN 'ENDED'; END IF;
  IF NOT authn.can_read_property(p_digest,p_org,p_property) THEN RETURN 'NOT_FOUND'; END IF;
  IF NOT authn.can_administer_org(p_digest,p_org) THEN RETURN 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.organization_membership m WHERE m.id=p_membership AND m.org_id=p_org
    AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF') THEN RETURN 'NOT_FOUND'; END IF;
  RETURN 'ABSENT';
END
$$;

REVOKE ALL ON FUNCTION authn.b4_get_property_staff_assignment(bytea,uuid,uuid,uuid),
  authn.b4_ensure_property_staff_assignment(bytea,uuid,uuid,uuid),
  authn.b4_end_property_staff_assignment(bytea,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.b4_get_property_staff_assignment(bytea,uuid,uuid,uuid),
  authn.b4_ensure_property_staff_assignment(bytea,uuid,uuid,uuid),
  authn.b4_end_property_staff_assignment(bytea,uuid,uuid,uuid) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA authn FROM bm_b4_assignment_owner;

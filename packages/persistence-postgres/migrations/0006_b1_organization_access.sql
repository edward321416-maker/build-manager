-- Required B1 roles must be provisioned and verified before this migration.
-- This is not production hosting or credential provisioning (D02b).
DO $b1_preflight$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('bm_b1_login', 'bm_b1_web', 'bm_b1_capability_owner')) <> 3 THEN
    RAISE EXCEPTION 'B1_REQUIRED_ROLES_MISSING';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname IN ('bm_b1_login', 'bm_b1_web', 'bm_b1_capability_owner')
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit
        OR rolcanlogin <> (rolname <> 'bm_b1_capability_owner'))
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.member
    WHERE r.rolname IN ('bm_b1_login', 'bm_b1_web', 'bm_b1_capability_owner')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
    JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
    WHERE r.rolname IN ('bm_b1_login', 'bm_b1_web', 'bm_b1_capability_owner')
      AND NOT (r.rolname='bm_b1_capability_owner' AND member_role.rolname=current_user
               AND NOT m.inherit_option AND m.set_option AND NOT m.admin_option)
  ) THEN
    RAISE EXCEPTION 'B1_ROLE_CONTRACT_INVALID';
  END IF;
END
$b1_preflight$;


GRANT USAGE ON SCHEMA app TO bm_b1_capability_owner, bm_b1_web;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_b1_capability_owner, bm_b1_web;
GRANT SELECT ON app.organization, app.organization_membership TO bm_b1_capability_owner;
GRANT SELECT ON app.property TO bm_b1_web;
GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;

CREATE FUNCTION authn.context_actor() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT authn.current_actor(authn.context_session_digest())
$$;
REVOKE ALL ON FUNCTION authn.context_actor() FROM PUBLIC;
ALTER FUNCTION authn.context_actor() OWNER TO bm_b1_capability_owner;

CREATE POLICY b1_member_discovery ON app.organization_membership
 AS PERMISSIVE FOR SELECT TO bm_b1_capability_owner
 USING (user_id=authn.context_actor() AND status='ACTIVE' AND role='ORG_ADMIN');
CREATE POLICY b1_member_ceiling ON app.organization_membership
 AS RESTRICTIVE FOR SELECT TO bm_b1_capability_owner
 USING (user_id=authn.context_actor() AND status='ACTIVE' AND role='ORG_ADMIN');
CREATE POLICY b1_org_discovery ON app.organization
 AS PERMISSIVE FOR SELECT TO bm_b1_capability_owner
 USING (status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m
 WHERE m.org_id=organization.id AND m.user_id=authn.context_actor() AND m.status='ACTIVE' AND m.role='ORG_ADMIN'));
CREATE POLICY b1_org_ceiling ON app.organization
 AS RESTRICTIVE FOR SELECT TO bm_b1_capability_owner
 USING (status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m
 WHERE m.org_id=organization.id AND m.user_id=authn.context_actor() AND m.status='ACTIVE' AND m.role='ORG_ADMIN'));

CREATE FUNCTION authn.can_read_org(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior text; allowed boolean;
BEGIN
 IF authn.current_actor(p_digest) IS NULL THEN RETURN false; END IF;
 prior := current_setting('app.b1_session_digest',true);
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 SELECT EXISTS(SELECT 1 FROM app.organization WHERE id=p_org AND status='ACTIVE') INTO allowed;
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RETURN allowed;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RAISE;
END $$;
REVOKE ALL ON FUNCTION authn.can_read_org(bytea,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.can_read_org(bytea,uuid) TO bm_b1_web;
ALTER FUNCTION authn.can_read_org(bytea,uuid) OWNER TO bm_b1_capability_owner;

CREATE FUNCTION authn.authorize_org(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT authn.can_read_org(p_digest,p_org)
$$;
REVOKE ALL ON FUNCTION authn.authorize_org(bytea,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.authorize_org(bytea,uuid) TO bm_b1_web;
ALTER FUNCTION authn.authorize_org(bytea,uuid) OWNER TO bm_b1_capability_owner;

CREATE FUNCTION authn.list_my_organizations(p_digest bytea,p_after uuid,p_limit integer)
RETURNS TABLE(id uuid, display_name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior text;
BEGIN
 IF authn.current_actor(p_digest) IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>51 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 prior := current_setting('app.b1_session_digest',true);
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 RETURN QUERY SELECT o.id,o.display_name FROM app.organization o WHERE o.status='ACTIVE'
 AND (p_after IS NULL OR o.id>p_after) ORDER BY o.id LIMIT p_limit;
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RAISE;
END $$;
REVOKE ALL ON FUNCTION authn.list_my_organizations(bytea,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.list_my_organizations(bytea,uuid,integer) TO bm_b1_web;
ALTER FUNCTION authn.list_my_organizations(bytea,uuid,integer) OWNER TO bm_b1_capability_owner;

CREATE POLICY b1_property_ceiling ON app.property
 AS RESTRICTIVE FOR SELECT TO bm_b1_web
 USING(status='ACTIVE' AND authn.can_read_org(authn.context_session_digest(),org_id));
REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;

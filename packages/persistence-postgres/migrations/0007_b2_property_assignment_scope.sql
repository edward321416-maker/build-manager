-- Required B1 roles must be provisioned and verified before this migration.
-- This is not production hosting or credential provisioning (D02b).
DO $b2_preflight$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('bm_b1_login', 'bm_b1_web', 'bm_b1_capability_owner')) <> 3 THEN
    RAISE EXCEPTION 'B2_REQUIRED_ROLES_MISSING';
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
    RAISE EXCEPTION 'B2_ROLE_CONTRACT_INVALID';
  END IF;
END
$b2_preflight$;

DO $owner_preflight$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relowner<>current_user::regrole::oid) THEN
  RAISE EXCEPTION 'B2_ROLE_CONTRACT_INVALID';
 END IF;
END
$owner_preflight$;

CREATE TABLE app.property_assignment (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  property_id uuid NOT NULL,
  status text NOT NULL CONSTRAINT property_assignment_status_check
    CHECK (status IN ('ACTIVE','ENDED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  ended_at timestamptz,
  CONSTRAINT property_assignment_org_id_id_unique UNIQUE(org_id,id),
  CONSTRAINT property_assignment_membership_fk FOREIGN KEY(org_id,membership_id)
    REFERENCES app.organization_membership(org_id,id),
  CONSTRAINT property_assignment_property_fk FOREIGN KEY(org_id,property_id)
    REFERENCES app.property(org_id,id),
  CONSTRAINT property_assignment_status_time_check CHECK (
    (status='ACTIVE' AND ended_at IS NULL) OR
    (status='ENDED' AND ended_at IS NOT NULL AND ended_at>=created_at))
);
CREATE UNIQUE INDEX property_assignment_one_active_membership_property
  ON app.property_assignment(org_id,membership_id,property_id) WHERE status='ACTIVE';
ALTER TABLE app.property_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property_assignment FORCE ROW LEVEL SECURITY;

DO $b2_owner_check$
BEGIN
  IF (SELECT relowner FROM pg_catalog.pg_class
      WHERE oid='app.property_assignment'::regclass)
     IS DISTINCT FROM current_user::regrole::oid THEN
    RAISE EXCEPTION 'B2_ASSIGNMENT_OWNER_CONTEXT_INVALID';
  END IF;
END
$b2_owner_check$;
CREATE POLICY b2_assignment_owner_scope
ON app.property_assignment AS PERMISSIVE FOR ALL TO CURRENT_USER
USING (org_id=app.current_org_id())
WITH CHECK (org_id=app.current_org_id());

CREATE POLICY b2_assignment_read_scope ON app.property_assignment
 AS PERMISSIVE FOR SELECT TO bm_b1_capability_owner
 USING (org_id=app.current_org_id());
GRANT SELECT(id,org_id,status) ON app.property TO bm_b1_capability_owner;
GRANT SELECT(org_id,membership_id,property_id,status)
 ON app.property_assignment TO bm_b1_capability_owner;

ALTER POLICY b1_member_discovery ON app.organization_membership
 USING (user_id=authn.context_actor() AND status='ACTIVE' AND role IN ('ORG_ADMIN','PROPERTY_STAFF'));
ALTER POLICY b1_member_ceiling ON app.organization_membership
 USING (user_id=authn.context_actor() AND status='ACTIVE' AND role IN ('ORG_ADMIN','PROPERTY_STAFF'));
ALTER POLICY b1_org_discovery ON app.organization
 USING (status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m
 WHERE m.org_id=organization.id AND m.user_id=authn.context_actor()
 AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','PROPERTY_STAFF')));
ALTER POLICY b1_org_ceiling ON app.organization
 USING (status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m
 WHERE m.org_id=organization.id AND m.user_id=authn.context_actor()
 AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','PROPERTY_STAFF')));
CREATE POLICY b2_assignment_read_ceiling ON app.property_assignment
 AS RESTRICTIVE FOR SELECT TO bm_b1_capability_owner
 USING (status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m
 WHERE m.org_id=property_assignment.org_id AND m.id=property_assignment.membership_id
 AND m.user_id=authn.context_actor() AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF'));
CREATE POLICY b2_property_owner_ceiling ON app.property
 AS RESTRICTIVE FOR SELECT TO bm_b1_capability_owner
 USING (org_id=app.current_org_id() AND status='ACTIVE');

-- Functions execute under the non-inherited capability role. The table-owner
-- policy above was resolved before this explicit role transition.
GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;
SET LOCAL ROLE bm_b1_capability_owner;

CREATE FUNCTION authn.can_access_org_context(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior text; allowed boolean;
BEGIN
 prior := current_setting('app.b1_session_digest',true);
 IF authn.current_actor(p_digest) IS NULL THEN RETURN false; END IF;
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 SELECT EXISTS(SELECT 1 FROM app.organization o
 JOIN app.organization_membership m ON m.org_id=o.id
 WHERE o.id=p_org AND o.status='ACTIVE' AND m.user_id=authn.current_actor(p_digest)
 AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','PROPERTY_STAFF')) INTO allowed;
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RETURN allowed;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RAISE;
END $$;

CREATE OR REPLACE FUNCTION authn.can_read_org(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior text; allowed boolean;
BEGIN
 prior := current_setting('app.b1_session_digest',true);
 IF authn.current_actor(p_digest) IS NULL THEN RETURN false; END IF;
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 SELECT EXISTS(SELECT 1 FROM app.organization o
 JOIN app.organization_membership m ON m.org_id=o.id
 WHERE o.id=p_org AND o.status='ACTIVE' AND m.user_id=authn.current_actor(p_digest)
 AND m.status='ACTIVE' AND m.role='ORG_ADMIN') INTO allowed;
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RETURN allowed;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RAISE;
END $$;

CREATE OR REPLACE FUNCTION authn.authorize_org(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT authn.can_access_org_context(p_digest,p_org)
$$;

CREATE OR REPLACE FUNCTION authn.list_my_organizations(p_digest bytea,p_after uuid,p_limit integer)
RETURNS TABLE(id uuid,display_name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior text;
BEGIN
 prior := current_setting('app.b1_session_digest',true);
 IF authn.current_actor(p_digest) IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>51 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 RETURN QUERY
 SELECT o.id,o.display_name FROM app.organization o
 WHERE o.status='ACTIVE'
 AND EXISTS(SELECT 1 FROM app.organization_membership m
 WHERE m.org_id=o.id AND m.user_id=authn.current_actor(p_digest)
 AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','PROPERTY_STAFF'))
 AND (p_after IS NULL OR o.id>p_after) ORDER BY o.id LIMIT p_limit;
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('app.b1_session_digest',COALESCE(prior,''),true);
 RAISE;
END $$;

CREATE FUNCTION authn.can_read_property(p_digest bytea,p_org uuid,p_property uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT COALESCE(
 p_digest=authn.context_session_digest() AND p_org=app.current_org_id()
 AND EXISTS (
 SELECT 1 FROM app.property p
 JOIN app.organization o ON o.id=p.org_id AND o.status='ACTIVE'
 JOIN app.organization_membership m ON m.org_id=p.org_id
 WHERE p.org_id=p_org AND p.id=p_property AND p.status='ACTIVE'
 AND m.user_id=authn.current_actor(p_digest) AND m.status='ACTIVE'
 AND (m.role='ORG_ADMIN' OR (m.role='PROPERTY_STAFF' AND EXISTS (
 SELECT 1 FROM app.property_assignment a
 WHERE a.org_id=m.org_id AND a.membership_id=m.id AND a.property_id=p.id AND a.status='ACTIVE')))
 ),false)
$$;

REVOKE ALL ON FUNCTION authn.can_access_org_context(bytea,uuid),
 authn.can_read_org(bytea,uuid),authn.authorize_org(bytea,uuid),
 authn.list_my_organizations(bytea,uuid,integer),authn.can_read_property(bytea,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.can_access_org_context(bytea,uuid),
 authn.can_read_org(bytea,uuid),authn.authorize_org(bytea,uuid),
 authn.list_my_organizations(bytea,uuid,integer),authn.can_read_property(bytea,uuid,uuid) TO bm_b1_web;

RESET ROLE;
ALTER POLICY b1_property_ceiling ON app.property
 USING (status='ACTIVE' AND authn.can_read_property(authn.context_session_digest(),org_id,id));
REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;

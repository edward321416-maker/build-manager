-- PF02-B/B3: additive ORG_ADMIN Property/Unit registration authority.
-- Roles are provisioned externally; this migration fails closed on contract drift.
DO $b3_preflight$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_roles
      WHERE rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')) <> 3 THEN
    RAISE EXCEPTION 'B3_REQUIRED_ROLES_MISSING';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')
      AND (
        rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit
        OR rolcanlogin <> (rolname <> 'bm_b1_capability_owner')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.member
    WHERE r.rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
    JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
    WHERE r.rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')
      AND NOT (
        r.rolname='bm_b1_capability_owner'
        AND member_role.rolname=current_user
        AND NOT m.inherit_option
        AND m.set_option
        AND NOT m.admin_option
      )
  ) THEN
    RAISE EXCEPTION 'B3_ROLE_CONTRACT_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app' AND c.relkind='r' AND c.relowner<>current_user::regrole::oid
  ) THEN
    RAISE EXCEPTION 'B3_TABLE_OWNER_CONTRACT_INVALID';
  END IF;

  IF to_regprocedure('authn.current_actor(bytea)') IS NULL
     OR to_regprocedure('authn.context_session_digest()') IS NULL
     OR to_regprocedure('authn.can_read_property(bytea,uuid,uuid)') IS NULL
     OR to_regprocedure('app.current_org_id()') IS NULL THEN
    RAISE EXCEPTION 'B3_REQUIRED_CAPABILITY_MISSING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc
    WHERE oid IN (
      'authn.current_actor(bytea)'::regprocedure,
      'authn.can_read_property(bytea,uuid,uuid)'::regprocedure
    )
      AND proowner <> 'bm_b1_capability_owner'::regrole
  ) THEN
    RAISE EXCEPTION 'B3_CAPABILITY_OWNER_CONTRACT_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class
    WHERE oid IN ('app.property'::regclass,'app.unit'::regclass)
      AND (NOT relrowsecurity OR NOT relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'B3_RLS_CONTRACT_INVALID';
  END IF;
END
$b3_preflight$;

GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;
SET LOCAL ROLE bm_b1_capability_owner;

CREATE FUNCTION authn.can_administer_org(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT COALESCE(
    p_digest=authn.context_session_digest()
    AND p_org=app.current_org_id()
    AND authn.current_actor(p_digest) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM app.organization o
      JOIN app.organization_membership m ON m.org_id=o.id
      WHERE o.id=p_org
        AND o.status='ACTIVE'
        AND m.user_id=authn.current_actor(p_digest)
        AND m.status='ACTIVE'
        AND m.role='ORG_ADMIN'
    ),
    false
  )
$$;

REVOKE ALL ON FUNCTION authn.can_administer_org(bytea,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.can_administer_org(bytea,uuid) TO bm_b1_web;

RESET ROLE;

CREATE POLICY b3_property_insert_ceiling ON app.property
  AS RESTRICTIVE FOR INSERT TO bm_b1_web
  WITH CHECK (
    status='ACTIVE'
    AND org_id=app.current_org_id()
    AND authn.can_administer_org(authn.context_session_digest(),org_id)
  );

CREATE POLICY b3_unit_read_ceiling ON app.unit
  AS RESTRICTIVE FOR SELECT TO bm_b1_web
  USING (
    status='ACTIVE'
    AND authn.can_read_property(
      authn.context_session_digest(),
      org_id,
      property_id
    )
  );

CREATE POLICY b3_unit_insert_ceiling ON app.unit
  AS RESTRICTIVE FOR INSERT TO bm_b1_web
  WITH CHECK (
    status='ACTIVE'
    AND org_id=app.current_org_id()
    AND authn.can_administer_org(authn.context_session_digest(),org_id)
    AND authn.can_read_property(
      authn.context_session_digest(),
      org_id,
      property_id
    )
  );

GRANT INSERT(id,org_id,address_reference,status) ON app.property TO bm_b1_web;
GRANT SELECT(id,org_id,property_id,label,status) ON app.unit TO bm_b1_web;
GRANT INSERT(id,org_id,property_id,label,status) ON app.unit TO bm_b1_web;

REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;

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

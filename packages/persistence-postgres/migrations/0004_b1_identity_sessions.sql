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

CREATE SCHEMA authn;
REVOKE ALL ON SCHEMA authn FROM PUBLIC;
ALTER TABLE app.app_user ADD COLUMN session_epoch bigint NOT NULL DEFAULT 0 CHECK (session_epoch >= 0);
CREATE TABLE authn.external_identity (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES app.app_user(id) ON DELETE RESTRICT,
  issuer text NOT NULL CHECK (char_length(issuer) BETWEEN 1 AND 2048),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 255),
  status text NOT NULL CHECK (status IN ('ACTIVE','DISABLED')),
  session_epoch bigint NOT NULL DEFAULT 0 CHECK (session_epoch >= 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(issuer,subject), UNIQUE(id,user_id)
);
CREATE TABLE authn.web_session (
  digest bytea PRIMARY KEY CHECK (octet_length(digest)=32),
  identity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_epoch bigint NOT NULL,
  identity_epoch bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY(identity_id,user_id) REFERENCES authn.external_identity(id,user_id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour')
);
REVOKE ALL ON ALL TABLES IN SCHEMA authn FROM PUBLIC;

CREATE FUNCTION authn.bump_session_epoch() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  NEW.session_epoch := greatest(OLD.session_epoch,NEW.session_epoch)
    + CASE WHEN OLD.status='ACTIVE' AND NEW.status<>'ACTIVE' THEN 1 ELSE 0 END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION authn.bump_session_epoch() FROM PUBLIC;
CREATE TRIGGER app_user_epoch BEFORE UPDATE ON app.app_user
FOR EACH ROW EXECUTE FUNCTION authn.bump_session_epoch();
CREATE TRIGGER external_identity_epoch BEFORE UPDATE ON authn.external_identity
FOR EACH ROW EXECUTE FUNCTION authn.bump_session_epoch();

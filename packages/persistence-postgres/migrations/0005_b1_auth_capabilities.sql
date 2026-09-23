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


GRANT USAGE ON SCHEMA app,authn TO bm_b1_capability_owner;
GRANT USAGE ON SCHEMA authn TO bm_b1_login,bm_b1_web;
GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;
GRANT SELECT,INSERT ON app.app_user,authn.external_identity,authn.web_session TO bm_b1_capability_owner;
GRANT UPDATE(revoked_at) ON authn.web_session TO bm_b1_capability_owner;
CREATE FUNCTION authn.begin_session(p_issuer text,p_subject text,p_digest bytea,p_expires timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $b1$
DECLARE actor_id uuid; identity_id uuid; actor_epoch bigint; identity_epoch bigint; actor_status text; identity_status text;
BEGIN
  IF p_issuer IS NULL OR char_length(p_issuer) NOT BETWEEN 1 AND 2048
    OR p_subject IS NULL OR char_length(p_subject) NOT BETWEEN 1 AND 255
    OR p_digest IS NULL OR octet_length(p_digest) <> 32
    OR p_expires IS NULL OR p_expires <= clock_timestamp() OR p_expires > clock_timestamp()+interval '1 hour' THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='AUTHENTICATION_REJECTED';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array(p_issuer,p_subject)::text,0));
  SELECT u.id,i.id,u.session_epoch,i.session_epoch,u.status,i.status
    INTO actor_id,identity_id,actor_epoch,identity_epoch,actor_status,identity_status
    FROM authn.external_identity i JOIN app.app_user u ON u.id=i.user_id
    WHERE i.issuer=p_issuer AND i.subject=p_subject;
  IF FOUND THEN
    IF actor_status <> 'ACTIVE' OR identity_status <> 'ACTIVE' THEN
      RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='AUTHENTICATION_REJECTED';
    END IF;
  ELSE
    INSERT INTO app.app_user(status) VALUES('ACTIVE') RETURNING id,session_epoch INTO actor_id,actor_epoch;
    INSERT INTO authn.external_identity(user_id,issuer,subject,status)
      VALUES(actor_id,p_issuer,p_subject,'ACTIVE') RETURNING id,session_epoch INTO identity_id,identity_epoch;
  END IF;
  INSERT INTO authn.web_session(digest,identity_id,user_id,user_epoch,identity_epoch,expires_at)
    VALUES(p_digest,identity_id,actor_id,actor_epoch,identity_epoch,p_expires);
  RETURN actor_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='AUTHENTICATION_REJECTED';
END
$b1$;
REVOKE ALL ON FUNCTION authn.begin_session(text,text,bytea,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.begin_session(text,text,bytea,timestamptz) TO bm_b1_login;
ALTER FUNCTION authn.begin_session(text,text,bytea,timestamptz) OWNER TO bm_b1_capability_owner;
REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;

-- Registry authorization is authoritative, independently of transport cookies.
GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;
CREATE FUNCTION authn.current_actor(p_digest bytea) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT u.id FROM authn.web_session s
  JOIN authn.external_identity i ON i.id=s.identity_id AND i.user_id=s.user_id
  JOIN app.app_user u ON u.id=s.user_id
  WHERE s.digest=p_digest AND octet_length(p_digest)=32
    AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
    AND u.status='ACTIVE' AND i.status='ACTIVE'
    AND s.user_epoch=u.session_epoch AND s.identity_epoch=i.session_epoch $$;
CREATE FUNCTION authn.revoke_session(p_digest bytea) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  UPDATE authn.web_session SET revoked_at=clock_timestamp() WHERE digest=p_digest AND revoked_at IS NULL
$$;
REVOKE ALL ON FUNCTION authn.current_actor(bytea),authn.revoke_session(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.current_actor(bytea),authn.revoke_session(bytea) TO bm_b1_web;
ALTER FUNCTION authn.current_actor(bytea) OWNER TO bm_b1_capability_owner;
ALTER FUNCTION authn.revoke_session(bytea) OWNER TO bm_b1_capability_owner;
REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;

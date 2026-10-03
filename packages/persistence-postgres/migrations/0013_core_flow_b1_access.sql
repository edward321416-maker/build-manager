-- Additive B1-to-core bridge. Existing B1-B5 and core capabilities are unchanged.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bm_core_access_owner' AND NOT rolcanlogin
 AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit AND NOT rolreplication)
 THEN RAISE EXCEPTION 'CORE_ACCESS_ROLE_REQUIRED'; END IF;
END $$;
GRANT USAGE,CREATE ON SCHEMA core_flow TO bm_core_access_owner;
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
GRANT USAGE ON SCHEMA app,authn TO bm_core_access_owner;
GRANT SELECT ON app.organization,app.organization_membership,app.occupancy,app.occupancy_member TO bm_core_access_owner;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_core_access_owner;
SET LOCAL ROLE bm_b1_capability_owner;
GRANT EXECUTE ON FUNCTION authn.current_actor(bytea) TO bm_core_access_owner;
RESET ROLE;

-- Discovery belongs only to a separate non-login owner. Restrictive ceilings
-- prevent a caller's app.org_id from widening these actor-specific reads.
CREATE POLICY core_access_member ON app.organization_membership FOR SELECT TO bm_core_access_owner
 USING(user_id=authn.current_actor(decode(current_setting('app.b1_session_digest',true),'hex')) AND status='ACTIVE');
CREATE POLICY core_access_member_ceiling ON app.organization_membership AS RESTRICTIVE FOR SELECT TO bm_core_access_owner
 USING(user_id=authn.current_actor(decode(current_setting('app.b1_session_digest',true),'hex')) AND status='ACTIVE');
CREATE POLICY core_access_resident ON app.occupancy_member FOR SELECT TO bm_core_access_owner
 USING(user_id=authn.current_actor(decode(current_setting('app.b1_session_digest',true),'hex')) AND status='ACTIVE' AND joined_at<=clock_timestamp());
CREATE POLICY core_access_resident_ceiling ON app.occupancy_member AS RESTRICTIVE FOR SELECT TO bm_core_access_owner
 USING(user_id=authn.current_actor(decode(current_setting('app.b1_session_digest',true),'hex')) AND status='ACTIVE' AND joined_at<=clock_timestamp());
CREATE POLICY core_access_occupancy ON app.occupancy FOR SELECT TO bm_core_access_owner
 USING(status='ACTIVE' AND starts_at<=clock_timestamp() AND (ends_at IS NULL OR ends_at>clock_timestamp()) AND EXISTS(SELECT 1 FROM app.occupancy_member m WHERE m.org_id=occupancy.org_id AND m.occupancy_id=occupancy.id));
CREATE POLICY core_access_occupancy_ceiling ON app.occupancy AS RESTRICTIVE FOR SELECT TO bm_core_access_owner
 USING(status='ACTIVE' AND starts_at<=clock_timestamp() AND (ends_at IS NULL OR ends_at>clock_timestamp()) AND EXISTS(SELECT 1 FROM app.occupancy_member m WHERE m.org_id=occupancy.org_id AND m.occupancy_id=occupancy.id));
CREATE POLICY core_access_org ON app.organization FOR SELECT TO bm_core_access_owner
 USING(status='ACTIVE' AND (EXISTS(SELECT 1 FROM app.organization_membership m WHERE m.org_id=organization.id) OR EXISTS(SELECT 1 FROM app.occupancy o WHERE o.org_id=organization.id)));
CREATE POLICY core_access_org_ceiling ON app.organization AS RESTRICTIVE FOR SELECT TO bm_core_access_owner
 USING(status='ACTIVE' AND (EXISTS(SELECT 1 FROM app.organization_membership m WHERE m.org_id=organization.id) OR EXISTS(SELECT 1 FROM app.occupancy o WHERE o.org_id=organization.id)));

SET LOCAL ROLE bm_core_access_owner;
CREATE FUNCTION core_flow.access_organizations(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; result jsonb;
BEGIN
 actor:=authn.current_actor(p_digest);
 IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.display_name,'role',coalesce(m.role,'TENANT')) ORDER BY o.display_name,o.id),'[]'::jsonb)
 INTO result FROM app.organization o LEFT JOIN app.organization_membership m ON m.org_id=o.id AND m.user_id=actor AND m.status='ACTIVE'
 WHERE o.status='ACTIVE';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION core_flow.access_organizations(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.access_organizations(bytea) TO bm_b1_web,bm_core_flow_owner;
RESET ROLE;
SET LOCAL ROLE bm_core_flow_owner;
CREATE FUNCTION core_flow.bind_organization(p_digest bytea,p_org uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF authn.current_actor(p_digest) IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_digest,'hex'),13001));
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(core_flow.access_organizations(p_digest)) o WHERE (o->>'id')::uuid=p_org)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 INSERT INTO core_flow.session_scope(digest,org_id) VALUES(p_digest,p_org)
 ON CONFLICT(digest) DO UPDATE SET org_id=excluded.org_id;
 PERFORM core_flow.session(p_digest);
END $$;
REVOKE ALL ON FUNCTION core_flow.bind_organization(bytea,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.bind_organization(bytea,uuid) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner,bm_core_access_owner;

-- Additive, B1-only invitation capability. No existing capability or migration changes.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bm_core_onboarding_owner'
 AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
 AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit)
 THEN RAISE EXCEPTION 'CORE_ONBOARDING_ROLE_REQUIRED'; END IF;
END $$;
CREATE SCHEMA core_onboarding;
REVOKE ALL ON SCHEMA core_onboarding FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA core_onboarding TO bm_core_onboarding_owner;
GRANT USAGE ON SCHEMA core_onboarding TO bm_b1_web;
GRANT USAGE ON SCHEMA app,authn,core_flow TO bm_core_onboarding_owner;
GRANT SELECT ON app.organization,app.organization_membership,app.property,app.unit,
 app.occupancy,app.occupancy_member TO bm_core_onboarding_owner;
GRANT SELECT(id,status),UPDATE(id) ON app.app_user TO bm_core_onboarding_owner;
GRANT UPDATE(id) ON app.organization,app.unit TO bm_core_onboarding_owner;
GRANT INSERT ON app.occupancy,app.occupancy_member TO bm_core_onboarding_owner;
GRANT REFERENCES ON app.app_user,app.unit,app.organization_membership,app.occupancy,app.occupancy_member TO bm_core_onboarding_owner;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_core_onboarding_owner;
CREATE POLICY onboarding_org_ceiling ON app.organization AS RESTRICTIVE TO bm_core_onboarding_owner
 USING(id=app.current_org_id()) WITH CHECK(id=app.current_org_id());
CREATE POLICY onboarding_member_ceiling ON app.organization_membership AS RESTRICTIVE TO bm_core_onboarding_owner
 USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY onboarding_property_ceiling ON app.property AS RESTRICTIVE TO bm_core_onboarding_owner
 USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY onboarding_unit_ceiling ON app.unit AS RESTRICTIVE TO bm_core_onboarding_owner
 USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY onboarding_occupancy_ceiling ON app.occupancy AS RESTRICTIVE TO bm_core_onboarding_owner
 USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY onboarding_resident_ceiling ON app.occupancy_member AS RESTRICTIVE TO bm_core_onboarding_owner
 USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
SET LOCAL ROLE bm_b1_capability_owner;
GRANT EXECUTE ON FUNCTION authn.current_actor(bytea) TO bm_core_onboarding_owner;
RESET ROLE;
SET LOCAL ROLE bm_core_flow_owner;
GRANT SELECT ON core_flow.building_context TO bm_core_onboarding_owner;
CREATE POLICY onboarding_context ON core_flow.building_context TO bm_core_onboarding_owner USING(org_id=app.current_org_id());
CREATE POLICY onboarding_context_ceiling ON core_flow.building_context AS RESTRICTIVE TO bm_core_onboarding_owner USING(org_id=app.current_org_id());
RESET ROLE;
SET LOCAL ROLE bm_core_onboarding_owner;

CREATE TABLE core_onboarding.invitation(
 id uuid PRIMARY KEY DEFAULT uuidv7(), org_id uuid NOT NULL, unit_id uuid NOT NULL,
 creator_id uuid NOT NULL REFERENCES app.app_user(id), creator_membership_id uuid NOT NULL,
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','REQUESTED','APPROVED','REJECTED','REVOKED','EXPIRED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 applicant_id uuid REFERENCES app.app_user(id), request_id uuid UNIQUE, requested_at timestamptz,
 decided_by uuid REFERENCES app.app_user(id), decided_at timestamptz,
 occupancy_id uuid, occupant_id uuid,
 FOREIGN KEY(org_id,unit_id) REFERENCES app.unit(org_id,id),
 FOREIGN KEY(org_id,creator_membership_id) REFERENCES app.organization_membership(org_id,id),
 FOREIGN KEY(org_id,occupancy_id) REFERENCES app.occupancy(org_id,id),
 FOREIGN KEY(org_id,occupant_id) REFERENCES app.occupancy_member(org_id,id),
 CHECK(expires_at>created_at),
 CHECK((applicant_id IS NULL AND request_id IS NULL AND requested_at IS NULL) OR
       (applicant_id IS NOT NULL AND request_id IS NOT NULL AND requested_at IS NOT NULL)),
 CHECK(state NOT IN ('REQUESTED','APPROVED','REJECTED') OR applicant_id IS NOT NULL),
 CHECK((state='APPROVED')=(occupancy_id IS NOT NULL AND occupant_id IS NOT NULL)),
 CHECK(state NOT IN ('APPROVED','REJECTED','REVOKED') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX invitation_one_open_unit ON core_onboarding.invitation(org_id,unit_id) WHERE state IN ('OPEN','REQUESTED');
CREATE INDEX invitation_manager_page ON core_onboarding.invitation(org_id,id);
CREATE INDEX invitation_applicant_page ON core_onboarding.invitation(applicant_id,id);
CREATE TABLE core_onboarding.token_attempt(
 actor_id uuid PRIMARY KEY REFERENCES app.app_user(id), attempts timestamptz[] NOT NULL CHECK(cardinality(attempts)<=20)
);
ALTER TABLE core_onboarding.invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_onboarding.invitation FORCE ROW LEVEL SECURITY;
ALTER TABLE core_onboarding.token_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_onboarding.token_attempt FORCE ROW LEVEL SECURITY;
-- Only the non-login definer can see token lookup/rate rows across organizations.
-- Runtime roles have no table privileges and cannot SET ROLE to this owner.
CREATE POLICY invitation_capability ON core_onboarding.invitation TO bm_core_onboarding_owner USING(true) WITH CHECK(true);
CREATE POLICY attempt_capability ON core_onboarding.token_attempt TO bm_core_onboarding_owner USING(true) WITH CHECK(true);

CREATE FUNCTION core_onboarding.is_admin(p_actor uuid,p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT m.id FROM app.organization_membership m JOIN app.app_user u ON u.id=m.user_id
 WHERE m.org_id=p_org AND m.user_id=p_actor AND m.role='ORG_ADMIN' AND m.status='ACTIVE' AND u.status='ACTIVE'
$$;
CREATE FUNCTION core_onboarding.view_invitation(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE i core_onboarding.invitation; result jsonb;
BEGIN
 SELECT * INTO STRICT i FROM core_onboarding.invitation WHERE id=p_id;
 PERFORM set_config('app.org_id',i.org_id::text,true);
 SELECT jsonb_build_object('invitationId',i.id,'requestNumber',i.request_id,
  'unitId',i.unit_id,'buildingId',u.property_id,'buildingName',coalesce(c.body->>'displayName','건물'),'unitLabel',u.label,
  'state',CASE WHEN i.state IN ('OPEN','REQUESTED') AND i.expires_at<=clock_timestamp() THEN 'EXPIRED' ELSE i.state END,
  'createdAt',i.created_at,'expiresAt',i.expires_at,'requestedAt',i.requested_at,'decidedAt',i.decided_at)
 INTO result FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=i.org_id AND u.id=i.unit_id;
 RETURN result;
END $$;

CREATE FUNCTION core_onboarding.command(p_digest bytea,p_action text,p_org uuid,p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; org uuid; unit_key uuid; member uuid; i core_onboarding.invitation;
 stamp timestamptz; tries timestamptz[]; ids uuid[]; page jsonb; cursor_id uuid; created_occ uuid; created_member uuid;
BEGIN
 actor:=authn.current_actor(p_digest);
 IF actor IS NULL THEN RETURN jsonb_build_object('code','UNAUTHENTICATED'); END IF;
 IF p_action IS NULL OR p_action NOT IN ('CREATE','INSPECT','CLAIM','MINE','LIST','UNITS','APPROVE','REJECT','REVOKE')
 OR p_value IS NULL OR jsonb_typeof(p_value)<>'object' OR octet_length(p_value::text)>4096
 THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END IF;
 IF p_action IN ('INSPECT','CLAIM') THEN
  -- A rolling sixty-second window, serialized in the shared DB, including failed token attempts.
  INSERT INTO core_onboarding.token_attempt(actor_id,attempts) VALUES(actor,ARRAY[]::timestamptz[]) ON CONFLICT DO NOTHING;
  SELECT attempts INTO tries FROM core_onboarding.token_attempt WHERE actor_id=actor FOR UPDATE;
  stamp:=clock_timestamp();
  SELECT coalesce(array_agg(t),'{}'::timestamptz[]) INTO tries FROM unnest(tries) t WHERE t>stamp-interval '60 seconds';
  IF cardinality(tries)>=20 THEN RETURN jsonb_build_object('code','RATE_LIMITED'); END IF;
  UPDATE core_onboarding.token_attempt SET attempts=array_append(tries,stamp) WHERE actor_id=actor;
 END IF;
 -- The SQL capability also rejects actor/role claims and extra keys from direct callers.
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_value) k WHERE NOT(k=ANY(CASE
  WHEN p_action='CREATE' THEN ARRAY['unitId','tokenDigest']
  WHEN p_action IN ('INSPECT','CLAIM') THEN ARRAY['tokenDigest']
  WHEN p_action IN ('APPROVE','REJECT','REVOKE') THEN ARRAY['invitationId','requestNumber']
  ELSE ARRAY['cursor'] END))) THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END IF;
 IF p_action IN ('CREATE','INSPECT','CLAIM') AND coalesce(p_value->>'tokenDigest','')!~'^[a-f0-9]{64}$'
 THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END IF;
 BEGIN
  IF p_action='CREATE' THEN unit_key:=(p_value->>'unitId')::uuid; END IF;
  IF p_action IN ('MINE','LIST','UNITS') THEN cursor_id:=(p_value->>'cursor')::uuid; END IF;
  IF p_action IN ('APPROVE','REJECT','REVOKE') THEN
   SELECT * INTO i FROM core_onboarding.invitation WHERE id=(p_value->>'invitationId')::uuid AND org_id=p_org;
  ELSIF p_action IN ('INSPECT','CLAIM') THEN
   SELECT * INTO i FROM core_onboarding.invitation WHERE token_digest=decode(p_value->>'tokenDigest','hex');
  END IF;
 EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END;
 IF p_action='MINE' THEN
  IF p_org IS NOT NULL THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END IF;
  SELECT array_agg(id ORDER BY id) INTO ids FROM (SELECT id FROM core_onboarding.invitation
   WHERE applicant_id=actor AND (cursor_id IS NULL OR id>cursor_id) ORDER BY id LIMIT 21) q;
  SELECT coalesce(jsonb_agg(core_onboarding.view_invitation(id) ORDER BY id),'[]'::jsonb) INTO page FROM unnest(ids[1:20]) id;
  RETURN jsonb_build_object('data',jsonb_build_object('items',page,'nextCursor',CASE WHEN cardinality(ids)>20 THEN ids[20] ELSE NULL END));
 END IF;
 IF p_action IN ('INSPECT','CLAIM') THEN
  IF p_org IS NOT NULL THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END IF;
  IF i.id IS NULL OR (i.applicant_id IS NOT NULL AND i.applicant_id<>actor) THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
  org:=i.org_id; unit_key:=i.unit_id;
 ELSE
  org:=p_org;
  IF org IS NULL THEN RETURN jsonb_build_object('code','INVALID_INPUT'); END IF;
 END IF;
 PERFORM set_config('app.org_id',org::text,true);
 -- All mutating transitions serialize with B5: organization -> unit -> invitation.
 -- Read lists never mutate invitation state or bind an organization/session scope.
 IF p_action IN ('LIST','UNITS') THEN
  PERFORM id FROM app.organization WHERE id=org AND status='ACTIVE';
 ELSE
  PERFORM id FROM app.organization WHERE id=org AND status='ACTIVE' FOR NO KEY UPDATE;
 END IF;
 IF NOT FOUND THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
 actor:=authn.current_actor(p_digest);
 IF actor IS NULL THEN RETURN jsonb_build_object('code','UNAUTHENTICATED'); END IF;
 IF p_action NOT IN ('INSPECT','CLAIM') THEN
  member:=core_onboarding.is_admin(actor,org);
  IF member IS NULL THEN
   IF EXISTS(SELECT 1 FROM app.organization_membership WHERE org_id=org AND user_id=actor AND status='ACTIVE')
    OR EXISTS(SELECT 1 FROM app.occupancy_member WHERE org_id=org AND user_id=actor AND status='ACTIVE')
   THEN RETURN jsonb_build_object('code','FORBIDDEN'); END IF;
   RETURN jsonb_build_object('code','NOT_FOUND');
  END IF;
 END IF;
 IF p_action='LIST' THEN
  SELECT array_agg(id ORDER BY id) INTO ids FROM (SELECT id FROM core_onboarding.invitation
   WHERE org_id=org AND (cursor_id IS NULL OR id>cursor_id) ORDER BY id LIMIT 21) q;
  SELECT coalesce(jsonb_agg(core_onboarding.view_invitation(id) ORDER BY id),'[]'::jsonb) INTO page FROM unnest(ids[1:20]) id;
  RETURN jsonb_build_object('data',jsonb_build_object('items',page,'nextCursor',CASE WHEN cardinality(ids)>20 THEN ids[20] ELSE NULL END));
 ELSIF p_action='UNITS' THEN
  SELECT array_agg(id ORDER BY id) INTO ids FROM (SELECT u.id FROM app.unit u JOIN app.property p ON p.org_id=u.org_id AND p.id=u.property_id
   WHERE u.org_id=org AND u.status='ACTIVE' AND p.status='ACTIVE' AND (cursor_id IS NULL OR u.id>cursor_id)
   AND NOT EXISTS(SELECT 1 FROM app.occupancy o WHERE o.org_id=org AND o.unit_id=u.id AND o.status='ACTIVE') ORDER BY u.id LIMIT 21) q;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'buildingId',u.property_id,'buildingName',coalesce(c.body->>'displayName','건물'),'label',u.label) ORDER BY u.id),'[]'::jsonb)
   INTO page FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id WHERE u.org_id=org AND u.id=ANY(ids[1:20]);
  RETURN jsonb_build_object('data',jsonb_build_object('items',page,'nextCursor',CASE WHEN cardinality(ids)>20 THEN ids[20] ELSE NULL END));
 END IF;
 IF p_action IN ('APPROVE','REJECT','REVOKE') THEN
  IF i.id IS NULL THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
  unit_key:=i.unit_id;
 END IF;
 PERFORM u.id FROM app.unit u JOIN app.property p ON p.org_id=u.org_id AND p.id=u.property_id
  WHERE u.org_id=org AND u.id=unit_key AND u.status='ACTIVE' AND p.status='ACTIVE' FOR UPDATE OF u;
 IF NOT FOUND THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
 IF p_action='CREATE' THEN
  actor:=authn.current_actor(p_digest);
  IF actor IS NULL THEN RETURN jsonb_build_object('code','UNAUTHENTICATED'); END IF;
  IF core_onboarding.is_admin(actor,org) IS DISTINCT FROM member THEN RETURN jsonb_build_object('code','FORBIDDEN'); END IF;
  IF EXISTS(SELECT 1 FROM app.occupancy WHERE org_id=org AND unit_id=unit_key AND status='ACTIVE')
  THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
  UPDATE core_onboarding.invitation SET state='EXPIRED' WHERE org_id=org AND unit_id=unit_key AND state IN ('OPEN','REQUESTED') AND expires_at<=clock_timestamp();
  IF EXISTS(SELECT 1 FROM core_onboarding.invitation WHERE org_id=org AND unit_id=unit_key AND state IN ('OPEN','REQUESTED'))
  THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
  stamp:=clock_timestamp();
  INSERT INTO core_onboarding.invitation(org_id,unit_id,creator_id,creator_membership_id,token_digest,created_at,expires_at)
   VALUES(org,unit_key,actor,member,decode(p_value->>'tokenDigest','hex'),stamp,stamp+interval '24 hours') RETURNING * INTO i;
  RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id));
 END IF;
 SELECT * INTO STRICT i FROM core_onboarding.invitation WHERE id=i.id FOR UPDATE;
 actor:=authn.current_actor(p_digest);
 IF actor IS NULL THEN RETURN jsonb_build_object('code','UNAUTHENTICATED'); END IF;
 IF p_action NOT IN ('INSPECT','CLAIM') AND core_onboarding.is_admin(actor,org) IS DISTINCT FROM member THEN RETURN jsonb_build_object('code','FORBIDDEN'); END IF;
 IF p_action IN ('INSPECT','CLAIM') AND i.applicant_id IS NOT NULL AND i.applicant_id<>actor THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
 IF i.state IN ('OPEN','REQUESTED') AND i.expires_at<=clock_timestamp() THEN
  UPDATE core_onboarding.invitation SET state='EXPIRED' WHERE id=i.id; i.state:='EXPIRED';
 END IF;
 IF p_action='REVOKE' THEN
  IF i.state='REVOKED' THEN RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id)); END IF;
  IF i.state NOT IN ('OPEN','REQUESTED') THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
  UPDATE core_onboarding.invitation SET state='REVOKED',decided_by=actor,decided_at=clock_timestamp() WHERE id=i.id;
  RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id));
 END IF;
 -- The exact creating membership must still be active; another admin cannot revive a revoked creator's link.
 IF core_onboarding.is_admin(i.creator_id,org) IS DISTINCT FROM i.creator_membership_id
 THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
 IF p_action IN ('INSPECT','CLAIM') THEN
  IF i.state NOT IN ('OPEN','REQUESTED','APPROVED') THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
  IF p_action='CLAIM' AND i.state='OPEN' THEN
   IF EXISTS(SELECT 1 FROM app.occupancy WHERE org_id=org AND unit_id=unit_key AND status='ACTIVE') THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
   UPDATE core_onboarding.invitation SET state='REQUESTED',applicant_id=actor,request_id=gen_random_uuid(),requested_at=clock_timestamp() WHERE id=i.id;
  END IF;
  RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id));
 END IF;
 IF actor=i.applicant_id THEN RETURN jsonb_build_object('code','FORBIDDEN'); END IF;
 IF p_value->>'requestNumber' IS DISTINCT FROM i.request_id::text OR i.request_id IS NULL
 THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
 IF (p_action='APPROVE' AND i.state='APPROVED') THEN
  IF EXISTS(SELECT 1 FROM app.occupancy o JOIN app.occupancy_member m ON m.org_id=o.org_id AND m.occupancy_id=o.id
   WHERE o.org_id=org AND o.id=i.occupancy_id AND o.unit_id=i.unit_id AND m.id=i.occupant_id AND m.user_id=i.applicant_id)
  THEN RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id)); END IF;
  RETURN jsonb_build_object('code','STATE_CONFLICT');
 ELSIF p_action='REJECT' AND i.state='REJECTED' THEN RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id));
 END IF;
 IF i.state<>'REQUESTED' THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
 IF p_action='REJECT' THEN
  UPDATE core_onboarding.invitation SET state='REJECTED',decided_by=actor,decided_at=clock_timestamp() WHERE id=i.id;
  RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id));
 END IF;
 -- Keep the applicant active through COMMIT; their old browser session need not remain open.
 PERFORM id FROM app.app_user WHERE id=ANY(ARRAY[actor,i.applicant_id,i.creator_id]) ORDER BY id FOR SHARE;
 IF authn.current_actor(p_digest) IS NULL THEN RETURN jsonb_build_object('code','UNAUTHENTICATED'); END IF;
 IF core_onboarding.is_admin(actor,org) IS DISTINCT FROM member THEN RETURN jsonb_build_object('code','FORBIDDEN'); END IF;
 IF core_onboarding.is_admin(i.creator_id,org) IS DISTINCT FROM i.creator_membership_id THEN RETURN jsonb_build_object('code','NOT_FOUND'); END IF;
 IF NOT EXISTS(SELECT 1 FROM app.app_user WHERE id=i.applicant_id AND status='ACTIVE') THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
 IF i.expires_at<=clock_timestamp() THEN
  UPDATE core_onboarding.invitation SET state='EXPIRED' WHERE id=i.id;RETURN jsonb_build_object('code','STATE_CONFLICT');
 END IF;
 IF EXISTS(SELECT 1 FROM app.occupancy WHERE org_id=org AND unit_id=unit_key AND status='ACTIVE') THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END IF;
 BEGIN
  INSERT INTO app.occupancy(org_id,unit_id,starts_at,status) VALUES(org,unit_key,clock_timestamp(),'ACTIVE') RETURNING id INTO created_occ;
  INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES(org,created_occ,i.applicant_id,clock_timestamp(),'ACTIVE') RETURNING id INTO created_member;
  UPDATE core_onboarding.invitation SET state='APPROVED',decided_by=actor,decided_at=clock_timestamp(),occupancy_id=created_occ,occupant_id=created_member WHERE id=i.id;
 EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('code','STATE_CONFLICT'); END;
 RETURN jsonb_build_object('data',core_onboarding.view_invitation(i.id));
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core_onboarding FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA core_onboarding FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_onboarding.command(bytea,text,uuid,jsonb) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_onboarding FROM bm_core_onboarding_owner;

-- Vendor Secure Handoff v1 foundation. Production roles are pre-provisioned; this migration only validates them.
DO $vendor_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='bm_vendor_handoff_owner'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit
  ) THEN RAISE EXCEPTION 'VENDOR_HANDOFF_OWNER_CONTRACT_INVALID'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname='bm_vendor_web'
      AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit
  ) THEN RAISE EXCEPTION 'VENDOR_WEB_ROLE_CONTRACT_INVALID'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
    JOIN pg_catalog.pg_roles u ON u.oid=m.member
    WHERE r.rolname='bm_vendor_handoff_owner' AND u.rolname=current_user
      AND NOT m.inherit_option AND m.set_option AND NOT m.admin_option
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
    JOIN pg_catalog.pg_roles u ON u.oid=m.member
    WHERE r.rolname='bm_vendor_handoff_owner'
      AND u.rolname IN ('bm_vendor_web','bm_b1_web')
  ) THEN RAISE EXCEPTION 'VENDOR_HANDOFF_ROLE_MEMBERSHIP_INVALID'; END IF;
END
$vendor_preflight$;

CREATE SCHEMA vendor_handoff;
REVOKE ALL ON SCHEMA vendor_handoff FROM PUBLIC;
GRANT USAGE ON SCHEMA vendor_handoff TO bm_vendor_web,bm_b1_web;
ALTER SCHEMA vendor_handoff OWNER TO bm_vendor_handoff_owner;
GRANT USAGE ON SCHEMA app,core_flow TO bm_vendor_handoff_owner;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_vendor_handoff_owner;

SET LOCAL ROLE bm_vendor_handoff_owner;

CREATE TABLE vendor_handoff.vendor_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  ticket_id text NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  vendor_label text NOT NULL CHECK(char_length(vendor_label) BETWEEN 1 AND 80),
  status text NOT NULL CHECK(status IN ('PREPARING','OFFERED','ACTIVE','ENDED')),
  end_reason text NULL CHECK(end_reason IS NULL OR end_reason IN ('DECLINED','WITHDRAWN','REVOKED','SUPERSEDED','CLOSED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ended_at timestamptz NULL,
  CHECK((status='ENDED')=(end_reason IS NOT NULL)),
  CHECK((status='ENDED')=(ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX vendor_assignment_one_current
  ON vendor_handoff.vendor_assignment(org_id,ticket_id)
  WHERE status IN ('PREPARING','OFFERED','ACTIVE');

CREATE TABLE vendor_handoff.work_packet_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  revision integer NOT NULL CHECK(revision>0),
  body jsonb NOT NULL CHECK(octet_length(body::text)<=131072),
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(assignment_id,revision)
);

CREATE TABLE vendor_handoff.work_packet_source_photo (
  org_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL REFERENCES vendor_handoff.work_packet_revision(id),
  source_photo_id uuid NOT NULL,
  PRIMARY KEY(packet_revision_id,source_photo_id)
);

CREATE TABLE vendor_handoff.vendor_capability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  digest bytea NOT NULL UNIQUE CHECK(octet_length(digest)=32),
  -- Request uniqueness belongs to the org/actor-scoped command receipt, not a cross-org global key.
  issue_request_id uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  redeem_request_id uuid NULL,
  redeemed_at timestamptz NULL,
  superseded_at timestamptz NULL,
  revoked_at timestamptz NULL,
  CHECK(expires_at>issued_at)
);
CREATE UNIQUE INDEX vendor_capability_one_current
  ON vendor_handoff.vendor_capability(assignment_id)
  WHERE redeemed_at IS NULL AND superseded_at IS NULL AND revoked_at IS NULL;

CREATE TABLE vendor_handoff.vendor_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  capability_id uuid NOT NULL REFERENCES vendor_handoff.vendor_capability(id),
  digest bytea NOT NULL UNIQUE CHECK(octet_length(digest)=32),
  csrf_digest bytea NOT NULL CHECK(octet_length(csrf_digest)=32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  CHECK(expires_at>created_at)
);
CREATE UNIQUE INDEX vendor_session_one_active
  ON vendor_handoff.vendor_session(assignment_id)
  WHERE revoked_at IS NULL;

CREATE TABLE vendor_handoff.command_receipt (
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  actor_scope text NOT NULL CHECK(actor_scope IN ('MANAGER','TENANT','VENDOR')),
  actor_id text NOT NULL CHECK(char_length(actor_id) BETWEEN 1 AND 256),
  request_key uuid NOT NULL,
  fingerprint bytea NOT NULL CHECK(octet_length(fingerprint)=32),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(org_id,actor_scope,actor_id,request_key)
);

ALTER TABLE vendor_handoff.vendor_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_assignment FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.work_packet_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.work_packet_revision FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.work_packet_source_photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.work_packet_source_photo FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_capability ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_capability FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_session FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.command_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.command_receipt FORCE ROW LEVEL SECURITY;

CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.vendor_assignment TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.vendor_assignment AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.work_packet_revision TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.work_packet_revision AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.work_packet_source_photo TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.work_packet_source_photo AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.command_receipt TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.command_receipt AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.vendor_capability TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_capability_digest_bootstrap ON vendor_handoff.vendor_capability FOR SELECT TO bm_vendor_handoff_owner
  USING(digest=CASE WHEN NULLIF(current_setting('app.vendor_capability_digest',true),'') ~ '^[a-f0-9]{64}$'
                    THEN decode(current_setting('app.vendor_capability_digest',true),'hex') ELSE NULL END);
CREATE POLICY vendor_capability_bootstrap_ceiling ON vendor_handoff.vendor_capability AS RESTRICTIVE FOR SELECT TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id() OR digest=CASE WHEN NULLIF(current_setting('app.vendor_capability_digest',true),'') ~ '^[a-f0-9]{64}$'
                    THEN decode(current_setting('app.vendor_capability_digest',true),'hex') ELSE NULL END);
CREATE POLICY vendor_capability_insert_ceiling ON vendor_handoff.vendor_capability AS RESTRICTIVE FOR INSERT TO bm_vendor_handoff_owner
  WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_capability_update_ceiling ON vendor_handoff.vendor_capability AS RESTRICTIVE FOR UPDATE TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_capability_delete_ceiling ON vendor_handoff.vendor_capability AS RESTRICTIVE FOR DELETE TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id());

CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.vendor_session TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_session_digest_bootstrap ON vendor_handoff.vendor_session FOR SELECT TO bm_vendor_handoff_owner
  USING(digest=CASE WHEN NULLIF(current_setting('app.vendor_session_digest',true),'') ~ '^[a-f0-9]{64}$'
                    THEN decode(current_setting('app.vendor_session_digest',true),'hex') ELSE NULL END);
CREATE POLICY vendor_session_bootstrap_ceiling ON vendor_handoff.vendor_session AS RESTRICTIVE FOR SELECT TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id() OR digest=CASE WHEN NULLIF(current_setting('app.vendor_session_digest',true),'') ~ '^[a-f0-9]{64}$'
                    THEN decode(current_setting('app.vendor_session_digest',true),'hex') ELSE NULL END);
CREATE POLICY vendor_session_insert_ceiling ON vendor_handoff.vendor_session AS RESTRICTIVE FOR INSERT TO bm_vendor_handoff_owner
  WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_session_update_ceiling ON vendor_handoff.vendor_session AS RESTRICTIVE FOR UPDATE TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_session_delete_ceiling ON vendor_handoff.vendor_session AS RESTRICTIVE FOR DELETE TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id());

RESET ROLE;

-- Narrow Core bridge capabilities. They own Core table access; Vendor roles never receive Core table grants.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.vendor_handoff_lock_ticket(p_org uuid,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;
BEGIN
  PERFORM set_config('app.org_id',p_org::text,true);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=p_org AND id=p_ticket FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('orgId',t.org_id,'ticketId',t.id,'unitId',t.unit_id,'workStatus',t.work_status,'ticketVersion',t.version);
END $$;

CREATE FUNCTION core_flow.vendor_handoff_manager_context(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;t core_flow.ticket;
BEGIN
  s:=core_flow.session(p_digest);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(s->>'orgId')::uuid AND id=p_ticket;
  IF t.id IS NULL OR (s->>'role'<>'ORG_ADMIN' AND (s->>'role'<>'PROPERTY_STAFF' OR NOT authn.can_read_property(p_digest,t.org_id,t.property_id)))
    OR NOT core_flow.can_unit(p_digest,t.unit_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('orgId',t.org_id,'ticketId',t.id,'unitId',t.unit_id);
END $$;

CREATE FUNCTION core_flow.vendor_handoff_tenant_context(p_digest bytea,p_ticket text,p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;t core_flow.ticket;m uuid;o_id uuid;
BEGIN
  s:=core_flow.session(p_digest);
  IF s->>'role'<>'TENANT' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(s->>'orgId')::uuid AND id=p_ticket;
  IF t.id IS NULL OR t.tenant_id<>(s->>'actorId')::uuid OR NOT core_flow.can_unit(p_digest,t.unit_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF p_lock THEN SELECT * INTO t FROM core_flow.ticket WHERE org_id=(s->>'orgId')::uuid AND id=p_ticket FOR UPDATE;
  ELSE SELECT * INTO t FROM core_flow.ticket WHERE org_id=(s->>'orgId')::uuid AND id=p_ticket; END IF;
  s:=core_flow.session(p_digest);
  IF s->>'role'<>'TENANT' OR t.id IS NULL OR t.tenant_id<>(s->>'actorId')::uuid OR NOT core_flow.can_unit(p_digest,t.unit_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  SELECT om.id,o.id INTO m,o_id FROM app.occupancy o JOIN app.occupancy_member om
    ON om.org_id=o.org_id AND om.occupancy_id=o.id
    WHERE o.org_id=t.org_id AND o.unit_id=t.unit_id AND o.status='ACTIVE'
      AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp())
      AND om.user_id=(s->>'actorId')::uuid AND om.status='ACTIVE' AND om.joined_at<=clock_timestamp()
    ORDER BY om.joined_at,om.id LIMIT 1;
  IF m IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('orgId',t.org_id,'ticketId',t.id,'unitId',t.unit_id,'occupancyId',o_id,'occupancyMemberId',m,'ticketVersion',t.version);
END $$;

CREATE FUNCTION core_flow.vendor_handoff_recheck_occupancy(p_org uuid,p_ticket text,p_occupancy_member uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;
BEGIN
  PERFORM set_config('app.org_id',p_org::text,true);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=p_org AND id=p_ticket;
  IF t.id IS NULL THEN RETURN false; END IF;
  RETURN EXISTS(
    SELECT 1 FROM app.occupancy o JOIN app.occupancy_member om ON om.org_id=o.org_id AND om.occupancy_id=o.id
    WHERE o.org_id=p_org AND o.unit_id=t.unit_id AND o.status='ACTIVE'
      AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp())
      AND om.id=p_occupancy_member AND om.status='ACTIVE' AND om.joined_at<=clock_timestamp()
  );
END $$;

CREATE FUNCTION core_flow.vendor_handoff_source(p_digest bytea,p_ticket text,p_photo_ids uuid[],p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;actor jsonb;t core_flow.ticket;b jsonb;photos jsonb;unit_label text;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  actor:=core_flow.session(p_digest);
  IF p_lock THEN PERFORM core_flow.vendor_handoff_lock_ticket((c->>'orgId')::uuid,p_ticket); END IF;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket;
  SELECT body INTO b FROM core_flow.building_context WHERE org_id=t.org_id AND property_id=t.property_id;
  SELECT label INTO unit_label FROM app.unit WHERE org_id=t.org_id AND id=t.unit_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('photoId',p.id,'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height)
    ORDER BY p.id),'[]'::jsonb) INTO photos
    FROM core_flow.ticket_photo p WHERE p.org_id=t.org_id AND p.ticket_id=t.id AND (p_photo_ids IS NULL OR p.id=ANY(p_photo_ids));
  RETURN jsonb_build_object('actorId',actor->>'actorId','orgId',t.org_id,'ticketId',t.id,'propertyId',t.property_id,'unitId',t.unit_id,'unitLabel',unit_label,
    'ticketVersion',t.version,'workStatus',t.work_status,'ticket',t.body,'building',b,'photos',photos);
END $$;

CREATE FUNCTION core_flow.vendor_handoff_source_photo(p_org uuid,p_ticket text,p_photo uuid)
RETURNS TABLE(metadata jsonb,content bytea)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p core_flow.ticket_photo;
BEGIN
  PERFORM set_config('app.org_id',p_org::text,true);
  SELECT * INTO p FROM core_flow.ticket_photo WHERE org_id=p_org AND ticket_id=p_ticket AND id=p_photo;
  IF p.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN QUERY SELECT jsonb_build_object('photoId',p.id,'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height),p.content;
END $$;

CREATE FUNCTION core_flow.vendor_handoff_mark_offered(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;actor jsonb;t core_flow.ticket;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket FOR UPDATE;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  IF t.work_status='OPEN' THEN
    actor:=core_flow.session(p_digest);
    UPDATE core_flow.ticket SET work_status='IN_PROGRESS',version=version+1,updated_at=clock_timestamp() WHERE org_id=t.org_id AND id=t.id RETURNING * INTO t;
    INSERT INTO core_flow.ticket_event(ticket_id,org_id,actor_id,actor_role,kind,message)
      VALUES(t.id,t.org_id,(actor->>'actorId')::uuid,actor->>'role','HANDLING','외부 업체 작업 요청을 시작했습니다.');
  END IF;
  RETURN jsonb_build_object('orgId',t.org_id,'ticketId',t.id,'workStatus',t.work_status,'ticketVersion',t.version);
END $$;

REVOKE ALL ON FUNCTION core_flow.vendor_handoff_lock_ticket(uuid,text),
  core_flow.vendor_handoff_manager_context(bytea,text),
  core_flow.vendor_handoff_tenant_context(bytea,text,boolean),
  core_flow.vendor_handoff_recheck_occupancy(uuid,text,uuid),
  core_flow.vendor_handoff_source(bytea,text,uuid[],boolean),
  core_flow.vendor_handoff_source_photo(uuid,text,uuid),
  core_flow.vendor_handoff_mark_offered(bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.vendor_handoff_lock_ticket(uuid,text),
  core_flow.vendor_handoff_manager_context(bytea,text),
  core_flow.vendor_handoff_tenant_context(bytea,text,boolean),
  core_flow.vendor_handoff_recheck_occupancy(uuid,text,uuid),
  core_flow.vendor_handoff_source(bytea,text,uuid[],boolean),
  core_flow.vendor_handoff_source_photo(uuid,text,uuid),
  core_flow.vendor_handoff_mark_offered(bytea,text) TO bm_vendor_handoff_owner;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

-- Vendor-schema capabilities. All durable access is owner-only and FORCE-RLS constrained.
SET LOCAL ROLE bm_vendor_handoff_owner;

-- Private receipt helpers: execute is never granted to either runtime.
CREATE FUNCTION vendor_handoff.request_fingerprint(p_payload jsonb) RETURNS bytea
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT sha256(convert_to(p_payload::text,'UTF8')) $$;

CREATE FUNCTION vendor_handoff.receipt(p_org uuid,p_scope text,p_actor text,p_request uuid,p_fingerprint bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r vendor_handoff.command_receipt;
BEGIN
  IF p_request IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  SELECT * INTO r FROM vendor_handoff.command_receipt
    WHERE org_id=p_org AND actor_scope=p_scope AND actor_id=p_actor AND request_key=p_request;
  IF r.request_key IS NULL THEN RETURN NULL; END IF;
  IF r.fingerprint<>p_fingerprint THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  RETURN r.result;
END $$;

CREATE FUNCTION vendor_handoff.immutable_packet() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_PACKET'; END $$;
CREATE TRIGGER work_packet_revision_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.work_packet_revision
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_packet();
CREATE TRIGGER work_packet_source_photo_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.work_packet_source_photo
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_packet();

-- Shared exact issue-specific projection for Manager preview and packet publication.
-- Source contains private Core data only inside this owner boundary; result contains no raw answers.
CREATE FUNCTION vendor_handoff.packet_detail_candidates(s jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE details jsonb:='[]'::jsonb;key text;answer jsonb;detail jsonb;label text;value text;
BEGIN
  FOREACH key IN ARRAY ARRAY['leak.active','leak.applianceOnly','leak.location','heating.hotWater','heating.allRooms','heating.powerOn','heating.unitOnly','heating.controllerAbnormal','heatingType','managementMode','primaryUse','approvalYear'] LOOP
    detail:=NULL;value:=NULL;label:=NULL;
    IF (s->'ticket'->>'issueType'='LEAK' AND key IN ('leak.active','leak.applianceOnly'))
      OR (s->'ticket'->>'issueType'='HEATING' AND key IN ('heating.hotWater','heating.allRooms','heating.powerOn','heating.unitOnly','heating.controllerAbnormal')) THEN
      SELECT x->'value' INTO answer FROM jsonb_array_elements(coalesce(s->'ticket'->'answers','[]'::jsonb)) x WHERE x->>'questionId'=key;
      IF jsonb_typeof(answer)='boolean' THEN
        value:=CASE WHEN answer='true'::jsonb THEN '예' ELSE '아니요' END;
        label:=CASE key WHEN 'leak.active' THEN '현재 누수' WHEN 'leak.applianceOnly' THEN '기기 사용 시 누수'
          WHEN 'heating.hotWater' THEN '온수 사용' WHEN 'heating.allRooms' THEN '모든 방 난방' WHEN 'heating.powerOn' THEN '전원 상태'
          WHEN 'heating.unitOnly' THEN '해당 호실만 발생' WHEN 'heating.controllerAbnormal' THEN '조절기 이상' END;
      END IF;
      IF value IS NOT NULL THEN detail:=jsonb_build_object('key',key,'label',label,'value',value,'sourceType','TENANT_REPORTED'); END IF;
    ELSIF s->'ticket'->>'issueType'='LEAK' AND key='leak.location' THEN
      SELECT x->>'value' INTO value FROM jsonb_array_elements(coalesce(s->'ticket'->'answers','[]'::jsonb)) x WHERE x->>'questionId'=key;
      label:=CASE value WHEN 'CEILING_WALL' THEN '천장 또는 벽' WHEN 'SINK_BATHROOM_FIXTURE' THEN '싱크대·욕실 설비' WHEN 'APPLIANCE' THEN '특정 기기' WHEN 'UNKNOWN' THEN '잘 모르겠음' END;
      IF label IS NOT NULL THEN detail:=jsonb_build_object('key',key,'label','누수 위치','value',label,'sourceType','TENANT_REPORTED'); END IF;
    ELSIF key IN ('heatingType','managementMode','primaryUse','approvalYear') THEN
      SELECT x->>'value' INTO value FROM jsonb_array_elements(coalesce(s->'building'->'context','[]'::jsonb)) x
        WHERE x->>'key'=key AND x->>'verified'='true' AND x->'value'<>'null'::jsonb AND jsonb_typeof(x->'value') IN ('string','number');
      label:=CASE key WHEN 'heatingType' THEN '난방 방식' WHEN 'managementMode' THEN '관리 방식' WHEN 'primaryUse' THEN '건물 용도' WHEN 'approvalYear' THEN '승인 연도' END;
      IF value IS NOT NULL AND char_length(value) BETWEEN 1 AND 500 THEN detail:=jsonb_build_object('key',key,'label',label,'value',value,'sourceType','BUILDING_VERIFIED'); END IF;
    END IF;
    IF detail IS NOT NULL THEN details:=details || jsonb_build_array(detail); END IF;
  END LOOP;
  RETURN details;
END $$;

CREATE FUNCTION vendor_handoff.manager_read(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;s jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;phase text:='ENDED';
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  s:=core_flow.vendor_handoff_source(p_digest,p_ticket,NULL,false);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment
    WHERE org_id=(c->>'orgId')::uuid AND ticket_id=p_ticket ORDER BY created_at DESC,id DESC LIMIT 1;
  IF a.id IS NOT NULL THEN
    SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
    phase:=CASE WHEN a.status='ENDED' THEN 'ENDED' WHEN a.status='OFFERED' THEN 'OFFERED' ELSE 'IN_PROGRESS' END;
  END IF;
  RETURN jsonb_build_object('ticketId',p_ticket,'assignment',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',a.id,'status',a.status,'endReason',a.end_reason,'vendorLabel',a.vendor_label,'version',a.version) END,
    'currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,'currentRound',NULL,'appointment',NULL,'activeBlocker',NULL,
    'currentReport',NULL,'reportHistory','[]'::jsonb,'phase',phase,'waitingOn','NONE',
    'packetSource',jsonb_build_object('jobReference',p_ticket,'buildingName',s->'building'->>'displayName',
      'serviceAddress',nullif(btrim(s->'building'->>'serviceAddress'),''),'unitLabel',nullif(btrim(s->>'unitLabel'),''),
      'issueType',s->'ticket'->>'issueType','sharedDetails',vendor_handoff.packet_detail_candidates(s),
      'sourcePhotoIds',coalesce((SELECT jsonb_agg(x->'photoId') FROM jsonb_array_elements(s->'photos') x),'[]'::jsonb),'safetyNotice','[]'::jsonb));
END $$;

CREATE FUNCTION vendor_handoff.manager_create_assignment(
  p_digest bytea,p_ticket text,p_request uuid,p_expected_ticket_version bigint,p_vendor_label text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;a vendor_handoff.vendor_assignment;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_ticket_version IS NULL OR p_expected_ticket_version<1 OR p_vendor_label IS NULL OR char_length(btrim(p_vendor_label)) NOT BETWEEN 1 AND 80
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  s:=core_flow.vendor_handoff_source(p_digest,p_ticket,'{}'::uuid[],true);
  PERFORM set_config('app.org_id',s->>'orgId',true);
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('createAssignment',p_ticket,p_expected_ticket_version,btrim(p_vendor_label)));
  prior:=vendor_handoff.receipt((s->>'orgId')::uuid,'MANAGER',s->>'actorId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF (s->>'ticketVersion')::bigint<>p_expected_ticket_version
    OR s->>'workStatus'='COMPLETED'
    OR s->'ticket'->>'status'='SAFETY_ESCALATED'
    OR jsonb_array_length(coalesce(s->'ticket'->'safetyFlags','[]'::jsonb))>0
    OR coalesce(s->'ticket'->'repairPacket'->'safety'->>'escalated','false')='true'
    OR coalesce(s->'ticket'->'routeDecision'->>'selectedRoute','') NOT IN ('GENERAL_VENDOR','MANUFACTURER_AS')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM vendor_handoff.vendor_assignment WHERE org_id=(s->>'orgId')::uuid AND ticket_id=p_ticket AND status IN ('PREPARING','OFFERED','ACTIVE'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.vendor_assignment(org_id,ticket_id,property_id,unit_id,vendor_label,status)
    VALUES((s->>'orgId')::uuid,p_ticket,(s->>'propertyId')::uuid,(s->>'unitId')::uuid,btrim(p_vendor_label),'PREPARING')
    RETURNING * INTO a;
  result:=vendor_handoff.manager_read(p_digest,p_ticket);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'MANAGER',s->>'actorId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.manager_publish_packet(
  p_digest bytea,p_assignment uuid,p_request uuid,p_expected_assignment bigint,p_expected_packet uuid,
  p_work_summary text,p_shared_keys text[],p_photo_ids uuid[],p_access_policy text,p_access_instruction text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;s jsonb;current_id uuid;rev integer;b jsonb;details jsonb:='[]'::jsonb;
  fp bytea;prior jsonb;result jsonb;key text;answer jsonb;detail jsonb;label text;value text;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_access_policy IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  s:=core_flow.vendor_handoff_source(p_digest,a.ticket_id,coalesce(p_photo_ids,'{}'::uuid[]),true);
  PERFORM set_config('app.org_id',s->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment AND org_id=(s->>'orgId')::uuid FOR UPDATE;
  IF a.id IS NULL OR a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF s->'ticket'->>'status'='SAFETY_ESCALATED' OR jsonb_array_length(coalesce(s->'ticket'->'safetyFlags','[]'::jsonb))>0
    OR coalesce(s->'ticket'->'repairPacket'->'safety'->>'escalated','false')='true'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('publishPacket',p_assignment,p_expected_assignment,p_expected_packet,
    btrim(p_work_summary),p_shared_keys,p_photo_ids,p_access_policy,btrim(p_access_instruction)));
  prior:=vendor_handoff.receipt(a.org_id,'MANAGER',s->>'actorId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT id INTO current_id FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  IF a.id IS NULL OR a.version<>p_expected_assignment OR current_id IS DISTINCT FROM p_expected_packet
    OR p_work_summary IS NULL OR char_length(btrim(p_work_summary)) NOT BETWEEN 1 AND 1000
    OR p_access_policy NOT IN ('TENANT_PRESENT_REQUIRED','TENANT_PREAUTHORIZATION_ALLOWED')
    OR (p_access_instruction IS NOT NULL AND char_length(btrim(p_access_instruction)) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF coalesce(btrim(s->'building'->>'serviceAddress'),'')='' OR coalesce(btrim(s->>'unitLabel'),'')=''
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ADDRESS_REQUIRED'; END IF;
  IF p_shared_keys IS NULL OR p_photo_ids IS NULL OR cardinality(p_photo_ids)<>jsonb_array_length(s->'photos')
    OR cardinality(p_photo_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_photo_ids) x)
    OR cardinality(p_shared_keys)<>(SELECT count(DISTINCT x) FROM unnest(p_shared_keys) x)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SELECTION'; END IF;
  -- Two-stage sharing: bounded issue-specific structured values, then exact Manager selection.
  -- Free-text answers and unverified building data are never candidates.
  FOREACH key IN ARRAY p_shared_keys LOOP
    SELECT x INTO detail FROM jsonb_array_elements(vendor_handoff.packet_detail_candidates(s)) x WHERE x->>'key'=key;
    IF detail IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_SELECTION'; END IF;
    details:=details || jsonb_build_array(detail);
  END LOOP;
  rev:=coalesce((SELECT max(revision) FROM vendor_handoff.work_packet_revision WHERE assignment_id=a.id),0)+1;
  b:=jsonb_build_object('id',gen_random_uuid(),'assignmentId',a.id,'jobReference',a.ticket_id,'vendorLabel',a.vendor_label,'revision',rev,
    'publishedAt',clock_timestamp(),'buildingName',coalesce(s->'building'->>'displayName',''),'serviceAddress',s->'building'->>'serviceAddress',
    'unitLabel',s->>'unitLabel','issueType',s->'ticket'->>'issueType','workSummary',btrim(p_work_summary),
    'sharedDetails',details,'allowedPhotoIds',coalesce(to_jsonb(p_photo_ids),'[]'::jsonb),
    -- Existing eligible Core sources have no non-escalating notice vocabulary. Never publish raw text as a notice.
    'safetyNotice','[]'::jsonb,'accessPolicy',p_access_policy,
    'accessInstruction',CASE WHEN p_access_instruction IS NULL THEN NULL ELSE btrim(p_access_instruction) END);
  INSERT INTO vendor_handoff.work_packet_revision(id,org_id,assignment_id,revision,body)
    VALUES((b->>'id')::uuid,a.org_id,a.id,rev,b);
  INSERT INTO vendor_handoff.work_packet_source_photo(org_id,packet_revision_id,source_photo_id)
    SELECT a.org_id,(b->>'id')::uuid,x FROM unnest(coalesce(p_photo_ids,'{}'::uuid[])) x;
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  result:=vendor_handoff.manager_read(p_digest,a.ticket_id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'MANAGER',s->>'actorId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.manager_issue_link(
  p_digest bytea,p_assignment uuid,p_request uuid,p_expected_assignment bigint,p_expected_packet uuid,
  p_capability_digest bytea,p_reissue boolean
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;c vendor_handoff.vendor_capability;s jsonb;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_capability_digest IS NULL OR octet_length(p_capability_digest)<>32
    OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL OR p_reissue IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  s:=core_flow.vendor_handoff_source(p_digest,a.ticket_id,'{}'::uuid[],true);
  PERFORM set_config('app.org_id',s->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment AND org_id=(s->>'orgId')::uuid FOR UPDATE;
  IF a.id IS NULL OR a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('issueLink',p_assignment,p_expected_assignment,p_expected_packet,p_reissue));
  IF s->'ticket'->>'status'='SAFETY_ESCALATED' OR jsonb_array_length(coalesce(s->'ticket'->'safetyFlags','[]'::jsonb))>0
    OR coalesce(s->'ticket'->'repairPacket'->'safety'->>'escalated','false')='true'
    OR coalesce(s->'ticket'->'routeDecision'->>'selectedRoute','') NOT IN ('GENERAL_VENDOR','MANUFACTURER_AS')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  prior:=vendor_handoff.receipt(a.org_id,'MANAGER',s->>'actorId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  IF a.id IS NULL OR a.version<>p_expected_assignment OR p.id IS NULL OR p.id<>p_expected_packet
    OR (NOT p_reissue AND a.status<>'PREPARING') OR (p_reissue AND a.status NOT IN ('OFFERED','ACTIVE'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF p_reissue THEN
    -- Retire redemption authority as well as unredeemed links; existing sessions remain valid until replacement redemption.
    UPDATE vendor_handoff.vendor_capability SET superseded_at=clock_timestamp()
      WHERE org_id=a.org_id AND assignment_id=a.id AND superseded_at IS NULL AND revoked_at IS NULL;
  ELSIF EXISTS(
    SELECT 1 FROM vendor_handoff.vendor_capability
    WHERE org_id=a.org_id AND assignment_id=a.id AND redeemed_at IS NULL AND superseded_at IS NULL AND revoked_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';
  END IF;
  INSERT INTO vendor_handoff.vendor_capability(org_id,assignment_id,digest,issue_request_id,expires_at)
    VALUES(a.org_id,a.id,p_capability_digest,p_request,clock_timestamp()+interval '72 hours') RETURNING * INTO c;
  IF a.status='PREPARING' THEN
    UPDATE vendor_handoff.vendor_assignment SET status='OFFERED',version=version+1 WHERE id=a.id RETURNING * INTO a;
    PERFORM core_flow.vendor_handoff_mark_offered(p_digest,a.ticket_id);
  END IF;
  result:=jsonb_build_object('created',false,'assignmentId',a.id,'assignmentVersion',a.version,'expiresAt',c.expires_at);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'MANAGER',s->>'actorId',p_request,fp,result);
  RETURN result || jsonb_build_object('created',true);
END $$;

CREATE FUNCTION vendor_handoff.session_info(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s vendor_handoff.vendor_session;a vendor_handoff.vendor_assignment;
BEGIN
  IF p_digest IS NULL OR octet_length(p_digest)<>32 THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM set_config('app.vendor_session_digest',encode(p_digest,'hex'),true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_digest;
  IF s.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM set_config('app.org_id',s.org_id::text,true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE id=s.id AND revoked_at IS NULL AND expires_at>clock_timestamp();
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=s.assignment_id AND org_id=s.org_id;
  IF s.id IS NULL OR a.id IS NULL OR a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  RETURN jsonb_build_object('assignmentId',a.id,'expiresAt',s.expires_at);
END $$;

CREATE FUNCTION vendor_handoff.redeem(
  p_token_digest bytea,p_request uuid,p_session_digest bytea,p_csrf_digest bytea
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c vendor_handoff.vendor_capability;a vendor_handoff.vendor_assignment;s vendor_handoff.vendor_session;lineage vendor_handoff.vendor_session;t jsonb;
  route_org uuid;route_assignment uuid;route_ticket text;fp bytea;prior jsonb;result jsonb;expiry timestamptz;
BEGIN
  IF p_token_digest IS NULL OR octet_length(p_token_digest)<>32 OR p_request IS NULL
    OR p_session_digest IS NULL OR octet_length(p_session_digest)<>32 OR p_csrf_digest IS NULL OR octet_length(p_csrf_digest)<>32
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM set_config('app.vendor_capability_digest',encode(p_token_digest,'hex'),true);
  SELECT * INTO c FROM vendor_handoff.vendor_capability WHERE digest=p_token_digest;
  IF c.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM set_config('app.org_id',c.org_id::text,true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=c.assignment_id AND org_id=c.org_id;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  route_org:=c.org_id;route_assignment:=a.id;route_ticket:=a.ticket_id;
  t:=core_flow.vendor_handoff_lock_ticket(route_org,route_ticket);
  PERFORM set_config('app.org_id',route_org::text,true);
  -- Re-read authority after the wait, then assignment, then subordinate capability/session.
  SELECT * INTO c FROM vendor_handoff.vendor_capability WHERE digest=p_token_digest AND org_id=route_org AND assignment_id=route_assignment;
  IF c.id IS NULL OR c.revoked_at IS NOT NULL OR c.superseded_at IS NOT NULL OR c.expires_at<=clock_timestamp()
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=route_assignment AND org_id=route_org AND ticket_id=route_ticket AND status IN ('OFFERED','ACTIVE') FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO c FROM vendor_handoff.vendor_capability WHERE digest=p_token_digest AND org_id=route_org AND assignment_id=a.id FOR UPDATE;
  IF c.redeemed_at IS NOT NULL AND c.redeem_request_id IS DISTINCT FROM p_request
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('redeem',a.id,encode(p_token_digest,'hex')));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',c.id::text,p_request,fp);
  expiry:=CASE WHEN prior IS NULL THEN clock_timestamp()+interval '7 days' ELSE (prior->>'expiresAt')::timestamptz END;
  IF prior IS NOT NULL THEN
    SELECT * INTO lineage FROM vendor_handoff.vendor_session
      WHERE assignment_id=a.id AND org_id=a.org_id AND capability_id=c.id AND revoked_at IS NULL FOR UPDATE;
    IF lineage.id IS NULL OR lineage.expires_at<=clock_timestamp()
    THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  END IF;
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_session_digest;
  IF s.id IS NOT NULL THEN
    IF s.assignment_id<>a.id OR s.org_id<>a.org_id OR s.capability_id<>c.id OR s.csrf_digest<>p_csrf_digest
      OR s.revoked_at IS NOT NULL OR prior IS NULL OR s.id IS DISTINCT FROM lineage.id
    THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
    RETURN prior;
  END IF;
  UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp()
    WHERE assignment_id=a.id AND org_id=a.org_id AND revoked_at IS NULL AND (prior IS NULL OR id=lineage.id);
  INSERT INTO vendor_handoff.vendor_session(org_id,assignment_id,capability_id,digest,csrf_digest,expires_at)
    VALUES(a.org_id,a.id,c.id,p_session_digest,p_csrf_digest,expiry) RETURNING * INTO s;
  IF c.redeemed_at IS NULL THEN UPDATE vendor_handoff.vendor_capability SET redeem_request_id=p_request,redeemed_at=clock_timestamp() WHERE id=c.id; END IF;
  result:=jsonb_build_object('assignmentId',a.id,'expiresAt',s.expires_at);
  IF prior IS NULL THEN
    INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
      VALUES(a.org_id,a.id,'VENDOR',c.id::text,p_request,fp,result);
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.logout(p_session_digest bytea,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s vendor_handoff.vendor_session;a vendor_handoff.vendor_assignment;
  route_org uuid;route_assignment uuid;route_ticket text;initial_revoked boolean;fp bytea;prior jsonb;
BEGIN
  IF p_request IS NULL OR p_session_digest IS NULL OR octet_length(p_session_digest)<>32
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  PERFORM set_config('app.vendor_session_digest',encode(p_session_digest,'hex'),true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_session_digest;
  IF s.id IS NULL THEN RETURN jsonb_build_object('revoked',true); END IF;
  PERFORM set_config('app.org_id',s.org_id::text,true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=s.assignment_id;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  route_org:=s.org_id;route_assignment:=a.id;route_ticket:=a.ticket_id;initial_revoked:=s.revoked_at IS NOT NULL;
  PERFORM core_flow.vendor_handoff_lock_ticket(route_org,route_ticket);
  PERFORM set_config('app.org_id',route_org::text,true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_session_digest AND org_id=route_org AND assignment_id=route_assignment;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=route_assignment AND org_id=route_org AND ticket_id=route_ticket FOR UPDATE;
  IF s.id IS NULL OR a.id IS NULL OR a.status='ENDED' OR s.expires_at<=clock_timestamp()
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('logout',a.id,encode(p_session_digest,'hex')));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',s.id::text,p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF s.revoked_at IS NOT NULL THEN
    IF initial_revoked THEN RETURN jsonb_build_object('revoked',true); END IF;
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED';
  END IF;
  UPDATE vendor_handoff.vendor_session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE id=s.id;
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',s.id::text,p_request,fp,jsonb_build_object('revoked',true));
  RETURN jsonb_build_object('revoked',true);
END $$;

CREATE FUNCTION vendor_handoff.read_job(p_session_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE session jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;
BEGIN
  session:=vendor_handoff.session_info(p_session_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(session->>'assignmentId')::uuid;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  RETURN jsonb_build_object('assignmentId',a.id,'status',a.status,'endReason',a.end_reason,
    'phase',CASE WHEN a.status='ENDED' THEN 'ENDED' WHEN a.status='OFFERED' THEN 'OFFERED' ELSE 'IN_PROGRESS' END,
    'waitingOn','NONE','currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,
    'currentRound',NULL,'appointment',NULL,'activeBlocker',NULL,'currentReport',NULL);
END $$;

CREATE FUNCTION vendor_handoff.guard_direct_completion(p_digest bytea,p_ticket text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  IF EXISTS(SELECT 1 FROM vendor_handoff.vendor_assignment WHERE org_id=(c->>'orgId')::uuid AND ticket_id=p_ticket AND status IN ('PREPARING','OFFERED','ACTIVE'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA vendor_handoff FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vendor_handoff FROM PUBLIC;

GRANT EXECUTE ON FUNCTION vendor_handoff.manager_read(bytea,text),
  vendor_handoff.manager_create_assignment(bytea,text,uuid,bigint,text),
  vendor_handoff.manager_publish_packet(bytea,uuid,uuid,bigint,uuid,text,text[],uuid[],text,text),
  vendor_handoff.manager_issue_link(bytea,uuid,uuid,bigint,uuid,bytea,boolean)
  TO bm_b1_web;
GRANT EXECUTE ON FUNCTION vendor_handoff.guard_direct_completion(bytea,text) TO bm_b1_web;
GRANT EXECUTE ON FUNCTION vendor_handoff.session_info(bytea),
  vendor_handoff.redeem(bytea,uuid,bytea,bytea),
  vendor_handoff.logout(bytea,uuid),
  vendor_handoff.read_job(bytea)
  TO bm_vendor_web;

RESET ROLE;

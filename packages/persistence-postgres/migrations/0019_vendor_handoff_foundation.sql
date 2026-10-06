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

CREATE SCHEMA vendor_handoff AUTHORIZATION bm_vendor_handoff_owner;
REVOKE ALL ON SCHEMA vendor_handoff FROM PUBLIC;
GRANT USAGE ON SCHEMA vendor_handoff TO bm_vendor_web,bm_b1_web;
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
  THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('actorId',s->>'actorId','orgId',t.org_id,'ticketId',t.id,'propertyId',t.property_id,'unitId',t.unit_id,'ticketVersion',t.version);
END $$;

CREATE FUNCTION core_flow.vendor_handoff_tenant_context(p_digest bytea,p_ticket text,p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;t core_flow.ticket;m uuid;
BEGIN
  s:=core_flow.session(p_digest);
  IF s->>'role'<>'TENANT' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  IF p_lock THEN SELECT * INTO t FROM core_flow.ticket WHERE org_id=(s->>'orgId')::uuid AND id=p_ticket FOR UPDATE;
  ELSE SELECT * INTO t FROM core_flow.ticket WHERE org_id=(s->>'orgId')::uuid AND id=p_ticket; END IF;
  s:=core_flow.session(p_digest);
  IF t.id IS NULL OR t.tenant_id<>(s->>'actorId')::uuid THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  SELECT om.id INTO m FROM app.occupancy o JOIN app.occupancy_member om
    ON om.org_id=o.org_id AND om.occupancy_id=o.id
    WHERE o.org_id=t.org_id AND o.unit_id=t.unit_id AND o.status='ACTIVE'
      AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp())
      AND om.user_id=(s->>'actorId')::uuid AND om.status='ACTIVE' AND om.joined_at<=clock_timestamp()
    ORDER BY om.joined_at,om.id LIMIT 1;
  IF m IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('orgId',t.org_id,'ticketId',t.id,'unitId',t.unit_id,'occupancyMemberId',m,'ticketVersion',t.version);
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
DECLARE c jsonb;t core_flow.ticket;b jsonb;photos jsonb;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  IF p_lock THEN PERFORM core_flow.vendor_handoff_lock_ticket((c->>'orgId')::uuid,p_ticket); END IF;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket;
  SELECT body INTO b FROM core_flow.building_context WHERE org_id=t.org_id AND property_id=t.property_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('photoId',p.id,'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height)
    ORDER BY p.id),'[]'::jsonb) INTO photos
    FROM core_flow.ticket_photo p WHERE p.org_id=t.org_id AND p.ticket_id=t.id AND p.id=ANY(coalesce(p_photo_ids,'{}'::uuid[]));
  RETURN jsonb_build_object('actorId',c->>'actorId','orgId',t.org_id,'ticketId',t.id,'propertyId',t.property_id,'unitId',t.unit_id,
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
DECLARE c jsonb;t core_flow.ticket;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket FOR UPDATE;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  IF t.work_status='OPEN' THEN
    UPDATE core_flow.ticket SET work_status='IN_PROGRESS',version=version+1,updated_at=clock_timestamp() WHERE org_id=t.org_id AND id=t.id RETURNING * INTO t;
    INSERT INTO core_flow.ticket_event(ticket_id,org_id,actor_id,actor_role,kind,message)
      VALUES(t.id,t.org_id,(c->>'actorId')::uuid,'ORG_ADMIN','HANDLING','외부 업체 작업 요청을 시작했습니다.');
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

CREATE FUNCTION vendor_handoff.manager_read(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;phase text:='ENDED';
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
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
    'currentReport',NULL,'reportHistory','[]'::jsonb,'phase',phase,'waitingOn','NONE');
END $$;

CREATE FUNCTION vendor_handoff.manager_create_assignment(
  p_digest bytea,p_ticket text,p_request uuid,p_expected_ticket_version bigint,p_vendor_label text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;a vendor_handoff.vendor_assignment;
BEGIN
  IF p_request IS NULL OR p_expected_ticket_version<1 OR p_vendor_label IS NULL OR char_length(btrim(p_vendor_label)) NOT BETWEEN 1 AND 80
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  s:=core_flow.vendor_handoff_source(p_digest,p_ticket,'{}'::uuid[],true);
  PERFORM set_config('app.org_id',s->>'orgId',true);
  IF (s->>'ticketVersion')::bigint<>p_expected_ticket_version
    OR s->>'workStatus'='COMPLETED'
    OR s->'ticket'->>'status'='SAFETY_ESCALATED'
    OR coalesce(s->'ticket'->'routeDecision'->>'selectedRoute','') NOT IN ('GENERAL_VENDOR','MANUFACTURER_AS')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM vendor_handoff.vendor_assignment WHERE org_id=(s->>'orgId')::uuid AND ticket_id=p_ticket AND status IN ('PREPARING','OFFERED','ACTIVE'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.vendor_assignment(org_id,ticket_id,property_id,unit_id,vendor_label,status)
    VALUES((s->>'orgId')::uuid,p_ticket,(s->>'propertyId')::uuid,(s->>'unitId')::uuid,btrim(p_vendor_label),'PREPARING')
    RETURNING * INTO a;
  RETURN vendor_handoff.manager_read(p_digest,p_ticket);
END $$;

CREATE FUNCTION vendor_handoff.manager_publish_packet(
  p_digest bytea,p_assignment uuid,p_request uuid,p_expected_assignment bigint,p_expected_packet uuid,
  p_work_summary text,p_shared_keys text[],p_photo_ids uuid[],p_access_policy text,p_access_instruction text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;s jsonb;current_id uuid;rev integer;b jsonb;details jsonb:='[]'::jsonb;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  s:=core_flow.vendor_handoff_source(p_digest,a.ticket_id,coalesce(p_photo_ids,'{}'::uuid[]),true);
  PERFORM set_config('app.org_id',s->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment AND org_id=(s->>'orgId')::uuid FOR UPDATE;
  SELECT id INTO current_id FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  IF a.id IS NULL OR a.version<>p_expected_assignment OR current_id IS DISTINCT FROM p_expected_packet
    OR p_work_summary IS NULL OR char_length(btrim(p_work_summary)) NOT BETWEEN 1 AND 1000
    OR p_access_policy NOT IN ('TENANT_PRESENT_REQUIRED','TENANT_PREAUTHORIZATION_ALLOWED')
    OR (p_access_instruction IS NOT NULL AND char_length(btrim(p_access_instruction)) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF coalesce(s->'building'->>'serviceAddress','')='' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ADDRESS_REQUIRED'; END IF;
  rev:=coalesce((SELECT max(revision) FROM vendor_handoff.work_packet_revision WHERE assignment_id=a.id),0)+1;
  b:=jsonb_build_object('id',gen_random_uuid(),'assignmentId',a.id,'jobReference',a.ticket_id,'vendorLabel',a.vendor_label,'revision',rev,
    'publishedAt',clock_timestamp(),'buildingName',coalesce(s->'building'->>'displayName',''),'serviceAddress',s->'building'->>'serviceAddress',
    'unitLabel',coalesce(s->'ticket'->>'unitLabel',''),'issueType',s->'ticket'->>'issueType','workSummary',btrim(p_work_summary),
    'sharedDetails',details,'allowedPhotoIds',coalesce(to_jsonb(p_photo_ids),'[]'::jsonb),'accessPolicy',p_access_policy,
    'accessInstruction',CASE WHEN p_access_instruction IS NULL THEN NULL ELSE btrim(p_access_instruction) END);
  INSERT INTO vendor_handoff.work_packet_revision(id,org_id,assignment_id,revision,body)
    VALUES((b->>'id')::uuid,a.org_id,a.id,rev,b);
  INSERT INTO vendor_handoff.work_packet_source_photo(org_id,packet_revision_id,source_photo_id)
    SELECT a.org_id,(b->>'id')::uuid,x FROM unnest(coalesce(p_photo_ids,'{}'::uuid[])) x;
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  RETURN vendor_handoff.manager_read(p_digest,a.ticket_id);
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
DECLARE c vendor_handoff.vendor_capability;a vendor_handoff.vendor_assignment;s vendor_handoff.vendor_session;t jsonb;
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
  t:=core_flow.vendor_handoff_lock_ticket(c.org_id,a.ticket_id);
  PERFORM set_config('app.org_id',c.org_id::text,true);
  SELECT * INTO c FROM vendor_handoff.vendor_capability WHERE id=c.id FOR UPDATE;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=c.assignment_id AND org_id=c.org_id FOR UPDATE;
  IF a.status NOT IN ('OFFERED','ACTIVE') OR c.revoked_at IS NOT NULL OR c.superseded_at IS NOT NULL OR c.expires_at<=clock_timestamp()
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  IF c.redeemed_at IS NOT NULL AND c.redeem_request_id IS DISTINCT FROM p_request
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp()
    WHERE assignment_id=a.id AND org_id=a.org_id AND revoked_at IS NULL;
  INSERT INTO vendor_handoff.vendor_session(org_id,assignment_id,digest,csrf_digest,expires_at)
    VALUES(a.org_id,a.id,p_session_digest,p_csrf_digest,clock_timestamp()+interval '7 days') RETURNING * INTO s;
  IF c.redeemed_at IS NULL THEN UPDATE vendor_handoff.vendor_capability SET redeem_request_id=p_request,redeemed_at=clock_timestamp() WHERE id=c.id; END IF;
  RETURN jsonb_build_object('assignmentId',a.id,'expiresAt',s.expires_at);
END $$;

CREATE FUNCTION vendor_handoff.logout(p_session_digest bytea,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s vendor_handoff.vendor_session;a vendor_handoff.vendor_assignment;
BEGIN
  PERFORM set_config('app.vendor_session_digest',encode(p_session_digest,'hex'),true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_session_digest;
  IF s.id IS NULL THEN RETURN jsonb_build_object('revoked',true); END IF;
  PERFORM set_config('app.org_id',s.org_id::text,true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=s.assignment_id;
  IF a.id IS NOT NULL THEN PERFORM core_flow.vendor_handoff_lock_ticket(s.org_id,a.ticket_id); END IF;
  UPDATE vendor_handoff.vendor_session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE id=s.id;
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
  vendor_handoff.manager_publish_packet(bytea,uuid,uuid,bigint,uuid,text,text[],uuid[],text,text)
  TO bm_b1_web;
GRANT EXECUTE ON FUNCTION vendor_handoff.guard_direct_completion(bytea,text) TO bm_b1_web;
GRANT EXECUTE ON FUNCTION vendor_handoff.session_info(bytea),
  vendor_handoff.redeem(bytea,uuid,bytea,bytea),
  vendor_handoff.logout(bytea,uuid),
  vendor_handoff.read_job(bytea)
  TO bm_vendor_web;

RESET ROLE;

-- Owner needs only the approved Core bridge helpers and current-org helper.
GRANT EXECUTE ON FUNCTION core_flow.vendor_handoff_lock_ticket(uuid,text),
  core_flow.vendor_handoff_manager_context(bytea,text),
  core_flow.vendor_handoff_tenant_context(bytea,text,boolean),
  core_flow.vendor_handoff_recheck_occupancy(uuid,text,uuid),
  core_flow.vendor_handoff_source(bytea,text,uuid[],boolean),
  core_flow.vendor_handoff_source_photo(uuid,text,uuid),
  core_flow.vendor_handoff_mark_offered(bytea,text),
  app.current_org_id() TO bm_vendor_handoff_owner;

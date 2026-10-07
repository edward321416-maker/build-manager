-- Vendor Secure Handoff v1 work evidence (Task7): append-only VISIT_STARTED / BLOCKER_RECORDED / BLOCKER_CLEARED.
-- Additive only. Owner-owned, org-scoped, FORCE-RLS constrained; runtimes get EXECUTE on exact functions only.
SET LOCAL ROLE bm_vendor_handoff_owner;

ALTER TABLE vendor_handoff.appointment ADD CONSTRAINT appointment_id_assignment_key UNIQUE(id,assignment_id);

CREATE TABLE vendor_handoff.work_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  kind text NOT NULL CHECK(kind IN ('VISIT_STARTED','BLOCKER_RECORDED','BLOCKER_CLEARED')),
  packet_revision_id uuid NOT NULL,
  appointment_id uuid NULL,
  blocker_code text NULL CHECK(blocker_code IN ('PARTS_REQUIRED','ACCESS_BLOCKED','SCOPE_REVIEW_REQUIRED','FOLLOW_UP_VISIT_REQUIRED','OTHER')),
  note text NULL CHECK(note IS NULL OR char_length(note) BETWEEN 1 AND 500),
  clears_event_id uuid NULL,
  -- A clear can only reference a BLOCKER_RECORDED event of the same assignment (declarative, independent of RLS).
  clears_kind text GENERATED ALWAYS AS (CASE WHEN clears_event_id IS NULL THEN NULL ELSE 'BLOCKER_RECORDED' END) STORED,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,assignment_id),
  UNIQUE(id,assignment_id,kind),
  FOREIGN KEY(packet_revision_id,assignment_id) REFERENCES vendor_handoff.work_packet_revision(id,assignment_id),
  FOREIGN KEY(appointment_id,assignment_id) REFERENCES vendor_handoff.appointment(id,assignment_id),
  FOREIGN KEY(clears_event_id,assignment_id,clears_kind) REFERENCES vendor_handoff.work_event(id,assignment_id,kind),
  CHECK((kind='VISIT_STARTED')=(appointment_id IS NOT NULL)),
  CHECK((kind='BLOCKER_RECORDED')=(blocker_code IS NOT NULL)),
  CHECK((kind='BLOCKER_CLEARED')=(clears_event_id IS NOT NULL)),
  CHECK(kind<>'VISIT_STARTED' OR note IS NULL)
);
-- One VISIT_STARTED per Appointment; one clear per blocker.
CREATE UNIQUE INDEX work_event_one_visit ON vendor_handoff.work_event(appointment_id) WHERE kind='VISIT_STARTED';
CREATE UNIQUE INDEX work_event_one_clear ON vendor_handoff.work_event(clears_event_id) WHERE kind='BLOCKER_CLEARED';

-- FOLLOW_UP provenance: a blocker-driven round references a BLOCKER_RECORDED event of the same assignment.
ALTER TABLE vendor_handoff.scheduling_round
  ADD COLUMN source_blocker_kind text GENERATED ALWAYS AS (CASE WHEN source_blocker_id IS NULL THEN NULL ELSE 'BLOCKER_RECORDED' END) STORED;
ALTER TABLE vendor_handoff.scheduling_round
  ADD CONSTRAINT scheduling_round_source_blocker_fkey FOREIGN KEY(source_blocker_id,assignment_id,source_blocker_kind)
  REFERENCES vendor_handoff.work_event(id,assignment_id,kind);

ALTER TABLE vendor_handoff.work_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.work_event FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.work_event TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.work_event AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE TRIGGER work_event_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.work_event
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();

-- Current blocker: the latest BLOCKER_RECORDED with no BLOCKER_CLEARED referencing it.
CREATE FUNCTION vendor_handoff.active_blocker(p_assignment uuid) RETURNS vendor_handoff.work_event
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT e.* FROM vendor_handoff.work_event e
  WHERE e.assignment_id=p_assignment AND e.kind='BLOCKER_RECORDED'
    AND NOT EXISTS(SELECT 1 FROM vendor_handoff.work_event c
      WHERE c.assignment_id=e.assignment_id AND c.kind='BLOCKER_CLEARED' AND c.clears_event_id=e.id)
  ORDER BY e.created_at DESC,e.id DESC LIMIT 1
$$;

-- Defense in depth for direct inserts: serialize per assignment and keep at most one current blocker.
CREATE FUNCTION vendor_handoff.work_event_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM set_config('app.org_id',NEW.org_id::text,true);
  PERFORM 1 FROM vendor_handoff.vendor_assignment WHERE id=NEW.assignment_id AND org_id=NEW.org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PROVENANCE'; END IF;
  IF NEW.kind='BLOCKER_RECORDED' AND (vendor_handoff.active_blocker(NEW.assignment_id)).id IS NOT NULL
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER work_event_guard BEFORE INSERT ON vendor_handoff.work_event
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.work_event_guard();

-- Blocker projection: present only while the assignment is ACTIVE; Manager and Vendor only (never the Tenant projection).
CREATE FUNCTION vendor_handoff.blocker_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;b vendor_handoff.work_event;
BEGIN
  IF p_assignment IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL OR a.status<>'ACTIVE' THEN RETURN NULL; END IF;
  b:=vendor_handoff.active_blocker(a.id);
  IF b.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',b.id,'code',b.blocker_code,'note',b.note,'active',true,'createdAt',b.created_at,'clearedAt',NULL);
END $$;

-- A blocker overlays waitingOn without replacing the phase or any lifecycle/history (AC29).
ALTER FUNCTION vendor_handoff.scheduling_projection(uuid) RENAME TO scheduling_base_projection;
CREATE FUNCTION vendor_handoff.scheduling_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE sched jsonb;a vendor_handoff.vendor_assignment;b vendor_handoff.work_event;
BEGIN
  sched:=vendor_handoff.scheduling_base_projection(p_assignment);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.status='ACTIVE' THEN
    b:=vendor_handoff.active_blocker(a.id);
    IF b.id IS NOT NULL THEN
      sched:=sched||jsonb_build_object('waitingOn',CASE b.blocker_code WHEN 'PARTS_REQUIRED' THEN 'PARTS'
        WHEN 'ACCESS_BLOCKED' THEN 'MANAGER' WHEN 'SCOPE_REVIEW_REQUIRED' THEN 'MANAGER' ELSE 'VENDOR' END);
    END IF;
  END IF;
  RETURN sched;
END $$;

CREATE OR REPLACE FUNCTION vendor_handoff.job_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;sched jsonb;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  sched:=vendor_handoff.scheduling_projection(a.id);
  RETURN jsonb_build_object('assignmentId',a.id,'assignmentVersion',a.version,'status',a.status,'endReason',a.end_reason,
    'phase',sched->>'phase','waitingOn',sched->>'waitingOn','currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,
    'currentRound',sched->'currentRound','appointment',sched->'appointment','activeBlocker',vendor_handoff.blocker_projection(a.id),'currentReport',NULL,
    'effectiveMode',sched->'effectiveMode','availability',sched->'availability','proposal',sched->'proposal');
END $$;

CREATE OR REPLACE FUNCTION vendor_handoff.manager_read(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;s jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;phase text:='ENDED';sched jsonb:='{}'::jsonb;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  s:=core_flow.vendor_handoff_source(p_digest,p_ticket,NULL,false);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment
    WHERE org_id=(c->>'orgId')::uuid AND ticket_id=p_ticket ORDER BY created_at DESC,id DESC LIMIT 1;
  IF a.id IS NOT NULL THEN
    SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
    phase:=CASE WHEN a.status='ENDED' THEN 'ENDED' WHEN a.status='OFFERED' THEN 'OFFERED' ELSE 'IN_PROGRESS' END;
    sched:=vendor_handoff.scheduling_projection(a.id);
  END IF;
  RETURN jsonb_build_object('ticketId',p_ticket,'assignment',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',a.id,'status',a.status,'endReason',a.end_reason,'vendorLabel',a.vendor_label,'version',a.version) END,
    'currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,'currentRound',sched->'currentRound','appointment',sched->'appointment','activeBlocker',vendor_handoff.blocker_projection(a.id),
    'currentReport',NULL,'reportHistory','[]'::jsonb,'phase',coalesce(sched->>'phase',phase),'waitingOn',coalesce(sched->>'waitingOn','NONE'),
    'packetSource',jsonb_build_object('jobReference',p_ticket,'buildingName',s->'building'->>'displayName',
      'serviceAddress',nullif(btrim(s->'building'->>'serviceAddress'),''),'unitLabel',nullif(btrim(s->>'unitLabel'),''),
      'issueType',s->'ticket'->>'issueType','sharedDetails',vendor_handoff.packet_detail_candidates(s),
      'sourcePhotoIds',coalesce((SELECT jsonb_agg(x->'photoId') FROM jsonb_array_elements(s->'photos') x),'[]'::jsonb),'safetyNotice','[]'::jsonb));
END $$;

-- VISIT_STARTED: exact current SCHEDULED Appointment of the CONFIRMED latest round, no current blocker; PREAUTHORIZED_ENTRY
-- additionally rechecks the exact stored authorizing occupancy member under the source-ticket lock and only inside the
-- explicitly authorized window. The Appointment becomes OCCURRED without any time change.
CREATE FUNCTION vendor_handoff.start_visit(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_appointment uuid,
  p_expected_assignment bigint,p_expected_round bigint,p_expected_packet uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  appt vendor_handoff.appointment;w vendor_handoff.tenant_availability_window;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_appointment IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1
    OR p_expected_round IS NULL OR p_expected_round<1 OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('startVisit',a.id,p_appointment,p_expected_assignment,p_expected_round,p_expected_packet));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id
    ORDER BY (status='OPEN') DESC,created_at DESC,id DESC LIMIT 1;
  SELECT * INTO appt FROM vendor_handoff.appointment WHERE org_id=a.org_id AND assignment_id=a.id AND id=p_appointment FOR UPDATE;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR ctx->>'workStatus'='COMPLETED'
    OR r.id IS NULL OR r.status<>'CONFIRMED' OR r.version<>p_expected_round
    OR appt.id IS NULL OR appt.round_id<>r.id OR appt.status<>'SCHEDULED'
    OR (vendor_handoff.active_blocker(a.id)).id IS NOT NULL
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF appt.confirmation_mode='PREAUTHORIZED_ENTRY' THEN
    IF NOT core_flow.vendor_handoff_recheck_occupancy(a.org_id,a.ticket_id,appt.occupancy_member_id)
    THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
    PERFORM set_config('app.org_id',a.org_id::text,true);
    SELECT * INTO w FROM vendor_handoff.tenant_availability_window
      WHERE org_id=a.org_id AND id=appt.selected_window_id AND submission_id=appt.availability_submission_id;
    -- Unattended entry is limited to the explicitly authorized window.
    IF w.id IS NULL OR clock_timestamp()<w.start_at OR clock_timestamp()>=w.end_at
    THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  END IF;
  UPDATE vendor_handoff.appointment SET status='OCCURRED' WHERE id=appt.id;
  INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,appointment_id)
    VALUES(a.org_id,a.id,'VISIT_STARTED',p.id,appt.id);
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

-- BLOCKER_RECORDED: overlays current work; at most one current blocker. FOLLOW_UP_VISIT_REQUIRED needs a visit that
-- actually occurred and no pending scheduling (no OPEN round, no SCHEDULED Appointment).
CREATE FUNCTION vendor_handoff.record_blocker(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,
  p_expected_assignment bigint,p_expected_packet uuid,p_code text,p_note text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;note text;fp bytea;prior jsonb;result jsonb;
BEGIN
  note:=CASE WHEN p_note IS NULL THEN NULL ELSE btrim(p_note) END;
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL
    OR p_code IS NULL OR p_code NOT IN ('PARTS_REQUIRED','ACCESS_BLOCKED','SCOPE_REVIEW_REQUIRED','FOLLOW_UP_VISIT_REQUIRED','OTHER')
    OR (note IS NOT NULL AND char_length(note) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('recordBlocker',a.id,p_expected_assignment,p_expected_packet,p_code,note));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet
    OR (vendor_handoff.active_blocker(a.id)).id IS NOT NULL
    OR (p_code='FOLLOW_UP_VISIT_REQUIRED' AND (
      NOT EXISTS(SELECT 1 FROM vendor_handoff.appointment WHERE org_id=a.org_id AND assignment_id=a.id AND status='OCCURRED')
      OR EXISTS(SELECT 1 FROM vendor_handoff.appointment WHERE org_id=a.org_id AND assignment_id=a.id AND status='SCHEDULED')
      OR EXISTS(SELECT 1 FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN')))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,blocker_code,note)
    VALUES(a.org_id,a.id,'BLOCKER_RECORDED',p.id,p_code,note);
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

-- BLOCKER_CLEARED references the exact current blocker; the original stays history. Clearing FOLLOW_UP_VISIT_REQUIRED
-- atomically opens one FOLLOW_UP round whose provenance is that blocker (AC30, AC31).
CREATE FUNCTION vendor_handoff.clear_blocker(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_blocker uuid,
  p_expected_assignment bigint,p_expected_packet uuid,p_note text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;b vendor_handoff.work_event;note text;fp bytea;prior jsonb;result jsonb;
BEGIN
  note:=CASE WHEN p_note IS NULL THEN NULL ELSE btrim(p_note) END;
  IF p_request IS NULL OR p_blocker IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL
    OR (note IS NOT NULL AND char_length(note) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('clearBlocker',a.id,p_blocker,p_expected_assignment,p_expected_packet,note));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  b:=vendor_handoff.active_blocker(a.id);
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR b.id IS NULL OR b.id<>p_blocker
    OR (b.blocker_code='FOLLOW_UP_VISIT_REQUIRED' AND (
      EXISTS(SELECT 1 FROM vendor_handoff.appointment WHERE org_id=a.org_id AND assignment_id=a.id AND status='SCHEDULED')
      OR EXISTS(SELECT 1 FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN')))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,note,clears_event_id)
    VALUES(a.org_id,a.id,'BLOCKER_CLEARED',p.id,note,b.id);
  IF b.blocker_code='FOLLOW_UP_VISIT_REQUIRED' THEN
    INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,source_blocker_id)
      VALUES(a.org_id,a.id,p.id,'FOLLOW_UP','OPEN',b.id);
  END IF;
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA vendor_handoff FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vendor_handoff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vendor_handoff.start_visit(bytea,bytea,uuid,uuid,bigint,bigint,uuid),
  vendor_handoff.record_blocker(bytea,bytea,uuid,bigint,uuid,text,text),
  vendor_handoff.clear_blocker(bytea,bytea,uuid,uuid,bigint,uuid,text)
  TO bm_vendor_web;

RESET ROLE;

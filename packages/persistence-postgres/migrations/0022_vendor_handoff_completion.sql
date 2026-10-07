-- Vendor Secure Handoff v1 completion (Task8): staged sanitized completion photos, append-only initial completion
-- reports, the manager_disposition resource shape (no Task8 command) and the final FOLLOW_UP provenance invariant.
-- Additive only. Owner-owned, org-scoped, FORCE-RLS constrained; runtimes get EXECUTE on exact functions only.
SET LOCAL ROLE bm_vendor_handoff_owner;

CREATE TABLE vendor_handoff.completion_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  appointment_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL,
  revision integer NOT NULL CHECK(revision>0),
  supersedes_report_id uuid NULL,
  correction_request_id uuid NULL,
  work_summary text NOT NULL CHECK(char_length(work_summary) BETWEEN 1 AND 1000 AND work_summary=btrim(work_summary)),
  component_or_part_note text NULL CHECK(component_or_part_note IS NULL OR (char_length(component_or_part_note) BETWEEN 1 AND 500 AND component_or_part_note=btrim(component_or_part_note))),
  completion_photo_ids uuid[] NOT NULL CHECK(cardinality(completion_photo_ids)<=5 AND array_position(completion_photo_ids,NULL) IS NULL),
  photo_omission_reason text NULL CHECK(photo_omission_reason IS NULL OR photo_omission_reason IN ('NOT_APPLICABLE','SAFETY_OR_PRIVACY','TECHNICAL_FAILURE')),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,assignment_id),
  UNIQUE(assignment_id,revision),
  FOREIGN KEY(appointment_id,assignment_id) REFERENCES vendor_handoff.appointment(id,assignment_id),
  FOREIGN KEY(packet_revision_id,assignment_id) REFERENCES vendor_handoff.work_packet_revision(id,assignment_id),
  FOREIGN KEY(supersedes_report_id,assignment_id) REFERENCES vendor_handoff.completion_report(id,assignment_id),
  -- 1-5 photos XOR one approved omission reason.
  CHECK((cardinality(completion_photo_ids) BETWEEN 1 AND 5)<>(photo_omission_reason IS NOT NULL)),
  -- Task8 permits only the initial report; Task9 (0023) replaces this when correction revisions are enabled.
  CONSTRAINT completion_report_initial_only CHECK(revision=1 AND supersedes_report_id IS NULL AND correction_request_id IS NULL)
);

CREATE TABLE vendor_handoff.completion_photo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  appointment_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL,
  correction_request_id uuid NULL,
  mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png')),
  byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
  width integer NOT NULL CHECK(width>0),
  height integer NOT NULL CHECK(height>0),
  sha256 bytea NOT NULL CHECK(octet_length(sha256)=32),
  bytes bytea NOT NULL,
  disposition text NOT NULL DEFAULT 'PENDING' CHECK(disposition IN ('PENDING','ATTACHED','UNATTACHED_RETAINED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  disposed_at timestamptz NULL,
  UNIQUE(id,assignment_id),
  FOREIGN KEY(appointment_id,assignment_id) REFERENCES vendor_handoff.appointment(id,assignment_id),
  FOREIGN KEY(packet_revision_id,assignment_id) REFERENCES vendor_handoff.work_packet_revision(id,assignment_id),
  CHECK(octet_length(bytes)=byte_size AND sha256(bytes)=sha256),
  CHECK(width::bigint*height<=20000000),
  CHECK((disposition='PENDING')=(disposed_at IS NULL)),
  -- Task8 accepts only the initial upload context; Task9 (0023) adds the correction-request FK and context invariants.
  CONSTRAINT completion_photo_initial_only CHECK(correction_request_id IS NULL)
);
CREATE INDEX completion_photo_context ON vendor_handoff.completion_photo(assignment_id,appointment_id,correction_request_id);

-- Durable Manager disposition / correction-request identity. Task8 creates the shape only; Task9 adds commands.
CREATE TABLE vendor_handoff.manager_disposition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  completion_report_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('CLOSEOUT','REQUEST_CORRECTION','MORE_WORK')),
  reason text NULL CHECK(reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_by_report_id uuid NULL,
  FOREIGN KEY(completion_report_id,assignment_id) REFERENCES vendor_handoff.completion_report(id,assignment_id),
  FOREIGN KEY(consumed_by_report_id,assignment_id) REFERENCES vendor_handoff.completion_report(id,assignment_id),
  CHECK((kind='REQUEST_CORRECTION')=(reason IS NOT NULL)),
  CHECK(kind='REQUEST_CORRECTION' OR consumed_by_report_id IS NULL)
);

ALTER TABLE vendor_handoff.completion_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.completion_report FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.completion_report TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.completion_report AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.completion_photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.completion_photo FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.completion_photo TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.completion_photo AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.manager_disposition ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.manager_disposition FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.manager_disposition TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.manager_disposition AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

-- Final FOLLOW_UP provenance: exactly one of blocker or completion report for FOLLOW_UP, none otherwise.
ALTER TABLE vendor_handoff.scheduling_round
  ADD CONSTRAINT scheduling_round_source_completion_report_fkey FOREIGN KEY(source_completion_report_id,assignment_id)
  REFERENCES vendor_handoff.completion_report(id,assignment_id);
DO $$
DECLARE c record;dropped integer:=0;
BEGIN
  FOR c IN SELECT conname FROM pg_catalog.pg_constraint
    WHERE conrelid='vendor_handoff.scheduling_round'::regclass AND contype='c'
      AND pg_catalog.pg_get_constraintdef(oid) LIKE '%source_blocker_id%' AND pg_catalog.pg_get_constraintdef(oid) LIKE '%source_completion_report_id%'
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE vendor_handoff.scheduling_round DROP CONSTRAINT %I',c.conname);
    dropped:=dropped+1;
  END LOOP;
  IF dropped<>2 THEN RAISE EXCEPTION 'expected the two provisional 0020 FOLLOW_UP provenance checks, found %',dropped; END IF;
END $$;
ALTER TABLE vendor_handoff.scheduling_round ADD CONSTRAINT scheduling_round_follow_up_provenance
  CHECK(num_nonnulls(source_blocker_id,source_completion_report_id)=CASE WHEN purpose='FOLLOW_UP' THEN 1 ELSE 0 END);

-- Reports are append-only history.
CREATE TRIGGER completion_report_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.completion_report
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();

-- Photos: immutable provenance and bytes; disposition moves only PENDING -> ATTACHED | UNATTACHED_RETAINED, timestamped by the trigger.
CREATE FUNCTION vendor_handoff.completion_photo_transition() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF (NEW.id,NEW.org_id,NEW.assignment_id,NEW.appointment_id,NEW.packet_revision_id,NEW.correction_request_id,NEW.mime,NEW.byte_size,
      NEW.width,NEW.height,NEW.sha256,NEW.bytes,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.org_id,OLD.assignment_id,OLD.appointment_id,OLD.packet_revision_id,OLD.correction_request_id,OLD.mime,OLD.byte_size,
      OLD.width,OLD.height,OLD.sha256,OLD.bytes,OLD.created_at)
     OR (NEW.disposition IS DISTINCT FROM OLD.disposition AND NOT (OLD.disposition='PENDING' AND NEW.disposition IN ('ATTACHED','UNATTACHED_RETAINED')))
     OR (NEW.disposition IS NOT DISTINCT FROM OLD.disposition AND NEW.disposed_at IS DISTINCT FROM OLD.disposed_at)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF NEW.disposition IS DISTINCT FROM OLD.disposition THEN NEW.disposed_at:=clock_timestamp(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER completion_photo_transition BEFORE UPDATE OR DELETE ON vendor_handoff.completion_photo
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_photo_transition();

-- Task8 exposes no disposition command: every change is refused until Task9 replaces this function.
CREATE FUNCTION vendor_handoff.manager_disposition_transition() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END $$;
CREATE TRIGGER manager_disposition_transition BEFORE UPDATE OR DELETE ON vendor_handoff.manager_disposition
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.manager_disposition_transition();

-- The latest report without a Manager disposition: the assignment is COMPLETION_REPORTED while it exists.
CREATE FUNCTION vendor_handoff.pending_report(p_assignment uuid) RETURNS vendor_handoff.completion_report
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT r.* FROM vendor_handoff.completion_report r
  WHERE r.assignment_id=p_assignment
    AND NOT EXISTS(SELECT 1 FROM vendor_handoff.manager_disposition d WHERE d.completion_report_id=r.id)
  ORDER BY r.revision DESC LIMIT 1
$$;

-- COMPLETION_REPORTED is read-only: packet publication, scheduling, visit/blocker evidence and every assignment end
-- except a Manager closeout are refused while a report awaits its Manager disposition.
CREATE FUNCTION vendor_handoff.completion_reported_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target uuid;
BEGIN
  IF TG_TABLE_NAME='vendor_assignment' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status<>'ENDED' OR NEW.end_reason='CLOSED' THEN RETURN NEW; END IF;
    target:=NEW.id;
  ELSE
    target:=NEW.assignment_id;
  END IF;
  IF (vendor_handoff.pending_report(target)).id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER completion_reported_guard BEFORE UPDATE ON vendor_handoff.vendor_assignment
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();
CREATE TRIGGER completion_reported_guard BEFORE INSERT ON vendor_handoff.work_packet_revision
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();
CREATE TRIGGER completion_reported_guard BEFORE INSERT ON vendor_handoff.tenant_availability_submission
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();
CREATE TRIGGER completion_reported_guard BEFORE INSERT ON vendor_handoff.tenant_entry_authorization
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();
CREATE TRIGGER completion_reported_guard BEFORE INSERT ON vendor_handoff.vendor_slot_proposal
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();
CREATE TRIGGER completion_reported_guard BEFORE INSERT ON vendor_handoff.appointment
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();
CREATE TRIGGER completion_reported_guard BEFORE INSERT ON vendor_handoff.work_event
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.completion_reported_guard();

CREATE FUNCTION vendor_handoff.report_dto(r vendor_handoff.completion_report) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'assignmentId',r.assignment_id,'appointmentId',r.appointment_id,
    'packetRevisionId',r.packet_revision_id,'revision',r.revision,'supersedesReportId',r.supersedes_report_id,'workSummary',r.work_summary,
    'componentOrPartNote',r.component_or_part_note,'completionPhotoIds',to_jsonb(r.completion_photo_ids),
    'photoOmissionReason',r.photo_omission_reason,'submittedAt',r.submitted_at) END
$$;
CREATE FUNCTION vendor_handoff.current_report_dto(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r vendor_handoff.completion_report;
BEGIN
  IF p_assignment IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM vendor_handoff.completion_report WHERE assignment_id=p_assignment ORDER BY revision DESC LIMIT 1;
  RETURN vendor_handoff.report_dto(r);
END $$;
CREATE FUNCTION vendor_handoff.report_history(p_assignment uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT coalesce(jsonb_agg(vendor_handoff.report_dto(r) ORDER BY r.revision),'[]'::jsonb)
  FROM vendor_handoff.completion_report r WHERE p_assignment IS NOT NULL AND r.assignment_id=p_assignment
$$;

CREATE OR REPLACE FUNCTION vendor_handoff.scheduling_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE sched jsonb;a vendor_handoff.vendor_assignment;b vendor_handoff.work_event;r vendor_handoff.completion_report;
BEGIN
  sched:=vendor_handoff.scheduling_base_projection(p_assignment);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.status='ACTIVE' THEN
    -- A report awaiting its Manager disposition makes the assignment COMPLETION_REPORTED, waiting on the Manager.
    r:=vendor_handoff.pending_report(a.id);
    IF r.id IS NOT NULL THEN RETURN sched||jsonb_build_object('phase','COMPLETION_REPORTED','waitingOn','MANAGER'); END IF;
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
    'currentRound',sched->'currentRound','appointment',sched->'appointment','activeBlocker',vendor_handoff.blocker_projection(a.id),'currentReport',vendor_handoff.current_report_dto(a.id),
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
    'currentReport',vendor_handoff.current_report_dto(a.id),'reportHistory',vendor_handoff.report_history(a.id),'phase',coalesce(sched->>'phase',phase),'waitingOn',coalesce(sched->>'waitingOn','NONE'),
    'packetSource',jsonb_build_object('jobReference',p_ticket,'buildingName',s->'building'->>'displayName',
      'serviceAddress',nullif(btrim(s->'building'->>'serviceAddress'),''),'unitLabel',nullif(btrim(s->>'unitLabel'),''),
      'issueType',s->'ticket'->>'issueType','sharedDetails',vendor_handoff.packet_detail_candidates(s),
      'sourcePhotoIds',coalesce((SELECT jsonb_agg(x->'photoId') FROM jsonb_array_elements(s->'photos') x),'[]'::jsonb),'safetyNotice','[]'::jsonb));
END $$;

-- The current visit context: the latest non-superseded/non-cancelled Appointment must be the expected one and OCCURRED.
CREATE FUNCTION vendor_handoff.current_visit(p_assignment uuid,p_appointment uuid) RETURNS vendor_handoff.appointment
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE appt vendor_handoff.appointment;
BEGIN
  SELECT * INTO appt FROM vendor_handoff.appointment WHERE assignment_id=p_assignment AND status IN ('SCHEDULED','OCCURRED')
    ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF appt.id IS DISTINCT FROM p_appointment OR appt.status<>'OCCURRED' THEN RETURN NULL; END IF;
  RETURN appt;
END $$;

-- Completion-photo staging. Binary preprocessing (decode/re-encode, metadata removal, bounds) happens before this
-- transaction; here the Vendor prologue, receipt reconciliation (before context/capacity checks) and the bounded
-- initial upload context (assignment, OCCURRED Appointment, no correction request) are enforced.
CREATE FUNCTION vendor_handoff.upload_completion_photo(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,
  p_expected_assignment bigint,p_expected_packet uuid,p_appointment uuid,p_correction uuid,
  p_mime text,p_byte_size integer,p_width integer,p_height integer,p_sha256 bytea,p_bytes bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;appt vendor_handoff.appointment;
  photo_id uuid;created timestamptz;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL OR p_appointment IS NULL
    OR p_mime IS NULL OR p_mime NOT IN ('image/jpeg','image/png') OR p_byte_size IS NULL OR p_byte_size NOT BETWEEN 1 AND 5242880
    OR p_width IS NULL OR p_width<1 OR p_height IS NULL OR p_height<1 OR p_width::bigint*p_height>20000000
    OR p_bytes IS NULL OR octet_length(p_bytes)<>p_byte_size OR p_sha256 IS NULL OR octet_length(p_sha256)<>32 OR sha256(p_bytes)<>p_sha256
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('uploadCompletionPhoto',a.id,p_expected_assignment,p_expected_packet,p_appointment,
    p_correction,encode(p_sha256,'hex'),p_mime,p_byte_size,p_width,p_height));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  appt:=vendor_handoff.current_visit(a.id,p_appointment);
  -- Task8 opens only the initial context: no correction request, no report yet (an earlier report closed it).
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR appt.id IS NULL
    OR p_correction IS NOT NULL OR EXISTS(SELECT 1 FROM vendor_handoff.completion_report WHERE org_id=a.org_id AND assignment_id=a.id)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF (SELECT count(*) FROM vendor_handoff.completion_photo WHERE org_id=a.org_id AND assignment_id=a.id AND appointment_id=appt.id
      AND correction_request_id IS NULL)>=10
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.completion_photo(org_id,assignment_id,appointment_id,packet_revision_id,mime,byte_size,width,height,sha256,bytes)
    VALUES(a.org_id,a.id,appt.id,p.id,p_mime,p_byte_size,p_width,p_height,p_sha256,p_bytes) RETURNING id,created_at INTO photo_id,created;
  result:=jsonb_build_object('photoId',photo_id,'mime',p_mime,'byteSize',p_byte_size,'width',p_width,'height',p_height,'createdAt',created);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

-- Initial Completion Report: requires the current OCCURRED visit, no current blocker, no OPEN round, the current packet,
-- no earlier report, and 1-5 PENDING photos of the exact initial context XOR one approved omission reason.
-- Selected photos become ATTACHED; the rest of that context becomes UNATTACHED_RETAINED and the context closes.
CREATE FUNCTION vendor_handoff.submit_completion_report(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,
  p_expected_assignment bigint,p_expected_packet uuid,p_appointment uuid,p_correction uuid,p_supersedes uuid,
  p_summary text,p_note text,p_photo_ids uuid[],p_omission text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;appt vendor_handoff.appointment;
  r vendor_handoff.completion_report;summary text;note text;fp bytea;prior jsonb;result jsonb;
BEGIN
  summary:=CASE WHEN p_summary IS NULL THEN NULL ELSE btrim(p_summary) END;
  note:=CASE WHEN p_note IS NULL THEN NULL ELSE btrim(p_note) END;
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL OR p_appointment IS NULL
    OR summary IS NULL OR char_length(summary) NOT BETWEEN 1 AND 1000 OR (note IS NOT NULL AND char_length(note) NOT BETWEEN 1 AND 500)
    OR p_photo_ids IS NULL OR cardinality(p_photo_ids)>5 OR array_position(p_photo_ids,NULL) IS NOT NULL
    OR cardinality(p_photo_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_photo_ids) x)
    OR (p_omission IS NOT NULL AND p_omission NOT IN ('NOT_APPLICABLE','SAFETY_OR_PRIVACY','TECHNICAL_FAILURE'))
    OR (cardinality(p_photo_ids) BETWEEN 1 AND 5)=(p_omission IS NOT NULL)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('submitCompletionReport',a.id,p_expected_assignment,p_expected_packet,p_appointment,
    p_correction,p_supersedes,summary,note,to_jsonb(p_photo_ids),p_omission));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  appt:=vendor_handoff.current_visit(a.id,p_appointment);
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR appt.id IS NULL
    OR p_correction IS NOT NULL OR p_supersedes IS NOT NULL OR ctx->>'workStatus'='COMPLETED'
    OR EXISTS(SELECT 1 FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN')
    OR (vendor_handoff.active_blocker(a.id)).id IS NOT NULL
    OR EXISTS(SELECT 1 FROM vendor_handoff.completion_report WHERE org_id=a.org_id AND assignment_id=a.id)
    OR cardinality(p_photo_ids)<>(SELECT count(*) FROM vendor_handoff.completion_photo WHERE org_id=a.org_id AND assignment_id=a.id
      AND appointment_id=appt.id AND correction_request_id IS NULL AND disposition='PENDING' AND id=ANY(p_photo_ids))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.completion_report(org_id,assignment_id,appointment_id,packet_revision_id,revision,work_summary,component_or_part_note,
    completion_photo_ids,photo_omission_reason) VALUES(a.org_id,a.id,appt.id,p.id,1,summary,note,p_photo_ids,p_omission) RETURNING * INTO r;
  UPDATE vendor_handoff.completion_photo SET disposition='ATTACHED' WHERE org_id=a.org_id AND assignment_id=a.id AND id=ANY(p_photo_ids);
  UPDATE vendor_handoff.completion_photo SET disposition='UNATTACHED_RETAINED'
    WHERE org_id=a.org_id AND assignment_id=a.id AND appointment_id=appt.id AND correction_request_id IS NULL AND disposition='PENDING';
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  result:=vendor_handoff.report_dto(r);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

-- Vendor own-photo read: any of the current session's own completion photos (staging preview/reconciliation only).
CREATE FUNCTION vendor_handoff.read_completion_photo(p_session_digest bytea,p_photo uuid)
RETURNS TABLE(metadata jsonb,content bytea)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE session jsonb;a vendor_handoff.vendor_assignment;ph vendor_handoff.completion_photo;
BEGIN
  session:=vendor_handoff.session_info(p_session_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(session->>'assignmentId')::uuid;
  SELECT * INTO ph FROM vendor_handoff.completion_photo WHERE org_id=a.org_id AND assignment_id=a.id AND id=p_photo;
  IF p_photo IS NULL OR ph.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN QUERY SELECT jsonb_build_object('photoId',ph.id,'mime',ph.mime,'byteSize',ph.byte_size,'width',ph.width,'height',ph.height,'createdAt',ph.created_at),ph.bytes;
END $$;

-- Manager read: ATTACHED photos selected by a report of an assignment of a ticket the Manager can currently read.
-- Every other id (PENDING, retained, guessed, other ticket/org) is the same hidden NOT_FOUND.
CREATE FUNCTION vendor_handoff.manager_completion_photo(p_digest bytea,p_ticket text,p_photo uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;ph vendor_handoff.completion_photo;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  SELECT x.* INTO ph FROM vendor_handoff.completion_photo x
    JOIN vendor_handoff.vendor_assignment a ON a.id=x.assignment_id AND a.org_id=x.org_id
    WHERE x.org_id=(c->>'orgId')::uuid AND a.ticket_id=p_ticket AND x.id=p_photo AND x.disposition='ATTACHED'
      AND EXISTS(SELECT 1 FROM vendor_handoff.completion_report r WHERE r.org_id=x.org_id AND r.assignment_id=x.assignment_id AND x.id=ANY(r.completion_photo_ids));
  IF p_photo IS NULL OR ph.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('photo',jsonb_build_object('photoId',ph.id,'mime',ph.mime,'byteSize',ph.byte_size,'width',ph.width,'height',ph.height,
    'createdAt',ph.created_at),'content',encode(ph.bytes,'base64'));
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA vendor_handoff FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vendor_handoff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vendor_handoff.upload_completion_photo(bytea,bytea,uuid,bigint,uuid,uuid,uuid,text,integer,integer,integer,bytea,bytea),
  vendor_handoff.submit_completion_report(bytea,bytea,uuid,bigint,uuid,uuid,uuid,uuid,text,text,uuid[],text),
  vendor_handoff.read_completion_photo(bytea,uuid)
  TO bm_vendor_web;
GRANT EXECUTE ON FUNCTION vendor_handoff.manager_completion_photo(bytea,text,uuid) TO bm_b1_web;

RESET ROLE;

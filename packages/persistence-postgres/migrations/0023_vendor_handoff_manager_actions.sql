-- Task9: atomic Manager dispositions and assignment ends. No historical migration changes.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;
CREATE FUNCTION core_flow.vendor_handoff_complete(p_digest bytea,p_ticket text,p_expected_communication_version bigint,p_message text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;t core_flow.ticket;
BEGIN
  IF p_expected_communication_version IS NULL OR p_expected_communication_version<0 OR NOT core_flow.communication_valid_body(p_message)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  PERFORM core_flow.vendor_handoff_lock_ticket((c->>'orgId')::uuid,p_ticket);
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket;
  IF t.work_status<>'IN_PROGRESS' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  PERFORM core_flow.guard_communication_completion(p_digest,p_ticket,p_expected_communication_version);
  -- The existing Core writer supplies Manager actor/event semantics. This capability never runs the direct guard.
  PERFORM core_flow.store_ticket(p_digest,t.body,'HANDLING',btrim(p_message),'COMPLETED');
  RETURN jsonb_build_object('ticketId',p_ticket,'workStatus','COMPLETED');
END $$;
REVOKE ALL ON FUNCTION core_flow.vendor_handoff_complete(bytea,text,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.vendor_handoff_complete(bytea,text,bigint,text) TO bm_vendor_handoff_owner;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;
SET LOCAL ROLE bm_vendor_handoff_owner;

ALTER TABLE vendor_handoff.completion_report DROP CONSTRAINT completion_report_initial_only;
ALTER TABLE vendor_handoff.completion_photo DROP CONSTRAINT completion_photo_initial_only;
ALTER TABLE vendor_handoff.completion_report ADD CONSTRAINT completion_report_org_assignment_key UNIQUE(org_id,assignment_id,id);
ALTER TABLE vendor_handoff.manager_disposition ADD CONSTRAINT manager_disposition_org_assignment_key UNIQUE(org_id,assignment_id,id);
ALTER TABLE vendor_handoff.manager_disposition ADD CONSTRAINT disposition_one_per_report UNIQUE(org_id,assignment_id,completion_report_id);
CREATE UNIQUE INDEX manager_disposition_one_unresolved_correction ON vendor_handoff.manager_disposition(org_id,assignment_id)
  WHERE kind='REQUEST_CORRECTION' AND consumed_by_report_id IS NULL;
ALTER TABLE vendor_handoff.manager_disposition
  ADD CONSTRAINT disposition_exact_report FOREIGN KEY(org_id,assignment_id,completion_report_id) REFERENCES vendor_handoff.completion_report(org_id,assignment_id,id),
  ADD CONSTRAINT disposition_exact_consumed_report FOREIGN KEY(org_id,assignment_id,consumed_by_report_id) REFERENCES vendor_handoff.completion_report(org_id,assignment_id,id);
ALTER TABLE vendor_handoff.completion_photo ADD CONSTRAINT photo_exact_correction FOREIGN KEY(org_id,assignment_id,correction_request_id)
  REFERENCES vendor_handoff.manager_disposition(org_id,assignment_id,id);
ALTER TABLE vendor_handoff.completion_report
  ADD CONSTRAINT report_exact_correction FOREIGN KEY(org_id,assignment_id,correction_request_id) REFERENCES vendor_handoff.manager_disposition(org_id,assignment_id,id),
  ADD CONSTRAINT report_exact_supersedes FOREIGN KEY(org_id,assignment_id,supersedes_report_id) REFERENCES vendor_handoff.completion_report(org_id,assignment_id,id),
  ADD CONSTRAINT report_correction_pair CHECK((correction_request_id IS NULL)=(supersedes_report_id IS NULL));

-- Match plainSingle/plainMulti: ECMAScript trim first, then the Unicode Cc/Cf boundary.
-- PostgreSQL text cannot contain U+0000. Supplementary ranges are intentional;
-- POSIX cntrl alone does not implement the API's Unicode property escapes.
CREATE FUNCTION vendor_handoff.trim_plain_text(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT btrim(p_value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;
CREATE FUNCTION vendor_handoff.plain_text(p_value text,p_max integer) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT p_value IS NOT NULL AND char_length(value) BETWEEN 1 AND p_max
    AND translate(value,E'\r\n','') !~ U&'[\0001-\001F\007F-\009F\00AD\0600-\0605\061C\06DD\070F\0890-\0891\08E2\180E\200B-\200F\202A-\202E\2060-\2064\2066-\206F\FEFF\FFF9-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0001\+0E0020-\+0E007F]'
  FROM (SELECT vendor_handoff.trim_plain_text(p_value) AS value) normalized
$$;
ALTER TABLE vendor_handoff.manager_disposition ADD CONSTRAINT correction_plain_reason
  CHECK(kind<>'REQUEST_CORRECTION' OR (reason=vendor_handoff.trim_plain_text(reason) AND vendor_handoff.plain_text(reason,500)));

CREATE OR REPLACE FUNCTION vendor_handoff.manager_disposition_transition() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF (NEW.id,NEW.org_id,NEW.assignment_id,NEW.completion_report_id,NEW.kind,NEW.reason,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.org_id,OLD.assignment_id,OLD.completion_report_id,OLD.kind,OLD.reason,OLD.created_at)
    OR OLD.kind<>'REQUEST_CORRECTION' OR OLD.consumed_by_report_id IS NOT NULL OR NEW.consumed_by_report_id IS NULL
    OR NOT EXISTS(SELECT 1 FROM vendor_handoff.completion_report r WHERE r.org_id=OLD.org_id AND r.assignment_id=OLD.assignment_id
      AND r.id=NEW.consumed_by_report_id AND r.correction_request_id=OLD.id AND r.supersedes_report_id=OLD.completion_report_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION vendor_handoff.pending_report(p_assignment uuid) RETURNS vendor_handoff.completion_report
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT r.* FROM vendor_handoff.completion_report r
  WHERE r.assignment_id=p_assignment AND r.revision=(SELECT max(revision) FROM vendor_handoff.completion_report WHERE assignment_id=p_assignment)
    AND NOT EXISTS(SELECT 1 FROM vendor_handoff.manager_disposition d WHERE d.org_id=r.org_id AND d.assignment_id=r.assignment_id
      AND d.completion_report_id=r.id AND (d.kind<>'REQUEST_CORRECTION' OR d.consumed_by_report_id IS NOT NULL))
$$;
CREATE FUNCTION vendor_handoff.correction_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('id',id,'completionReportId',completion_report_id,'reason',reason)
  FROM vendor_handoff.manager_disposition WHERE assignment_id=p_assignment AND kind='REQUEST_CORRECTION' AND consumed_by_report_id IS NULL
$$;

-- Derive routing identity without subordinate locks, acquire ticket through current B1 authority, then assignment.
CREATE FUNCTION vendor_handoff.manager_command(p_digest bytea,p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;c jsonb;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  c:=core_flow.vendor_handoff_source(p_digest,a.ticket_id,'{}'::uuid[],true);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE org_id=(c->>'orgId')::uuid AND id=p_assignment FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN c;
END $$;

-- Private shared command body; only the five exact Manager wrappers are runtime-executable.
CREATE FUNCTION vendor_handoff.manager_dispose(p_digest bytea,p_assignment uuid,p_request uuid,p_expected bigint,p_report uuid,
  p_kind text,p_reason text,p_communication bigint,p_message text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;r vendor_handoff.completion_report;fp bytea;prior jsonb;result jsonb;p uuid;
BEGIN
  p_reason:=vendor_handoff.trim_plain_text(p_reason);
  IF p_request IS NULL OR p_expected IS NULL OR p_expected<1 OR p_report IS NULL OR p_kind IS NULL OR p_kind NOT IN ('REQUEST_CORRECTION','MORE_WORK','CLOSEOUT')
    OR (p_kind='REQUEST_CORRECTION' AND NOT vendor_handoff.plain_text(p_reason,500))
    OR (p_kind='CLOSEOUT' AND (p_communication IS NULL OR p_communication<0 OR NOT vendor_handoff.plain_text(p_message,2000)))
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  c:=vendor_handoff.manager_command(p_digest,p_assignment);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array(p_kind,a.id,p_expected,p_report,btrim(p_reason),p_communication,btrim(p_message)));
  prior:=vendor_handoff.receipt(a.org_id,'MANAGER',c->>'actorId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT * INTO r FROM vendor_handoff.completion_report WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1 FOR UPDATE;
  IF a.status<>'ACTIVE' OR a.version<>p_expected OR r.id IS DISTINCT FROM p_report OR c->>'workStatus'<>'IN_PROGRESS'
    OR EXISTS(SELECT 1 FROM vendor_handoff.manager_disposition WHERE org_id=a.org_id AND assignment_id=a.id AND completion_report_id=r.id)
    OR EXISTS(SELECT 1 FROM vendor_handoff.manager_disposition WHERE org_id=a.org_id AND assignment_id=a.id AND kind='REQUEST_CORRECTION' AND consumed_by_report_id IS NULL)
    OR (vendor_handoff.active_blocker(a.id)).id IS NOT NULL
    OR EXISTS(SELECT 1 FROM vendor_handoff.scheduling_round WHERE assignment_id=a.id AND status='OPEN')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF p_kind='CLOSEOUT' THEN
    PERFORM core_flow.vendor_handoff_complete(p_digest,a.ticket_id,p_communication,p_message);
    UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason='CLOSED',ended_at=clock_timestamp(),version=version+1 WHERE id=a.id;
    UPDATE vendor_handoff.vendor_capability SET revoked_at=clock_timestamp() WHERE assignment_id=a.id AND revoked_at IS NULL;
    UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=a.id AND revoked_at IS NULL;
  ELSE
    UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  END IF;
  INSERT INTO vendor_handoff.manager_disposition(org_id,assignment_id,completion_report_id,kind,reason)
    VALUES(a.org_id,a.id,r.id,p_kind,CASE WHEN p_kind='REQUEST_CORRECTION' THEN btrim(p_reason) ELSE NULL END);
  IF p_kind='MORE_WORK' THEN
    SELECT id INTO p FROM vendor_handoff.work_packet_revision WHERE assignment_id=a.id ORDER BY revision DESC LIMIT 1;
    INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,source_completion_report_id)
      VALUES(a.org_id,a.id,p,'FOLLOW_UP','OPEN',r.id);
  END IF;
  result:=vendor_handoff.manager_read(p_digest,a.ticket_id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'MANAGER',c->>'actorId',p_request,fp,result);
  RETURN result;
END $$;
CREATE FUNCTION vendor_handoff.manager_request_correction(bytea,uuid,uuid,bigint,uuid,text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT vendor_handoff.manager_dispose($1,$2,$3,$4,$5,'REQUEST_CORRECTION',$6,NULL,NULL) $$;
CREATE FUNCTION vendor_handoff.manager_require_follow_up(bytea,uuid,uuid,bigint,uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT vendor_handoff.manager_dispose($1,$2,$3,$4,$5,'MORE_WORK',NULL,NULL,NULL) $$;
CREATE FUNCTION vendor_handoff.closeout(bytea,uuid,uuid,bigint,uuid,bigint,text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT vendor_handoff.manager_dispose($1,$2,$3,$4,$5,'CLOSEOUT',NULL,$6,$7) $$;

CREATE FUNCTION vendor_handoff.manager_end(p_digest bytea,p_assignment uuid,p_request uuid,p_expected bigint,p_kind text,p_label text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;fp bytea;prior jsonb;result jsonb;
BEGIN
  p_label:=vendor_handoff.trim_plain_text(p_label);
  IF p_request IS NULL OR p_expected IS NULL OR p_expected<1 OR p_kind IS NULL OR p_kind NOT IN ('REVOKED','SUPERSEDED')
    OR (p_kind='SUPERSEDED' AND (NOT vendor_handoff.plain_text(p_label,80) OR p_label ~ E'[\r\n]'))
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  c:=vendor_handoff.manager_command(p_digest,p_assignment);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array(p_kind,a.id,p_expected,btrim(p_label)));
  prior:=vendor_handoff.receipt(a.org_id,'MANAGER',c->>'actorId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' OR a.version<>p_expected OR (vendor_handoff.pending_report(a.id)).id IS NOT NULL OR c->>'workStatus'='COMPLETED'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  UPDATE vendor_handoff.scheduling_round SET status=CASE WHEN p_kind='SUPERSEDED' THEN 'SUPERSEDED' ELSE 'CANCELLED' END,version=version+1
    WHERE assignment_id=a.id AND status='OPEN';
  UPDATE vendor_handoff.appointment SET status=CASE WHEN p_kind='SUPERSEDED' THEN 'SUPERSEDED' ELSE 'CANCELLED' END
    WHERE assignment_id=a.id AND status='SCHEDULED';
  UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason=p_kind,ended_at=clock_timestamp(),version=version+1 WHERE id=a.id;
  UPDATE vendor_handoff.vendor_capability SET revoked_at=clock_timestamp() WHERE assignment_id=a.id AND revoked_at IS NULL;
  UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=a.id AND revoked_at IS NULL;
  IF p_kind='SUPERSEDED' THEN
    INSERT INTO vendor_handoff.vendor_assignment(org_id,ticket_id,property_id,unit_id,vendor_label,status)
      VALUES(a.org_id,a.ticket_id,a.property_id,a.unit_id,btrim(p_label),'PREPARING');
  END IF;
  result:=vendor_handoff.manager_read(p_digest,a.ticket_id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'MANAGER',c->>'actorId',p_request,fp,result);
  RETURN result;
END $$;
CREATE FUNCTION vendor_handoff.manager_revoke(bytea,uuid,uuid,bigint) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT vendor_handoff.manager_end($1,$2,$3,$4,'REVOKED',NULL) $$;
CREATE FUNCTION vendor_handoff.manager_reassign(bytea,uuid,uuid,bigint,text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT vendor_handoff.manager_end($1,$2,$3,$4,'SUPERSEDED',$5) $$;

-- Shared authorization of a fresh report/upload context. Exact receipt replay occurs before this check.
CREATE FUNCTION vendor_handoff.report_context(p_assignment uuid,p_correction uuid) RETURNS vendor_handoff.completion_report
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r vendor_handoff.completion_report;d vendor_handoff.manager_disposition;
BEGIN
  SELECT * INTO r FROM vendor_handoff.completion_report WHERE assignment_id=p_assignment ORDER BY revision DESC LIMIT 1;
  IF p_correction IS NOT NULL THEN
    SELECT * INTO d FROM vendor_handoff.manager_disposition WHERE assignment_id=p_assignment AND org_id=r.org_id AND id=p_correction;
    IF d.id IS NULL OR d.kind<>'REQUEST_CORRECTION' OR d.completion_report_id IS DISTINCT FROM r.id OR d.consumed_by_report_id IS NOT NULL
    THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  ELSIF r.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vendor_handoff.manager_disposition WHERE org_id=r.org_id AND assignment_id=p_assignment
      AND completion_report_id=r.id AND kind='MORE_WORK')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  RETURN r;
END $$;


CREATE OR REPLACE FUNCTION vendor_handoff.scheduling_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE sched jsonb;a vendor_handoff.vendor_assignment;b vendor_handoff.work_event;r vendor_handoff.completion_report;
BEGIN
  sched:=vendor_handoff.scheduling_base_projection(p_assignment);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.status='ACTIVE' THEN
    -- A report awaiting its Manager disposition makes the assignment COMPLETION_REPORTED, waiting on the Manager.
    r:=vendor_handoff.pending_report(a.id);
    IF r.id IS NOT NULL THEN RETURN sched||jsonb_build_object('phase','COMPLETION_REPORTED','waitingOn',CASE WHEN vendor_handoff.correction_projection(a.id) IS NULL THEN 'MANAGER' ELSE 'VENDOR' END); END IF;
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
    'correctionRequest',vendor_handoff.correction_projection(a.id),'effectiveMode',sched->'effectiveMode','availability',sched->'availability','proposal',sched->'proposal');
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
  RETURN jsonb_build_object('ticketId',p_ticket,'ticketWorkStatus',s->>'workStatus','correctionRequest',vendor_handoff.correction_projection(a.id),
    'assignmentHistory',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'vendorLabel',h.vendor_label,'endReason',h.end_reason,'declineReason',h.decline_reason,'operationalNote',h.end_note) ORDER BY h.created_at DESC,h.id DESC) FROM vendor_handoff.vendor_assignment h WHERE h.org_id=(c->>'orgId')::uuid AND h.ticket_id=p_ticket AND h.status='ENDED'),'[]'::jsonb),'assignment',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',a.id,'status',a.status,'endReason',a.end_reason,'vendorLabel',a.vendor_label,'version',a.version) END,
    'currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,'currentRound',sched->'currentRound','appointment',sched->'appointment','activeBlocker',vendor_handoff.blocker_projection(a.id),
    'currentReport',vendor_handoff.current_report_dto(a.id),'reportHistory',vendor_handoff.report_history(a.id),'phase',coalesce(sched->>'phase',phase),'waitingOn',coalesce(sched->>'waitingOn','NONE'),
    'packetSource',jsonb_build_object('jobReference',p_ticket,'buildingName',s->'building'->>'displayName',
      'serviceAddress',nullif(btrim(s->'building'->>'serviceAddress'),''),'unitLabel',nullif(btrim(s->>'unitLabel'),''),
      'issueType',s->'ticket'->>'issueType','sharedDetails',vendor_handoff.packet_detail_candidates(s),
      'sourcePhotoIds',coalesce((SELECT jsonb_agg(x->'photoId') FROM jsonb_array_elements(s->'photos') x),'[]'::jsonb),'safetyNotice','[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION vendor_handoff.upload_completion_photo(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,
  p_expected_assignment bigint,p_expected_packet uuid,p_appointment uuid,p_correction uuid,
  p_mime text,p_byte_size integer,p_width integer,p_height integer,p_sha256 bytea,p_bytes bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;appt vendor_handoff.appointment;
  previous vendor_handoff.completion_report;photo_id uuid;created timestamptz;fp bytea;prior jsonb;result jsonb;
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
  previous:=vendor_handoff.report_context(a.id,p_correction);
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR appt.id IS NULL
    OR (p_correction IS NULL AND previous.id IS NOT NULL AND previous.appointment_id=appt.id)
    OR EXISTS(SELECT 1 FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  IF (SELECT count(*) FROM vendor_handoff.completion_photo WHERE org_id=a.org_id AND assignment_id=a.id AND appointment_id=appt.id
      AND correction_request_id IS NOT DISTINCT FROM p_correction)>=10
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.completion_photo(org_id,assignment_id,appointment_id,packet_revision_id,correction_request_id,mime,byte_size,width,height,sha256,bytes)
    VALUES(a.org_id,a.id,appt.id,p.id,p_correction,p_mime,p_byte_size,p_width,p_height,p_sha256,p_bytes) RETURNING id,created_at INTO photo_id,created;
  result:=jsonb_build_object('photoId',photo_id,'mime',p_mime,'byteSize',p_byte_size,'width',p_width,'height',p_height,'createdAt',created);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION vendor_handoff.submit_completion_report(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,
  p_expected_assignment bigint,p_expected_packet uuid,p_appointment uuid,p_correction uuid,p_supersedes uuid,
  p_summary text,p_note text,p_photo_ids uuid[],p_omission text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;appt vendor_handoff.appointment;
  previous vendor_handoff.completion_report;r vendor_handoff.completion_report;summary text;note text;fp bytea;prior jsonb;result jsonb;
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
  previous:=vendor_handoff.report_context(a.id,p_correction);
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR appt.id IS NULL
    OR (p_correction IS NULL AND p_supersedes IS NOT NULL) OR (p_correction IS NOT NULL AND p_supersedes IS DISTINCT FROM previous.id) OR ctx->>'workStatus'='COMPLETED'
    OR EXISTS(SELECT 1 FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN')
    OR (vendor_handoff.active_blocker(a.id)).id IS NOT NULL
    OR (p_correction IS NULL AND previous.id IS NOT NULL AND previous.appointment_id=appt.id)
    OR cardinality(p_photo_ids)<>(SELECT count(*) FROM vendor_handoff.completion_photo WHERE org_id=a.org_id AND assignment_id=a.id
      AND id=ANY(p_photo_ids) AND ((appointment_id=appt.id AND packet_revision_id=p.id AND correction_request_id IS NOT DISTINCT FROM p_correction AND disposition='PENDING')
        OR (p_correction IS NOT NULL AND disposition='ATTACHED' AND id=ANY(previous.completion_photo_ids))))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.completion_report(org_id,assignment_id,appointment_id,packet_revision_id,revision,supersedes_report_id,correction_request_id,work_summary,component_or_part_note,
    completion_photo_ids,photo_omission_reason) VALUES(a.org_id,a.id,appt.id,p.id,coalesce(previous.revision,0)+1,p_supersedes,p_correction,summary,note,p_photo_ids,p_omission) RETURNING * INTO r;
  UPDATE vendor_handoff.completion_photo SET disposition='ATTACHED' WHERE org_id=a.org_id AND assignment_id=a.id AND id=ANY(p_photo_ids) AND disposition='PENDING';
  UPDATE vendor_handoff.completion_photo SET disposition='UNATTACHED_RETAINED'
    WHERE org_id=a.org_id AND assignment_id=a.id AND correction_request_id IS NOT DISTINCT FROM p_correction AND disposition='PENDING';
  IF p_correction IS NOT NULL THEN
    UPDATE vendor_handoff.manager_disposition SET consumed_by_report_id=r.id WHERE org_id=a.org_id AND assignment_id=a.id AND id=p_correction AND consumed_by_report_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  END IF;
  UPDATE vendor_handoff.vendor_assignment SET version=version+1 WHERE id=a.id;
  result:=vendor_handoff.report_dto(r);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vendor_handoff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vendor_handoff.manager_request_correction(bytea,uuid,uuid,bigint,uuid,text),
  vendor_handoff.manager_require_follow_up(bytea,uuid,uuid,bigint,uuid),vendor_handoff.closeout(bytea,uuid,uuid,bigint,uuid,bigint,text),
  vendor_handoff.manager_revoke(bytea,uuid,uuid,bigint),vendor_handoff.manager_reassign(bytea,uuid,uuid,bigint,text) TO bm_b1_web;
RESET ROLE;

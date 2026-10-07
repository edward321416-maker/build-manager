-- Vendor Secure Handoff v1 scheduling (Task5): rounds, Tenant availability/consent, Vendor proposals, immutable Appointments.
-- Additive only. Every table is owner-owned, org-scoped and FORCE-RLS constrained; runtimes get EXECUTE on exact functions only.
SET LOCAL ROLE bm_vendor_handoff_owner;

CREATE TABLE vendor_handoff.scheduling_round (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL REFERENCES vendor_handoff.vendor_assignment(id),
  opened_packet_revision_id uuid NOT NULL REFERENCES vendor_handoff.work_packet_revision(id),
  purpose text NOT NULL CHECK(purpose IN ('INITIAL','RESCHEDULE','FOLLOW_UP')),
  status text NOT NULL CHECK(status IN ('OPEN','CONFIRMED','SUPERSEDED','CANCELLED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  -- RESCHEDULE provenance: the superseded future Appointment (FK added after appointment exists).
  previous_appointment_id uuid NULL,
  -- Provisional FOLLOW_UP provenance slots. Task7 adds the blocker FK and Task8 the completion-report FK.
  source_blocker_id uuid NULL,
  source_completion_report_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz NULL,
  UNIQUE(id,assignment_id),
  CHECK(purpose='FOLLOW_UP' OR (source_blocker_id IS NULL AND source_completion_report_id IS NULL)),
  CHECK(NOT (source_blocker_id IS NOT NULL AND source_completion_report_id IS NOT NULL)),
  CHECK((purpose='RESCHEDULE')=(previous_appointment_id IS NOT NULL)),
  CHECK((status='OPEN')=(closed_at IS NULL))
);
CREATE UNIQUE INDEX scheduling_round_one_open ON vendor_handoff.scheduling_round(assignment_id) WHERE status='OPEN';

CREATE TABLE vendor_handoff.tenant_availability_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  round_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL REFERENCES vendor_handoff.work_packet_revision(id),
  occupancy_member_id uuid NOT NULL,
  round_sequence bigint NOT NULL CHECK(round_sequence>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(round_id,assignment_id) REFERENCES vendor_handoff.scheduling_round(id,assignment_id),
  UNIQUE(id,round_id)
);

CREATE TABLE vendor_handoff.tenant_availability_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  submission_id uuid NOT NULL REFERENCES vendor_handoff.tenant_availability_submission(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  CHECK(isfinite(start_at) AND isfinite(end_at) AND start_at<end_at),
  UNIQUE(id,submission_id)
);

CREATE TABLE vendor_handoff.tenant_entry_authorization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  round_id uuid NOT NULL,
  submission_id uuid NOT NULL,
  -- Exact current-Tenant occupancy relationship relied on; rechecked before any unattended entry.
  occupancy_member_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL REFERENCES vendor_handoff.work_packet_revision(id),
  round_sequence bigint NOT NULL CHECK(round_sequence>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(submission_id,round_id) REFERENCES vendor_handoff.tenant_availability_submission(id,round_id),
  FOREIGN KEY(round_id,assignment_id) REFERENCES vendor_handoff.scheduling_round(id,assignment_id),
  UNIQUE(id,submission_id)
);

CREATE TABLE vendor_handoff.tenant_entry_authorization_window (
  org_id uuid NOT NULL,
  authorization_id uuid NOT NULL,
  submission_id uuid NOT NULL,
  window_id uuid NOT NULL,
  PRIMARY KEY(authorization_id,window_id),
  FOREIGN KEY(authorization_id,submission_id) REFERENCES vendor_handoff.tenant_entry_authorization(id,submission_id),
  FOREIGN KEY(window_id,submission_id) REFERENCES vendor_handoff.tenant_availability_window(id,submission_id)
);

CREATE TABLE vendor_handoff.vendor_slot_proposal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  round_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL REFERENCES vendor_handoff.work_packet_revision(id),
  availability_submission_id uuid NULL REFERENCES vendor_handoff.tenant_availability_submission(id),
  round_sequence bigint NOT NULL CHECK(round_sequence>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(round_id,assignment_id) REFERENCES vendor_handoff.scheduling_round(id,assignment_id),
  UNIQUE(id,round_id)
);

CREATE TABLE vendor_handoff.vendor_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  proposal_id uuid NOT NULL REFERENCES vendor_handoff.vendor_slot_proposal(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  CHECK(isfinite(start_at) AND isfinite(end_at) AND start_at<end_at),
  UNIQUE(id,proposal_id)
);

CREATE TABLE vendor_handoff.appointment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  round_id uuid NOT NULL,
  packet_revision_id uuid NOT NULL REFERENCES vendor_handoff.work_packet_revision(id),
  proposal_id uuid NULL,
  slot_id uuid NULL,
  availability_submission_id uuid NULL,
  selected_window_id uuid NULL,
  entry_authorization_id uuid NULL,
  occupancy_member_id uuid NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  confirmation_mode text NOT NULL CHECK(confirmation_mode IN ('TENANT_CONFIRMED','PREAUTHORIZED_ENTRY')),
  status text NOT NULL CHECK(status IN ('SCHEDULED','OCCURRED','SUPERSEDED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status_changed_at timestamptz NULL,
  FOREIGN KEY(round_id,assignment_id) REFERENCES vendor_handoff.scheduling_round(id,assignment_id),
  FOREIGN KEY(slot_id,proposal_id) REFERENCES vendor_handoff.vendor_slot(id,proposal_id),
  FOREIGN KEY(selected_window_id,availability_submission_id) REFERENCES vendor_handoff.tenant_availability_window(id,submission_id),
  FOREIGN KEY(entry_authorization_id,availability_submission_id) REFERENCES vendor_handoff.tenant_entry_authorization(id,submission_id),
  CHECK(isfinite(start_at) AND isfinite(end_at) AND start_at<end_at),
  CHECK(confirmation_mode<>'TENANT_CONFIRMED' OR (proposal_id IS NOT NULL AND slot_id IS NOT NULL AND availability_submission_id IS NULL
    AND selected_window_id IS NULL AND entry_authorization_id IS NULL AND occupancy_member_id IS NULL)),
  CHECK(confirmation_mode<>'PREAUTHORIZED_ENTRY' OR (proposal_id IS NULL AND slot_id IS NULL AND availability_submission_id IS NOT NULL
    AND selected_window_id IS NOT NULL AND entry_authorization_id IS NOT NULL AND occupancy_member_id IS NOT NULL)),
  CHECK((status='SCHEDULED')=(status_changed_at IS NULL))
);
CREATE UNIQUE INDEX appointment_one_scheduled ON vendor_handoff.appointment(assignment_id) WHERE status='SCHEDULED';
ALTER TABLE vendor_handoff.scheduling_round
  ADD CONSTRAINT scheduling_round_previous_appointment_fkey FOREIGN KEY(previous_appointment_id) REFERENCES vendor_handoff.appointment(id);

ALTER TABLE vendor_handoff.scheduling_round ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.scheduling_round FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.scheduling_round TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.scheduling_round AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.tenant_availability_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.tenant_availability_submission FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.tenant_availability_submission TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.tenant_availability_submission AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.tenant_availability_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.tenant_availability_window FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.tenant_availability_window TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.tenant_availability_window AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.tenant_entry_authorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.tenant_entry_authorization FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.tenant_entry_authorization TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.tenant_entry_authorization AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.tenant_entry_authorization_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.tenant_entry_authorization_window FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.tenant_entry_authorization_window TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.tenant_entry_authorization_window AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.vendor_slot_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_slot_proposal FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.vendor_slot_proposal TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.vendor_slot_proposal AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.vendor_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.vendor_slot FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.vendor_slot TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.vendor_slot AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE vendor_handoff.appointment ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_handoff.appointment FORCE ROW LEVEL SECURITY;
CREATE POLICY vendor_handoff_org_scope ON vendor_handoff.appointment TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY vendor_handoff_org_ceiling ON vendor_handoff.appointment AS RESTRICTIVE FOR ALL TO bm_vendor_handoff_owner
  USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

-- History rows are append-only; Appointment time/provenance never changes in place.
CREATE FUNCTION vendor_handoff.immutable_history() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END $$;
CREATE TRIGGER tenant_availability_submission_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.tenant_availability_submission
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();
CREATE TRIGGER tenant_availability_window_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.tenant_availability_window
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();
CREATE TRIGGER tenant_entry_authorization_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.tenant_entry_authorization
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();
CREATE TRIGGER tenant_entry_authorization_window_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.tenant_entry_authorization_window
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();
CREATE TRIGGER vendor_slot_proposal_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.vendor_slot_proposal
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();
CREATE TRIGGER vendor_slot_immutable BEFORE UPDATE OR DELETE ON vendor_handoff.vendor_slot
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.immutable_history();

CREATE FUNCTION vendor_handoff.appointment_transition() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF (NEW.id,NEW.org_id,NEW.assignment_id,NEW.round_id,NEW.packet_revision_id,NEW.proposal_id,NEW.slot_id,NEW.availability_submission_id,
      NEW.selected_window_id,NEW.entry_authorization_id,NEW.occupancy_member_id,NEW.start_at,NEW.end_at,NEW.confirmation_mode,NEW.created_at)
     IS DISTINCT FROM
     (OLD.id,OLD.org_id,OLD.assignment_id,OLD.round_id,OLD.packet_revision_id,OLD.proposal_id,OLD.slot_id,OLD.availability_submission_id,
      OLD.selected_window_id,OLD.entry_authorization_id,OLD.occupancy_member_id,OLD.start_at,OLD.end_at,OLD.confirmation_mode,OLD.created_at)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='SCHEDULED' AND NEW.status IN ('OCCURRED','SUPERSEDED','CANCELLED'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_changed_at:=coalesce(NEW.status_changed_at,clock_timestamp()); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_transition BEFORE UPDATE OR DELETE ON vendor_handoff.appointment
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.appointment_transition();

CREATE FUNCTION vendor_handoff.round_transition() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF (NEW.id,NEW.org_id,NEW.assignment_id,NEW.opened_packet_revision_id,NEW.purpose,NEW.previous_appointment_id,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.org_id,OLD.assignment_id,OLD.opened_packet_revision_id,OLD.purpose,OLD.previous_appointment_id,OLD.created_at)
     OR NEW.version<OLD.version
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='OPEN' AND NEW.status IN ('CONFIRMED','SUPERSEDED','CANCELLED'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IMMUTABLE_HISTORY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER scheduling_round_transition BEFORE UPDATE OR DELETE ON vendor_handoff.scheduling_round
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.round_transition();

-- Validates 1-5 future finite non-overlapping intervals and returns them normalized and ordered.
CREATE FUNCTION vendor_handoff.parse_intervals(p_intervals jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE x jsonb;s timestamptz;e timestamptz;parsed jsonb:='[]'::jsonb;ordered jsonb;prev_end timestamptz;
BEGIN
  IF p_intervals IS NULL OR jsonb_typeof(p_intervals)<>'array' OR jsonb_array_length(p_intervals) NOT BETWEEN 1 AND 5
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p_intervals) LOOP
    IF jsonb_typeof(x)<>'object' OR jsonb_typeof(x->'startAt')<>'string' OR jsonb_typeof(x->'endAt')<>'string'
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
    BEGIN s:=(x->>'startAt')::timestamptz;e:=(x->>'endAt')::timestamptz;
    EXCEPTION WHEN others THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END;
    IF NOT isfinite(s) OR NOT isfinite(e) OR s>=e OR s<=clock_timestamp()
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
    parsed:=parsed||jsonb_build_array(jsonb_build_object('startAt',s,'endAt',e));
  END LOOP;
  SELECT jsonb_agg(v ORDER BY (v->>'startAt')::timestamptz,(v->>'endAt')::timestamptz) INTO ordered FROM jsonb_array_elements(parsed) v;
  FOR x IN SELECT value FROM jsonb_array_elements(ordered) LOOP
    IF prev_end IS NOT NULL AND (x->>'startAt')::timestamptz<prev_end THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
    prev_end:=(x->>'endAt')::timestamptz;
  END LOOP;
  RETURN ordered;
END $$;

-- Private role-neutral scheduling projection. Callers have bound app.org_id from authenticated state.
CREATE FUNCTION vendor_handoff.scheduling_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  sub vendor_handoff.tenant_availability_submission;auth vendor_handoff.tenant_entry_authorization;prop vendor_handoff.vendor_slot_proposal;
  appt vendor_handoff.appointment;availability jsonb;proposal jsonb;mode text;phase text;waiting text;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RETURN jsonb_build_object('phase','ENDED','waitingOn','NONE'); END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id
    ORDER BY (status='OPEN') DESC,created_at DESC,id DESC LIMIT 1;
  SELECT * INTO appt FROM vendor_handoff.appointment WHERE org_id=a.org_id AND assignment_id=a.id AND status IN ('SCHEDULED','OCCURRED')
    ORDER BY (status='SCHEDULED') DESC,created_at DESC,id DESC LIMIT 1;
  IF r.status='OPEN' THEN
    SELECT * INTO sub FROM vendor_handoff.tenant_availability_submission WHERE org_id=a.org_id AND round_id=r.id ORDER BY round_sequence DESC LIMIT 1;
    IF sub.id IS NOT NULL THEN
      SELECT * INTO auth FROM vendor_handoff.tenant_entry_authorization WHERE org_id=a.org_id AND submission_id=sub.id ORDER BY round_sequence DESC LIMIT 1;
    END IF;
    SELECT * INTO prop FROM vendor_handoff.vendor_slot_proposal WHERE org_id=a.org_id AND round_id=r.id AND round_sequence>coalesce(sub.round_sequence,0)
      ORDER BY round_sequence DESC LIMIT 1;
  END IF;
  IF sub.id IS NOT NULL THEN
    availability:=jsonb_build_object('id',sub.id,
      'windows',(SELECT jsonb_agg(jsonb_build_object('id',w.id,'startAt',w.start_at,'endAt',w.end_at) ORDER BY w.start_at,w.id)
        FROM vendor_handoff.tenant_availability_window w WHERE w.org_id=a.org_id AND w.submission_id=sub.id),
      'authorizedWindowIds',coalesce((SELECT jsonb_agg(x.window_id ORDER BY w.start_at,w.id)
        FROM vendor_handoff.tenant_entry_authorization_window x JOIN vendor_handoff.tenant_availability_window w ON w.id=x.window_id
        WHERE x.org_id=a.org_id AND x.authorization_id=auth.id),'[]'::jsonb),
      'createdAt',sub.created_at);
  END IF;
  IF prop.id IS NOT NULL THEN
    proposal:=jsonb_build_object('id',prop.id,
      'slots',(SELECT jsonb_agg(jsonb_build_object('id',v.id,'startAt',v.start_at,'endAt',v.end_at) ORDER BY v.start_at,v.id)
        FROM vendor_handoff.vendor_slot v WHERE v.org_id=a.org_id AND v.proposal_id=prop.id),
      'createdAt',prop.created_at);
  END IF;
  IF a.status='ACTIVE' AND r.id IS NOT NULL THEN
    mode:=CASE WHEN r.status='OPEN' THEN
        CASE WHEN auth.id IS NOT NULL AND p.body->>'accessPolicy'='TENANT_PREAUTHORIZATION_ALLOWED' THEN 'PREAUTHORIZED_ENTRY_WINDOW' ELSE 'RESIDENT_CONFIRMATION_REQUIRED' END
      WHEN appt.confirmation_mode='PREAUTHORIZED_ENTRY' THEN 'PREAUTHORIZED_ENTRY_WINDOW' ELSE 'RESIDENT_CONFIRMATION_REQUIRED' END;
  END IF;
  IF a.status='ENDED' THEN phase:='ENDED';waiting:='NONE';
  ELSIF a.status='OFFERED' THEN phase:='OFFERED';waiting:='VENDOR';
  ELSIF a.status='PREPARING' THEN phase:='IN_PROGRESS';waiting:='NONE';
  ELSIF r.status='OPEN' THEN
    phase:='SCHEDULING';
    waiting:=CASE WHEN mode='PREAUTHORIZED_ENTRY_WINDOW' THEN 'VENDOR' WHEN prop.id IS NOT NULL THEN 'TENANT' WHEN sub.id IS NOT NULL THEN 'VENDOR' ELSE 'TENANT' END;
  ELSIF appt.status='SCHEDULED' THEN phase:='SCHEDULED';waiting:='VENDOR';
  ELSE phase:='IN_PROGRESS';waiting:='VENDOR';
  END IF;
  RETURN jsonb_build_object(
    'currentRound',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'openedPacketRevisionId',r.opened_packet_revision_id,
      'purpose',r.purpose,'status',r.status,'version',r.version,'createdAt',r.created_at) END,
    'appointment',CASE WHEN appt.id IS NULL THEN NULL ELSE jsonb_build_object('id',appt.id,'schedulingRoundId',appt.round_id,
      'packetRevisionId',appt.packet_revision_id,'proposalId',appt.proposal_id,'availabilitySubmissionId',appt.availability_submission_id,
      'selectedWindowId',appt.selected_window_id,'startAt',appt.start_at,'endAt',appt.end_at,'confirmationMode',appt.confirmation_mode,
      'status',appt.status,'createdAt',appt.created_at) END,
    'availability',availability,'proposal',proposal,'effectiveMode',mode,'accessPolicy',p.body->>'accessPolicy',
    'packetRevisionId',p.id,'phase',phase,'waitingOn',waiting);
END $$;

CREATE OR REPLACE FUNCTION vendor_handoff.job_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;sched jsonb;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  sched:=vendor_handoff.scheduling_projection(a.id);
  RETURN jsonb_build_object('assignmentId',a.id,'assignmentVersion',a.version,'status',a.status,'endReason',a.end_reason,
    'phase',sched->>'phase','waitingOn',sched->>'waitingOn','currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,
    'currentRound',sched->'currentRound','appointment',sched->'appointment','activeBlocker',NULL,'currentReport',NULL,
    'effectiveMode',sched->'effectiveMode','availability',sched->'availability','proposal',sched->'proposal');
END $$;

-- Tenant projection: no vendorLabel, private notes, occupancy provenance or Vendor credentials.
CREATE FUNCTION vendor_handoff.tenant_projection(p_assignment uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;sched jsonb;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  sched:=vendor_handoff.scheduling_projection(a.id);
  RETURN jsonb_build_object('ticketId',a.ticket_id,'assignmentVersion',a.version,'packetRevisionId',sched->'packetRevisionId',
    'effectiveMode',CASE WHEN jsonb_typeof(sched->'effectiveMode')='string' THEN sched->'effectiveMode' ELSE '"RESIDENT_CONFIRMATION_REQUIRED"'::jsonb END,'phase',sched->>'phase','waitingOn',sched->>'waitingOn',
    'currentRound',sched->'currentRound','appointment',sched->'appointment','accessPolicy',sched->'accessPolicy',
    'availability',sched->'availability','proposal',sched->'proposal');
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
    'currentPacket',CASE WHEN p.id IS NULL THEN NULL ELSE p.body END,'currentRound',sched->'currentRound','appointment',sched->'appointment','activeBlocker',NULL,
    'currentReport',NULL,'reportHistory','[]'::jsonb,'phase',coalesce(sched->>'phase',phase),'waitingOn',coalesce(sched->>'waitingOn','NONE'),
    'packetSource',jsonb_build_object('jobReference',p_ticket,'buildingName',s->'building'->>'displayName',
      'serviceAddress',nullif(btrim(s->'building'->>'serviceAddress'),''),'unitLabel',nullif(btrim(s->>'unitLabel'),''),
      'issueType',s->'ticket'->>'issueType','sharedDetails',vendor_handoff.packet_detail_candidates(s),
      'sourcePhotoIds',coalesce((SELECT jsonb_agg(x->'photoId') FROM jsonb_array_elements(s->'photos') x),'[]'::jsonb),'safetyNotice','[]'::jsonb));
END $$;

-- Consequential packet contract changes: block silent change beneath a confirmed Appointment (BEFORE)
-- and restart an unconfirmed OPEN round at the new revision without labeling it RESCHEDULE (AFTER).
CREATE FUNCTION vendor_handoff.packet_scheduling_guard() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prev vendor_handoff.work_packet_revision;basis vendor_handoff.work_packet_revision;appt vendor_handoff.appointment;r vendor_handoff.scheduling_round;
BEGIN
  SELECT * INTO prev FROM vendor_handoff.work_packet_revision
    WHERE org_id=NEW.org_id AND assignment_id=NEW.assignment_id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1;
  IF prev.id IS NULL THEN RETURN NEW; END IF;
  IF TG_WHEN='BEFORE' THEN
    FOR appt IN SELECT * FROM vendor_handoff.appointment WHERE org_id=NEW.org_id AND assignment_id=NEW.assignment_id AND status='SCHEDULED' LOOP
      SELECT * INTO basis FROM vendor_handoff.work_packet_revision WHERE id=appt.packet_revision_id;
      IF (basis.body->>'serviceAddress',basis.body->>'unitLabel',basis.body->>'accessPolicy')
         IS DISTINCT FROM (NEW.body->>'serviceAddress',NEW.body->>'unitLabel',NEW.body->>'accessPolicy')
      THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  IF (prev.body->>'serviceAddress',prev.body->>'unitLabel',prev.body->>'accessPolicy')
     IS NOT DISTINCT FROM (NEW.body->>'serviceAddress',NEW.body->>'unitLabel',NEW.body->>'accessPolicy') THEN RETURN NEW; END IF;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=NEW.org_id AND assignment_id=NEW.assignment_id AND status='OPEN' FOR UPDATE;
  IF r.id IS NOT NULL THEN
    UPDATE vendor_handoff.scheduling_round SET status='SUPERSEDED',closed_at=clock_timestamp(),version=version+1 WHERE id=r.id;
    INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,previous_appointment_id,source_blocker_id,source_completion_report_id)
      VALUES(NEW.org_id,NEW.assignment_id,NEW.id,r.purpose,'OPEN',r.previous_appointment_id,r.source_blocker_id,r.source_completion_report_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER work_packet_revision_scheduling_before BEFORE INSERT ON vendor_handoff.work_packet_revision
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.packet_scheduling_guard();
CREATE TRIGGER work_packet_revision_scheduling_after AFTER INSERT ON vendor_handoff.work_packet_revision
  FOR EACH ROW EXECUTE FUNCTION vendor_handoff.packet_scheduling_guard();

-- Shared Vendor mutation prologue: session digest -> route -> source-ticket lock -> post-wait session/CSRF recheck -> assignment lock.
CREATE FUNCTION vendor_handoff.vendor_command(p_session_digest bytea,p_csrf_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s vendor_handoff.vendor_session;a vendor_handoff.vendor_assignment;t jsonb;route_org uuid;route_assignment uuid;route_ticket text;
BEGIN
  IF p_session_digest IS NULL OR octet_length(p_session_digest)<>32 OR p_csrf_digest IS NULL OR octet_length(p_csrf_digest)<>32
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM set_config('app.vendor_session_digest',encode(p_session_digest,'hex'),true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_session_digest;
  IF s.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM set_config('app.org_id',s.org_id::text,true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=s.assignment_id AND org_id=s.org_id;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  route_org:=s.org_id;route_assignment:=a.id;route_ticket:=a.ticket_id;
  t:=core_flow.vendor_handoff_lock_ticket(route_org,route_ticket);
  PERFORM set_config('app.org_id',route_org::text,true);
  SELECT * INTO s FROM vendor_handoff.vendor_session WHERE digest=p_session_digest AND org_id=route_org AND assignment_id=route_assignment;
  IF s.id IS NULL OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp()
  THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  IF s.csrf_digest<>p_csrf_digest THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=route_assignment AND org_id=route_org AND ticket_id=route_ticket FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  RETURN jsonb_build_object('sessionId',s.id,'orgId',route_org,'assignmentId',a.id,'ticketId',route_ticket,'workStatus',t->>'workStatus');
END $$;

-- Shared Tenant mutation prologue: digest-bound current Tenant context with source-ticket lock and post-wait recheck, then assignment lock.
CREATE FUNCTION vendor_handoff.tenant_command(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;
BEGIN
  c:=core_flow.vendor_handoff_tenant_context(p_digest,p_ticket,true);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE org_id=(c->>'orgId')::uuid AND ticket_id=p_ticket AND status IN ('OFFERED','ACTIVE') FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN c||jsonb_build_object('assignmentId',a.id);
END $$;

-- Common RESCHEDULE: requires a current future SCHEDULED Appointment; supersedes it and opens one RESCHEDULE round.
CREATE FUNCTION vendor_handoff.reschedule_core(p_assignment uuid,p_expected_assignment bigint,p_expected_round bigint,p_expected_appointment uuid,p_expected_packet uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;appt vendor_handoff.appointment;
BEGIN
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY (status='OPEN') DESC,created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  SELECT * INTO appt FROM vendor_handoff.appointment WHERE org_id=a.org_id AND assignment_id=a.id AND id=p_expected_appointment FOR UPDATE;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR r.id IS NULL OR r.version<>p_expected_round
    OR r.status<>'CONFIRMED' OR appt.id IS NULL OR appt.round_id<>r.id OR appt.status<>'SCHEDULED' OR appt.start_at<=clock_timestamp()
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  UPDATE vendor_handoff.appointment SET status='SUPERSEDED' WHERE id=appt.id;
  INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,previous_appointment_id)
    VALUES(a.org_id,a.id,p.id,'RESCHEDULE','OPEN',appt.id);
END $$;

CREATE FUNCTION vendor_handoff.accept(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_expected_assignment bigint,p_expected_packet uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('accept',a.id,p_expected_assignment,p_expected_packet));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  IF a.status<>'OFFERED' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR ctx->>'workStatus'='COMPLETED'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  -- ACTIVE and the first INITIAL/OPEN round commit together; ACTIVE is never observable without it.
  UPDATE vendor_handoff.vendor_assignment SET status='ACTIVE',version=version+1 WHERE id=a.id;
  INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status)
    VALUES(a.org_id,a.id,p.id,'INITIAL','OPEN');
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.withdraw(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_expected_assignment bigint,p_expected_packet uuid,p_note text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;note text;fp bytea;prior jsonb;result jsonb;
BEGIN
  note:=CASE WHEN p_note IS NULL THEN NULL ELSE btrim(p_note) END;
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_packet IS NULL
    OR (note IS NOT NULL AND char_length(note) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('withdraw',a.id,p_expected_assignment,p_expected_packet,note));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  -- ENDED denies every Vendor read/mutation; only still-actionable scheduling is cancelled, history is preserved.
  UPDATE vendor_handoff.scheduling_round SET status='CANCELLED',closed_at=clock_timestamp(),version=version+1
    WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN';
  UPDATE vendor_handoff.appointment SET status='CANCELLED' WHERE org_id=a.org_id AND assignment_id=a.id AND status='SCHEDULED';
  UPDATE vendor_handoff.vendor_assignment
    SET status='ENDED',end_reason='WITHDRAWN',ended_at=clock_timestamp(),version=version+1,end_note=note WHERE id=a.id;
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.propose_slots(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,p_expected_packet uuid,p_slots jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  sub vendor_handoff.tenant_availability_submission;slots jsonb;proposal_id uuid;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1 OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  slots:=vendor_handoff.parse_intervals(p_slots);
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('proposeSlots',a.id,p_expected_assignment,p_expected_round,p_expected_packet,slots));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN' FOR UPDATE;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR r.id IS NULL OR r.version<>p_expected_round
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  SELECT * INTO sub FROM vendor_handoff.tenant_availability_submission WHERE org_id=a.org_id AND round_id=r.id ORDER BY round_sequence DESC LIMIT 1;
  INSERT INTO vendor_handoff.vendor_slot_proposal(org_id,assignment_id,round_id,packet_revision_id,availability_submission_id,round_sequence)
    VALUES(a.org_id,a.id,r.id,p.id,sub.id,r.version+1) RETURNING id INTO proposal_id;
  INSERT INTO vendor_handoff.vendor_slot(org_id,proposal_id,start_at,end_at)
    SELECT a.org_id,proposal_id,(x->>'startAt')::timestamptz,(x->>'endAt')::timestamptz FROM jsonb_array_elements(slots) x;
  UPDATE vendor_handoff.scheduling_round SET version=version+1 WHERE id=r.id;
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.select_preauthorized_slot(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_packet uuid,p_submission uuid,p_window uuid,p_start text,p_end text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  sub vendor_handoff.tenant_availability_submission;auth vendor_handoff.tenant_entry_authorization;w vendor_handoff.tenant_availability_window;
  s timestamptz;e timestamptz;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1
    OR p_expected_packet IS NULL OR p_submission IS NULL OR p_window IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  BEGIN s:=p_start::timestamptz;e:=p_end::timestamptz;
  EXCEPTION WHEN others THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END;
  IF s IS NULL OR e IS NULL OR NOT isfinite(s) OR NOT isfinite(e) OR s>=e THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('selectPreauthorizedSlot',a.id,p_expected_assignment,p_expected_round,p_expected_packet,p_submission,p_window,s,e));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN' FOR UPDATE;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR r.id IS NULL OR r.version<>p_expected_round
    OR p.body->>'accessPolicy'<>'TENANT_PREAUTHORIZATION_ALLOWED'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  SELECT * INTO sub FROM vendor_handoff.tenant_availability_submission WHERE org_id=a.org_id AND round_id=r.id ORDER BY round_sequence DESC LIMIT 1;
  IF sub.id IS NOT NULL THEN
    SELECT * INTO auth FROM vendor_handoff.tenant_entry_authorization WHERE org_id=a.org_id AND submission_id=sub.id ORDER BY round_sequence DESC LIMIT 1;
  END IF;
  SELECT w0.* INTO w FROM vendor_handoff.tenant_availability_window w0
    JOIN vendor_handoff.tenant_entry_authorization_window x ON x.window_id=w0.id AND x.authorization_id=auth.id
    WHERE w0.org_id=a.org_id AND w0.id=p_window AND w0.submission_id=sub.id;
  -- Exact current submission + explicitly authorized window + full containment + still-current authorizing occupancy member.
  IF sub.id IS NULL OR sub.id<>p_submission OR auth.id IS NULL OR w.id IS NULL OR s<w.start_at OR e>w.end_at OR s<=clock_timestamp()
    OR NOT core_flow.vendor_handoff_recheck_occupancy(a.org_id,a.ticket_id,auth.occupancy_member_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  PERFORM set_config('app.org_id',a.org_id::text,true);
  INSERT INTO vendor_handoff.appointment(org_id,assignment_id,round_id,packet_revision_id,availability_submission_id,selected_window_id,
      entry_authorization_id,occupancy_member_id,start_at,end_at,confirmation_mode,status)
    VALUES(a.org_id,a.id,r.id,p.id,sub.id,w.id,auth.id,auth.occupancy_member_id,s,e,'PREAUTHORIZED_ENTRY','SCHEDULED');
  UPDATE vendor_handoff.scheduling_round SET status='CONFIRMED',closed_at=clock_timestamp(),version=version+1 WHERE id=r.id;
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.vendor_reschedule(p_session_digest bytea,p_csrf_digest bytea,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_appointment uuid,p_expected_packet uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb;a vendor_handoff.vendor_assignment;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1
    OR p_expected_appointment IS NULL OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  ctx:=vendor_handoff.vendor_command(p_session_digest,p_csrf_digest);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(ctx->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('reschedule',a.id,p_expected_assignment,p_expected_round,p_expected_appointment,p_expected_packet));
  prior:=vendor_handoff.receipt(a.org_id,'VENDOR',ctx->>'sessionId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
  PERFORM vendor_handoff.reschedule_core(a.id,p_expected_assignment,p_expected_round,p_expected_appointment,p_expected_packet);
  result:=vendor_handoff.job_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'VENDOR',ctx->>'sessionId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.tenant_read(p_digest bytea,p_ticket text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;
BEGIN
  c:=core_flow.vendor_handoff_tenant_context(p_digest,p_ticket,false);
  PERFORM set_config('app.org_id',c->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE org_id=(c->>'orgId')::uuid AND ticket_id=p_ticket AND status IN ('OFFERED','ACTIVE');
  IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id)
  THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  RETURN vendor_handoff.tenant_projection(a.id);
END $$;

CREATE FUNCTION vendor_handoff.tenant_submit_availability(p_digest bytea,p_ticket text,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_packet uuid,p_windows jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  windows jsonb;submission_id uuid;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1 OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  windows:=vendor_handoff.parse_intervals(p_windows);
  c:=vendor_handoff.tenant_command(p_digest,p_ticket);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(c->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('submitAvailability',a.id,p_expected_assignment,p_expected_round,p_expected_packet,windows));
  prior:=vendor_handoff.receipt(a.org_id,'TENANT',c->>'occupancyMemberId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN' FOR UPDATE;
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR r.id IS NULL OR r.version<>p_expected_round
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  -- Availability never creates unattended-entry authorization; a new submission supersedes the current proposal in-round.
  INSERT INTO vendor_handoff.tenant_availability_submission(org_id,assignment_id,round_id,packet_revision_id,occupancy_member_id,round_sequence)
    VALUES(a.org_id,a.id,r.id,p.id,(c->>'occupancyMemberId')::uuid,r.version+1) RETURNING id INTO submission_id;
  INSERT INTO vendor_handoff.tenant_availability_window(org_id,submission_id,start_at,end_at)
    SELECT a.org_id,submission_id,(x->>'startAt')::timestamptz,(x->>'endAt')::timestamptz FROM jsonb_array_elements(windows) x;
  UPDATE vendor_handoff.scheduling_round SET version=version+1 WHERE id=r.id;
  result:=vendor_handoff.tenant_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'TENANT',c->>'occupancyMemberId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.tenant_authorize_entry(p_digest bytea,p_ticket text,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_packet uuid,p_submission uuid,p_windows uuid[]) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  sub vendor_handoff.tenant_availability_submission;windows uuid[];authorization_id uuid;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1
    OR p_expected_packet IS NULL OR p_submission IS NULL OR p_windows IS NULL OR cardinality(p_windows) NOT BETWEEN 1 AND 5
    OR array_position(p_windows,NULL) IS NOT NULL OR cardinality(p_windows)<>(SELECT count(DISTINCT x) FROM unnest(p_windows) x)
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  windows:=ARRAY(SELECT x FROM unnest(p_windows) x ORDER BY x);
  c:=vendor_handoff.tenant_command(p_digest,p_ticket);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(c->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('authorizeEntry',a.id,p_expected_assignment,p_expected_round,p_expected_packet,p_submission,to_jsonb(windows)));
  prior:=vendor_handoff.receipt(a.org_id,'TENANT',c->>'occupancyMemberId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN' FOR UPDATE;
  IF r.id IS NOT NULL THEN
    SELECT * INTO sub FROM vendor_handoff.tenant_availability_submission WHERE org_id=a.org_id AND round_id=r.id ORDER BY round_sequence DESC LIMIT 1;
  END IF;
  -- Only the current Tenant, only under a permitting policy, only exact windows of the current submission.
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR r.id IS NULL OR r.version<>p_expected_round
    OR p.body->>'accessPolicy'<>'TENANT_PREAUTHORIZATION_ALLOWED' OR sub.id IS NULL OR sub.id<>p_submission
    OR cardinality(windows)<>(SELECT count(*) FROM vendor_handoff.tenant_availability_window w WHERE w.org_id=a.org_id AND w.submission_id=sub.id AND w.id=ANY(windows))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.tenant_entry_authorization(org_id,assignment_id,round_id,submission_id,occupancy_member_id,packet_revision_id,round_sequence)
    VALUES(a.org_id,a.id,r.id,sub.id,(c->>'occupancyMemberId')::uuid,p.id,r.version+1) RETURNING id INTO authorization_id;
  INSERT INTO vendor_handoff.tenant_entry_authorization_window(org_id,authorization_id,submission_id,window_id)
    SELECT a.org_id,authorization_id,sub.id,x FROM unnest(windows) x;
  UPDATE vendor_handoff.scheduling_round SET version=version+1 WHERE id=r.id;
  result:=vendor_handoff.tenant_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'TENANT',c->>'occupancyMemberId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.tenant_confirm_slot(p_digest bytea,p_ticket text,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_packet uuid,p_proposal uuid,p_slot uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;p vendor_handoff.work_packet_revision;r vendor_handoff.scheduling_round;
  sub vendor_handoff.tenant_availability_submission;prop vendor_handoff.vendor_slot_proposal;slot vendor_handoff.vendor_slot;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1
    OR p_expected_packet IS NULL OR p_proposal IS NULL OR p_slot IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  c:=vendor_handoff.tenant_command(p_digest,p_ticket);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(c->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('confirmSlot',a.id,p_expected_assignment,p_expected_round,p_expected_packet,p_proposal,p_slot));
  prior:=vendor_handoff.receipt(a.org_id,'TENANT',c->>'occupancyMemberId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  SELECT * INTO p FROM vendor_handoff.work_packet_revision WHERE org_id=a.org_id AND assignment_id=a.id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO r FROM vendor_handoff.scheduling_round WHERE org_id=a.org_id AND assignment_id=a.id AND status='OPEN' FOR UPDATE;
  IF r.id IS NOT NULL THEN
    SELECT * INTO sub FROM vendor_handoff.tenant_availability_submission WHERE org_id=a.org_id AND round_id=r.id ORDER BY round_sequence DESC LIMIT 1;
    SELECT * INTO prop FROM vendor_handoff.vendor_slot_proposal WHERE org_id=a.org_id AND round_id=r.id AND round_sequence>coalesce(sub.round_sequence,0)
      ORDER BY round_sequence DESC LIMIT 1;
    SELECT * INTO slot FROM vendor_handoff.vendor_slot WHERE org_id=a.org_id AND proposal_id=prop.id AND id=p_slot;
  END IF;
  -- Explicit Tenant choice of one slot of the current proposal; superseded proposals and foreign slots never confirm.
  IF a.status<>'ACTIVE' OR a.version<>p_expected_assignment OR p.id IS DISTINCT FROM p_expected_packet OR r.id IS NULL OR r.version<>p_expected_round
    OR prop.id IS NULL OR prop.id<>p_proposal OR slot.id IS NULL OR slot.start_at<=clock_timestamp()
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  INSERT INTO vendor_handoff.appointment(org_id,assignment_id,round_id,packet_revision_id,proposal_id,slot_id,start_at,end_at,confirmation_mode,status)
    VALUES(a.org_id,a.id,r.id,p.id,prop.id,slot.id,slot.start_at,slot.end_at,'TENANT_CONFIRMED','SCHEDULED');
  UPDATE vendor_handoff.scheduling_round SET status='CONFIRMED',closed_at=clock_timestamp(),version=version+1 WHERE id=r.id;
  result:=vendor_handoff.tenant_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'TENANT',c->>'occupancyMemberId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.tenant_reschedule(p_digest bytea,p_ticket text,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_appointment uuid,p_expected_packet uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;a vendor_handoff.vendor_assignment;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1
    OR p_expected_appointment IS NULL OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  c:=vendor_handoff.tenant_command(p_digest,p_ticket);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=(c->>'assignmentId')::uuid;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('reschedule',a.id,p_expected_assignment,p_expected_round,p_expected_appointment,p_expected_packet));
  prior:=vendor_handoff.receipt(a.org_id,'TENANT',c->>'occupancyMemberId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  PERFORM vendor_handoff.reschedule_core(a.id,p_expected_assignment,p_expected_round,p_expected_appointment,p_expected_packet);
  result:=vendor_handoff.tenant_projection(a.id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'TENANT',c->>'occupancyMemberId',p_request,fp,result);
  RETURN result;
END $$;

CREATE FUNCTION vendor_handoff.manager_reschedule(p_digest bytea,p_assignment uuid,p_request uuid,p_expected_assignment bigint,p_expected_round bigint,
  p_expected_appointment uuid,p_expected_packet uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a vendor_handoff.vendor_assignment;s jsonb;fp bytea;prior jsonb;result jsonb;
BEGIN
  IF p_request IS NULL OR p_expected_assignment IS NULL OR p_expected_assignment<1 OR p_expected_round IS NULL OR p_expected_round<1
    OR p_expected_appointment IS NULL OR p_expected_packet IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment;
  IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  -- Digest-authorized Manager bridge takes the source-ticket lock and reauthorizes after the wait.
  s:=core_flow.vendor_handoff_source(p_digest,a.ticket_id,'{}'::uuid[],true);
  PERFORM set_config('app.org_id',s->>'orgId',true);
  SELECT * INTO a FROM vendor_handoff.vendor_assignment WHERE id=p_assignment AND org_id=(s->>'orgId')::uuid FOR UPDATE;
  IF a.id IS NULL OR a.status='ENDED' THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
  fp:=vendor_handoff.request_fingerprint(jsonb_build_array('reschedule',a.id,p_expected_assignment,p_expected_round,p_expected_appointment,p_expected_packet));
  prior:=vendor_handoff.receipt(a.org_id,'MANAGER',s->>'actorId',p_request,fp);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  PERFORM vendor_handoff.reschedule_core(a.id,p_expected_assignment,p_expected_round,p_expected_appointment,p_expected_packet);
  result:=vendor_handoff.manager_read(p_digest,a.ticket_id);
  INSERT INTO vendor_handoff.command_receipt(org_id,assignment_id,actor_scope,actor_id,request_key,fingerprint,result)
    VALUES(a.org_id,a.id,'MANAGER',s->>'actorId',p_request,fp,result);
  RETURN result;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA vendor_handoff FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vendor_handoff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vendor_handoff.accept(bytea,bytea,uuid,bigint,uuid),
  vendor_handoff.withdraw(bytea,bytea,uuid,bigint,uuid,text),
  vendor_handoff.propose_slots(bytea,bytea,uuid,bigint,bigint,uuid,jsonb),
  vendor_handoff.select_preauthorized_slot(bytea,bytea,uuid,bigint,bigint,uuid,uuid,uuid,text,text),
  vendor_handoff.vendor_reschedule(bytea,bytea,uuid,bigint,bigint,uuid,uuid)
  TO bm_vendor_web;
GRANT EXECUTE ON FUNCTION vendor_handoff.tenant_read(bytea,text),
  vendor_handoff.tenant_submit_availability(bytea,text,uuid,bigint,bigint,uuid,jsonb),
  vendor_handoff.tenant_authorize_entry(bytea,text,uuid,bigint,bigint,uuid,uuid,uuid[]),
  vendor_handoff.tenant_confirm_slot(bytea,text,uuid,bigint,bigint,uuid,uuid,uuid),
  vendor_handoff.tenant_reschedule(bytea,text,uuid,bigint,bigint,uuid,uuid),
  vendor_handoff.manager_reschedule(bytea,uuid,uuid,bigint,bigint,uuid,uuid)
  TO bm_b1_web;

RESET ROLE;

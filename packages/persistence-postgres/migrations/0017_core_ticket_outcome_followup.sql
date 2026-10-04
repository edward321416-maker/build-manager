-- Tenant assertions and atomic fresh follow-ups; completed source rows are never updated.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE TABLE core_flow.ticket_outcome_assertion (
 id uuid PRIMARY KEY DEFAULT uuidv7(),org_id uuid NOT NULL,ticket_id text NOT NULL,
 actor_id uuid NOT NULL REFERENCES app.app_user(id),
 kind text NOT NULL CHECK(kind IN ('RESOLVED','UNRESOLVED','RECURRENCE_CLAIM')),
 client_request_id uuid NOT NULL,request_fingerprint bytea NOT NULL CHECK(octet_length(request_fingerprint)=32),
 related_ticket_id text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(org_id,actor_id,client_request_id),
 UNIQUE(org_id,id,ticket_id,related_ticket_id,kind,actor_id),
 FOREIGN KEY(org_id,ticket_id) REFERENCES core_flow.ticket(org_id,id),
 FOREIGN KEY(org_id,related_ticket_id) REFERENCES core_flow.ticket(org_id,id),
 CHECK((kind='RESOLVED' AND related_ticket_id IS NULL) OR (kind<>'RESOLVED' AND related_ticket_id IS NOT NULL))
);
CREATE UNIQUE INDEX outcome_one_resolved ON core_flow.ticket_outcome_assertion(org_id,ticket_id) WHERE kind='RESOLVED';
CREATE INDEX outcome_ticket_latest ON core_flow.ticket_outcome_assertion(org_id,ticket_id,created_at DESC,id DESC);
CREATE TABLE core_flow.ticket_follow_up (
 source_ticket_id text PRIMARY KEY,org_id uuid NOT NULL,target_ticket_id text NOT NULL UNIQUE,
 claim_kind text NOT NULL CHECK(claim_kind IN ('UNRESOLVED','RECURRENCE_CLAIM')),
 assertion_id uuid NOT NULL UNIQUE,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(source_ticket_id<>target_ticket_id),
 FOREIGN KEY(org_id,source_ticket_id) REFERENCES core_flow.ticket(org_id,id),
 FOREIGN KEY(org_id,target_ticket_id) REFERENCES core_flow.ticket(org_id,id),
 FOREIGN KEY(org_id,assertion_id,source_ticket_id,target_ticket_id,claim_kind,created_by)
 REFERENCES core_flow.ticket_outcome_assertion(org_id,id,ticket_id,related_ticket_id,kind,actor_id)
);
ALTER TABLE core_flow.ticket_outcome_assertion ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_outcome_assertion FORCE ROW LEVEL SECURITY;
CREATE POLICY outcome_org ON core_flow.ticket_outcome_assertion TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY outcome_ceiling ON core_flow.ticket_outcome_assertion AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE core_flow.ticket_follow_up ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_follow_up FORCE ROW LEVEL SECURITY;
CREATE POLICY follow_up_org ON core_flow.ticket_follow_up TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY follow_up_ceiling ON core_flow.ticket_follow_up AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE FUNCTION core_flow.outcome_ticket(p_digest bytea,p_id text,p_mutate boolean) RETURNS core_flow.ticket
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;s jsonb;
BEGIN
 t:=core_flow.communication_ticket(p_digest,p_id,p_mutate);
 s:=core_flow.session(p_digest);
 IF p_mutate AND (s->>'role'<>'TENANT' OR t.tenant_id<>(s->>'actorId')::uuid) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN';END IF;
 IF p_mutate AND t.work_status<>'COMPLETED' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 RETURN t;
END $$;
CREATE FUNCTION core_flow.outcome_assertion_json(a core_flow.ticket_outcome_assertion) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('ticketId',a.ticket_id,'kind',a.kind,'assertedAt',a.created_at,'followUpTicketId',a.related_ticket_id)
$$;
CREATE FUNCTION core_flow.outcome_fingerprint(p_kind text,p_issue text,p_text text) RETURNS bytea
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT sha256(convert_to(jsonb_build_array(p_kind,p_issue,p_text)::text,'UTF8'))
$$;
CREATE FUNCTION core_flow.validate_ticket_follow_up() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE source core_flow.ticket;target core_flow.ticket;
BEGIN
 SELECT * INTO source FROM core_flow.ticket WHERE org_id=NEW.org_id AND id=NEW.source_ticket_id;
 SELECT * INTO target FROM core_flow.ticket WHERE org_id=NEW.org_id AND id=NEW.target_ticket_id;
 IF source.id IS NULL OR target.id IS NULL OR source.work_status<>'COMPLETED' OR source.unit_id<>target.unit_id
 OR source.tenant_id<>NEW.created_by OR target.tenant_id<>NEW.created_by THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER follow_up_location BEFORE INSERT ON core_flow.ticket_follow_up FOR EACH ROW EXECUTE FUNCTION core_flow.validate_ticket_follow_up();

CREATE FUNCTION core_flow.read_ticket_outcome(p_digest bytea,p_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;a core_flow.ticket_outcome_assertion;
BEGIN
 t:=core_flow.outcome_ticket(p_digest,p_id,false);
 SELECT * INTO a FROM core_flow.ticket_outcome_assertion WHERE org_id=t.org_id AND ticket_id=t.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF a.id IS NULL THEN RETURN jsonb_build_object('ticketId',p_id,'kind','UNCONFIRMED','assertedAt',NULL,'followUpTicketId',NULL);END IF;
 IF a.related_ticket_id IS NOT NULL THEN PERFORM core_flow.read_ticket(p_digest,a.related_ticket_id,false);END IF;
 RETURN core_flow.outcome_assertion_json(a);
END $$;
CREATE FUNCTION core_flow.confirm_ticket_resolved(p_digest bytea,p_id text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;a core_flow.ticket_outcome_assertion;s jsonb;fp bytea;
BEGIN
 t:=core_flow.outcome_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 IF p_key IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';END IF;
 fp:=core_flow.outcome_fingerprint('RESOLVED',NULL,NULL);
 SELECT * INTO a FROM core_flow.ticket_outcome_assertion WHERE org_id=t.org_id AND actor_id=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF a.id IS NOT NULL THEN
  IF a.ticket_id<>p_id OR a.request_fingerprint<>fp THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
  RETURN jsonb_build_object('outcome',core_flow.outcome_assertion_json(a),'created',false);
 END IF;
 IF EXISTS(SELECT 1 FROM core_flow.ticket_outcome_assertion WHERE org_id=t.org_id AND ticket_id=t.id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 INSERT INTO core_flow.ticket_outcome_assertion(org_id,ticket_id,actor_id,kind,client_request_id,request_fingerprint)
 VALUES(t.org_id,t.id,(s->>'actorId')::uuid,'RESOLVED',p_key,fp) RETURNING * INTO a;
 RETURN jsonb_build_object('outcome',core_flow.outcome_assertion_json(a),'created',true);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';
END $$;

-- NULL body is a write-free preparation step. The adapter retains this source lock in
-- the same transaction, constructs a fresh Ticket through normal domain intake, then calls again.
CREATE FUNCTION core_flow.create_ticket_follow_up(p_digest bytea,p_id text,p_key uuid,p_kind text,p_issue text,p_text text,p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;a core_flow.ticket_outcome_assertion;s jsonb;fp bytea;target_id text;
BEGIN
 t:=core_flow.outcome_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 IF p_key IS NULL OR p_kind IS NULL OR p_kind NOT IN ('UNRESOLVED','RECURRENCE_CLAIM')
 OR p_issue IS NULL OR p_issue NOT IN ('HEATING','LEAK') OR NOT core_flow.communication_valid_body(p_text)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';END IF;
 fp:=core_flow.outcome_fingerprint(p_kind,p_issue,p_text);
 SELECT * INTO a FROM core_flow.ticket_outcome_assertion WHERE org_id=t.org_id AND actor_id=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF a.id IS NOT NULL THEN
  IF a.ticket_id<>p_id OR a.request_fingerprint<>fp THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
  RETURN jsonb_build_object('sourceOutcome',core_flow.outcome_assertion_json(a),'ticket',core_flow.read_ticket(p_digest,a.related_ticket_id,false),'created',false);
 END IF;
 IF EXISTS(SELECT 1 FROM core_flow.ticket_follow_up WHERE org_id=t.org_id AND source_ticket_id=t.id)
 OR (p_kind='UNRESOLVED' AND EXISTS(SELECT 1 FROM core_flow.ticket_outcome_assertion WHERE org_id=t.org_id AND ticket_id=t.id AND kind='RESOLVED'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 IF p_body IS NULL THEN RETURN NULL;END IF;
 target_id:=p_body->>'id';
 IF jsonb_typeof(p_body)<>'object' OR target_id IS NULL OR target_id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 OR target_id=p_id OR EXISTS(SELECT 1 FROM core_flow.ticket WHERE id=target_id)
 OR p_body->>'unitId' IS DISTINCT FROM t.unit_id::text OR p_body->>'buildingId' IS DISTINCT FROM t.property_id::text
 OR p_body->>'issueType' IS DISTINCT FROM p_issue OR p_body->>'rawUserText' IS DISTINCT FROM p_text
 OR p_body->'answers' IS DISTINCT FROM '[]'::jsonb OR p_body->'evidence' IS DISTINCT FROM '[]'::jsonb
 OR p_body->'repairPacket' IS DISTINCT FROM 'null'::jsonb OR p_body->'routeDecision' IS DISTINCT FROM 'null'::jsonb OR p_body->'moreInfoRequest' IS DISTINCT FROM 'null'::jsonb
 OR (p_body-ARRAY['id','buildingId','unitId','issueType','rawUserText','status','protocolId','answers','evidence','safetyFlags','repairPacket','routeDecision','moreInfoRequest','createdAt','updatedAt'])<>'{}'::jsonb
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';END IF;
 PERFORM core_flow.store_ticket(p_digest,p_body,'CREATED','',NULL);
 INSERT INTO core_flow.ticket_outcome_assertion(org_id,ticket_id,actor_id,kind,client_request_id,request_fingerprint,related_ticket_id)
 VALUES(t.org_id,t.id,(s->>'actorId')::uuid,p_kind,p_key,fp,target_id) RETURNING * INTO a;
 INSERT INTO core_flow.ticket_follow_up(source_ticket_id,org_id,target_ticket_id,claim_kind,assertion_id,created_by)
 VALUES(t.id,t.org_id,target_id,p_kind,a.id,(s->>'actorId')::uuid);
 RETURN jsonb_build_object('sourceOutcome',core_flow.outcome_assertion_json(a),'ticket',core_flow.read_ticket(p_digest,target_id,false),'created',true);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';
END $$;
CREATE FUNCTION core_flow.outcome_receipt(p_digest bytea,p_id text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;a core_flow.ticket_outcome_assertion;s jsonb;
BEGIN
 t:=core_flow.outcome_ticket(p_digest,p_id,false);s:=core_flow.session(p_digest);
 SELECT * INTO a FROM core_flow.ticket_outcome_assertion WHERE org_id=t.org_id AND ticket_id=t.id AND actor_id=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF a.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND';END IF;
 IF a.related_ticket_id IS NOT NULL THEN PERFORM core_flow.read_ticket(p_digest,a.related_ticket_id,false);END IF;
 RETURN jsonb_build_object('outcome',core_flow.outcome_assertion_json(a),'targetTicketId',a.related_ticket_id);
END $$;
CREATE FUNCTION core_flow.read_follow_up_source(p_digest bytea,p_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;source text;
BEGIN
 t:=core_flow.outcome_ticket(p_digest,p_id,false);
 SELECT source_ticket_id INTO source FROM core_flow.ticket_follow_up WHERE org_id=t.org_id AND target_ticket_id=t.id;
 IF source IS NOT NULL THEN PERFORM core_flow.read_ticket(p_digest,source,false);END IF;
 RETURN jsonb_build_object('sourceTicketId',source);
END $$;
REVOKE ALL ON core_flow.ticket_outcome_assertion,core_flow.ticket_follow_up FROM PUBLIC;
REVOKE ALL ON FUNCTION core_flow.outcome_ticket(bytea,text,boolean),core_flow.outcome_assertion_json(core_flow.ticket_outcome_assertion),core_flow.outcome_fingerprint(text,text,text),core_flow.validate_ticket_follow_up(),
 core_flow.read_ticket_outcome(bytea,text),core_flow.confirm_ticket_resolved(bytea,text,uuid),core_flow.create_ticket_follow_up(bytea,text,uuid,text,text,text,jsonb),
 core_flow.outcome_receipt(bytea,text,uuid),core_flow.read_follow_up_source(bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.read_ticket_outcome(bytea,text),core_flow.confirm_ticket_resolved(bytea,text,uuid),
 core_flow.create_ticket_follow_up(bytea,text,uuid,text,text,text,jsonb),core_flow.outcome_receipt(bytea,text,uuid),core_flow.read_follow_up_source(bytea,text) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

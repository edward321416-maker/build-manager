-- Manager-only operations metadata. No historical ticket backfill or tenant DTO changes.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;
ALTER TABLE core_flow.ticket ADD CONSTRAINT core_ticket_org_id_key UNIQUE(org_id,id);
CREATE TABLE core_flow.ticket_work (
 ticket_id text PRIMARY KEY,org_id uuid NOT NULL,
 priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('NORMAL','HIGH','URGENT')),
 assignee_label text CHECK(assignee_label IS NULL OR (assignee_label=btrim(assignee_label) AND char_length(assignee_label) BETWEEN 1 AND 80 AND assignee_label !~ '[[:cntrl:]]')),
 due_at timestamptz CHECK(due_at IS NULL OR isfinite(due_at)),
 updated_by uuid NOT NULL REFERENCES app.app_user(id),updated_at timestamptz NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 FOREIGN KEY(org_id,ticket_id) REFERENCES core_flow.ticket(org_id,id)
);
CREATE TABLE core_flow.ticket_internal_note (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,ticket_id text NOT NULL,org_id uuid NOT NULL,
 author_id uuid NOT NULL REFERENCES app.app_user(id),
 body text NOT NULL CHECK(body=btrim(body,E' \r\n') AND char_length(body) BETWEEN 1 AND 2000 AND translate(body,E'\r\n','') !~ '[[:cntrl:]]'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(org_id,ticket_id) REFERENCES core_flow.ticket(org_id,id)
);
CREATE INDEX core_work_queue ON core_flow.ticket_work(org_id,due_at,ticket_id);
CREATE INDEX core_internal_note_history ON core_flow.ticket_internal_note(org_id,ticket_id,id DESC);
ALTER TABLE core_flow.ticket_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_work FORCE ROW LEVEL SECURITY;
CREATE POLICY work_org ON core_flow.ticket_work TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY work_org_ceiling ON core_flow.ticket_work AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE core_flow.ticket_internal_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_internal_note FORCE ROW LEVEL SECURITY;
CREATE POLICY internal_note_org ON core_flow.ticket_internal_note TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY internal_note_org_ceiling ON core_flow.ticket_internal_note AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

-- Private helper: recheck session, unit and assignment after acquiring the shared ticket lock.
CREATE FUNCTION core_flow.manager_ticket(p_digest bytea,p_id text,p_lock boolean) RETURNS core_flow.ticket
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;t core_flow.ticket;
BEGIN
 s:=core_flow.session(p_digest);
 IF s->>'role' NOT IN ('ORG_ADMIN','PROPERTY_STAFF') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 PERFORM core_flow.read_ticket(p_digest,p_id,p_lock);
 s:=core_flow.session(p_digest);
 IF s->>'role' NOT IN ('ORG_ADMIN','PROPERTY_STAFF') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO t FROM core_flow.ticket WHERE id=p_id AND org_id=app.current_org_id();
 IF t.id IS NULL OR NOT core_flow.can_unit(p_digest,t.unit_id) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN t;
END $$;

-- Called only with an authorized ticket by the private owner. No runtime EXECUTE grant.
CREATE FUNCTION core_flow.manager_work_json(t core_flow.ticket) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('ticketId',t.id,'unitId',t.unit_id,'buildingId',t.property_id,
 'buildingName',c.body->>'displayName','unitLabel',u.label,'issueType',t.body->>'issueType',
 'workStatus',t.work_status,'priority',coalesce(w.priority,'NORMAL'),'assigneeLabel',w.assignee_label,
 'dueAt',w.due_at,'createdAt',t.created_at,'updatedAt',coalesce(w.updated_at,t.updated_at),'version',coalesce(w.version,1))
 FROM app.unit u JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 LEFT JOIN core_flow.ticket_work w ON w.org_id=t.org_id AND w.ticket_id=t.id
 WHERE u.org_id=t.org_id AND u.id=t.unit_id AND t.org_id=app.current_org_id()
$$;

CREATE FUNCTION core_flow.read_manager_work(p_digest bytea,p_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RETURN core_flow.manager_work_json(core_flow.manager_ticket(p_digest,p_id,false)); END $$;

CREATE FUNCTION core_flow.list_manager_work(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;result jsonb;at_time timestamptz:=clock_timestamp();
BEGIN
 s:=core_flow.session(p_digest);
 IF s->>'role' NOT IN ('ORG_ADMIN','PROPERTY_STAFF') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT coalesce(jsonb_agg(core_flow.manager_work_json(t) ORDER BY
 (t.work_status='COMPLETED'),coalesce(w.due_at<at_time AND t.work_status<>'COMPLETED',false) DESC,
 CASE coalesce(w.priority,'NORMAL') WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
 w.due_at ASC NULLS LAST,t.created_at DESC,t.id),'[]'::jsonb) INTO result
 FROM core_flow.ticket t LEFT JOIN core_flow.ticket_work w ON w.org_id=t.org_id AND w.ticket_id=t.id
 WHERE t.org_id=app.current_org_id() AND core_flow.can_unit(p_digest,t.unit_id);
 RETURN result;
END $$;

CREATE FUNCTION core_flow.update_manager_work(p_digest bytea,p_id text,p_priority text,p_assignee text,p_due timestamptz,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;s jsonb;v bigint;
BEGIN
 t:=core_flow.manager_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 IF t.work_status='COMPLETED' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 IF p_priority IS NULL OR p_priority NOT IN ('NORMAL','HIGH','URGENT') OR p_version IS NULL OR p_version<=0
 OR (p_assignee IS NOT NULL AND (p_assignee<>btrim(p_assignee) OR char_length(p_assignee) NOT BETWEEN 1 AND 80 OR p_assignee ~ '[[:cntrl:]]'))
 OR (p_due IS NOT NULL AND NOT isfinite(p_due)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 SELECT version INTO v FROM core_flow.ticket_work WHERE org_id=t.org_id AND ticket_id=t.id;
 IF coalesce(v,1)<>p_version THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 INSERT INTO core_flow.ticket_work(ticket_id,org_id,priority,assignee_label,due_at,updated_by,updated_at,version)
 VALUES(t.id,t.org_id,p_priority,p_assignee,p_due,(s->>'actorId')::uuid,clock_timestamp(),p_version+1)
 ON CONFLICT(ticket_id) DO UPDATE SET priority=excluded.priority,assignee_label=excluded.assignee_label,
 due_at=excluded.due_at,updated_by=excluded.updated_by,updated_at=excluded.updated_at,version=excluded.version;
 RETURN core_flow.manager_work_json(t);
END $$;

CREATE FUNCTION core_flow.list_internal_notes(p_digest bytea,p_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;result jsonb;
BEGIN
 t:=core_flow.manager_ticket(p_digest,p_id,false);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id::text,'body',body,'createdAt',created_at) ORDER BY id DESC),'[]'::jsonb)
 INTO result FROM core_flow.ticket_internal_note WHERE ticket_id=t.id AND org_id=t.org_id;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.append_internal_note(p_digest bytea,p_id text,p_body text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;s jsonb;n core_flow.ticket_internal_note;
BEGIN
 t:=core_flow.manager_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 IF t.work_status='COMPLETED' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 IF p_body IS NULL OR p_body<>btrim(p_body,E' \r\n') OR char_length(p_body) NOT BETWEEN 1 AND 2000 OR translate(p_body,E'\r\n','') ~ '[[:cntrl:]]'
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 INSERT INTO core_flow.ticket_internal_note(ticket_id,org_id,author_id,body)
 VALUES(t.id,t.org_id,(s->>'actorId')::uuid,p_body) RETURNING * INTO n;
 RETURN jsonb_build_object('id',n.id::text,'body',n.body,'createdAt',n.created_at);
END $$;

REVOKE ALL ON core_flow.ticket_work,core_flow.ticket_internal_note,core_flow.ticket_internal_note_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION core_flow.manager_ticket(bytea,text,boolean),core_flow.manager_work_json(core_flow.ticket),
 core_flow.read_manager_work(bytea,text),core_flow.list_manager_work(bytea),core_flow.update_manager_work(bytea,text,text,text,timestamptz,bigint),
 core_flow.list_internal_notes(bytea,text),core_flow.append_internal_note(bytea,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.read_manager_work(bytea,text),core_flow.list_manager_work(bytea),
 core_flow.update_manager_work(bytea,text,text,text,timestamptz,bigint),core_flow.list_internal_notes(bytea,text),core_flow.append_internal_note(bytea,text,text) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

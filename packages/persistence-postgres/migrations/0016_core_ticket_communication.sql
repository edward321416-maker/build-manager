-- Public ticket conversation, separate from protocol, handling and private manager notes.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.communication_valid_body(p_body text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_body IS NOT NULL AND p_body=btrim(p_body,E' \r\n') AND char_length(p_body) BETWEEN 1 AND 2000
 AND translate(p_body,E'\r\n','') !~ '[[:cntrl:]]'
 -- Unicode Cc/Cf, including format controls not covered by POSIX cntrl in every locale.
 AND p_body !~ U&'[\0001-\0009\000B\000C\000E-\001F\007F-\009F\00AD\0600-\0605\061C\06DD\070F\0890-\0891\08E2\180E\200B-\200F\202A-\202E\2060-\2064\2066-\206F\FEFF\FFF9-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0001\+0E0020-\+0E007F]'
$$;
CREATE TABLE core_flow.ticket_public_message (
 id uuid PRIMARY KEY DEFAULT uuidv7(),ticket_id text NOT NULL,org_id uuid NOT NULL,
 sequence bigint NOT NULL CHECK(sequence>0 AND sequence<=9007199254740991),
 actor_id uuid NOT NULL REFERENCES app.app_user(id),actor_role text NOT NULL CHECK(actor_role IN ('TENANT','MANAGER')),
 intent text NOT NULL CHECK(intent IN ('REQUEST_REPLY','TENANT_MESSAGE','MANAGER_REPLY','MANAGER_UPDATE')),
 body text NOT NULL CHECK(core_flow.communication_valid_body(body)),reply_to_message_id uuid,
 client_request_id uuid NOT NULL,request_expected_version bigint NOT NULL CHECK(request_expected_version>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(sequence=request_expected_version+1),CHECK((actor_role='TENANT')=(intent='TENANT_MESSAGE')),
 UNIQUE(org_id,ticket_id,sequence),UNIQUE(org_id,actor_id,client_request_id),UNIQUE(org_id,ticket_id,id),
 FOREIGN KEY(org_id,ticket_id) REFERENCES core_flow.ticket(org_id,id),
 FOREIGN KEY(org_id,ticket_id,reply_to_message_id) REFERENCES core_flow.ticket_public_message(org_id,ticket_id,id)
);
CREATE TABLE core_flow.ticket_communication_thread (
 ticket_id text PRIMARY KEY,org_id uuid NOT NULL,
 version bigint NOT NULL CHECK(version>0 AND version<=9007199254740991),
 waiting_for text NOT NULL CHECK(waiting_for IN ('NONE','TENANT','MANAGER')),
 pending_since_message_id uuid,updated_at timestamptz NOT NULL,
 CHECK((waiting_for='NONE')=(pending_since_message_id IS NULL)),
 FOREIGN KEY(org_id,ticket_id) REFERENCES core_flow.ticket(org_id,id),
 FOREIGN KEY(org_id,ticket_id,pending_since_message_id) REFERENCES core_flow.ticket_public_message(org_id,ticket_id,id)
);
ALTER TABLE core_flow.ticket_public_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_public_message FORCE ROW LEVEL SECURITY;
CREATE POLICY communication_message_org ON core_flow.ticket_public_message TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY communication_message_ceiling ON core_flow.ticket_public_message AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE core_flow.ticket_communication_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_communication_thread FORCE ROW LEVEL SECURITY;
CREATE POLICY communication_thread_org ON core_flow.ticket_communication_thread TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY communication_thread_ceiling ON core_flow.ticket_communication_thread AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

-- Check access before waiting, then recheck current session/unit/ownership after the ticket lock.
CREATE FUNCTION core_flow.communication_ticket(p_digest bytea,p_id text,p_lock boolean) RETURNS core_flow.ticket
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;
BEGIN
 PERFORM core_flow.read_ticket(p_digest,p_id,false);
 IF p_lock THEN PERFORM core_flow.read_ticket(p_digest,p_id,true); END IF;
 PERFORM core_flow.read_ticket(p_digest,p_id,false);
 SELECT * INTO t FROM core_flow.ticket WHERE id=p_id AND org_id=app.current_org_id();
 IF t.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN t;
END $$;

CREATE FUNCTION core_flow.communication_message_json(m core_flow.ticket_public_message) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',m.id,'sequence',m.sequence,'intent',m.intent,'authorRole',m.actor_role,
 'body',m.body,'replyToMessageId',m.reply_to_message_id,'createdAt',m.created_at)
$$;

CREATE FUNCTION core_flow.read_communication(p_digest bytea,p_id text,p_before bigint DEFAULT NULL,p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;result jsonb;
BEGIN
 t:=core_flow.communication_ticket(p_digest,p_id,false);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR (p_before IS NOT NULL AND (p_before<1 OR p_before>9007199254740991))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 WITH selected AS (
  SELECT m.* FROM core_flow.ticket_public_message m WHERE m.org_id=t.org_id AND m.ticket_id=t.id
  AND (p_before IS NULL OR m.sequence<p_before) ORDER BY sequence DESC LIMIT p_limit
 ), page AS (SELECT coalesce(jsonb_agg(core_flow.communication_message_json(s) ORDER BY sequence),'[]'::jsonb) messages,min(sequence) first_sequence FROM selected s)
 SELECT jsonb_build_object('version',coalesce(th.version,0),
 'waitingFor',CASE WHEN current_ticket.work_status='COMPLETED' THEN 'NONE' ELSE coalesce(th.waiting_for,'NONE') END,
 'readOnly',current_ticket.work_status='COMPLETED','messages',page.messages,
 'nextBeforeSequence',CASE WHEN EXISTS(SELECT 1 FROM core_flow.ticket_public_message m WHERE m.org_id=t.org_id AND m.ticket_id=t.id AND m.sequence<page.first_sequence) THEN page.first_sequence ELSE NULL END)
 INTO result FROM core_flow.ticket current_ticket LEFT JOIN core_flow.ticket_communication_thread th ON th.org_id=t.org_id AND th.ticket_id=t.id CROSS JOIN page WHERE current_ticket.id=t.id AND current_ticket.org_id=t.org_id;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.send_communication(p_digest bytea,p_id text,p_key uuid,p_version bigint,p_intent text,p_body text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;s jsonb;m core_flow.ticket_public_message;th core_flow.ticket_communication_thread;
 v bigint;waiting text;anchor uuid;reply uuid;new_id uuid:=uuidv7();
BEGIN
 t:=core_flow.communication_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 SELECT * INTO m FROM core_flow.ticket_public_message WHERE org_id=t.org_id AND actor_id=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF m.id IS NOT NULL THEN
  IF m.ticket_id IS DISTINCT FROM t.id OR m.intent IS DISTINCT FROM p_intent OR m.body IS DISTINCT FROM p_body OR m.request_expected_version IS DISTINCT FROM p_version
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
  RETURN jsonb_build_object('message',core_flow.communication_message_json(m),'created',false);
 END IF;
 IF t.work_status='COMPLETED' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 IF p_key IS NULL OR p_version IS NULL OR p_version<0 OR p_version>=9007199254740991 OR p_intent IS NULL
 OR p_intent NOT IN ('REQUEST_REPLY','TENANT_MESSAGE','MANAGER_REPLY','MANAGER_UPDATE') OR NOT core_flow.communication_valid_body(p_body)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 IF (s->>'role'='TENANT')<>(p_intent='TENANT_MESSAGE') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO th FROM core_flow.ticket_communication_thread WHERE ticket_id=t.id AND org_id=t.org_id;
 v:=coalesce(th.version,0);waiting:=coalesce(th.waiting_for,'NONE');anchor:=th.pending_since_message_id;
 IF v<>p_version THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 CASE p_intent
  WHEN 'REQUEST_REPLY' THEN
   IF waiting='TENANT' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
   waiting:='TENANT';anchor:=new_id;
  WHEN 'TENANT_MESSAGE' THEN
   IF waiting='TENANT' THEN reply:=anchor; END IF;
   IF waiting<>'MANAGER' THEN anchor:=new_id; END IF;
   waiting:='MANAGER';
  WHEN 'MANAGER_REPLY' THEN
   IF waiting<>'MANAGER' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
   reply:=anchor;waiting:='NONE';anchor:=NULL;
  WHEN 'MANAGER_UPDATE' THEN NULL;
 END CASE;
 INSERT INTO core_flow.ticket_public_message(id,ticket_id,org_id,sequence,actor_id,actor_role,intent,body,reply_to_message_id,client_request_id,request_expected_version)
 VALUES(new_id,t.id,t.org_id,v+1,(s->>'actorId')::uuid,CASE WHEN s->>'role'='TENANT' THEN 'TENANT' ELSE 'MANAGER' END,p_intent,p_body,reply,p_key,p_version) RETURNING * INTO m;
 INSERT INTO core_flow.ticket_communication_thread(ticket_id,org_id,version,waiting_for,pending_since_message_id,updated_at)
 VALUES(t.id,t.org_id,v+1,waiting,anchor,m.created_at)
 ON CONFLICT(ticket_id) DO UPDATE SET version=excluded.version,waiting_for=excluded.waiting_for,pending_since_message_id=excluded.pending_since_message_id,updated_at=excluded.updated_at;
 RETURN jsonb_build_object('message',core_flow.communication_message_json(m),'created',true);
EXCEPTION WHEN unique_violation THEN
 -- A key raced on another ticket. The subtransaction rolls back this append; no foreign receipt leaks.
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';
END $$;

CREATE FUNCTION core_flow.communication_receipt(p_digest bytea,p_id text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;s jsonb;m core_flow.ticket_public_message;
BEGIN
 t:=core_flow.communication_ticket(p_digest,p_id,false);s:=core_flow.session(p_digest);
 SELECT * INTO m FROM core_flow.ticket_public_message WHERE org_id=t.org_id AND ticket_id=t.id AND actor_id=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF m.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN core_flow.communication_message_json(m);
END $$;

CREATE FUNCTION core_flow.communication_summaries(p_digest bytea,p_ids text[]) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;ident text;part jsonb;result jsonb:='[]'::jsonb;
BEGIN
 PERFORM core_flow.session(p_digest);
 IF p_ids IS NULL OR cardinality(p_ids)>50 OR EXISTS(SELECT 1 FROM unnest(p_ids) i WHERE i IS NULL OR i !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 FOR ident IN SELECT DISTINCT unnest(p_ids) LOOP
  BEGIN
   t:=core_flow.communication_ticket(p_digest,ident,false);
   SELECT jsonb_build_object('ticketId',t.id,'version',coalesce(th.version,0),
    'waitingFor',CASE WHEN ct.work_status='COMPLETED' THEN 'NONE' ELSE coalesce(th.waiting_for,'NONE') END,'readOnly',ct.work_status='COMPLETED')
   INTO part FROM core_flow.ticket ct LEFT JOIN core_flow.ticket_communication_thread th ON th.ticket_id=ct.id AND th.org_id=ct.org_id WHERE ct.id=t.id AND ct.org_id=t.org_id;
   result:=result||jsonb_build_array(part);
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.guard_communication_completion(p_digest bytea,p_id text,p_version bigint) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;v bigint;s jsonb;
BEGIN
 t:=core_flow.communication_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 IF s->>'role' NOT IN ('ORG_ADMIN','PROPERTY_STAFF') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT version INTO v FROM core_flow.ticket_communication_thread WHERE ticket_id=t.id AND org_id=t.org_id;
 IF v IS NOT NULL AND v IS DISTINCT FROM p_version THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
END $$;

REVOKE ALL ON core_flow.ticket_public_message,core_flow.ticket_communication_thread FROM PUBLIC;
REVOKE ALL ON FUNCTION core_flow.communication_valid_body(text),core_flow.communication_ticket(bytea,text,boolean),core_flow.communication_message_json(core_flow.ticket_public_message),
 core_flow.read_communication(bytea,text,bigint,integer),core_flow.send_communication(bytea,text,uuid,bigint,text,text),
 core_flow.communication_receipt(bytea,text,uuid),core_flow.communication_summaries(bytea,text[]),core_flow.guard_communication_completion(bytea,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.read_communication(bytea,text,bigint,integer),core_flow.send_communication(bytea,text,uuid,bigint,text,text),
 core_flow.communication_receipt(bytea,text,uuid),core_flow.communication_summaries(bytea,text[]),core_flow.guard_communication_completion(bytea,text,bigint) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

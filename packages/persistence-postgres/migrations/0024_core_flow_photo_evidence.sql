-- P1b (docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md): a tenant records EVIDENCE when naming one
-- of the ticket's own photos as the evidence its protocol requires. This only widens the accepted event kinds; code that
-- predates it never writes EVIDENCE, so rolling the Web image back keeps working. store_ticket keeps its signature, owner,
-- SECURITY DEFINER and search_path; only the two kind lists change.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

ALTER TABLE core_flow.ticket_event DROP CONSTRAINT ticket_event_kind_check;
ALTER TABLE core_flow.ticket_event ADD CONSTRAINT ticket_event_kind_check
 CHECK(kind IN ('CREATED','ANSWERED','FINALIZED','MORE_INFO','DECISION','HANDLING','EVIDENCE'));

CREATE OR REPLACE FUNCTION core_flow.store_ticket(p_digest bytea,p_body jsonb,p_kind text,p_message text,p_work text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; old core_flow.ticket; v_unit uuid; prop uuid; ident text;
BEGIN
 s:=core_flow.session(p_digest);v_unit:=(p_body->>'unitId')::uuid;prop:=(p_body->>'buildingId')::uuid;ident:=p_body->>'id';
 IF p_kind NOT IN ('CREATED','ANSWERED','FINALIZED','MORE_INFO','DECISION','HANDLING','EVIDENCE') OR p_message IS NULL OR char_length(p_message)>2000
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT core_flow.can_unit(p_digest,v_unit) OR NOT EXISTS(SELECT 1 FROM app.unit u WHERE u.id=v_unit AND u.property_id=prop AND u.org_id=app.current_org_id())
 THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 IF (p_kind IN ('CREATED','ANSWERED','FINALIZED','EVIDENCE'))<>(s->>'role'='TENANT')
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_kind='CREATED' THEN
  IF p_work IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  INSERT INTO core_flow.ticket(id,org_id,property_id,unit_id,tenant_id,body) VALUES(ident,app.current_org_id(),prop,v_unit,(s->>'actorId')::uuid,p_body);
 ELSE
  PERFORM core_flow.read_ticket(p_digest,ident,true);
  s:=core_flow.session(p_digest);
  IF (p_kind IN ('ANSWERED','FINALIZED','EVIDENCE'))<>(s->>'role'='TENANT')
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
  SELECT * INTO old FROM core_flow.ticket WHERE id=ident AND org_id=app.current_org_id();
  IF old.unit_id<>v_unit OR old.property_id<>prop THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  IF p_work IS NOT NULL AND (p_kind<>'HANDLING' OR p_work NOT IN ('IN_PROGRESS','COMPLETED'))
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  UPDATE core_flow.ticket SET body=p_body,work_status=coalesce(p_work,work_status),version=version+1,updated_at=clock_timestamp() WHERE id=ident;
 END IF;
 INSERT INTO core_flow.ticket_event(ticket_id,org_id,actor_id,actor_role,kind,message)
 VALUES(ident,app.current_org_id(),(s->>'actorId')::uuid,s->>'role',p_kind,p_message);
END $$;

RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

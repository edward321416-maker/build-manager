-- Additive development core flow. B1-B5 functions/policies remain unchanged.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bm_core_flow_owner' AND NOT rolcanlogin
 AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit AND NOT rolreplication)
 THEN RAISE EXCEPTION 'CORE_FLOW_ROLE_REQUIRED'; END IF;
END $$;
CREATE SCHEMA core_flow;
REVOKE ALL ON SCHEMA core_flow FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
GRANT USAGE ON SCHEMA app,authn TO bm_core_flow_owner;
GRANT SELECT ON app.organization,app.organization_membership,app.property,app.unit,
 app.occupancy,app.occupancy_member TO bm_core_flow_owner;
GRANT REFERENCES ON app.organization,app.property,app.unit,app.app_user TO bm_core_flow_owner;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO bm_core_flow_owner;
SET LOCAL ROLE bm_b1_capability_owner;
GRANT EXECUTE ON FUNCTION authn.current_actor(bytea),authn.can_read_property(bytea,uuid,uuid) TO bm_core_flow_owner;
RESET ROLE;
SET LOCAL ROLE bm_core_flow_owner;

-- Only trusted fixture/bootstrap code may attach an existing B1 session to an org.
CREATE TABLE core_flow.session_scope (
 digest bytea PRIMARY KEY CHECK(octet_length(digest)=32),
 org_id uuid NOT NULL REFERENCES app.organization(id)
);
CREATE TABLE core_flow.building_context (
 org_id uuid NOT NULL,property_id uuid NOT NULL,body jsonb NOT NULL,
 PRIMARY KEY(org_id,property_id),FOREIGN KEY(org_id,property_id) REFERENCES app.property(org_id,id)
);
CREATE TABLE core_flow.ticket (
 id text PRIMARY KEY,org_id uuid NOT NULL,property_id uuid NOT NULL,unit_id uuid NOT NULL,
 tenant_id uuid NOT NULL REFERENCES app.app_user(id),body jsonb NOT NULL,
 work_status text NOT NULL DEFAULT 'OPEN' CHECK(work_status IN ('OPEN','IN_PROGRESS','COMPLETED')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(org_id,property_id) REFERENCES app.property(org_id,id),
 FOREIGN KEY(org_id,unit_id) REFERENCES app.unit(org_id,id),
 CHECK(char_length(id) BETWEEN 1 AND 100),CHECK(octet_length(body::text)<=131072)
);
CREATE INDEX core_ticket_unit_history ON core_flow.ticket(org_id,unit_id,created_at DESC,id);
CREATE TABLE core_flow.ticket_event (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,ticket_id text NOT NULL REFERENCES core_flow.ticket(id),
 org_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES app.app_user(id),actor_role text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('CREATED','ANSWERED','FINALIZED','MORE_INFO','DECISION','HANDLING')),
 message text NOT NULL CHECK(char_length(message)<=2000),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE core_flow.session_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.session_scope FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_digest ON core_flow.session_scope TO bm_core_flow_owner
 USING(digest=decode(current_setting('app.b1_session_digest',true),'hex'));
ALTER TABLE core_flow.building_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.building_context FORCE ROW LEVEL SECURITY;
CREATE POLICY context_org ON core_flow.building_context TO bm_core_flow_owner USING(org_id=app.current_org_id());
ALTER TABLE core_flow.ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket FORCE ROW LEVEL SECURITY;
CREATE POLICY ticket_org ON core_flow.ticket TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
ALTER TABLE core_flow.ticket_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.ticket_event FORCE ROW LEVEL SECURITY;
CREATE POLICY event_org ON core_flow.ticket_event TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE FUNCTION core_flow.session(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; org uuid; role_name text;
BEGIN
 actor:=authn.current_actor(p_digest);
 IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
 PERFORM set_config('app.b1_session_digest',encode(p_digest,'hex'),true);
 SELECT org_id INTO org FROM core_flow.session_scope WHERE digest=p_digest;
 IF org IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='UNAUTHENTICATED'; END IF;
 PERFORM set_config('app.org_id',org::text,true);
 IF NOT EXISTS(SELECT 1 FROM app.organization WHERE id=org AND status='ACTIVE')
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 SELECT role INTO role_name FROM app.organization_membership WHERE org_id=org AND user_id=actor AND status='ACTIVE';
 IF role_name IS NULL AND EXISTS(SELECT 1 FROM app.occupancy_member m JOIN app.occupancy o ON o.org_id=m.org_id AND o.id=m.occupancy_id
 WHERE m.org_id=org AND m.user_id=actor AND m.status='ACTIVE' AND m.joined_at<=clock_timestamp() AND o.status='ACTIVE'
 AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp())) THEN role_name:='TENANT'; END IF;
 IF role_name IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 RETURN jsonb_build_object('actorId',actor,'orgId',org,'role',role_name);
END $$;

CREATE FUNCTION core_flow.can_unit(p_digest bytea,p_unit uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; prop uuid;
BEGIN
 s:=core_flow.session(p_digest);
 SELECT u.property_id INTO prop FROM app.unit u JOIN app.property p ON p.org_id=u.org_id AND p.id=u.property_id
 WHERE u.org_id=(s->>'orgId')::uuid AND u.id=p_unit AND u.status='ACTIVE' AND p.status='ACTIVE';
 IF prop IS NULL THEN RETURN false; END IF;
 IF s->>'role'<>'TENANT' THEN RETURN authn.can_read_property(p_digest,(s->>'orgId')::uuid,prop); END IF;
 RETURN EXISTS(SELECT 1 FROM app.occupancy o JOIN app.occupancy_member m ON m.org_id=o.org_id AND m.occupancy_id=o.id
 WHERE o.org_id=(s->>'orgId')::uuid AND o.unit_id=p_unit AND o.status='ACTIVE' AND m.status='ACTIVE'
 AND m.user_id=(s->>'actorId')::uuid AND m.joined_at<=clock_timestamp() AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp()));
END $$;

CREATE FUNCTION core_flow.units(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'buildingName',x->>'label'),'[]'::jsonb) INTO result FROM (
 SELECT jsonb_build_object('id',u.id,'buildingId',u.property_id,'label',u.label,
 'buildingName',c.body->>'displayName') AS x FROM app.unit u JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=(s->>'orgId')::uuid AND core_flow.can_unit(p_digest,u.id) ORDER BY u.id LIMIT 200) q;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.building(p_digest bytea,p_unit uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF NOT core_flow.can_unit(p_digest,p_unit) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT c.body INTO result FROM app.unit u JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=app.current_org_id() AND u.id=p_unit;
 IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.read_ticket(p_digest bytea,p_id text,p_lock boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; t core_flow.ticket; events jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 IF p_lock THEN SELECT * INTO t FROM core_flow.ticket WHERE id=p_id AND org_id=app.current_org_id() FOR UPDATE;
 ELSE SELECT * INTO t FROM core_flow.ticket WHERE id=p_id AND org_id=app.current_org_id(); END IF;
 s:=core_flow.session(p_digest);
 IF t.id IS NULL OR NOT core_flow.can_unit(p_digest,t.unit_id) OR (s->>'role'='TENANT' AND t.tenant_id<>(s->>'actorId')::uuid)
 THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id::text,'kind',kind,'actorRole',actor_role,'message',message,'at',created_at) ORDER BY id),'[]'::jsonb)
 INTO events FROM core_flow.ticket_event WHERE ticket_id=t.id AND org_id=t.org_id;
 RETURN jsonb_build_object('ticket',t.body,'workStatus',t.work_status,'version',t.version,'events',events,
 'building',core_flow.building(p_digest,t.unit_id));
END $$;

CREATE FUNCTION core_flow.list_tickets(p_digest bytea,p_unit uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 IF p_unit IS NOT NULL AND NOT core_flow.can_unit(p_digest,p_unit) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(core_flow.read_ticket(p_digest,id,false) ORDER BY created_at DESC,id),'[]'::jsonb) INTO result FROM (
 SELECT id,created_at FROM core_flow.ticket WHERE org_id=app.current_org_id() AND (p_unit IS NULL OR unit_id=p_unit)
 AND core_flow.can_unit(p_digest,unit_id) AND (s->>'role'<>'TENANT' OR tenant_id=(s->>'actorId')::uuid)
 ORDER BY created_at DESC,id LIMIT 100) q;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.store_ticket(p_digest bytea,p_body jsonb,p_kind text,p_message text,p_work text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; old core_flow.ticket; v_unit uuid; prop uuid; ident text;
BEGIN
 s:=core_flow.session(p_digest);v_unit:=(p_body->>'unitId')::uuid;prop:=(p_body->>'buildingId')::uuid;ident:=p_body->>'id';
 IF p_kind NOT IN ('CREATED','ANSWERED','FINALIZED','MORE_INFO','DECISION','HANDLING') OR p_message IS NULL OR char_length(p_message)>2000
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 IF NOT core_flow.can_unit(p_digest,v_unit) OR NOT EXISTS(SELECT 1 FROM app.unit u WHERE u.id=v_unit AND u.property_id=prop AND u.org_id=app.current_org_id())
 THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 IF (p_kind IN ('CREATED','ANSWERED','FINALIZED'))<>(s->>'role'='TENANT')
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 IF p_kind='CREATED' THEN
  IF p_work IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
  INSERT INTO core_flow.ticket(id,org_id,property_id,unit_id,tenant_id,body) VALUES(ident,app.current_org_id(),prop,v_unit,(s->>'actorId')::uuid,p_body);
 ELSE
  PERFORM core_flow.read_ticket(p_digest,ident,true);
  s:=core_flow.session(p_digest);
  IF (p_kind IN ('ANSWERED','FINALIZED'))<>(s->>'role'='TENANT')
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

REVOKE ALL ON ALL TABLES IN SCHEMA core_flow FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA core_flow FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.session(bytea),core_flow.units(bytea),core_flow.building(bytea,uuid),
 core_flow.read_ticket(bytea,text,boolean),core_flow.list_tickets(bytea,uuid),core_flow.store_ticket(bytea,jsonb,text,text,text) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;
GRANT USAGE ON SCHEMA core_flow TO bm_b1_web;

-- Explicit reviewed manager facts. No ticket backfill, UPDATE, or DELETE capability.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.maintenance_valid_component(p_label text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_label IS NULL OR (p_label=btrim(p_label) AND char_length(p_label) BETWEEN 1 AND 80
 AND p_label !~ '[[:cntrl:]]'
 AND p_label !~ U&'[\0001-\001F\007F-\009F\00AD\0600-\0605\061C\06DD\070F\0890-\0891\08E2\180E\200B-\200F\202A-\202E\2060-\2064\2066-\206F\FEFF\FFF9-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0001\+0E0020-\+0E007F]')
$$;
CREATE TABLE core_flow.unit_maintenance_fact (
 id uuid PRIMARY KEY DEFAULT uuidv7(),org_id uuid NOT NULL,unit_id uuid NOT NULL,source_ticket_id text NOT NULL,
 issue_type text NOT NULL CHECK(issue_type IN ('HEATING','LEAK')),
 action_kind text NOT NULL CHECK(action_kind IN ('INSPECTION','REPAIR','PART_REPLACEMENT','ADJUSTMENT','OTHER')),
 component_label text CHECK(core_flow.maintenance_valid_component(component_label)),
 source_completed_at timestamptz NOT NULL CHECK(isfinite(source_completed_at)),
 recorded_by uuid NOT NULL REFERENCES app.app_user(id),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 replaces_fact_id uuid UNIQUE,correction_reason text CHECK(correction_reason IN ('ACTION_CLASSIFICATION','COMPONENT_LABEL','OTHER')),
 client_request_id uuid NOT NULL,request_fingerprint bytea NOT NULL CHECK(octet_length(request_fingerprint)=32),
 CHECK((replaces_fact_id IS NULL)=(correction_reason IS NULL)),CHECK(replaces_fact_id IS NULL OR replaces_fact_id<>id),
 UNIQUE(org_id,recorded_by,client_request_id),
 UNIQUE(id,org_id,unit_id,source_ticket_id,issue_type,source_completed_at),
 FOREIGN KEY(org_id,source_ticket_id) REFERENCES core_flow.ticket(org_id,id),
 FOREIGN KEY(org_id,unit_id) REFERENCES app.unit(org_id,id),
 FOREIGN KEY(replaces_fact_id,org_id,unit_id,source_ticket_id,issue_type,source_completed_at)
 REFERENCES core_flow.unit_maintenance_fact(id,org_id,unit_id,source_ticket_id,issue_type,source_completed_at)
);
CREATE UNIQUE INDEX maintenance_one_root ON core_flow.unit_maintenance_fact(org_id,source_ticket_id) WHERE replaces_fact_id IS NULL;
CREATE INDEX maintenance_unit_order ON core_flow.unit_maintenance_fact(org_id,unit_id,source_completed_at DESC,id);
ALTER TABLE core_flow.unit_maintenance_fact ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_flow.unit_maintenance_fact FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_org ON core_flow.unit_maintenance_fact TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());
CREATE POLICY maintenance_org_ceiling ON core_flow.unit_maintenance_fact AS RESTRICTIVE TO bm_core_flow_owner USING(org_id=app.current_org_id()) WITH CHECK(org_id=app.current_org_id());

CREATE FUNCTION core_flow.maintenance_ticket(p_digest bytea,p_id text,p_lock boolean) RETURNS core_flow.ticket
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;
BEGIN
 -- manager_ticket rechecks current session and assignment AFTER the source lock wait.
 t:=core_flow.manager_ticket(p_digest,p_id,p_lock);
 IF p_lock AND t.work_status<>'COMPLETED' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 RETURN t;
END $$;
CREATE FUNCTION core_flow.maintenance_request_fingerprint(p_source text,p_expected uuid,p_action text,p_label text,p_reason text) RETURNS bytea
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT sha256(convert_to(jsonb_build_array(p_source,p_expected,p_action,p_label,p_reason)::text,'UTF8'))
$$;
CREATE FUNCTION core_flow.maintenance_current_fact(p_source text) RETURNS core_flow.unit_maintenance_fact
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT f FROM core_flow.unit_maintenance_fact f WHERE f.org_id=app.current_org_id() AND f.source_ticket_id=p_source
 AND NOT EXISTS(SELECT 1 FROM core_flow.unit_maintenance_fact child WHERE child.replaces_fact_id=f.id)
$$;
CREATE FUNCTION core_flow.maintenance_fact_json(f core_flow.unit_maintenance_fact) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH RECURSIVE ancestors AS (
  SELECT f.id,f.replaces_fact_id,0 AS depth
  UNION ALL SELECT p.id,p.replaces_fact_id,a.depth+1 FROM core_flow.unit_maintenance_fact p JOIN ancestors a ON p.id=a.replaces_fact_id
 )
 SELECT jsonb_build_object('factId',f.id,'unitId',f.unit_id,'buildingId',u.property_id,'buildingName',c.body->>'displayName','unitLabel',u.label,
 'sourceTicketId',f.source_ticket_id,'issueType',f.issue_type,'actionKind',f.action_kind,'componentLabel',f.component_label,
 'sourceCompletedAt',f.source_completed_at,'recordedAt',f.recorded_at,'corrected',f.replaces_fact_id IS NOT NULL,'correctionCount',(SELECT max(depth) FROM ancestors),
 'tenantOutcome',coalesce((SELECT kind FROM core_flow.ticket_outcome_assertion WHERE org_id=f.org_id AND ticket_id=f.source_ticket_id ORDER BY created_at DESC,id DESC LIMIT 1),'UNCONFIRMED'),
 'previousTicketId',(SELECT source_ticket_id FROM core_flow.ticket_follow_up WHERE org_id=f.org_id AND target_ticket_id=f.source_ticket_id),
 'followUpTicketId',(SELECT target_ticket_id FROM core_flow.ticket_follow_up WHERE org_id=f.org_id AND source_ticket_id=f.source_ticket_id))
 FROM app.unit u JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=f.org_id AND u.id=f.unit_id AND f.org_id=app.current_org_id()
$$;
CREATE FUNCTION core_flow.read_unit_maintenance_facts(p_digest bytea,p_unit uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 IF s->>'role' NOT IN ('ORG_ADMIN','PROPERTY_STAFF') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN';END IF;
 IF p_unit IS NULL OR NOT core_flow.can_unit(p_digest,p_unit) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND';END IF;
 SELECT coalesce(jsonb_agg(core_flow.maintenance_fact_json(f) ORDER BY f.source_completed_at DESC,f.id ASC),'[]'::jsonb) INTO result
 FROM (SELECT x.* FROM core_flow.unit_maintenance_fact x WHERE x.org_id=app.current_org_id() AND x.unit_id=p_unit
 AND NOT EXISTS(SELECT 1 FROM core_flow.unit_maintenance_fact child WHERE child.replaces_fact_id=x.id)
 ORDER BY x.source_completed_at DESC,x.id ASC LIMIT 100) f;
 RETURN result;
END $$;
CREATE FUNCTION core_flow.read_ticket_maintenance_fact(p_digest bytea,p_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;current_fact core_flow.unit_maintenance_fact;revisions jsonb;
BEGIN
 t:=core_flow.maintenance_ticket(p_digest,p_id,false);current_fact:=core_flow.maintenance_current_fact(t.id);
 WITH RECURSIVE chain AS (
  SELECT f.*,0 AS depth FROM core_flow.unit_maintenance_fact f WHERE f.org_id=t.org_id AND f.source_ticket_id=t.id AND f.replaces_fact_id IS NULL
  UNION ALL SELECT f.*,p.depth+1 FROM core_flow.unit_maintenance_fact f JOIN chain p ON f.replaces_fact_id=p.id
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('factId',id,'actionKind',action_kind,'componentLabel',component_label,'recordedAt',recorded_at,'correctionReason',correction_reason,'current',id=current_fact.id) ORDER BY depth),'[]'::jsonb) INTO revisions FROM chain;
 RETURN jsonb_build_object('current',CASE WHEN current_fact.id IS NULL THEN NULL ELSE core_flow.maintenance_fact_json(current_fact) END,'revisions',revisions);
END $$;
CREATE FUNCTION core_flow.create_unit_maintenance_fact(p_digest bytea,p_id text,p_key uuid,p_action text,p_label text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t core_flow.ticket;s jsonb;f core_flow.unit_maintenance_fact;fp bytea;
BEGIN
 t:=core_flow.maintenance_ticket(p_digest,p_id,true);s:=core_flow.session(p_digest);
 IF p_key IS NULL OR p_action IS NULL OR p_action NOT IN ('INSPECTION','REPAIR','PART_REPLACEMENT','ADJUSTMENT','OTHER') OR NOT core_flow.maintenance_valid_component(p_label)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';END IF;
 -- Serializes a reused actor/key even across different source tickets. No retry of COMMIT.
 PERFORM pg_advisory_xact_lock(hashtextextended(t.org_id::text||':'||(s->>'actorId')||':'||p_key::text,0));
 fp:=core_flow.maintenance_request_fingerprint(t.id,NULL,p_action,p_label,NULL);
 SELECT * INTO f FROM core_flow.unit_maintenance_fact WHERE org_id=t.org_id AND recorded_by=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF f.id IS NOT NULL THEN
  IF f.request_fingerprint<>fp THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
  RETURN jsonb_build_object('fact',core_flow.maintenance_fact_json(f),'created',false);
 END IF;
 IF EXISTS(SELECT 1 FROM core_flow.unit_maintenance_fact WHERE org_id=t.org_id AND source_ticket_id=t.id) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 INSERT INTO core_flow.unit_maintenance_fact(org_id,unit_id,source_ticket_id,issue_type,action_kind,component_label,source_completed_at,recorded_by,client_request_id,request_fingerprint)
 VALUES(t.org_id,t.unit_id,t.id,t.body->>'issueType',p_action,p_label,t.updated_at,(s->>'actorId')::uuid,p_key,fp) RETURNING * INTO f;
 RETURN jsonb_build_object('fact',core_flow.maintenance_fact_json(f),'created',true);
END $$;
CREATE FUNCTION core_flow.correct_unit_maintenance_fact(p_digest bytea,p_id uuid,p_key uuid,p_expected uuid,p_action text,p_label text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;t core_flow.ticket;old_fact core_flow.unit_maintenance_fact;current_fact core_flow.unit_maintenance_fact;f core_flow.unit_maintenance_fact;fp bytea;
BEGIN
 s:=core_flow.session(p_digest);
 IF s->>'role' NOT IN ('ORG_ADMIN','PROPERTY_STAFF') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO old_fact FROM core_flow.unit_maintenance_fact WHERE org_id=app.current_org_id() AND id=p_id;
 IF old_fact.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND';END IF;
 t:=core_flow.maintenance_ticket(p_digest,old_fact.source_ticket_id,true);s:=core_flow.session(p_digest);
 IF p_expected IS NULL OR p_id<>p_expected THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 IF p_key IS NULL OR p_action IS NULL OR p_action NOT IN ('INSPECTION','REPAIR','PART_REPLACEMENT','ADJUSTMENT','OTHER') OR NOT core_flow.maintenance_valid_component(p_label)
 OR p_reason IS NULL OR p_reason NOT IN ('ACTION_CLASSIFICATION','COMPONENT_LABEL','OTHER') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t.org_id::text||':'||(s->>'actorId')||':'||p_key::text,0));
 fp:=core_flow.maintenance_request_fingerprint(t.id,p_expected,p_action,p_label,p_reason);
 SELECT * INTO f FROM core_flow.unit_maintenance_fact WHERE org_id=t.org_id AND recorded_by=(s->>'actorId')::uuid AND client_request_id=p_key;
 IF f.id IS NOT NULL THEN
  IF f.request_fingerprint<>fp THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
  RETURN jsonb_build_object('fact',core_flow.maintenance_fact_json(f),'created',false);
 END IF;
 current_fact:=core_flow.maintenance_current_fact(t.id);
 IF current_fact.id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT';END IF;
 IF current_fact.action_kind=p_action AND current_fact.component_label IS NOT DISTINCT FROM p_label THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT';END IF;
 INSERT INTO core_flow.unit_maintenance_fact(org_id,unit_id,source_ticket_id,issue_type,action_kind,component_label,source_completed_at,recorded_by,replaces_fact_id,correction_reason,client_request_id,request_fingerprint)
 VALUES(current_fact.org_id,current_fact.unit_id,current_fact.source_ticket_id,current_fact.issue_type,p_action,p_label,current_fact.source_completed_at,(s->>'actorId')::uuid,current_fact.id,p_reason,p_key,fp) RETURNING * INTO f;
 RETURN jsonb_build_object('fact',core_flow.maintenance_fact_json(f),'created',true);
END $$;
REVOKE ALL ON core_flow.unit_maintenance_fact FROM PUBLIC;
REVOKE ALL ON FUNCTION core_flow.maintenance_valid_component(text),core_flow.maintenance_ticket(bytea,text,boolean),core_flow.maintenance_request_fingerprint(text,uuid,text,text,text),
 core_flow.maintenance_current_fact(text),core_flow.maintenance_fact_json(core_flow.unit_maintenance_fact),core_flow.read_unit_maintenance_facts(bytea,uuid),
 core_flow.read_ticket_maintenance_fact(bytea,text),core_flow.create_unit_maintenance_fact(bytea,text,uuid,text,text),core_flow.correct_unit_maintenance_fact(bytea,uuid,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.read_unit_maintenance_facts(bytea,uuid),core_flow.read_ticket_maintenance_fact(bytea,text),core_flow.create_unit_maintenance_fact(bytea,text,uuid,text,text),
 core_flow.correct_unit_maintenance_fact(bytea,uuid,uuid,uuid,text,text,text) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

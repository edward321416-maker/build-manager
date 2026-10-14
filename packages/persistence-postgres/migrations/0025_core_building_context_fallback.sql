-- C1 step 1 (docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md): a property registered through B3 has no
-- core_flow.building_context row, so the five Core functions below dropped its units (inner joins) or failed (NOT_FOUND, null
-- list entries, a null vendor building name). building_body returns the stored body, or a fallback named 건물 with no
-- context facts: protocol selection then asks, and route recommendation never guesses. The replaced functions keep their
-- signatures, owner, SECURITY DEFINER, search_path and grants; only the building read changes. No address is derived.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.building_body(p_org uuid,p_property uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(
  (SELECT c.body FROM core_flow.building_context c WHERE c.org_id=p_org AND c.property_id=p_property),
  jsonb_build_object('id',p_property::text,'displayName','건물','demo',false,'sourceNativeIds','{}'::jsonb,'context','[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION core_flow.building_body(uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION core_flow.units(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'buildingName',x->>'label'),'[]'::jsonb) INTO result FROM (
 SELECT jsonb_build_object('id',u.id,'buildingId',u.property_id,'label',u.label,
 'buildingName',coalesce(c.body->>'displayName','건물')) AS x FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=(s->>'orgId')::uuid AND core_flow.can_unit(p_digest,u.id) ORDER BY u.id LIMIT 200) q;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION core_flow.building(p_digest bytea,p_unit uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF NOT core_flow.can_unit(p_digest,p_unit) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT core_flow.building_body(u.org_id,u.property_id) INTO result FROM app.unit u
 WHERE u.org_id=app.current_org_id() AND u.id=p_unit;
 IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION core_flow.manager_work_json(t core_flow.ticket) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('ticketId',t.id,'unitId',t.unit_id,'buildingId',t.property_id,
 'buildingName',coalesce(c.body->>'displayName','건물'),'unitLabel',u.label,'issueType',t.body->>'issueType',
 'workStatus',t.work_status,'priority',coalesce(w.priority,'NORMAL'),'assigneeLabel',w.assignee_label,
 'dueAt',w.due_at,'createdAt',t.created_at,'updatedAt',coalesce(w.updated_at,t.updated_at),'version',coalesce(w.version,1))
 FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 LEFT JOIN core_flow.ticket_work w ON w.org_id=t.org_id AND w.ticket_id=t.id
 WHERE u.org_id=t.org_id AND u.id=t.unit_id AND t.org_id=app.current_org_id()
$$;

CREATE OR REPLACE FUNCTION core_flow.maintenance_fact_json(f core_flow.unit_maintenance_fact) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH RECURSIVE ancestors AS (
  SELECT f.id,f.replaces_fact_id,0 AS depth
  UNION ALL SELECT p.id,p.replaces_fact_id,a.depth+1 FROM core_flow.unit_maintenance_fact p JOIN ancestors a ON p.id=a.replaces_fact_id
 )
 SELECT jsonb_build_object('factId',f.id,'unitId',f.unit_id,'buildingId',u.property_id,'buildingName',coalesce(c.body->>'displayName','건물'),'unitLabel',u.label,
 'sourceTicketId',f.source_ticket_id,'issueType',f.issue_type,'actionKind',f.action_kind,'componentLabel',f.component_label,
 'sourceCompletedAt',f.source_completed_at,'recordedAt',f.recorded_at,'corrected',f.replaces_fact_id IS NOT NULL,'correctionCount',(SELECT max(depth) FROM ancestors),
 'tenantOutcome',coalesce((SELECT kind FROM core_flow.ticket_outcome_assertion WHERE org_id=f.org_id AND ticket_id=f.source_ticket_id ORDER BY created_at DESC,id DESC LIMIT 1),'UNCONFIRMED'),
 'previousTicketId',(SELECT source_ticket_id FROM core_flow.ticket_follow_up WHERE org_id=f.org_id AND target_ticket_id=f.source_ticket_id),
 'followUpTicketId',(SELECT target_ticket_id FROM core_flow.ticket_follow_up WHERE org_id=f.org_id AND source_ticket_id=f.source_ticket_id))
 FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=f.org_id AND u.id=f.unit_id AND f.org_id=app.current_org_id()
$$;

CREATE OR REPLACE FUNCTION core_flow.vendor_handoff_source(p_digest bytea,p_ticket text,p_photo_ids uuid[],p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;actor jsonb;t core_flow.ticket;b jsonb;photos jsonb;unit_label text;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  actor:=core_flow.session(p_digest);
  IF p_lock THEN PERFORM core_flow.vendor_handoff_lock_ticket((c->>'orgId')::uuid,p_ticket); END IF;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket;
  b:=core_flow.building_body(t.org_id,t.property_id);
  SELECT label INTO unit_label FROM app.unit WHERE org_id=t.org_id AND id=t.unit_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('photoId',p.id,'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height)
    ORDER BY p.id),'[]'::jsonb) INTO photos
    FROM core_flow.ticket_photo p WHERE p.org_id=t.org_id AND p.ticket_id=t.id AND (p_photo_ids IS NULL OR p.id=ANY(p_photo_ids));
  RETURN jsonb_build_object('actorId',actor->>'actorId','orgId',t.org_id,'ticketId',t.id,'propertyId',t.property_id,'unitId',t.unit_id,'unitLabel',unit_label,
    'ticketVersion',t.version,'workStatus',t.work_status,'ticket',t.body,'building',b,'photos',photos);
END $$;

RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

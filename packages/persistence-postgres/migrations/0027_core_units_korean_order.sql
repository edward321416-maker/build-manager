-- Unit list order (docs/superpowers/specs/2026-10-14-unit-list-korean-order-design.md). The database default collation
-- (en_US.utf8) skips Hangul at the first comparison and compares digits as text, and units of buildings that share a
-- name (every building without building information reads 건물 since 0025) were interleaved. core_flow.unit_name_order
-- is ICU Korean with numbers compared by value (2호 < 10호 < 101호, Hangul before Latin); it is used only for ordering,
-- never in an index. core_flow.units keeps the 0026 body, signature, owner, SECURITY DEFINER, search_path and grants;
-- only its ORDER BY changes: building name, then building id, then unit label, then unit id.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE COLLATION core_flow.unit_name_order (provider = icu, locale = 'ko-u-kn-true');

CREATE OR REPLACE FUNCTION core_flow.units(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; org uuid; actor uuid; tenant boolean; result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 org:=(s->>'orgId')::uuid; actor:=(s->>'actorId')::uuid; tenant:=s->>'role'='TENANT';
 WITH readable AS MATERIALIZED (
  SELECT p.id FROM app.property p
  WHERE p.org_id=org AND p.status='ACTIVE' AND (tenant OR authn.can_read_property(p_digest,org,p.id))
 ), visible AS (
  SELECT u.id,u.property_id,u.label,coalesce(c.body->>'displayName','건물') AS building_name
  FROM app.unit u JOIN readable r ON r.id=u.property_id
  LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
  WHERE u.org_id=org AND u.status='ACTIVE'
  AND (NOT tenant OR EXISTS(SELECT 1 FROM app.occupancy o JOIN app.occupancy_member m ON m.org_id=o.org_id AND m.occupancy_id=o.id
   WHERE o.org_id=org AND o.unit_id=u.id AND o.status='ACTIVE' AND m.status='ACTIVE' AND m.user_id=actor
   AND m.joined_at<=clock_timestamp() AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp())))
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'buildingId',v.property_id,'label',v.label,'buildingName',v.building_name)
  ORDER BY v.building_name COLLATE core_flow.unit_name_order,v.property_id,v.label COLLATE core_flow.unit_name_order,v.id),'[]'::jsonb)
  INTO result FROM visible v;
 RETURN result;
END $$;

RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

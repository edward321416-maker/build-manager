-- Unit list over 200 (docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md, option A). core_flow.units cut the list
-- to the first 200 units in id order (unit ids are time-ordered uuidv7, so newly registered units were the ones left out)
-- and ran core_flow.can_unit once per unit of the organisation. It now returns every unit
-- the session can read, ordered by building name, unit label and unit id, and checks building access once per building
-- (the readable CTE is MATERIALIZED so that holds whatever the plan)
-- with the rules of can_unit: a manager or staff member reads the active units of every active building
-- authn.can_read_property allows; a tenant reads the active units of active buildings they live in now. The building
-- name keeps the 0025 fallback. Since 0025 also lists units of buildings without a building context row, those units
-- shared the same 200 places; with no limit they are all listed too.
-- Signature, owner, SECURITY DEFINER, search_path and grants stay; can_unit is unchanged.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

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
  ORDER BY v.building_name,v.label,v.id),'[]'::jsonb) INTO result FROM visible v;
 RETURN result;
END $$;

RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

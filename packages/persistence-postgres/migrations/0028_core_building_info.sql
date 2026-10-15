-- P6 + C1 step 2 (docs/superpowers/specs/2026-10-15-building-setup-p6-design.md): organisation admins read their buildings
-- and save a building's name, vendor service address and owner-verified heating/management facts. Demo buildings
-- (body.demo=true) are never saved here. The saved body keeps the 0011 building shape plus version and updatedAt, so
-- building_body (0025), units, the manager queue and the vendor source read it unchanged.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.require_org_admin(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 IF s->>'role' IS DISTINCT FROM 'ORG_ADMIN' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 RETURN s;
END $$;

CREATE FUNCTION core_flow.verified_fact(p_body jsonb,p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT f->>'value' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_body->'context')='array' THEN p_body->'context' ELSE '[]'::jsonb END) f
 WHERE f->>'key'=p_key AND f->'verified'='true'::jsonb AND f->'routingEligible'='true'::jsonb AND jsonb_typeof(f->'value')='string'
 LIMIT 1
$$;

CREATE FUNCTION core_flow.building_info_json(p_digest bytea,p_org uuid,p_property uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b jsonb; heating text; management text;
BEGIN
 PERFORM 1 FROM app.property p WHERE p.org_id=p_org AND p.id=p_property AND p.status='ACTIVE' AND authn.can_read_property(p_digest,p_org,p.id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT c.body INTO b FROM core_flow.building_context c WHERE c.org_id=p_org AND c.property_id=p_property;
 heating:=core_flow.verified_fact(b,'heatingType'); management:=core_flow.verified_fact(b,'managementMode');
 RETURN jsonb_build_object('buildingId',p_property::text,
  'displayName',nullif(btrim(b->>'displayName'),''),
  'serviceAddress',nullif(btrim(b->>'serviceAddress'),''),
  'heatingType',CASE WHEN heating IN ('INDIVIDUAL','CENTRAL_SHARED') THEN heating END,
  'managementMode',CASE WHEN management IN ('OWNER_DIRECT','MANAGEMENT_OFFICE') THEN management END,
  'demo',coalesce(b->'demo'='true'::jsonb,false),
  'version',CASE WHEN jsonb_typeof(b->'version')='number' THEN (b->>'version')::integer ELSE 0 END,
  'unitCount',(SELECT count(*)::integer FROM app.unit u WHERE u.org_id=p_org AND u.property_id=p_property AND u.status='ACTIVE'));
END $$;

CREATE FUNCTION core_flow.org_buildings(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; org uuid; result jsonb;
BEGIN
 s:=core_flow.require_org_admin(p_digest); org:=(s->>'orgId')::uuid;
 SELECT coalesce(jsonb_agg(jsonb_build_object('buildingId',x.id::text,'displayName',x.name,'unitCount',x.units,'needsInfo',x.name IS NULL OR x.address IS NULL)
  ORDER BY x.name IS NULL,x.name COLLATE core_flow.unit_name_order,x.id),'[]'::jsonb) INTO result
 FROM (SELECT p.id,nullif(btrim(c.body->>'displayName'),'') AS name,nullif(btrim(c.body->>'serviceAddress'),'') AS address,
  (SELECT count(*)::integer FROM app.unit u WHERE u.org_id=org AND u.property_id=p.id AND u.status='ACTIVE') AS units
  FROM app.property p LEFT JOIN core_flow.building_context c ON c.org_id=p.org_id AND c.property_id=p.id
  WHERE p.org_id=org AND p.status='ACTIVE' AND authn.can_read_property(p_digest,org,p.id)) x;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.building_info(p_digest bytea,p_property uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;
BEGIN
 s:=core_flow.require_org_admin(p_digest);
 RETURN core_flow.building_info_json(p_digest,(s->>'orgId')::uuid,p_property);
END $$;

CREATE FUNCTION core_flow.save_building_info(p_digest bytea,p_property uuid,p_expected_version integer,p_name text,
 p_service_address text,p_heating text,p_management text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; org uuid; b jsonb; current_version integer; at_text text; facts jsonb:='[]'::jsonb;
 invisible CONSTANT text:='[\u0000-\u001f\u007f-\u009f­؀-؅؜۝܏࢐-࢑࣢᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻\U000110bd\U000110cd\U00013430-\U0001343f\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0001\U000e0020-\U000e007f]';
BEGIN
 s:=core_flow.require_org_admin(p_digest); org:=(s->>'orgId')::uuid;
 PERFORM 1 FROM app.property p WHERE p.org_id=org AND p.id=p_property AND p.status='ACTIVE' AND authn.can_read_property(p_digest,org,p.id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 -- invisible: Unicode Cc and Cf (17.0), the same set the vendor packet's /[\p{Cc}\p{Cf}]/u refuses.
 IF p_expected_version IS NULL OR p_expected_version<0
  OR p_name IS NULL OR p_name<>btrim(p_name) OR char_length(p_name) NOT BETWEEN 1 AND 50 OR p_name ~ invisible
  OR (p_service_address IS NOT NULL AND (p_service_address<>btrim(p_service_address) OR char_length(p_service_address) NOT BETWEEN 1 AND 200 OR p_service_address ~ invisible))
  OR (p_heating IS NOT NULL AND p_heating NOT IN ('INDIVIDUAL','CENTRAL_SHARED'))
  OR (p_management IS NOT NULL AND p_management NOT IN ('OWNER_DIRECT','MANAGEMENT_OFFICE'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 -- Serialises the first save of a building too, when no row exists yet to lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('core_flow.building_info:'||p_property::text,0));
 SELECT c.body INTO b FROM core_flow.building_context c WHERE c.org_id=org AND c.property_id=p_property;
 IF b->'demo'='true'::jsonb THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 current_version:=CASE WHEN jsonb_typeof(b->'version')='number' THEN (b->>'version')::integer ELSE 0 END;
 IF current_version<>p_expected_version THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 at_text:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 IF p_heating IS NOT NULL THEN facts:=facts||jsonb_build_array(jsonb_build_object('key','heatingType','value',p_heating,'sourceType','OWNER_VERIFIED',
  'sourceRef','org_admin','verified',true,'routingEligible',true,'fetchedAt',NULL,'updatedAt',at_text)); END IF;
 IF p_management IS NOT NULL THEN facts:=facts||jsonb_build_array(jsonb_build_object('key','managementMode','value',p_management,'sourceType','OWNER_VERIFIED',
  'sourceRef','org_admin','verified',true,'routingEligible',true,'fetchedAt',NULL,'updatedAt',at_text)); END IF;
 INSERT INTO core_flow.building_context(org_id,property_id,body)
 VALUES(org,p_property,jsonb_build_object('id',p_property::text,'displayName',p_name,'demo',false,'sourceNativeIds','{}'::jsonb,'context',facts,
  'serviceAddress',p_service_address,'version',current_version+1,'updatedAt',at_text))
 ON CONFLICT(org_id,property_id) DO UPDATE SET body=excluded.body;
 RETURN core_flow.building_info_json(p_digest,org,p_property);
END $$;

REVOKE ALL ON FUNCTION core_flow.require_org_admin(bytea),core_flow.verified_fact(jsonb,text),core_flow.building_info_json(bytea,uuid,uuid),
 core_flow.org_buildings(bytea),core_flow.building_info(bytea,uuid),core_flow.save_building_info(bytea,uuid,integer,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.org_buildings(bytea),core_flow.building_info(bytea,uuid),
 core_flow.save_building_info(bytea,uuid,integer,text,text,text,text) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;

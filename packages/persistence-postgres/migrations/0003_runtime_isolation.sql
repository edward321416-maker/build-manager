CREATE FUNCTION app.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(pg_catalog.current_setting('app.org_id', true), '')::uuid
$$;

REVOKE EXECUTE ON FUNCTION app.current_org_id() FROM PUBLIC;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

ALTER TABLE app.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization FORCE ROW LEVEL SECURITY;
ALTER TABLE app.organization_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_membership FORCE ROW LEVEL SECURITY;
ALTER TABLE app.property ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property FORCE ROW LEVEL SECURITY;
ALTER TABLE app.unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.unit FORCE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy FORCE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy_member FORCE ROW LEVEL SECURITY;

CREATE POLICY organization_org_scope ON app.organization
  USING (id = app.current_org_id())
  WITH CHECK (id = app.current_org_id());

CREATE POLICY organization_membership_org_scope ON app.organization_membership
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY property_org_scope ON app.property
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY unit_org_scope ON app.unit
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY occupancy_org_scope ON app.occupancy
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY occupancy_member_org_scope ON app.occupancy_member
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

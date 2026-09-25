import { afterAll, beforeAll, expect, it } from "vitest";
import { createB2Harness, type B2Harness } from "./helpers/b2-fixture";

let h: B2Harness;
beforeAll(async () => { h = await createB2Harness(); }, 120_000);
afterAll(async () => { await h?.close(); });

it("AC17 exposes the exact B3 admin capability contract", async () => {
  const fn = await h.migration.query(`
    SELECT owner.rolname AS owner,p.provolatile,p.prosecdef,p.proconfig
    FROM pg_proc p JOIN pg_roles owner ON owner.oid=p.proowner
    WHERE p.oid=to_regprocedure('authn.can_administer_org(bytea,uuid)')`);
  expect(fn.rows).toEqual([{
    owner: "bm_b1_capability_owner",
    provolatile: "s",
    prosecdef: true,
    proconfig: ["search_path=pg_catalog"],
  }]);

  const privileges = await h.migration.query(`
    WITH fn AS (SELECT to_regprocedure('authn.can_administer_org(bytea,uuid)') AS oid)
    SELECT role_name,
      CASE WHEN fn.oid IS NULL THEN false
           ELSE has_function_privilege(role_name,fn.oid,'EXECUTE') END AS execute
    FROM fn CROSS JOIN (VALUES
      ('bm_b1_capability_owner'),('bm_b1_web'),('bm_b1_login'),('bm_pf02a_runtime')
    ) roles(role_name) ORDER BY role_name`);
  expect(privileges.rows).toEqual([
    { role_name: "bm_b1_capability_owner", execute: true },
    { role_name: "bm_b1_login", execute: false },
    { role_name: "bm_b1_web", execute: true },
    { role_name: "bm_pf02a_runtime", execute: false },
  ]);
});

it("AC17 installs exactly the three bm_b1_web restrictive B3 policies", async () => {
  const webOid = (await h.migration.query("SELECT oid FROM pg_roles WHERE rolname='bm_b1_web'")).rows[0].oid;
  const policies = await h.migration.query(`
    SELECT c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles,
      pg_get_expr(p.polqual,p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr
    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app' AND p.polname LIKE 'b3_%'
    ORDER BY p.polname`);
  expect(policies.rows.map(row => ({
    relname: row.relname,
    polname: row.polname,
    polcmd: row.polcmd,
    polpermissive: row.polpermissive,
    polroles: row.polroles,
  }))).toEqual([
    { relname: "property", polname: "b3_property_insert_ceiling", polcmd: "a", polpermissive: false, polroles: [webOid] },
    { relname: "unit", polname: "b3_unit_insert_ceiling", polcmd: "a", polpermissive: false, polroles: [webOid] },
    { relname: "unit", polname: "b3_unit_read_ceiling", polcmd: "r", polpermissive: false, polroles: [webOid] },
  ]);

  const normalize = (value: string | null) => value?.replace(/::text/g, "").replace(/\s/g, "").toLowerCase() ?? null;
  const byName = new Map(policies.rows.map(row => [row.polname, row]));
  expect(normalize(byName.get("b3_property_insert_ceiling")?.check_expr ?? null))
    .toContain("authn.can_administer_org(authn.context_session_digest(),org_id)");
  expect(normalize(byName.get("b3_unit_read_ceiling")?.using_expr ?? null))
    .toContain("authn.can_read_property(authn.context_session_digest(),org_id,property_id)");
  expect(normalize(byName.get("b3_unit_insert_ceiling")?.check_expr ?? null))
    .toContain("authn.can_read_property(authn.context_session_digest(),org_id,property_id)");
});

it("AC17 grants only the approved B3 Web columns and leaves owner CREATE revoked", async () => {
  const allowed = async (table: string, column: string, privilege: string) =>
    (await h.migration.query(
      "SELECT has_column_privilege('bm_b1_web',$1,$2,$3) AS allowed",
      ["app." + table, column, privilege],
    )).rows[0].allowed as boolean;

  for (const column of ["id","org_id","address_reference","status"])
    expect(await allowed("property", column, "INSERT"), "property." + column + " INSERT").toBe(true);
  expect(await allowed("property", "created_at", "INSERT")).toBe(false);

  for (const column of ["id","org_id","property_id","label","status"]) {
    expect(await allowed("unit", column, "SELECT"), "unit." + column + " SELECT").toBe(true);
    expect(await allowed("unit", column, "INSERT"), "unit." + column + " INSERT").toBe(true);
  }
  expect(await allowed("unit", "created_at", "SELECT")).toBe(false);
  expect(await allowed("unit", "created_at", "INSERT")).toBe(false);
  for (const table of ["property","unit"]) {
    expect((await h.migration.query(
      "SELECT has_table_privilege('bm_b1_web',$1,'UPDATE') AS update,has_table_privilege('bm_b1_web',$1,'DELETE') AS delete",
      ["app." + table],
    )).rows[0]).toEqual({ update: false, delete: false });
  }

  expect((await h.migration.query(
    "SELECT has_schema_privilege('bm_b1_capability_owner','authn','CREATE') AS allowed",
  )).rows).toEqual([{ allowed: false }]);

  const tables = (await h.migration.query(`
    SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename`)).rows.map(row => row.tablename);
  expect(tables).toEqual([
    "app_user","occupancy","occupancy_member","organization",
    "organization_membership","property","property_assignment","unit",
  ]);
});

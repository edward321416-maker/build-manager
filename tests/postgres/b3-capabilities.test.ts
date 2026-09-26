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
  // A NULL ACL means PostgreSQL's default function ACL (including PUBLIC EXECUTE),
  // not an empty ACL. Owner-intrinsic privileges are distinct from these explicit entries.
  const acl = await h.migration.query(`
    SELECT p.proacl IS NULL AS default_acl,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE COALESCE(grantee.rolname,a.grantee::text) END AS grantee,
      COALESCE(grantor.rolname,a.grantor::text) AS grantor,a.privilege_type,a.is_grantable
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
    LEFT JOIN pg_roles grantor ON grantor.oid=a.grantor
    WHERE p.oid=to_regprocedure('authn.can_administer_org(bytea,uuid)')
    ORDER BY grantee,grantor,a.privilege_type,a.is_grantable`);
  // 0008 creates the function as capability owner, revokes PUBLIC and grants Web EXECUTE.
  const expectedAcl = ["bm_b1_capability_owner", "bm_b1_web"].map(grantee => ({
    default_acl: false, grantee, grantor: "bm_b1_capability_owner", privilege_type: "EXECUTE", is_grantable: false,
  }));
  const assertAcl = (rows: typeof acl.rows) => expect(rows).toEqual(expectedAcl);
  assertAcl(acl.rows);
  const extra = (grantee: string) => [...acl.rows, { ...acl.rows[1], grantee }];
  for (const copy of [extra("bm_b1_login"), extra("PUBLIC"),
    acl.rows.map((row, i) => i === 1 ? { ...row, is_grantable: true } : { ...row }),
    acl.rows.filter(row => row.grantee !== "bm_b1_web"),
    acl.rows.map(row => ({ ...row, default_acl: true })),
    acl.rows.map((row, i) => i === 1 ? { ...row, grantor: "bm_b1_web" } : { ...row }),
    acl.rows.map((row, i) => i === 1 ? { ...row, privilege_type: "UPDATE" } : { ...row }),
  ]) expect(() => assertAcl(copy)).toThrowError(expect.objectContaining({ name: "AssertionError" }));
  assertAcl(acl.rows);

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
  // Expected expressions are the frozen 0008 conjunctions in pg_get_expr display form.
  // Preserve casts, literals, parentheses and AND/OR; collapse display whitespace only.
  const normalize = (value: string | null) => value === null ? null : value.replace(/\s+/g, " ").trim();
  const expected = [
    { relname: "property", polname: "b3_property_insert_ceiling", polcmd: "a", polpermissive: false, polroles: [webOid],
      using_expr: null,
      check_expr: "((status = 'ACTIVE'::text) AND (org_id = app.current_org_id()) AND authn.can_administer_org(authn.context_session_digest(), org_id))" },
    { relname: "unit", polname: "b3_unit_insert_ceiling", polcmd: "a", polpermissive: false, polroles: [webOid],
      using_expr: null,
      check_expr: "((status = 'ACTIVE'::text) AND (org_id = app.current_org_id()) AND authn.can_administer_org(authn.context_session_digest(), org_id) AND authn.can_read_property(authn.context_session_digest(), org_id, property_id))" },
    { relname: "unit", polname: "b3_unit_read_ceiling", polcmd: "r", polpermissive: false, polroles: [webOid],
      using_expr: "((status = 'ACTIVE'::text) AND authn.can_read_property(authn.context_session_digest(), org_id, property_id))",
      check_expr: null },
  ];
  const assertPolicies = (rows: typeof policies.rows) => expect(rows.map(row => ({ ...row,
    using_expr: normalize(row.using_expr), check_expr: normalize(row.check_expr),
  }))).toEqual(expected);
  assertPolicies(policies.rows);
  // CATALOG_ASSERTION_MUTATION: each copy is checked by the same installed-object assertion.
  for (const [index, row] of policies.rows.entries()) {
    const field = row.polcmd === "r" ? "using_expr" : "check_expr";
    const expression = row[field] as string;
    const terms = ["(status = 'ACTIVE'::text)", "(org_id = app.current_org_id())",
      "authn.can_administer_org(authn.context_session_digest(), org_id)",
      "authn.can_read_property(authn.context_session_digest(), org_id, property_id)"];
    const mutations = [
      { ...row, [field]: `(${expression}) OR true` }, { ...row, [field]: null },
      { ...row, polpermissive: true }, { ...row, polroles: [0] },
      { ...row, polroles: [...row.polroles, 0] }, { ...row, polcmd: "*" },
      { ...row, relname: "organization" }, { ...row, polname: row.polname + "_changed" },
      { ...row, [field === "using_expr" ? "check_expr" : "using_expr"]: "true" },
      ...terms.filter(term => expression.includes(term)).map(term => ({ ...row, [field]: expression.replace(term, "true") })),
    ];
    for (const mutated of mutations) {
      const copy = policies.rows.map((original, i) => i === index ? mutated : { ...original });
      expect(() => assertPolicies(copy)).toThrowError(expect.objectContaining({ name: "AssertionError" }));
    }
  }
  for (const copy of [policies.rows.slice(1), [...policies.rows, { ...policies.rows[0] }]])
    expect(() => assertPolicies(copy)).toThrowError(expect.objectContaining({ name: "AssertionError" }));
  assertPolicies(policies.rows); // Observation and database remained unchanged.

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

it("AC13 pins exact Unit Web columns and no capability-owner Unit grant", async () => {
  const columns = (await h.migration.query(
    "SELECT attname FROM pg_attribute WHERE attrelid='app.unit'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum",
  )).rows.map(row => row.attname as string);
  const webSelect = new Set(["id","org_id","property_id","label","status"]);
  const webInsert = new Set(["id","org_id","property_id","label","status"]);

  for (const column of columns) {
    for (const privilege of ["SELECT","INSERT","UPDATE","REFERENCES"]) {
      const allowed = (await h.migration.query(
        "SELECT has_column_privilege('bm_b1_web','app.unit',$1,$2) AS allowed",
        [column, privilege],
      )).rows[0].allowed as boolean;
      const expected = privilege === "SELECT" ? webSelect.has(column)
        : privilege === "INSERT" ? webInsert.has(column)
        : false;
      expect(allowed, "bm_b1_web unit." + column + " " + privilege).toBe(expected);

      const ownerAllowed = (await h.migration.query(
        "SELECT has_column_privilege('bm_b1_capability_owner','app.unit',$1,$2) AS allowed",
        [column, privilege],
      )).rows[0].allowed as boolean;
      expect(ownerAllowed, "capability owner unit." + column + " " + privilege).toBe(false);
    }
  }
  for (const privilege of ["UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"]) {
    expect((await h.migration.query(
      "SELECT has_table_privilege('bm_b1_web','app.unit',$1) AS allowed",
      [privilege],
    )).rows[0].allowed, "bm_b1_web unit " + privilege).toBe(false);
    expect((await h.migration.query(
      "SELECT has_table_privilege('bm_b1_capability_owner','app.unit',$1) AS allowed",
      [privilege],
    )).rows[0].allowed, "capability owner unit " + privilege).toBe(false);
  }
});

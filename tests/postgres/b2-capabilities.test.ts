import { afterAll, beforeAll, expect, it } from "vitest";
import { Client } from "pg";
import { createB2Harness, seedB2Scope, changeOrg, type B2Harness } from "./helpers/b2-fixture";

let h: B2Harness;
beforeAll(async () => { h = await createB2Harness(); }, 120_000);
afterAll(async () => { await h?.close(); });

const proof = (digest: string) => Buffer.from(digest, "hex");
const catalog = async () => (await h.migration.query(`
  SELECT c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles,
    pg_get_expr(p.polqual,p.polrelid) AS expression,
    pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression,c.relacl
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app'
  ORDER BY c.relname,p.polname`)).rows;

it("AC03 staffContextWithoutAssignment", async () => {
  const s = await seedB2Scope(h);
  expect((await h.web.query("SELECT id FROM authn.list_my_organizations($1,NULL,20)",
    [proof(s.staffNone.digest)])).rows).toEqual([{ id: s.orgA }]);
  expect((await h.web.query("SELECT authn.authorize_org($1,$2) AS allowed",
    [proof(s.staffNone.digest), s.orgA])).rows[0].allowed).toBe(true);
});

it("AC16 explicitDiscoverySurvivesWeakenedRls", async () => {
  const s = await seedB2Scope(h);
  const ended = await seedB2Scope(h), inactive = await seedB2Scope(h), suspended = await seedB2Scope(h);
  await changeOrg(h.migration, ended.orgA,
    "UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1", [ended.adminA.userId]);
  await changeOrg(h.migration, inactive.orgA,
    "UPDATE app.organization SET status='SUSPENDED' WHERE id=$1", [inactive.orgA]);
  await h.migration.query("UPDATE app.app_user SET status='SUSPENDED' WHERE id=$1", [suspended.adminA.userId]);
  const before = await catalog();
  await h.migration.query("BEGIN");
  try {
    for (const [table, prefix] of [["organization_membership", "member"], ["organization", "org"]])
      for (const suffix of ["discovery", "ceiling"])
        await h.migration.query(`ALTER POLICY b1_${prefix}_${suffix} ON app.${table} USING(true)`);
    await h.migration.query("SET LOCAL ROLE bm_b1_capability_owner");
    await h.migration.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",
      [s.orgB, s.adminA.digest]);
    const rawOrgs = (await h.migration.query("SELECT id,status FROM app.organization")).rows;
    const rawMembers = (await h.migration.query("SELECT id,org_id,user_id,status FROM app.organization_membership")).rows;
    expect(rawOrgs.map(r => r.id)).toContain(s.orgB);
    expect(rawMembers.map(r => r.id)).toContain(s.foreignMembership);
    expect(rawOrgs).toContainEqual({ id: inactive.orgA, status: "SUSPENDED" });
    expect(rawMembers.some(r => r.org_id === ended.orgA && r.user_id === ended.adminA.userId && r.status === "ENDED")).toBe(true);
    expect(rawMembers.some(r => r.org_id === suspended.orgA && r.user_id === suspended.adminA.userId)).toBe(true);
    const discover = async (digest: string) => (await h.migration.query(
      "SELECT id FROM authn.list_my_organizations($1,NULL,51)", [proof(digest)])).rows;
    // The raw foreign organization AND foreign membership above must be visible before this assertion.
    expect(await discover(s.adminA.digest)).toEqual([{ id: s.orgA }]);
    expect(await discover(s.staffNone.digest)).toEqual([{ id: s.orgA }]);
    expect(await discover(s.noMember.digest)).toEqual([]);
    expect(await discover(ended.adminA.digest)).toEqual([]);
    expect(await discover(inactive.adminA.digest)).toEqual([]);
    await h.migration.query("SAVEPOINT suspended_actor");
    await expect(discover(suspended.adminA.digest)).rejects.toMatchObject({ code: "28000" });
    await h.migration.query("ROLLBACK TO SAVEPOINT suspended_actor");
    const body = (await h.migration.query("SELECT prosrc FROM pg_proc WHERE oid='authn.list_my_organizations(bytea,uuid,integer)'::regprocedure")).rows[0].prosrc;
    expect(body).toMatch(/m\.role\s+IN\s*\(\s*'ORG_ADMIN'\s*,\s*'PROPERTY_STAFF'\s*\)/i);
    expect(body).toMatch(/m\.user_id\s*=\s*authn\.current_actor\(p_digest\)/i);
    expect(body).toMatch(/m\.status\s*=\s*'ACTIVE'/i);
  } finally {
    await h.migration.query("ROLLBACK");
    expect(await catalog()).toEqual(before);
  }
});

it("AC02 staffPropertyCeiling", async () => {
  const s = await seedB2Scope(h);
  for (const [actor, expected, admin] of [
    [s.staffA, [s.propertyA, s.propertyC], false],
    [s.staffNone, [], false],
    [s.adminA, [s.propertyA, s.propertyB, s.propertyC], true],
  ] as const) {
    await h.web.query("BEGIN");
    try {
      expect((await h.web.query(`SELECT authn.authorize_org($1,$2) AS context,
        authn.can_access_org_context($1,$2) AS direct_context,authn.can_read_org($1,$2) AS admin`,
        [proof(actor.digest), s.orgA])).rows).toEqual([{ context: true, direct_context: true, admin }]);
      await h.web.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)", [s.orgA, actor.digest]);
      expect((await h.web.query("SELECT id FROM app.property ORDER BY id")).rows.map(r => r.id)).toEqual(expected);
      for (const property of [s.propertyA, s.propertyB, s.propertyC, s.foreignProperty])
        expect((await h.web.query("SELECT authn.can_read_property($1,$2,$3) AS allowed",
          [proof(actor.digest), s.orgA, property])).rows[0].allowed).toBe((expected as readonly string[]).includes(property));
    } finally { await h.web.query("ROLLBACK"); }
  }
  for (const [org, digest] of [[s.orgA, ""], [s.orgA, "not-hex"], [s.orgB, s.staffA.digest], [s.orgA, s.adminB.digest]]) {
    await h.web.query("BEGIN");
    try {
      await h.web.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)", [org, digest]);
      expect((await h.web.query("SELECT id FROM app.property")).rows).toEqual([]);
      expect((await h.web.query("SELECT authn.can_read_property($1,$2,$3) AS allowed",
        [proof(s.staffA.digest), s.orgA, s.propertyA])).rows[0].allowed).toBe(false);
    } finally { await h.web.query("ROLLBACK"); }
  }
});

it("AC15 exactB2CapabilityCatalog", async () => {
  const owner = (await h.migration.query(`SELECT c.relowner,r.rolname,r.rolsuper,r.rolcreatedb,
    r.rolcreaterole,r.rolreplication,r.rolbypassrls FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
    WHERE c.oid='app.property_assignment'::regclass`)).rows[0];
  expect([owner.rolsuper, owner.rolcreatedb, owner.rolcreaterole, owner.rolreplication, owner.rolbypassrls]).toEqual(Array(5).fill(false));
  const roleRows = (await h.migration.query(`SELECT oid,rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,
    rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname IN
    ('bm_b1_web','bm_b1_login','bm_b1_capability_owner','bm_pf02a_runtime') ORDER BY rolname`)).rows;
  expect(roleRows.map(r => r.rolname)).toEqual(["bm_b1_capability_owner", "bm_b1_login", "bm_b1_web", "bm_pf02a_runtime"]);
  for (const role of roleRows) {
    expect([role.rolsuper, role.rolcreatedb, role.rolcreaterole, role.rolreplication, role.rolbypassrls]).toEqual(Array(5).fill(false));
    expect(role.oid).not.toBe(owner.relowner);
    if (role.rolname.startsWith("bm_b1_")) expect(role.rolinherit).toBe(false);
    expect(role.rolcanlogin).toBe(role.rolname !== "bm_b1_capability_owner");
    for (const schema of ["app", "authn"])
      expect((await h.migration.query("SELECT has_schema_privilege($1,$2,'CREATE') AS allowed", [role.rolname, schema])).rows[0].allowed).toBe(false);
  }
  const memberships = (await h.migration.query(`SELECT granted.rolname AS granted,member.rolname AS member,
    am.admin_option,am.inherit_option,am.set_option FROM pg_auth_members am
    JOIN pg_roles granted ON granted.oid=am.roleid JOIN pg_roles member ON member.oid=am.member
    WHERE granted.rolname LIKE 'bm_%' OR member.rolname LIKE 'bm_%' ORDER BY granted.rolname,member.rolname`)).rows;
  expect(memberships).toEqual([{ granted: "bm_b1_capability_owner", member: owner.rolname,
    admin_option: false, inherit_option: false, set_option: true }]);
  // Keep this frozen regression scoped to the B1/B2 policy inventory. B3 policies
  // are asserted independently in b3-capabilities.test.ts.
  const policies = (await catalog()).filter(policy => !policy.polname.startsWith("b3_"));
  const capOid = roleRows.find(r => r.rolname === "bm_b1_capability_owner")!.oid;
  const webOid = roleRows.find(r => r.rolname === "bm_b1_web")!.oid;
  const m = "user_id=authn.context_actor() AND status='ACTIVE' AND role=ANY(ARRAY['ORG_ADMIN','PROPERTY_STAFF'])";
  const o = "status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m WHERE m.org_id=organization.id AND m.user_id=authn.context_actor() AND m.status='ACTIVE' AND m.role=ANY(ARRAY['ORG_ADMIN','PROPERTY_STAFF']))";
  const a = "status='ACTIVE' AND EXISTS(SELECT 1 FROM app.organization_membership m WHERE m.org_id=property_assignment.org_id AND m.id=property_assignment.membership_id AND m.user_id=authn.context_actor() AND m.status='ACTIVE' AND m.role='PROPERTY_STAFF')";
  const normalize = (value: string | null) => value?.replace(/::text/g, "").replace(/[\s()]/g, "").toLowerCase() ?? null;
  type ExpectedPolicy = [string, string, string, boolean, number[], string, string | null];
  const expected: ExpectedPolicy[] = [
    ...["organization", "organization_membership", "property", "unit", "occupancy", "occupancy_member"].map(table => {
      const expr = `${table === "organization" ? "id" : "org_id"}=app.current_org_id()`;
      return [table, `${table}_org_scope`, "*", true, [0], expr, expr] as ExpectedPolicy;
    }),
    ["organization_membership", "b1_member_discovery", "r", true, [capOid], m, null],
    ["organization_membership", "b1_member_ceiling", "r", false, [capOid], m, null],
    ["organization", "b1_org_discovery", "r", true, [capOid], o, null],
    ["organization", "b1_org_ceiling", "r", false, [capOid], o, null],
    ["property", "b1_property_ceiling", "r", false, [webOid], "status='ACTIVE' AND authn.can_read_property(authn.context_session_digest(),org_id,id)", null],
    ["property", "b2_property_owner_ceiling", "r", false, [capOid], "org_id=app.current_org_id() AND status='ACTIVE'", null],
    ["property_assignment", "b2_assignment_owner_scope", "*", true, [owner.relowner], "org_id=app.current_org_id()", "org_id=app.current_org_id()"],
    ["property_assignment", "b2_assignment_read_scope", "r", true, [capOid], "org_id=app.current_org_id()", null],
    ["property_assignment", "b2_assignment_read_ceiling", "r", false, [capOid], a, null],
  ];
  expect(policies.map(p => p.polname).sort()).toEqual(expected.map(p => p[1]).sort());
  for (const [table, name, command, permissive, roles, expression, check] of expected) {
    const actual = policies.find(p => p.polname === name)!;
    expect({ table: actual.relname, command: actual.polcmd, permissive: actual.polpermissive, roles: actual.polroles }, name)
      .toEqual({ table, command, permissive, roles });
    expect(normalize(actual.expression), name).toBe(normalize(expression));
    expect(normalize(actual.check_expression), name).toBe(normalize(check));
  }
  const rls = (await h.migration.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
    WHERE relnamespace='app'::regnamespace AND relkind='r' AND relname<>'app_user' ORDER BY relname`)).rows;
  expect(rls.map(r => r.relname)).toEqual(["occupancy", "occupancy_member", "organization", "organization_membership", "property", "property_assignment", "unit"]);
  for (const row of rls) expect([row.relrowsecurity, row.relforcerowsecurity]).toEqual([true, true]);
  for (const [name, args, volatility, language, definer, web, result] of [
    ["can_access_org_context", "bytea, uuid", "v", "plpgsql", true, true, "boolean"],
    ["can_read_org", "bytea, uuid", "v", "plpgsql", true, true, "boolean"],
    ["authorize_org", "bytea, uuid", "v", "sql", true, true, "boolean"],
    ["list_my_organizations", "bytea, uuid, integer", "v", "plpgsql", true, true, "TABLE(id uuid, display_name text)"],
    ["can_read_property", "bytea, uuid, uuid", "s", "sql", true, true, "boolean"],
    ["context_actor", "", "s", "sql", true, false, "uuid"],
    ["current_actor", "bytea", "s", "sql", true, true, "uuid"],
    ["context_session_digest", "", "s", "sql", false, true, "bytea"],
  ] as const) {
    const signature = `authn.${name}(${args})`;
    const f = (await h.migration.query(`SELECT r.rolname AS owner,p.provolatile,l.lanname,p.prosecdef,p.proconfig,
      oidvectortypes(p.proargtypes) AS args,pg_get_function_result(p.oid) AS result,
      ARRAY(SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE gr.rolname::text END
        FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles gr ON gr.oid=a.grantee
        WHERE a.privilege_type='EXECUTE' ORDER BY 1) AS executors,
      EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.is_grantable) AS grantable
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid=$1::regprocedure`, [signature])).rows[0];
    expect(f, signature).toEqual({ owner: "bm_b1_capability_owner", provolatile: volatility, lanname: language,
      prosecdef: definer, proconfig: ["search_path=pg_catalog"], args, result,
      executors: web ? ["bm_b1_capability_owner", "bm_b1_web"] : ["bm_b1_capability_owner"], grantable: false });
    for (const role of ["bm_b1_login", "bm_pf02a_runtime"])
      expect((await h.migration.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, signature])).rows[0].allowed).toBe(false);
  }
});

it("AC15 exactColumnGrantsAndActualRoleDenials", async () => {
  const s = await seedB2Scope(h);
  for (const [table, allowed] of [["property", ["id", "org_id", "status"]],
    ["property_assignment", ["org_id", "membership_id", "property_id", "status"]]] as const) {
    const columns = (await h.migration.query(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass
      AND attnum>0 AND NOT attisdropped ORDER BY attnum`, [`app.${table}`])).rows.map(r => r.attname as string);
    for (const column of columns) for (const privilege of ["SELECT", "INSERT", "UPDATE", "REFERENCES"]) {
      const result = (await h.migration.query("SELECT has_column_privilege('bm_b1_capability_owner',$1,$2,$3) AS allowed",
        [`app.${table}`, column, privilege])).rows[0].allowed;
      expect(result, `${table}.${column} ${privilege}`).toBe(privilege === "SELECT" && (allowed as readonly string[]).includes(column));
    }
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
      expect((await h.migration.query("SELECT has_table_privilege('bm_b1_capability_owner',$1,$2) AS allowed", [`app.${table}`, privilege])).rows[0].allowed).toBe(false);
  }
  await h.migration.query("BEGIN");
  try {
    await h.migration.query("SET LOCAL ROLE bm_b1_capability_owner");
    await h.migration.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)", [s.orgA, s.staffA.digest]);
    expect((await h.migration.query("SELECT id,org_id,status FROM app.property ORDER BY id")).rows.map(r => r.id))
      .toEqual([s.propertyA, s.propertyB, s.propertyC]);
    expect((await h.migration.query("SELECT org_id,membership_id,property_id,status FROM app.property_assignment ORDER BY property_id")).rows)
      .toEqual([s.propertyA, s.propertyC].map(property_id => ({ org_id: s.orgA, membership_id: s.staffMembership, property_id, status: "ACTIVE" })));
    for (const sql of ["SELECT address_reference FROM app.property", "SELECT id FROM app.property_assignment",
      "SELECT created_at FROM app.property_assignment", "SELECT ended_at FROM app.property_assignment",
      "INSERT INTO app.property DEFAULT VALUES", "UPDATE app.property SET status='ARCHIVED'", "DELETE FROM app.property",
      "INSERT INTO app.property_assignment DEFAULT VALUES", "UPDATE app.property_assignment SET status='ENDED'", "DELETE FROM app.property_assignment"]) {
      await h.migration.query("SAVEPOINT forbidden_privilege");
      await expect(h.migration.query(sql)).rejects.toMatchObject({ code: "42501" });
      await h.migration.query("ROLLBACK TO SAVEPOINT forbidden_privilege");
    }
  } finally { await h.migration.query("ROLLBACK"); }
  const runtime = new Client(h.roles.runtimeConfig);
  await runtime.connect();
  try {
    for (const c of [h.web, h.login, runtime])
      await expect(c.query("SELECT org_id,membership_id,property_id,status FROM app.property_assignment")).rejects.toMatchObject({ code: "42501" });
    const publicGrants = (await h.migration.query(`SELECT a.privilege_type FROM pg_class c
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid='app.property_assignment'::regclass AND a.grantee=0
      UNION ALL SELECT a.privilege_type FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a
      WHERE c.attrelid='app.property_assignment'::regclass AND a.grantee=0`)).rows;
    expect(publicGrants).toEqual([]);
    for (const role of ["bm_b1_web", "bm_b1_login", "bm_pf02a_runtime"]) {
      for (const column of ["id", "org_id", "membership_id", "property_id", "status", "created_at", "ended_at"])
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "REFERENCES"])
          expect((await h.migration.query("SELECT has_column_privilege($1,'app.property_assignment',$2,$3) AS allowed", [role, column, privilege])).rows[0].allowed).toBe(false);
      for (const privilege of ["DELETE", "TRUNCATE", "TRIGGER", "MAINTAIN"])
        expect((await h.migration.query("SELECT has_table_privilege($1,'app.property_assignment',$2) AS allowed", [role, privilege])).rows[0].allowed).toBe(false);
    }
  } finally { await runtime.end(); }
});

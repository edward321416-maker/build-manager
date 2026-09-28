import { afterAll, beforeAll, expect, it } from "vitest";
import { createB2Harness, seedB2Scope, type B2Harness } from "./helpers/b2-fixture";

let h: B2Harness;
beforeAll(async () => { h = await createB2Harness(); }, 120_000);
afterAll(async () => { await h?.close(); });
const owner = "bm_b4_assignment_owner";

it("AC16 provisions only a NOLOGIN owner with migrator SET-only membership", async () => {
  expect((await h.p.admin.query(`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit
    FROM pg_roles WHERE rolname=$1`, [owner])).rows).toEqual([{
    rolcanlogin: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    rolreplication: false, rolbypassrls: false, rolinherit: false,
  }]);
  expect((await h.p.admin.query(`SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname=$1 OR m.rolname=$1`, [owner])).rows).toEqual([{
    role: owner, member: "bm_pf02a_migrator", admin_option: false, inherit_option: false, set_option: true,
  }]);
  await expect(h.web.query("SET ROLE bm_b4_assignment_owner")).rejects.toMatchObject({ code: "42501" });
});

it("AC15-17 exposes three exact secure definers and no PUBLIC or unintended EXECUTE", async () => {
  const fns = (await h.p.admin.query(`SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,
    p.prorettype::regtype::text AS returns,r.rolname,l.lanname,p.provolatile,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) AS def,
    ARRAY(SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname::text END
      FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
      WHERE a.privilege_type='EXECUTE' ORDER BY 1) AS executors
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='authn' AND p.proname LIKE 'b4_%' ORDER BY p.proname`)).rows;
  expect(fns.map(r => r.proname)).toEqual(["b4_end_property_staff_assignment", "b4_ensure_property_staff_assignment", "b4_get_property_staff_assignment"]);
  for (const fn of fns) {
    expect(fn).toMatchObject({ returns: "text", rolname: owner, lanname: "plpgsql", prosecdef: true,
      provolatile: fn.proname === "b4_get_property_staff_assignment" ? "s" : "v",
      proconfig: ["search_path=pg_catalog, pg_temp"], executors: ["bm_b1_web", owner] });
    expect(fn.args).toBe("p_digest bytea, p_org uuid, p_property uuid, p_membership uuid");
    expect(fn.def).not.toMatch(/\bEXECUTE\b/i);
    expect(fn.def).not.toMatch(/(?<![.\w])(?:property_assignment|organization_membership|can_administer_org|can_read_property)\b/i);
    expect(fn.def).toContain("authn.can_administer_org");
    expect(fn.def).toContain("authn.can_read_property");
    expect(fn.def).toContain("app.organization_membership");
    expect(fn.def).toContain("app.property_assignment");
  }
});

it("AC15-18 pins exact raw column grants, helper grants and revoked schema CREATE", async () => {
  const columns = (await h.p.admin.query(`SELECT table_name,column_name,privilege_type,is_grantable FROM information_schema.column_privileges
    WHERE table_schema='app' AND grantee=$1 ORDER BY table_name,column_name,privilege_type`, [owner])).rows;
  const expected = [
    ...["id", "org_id", "role", "status"].map(column_name => ({ table_name: "organization_membership", column_name, privilege_type: "SELECT", is_grantable: "NO" })),
    ...["org_id", "membership_id", "property_id", "status"].flatMap(column_name => ["SELECT", "INSERT"].map(privilege_type => ({ table_name: "property_assignment", column_name, privilege_type, is_grantable: "NO" }))),
    ...["status", "ended_at"].map(column_name => ({ table_name: "property_assignment", column_name, privilege_type: "UPDATE", is_grantable: "NO" })),
  ].sort((a,b) => `${a.table_name}/${a.column_name}/${a.privilege_type}`.localeCompare(`${b.table_name}/${b.column_name}/${b.privilege_type}`));
  expect(columns).toEqual(expected);
  for (const role of ["bm_b1_web", "bm_b1_capability_owner", owner]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      expect((await h.p.admin.query("SELECT has_table_privilege($1,'app.property_assignment',$2) AS allowed", [role, privilege])).rows[0].allowed).toBe(false);
    }
  }
  for (const schema of ["app", "authn"]) {
    expect((await h.p.admin.query("SELECT has_schema_privilege($1,$2,'CREATE') AS allowed", [owner, schema])).rows[0].allowed).toBe(false);
  }
  const helperAcl = (await h.p.admin.query(`SELECT p.oid::regprocedure::text AS fn,g.rolname AS grantor,a.privilege_type,a.is_grantable
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles g ON g.oid=a.grantor
    WHERE a.grantee=$1::regrole ORDER BY fn`, [owner])).rows;
  expect(helperAcl).toEqual([
    { fn: "app.current_org_id()", grantor: "bm_pf02a_migrator", privilege_type: "EXECUTE", is_grantable: false },
    { fn: "authn.b4_end_property_staff_assignment(bytea,uuid,uuid,uuid)", grantor: owner, privilege_type: "EXECUTE", is_grantable: false },
    { fn: "authn.b4_ensure_property_staff_assignment(bytea,uuid,uuid,uuid)", grantor: owner, privilege_type: "EXECUTE", is_grantable: false },
    { fn: "authn.b4_get_property_staff_assignment(bytea,uuid,uuid,uuid)", grantor: owner, privilege_type: "EXECUTE", is_grantable: false },
    { fn: "authn.can_administer_org(bytea,uuid)", grantor: "bm_b1_capability_owner", privilege_type: "EXECUTE", is_grantable: false },
    { fn: "authn.can_read_property(bytea,uuid,uuid)", grantor: "bm_b1_capability_owner", privilege_type: "EXECUTE", is_grantable: false },
  ]);
});

it("AC18 pins role-only RLS and permits ACTIVE to ENDED but rejects ENDED insert/reactivation", async () => {
  const policies = (await h.p.admin.query("SELECT policyname,tablename,roles::text[] AS roles,cmd,permissive,qual,with_check FROM pg_policies WHERE policyname LIKE 'b4_%' ORDER BY policyname")).rows;
  expect(policies.map(p => [p.policyname,p.tablename,p.roles,p.cmd,p.permissive])).toEqual([
    ["b4_assignment_insert_ceiling", "property_assignment", [owner], "INSERT", "RESTRICTIVE"],
    ["b4_assignment_insert_scope", "property_assignment", [owner], "INSERT", "PERMISSIVE"],
    ["b4_assignment_select_scope", "property_assignment", [owner], "SELECT", "PERMISSIVE"],
    ["b4_assignment_update_ceiling", "property_assignment", [owner], "UPDATE", "RESTRICTIVE"],
    ["b4_assignment_update_scope", "property_assignment", [owner], "UPDATE", "PERMISSIVE"],
    ["b4_member_target_ceiling", "organization_membership", [owner], "SELECT", "RESTRICTIVE"],
  ]);
  expect(policies.find(p => p.policyname === "b4_assignment_select_scope").qual).toBe("(org_id = app.current_org_id())");
  const s = await seedB2Scope(h);
  async function asOwner(sql: string, args: unknown[] = [], org: string = s.orgA) {
    await h.migration.query("BEGIN");
    try {
      await h.migration.query("SELECT set_config('app.org_id',$1,true)", [org]);
      await h.migration.query("SET LOCAL ROLE bm_b4_assignment_owner");
      const result = await h.migration.query(sql,args);
      await h.migration.query("COMMIT");
      return result;
    } catch (e) { await h.migration.query("ROLLBACK"); throw e; }
  }
  expect((await asOwner("SELECT id FROM app.organization_membership ORDER BY id")).rows.map(r => r.id).sort()).toEqual([s.staffMembership,s.staffNoneMembership].sort());
  for (const sql of ["SELECT user_id FROM app.organization_membership", "SELECT id FROM app.property_assignment", "SELECT ended_at FROM app.property_assignment", "DELETE FROM app.property_assignment"]) {
    await expect(asOwner(sql)).rejects.toMatchObject({ code: "42501" });
  }
  expect((await asOwner("SELECT org_id FROM app.property_assignment", [], "")).rows).toEqual([]);
  // Frozen current_org_id rejects malformed UUID context; no rows are disclosed.
  await expect(asOwner("SELECT org_id FROM app.property_assignment", [], "invalid")).rejects.toMatchObject({ code: "22P02" });
  expect((await asOwner("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE property_id=$1", [s.propertyA])).rowCount).toBe(1);
  expect((await asOwner("UPDATE app.property_assignment SET status='ACTIVE',ended_at=NULL WHERE property_id=$1", [s.propertyA])).rowCount).toBe(0);
  await expect(asOwner("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ENDED')", [s.orgA,s.staffMembership,s.propertyB])).rejects.toMatchObject({ code: "42501" });
  await expect(asOwner("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')", [s.orgB,s.foreignMembership,s.foreignProperty])).rejects.toMatchObject({ code: "42501" });
});

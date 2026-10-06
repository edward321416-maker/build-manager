import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createB1Fixture } from "./helpers/b1-fixture";

let f: Awaited<ReturnType<typeof createB1Fixture>>;

beforeAll(async () => {
  f = await createB1Fixture();
});

afterAll(async () => {
  await f?.close();
});

describe("Vendor Secure Handoff security boundary", () => {
  it("revokes PUBLIC and pins exact schema USAGE/CREATE privileges", async () => {
    const rows = await f.p.admin.query(`
      SELECT grantee,
        has_schema_privilege(grantee,'vendor_handoff','USAGE') AS usage,
        has_schema_privilege(grantee,'vendor_handoff','CREATE') AS create_priv
      FROM (VALUES ('public'),('bm_vendor_web'),('bm_b1_web'),('bm_vendor_handoff_owner')) AS g(grantee)
      ORDER BY grantee
    `);
    expect(rows.rows).toEqual([
      { grantee: "bm_b1_web", usage: true, create_priv: false },
      { grantee: "bm_vendor_handoff_owner", usage: true, create_priv: true },
      { grantee: "bm_vendor_web", usage: true, create_priv: false },
      { grantee: "public", usage: false, create_priv: false },
    ]);
    expect((await f.p.admin.query("SELECT has_schema_privilege('bm_vendor_handoff_owner','core_flow','CREATE') AS v")).rows[0].v).toBe(false);
    expect((await f.p.admin.query("SELECT has_schema_privilege('bm_vendor_handoff_owner','app','CREATE') AS v")).rows[0].v).toBe(false);
  });

  it("applies org scope, restrictive ceilings and digest bootstrap SELECT-only policies", async () => {
    const policies = await f.p.admin.query(`
      SELECT tablename,policyname,permissive,cmd
      FROM pg_policies
      WHERE schemaname='vendor_handoff'
      ORDER BY tablename,policyname
    `);
    const byTable = new Map<string, typeof policies.rows>();
    for (const row of policies.rows) {
      const list = byTable.get(row.tablename) ?? [];
      list.push(row);
      byTable.set(row.tablename, list);
    }
    for (const table of ["vendor_assignment","work_packet_revision","work_packet_source_photo","command_receipt"]) {
      expect(byTable.get(table)?.some((p) => p.policyname === "vendor_handoff_org_scope" && p.permissive === "PERMISSIVE" && p.cmd === "ALL")).toBe(true);
      expect(byTable.get(table)?.some((p) => p.policyname === "vendor_handoff_org_ceiling" && p.permissive === "RESTRICTIVE" && p.cmd === "ALL")).toBe(true);
    }
    for (const table of ["vendor_capability","vendor_session"]) {
      const set = byTable.get(table) ?? [];
      expect(set.some((p) => /digest_bootstrap/.test(p.policyname) && p.cmd === "SELECT")).toBe(true);
      expect(set.some((p) => /bootstrap_ceiling/.test(p.policyname) && p.permissive === "RESTRICTIVE" && p.cmd === "SELECT")).toBe(true);
      expect(set.some((p) => /insert_ceiling/.test(p.policyname) && p.cmd === "INSERT")).toBe(true);
      expect(set.some((p) => /update_ceiling/.test(p.policyname) && p.cmd === "UPDATE")).toBe(true);
      expect(set.some((p) => /delete_ceiling/.test(p.policyname) && p.cmd === "DELETE")).toBe(true);
    }
  });

  it("denies direct Vendor table access and owner SET ROLE to Web runtimes", async () => {
    const tables = ["vendor_assignment","work_packet_revision","work_packet_source_photo","vendor_capability","vendor_session","command_receipt"];
    for (const role of ["bm_vendor_web","bm_b1_web"]) {
      for (const table of tables) {
        for (const privilege of ["SELECT","INSERT","UPDATE","DELETE"]) {
          const result = await f.p.admin.query("SELECT has_table_privilege($1,$2,$3) AS allowed", [role, `vendor_handoff.${table}`, privilege]);
          expect(result.rows[0].allowed, `${role} ${privilege} ${table}`).toBe(false);
        }
      }
      const membership = await f.p.admin.query(`
        SELECT m.set_option,m.inherit_option,m.admin_option
        FROM pg_auth_members m
        JOIN pg_roles r ON r.oid=m.roleid
        JOIN pg_roles u ON u.oid=m.member
        WHERE r.rolname='bm_vendor_handoff_owner' AND u.rolname=$1
      `, [role]);
      expect(membership.rows).toEqual([]);
    }
  });

  it("revokes PUBLIC function execution and exposes only bounded runtime capabilities", async () => {
    const funcs = await f.p.admin.query(`
      SELECT p.oid::regprocedure::text AS signature,p.prosecdef,p.proconfig,
             pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('bm_vendor_web',p.oid,'EXECUTE') AS vendor_web,
             has_function_privilege('bm_b1_web',p.oid,'EXECUTE') AS b1_web,
             has_function_privilege('public',p.oid,'EXECUTE') AS public_exec
      FROM pg_proc p
      WHERE p.pronamespace=to_regnamespace('vendor_handoff')
      ORDER BY p.oid::regprocedure::text
    `);
    expect(funcs.rows.length).toBeGreaterThan(0);
    expect(funcs.rows.every((row) => row.prosecdef === true && row.owner === "bm_vendor_handoff_owner" && row.public_exec === false)).toBe(true);
    expect(funcs.rows.every((row) => Array.isArray(row.proconfig) && row.proconfig.includes("search_path=pg_catalog"))).toBe(true);
    expect(funcs.rows.some((row) => row.vendor_web)).toBe(true);
    expect(funcs.rows.some((row) => row.b1_web)).toBe(true);
  });

  it("does not grant the Vendor owner broad Core/app table access", async () => {
    const rows = await f.p.admin.query(`
      SELECT n.nspname,c.relname,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'SELECT') AS sel,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'INSERT') AS ins,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'UPDATE') AS upd,
        has_table_privilege('bm_vendor_handoff_owner',c.oid,'DELETE') AS del
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('core_flow','app') AND c.relkind='r'
      ORDER BY n.nspname,c.relname
    `);
    expect(rows.rows.every((row) => !row.sel && !row.ins && !row.upd && !row.del)).toBe(true);
  });
});

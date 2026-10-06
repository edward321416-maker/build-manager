import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createB1Fixture } from "./helpers/b1-fixture";

let f: Awaited<ReturnType<typeof createB1Fixture>>;

beforeAll(async () => {
  f = await createB1Fixture();
});

afterAll(async () => {
  await f?.close();
});

describe("Vendor Secure Handoff foundation", () => {
  it("preserves migrations 0001-0018 and provisions exact isolated Vendor roles", async () => {
    const files = (await import("node:fs/promises")).readdir;
    const names = (await files(resolve("packages/persistence-postgres/migrations")))
      .filter((name) => /^00(0[1-9]|1[0-8])_/.test(name))
      .sort();
    expect(names).toHaveLength(18);
    for (const name of names) {
      const bytes = await readFile(resolve("packages/persistence-postgres/migrations", name));
      expect(createHash("sha256").update(bytes).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
    }

    const roles = await f.p.admin.query(`
      SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit
      FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname
    `, [["bm_vendor_handoff_owner", "bm_vendor_web"]]);
    expect(roles.rows).toEqual([
      { rolname: "bm_vendor_handoff_owner", rolcanlogin: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false },
      { rolname: "bm_vendor_web", rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false },
    ]);
  }, 120_000);

  it("creates exactly the six 0019 foundation tables with FORCE RLS and org ownership", async () => {
    const rows = await f.p.admin.query(`
      SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
             EXISTS (
               SELECT 1 FROM information_schema.columns x
               WHERE x.table_schema='vendor_handoff' AND x.table_name=c.relname
                 AND x.column_name='org_id' AND x.is_nullable='NO' AND x.udt_name='uuid'
             ) AS has_org
      FROM pg_class c
      WHERE c.relnamespace=to_regnamespace('vendor_handoff') AND c.relkind='r'
      ORDER BY c.relname
    `);
    expect(rows.rows).toEqual([
      "command_receipt",
      "vendor_assignment",
      "vendor_capability",
      "vendor_session",
      "work_packet_revision",
      "work_packet_source_photo",
    ].map((relname) => ({ relname, relrowsecurity: true, relforcerowsecurity: true, has_org: true })));
  });

  it("enforces one non-ended assignment and one active Vendor session per assignment", async () => {
    const indexes = await f.p.admin.query(`
      SELECT indexname,indexdef
      FROM pg_indexes
      WHERE schemaname='vendor_handoff'
      ORDER BY indexname
    `);
    const defs = indexes.rows.map((row) => String(row.indexdef));
    expect(defs.some((value) => /vendor_assignment/.test(value) && /WHERE/.test(value) && /(PREPARING|OFFERED|ACTIVE)/.test(value))).toBe(true);
    expect(defs.some((value) => /vendor_session/.test(value) && /WHERE/.test(value) && /(revoked_at IS NULL|revoked_at.*NULL)/i.test(value))).toBe(true);
  });

  it("stores capability/session digests rather than plaintext secrets", async () => {
    const columns = await f.p.admin.query(`
      SELECT table_name,column_name,data_type
      FROM information_schema.columns
      WHERE table_schema='vendor_handoff'
        AND table_name IN ('vendor_capability','vendor_session')
      ORDER BY table_name,column_name
    `);
    const names = columns.rows.map((row) => `${row.table_name}.${row.column_name}`);
    expect(names).toContain("vendor_capability.digest");
    expect(names).toContain("vendor_session.digest");
    expect(names).toContain("vendor_session.csrf_digest");
    expect(names.some((name) => /(token|secret|raw_token|session_token)$/i.test(name))).toBe(false);
  });
});

import { expect, it } from "vitest";
import { Client } from "pg";
import { createB1Fixture, provisionFoundationOnly } from "./helpers/b1-fixture";
import { startPostgres18Container, runPostgresMigrations } from "@build-manager/persistence-postgres/testing";

it("M05 missing B1 roles rejects the full chain atomically on an empty database", async () => {
  const postgres = await startPostgres18Container();
  let migration: Client | undefined;
  try {
    const config = await provisionFoundationOnly(postgres);
    migration = new Client(config);
    await migration.connect();
    await expect(runPostgresMigrations(migration)).rejects.toThrow("B1_REQUIRED_ROLES_MISSING");
    const schemas = await postgres.admin.query("SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('app', 'authn')");
    expect(schemas.rows).toEqual([]);
    expect((await postgres.admin.query("SELECT count(*)::int AS count FROM app_migrations.pgmigrations")).rows).toEqual([{ count: 0 }]);
  } finally {
    await migration?.end();
    await postgres.stop();
  }
}, 120_000);

it("B1 private tables are separate from the frozen seven app tables", async () => {
  const f = await createB1Fixture();
  try {
    const tableNames = async (schema: string) => (await f.migration.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname=$1 ORDER BY tablename", [schema])).rows.map(r => r.tablename);
    expect(await tableNames("authn")).toEqual(["external_identity", "web_session"]);
    expect(await tableNames("app")).toEqual(["app_user", "occupancy", "occupancy_member", "organization", "organization_membership", "property", "unit"]);
  } finally { await f.close(); }
}, 120_000);

for (const missing of ["bm_b1_login", "bm_b1_web", "bm_b1_capability_owner"]) {
  it(`M04 missing ${missing} rolls back all application migrations`, async () => {
    const p=await startPostgres18Container(); let migration: Client | undefined;
    try {
      const cfg=await provisionFoundationOnly(p);
      for (const name of ["bm_b1_login", "bm_b1_web", "bm_b1_capability_owner"]) {
        if(name !== missing) await p.admin.query(`CREATE ROLE ${name} ${name === "bm_b1_capability_owner" ? "NOLOGIN" : "LOGIN"} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`);
      }
      migration=new Client(cfg); await migration.connect();
      await expect(runPostgresMigrations(migration)).rejects.toThrow("B1_REQUIRED_ROLES_MISSING");
      expect((await migration.query("SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('app','authn')")).rows).toEqual([]);
      expect((await migration.query("SELECT count(*)::int AS n FROM app_migrations.pgmigrations")).rows[0].n).toBe(0);
    } finally { await migration?.end(); await p.stop(); }
  },120_000);
}
it("B1 roles have no privileged attributes, inherited capability or schema CREATE", async () => {
  const f=await createB1Fixture();
  try {
    const rows=(await f.migration.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname LIKE 'bm_b1_%'")).rows;
    expect(rows).toHaveLength(3);
    for(const r of rows) {
      expect([r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,r.rolinherit]).toEqual([false,false,false,false,false,false]);
      expect(r.rolcanlogin).toBe(r.rolname !== "bm_b1_capability_owner");
      expect((await f.migration.query("SELECT has_schema_privilege($1,'authn','CREATE') AS allowed",[r.rolname])).rows[0].allowed).toBe(false);
    }
    expect((await f.migration.query("SELECT pg_has_role(current_user,'bm_b1_capability_owner','USAGE') AS inherited")).rows[0].inherited).toBe(false);
    await expect(f.web.query("SELECT authn.begin_session(NULL,NULL,NULL,NULL)")).rejects.toMatchObject({code:"42501"});
    for(const c of [f.login,f.web]) for(const table of ["app.app_user","authn.external_identity","authn.web_session","app.organization_membership"]) await expect(c.query(`SELECT * FROM ${table}`)).rejects.toMatchObject({code:"42501"});
    const functions=(await f.migration.query("SELECT p.prosecdef,p.proconfig,r.rolname,EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0) AS public_exec FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='authn'")).rows;
    for(const fun of functions) { expect(fun.public_exec).toBe(false); expect(fun.proconfig).toEqual(["search_path=pg_catalog"]); expect(fun.rolname).toBe("bm_b1_capability_owner"); }
  } finally { await f.close(); }
},120_000);

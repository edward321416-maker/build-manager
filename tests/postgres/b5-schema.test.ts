import { Client } from "pg";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runner } from "node-pg-migrate";
import { describe, expect, it, vi } from "vitest";
import { provisionTestRoles, provisionB4TestRole, provisionB5TestRoles, runPostgresMigrations, startPostgres18Container } from "@build-manager/persistence-postgres/testing";
import { provisionB1TestRoles } from "../../packages/persistence-postgres/src/testing/b1-roles";
import { provisionFoundationOnly } from "./helpers/b1-fixture";

const owners = ["bm_b5_effective_admin_probe_owner", "bm_b5_membership_owner"];
const frozen = {
  "0001_core_identity_organization.sql":"e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "0002_property_unit_occupancy.sql":"1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "0003_runtime_isolation.sql":"649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "0004_b1_identity_sessions.sql":"2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "0005_b1_auth_capabilities.sql":"22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "0006_b1_organization_access.sql":"a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
  "0007_b2_property_assignment_scope.sql":"4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2",
  "0008_b3_building_registration.sql":"c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986",
  "0009_b4_property_assignment_mutation.sql":"021ce7b36282e3a8a1ae12a4daecb944a9400a04825c2f65646944756b537fd4",
};
it("preserves implementation-base migration bytes 0001 through 0009", async () => {
  for (const [file,sha] of Object.entries(frozen)) expect(createHash("sha256").update(
    await readFile(resolve("packages/persistence-postgres/migrations",file))).digest("hex"),file).toBe(sha);
});

for (const owner of owners) for (const upgrade of [false,true]) {
  it.each(["missing","inherit","membership-inherit","membership-admin","membership-no-set","web-membership"])(
    `B5 ${owner} ${upgrade?'upgrade':'fresh'} preflight rejects %s atomically`, async fault => {
      const p=await startPostgres18Container();
      let migration: Client | undefined;
      const quiet=vi.spyOn(console,"error").mockImplementation(()=>{});
      try {
        // Deliberately bypass the common all-role helper: these are negative controls.
        const config=await provisionFoundationOnly(p);
        await provisionB1TestRoles(p.admin,p.adminConfig,"bm_pf02a_migrator");
        await provisionB4TestRole(p.admin,"bm_pf02a_migrator");
        await provisionB5TestRoles(p.admin,"bm_pf02a_migrator");
        migration=new Client(config); await migration.connect();
        if(upgrade) await runner({dbClient:migration,dir:resolve("packages/persistence-postgres/migrations"),direction:"up",count:9,
          migrationsTable:"pgmigrations",migrationsSchema:"app_migrations",createMigrationsSchema:true,singleTransaction:true,
          checkOrder:true,advisoryLockMode:"fail",migrationLoaderStrategies:[{extensions:[".sql"],loader:"sql"}]});
        const snapshot=async()=>({
          functions:(await p.admin.query("SELECT pg_get_functiondef(p.oid) AS def,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','authn') ORDER BY p.oid::regprocedure::text")).rows,
          policies:(await p.admin.query("SELECT * FROM pg_policies WHERE schemaname='app' ORDER BY tablename,policyname")).rows,
        });
        const before=await snapshot();
        if(fault==='missing') await p.admin.query(`ALTER ROLE ${owner} RENAME TO b5_missing_test_role`);
        if(fault==='inherit') await p.admin.query(`ALTER ROLE ${owner} INHERIT`);
        if(fault==='membership-inherit') await p.admin.query(`GRANT ${owner} TO bm_pf02a_migrator WITH INHERIT TRUE`);
        if(fault==='membership-admin') await p.admin.query(`GRANT ${owner} TO bm_pf02a_migrator WITH ADMIN TRUE`);
        if(fault==='membership-no-set') await p.admin.query(`GRANT ${owner} TO bm_pf02a_migrator WITH SET FALSE`);
        if(fault==='web-membership') await p.admin.query(`GRANT ${owner} TO bm_b1_web WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
        await expect(runPostgresMigrations(migration)).rejects.toThrow(!upgrade && fault==='web-membership'?'B1_ROLE_CONTRACT_INVALID':/B5_.*CONTRACT_INVALID/);
        expect(await snapshot()).toEqual(before);
        if(upgrade) expect((await p.admin.query("SELECT name FROM app_migrations.pgmigrations ORDER BY id")).rowCount).toBe(9);
      } finally {quiet.mockRestore(); await migration?.end(); await p.stop();}
    },120_000);
}

describe("B5 common bootstrap", () => {
  it("provisions both exact B5 owners before migration through the existing bootstrap", async () => {
    const p = await startPostgres18Container();
    let migration: Client | undefined;
    try {
      const roles = await provisionTestRoles(p.admin, p.adminConfig, p.database);
      expect(Object.keys(roles).sort()).toEqual(["b1", "migrationConfig", "runtimeConfig"]);
      const catalog = await p.admin.query(`SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,
        rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=ANY($1) ORDER BY rolname`, [owners]);
      expect(catalog.rows).toEqual(owners.map(rolname => ({ rolname, rolcanlogin: false, rolsuper: false,
        rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false })));
      const memberships = await p.admin.query(`SELECT r.rolname, u.rolname AS member,
        m.inherit_option,m.set_option,m.admin_option FROM pg_auth_members m
        JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member
        WHERE r.rolname=ANY($1) OR u.rolname=ANY($1) ORDER BY r.rolname`, [owners]);
      expect(memberships.rows).toEqual(owners.map(rolname => ({ rolname, member: "bm_pf02a_migrator",
        inherit_option: false, set_option: true, admin_option: false })));
      migration = new Client(roles.migrationConfig);
      await migration.connect();
      await runPostgresMigrations(migration);
      expect((await p.admin.query("SELECT name FROM app_migrations.pgmigrations ORDER BY id")).rows.map(r => r.name))
        .toContain("0010_b5_membership_termination");
    } finally {
      await migration?.end();
      await p.stop();
    }
  }, 120_000);
});

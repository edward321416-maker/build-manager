import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { runner } from "node-pg-migrate";
import { describe, expect, it, vi } from "vitest";
import { provisionTestRoles, startPostgres18Container } from "@build-manager/persistence-postgres/testing";

const dir = resolve("packages/persistence-postgres/migrations");
const frozen = {
  "0001_core_identity_organization.sql": "e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "0002_property_unit_occupancy.sql": "1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "0003_runtime_isolation.sql": "649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "0004_b1_identity_sessions.sql": "2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "0005_b1_auth_capabilities.sql": "22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "0006_b1_organization_access.sql": "a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
  "0007_b2_property_assignment_scope.sql": "4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2",
  "0008_b3_building_registration.sql": "c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986",
};
async function migrate(client: Client, count?: number) {
  await runner({ dbClient: client, dir, direction: "up", count,
    migrationsTable: "pgmigrations", migrationsSchema: "app_migrations", createMigrationsSchema: true,
    singleTransaction: true, checkOrder: true, advisoryLockMode: "fail",
    migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
  });
}
async function snapshot(c: Client) {
  return {
    functions: (await c.query("SELECT pg_get_functiondef(p.oid) AS def,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','authn') ORDER BY p.oid::regprocedure::text")).rows,
    policies: (await c.query("SELECT * FROM pg_policies WHERE schemaname='app' ORDER BY tablename,policyname")).rows,
    history: (await c.query("SELECT row_to_json(a)::text AS bytes FROM app.property_assignment a ORDER BY id")).rows,
    migrations: (await c.query("SELECT name FROM app_migrations.pgmigrations ORDER BY id")).rows,
  };
}

describe("B4 additive migration atomicity", () => {
  it("preserves all eight frozen migration bytes", async () => {
    for (const [name, hash] of Object.entries(frozen)) {
      expect(createHash("sha256").update(await readFile(resolve(dir, name))).digest("hex"), name).toBe(hash);
    }
  });
  for (const upgrade of [false, true]) {
    it.each(["missing", "inherit", "web-membership"])(`${upgrade ? "upgrade" : "fresh"} fails closed on %s role contract without partial objects`, async (fault) => {
      const p = await startPostgres18Container();
      let client: Client | undefined;
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const roles = await provisionTestRoles(p.admin, p.adminConfig, p.database);
        expect(Object.keys(roles).sort()).toEqual(["b1", "migrationConfig", "runtimeConfig"]);
        expect((await p.admin.query("SELECT rolname FROM pg_roles WHERE rolname='bm_b4_assignment_owner'")).rowCount).toBe(1);
        client = new Client(roles.migrationConfig);
        await client.connect();
        let before: Awaited<ReturnType<typeof snapshot>> | undefined;
        if (upgrade) {
          await migrate(client, 8);
          const org = randomUUID(), user = randomUUID(), member = randomUUID(), property = randomUUID();
          await p.admin.query("INSERT INTO app.app_user(id,status) VALUES($1,'ACTIVE')", [user]);
          await p.admin.query("INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','Synthetic')", [org]);
          await p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')", [member, org, user]);
          await p.admin.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')", [property, org]);
          await p.admin.query("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status,ended_at) VALUES($1,$2,$3,'ENDED',clock_timestamp())", [org, member, property]);
          before = await snapshot(p.admin);
          expect(before.history).toHaveLength(1);
          expect(before.migrations).toHaveLength(8);
        }
        if (fault === "missing") await p.admin.query("ALTER ROLE bm_b4_assignment_owner RENAME TO b4_missing_test_role");
        if (fault === "inherit") await p.admin.query("ALTER ROLE bm_b4_assignment_owner INHERIT");
        if (fault === "web-membership") await p.admin.query("GRANT bm_b4_assignment_owner TO bm_b1_web WITH INHERIT FALSE, SET TRUE, ADMIN FALSE");
        // The frozen B1 preflight detects hostile Web membership first on a fresh chain.
        await expect(migrate(client)).rejects.toThrow(!upgrade && fault === "web-membership" ? "B1_ROLE_CONTRACT_INVALID" : /B4_.*CONTRACT/);
        expect((await p.admin.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='authn' AND p.proname LIKE 'b4_%'")).rows).toEqual([]);
        expect((await p.admin.query("SELECT policyname FROM pg_policies WHERE policyname LIKE 'b4_%'")).rows).toEqual([]);
        if (before) expect(await snapshot(p.admin)).toEqual(before);
        else expect((await p.admin.query("SELECT tablename FROM pg_tables WHERE schemaname IN ('app','authn')")).rows).toEqual([]);
      } finally { quiet.mockRestore(); await client?.end(); await p.stop(); }
    }, 120_000);
  }
});

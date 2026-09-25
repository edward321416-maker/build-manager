import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  provisionTestRoles,
  startPostgres18Container,
} from "@build-manager/persistence-postgres/testing";
import { createB2Harness, type B2Harness } from "./helpers/b2-fixture";

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/persistence-postgres/migrations");
const b3Migration = "0008_b3_building_registration.sql";
const frozenMigrations = {
  "0001_core_identity_organization.sql": "e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "0002_property_unit_occupancy.sql": "1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "0003_runtime_isolation.sql": "649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "0004_b1_identity_sessions.sql": "2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "0005_b1_auth_capabilities.sql": "22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "0006_b1_organization_access.sql": "a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
  "0007_b2_property_assignment_scope.sql": "4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2",
} as const;
const appTables = [
  "app_user", "occupancy", "occupancy_member", "organization",
  "organization_membership", "property", "property_assignment", "unit",
];

async function migrateCopy(client: Client, dir: string) {
  await runner({
    dbClient: client,
    dir,
    direction: "up",
    migrationsTable: "pgmigrations",
    migrationsSchema: "app_migrations",
    createMigrationsSchema: true,
    singleTransaction: true,
    checkOrder: true,
    advisoryLockMode: "fail",
    migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
  });
}

async function tableNames(client: Client) {
  return (await client.query(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='app' ORDER BY tablename",
  )).rows.map(row => row.tablename);
}

async function b3Snapshot(client: Client) {
  const policies = await client.query(`
    SELECT c.relname,p.polname,p.polcmd,p.polpermissive,
      ARRAY(SELECT COALESCE(r.rolname,'PUBLIC') FROM unnest(p.polroles) role_oid
        LEFT JOIN pg_roles r ON r.oid=role_oid ORDER BY 1) AS roles,
      pg_get_expr(p.polqual,p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr
    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app' AND p.polname LIKE 'b3_%'
    ORDER BY p.polname`);
  const capability = await client.query(`
    SELECT owner.rolname AS owner,p.provolatile,p.prosecdef,p.proconfig,
      has_function_privilege('bm_b1_capability_owner',p.oid,'EXECUTE') AS owner_execute,
      has_function_privilege('bm_b1_web',p.oid,'EXECUTE') AS web_execute,
      has_function_privilege('bm_b1_login',p.oid,'EXECUTE') AS login_execute,
      has_function_privilege('bm_pf02a_runtime',p.oid,'EXECUTE') AS runtime_execute
    FROM pg_proc p JOIN pg_roles owner ON owner.oid=p.proowner
    WHERE p.oid=to_regprocedure('authn.can_administer_org(bytea,uuid)')`);
  const grants = await client.query(`
    SELECT table_name,column_name,privilege_type,is_grantable
    FROM information_schema.column_privileges
    WHERE table_schema='app' AND grantee='bm_b1_web'
      AND table_name IN ('property','unit')
    ORDER BY table_name,column_name,privilege_type`);
  const rls = await client.query(`
    SELECT relname,relrowsecurity,relforcerowsecurity
    FROM pg_class WHERE oid IN ('app.property'::regclass,'app.unit'::regclass)
    ORDER BY relname`);
  const memberships = await client.query(`
    SELECT granted.rolname AS granted,member.rolname AS member,
      am.admin_option,am.inherit_option,am.set_option
    FROM pg_auth_members am
    JOIN pg_roles granted ON granted.oid=am.roleid
    JOIN pg_roles member ON member.oid=am.member
    WHERE granted.rolname LIKE 'bm_%' OR member.rolname LIKE 'bm_%'
    ORDER BY granted.rolname,member.rolname`);
  const migrations = await client.query(
    "SELECT name FROM app_migrations.pgmigrations ORDER BY id",
  );
  const schemaCreate = await client.query(
    "SELECT has_schema_privilege('bm_b1_capability_owner','authn','CREATE') AS allowed",
  );
  return {
    tables: await tableNames(client),
    policies: policies.rows,
    capability: capability.rows,
    grants: grants.rows,
    rls: rls.rows,
    memberships: memberships.rows,
    migrations: migrations.rows,
    schemaCreate: schemaCreate.rows,
  };
}

async function expectedFailure(operation: Promise<unknown>, marker: string) {
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await expect(operation).rejects.toThrow(marker);
  } finally {
    errors.mockRestore();
  }
}

describe("B3 migration schema", { concurrent: false }, () => {
  let h: B2Harness;
  beforeAll(async () => { h = await createB2Harness(); }, 120_000);
  afterAll(async () => { await h?.close(); });

  it("AC17 M02 rejects a privileged executor before B3 grants", async () => {
    const sql = await readFile(join(migrationsDir, b3Migration), "utf8");
    const boundary = "GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;";
    expect(sql.split(boundary)).toHaveLength(2);
    const preflight = sql.slice(0, sql.indexOf(boundary));
    const before = await b3Snapshot(h.migration);

    const attributes = "SELECT rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user";
    expect((await h.migration.query(attributes)).rows).toEqual([
      { rolsuper: false, rolbypassrls: false },
    ]);
    // The valid executing owner must pass the actual, unchanged preflight.
    await h.migration.query(preflight);
    expect((await h.p.admin.query(attributes)).rows[0]?.rolsuper).toBe(true);
    // Exercise PostgreSQL's real effective user, without changing any role.
    await expect(h.p.admin.query(preflight)).rejects.toThrow("B3_MIGRATION_OWNER_CONTRACT_INVALID");
    expect(await b3Snapshot(h.migration)).toEqual(before);

    // Pin both forbidden attributes and their placement before every grant.
    // The runtime control above covers a real privileged session; this source
    // assertion also detects losing the independent BYPASSRLS check.
    expect(preflight.replace(/\s+/g, " ")).toContain(
      "BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_catalog.pg_roles " +
      "WHERE rolname=current_user AND NOT rolsuper AND NOT rolbypassrls " +
      ") THEN RAISE EXCEPTION 'B3_MIGRATION_OWNER_CONTRACT_INVALID'; END IF;",
    );
  });

  it("AC17 preserves frozen 0001-0007 hashes and fresh/upgrade catalogs", async () => {
    for (const [name, sha] of Object.entries(frozenMigrations)) {
      const bytes = await readFile(join(migrationsDir, name));
      expect(createHash("sha256").update(bytes).digest("hex"), name).toBe(sha);
    }
    expect(await tableNames(h.migration)).toEqual(appTables);

    const root = await realpath(tmpdir());
    const ownedDirs: string[] = [];
    const clients: Client[] = [];
    const makeDir = async () => {
      const dir = await mkdtemp(join(root, "b3-migrations-"));
      ownedDirs.push(dir);
      for (const [name, sha] of Object.entries(frozenMigrations)) {
        await copyFile(join(migrationsDir, name), join(dir, name));
        expect(createHash("sha256").update(await readFile(join(dir, name))).digest("hex"), name).toBe(sha);
      }
      return dir;
    };
    const makeDatabase = async () => {
      const database = "b3_atomic_" + randomUUID().replaceAll("-", "");
      const role = h.roles.migrationConfig.user;
      if (!role || !/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("Unexpected disposable role identifier");
      await h.p.admin.query('CREATE DATABASE "' + database + '"');
      await h.p.admin.query('GRANT CREATE ON DATABASE "' + database + '" TO "' + role + '"');
      const client = new Client({ ...h.roles.migrationConfig, database });
      clients.push(client);
      await client.connect();
      return client;
    };

    try {
      const exactB3 = await readFile(join(migrationsDir, b3Migration));

      const freshDir = await makeDir();
      await writeFile(join(freshDir, b3Migration), exactB3);
      const fresh = await makeDatabase();
      await migrateCopy(fresh, freshDir);
      const freshSnapshot = await b3Snapshot(fresh);
      expect(freshSnapshot.tables).toEqual(appTables);
      expect(freshSnapshot.migrations.map(row => row.name)).toEqual(
        [...Object.keys(frozenMigrations), b3Migration].map(name => name.replace(/\.sql$/, "")),
      );
      expect(freshSnapshot.capability).toHaveLength(1);
      expect(freshSnapshot.policies.map(row => row.polname)).toEqual([
        "b3_property_insert_ceiling", "b3_unit_insert_ceiling", "b3_unit_read_ceiling",
      ]);
      expect(freshSnapshot.schemaCreate).toEqual([{ allowed: false }]);

      const upgradeDir = await makeDir();
      const upgrade = await makeDatabase();
      await migrateCopy(upgrade, upgradeDir);
      expect((await upgrade.query(
        "SELECT name FROM app_migrations.pgmigrations ORDER BY id",
      )).rows).toHaveLength(7);
      expect((await upgrade.query(
        "SELECT to_regprocedure('authn.can_administer_org(bytea,uuid)') IS NULL AS absent",
      )).rows).toEqual([{ absent: true }]);
      await writeFile(join(upgradeDir, b3Migration), exactB3);
      await migrateCopy(upgrade, upgradeDir);
      expect(await b3Snapshot(upgrade)).toEqual(freshSnapshot);
    } finally {
      await Promise.all(clients.map(client => client.end()));
      for (const dir of ownedDirs) {
        const actual = await realpath(dir);
        const child = relative(root, actual);
        if (!child || child.startsWith("..") || isAbsolute(child) || !child.startsWith("b3-migrations-")) {
          throw new Error("Refusing to remove a path outside owned temporary migrations");
        }
        await rm(actual, { recursive: true, force: false });
      }
    }
  }, 120_000);

  it("AC17 rolls back injected 0008 failures on upgrade and fresh chains", async () => {
    const root = await realpath(tmpdir());
    const ownedDirs: string[] = [];
    const clients: Client[] = [];
    const makeDir = async () => {
      const dir = await mkdtemp(join(root, "b3-failure-"));
      ownedDirs.push(dir);
      for (const name of Object.keys(frozenMigrations)) {
        await copyFile(join(migrationsDir, name), join(dir, name));
      }
      return dir;
    };
    const makeDatabase = async () => {
      const database = "b3_failure_" + randomUUID().replaceAll("-", "");
      const role = h.roles.migrationConfig.user;
      if (!role || !/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("Unexpected disposable role identifier");
      await h.p.admin.query('CREATE DATABASE "' + database + '"');
      await h.p.admin.query('GRANT CREATE ON DATABASE "' + database + '" TO "' + role + '"');
      const client = new Client({ ...h.roles.migrationConfig, database });
      clients.push(client);
      await client.connect();
      return client;
    };

    try {
      const exactB3 = await readFile(join(migrationsDir, b3Migration), "utf8");
      const marker = "REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;";
      expect(exactB3.includes(marker)).toBe(true);
      const failingB3 = exactB3.replace(
        marker,
        "DO $b3_test_abort$ BEGIN RAISE EXCEPTION 'SYNTHETIC_B3_ABORT'; END $b3_test_abort$;\n" + marker,
      );

      const upgradeDir = await makeDir();
      const upgrade = await makeDatabase();
      await migrateCopy(upgrade, upgradeDir);
      const before = await b3Snapshot(upgrade);
      expect(before.migrations).toHaveLength(7);
      await writeFile(join(upgradeDir, b3Migration), failingB3);
      await expectedFailure(migrateCopy(upgrade, upgradeDir), "SYNTHETIC_B3_ABORT");
      expect(await b3Snapshot(upgrade)).toEqual(before);
      expect((await upgrade.query(
        "SELECT to_regprocedure('authn.can_administer_org(bytea,uuid)') IS NULL AS absent",
      )).rows).toEqual([{ absent: true }]);
      expect((await upgrade.query(
        "SELECT has_schema_privilege('bm_b1_capability_owner','authn','CREATE') AS allowed",
      )).rows).toEqual([{ allowed: false }]);

      const freshDir = await makeDir();
      await writeFile(join(freshDir, b3Migration), failingB3);
      const fresh = await makeDatabase();
      await expectedFailure(migrateCopy(fresh, freshDir), "SYNTHETIC_B3_ABORT");
      expect((await fresh.query(
        "SELECT nspname FROM pg_namespace WHERE nspname IN ('app','authn') ORDER BY nspname",
      )).rows).toEqual([]);
      const metadata = await fresh.query(
        "SELECT to_regclass('app_migrations.pgmigrations') IS NOT NULL AS present",
      );
      if (metadata.rows[0].present) {
        expect((await fresh.query(
          "SELECT count(*)::int AS n FROM app_migrations.pgmigrations",
        )).rows).toEqual([{ n: 0 }]);
      }
    } finally {
      await Promise.all(clients.map(client => client.end()));
      for (const dir of ownedDirs) {
        const actual = await realpath(dir);
        const child = relative(root, actual);
        if (!child || child.startsWith("..") || isAbsolute(child) || !child.startsWith("b3-failure-")) {
          throw new Error("Refusing to remove a path outside owned temporary migrations");
        }
        await rm(actual, { recursive: true, force: false });
      }
    }
  }, 120_000);

  it("AC17 missing and invalid B1 roles fail closed without repair", async () => {
    const p = await startPostgres18Container();
    const ownedDirs: string[] = [];
    const root = await realpath(tmpdir());
    const clients: Client[] = [];
    try {
      const roles = await provisionTestRoles(p.admin, p.adminConfig, p.database);
      const exactB3 = await readFile(join(migrationsDir, b3Migration));

      const makeDir = async () => {
        const dir = await mkdtemp(join(root, "b3-role-preflight-"));
        ownedDirs.push(dir);
        for (const name of Object.keys(frozenMigrations)) {
          await copyFile(join(migrationsDir, name), join(dir, name));
        }
        return dir;
      };
      const makeDatabase = async () => {
        const database = "b3_role_" + randomUUID().replaceAll("-", "");
        const role = roles.migrationConfig.user;
        if (!role || !/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("Unexpected disposable role identifier");
        await p.admin.query('CREATE DATABASE "' + database + '"');
        await p.admin.query('GRANT CREATE ON DATABASE "' + database + '" TO "' + role + '"');
        const client = new Client({ ...roles.migrationConfig, database });
        clients.push(client);
        await client.connect();
        return client;
      };

      const missingDir = await makeDir();
      const missing = await makeDatabase();
      await migrateCopy(missing, missingDir);
      await p.admin.query("ALTER ROLE bm_b1_web RENAME TO bm_b1_web_missing");
      try {
        await writeFile(join(missingDir, b3Migration), exactB3);
        await expectedFailure(migrateCopy(missing, missingDir), "B3_REQUIRED_ROLES_MISSING");
        expect((await p.admin.query(
          "SELECT rolname FROM pg_roles WHERE rolname IN ('bm_b1_web','bm_b1_web_missing') ORDER BY rolname",
        )).rows).toEqual([{ rolname: "bm_b1_web_missing" }]);
        expect((await missing.query(
          "SELECT to_regprocedure('authn.can_administer_org(bytea,uuid)') IS NULL AS absent",
        )).rows).toEqual([{ absent: true }]);
      } finally {
        await p.admin.query("ALTER ROLE bm_b1_web_missing RENAME TO bm_b1_web");
      }

      const invalidDir = await makeDir();
      const invalid = await makeDatabase();
      await migrateCopy(invalid, invalidDir);
      await p.admin.query("ALTER ROLE bm_b1_web INHERIT");
      try {
        await writeFile(join(invalidDir, b3Migration), exactB3);
        await expectedFailure(migrateCopy(invalid, invalidDir), "B3_ROLE_CONTRACT_INVALID");
        expect((await p.admin.query(
          "SELECT rolinherit FROM pg_roles WHERE rolname='bm_b1_web'",
        )).rows).toEqual([{ rolinherit: true }]);
        expect((await invalid.query(
          "SELECT to_regprocedure('authn.can_administer_org(bytea,uuid)') IS NULL AS absent",
        )).rows).toEqual([{ absent: true }]);
      } finally {
        await p.admin.query("ALTER ROLE bm_b1_web NOINHERIT");
      }
    } finally {
      await Promise.all(clients.map(client => client.end()));
      for (const dir of ownedDirs) {
        const actual = await realpath(dir);
        const child = relative(root, actual);
        if (!child || child.startsWith("..") || isAbsolute(child) || !child.startsWith("b3-role-preflight-")) {
          throw new Error("Refusing to remove a path outside owned temporary migrations");
        }
        await rm(actual, { recursive: true, force: false });
      }
      await p.stop();
    }
  }, 120_000);
});

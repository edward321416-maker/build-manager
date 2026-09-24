import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { barrier, changeOrg, createB2Harness, seedB2Scope, type B2Harness } from "./helpers/b2-fixture";

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages/persistence-postgres/migrations");
const b2Migration = "0007_b2_property_assignment_scope.sql";
const frozenMigrations = {
  "0001_core_identity_organization.sql": "e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "0002_property_unit_occupancy.sql": "1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "0003_runtime_isolation.sql": "649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "0004_b1_identity_sessions.sql": "2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "0005_b1_auth_capabilities.sql": "22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "0006_b1_organization_access.sql": "a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
} as const;
const appTables = ["app_user", "occupancy", "occupancy_member", "organization",
  "organization_membership", "property", "property_assignment", "unit"];
const scopedTables = ["organization", "organization_membership", "property", "unit", "occupancy", "occupancy_member"];
const insertActive = "INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')";

async function bindOrg(client: Client, orgId: string) {
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.org_id',$1,true)", [orgId]);
}

/** Return only SQLSTATE/constraint; expected failures never print database parameters. */
async function rejection(operation: Promise<unknown>) {
  try { await operation; return null; }
  catch (error) {
    const e = error as { code?: string; constraint?: string };
    return { code: e.code, constraint: e.constraint };
  }
}

/** A control changes only the named enforcement, and restores it with ROLLBACK. */
async function withoutEnforcement(client: Client, orgId: string, ddl: string, operation: () => Promise<void>) {
  await bindOrg(client, orgId);
  try {
    await client.query(ddl);
    await operation();
  } finally { await client.query("ROLLBACK"); }
}

async function tableNames(client: Client) {
  return (await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='app' ORDER BY tablename"))
    .rows.map(row => row.tablename);
}

/** This mirrors the production test runner options; only dir is substituted. */
async function migrateCopy(client: Client, dir: string) {
  await runner({
    dbClient: client, dir, direction: "up", migrationsTable: "pgmigrations",
    migrationsSchema: "app_migrations", createMigrationsSchema: true,
    singleTransaction: true, checkOrder: true, advisoryLockMode: "fail",
    migrationLoaderStrategies: [{ extensions: [".sql"], loader: "sql" }],
  });
}

async function catalogSnapshot(client: Client) {
  const queries = {
    schemas: "SELECT nspname,nspowner,nspacl FROM pg_namespace WHERE nspname IN ('app','authn','app_migrations') ORDER BY nspname",
    relations: "SELECT n.nspname,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','authn') ORDER BY n.nspname,c.relname",
    columns: "SELECT n.nspname,c.relname,a.attname,a.atttypid,a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid) AS default_expr FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN ('app','authn') AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname,c.relname,a.attnum",
    constraints: "SELECT n.nspname,c.relname,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','authn') ORDER BY n.nspname,c.relname,k.conname",
    indexes: "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('app','authn') ORDER BY schemaname,tablename,indexname",
    policies: "SELECT n.nspname,c.relname,p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid) AS using_expr,pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','authn') ORDER BY n.nspname,c.relname,p.polname",
    functions: "SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.proowner,p.proacl,p.proconfig,p.prosecdef,p.provolatile,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','authn') ORDER BY n.nspname,p.proname,arguments",
    defaultGrants: "SELECT d.defaclrole,n.nspname,d.defaclobjtype,d.defaclacl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname IN ('app','authn') OR d.defaclnamespace=0 ORDER BY d.defaclrole,n.nspname,d.defaclobjtype",
    migrations: "SELECT id,name,run_on FROM app_migrations.pgmigrations ORDER BY id",
  };
  const snapshot: Record<string, unknown[]> = {};
  for (const [key, sql] of Object.entries(queries)) snapshot[key] = (await client.query(sql)).rows;
  return snapshot;
}

describe("B2 assignment schema", { concurrent: false }, () => {
  let h: B2Harness;
  beforeAll(async () => { h = await createB2Harness(); }, 120_000);
  afterAll(async () => { await h?.close(); });

  it("AC15 exactEightAndFrozenPrivileges", async () => {
    expect(await tableNames(h.migration)).toEqual(appTables);
    for (const [name, sha] of Object.entries(frozenMigrations)) {
      expect(createHash("sha256").update(await readFile(join(migrationsDir, name))).digest("hex"), name).toBe(sha);
    }
    const runtime = new Client(h.roles.runtimeConfig);
    await runtime.connect();
    try {
      const privileges = await runtime.query(
        "SELECT c.relname,has_table_privilege(current_user,c.oid,'SELECT') AS can_select," +
        "has_table_privilege(current_user,c.oid,'INSERT') AS can_insert," +
        "has_table_privilege(current_user,c.oid,'UPDATE') AS can_update," +
        "has_table_privilege(current_user,c.oid,'DELETE') AS can_delete," +
        "has_table_privilege(current_user,c.oid,'TRUNCATE') AS can_truncate," +
        "has_table_privilege(current_user,c.oid,'REFERENCES') AS can_reference," +
        "has_table_privilege(current_user,c.oid,'TRIGGER') AS can_trigger," +
        "has_table_privilege(current_user,c.oid,'MAINTAIN') AS can_maintain " +
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' ORDER BY c.relname",
      );
      expect(privileges.rows).toEqual(appTables.map(relname => ({
        relname, can_select: scopedTables.includes(relname),
        can_insert: ["property", "unit", "occupancy", "occupancy_member"].includes(relname),
        can_update: ["property", "unit", "occupancy", "occupancy_member"].includes(relname),
        can_delete: false, can_truncate: false, can_reference: false, can_trigger: false, can_maintain: false,
      })));
      expect(await rejection(runtime.query("SELECT * FROM app.property_assignment"))).toMatchObject({ code: "42501" });
    } finally { await runtime.end(); }
    for (const client of [h.web, h.login]) {
      expect(await rejection(client.query("SELECT * FROM app.property_assignment"))).toMatchObject({ code: "42501" });
    }
  });

  it("AC15 assignmentOwnerPolicyUsesRelationOwnerOid", async () => {
    const result = await h.migration.query(
      "SELECT c.relrowsecurity,c.relforcerowsecurity,c.relowner,p.polcmd,p.polpermissive," +
      "cardinality(p.polroles) AS role_count,p.polroles[1]=c.relowner AS targets_owner," +
      "0::oid=ANY(p.polroles) AS targets_public,pg_get_expr(p.polqual,p.polrelid) AS using_expr," +
      "pg_get_expr(p.polwithcheck,p.polrelid) AS check_expr,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls " +
      "FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner JOIN pg_policy p ON p.polrelid=c.oid " +
      "WHERE c.oid='app.property_assignment'::regclass AND p.polname='b2_assignment_owner_scope'",
    );
    expect(result.rows).toHaveLength(1);
    const { relowner, ...policy } = result.rows[0];
    expect(policy).toEqual({
      relrowsecurity: true, relforcerowsecurity: true, polcmd: "*", polpermissive: true,
      role_count: 1, targets_owner: true, targets_public: false,
      using_expr: "(org_id = app.current_org_id())", check_expr: "(org_id = app.current_org_id())",
      rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false,
    });
    const otherRoles = await h.migration.query(
      "SELECT oid FROM pg_roles WHERE rolname=ANY($1::text[])",
      [["bm_b1_capability_owner", "bm_b1_web", "bm_b1_login", h.roles.runtimeConfig.user]],
    );
    expect(otherRoles.rows).toHaveLength(4);
    expect(otherRoles.rows.some(row => row.oid === relowner)).toBe(false);
    const forced = await h.migration.query(
      "SELECT relname,relrowsecurity,relforcerowsecurity,relowner=$2::oid AS original_owner FROM pg_class " +
      "WHERE relnamespace='app'::regnamespace AND relname=ANY($1::text[]) ORDER BY relname",
      [scopedTables, relowner],
    );
    expect(forced.rows).toEqual([...scopedTables].sort().map(relname => ({
      relname, relrowsecurity: true, relforcerowsecurity: true, original_owner: true,
    })));
  });

  for (const kind of ["membership", "property"] as const) {
    it("AC09 " + kind + "CompositeFk", async () => {
      const s = await seedB2Scope(h);
      for (const [orgId, membershipId, propertyId] of [
        [s.orgA, s.staffMembership, s.propertyA], [s.orgB, s.foreignMembership, s.foreignProperty],
      ]) {
        await bindOrg(h.migration, orgId);
        try {
          const parents = await h.migration.query(
            "SELECT EXISTS(SELECT 1 FROM app.organization_membership WHERE org_id=$1 AND id=$2) AS membership_exists," +
            "EXISTS(SELECT 1 FROM app.property WHERE org_id=$1 AND id=$3) AS property_exists",
            [orgId, membershipId, propertyId],
          );
          expect(parents.rows).toEqual([{ membership_exists: true, property_exists: true }]);
        } finally { await h.migration.query("ROLLBACK"); }
      }
      const constraint = "property_assignment_" + kind + "_fk";
      const args = [s.orgA, kind === "membership" ? s.foreignMembership : s.staffMembership,
        kind === "property" ? s.foreignProperty : s.propertyA];
      await withoutEnforcement(h.migration, s.orgA,
        "ALTER TABLE app.property_assignment DROP CONSTRAINT " + constraint, async () => {
          expect((await h.migration.query(insertActive, args)).rowCount).toBe(1);
        });
      expect(await rejection(changeOrg(h.migration, s.orgA, insertActive, args)))
        .toEqual({ code: "23503", constraint });
      expect((await h.migration.query(
        "SELECT convalidated FROM pg_constraint WHERE conrelid='app.property_assignment'::regclass AND conname=$1", [constraint],
      )).rows).toEqual([{ convalidated: true }]);
    });
  }

  it("AC10 assignmentStateHistory", async () => {
    const s = await seedB2Scope(h);
    const sql = "INSERT INTO app.property_assignment(org_id,membership_id,property_id,status,created_at,ended_at) VALUES($1,$2,$3,$4,$5,$6)";
    const start = "2026-01-02T00:00:00Z";
    const cases = [
      { status: "UNKNOWN", ended: null, constraint: "property_assignment_status_check" },
      { status: "ACTIVE", ended: start, constraint: "property_assignment_status_time_check" },
      { status: "ENDED", ended: null, constraint: "property_assignment_status_time_check" },
      { status: "ENDED", ended: "2026-01-01T00:00:00Z", constraint: "property_assignment_status_time_check" },
    ];
    for (const c of cases) {
      const args = [s.orgA, s.staffNoneMembership, s.propertyB, c.status, start, c.ended];
      await withoutEnforcement(h.migration, s.orgA,
        "ALTER TABLE app.property_assignment DROP CONSTRAINT " + c.constraint, async () => {
          if (c.status === "UNKNOWN") {
            // The time CHECK independently implies the status domain. Removing only the
            // domain CHECK changes the named failure, rather than permitting an invalid row.
            expect(await rejection(h.migration.query(sql, args)))
              .toEqual({ code: "23514", constraint: "property_assignment_status_time_check" });
          } else {
            expect((await h.migration.query(sql, args)).rowCount).toBe(1);
          }
        });
      expect(await rejection(changeOrg(h.migration, s.orgA, sql, args))).toEqual({ code: "23514", constraint: c.constraint });
    }

    await bindOrg(h.migration, s.orgA);
    try {
      const ended = (await h.migration.query(
        sql + " RETURNING id,status,created_at,ended_at",
        [s.orgA, s.staffNoneMembership, s.propertyB, "ENDED", start, start],
      )).rows[0];
      const active = (await h.migration.query(insertActive + " RETURNING id,created_at,ended_at,transaction_timestamp() AS tx_time",
        [s.orgA, s.staffNoneMembership, s.propertyB])).rows[0];
      // Assert booleans so generated fixture identifiers never appear in assertion diffs.
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(active.id)).toBe(true);
      expect(active.id !== ended.id).toBe(true);
      expect(active.created_at).toEqual(active.tx_time);
      expect(active.ended_at).toBeNull();
      const unchanged = (await h.migration.query(
        "SELECT id,status,created_at,ended_at FROM app.property_assignment WHERE id=$1", [ended.id],
      )).rows[0];
      expect(JSON.stringify(unchanged) === JSON.stringify(ended)).toBe(true);
      expect((await h.migration.query(
        "SELECT status,count(*)::int AS n FROM app.property_assignment WHERE org_id=$1 AND membership_id=$2 AND property_id=$3 GROUP BY status ORDER BY status",
        [s.orgA, s.staffNoneMembership, s.propertyB],
      )).rows).toEqual([{ status: "ACTIVE", n: 1 }, { status: "ENDED", n: 1 }]);
      await h.migration.query("COMMIT");
    } finally { await h.migration.query("ROLLBACK"); }

    const columns = await h.migration.query(
      "SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns " +
      "WHERE table_schema='app' AND table_name='property_assignment' ORDER BY ordinal_position",
    );
    expect(columns.rows).toEqual([
      { column_name: "id", data_type: "uuid", is_nullable: "NO", column_default: "uuidv7()" },
      { column_name: "org_id", data_type: "uuid", is_nullable: "NO", column_default: null },
      { column_name: "membership_id", data_type: "uuid", is_nullable: "NO", column_default: null },
      { column_name: "property_id", data_type: "uuid", is_nullable: "NO", column_default: null },
      { column_name: "status", data_type: "text", is_nullable: "NO", column_default: null },
      { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: "NO", column_default: "transaction_timestamp()" },
      { column_name: "ended_at", data_type: "timestamp with time zone", is_nullable: "YES", column_default: null },
    ]);
    const constraints = await h.migration.query(
      "SELECT conname,contype,conkey,confkey,CASE WHEN confrelid=0 THEN NULL ELSE confrelid::regclass::text END AS target," +
      "confupdtype,confdeltype,condeferrable,condeferred,convalidated FROM pg_constraint " +
      "WHERE conrelid='app.property_assignment'::regclass ORDER BY conname",
    );
    const base = { confupdtype: " ", confdeltype: " ", condeferrable: false, condeferred: false, convalidated: true, confkey: null, target: null };
    expect(constraints.rows).toEqual([
      { ...base, conname: "property_assignment_membership_fk", contype: "f", conkey: [2, 3], confkey: [2, 1], target: "app.organization_membership", confupdtype: "a", confdeltype: "a" },
      { ...base, conname: "property_assignment_org_id_id_unique", contype: "u", conkey: [2, 1] },
      { ...base, conname: "property_assignment_pkey", contype: "p", conkey: [1] },
      { ...base, conname: "property_assignment_property_fk", contype: "f", conkey: [2, 4], confkey: [2, 1], target: "app.property", confupdtype: "a", confdeltype: "a" },
      { ...base, conname: "property_assignment_status_check", contype: "c", conkey: [5] },
      { ...base, conname: "property_assignment_status_time_check", contype: "c", conkey: [5, 7, 6] },
      ...["id", "org_id", "membership_id", "property_id", "status", "created_at"].map((column, index) => ({
        ...base, conname: "property_assignment_" + column + "_not_null", contype: "n", conkey: [index + 1],
      })),
    ].sort((a, b) => a.conname.localeCompare(b.conname)));
  });

  it("AC10 concurrentActiveUnique", async () => {
    const s = await seedB2Scope(h);
    const args = [s.orgA, s.staffNoneMembership, s.propertyB];
    await withoutEnforcement(h.migration, s.orgA,
      "DROP INDEX app.property_assignment_one_active_membership_property", async () => {
        await h.migration.query(insertActive, args);
        await h.migration.query(insertActive, args);
        expect((await h.migration.query(
          "SELECT count(*)::int AS n FROM app.property_assignment WHERE org_id=$1 AND membership_id=$2 AND property_id=$3 AND status='ACTIVE'", args,
        )).rows).toEqual([{ n: 2 }]);
      });
    const index = await h.migration.query(
      "SELECT i.indisunique,i.indisvalid,i.indkey::text AS keys,pg_get_expr(i.indpred,i.indrelid) AS predicate " +
      "FROM pg_index i WHERE i.indexrelid='app.property_assignment_one_active_membership_property'::regclass",
    );
    expect(index.rows).toEqual([{ indisunique: true, indisvalid: true, keys: "2 3 4", predicate: "(status = 'ACTIVE'::text)" }]);
    const a = new Client(h.roles.migrationConfig);
    const b = new Client(h.roles.migrationConfig);
    const diagnostic = new Client(h.roles.migrationConfig);
    let pending: Promise<{ code?: string; constraint?: string } | null> | undefined;
    const connected = new Set<Client>();
    try {
      for (const client of [a, b, diagnostic]) { await client.connect(); connected.add(client); }
      const aPid = (await a.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const bPid = (await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      expect(aPid !== bPid).toBe(true);
      await bindOrg(a, s.orgA); await bindOrg(b, s.orgA);
      await b.query("SET LOCAL statement_timeout='15s'");
      await a.query(insertActive, args);
      const launched = barrier();
      pending = rejection(b.query(insertActive, args));
      launched.arrive();
      await launched.reached;
      const deadline = performance.now() + 10_000;
      let observedBlocking = false;
      while (performance.now() < deadline) {
        const lock = await diagnostic.query(
          "SELECT $1::int=ANY(pg_blocking_pids($2::int)) AS blocked", [aPid, bPid],
        );
        if (lock.rows[0].blocked) { observedBlocking = true; break; }
      }
      expect(observedBlocking).toBe(true);
      await a.query("COMMIT");
      expect(await pending).toEqual({ code: "23505", constraint: "property_assignment_one_active_membership_property" });
      await b.query("ROLLBACK");
      await bindOrg(diagnostic, s.orgA);
      expect((await diagnostic.query(
        "SELECT count(*)::int AS n FROM app.property_assignment WHERE org_id=$1 AND membership_id=$2 AND property_id=$3 AND status='ACTIVE'", args,
      )).rows).toEqual([{ n: 1 }]);
      await diagnostic.query("ROLLBACK");
    } finally {
      // Roll back A first to release B even if the overlap assertion failed.
      if (connected.has(a)) await a.query("ROLLBACK").catch(() => undefined);
      await pending;
      if (connected.has(b)) await b.query("ROLLBACK").catch(() => undefined);
      if (connected.has(diagnostic)) await diagnostic.query("ROLLBACK").catch(() => undefined);
      await Promise.all([a.end(), b.end(), diagnostic.end()]);
    }
  });

  it("AC15 migrationAtomicity", async () => {
    const root = await realpath(tmpdir());
    const ownedDirs: string[] = [];
    const clients: Client[] = [];
    const makeDir = async () => {
      const dir = await mkdtemp(join(root, "b2-migrations-"));
      ownedDirs.push(dir);
      for (const [name, sha] of Object.entries(frozenMigrations)) {
        await copyFile(join(migrationsDir, name), join(dir, name));
        expect(createHash("sha256").update(await readFile(join(dir, name))).digest("hex"), name).toBe(sha);
      }
      return dir;
    };
    const makeDatabase = async () => {
      const database = "b2_atomic_" + randomUUID().replaceAll("-", "");
      const role = h.roles.migrationConfig.user;
      if (!role || !/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("Unexpected disposable role identifier");
      // Admin is used only to provision disposable databases. Every migration and
      // catalog assertion below uses the existing restricted migration role.
      await h.p.admin.query('CREATE DATABASE "' + database + '"');
      await h.p.admin.query('GRANT CREATE ON DATABASE "' + database + '" TO "' + role + '"');
      const client = new Client({ ...h.roles.migrationConfig, database });
      clients.push(client);
      await client.connect();
      return client;
    };
    const assertSuccess = async (client: Client) => {
      expect(await tableNames(client)).toEqual(appTables);
      expect((await client.query("SELECT name FROM app_migrations.pgmigrations ORDER BY id")).rows.map(row => row.name))
        .toEqual([...Object.keys(frozenMigrations), b2Migration].map(name => name.replace(/\.sql$/, "")));
    };
    const failsSynthetically = async (client: Client, dir: string) => {
      let synthetic = false;
      // The runner prints the complete SQL on an expected error. Suppress that
      // dump while still asserting the fixed injected failure and rollback.
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        try { await migrateCopy(client, dir); }
        catch (error) { synthetic = (error as Error).message.includes("SYNTHETIC_B2_ABORT"); }
      } finally { errors.mockRestore(); }
      expect(synthetic).toBe(true);
    };
    try {
      const exactB2 = await readFile(join(migrationsDir, b2Migration));
      const failB2 = Buffer.concat([exactB2, Buffer.from("\nDO $b2_test_abort$ BEGIN RAISE EXCEPTION 'SYNTHETIC_B2_ABORT'; END $b2_test_abort$;\n")]);
      const freshDir = await makeDir();
      await writeFile(join(freshDir, b2Migration), exactB2);
      const fresh = await makeDatabase();
      await migrateCopy(fresh, freshDir);
      await assertSuccess(fresh);

      const upgradeDir = await makeDir();
      const upgrade = await makeDatabase();
      await migrateCopy(upgrade, upgradeDir);
      const baseline = await catalogSnapshot(upgrade);
      expect(baseline.migrations).toHaveLength(6);
      expect(await tableNames(upgrade)).toEqual(appTables.filter(name => name !== "property_assignment"));
      await writeFile(join(upgradeDir, b2Migration), exactB2);
      await migrateCopy(upgrade, upgradeDir);
      await assertSuccess(upgrade);

      const freshFailDir = await makeDir();
      await writeFile(join(freshFailDir, b2Migration), failB2);
      const freshFail = await makeDatabase();
      await failsSynthetically(freshFail, freshFailDir);
      expect((await freshFail.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('app','authn')")).rows).toEqual([]);
      const metadata = await freshFail.query("SELECT to_regclass('app_migrations.pgmigrations') IS NOT NULL AS present");
      if (metadata.rows[0].present) {
        expect((await freshFail.query("SELECT count(*)::int AS n FROM app_migrations.pgmigrations")).rows).toEqual([{ n: 0 }]);
      }

      const upgradeFailDir = await makeDir();
      const upgradeFail = await makeDatabase();
      await migrateCopy(upgradeFail, upgradeFailDir);
      const beforeFailure = await catalogSnapshot(upgradeFail);
      expect(beforeFailure.migrations).toHaveLength(6);
      await writeFile(join(upgradeFailDir, b2Migration), failB2);
      await failsSynthetically(upgradeFail, upgradeFailDir);
      expect(await catalogSnapshot(upgradeFail)).toEqual(beforeFailure);
      expect((await upgradeFail.query("SELECT to_regclass('app.property_assignment') IS NULL AS absent")).rows).toEqual([{ absent: true }]);
      expect(createHash("sha256").update(await readFile(join(migrationsDir, b2Migration))).digest("hex"))
        .toBe(createHash("sha256").update(exactB2).digest("hex"));
    } finally {
      await Promise.all(clients.map(client => client.end()));
      for (const dir of ownedDirs) {
        const actual = await realpath(dir);
        const child = relative(root, actual);
        if (!child || child.startsWith("..") || isAbsolute(child) || !child.startsWith("b2-migrations-")) {
          throw new Error("Refusing to remove a path outside owned temporary migrations");
        }
        await rm(actual, { recursive: true, force: false });
      }
    }
  }, 120_000);
});

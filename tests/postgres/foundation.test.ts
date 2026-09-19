import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client, type ClientConfig, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import * as publicApi from "@build-manager/persistence-postgres";
import { createPostgresDatabase, withTransaction, withOrgTransaction } from "@build-manager/persistence-postgres";
import { getInternalPool } from "../../packages/persistence-postgres/src/database";
import {
  grantRuntimeAccess,
  provisionTestRoles,
  runPostgresMigrations,
  TEST_MIGRATION_ROLE,
  TEST_RUNTIME_ROLE,
  startPostgres18Container,
  type Postgres18Container,
} from "@build-manager/persistence-postgres/testing";

describe("PF02-A PostgreSQL foundation", { concurrent: false }, () => {
  let postgres: Postgres18Container | undefined;
  let diagnostics: unknown[][] = [];
  let migrationClient: Client;
  let runtimeConfig: ClientConfig;
  let migrationConfig: ClientConfig;
  let migrationDatabase: publicApi.PostgresDatabase;

  beforeAll(async () => {
    const info = vi.spyOn(console, "info");
    try {
      postgres = await startPostgres18Container();
    } finally {
      diagnostics = info.mock.calls.map((call) => [...call]);
      info.mockRestore();
    }
    const roles = await provisionTestRoles(
      postgres.admin, postgres.adminConfig, postgres.database,
    );
    migrationClient = new Client(roles.migrationConfig);
    await migrationClient.connect();
    await runPostgresMigrations(migrationClient);
    await grantRuntimeAccess(migrationClient);
    runtimeConfig = roles.runtimeConfig;
    migrationConfig = roles.migrationConfig;
    migrationDatabase = createPostgresDatabase(migrationConfig);
  }, 120_000);

  afterAll(async () => {
    try {
      await migrationDatabase?.close();
      await migrationClient?.end();
    } finally {
      await postgres?.stop();
    }
  }, 60_000);

  it("commits a write only after the operation completes on one backend", async () => {
    const database = createPostgresDatabase({ ...migrationConfig, max: 1 });
    const id = randomUUID();
    try {
      const result = await withOrgTransaction(database, id, async (client) => {
        const before = await client.query("SELECT pg_backend_pid() AS pid, txid_current()::text AS tx");
        await client.query("INSERT INTO app.organization (id, status, display_name) VALUES ($1, 'ACTIVE', 'SYNTHETIC_TX')", [id]);
        expect((await withOrgTransaction(migrationDatabase, id, (client) => client.query("SELECT id FROM app.organization WHERE id = $1", [id]))).rows).toEqual([]);
        const after = await client.query("SELECT pg_backend_pid() AS pid, txid_current()::text AS tx");
        expect(after.rows).toEqual(before.rows);
        return { id, pid: before.rows[0].pid };
      });
      expect(result.id).toBe(id);
      expect((await withOrgTransaction(migrationDatabase, id, (client) => client.query("SELECT id FROM app.organization WHERE id = $1", [id]))).rows).toEqual([{ id }]);
      await withTransaction(database, async (client) => {
        expect((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid).toBe(result.pid);
      });
    } finally { await database.close(); }
  });

  it("rolls back a valid write after an actual database error and reuses the client", async () => {
    const database = createPostgresDatabase({ ...migrationConfig, max: 1 });
    const id = randomUUID();
    let pid: number | undefined;
    let primary: unknown;
    try {
      const transaction = withOrgTransaction(database, id, async (client) => {
        pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        await client.query("INSERT INTO app.organization (id, status, display_name) VALUES ($1, 'ACTIVE', 'SYNTHETIC_ROLLBACK')", [id]);
        try { await client.query("SELECT 1 / 0"); } catch (error) { primary = error; throw error; }
      });
      await expect(transaction).rejects.toMatchObject({ code: "22012" });
      await expect(transaction).rejects.toBe(primary);
      expect((await withOrgTransaction(migrationDatabase, id, (client) => client.query("SELECT id FROM app.organization WHERE id = $1", [id]))).rows).toEqual([]);
      await withTransaction(database, async (client) => {
        expect((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid).toBe(pid);
        expect((await client.query("SELECT 42 AS answer")).rows[0].answer).toBe(42);
      });
    } finally { await database.close(); }
  });

  it("sets parameterized organization context locally and clears it after commit and rollback", async () => {
    const database = createPostgresDatabase({ ...runtimeConfig, max: 1 });
    const orgId = randomUUID();
    const primary = new Error("SYNTHETIC_OPERATION_FAILURE");
    let pid: number | undefined;
    const inspectContext = async (client: publicApi.SqlClient, expected: string | null) => {
      const result = await client.query("SELECT pg_backend_pid() AS pid, NULLIF(current_setting('app.org_id', true), '') AS org");
      expect(result.rows[0].org).toBe(expected);
      pid ??= result.rows[0].pid;
      expect(result.rows[0].pid).toBe(pid);
    };
    try {
      await withOrgTransaction(database, orgId, (client) => inspectContext(client, orgId));
      await withTransaction(database, (client) => inspectContext(client, null));
      await expect(withOrgTransaction(database, orgId, async (client) => {
        await inspectContext(client, orgId);
        throw primary;
      })).rejects.toBe(primary);
      await withTransaction(database, (client) => inspectContext(client, null));
    } finally { await database.close(); }
  });

  it.each(["", "not-a-uuid", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", "aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa", "aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa", "aaaaaaaa-aaaa-4aaa-7aaa-aaaaaaaaaaaa", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa ", null, 123])(
    "rejects non-canonical org %j before acquiring or calling the operation", async (orgId) => {
      const database = createPostgresDatabase(runtimeConfig);
      const pool = getInternalPool(database);
      const connect = vi.spyOn(pool, "connect");
      const operation = vi.fn(async () => undefined);
      try {
        await expect(withOrgTransaction(database, orgId as string, operation)).rejects.toThrow("Expected canonical lowercase UUID");
        expect(connect).not.toHaveBeenCalled();
        expect(operation).not.toHaveBeenCalled();
      } finally { connect.mockRestore(); await database.close(); }
    },
  );

  it("shares one close promise and exposes only the safe public handle and exports", async () => {
    const database = createPostgresDatabase(runtimeConfig);
    expect(Object.keys(database)).toEqual(["close"]);
    expect(Object.keys(publicApi).sort()).toEqual(["createPostgresDatabase", "withOrgTransaction", "withTransaction"]);
    const first = database.close();
    const second = database.close();
    // Await both before asserting identity so a failing implementation cannot leak a rejection.
    const outcomes = await Promise.allSettled([first, second]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(second).toBe(first);
    expect(database.close()).toBe(first);
  });

  it("rejects a fabricated close-only handle without calling the operation", async () => {
    const operation = vi.fn(async () => undefined);
    await expect(withTransaction({ close: async () => undefined }, operation)).rejects.toThrow("Unknown PostgresDatabase handle");
    expect(operation).not.toHaveBeenCalled();
  });

  describe("transaction cleanup fault injection (not server fault evidence)", () => {
    it.each([
      { stage: "BEGIN", rollbackFails: false, releaseFails: false, commands: ["BEGIN"], destroy: true },
      { stage: "OPERATION", rollbackFails: false, releaseFails: false, commands: ["BEGIN", "ROLLBACK"], destroy: false },
      { stage: "CONTEXT", rollbackFails: false, releaseFails: false, commands: ["BEGIN", "CONTEXT", "ROLLBACK"], destroy: false },
      { stage: "COMMIT", rollbackFails: false, releaseFails: false, commands: ["BEGIN", "COMMIT", "ROLLBACK"], destroy: true },
      { stage: "OPERATION", rollbackFails: true, releaseFails: false, commands: ["BEGIN", "ROLLBACK"], destroy: true },
      { stage: "COMMIT", rollbackFails: true, releaseFails: false, commands: ["BEGIN", "COMMIT", "ROLLBACK"], destroy: true },
      { stage: "BEGIN", rollbackFails: false, releaseFails: true, commands: ["BEGIN"], destroy: true },
      { stage: "OPERATION", rollbackFails: false, releaseFails: true, commands: ["BEGIN", "ROLLBACK"], destroy: false },
      { stage: "OPERATION", rollbackFails: true, releaseFails: true, commands: ["BEGIN", "ROLLBACK"], destroy: true },
      { stage: "COMMIT", rollbackFails: true, releaseFails: true, commands: ["BEGIN", "COMMIT", "ROLLBACK"], destroy: true },
    ])("preserves $stage failure (rollback=$rollbackFails, release=$releaseFails)", async ({ stage, rollbackFails, releaseFails, commands, destroy }) => {
      const database = createPostgresDatabase(runtimeConfig);
      const primary = Object.freeze(new Error("SYNTHETIC_PRIMARY"));
      const rollbackError = new Error("SYNTHETIC_ROLLBACK_FAILURE");
      const releaseError = new Error("SYNTHETIC_RELEASE_FAILURE");
      const query = vi.fn(async (sql: string) => {
        const command = sql.startsWith("SELECT pg_catalog.set_config") ? "CONTEXT" : sql;
        if (command === stage) throw primary;
        if (command === "ROLLBACK" && rollbackFails) throw rollbackError;
        return { rows: [] };
      });
      const release = vi.fn(() => { if (releaseFails) throw releaseError; });
      const client = { query, release } as unknown as PoolClient;
      const connect = vi.spyOn(getInternalPool(database), "connect").mockImplementation(async () => client);
      const operation = vi.fn(async (received: publicApi.SqlClient) => {
        expect(received).toBe(client);
        if (stage === "OPERATION") throw primary;
        return "SYNTHETIC_RESULT";
      });
      try {
        const transaction = stage === "CONTEXT"
          ? withOrgTransaction(database, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", operation)
          : withTransaction(database, operation);
        if (rollbackFails || releaseFails) {
          const errors = [primary, ...(rollbackFails ? [rollbackError] : []), ...(releaseFails ? [releaseError] : [])];
          await expect(transaction).rejects.toBeInstanceOf(AggregateError);
          await expect(transaction).rejects.toMatchObject({ cause: primary, errors });
        } else { await expect(transaction).rejects.toBe(primary); }
        expect(query.mock.calls.map(([sql]) => sql.startsWith("SELECT pg_catalog.set_config") ? "CONTEXT" : sql)).toEqual(commands);
        if (stage === "CONTEXT") expect(query).toHaveBeenNthCalledWith(2, "SELECT pg_catalog.set_config('app.org_id', $1, true)", ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
        expect(operation).toHaveBeenCalledTimes(stage === "BEGIN" || stage === "CONTEXT" ? 0 : 1);
        expect(connect).toHaveBeenCalledTimes(1);
        expect(release).toHaveBeenCalledExactlyOnceWith(destroy);
      } finally { connect.mockRestore(); await database.close(); }
    });

    it("propagates release failure after a committed operation", async () => {
      const database = createPostgresDatabase(runtimeConfig);
      const primary = new Error("SYNTHETIC_RELEASE_FAILURE");
      const query = vi.fn(async () => ({ rows: [] }));
      const release = vi.fn(() => { throw primary; });
      const connect = vi.spyOn(getInternalPool(database), "connect").mockImplementation(async () => ({ query, release } as unknown as PoolClient));
      try {
        await expect(withTransaction(database, async () => "done")).rejects.toBe(primary);
        expect(query.mock.calls).toEqual([["BEGIN"], ["COMMIT"]]);
        expect(release).toHaveBeenCalledExactlyOnceWith(false);
      } finally { connect.mockRestore(); await database.close(); }
    });

    it.each([undefined, null, false, 0, "SYNTHETIC_THROWN_STRING"])("preserves arbitrary thrown value %j after rollback", async (primary) => {
      const database = createPostgresDatabase(runtimeConfig);
      const query = vi.fn(async () => ({ rows: [] }));
      const release = vi.fn();
      const connect = vi.spyOn(getInternalPool(database), "connect").mockImplementation(async () => ({ query, release } as unknown as PoolClient));
      try {
        await expect(withTransaction(database, async () => { throw primary; })).rejects.toBe(primary);
        expect(query.mock.calls).toEqual([["BEGIN"], ["ROLLBACK"]]);
        expect(release).toHaveBeenCalledExactlyOnceWith(false);
      } finally { connect.mockRestore(); await database.close(); }
    });
  });

  it("runs the exact PostgreSQL 18.6 server", async () => {
    const result = await postgres!.admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );

    expect(result.rows[0]?.server_version_num).toBe("180006");
  });

  it("records the actual human-readable server version for diagnostics", async () => {
    const result = await postgres!.admin.query<{ server_version: string }>(
      "SHOW server_version",
    );

    expect(diagnostics).toContainEqual([
      "PostgreSQL server_version:",
      result.rows[0]?.server_version,
    ]);
  });

  it("provisions separate restricted migration and runtime logins", async () => {
    const roles = await migrationClient.query(`
      SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
             rolreplication, rolbypassrls,
             has_database_privilege(oid, current_database(), 'CREATE') AS can_create
      FROM pg_roles
      WHERE rolname IN ('bm_pf02a_migrator', 'bm_pf02a_runtime')
      ORDER BY rolname
    `);

    expect(roles.rows).toEqual([
      {
        rolname: "bm_pf02a_migrator", rolcanlogin: true, rolsuper: false,
        rolcreatedb: false, rolcreaterole: false, rolreplication: false,
        rolbypassrls: false, can_create: true,
      },
      {
        rolname: "bm_pf02a_runtime", rolcanlogin: true, rolsuper: false,
        rolcreatedb: false, rolcreaterole: false, rolreplication: false,
        rolbypassrls: false, can_create: false,
      },
    ]);
  });

  it("runs migrations as a dedicated non-superuser migration owner", async () => {
    const owner = await migrationClient.query(`
      SELECT current_user, rolsuper, rolcreatedb, rolcreaterole,
             rolreplication, rolbypassrls
      FROM pg_roles WHERE rolname = current_user
    `);
    expect(owner.rows[0]).toEqual({
      current_user: TEST_MIGRATION_ROLE, rolsuper: false, rolcreatedb: false,
      rolcreaterole: false, rolreplication: false, rolbypassrls: false,
    });
    const tables = await migrationClient.query(`
      SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'app'
        AND c.relname IN ('app_user', 'organization', 'organization_membership')
      ORDER BY c.relname
    `);
    expect(tables.rows).toEqual([
      { relname: "app_user", owner: TEST_MIGRATION_ROLE },
      { relname: "organization", owner: TEST_MIGRATION_ROLE },
      { relname: "organization_membership", owner: TEST_MIGRATION_ROLE },
    ]);
  });

  it("keeps runtime credentials separate from migration ownership", async () => {
    const runtime = new Client(runtimeConfig);
    try {
      await runtime.connect();
      const result = await runtime.query(`
        SELECT current_user,
               pg_has_role(current_user, $1, 'MEMBER') AS migration_member,
               has_schema_privilege(current_user, 'app', 'CREATE') AS can_create
      `, [TEST_MIGRATION_ROLE]);
      expect(result.rows[0]).toEqual({
        current_user: TEST_RUNTIME_ROLE, migration_member: false, can_create: false,
      });
    } finally {
      await runtime.end();
    }
  });

  it("records applied migrations without adding history on a second run", async () => {
    const before = await migrationClient.query(
      "SELECT id, name, run_on FROM app_migrations.pgmigrations ORDER BY id",
    );
    expect(before.rows.length).toBeGreaterThan(0);
    await runPostgresMigrations(migrationClient);
    const after = await migrationClient.query(
      "SELECT id, name, run_on FROM app_migrations.pgmigrations ORDER BY id",
    );
    expect(after.rows).toEqual(before.rows);
  });

  const scopedTables = ["organization", "organization_membership", "property", "unit", "occupancy", "occupancy_member"] as const;

  it("stores an invoker stable context helper with fixed search path and no PUBLIC schema or function privileges", async () => {
    const helper = await migrationClient.query(`
      SELECT p.prosecdef, p.provolatile, p.proconfig,
             has_function_privilege($1, p.oid, 'EXECUTE') AS runtime_execute,
             EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS public_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'app' AND p.proname = 'current_org_id' AND p.pronargs = 0
    `, [TEST_RUNTIME_ROLE]);
    expect(helper.rows).toEqual([{
      prosecdef: false, provolatile: "s", proconfig: ["search_path=pg_catalog"],
      runtime_execute: true, public_execute: false,
    }]);
    const schema = await migrationClient.query(`
      SELECT EXISTS (SELECT 1 FROM aclexplode(nspacl) a WHERE a.grantee = 0) AS public_access
      FROM pg_namespace WHERE nspname = 'app'
    `);
    expect(schema.rows).toEqual([{ public_access: false }]);
  });

  it("F19 candidate: runtime is restricted, outside inherited roles, and every scoped table forces RLS", async () => {
    const database = createPostgresDatabase(runtimeConfig);
    try {
      await withTransaction(database, async (client) => {
        const role = await client.query(`
          SELECT current_user, session_user, rolsuper, rolcreatedb, rolcreaterole,
                 rolreplication, rolbypassrls,
                 has_schema_privilege(current_user, 'app', 'CREATE') AS schema_create,
                 pg_has_role(current_user, $1, 'MEMBER') AS migration_member
          FROM pg_roles WHERE rolname = current_user
        `, [TEST_MIGRATION_ROLE]);
        expect(role.rows).toEqual([{
          current_user: TEST_RUNTIME_ROLE, session_user: TEST_RUNTIME_ROLE,
          rolsuper: false, rolcreatedb: false, rolcreaterole: false,
          rolreplication: false, rolbypassrls: false, schema_create: false,
          migration_member: false,
        }]);
        // MEMBER follows indirect membership too; no other role is reachable.
        const memberships = await client.query(`
          SELECT rolname FROM pg_roles
          WHERE rolname <> current_user AND pg_has_role(current_user, oid, 'MEMBER')
        `);
        expect(memberships.rows).toEqual([]);
        const tables = await client.query(`
          SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
                 c.relrowsecurity, c.relforcerowsecurity
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'app' AND c.relname = ANY($1::text[])
          ORDER BY c.relname
        `, [scopedTables]);
        expect(tables.rows).toEqual([...scopedTables].sort().map((relname) => ({
          relname, owner: TEST_MIGRATION_ROLE, relrowsecurity: true, relforcerowsecurity: true,
        })));
        expect(tables.rows.every((table) => table.owner !== role.rows[0].current_user)).toBe(true);
      });
    } finally { await database.close(); }
  });

  it("F19 candidate: runtime has only the exact scoped grants and cannot create schema objects", async () => {
    const database = createPostgresDatabase(runtimeConfig);
    try {
      await withTransaction(database, async (client) => {
        const privileges = await client.query(`
          SELECT c.relname,
                 has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
                 has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
                 has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
                 has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
                 has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
                 has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_reference,
                 has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger,
                 has_table_privilege(current_user, c.oid, 'MAINTAIN') AS can_maintain
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'app' AND c.relkind = 'r' ORDER BY c.relname
        `);
        expect(privileges.rows).toEqual(["app_user", ...scopedTables].sort().map((relname) => ({
          relname, can_select: relname !== "app_user",
          can_insert: ["property", "unit", "occupancy", "occupancy_member"].includes(relname),
          can_update: ["property", "unit", "occupancy", "occupancy_member"].includes(relname),
          can_delete: false, can_truncate: false, can_reference: false, can_trigger: false, can_maintain: false,
        })));
      });
      await expect(withTransaction(database, (client) => client.query(
        "CREATE TABLE app.synthetic_forbidden_runtime_table (id integer)",
      ))).rejects.toMatchObject({ code: "42501" });
    } finally { await database.close(); }
  });

  it("F18/F19 candidate: one runtime backend clears context after commit and rollback and isolates all six tables", async () => {
    const a = await createRelationshipFixture();
    const b = await createRelationshipFixture();
    for (const fixture of [a, b]) {
      await withOrgTransaction(migrationDatabase, fixture.orgId, (client) => client.query(`
        INSERT INTO app.organization_membership (org_id, user_id, role, status)
        VALUES ($1, $2, 'ORG_ADMIN', 'ACTIVE')
      `, [fixture.orgId, fixture.userId]));
      await withOrgTransaction(migrationDatabase, fixture.orgId, (client) => client.query(`
        INSERT INTO app.occupancy_member (org_id, occupancy_id, user_id, joined_at, status)
        VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', 'ACTIVE')
      `, [fixture.orgId, fixture.occupancyId, fixture.userId]));
    }
    const database = createPostgresDatabase({ ...runtimeConfig, max: 1 });
    let pid: number | undefined;
    const inspect = async (client: publicApi.SqlClient, expected: string | null, raw: string | null) => {
      const result = await client.query(`
        SELECT pg_backend_pid() AS pid, current_user, session_user,
               current_setting('app.org_id', true) AS raw, app.current_org_id() AS org
      `);
      pid ??= result.rows[0].pid;
      expect(result.rows).toEqual([{
        pid, current_user: TEST_RUNTIME_ROLE, session_user: TEST_RUNTIME_ROLE, raw, org: expected,
      }]);
      for (const table of scopedTables) {
        const key = table === "organization" ? "id" : "org_id";
        const rows = await client.query(`SELECT DISTINCT ${key} AS org FROM app.${table}`);
        expect(rows.rows).toEqual(expected === null ? [] : [{ org: expected }]);
      }
    };
    const committedId = randomUUID();
    const rolledBackId = randomUUID();
    const failure = new Error("SYNTHETIC_F18_ROLLBACK");
    try {
      await withTransaction(database, (client) => inspect(client, null, null));
      await withOrgTransaction(database, a.orgId, async (client) => {
        await inspect(client, a.orgId, a.orgId);
        await client.query(`INSERT INTO app.property (id, org_id, address_reference, status)
          VALUES ($1, $2, 'SYNTHETIC_F18_COMMIT', 'ACTIVE')`, [committedId, a.orgId]);
      });
      await withTransaction(database, (client) => inspect(client, null, ""));
      await expect(withOrgTransaction(database, a.orgId, async (client) => {
        await inspect(client, a.orgId, a.orgId);
        await client.query(`INSERT INTO app.property (id, org_id, address_reference, status)
          VALUES ($1, $2, 'SYNTHETIC_F18_ROLLBACK', 'ACTIVE')`, [rolledBackId, a.orgId]);
        throw failure;
      })).rejects.toBe(failure);
      await withTransaction(database, (client) => inspect(client, null, ""));
      await withOrgTransaction(database, b.orgId, (client) => inspect(client, b.orgId, b.orgId));
      await withTransaction(database, (client) => inspect(client, null, ""));
      await withOrgTransaction(database, a.orgId, async (client) => {
        expect((await client.query("SELECT id FROM app.property WHERE id = ANY($1::uuid[])", [
          [committedId, rolledBackId],
        ])).rows).toEqual([{ id: committedId }]);
      });
      await expect(withOrgTransaction(database, a.orgId, (client) => client.query(`
        INSERT INTO app.property (org_id, address_reference, status)
        VALUES ($1, 'SYNTHETIC_WRONG_CONTEXT', 'ACTIVE')
      `, [b.orgId]))).rejects.toMatchObject({ code: "42501", message: 'new row violates row-level security policy for table "property"' });
      await expect(withOrgTransaction(database, a.orgId, (client) => client.query(
        "UPDATE app.property SET org_id = $1 WHERE id = $2", [b.orgId, committedId],
      ))).rejects.toMatchObject({ code: "42501", message: 'new row violates row-level security policy for table "property"' });
      await withOrgTransaction(database, b.orgId, async (client) => {
        expect((await client.query("UPDATE app.property SET address_reference = 'SYNTHETIC_HIDDEN_UPDATE' WHERE id = $1 RETURNING id", [committedId])).rows).toEqual([]);
      });
      await expect(withTransaction(database, (client) => client.query(`
        INSERT INTO app.property (org_id, address_reference, status)
        VALUES ($1, 'SYNTHETIC_NO_CONTEXT', 'ACTIVE')
      `, [a.orgId]))).rejects.toMatchObject({ code: "42501", message: 'new row violates row-level security policy for table "property"' });
      await withTransaction(database, (client) => inspect(client, null, ""));
    } finally { await database.close(); }
  });

  // Database prerequisites only: canonical F01/F16/F41/F43 remain NOT_RUN.
  it("A-ISO-01 database isolation prerequisite for F01: runtime creates and reads Property/Unit with tenant isolation", async () => {
    const a = await createIdentityAndOrganization();
    const b = await createIdentityAndOrganization();
    const database = createPostgresDatabase({ ...runtimeConfig, max: 1 });
    const properties = [randomUUID(), randomUUID()];
    const units = [randomUUID(), randomUUID()];
    try {
      for (const [index, fixture] of [a, b].entries()) {
        await withOrgTransaction(database, fixture.orgId, async (client) => {
          expect((await client.query("SELECT current_user, session_user")).rows).toEqual([
            { current_user: TEST_RUNTIME_ROLE, session_user: TEST_RUNTIME_ROLE },
          ]);
          await client.query(`
            INSERT INTO app.property (id, org_id, address_reference, status)
            VALUES ($1, $2, 'SYNTHETIC_A_ISO_REFERENCE', 'ACTIVE')
          `, [properties[index], fixture.orgId]);
          await client.query(`
            INSERT INTO app.unit (id, org_id, property_id, label, status)
            VALUES ($1, $2, $3, 'SYNTHETIC_A_ISO_UNIT', 'ACTIVE')
          `, [units[index], fixture.orgId, properties[index]]);
        });
      }
      await withOrgTransaction(database, a.orgId, async (client) => {
        expect((await client.query("SELECT id, org_id FROM app.property WHERE id = ANY($1::uuid[])", [properties])).rows)
          .toEqual([{ id: properties[0], org_id: a.orgId }]);
        expect((await client.query("SELECT id, org_id, property_id FROM app.unit WHERE id = ANY($1::uuid[])", [units])).rows)
          .toEqual([{ id: units[0], org_id: a.orgId, property_id: properties[0] }]);
      });
      await withOrgTransaction(database, b.orgId, async (client) => {
        expect((await client.query("SELECT id FROM app.property WHERE org_id = $1", [a.orgId])).rows).toEqual([]);
        expect((await client.query("SELECT id FROM app.unit WHERE org_id = $1", [a.orgId])).rows).toEqual([]);
        expect((await client.query("SELECT id FROM app.property WHERE id = $1", [properties[1]])).rows)
          .toEqual([{ id: properties[1] }]);
        expect((await client.query("SELECT id FROM app.unit WHERE id = $1", [units[1]])).rows)
          .toEqual([{ id: units[1] }]);
      });
      await withTransaction(database, async (client) => {
        expect((await client.query("SELECT app.current_org_id() AS org")).rows).toEqual([{ org: null }]);
        expect((await client.query("SELECT id FROM app.property")).rows).toEqual([]);
        expect((await client.query("SELECT id FROM app.unit")).rows).toEqual([]);
      });
    } finally { await database.close(); }
  });

  it("A-TX-01 database transaction prerequisite for F16: a duplicate key rolls back the preceding valid write", async () => {
    const database = createPostgresDatabase(migrationConfig);
    const userId = randomUUID();
    try {
      await expect(withTransaction(database, async (client) => {
        await client.query("INSERT INTO app.app_user (id, status) VALUES ($1, 'ACTIVE')", [userId]);
        expect((await client.query("SELECT id FROM app.app_user WHERE id = $1", [userId])).rows)
          .toEqual([{ id: userId }]);
        await client.query("INSERT INTO app.app_user (id, status) VALUES ($1, 'ACTIVE')", [userId]);
      })).rejects.toMatchObject({ code: "23505" });
      expect((await migrationClient.query("SELECT id FROM app.app_user WHERE id = $1", [userId])).rows)
        .toEqual([]);
    } finally { await database.close(); }
  });

  it("A-FK-01 database foreign-key prerequisite for F41: composite parent rejects a foreign organization with 23503", async () => {
    const constraint = await migrationClient.query(`
      SELECT pg_get_constraintdef(c.oid) AS definition,
        ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, pos)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num
          ORDER BY k.pos) AS source_columns,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num, pos)
          JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num
          ORDER BY k.pos) AS target_columns
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'app' AND c.conname = 'unit_property_fk' AND c.contype = 'f'
        AND c.conrelid = 'app.unit'::regclass AND c.confrelid = 'app.property'::regclass
    `);
    expect(constraint.rows).toHaveLength(1);
    expect(constraint.rows[0]).toMatchObject({
      source_columns: ["org_id", "property_id"], target_columns: ["org_id", "id"],
    });
    const definition = constraint.rows[0]!.definition.replace(/\s+/g, " ");
    expect(definition).toContain("FOREIGN KEY (org_id, property_id)");
    expect(definition).toContain("REFERENCES app.property(org_id, id)");

    const a = await createIdentityAndOrganization();
    const b = await createIdentityAndOrganization();
    const database = createPostgresDatabase(runtimeConfig);
    const propertyA = randomUUID();
    const propertyB = randomUUID();
    const validUnit = randomUUID();
    const rejectedUnit = randomUUID();
    try {
      for (const [orgId, propertyId] of [[a.orgId, propertyA], [b.orgId, propertyB]]) {
        await withOrgTransaction(database, orgId!, (client) => client.query(`
          INSERT INTO app.property (id, org_id, address_reference, status)
          VALUES ($1, $2, 'SYNTHETIC_A_FK_REFERENCE', 'ACTIVE')
        `, [propertyId, orgId]));
      }
      // A same-org child proves the runtime INSERT path and fixture are valid.
      await withOrgTransaction(database, a.orgId, (client) => client.query(`
        INSERT INTO app.unit (id, org_id, property_id, label, status)
        VALUES ($1, $2, $3, 'SYNTHETIC_A_FK_UNIT', 'ACTIVE')
      `, [validUnit, a.orgId, propertyA]));
      await expect(withOrgTransaction(database, a.orgId, (client) => client.query(`
        INSERT INTO app.unit (id, org_id, property_id, label, status)
        VALUES ($1, $2, $3, 'SYNTHETIC_A_FK_UNIT', 'ACTIVE')
      `, [rejectedUnit, a.orgId, propertyB]))).rejects.toMatchObject({
        code: "23503", constraint: "unit_property_fk",
      });
      await withOrgTransaction(database, a.orgId, async (client) => {
        expect((await client.query("SELECT id FROM app.unit WHERE id = ANY($1::uuid[])", [[validUnit, rejectedUnit]])).rows)
          .toEqual([{ id: validUnit }]);
      });
      for (const fixture of [a, b]) {
        await withOrgTransaction(migrationDatabase, fixture.orgId, async (client) => {
          expect((await client.query("SELECT id FROM app.unit WHERE id = $1", [rejectedUnit])).rows).toEqual([]);
        });
      }
    } finally { await database.close(); }
  });

  it("A-ADDRESS-01 database address prerequisite for F43: identical references coexist without cross-organization visibility", async () => {
    const a = await createIdentityAndOrganization();
    const b = await createIdentityAndOrganization();
    const database = createPostgresDatabase(runtimeConfig);
    const reference = `SYNTHETIC_A_ADDRESS_${randomUUID()}`;
    const properties = [randomUUID(), randomUUID()];
    try {
      for (const [index, fixture] of [a, b].entries()) {
        await withOrgTransaction(database, fixture.orgId, (client) => client.query(`
          INSERT INTO app.property (id, org_id, address_reference, status)
          VALUES ($1, $2, $3, 'ACTIVE')
        `, [properties[index], fixture.orgId, reference]));
      }
      // FORCE RLS also binds the migration owner: verify each tenant separately.
      const ownerRows: Array<{ id: string; org_id: string; address_reference: string }> = [];
      for (const [index, fixture] of [a, b].entries()) {
        const expected = [{ id: properties[index], org_id: fixture.orgId, address_reference: reference }];
        const owner = await withOrgTransaction(migrationDatabase, fixture.orgId, (client) => client.query<{
          id: string; org_id: string; address_reference: string;
        }>("SELECT id, org_id, address_reference FROM app.property WHERE address_reference = $1", [reference]));
        expect(owner.rows).toEqual(expected);
        ownerRows.push(...owner.rows);
        const runtime = await withOrgTransaction(database, fixture.orgId, (client) => client.query(
          "SELECT id, org_id, address_reference FROM app.property WHERE address_reference = $1", [reference],
        ));
        expect(runtime.rows).toEqual(expected);
      }
      expect(ownerRows).toHaveLength(2);
      expect(new Set(ownerRows.map((row) => row.id)).size).toBe(2);
    } finally { await database.close(); }
  });

  async function createIdentityAndOrganization() {
    const user = await migrationClient.query<{ id: string }>(
      "INSERT INTO app.app_user (status) VALUES ('ACTIVE') RETURNING id",
    );
    // Forced RLS needs the future organization ID before the scoped INSERT.
    const orgId = (await migrationClient.query<{ id: string }>("SELECT uuidv7() AS id")).rows[0]!.id;
    const organization = await withOrgTransaction(migrationDatabase, orgId, (client) => client.query<{ id: string }>(
      "INSERT INTO app.organization (id, status, display_name) VALUES ($1, 'ACTIVE', $2) RETURNING id",
      [orgId, "SYNTHETIC_PF02A_ORG"],
    ));
    return { userId: user.rows[0]!.id, orgId: organization.rows[0]!.id };
  }

  it("creates a default UUIDv7 user and explicitly scoped UUIDv7 organization with its default intact", async () => {
    const { userId, orgId } = await createIdentityAndOrganization();
    expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(orgId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const columns = await migrationClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'app_user'
      ORDER BY ordinal_position
    `);
    expect(columns.rows.map((row) => row.column_name)).toEqual(["id", "status", "created_at"]);
    const defaults = await migrationClient.query(`
      SELECT table_name, column_default FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name IN ('app_user', 'organization') AND column_name = 'id'
      ORDER BY table_name
    `);
    expect(defaults.rows).toEqual([
      { table_name: "app_user", column_default: "uuidv7()" },
      { table_name: "organization", column_default: "uuidv7()" },
    ]);
  });

  it.each(["", " ", " PADDED", "PADDED ", "x".repeat(161)])(
    "rejects invalid organization display name %j", async (displayName) => {
      const orgId = randomUUID();
      await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(
        "INSERT INTO app.organization (id, status, display_name) VALUES ($1, 'ACTIVE', $2)",
        [orgId, displayName],
      ))).rejects.toMatchObject({ code: "23514", constraint: "organization_display_name_shape" });
    },
  );

  it("rejects a second ACTIVE membership for the same organization and user", async () => {
    const { userId, orgId } = await createIdentityAndOrganization();
    const insert = () => withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.organization_membership (org_id, user_id, role, status)
      VALUES ($1, $2, 'ORG_ADMIN', 'ACTIVE') RETURNING version, ended_at
    `, [orgId, userId]));
    expect((await insert()).rows[0]).toEqual({ version: 1, ended_at: null });
    await expect(insert()).rejects.toMatchObject({
      code: "23505", constraint: "organization_membership_one_active_user_org",
    });
  });

  it.each([
    ["ACTIVE", "2026-01-02T00:00:00Z"],
    ["ENDED", null],
    ["ENDED", "2025-12-31T00:00:00Z"],
  ])("rejects inconsistent membership lifecycle %s / %s", async (status, endedAt) => {
    const { userId, orgId } = await createIdentityAndOrganization();
    await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.organization_membership
        (org_id, user_id, role, status, created_at, ended_at)
      VALUES ($1, $2, 'PROPERTY_STAFF', $3, '2026-01-01T00:00:00Z', $4)
    `, [orgId, userId, status, endedAt]))).rejects.toMatchObject({
      code: "23514", constraint: "organization_membership_status_time",
    });
  });

  it("allows ended membership history alongside a new active membership", async () => {
    const { userId, orgId } = await createIdentityAndOrganization();
    await withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.organization_membership
        (org_id, user_id, role, status, ended_at)
      VALUES ($1, $2, 'ORG_ADMIN', 'ENDED', transaction_timestamp()),
             ($1, $2, 'PROPERTY_STAFF', 'ENDED', transaction_timestamp()),
             ($1, $2, 'PROPERTY_STAFF', 'ACTIVE', NULL)
    `, [orgId, userId]));
    const count = await withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      SELECT count(*)::integer AS count FROM app.organization_membership
      WHERE org_id = $1 AND user_id = $2
    `, [orgId, userId]));
    expect(count.rows[0]?.count).toBe(3);
  });
  async function createRelationshipFixture() {
    const identity = await createIdentityAndOrganization();
    const property = await withOrgTransaction(migrationDatabase, identity.orgId, (client) => client.query<{ id: string }>(`
      INSERT INTO app.property (org_id, address_reference, status)
      VALUES ($1, 'SYNTHETIC_BUILDING_REFERENCE', 'ACTIVE') RETURNING id
    `, [identity.orgId]));
    const propertyId = property.rows[0]!.id;
    const unit = await withOrgTransaction(migrationDatabase, identity.orgId, (client) => client.query<{ id: string }>(`
      INSERT INTO app.unit (org_id, property_id, label, status)
      VALUES ($1, $2, 'SYNTHETIC_UNIT', 'ACTIVE') RETURNING id
    `, [identity.orgId, propertyId]));
    const unitId = unit.rows[0]!.id;
    const occupancy = await withOrgTransaction(migrationDatabase, identity.orgId, (client) => client.query<{ id: string }>(`
      INSERT INTO app.occupancy (org_id, unit_id, starts_at, status)
      VALUES ($1, $2, '2026-01-01T00:00:00Z', 'ACTIVE') RETURNING id
    `, [identity.orgId, unitId]));
    return { ...identity, propertyId, unitId, occupancyId: occupancy.rows[0]!.id };
  }

  it.each(["", " ", " PADDED", "PADDED ", "x".repeat(513)])(
    "rejects invalid property reference %j", async (reference) => {
      const { orgId } = await createIdentityAndOrganization();
      await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
        INSERT INTO app.property (org_id, address_reference, status)
        VALUES ($1, $2, 'ACTIVE')
      `, [orgId, reference]))).rejects.toMatchObject({
        code: "23514", constraint: "property_address_reference_shape",
      });
    },
  );

  it.each(["", " ", " PADDED", "PADDED ", "x".repeat(81), "CONTROL\nLABEL"])(
    "rejects invalid unit label %j", async (label) => {
      const { orgId, propertyId } = await createRelationshipFixture();
      await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
        INSERT INTO app.unit (org_id, property_id, label, status)
        VALUES ($1, $2, $3, 'ACTIVE')
      `, [orgId, propertyId, label]))).rejects.toMatchObject({
        code: "23514", constraint: "unit_label_shape",
      });
    },
  );

  it("rejects case-only duplicate active labels while allowing archived history", async () => {
    const { orgId, propertyId } = await createRelationshipFixture();
    const insert = (status: string) => withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.unit (org_id, property_id, label, status)
      VALUES ($1, $2, 'synthetic_unit', $3) RETURNING status
    `, [orgId, propertyId, status]));
    await expect(insert("ACTIVE")).rejects.toMatchObject({
      code: "23505", constraint: "unit_active_label_unique",
    });
    expect((await insert("ARCHIVED")).rows[0]?.status).toBe("ARCHIVED");
    expect((await insert("ARCHIVED")).rows[0]?.status).toBe("ARCHIVED");
  });

  it("rejects a cross-organization unit parent with a foreign-key violation", async () => {
    const { propertyId } = await createRelationshipFixture();
    const other = await createIdentityAndOrganization();
    await expect(withOrgTransaction(migrationDatabase, other.orgId, (client) => client.query(`
      INSERT INTO app.unit (org_id, property_id, label, status)
      VALUES ($1, $2, 'OTHER_SYNTHETIC_UNIT', 'ACTIVE')
    `, [other.orgId, propertyId]))).rejects.toMatchObject({
      code: "23503", constraint: "unit_property_fk",
    });
  });

  it("F23 candidate: concurrent runtime inserts wait on a lock and leave exactly one ACTIVE occupancy", async () => {
    const { orgId } = await createIdentityAndOrganization();
    const unitId = await withOrgTransaction(migrationDatabase, orgId, async (client) => {
      const property = await client.query<{ id: string }>(`
        INSERT INTO app.property (org_id, address_reference, status)
        VALUES ($1, 'SYNTHETIC_F23_PROPERTY', 'ACTIVE') RETURNING id
      `, [orgId]);
      const unit = await client.query<{ id: string }>(`
        INSERT INTO app.unit (org_id, property_id, label, status)
        VALUES ($1, $2, 'SYNTHETIC_F23_UNIT', 'ACTIVE') RETURNING id
      `, [orgId, property.rows[0]!.id]);
      return unit.rows[0]!.id;
    });
    // Local bounds also release B if coordination fails; no global timeout changes.
    const bounds = { connectionTimeoutMillis: 5_000, statement_timeout: 4_000, query_timeout: 5_000 };
    const clientA = new Client({ ...runtimeConfig, ...bounds });
    const clientB = new Client({ ...runtimeConfig, ...bounds });
    const diagnostic = new Client({ ...postgres!.adminConfig, ...bounds });
    const failures: unknown[] = [];
    let connectedA = false;
    let connectedB = false;
    let conflictingInsert: Promise<{ ok: true } | { ok: false; error: unknown }> | undefined;
    try {
      await clientA.connect();
      connectedA = true;
      await clientB.connect();
      connectedB = true;
      await diagnostic.connect();
      const pids: number[] = [];
      for (const client of [clientA, clientB]) {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
        const identity = await client.query<{ pid: number; role: string }>(
          "SELECT pg_backend_pid() AS pid, current_user AS role",
        );
        expect(identity.rows[0]!.role).toBe(TEST_RUNTIME_ROLE);
        pids.push(identity.rows[0]!.pid);
      }
      const diagnosticPid = (await diagnostic.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      )).rows[0]!.pid;
      expect(new Set([...pids, diagnosticPid]).size).toBe(3);
      const [pidA, pidB] = pids;
      const insert = `INSERT INTO app.occupancy (org_id, unit_id, starts_at, status)
        VALUES ($1, $2, transaction_timestamp(), 'ACTIVE')`;
      await clientA.query(insert, [orgId, unitId]);
      // Attach both handlers immediately, before any diagnostic await.
      conflictingInsert = clientB.query(insert, [orgId, unitId]).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      type LockObservation = { wait_event_type: string | null; wait_event: string | null; blockers: number[] };
      let observation: LockObservation | undefined;
      const deadline = performance.now() + 2_000;
      do {
        const activity = await diagnostic.query<LockObservation>(`
          SELECT wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers
          FROM pg_stat_activity WHERE pid = $1
        `, [pidB]);
        observation = activity.rows[0];
        if (observation?.wait_event_type === "Lock" && observation.blockers.includes(pidA!)) break;
        // Poll pacing is not evidence: only the server observation can satisfy the assertion.
        await new Promise((resolve) => setTimeout(resolve, 10));
      } while (performance.now() < deadline);
      expect(observation, "B must be observed waiting on A before A commits").toMatchObject({
        wait_event_type: "Lock", blockers: expect.arrayContaining([pidA]),
      });
      await clientA.query("COMMIT");
      const result = await conflictingInsert;
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected the concurrent ACTIVE insert to fail");
      expect(result.error).toMatchObject({ code: "23505", constraint: "occupancy_one_active_unit" });
      await clientB.query("ROLLBACK");
      await clientA.query("BEGIN");
      await clientA.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
      const count = await clientA.query<{ count: number }>(`
        SELECT count(*)::integer AS count FROM app.occupancy
        WHERE org_id = $1 AND unit_id = $2 AND status = 'ACTIVE'
      `, [orgId, unitId]);
      expect(count.rows[0]!.count).toBe(1);
      await clientA.query("COMMIT");
      console.info("F23 concurrency evidence", { pidA, pidB, diagnosticPid, observation, sqlstate: "23505", activeCount: count.rows[0]!.count });
    } catch (error) {
      failures.push(error);
    } finally {
      // Release A before awaiting B: B may still be blocked on A after an assertion failure.
      if (connectedA) {
        try { await clientA.query("ROLLBACK"); } catch (error) { failures.push(error); }
      }
      try { await clientA.end(); } catch (error) { failures.push(error); }
      if (conflictingInsert) await conflictingInsert;
      if (connectedB) {
        try { await clientB.query("ROLLBACK"); } catch (error) { failures.push(error); }
      }
      const closed = await Promise.allSettled([clientB.end(), diagnostic.end()]);
      for (const result of closed) {
        if (result.status === "rejected") failures.push(result.reason);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "F23 operation and cleanup failures", { cause: failures[0] });
  });

  it("rejects a second ACTIVE occupancy while allowing ended history", async () => {
    const { orgId, unitId } = await createRelationshipFixture();
    const insert = (status: string) => withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.occupancy (org_id, unit_id, starts_at, ends_at, status)
      VALUES ($1, $2, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', $3)
      RETURNING version
    `, [orgId, unitId, status]));
    await expect(insert("ACTIVE")).rejects.toMatchObject({
      code: "23505", constraint: "occupancy_one_active_unit",
    });
    expect((await insert("ENDED")).rows[0]?.version).toBe(1);
    expect((await insert("ENDED")).rows[0]?.version).toBe(1);
  });

  it.each([null, "2026-01-01T00:00:00Z", "2025-12-31T00:00:00Z"])(
    "rejects an ENDED occupancy with invalid ends_at %s", async (endsAt) => {
      const { orgId, unitId } = await createRelationshipFixture();
      await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
        INSERT INTO app.occupancy (org_id, unit_id, starts_at, ends_at, status)
        VALUES ($1, $2, '2026-01-01T00:00:00Z', $3, 'ENDED')
      `, [orgId, unitId, endsAt]))).rejects.toMatchObject({
        code: "23514", constraint: "occupancy_time_shape",
      });
    },
  );

  it("rejects occupancy versions below one", async () => {
    const { orgId, occupancyId } = await createRelationshipFixture();
    await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(
      "UPDATE app.occupancy SET version = 0 WHERE id = $1", [occupancyId],
    ))).rejects.toMatchObject({ code: "23514", constraint: "occupancy_version_check" });
  });

  it("rejects a duplicate ACTIVE member while allowing ended history and other users", async () => {
    const { orgId, occupancyId, userId } = await createRelationshipFixture();
    const insert = (memberId: string, status: string) => withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.occupancy_member
        (org_id, occupancy_id, user_id, joined_at, ended_at, status)
      VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', $4)
      RETURNING status
    `, [orgId, occupancyId, memberId, status]));
    expect((await insert(userId, "ACTIVE")).rows[0]?.status).toBe("ACTIVE");
    await expect(insert(userId, "ACTIVE")).rejects.toMatchObject({
      code: "23505", constraint: "occupancy_member_one_active_user",
    });
    expect((await insert(userId, "ENDED")).rows[0]?.status).toBe("ENDED");
    expect((await insert(userId, "ENDED")).rows[0]?.status).toBe("ENDED");
    const other = await createIdentityAndOrganization();
    expect((await insert(other.userId, "ACTIVE")).rows[0]?.status).toBe("ACTIVE");
  });

  it.each([null, "2025-12-31T00:00:00Z"])(
    "rejects an ENDED member with invalid ended_at %s", async (endedAt) => {
      const { orgId, occupancyId, userId } = await createRelationshipFixture();
      await expect(withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
        INSERT INTO app.occupancy_member
          (org_id, occupancy_id, user_id, joined_at, ended_at, status)
        VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', $4, 'ENDED')
      `, [orgId, occupancyId, userId, endedAt]))).rejects.toMatchObject({
        code: "23514", constraint: "occupancy_member_time_shape",
      });
    },
  );

  it("allows member ending exactly at joining time", async () => {
    const { orgId, occupancyId, userId } = await createRelationshipFixture();
    const result = await withOrgTransaction(migrationDatabase, orgId, (client) => client.query(`
      INSERT INTO app.occupancy_member
        (org_id, occupancy_id, user_id, joined_at, ended_at, status)
      VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'ENDED')
      RETURNING status
    `, [orgId, occupancyId, userId]));
    expect(result.rows[0]?.status).toBe("ENDED");
  });

  it("stores the actual composite parent columns without cascading deletes", async () => {
    const result = await migrationClient.query(`
      SELECT source.relname AS source_table, target.relname AS target_table,
        ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, pos)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num
          ORDER BY k.pos) AS source_columns,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num, pos)
          JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num
          ORDER BY k.pos) AS target_columns,
        c.confdeltype AS delete_action
      FROM pg_constraint c
      JOIN pg_class source ON source.oid = c.conrelid
      JOIN pg_class target ON target.oid = c.confrelid
      JOIN pg_namespace ns ON ns.oid = source.relnamespace
      WHERE ns.nspname = 'app' AND c.contype = 'f'
        AND source.relname IN ('property', 'unit', 'occupancy', 'occupancy_member')
      ORDER BY source.relname, target.relname
    `);
    expect(result.rows).toEqual([
      { source_table: "occupancy", target_table: "unit", source_columns: ["org_id", "unit_id"], target_columns: ["org_id", "id"], delete_action: "a" },
      { source_table: "occupancy_member", target_table: "app_user", source_columns: ["user_id"], target_columns: ["id"], delete_action: "a" },
      { source_table: "occupancy_member", target_table: "occupancy", source_columns: ["org_id", "occupancy_id"], target_columns: ["org_id", "id"], delete_action: "a" },
      { source_table: "property", target_table: "organization", source_columns: ["org_id"], target_columns: ["id"], delete_action: "a" },
      { source_table: "unit", target_table: "property", source_columns: ["org_id", "property_id"], target_columns: ["org_id", "id"], delete_action: "a" },
    ]);
  });

  it("stores unique ACTIVE-only indexes with exact keys and C collation", async () => {
    const result = await migrationClient.query(`
      SELECT t.relname AS table_name, i.indisunique AS is_unique,
        ARRAY(SELECT pg_get_indexdef(i.indexrelid, k, true)
          FROM generate_series(1, i.indnkeyatts) k) AS keys,
        ARRAY(SELECT col.collname::text
          FROM unnest(i.indcollation) WITH ORDINALITY k(collation_id, pos)
          LEFT JOIN pg_collation col ON col.oid = k.collation_id
          ORDER BY k.pos) AS collations,
        pg_get_expr(i.indpred, i.indrelid) AS predicate,
        i.indisvalid AS is_valid
      FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
      WHERE ns.nspname = 'app' AND i.indpred IS NOT NULL
        AND t.relname IN ('unit', 'occupancy', 'occupancy_member')
      ORDER BY t.relname
    `);
    expect(result.rows).toEqual([
      { table_name: "occupancy", is_unique: true, keys: ["org_id", "unit_id"], collations: [null, null], predicate: "(status = 'ACTIVE'::text)", is_valid: true },
      { table_name: "occupancy_member", is_unique: true, keys: ["org_id", "occupancy_id", "user_id"], collations: [null, null, null], predicate: "(status = 'ACTIVE'::text)", is_valid: true },
      { table_name: "unit", is_unique: true, keys: ["org_id", "property_id", "lower(label)"], collations: [null, null, "C"], predicate: "(status = 'ACTIVE'::text)", is_valid: true },
    ]);
  });
});

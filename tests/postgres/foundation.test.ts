import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client, type ClientConfig } from "pg";
import {
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
    runtimeConfig = roles.runtimeConfig;
  }, 120_000);

  afterAll(async () => {
    try {
      await migrationClient?.end();
    } finally {
      await postgres?.stop();
    }
  }, 60_000);

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

  async function createIdentityAndOrganization() {
    const user = await migrationClient.query<{ id: string }>(
      "INSERT INTO app.app_user (status) VALUES ('ACTIVE') RETURNING id",
    );
    const organization = await migrationClient.query<{ id: string }>(
      "INSERT INTO app.organization (status, display_name) VALUES ('ACTIVE', $1) RETURNING id",
      ["SYNTHETIC_PF02A_ORG"],
    );
    return { userId: user.rows[0]!.id, orgId: organization.rows[0]!.id };
  }

  it("creates synthetic identity and organization rows with UUIDv7 defaults", async () => {
    const { userId, orgId } = await createIdentityAndOrganization();
    expect(userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(orgId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const columns = await migrationClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'app_user'
      ORDER BY ordinal_position
    `);
    expect(columns.rows.map((row) => row.column_name)).toEqual(["id", "status", "created_at"]);
  });

  it.each(["", " ", " PADDED", "PADDED ", "x".repeat(161)])(
    "rejects invalid organization display name %j", async (displayName) => {
      await expect(migrationClient.query(
        "INSERT INTO app.organization (status, display_name) VALUES ('ACTIVE', $1)",
        [displayName],
      )).rejects.toMatchObject({ code: "23514", constraint: "organization_display_name_shape" });
    },
  );

  it("rejects a second ACTIVE membership for the same organization and user", async () => {
    const { userId, orgId } = await createIdentityAndOrganization();
    const insert = () => migrationClient.query(`
      INSERT INTO app.organization_membership (org_id, user_id, role, status)
      VALUES ($1, $2, 'ORG_ADMIN', 'ACTIVE') RETURNING version, ended_at
    `, [orgId, userId]);
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
    await expect(migrationClient.query(`
      INSERT INTO app.organization_membership
        (org_id, user_id, role, status, created_at, ended_at)
      VALUES ($1, $2, 'PROPERTY_STAFF', $3, '2026-01-01T00:00:00Z', $4)
    `, [orgId, userId, status, endedAt])).rejects.toMatchObject({
      code: "23514", constraint: "organization_membership_status_time",
    });
  });

  it("allows ended membership history alongside a new active membership", async () => {
    const { userId, orgId } = await createIdentityAndOrganization();
    await migrationClient.query(`
      INSERT INTO app.organization_membership
        (org_id, user_id, role, status, ended_at)
      VALUES ($1, $2, 'ORG_ADMIN', 'ENDED', transaction_timestamp()),
             ($1, $2, 'PROPERTY_STAFF', 'ENDED', transaction_timestamp()),
             ($1, $2, 'PROPERTY_STAFF', 'ACTIVE', NULL)
    `, [orgId, userId]);
    const count = await migrationClient.query(`
      SELECT count(*)::integer AS count FROM app.organization_membership
      WHERE org_id = $1 AND user_id = $2
    `, [orgId, userId]);
    expect(count.rows[0]?.count).toBe(3);
  });
});

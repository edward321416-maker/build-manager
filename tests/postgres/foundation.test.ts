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
  async function createRelationshipFixture() {
    const identity = await createIdentityAndOrganization();
    const property = await migrationClient.query<{ id: string }>(`
      INSERT INTO app.property (org_id, address_reference, status)
      VALUES ($1, 'SYNTHETIC_BUILDING_REFERENCE', 'ACTIVE') RETURNING id
    `, [identity.orgId]);
    const propertyId = property.rows[0]!.id;
    const unit = await migrationClient.query<{ id: string }>(`
      INSERT INTO app.unit (org_id, property_id, label, status)
      VALUES ($1, $2, 'SYNTHETIC_UNIT', 'ACTIVE') RETURNING id
    `, [identity.orgId, propertyId]);
    const unitId = unit.rows[0]!.id;
    const occupancy = await migrationClient.query<{ id: string }>(`
      INSERT INTO app.occupancy (org_id, unit_id, starts_at, status)
      VALUES ($1, $2, '2026-01-01T00:00:00Z', 'ACTIVE') RETURNING id
    `, [identity.orgId, unitId]);
    return { ...identity, propertyId, unitId, occupancyId: occupancy.rows[0]!.id };
  }

  it.each(["", " ", " PADDED", "PADDED ", "x".repeat(513)])(
    "rejects invalid property reference %j", async (reference) => {
      const { orgId } = await createIdentityAndOrganization();
      await expect(migrationClient.query(`
        INSERT INTO app.property (org_id, address_reference, status)
        VALUES ($1, $2, 'ACTIVE')
      `, [orgId, reference])).rejects.toMatchObject({
        code: "23514", constraint: "property_address_reference_shape",
      });
    },
  );

  it.each(["", " ", " PADDED", "PADDED ", "x".repeat(81), "CONTROL\nLABEL"])(
    "rejects invalid unit label %j", async (label) => {
      const { orgId, propertyId } = await createRelationshipFixture();
      await expect(migrationClient.query(`
        INSERT INTO app.unit (org_id, property_id, label, status)
        VALUES ($1, $2, $3, 'ACTIVE')
      `, [orgId, propertyId, label])).rejects.toMatchObject({
        code: "23514", constraint: "unit_label_shape",
      });
    },
  );

  it("rejects case-only duplicate active labels while allowing archived history", async () => {
    const { orgId, propertyId } = await createRelationshipFixture();
    const insert = (status: string) => migrationClient.query(`
      INSERT INTO app.unit (org_id, property_id, label, status)
      VALUES ($1, $2, 'synthetic_unit', $3) RETURNING status
    `, [orgId, propertyId, status]);
    await expect(insert("ACTIVE")).rejects.toMatchObject({
      code: "23505", constraint: "unit_active_label_unique",
    });
    expect((await insert("ARCHIVED")).rows[0]?.status).toBe("ARCHIVED");
    expect((await insert("ARCHIVED")).rows[0]?.status).toBe("ARCHIVED");
  });

  it("rejects a cross-organization unit parent with a foreign-key violation", async () => {
    const { propertyId } = await createRelationshipFixture();
    const other = await createIdentityAndOrganization();
    await expect(migrationClient.query(`
      INSERT INTO app.unit (org_id, property_id, label, status)
      VALUES ($1, $2, 'OTHER_SYNTHETIC_UNIT', 'ACTIVE')
    `, [other.orgId, propertyId])).rejects.toMatchObject({
      code: "23503", constraint: "unit_property_fk",
    });
  });

  it("rejects a second ACTIVE occupancy while allowing ended history", async () => {
    const { orgId, unitId } = await createRelationshipFixture();
    const insert = (status: string) => migrationClient.query(`
      INSERT INTO app.occupancy (org_id, unit_id, starts_at, ends_at, status)
      VALUES ($1, $2, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', $3)
      RETURNING version
    `, [orgId, unitId, status]);
    await expect(insert("ACTIVE")).rejects.toMatchObject({
      code: "23505", constraint: "occupancy_one_active_unit",
    });
    expect((await insert("ENDED")).rows[0]?.version).toBe(1);
    expect((await insert("ENDED")).rows[0]?.version).toBe(1);
  });

  it.each([null, "2026-01-01T00:00:00Z", "2025-12-31T00:00:00Z"])(
    "rejects an ENDED occupancy with invalid ends_at %s", async (endsAt) => {
      const { orgId, unitId } = await createRelationshipFixture();
      await expect(migrationClient.query(`
        INSERT INTO app.occupancy (org_id, unit_id, starts_at, ends_at, status)
        VALUES ($1, $2, '2026-01-01T00:00:00Z', $3, 'ENDED')
      `, [orgId, unitId, endsAt])).rejects.toMatchObject({
        code: "23514", constraint: "occupancy_time_shape",
      });
    },
  );

  it("rejects occupancy versions below one", async () => {
    const { occupancyId } = await createRelationshipFixture();
    await expect(migrationClient.query(
      "UPDATE app.occupancy SET version = 0 WHERE id = $1", [occupancyId],
    )).rejects.toMatchObject({ code: "23514", constraint: "occupancy_version_check" });
  });

  it("rejects a duplicate ACTIVE member while allowing ended history and other users", async () => {
    const { orgId, occupancyId, userId } = await createRelationshipFixture();
    const insert = (memberId: string, status: string) => migrationClient.query(`
      INSERT INTO app.occupancy_member
        (org_id, occupancy_id, user_id, joined_at, ended_at, status)
      VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', $4)
      RETURNING status
    `, [orgId, occupancyId, memberId, status]);
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
      await expect(migrationClient.query(`
        INSERT INTO app.occupancy_member
          (org_id, occupancy_id, user_id, joined_at, ended_at, status)
        VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', $4, 'ENDED')
      `, [orgId, occupancyId, userId, endedAt])).rejects.toMatchObject({
        code: "23514", constraint: "occupancy_member_time_shape",
      });
    },
  );

  it("allows member ending exactly at joining time", async () => {
    const { orgId, occupancyId, userId } = await createRelationshipFixture();
    const result = await migrationClient.query(`
      INSERT INTO app.occupancy_member
        (org_id, occupancy_id, user_id, joined_at, ended_at, status)
      VALUES ($1, $2, $3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'ENDED')
      RETURNING status
    `, [orgId, occupancyId, userId]);
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

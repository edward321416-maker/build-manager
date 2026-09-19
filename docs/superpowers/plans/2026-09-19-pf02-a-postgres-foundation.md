# PF02-A PostgreSQL Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PF02-A PostgreSQL persistence foundation as a reviewable implementation candidate that proves real PostgreSQL 18.6 isolation, transaction, role, foreign-key, and concurrency behavior without changing the frozen demo-v1 persistence path.

**Architecture:** Add `packages/persistence-postgres` as a production-only adapter package behind the existing domain/application boundary. The package owns an opaque node-postgres Pool, explicit SQL migrations, transaction-scoped organization context, and PostgreSQL integration-test helpers; Docker-backed tests live under `tests/postgres`, not under `packages/**/*.test.ts`, so the existing Shared suite remains Docker-independent. The first execution stops with an open implementation PR at `PF02-A = READY_FOR_ACCEPTANCE`; it does not merge or mark PF02-A VERIFIED.

**Tech Stack:** Node 24.21.0, npm 11.19.0, TypeScript 6.0.3, Vitest 5.0.0, PostgreSQL 18.6, pg 8.23.0, @types/pg 8.23.1, @testcontainers/postgresql 12.1.0, node-pg-migrate 9.0.0, GitHub Actions ubuntu-24.04.

**Spec:** `docs/superpowers/specs/2026-09-19-pf02-a-postgres-foundation-design.md`

## Global Constraints

- POLICY_REF for this plan: `main@9418211a4ab242024f687486f9626c32925b964d`. Refresh policies before execution; if main moved before the approved design/plan is published, stop instead of silently rebasing.
- The approved design branch is `docs/pf02-a-postgres-design`; implementation begins only after the approved spec/plan are published to canonical main.
- PF00 remains `FROZEN`; existing SQLite/demo-v1 behavior is not redesigned or migrated.
- New production adapter path: `packages/persistence-postgres`.
- Exact new dependency versions: `pg@8.23.0`, `@types/pg@8.23.1`, `@testcontainers/postgresql@12.1.0`, `node-pg-migrate@9.0.0`.
- No ORM/query builder.
- Test image is exactly `postgres:18.6`; acceptance requires `server_version_num = 180006`.
- Real tenant/landlord identities, addresses tied to people, credentials, hosted production DBs, identity providers, invitations, tickets, media, and notifications are outside PF02-A.
- `app_user`, Organization, Membership, Property, Unit, Occupancy, OccupancyMember are the only initial business entities.
- `PropertyAssignment` is deferred to PF02-B with authenticated staff scope.
- Runtime role is non-owner, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, and outside privileged inherited membership.
- Migrations run as a separate non-superuser migration-owner role, never as the Testcontainers admin/superuser.
- Organization-scoped RLS context is transaction-local `app.org_id`; the helper normalizes unknown and empty-string reset states to SQL NULL.
- The public package contract never exposes the raw `pg.Pool`.
- No production fallback to SQLite or fixtures.
- Existing PF00 regression checks are never reduced or skipped.
- Canonical F-case closure in this slice is limited to F18, F19, F23. F01/F16/F41/F43 receive database prerequisite evidence only and remain `NOT_RUN`.
- No `npm audit fix`, `npm audit fix --force`, install-script approval, action-major upgrade, force push, rebase, history rewrite, or branch deletion.
- Protect the existing platform-specific lockfile key baseline; disappearance is STOP_AND_REVIEW, not a manual lockfile reinjection.
- First implementation run ends with an open PR and `PF02-A = READY_FOR_ACCEPTANCE`; no merge and no `VERIFIED` claim.

## Review Focus

1. **RLS false PASS:** Task 5 proves the runtime credential is not owner/superuser/BYPASSRLS, has no privileged membership, and runs the isolation assertions itself.
2. **Transaction context leak/escape:** Task 4 hides the raw Pool, and Task 5 reuses a max-1 pool across commit/rollback while asserting the normalized context returns NULL before the next organization is set.
3. **Cross-org FK false confidence:** Task 6 inspects `pg_constraint` and requires SQLSTATE `23503`, not a generic RLS error, for the database prerequisite to F41.
4. **Fake concurrency:** Task 7 uses two runtime backends plus a third diagnostic connection, proves backend B is waiting on a lock, then requires SQLSTATE `23505` after backend A commits.
5. **Demo/test contamination:** Task 8 statically rejects imports of `node:sqlite`, `@build-manager/fixtures`, and demo persistence from the new package and proves Docker-backed tests are outside the Shared discovery pattern.

## Planned File Map

**Create**
- `packages/persistence-postgres/package.json`
- `packages/persistence-postgres/src/index.ts`
- `packages/persistence-postgres/src/database.ts`
- `packages/persistence-postgres/src/transaction.ts`
- `packages/persistence-postgres/src/context.ts`
- `packages/persistence-postgres/src/testing/index.ts`
- `packages/persistence-postgres/src/testing/postgres-container.ts`
- `packages/persistence-postgres/src/testing/roles.ts`
- `packages/persistence-postgres/src/testing/migrate.ts`
- `packages/persistence-postgres/migrations/0001_core_identity_organization.sql`
- `packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql`
- `packages/persistence-postgres/migrations/0003_runtime_isolation.sql`
- `vitest.postgres.config.ts`
- `tests/postgres/foundation.test.ts`
- `tests/architecture/postgres-boundary.test.ts`

**Modify**
- `package.json`
- `package-lock.json`
- `.github/workflows/app-check.yml`
- `ops/AI_Execution_Log.csv`

**Do not modify in the first implementation PR**
- `docs/production-foundation/acceptance_cases.json`
- `STATUS.md`
- existing SQLite/demo persistence files
- existing Web/Mobile product routes
- existing Jest/Vitest global timeout settings
- production-foundation revision/checksum files

---

## Pre-Execution Publication Gate

This gate runs only after the operator approves this written plan.

- [ ] **P1: Verify the design/plan branch has not diverged from the reviewed state**

Require:
- `origin/main = 9418211a4ab242024f687486f9626c32925b964d` unless a new operator-side review explicitly accepts a moved main.
- `docs/pf02-a-postgres-design` contains only the reviewed spec, this plan, and append-only execution-log events relative to that main.
- No product/workflow/dependency files are present on the documentation branch.

- [ ] **P2: Open the documentation approval PR**

Suggested title:

```text
docs: approve PF02-A postgres design and plan
```

The PR body records:
- D02a choice;
- package boundary choice;
- spec blob/ref;
- plan path/ref;
- implementation remains not started.

- [ ] **P3: Require the existing eight PF00-era checks on the exact docs PR head**

Require:

```text
verify
repository-safety
apps
mobile-cold-linux
install-mobile-windows
web-e2e
mobile-health
foundation-gate
```

Do not treat CodeRabbit `SUCCESS_STATUS` as review evidence when its comment says review skipped.

- [ ] **P4: Merge the approved documentation PR with a merge commit and expected-head protection**

Preserve `docs/pf02-a-postgres-design`.

Then require fresh push-to-main execution of the same eight checks on the actual merge SHA.

Only after that main publication is green:
- record `PF02_A_IMPLEMENTATION_BASE=<actual merge SHA>`;
- create `feat/pf02-a-postgres-foundation` from exactly that SHA;
- begin Task 1.

If publication/main CI fails, stop before product implementation.

---

### Task 1: Bootstrap the package, exact dependencies, Docker-isolated test discovery, and PostgreSQL 18.6 startup proof

**Files:**
- Create: `packages/persistence-postgres/package.json`
- Create: `packages/persistence-postgres/src/index.ts`
- Create: `packages/persistence-postgres/src/testing/index.ts`
- Create: `packages/persistence-postgres/src/testing/postgres-container.ts`
- Create: `vitest.postgres.config.ts`
- Create: `tests/postgres/foundation.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `startPostgres18Container(): Promise<Postgres18Container>`
- Produces: root command `npm run test:postgres`
- Produces: isolated test discovery `tests/postgres/**/*.test.ts`
- Later tasks consume the started container's admin connection config and database name.

- [ ] **Step 1: Record dependency/security and cross-platform lock baselines before changing manifests**

Run from repository root in WSL2/bash:

```bash
git status --short
node --version
npm --version
npm audit --json > /tmp/pf02a-audit-before.json || true
node --input-type=module <<'NODE' > /tmp/pf02a-platform-keys-before.json
import { readFileSync } from "node:fs";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const prefixes = [
  "node_modules/@tailwindcss/oxide-",
  "node_modules/@next/swc-",
  "node_modules/@img/sharp-",
  "node_modules/@unrs/resolver-binding-",
];
const keys = Object.keys(lock.packages ?? {})
  .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
  .sort();
process.stdout.write(JSON.stringify(keys, null, 2));
NODE
```

Expected:
- Node `v24.21.0`.
- npm `11.19.0`.
- Baseline files are private local receipts, not committed.
- No attempt to remediate audit findings.

- [ ] **Step 2: Write the first failing PostgreSQL integration test**

Create `tests/postgres/foundation.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startPostgres18Container,
  type Postgres18Container,
} from "@build-manager/persistence-postgres/testing";

describe.sequential("PF02-A PostgreSQL foundation", () => {
  let postgres: Postgres18Container;

  beforeAll(async () => {
    postgres = await startPostgres18Container();
  }, 120_000);

  afterAll(async () => {
    await postgres.stop();
  }, 60_000);

  it("runs the exact PostgreSQL 18.6 server", async () => {
    const result = await postgres.admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );

    expect(result.rows[0]?.server_version_num).toBe("180006");
  });
});
```

Create `vitest.postgres.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/postgres/**/*.test.ts"],
    passWithNoTests: false,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
```

Modify root `package.json` scripts:

```json
"test:postgres": "vitest run --config vitest.postgres.config.ts"
```

Expected RED: TypeScript/module resolution fails because the new workspace/testing export does not exist yet.

- [ ] **Step 3: Create the workspace manifest and install only the approved exact versions**

Create `packages/persistence-postgres/package.json`:

```json
{
  "name": "@build-manager/persistence-postgres",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/index.ts"
  },
  "dependencies": {
    "pg": "8.23.0"
  },
  "devDependencies": {
    "@testcontainers/postgresql": "12.1.0",
    "@types/pg": "8.23.1",
    "node-pg-migrate": "9.0.0"
  }
}
```

Run:

```bash
npm install --workspace @build-manager/persistence-postgres
```

Do not run `expo install --fix`, `npm audit fix`, or any dependency upgrade command.

Immediately verify:

```bash
npm ls --workspace @build-manager/persistence-postgres pg @types/pg @testcontainers/postgresql node-pg-migrate
```

Expected exact resolved versions: 8.23.0 / 8.23.1 / 12.1.0 / 9.0.0.

- [ ] **Step 4: Verify protected platform lock entries survived the install**

Run:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
const before = JSON.parse(readFileSync("/tmp/pf02a-platform-keys-before.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const prefixes = [
  "node_modules/@tailwindcss/oxide-",
  "node_modules/@next/swc-",
  "node_modules/@img/sharp-",
  "node_modules/@unrs/resolver-binding-",
];
const after = Object.keys(lock.packages ?? {})
  .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
  .sort();
const missing = before.filter((key) => !after.includes(key));
console.log(JSON.stringify({ before: before.length, after: after.length, missing }, null, 2));
if (missing.length > 0) process.exit(1);
NODE
```

Expected: `missing: []`. If any baseline key is missing, stop; do not edit the lockfile by hand.

- [ ] **Step 5: Implement the exact-version Testcontainers helper**

Create `packages/persistence-postgres/src/testing/postgres-container.ts`:

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client, type ClientConfig } from "pg";

export type Postgres18Container = {
  readonly container: StartedPostgreSqlContainer;
  readonly admin: Client;
  readonly adminConfig: ClientConfig;
  readonly database: string;
  stop(): Promise<void>;
};

export async function startPostgres18Container(): Promise<Postgres18Container> {
  const container = await new PostgreSqlContainer("postgres:18.6").start();
  const adminConfig: ClientConfig = {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
  };
  adminConfig.password = container.getPassword();
  const admin = new Client(adminConfig);

  try {
    await admin.connect();
    const result = await admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    if (result.rows[0]?.server_version_num !== "180006") {
      throw new Error(
        `Expected PostgreSQL server_version_num 180006, got ${result.rows[0]?.server_version_num ?? "missing"}`,
      );
    }
  } catch (error) {
    await admin.end().catch(() => undefined);
    await container.stop().catch(() => undefined);
    throw error;
  }

  let stopped = false;
  return {
    container,
    admin,
    adminConfig,
    database: container.getDatabase(),
    async stop() {
      if (stopped) return;
      stopped = true;
      await admin.end().catch(() => undefined);
      await container.stop();
    },
  };
}
```

Create `packages/persistence-postgres/src/testing/index.ts`:

```ts
export * from "./postgres-container";
```

Create `packages/persistence-postgres/src/index.ts` initially as:

```ts
export {};
```

- [ ] **Step 6: Run the first GREEN**

Run:

```bash
npm run test:postgres
npm run test:shared
npm run typecheck
```

Expected:
- PostgreSQL suite discovers at least one test and passes.
- Shared suite remains Docker-independent.
- Typecheck includes the new package source and root tests.

- [ ] **Step 7: Record the post-install dependency snapshot without remediation**

Run:

```bash
npm audit --json > /tmp/pf02a-audit-after-task1.json || true
git diff -- package.json package-lock.json packages/persistence-postgres/package.json
```

Stop if the new graph introduces a HIGH/CRITICAL advisory or unexplained install script. MODERATE additions must be attributed in the final PR report.

- [ ] **Step 8: Commit Task 1**

```bash
git add package.json package-lock.json vitest.postgres.config.ts packages/persistence-postgres/package.json packages/persistence-postgres/src/index.ts packages/persistence-postgres/src/testing/index.ts packages/persistence-postgres/src/testing/postgres-container.ts tests/postgres/foundation.test.ts
git commit -m "feat: bootstrap postgres integration foundation"
```

---

### Task 2: Provision separated test roles, run migrations as the migration owner, and create the core identity/organization schema

**Files:**
- Create: `packages/persistence-postgres/src/testing/roles.ts`
- Create: `packages/persistence-postgres/src/testing/migrate.ts`
- Create: `packages/persistence-postgres/migrations/0001_core_identity_organization.sql`
- Modify: `packages/persistence-postgres/src/testing/index.ts`
- Modify: `tests/postgres/foundation.test.ts`

**Interfaces:**
- Produces: `provisionTestRoles(admin, database): Promise<TestRoleCredentials>`
- Produces: `runPostgresMigrations(client): Promise<void>`
- Produces: `migrationConfig` and `runtimeConfig` for later tasks.

- [ ] **Step 1: Extend the integration test with a RED role/migration-owner assertion**

Append to the suite setup so the harness provisions roles and runs migrations, then add:

```ts
it("runs migrations as a dedicated non-superuser migration owner", async () => {
  const owner = await migrationClient.query<{
    current_user: string;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>(`
    SELECT current_user,
           r.rolsuper,
           r.rolcreatedb,
           r.rolcreaterole,
           r.rolreplication,
           r.rolbypassrls
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);

  expect(owner.rows[0]).toMatchObject({
    current_user: TEST_MIGRATION_ROLE,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    rolbypassrls: false,
  });

  const tableOwner = await migrationClient.query<{ owner: string }>(`
    SELECT pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app' AND c.relname = 'organization'
  `);

  expect(tableOwner.rows[0]?.owner).toBe(TEST_MIGRATION_ROLE);
});
```

Expected RED because role provisioning/migrations do not exist.

- [ ] **Step 2: Implement synthetic non-privileged roles**

Create `roles.ts` with fixed safe identifiers and random hexadecimal passwords:

```ts
import { randomBytes } from "node:crypto";
import type { Client, ClientConfig } from "pg";

export const TEST_MIGRATION_ROLE = "bm_pf02a_migrator";
export const TEST_RUNTIME_ROLE = "bm_pf02a_runtime";

export type TestRoleCredentials = {
  readonly migrationConfig: ClientConfig;
  readonly runtimeConfig: ClientConfig;
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function provisionTestRoles(
  admin: Client,
  adminConfig: ClientConfig,
  database: string,
): Promise<TestRoleCredentials> {
  const migrationPassword = `m_${randomBytes(24).toString("hex")}`;
  const runtimePassword = `r_${randomBytes(24).toString("hex")}`;

  await admin.query(`
    CREATE ROLE ${TEST_MIGRATION_ROLE}
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${migrationPassword}'
  `);
  await admin.query(`
    CREATE ROLE ${TEST_RUNTIME_ROLE}
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${runtimePassword}'
  `);
  await admin.query(
    `GRANT CREATE ON DATABASE ${quoteIdentifier(database)} TO ${TEST_MIGRATION_ROLE}`,
  );

  const base = {
    host: adminConfig.host,
    port: adminConfig.port,
    database,
  };

  return {
    migrationConfig: { ...base, user: TEST_MIGRATION_ROLE, password: migrationPassword },
    runtimeConfig: { ...base, user: TEST_RUNTIME_ROLE, password: runtimePassword },
  };
}
```

The generated passwords are hexadecimal/prefix-only and must never be logged.

- [ ] **Step 3: Create the first explicit SQL migration**

Create `0001_core_identity_organization.sql` with these statements, preserving the explicit checks:

```sql
CREATE SCHEMA app;

CREATE TABLE app.app_user (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETION_PENDING')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE app.organization (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  status text NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT organization_display_name_shape
    CHECK (
      display_name = btrim(display_name)
      AND char_length(display_name) BETWEEN 1 AND 160
    )
);

CREATE TABLE app.organization_membership (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('ORG_ADMIN', 'PROPERTY_STAFF')),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  ended_at timestamptz NULL,
  CONSTRAINT organization_membership_org_fk
    FOREIGN KEY (org_id) REFERENCES app.organization(id),
  CONSTRAINT organization_membership_user_fk
    FOREIGN KEY (user_id) REFERENCES app.app_user(id),
  CONSTRAINT organization_membership_status_time
    CHECK (
      (status = 'ACTIVE' AND ended_at IS NULL)
      OR
      (status = 'ENDED' AND ended_at IS NOT NULL AND ended_at >= created_at)
    ),
  CONSTRAINT organization_membership_org_id_id_unique UNIQUE (org_id, id)
);

CREATE UNIQUE INDEX organization_membership_one_active_user_org
  ON app.organization_membership (org_id, user_id)
  WHERE status = 'ACTIVE';
```

Do not add direct identity fields.

- [ ] **Step 4: Implement the programmatic migration runner**

Create `migrate.ts`:

```ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import type { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../migrations");

export async function runPostgresMigrations(client: Client): Promise<void> {
  await runner({
    dbClient: client,
    dir: migrationsDir,
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
```

Export it and the role helpers from `src/testing/index.ts`.

- [ ] **Step 5: Update the suite setup to connect as the migration owner**

Use:

```ts
const roles = await provisionTestRoles(
  postgres.admin,
  postgres.adminConfig,
  postgres.database,
);
migrationClient = new Client(roles.migrationConfig);
await migrationClient.connect();
await runPostgresMigrations(migrationClient);
runtimeConfig = roles.runtimeConfig;
```

The Testcontainers admin is not passed to `runPostgresMigrations`.

- [ ] **Step 6: Prove idempotent second migration run and core constraints**

Add tests that:
- call `runPostgresMigrations(migrationClient)` a second time;
- count migration rows before/after and require no new migration row;
- insert a synthetic User and Organization;
- reject blank/padded Organization display names;
- reject a second ACTIVE membership for the same `(org_id,user_id)`.

Run:

```bash
npm run test:postgres
npm run typecheck
```

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/persistence-postgres/src/testing packages/persistence-postgres/migrations/0001_core_identity_organization.sql tests/postgres/foundation.test.ts
git commit -m "feat: add postgres migration ownership"
```

---

### Task 3: Add Property, Unit, Occupancy, and OccupancyMember relational constraints

**Files:**
- Create: `packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql`
- Modify: `tests/postgres/foundation.test.ts`

**Interfaces:**
- Produces database relations and constraints used by Tasks 5–7.
- No production repository API is added yet.

- [ ] **Step 1: Add RED schema constraint tests**

Add tests that attempt:
- padded Unit label;
- case-only duplicate active Unit label in the same Property;
- cross-org Unit→Property parent mismatch;
- two ACTIVE Occupancies for one Unit;
- ENDED Occupancy without `ends_at`;
- duplicate ACTIVE OccupancyMember for the same user/occupancy.

Before migration 0002 exists these tests fail because the relations do not exist.

- [ ] **Step 2: Create migration 0002**

Use explicit SQL:

```sql
CREATE TABLE app.property (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  address_reference text NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT property_org_fk
    FOREIGN KEY (org_id) REFERENCES app.organization(id),
  CONSTRAINT property_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT property_address_reference_shape
    CHECK (
      address_reference IS NULL
      OR (
        address_reference = btrim(address_reference)
        AND char_length(address_reference) BETWEEN 1 AND 512
      )
    )
);

CREATE TABLE app.unit (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  property_id uuid NOT NULL,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT unit_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT unit_property_fk
    FOREIGN KEY (org_id, property_id)
    REFERENCES app.property(org_id, id),
  CONSTRAINT unit_label_shape
    CHECK (
      label = btrim(label)
      AND char_length(label) BETWEEN 1 AND 80
      AND label !~ '[[:cntrl:]]'
    )
);

CREATE UNIQUE INDEX unit_active_label_unique
  ON app.unit (
    org_id,
    property_id,
    (lower(label) COLLATE "C")
  )
  WHERE status = 'ACTIVE';

CREATE TABLE app.occupancy (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT occupancy_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT occupancy_unit_fk
    FOREIGN KEY (org_id, unit_id)
    REFERENCES app.unit(org_id, id),
  CONSTRAINT occupancy_time_shape
    CHECK (
      (ends_at IS NULL OR ends_at > starts_at)
      AND (status <> 'ENDED' OR ends_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX occupancy_one_active_unit
  ON app.occupancy (org_id, unit_id)
  WHERE status = 'ACTIVE';

CREATE TABLE app.occupancy_member (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  org_id uuid NOT NULL,
  occupancy_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT occupancy_member_org_id_id_unique UNIQUE (org_id, id),
  CONSTRAINT occupancy_member_occupancy_fk
    FOREIGN KEY (org_id, occupancy_id)
    REFERENCES app.occupancy(org_id, id),
  CONSTRAINT occupancy_member_user_fk
    FOREIGN KEY (user_id) REFERENCES app.app_user(id),
  CONSTRAINT occupancy_member_time_shape
    CHECK (
      (ended_at IS NULL OR ended_at >= joined_at)
      AND (status <> 'ENDED' OR ended_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX occupancy_member_one_active_user
  ON app.occupancy_member (org_id, occupancy_id, user_id)
  WHERE status = 'ACTIVE';
```

Do not add `ON DELETE CASCADE`.

- [ ] **Step 3: Run schema tests GREEN and inspect actual constraints**

Run:

```bash
npm run test:postgres
```

Add direct `pg_constraint`/index catalog assertions for the composite parent keys and partial unique indexes rather than trusting names alone.

- [ ] **Step 4: Commit Task 3**

```bash
git add packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql tests/postgres/foundation.test.ts
git commit -m "feat: add postgres relationship schema"
```

---

### Task 4: Implement the opaque database handle and transaction/context primitives

**Files:**
- Create: `packages/persistence-postgres/src/database.ts`
- Create: `packages/persistence-postgres/src/transaction.ts`
- Create: `packages/persistence-postgres/src/context.ts`
- Modify: `packages/persistence-postgres/src/index.ts`
- Modify: `tests/postgres/foundation.test.ts`

**Interfaces:**
- Produces:
  - `PostgresDatabase`
  - `createPostgresDatabase(config)`
  - `withTransaction(database, operation)`
  - `withOrgTransaction(database, orgId, operation)`
  - `SqlClient = Pick<PoolClient, "query">`
- The raw Pool remains inaccessible.

- [ ] **Step 1: Add RED transaction and context API tests**

Add tests for:
- successful commit;
- operation failure rolls back;
- invalid/non-canonical org UUID is rejected before context query;
- `close()` can be called twice;
- a fabricated object with only `close()` is rejected by `withTransaction`.

- [ ] **Step 2: Implement the opaque handle**

Create `database.ts`:

```ts
import { Pool, type PoolConfig } from "pg";

export type PostgresDatabase = {
  close(): Promise<void>;
};

const pools = new WeakMap<PostgresDatabase, Pool>();

export function createPostgresDatabase(config: PoolConfig): PostgresDatabase {
  const pool = new Pool(config);
  let closePromise: Promise<void> | null = null;

  const database: PostgresDatabase = {
    close() {
      closePromise ??= pool.end();
      return closePromise;
    },
  };

  pools.set(database, pool);
  return database;
}

export function getInternalPool(database: PostgresDatabase): Pool {
  const pool = pools.get(database);
  if (!pool) {
    throw new TypeError("Unknown PostgresDatabase handle");
  }
  return pool;
}
```

Do not export `getInternalPool` from `src/index.ts`; it is package-internal.

- [ ] **Step 3: Implement canonical UUID validation**

Create `context.ts`:

```ts
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function assertCanonicalUuid(value: string): void {
  if (!CANONICAL_UUID.test(value)) {
    throw new TypeError("Expected canonical lowercase UUID");
  }
}
```

- [ ] **Step 4: Implement transaction failure semantics**

Create `transaction.ts` with one checked-out client for the full transaction:

```ts
import type { PoolClient } from "pg";
import { getInternalPool, type PostgresDatabase } from "./database";
import { assertCanonicalUuid } from "./context";

export type SqlClient = Pick<PoolClient, "query">;

async function rollback(client: PoolClient): Promise<unknown | null> {
  try {
    await client.query("ROLLBACK");
    return null;
  } catch (error) {
    return error;
  }
}

export async function withTransaction<T>(
  database: PostgresDatabase,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await getInternalPool(database).connect();
  let destroy = false;
  let began = false;

  try {
    try {
      await client.query("BEGIN");
      began = true;
    } catch (beginError) {
      destroy = true;
      throw beginError;
    }

    let result: T;
    try {
      result = await operation(client);
    } catch (operationError) {
      const rollbackError = began ? await rollback(client) : null;
      if (rollbackError) {
        destroy = true;
        throw new AggregateError(
          [operationError, rollbackError],
          "Transaction operation and rollback both failed",
        );
      }
      throw operationError;
    }

    try {
      await client.query("COMMIT");
      began = false;
      return result;
    } catch (commitError) {
      const rollbackError = began ? await rollback(client) : null;
      destroy = true;
      if (rollbackError) {
        throw new AggregateError(
          [commitError, rollbackError],
          "Transaction commit and rollback both failed",
        );
      }
      throw commitError;
    }
  } finally {
    client.release(destroy);
  }
}

export async function withOrgTransaction<T>(
  database: PostgresDatabase,
  orgId: string,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T> {
  assertCanonicalUuid(orgId);
  return withTransaction(database, async (client) => {
    await client.query(
      "SELECT pg_catalog.set_config('app.org_id', $1, true)",
      [orgId],
    );
    return operation(client);
  });
}
```

- [ ] **Step 5: Export only the safe public surface**

`src/index.ts`:

```ts
export {
  createPostgresDatabase,
  type PostgresDatabase,
} from "./database";
export {
  withOrgTransaction,
  withTransaction,
  type SqlClient,
} from "./transaction";
```

No Pool export.

- [ ] **Step 6: Run GREEN**

```bash
npm run test:postgres
npm run typecheck
```

- [ ] **Step 7: Commit Task 4**

```bash
git add packages/persistence-postgres/src/database.ts packages/persistence-postgres/src/context.ts packages/persistence-postgres/src/transaction.ts packages/persistence-postgres/src/index.ts tests/postgres/foundation.test.ts
git commit -m "feat: add postgres transaction boundary"
```

---

### Task 5: Add forced RLS, explicit runtime grants, and complete F18/F19 evidence

**Files:**
- Create: `packages/persistence-postgres/migrations/0003_runtime_isolation.sql`
- Modify: `packages/persistence-postgres/src/testing/roles.ts`
- Modify: `packages/persistence-postgres/src/testing/index.ts`
- Modify: `tests/postgres/foundation.test.ts`

**Interfaces:**
- Produces: `grantRuntimeAccess(migrationClient): Promise<void>`
- Produces full canonical evidence for F18 and F19.

- [ ] **Step 1: Add RED F18/F19 tests before RLS/grants**

Add runtime tests that require:
- role flags false;
- no migration-owner membership;
- runtime does not own scoped tables;
- `relrowsecurity` and `relforcerowsecurity` true;
- no-context SELECT returns no business rows;
- wrong-context INSERT fails RLS;
- max-1 pool reuse after COMMIT and ROLLBACK returns normalized current org NULL until a new context is set.

- [ ] **Step 2: Create the RLS migration**

Create `0003_runtime_isolation.sql`:

```sql
CREATE FUNCTION app.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(pg_catalog.current_setting('app.org_id', true), '')::uuid
$$;

REVOKE EXECUTE ON FUNCTION app.current_org_id() FROM PUBLIC;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

ALTER TABLE app.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization FORCE ROW LEVEL SECURITY;
ALTER TABLE app.organization_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organization_membership FORCE ROW LEVEL SECURITY;
ALTER TABLE app.property ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property FORCE ROW LEVEL SECURITY;
ALTER TABLE app.unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.unit FORCE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy FORCE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.occupancy_member FORCE ROW LEVEL SECURITY;

CREATE POLICY organization_org_scope ON app.organization
  USING (id = app.current_org_id())
  WITH CHECK (id = app.current_org_id());

CREATE POLICY organization_membership_org_scope ON app.organization_membership
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY property_org_scope ON app.property
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY unit_org_scope ON app.unit
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY occupancy_org_scope ON app.occupancy
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY occupancy_member_org_scope ON app.occupancy_member
  USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());
```

Do not name the runtime role in the migration.

- [ ] **Step 3: Grant only PF02-A runtime privileges from the harness**

Add `grantRuntimeAccess` using the dedicated migration-owner connection:

```ts
export async function grantRuntimeAccess(migration: Client): Promise<void> {
  await migration.query(`GRANT USAGE ON SCHEMA app TO ${TEST_RUNTIME_ROLE}`);
  await migration.query(
    `GRANT EXECUTE ON FUNCTION app.current_org_id() TO ${TEST_RUNTIME_ROLE}`,
  );
  await migration.query(
    `GRANT SELECT ON app.organization, app.organization_membership TO ${TEST_RUNTIME_ROLE}`,
  );
  await migration.query(
    `GRANT SELECT, INSERT, UPDATE ON app.property, app.unit, app.occupancy, app.occupancy_member TO ${TEST_RUNTIME_ROLE}`,
  );
}
```

Do not grant DELETE, CREATE, app_user access, role membership, or schema ownership.

After forced RLS exists, any migration-owner fixture insert into an org-scoped table must run inside an explicit transaction that first calls `set_config('app.org_id', <synthetic-org-id>, true)`. The migration owner is not allowed to rely on table ownership to bypass forced RLS. `app_user` remains outside org RLS and may be seeded directly by the migration owner.

At this step, refactor every earlier Task 2/3 test setup that writes or reads an org-scoped table through the migration owner to use a `PostgresDatabase` created from `migrationConfig` plus `withOrgTransaction(migrationDatabase, orgId, ...)`. This keeps those earlier schema tests valid after `FORCE ROW LEVEL SECURITY` is introduced. Direct `app_user` setup may remain outside org context.

- [ ] **Step 4: Prove the empty-string reset contract explicitly**

Within a `max: 1` database handle:
1. run org A transaction and commit;
2. inspect `SELECT app.current_org_id()` through a plain transaction and require NULL;
3. run org A transaction that throws and rolls back;
4. inspect again and require NULL;
5. run org B transaction and prove A rows remain invisible.

The raw custom setting may be `''`; the helper result must be SQL NULL.

- [ ] **Step 5: Run F18/F19 GREEN**

```bash
npm run test:postgres
```

Record F18/F19 as test evidence in the eventual PR description, but do not edit canonical `acceptance_cases.json` yet.

- [ ] **Step 6: Commit Task 5**

```bash
git add packages/persistence-postgres/migrations/0003_runtime_isolation.sql packages/persistence-postgres/src/testing/roles.ts packages/persistence-postgres/src/testing/index.ts tests/postgres/foundation.test.ts
git commit -m "feat: enforce postgres tenant isolation"
```

---

### Task 6: Prove database prerequisites for F01/F16/F41/F43 without overclaiming canonical PASS

**Files:**
- Modify: `tests/postgres/foundation.test.ts`

**Interfaces:**
- Produces named prerequisite evidence:
  - A-ISO-01
  - A-TX-01
  - A-FK-01
  - A-ADDRESS-01
- These do not change F01/F16/F41/F43 from NOT_RUN.

- [ ] **Step 1: Add A-ISO-01**

Use migration owner only to seed synthetic Users/Organizations. Then use the runtime database handle:

```ts
await withOrgTransaction(runtimeDatabase, orgA, async (client) => {
  await client.query(
    `INSERT INTO app.property (org_id, address_reference, status)
     VALUES ($1, $2, 'ACTIVE')`,
    [orgA, "SYNTHETIC-BUILDING-01"],
  );
});

const visibleToB = await withOrgTransaction(runtimeDatabase, orgB, (client) =>
  client.query("SELECT id FROM app.property WHERE org_id = $1", [orgA]),
);
expect(visibleToB.rows).toHaveLength(0);
```

Also prove a no-context transaction sees zero tenant rows.

Label the test name `A-ISO-01`, not `F01 PASS`.

- [ ] **Step 2: Add A-TX-01**

Create a separate `PostgresDatabase` from `migrationConfig` for this foundation test. Use `withTransaction` to insert an unscoped synthetic `app.app_user`, then deliberately insert the same primary key again so PostgreSQL raises SQLSTATE `23505`. After the callback rejects, query through `migrationClient` and require that **zero** rows with that synthetic ID exist, proving the first insert rolled back with the second.

This is deliberately named `A-TX-01 database transaction prerequisite for F16`: canonical F16 requires Invitation consumption/relationship creation, which does not exist in PF02-A.

- [ ] **Step 3: Add A-FK-01 with exact catalog and SQLSTATE assertions**

First inspect `pg_constraint` for `unit_property_fk`:

```sql
SELECT pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'app'
  AND c.conname = 'unit_property_fk'
  AND c.contype = 'f'
```

Require exactly one row and require the normalized definition to contain both `FOREIGN KEY (org_id, property_id)` and `REFERENCES app.property(org_id, id)`.

Then under org A context, attempt:

```ts
await expect(
  withOrgTransaction(runtimeDatabase, orgA, (client) =>
    client.query(
      `INSERT INTO app.unit (org_id, property_id, label, status)
       VALUES ($1, $2, $3, 'ACTIVE')`,
      [orgA, propertyB, "A101"],
    ),
  ),
).rejects.toMatchObject({ code: "23503" });
```

Do not count an RLS error as success.

- [ ] **Step 4: Add A-ADDRESS-01**

Create one property per org with the exact same synthetic reference, then prove both exist to the migration owner while each runtime context sees only its own row.

The test remains a database prerequisite for F43, not a registration/search API PASS.

- [ ] **Step 5: Run GREEN and commit**

```bash
npm run test:postgres
git add tests/postgres/foundation.test.ts
git commit -m "test: prove postgres isolation prerequisites"
```

---

### Task 7: Prove F23 with a real concurrent unique-index conflict

**Files:**
- Modify: `tests/postgres/foundation.test.ts`

**Interfaces:**
- Produces full canonical F23 evidence.
- Uses two runtime Clients and one admin diagnostic Client only for observing lock wait state.

- [ ] **Step 1: Seed an org/unit and open two runtime backends**

Use `Client` directly in the test harness with the runtime connection config, not the production package's hidden Pool.

For both A and B:
- connect;
- `BEGIN`;
- set `app.org_id` with `set_config(..., true)`;
- record `pg_backend_pid()`.

- [ ] **Step 2: Insert the first ACTIVE occupancy and hold the transaction**

Backend A:

```ts
await clientA.query(
  `INSERT INTO app.occupancy (org_id, unit_id, starts_at, status)
   VALUES ($1, $2, transaction_timestamp(), 'ACTIVE')`,
  [orgId, unitId],
);
```

Do not commit yet.

- [ ] **Step 3: Start the conflicting insert on backend B without awaiting completion**

```ts
const conflictingInsert = clientB
  .query(
    `INSERT INTO app.occupancy (org_id, unit_id, starts_at, status)
     VALUES ($1, $2, transaction_timestamp(), 'ACTIVE')`,
    [orgId, unitId],
  )
  .then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
```

- [ ] **Step 4: Prove backend B is actually blocked before releasing A**

Poll through the admin diagnostic connection:

```sql
SELECT wait_event_type, wait_event
FROM pg_stat_activity
WHERE pid = $1
```

Require `wait_event_type = 'Lock'` before committing A. Use a bounded poll deadline; timeout is test failure.

- [ ] **Step 5: Commit A and require B to fail with 23505**

```ts
await clientA.query("COMMIT");

const conflictResult = await conflictingInsert;
expect(conflictResult.ok).toBe(false);
if (conflictResult.ok) {
  throw new Error("Expected the second ACTIVE occupancy insert to fail");
}
expect(conflictResult.error).toMatchObject({ code: "23505" });
await clientB.query("ROLLBACK");
```

Then count ACTIVE rows and require exactly 1.

Close both Clients in `finally`.

- [ ] **Step 6: Run F23 GREEN and commit**

```bash
npm run test:postgres
git add tests/postgres/foundation.test.ts
git commit -m "test: prove concurrent active occupancy guard"
```

---

### Task 8: Pin architecture boundaries and prevent demo/test contamination

**Files:**
- Create: `tests/architecture/postgres-boundary.test.ts`

**Interfaces:**
- Produces a Docker-independent architecture regression in the existing Shared suite.

- [ ] **Step 1: Write the boundary test**

Create:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) {
      result.push(...sourceFiles(path));
    } else if (path.endsWith(".ts")) {
      result.push(path);
    }
  }
  return result;
}

describe("PostgreSQL production persistence boundary", () => {
  it("does not import demo SQLite or fixtures", () => {
    const files = sourceFiles("packages/persistence-postgres/src");
    const joined = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(joined).not.toContain("node:sqlite");
    expect(joined).not.toContain("@build-manager/fixtures");
    expect(joined).not.toContain("apps/web/src/server/persistence");
  });

  it("keeps Docker-backed tests outside packages/**/*.test.ts", () => {
    const postgresTests = sourceFiles("tests/postgres");
    expect(postgresTests.length).toBeGreaterThan(0);
    expect(postgresTests.every((file) => file.endsWith(".test.ts"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run both suites**

```bash
npm run test:shared
npm run test:postgres
npm run typecheck
```

- [ ] **Step 3: Commit Task 8**

```bash
git add tests/architecture/postgres-boundary.test.ts
git commit -m "test: guard postgres adapter boundary"
```

---

### Task 9: Add the required Linux PostgreSQL CI job and aggregate it without weakening PF00

**Files:**
- Modify: `.github/workflows/app-check.yml`

**Interfaces:**
- Produces required project acceptance check `postgres-integration`.
- Extends `foundation-gate` from six internal dependencies to seven.
- Separate Repository `verify` remains unchanged, making nine project acceptance checks in total.

- [ ] **Step 1: Add `postgres-integration` using the existing pinned action SHAs**

Insert a job parallel to the existing Linux jobs:

```yaml
  postgres-integration:
    runs-on: ubuntu-24.04
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: "24.21.0"
          cache: npm
          cache-dependency-path: package-lock.json
      - name: Verify runtime and Docker
        shell: bash
        run: |
          test "$(node --version)" = "v24.21.0"
          test "$(npm --version)" = "11.19.0"
          docker info
      - name: Install without manifest, lock, or platform-key drift
        shell: bash
        env:
          BASELINE_SHA: ${{ github.event.pull_request.base.sha || github.event.before }}
        run: |
          test -n "$BASELINE_SHA"
          npm ci
          git diff --exit-code -- package.json package-lock.json packages/persistence-postgres/package.json
          git show "$BASELINE_SHA:package-lock.json" > "$RUNNER_TEMP/pf02a-lock-baseline.json"
          node --input-type=module <<'NODE'
          import { readFileSync } from "node:fs";
          const baseline = JSON.parse(
            readFileSync(process.env.RUNNER_TEMP + "/pf02a-lock-baseline.json", "utf8"),
          );
          const candidate = JSON.parse(readFileSync("package-lock.json", "utf8"));
          const prefixes = [
            "node_modules/@tailwindcss/oxide-",
            "node_modules/@next/swc-",
            "node_modules/@img/sharp-",
            "node_modules/@unrs/resolver-binding-",
          ];
          const select = (lock) =>
            Object.keys(lock.packages ?? {}).filter((key) =>
              prefixes.some((prefix) => key.startsWith(prefix)),
            );
          const before = select(baseline);
          const after = new Set(select(candidate));
          const missing = before.filter((key) => !after.has(key));
          console.log(
            JSON.stringify(
              { baseline: before.length, candidate: after.size, missing },
              null,
              2,
            ),
          );
          if (missing.length) process.exit(1);
          NODE
      - name: PostgreSQL 18.6 integration tests
        shell: bash
        run: npm run test:postgres
```

Do not change action major versions in this task.

- [ ] **Step 2: Add the job to `foundation-gate.needs`**

Add:

```yaml
      - postgres-integration
```

Add env:

```yaml
          POSTGRES_INTEGRATION_RESULT: ${{ needs.postgres-integration.result }}
```

Add aggregate line:

```bash
"postgres-integration=$POSTGRES_INTEGRATION_RESULT"
```

A skipped/cancelled/failure result must make the gate exit non-zero.

- [ ] **Step 3: Validate workflow syntax/diff and run local non-CI checks**

Run:

```bash
git diff --check
npm run test:postgres
npm run test:shared
npm run typecheck
```

- [ ] **Step 4: Commit Task 9**

```bash
git add .github/workflows/app-check.yml
git commit -m "ci: require postgres integration"
```

---

### Task 10: Full regression, public-data gates, dependency-delta audit, and implementation PR

**Files:**
- Modify: `ops/AI_Execution_Log.csv`
- No product/schema changes after verification begins unless a reproduced BLOCKER/HIGH requires a scoped fix and re-run.

**Interfaces:**
- Produces an open implementation PR at `PF02-A = READY_FOR_ACCEPTANCE`.
- Does not merge and does not edit canonical acceptance statuses.

- [ ] **Step 1: Run clean install and exact dependency verification**

```bash
npm ci
npm ls --workspace @build-manager/persistence-postgres pg @types/pg @testcontainers/postgresql node-pg-migrate
git diff --exit-code -- package.json package-lock.json packages/persistence-postgres/package.json
```

Expected exact versions remain 8.23.0 / 8.23.1 / 12.1.0 / 9.0.0.

- [ ] **Step 2: Re-run the protected platform-lock inclusion check**

Use the Task 1 baseline receipt and require no missing baseline key. If the baseline receipt is unavailable, regenerate the baseline from the exact pre-implementation main lockfile by reading `git show <IMPLEMENTATION_BASE>:package-lock.json`; do not infer it from historical count 67.

- [ ] **Step 3: Run the complete local functional regression**

```bash
npm run test:postgres
npm run test:shared
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run test:e2e:web
```

No warm retry replaces a failed first required run.

- [ ] **Step 4: Run repository/public-data gates**

```bash
PYTHONPATH="$PWD" python3 tests/test_verify_repository.py -v
PYTHONPATH="$PWD" python3 scripts/tests/test_verify_repository.py -v
python3 scripts/verify_repository.py
python3 scripts/verify_repository.py --history
git diff --check
```

Require scanner inventories 3 and 14 and zero public findings.

- [ ] **Step 5: Compare dependency-security delta**

Run:

```bash
npm audit --json > /tmp/pf02a-audit-final.json || true
```

Record:
- previous known moderate count;
- final moderate/high/critical counts;
- newly introduced advisory packages, if any;
- any new install-script warning.

No remediation in this task. HIGH/CRITICAL addition blocks publication. New MODERATE/install-script changes require explicit attribution in the PR.

- [ ] **Step 6: Verify scope**

Expected implementation delta is limited to:
- new `packages/persistence-postgres/**`;
- `tests/postgres/**`;
- `tests/architecture/postgres-boundary.test.ts`;
- root package manifest/lock/config;
- `.github/workflows/app-check.yml`;
- append-only execution log.

The existing demo persistence files must be byte-identical to implementation base.

- [ ] **Step 7: Append a sanitized execution-log event**

Append one event summarizing:
- implementation base/ref;
- exact resolved dependency versions;
- actual PostgreSQL test count;
- F18/F19/F23 execution result;
- A-ISO-01/A-TX-01/A-FK-01/A-ADDRESS-01 result;
- regression counts;
- CI still pending before push;
- external sync PENDING.

Do not log passwords, connection URIs, container IDs, local absolute paths, or raw audit payloads.

- [ ] **Step 8: Push a normal implementation branch and open the PR**

Implementation branch name:

```text
feat/pf02-a-postgres-foundation
```

Suggested PR title:

```text
feat: add PF02-A postgres foundation
```

PR body must clearly state:
- `PF00 = FROZEN`;
- `PF02-A = READY_FOR_ACCEPTANCE`, not VERIFIED;
- exact PostgreSQL/dependency versions;
- F18/F19/F23 are candidate full-case evidence;
- F01/F16/F41/F43 remain NOT_RUN despite prerequisite DB tests;
- no real user data/credentials;
- existing demo SQLite path unchanged;
- open dependency-security/supply-chain risks;
- CodeRabbit, if skipped, is not independent review evidence.

Do not merge.

- [ ] **Step 9: Require fresh PR CI on the exact pushed head**

Require these nine project acceptance checks on the exact PR head:

```text
verify
repository-safety
apps
mobile-cold-linux
install-mobile-windows
web-e2e
mobile-health
postgres-integration
foundation-gate
```

Inspect actual PostgreSQL job logs and require:
- Docker available;
- test command actually executed;
- server version proof 180006;
- test count > 0;
- zero test failures;
- no skipped/cancelled aggregate dependency.

Inspect foundation-gate and require all seven internal dependencies `success`.

- [ ] **Step 10: Stop for independent acceptance**

Terminal state for first execution:

```text
PF00 = FROZEN
PF01 = REVIEW_DRAFT
PF02-A = READY_FOR_ACCEPTANCE
PF02-B = NOT_STARTED
F18/F19/F23 = CANDIDATE_PASS_EVIDENCE_ONLY
F01/F16/F41/F43 = NOT_RUN
REAL_IDENTITY = NOT_IMPLEMENTED
REAL_TENANT_DATA = NOT_AUTHORIZED
PR = OPEN / NOT_MERGED
EXTERNAL_SYNC = PENDING
```

Do not update `acceptance_cases.json` or `STATUS.md` to VERIFIED in this run.

---

## Separate Acceptance/Publication Phase — Not Authorized for the First Execution

After the operator-side independent review accepts the exact implementation PR head:

1. merge with expected-head protection using a merge commit;
2. preserve the implementation branch;
3. require fresh push-to-main CI on the exact merge SHA with the same nine project acceptance checks;
4. inspect actual PostgreSQL logs again;
5. only then create a documentation/evidence finalization branch;
6. create `ops/pf02_a_acceptance.md`;
7. update `docs/production-foundation/acceptance_cases.json`:
   - F18 → `PASS_POSTGRES_INTEGRATION`;
   - F19 → `PASS_POSTGRES_INTEGRATION`;
   - F23 → `PASS_POSTGRES_INTEGRATION`;
   - F01/F16/F41/F43 remain `NOT_RUN`;
8. update `STATUS.md` to `PF02-A = VERIFIED`, `PF02-B = NOT_STARTED / D01 REQUIRED`;
9. update current production-foundation evidence/revision/checksums consistently;
10. run normal CI for the evidence PR and stop for independent acceptance before its merge.

This phase is intentionally separate so a PR result cannot be promoted to canonical PASS before the implementation has actually been accepted, merged, and re-run on main.

## Self-Review Record

- **Spec coverage:** All PF02-A sections map to Tasks 1–10. Deferred D01/D02b/D03/D04/D05 remain outside the implementation.
- **Completeness scan:** No unfinished marker or unspecified implementation step remains in the execution instructions.
- **Type consistency:** Public names are fixed as `PostgresDatabase`, `SqlClient`, `createPostgresDatabase`, `withTransaction`, `withOrgTransaction`; test helper names are fixed above.
- **Review Focus coverage:** RLS role truth → Task 5; transaction context leak/escape → Tasks 4–5; composite FK SQLSTATE → Task 6; true lock-wait concurrency → Task 7; demo/test contamination → Task 8.
- **Evidence integrity:** Only F18/F19/F23 are eligible for `PASS_POSTGRES_INTEGRATION` after accepted-main publication. F01/F16/F41/F43 remain `NOT_RUN` in the first implementation PR and after PF02-A unless their full canonical actions later execute.
- **Freeze integrity:** Existing SQLite/demo source remains untouched; production PostgreSQL failure never falls back to demo storage.

# PF02-A PostgreSQL Foundation Design

Status: **REVIEW_READY / IMPLEMENTATION_NOT_AUTHORIZED**
Date: 2026-09-19
POLICY_REF: `main@9418211a4ab242024f687486f9626c32925b964d`
TARGET_REF: `main@9418211a4ab242024f687486f9626c32925b964d`

## 1. Purpose

PF02-A establishes the first production persistence boundary without replacing or reinterpreting the frozen demo baseline.

The production path will use:

- PostgreSQL **18.6**.
- `pg` / node-postgres **8.23.0**.
- `@types/pg` **8.23.1**.
- `@testcontainers/postgresql` **12.1.0**.
- `node-pg-migrate` **9.0.0**.
- explicit SQL and application ports; no ORM.

All status/role vocabularies in PF02-A use `text` columns with explicit `CHECK` constraints rather than PostgreSQL enum types. This keeps the closed vocabulary visible while avoiding an unnecessary enum-type migration dependency during the first production slice.

The operator approved D02a and the package boundary:

```text
packages/domain
        ↑
packages/application
        ↑ ports
        │
packages/persistence-postgres
        │
PostgreSQL 18.6
```

The existing `apps/web/src/server/persistence/**` SQLite implementation remains the frozen synthetic/demo-v1 adapter. PF02-A does not convert, delete, or reuse it as production storage.

PF02-A ends with a verified PostgreSQL schema, migration path, runtime-role boundary, RLS tenant isolation, transaction-local organization context, and real PostgreSQL integration tests. It does not create a production login flow or authorize real user data.

## 2. Scope

### 2.1 In scope

PF02-A owns:

1. a new workspace package `packages/persistence-postgres`;
2. connection-pool ownership and transaction primitives;
3. deterministic migration execution;
4. the initial relational schema for:
   - User,
   - Organization,
   - OrganizationMembership,
   - Property,
   - Unit,
   - Occupancy,
   - OccupancyMember;
5. composite organization-scoped foreign keys;
6. one-active-occupancy database enforcement;
7. organization RLS and transaction-local organization context;
8. a non-owner, non-superuser, non-`BYPASSRLS` runtime role in ephemeral integration environments;
9. PostgreSQL 18.6 Testcontainers integration tests;
10. a Linux CI gate for those integration tests.

### 2.2 Explicitly out of scope

PF02-A does not implement:

- ExternalIdentity or a real identity provider;
- Web cookie sessions or Mobile OAuth/PKCE;
- PropertyAssignment (introduced in PF02-B together with authenticated staff scope);
- invitation creation or acceptance;
- MaintenanceTicket or TicketMessage persistence;
- CommandReceipt;
- actual email/SMS/push notifications;
- media/object storage;
- AI persistence;
- production hosting, region, backups, secrets, or managed PostgreSQL vendor selection;
- real tenant, landlord, address, contract, phone, email, or identity data;
- a PostgreSQL replacement for demo v1;
- a production `/api/v2` endpoint.

Those boundaries remain governed by PF01 and later PF02 phases.

## 3. Architectural boundary

Create a dedicated package:

```text
packages/persistence-postgres/
├─ package.json
├─ migrations/
│  ├─ 0001_core_identity_organization.sql
│  ├─ 0002_property_unit_occupancy.sql
│  └─ 0003_runtime_isolation.sql
└─ src/
   ├─ index.ts
   ├─ pool.ts
   ├─ transaction.ts
   ├─ context.ts
   └─ testing/
      ├─ postgres-container.ts
      ├─ roles.ts
      └─ migrate.ts
```

Implementation may split a focused file if it becomes too large, but must not move PostgreSQL-specific imports into `packages/domain` or `packages/application`.

### 3.1 Dependency direction

Allowed:

```text
application/domain types
        ↑
persistence-postgres
        ↑
future server composition
```

Forbidden:

```text
packages/application -> pg
packages/domain -> pg
demo SQLite -> production PostgreSQL fallback
production PostgreSQL -> fixtures package
```

PF02-A does not implement the existing demo `BuildingRepository` or `TicketRepository` over PostgreSQL. Those ports describe the synthetic v1 aggregate model and are not the production schema contract. Production repositories are introduced with the production use cases that need them in later phases.

## 4. Dependency contract

`packages/persistence-postgres/package.json` uses exact versions for this foundation:

```json
{
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

The repository remains Node 24.21.0 / npm 11.19.0.

No Prisma, Drizzle, Knex, Sequelize, TypeORM, Kysely, or other ORM/query-builder is added.

A dependency-security snapshot is taken before and after installation in the same execution. PF02-A does not run `npm audit fix`, `npm audit fix --force`, or approve new install scripts. A newly introduced high/critical advisory or an unexplained new install script is a stop condition.

Because this repository previously experienced cross-platform optional-package lockfile loss, dependency installation also preserves the **baseline set** of existing platform-specific lock keys. Before the install, derive the actual key set from `package-lock.json` for the currently protected families (including `@tailwindcss/oxide-`, `@next/swc-`, `@img/sharp-`, and `@unrs/resolver-binding-`). After the install, require `baseline key set ⊆ candidate key set`. Do not hard-code the historical count as a permanent requirement, and do not manually re-inject missing entries; disappearance is a stop-and-review condition.

## 5. Database namespace and identifiers

Production tables live in schema:

```text
app
```

Migration history lives separately:

```text
app_migrations
```

All production resource primary keys are PostgreSQL `uuid`, generated by PostgreSQL 18's built-in `uuidv7()`.

Reasons:

- IDs remain opaque to clients.
- UUIDv7 is time-ordered without introducing a sequential public identifier.
- PostgreSQL 18 provides `uuidv7()` in core, so no UUID extension is required.

Every stored business timestamp uses `timestamptz`. Application/UI timezone presentation is separate.

All mutable business rows that later participate in optimistic concurrency start with integer `version >= 1`.

Initial relationship foreign keys do not use `ON DELETE CASCADE`. History-bearing parent deletion is rejected by the database default/`RESTRICT` behavior; lifecycle changes are explicit status/end-time transitions.

## 6. Initial schema

### 6.1 app_user

```text
id          uuid primary key default uuidv7()
status      ACTIVE | SUSPENDED | DELETION_PENDING
created_at  timestamptz not null
```

No email, phone, name, password hash, provider subject, or other direct identity data is added in PF02-A.

The runtime role does not receive general-purpose direct access to `app_user` during PF02-A. Identity bootstrap permissions belong to PF02-B.

### 6.2 organization

```text
id           uuid primary key default uuidv7()
status       PENDING | ACTIVE | SUSPENDED | ARCHIVED
display_name text not null
created_at   timestamptz not null default transaction_timestamp()
```

The organization's primary key `id` is the organization scope value.

`display_name` must be trimmed and contain 1–160 characters.

PF02-A integration fixtures are synthetic. `display_name` values must not look like real businesses or persons.

### 6.3 organization_membership

```text
id         uuid primary key default uuidv7()
org_id     uuid not null
user_id    uuid not null
role       ORG_ADMIN | PROPERTY_STAFF
status     ACTIVE | ENDED
version    integer not null default 1
created_at timestamptz not null default transaction_timestamp() default transaction_timestamp()
ended_at   timestamptz null
```

Constraints:

- unique `(org_id, id)`;
- FK `org_id -> organization.id`;
- FK `user_id -> app_user.id`;
- partial unique index on `(org_id, user_id)` where `status = 'ACTIVE'`;
- `version >= 1`;
- `status = 'ACTIVE'` requires `ended_at IS NULL`;
- `status = 'ENDED'` requires `ended_at IS NOT NULL AND ended_at >= created_at`.

PF02-A does not implement the last-admin command policy. That belongs to PF02-B application authorization and its concurrency tests.

### 6.4 property

```text
id                uuid primary key default uuidv7()
org_id            uuid not null
address_reference text null
status            ACTIVE | ARCHIVED
created_at        timestamptz not null default transaction_timestamp()
```

Constraints:

- unique `(org_id, id)`;
- FK `org_id -> organization.id`.

When present, `address_reference` is trimmed, non-empty, and limited to 512 characters.

`address_reference` is an opaque/non-PII synthetic reference in PF02-A. It is deliberately **not globally unique**. Two organizations may represent the same public building reference without sharing tenant or management data.

### 6.5 unit

```text
id          uuid primary key default uuidv7()
org_id      uuid not null
property_id uuid not null
label       text not null
status      ACTIVE | ARCHIVED
created_at  timestamptz not null default transaction_timestamp()
```

Constraints:

- unique `(org_id, id)`;
- composite FK `(org_id, property_id) -> property(org_id, id)`;
- `label = btrim(label)`, `char_length(label) BETWEEN 1 AND 80`, and control characters are rejected;
- partial unique index on `(org_id, property_id, lower(label) COLLATE "C")` where `status = 'ACTIVE'`.

Therefore duplicate active labels cannot coexist in one Property, whitespace-only or padded labels are rejected, and case-only variants such as `A101` / `a101` cannot bypass the active-label uniqueness rule.

A Unit cannot point to a Property in another Organization even if the property UUID is known.

### 6.6 occupancy

```text
id         uuid primary key default uuidv7()
org_id     uuid not null
unit_id    uuid not null
starts_at  timestamptz not null
ends_at    timestamptz null
status     ACTIVE | ENDED
version    integer not null default 1
created_at timestamptz not null
```

Constraints:

- unique `(org_id, id)`;
- composite FK `(org_id, unit_id) -> unit(org_id, id)`;
- `ends_at > starts_at` when `ends_at` is present;
- `status = 'ENDED'` requires `ends_at IS NOT NULL`;
- `version >= 1`;
- partial unique index on `(org_id, unit_id)` where `status = 'ACTIVE'`.

The partial unique index is the database backstop for one ACTIVE occupancy per Unit.

PF01 also requires temporal validity. PF02-A does not attempt a time-dependent CHECK constraint based on the current clock. Later authorization queries must still require:

```text
status = ACTIVE
starts_at <= database decision time
ends_at IS NULL OR ends_at > database decision time
```

This is tested explicitly later rather than assuming ACTIVE alone grants access.

### 6.7 occupancy_member

```text
id           uuid primary key default uuidv7()
org_id       uuid not null
occupancy_id uuid not null
user_id      uuid not null
joined_at    timestamptz not null
ended_at     timestamptz null
status       ACTIVE | ENDED
created_at   timestamptz not null default transaction_timestamp()
```

Constraints:

- unique `(org_id, id)`;
- composite FK `(org_id, occupancy_id) -> occupancy(org_id, id)`;
- FK `user_id -> app_user.id`;
- partial unique index on `(org_id, occupancy_id, user_id)` where `status = 'ACTIVE'`;
- any non-null `ended_at` must be `>= joined_at`;
- `status = 'ENDED'` requires `ended_at IS NOT NULL`.

An ACTIVE member may carry a future `ended_at`; later authorization must still evaluate the timestamp and cannot rely on status alone.

Multiple active members may belong to one active Occupancy. This does not imply that those people automatically share future tickets or conversations.

## 7. Role model

PF02-A distinguishes migration ownership from application execution.

### 7.1 Migration owner

A dedicated migration-owner login owns `app` and the objects created by migrations. The container's built-in admin/superuser is used only to provision the test database and roles; **node-pg-migrate must connect as the dedicated migration owner, never as the container admin/superuser**.

The ephemeral migration owner is also `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, and `NOBYPASSRLS`. It receives the database-level `CREATE` privilege required to create the controlled schemas in the disposable test database.

Production credential/provisioning mechanics are deferred to D02b. PF02-A only defines the required capabilities.

### 7.2 Runtime role

The runtime role must satisfy:

```text
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOBYPASSRLS
not owner of app tables
not a member of the migration-owner or other privileged role
no schema CREATE privilege
```

The Testcontainers harness creates an ephemeral runtime login that has those attributes and grants only the `USAGE`/DML/function privileges needed by PF02-A tests. It does not grant `DELETE` unless a tested PF02-A operation specifically requires it.

No password or connection string from integration tests is committed or logged.

The runtime role must not be used to run migrations.

## 8. RLS and organization context

RLS is a defense-in-depth tenant-isolation layer, not the complete authorization system.

Enable and force RLS on organization-scoped tables:

- `organization`;
- `organization_membership`;
- `property`;
- `unit`;
- `occupancy`;
- `occupancy_member`.

The canonical transaction-local context key is:

```text
app.org_id
```

A small `SECURITY INVOKER`, `STABLE` SQL helper exposes the current organization as a nullable UUID. It must normalize both an unknown setting and PostgreSQL's post-`SET LOCAL` empty-string reset behavior:

```sql
NULLIF(current_setting('app.org_id', true), '')::uuid
```

This normalization is required because once a custom setting has existed on a pooled connection, ending a transaction can leave that setting defined with the empty string rather than making it unknown again. Both states must resolve to SQL NULL and therefore match no organization rows.

The helper is not `SECURITY DEFINER`. Its SQL body qualifies PostgreSQL catalog functions (for example `pg_catalog.current_setting`) rather than relying on a caller-controlled `search_path`. Its default PUBLIC execute privilege is revoked; the ephemeral harness grants execute only to the roles that need it.

Policies use both:

- `USING` for visible/target rows;
- `WITH CHECK` for inserted or modified rows.

The policy definitions do not embed a deployment-specific runtime role name; they apply through the normal/public policy target, while SQL `GRANT` permissions and the revoked/helper `EXECUTE` privilege determine which provisioned roles can actually reach the protected tables.

Policy shape:

```text
organization.id = current organization
or
row.org_id = current organization
```

No application query receives an `org_id` from an untrusted request and blindly copies it into database session context. The server must establish the organization only after later authentication/authorization validates the actor's relationship.

Custom PostgreSQL settings are not a substitute for parameterized queries or input validation. They are used here as an internal transaction-scoped RLS context mechanism with the empty-string behavior above treated explicitly as part of the contract. The runtime DB credential is server-only and is never exposed to a browser/mobile client.

Because a role that can execute arbitrary SQL could also call `set_config`, RLS is not claimed as a defense against successful SQL injection. Application SQL remains parameterized and the organization value passed to `withOrgTransaction` must come only from a later server-side authorization decision.

## 9. Pool and transaction API

The package exposes no module-global Pool **and does not expose the raw `pg.Pool` on its public handle**. That restriction is deliberate: callers must not be able to escape the package transaction/context boundary by casually calling `pool.query()`.

Proposed public surface:

```ts
export type SqlClient = Pick<PoolClient, "query">;

export type PostgresDatabase = {
  close(): Promise<void>;
};

export function createPostgresDatabase(config: PoolConfig): PostgresDatabase;

export async function withTransaction<T>(
  database: PostgresDatabase,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T>;

export async function withOrgTransaction<T>(
  database: PostgresDatabase,
  orgId: string,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T>;
```

`PostgresDatabase` is implemented by an internal class/private state that owns the actual `pg.Pool`; consumers cannot retrieve that Pool through the exported contract.

Behavior:

1. acquire exactly one client from the internal Pool;
2. `BEGIN`;
3. for `withOrgTransaction`, validate that `orgId` is a canonical UUID string before the context-setting query, then set `app.org_id` with a parameterized `set_config(..., true)` call;
4. execute every operation on that same `PoolClient`;
5. `COMMIT` on success;
6. on operation/context/commit failure, attempt `ROLLBACK` when the connection remains usable;
7. release the client in `finally`, discarding it from the pool when a connection/protocol failure makes reuse unsafe;
8. preserve the original failure; rollback/release failures are attached as internal diagnostic causes and are never exposed through public HTTP.

Repositories added later must accept the transaction client/query interface rather than calling `pool.query()` from inside an organization transaction. This prevents a repository from silently escaping the transaction-local RLS context.

PF02-A tests include `Pool({ max: 1 })` reuse to prove a previous organization setting does not leak after commit or rollback.

## 10. Migrations

Use `node-pg-migrate@9.0.0`; do not build a custom migration engine.

The migrations remain explicit SQL files so reviewers can inspect constraints, policies, indexes, grants, and ownership directly.

Programmatic test execution uses `node-pg-migrate`'s runner with:

```text
direction = up
singleTransaction = true
checkOrder = true
advisoryLockMode = fail
dir = packages/persistence-postgres/migrations
migrationsSchema = app_migrations
createMigrationsSchema = true
migrationLoaderStrategies = [{ extensions: [".sql"], loader: "sql" }]
```

The explicit SQL loader removes dependence on the legacy SQL-loader default. Each `000N_name.sql` file is an up-only migration unit; production rollback is not inferred from a destructive down section.

The runner does not set `schema = app`; migration SQL fully qualifies `app.*` objects so correctness does not depend on an ambient `search_path`.

No migration may fetch network data or depend on application fixtures.

Migration order:

### 0001_core_identity_organization.sql

Creates:

- `app` schema;
- core enum/check vocabulary;
- `app_user`;
- `organization`;
- `organization_membership`;
- base indexes and constraints.

### 0002_property_unit_occupancy.sql

Creates:

- `property`;
- `unit`;
- `occupancy`;
- `occupancy_member`;
- composite FKs;
- partial unique indexes.

### 0003_runtime_isolation.sql

Creates/applies:

- organization-context helper;
- `REVOKE EXECUTE ... FROM PUBLIC` for that helper;
- RLS enable/force;
- `USING` / `WITH CHECK` policies;
- hardening such as `REVOKE ALL ON SCHEMA app FROM PUBLIC`.

Role names and login credentials are **not** embedded in application migrations. Actual production role provisioning and grants are a D02b hosting decision. The ephemeral Testcontainers harness creates a synthetic migration owner and runtime login, applies the minimum `USAGE`/DML/function grants required for the PF02-A tests, and verifies the runtime role remains non-owner, non-superuser, non-`BYPASSRLS`, and outside privileged role membership.

Destructive automatic down migrations are not a release mechanism. PF02-A must prove clean-database `up` migration reproducibility. A future production rollback strategy is handled by forward repair migrations and backup/recovery procedures rather than pretending every schema change can be safely reversed.

## 11. Testcontainers harness

Use exact image version:

```text
postgres:18.6
```

The harness records `SHOW server_version` for diagnostics, but exact-version proof uses `SHOW server_version_num` and requires **`180006`**. Distribution suffixes may appear in the human-readable `server_version` string, so string equality against `18.6` is not used as the gate.

Each integration suite creates disposable synthetic state only.

The harness:

1. starts PostgreSQL 18.6;
2. uses the container admin/superuser connection solely to provision the disposable database privileges and the two synthetic logins;
3. connects as the dedicated migration owner and runs all migrations;
4. verifies the created `app` objects are owned by the migration owner rather than the admin/superuser;
5. creates synthetic bootstrap `app_user`/Organization fixtures through the migration-owner connection only where PF02-B application bootstrap does not yet exist; organization IDs are explicit and the same RLS context contract is used once forced RLS applies;
6. constructs the application database handle using the non-owner runtime credential;
7. executes runtime isolation/transaction/concurrency tests through that runtime credential;
8. closes database handles/clients;
9. stops the container in `finally`.

Admin/superuser connections never count as evidence for an RLS PASS.

No integration test connects to a developer's external PostgreSQL by default.

PF02-A has no context-discovery or organization-bootstrap application API. Synthetic Users/Organizations created by the harness are test prerequisites only and must not be described as the future production onboarding path.

No test environment may fall back to SQLite when PostgreSQL cannot start.

## 12. Required PF02-A acceptance scenarios

Canonical acceptance-case semantics are not weakened for this slice. Re-reading `acceptance_cases.json` shows that some PF02-A-labelled F cases include application/API or invitation preconditions that PF02-A intentionally does not implement. Therefore PF02-A distinguishes **full canonical-case closure** from **database prerequisite evidence**.

### 12.1 Canonical cases PF02-A can fully close

Only these existing cases are eligible to change from `NOT_RUN` to an evidence-backed PASS during PF02-A publication:

#### F18 — pool context leakage

Using runtime Pool size 1:

```text
org A transaction
→ rollback
→ org B transaction
→ missing-context transaction
```

Expected:

- B cannot see A;
- missing context sees no A/B tenant rows;
- the normalized context helper returns NULL after both COMMIT and ROLLBACK until a new context is set;
- the prior transaction-local value, including PostgreSQL's empty-string reset state, cannot leak authorization.

#### F19 — real runtime role

Verify against actual PostgreSQL metadata and execute the same isolation behavior with the runtime credential:

- `rolsuper = false`;
- `rolcreatedb = false`;
- `rolcreaterole = false`;
- `rolreplication = false`;
- `rolbypassrls = false`;
- runtime role has no privileged inherited membership that would reintroduce those capabilities;
- runtime role is not a member of the migration-owner/privileged role;
- runtime role does not own the tested tables;
- `pg_class.relrowsecurity = true` and `relforcerowsecurity = true` for every scoped table;
- tenant context missing denies general business access.

The migration owner is separately asserted to be non-superuser and non-`BYPASSRLS`; however migration-owner execution never substitutes for the F19 runtime-role proof.

#### F23 — concurrent ACTIVE Occupancy

Two separate runtime connections race to create ACTIVE occupancy for the same Unit.

Expected:

- exactly one commits;
- the other fails with SQLSTATE `23505`;
- exactly one ACTIVE occupancy remains.

This test must create actual overlap with two backend connections; sequential inserts do not count as concurrency evidence. The implementation test obtains both backend PIDs, holds the first transaction open after its insert, starts the conflicting insert on the second connection, and uses a third privileged diagnostic connection only to confirm the second backend is waiting on a lock before the first transaction is committed.

### 12.2 Database prerequisite evidence that does **not** close its canonical F case

The following tests are required in PF02-A, but their canonical F statuses remain `NOT_RUN` because the complete acceptance-case precondition/action is outside this slice.

#### A-ISO-01 — DB prerequisite for F01

PF02-A proof:

- synthetic org A and B already exist as harness prerequisites;
- runtime org A context creates Property/Unit under A;
- A reads its data;
- runtime org B cannot read A;
- missing context cannot read A/B business rows.

Why F01 remains `NOT_RUN`: canonical F01 requires an **active ORG_ADMIN** and the application/API create/read path. PF02-A has neither real actor authorization nor a production API.

#### A-TX-01 — transaction rollback foundation test

Inject a database error after a valid write inside one `withTransaction`/transaction callback.

Expected:

- the transaction fails;
- the first write is absent afterward;
- no partial relationship remains.

This proves the transaction primitive only. It **does not close F16**. Canonical F16 specifically requires invitation consumption/relationship creation failure injection, and Invitation does not exist until PF02-C.

#### A-FK-01 — DB prerequisite for F41

Proof:

- query `pg_constraint` to prove the relevant FK is exactly the composite `(org_id, parent_id) -> (org_id, id)` relationship;
- under runtime org A context, submit an otherwise valid A child that references org B's parent identifier;
- the insert fails with SQLSTATE `23503`;
- no child row persists.

Why F41 remains `NOT_RUN`: canonical F41 requires **both application guard and database guard**. PF02-A proves the DB/RLS/FK half only.

#### A-ADDRESS-01 — DB prerequisite for F43

Create Property rows in org A and B with the same synthetic `address_reference`.

Expected:

- both rows coexist independently;
- A cannot read B through ordinary scoped SQL;
- no database-level cross-org merge occurs.

Why F43 remains `NOT_RUN`: canonical F43 includes product registration/search behavior. PF02-A does not implement the production API/search path.

### 12.3 Additional foundation tests

Also require:

- PostgreSQL `server_version_num = 180006`;
- migrations run from empty DB twice only in the supported sense: first run applies, second run reports no pending migration without changing schema;
- migrations are proven to have executed as the dedicated migration owner, not container admin;
- runtime role cannot CREATE tables in `app`;
- RLS `WITH CHECK` rejects an insert whose row `org_id` differs from current context;
- after both COMMIT and ROLLBACK, the normalized organization helper returns NULL on the reused connection until a new org context is set, including PostgreSQL's empty-string custom-setting reset case;
- `withTransaction` commits success and rolls back failure;
- `withOrgTransaction` releases clients after success and failure;
- database close is idempotent at the package-handle boundary;
- no SQLite/demo/fixture import exists in the new production package.

### 12.4 Acceptance registry update rule

PF02-A publication may update only:

```text
F18 -> PASS_POSTGRES_INTEGRATION
F19 -> PASS_POSTGRES_INTEGRATION
F23 -> PASS_POSTGRES_INTEGRATION
```

and only after the exact canonical actions above pass on real PostgreSQL and the accepted commit is published to main with fresh CI.

`F01`, `F16`, `F41`, and `F43` remain `NOT_RUN`; their PF02-A database prerequisite receipts are linked as supporting evidence for the later phase that executes the full case. Every other unexecuted F case also remains `NOT_RUN`.

## 13. Test discovery

PostgreSQL integration tests must not silently become part of the current fast Shared suite. The current root Vitest config discovers `packages/**/*.test.ts`, so PF02-A must **not** place Docker-backed `*.test.ts` files under `packages/persistence-postgres`.

Use these exact discovery boundaries:

```text
vitest.postgres.config.ts
tests/postgres/**/*.test.ts
npm run test:postgres
```

`vitest.postgres.config.ts` includes only `tests/postgres/**/*.test.ts`, sets `passWithNoTests: false`, and uses a dedicated integration hook timeout large enough for a cold container start without changing any existing Web/Mobile/shared timeout.

Therefore:

- `npm run test:shared` remains Docker-independent;
- `npm run test:postgres` discovers more than zero tests;
- PostgreSQL integration files are not matched by the current shared include;
- the PostgreSQL command fails if Docker/Testcontainers/PostgreSQL is unavailable;
- no existing Jest/Vitest timeout is globally increased to conceal a failure.

## 14. CI evolution

Add one required Linux job:

```text
postgres-integration
```

Environment:

```text
ubuntu-24.04
Node 24.21.0
npm 11.19.0
Docker/Testcontainers
postgres:18.6
```

The job:

1. checks exact Node/npm;
2. confirms the Docker daemon is available;
3. runs `npm ci`;
4. proves manifest/lock do not drift and the protected baseline platform-lock key set is still present;
5. runs `npm run test:postgres`;
6. reports actual discovered/passed test counts;
7. verifies repository/public-data gates appropriate to its changed scope.

After PF02-A is integrated, `foundation-gate` also depends on `postgres-integration`. A missing, skipped, cancelled, or failed PostgreSQL integration job must fail the aggregate gate.

The existing Linux/Windows/Mobile/Web/Expo jobs remain required. Together with the separate Repository `verify` workflow, the **project acceptance check surface** becomes nine checks: the previous eight plus `postgres-integration`. This wording does not claim GitHub branch protection/merge enforcement has been configured; `MERGE_ENFORCED` remains a separate setting/evidence question. PF02-A does not reduce a PF00 gate.

## 15. Frozen/demo boundary

PF00 remains a frozen verified historical baseline while the product evolves through an explicitly authorized production phase.

PF02-A must not alter existing demo persistence behavior to make PostgreSQL integration easier.

Forbidden shortcuts:

- replacing `node:sqlite` with `pg` in the demo container;
- making demo v1 point at the production schema;
- allowing production connection failure to fall back to SQLite;
- seeding production PostgreSQL with `demoBuildings`;
- importing `@build-manager/fixtures` into `persistence-postgres`;
- calling the new schema production-ready merely because integration tests pass.

A later production composition root chooses the PostgreSQL adapter explicitly.

## 16. Security and privacy boundary

PF02-A contains synthetic data only.

Do not commit:

- actual connection strings;
- database passwords;
- tenant/landlord names;
- actual unit numbers tied to people;
- phone/email;
- raw addresses tied to occupants;
- tokens or identity-provider subjects.

SQL must use parameterized values for runtime data. Dynamic identifiers are limited to migration-owned constants, not untrusted inputs.

The existing open risks remain visible:

- dependency-security triage (current npm moderate findings / install-script warning);
- CI action internal-runtime maintenance.

PF02-A installation records any delta without auto-remediation. Any new HIGH/CRITICAL advisory is a blocker. Any newly introduced MODERATE advisory or install script must be individually attributed to the new dependency graph and recorded before acceptance; it is not silently absorbed into the pre-existing risk count.

## 17. Failure handling

PF02-A fails closed.

Examples:

- PostgreSQL unavailable → PostgreSQL tests/startup fail; no SQLite fallback.
- migration failure → candidate fails; do not mark migration history successful.
- missing organization context → organization-scoped reads return no business rows and writes fail RLS.
- invalid UUID context → transaction fails internally; do not reinterpret it as another tenant.
- transaction operation throws → rollback before client release.
- container cannot start → integration test fails as infrastructure evidence, not a skipped PASS.
- cross-org FK or RLS test unexpectedly succeeds → BLOCKER.
- runtime role has superuser/BYPASSRLS/table ownership → BLOCKER.

## 18. Implementation sequence

PF02-A implementation is split into independently reviewable units:

1. package/dependency/test-discovery bootstrap;
2. Testcontainers PostgreSQL 18.6 harness and migration runner;
3. initial schema migrations;
4. runtime pool/transaction/context primitives;
5. role/RLS/grant migration;
6. isolation/FK/rollback/pool-leak tests;
7. concurrency test;
8. CI `postgres-integration` and aggregate-gate wiring;
9. full regression/publication evidence.

No unit begins PF02-B authentication work.

## 19. Completion state

PF02-A may be called verified only when:

- all authorized dependency versions are resolved exactly;
- migrations reproduce on a fresh PostgreSQL 18.6 container;
- selected PF02-A F cases pass using actual PostgreSQL;
- runtime role is proven non-owner, non-superuser, non-`BYPASSRLS`;
- RLS and composite FKs actually reject forbidden cases;
- concurrent ACTIVE occupancy produces exactly one winner;
- transaction-local organization context does not leak through pool reuse;
- `postgres-integration` is required by the aggregate CI gate;
- existing PF00 regression gates remain green;
- the exact PF02-A PR head passes all nine required checks;
- after independent acceptance and merge, a fresh push-to-main run on the actual merge SHA passes all nine required checks before PF02-A is called VERIFIED;
- no real user data or production credentials are used.

Successful PF02-A status:

```text
PF00 = FROZEN
PF01 = REVIEW_DRAFT (PF02-A-required constraints approved for this slice)
PF02-A = VERIFIED
PF02-B = NOT_STARTED
real identity/auth = NOT_IMPLEMENTED
real tenant data = NOT_AUTHORIZED
```

At PF02-A publication, canonical status/evidence documents may mark only F18, F19, and F23 as `PASS_POSTGRES_INTEGRATION` when their full canonical actions have actually executed. The database-only prerequisites for F01/F16/F41/F43 do not change those canonical statuses from `NOT_RUN`. All other unexecuted PF02 cases remain `NOT_RUN`.

## 20. Decisions deliberately deferred

These are not implementation placeholders; they are governed future decisions outside PF02-A:

- **D01** identity provider and account-recovery flow — before PF02-B.
- **D02b** production PostgreSQL hosting, region, backup/restore and credential provisioning — before real-data pilot.
- **D03** organization activation/management-control verification — before real-data pilot.
- **D04** field-specific privacy retention/deletion/subprocessors/international transfer — before real-data pilot.
- **D05** notification channel, response-time policy and cost ceilings — before real-data pilot.

No executor may fill these with convenient defaults and claim production readiness.

## 21. Source verification

Versions and technical behaviors were rechecked on 2026-09-19 for this review-ready revision:

- PostgreSQL 18.6 release notes: https://www.postgresql.org/docs/release/18.6/
- PostgreSQL 18 UUID functions: https://www.postgresql.org/docs/18/functions-uuid.html
- PostgreSQL row security: https://www.postgresql.org/docs/18/ddl-rowsecurity.html
- PostgreSQL role/RLS bypass behavior: https://www.postgresql.org/docs/18/sql-createrole.html
- PostgreSQL `set_config` / `current_setting`: https://www.postgresql.org/docs/18/functions-admin.html
- PostgreSQL `server_version_num`: https://www.postgresql.org/docs/18/runtime-config-preset.html
- node-postgres transactions: https://node-postgres.com/features/transactions
- pg 8.23.0 package: https://www.npmjs.com/package/pg
- @types/pg 8.23.1 package: https://www.npmjs.com/package/@types/pg
- Testcontainers PostgreSQL package 12.1.0: https://www.npmjs.com/package/@testcontainers/postgresql
- Testcontainers PostgreSQL documentation: https://node.testcontainers.org/modules/postgresql/
- node-pg-migrate 9.0.0: https://www.npmjs.com/package/node-pg-migrate
- node-pg-migrate programmatic API: https://salsita.github.io/node-pg-migrate/api
- node-pg-migrate migration loading strategies: https://salsita.github.io/node-pg-migrate/migration-loading-strategies
- node-pg-migrate migrations/locking: https://salsita.github.io/node-pg-migrate/migrations/

Audit note: PostgreSQL custom two-part settings are intentionally treated as an internal implementation mechanism, not a typed application-session-variable feature. The integration suite pins the observed empty-string reset behavior into the helper contract rather than assuming `current_setting(..., true)` returns NULL after a pooled connection has previously set the key.

## 22. Review focus

Before implementation, reviewers should specifically challenge these five failure classes:

1. **RLS false confidence:** a test accidentally uses the migration owner, container superuser, privileged membership, or a `BYPASSRLS` role and therefore proves nothing.
2. **Transaction-context escape/leak:** a caller bypasses the opaque database handle or the custom GUC resets to an empty string after `SET LOCAL`, causing stale/invalid tenant context handling.
3. **Cross-org referential mismatch:** globally unique UUIDs make an invalid parent reference appear safe unless the exact composite FK and SQLSTATE `23503` are exercised.
4. **Fake concurrency:** the active-occupancy test executes sequentially instead of proving a second backend actually waited on the first transaction's conflicting write.
5. **Demo/test contamination:** production adapter imports fixtures, Docker-backed tests enter the Shared suite, or PostgreSQL failure silently falls back to SQLite.

Each of these must be covered by a concrete integration test in the implementation plan.

# PF02-B / B5 Organization Membership Termination & Last-Admin Safety — Implementation Plan

Date: **2026-10-01**

Status: **IMPLEMENTATION_PLAN_CORRECTION_CANDIDATE / DELTA_REVIEW_PENDING / PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED**

Revision: **0.4**. Original whole-plan review at HEAD `3e6629989a5cacf47050f7f5cf6f52e11419d94c` / blob `984ab71cff5418a8b84b789e2992c12441fda75e` returned CHANGES_REQUIRED, BLOCKER0/HIGH0/MEDIUM5/LOW5. Revisions 0.2/0.3 supplied the ten corrections and the B5PD-M01 common-bootstrap connection. The supplied independent cumulative delta review at HEAD `735cd51ad6300d763fd6d27a218ad1ef21a71767` / blob `ada42c66245deaef2353c772bc591b3296024e34` returned CHANGES_REQUIRED, BLOCKER0/HIGH0/MEDIUM1/LOW0: nine original findings and B5PD-M01 RESOLVED in plan text; B5P-M02 PARTIALLY_RESOLVED through new finding B5PDR-M01. This revision addresses only that worker-loading/frozen-source issue and its evidence links; independent acceptance remains pending. No design change, runtime verification, plan approval, Ready conversion, merge or product-implementation authorization is implied.

Revision 0.3's bounded common-bootstrap connection is preserved. The next independent review may be limited to B5PDR-M01 and its directly dependent worker-loading/frozen-source boundaries against `735cd51ad6300d763fd6d27a218ad1ef21a71767`; the supplied cumulative review already dispositioned the earlier corrections. Its overall CHANGES_REQUIRED verdict is not converted into acceptance by this revision.

Repository: `edward321416-maker/build-manager`

Plan base / POLICY_REF / TARGET_REF:

`main@211d84ead3e65f328da648d1cc9f3e050c326c1a`

Approved design:

`docs/superpowers/specs/2026-09-30-pf02-b-b5-organization-membership-termination-last-admin-safety-design.md`

Approved design blob:

`3c33c817236f7b9d3c6a404125f94e48913d7a8f`

Deadline mode: target release-candidate readiness by **2026-10-05**. This plan is intentionally execution-oriented: six bounded tasks, explicit RED→GREEN evidence, no speculative adjacent product work.

---

## 1. Goal

Implement only the approved B5 slice:

> A current same-org ACTIVE `ORG_ADMIN` can terminate one existing ACTIVE `OrganizationMembership` while preserving history and preventing voluntary B5 commands from leaving zero effective administrators.

Effective administrator means:
- membership ACTIVE;
- role ORG_ADMIN;
- referenced `app_user.status='ACTIVE'`.

Public resource:

`DELETE /api/v2/organizations/:orgId/memberships/:membershipId`

Success:

`204 No Content`

The implementation must preserve B1-B4 frozen behavior and keep:
- F15 = NOT_RUN;
- F25 = NOT_RUN;
- F39 = NOT_RUN;
- B5D2-L02 = ACCEPTED_LOW_RESIDUAL.

---

## 2. Hard boundaries

Do **not** implement or prepare:
- role mutation, promotion or demotion;
- membership create/reactivate;
- staff/member roster, search, profile or identity projection;
- invitation/onboarding/account creation;
- PropertyAssignment cleanup/cascade;
- assignment collection or UI;
- User/Organization suspension;
- PF02-C;
- F43;
- provider/IAM changes;
- real tenant/landlord/contact data;
- production hosting;
- dependency/version/lockfile/workflow changes.

Migrations `0001`–`0009` are byte-frozen. Add only migration `0010_b5_membership_termination.sql`.

Do not modify frozen B1/B2/B3/B4 helper bodies. Any test inventory adjustment must be additive and bounded exactly as described below.

The sole test-bootstrap connection exception is the Task 1 import and one awaited B5 provisioning call inside `packages/persistence-postgres/src/testing/roles.ts::provisionTestRoles`. Preserve the existing B1/B4 provisioning calls, their implementations, `grantRuntimeAccess`, and the existing signature/return contract. This permits no frozen product-helper rewrite, migration-runner change, or Web global-setup change; it takes effect only after separate product-implementation authorization.

Keep `tests/postgres/helpers/idle-pool-worker.ts` and `tests/postgres/foundation.test.ts` (the existing R27-H02 test owner) byte-unchanged against the implementation base. Use the new B5-owned worker instead. No production timeout-override parameter, test-only production switch, global exception suppressor, or repeat-until-green is allowed.

---

## 3. Expected implementation shape

### New application/API surface

Create:
- `packages/api-contracts/src/b5.ts`
- `packages/application/src/b5/ports.ts`
- `packages/application/src/b5/errors.ts`
- `packages/application/src/b5/validation.ts`
- `packages/application/src/b5/membership-termination.ts`
- `packages/application/src/b5/membership-termination.test.ts`

Modify:
- `packages/api-contracts/src/index.ts`
- `packages/application/src/index.ts`

Public B5 error vocabulary:

`UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | INVALID_INPUT | CONFLICT | PAYLOAD_TOO_LARGE | DEPENDENCY_UNAVAILABLE | METHOD_NOT_ALLOWED`

Application port:

`OrganizationMembershipTerminationPort.endCurrent(digest, orgId, membershipId): Promise<void>`

Application layer validates exact lower-case UUID selectors and 64-char lower-case digest, performs only the current-session precheck, and delegates decisive authority to persistence.

### New PostgreSQL surface

Create:
- `packages/persistence-postgres/migrations/0010_b5_membership_termination.sql`
- `packages/persistence-postgres/src/testing/b5-roles.ts`
- `packages/persistence-postgres/src/b5/index.ts`
- `packages/persistence-postgres/src/b5/transaction.ts`
- `packages/persistence-postgres/src/b5/membership-termination.ts`

Modify:
- `packages/persistence-postgres/src/testing/index.ts`
- `packages/persistence-postgres/src/testing/roles.ts` (Task 1 test-bootstrap import and one awaited call only)
- `packages/persistence-postgres/package.json`

The only package-manifest change allowed is:

`"./b5": "./src/b5/index.ts"`

No dependency or lockfile change.

### New Web surface

Create:
- `apps/web/src/server/b5/errors.ts`
- `apps/web/src/server/b5/request.ts`
- `apps/web/src/server/b5/http.ts`
- `apps/web/src/app/api/v2/organizations/[orgId]/memberships/[membershipId]/route.ts`

Modify:
- `apps/web/src/server/b1/container.ts`

The existing single B1 PostgreSQL pool is reused. No B5 DATABASE_URL or second pool.

### B5-owned tests

Create:
- `tests/postgres/b5-schema.test.ts`
- `tests/postgres/b5-capabilities.test.ts`
- `tests/postgres/b5-membership-termination.test.ts`
- `tests/postgres/b5-concurrency.test.ts`
- `tests/postgres/b5-revocation.test.ts`
- `tests/postgres/b5-timeout.test.ts`
- `tests/postgres/b5-transaction.test.ts`
- `tests/postgres/helpers/b5-timeout-worker.ts`
- `tests/postgres/helpers/b5-fixture.ts`
- `tests/architecture/b5-boundary.test.ts`

Also create:
- `apps/web/src/server/b5/http.test.ts` (colocated HTTP unit tests, matching B3/B4);
- `apps/web/tests/b1-e2e/b5-fixture.ts` (synthetic fixtures only);
- `apps/web/tests/b1-e2e/b5.spec.ts` (actual authenticated Web/API/PostgreSQL evidence, owned by Task 3).

The existing PostgreSQL test glob is `tests/postgres/**/*.test.ts`; the existing authenticated Playwright configuration discovers `apps/web/tests/b1-e2e`, with retries 0. Do not introduce another runner/configuration.

Bounded existing-test updates only:
- `tests/postgres/b2-capabilities.test.ts`
- `tests/postgres/b3-capabilities.test.ts`
- `tests/architecture/b1-boundary.test.ts`
- `apps/web/tests/b1-e2e/check-results.mjs`: append only the three Task 3 B5 case names and missing-B5-case negative controls; preserve all existing case names, verifier conditions and negative controls.

Any additional existing file may be changed only if a RED test proves it is a necessary B5 integration point and the executor records that justification before editing. This rule never overrides the frozen-source boundary: do not edit frozen B1/B2/B3/B4 application or persistence-postgres sources, including their error classes, to make the B5 worker load. Preserve their existing implementations and shared `src/transaction.ts`; only the explicitly predeclared additive integration seams and Task 1 import/await-only bootstrap exception remain permitted. A worker load failure is not authorization for a frozen-source rewrite.

---

# Task 1 — Add migration 0010, disposable test roles, exact catalog/RLS boundary

## Files

Create:
- `packages/persistence-postgres/src/testing/b5-roles.ts`
- `packages/persistence-postgres/migrations/0010_b5_membership_termination.sql`
- `tests/postgres/b5-schema.test.ts`
- `tests/postgres/b5-capabilities.test.ts`

Modify:
- `packages/persistence-postgres/src/testing/index.ts`
- `packages/persistence-postgres/src/testing/roles.ts` (test-bootstrap connection only; see Step 2)
- `tests/postgres/b2-capabilities.test.ts`
- `tests/postgres/b3-capabilities.test.ts`

## Step 1 — RED: migration and role-contract tests

Write failing tests that prove:
- migrations `0001`–`0009` are unchanged from the implementation-base bytes;
- disposable test infrastructure provisions exactly:
  - `bm_b5_membership_owner`;
  - `bm_b5_effective_admin_probe_owner`;
- both roles are NOLOGIN / NOSUPERUSER / NOCREATEDB / NOCREATEROLE / NOREPLICATION / NOBYPASSRLS / NOINHERIT;
- migration role has SET-only, non-inherited, non-admin membership to both roles in tests;
- `bm_b1_web` cannot SET ROLE to either B5 role;
- production migration fails closed if either role is missing, has wrong attributes, wrong membership, or hostile Web membership;
- failed migration leaves no partial `b5_*` functions/policies/grants.

In `tests/postgres/b5-schema.test.ts`, add a common-bootstrap regression that calls the existing exported `provisionTestRoles(admin, adminConfig, database)` on a fresh disposable database, with no B5-specific role pre-seeding. Assert both B5 roles and their exact migrator memberships exist before migration, the existing return shape is unchanged, and `runPostgresMigrations` then applies through 0010 successfully. The pre-connection RED must fail on missing B5 role/catalog assertions, not an import error; the test must still detect an omitted awaited call when the new helper/export already exists. Keep separate deliberate missing-role negative controls that bypass the all-role helper and still fail closed.

## Step 2 — Implement test-only role provisioning and connect the common bootstrap

Follow `src/testing/b4-roles.ts` style. Define the new `provisionB5TestRoles(admin: Client, migrationRole: string): Promise<void>` in `b5-roles.ts`; it provisions only the two disposable NOLOGIN owners and exact SET-only memberships already specified above, never a production login or credential.

In `packages/persistence-postgres/src/testing/roles.ts`, add its import and exactly one awaited `provisionB5TestRoles(admin, TEST_MIGRATION_ROLE)` call immediately after the existing `await provisionB4TestRole(admin, TEST_MIGRATION_ROLE)` and before `return { migrationConfig, runtimeConfig, b1 }`. Preserve the `provisionTestRoles` signature, return type/shape, credentials, and existing B1/B4 order; return no B5 credential/config. Do not change either existing role generator or `grantRuntimeAccess`.

Keep `testing/index.ts` exporting the same `provisionTestRoles` from `./roles`; add only the new B5 testing exports, not an alternative wrapper/re-export route. Existing PostgreSQL harnesses and `apps/web/tests/b1-e2e/global-setup.ts` must obtain B5 roles through that common call before `runPostgresMigrations`; do not edit Web global setup, `testing/migrate.ts`, or compensate inside `b5-fixture.ts` after migration has already run. No role creation in production migration SQL, suppressed preflight error, or weakened missing-role check is allowed.

Run `npm run test:postgres -- tests/postgres/b5-schema.test.ts tests/postgres/b5-capabilities.test.ts` from repository root. At this step, common role/return-contract assertions must turn GREEN while not-yet-implemented migration/catalog assertions remain RED; after Steps 3/4, the same tests must all pass. Task 3 Step 4 separately proves the unchanged Web setup reaches server startup and the three B5 cases through this connection.

## Step 3 — Implement migration 0010

Preflight both B5 roles before creating B5 objects.

Create the exact accepted privilege graph:

### `bm_b5_membership_owner`

Common:
- USAGE on `app, authn`;
- EXECUTE on `app.current_org_id()`.

Organization:
- SELECT(id,status);
- UPDATE(id) only, solely to permit `FOR NO KEY UPDATE`;
- B5-specific RESTRICTIVE SELECT/UPDATE ceilings require current ACTIVE org and prevent any business transition.

OrganizationMembership:
- SELECT(id,org_id,role,status,version);
- UPDATE(status,version,ended_at);
- no SELECT(user_id,created_at,ended_at);
- no INSERT/DELETE;
- RESTRICTIVE SELECT ceiling = current org only;
- RESTRICTIVE UPDATE ceiling = old current-org ACTIVE, new current-org ENDED with ended_at non-null.

### `bm_b5_effective_admin_probe_owner`

Common:
- USAGE on `app, authn`;
- EXECUTE on `app.current_org_id()`.

Reads only:
- membership SELECT(id,org_id,user_id,role,status);
- app_user SELECT(id,status).

Membership RESTRICTIVE SELECT ceiling:
- current org;
- ACTIVE;
- ORG_ADMIN.

No mutation privilege on either table.

### Helpers

Create:
- `authn.b5_classify_caller(bytea,uuid) RETURNS text`
  - owner `bm_b1_capability_owner`;
  - STABLE;
  - SECURITY DEFINER;
  - `search_path=pg_catalog`;
  - result `ALLOWED | NOT_FOUND | FORBIDDEN`;
  - EXECUTE only to B5 command owner.

- `authn.b5_has_other_effective_admin(uuid,uuid) RETURNS boolean`
  - owner probe owner;
  - STABLE;
  - SECURITY DEFINER;
  - `search_path=pg_catalog,pg_temp`;
  - EXECUTE only to B5 command owner;
  - different ACTIVE ORG_ADMIN membership joined to ACTIVE app_user;
  - boolean only.

Create the B5 command function under `bm_b5_membership_owner`; no catch-all `EXCEPTION WHEN OTHERS`; no dynamic SQL.

Temporarily grant CREATE on authn only where required, create functions under the intended owner, revoke PUBLIC EXECUTE, grant exact EXECUTE, RESET ROLE, then revoke temporary CREATE.

## Step 4 — Catalog/behavior GREEN

B5 catalog tests must assert:
- exact role attributes/memberships;
- exact column grants;
- exact policy types/roles/expressions;
- exact helper owner/volatility/search_path/ACL;
- command `authn.b5_end_organization_membership(bytea,uuid,uuid)` owner is `bm_b5_membership_owner`, SECURITY DEFINER, `search_path=pg_catalog,pg_temp`, with PUBLIC EXECUTE revoked and only the intended command EXECUTE grant to Web;
- command definition contains no dynamic SQL or catch-all `EXCEPTION WHEN OTHERS`;
- Web gets command EXECUTE only;
- command owner gets helper EXECUTE only;
- no direct Web membership DML;
- no B5 owner role/user/org mutation surface;
- probe owner cannot mutate tables or read ungranted columns such as `app_user.session_epoch`;
- helper positive case with two distinct ACTIVE admin Users returns true;
- SUSPENDED/DELETION_PENDING second User, ENDED/staff membership, foreign/missing context return false/no visibility.

### AC15 — Mandatory owner-role behavior

Run the following approved-design AC15 list under real `SET ROLE` to each disposable synthetic owner, using the migrator's SET-only/non-inherited membership. Assert final RLS/privilege behavior, not merely catalog snapshots. Use valid positive-control rows and statements that isolate the intended denial; unrelated syntax/fixture failures do not satisfy a negative.

Using the disposable synthetic B5 command owner under final policies:
- actual ACTIVE→ENDED UPDATE succeeds;
- ENDED→ACTIVE denied;
- role/org/user update denied;
- membership INSERT denied;
- membership DELETE denied;
- Organization status/display_name/created_at update denied;
- Organization id change denied by RLS/FK;
- missing org context sees/mutates zero B5 rows.

Using the disposable synthetic B5 effective-admin probe owner under final policies:
- INSERT/UPDATE/DELETE on organization_membership denied;
- INSERT/UPDATE/DELETE on app_user denied;
- ungranted membership columns denied outside the granted set;
- ungranted app_user columns such as session_epoch denied;
- ENDED membership rows not visible through the probe policy;
- PROPERTY_STAFF membership rows not visible through the probe policy;
- foreign-org admin membership rows not visible through the probe policy;
- missing current-org context yields zero probe-visible membership rows.

Use synthetic transaction/fixture cleanup; do not provision a production role or credential. Verify denied/zero-row mutations leave the corresponding row bytes unchanged. Read full history snapshots through a separate privileged synthetic fixture, not by expanding the owner's SELECT grants.

Bounded frozen-test changes:
- B2 exact policy inventory excludes `b5_*` just as it excludes B3/B4;
- B2 role-membership inventory excludes the two B5 test-owner provisioning relationships while B5 tests assert them exactly;
- B3 `can_administer_org` ACL remains byte-for-byte equivalent in meaning; add B5 roles to negative privilege probes if needed, but do not grant them direct EXECUTE.

STOP if satisfying catalog tests requires widening frozen B1-B4 helper bodies or raw Web membership privileges.

---

# Task 2 — Application contract and B5-specific persistence transaction/command port

## Files

Create:
- `packages/api-contracts/src/b5.ts`
- `packages/application/src/b5/{ports,errors,validation,membership-termination}.ts`
- `packages/application/src/b5/membership-termination.test.ts`
- `packages/persistence-postgres/src/b5/{index,transaction,membership-termination}.ts`
- `tests/postgres/b5-transaction.test.ts`

Modify:
- `packages/api-contracts/src/index.ts`
- `packages/application/src/index.ts`
- `packages/persistence-postgres/package.json`

## Step 1 — RED: application contract

Test:
- valid call delegates once to `endCurrent`;
- malformed digest/UUID => INVALID_INPUT;
- missing current actor => UNAUTHENTICATED;
- persistence NOT_FOUND/FORBIDDEN/CONFLICT/DEPENDENCY_UNAVAILABLE remain sanitized B5 errors;
- no DTO/member identity is returned.

## Step 2 — Implement API/application B5 types

Add only B5 error schema; success DELETE has no response body schema.

New B5 application code must not use TypeScript parameter properties. Declare fields explicitly and assign them in the constructor body; keep the new B5 source erasable. Do not rewrite existing B1/B3/B4 error classes or remove their existing exports to satisfy this rule. Task 5 handles the real graph's legacy syntax within the B5 test child only.

## Step 3 — RED: transaction order and connection-loss safety

In `tests/postgres/b5-transaction.test.ts`, prove exact production query order:

`BEGIN ISOLATION LEVEL READ COMMITTED`
→ `SET LOCAL lock_timeout = '2000ms'`
→ `SET LOCAL statement_timeout = '5000ms'`
→ `SET LOCAL transaction_timeout = '7000ms'`
→ current_actor
→ authorize_org
→ set_config org/session
→ command
→ `COMMIT`

A fixture-side probe after the three SET LOCAL statements must assert `current_setting('transaction_isolation') = 'read committed'`; it is not an extra production query or a substitute for the exact-order assertion. Do not rely on the connection's default isolation. Do not use `withB1OrgTransaction` unchanged.

Add a RED fake-client test that emits `error` twice around a query rejection (before and after it), plus an event during release handoff. Assert a persistent, idempotent handler, no unhandled event, no COMMIT/ROLLBACK after observed termination, exactly one `release(true)`, and no listener-free cleanup interval. Cover normal release separately to detect listener accumulation. Missing imports alone are not behavioral RED evidence.

## Step 4 — Implement isolated B5 transaction wrapper

Preferred implementation: `src/b5/transaction.ts` owns the checked-out `PoolClient` using existing internal `getInternalPool(database)` and mirrors the frozen `withTransaction` success/rollback/unknown-COMMIT semantics without changing the frozen shared helper.

It must:
- attach a persistent temporary checked-out-client `error` listener with `on`, never `once`, before BEGIN; it must be idempotent and tolerate repeated events without throwing or logging raw errors;
- use `BEGIN ISOLATION LEVEL READ COMMITTED`, then arm the three fixed SET LOCAL values above as the first statements after BEGIN;
- then run current_actor / authorize_org / org+session set_config;
- set a termination flag on captured client termination; check it before COMMIT/ROLLBACK, skip both once termination is observed, return the sanitized dependency category, and force `release(true)`;
- treat 25P04/session termination as connection loss and force `release(true)` even when first observed through the query rejection;
- destroy on failed BEGIN/COMMIT/ROLLBACK or captured client termination, releasing exactly once;
- retain the temporary listener through synchronous `release(true)` and remove it only after that call returns; never remove it first or introduce an await between removal and release;
- on a healthy path, likewise remove the temporary listener only after ordinary release returns, without accumulating listeners on pooled clients;
- never auto-retry;
- never log credentials/raw SQL/error payloads.

Before relying on that listener handoff, inspect the installed locked `pg@8.23.0` and its lock-resolved `pg-pool` sources: checkout/release listener transfer, Client error/socket-close handling, and end/destruction ordering. Record exact package versions, source paths and bounded line evidence. The supplied review explicitly described these internals from library knowledge, not a repository-installed inspection; this plan does not claim that inspection or runtime proof has already occurred. The fake-client test and real child-process tests are both mandatory. Stop for review if the installed behavior contradicts the handoff contract.

STOP AND REVIEW if the only viable implementation requires changing shared `src/transaction.ts`; do not silently widen a frozen cross-slice helper.

## Step 5 — Implement persistence port

Expose only through `@build-manager/persistence-postgres/b5`.

Call exactly one public command function:
`SELECT authn.b5_end_organization_membership($1::bytea,$2::uuid,$3::uuid) AS state`

Map:
- ENDED => success;
- NOT_FOUND => B5 NOT_FOUND;
- FORBIDDEN => B5 FORBIDDEN;
- LAST_ADMIN => B5 CONFLICT;
- PostgreSQL/driver 55P03/57014/40P01/40001/23514/22003/25P04 and unknown errors => B5 DEPENDENCY_UNAVAILABLE;
- B1 transaction-context UNAUTHENTICATED/NOT_FOUND => corresponding B5 sanitized category;
- unknown COMMIT outcome => DEPENDENCY_UNAVAILABLE, no retry.

Architecture test later must prove persistence contains no raw `app.organization_membership` DML and no second pool.

---

# Task 3 — Web DELETE transport and single-pool integration

## Files

Create:
- `apps/web/src/server/b5/{errors,request,http}.ts`
- exact membership route
- `apps/web/src/server/b5/http.test.ts`
- `apps/web/tests/b1-e2e/b5-fixture.ts`
- `apps/web/tests/b1-e2e/b5.spec.ts`

Modify:
- `apps/web/src/server/b1/container.ts`
- `tests/architecture/b1-boundary.test.ts`
- `apps/web/tests/b1-e2e/check-results.mjs` (bounded additive case inventory and negative controls only)

## Step 1 — RED: HTTP precedence

Test recognized methods and DELETE precedence:
1. recognized-but-disallowed method => 405 + `Allow: DELETE`;
2. DELETE wrong/missing Origin => 403;
3. no session => 401;
4. bad/missing CSRF => 403;
5. query/path/body invalid => 400 or 413;
6. hidden/inactive org => 404;
7. visible caller no longer admin => 403;
8. hidden/missing/ENDED target => 404;
9. sole effective admin => 409;
10. successful termination => 204 empty body.

All responses use frozen private/no-store headers and Cookie Vary.

No response projects membership/user/role/version/timestamps.

## Step 2 — Implement handler

Follow B4 transport style but support only DELETE.

Export DELETE plus the pinned Next.js recognized disallowed method dispatchers needed for deterministic custom 405. Verify the exact route-method inventory against the pinned runtime rather than assuming framework behavior.

Keep PROPFIND as framework-owned diagnostic evidence; do not invent CONNECT/TRACE guarantees.

## Step 3 — Container integration

Add one B5 termination port on the existing single B1 database handle.

No new env var, pool, provider client or credential.

Update route inventory from nine to ten v2 route files.

## Step 4 — Actual authenticated Web/API/PostgreSQL evidence

Prerequisite: Task 1's common bootstrap must create B1/B4/B5 roles before migration 0010. Use the unchanged `apps/web/tests/b1-e2e/global-setup.ts` path: `provisionTestRoles` → `runPostgresMigrations` → Web server startup → B5 spec. A B5 fixture that manually creates missing roles after setup is not evidence for this connection; startup/migration failures must fail the run rather than be swallowed. Verify global setup and the migration runner remain byte-unchanged.

`apps/web/tests/b1-e2e/b5.spec.ts` owns the following exact case titles, using a new B5 fixture and the existing synthetic session/server/PostgreSQL setup without editing frozen B4 fixtures/specs:
- `B5 AC02-06 membershipTerminationAndLastAdmin`: successful staff/admin termination, last-effective-admin rejection, repeated/hidden target non-disclosure and database history/version readback;
- `B5 AC03 AC13 transportAndNonDisclosure`: real HTTP method/Origin/session/CSRF/query/path/body precedence, private/no-store and Cookie Vary, empty 204, sanitized failures and zero mutation;
- `B5 AC10-12 membershipRevocationAndSessionSeparation`: before/after B1-B4 authority checks through the ended membership, untouched assignment history, and continued unrelated-org access using the same synthetic session.

Follow `apps/web/tests/b1-e2e/b4.spec.ts` / `b4-fixture.ts` as read-only precedents. B5 fixtures may compose existing helpers; new B5 fixture behavior stays in the new file. Assert real HTTP responses plus PostgreSQL readback, not mocked port calls. This is SYNTHETIC_AUTH + ACTUAL_WEB_POSTGRES, never LIVE_PROVIDER evidence.

Append these three exact names to `check-results.mjs` and add a missing-case negative control for each. Preserve all 57 existing required cases, exact-one-result checks, retries=0, failure/skip/error rejection and existing negative controls. The expected full-run case inventory becomes 60; do not weaken equality into a minimum count.

From repository root, run the targeted browser spec with `npm --workspace @build-manager/web run test:e2e:b1 -- b5.spec.ts`. Then run `npm run test:e2e:b1` and `node apps/web/tests/b1-e2e/check-results.mjs` on the full report. Do not feed the targeted three-case report to the full-inventory checker. Keep the existing prebuilt-server/environment setup and workflows unchanged. If existing setup cannot support the new fixture without a frozen change, stop and report the exact integration need.

---

# Task 4 — PostgreSQL command semantics, concurrency, revocation and B4 interaction

## Files

Create:
- `tests/postgres/helpers/b5-fixture.ts`
- `tests/postgres/b5-membership-termination.test.ts`
- `tests/postgres/b5-concurrency.test.ts`
- `tests/postgres/b5-revocation.test.ts`

Implement/finalize migration command function until these tests are GREEN.

## Required command algorithm

Inside the B5 function:
1. optional fast caller classification;
2. lock current ACTIVE Organization `FOR NO KEY UPDATE`; if the lock returns zero rows (including an org hidden/inactivated while waiting), return NOT_FOUND immediately with no further command statements or mutation;
3. reclassify caller;
4. lock all current ACTIVE ORG_ADMIN memberships plus exact ACTIVE target in **one top-level query** with `ORDER BY id FOR NO KEY UPDATE`;
5. derive target from locked rows;
6. reclassify caller after wait;
7. for admin target require `b5_has_other_effective_admin=true`;
8. exactly one guarded `ACTIVE→ENDED` UPDATE:
   - status ENDED;
   - ended_at DB-owned;
   - version + 1;
   - caller still ALLOWED;
   - admin target still has another effective admin;
9. classify zero-row result without issuing a second mutation;
10. return ENDED / NOT_FOUND / FORBIDDEN / LAST_ADMIN.

## Mandatory GREEN cases

### Basic/history
- staff ACTIVE→ENDED;
- admin ACTIVE→ENDED with other effective admin;
- id/org/user/role/created_at unchanged;
- ended_at set once;
- version increments exactly once;
- repeated target => 404 and byte/version unchanged.

### Last-admin
- sole admin => 409/no mutation;
- second admin membership ACTIVE but User SUSPENDED => 409;
- second admin membership ACTIVE but User DELETION_PENDING => 409.

### AC07–AC10 test-controlled transaction boundary

For evidenced concurrency/race waits, call the real `authn.b5_end_organization_membership` function directly as `bm_b1_web` in test-controlled READ COMMITTED transactions with the real authorized synthetic org/session context. Do not use privileged fixture DML as the product operation. A separate privileged fixture may hold/release the Organization lock or stage the specified race.

These semantic-lock tests intentionally do not pass through the production wrapper's 2000ms lock budget. Keep their own bounded harness watchdog and finally-release cleanup; do not modify global/production timeouts. Follow the `gateB4Query` / `waitB4Lock` fixture-side gating and observation precedent without editing frozen helpers. Test wrapper timeout enforcement separately in Task 5 and real HTTP mapping in Task 3; direct-function evidence must not be labeled wrapper/HTTP execution.

### AC07 concurrency

Use distinct DB handles/backend PIDs and `pg_blocking_pids` or `pg_stat_activity`, no sleeps-as-proof. Establish the first lock holder and observe the waiter before releasing the holder; commit in the evidenced order. Assert exact SQL results with their separately tested public mappings:
- self/self with two admins => ENDED then LAST_ADMIN (204 then 409);
- cross A ends B while B ends A => ENDED then NOT_FOUND (204 then 404 because the losing caller's membership ended);
- two distinct still-active admins end the same staff target => ENDED then NOT_FOUND (204 then 404);
- three admins each self-terminate in an evidenced A→B→C order => ENDED, ENDED, LAST_ADMIN; one effective administrator remains.

Prove Organization lock is the first common serialization point. In every variant assert at least one effective admin remains. A 503 or arbitrary denial is not an acceptable substitute for the specified business result. No repeat-until-green; a failed/deadline-exceeded run is retained and investigated.

### Authority/target races
- caller loses membership visibility while blocked => 404;
- caller remains visible but ceases admin => 403;
- target becomes ENDED before classification => 404/no rewrite.

### B4 interaction
Controlled B4 PUT × B5 termination in both commit orders:
- PropertyAssignment history is never cleaned up;
- ACTIVE assignment may remain/be committed after membership end;
- frozen B2/B4 authority still denies through ENDED membership;
- no authority revival.

### Multi-org/session separation
- unrelated org memberships remain unchanged/usable;
- no global logout/session revoke.

STOP if a concurrency test can reach zero effective admins or requires client-side admin counting.

---

# Task 5 — Timeout/error/connection evidence and architecture/frozen regression

## Files

Create:
- `tests/postgres/b5-timeout.test.ts`
- `tests/postgres/helpers/b5-timeout-worker.ts`
- `tests/architecture/b5-boundary.test.ts`

Modify only bounded frozen inventories already declared.

## Fixture-side gates and B5-owned native worker

Use fixture-side interception of the checked-out client's query in `b5-fixture.ts` / the B5 worker, never a production delay/timeout option. Preserve and restore the intercepted method in finally. Gate after the real command returns and before COMMIT delivery for the idle-in-transaction variant. For the active-statement variant, first age the transaction within its fixed budget, then run a fixture-only statement on the same client that spans the remaining transaction lifetime but is shorter than the fixed 5000ms statement timeout. An immediate statement longer than 7000ms would hit statement_timeout first and is not valid 25P04 evidence. Use backend state/timing and the observed error class to identify the actual failure, not the planned delay alone.

The new `b5-timeout-worker.ts` must load the real B5 port/wrapper under the pinned native Node runtime. Its resolver must handle extensionless relative imports in both `packages/persistence-postgres/src/` and `packages/application/src/`, including required parent-relative imports. Derive any additional finite workspace-source allowlist from the actual B5 import graph and record it; do not rewrite builtins, third-party modules, explicit-extension imports or paths outside those allowlisted source roots. Smoke-test worker module loading before inducing database failure. Do not edit `idle-pool-worker.ts` or `tests/postgres/foundation.test.ts`.

### B5PDR-M01 — Native TypeScript loading contract

Resolution and syntax transformation are separate requirements. At the pinned base, the application index re-exports B1/B3/B4 error classes with TypeScript parameter properties; fixing extensionless paths alone does not make the real graph load in strip-only mode. Official [Node v24 TypeScript documentation](https://r2.nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping), displayed as v24.21.0 when checked, documents `--experimental-transform-types` for this syntax. This is source/documentation evidence, not a claim that the B5 worker has run.

In the new `tests/postgres/b5-timeout.test.ts`, fork only the new B5 worker using the repository-pinned Node **24.21.0** executable and an explicit `execArgv: ["--experimental-transform-types"]`. Verify the actual executable version and option support before relying on it; record the child version and effective execArgv. Do not inherit an arbitrary parent execArgv, set global `NODE_OPTIONS`, change workflows/manifests/toolchain, install another loader, or change the R27-H02 fork's `execArgv: []`. The transformation option is a B5 test-child launch setting, not a production runtime setting or a production test switch.

The load smoke test must use this same launch contract and resolver to dynamically import the real `@build-manager/persistence-postgres/b5` package entry with its actual application dependencies, without stubbing the entry or pruning frozen exports. Require an explicit sanitized module-loaded IPC marker after the import resolves and exit 0 for the load-only smoke invocation before supplying database configuration or inducing failure. Missing entry/import failure is loadability failure, never transaction/process-survival evidence. New B5 application code follows Task 2's no-parameter-properties rule; existing B1/B3/B4 classes remain byte-unchanged.

Record transformation-warning behavior in the load-only, no-database smoke invocation: presence/absence and sanitized warning category, not raw stderr, stack paths or exact warning counts as the success oracle. Do not add `--no-warnings`, a global exception handler, or a test-only Pool error listener to obtain a pass. In the database-failure children, continue to discard raw stdout/stderr and use only the existing sanitized IPC/result oracle; Node startup warnings do not substitute for module-loaded, intended-phase, replacement-backend and exit-status evidence. Preserve the active/idle variants and unchanged 2000/5000/7000ms production budgets. If Node 24.21.0, the option, warning handling or the real graph is unavailable/unsuitable, **STOP AND REVIEW**; no frozen-source rewrite, alternate loader/dependency, version change or reduced AC16 evidence is implicitly authorized.

Run both active-statement and idle-after-command/before-COMMIT variants in the B5-owned child harness. Its oracle permits only sanitized result/diagnostic messages. Late errors may reach the existing production pool listener as `postgres.pool.idle_error <sanitized code|UNKNOWN>`; accept that fixed shape only, with no raw error/message/SQL/credentials. Do not require an exact late-event count/order. Do not add a test-only Pool error listener or global exception handler. A child that never loaded B5, never reached the intended transaction phase, or died before replacement-backend success fails the test.

## Timeout evidence

Induce without global config changes, production timeout overrides, framework-timeout increases or retries-until-green:
- lock_timeout;
- statement_timeout/cancel;
- deadlock;
- transaction_timeout during active statement;
- transaction_timeout while idle after B5 command return but before COMMIT;
- 23514;
- 22003 where practical.

For non-session-terminating failures:
- sanitized 503 category;
- rollback;
- no partial mutation;
- no raw SQLSTATE/constraint/SQL leak.

For transaction_timeout:
- observe PostgreSQL session termination / 25P04 class where surfaced;
- request/persistence result sanitized DEPENDENCY_UNAVAILABLE;
- no committed B5 mutation in the induced pre-commit case;
- checked-out client destroyed, never returned to pool;
- next pool operation obtains a healthy connection;
- prove process survival with the actual B5-owned `tests/postgres/helpers/b5-timeout-worker.ts` child-process/backend-termination harness above; preserve the existing R27-H02 worker/test bytes;
- the child must exit 0 after observing only sanitized diagnostics and a successful replacement-backend transaction.

Unknown COMMIT tests:
- before-delivery and after-delivery transport loss;
- always return 503;
- never automatically reissue B5 command;
- fresh state read decides whether mutation committed.

## Architecture tests

Assert:
- B5 server graph excludes raw pg driver, demo/fixture/testing auth imports;
- persistence uses only the B5 command function for mutation, no raw membership DML;
- one existing pool only;
- route runtime = nodejs and dynamic = force-dynamic;
- no B5 roster/list/profile/create/reactivate/role-mutation route/page/component;
- package export is only `./b5`;
- no dependency/lockfile/workflow/provider change;
- migrations 0001-0009 unchanged.

## Frozen regression

Run targeted B1/B2/B3/B4 suites plus all B5 suites before the full repository gate.

No existing frozen assertion may be deleted or weakened merely to make B5 pass.

---

# Task 6 — Release-candidate integration, evidence package and stop gate

This task is verification/publication preparation, not authorization to merge implementation.

## Full local/hosted verification target

Run the existing repository commands that feed the nine hosted checks, then push one fixed implementation candidate and require:

- verify;
- repository-safety;
- apps;
- mobile-cold-linux;
- install-mobile-windows;
- web-e2e;
- mobile-health;
- postgres-integration;
- foundation-gate.

Required: **9/9 SUCCESS**.

Keep candidate CI, implementation-main CI and later closure-main CI as distinct evidence generations.

## Fixed-head evidence package

At the fixed implementation candidate HEAD record:
- base/POLICY_REF;
- exact HEAD;
- changed paths;
- migrations 0001-0009 byte-freeze evidence;
- new migration filename;
- B5 role/policy/function catalog;
- B5 test counts;
- authenticated Web/API/PostgreSQL B5 evidence from Task 3 `apps/web/tests/b1-e2e/b5.spec.ts`, the full-run result checker and PostgreSQL readback;
- AC01-AC19 disposition;
- retained B5D2-L02;
- F15/F25/F39 = NOT_RUN;
- no real data/provider/hosting;
- CI run IDs.

## Independent review gate

Before Ready/merge, obtain one independent whole-implementation review of the fixed HEAD focused on:
- last-admin concurrency;
- timeout/client-destruction semantics;
- RLS/least privilege;
- caller/target race precedence;
- B4 PUT × B5 interaction;
- Web non-disclosure;
- frozen B1-B4 regression;
- scope drift.

BLOCKER/HIGH => must fix before acceptance.
MEDIUM => fix unless explicitly accepted by operator with concrete reason.
LOW => fix if cheap; otherwise record as bounded release backlog.

After corrections, rerun fresh exact-head CI.

## STOP

At the end of this plan:
- implementation candidate may be review-ready;
- **do not mark Ready or merge implementation without explicit operator approval**;
- do not begin PF02-C or another slice;
- do not use real tenant data or production hosting.

---

# 4. AC01–AC19 evidence map

| AC | Primary evidence |
| --- | --- |
| AC01 | Task 3 route inventory + Task 5 architecture no-roster/no-create/no-role-mutation checks |
| AC02 | Task 4 basic authority tests: current same-org ORG_ADMIN success; PROPERTY_STAFF forbidden |
| AC03 | Task 4 hidden/foreign/missing/ENDED target uniform 404 + zero mutation |
| AC04 | Task 4 staff ACTIVE→ENDED history/version/ended_at invariants |
| AC05 | Task 4 admin termination with another effective admin |
| AC06 | Task 4 sole-effective-admin + SUSPENDED/DELETION_PENDING co-admin denial |
| AC07 | Task 4 distinct-backend concurrency matrix + pg_blocking_pids/activity evidence |
| AC08 | Task 4 caller visibility/admin revocation race precedence |
| AC09 | Task 4 target-ended-before-lock race |
| AC10 | Task 4 PropertyAssignment preservation + B4 PUT × B5 both commit orders |
| AC11 | Task 4 multi-org isolation |
| AC12 | Task 4 unrelated organization/session access preserved |
| AC13 | Task 3 colocated HTTP tests plus actual b5.spec.ts transportAndNonDisclosure and zero-mutation readback |
| AC14 | Task 1 catalog/helper least privilege and effective-admin helper positives/negatives |
| AC15 | Task 1 Step 4 verbatim owner-role behavior matrix under real SET ROLE and final RLS, with positive controls and unchanged-row evidence |
| AC16 | Task 2 b5-transaction.test.ts repeated-error/isolation/order RED→GREEN plus Task 5 real-entry load smoke under the B5-only transform-types launch contract, then b5-timeout-worker.ts active/idle termination, sanitized failure, client discard and replacement-backend/process-survival evidence |
| AC17 | Task 1 + Task 5 bounded frozen inventory updates only |
| AC18 | Task 1 common-bootstrap/migration regression + Task 3 unchanged Web startup path + Task 5 targeted B1-B4 regression + Task 6 full nine-check gate |
| AC19 | Task 6 fixed-head evidence/publication boundary; no implementation merge before operator approval |

No AC row above is a canonical F-case promotion. F15/F25/F39 remain NOT_RUN.

---

# 5. Codex execution package

After this plan is independently accepted and the operator separately authorizes product implementation, give Codex the following execution rule:

> Implement this plan end-to-end from the exact approved implementation base. Preserve B1-B4 frozen boundaries and the approved B5 design. Work task-by-task with RED→GREEN tests and small commits. Do not pause for LOW-only issues; record them and continue unless they imply security, data isolation, corruption, crash, or scope drift. Stop immediately on any need to widen frozen B1-B4 helpers, raw Web membership DML, provider/IAM, real data, production hosting, role mutation, roster/onboarding, PF02-C, dependency/lockfile/workflow changes, or a conflict with the approved B5 design. Produce one fixed release-candidate HEAD with all nine hosted checks green and no unresolved BLOCKER/HIGH before handoff for full-product audit.

---

# 6. Plan self-check / approval gate

Before this plan may be approved, verify:
- exact base is current live main and contains no unreviewed B5 product code;
- every approved design constraint in §26 maps to a concrete task/test above;
- AC01-AC19 all have an evidence location;
- no task authorizes role mutation, roster/onboarding, PF02-C, F43, provider/IAM, real data or hosting;
- B5-specific transaction wrapper avoids silently modifying frozen shared transaction behavior;
- 25P04/process-survival is an explicit acceptance test, not an assumption;
- B4 PUT × B5 both commit orders are mandatory;
- frozen B2/B3 inventories and the authenticated Web required-case inventory are adjusted only additively;
- all B5P-M01–M05 and B5P-L01–L05 corrections are checked against the fixed delta, including both listener events, worker loading, test-controlled waits, exact outcomes, verbatim AC15 and READ COMMITTED;
- B5PD-M01 is covered by the declared roles.ts import/await-only connection, common-bootstrap behavioral RED→GREEN, preserved return contract and fail-closed negative controls, and unchanged Web global setup reaching the B5 cases; no source work is authorized by this plan-text correction;
- B5PDR-M01 has an explicit B5-only fork option/version/warning contract, real B5-entry smoke evidence before timeout evidence, new-B5 erasable syntax, and a frozen-source exclusion that overrides RED justification; unsuitable runtime/option/graph means STOP AND REVIEW;
- the new B5 worker, transaction test, HTTP test and authenticated Web spec/fixture are explicitly declared while existing R27-H02 evidence stays byte-frozen;
- implementation remains NOT_AUTHORIZED until separate operator approval after independent plan review.

Next gate:

`FRESH_B5_IMPLEMENTATION_PLAN_DELTA_REVIEW` of B5PDR-M01 and directly dependent changes in the corrected fixed HEAD and plan blob against reviewed base `735cd51ad6300d763fd6d27a218ad1ef21a71767`. The supplied cumulative review of `3e6629989a5cacf47050f7f5cf6f52e11419d94c` through that base remains the provenance for the resolved earlier findings; do not repeat the whole design audit or claim new runtime evidence.

Only after acceptable delta review does the gate become `B5_IMPLEMENTATION_PLAN_APPROVAL_DECISION`. Keep PR #67 Draft; no plan Ready/merge or product implementation is authorized by this correction.
# PF02-B / B5 Organization Membership Termination & Last-Admin Safety — Implementation Plan

Date: **2026-10-01**

Status: **IMPLEMENTATION_PLAN_DRAFT / PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED**

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
- `tests/postgres/helpers/b5-fixture.ts`
- `tests/architecture/b5-boundary.test.ts`

Use the existing Web test location/pattern discovered at implementation time for B5 HTTP transport tests; do not invent a second test convention if the current main uses colocated Web server tests.

Bounded existing-test updates only:
- `tests/postgres/b2-capabilities.test.ts`
- `tests/postgres/b3-capabilities.test.ts`
- `tests/architecture/b1-boundary.test.ts`

Any additional existing file may be changed only if a RED test proves it is a necessary B5 integration point and the executor records that justification before editing.

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

## Step 2 — Implement test-only role provisioning

Follow `src/testing/b4-roles.ts` style. Do not create a production login or credential.

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
- Web gets command EXECUTE only;
- command owner gets helper EXECUTE only;
- no direct Web membership DML;
- no B5 owner role/user/org mutation surface;
- probe owner cannot mutate tables or read ungranted columns such as `app_user.session_epoch`;
- helper positive case with two distinct ACTIVE admin Users returns true;
- SUSPENDED/DELETION_PENDING second User, ENDED/staff membership, foreign/missing context return false/no visibility.

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

## Step 3 — RED: transaction order and connection-loss safety

Write tests around a B5-specific transaction wrapper proving exact order:

`BEGIN`
→ lock_timeout
→ statement_timeout
→ transaction_timeout
→ current_actor
→ authorize_org
→ set_config org/session
→ command
→ `COMMIT`

Do not use `withB1OrgTransaction` unchanged.

## Step 4 — Implement isolated B5 transaction wrapper

Preferred implementation: `src/b5/transaction.ts` owns the checked-out `PoolClient` using existing internal `getInternalPool(database)` and mirrors the frozen `withTransaction` success/rollback/unknown-COMMIT semantics without changing the frozen shared helper.

It must:
- attach a temporary checked-out-client `error` listener before BEGIN so server-side `transaction_timeout` termination cannot become an unhandled process error;
- arm all three SET LOCAL values as the first statements after BEGIN;
- then run current_actor / authorize_org / org+session set_config;
- treat 25P04/session termination as connection loss and force `release(true)`;
- destroy on failed BEGIN/COMMIT/ROLLBACK or captured client termination;
- remove the temporary listener safely during cleanup;
- never auto-retry;
- never log credentials/raw SQL/error payloads.

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
- B5 HTTP tests at the repository's current Web-test convention

Modify:
- `apps/web/src/server/b1/container.ts`
- `tests/architecture/b1-boundary.test.ts`

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
2. lock current ACTIVE Organization `FOR NO KEY UPDATE`;
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

### AC07 concurrency
Use distinct DB handles/backend PIDs and `pg_blocking_pids` or `pg_stat_activity`, no sleeps-as-proof:
- self/self with two admins => one success then one conflict/denial consistent with current state, never zero effective admins;
- cross A ends B while B ends A;
- same target;
- three-admin case.

Prove Organization lock is the first common serialization point.

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
- `tests/architecture/b5-boundary.test.ts`

Modify only bounded frozen inventories already declared.

## Timeout evidence

Induce without global config changes:
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
- Web/process survives with no unhandled client error event.

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
- authenticated Web/API/PostgreSQL B5 evidence;
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

# 4. Codex execution package

After this plan is independently accepted and the operator separately authorizes product implementation, give Codex the following execution rule:

> Implement this plan end-to-end from the exact approved implementation base. Preserve B1-B4 frozen boundaries and the approved B5 design. Work task-by-task with RED→GREEN tests and small commits. Do not pause for LOW-only issues; record them and continue unless they imply security, data isolation, corruption, crash, or scope drift. Stop immediately on any need to widen frozen B1-B4 helpers, raw Web membership DML, provider/IAM, real data, production hosting, role mutation, roster/onboarding, PF02-C, dependency/lockfile/workflow changes, or a conflict with the approved B5 design. Produce one fixed release-candidate HEAD with all nine hosted checks green and no unresolved BLOCKER/HIGH before handoff for full-product audit.

---

# 5. Plan self-check / approval gate

Before this plan may be approved, verify:
- exact base is current live main and contains no unreviewed B5 product code;
- every approved design constraint in §26 maps to a concrete task/test above;
- AC01-AC19 all have an evidence location;
- no task authorizes role mutation, roster/onboarding, PF02-C, F43, provider/IAM, real data or hosting;
- B5-specific transaction wrapper avoids silently modifying frozen shared transaction behavior;
- 25P04/process-survival is an explicit acceptance test, not an assumption;
- B4 PUT × B5 both commit orders are mandatory;
- frozen B2/B3 inventories are adjusted only additively;
- implementation remains NOT_AUTHORIZED until separate operator approval after independent plan review.

Next gate:

`B5_IMPLEMENTATION_PLAN_APPROVAL_DECISION`

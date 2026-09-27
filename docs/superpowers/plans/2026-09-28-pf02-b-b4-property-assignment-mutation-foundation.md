# PF02-B / B4 Property Assignment Mutation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, non-human-facing B4 API/DB foundation that lets a current ORG_ADMIN inspect, ensure, and end one exact Property ↔ existing ACTIVE PROPERTY_STAFF assignment without widening frozen B1/B2/B3 raw data authority.

**Architecture:** Expose one exact composite relationship resource with GET/PUT/DELETE. Route/application code calls a narrow PostgreSQL port; `bm_b1_web` gets B4 function EXECUTE only, while a new NOLOGIN `bm_b4_assignment_owner` owns SECURITY DEFINER routines and the minimum row privileges. Existing B2 `can_read_property`, B3 `can_administer_org`, PropertyAssignment history constraints, and the ACTIVE partial unique index remain authoritative.

**Tech Stack:** Node.js 24, TypeScript 6, Next.js 16 App Router, Zod, node-postgres, PostgreSQL 18.6, node-pg-migrate SQL migrations, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-28-pf02-b-b4-property-assignment-mutation-foundation-design.md` at approved spec HEAD `087b80bda320593688660347a9099b8ef52f9159`.

## Global Constraints

- POLICY_REF for execution starts from live `main`; the approved spec is the B4 behavior authority. Do not silently retarget either ref.
- B1/B2/B3 remain FROZEN except for the exact additive B4 integration points named in this plan.
- Migrations `0001`–`0008` stay byte-identical. Add only `0009_b4_property_assignment_mutation.sql`.
- Frozen migration SHA-256 preconditions:
  - `0001_core_identity_organization.sql` = `e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1`
  - `0002_property_unit_occupancy.sql` = `1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a`
  - `0003_runtime_isolation.sql` = `649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6`
  - `0004_b1_identity_sessions.sql` = `2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a`
  - `0005_b1_auth_capabilities.sql` = `22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33`
  - `0006_b1_organization_access.sql` = `a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe`
  - `0007_b2_property_assignment_scope.sql` = `4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2`
  - `0008_b3_building_registration.sql` = `c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986`.
- No new business table/column/index, ORM, dependency, second DB pool, LOGIN role, credential, provider/IAM change, production hosting, or real tenant/landlord/address data. The only package-manifest change allowed is adding the `./b4` source subpath export to `packages/persistence-postgres/package.json`; no dependency/version/lockfile change.
- `bm_b1_web` gets no direct `app.property_assignment` SELECT/INSERT/UPDATE/DELETE and cannot SET ROLE to `bm_b4_assignment_owner`.
- `bm_b1_capability_owner` gets no B4 row-mutation privilege.
- `bm_b4_assignment_owner` is NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS/NOINHERIT. Only the migration role may hold non-inherited SET-only, non-admin membership for object creation/ownership.
- B4 SECURITY DEFINER routines use exact `search_path = pg_catalog, pg_temp`, schema-qualified app/authn objects, no dynamic SQL, PUBLIC EXECUTE revoked.
- Public resource is exactly `/api/v2/organizations/:orgId/properties/:propertyId/staff-assignments/:membershipId`; no collection/list/search endpoint and no B4 UI.
- GET/PUT/DELETE only. PUT/DELETE carry no business body. No assignmentId/userId/role/status/timestamp is accepted from clients.
- Positive public state body is exactly `{ assigned: true }`. PUT returns 201 when a new ACTIVE row is created and 200 when already ACTIVE; DELETE returns 204 for ended or eligible no-op.
- ENDED rows are never physically deleted or reactivated. Reassignment creates a new row. Frozen partial unique ACTIVE index remains the one-current-relation arbiter.
- Origin/session/CSRF/private-cache/error precedence follows the approved B4 spec and existing B3 mutation conventions.
- B4 does not implement roster/onboarding/invitation/membership mutation/last-admin/PF02-C/F43/Mobile auth/Kakao/billing/security-completion.
- B4 does not automatically promote F15/F25/F39/F43 or any other canonical F-case.
- B4D-L01/L02/L03 remain disclosed design boundaries; do not claim universal lifecycle serialization, human-facing target discovery, or CommandReceipt exactly-once semantics.
- Required hosted checks remain: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate.

## Execution Authorization Gate

This document being reviewable or operator-approved does **not** authorize Task 1 execution.

Before any product implementation:
1. the operator must approve the exact fixed plan HEAD;
2. a separate fixed-head independent plan review must return no unresolved BLOCKER/HIGH finding, and any accepted MEDIUM/LOW must be explicitly reconciled or retained;
3. the approved spec/plan documentation must receive a separate publication decision, merge with expected-head protection, and complete fresh actual-main required CI before it is treated as canonical implementation authority;
4. only after that publication evidence may the operator separately choose/authorize the execution method and B4 product implementation boundary.

PR #50/#51 merge is necessary for canonical publication after review but never substitutes for the separate product implementation authorization.

## Spec Acceptance Ownership

| Spec AC | Owning plan task(s) / evidence |
| --- | --- |
| AC01 | Task 1 contract; Task 5 HTTP/method/body tests; Task 6 actual route E2E |
| AC02 | Task 3 adapter precedence; Task 5 HTTP auth precedence; Task 6 E2E |
| AC03 | Task 2 membership RLS/ACL; Task 3 adapter; Task 6 targetMembershipBoundary |
| AC04 | Task 3 adapter; Task 6 propertyBoundary |
| AC05 | Task 3 state/history; Task 5 HTTP 201 body/Location; Task 6 lifecycle |
| AC06 | Task 3 idempotency; Task 4 PUT/PUT; Task 6 lifecycle |
| AC07 | Task 3 history; Task 6 lifecycle |
| AC08 | Task 2 UPDATE boundary; Task 3 history; Task 4 DELETE/DELETE; Task 6 lifecycle |
| AC09 | Task 3 adapter; Task 5 GET; Task 6 lifecycle |
| AC10 | Task 4 real dual-connection PUT/PUT |
| AC11 | Task 4 DELETE/DELETE + PUT/DELETE |
| AC12 | Task 2 decisive SQL predicates; Task 4 revocation barriers |
| AC13 | Task 4 B2 read revocation; Task 6 staffReadThroughScope |
| AC14 | Task 6 staffReadThroughScope |
| AC15 | Task 2 ACL/catalog; Task 5 architecture/container |
| AC16 | Task 2 role provisioning/catalog |
| AC17 | Task 2 function owner/config/ACL |
| AC18 | Task 2 RLS/catalog regression |
| AC19 | Task 2 frozen hashes + fresh/upgrade atomicity; Task 7 frozen-path verification |
| AC20 | Task 5 HTTP transport/error tests; Task 6 transportAndMethodBoundaries |
| AC21 | Task 5 architecture boundaries; Task 6 E2E gate; Task 7 full regression |
| AC22 | Task 4 unknown-COMMIT/reconciliation; Task 5 sanitized 503 |
| AC23 | Task 5 architecture test; Task 7 diff/security verification |
| AC24 | Task 7 repository safety/public-history gates |

The ownership table is traceability only. It does not mark any B4 runtime AC PASS before implementation evidence exists.

## Review Focus

1. **Forged or stale target membership:** a valid UUID pointing to foreign, ENDED, or ORG_ADMIN membership must return 404 and never mutate. Task 2/3 tests pin this.
2. **Visibility vs admin precedence:** assigned PROPERTY_STAFF sees its Property but gets 403; unassigned staff gets 404 before admin classification. Task 3/5 tests pin this.
3. **Concurrent PUT after unique-index contention:** the second request must converge to EXISTS/200, not 503 or a duplicate history row. Task 4 tests pin this.
4. **Mutation body edge cases:** missing body is valid for PUT/DELETE, any actual business bytes are 400, advertised oversized body is 413, and no unbounded stream read occurs. Task 5 tests pin this.
5. **Unknown COMMIT outcome:** the adapter never auto-retries or reports rollback without proof; it returns 503 and a later exact GET can reconcile. Task 4 tests pin this.

---

### Task 1: Define B4 contracts, errors, validation, and application use cases

**Files:**
- Create: `packages/api-contracts/src/b4.ts`
- Create: `packages/api-contracts/src/b4.test.ts`
- Modify: `packages/api-contracts/src/index.ts`
- Create: `packages/application/src/b4/errors.ts`
- Create: `packages/application/src/b4/validation.ts`
- Create: `packages/application/src/b4/ports.ts`
- Create: `packages/application/src/b4/property-assignment.ts`
- Create: `packages/application/src/b4/property-assignment.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Produces `B4AssignmentStateSchema = z.strictObject({ assigned: z.literal(true) })`.
- Produces `B4ErrorSchema` with exact codes: `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | INVALID_INPUT | PAYLOAD_TOO_LARGE | DEPENDENCY_UNAVAILABLE | METHOD_NOT_ALLOWED`.
- Produces `B4ErrorCode`, `B4Error`.
- Produces `PropertyAssignmentState = Readonly<{ assigned: true }>`.
- Produces `EnsurePropertyAssignmentResult = Readonly<{ assigned: true; created: boolean }>`.
- Produces `PropertyAssignmentMutationPort`:
  - `getCurrent(digest, orgId, propertyId, membershipId): Promise<PropertyAssignmentState>`
  - `ensureCurrent(...): Promise<EnsurePropertyAssignmentResult>`
  - `endCurrent(...): Promise<void>`
- Produces `B4Dependencies = { sessions: Omit<IdentitySessionPort,"begin">; assignments: PropertyAssignmentMutationPort }`.
- Produces use cases:
  - `getPropertyStaffAssignment(dependencies,digest,orgId,propertyId,membershipId)`
  - `ensurePropertyStaffAssignment(...)`
  - `endPropertyStaffAssignment(...)`
- `b4/validation.ts` validates exact lower-case UUID wire format and 64-char lower-case digest; do not import private B3 validation internals.

- [ ] **Step 1: Write contract RED tests**

Add strict-schema tests asserting:
- `{assigned:true}` parses;
- false/extra keys/assignmentId/role/userId/status/timestamps fail;
- B4 error schema contains exactly the seven codes above.

Run:

```bash
npm run test:shared -- packages/api-contracts/src/b4.test.ts
```

Expected: FAIL because `b4.ts`/exports do not exist.

- [ ] **Step 2: Implement API contract exports**

Create `b4.ts`; export it from `packages/api-contracts/src/index.ts`.

Re-run the same command. Expected: PASS.

- [ ] **Step 3: Write application RED tests**

In `property-assignment.test.ts`, use fake sessions/port and assert:
- malformed/invalid internal session digest → `B4Error("UNAUTHENTICATED")`; malformed org/property/membership UUID → `B4Error("INVALID_INPUT")`;
- missing current actor → `UNAUTHENTICATED`;
- valid input delegates exact digest/org/property/membership without client authority fields;
- ensure preserves `created`; get returns `{assigned:true}`; end returns void;
- port error propagates as B4 error, no retry loop.

Run:

```bash
npm run test:shared -- packages/application/src/b4/property-assignment.test.ts
```

Expected: FAIL because B4 application module does not exist.

- [ ] **Step 4: Implement B4 application module**

Implement the interfaces/signatures above and export them from `packages/application/src/index.ts`. Keep use cases thin: current actor + input validation, then port call.

Run:

```bash
npm run test:shared -- packages/api-contracts/src/b4.test.ts packages/application/src/b4/property-assignment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/api-contracts/src/b4.ts packages/api-contracts/src/b4.test.ts packages/api-contracts/src/index.ts   packages/application/src/b4 packages/application/src/index.ts
git commit -m "feat: define B4 assignment contracts"
```

### Task 2: Add test-only B4 role provisioning and migration 0009 least-privilege command boundary

**Files:**
- Create: `packages/persistence-postgres/src/testing/b4-roles.ts`
- Modify: `packages/persistence-postgres/src/testing/roles.ts`
- Modify: `packages/persistence-postgres/src/testing/index.ts`
- Create: `packages/persistence-postgres/migrations/0009_b4_property_assignment_mutation.sql`
- Create: `tests/postgres/b4-schema.test.ts`
- Create: `tests/postgres/b4-capabilities.test.ts`
- Modify: `tests/postgres/b1-capabilities.test.ts` — keep the frozen B1 authn-function owner assertion scoped to non-B4 functions; B4 function owner/ACL is asserted exactly in `b4-capabilities.test.ts`
- Modify: `tests/postgres/b2-capabilities.test.ts` — keep frozen B1/B2 membership/policy inventory scoped away from exact `bm_b4_assignment_owner` / `b4_*` additions; for frozen `can_read_property`, allow exactly one new non-grantable EXECUTE grantee `bm_b4_assignment_owner`
- Modify: `tests/postgres/b3-capabilities.test.ts` — preserve frozen `can_administer_org` owner/body/config/policies while allowing exactly one new non-grantable EXECUTE grantee `bm_b4_assignment_owner`

**Interfaces:**
- `B4_ASSIGNMENT_OWNER = "bm_b4_assignment_owner"`.
- `provisionB4TestRole(admin, migrationRole): Promise<void>` creates the exact NOLOGIN role and grants only `GRANT bm_b4_assignment_owner TO bm_pf02a_migrator WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`.
- Production migration **preflights** this role; it never CREATE ROLEs it.
- Frozen helper grants to B4 owner are limited to exact EXECUTE needed for `app.current_org_id()`, `authn.can_administer_org(bytea,uuid)`, and `authn.can_read_property(bytea,uuid,uuid)`.
- Grant path is explicit: the migration owner grants `app.current_org_id()` plus schema USAGE it owns; then `SET LOCAL ROLE bm_b1_capability_owner` only to grant EXECUTE on the two frozen authn helpers to `bm_b4_assignment_owner`, then `RESET ROLE`. Frozen helper ownership/body stays unchanged.
- Exact B4-owner PropertyAssignment raw ACL ceiling: SELECT(`org_id,membership_id,property_id,status`), INSERT(`org_id,membership_id,property_id,status`), UPDATE(`status,ended_at`), DELETE none. Omit `id` on INSERT so the frozen `uuidv7()` default generates row identity; production B4 routines never read assignment `id` or `ended_at`.
- B4 function signatures are fixed:
  - `authn.b4_get_property_staff_assignment(bytea,uuid,uuid,uuid) RETURNS text`
  - `authn.b4_ensure_property_staff_assignment(bytea,uuid,uuid,uuid) RETURNS text`
  - `authn.b4_end_property_staff_assignment(bytea,uuid,uuid,uuid) RETURNS text`
- Internal result vocabularies:
  - get: `ACTIVE | ABSENT | NOT_FOUND | FORBIDDEN`
  - ensure: `CREATED | EXISTS | NOT_FOUND | FORBIDDEN`
  - end: `ENDED | ABSENT | NOT_FOUND | FORBIDDEN`
- Function execution contract: all three are `LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, pg_temp`; GET is `STABLE`; ENSURE and END are `VOLATILE` because they mutate state. PUBLIC EXECUTE is false and Web EXECUTE true. `b4-capabilities.test.ts` asserts owner, language, volatility, SECURITY DEFINER flag, exact proconfig and ACL.

- [ ] **Step 1: Write role/migration RED tests**

In `b4-schema.test.ts` and `b4-capabilities.test.ts`, assert before implementation:
- synthetic all-role provisioning includes B4 owner but returns no B4 credential;
- role attributes exactly match spec;
- only migrator has SET-only non-inherited membership;
- missing/incorrect B4 owner makes 0009 fail closed on a fresh chain; the single migration invocation leaves no partial B4 objects;
- upgrade failure is separate evidence: start from a successfully committed 0001–0008 database, make the B4 role contract missing/invalid, run the next migration, assert 0009 rolls back while all pre-existing B1/B2/B3 schema/functions/history remain intact;
- migrations 0001–0008 SHA-256 remain unchanged;
- expected three functions/policies/grants do not yet exist.

Run:

```bash
npm run test:postgres -- tests/postgres/b4-schema.test.ts tests/postgres/b4-capabilities.test.ts
```

Expected: FAIL on missing role helper/migration/functions.

- [ ] **Step 2: Add disposable B4 role provisioning**

Create `b4-roles.ts`; call it from `provisionTestRoles` after B1 roles and before migrations. Do not alter `B1_ROLES` or return a password/config for B4. Export only test helpers/constants from testing index.

Re-run the B4 postgres tests. Expected: still FAIL on migration/functions, role-provisioning assertions PASS.

- [ ] **Step 3: Implement migration preflight, ACL, and RLS**

Create `0009_b4_property_assignment_mutation.sql`.

Migration must:
- verify role attributes and exact allowed membership;
- fail if Web/login/runtime/capability roles are members;
- grant `USAGE ON SCHEMA app, authn` to B4 owner;
- grant `EXECUTE ON FUNCTION app.current_org_id()` to B4 owner under migration-owner authority;
- `SET LOCAL ROLE bm_b1_capability_owner`, grant only `EXECUTE` on `authn.can_administer_org(bytea,uuid)` and `authn.can_read_property(bytea,uuid,uuid)` to B4 owner, then `RESET ROLE`; do not alter either frozen helper body/owner;
- grant exact target-membership ACL: SELECT(`id,org_id,role,status`) ON `app.organization_membership`; grant no B4-owner SELECT on `user_id` or identity/profile data;
- grant exact PropertyAssignment column ACL only: SELECT(`org_id,membership_id,property_id,status`), INSERT(`org_id,membership_id,property_id,status`), UPDATE(`status,ended_at`); grant no SELECT(`id,ended_at`), INSERT(`id`) or DELETE;
- add `b4_member_target_ceiling` as RESTRICTIVE SELECT TO B4 owner with current-org + ACTIVE + PROPERTY_STAFF; rely on the existing PUBLIC permissive `organization_membership_org_scope` as the required permissive policy;
- add `b4_assignment_select_scope` as PERMISSIVE SELECT TO B4 owner with current-org USING;
- add `b4_assignment_insert_scope` as PERMISSIVE INSERT TO B4 owner with current-org WITH CHECK;
- add `b4_assignment_update_scope` as PERMISSIVE UPDATE TO B4 owner with current-org USING/WITH CHECK;
- add `b4_assignment_select_ceiling` as RESTRICTIVE SELECT TO B4 owner with `status='ACTIVE'`;
- add `b4_assignment_insert_ceiling` as RESTRICTIVE INSERT TO B4 owner with `status='ACTIVE' AND ended_at IS NULL`;
- add `b4_assignment_update_ceiling` as RESTRICTIVE UPDATE TO B4 owner with old-row `status='ACTIVE'` and new-row `status='ENDED' AND ended_at IS NOT NULL`;
- add **no DELETE policy of any kind**, no DELETE grant, and no PUBLIC B4 policy;
- leave `bm_b1_web` with no raw assignment DML/read;
- temporarily grant CREATE on authn to B4 owner, `SET LOCAL ROLE bm_b4_assignment_owner`, create the three B4 functions, immediately REVOKE PUBLIC EXECUTE and GRANT exact B4-function EXECUTE to `bm_b1_web` while the function owner role is current, then `RESET ROLE` and revoke temporary CREATE;
- keep PF02-A/B1/B2/B3 role ACL/policy definitions unchanged outside the explicit helper EXECUTE grants to the new B4 owner.

- [ ] **Step 4: Implement exact SECURITY DEFINER semantics**

Within 0009:
- GET: property visibility first via `can_read_property`, then admin via `can_administer_org`, then eligible target membership, then current ACTIVE exact assignment.
- ENSURE: same precedence; decisive INSERT uses target membership eligibility and frozen helper predicates in the state-changing statement; use the existing partial unique ACTIVE index with matching `ON CONFLICT ... WHERE status='ACTIVE' DO NOTHING`; after a no-insert outcome, classify current state without performing another mutation.
- END: same precedence; decisive UPDATE includes frozen helper + eligible membership predicates and changes only ACTIVE→ENDED with `ended_at=clock_timestamp()`; if no row changed, classify eligible ABSENT vs changed authority without retrying.
- Never reactivate an ENDED row.

- [ ] **Step 5: Reconcile frozen B1/B2 catalog test scope without weakening it**

Update only the additive-slice boundaries:
- in `b1-capabilities.test.ts`, exclude only `authn.b4_*` functions from the historical B1 owner/config loop; do not change any B1 function expectation;
- in `b2-capabilities.test.ts`, exclude only the exact `bm_b4_assignment_owner` membership row from the historical B1/B2 membership equality and exclude only `b4_*` policies from the historical B1/B2 policy inventory;
- in the same B2 test, keep every frozen helper ACL exact and change only `can_read_property` executor expectation from `[bm_b1_capability_owner,bm_b1_web]` to `[bm_b1_capability_owner,bm_b1_web,bm_b4_assignment_owner]`, with the B4 grant non-grantable;
- in `b3-capabilities.test.ts`, add B4 owner to the explicit privilege matrix for `can_administer_org` with EXECUTE=true and to the exact ACL rows with grantor=`bm_b1_capability_owner`, is_grantable=false; keep owner, volatility, SECURITY DEFINER config and all B3 policies unchanged;
- add comments routing all B4 additions to `b4-capabilities.test.ts`; do not relax any privilege/role/policy assertion for existing B1/B2/B3 objects.

- [ ] **Step 6: Verify migration/catalog tests GREEN**

Run:

```bash
npm run test:postgres -- tests/postgres/b4-schema.test.ts tests/postgres/b4-capabilities.test.ts   tests/postgres/foundation.test.ts tests/postgres/b1-capabilities.test.ts   tests/postgres/b2-schema.test.ts tests/postgres/b2-capabilities.test.ts   tests/postgres/b3-schema.test.ts tests/postgres/b3-capabilities.test.ts
```

Expected: PASS, including exact role attributes/membership, helper grantors/ACL, exact target-membership and assignment column ACLs (including denied user_id/assignment id reads), permissive/restrictive RLS catalog, no raw Web assignment privilege, migrations 0001–0008 hash preservation, fresh-chain rollback, upgrade-failure preservation, and existing PF02-A/B1/B2/B3 schema/capability regressions.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/persistence-postgres/src/testing/b4-roles.ts   packages/persistence-postgres/src/testing/roles.ts packages/persistence-postgres/src/testing/index.ts   packages/persistence-postgres/migrations/0009_b4_property_assignment_mutation.sql   tests/postgres/b4-schema.test.ts tests/postgres/b4-capabilities.test.ts   tests/postgres/b1-capabilities.test.ts tests/postgres/b2-capabilities.test.ts   tests/postgres/b3-capabilities.test.ts
git commit -m "feat: add B4 assignment command boundary"
```

### Task 3: Implement the PostgreSQL B4 port and relationship-state behavior

**Files:**
- Create: `packages/persistence-postgres/src/b4/index.ts`
- Create: `packages/persistence-postgres/src/b4/property-assignment.ts`
- Modify: `packages/persistence-postgres/package.json` — add only `"./b4": "./src/b4/index.ts"` to exports
- Create: `tests/postgres/helpers/b4-fixture.ts`
- Create: `tests/postgres/b4-assignment.test.ts`

**Interfaces:**
- Produces `createPropertyAssignmentMutationPort(database: PostgresDatabase): PropertyAssignmentMutationPort`.
- Makes that factory importable only through `@build-manager/persistence-postgres/b4`; do not widen the root export just to avoid the explicit B4 subpath.
- Adapter always enters `withB1OrgTransaction(database,digest,orgId,...)`.
- Adapter executes only the three B4 functions; no raw PropertyAssignment SQL in the production adapter.
- Result mapping:
  - GET ACTIVE → `{assigned:true}`; ABSENT/NOT_FOUND → NOT_FOUND; FORBIDDEN → FORBIDDEN.
  - ENSURE CREATED → `{assigned:true,created:true}`; EXISTS → `{assigned:true,created:false}`; NOT_FOUND/FORBIDDEN map to B4 errors.
  - END ENDED/ABSENT → void; NOT_FOUND/FORBIDDEN map to B4 errors.
- B1 `UNAUTHENTICATED` and PostgreSQL `28000` map to B4 UNAUTHENTICATED; B1 `NOT_FOUND` from `withB1OrgTransaction` maps to B4 NOT_FOUND; fixed B4 function results map as above; all other unexpected database/transaction errors, including uncertain COMMIT cleanup aggregates, map to DEPENDENCY_UNAVAILABLE.

- [ ] **Step 1: Create B4 fixture and adapter RED tests**

`b4-fixture.ts` should extend the B2 harness with:
- the B4 port;
- same-org eligible target staff membership;
- same-org ORG_ADMIN target membership;
- foreign target membership/property;
- helpers to read PropertyAssignment history through migration owner with transaction-local org context.

Tests must pin Review Focus #1/#2:
- admin first PUT CREATED then repeated PUT EXISTS with one ACTIVE row;
- GET ACTIVE vs ABSENT;
- DELETE ENDED then repeated ABSENT/void; row retained and ended_at set;
- reassignment after end creates a different row and preserves old bytes;
- foreign/ended/admin target membership 404 with unchanged snapshot;
- assigned staff on visible Property → 403; unassigned staff on hidden Property → 404;
- foreign/inactive Property 404.

Run:

```bash
npm run test:postgres -- tests/postgres/b4-assignment.test.ts
```

Expected: FAIL because B4 adapter does not exist.

- [ ] **Step 2: Implement B4 persistence adapter**

Create `src/b4/property-assignment.ts` and `index.ts`. Use exact function calls and fixed status mapping. Do not introspect role/user data in TypeScript; database functions own decisive classification.

- [ ] **Step 3: Verify state/history tests GREEN**

Run:

```bash
npm run test:postgres -- tests/postgres/b4-assignment.test.ts tests/postgres/b4-capabilities.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

```bash
git add packages/persistence-postgres/src/b4 packages/persistence-postgres/package.json   tests/postgres/helpers/b4-fixture.ts tests/postgres/b4-assignment.test.ts
git commit -m "feat: add B4 assignment persistence"
```

### Task 4: Prove concurrency, revocation-at-decisive-statement, and unknown-COMMIT behavior

**Files:**
- Create: `tests/postgres/b4-concurrency.test.ts`
- Create: `tests/postgres/b4-revocation.test.ts`
- Modify: `tests/postgres/helpers/b4-fixture.ts`
- Modify only if needed for generic transaction failure observation: existing focused persistence transaction helper; do not change timeout/retry policy.

**Interfaces:**
- Reuse explicit two-connection/barrier style from B2/B3; no elapsed sleeps as correctness evidence.
- Production port contains no automatic mutation retry.

- [ ] **Step 1: Write PUT/PUT and DELETE/DELETE RED tests**

Use two distinct Web DB connections and deterministic gates:
- simultaneous PUT same relation → exactly one ACTIVE row; exactly one call returns CREATED and the other converges to EXISTS after unique-index contention, with no duplicate history row;
- simultaneous DELETE same current row → exactly one ENDED history transition; both calls succeed idempotently.

Run:

```bash
npm run test:postgres -- tests/postgres/b4-concurrency.test.ts
```

Expected: FAIL until gating/adapter behavior is correct.

- [ ] **Step 2: Add PUT/DELETE order tests**

Exercise both release orders with real connections. After both commits:
- no more than one ACTIVE row;
- all history rows satisfy CHECK;
- exact GET agrees with final committed relation;
- no retry-created extra history.

- [ ] **Step 3: Add decisive-statement revocation tests**

Gate the actual B4 ensure/end SQL call, then commit before release:
- caller admin→staff change;
- Property ACTIVE→ARCHIVED;
- target PROPERTY_STAFF ACTIVE→ENDED.

Expected: stale precheck never authorizes the state-changing statement; mutation snapshot unchanged; error classification follows spec. Also prove after assignment end the target staff's frozen B2 Property/Unit read disappears on the next request/adapter call.

Run:

```bash
npm run test:postgres -- tests/postgres/b4-concurrency.test.ts tests/postgres/b4-revocation.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add unknown-COMMIT RED/GREEN test**

Instrument the same connection/transaction boundary used by B4 so COMMIT delivery becomes uncertain after the mutation command. Assert:
- adapter returns DEPENDENCY_UNAVAILABLE;
- mutation is not automatically reissued;
- no claim of rollback;
- a fresh `getCurrent` can reconcile whichever committed state the database actually has.

Do not change global transaction retry semantics.

- [ ] **Step 5: Commit Task 4**

```bash
git add tests/postgres/b4-concurrency.test.ts tests/postgres/b4-revocation.test.ts tests/postgres/helpers/b4-fixture.ts
git commit -m "test: prove B4 assignment boundaries"
```

### Task 5: Add secure B4 HTTP handler, bounded empty-body validation, route, and container wiring

**Files:**
- Create: `apps/web/src/server/b4/errors.ts`
- Create: `apps/web/src/server/b4/request.ts`
- Create: `apps/web/src/server/b4/http.ts`
- Create: `apps/web/src/server/b4/http.test.ts`
- Create: `apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/staff-assignments/[membershipId]/route.ts`
- Modify: `apps/web/src/server/b1/container.ts`
- Create: `tests/architecture/b4-boundary.test.ts`
- Modify: `tests/architecture/b1-boundary.test.ts` — add the exact B4 route to the v2 route list and change the literal inventory expectation/title from eight to nine

**Interfaces:**
- `B4HTTPDependencies = B4Dependencies & { readSession(request): Promise<SessionData|null>; appBaseUrl:string }`.
- `handleB4Http(request, params, dependencies)` handles exact relationship only.
- `assertB4EmptyBody(request): Promise<void>`:
  - no body → success;
  - advertised Content-Length > 8192 → PAYLOAD_TOO_LARGE;
  - any actual body byte → INVALID_INPUT and cancel stream promptly;
  - malformed Content-Length → INVALID_INPUT.
- Existing constant-time CSRF semantics are copied into B4 server boundary or factored only if B3 behavior remains byte/behavior compatible; do not refactor B3 merely for style.
- Route sets `runtime="nodejs"`, `dynamic="force-dynamic"`; it explicitly exports GET/PUT/DELETE and also POST/PATCH/HEAD/OPTIONS dispatchers so every unsupported method reaches the B4 handler and receives deterministic custom 405 with exact `Allow: GET, PUT, DELETE`. Do not rely on Next.js automatic OPTIONS handling for this exact-method contract.
- Container adds one `assignments:createPropertyAssignmentMutationPort(database)` on the existing single B1 Web database handle; no B4 DATABASE_URL.
- Existing architecture route inventory must contain exactly nine v2 route files after B4; the ninth is `organizations/[orgId]/properties/[propertyId]/staff-assignments/[membershipId]`.

- [ ] **Step 1: Write HTTP RED tests**

Pin:
- GET malformed path/query → 400; anonymous →401;
- PUT/DELETE missing/wrong Origin →403 before session/body; valid Origin anonymous→401; valid session wrong/missing CSRF→403;
- valid auth/CSRF with non-empty body→400; Content-Length >8192→413; request reader stops/cancels;
- assigned staff visible Property→403; unassigned/foreign Property→404;
- target membership 404 non-disclosure;
- GET active 200 exact body; PUT created 201 + same-resource Location; PUT existing 200; DELETE 204 empty;
- unsupported POST/PATCH/HEAD/OPTIONS →405 and exact `Allow: GET, PUT, DELETE`;
- no error leaks SQL/target identity;
- injected `DEPENDENCY_UNAVAILABLE` from the B4 application/port maps to sanitized private 503 without automatic retry.

Run:

```bash
npm --workspace @build-manager/web run test -- src/server/b4/http.test.ts
```

Expected: FAIL because B4 server module does not exist.

- [ ] **Step 2: Implement B4 request/error/HTTP modules**

Use B4 application use cases and existing session reader. Preserve private/no-store headers and exact Origin/session/CSRF order from spec.

- [ ] **Step 3: Add route and container wiring**

Create exact route file. Modify container type to satisfy both existing B3 handlers and B4 handler while preserving one `createPostgresDatabase` call.

- [ ] **Step 4: Add architecture boundary tests**

`b4-boundary.test.ts` must assert:
- B4 server modules do not import `pg`, SQLite/demo persistence, fixtures, or Auth0 test utilities;
- route/component layers contain no raw `property_assignment` SQL;
- `b1-boundary.test.ts` discovers exactly nine actual v2 handlers and includes the B4 route in both literal-runtime and literal-dynamic negative controls;
- container creates one DB pool and no B4 database env;
- no B4 UI/page directory or roster route is introduced;
- application/api/persistence import directions remain valid.

Run:

```bash
npm --workspace @build-manager/web run test -- src/server/b4/http.test.ts
npm run test:shared -- tests/architecture/b4-boundary.test.ts tests/architecture/b1-boundary.test.ts   tests/architecture/b3-boundary.test.ts tests/architecture/import-boundaries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/web/src/server/b4   "apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/staff-assignments/[membershipId]/route.ts"   apps/web/src/server/b1/container.ts tests/architecture/b4-boundary.test.ts tests/architecture/b1-boundary.test.ts
git commit -m "feat: expose B4 assignment API"
```

### Task 6: Add actual Web + PostgreSQL B4 E2E without adding management UI

**Files:**
- Create: `apps/web/tests/b1-e2e/b4-fixture.ts`
- Create: `apps/web/tests/b1-e2e/b4.spec.ts`
- Modify: `apps/web/tests/b1-e2e/check-results.mjs` — extend the existing exact 51-case gate with the six B4 titles below, preserving all existing assertions/negative controls and adding one B4 removal negative control.

**Interfaces:**
- B4 E2E fixture creates:
  - one authenticated admin session;
  - one second synthetic staff identity/session joined to the admin's same organization as PROPERTY_STAFF;
  - known membershipId and two Properties;
  - no email/name projection and no real provider identity.
- Produce `createB4StaffSession(browser, adminFixture): Promise<B4StaffFixture>` inside `b4-fixture.ts`; it may use the existing test-only login role/session-cookie mechanism but must not modify production roster/profile APIs.
- Produce `assignmentPath(f, membershipId, propertyId?, orgId?)` for only the exact composite resource.
- Mutating helpers call PUT/DELETE with exact Origin + `x-b1-csrf` and no business body.
- `b4.spec.ts` contains exactly six Playwright tests with these exact titles:
  1. `B4 AC05-09 adminAssignmentLifecycle`
  2. `B4 AC03 targetMembershipBoundary`
  3. `B4 AC04 propertyBoundary`
  4. `B4 AC02 staffVisibilityPrecedence`
  5. `B4 AC13-14 staffReadThroughScope`
  6. `B4 AC20 transportAndMethodBoundaries`
- `check-results.mjs` appends those six titles to the existing 51-title required list (57 total required specs), keeps failed/skipped/retry/error rejection intact, and adds a negative control that removes `B4 AC05-09 adminAssignmentLifecycle` and must be rejected. The 57 count is a required-test inventory, not a coverage claim.

- [ ] **Step 1: Write E2E RED tests for API state transitions**

Required mapping:
- `B4 AC05-09 adminAssignmentLifecycle`: admin GET absent 404 → PUT 201/body → GET 200 → repeated PUT 200 → DELETE 204 → GET 404 → repeated DELETE 204;
  DB readback proves one ACTIVE max and ENDED history retained; reassignment creates a new row id and preserves previous history bytes.
- `B4 AC03 targetMembershipBoundary`: ORG_ADMIN/ENDED/foreign target membership 404 with no mutation.
- `B4 AC04 propertyBoundary`: foreign/archived Property 404 with no mutation.
- `B4 AC02 staffVisibilityPrecedence`: assigned staff caller exact resource 403 only when Property is visible; unassigned peer Property 404.

Run:

```bash
npm --workspace @build-manager/web run test:e2e:b1 -- b4.spec.ts
```

Expected: FAIL until route/container/fixtures are complete.

- [ ] **Step 2: Add B2 read-through E2E**

Implement `B4 AC13-14 staffReadThroughScope` with the same target staff session:
- before B4 PUT, property list/detail denied/absent;
- after admin PUT, exact Property and its Unit become visible through frozen B2/B3 reads;
- peer Property stays denied;
- after admin DELETE, next staff request loses Property/Unit visibility;
- after reassignment, exact scope returns without widening peers.

- [ ] **Step 3: Add transport/negative E2E**

Implement `B4 AC20 transportAndMethodBoundaries` and assert:
- anonymous, bad Origin, missing/bad CSRF, malformed ids/query/body, and unsupported POST/PATCH/HEAD/OPTIONS;
- response/error body never includes staff user id, raw membership attributes, assignment row id or SQL;
- no new UI link/page/roster appears.

- [ ] **Step 4: Run full authenticated Web/PostgreSQL suite and exact result gate**

```bash
npm run test:e2e:b1
node apps/web/tests/b1-e2e/check-results.mjs
```

Expected: exact required inventory = 57 specs (existing 51 + six B4), all PASS, failed=0, skipped=0, retries=0; gate negative controls including the B4-removal control all reject. This count is not a coverage percentage.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/web/tests/b1-e2e/b4-fixture.ts apps/web/tests/b1-e2e/b4.spec.ts apps/web/tests/b1-e2e/check-results.mjs
git commit -m "test: cover B4 web postgres assignment flow"
```

### Task 7: Run full regression, security/public-history gates, and publish only a reviewable implementation candidate

**Files:**
- Modify: `ops/AI_Execution_Log.csv` (append-only implementation checkpoint)
- Do **not** update STATUS/canonical acceptance state in the implementation branch; B4 remains unaccepted until independent review/operator decision/merge/closure.

**Interfaces:**
- Candidate report records exact BASE/HEAD, changed paths, migration hash preservation, test/CI evidence classes, retained B4D limitations, and no F-case promotion.
- No Google sync claim without actual write/readback.

- [ ] **Step 1: Verify exact diff and frozen paths**

Confirm:
- migrations 0001–0008 byte-identical to approved baseline;
- no Product/Occupancy/Ticket/Mobile/provider/hosting/credential files changed outside named B4 integration/test paths;
- no staff roster/UI route;
- no package/lock/workflow changes except the explicitly approved `packages/persistence-postgres/package.json` `./b4` export; no dependency/version/lockfile/workflow drift.

- [ ] **Step 2: Run focused suites**

```bash
npm run test:shared -- packages/api-contracts/src/b4.test.ts packages/application/src/b4/property-assignment.test.ts   tests/architecture/b4-boundary.test.ts tests/architecture/b1-boundary.test.ts   tests/architecture/b3-boundary.test.ts tests/architecture/import-boundaries.test.ts
npm run test:postgres -- tests/postgres/b4-schema.test.ts tests/postgres/b4-capabilities.test.ts   tests/postgres/b4-assignment.test.ts tests/postgres/b4-concurrency.test.ts tests/postgres/b4-revocation.test.ts
npm --workspace @build-manager/web run test -- src/server/b4/http.test.ts
npm run test:e2e:b1
node apps/web/tests/b1-e2e/check-results.mjs
```

Expected: PASS.

- [ ] **Step 3: Run repository-standard regression**

```bash
npm run test:shared
npm run test:postgres
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run test:e2e:web
npm run test:e2e:b1
node apps/web/tests/b1-e2e/check-results.mjs
```

Expected: all applicable commands PASS. Preserve any pre-existing Local Mobile OPEN risk classification; do not reinterpret hosted green as root-cause resolution.

- [ ] **Step 4: Run repository safety/public-history gates**

Run the repository's current scanner commands exactly as defined by the workflow/scripts at execution HEAD. Require:
- root scanner expected test count;
- scripts scanner expected test count;
- full reachable-history scan findings=[].

Do not invent static counts in the plan; record actual file/link/blob counts from execution.

- [ ] **Step 5: Append implementation candidate log and sync only if verified**

Append one unique event id to `ops/AI_Execution_Log.csv`. If the connected Google log is available and authorized, write/readback and mark the repository row synced; otherwise leave pending and update the existing pending queue without exposing destination ids.

- [ ] **Step 6: Commit final implementation-candidate metadata only**

```bash
git add ops/AI_Execution_Log.csv
git commit -m "docs: record B4 implementation candidate"
```

Do not add STATUS or an acceptance receipt unless a later separately authorized acceptance/closure task creates them.

- [ ] **Step 7: Push/open Draft implementation PR and STOP**

The implementation PR must remain Draft/NOT_MERGED and request a fixed-head independent full review. Report:
- BASE_SHA / HEAD_SHA;
- exact changed paths and commits;
- focused + full regression results;
- hosted CI run ids after they complete;
- B4D-L01/L02/L03 retained;
- B4 product runtime evidence class;
- F-case statuses unchanged unless separately authorized and directly evidenced.

**STOP:** no Ready conversion, merge, canonical B4 closure, PF02-C/F43 work, or later slice begins without separate operator authorization.

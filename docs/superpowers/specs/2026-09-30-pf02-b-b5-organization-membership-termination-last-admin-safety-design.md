# PF02-B / B5 — Organization Membership Termination & Last-Admin Safety Foundation

## 1. Status / authority

Date: **2026-09-30**. Revision: **0.3**.

**SCOPE_APPROVED; SECOND_INDEPENDENT_REVIEW_CHANGES_REQUIRED; WRITTEN_SPEC_SECOND_CORRECTION_CANDIDATE; DESIGN_NOT_APPROVED; IMPLEMENTATION_PLAN_NOT_AUTHORIZED; PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED.**

Repository: `edward321416-maker/build-manager`.

`POLICY_REF = TARGET_REF = main@cfb7a34828c63933c0e9f12b45fa578cfd127cca`.

This document records the operator-approved B5 scope and the second corrected architecture candidate after two fresh independent reviews. The first review of PR #63 at `ca53af17d084cbf159a8b707e403de6d057fd003` returned **CHANGES_REQUIRED** with one HIGH, three MEDIUM and five LOW findings. The delta review of corrected HEAD `b9c69dfeb27bdf100658dff23faf2a9b0943da0a` returned **CHANGES_REQUIRED** with one new HIGH and three LOW findings: eight of the nine prior findings were resolved, while the M02 mechanism remained partially resolved because the proposed capability-owner helper could not see other administrators through frozen RLS. Revision 0.3 dispositions that second-review delta without changing the operator-approved functional scope. It is still **not approved**.

This document does **not** authorize an implementation plan, product code, SQL migration, tests, dependency changes, provider/IAM changes, production hosting, real data, Ready conversion, or merge.

Canonical baseline at TARGET_REF:
- PF00 = FROZEN.
- PF02-A = VERIFIED / FROZEN.
- PF02-B = IN_PROGRESS.
- PF02-B/B1, B2, B3, B4 = VERIFIED / FROZEN.
- F01 = PASS_POSTGRES_INTEGRATION.
- F15 = NOT_RUN.
- F25 = NOT_RUN.
- F39 = NOT_RUN.
- F43 = NOT_RUN.
- B5 scope is operator-approved; the written architecture is still under review.
- REAL_TENANT_DATA = NOT_AUTHORIZED.
- PRODUCTION_DB_HOSTING = NOT_AUTHORIZED.

Authority sources: [AGENTS](../../../AGENTS.md), [AI delivery rules](../../../governance/ai_delivery_rules.md), [project policy](../../../governance/project_policy.md), [STATUS](../../../STATUS.md), [manifest](../../../ops/CHAT_CONTEXT_MANIFEST.json), [handoff](../../../ops/CHAT_HANDOFF.md), [PF01 authorization model](../../production-foundation/PF01_data_authorization.md), [acceptance cases](../../production-foundation/acceptance_cases.json), [B4 closure](../../../ops/pf02_b_b4_closure.md), frozen B1-B4 design/implementation receipts, and the operator's explicit B5 scope approval.

Historical B1-B4 receipts remain immutable snapshots. Nothing in B5 reopens their frozen contracts.

The repository `STATUS.md` and `ops/CHAT_CONTEXT_MANIFEST.json` on main still say no later slice is authorized. They remain truthful for published main because PR #63 is not merged. If and only if the written B5 design is independently accepted and the operator separately approves publication, a bounded status/manifest reconciliation must be separately authorized and published; this PR does not silently change those canonical routing files.

---

## 2. Operator-approved slice

The next PF02-B slice is:

> **B5 — Organization Membership Termination & Last-Admin Safety Foundation**

The approved scope is intentionally narrower than a general staff-management lifecycle.

B5 may:
- terminate one already-existing ACTIVE `OrganizationMembership`;
- target either `PROPERTY_STAFF` or `ORG_ADMIN`;
- require a current same-org ACTIVE `ORG_ADMIN` caller;
- allow an admin to terminate their own membership only when another **effective administrator** remains;
- preserve historical membership rows;
- prove concurrent B5 termination requests cannot leave an organization with zero **effective administrators**, where effective means ACTIVE ORG_ADMIN membership referencing an ACTIVE User;
- rely on the frozen current-state authorization model so an ENDED membership immediately stops conferring current organization/property/admin authority.

B5 does **not** implement:
- role mutation;
- `ORG_ADMIN → PROPERTY_STAFF` demotion;
- `PROPERTY_STAFF → ORG_ADMIN` promotion;
- membership creation;
- membership reactivation;
- staff roster/list/search;
- human-readable staff name/email/profile projection;
- onboarding/invitation;
- account creation;
- PropertyAssignment cleanup or cascade;
- assignment collection/list API;
- assignment management UI;
- global logout or Auth0 session revocation;
- User suspension;
- Organization suspension/archive;
- Property/Unit lifecycle mutation;
- PF02-C occupancy/resident invitation;
- F43 search;
- provider/IAM work;
- real tenant/landlord/contact data;
- production hosting.

The scope audit explicitly removed role mutation because the current membership row has one mutable `role` and no separate role-history model. In-place demotion/promotion would open additional questions about historical PropertyAssignment relationships and future authority reactivation. That is a separate future slice.

---

## 3. Problem statement

Frozen B1/B2/B3/B4 authorization already derives current authority from current database state rather than a long-lived JWT role string:

- B1/B2 organization context requires a current ACTIVE User/session, ACTIVE organization, and ACTIVE membership.
- B2 Property reads require current membership and, for `PROPERTY_STAFF`, a current ACTIVE PropertyAssignment.
- B3 `authn.can_administer_org` requires a current ACTIVE `ORG_ADMIN` membership.
- B4 assignment commands re-check current admin authority and current target membership state at the database boundary.

Existing regression tests already prove that manually changing a membership to `ENDED` removes current authorization. What is missing is a **bounded authenticated product command** that performs that lifecycle change safely.

Without a B5 command:
- product code has no supported way to terminate a membership;
- privileged fixtures/manual SQL are the only current termination mechanism;
- no product invariant prevents two admins from concurrently terminating the last two ACTIVE admin memberships;
- no command contract defines history/version behavior, non-disclosure, CSRF/method handling, or commit ambiguity.

B5 fills that command gap only.

---

## 4. Goal

For a caller with a current authenticated session and current ACTIVE `ORG_ADMIN` membership in an ACTIVE organization, B5 must support an exact termination command for one already-existing ACTIVE membership in the same organization.

The command must:

1. preserve the target row identity and history;
2. perform only `ACTIVE → ENDED`;
3. set database-owned `ended_at`;
4. increment `version`;
5. never physically delete or reactivate a membership row;
6. prevent a voluntary B5 termination from leaving zero **effective administrators**, where an effective administrator means:
   - membership is ACTIVE;
   - membership role is ORG_ADMIN;
   - referenced `app_user.status = 'ACTIVE'`;
7. serialize B5 last-admin changes at Organization level and use the PF01-compatible Organization→Membership lock discipline;
8. preserve all existing B1-B4 authorization semantics;
9. leave PropertyAssignment history untouched;
10. expose no User identity/profile/email/provider data;
11. fail closed if current authority or target eligibility changes;
12. bound lock/statement waits so one stalled command cannot indefinitely consume the five-connection Web pool;
13. keep canonical F15/F25/F39 statuses unchanged unless their complete acceptance semantics are later evidenced.

Security suspension remains a separate out-of-scope command. PF01 explicitly allows security suspension to leave an organization with no effective administrator and then requires organization work to lock pending recovery. B5 must not misclassify that security exception as voluntary last-admin safety.

---

## 5. Explicit non-goals

B5 does **not** add, infer, or prepare:

- staff roster/list/search;
- member collection/list/search;
- member detail/profile GET;
- user name, email, phone, avatar, issuer, subject, or provider profile projection;
- invitation issuance/acceptance/revocation;
- membership creation;
- membership reactivation;
- membership role mutation;
- role history;
- last-admin protection for future role-demotion commands;
- User suspension/deletion;
- Organization suspension/archive;
- Property/Unit archive;
- PropertyAssignment automatic end/delete/repoint;
- assignment management UI;
- self-service leave UI;
- staff-management UI;
- Occupancy/OccupancyMember/Resident Invitation;
- MaintenanceTicket/TicketMessage;
- F43 address/reference search;
- Auth0 provider changes or broader LIVE_PROVIDER evidence;
- Mobile auth changes;
- CommandReceipt or a general exactly-once framework;
- production hosting, credentials, external IAM, real data, or security/privacy completion;
- automatic canonical F-case promotion.

B5 is a database/API foundation. The exact target `membershipId` is assumed to be known to an authorized internal caller/test. A legitimate human-facing roster/identity contract remains a separate later slice.

---

## 6. Existing frozen facts at TARGET_REF

### 6.1 Membership schema

`app.organization_membership` already contains:

- `id uuid`;
- `org_id uuid`;
- `user_id uuid`;
- `role ORG_ADMIN | PROPERTY_STAFF`;
- `status ACTIVE | ENDED`;
- `version integer >= 1`;
- `created_at`;
- nullable `ended_at`;
- same-org identity constraints;
- status/time CHECK:
  - ACTIVE requires `ended_at IS NULL`;
  - ENDED requires `ended_at IS NOT NULL AND ended_at >= created_at`;
- partial unique index `organization_membership_one_active_user_org` on `(org_id,user_id) WHERE status='ACTIVE'`.

No B5 schema column is required for the approved scope.

### 6.2 Current context and authority

Frozen B2:
- `authn.can_access_org_context` accepts current ACTIVE `ORG_ADMIN` or `PROPERTY_STAFF`;
- `authn.authorize_org` delegates to that context capability;
- `authn.can_read_property` recomputes current membership, current role, current Property status, and current assignment state.

Frozen B3:
- `authn.can_administer_org(bytea,uuid)` is the exact current admin capability;
- it requires current session/actor, ACTIVE organization, ACTIVE membership and role exactly `ORG_ADMIN`.

B5 preserves and reuses the frozen B1-B4 authorization semantics where their current visibility is sufficient, but it does not pretend those frozen helpers can answer new cross-user B5 questions. The corrected B5 design therefore:
- leaves frozen helper bodies and existing Web ACLs unchanged;
- uses a new B5-specific capability-owned caller-classification helper only for the current caller, which the frozen RLS can see;
- uses a separate B5 read-only probe owner/helper for the cross-user "other effective administrator" question.

No frozen helper body is rewritten or widened.

### 6.3 B4 relationship behavior

B4 uses `membershipId` as the target side of PropertyAssignment and already treats an ENDED target membership as ineligible.

Therefore after B5 commits `membership.status='ENDED'`:
- frozen B2 staff Property reads cease to authorize through that membership even if ACTIVE PropertyAssignment rows remain;
- frozen B4 exact assignment operations against that membership return non-disclosing denial;
- PropertyAssignment rows need no cascade or cleanup to revoke current authority.

B5 must preserve that model.

### 6.4 Existing evidence is not product mutation authority

Existing tests directly mutate membership rows through migration/test privileges to verify revocation. Those tests prove current authorization behavior, but they do not implement or authorize the B5 command itself.

---

## 7. Architecture alternatives

### 7.1 Mutation authority

| Alternative | Decision |
| --- | --- |
| A. Give `bm_b1_web` raw UPDATE on `organization_membership` plus RLS | **Rejected.** This widens the frozen Web role to raw membership mutation and couples last-admin correctness to direct table access. |
| B. Reuse `bm_b1_capability_owner` as the mutation owner | **Rejected.** That NOLOGIN role is the frozen B1/B2/B3 read/capability owner. Business-row mutation rights would enlarge its trust boundary. |
| C. Reuse `bm_b4_assignment_owner` | **Rejected.** B4 ownership is assignment-specific. Membership mutation and assignment mutation remain separate authorities. |
| D. Use migration/table owner SECURITY DEFINER | **Rejected.** The migration owner has substantially broader authority than B5 needs. |
| E. New LOGIN role / pool / credential | **Rejected.** Adds hosting/IAM/credential lifecycle for no product need. |
| **F. Dedicated NOLOGIN B5 command owner + SECURITY DEFINER + Web EXECUTE-only** | **Selected correction candidate.** Narrowly isolates membership termination without raw Web membership UPDATE or a new credential. |

Proposed internal role:

`bm_b5_membership_owner`

Required attributes:

`NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`

This role is not a credential and is never a product login role.

### 7.2 Last-admin serialization

The first design candidate rejected an Organization-row lock and locked ACTIVE admin memberships before the exact target. Independent review correctly found that this diverged from canonical PF01 §8.2 and could compose badly with a future PF01-order command.

Corrected architecture:

1. **Organization-level serialization is required.**
2. The B5 owner receives the minimum lock-enabling privilege on `app.organization`: `SELECT(id,status)` plus `UPDATE(id)`.
3. A B5-specific RESTRICTIVE Organization SELECT/UPDATE ceiling limits the owner to the current ACTIVE organization and requires the post-operation id to remain exactly `app.current_org_id()`. The B5 function never executes an Organization UPDATE; `UPDATE(id)` exists only because PostgreSQL locking clauses require UPDATE privilege on at least one column.
4. B5 acquires the current Organization row with `FOR NO KEY UPDATE` before membership locks.
5. B5 then locks the set **(all current ACTIVE ORG_ADMIN memberships ∪ exact target membership)** in one top-level query ordered by immutable membership `id`, using `FOR NO KEY UPDATE`.
6. Current target/admin facts are derived from that locking query's returned rows; no separate stale application count is authoritative.

The one-statement membership union fixes the prior admin-first/target-second ordering problem. A staff target with a lower UUID is locked in the same id order as every admin membership.

PF01's generic order also names User before Organization. B5 deliberately does **not** row-lock `app_user`: User security suspension is a separate security command that PF01 says must not be prevented by last-admin protection. Instead B5 re-evaluates referenced User ACTIVE state through the capability-owned effective-admin helper in the decisive UPDATE snapshot. This is a bounded B5 security-suspension exception, not a claim that B5 serializes User lifecycle commands.

`FOR NO KEY UPDATE` is selected instead of `FOR UPDATE` because B5 changes only non-key membership columns. It still conflicts with other B5 membership updates/locks while not unnecessarily conflicting with B4's foreign-key `FOR KEY SHARE` behavior.

### 7.3 Effective-admin read-only probe boundary

The second independent review correctly found that `bm_b1_capability_owner` cannot implement the cross-user effective-admin helper: frozen `b1_member_ceiling` restricts that owner to the current actor's own membership.

B5 therefore does **not** alter `b1_member_discovery`, `b1_member_ceiling`, or any other frozen B1/B2 policy.

Instead B5 proposes a second dedicated internal role:

`bm_b5_effective_admin_probe_owner`

Required attributes:

`NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`

This role is read-only and separate from `bm_b5_membership_owner`.

Raw privileges are limited to:

On `app.organization_membership`, SELECT only:
- `id`;
- `org_id`;
- `user_id`;
- `role`;
- `status`.

On `app.app_user`, SELECT only:
- `id`;
- `status`.

It receives no INSERT/UPDATE/DELETE on either table.

For `organization_membership`, a B5-specific RESTRICTIVE SELECT ceiling for the probe owner requires:
- `org_id = app.current_org_id()`;
- `status='ACTIVE'`;
- `role='ORG_ADMIN'`.

The existing PUBLIC permissive `organization_membership_org_scope` supplies the permissive current-org side. The probe ceiling narrows it to current ACTIVE admins.

`app.app_user` currently has no RLS. Therefore the probe owner can technically raw-read only the granted `id,status` columns across app_user rows. This is an explicit internal trust boundary. It is contained by:
- NOLOGIN/NOINHERIT;
- exact preflighted role membership;
- no Web or B5 command-owner SET ROLE path;
- fixed SECURITY DEFINER helper code that joins only user ids reached through current-org visible ACTIVE admin membership rows;
- no user row or status returned to the caller.

The effective-admin helper becomes:

`authn.b5_has_other_effective_admin(p_org uuid,p_target uuid) RETURNS boolean`

Properties:
- owner = `bm_b5_effective_admin_probe_owner`;
- SECURITY DEFINER;
- secure `search_path = pg_catalog, pg_temp`;
- PUBLIC EXECUTE revoked;
- EXECUTE granted only to `bm_b5_membership_owner`;
- requires `p_org = app.current_org_id()`;
- searches a different current-org ACTIVE ORG_ADMIN membership;
- joins that membership's `user_id` to `app.app_user.id`;
- requires `app_user.status='ACTIVE'`;
- returns boolean only.

Positive evidence must prove that two distinct ACTIVE Users with ACTIVE ORG_ADMIN memberships make the helper return true through the real probe-owner → command-owner execution path, while a suspended or deletion-pending second User returns false.

The caller-classification helper remains separate and may stay owned by `bm_b1_capability_owner` because it needs only the caller's own current membership, which frozen RLS already permits.

PostgreSQL 18 basis:
- RLS SELECT policies also affect UPDATE queries that require SELECT privileges;
- restrictive policies are ANDed with applicable permissive policies;
- row-locking clauses require SELECT plus UPDATE privilege on at least one selected table column;
- `FOR NO KEY UPDATE` conflicts with writers/`FOR NO KEY UPDATE` but not `FOR KEY SHARE`;
- consistency-sensitive transactions should acquire locks in a common order.

References:
- https://www.postgresql.org/docs/18/ddl-rowsecurity.html
- https://www.postgresql.org/docs/18/sql-select.html
- https://www.postgresql.org/docs/18/explicit-locking.html
- https://www.postgresql.org/docs/18/sql-update.html
- https://www.postgresql.org/docs/18/runtime-config-client.html

---

## 8. Exact public command resource

Proposed B5 resource:

`DELETE /api/v2/organizations/:orgId/memberships/:membershipId`

It represents:

> end the current ACTIVE membership identified by `membershipId` in `orgId`.

It does **not** represent physical deletion of the historical row.

B5 introduces:
- no collection endpoint;
- no GET member detail;
- no POST create;
- no PUT/PATCH role change;
- no human-facing roster UI.

### 8.1 Success

Eligible ACTIVE target successfully transitions to ENDED:

- HTTP 204;
- empty body;
- row retained;
- `ended_at = clock_timestamp()` or equivalent DB-owned current timestamp;
- `version = version + 1`.

### 8.2 Already ended / missing / foreign

A target that is absent, foreign, or already ENDED returns the same non-disclosing 404.

A repeated DELETE after a successful prior termination therefore has no additional effect but may return 404. The effect remains idempotent; B5 does not add a historical membership-discovery API merely to make repeated response codes identical.

### 8.3 Last effective admin

If the target is an ACTIVE `ORG_ADMIN` and there is no **other effective administrator** (ACTIVE ORG_ADMIN membership whose referenced User is ACTIVE):

- no row is changed;
- HTTP 409;
- public error `CONFLICT`;
- no admin count, User state, target role, identity, or raw constraint detail is exposed.

A suspended/deletion-pending User does not satisfy the "other effective administrator" condition.

### 8.4 Known transient database contention

A bounded lock wait, deadlock, statement timeout, or other mapped pre-commit database failure returns sanitized 503 `DEPENDENCY_UNAVAILABLE`. It does not become 409 and does not expose SQLSTATE publicly.

---

## 9. Request, transport, and database-error contract

The B5 DELETE accepts:
- path `orgId`;
- path `membershipId`;
- no query parameters;
- no business body.

It must reject any attempt to supply role, userId, status, version, endedAt, caller identity, authority flags, replacement membership, or assignment data.

Mutating request precedence follows the frozen B3/B4 convention:

1. supported method;
2. exact configured Origin;
3. current authenticated session/registry;
4. session-bound CSRF;
5. bounded empty-body / query / UUID validation;
6. current organization context visibility;
7. current admin authority;
8. exact target eligibility;
9. last-admin invariant;
10. decisive database transition.

Expected public errors:

| HTTP | Error |
| --- | --- |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 400 | `INVALID_INPUT` |
| 409 | `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 503 | `DEPENDENCY_UNAVAILABLE` |
| 405 | `METHOD_NOT_ALLOWED` |

The public body stays flat: `{"error":"CODE"}`.

For recognized-but-disallowed HTTP methods, the B5 route owns a narrow 405 with `Allow: DELETE`. Framework-owned unknown-method behavior remains framework-owned, following B4; the implementation plan must verify a Fetch-allowed diagnostic such as PROPFIND rather than invent a TRACE contract.

All B5 responses use private/no-store cache behavior and preserve the existing Cookie cache dimension.

### 9.1 Transaction-local timeout contract

The B5 persistence adapter must set, inside the already-open transaction and **before** invoking the B5 command function:

- `SET LOCAL lock_timeout = '2000ms'`;
- `SET LOCAL statement_timeout = '5000ms'`;
- `SET LOCAL transaction_timeout = '7000ms'`.

These values are B5 design bounds, not platform-wide settings and not an SLA. `transaction_timeout` bounds the full transaction lifetime, including a holder that stalls after the B5 function returns but before COMMIT. The production Web pool remains the current max-5 pool; B5 does not change pool configuration.

### 9.2 Sanitized SQLSTATE mapping

The implementation must treat the following as known pre-commit/transaction-aborting failures, rollback, and return B5 `DEPENDENCY_UNAVAILABLE` / HTTP 503 without automatic retry:

- `55P03 lock_not_available` — including lock_timeout expiration;
- `57014 query_canceled` — statement timeout/cancel;
- `40P01 deadlock_detected`;
- `40001 serialization_failure` if ever surfaced despite the READ COMMITTED contract;
- `23514 check_violation` — including a frozen membership status/time invariant failure;
- `22003 numeric_value_out_of_range` — including version overflow.

No raw SQLSTATE/constraint/error text reaches the client. **Any unlisted PostgreSQL/driver error code also defaults to the same sanitized `DEPENDENCY_UNAVAILABLE` / HTTP 503 path unless it is one of the explicitly recognized B5 business results (`NOT_FOUND`, `FORBIDDEN`, `LAST_ADMIN`).**

A failure returned before COMMIT is distinguishable from an unknown COMMIT outcome. The former is known rolled back/no mutation after transaction cleanup; the latter remains ambiguous and uses the existing transaction-helper rule: sanitized 503, destroy uncertain connection, no automatic command retry.

---

## 10. Visibility and authorization precedence

### 10.1 Organization context

The outer Web transaction may reuse the frozen B1 organization-context establishment:
- current session/actor;
- current organization context via `authorize_org`;
- transaction-local `app.org_id` and session digest.

Thus:
- current admin can enter context;
- current staff can enter context but is not authorized to terminate membership;
- foreign/inactive/hidden organization is 404.

### 10.2 Post-wait caller classification

Inside the B5 command:

1. a fast current-admin check may reject obvious unauthorized calls before locking;
2. acquire the Organization-level lock;
3. acquire the ordered membership-union locks;
4. **after any lock wait**, re-evaluate organization visibility first;
5. if organization context is no longer visible/current → internal NOT_FOUND → public 404;
6. if context is still visible but caller is no longer current ORG_ADMIN → internal FORBIDDEN → public 403;
7. repeat the same current-state authority requirement in the decisive UPDATE predicate.

This preserves frozen B3/B4 precedence.

A caller whose membership is ended while the B5 request is blocked on the Organization or membership lock must not be classified from the stale pre-lock check.

Once the caller's current admin membership row has itself been acquired by the B5 membership-union lock, another in-scope B5 termination cannot change that row until the transaction completes. Out-of-scope security/lifecycle commands are not claimed globally serialized by B5.

### 10.3 Target eligibility

The exact target must be:
- same `orgId`;
- status ACTIVE;
- role currently `ORG_ADMIN` or `PROPERTY_STAFF`.

The target is included in the same deterministic membership lock query as all current admin memberships.

B5 returns no target user_id, role, version, timestamps, identity or profile data to the public caller.

---

## 11. Additive migration boundary

The first available migration number after frozen B4 is currently 0010.

Proposed filename:

`packages/persistence-postgres/migrations/0010_b5_membership_termination.sql`

Existing migrations 0001-0009 remain byte-frozen.

The B5 migration may:
1. preflight both `bm_b5_membership_owner` and `bm_b5_effective_admin_probe_owner` attributes and role membership;
2. grant minimum schema/function/table/column privileges;
3. create B5-specific **RESTRICTIVE** RLS ceilings on Organization and OrganizationMembership;
4. create the B5 SECURITY DEFINER command routine;
5. create the B5 caller-classification helper under `bm_b1_capability_owner` and the other-effective-admin helper under `bm_b5_effective_admin_probe_owner`;
6. add the probe owner's RESTRICTIVE membership SELECT ceiling and exact read-only column grants;
7. revoke PUBLIC EXECUTE on all new helpers;
8. grant both B5 helper EXECUTEs only to `bm_b5_membership_owner`;
9. grant only exact B5 command EXECUTE to `bm_b1_web`;
10. revoke temporary CREATE authority before commit;
11. verify no raw Web membership or Organization UPDATE surface;
12. verify no unintended role membership/inheritance remains.

The migration may **not**:
- add a business table or column;
- modify old migrations;
- create a LOGIN role;
- provision a credential;
- change provider/IAM;
- change frozen B1/B2/B3/B4 helper bodies;
- change PropertyAssignment schema.

### 11.1 Synthetic role provisioning boundary

Production migration **preflights** both B5 NOLOGIN roles; it does not create a production login or credential.

Only disposable test infrastructure may provision the synthetic `bm_b5_membership_owner` and `bm_b5_effective_admin_probe_owner` roles and the migrator's non-inherited SET-only memberships required to create/own B5 functions, following the established B4 testing pattern. This is not production IAM evidence.

### 11.2 Pre-declared frozen-test expectation updates

B5 is additive, but current frozen capability tests use exact inventories. A future implementation plan must therefore predeclare and limit the following test expectation changes:

- `tests/postgres/b2-capabilities.test.ts` must extend its frozen policy-inventory scoping to exclude `b5_*` from the B1/B2 exact list, exactly as it already separates B3/B4 additions; the B5 policies are then asserted in B5-owned tests;
- that same B2 frozen role-membership inventory must exclude both dedicated B5 owner/probe-owner migrator provisioning relationships from the B1/B2 list while B5-owned tests assert both exact membership/options;
- `tests/postgres/b3-capabilities.test.ts` keeps the existing `can_administer_org` ACL unchanged: B5 does **not** gain EXECUTE on that frozen helper directly because caller classification is provided by a new B5-specific capability-owned helper;
- existing exact executor inventories may add only new B5 helper entries where a new helper is actually introduced and must retain every prior expected row;
- new B5 catalog tests own the exact B5 role, policy, helper, ACL and negative behavior assertions.

These expectation updates are not product-semantic changes and must not delete/weaken existing B1-B4 assertions.

---

## 12. Least-privilege surface

### 12.1 organization_membership

Proposed maximum B5-owner raw columns:

SELECT:
- `id`;
- `org_id`;
- `role`;
- `status`;
- `version`.

UPDATE:
- `status`;
- `version`;
- `ended_at`.

Explicitly no B5-owner raw SELECT on:
- `user_id`;
- `created_at`;
- `ended_at`;
- external identity/profile/contact data.

Explicitly no B5-owner INSERT or DELETE on `organization_membership`.

**RLS correction:** B5 membership SELECT cannot be ACTIVE-only. PostgreSQL applies applicable SELECT policy visibility to UPDATE queries that require SELECT privileges, and B5's guarded UPDATE reads `id/org_id/status/version`. An ACTIVE-only SELECT policy would reject the resulting ENDED row. Therefore the B5-owner SELECT ceiling is current-org only.

This means ENDED membership rows in the current org are RLS-visible to the NOLOGIN B5 owner for only the granted columns above. Public non-disclosure is enforced by fixed function predicates, the absence of any member projection/GET surface, and the absence of Web raw table privilege.

### 12.2 organization lock surface

The B5 owner receives:

SELECT:
- `id`;
- `status`.

UPDATE:
- `id` only.

`UPDATE(id)` is a PostgreSQL lock-enabling privilege, not an authorized business mutation. B5-specific RESTRICTIVE UPDATE RLS requires both old and new `id = app.current_org_id()` and `status='ACTIVE'`; the owner has no UPDATE privilege on status/display_name/created_at. The B5 function performs no Organization UPDATE.

Required behavioral negative evidence must prove an attempted id change is blocked by the B5 RLS/FK boundary and that status/display_name/created_at updates are privilege-denied.

### 12.3 Effective-admin visibility

The B5 command owner gets **no raw app_user SELECT** and no raw membership user_id SELECT.

Instead it receives EXECUTE only on the B5-specific boolean helper owned by `bm_b5_effective_admin_probe_owner`.

The probe owner receives only the exact read-only columns defined in §7.3 and no mutation privilege.

### 12.4 property_assignment

B5 receives no new raw privilege on `app.property_assignment`.

Membership termination revokes current authority through frozen B2/B4 predicates. Assignment history stays untouched.

---

## 13. B5 RLS intent

The dedicated B5 owner is neither a table owner nor BYPASSRLS. FORCE RLS remains effective on Organization and OrganizationMembership.

The existing `organization_org_scope` and `organization_membership_org_scope` are PUBLIC permissive policies. Therefore all B5 ceilings described here must be **RESTRICTIVE**; a new permissive policy alone cannot narrow those PUBLIC policies.

### 13.1 Organization SELECT ceiling — RESTRICTIVE

For `bm_b5_membership_owner`:
- `id = app.current_org_id()`;
- `status = 'ACTIVE'`.

### 13.2 Organization UPDATE ceiling — RESTRICTIVE

USING:
- `id = app.current_org_id()`;
- `status='ACTIVE'`.

WITH CHECK:
- `id = app.current_org_id()`;
- `status='ACTIVE'`.

The owner can UPDATE only `id`, so this ceiling makes the privilege usable for a row-locking clause without authorizing an actual id transition.

### 13.3 Membership SELECT ceiling — RESTRICTIVE

For `bm_b5_membership_owner`:
- `org_id = app.current_org_id()`.

There is deliberately **no status filter** on this SELECT ceiling after the H01 correction.

### 13.4 Membership UPDATE ceiling — RESTRICTIVE

USING:
- current org only;
- old row status ACTIVE.

WITH CHECK:
- current org only;
- resulting status ENDED;
- resulting ended_at non-null.

The owner lacks UPDATE on id/org_id/user_id/role/created_at, so those cannot be changed by the B5 role.

### 13.5 Effective-admin probe membership SELECT ceiling — RESTRICTIVE

For `bm_b5_effective_admin_probe_owner`:
- `org_id = app.current_org_id()`;
- `status='ACTIVE'`;
- `role='ORG_ADMIN'`.

No B5 probe policy is added to app_user because app_user currently has no RLS. The probe's app_user boundary is the exact SELECT(id,status) column grant plus NOLOGIN isolation and fixed SECURITY DEFINER helper code.

### 13.6 Required final policy behavior

Final catalog/behavior evidence must prove:
- no B5 policy is PUBLIC;
- no B5 policy is permissive-only;
- Web still has no raw membership/Organization UPDATE;
- capability/B4/PF02-A roles gain no B5 mutation authority;
- the command owner gains no raw user_id/app_user visibility;
- the probe owner gains no mutation authority and sees membership rows only through its current-org ACTIVE-ORG_ADMIN RESTRICTIVE ceiling;
- missing org context yields zero B5 row visibility/mutation;
- an actual ACTIVE→ENDED UPDATE executes successfully under the final B5 owner + final RLS;
- ENDED→ACTIVE is denied;
- role/org/user mutation is denied;
- INSERT/DELETE membership is denied.

---

## 14. SECURITY DEFINER and capability boundary

### 14.1 B5 command

Proposed internal command:

`authn.b5_end_organization_membership(p_digest bytea,p_org uuid,p_membership uuid) RETURNS text`

Required properties:
- owner = `bm_b5_membership_owner`;
- SECURITY DEFINER;
- secure `search_path = pg_catalog, pg_temp`;
- all app/authn objects schema-qualified;
- no dynamic SQL;
- PUBLIC EXECUTE revoked;
- Web receives only EXECUTE on this command;
- no identity/profile return;
- no raw DB error detail;
- no automatic retry of unknown COMMIT outcome.

Possible internal result vocabulary:
- `ENDED`;
- `NOT_FOUND`;
- `FORBIDDEN`;
- `LAST_ADMIN`.

### 14.2 Caller classification helper

Proposed read-only helper:

`authn.b5_classify_caller(p_digest bytea,p_org uuid) RETURNS text`

- owner = `bm_b1_capability_owner`;
- SECURITY DEFINER;
- secure `search_path = pg_catalog`;
- PUBLIC EXECUTE revoked;
- EXECUTE only to `bm_b5_membership_owner`;
- internal vocabulary `ALLOWED | NOT_FOUND | FORBIDDEN`;
- no direct Web EXECUTE;
- no identity projection.

It implements the frozen precedence:
- organization/session relationship no longer visible/current → NOT_FOUND;
- context visible but caller not current ORG_ADMIN → FORBIDDEN;
- current active admin → ALLOWED.

### 14.3 Other-effective-admin helper

Proposed read-only helper:

`authn.b5_has_other_effective_admin(p_org uuid,p_target uuid) RETURNS boolean`

- owner = `bm_b5_effective_admin_probe_owner`;
- SECURITY DEFINER;
- secure `search_path = pg_catalog, pg_temp`;
- PUBLIC EXECUTE revoked;
- EXECUTE only to `bm_b5_membership_owner`;
- no direct Web EXECUTE;
- current org only;
- reads only probe-visible ACTIVE ORG_ADMIN memberships;
- joins only referenced `app_user.id,status`;
- requires a different membership and ACTIVE User;
- returns boolean only;
- never returns user_id/status rows.

The caller-classification helper remains capability-owned; the cross-user effective-admin helper does not.

These B5-specific additive helpers do not modify frozen B1-B4 helper bodies or their existing direct Web ACLs.

---

## 15. Corrected last-admin algorithm

Every B5 command in an organization uses the same lock discipline.

1. Outer Web boundary validates method/Origin/session/CSRF/input and establishes current organization context.
2. Optional fast caller classification rejects obvious NOT_FOUND/FORBIDDEN before lock work.
3. Persistence sets B5 transaction-local timeouts.
4. Lock the current ACTIVE Organization row with `FOR NO KEY UPDATE`.
5. After the Organization lock wait, re-run caller classification: visibility first, then admin authority.
6. Lock **all current ACTIVE ORG_ADMIN memberships plus the exact ACTIVE target** in one top-level query:
   - same org;
   - `status='ACTIVE'`;
   - predicate `role='ORG_ADMIN' OR id=p_target`;
   - `ORDER BY id`;
   - `FOR NO KEY UPDATE`.
7. Derive the exact target from the rows returned by that locking query. If the target is absent, return NOT_FOUND.
8. After membership-lock wait, re-run caller classification again.
9. If target role is ORG_ADMIN, require `b5_has_other_effective_admin(p_org,p_target)=true`; otherwise LAST_ADMIN.
10. Execute exactly one guarded ACTIVE→ENDED UPDATE:
    - exact org/id;
    - status ACTIVE;
    - caller classification still ALLOWED in the decisive statement snapshot;
    - if target role is ORG_ADMIN, another effective admin still exists in the decisive statement snapshot;
    - SET status='ENDED', ended_at=clock_timestamp(), version=version+1.
11. Success only if exactly one row changes.
12. If zero rows change, classify current state without another mutation: caller visibility/admin first, target state second, last-effective-admin third.
13. COMMIT once. No automatic mutation retry.

### 15.1 Deterministic membership lock evidence

The `ORDER BY id` must be at the same locking-query level that carries `FOR NO KEY UPDATE`. The design does not rely on an outer ORDER BY around an already-locking subquery.

The admin/current-target facts used before UPDATE come from this returned locked row set, not a separate unlocked count query.

### 15.2 Two-admin concurrent termination

With Admin A and Admin B effective and ACTIVE:
- both commands contend first at Organization level;
- one proceeds;
- the second waits;
- after wake-up, fresh caller/effective-admin checks use the committed state;
- both voluntary B5 commands cannot commit a zero-effective-admin outcome.

### 15.3 Effective-admin User state

The decisive last-admin predicate is membership ACTIVE + role ORG_ADMIN + referenced User ACTIVE.

If the other admin's User is already SUSPENDED/DELETION_PENDING before the decisive UPDATE snapshot, that admin does not satisfy the guard.

If an out-of-scope security suspension commits after B5's decisive snapshot, security suspension may subsequently leave zero effective admins. That is PF01's explicit security exception and must lead to organization operational lock/recovery in the future lifecycle design; B5 does not block that security command.

### 15.4 Staff termination

Staff target termination uses the same Organization lock and membership-union lock discipline for compositional simplicity. B5 makes no throughput/SLA claim.

---

## 16. Transaction, timeout, and failure contract

B5 reuses the existing authenticated organization transaction boundary and READ COMMITTED. It does not switch the application to SERIALIZABLE.

The command is one database transaction.

Before calling the B5 command function, the persistence adapter must execute transaction-local:
- `SET LOCAL lock_timeout = '2000ms'`;
- `SET LOCAL statement_timeout = '5000ms'`.

Required properties:
- lock wait is bounded;
- Organization last-admin serialization occurs before membership mutation;
- membership target state is never trusted from an earlier application read;
- no client-side count decides the invariant;
- no automatic retry for lock timeout/deadlock/statement timeout;
- mapped database failures roll back and return sanitized 503;
- unknown COMMIT outcome remains distinct from known pre-commit rollback.

### 16.1 Routine exception discipline

The B5 SECURITY DEFINER command and its helpers must not use a catch-all `EXCEPTION WHEN OTHERS` that swallows database failures, converts them to a business result, or attempts an internal retry. Expected business branches use ordinary SQL/PLpgSQL control flow. Unexpected database exceptions propagate to the persistence adapter for rollback and sanitized mapping.

### 16.2 Known pre-commit failures

The adapter maps SQLSTATE `55P03`, `57014`, `40P01`, `40001`, `23514`, and `22003` to internal B5 `DEPENDENCY_UNAVAILABLE`, rolls back, and exposes only HTTP 503.

No internal retry is performed. PF01 allows either bounded internal retry or a retryable error; B5 chooses the latter.

### 16.3 Check/time/version edge cases

B5 does not expand raw owner SELECT merely to clamp `ended_at` against `created_at`. If the frozen status/time CHECK rejects the DB-owned timestamp shape with 23514, the whole transaction rolls back and returns sanitized 503.

If `version + 1` overflows and PostgreSQL reports 22003, the whole transaction rolls back and returns sanitized 503.

These are dependency/invariant failures, not public client conflicts.

### 16.4 Unknown COMMIT outcome

If COMMIT itself fails/has unknown outcome:
- return sanitized 503;
- destroy/release the uncertain connection according to the frozen transaction helper;
- do not automatically issue a second termination command;
- do not claim no mutation occurred.

---

## 17. Membership state/history semantics

### 17.1 Allowed transition

Only:

`ACTIVE → ENDED`

### 17.2 Mutation fields

On successful transition:
- `status = 'ENDED'`;
- `ended_at = clock_timestamp()` or equivalent DB-owned current time;
- `version = version + 1`.

The command must not accept a client timestamp or version.

### 17.3 Forbidden transitions

B5 must never:
- DELETE the row;
- set ENDED→ACTIVE;
- change role;
- change org_id;
- change user_id;
- reuse an ended row as a new membership;
- create another membership.

A future new membership lifecycle must create a new current relationship under its own approved scope and must not rewrite historical B5 rows.

---

## 18. Interaction with PropertyAssignment and B4

B5 performs no assignment cleanup.

If a PROPERTY_STAFF membership has ACTIVE PropertyAssignment rows and B5 ends the membership:
- assignment rows remain byte/history intact;
- frozen B2 `can_read_property` no longer authorizes through that membership;
- frozen B4 exact relationship target becomes ineligible;
- B4 does not reactivate or rewrite assignments for an ended membership.

### 18.1 B4 PUT × B5 termination race

B5 uses `FOR NO KEY UPDATE`, which does not conflict with PostgreSQL `FOR KEY SHARE`. A B4 PUT whose decisive statement snapshot predates B5's commit can therefore still finish an ACTIVE PropertyAssignment insert for a membership that is ENDED by the time both transactions are committed.

This is an accepted history-only race aligned with the retained B4 lifecycle limitation:
- it does **not** restore authority;
- frozen B2 requires the membership itself to remain ACTIVE;
- frozen B4 later treats the ended target as ineligible;
- B5 does not clean up or rewrite the assignment row.

B5 acceptance evidence must reproduce both commit orders and prove final authorization is denied after membership termination even if an ACTIVE assignment history row exists.

B5 does not claim that future membership creation/role-transition commands use the same locks. Such future commands must explicitly adopt a compatible PF01 last-admin/invariant protocol before full F39 semantics can be claimed.

---

## 19. Session semantics

B5 does not globally revoke the authentication session.

After membership termination:
- the same Web cookie/session may remain technically authenticated;
- access to the ended organization is denied because current authorization no longer finds an ACTIVE membership;
- other organizations in which the same User still has a current authorized relationship remain unaffected.

This preserves separation between identity/session validity and organization authorization.

B5 does not:
- call Auth0 logout;
- revoke every session for the User;
- delete the User;
- modify ExternalIdentity.

---

## 20. Public response and privacy boundary

B5 success has no body.

Errors reveal no:
- target user id;
- target role;
- membership status;
- membership version;
- admin count;
- assignment count;
- organization membership count;
- email/name/profile/provider identifier;
- SQL error or constraint name.

Foreign, absent and ENDED target membership cases share 404.

Last-admin receives the generic public `CONFLICT` code. The API does not disclose how many admins exist.

**Accepted residual inference — B5D2-L02:** on self-termination, a current admin who already knows that a co-admin membership exists can distinguish success from `CONFLICT` and may therefore infer that no *other effective* admin exists; because effective-admin status includes `app_user.status='ACTIVE'`, this can indirectly reveal that the known co-admin is not currently effective. B5 does not reveal which underlying condition failed, does not expose the other User row/status, and limits this inference to an already-authorized current admin. This residual is accepted as LOW unless a later product/privacy review requires a different last-admin UX/error contract.

No logs/public evidence may include real identity data, request cookies, CSRF material, raw provider subject, or production identifiers.

Tests use synthetic UUIDs/identities only.

---

## 21. Proposed application boundary

A future implementation may introduce a dedicated application port, for example:

`OrganizationMembershipTerminationPort`

with one operation equivalent to:

`endCurrent(digest, orgId, membershipId): Promise<void>`

Application responsibilities:
- strict UUID/path/query validation;
- current actor/session precheck;
- map persistence error categories to B5 sanitized error categories;
- no direct SQL;
- no admin-count logic;
- no optimistic local membership state.

Persistence is the decisive authority.

A future implementation should use a new explicit package subpath such as `@build-manager/persistence-postgres/b5` only if the approved implementation plan verifies that it does not widen existing B1-B4 imports.

---

## 22. Proposed Web route boundary

Proposed route:

`apps/web/src/app/api/v2/organizations/[orgId]/memberships/[membershipId]/route.ts`

Required runtime:
- Node.js route runtime;
- force-dynamic;
- no provider calls;
- no client-side authority.

DELETE:
- exact Origin;
- current session;
- session-bound CSRF;
- empty body;
- no query;
- strict UUID selectors.

All other recognized route methods:
- no business handling;
- custom 405 only if supported by the pinned Next.js route boundary;
- `Allow: DELETE`.

The exact method export inventory must be verified against the pinned runtime in the implementation plan rather than assumed.

---

## 23. Acceptance criteria for B5

These are B5 slice criteria, not automatic canonical F-case promotions.

### AC01 — Scope / exact resource
Only the exact organization-membership termination resource is added. No roster, profile, create, role mutation, invitation, assignment UI, PF02-C or F43 surface appears.

### AC02 — Current admin authority
A current same-org effective ORG_ADMIN can terminate an eligible ACTIVE target. Current PROPERTY_STAFF cannot.

### AC03 — Hidden target non-disclosure
Foreign, missing or already ENDED target returns the same 404 and mutates nothing.

### AC04 — Staff termination / history
ACTIVE PROPERTY_STAFF transitions to ENDED, sets DB-owned ended_at, increments version exactly once, retains id/org/user/role/created_at.

### AC05 — Admin termination / effective-admin definition
An ACTIVE ORG_ADMIN target may be terminated only when at least one **other** ACTIVE ORG_ADMIN membership references an ACTIVE User at the decisive statement snapshot.

### AC06 — Last-effective-admin denial
If no other effective admin exists, B5 returns sanitized 409 CONFLICT and target row bytes/version are unchanged. Include the case where another admin membership is ACTIVE but its User is SUSPENDED or DELETION_PENDING.

### AC07 — Organization-level concurrency
Actual product-function calls through `bm_b1_web`, with distinct backend PIDs, prove blocking using `pg_blocking_pids` and/or `pg_stat_activity`. Required variants:
- two admins self/self;
- cross A terminates B while B terminates A;
- same target;
- three-admin case.
All variants prove final voluntary B5 outcome retains >=1 effective admin and no repeat-until-green occurs.

### AC08 — Caller authority race / precedence
Create an evidenced window where the caller loses its organization membership while the B5 request is blocked before acquiring the relevant membership locks. After wake-up B5 rechecks:
- no longer visible/current org context → 404 NOT_FOUND;
- still visible but no longer admin → 403 FORBIDDEN.
Target remains unchanged.

### AC09 — Target race
If target becomes ENDED before B5 acquires/classifies its membership lock, B5 returns non-disclosing 404, does not rewrite it, and does not increment version again.

### AC10 — Assignment preservation and B4 race
Ending a PROPERTY_STAFF membership leaves PropertyAssignment history unchanged while frozen B2/B4 current authorization denies. Also reproduce B4 PUT × B5 termination in both controlled commit orders and prove no authority revival even if an ACTIVE assignment row is committed after the membership-ending snapshot.

### AC11 — Multi-org isolation
Ending one membership changes no membership, assignment or authority in another organization.

### AC12 — Session separation
The same authenticated User may retain unrelated organization access; B5 does not globally revoke identity/session.

### AC13 — Transport boundaries
Method/Origin/session/CSRF/query/path/body-size precedence produces fixed sanitized errors and zero mutation on failure.

### AC14 — Catalog least privilege
Catalog evidence proves:
- dedicated NOLOGIN B5 owner;
- exact Organization SELECT + UPDATE(id)-only lock privilege;
- exact membership SELECT/UPDATE column ceiling;
- dedicated NOLOGIN effective-admin probe owner with membership SELECT(id,org_id,user_id,role,status) and app_user SELECT(id,status) only;
- no member INSERT/DELETE;
- new B5 policies are RESTRICTIVE;
- secure SECURITY DEFINER ownership/search_path/ACL;
- caller helper and probe helper are not directly Web-executable;
- probe helper positive case with two distinct ACTIVE admin Users returns true through the real probe-owner → command-owner path;
- suspended/deletion-pending second User returns false;
- no unintended role inheritance/membership.

### AC15 — Owner-role behavioral negatives
Using the disposable synthetic B5 owner under final policies:
- actual ACTIVE→ENDED UPDATE succeeds;
- ENDED→ACTIVE denied;
- role/org/user update denied;
- membership INSERT denied;
- membership DELETE denied;
- Organization status/display_name/created_at update denied;
- Organization id change denied by RLS/FK;
- missing org context sees/mutates zero B5 rows.

### AC16 — Bounded wait / SQLSTATE mapping
Induce lock_timeout, statement_timeout/cancel, and deadlock paths without production config changes. Prove fixed sanitized 503, transaction rollback/no partial mutation, and no raw SQLSTATE/SQL text in HTTP output. Separately verify 23514 and 22003 mapping with synthetic negative controls where practical.

### AC17 — Frozen inventory additive expectations
Predeclared B1/B2/B3/B4 catalog tests are updated only to recognize the bounded B5 role/policies/helpers. Existing frozen assertions are not deleted/weakened.

### AC18 — Frozen regression
B1/B2/B3/B4 and current PostgreSQL/Web/Mobile repository gates remain green; migrations 0001-0009 are byte-frozen.

### AC19 — Publication/status boundary
The design candidate itself changes only design/ops bookkeeping. Canonical STATUS/manifest routing is reconciled only after independent design acceptance plus explicit operator publication authorization; no candidate text is treated as published main authority before then.

---

## 24. Canonical F-case relationship

B5 does **not** automatically promote F15, F25 or F39.

### F15 — remains NOT_RUN
F15 requires later ticket read/reply behavior. B5 may provide future supporting revocation evidence for current B1-B4 organization/property/admin paths, but it cannot prove ticket behavior before PF02-D exists.

### F39 — remains NOT_RUN
F39's canonical expected behavior includes organization-level last-admin serialization, voluntary leave/**demotion**, and the security-suspension exception. The corrected B5 architecture now aligns its **termination** path with Organization-level serialization, but role demotion and complete security lifecycle semantics remain outside B5.

Therefore B5 evidence may be cited later as **partial termination-path evidence**, not as complete F39 prerequisite satisfaction or PASS.

### F25 — remains NOT_RUN
F25 includes User suspension, Organization suspension and Property/Unit lifecycle changes. Those are outside B5.

B5 closure, if later accepted, must state these statuses explicitly and must not infer canonical promotion from B5-specific AC success.

---

## 25. Concurrency boundaries not claimed

B5 guarantees the corrected Organization→Membership serialization protocol only for B5 product termination commands.

B5 does not claim universal serialization against:
- future role-mutation commands;
- future membership creation/reactivation;
- User security suspension;
- Organization suspension/archive;
- direct privileged/migration-owner maintenance;
- provider/IAM operations;
- Property lifecycle commands.

The deliberate User-security exception is important: B5 checks current User ACTIVE state when deciding whether another effective admin exists, but it does not claim to prevent an authorized security suspension from committing later and leaving zero effective admins. That outcome belongs to PF01's security-recovery rule, not voluntary B5 last-admin safety.

Future membership creation/role-transition commands that can affect last-admin invariants must adopt the same Organization-level serialization and compatible membership ID-order locking before compositional F39 safety can be claimed.

---

## 26. Implementation-plan constraints

A later implementation plan, if separately authorized, must:

1. derive exact paths/symbols from the then-current main;
2. preserve migrations 0001-0009 byte-for-byte;
3. use an additive B5 migration only;
4. prove B5 role preflight/final catalog and synthetic test-only role provisioning;
5. implement the corrected Organization→membership lock order;
6. put the membership union `ORDER BY id` at the actual locking-query level;
7. use `FOR NO KEY UPDATE` unless a later review proves stronger locking is required;
8. implement the capability-owned caller helper plus dedicated probe-owned effective-admin helper without public identity projection;
9. set transaction-local lock_timeout=2000ms, statement_timeout=5000ms and transaction_timeout=7000ms before the B5 function call;
10. map 55P03/57014/40P01/40001/23514/22003 and all unlisted database/driver failures to sanitized 503 with no automatic retry, except explicit B5 business results;
11. include strict RED→GREEN tests for AC01-AC19;
12. include distinct-backend `pg_blocking_pids`/activity evidence for all AC07 variants;
13. include owner-role behavioral RLS/privilege negatives, not catalog snapshots only;
14. include B4 PUT × B5 commit-order evidence;
15. include authenticated Web/API/PostgreSQL transport/revocation evidence;
16. predeclare only the bounded exact-inventory test changes required for B5 additions;
17. keep all test identities/data synthetic;
18. preserve current CI without weakening Doctor/timeouts/Jest/workflows;
19. make no dependency/lockfile/provider/IAM change unless separately authorized;
20. keep F15/F25/F39 NOT_RUN unless separately promoted by complete canonical evidence;
21. stop before Ready/merge until fixed-head independent implementation review.

No implementation plan is authorized by this document.

---

## 27. Security / privacy review boundary

B5 deliberately avoids new personal-data projection.

No new field for:
- name;
- email;
- phone;
- avatar;
- provider subject;
- external identity;
- contact route;

is needed.

The exact target is a membership UUID known to the caller/test. B5 returns no member DTO.

This keeps the B5 privacy surface smaller than a roster/onboarding slice.

Security/privacy remains incomplete overall. B5 is not a production-readiness certification.

---

## 28. Retained project risks

B5 design does not close:
- B4I-L01 / B4R-L01;
- B4D-L01..L04;
- B3D-L01/L02;
- B3 AC04 PostgreSQL-layer 513-code-point rejection NOT_RUN;
- historical Local Mobile FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED;
- dependency-security backlog;
- CI supply-chain backlog;
- Auth0/live-provider limitations;
- session/retention operational limits;
- incomplete privacy/security work;
- production hosting/credential work;
- real-data authorization.

REAL_TENANT_DATA = NOT_AUTHORIZED.
PRODUCTION_DB_HOSTING = NOT_AUTHORIZED.

---

## 29. Design-review questions for delta review

Independent delta review must specifically challenge:

1. Does current-org-only membership SELECT RLS now permit the real ACTIVE→ENDED UPDATE while preserving public non-disclosure?
2. Are all B5 ceilings correctly RESTRICTIVE given the existing PUBLIC permissive org-scope policies?
3. Is UPDATE(id)-only Organization privilege acceptably contained by RLS/FK and fixed function code?
4. Does Organization-level `FOR NO KEY UPDATE` align with PF01 last-admin serialization without unnecessary B4 blocking?
5. Does the one-query admin∪target lock use actual top-level `ORDER BY id ... FOR NO KEY UPDATE`?
6. Can any two B5 variants in AC07 deadlock?
7. Is "effective admin" correctly defined as ACTIVE membership + ACTIVE app_user, and can the dedicated probe owner actually observe the positive cross-user case under frozen B1/B2 policies?
8. Can a security suspension race still create an outcome incorrectly attributed to voluntary B5?
9. Are post-wait 404-vs-403 classifications consistent with B3/B4?
10. Are lock/statement/transaction timeout values and default-unlisted-error mapping sufficient to protect the max-5 Web pool, including a stall after function return but before COMMIT?
11. Are 23514/22003 safely mapped without raw leak or partial mutation?
12. Does FOR NO KEY UPDATE leave the acknowledged B4 PUT race authority-safe?
13. Are command-owner and probe-owner behavioral negatives/positive helper cases sufficient to prove least privilege?
14. Are frozen capability inventory updates bounded rather than weakened?
15. Are F15/F25/F39 correctly left NOT_RUN?
16. Does the design still avoid any role mutation, roster, onboarding, PF02-C or provider scope?
17. Does canonical status reconciliation remain a separately authorized publication step?

---

## 30. Review finding disposition / handoff state

First independent review at `ca53af17d084cbf159a8b707e403de6d057fd003`: CHANGES_REQUIRED, B0/H1/M3/L5.

First delta review at `b9c69dfeb27bdf100658dff23faf2a9b0943da0a`: CHANGES_REQUIRED, B0/H1/M0/L3. Eight of the nine prior findings were RESOLVED. B5D-M02 was PARTIALLY_RESOLVED because the effective-admin definition was correct but its capability-owner helper could not see other administrators through frozen B1/B2 RLS.

Revision 0.3 dispositions the delta-review findings:

- **B5D2-H01 — FIXED IN DESIGN:** move the cross-user effective-admin read to a separate NOLOGIN `bm_b5_effective_admin_probe_owner`; do not alter frozen `b1_member_*` policies; add current-org ACTIVE-ORG_ADMIN RESTRICTIVE probe policy; grant only membership id/org/user_id/role/status and app_user id/status reads; helper is probe-owned and returns boolean to command owner only; add positive/negative real-role AC evidence.
- **B5D2-L01 — FIXED IN DESIGN:** add transaction_timeout=7000ms, default all unlisted DB/driver errors to sanitized 503, and forbid catch-all exception swallowing/retry in B5 routines.
- **B5D2-L02 — ACCEPTED_LOW_RESIDUAL:** document the limited self-termination 409 inference about whether another effective administrator exists.
- **B5D2-L03 — FIXED IN DESIGN:** align approved-scope wording to effective-administrator terminology and distinguish frozen-helper reuse from B5-specific helper additions.

Prior findings remain dispositioned:
- B5D-H01 = RESOLVED
- B5D-M01 = RESOLVED
- B5D-M02 = superseded by B5D2-H01 correction above
- B5D-M03 = RESOLVED
- B5D-L01..L05 = RESOLVED

Current authority:
- PASS: operator-approved functional scope unchanged;
- COMPLETE: two independent design review generations received;
- CURRENT: revision 0.3 second-correction candidate awaits fresh independent delta review;
- NOT_APPROVED: written design/spec;
- NOT_AUTHORIZED: implementation plan;
- NOT_AUTHORIZED: product implementation;
- NOT_AUTHORIZED: Ready/merge.

**NEXT_GATE = FRESH_CLAUDE_OPUS_B5_DESIGN_SECOND_DELTA_REVIEW** after the corrected exact HEAD receives fresh candidate CI.

Do not implement or publish B5 until the fresh second delta review is accepted and the operator separately approves the written design.

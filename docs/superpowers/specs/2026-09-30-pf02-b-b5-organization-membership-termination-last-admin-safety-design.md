# PF02-B / B5 — Organization Membership Termination & Last-Admin Safety Foundation

## 1. Status / authority

Date: **2026-09-30**. Revision: **0.1**.

**SCOPE_APPROVED; WRITTEN_SPEC_CANDIDATE; ARCHITECTURE_PROPOSED; INDEPENDENT_REVIEW_NOT_RUN; DESIGN_NOT_APPROVED; IMPLEMENTATION_PLAN_NOT_AUTHORIZED; PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED.**

Repository: `edward321416-maker/build-manager`.

`POLICY_REF = TARGET_REF = main@cfb7a34828c63933c0e9f12b45fa578cfd127cca`.

This document records the operator-approved B5 scope and a proposed architecture for independent review. It is a **design/specification candidate only**. It does **not** authorize an implementation plan, product code, SQL migration, tests, dependency changes, provider/IAM changes, production hosting, real data, Ready conversion, or merge.

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
- CURRENT ADDITIONAL PRODUCT TASK before this scope decision = NONE_AUTHORIZED.
- B5 scope is now operator-approved; only design/spec drafting is authorized.
- REAL_TENANT_DATA = NOT_AUTHORIZED.
- PRODUCTION_DB_HOSTING = NOT_AUTHORIZED.

Authority sources: [AGENTS](../../../AGENTS.md), [AI delivery rules](../../../governance/ai_delivery_rules.md), [project policy](../../../governance/project_policy.md), [STATUS](../../../STATUS.md), [manifest](../../../ops/CHAT_CONTEXT_MANIFEST.json), [handoff](../../../ops/CHAT_HANDOFF.md), [PF01 authorization model](../../production-foundation/PF01_data_authorization.md), [acceptance cases](../../production-foundation/acceptance_cases.json), [B4 closure](../../../ops/pf02_b_b4_closure.md), frozen B1-B4 design/implementation receipts, and the operator's explicit B5 scope approval.

Historical B1-B4 receipts remain immutable snapshots. Nothing in B5 reopens their frozen contracts.

---

## 2. Operator-approved slice

The next PF02-B slice is:

> **B5 — Organization Membership Termination & Last-Admin Safety Foundation**

The approved scope is intentionally narrower than a general staff-management lifecycle.

B5 may:
- terminate one already-existing ACTIVE `OrganizationMembership`;
- target either `PROPERTY_STAFF` or `ORG_ADMIN`;
- require a current same-org ACTIVE `ORG_ADMIN` caller;
- allow an admin to terminate their own membership only when another ACTIVE admin remains;
- preserve historical membership rows;
- prove concurrent B5 termination requests cannot leave an organization with zero ACTIVE admins;
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
6. prevent a B5 command from leaving the organization with zero ACTIVE `ORG_ADMIN` memberships;
7. serialize concurrent B5 admin-termination decisions for the same organization;
8. preserve all existing B1-B4 authorization semantics;
9. leave PropertyAssignment history untouched;
10. expose no User identity/profile/email/provider data;
11. fail closed if current authority or target eligibility changes;
12. keep canonical F15/F25/F39 statuses unchanged unless their complete acceptance semantics are later evidenced.

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

B5 reuses these frozen helpers. It does not rewrite them.

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
| B. Reuse `bm_b1_capability_owner` | **Rejected.** That NOLOGIN role is the frozen B1/B2/B3 read/capability owner. Business mutation rights would enlarge its trust boundary. |
| C. Reuse `bm_b4_assignment_owner` | **Rejected.** B4 ownership is intentionally assignment-specific. Membership mutation and assignment mutation must remain separate authorities. |
| D. Use migration/table owner SECURITY DEFINER | **Rejected.** The migration owner has substantially broader authority than B5 needs. |
| E. New LOGIN role / pool / credential | **Rejected.** Adds hosting/IAM/credential lifecycle for no product need. |
| **F. Dedicated NOLOGIN B5 command owner + SECURITY DEFINER + Web EXECUTE-only** | **Selected architecture candidate.** Narrowly isolates membership termination without raw Web UPDATE or a new credential. |

Proposed internal role:

`bm_b5_membership_owner`

Required attributes:

`NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`

This role is not a credential and is never a product login role.

### 7.2 Last-admin concurrency

| Alternative | Decision |
| --- | --- |
| App-layer count then UPDATE | **Rejected.** Two concurrent transactions can both observe two admins and both terminate, leaving zero. |
| Table-wide lock on membership table | **Rejected.** Correct but unnecessarily broad and harmful to unrelated organizations. |
| Transaction advisory lock derived from org id | **Rejected.** Cooperative/hash-namespace locking introduces a second lock authority and collision/discipline concerns not needed for rows that already represent the invariant. |
| Organization-row `FOR UPDATE` | **Not selected.** It would require mutation-level privilege on the organization relation solely to use a row lock and couples B5 to a parent row that B5 never changes. |
| **Deterministic `FOR UPDATE` locking of the organization's current ACTIVE admin membership rows, then the target row** | **Selected architecture candidate.** Locks exactly the rows whose cardinality defines the invariant and uses the same membership relation B5 already updates. |

PostgreSQL 18 reference behavior used by this design:
- `SELECT ... FOR UPDATE` locks selected rows against concurrent updates;
- locking clauses require SELECT plus UPDATE privilege on at least one selected table column;
- consistency-sensitive transactions should acquire locks in a consistent order;
- READ COMMITTED waits on conflicting row updates and proceeds against the current committed row version after the wait.

References:
- https://www.postgresql.org/docs/18/sql-select.html
- https://www.postgresql.org/docs/18/applevel-consistency.html
- https://www.postgresql.org/docs/18/sql-update.html
- https://www.postgresql.org/docs/18/ddl-rowsecurity.html

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

A target that is:
- absent;
- foreign;
- already ENDED;

returns the same non-disclosing 404.

A repeated DELETE after a successful prior termination therefore has no additional effect but may return 404. HTTP effect remains idempotent; B5 does not create a historical membership-discovery API to make repeated response codes identical.

### 8.3 Last admin

If the target is an ACTIVE `ORG_ADMIN` and terminating it would leave zero ACTIVE admins:

- no row is changed;
- HTTP 409;
- public error `CONFLICT`;
- no admin count, target role, user identity, or raw constraint detail is exposed.

---

## 9. Request and transport contract

The B5 DELETE accepts:
- path `orgId`;
- path `membershipId`;
- no query parameters;
- no business body.

It must reject any attempt to supply:
- role;
- userId;
- status;
- version;
- endedAt;
- caller identity;
- authority flags;
- replacement membership;
- assignment data.

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

The public error body stays flat: `{"error":"CODE"}`.

For recognized-but-disallowed HTTP methods, the B5 route owns a narrow 405 with `Allow: DELETE`. Framework-owned unknown-method behavior outside the Next.js route contract remains framework-owned, following the B4 boundary; the implementation plan must use a Fetch-allowed diagnostic method such as PROPFIND rather than invent a TRACE contract.

All B5 responses use private/no-store cache behavior and preserve the existing Cookie cache dimension.

---

## 10. Visibility and authorization precedence

### 10.1 Organization context

The outer Web transaction may reuse the frozen B1 organization-context establishment:
- current session/actor;
- current organization context via `authorize_org`;
- transaction-local `app.org_id` and session digest.

This means:
- current admin can enter context;
- current staff can enter context but is not thereby authorized to terminate membership;
- foreign/inactive/hidden organization remains 404.

### 10.2 Admin action authority

Inside the B5 command boundary:
- current `authn.can_administer_org(p_digest,p_org)` must be true before locking work proceeds;
- it must be re-evaluated after B5 admin locks are acquired and again at the decisive mutation predicate.

An application-layer precheck may improve error classification but is never the decisive authority.

A PROPERTY_STAFF caller in an otherwise visible organization receives 403 and cannot lock/mutate membership rows through the B5 product path.

### 10.3 Target eligibility

The target must be:
- exact `membershipId`;
- same `orgId`;
- status ACTIVE;
- role currently `ORG_ADMIN` or `PROPERTY_STAFF`.

B5 returns no target `user_id`, role, version, timestamps, identity or profile data to the caller.

---

## 11. Additive migration boundary

The first available migration number after frozen B4 is currently 0010.

Proposed filename:

`packages/persistence-postgres/migrations/0010_b5_membership_termination.sql`

Existing migrations 0001-0009 remain byte-frozen.

The B5 migration may:
1. preflight `bm_b5_membership_owner` attributes and role membership;
2. grant minimum schema/function/table/column privileges;
3. create role-scoped B5 RLS policies;
4. create B5 SECURITY DEFINER command routine(s);
5. revoke PUBLIC EXECUTE;
6. grant only exact B5 EXECUTE to `bm_b1_web`;
7. grant the B5 owner only the frozen helper EXECUTE it needs;
8. revoke any temporary CREATE authority before commit;
9. verify no new raw Web membership UPDATE/SELECT surface;
10. verify no unintended role membership/inheritance remains.

The migration may **not**:
- add a new business table;
- add a new membership column;
- modify old migrations;
- create a LOGIN role;
- provision a credential;
- change provider/IAM;
- change B1/B2/B3/B4 helper bodies;
- change PropertyAssignment schema.

---

## 12. Least-privilege table surface

### 12.1 organization_membership

Proposed maximum B5-owner raw columns:

SELECT:
- `id`;
- `org_id`;
- `role`;
- `status`;
- `version`.

B5 needs no raw SELECT of `ended_at`: the SELECT/RLS surface is restricted to ACTIVE memberships, for which the frozen status/time CHECK already requires `ended_at IS NULL`.

UPDATE:
- `status`;
- `version`;
- `ended_at`.

Explicitly no B5-owner SELECT on:
- `user_id`;
- external identity tables;
- issuer/subject;
- email/profile data.

Explicitly no B5-owner INSERT or DELETE on `organization_membership`.

Because locking clauses require update privilege, the owner already has the minimum UPDATE privilege needed for `SELECT ... FOR UPDATE`; B5 does not grant extra dummy mutation rights solely for locking.

### 12.2 organization

B5 should not require raw mutation privilege on `app.organization`.

Current organization ACTIVE/admin authority is consumed through frozen capability helpers.

### 12.3 property_assignment

B5 receives **no** new B5-owner raw privilege on `app.property_assignment`.

Membership termination revokes current authority through the frozen B2/B4 predicates. Assignment history stays untouched.

---

## 13. B5 RLS intent

The dedicated B5 owner is neither a table owner nor BYPASSRLS. FORCE RLS remains effective.

B5 may add role-scoped policies only for `bm_b5_membership_owner`.

Design intent:

### SELECT policy
- current org only;
- status ACTIVE only;
- enough visibility to lock current ACTIVE admin rows and the exact ACTIVE target;
- ENDED membership history is not raw-visible to the B5 owner;
- no PUBLIC or `bm_b1_web` raw expansion.

### UPDATE policy
USING:
- current org only;
- existing row status ACTIVE.

WITH CHECK:
- same current org;
- resulting status ENDED;
- resulting `ended_at` non-null;
- role/org/user/id remain unchanged structurally because the owner lacks UPDATE privilege on those columns.

The frozen membership status/time CHECK remains final shape authority.

The exact permissive/restrictive split is implementation-plan detail, but final catalog evidence must prove:
- Web still has no raw membership UPDATE;
- B1 capability owner gained no mutation authority;
- B4 owner gained no membership mutation authority;
- PF02-A runtime gained no membership mutation authority;
- missing org context yields zero B5 row visibility/mutation.

---

## 14. SECURITY DEFINER command boundary

Proposed internal function:

`authn.b5_end_organization_membership(p_digest bytea,p_org uuid,p_membership uuid) RETURNS text`

Exact signature/result vocabulary freezes only after written design approval and implementation-plan review.

Required function properties:
- owner = `bm_b5_membership_owner`;
- `SECURITY DEFINER`;
- exact secure search path `pg_catalog, pg_temp`;
- all app/authn objects schema-qualified;
- no dynamic SQL;
- PUBLIC EXECUTE revoked;
- Web receives only EXECUTE;
- no identity/profile return;
- no raw DB errors to public HTTP;
- no internal retry of an unknown commit outcome.

Possible internal result vocabulary:
- `ENDED`;
- `NOT_FOUND`;
- `FORBIDDEN`;
- `LAST_ADMIN`.

The result vocabulary is internal and must not become a richer public member DTO.

---

## 15. Last-admin algorithm

The command must acquire locks in one consistent order for every B5 request in an organization.

Proposed order:

1. fast current-admin capability check;
2. lock all current ACTIVE `ORG_ADMIN` membership rows in the target organization in deterministic `id` order using `FOR UPDATE`;
3. re-evaluate current caller admin authority after the lock wait;
4. lock/read the exact target membership if it was not already one of the locked admin rows;
5. classify target ACTIVE/role state;
6. if target role is ORG_ADMIN, compute active-admin count from the locked current rows;
7. if count <= 1, return `LAST_ADMIN` with no mutation;
8. execute one guarded ACTIVE→ENDED UPDATE that also rechecks current admin authority;
9. increment version and set database-owned ended_at;
10. return ENDED only if exactly one row changed.

All B5 requests use the same admin-lock-first order, so two concurrent admin termination requests for the same org serialize instead of each acting on a stale count.

### 15.1 Two-admin concurrent self-termination

Initial state:

- Admin A ACTIVE
- Admin B ACTIVE

Two independent transactions issue B5 DELETE concurrently.

Required observable result:
- one command may succeed;
- the other waits on the same admin rows;
- after wake-up it observes current committed membership state;
- the remaining admin cannot be terminated by B5;
- final ACTIVE admin count >= 1.

The test must use distinct PostgreSQL backends and explicit lock observation/barriers. Sequential commands are not concurrency evidence.

### 15.2 Staff termination

Terminating a PROPERTY_STAFF membership still follows the common admin-lock-first order. This intentionally serializes B5 termination commands within an organization. The expected operator scale is small, and correctness is preferred over introducing separate lock protocols in this foundation.

The design makes no throughput/SLA claim.

---

## 16. Transaction/isolation contract

B5 reuses the existing authenticated organization transaction boundary and READ COMMITTED unless a later independently reviewed implementation plan proves a narrower change is necessary.

B5 does not switch the whole application to SERIALIZABLE.

The command must be one database transaction.

Required properties:
- lock wait is part of the command;
- last-admin decision is made only after acquiring the B5 admin row locks;
- target state is not accepted from an earlier application read;
- no client-side count decides the invariant;
- no automatic retry after an ambiguous COMMIT outcome.

If COMMIT outcome is unknown:
- return sanitized dependency failure;
- do not issue a second termination command automatically;
- future current-state product surfaces may reconcile state, but B5 does not add a roster/detail API merely for reconciliation.

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

Required B5 regression evidence must prove this without changing B4 code.

B5 does not claim that all future membership creation/role-transition commands use the same locks. Such future commands must explicitly adopt a compatible invariant/lock order before F39 can be fully promoted.

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
A current same-org ACTIVE ORG_ADMIN can terminate an eligible ACTIVE target. Current PROPERTY_STAFF cannot.

### AC03 — Hidden target non-disclosure
Foreign, missing or already ENDED target returns the same 404 and mutates nothing.

### AC04 — Staff termination
ACTIVE PROPERTY_STAFF transitions to ENDED, sets DB-owned ended_at, increments version exactly once, retains id/org/user/role/created_at.

### AC05 — Admin termination
An ACTIVE ORG_ADMIN may terminate another/current admin membership only when at least one other ACTIVE admin remains.

### AC06 — Last-admin denial
The sole ACTIVE ORG_ADMIN cannot be terminated through B5; returns sanitized 409 CONFLICT; row bytes/version remain unchanged.

### AC07 — Concurrent last-admin safety
With two ACTIVE admins and two distinct database backends issuing concurrent terminations, explicit lock evidence proves final ACTIVE admin count >= 1. No repeat-until-green or sequential substitute.

### AC08 — Current authority race
If caller admin authority is removed before the decisive mutation snapshot, the B5 command fails without changing target state.

### AC09 — Target race
If target membership becomes ENDED before the decisive mutation, B5 does not rewrite it or increment version again.

### AC10 — Assignment preservation
Ending a PROPERTY_STAFF membership leaves PropertyAssignment history unchanged while frozen B2/B4 current authorization denies through the ended membership.

### AC11 — Multi-org isolation
Ending one membership changes no membership, assignment or authority in another organization.

### AC12 — Session separation
The same authenticated User may retain unrelated organization access; B5 does not globally revoke identity/session.

### AC13 — Transport boundaries
Method/Origin/session/CSRF/query/path/body-size precedence produces fixed sanitized errors and zero mutation on failure.

### AC14 — DB privilege / RLS boundary
Catalog evidence proves:
- dedicated NOLOGIN B5 owner;
- no raw Web membership UPDATE;
- exact owner SELECT/UPDATE column ceiling;
- no INSERT/DELETE membership privilege;
- secure SECURITY DEFINER ownership/search_path/ACL;
- no B1/B2/B3/B4 privilege widening.

### AC15 — Frozen regression
B1/B2/B3/B4 and current PostgreSQL/Web/Mobile repository gates remain green; no existing frozen migration changes.

---

## 24. Canonical F-case relationship

B5 does **not** automatically promote F15, F25 or F39.

### F15 — remains NOT_RUN
F15 requires the later ticket read/reply surface. B5 may provide prerequisite evidence that membership termination immediately removes current B1-B4 organization/property/admin authority, but it cannot prove ticket behavior before PF02-D exists.

### F39 — remains NOT_RUN
F39 includes concurrent voluntary leave/**demotion** and the distinction from security account suspension. B5 only covers concurrent membership termination. It can provide prerequisite last-admin evidence but not full F39 semantics.

### F25 — remains NOT_RUN
F25 includes User suspension, Organization suspension and Property/Unit lifecycle changes. Those are outside B5.

B5 closure, if later accepted, must state these statuses explicitly and must not infer canonical promotion from B5-specific AC success.

---

## 25. Concurrency boundaries not claimed

B5 does not claim universal serialization against:
- future role-mutation commands;
- future membership creation/reactivation;
- User suspension;
- Organization suspension/archive;
- direct privileged/migration-owner maintenance;
- future provider/IAM operations;
- Property lifecycle commands.

B5 only guarantees the invariant among B5 product termination commands using the approved lock order, plus decisive current-state rechecks against frozen helpers.

Future membership creation/role-transition slices must adopt compatible last-admin/invariant locking before they can claim compositional safety.

---

## 26. Implementation-plan constraints

A later implementation plan, if separately authorized, must:

1. derive exact paths/symbols from the then-current main;
2. preserve migrations 0001-0009 byte-for-byte;
3. use an additive B5 migration only;
4. prove the B5 role preflight and final catalog;
5. include strict RED→GREEN tests for every AC;
6. include actual distinct-backend PostgreSQL concurrency barriers for AC07;
7. include B4 assignment-history byte/snapshot regression for AC10;
8. include authenticated Web/API/PostgreSQL evidence for transport and revocation;
9. keep all test identities/data synthetic;
10. preserve current required CI without weakening Doctor/timeouts/test configs;
11. make no dependency/lockfile/provider/IAM change unless separately authorized;
12. keep F15/F25/F39 statuses unchanged unless a separate canonical evidence decision is made;
13. stop before Ready/merge until fixed-head independent implementation review.

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

## 29. Design-review questions

Independent review must specifically challenge:

1. Is B5 correctly separated from role mutation and staff discovery?
2. Does the proposed active-admin row lock order actually prevent zero-admin outcomes under READ COMMITTED?
3. Can any two B5 commands deadlock because lock order differs?
4. Does the B5 owner receive more raw membership authority than necessary?
5. Can Web or B4/B1 capability roles obtain membership UPDATE by role membership or grant leakage?
6. Does any RLS policy accidentally broaden current raw membership visibility?
7. Is caller authority rechecked after lock wait and at the decisive mutation?
8. Can target state change after classification but before UPDATE?
9. Does self-termination behave correctly with one vs two admins?
10. Does version/ended_at mutate exactly once?
11. Are PropertyAssignment rows untouched?
12. Does B5 accidentally disclose historical membership existence?
13. Is the 409 last-admin response acceptably non-sensitive?
14. Are F15/F25/F39 correctly left NOT_RUN?
15. Does the command remain useful as a foundation despite no roster/UI?
16. Does the design avoid claiming universal cross-lifecycle serialization?

---

## 30. Self-audit / handoff state

Scope:
- PASS: membership termination only;
- PASS: last-admin safety included;
- PASS: concurrent B5 termination included;
- PASS: role mutation excluded;
- PASS: roster/search/profile excluded;
- PASS: invitation/onboarding excluded;
- PASS: assignments untouched;
- PASS: PF02-C/F43 excluded.

Data/privacy:
- PASS: no new PII field;
- PASS: no user/profile DTO;
- PASS: no real data.

Frozen boundaries:
- PASS: B1-B4 helpers are reused, not rewritten;
- PASS: no old migration modification authorized;
- PASS: no existing F-case status changed.

Authorization:
- PASS: scope approved;
- NOT_RUN: independent written-design review;
- NOT_APPROVED: written design/spec;
- NOT_AUTHORIZED: implementation plan;
- NOT_AUTHORIZED: product implementation;
- NOT_AUTHORIZED: Ready/merge.

**NEXT_GATE = FRESH_CLAUDE_OPUS_B5_DESIGN_REVIEW** after this exact design candidate is published to a Draft PR and fixed-head CI/readback is available.

Do not implement B5 from this candidate until the written design is independently reviewed, findings are dispositioned, and the operator separately approves the design.

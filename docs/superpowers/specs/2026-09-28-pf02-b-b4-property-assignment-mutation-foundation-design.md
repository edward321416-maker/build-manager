# PF02-B / B4 — Property Assignment Mutation Foundation

## 1. Status / authority

Date: **2026-09-28**. Revision: **0.1**.

**SCOPE_APPROVED; ARCHITECTURE_APPROVED_IN_CONVERSATION; WRITTEN_SPEC_AWAITS_OPERATOR_REVIEW; IMPLEMENTATION_PLAN_NOT_AUTHORIZED; PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED.**

Repository: `edward321416-maker/build-manager`.

`POLICY_REF = TARGET_REF = main@e759e6261482d130d89aabfcb174f72b0ae6a1a3`.

This document records the operator-approved B4 scope and architecture after a full scope and architecture audit. It is a design/specification only. It does **not** authorize an implementation plan, product code, SQL migration execution, test changes, provider/IAM work, production hosting, real data, or merge to `main`.

Canonical baseline at TARGET_REF:
- PF00 = FROZEN.
- PF02-A = VERIFIED / FROZEN.
- PF02-B = IN_PROGRESS.
- PF02-B/B1, B2, B3 = VERIFIED / FROZEN.
- F01 = PASS_POSTGRES_INTEGRATION.
- F43 = NOT_RUN.
- GitHub main still has no canonical B4 product task because the B4 scope/design decision is currently in the rolling development handoff.
- REAL_TENANT_DATA = NOT_AUTHORIZED.
- PRODUCTION_DB_HOSTING = NOT_AUTHORIZED.

Authority sources: [AGENTS](../../../AGENTS.md), [AI delivery rules](../../../governance/ai_delivery_rules.md), [project policy](../../../governance/project_policy.md), [STATUS](../../../STATUS.md), [manifest](../../../ops/CHAT_CONTEXT_MANIFEST.json), [handoff](../../../ops/CHAT_HANDOFF.md), [B3 closure](../../../ops/pf02_b_b3_closure.md), the frozen B2/B3 design history, and the operator's explicit B4 scope/architecture approval.

Historical B1/B2/B3 receipts remain immutable snapshots. Nothing in this spec reopens their frozen contracts.

## 2. Operator-approved decision

The next PF02-B slice is:

> **B4 — Property Assignment Mutation Foundation**

B4 is deliberately **not** a staff-management product surface. It adds the authenticated database/API foundation for an ORG_ADMIN to make an already-existing ACTIVE PROPERTY_STAFF membership currently assigned, or no longer assigned, to one ACTIVE Property.

The original broader “Staff Assignment Lifecycle Foundation” proposal was rejected during scope audit because the current product has no staff roster, human-readable staff identity, staff search, onboarding, or management UI. Exposing raw UUID selection as a human-facing flow would be a false product surface. B4 therefore stops at an exact relationship API/DB boundary.

The approved architecture is:
1. exact composite relationship resource, not assignment-row identity;
2. `GET / PUT / DELETE`, with PUT and DELETE idempotent at the relationship-state level;
3. no collection/list/search endpoint and no B4 management UI;
4. a dedicated internal NOLOGIN assignment-command owner;
5. SECURITY DEFINER routines owned by that role;
6. `bm_b1_web` receives EXECUTE only for B4 routines and **no raw PropertyAssignment SELECT/INSERT/UPDATE/DELETE**;
7. frozen B2 property-read authorization remains the effective staff access rule;
8. frozen B3 `authn.can_administer_org` and B2 `authn.can_read_property` are reused, not rewritten.

## 3. Goal

For a caller with a current authenticated session and current ACTIVE ORG_ADMIN membership in an ACTIVE organization:

- inspect whether one exact ACTIVE PROPERTY_STAFF membership is currently assigned to one exact ACTIVE Property;
- ensure that relationship is ACTIVE;
- end that relationship while preserving its historical row;
- preserve same-org, current-role, current-status and current-Property authority at the server/DB boundary;
- make repeated PUT/DELETE converge instead of creating duplicate ACTIVE relationships or deleting history;
- ensure the frozen B2 reader immediately consumes the resulting assignment state without a second authorization model.

B4 is complete only when the exact authenticated Web API and real PostgreSQL path prove the relationship-state behavior and hostile direct requests cannot bypass it.

## 4. Approved scope

### 4.1 Allowed behavior

- Caller: current ACTIVE ORG_ADMIN only.
- Target organization: caller's current ACTIVE organization.
- Target property: same-org ACTIVE Property.
- Target staff membership: same-org ACTIVE `PROPERTY_STAFF` organization_membership row.
- Relationship table: existing `app.property_assignment`.
- Operations: exact current-state read, ensure ACTIVE assignment, end ACTIVE assignment.
- History: ENDED rows are retained. A later new assignment creates a new ACTIVE row; an ENDED row is never reactivated.
- Synthetic identities/data only for tests and validation.

### 4.2 Exact relationship resource

The B4 HTTP resource is:

```text
/api/v2/organizations/:orgId/properties/:propertyId/staff-assignments/:membershipId
```

It represents the **current relationship** between a Property and a PROPERTY_STAFF membership. It does not expose the underlying PropertyAssignment row id.

Supported methods:

| Method | Meaning | Success |
| --- | --- | --- |
| GET | Is this exact eligible relationship currently ACTIVE? | 200 with strict `{"assigned": true}`; absent/ineligible is non-disclosing 404 |
| PUT | Ensure this exact eligible relationship is ACTIVE | 201 when a new ACTIVE history row is created; 200 when it was already ACTIVE |
| DELETE | Ensure this exact eligible relationship is not ACTIVE | 204 whether one ACTIVE row was ended or no ACTIVE row existed for an otherwise eligible target |

No collection endpoint is introduced in B4.

### 4.3 Request shape

- Path ids only: `orgId`, `propertyId`, `membershipId`.
- PUT and DELETE accept **no business body**.
- Query parameters are rejected.
- Any client-supplied role, userId, orgId, assignmentId, status, timestamps or authority flag is rejected or structurally impossible.
- Mutating requests reuse the existing authenticated cookie session, exact configured Origin check and session-bound CSRF requirement.
- GET remains no-store/private and does not require CSRF.

A future implementation plan must define an actual-byte bounded empty-body reader so a non-empty or oversized request cannot become an unbounded body sink. This design does not authorize a new business body format.

## 5. Explicit non-goals

B4 does **not** add, infer or prepare:

- staff roster/list/search;
- human-readable staff identity, profile, name or email projection;
- staff onboarding or invitation;
- staff account creation;
- organization_membership creation, role mutation, end API, reactivation or last-admin workflow;
- PropertyAssignment collection/list API;
- assignment management Web UI;
- Occupancy start/end, OccupancyMember, resident invitation or resident end-user flow;
- MaintenanceTicket, TicketMessage, AI intake/triage;
- F43 address/reference search;
- Property/Unit update/delete/archive;
- Mobile authentication;
- Kakao login or account linking;
- Auth0/provider changes;
- production DB hosting or credentials;
- external IAM changes;
- real tenant, landlord or address data;
- billing;
- complete security/privacy certification;
- CommandReceipt or general command framework;
- automatic canonical F-case promotion.

Occupancy / Resident Invitation remains **PF02-C**, not a B4 subtask.

## 6. Existing main facts at TARGET_REF

### 6.1 Data model

`app.property_assignment` already exists from frozen B2 with:
- `id uuid` primary key;
- `org_id`;
- `membership_id`;
- `property_id`;
- `status ACTIVE | ENDED`;
- `created_at`;
- nullable `ended_at`;
- composite same-org membership/property foreign keys;
- status/time CHECK;
- partial unique index `property_assignment_one_active_membership_property` on `(org_id,membership_id,property_id) WHERE status='ACTIVE'`.

The table already expresses exactly the current/history relationship needed by B4. **No new business table, column, version, copied role, copied identity field or soft-delete field is needed.**

### 6.2 Frozen B2 read authority

B2 currently defines:
- organization context for ACTIVE ORG_ADMIN / PROPERTY_STAFF;
- `authn.can_read_property`:
  - ORG_ADMIN can read ACTIVE same-org Properties;
  - PROPERTY_STAFF can read only ACTIVE Properties with a matching current ACTIVE PropertyAssignment tied to that current ACTIVE PROPERTY_STAFF membership;
- zero-assignment staff sees organization context and an empty Property list;
- ended membership / ended assignment / inactive Property does not confer current read authority.

B4 must mutate the relationship consumed by this frozen predicate. It must **not** add a second staff-property authorization path.

### 6.3 Frozen B3 admin authority

B3 already defines `authn.can_administer_org(bytea,uuid)` as the narrow current ORG_ADMIN capability used by the authenticated Web runtime. B4 reuses it.

B4 does not broaden:
- `authn.authorize_org`;
- `authn.can_read_org`;
- `authn.can_read_property`;
- B1/B2/B3 response DTOs;
- B3 Property/Unit mutation authority.

### 6.4 Missing product surfaces are intentional

At TARGET_REF there is no staff/member roster API, raw assignment API, staff profile DTO, human-readable app_user name, email-based membership selector, assignment mutation port or assignment management UI.

B4 therefore cannot pretend to be a complete human-facing staff-management workflow.

## 7. Architecture alternatives

| Alternative | Decision |
| --- | --- |
| A. Direct `bm_b1_web` SELECT/INSERT/UPDATE on PropertyAssignment with RLS | **Rejected.** UPDATE and nontrivial conflict handling require SELECT privileges on referenced columns. This broadens the raw assignment surface that B2 intentionally hides from the Web runtime and couples mutation correctness to existing staff-only SELECT policy behavior. |
| B. Reuse `bm_b1_capability_owner` as mutation owner | **Rejected.** That frozen NOLOGIN role is the B1/B2/B3 read/capability owner. Adding business-row mutation rights widens its trust boundary. |
| C. Use broad migration/table owner SECURITY DEFINER commands | **Rejected.** The migrator owns substantially more DDL/data authority than B4 needs; making it the runtime definer increases blast radius. |
| D. New LOGIN B4 role / new pool / credential | **Rejected.** Adds production credential/pool lifecycle and hosting/IAM scope with no need for another connected runtime. |
| **E. Dedicated NOLOGIN assignment-command owner + SECURITY DEFINER + Web EXECUTE-only** | **Selected.** Isolates the exact mutation authority without a new credential, preserves frozen capability roles, and keeps raw assignment access out of `bm_b1_web`. |

PostgreSQL 18 basis:
- UPDATE requires UPDATE privilege and SELECT on any columns read by conditions/expressions.
- `ON CONFLICT` can infer a partial unique index using a matching index predicate.
- SECURITY DEFINER executes with the function owner's privileges and must use a secure search path with PUBLIC EXECUTE revoked.
- RLS remains a separate boundary from object privileges.

References:
- https://www.postgresql.org/docs/18/sql-update.html
- https://www.postgresql.org/docs/18/sql-insert.html
- https://www.postgresql.org/docs/18/sql-createfunction.html
- https://www.postgresql.org/docs/18/ddl-rowsecurity.html

## 8. Dedicated B4 command-owner role

Design name:

```text
bm_b4_assignment_owner
```

Required role attributes:

```text
NOLOGIN
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOREPLICATION
NOBYPASSRLS
NOINHERIT
```

This is an internal database object-ownership role, **not a credential** and not a production connection role.

B4 implementation must not create or provision a production credential. The future migration must preflight the role and fail closed if its contract is absent/wrong. Disposable test infrastructure may provision the synthetic NOLOGIN role and the existing migrator's non-inherited SET-only membership needed to create/own B4 functions. That test provisioning is not production IAM evidence.

`bm_b1_web`:
- must not become a member of `bm_b4_assignment_owner`;
- must not SET ROLE to it;
- receives only schema/function lookup required to EXECUTE B4 routines;
- receives no direct raw assignment table privilege.

The existing `bm_b1_capability_owner` remains a frozen capability role. B4 may grant its exact frozen helper functions to the B4 owner if required; no B4 row mutation grant is added to the capability owner.

## 9. Proposed additive migration boundary

B4 must use one additive migration after frozen `0008_b3_building_registration.sql`. Design filename:

```text
packages/persistence-postgres/migrations/0009_b4_property_assignment_mutation.sql
```

Existing migrations `0001`–`0008` remain byte-frozen.

The migration may:
1. preflight `bm_b4_assignment_owner` attributes and role membership: only the migration role may hold SET-only, non-inherited, non-admin membership needed for object creation/ownership; Web/login/PF02-A runtime/capability roles must not be members;
2. grant the owner the minimum schema/function/table/column privileges required by B4;
3. add role-scoped RLS policies needed for that owner;
4. create B4 SECURITY DEFINER routines under that owner;
5. revoke PUBLIC EXECUTE before commit;
6. grant only the exact B4 EXECUTE surface to `bm_b1_web`;
7. revoke temporary schema CREATE used during function ownership setup;
8. verify no new raw Web table privilege, role inheritance or unintended membership remains.

The migration may **not** create LOGIN credentials, modify external IAM, or change frozen role attributes.

## 10. Least-privilege surface

### 10.1 Target membership

The B4 owner needs only enough organization_membership visibility to answer:

> does `membershipId` identify a current same-org ACTIVE PROPERTY_STAFF membership?

Expected raw target columns:
- `id`
- `org_id`
- `role`
- `status`

No target `user_id`, email, issuer, subject or profile field is returned to the caller.

A B4 role-scoped restrictive SELECT ceiling must keep this target surface to current org, ACTIVE, role exactly PROPERTY_STAFF.

### 10.2 Caller / Property authority

B4 reuses:
- `authn.can_administer_org` for current ORG_ADMIN authority;
- `authn.can_read_property` for current same-org ACTIVE Property visibility.

B4 does not add raw Web membership/Property reads to duplicate those decisions.

The decisive B4 routine must re-evaluate these capabilities at its own mutation statement boundary. An application-layer precheck may improve error classification but cannot be decisive authorization.

### 10.3 Assignment table

The B4 owner receives only the columns required to detect an ACTIVE exact relation, insert a new ACTIVE history row and end an ACTIVE row.

Expected maximum raw column requirements:
- SELECT: `id, org_id, membership_id, property_id, status, ended_at`;
- INSERT: `id, org_id, membership_id, property_id, status`;
- UPDATE: `status, ended_at`;
- **no DELETE privilege**.

The exact final grant list is an implementation-plan verification item. A broader `ALL` grant is forbidden.

## 11. RLS model

The B4 command owner is neither a table owner nor BYPASSRLS, so FORCE RLS remains effective.

B4 adds only role-specific policies needed by the command owner.

Design intent:

1. organization_membership target ceiling:
   - current org only;
   - ACTIVE only;
   - PROPERTY_STAFF only.

2. property_assignment command scope:
   - current org only for SELECT / INSERT / UPDATE;
   - no physical DELETE;
   - WITH CHECK preserves org id;
   - table CHECK / FK / partial unique index remain final structural authorities.

The exact permissive/restrictive policy split is implementation-plan detail, but the final catalog must prove:
- no B4 policy is a PUBLIC expansion;
- no B4 policy expands `bm_b1_web` raw table visibility;
- no B4 policy changes `bm_pf02a_runtime`;
- no B4 policy changes B2 staff read semantics;
- missing/invalid current org context sees/mutates zero B4 rows.

## 12. SECURITY DEFINER boundary

Design function family:

```text
authn.b4_get_property_staff_assignment(...)
authn.b4_ensure_property_staff_assignment(...)
authn.b4_end_property_staff_assignment(...)
```

Exact signatures become frozen only after written-spec approval and implementation-plan validation.

Every B4 SECURITY DEFINER routine must:
- be owned by `bm_b4_assignment_owner`;
- set exactly `search_path = pg_catalog, pg_temp`;
- schema-qualify every `app` and `authn` object and avoid unqualified application objects;
- use only parameterized values; no dynamic SQL;
- revoke PUBLIC EXECUTE;
- grant EXECUTE only to the intended Web runtime;
- verify supplied digest/org against the established session/org context through frozen helpers;
- re-evaluate current ORG_ADMIN and Property authority;
- never return raw membership, assignment history, user identity or database error detail.

Internal fixed result vocabularies are allowed. They must not become broader public DTOs.

## 13. Relationship-state semantics

### 13.1 GET

Preconditions:
- authenticated visible organization context;
- current ORG_ADMIN authority;
- ACTIVE visible Property;
- exact same-org ACTIVE PROPERTY_STAFF target membership.

Results:
- ACTIVE exact assignment exists → 200 `{"assigned":true}`;
- eligible target but no ACTIVE assignment → 404;
- target membership foreign/ended/wrong-role/hidden → 404;
- Property foreign/inactive/hidden → 404;
- visible org but caller not current ORG_ADMIN → 403;
- unauthenticated → 401.

No assignment id/history is exposed.

### 13.2 PUT

PUT means **ensure current relationship ACTIVE**, not “insert a row every request”.

The decisive SQL must use the frozen partial unique index as the ACTIVE relationship arbiter.

Expected outcomes:
- no eligible ACTIVE relationship → create one new ACTIVE history row → 201 with `{"assigned":true}` and Location equal to the same composite resource;
- already ACTIVE → no duplicate row → 200 with `{"assigned":true}`;
- only ENDED history → create a new ACTIVE row → 201 with the same current-state body;
- target/property/caller authority is ineligible at the decisive statement snapshot → no creation and non-disclosing classification.

A valid implementation may use partial-index inference with `ON CONFLICT (org_id,membership_id,property_id) WHERE status='ACTIVE' DO NOTHING`. It must not reactivate an ENDED row.

### 13.3 DELETE

DELETE means **ensure current relationship not ACTIVE**.

Database behavior:
- matching ACTIVE row → UPDATE to `status='ENDED'` and DB-owned `ended_at`;
- no ACTIVE row for an otherwise eligible target → no-op;
- row/history retained;
- no physical DELETE;
- no ENDED→ACTIVE reuse.

Both ended/no-op eligible outcomes return 204.

### 13.4 History invariant

At most one ACTIVE row exists per `(org_id,membership_id,property_id)`, enforced by the frozen partial unique index.

Zero or more ENDED history rows may exist.

A later re-assignment creates a new row and does not rewrite prior `id`, `created_at` or `ended_at`.

## 14. Transaction and concurrency contract

B4 uses the existing authenticated organization transaction boundary and READ COMMITTED unless a later approved plan proves a narrower change is necessary.

The decisive B4 state-changing statement must include current `authn.can_administer_org`, current `authn.can_read_property`, and current same-org ACTIVE PROPERTY_STAFF target-membership eligibility in the same SQL statement/snapshot that decides the relationship mutation. Application/UI authority is advisory.

Required concurrency evidence:

### 14.1 PUT vs PUT

Two real PostgreSQL connections attempt the same exact PUT.

Expected:
- exactly one ACTIVE relationship;
- no duplicate ACTIVE row;
- one may create while the other converges to existing state;
- deterministic barrier/contention, not sleep-only ordering.

### 14.2 DELETE vs DELETE

Two commands end the same ACTIVE relationship.

Expected:
- the current row is ENDED once;
- the other request is an idempotent no-op;
- no physical deletion or timestamp corruption.

### 14.3 PUT vs DELETE

Exercise both meaningful statement-order outcomes.

Expected:
- final state reflects the relationship mutation that linearizes last;
- never more than one ACTIVE row;
- no partial row;
- subsequent GET reflects committed current state.

### 14.4 Cross-lifecycle boundary

B4 does **not** claim universal commit-order serialization against future/out-of-scope Organization suspension, Membership role/end mutation, Property archive, User suspension or last-admin commands.

Bounded guarantee:
- current authority/target state is rechecked by the decisive B4 statement;
- a change committed before that statement snapshot cannot be bypassed by stale application state;
- frozen B2 reads continue to recompute current membership/assignment/property state;
- cached provider/JWT/UI role is never authority.

A future authorization-lifecycle slice must integrate PF01's complete shared-lock/revocation protocol for the reverse mutation APIs. B4 does not claim that protocol is already implemented.

## 15. Unknown commit / retry model

B4 does not add CommandReceipt and does not promise global exactly-once execution.

If the connection is lost around COMMIT:
- server returns sanitized 503 unless commit is confirmed;
- never claims rollback without confirmation;
- no automatic mutation retry;
- exact GET can reconcile current relationship;
- repeating PUT/DELETE is relationship-state idempotent, but another authorized actor can legitimately change the state between attempts.

GET reconciliation is not a historical command receipt.

## 16. HTTP error precedence

B4 preserves the frozen B3 transport precedence rather than inventing a new one.

For all methods:
1. unsupported method → 405.

For GET:
2. duplicate/unexpected query or malformed path ids → 400 before business lookup;
3. unauthenticated → 401;
4. invisible/foreign/inactive organization or Property → 404;
5. visible organization but caller not current ORG_ADMIN → 403;
6. foreign/inactive/non-PROPERTY_STAFF target membership or absent relationship → 404;
7. active exact relationship → 200.

For PUT/DELETE:
2. Origin must exactly equal configured app base URL; mismatch/missing → 403 before session/body processing, matching frozen B3 mutation behavior;
3. current session required → 401;
4. session-bound CSRF required → 403;
5. unexpected query, malformed ids or non-empty invalid body → 400; oversized body may use the existing bounded 413 convention;
6. invisible/foreign/inactive organization or Property → 404;
7. visible organization but caller not current ORG_ADMIN → 403;
8. foreign/inactive/non-PROPERTY_STAFF target membership → 404;
9. valid mutation → method-specific success;
10. unexpected DB / commit ambiguity → sanitized 503.

A race invalidating an earlier precheck must never be misreported as success. Fresh read-only classification may occur after a denied decisive statement, but it must not retry the write.

No error body may include raw SQL/constraint text, target identity, foreign existence detail, request/session/CSRF material.

## 17. Application/API boundary

Conceptual port:

```text
PropertyAssignmentMutationPort
  getCurrent(digest, orgId, propertyId, membershipId)
  ensureCurrent(digest, orgId, propertyId, membershipId)
  endCurrent(digest, orgId, propertyId, membershipId)
```

Public positive response is intentionally minimal:

```json
{"assigned": true}
```

No role, userId, assignmentId, timestamps, membership status or hidden authority flag is added.

B1/B2/B3 strict response schemas remain unchanged.

B4 may define its own narrow strict schema/error vocabulary.

## 18. Web/product surface

B4 has **no new user-facing management UI**.

There is no roster page, membership UUID textbox as a product flow, staff dropdown, assignment history page, or invite-staff action.

A later separately scoped staff-management/onboarding slice must establish a legitimate human identity/roster contract before any human-facing assignment selector.

## 19. Acceptance criteria

A future approved plan must turn these into exact RED/GREEN and regression evidence.

| ID | Acceptance |
| --- | --- |
| AC01 | Exact resource accepts only valid org/property/membership UUID path and GET/PUT/DELETE; no query/business-body/server-owned injection |
| AC02 | Anonymous 401; foreign/inactive org 404; visible non-admin staff 403; current same-org admin positive |
| AC03 | Foreign/inactive/ORG_ADMIN/ENDED target membership returns non-disclosing 404 and mutates nothing |
| AC04 | Foreign/inactive Property returns 404 and mutates nothing |
| AC05 | First valid PUT creates exactly one ACTIVE row and returns 201/current state |
| AC06 | Repeated PUT returns existing state without a second ACTIVE/history row |
| AC07 | ENDED history followed by PUT creates a new row and preserves old history |
| AC08 | DELETE ends ACTIVE row with DB-owned time; repeated DELETE is 204 no-op; physical row remains |
| AC09 | GET returns 200 only for current eligible ACTIVE relation; absent/ineligible is 404 |
| AC10 | Real dual-connection PUT/PUT contention leaves exactly one ACTIVE row |
| AC11 | Real DELETE/DELETE and PUT/DELETE contention preserves valid final state/history |
| AC12 | Decisive statement rechecks current authority; pre-statement committed revocation is not bypassed by stale app state |
| AC13 | Ending assignment removes PROPERTY_STAFF Property/Unit read visibility on next frozen B2/B3 request |
| AC14 | Reassignment restores only exact Property scope; peer Property remains denied |
| AC15 | `bm_b1_web` has exact B4 EXECUTE but no direct assignment SELECT/INSERT/UPDATE/DELETE and cannot SET ROLE to B4 owner |
| AC16 | B4 owner is exact NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT with no credential and minimum grants |
| AC17 | B4 functions are SECURITY DEFINER with approved owner, secure search_path, PUBLIC EXECUTE revoked and no dynamic SQL |
| AC18 | RLS/catalog snapshot proves role-scoped B4 policies and no B1/B2/B3/PF02-A widening |
| AC19 | migrations 0001–0008 hashes unchanged; fresh-chain/upgrade migration atomic and fail-closed |
| AC20 | Session/CSRF/Origin/private-cache/error behavior follows existing mutation conventions without secrets |
| AC21 | B1/B2/B3 regressions green; no roster/UI/onboarding/PF02-C/F43 behavior appears |
| AC22 | Commit ambiguity returns sanitized 503; no automatic mutation retry; exact GET supports state reconciliation |
| AC23 | Architecture checks prevent raw assignment SQL in route/component layers and prevent second DB pool/credential/provider |
| AC24 | Public-history/scanner gates contain no secret, real tenant/address data or private identity artifact |

No AC claims a coverage percentage, real-user readiness, production deployment or live Auth0 reproduction.

## 20. F-case boundary

B4 evidence does **not automatically promote** a canonical F-case.

Examples:
- F15 includes ticket read/reply after staff scope revocation; tickets do not exist.
- F25 spans User/Organization/Property/Unit lifecycle beyond B4.
- F39 is last-admin mutation and excluded.
- F43 remains search-dependent and NOT_RUN.

Any later F-case promotion requires its full canonical precondition/action/expected behavior to be implemented and directly evidenced.

## 21. Evidence and required gates

Evidence classes remain distinct:
- DOCUMENT_EVIDENCE;
- INDEPENDENT_REVIEW;
- EXECUTOR_LOCAL;
- HOSTED_CI;
- SYNTHETIC_AUTH;
- ACTUAL_WEB_POSTGRES;
- LIVE_PROVIDER.

Current B4 product runtime = NOT_RUN.

A future implementation plan must preserve the required hosted check set unless separately approved:
- verify
- repository-safety
- apps
- mobile-cold-linux
- install-mobile-windows
- web-e2e
- mobile-health
- postgres-integration
- foundation-gate

Green CI alone is not proof of authorization correctness.

## 22. Frozen boundaries / retained risks

B4 must not reopen:
- B1 Auth0/session/logout/proxy contracts;
- B2 organization/property staff read model;
- B3 Property/Unit registration/read contracts;
- migrations 0001–0008;
- F01 PASS;
- F43 NOT_RUN;
- B3D-L01/L02;
- B3 AC04 PG513 evidence limit;
- Local Mobile FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED.

Dependency-security, CI supply-chain, live-provider entitlement, operational session/retention, privacy/security and external-sync risks remain separate.

## 23. B4 design limitations

### B4D-L01 — cross-lifecycle commit-order locking not closed

B4 controls assignment relationship mutation but not reverse APIs for Organization/User/Membership/Property lifecycle. It therefore does not claim universal shared-lock serialization against all future revocation commands.

Mitigation:
- decisive statement rechecks current authority/target state;
- stale app/UI authority is insufficient;
- frozen B2 current reads remain fail-closed;
- future lifecycle APIs must integrate the PF01 lock-order/revocation contract.

Disposition: **LOW / retained design boundary**, provided AC12 is satisfied and implementation makes no stronger serialization claim.

### B4D-L02 — no human-facing target discovery

The exact API requires a membershipId already known to an authorized internal caller/test. B4 intentionally provides no roster/search/profile UI.

Disposition: **LOW / intentional scope boundary**.

### B4D-L03 — no CommandReceipt

GET + idempotent relationship methods improve unknown-outcome recovery but do not prove historical exactly-once command execution.

Disposition: **LOW / intentional scope boundary**.

## 24. Self-review checklist

Before implementation planning, this written spec must have:
- no unresolved placeholder markers;
- no staff roster/onboarding/UI leakage;
- no PF02-C/F43 leakage;
- no direct Web assignment table privilege;
- no mutation grant to frozen `bm_b1_capability_owner`;
- no broad migrator-definer command;
- no production credential/IAM authorization;
- no real data;
- no implicit F-case promotion;
- explicit current-state and unknown-commit semantics;
- explicit frozen migration boundary;
- exact next gate.

## 25. Next gate

This document is a **written spec candidate**.

After commit to the docs-only branch:
1. self-review this exact spec for placeholders, contradictions, authority overclaim and scope expansion;
2. run candidate documentation/repository checks;
3. present the exact committed spec to the operator for written-spec review;
4. **STOP**.

Only explicit operator approval of the written spec permits implementation-plan authoring.

Written-spec approval still does **not** authorize product implementation.

No B4 product branch, migration, code, test, provider, hosting, IAM, real-data or PF02-C work may begin from this document alone.

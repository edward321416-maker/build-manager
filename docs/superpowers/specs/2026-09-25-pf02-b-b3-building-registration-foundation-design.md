# PF02-B / B3 — ORG_ADMIN Building Registration Foundation

## 1. Status / authority

Date: 2026-09-25. Revision: 1.0. **DESIGN / SPEC / STATE-ROUTER DOCS ONLY. B3_DESIGN_CANDIDATE_READY; DESIGN_AUTHORIZED / SPEC_REVIEW_PENDING; B3_IMPLEMENTATION = NOT_AUTHORIZED.** This is a design candidate, not an approved written spec, implementation plan, executed acceptance receipt or production-readiness claim.

Repository: `edward321416-maker/build-manager`. POLICY_REF = TARGET_REF = `ec3d05f69fe33baab70e4a9268e9dc7eca089428`. Live main matched this ref before inspection. Every **existing** code fact below refers to that ref; every B3 capability, grant, API and UI behavior is **proposed**, not implemented. This operator-authorized design supersedes the previous router's NONE_AUTHORIZED only for B3 design/spec review. It does not authorize product implementation.

Authority: [AGENTS](../../../AGENTS.md), [AI delivery rules](../../../governance/ai_delivery_rules.md), [project policy](../../../governance/project_policy.md), [STATUS](../../../STATUS.md), [manifest](../../../ops/CHAT_CONTEXT_MANIFEST.json), [handoff](../../../ops/CHAT_HANDOFF.md), and this task's explicit operator scope. Existing receipts retain their historical meaning. PF00 FROZEN; PF01 REVIEW_DRAFT; PF02-A VERIFIED/FROZEN; PF02-B IN_PROGRESS; B1/B2 VERIFIED/FROZEN. B1I-M01 remains CLOSED_BY_B2 and B1I-M02 DOCUMENT_RECONCILED. B3 is not a reopening of B2.

## 2. Operator-approved decision and rationale

The [charter](../../../PROJECT_CHARTER.md) targets actionable maintenance and unit-level history. [PF01 §1](../../production-foundation/PF01_data_authorization.md) orders the vertical flow: Organization → Property/Unit → Occupancy → Resident Invitation → Maintenance Ticket → Manager handling. The [phase graph](../../production-foundation/phase_dependencies.json) places PF02-C after PF02-B; it does not define or automatically authorize individual B slices.

The current authenticated v2 tree contains session operations, organization discovery and Property list/detail, but no createProperty, createUnit, Unit list/detail or startOccupancy. The approved next slice fills the registration prerequisite using synthetic data before anyone begins occupancy/invitation. An existing table or demo fixture does not constitute that production application path.

| Next-slice alternative | Decision / reason |
| --- | --- |
| A. Property/Unit registration | Selected: closes the missing management-resource prerequisite and delivers a bounded end-to-end path |
| B. Occupancy/Invitation immediately | Deferred: lacks production Property/Unit registration and would skip the selected prerequisite |
| C. Staff invitation / assignment mutation | Deferred: not the missing prerequisite for this vertical flow |
| D. Real address/building-register integration | Deferred: opens provider, credentials, real addresses, provenance and fallback decisions together |
| E. Ticket first | Deferred: would skip Occupancy/Member authority chain |
| F. B1/B2 LOW hardening | Retained backlog: non-blocking improvements do not supply registration |

## 3. Goal

An authenticated ACTIVE ORG_ADMIN creates a Property in their ACTIVE organization and a Unit beneath their ACTIVE Property, persists each command atomically in PostgreSQL, and reads the result through the existing v2 hierarchy and Web workspace. An authenticated ACTIVE PROPERTY_STAFF can read ACTIVE Units only under a Property already visible through the frozen B2 assignment capability. Staff cannot create either resource.

Zero-assignment staff continues to see organization context, an empty Property list, and no arbitrary Unit enumeration. Organization visibility is not write authority or Unit authority. A newly created Property has no automatically created staff assignments.

## 4. Approved scope

- ORG_ADMIN: create Property; create Unit; preserve Property list/detail; read ACTIVE Unit list/detail; minimal Web registration and readback.
- PROPERTY_STAFF: assigned ACTIVE Property and its ACTIVE Unit list/detail only; both create operations denied.
- Existing application ports / explicit SQL / real PostgreSQL, application authorization plus DB/RLS enforcement, authenticated `/api/v2`, synthetic test setup only.
- Server-owned identifiers, tenant relationships, status and creation time. Separate Property and Unit POST transactions: the UI is a sequence, not an all-buildings-and-units batch transaction.

## 5. Non-goals

No Occupancy create/start/end, OccupancyMember, resident/staff invitation, membership mutation, PropertyAssignment mutation, Property/Unit update/delete/archive mutation, MaintenanceTicket, TicketMessage, CommandReceipt, AI intake/triage, billing or Mobile auth. No Kakao, account linking, Auth0/provider change, actual address API, building-register provider, K-apt, address-normalization provider, Verified Building Context, address-based automatic merge or ownership verification. No production DB hosting, credential/IAM provisioning, real tenant/landlord/address data, real pilot or complete privacy/security certification.

**REAL_TENANT_DATA = NOT_AUTHORIZED. PRODUCTION_DB_HOSTING = NOT_AUTHORIZED.** “Production v2” names the authenticated architecture boundary, not an authorization to deploy or collect production data. Broader PF01 invitation, CommandReceipt and row-locking workflows are not silently imported into this registration slice.

## 6. Existing B1/B2 baseline — inspected facts

All paths in this table are repository-relative at TARGET_REF. SQL migration basenames resolve under [migrations](../../../packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql).

| Existing source | Observed contract and B3 consequence |
| --- | --- |
| [B2 acceptance](../../../ops/pf02_b_b2_acceptance.md), [approved B2 design](2026-09-23-pf02-b-b2-property-staff-scope-design.md) | B2 accepted/closed, A+ frozen; design's historical NOT_RUN is not the current implementation state |
| `0002_property_unit_occupancy.sql` | Property and Unit already exist; nullable reference; no global address uniqueness; Unit composite FK and partial case-insensitive ACTIVE label index |
| [0003](../../../packages/persistence-postgres/migrations/0003_runtime_isolation.sql) | ENABLE/FORCE RLS; property_org_scope and unit_org_scope are permissive ALL policies with org equality for USING/WITH CHECK |
| [0006](../../../packages/persistence-postgres/migrations/0006_b1_organization_access.sql) | bm_b1_web has Property SELECT; capability owner has organization/member SELECT; restrictive Property SELECT policy is role-scoped |
| [0007](../../../packages/persistence-postgres/migrations/0007_b2_property_assignment_scope.sql) | authorize_org delegates to can_access_org_context (admin + staff); can_read_org stays admin-only; can_read_property checks current actor/parent/membership/assignment; owner-side Property ceiling avoids recursive Web policy |
| [org-transaction.ts](../../../packages/persistence-postgres/src/b1/org-transaction.ts) | withB1OrgTransaction explicitly selects READ COMMITTED, calls current_actor and authorize_org, then sets transaction-local org/digest; this is context authorization, not admin write permission |
| [organization-reader.ts](../../../packages/persistence-postgres/src/b1/organization-reader.ts) | SQL Property predicate + RLS before UUID cursor/order/LIMIT; limit+1, nextCursor is last emitted visible item; unknown DB errors map to dependency unavailable |
| [organization-access.ts](../../../packages/application/src/b1/organization-access.ts), [ports.ts](../../../packages/application/src/b1/ports.ts) | Verified current actor before read port; OrganizationReadPort has listMine/listProperties/getProperty; no writes or Unit read port |
| [API contracts](../../../packages/api-contracts/src/b1.ts) | Strict object schemas, PropertyView reference nullable; Page limit default20/max50; session response has csrf; no raw role DTO |
| [http.ts](../../../apps/web/src/server/b1/http.ts) | GET-only handler, strict query validation, current session, private/no-store; no business POST handler |
| [session.ts](../../../apps/web/src/server/b1/session.ts) | Cookie transport expiry and DB registry currentActor checked; returns digest/actor/csrf internally |
| [logout.ts](../../../apps/web/src/server/b1/logout.ts) | POST, exact configured Origin, session-bound x-b1-csrf, shape validation and timingSafeEqual; logout also supports its existing form path |
| [container.ts](../../../apps/web/src/server/b1/container.ts) | BUILD_MANAGER_MODE=B1, B1_WEB_DATABASE_URL, fail-closed config; cached dependencies do not mean cached authorization |
| [workspace-shell.tsx](../../../apps/web/src/components/b1/workspace-shell.tsx) | Client renders authenticated HTTP results, obtains csrf from session GET, no-store/abort handling, role-neutral empty Property text; no registration UI |
| [Property collection route](../../../apps/web/src/app/api/v2/organizations/[orgId]/properties/route.ts), [detail route](../../../apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/route.ts) | Existing GET exports and literal nodejs/force-dynamic; collection POST is absent |
| [package.json](../../../package.json) | Node24 engine, workspace Shared/Web/Mobile/PG/E2E commands; this design adds no dependency |

Repository-tree inspection found exactly migrations0001–0007 and six v2 Route Handler files. The [v3 product spec](../../../product/05_product_spec_v3_web_mobile_REAUDITED.md) preserves monorepo/import boundaries and synthetic demo separation; its P0 SQLite, demo-only Unit identity and nested v1 error envelope are historical P0 contracts. They do not override current B1 PostgreSQL, current flat v2 `{error: code}` or authorize importing demo adapters into B3.

## 7. Write architecture alternatives

| Alternative | Least privilege / freeze / recursion / testing / atomicity |
| --- | --- |
| A. Existing bm_b1_web direct INSERT | Selected. Explicit insert-column grants, application admin guard and role-specific restrictive WITH CHECK. Keeps plain SQL and existing transaction boundary; bypass tests can address actual raw runtime SQL. One new boolean helper; no write-capability-owner table rights |
| B. SECURITY DEFINER command functions | Can confine writes behind EXECUTE, but introduces owner write grants, owner INSERT policies, command/error protocol and context restoration. No benefit requiring this additional privileged command surface for two bounded inserts |
| C. New production write role | Adds credential/pool/role-transition lifecycle without a separate trust domain or approved hosting need. Not selected |
| D. Reuse bm_pf02a_runtime | Rejected: foundation fixture role has broader historic CRUD matrix and is not verified Web actor authority. Its privileges remain unchanged |

Choose A with **no new role, table, role membership or dependency**. It grants no UPDATE/DELETE and does not reuse a migration owner as runtime. SECURITY DEFINER remains only a narrow boolean authority check. Normal INSERT statements and all constraint failures remain inside the existing transaction abstraction. Table RLS remains enabled/forced. This proposal is not a request to change deployed roles/settings during design.

## 8. Existing data model / no-new-table analysis

The exact app business table inventory stays eight: app_user, organization, organization_membership, property, unit, occupancy, occupancy_member, property_assignment. No new registration table, version column, normalized-address table, CommandReceipt or generic command framework is needed.

| Existing model | Preserved invariant / selected create contract |
| --- | --- |
| Property | id UUID DEFAULT uuidv7(); org FK; UNIQUE(org_id,id); nullable address_reference whose non-null value equals btrim and has 1..512 characters; ACTIVE/ARCHIVED status; created_at default transaction_timestamp |
| Unit | UUID, org_id/property_id; UNIQUE(org_id,id); composite unit_property_fk(org_id,property_id); trimmed label 1..80 characters with control characters prohibited; ACTIVE/ARCHIVED status; default creation timestamp |
| Active Unit label | `unit_active_label_unique` on org_id, property_id, lower(label) COLLATE C WHERE status=ACTIVE is the final authority; duplicate ACTIVE case variants conflict, another Property scope is allowed, ARCHIVED history does not occupy this partial index |

### Property input decision

Select **required addressReference string**, not optional/null, for new B3 registrations. A visible registration reference gives the minimal existing Property DTO/UI a useful label without adding a new field. Nullable/optional is compatible with legacy rows but produces indistinguishable unnamed new entries and unnecessary remediation UI when update is excluded. The SQL column remains nullable; all existing null-valued Properties remain readable. No backfill or NOT NULL migration.

POST body is exactly `{addressReference: string}`. Require already-trimmed input, length 1..512 Unicode code points, no C0/C1 control characters or unpaired surrogate; reject surrounding whitespace rather than silently normalize. This is a stricter application subset of the existing btrim/char_length constraint. Frontend may offer trimming before submission but the API checks independently. Use synthetic opaque references only in authorized validation; the field is an **unverified operator-entered reference**, not provider verification or Verified Building Context. The same reference may appear in different organizations or multiple Properties in one organization. It implies neither ownership nor deduplication. No provider calls, search or automatic merging.

### Unit input / output decision

POST body is exactly `{label: string}`. Require already-trimmed 1..80 Unicode code points, no C0/C1 controls or unpaired surrogate. Preserve label case; the database expression, not JavaScript lowercasing, determines conflict. Include Korean/emoji/code-point boundaries and case variants in future tests; do not claim linguistic normalization beyond the index.

UnitView is exactly `{id, orgId, propertyId, label}`, UUIDs plus string. Reads expose ACTIVE Units only; no status/createdAt/occupancy/assignment/role fields. Existing PropertyView remains `{id, orgId, addressReference: string|null}`. Server owns id, orgId, propertyId, userId, membershipId, role, status, createdAt, assignment and owner/admin flags: reject these and all unknown body fields, arrays, null/scalar bodies and nested substitutes. Path IDs are selectors validated against current relationships, not grants.

## 9. Authorization model

**Existing context capability:** `authn.authorize_org(bytea,uuid)` continues to delegate to admin-or-staff context. `withB1OrgTransaction` and legacy `can_read_org` keep their existing meanings. Neither is renamed into a write command or broadened for B3.

**New proposed capability:** `authn.can_administer_org(p_digest bytea,p_org uuid) RETURNS boolean`. SQL STABLE SECURITY DEFINER, owner bm_b1_capability_owner, search_path=pg_catalog, qualified relations/functions. Return COALESCE(the complete authorization predicate, false): supplied digest must equal context_session_digest, p_org must equal current_org_id, current_actor(p_digest) must be non-null, organization ACTIVE, and that actor's current membership ACTIVE with role exactly ORG_ADMIN. Implement the actor/org/member predicate explicitly; do not infer admin from discovery success or from the legacy helper's name. No GUC mutation, row lock, raw identity return or retained authorization cache.

Call this helper **after** existing withB1OrgTransaction established authorized context. Property create: visible org first, then admin check. Unit create: visible parent through can_read_property first, then admin check. Thus a staff caller gets403 only when the requested context is already visible; an unassigned/foreign/archived parent returns404 before an admin-only denial. Staff with zero assignments has organization visibility, so Property create403 and Unit access404.

Application use cases first require the current B1 actor and then invoke narrow B3 ports; adapters enforce visibility/admin/parent checks inside the same transaction, and DB RLS repeats the decisive checks. An injected browser role, JWT role, userId, chosen org GUC without a valid current digest, or visibility of a peer's organization never grants a write.

## 10. RLS / ACL / write-capability evolution

Proposed sole additive migration: **`packages/persistence-postgres/migrations/0008_b3_building_registration.sql`**. Inspection found0007 is the current last migration. Responsibility is B3 authority helper, narrowly scoped grants and three policies; no table/column/index change. New SQL identifiers are not present in the inspected migration set.

### Exact new privilege surface

| Grantee | New privilege only |
| --- | --- |
| bm_b1_web | INSERT(id,org_id,address_reference,status) on app.property |
| bm_b1_web | INSERT(id,org_id,property_id,label,status) on app.unit |
| bm_b1_web | SELECT(id,org_id,property_id,label,status) on app.unit |
| bm_b1_web | EXECUTE on authn.can_administer_org(bytea,uuid) |
| bm_b1_capability_owner | Temporary CREATE on authn solely for function ownership creation, revoked before migration completion; no additional raw table grant |

Existing Property SELECT and narrow capability-owner Property/assignment SELECT grants stay unchanged. No INSERT grant on created_at; DB default remains authoritative. No Unit grant to capability owner is needed: the Unit policy passes the row's parent identifiers into frozen can_read_property, which reads existing Property/member/assignment relations. No assignment, occupancy, user, membership, session or identity write grant is introduced. No PUBLIC EXECUTE; no runtime schema CREATE, SET ROLE, membership, UPDATE, DELETE, TRUNCATE or BYPASSRLS. bm_b1_login and bm_pf02a_runtime receive nothing new.

Explicit id INSERT columns serve server-generated UUIDs described in §14; accepting an ID column in internal SQL does not accept a client ID. IDs never establish authority.

### Final policy graph relevant to bm_b1_web

Let D=context_session_digest(), O=current_org_id(), Admin(org)=can_administer_org(D,org), ReadParent(org,property)=can_read_property(D,org,property). Every false/null predicate denies.

| Table / operation | Permissive baseline unchanged | Restrictive ceiling |
| --- | --- | --- |
| Property SELECT | property_org_scope: org_id=O | Existing b1_property_ceiling: status ACTIVE AND ReadParent(org_id,id), unchanged |
| Property INSERT | property_org_scope WITH CHECK org_id=O | New b3_property_insert_ceiling FOR INSERT TO bm_b1_web: status ACTIVE AND org_id=O AND Admin(org_id) |
| Unit SELECT | unit_org_scope: org_id=O | New b3_unit_read_ceiling FOR SELECT TO bm_b1_web: status ACTIVE AND ReadParent(org_id,property_id) |
| Unit INSERT | unit_org_scope WITH CHECK org_id=O | New b3_unit_insert_ceiling FOR INSERT TO bm_b1_web: status ACTIVE AND org_id=O AND Admin(org_id) AND ReadParent(org_id,property_id) |
| Property/Unit UPDATE/DELETE | Historic policies still exist | Web has no corresponding grant: denied, no mutation API |

Permissive policies combine OR, restrictive policies AND. The three new ceilings apply only to bm_b1_web, never PUBLIC or the PF02-A runtime. A permissive org match cannot cancel a failing ceiling. INSERT ceilings use WITH CHECK, not USING. Reference: [PostgreSQL18 CREATE POLICY](https://www.postgresql.org/docs/18/sql-createpolicy.html).

Nonrecursive paths: Web Unit → can_read_property as capability owner → simple existing b2_property_owner_ceiling + membership/assignment policies; it never queries Unit. Web Property INSERT → can_administer_org → org/member/current_actor, never the newly inserted Property. Existing Web Property SELECT → B2 helper → owner Property policy, unchanged. FORCE RLS remains on tables; the definer is neither table owner nor BYPASSRLS and does not inherit Web policies. See [row security semantics](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).

### Migration sequence / catalog contract

1. Before any grant, verify required existing B1 roles, attributes and pg_auth_members contract, non-superuser/non-BYPASSRLS executing migration owner, expected ownership of existing app tables and required helper signatures. Missing/invalid prerequisites fail closed, never CREATE ROLE or silently repair provisioning.
2. Under migration owner, grant temporary CREATE on authn to capability owner; SET LOCAL ROLE bm_b1_capability_owner; create only the new STABLE function with explicit secure search_path, revoke PUBLIC EXECUTE, grant Web EXECUTE.
3. RESET ROLE; create the three role-specific restrictive policies under table ownership; add exact column grants above; revoke temporary CREATE. Existing B1/B2 functions, policy definitions and owners remain unchanged.
4. Verify pg_policy command/role OIDs/permissive flags/check expressions, function owner/volatility/config/ACL, table ENABLE/FORCE and exact added column privileges. Verify no residual CREATE and no new role memberships, raw capability-owner address read, Unit owner grant or assignment writes.

Publish atomically using the existing singleTransaction migration runner. There is no observable grant-without-ceiling window. Security policy omissions must fail catalog/security tests, not be patched by changing0001–0007 or disabling RLS. Current table inventory remains exactly eight.

## 11. API / application contract

No staff-specific URL, no root unscoped Unit enumeration, no replacement of existing GET URLs.

| Method / path | Proposed result / authority |
| --- | --- |
| GET `/api/v2/me/organizations` | Existing B1/B2 discovery unchanged |
| GET `/api/v2/organizations/:orgId/properties` | Existing Property Page JSON unchanged; server-derived create-Property action header (§13) |
| GET `/api/v2/organizations/:orgId/properties/:propertyId` | Existing PropertyView JSON unchanged; create-Unit action header (§13) |
| POST `/api/v2/organizations/:orgId/properties` | Admin-only create;201 PropertyView after successful commit; Location is its existing detail URL |
| GET `/api/v2/organizations/:orgId/properties/:propertyId/units` |200 Page<UnitView> for visible parent; authorized empty list allowed |
| POST `/api/v2/organizations/:orgId/properties/:propertyId/units` | Admin-only create;201 UnitView after successful commit; Location is Unit detail URL |
| GET `/api/v2/organizations/:orgId/properties/:propertyId/units/:unitId` |200 UnitView, exact org/property/unit chain and current visibility required |

Unit Page reuses `{items,nextCursor}` and PageQuery after/limit (default20,1..50). Unknown/duplicate query keys fail400. Detail/POST accepts no query parameters. IDs are validated as UUIDs using the canonical API boundary; no request selector bypasses chain checks. No response role or assignment list.

Proposed ports alongside, not replacing, OrganizationReadPort:

- BuildingRegistrationPort: createProperty(digest,orgId,input) → PropertyView; createUnit(digest,orgId,propertyId,input) → UnitView; canCreateProperty(digest,orgId) → boolean; canCreateUnit(digest,orgId,propertyId) → boolean. Capability methods must throw unauthorized/not-found for an invisible context before returning an advisory boolean.
- UnitReadPort: listUnits(digest,orgId,propertyId,page) → Page<UnitView>; getUnit(digest,orgId,propertyId,unitId) → UnitView.
- Use cases expose the corresponding operations, validate current actor and input, then delegate to these PostgreSQL ports. SessionDigest/PropertyView/PageQuery/Page remain the existing B1 types. Exact module file splits are implementation-plan concerns; no generic role engine or DB access from page/layout.

Unit SQL list/detail both include org_id, property_id, ACTIVE status and explicit can_read_property(digest,org_id,property_id) as well as Unit RLS. List filters apply before id ordering, id>after and LIMIT(limit+1); nextCursor uses only the last emitted Unit. No counts or hidden row IDs. Detail also predicates unitId and returns the same generalized NOT_FOUND for a missing, foreign, unassigned or archived chain. Even an empty list first verifies parent visibility, so invisible-parent404 is distinguishable from visible-parent200[] without exposing other resources. Parent/assignment changes are rechecked at final SQL statement snapshot.

New Unit routes and modified collection route retain literal `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Business authorization stays in server/application/PostgreSQL; proxy and session transport semantics stay frozen. B3 assembly extends the existing authenticated B1-mode container, not a new demo fallback or new auth mode.

## 12. CSRF / mutation boundary

B3 JSON POST reuses the security contract of B1 logout without changing logout's form/provider behavior. Common helper extraction is optional later implementation structure, not a redesign of transport.

Order is explicit: supported method → exact Origin → authenticated current session/registry → session-bound CSRF → bounded JSON/input validation → current org/parent visibility → admin action check → transaction INSERT/readback/commit. Method errors405; absent/wrong Origin403 including literal null Origin; with valid Origin an absent/expired/revoked session401; authenticated missing/malformed/wrong CSRF403. This precedence is resource-independent and never requires probing foreign resource existence to reject CSRF.

Use the configured explicit appBaseUrl origin under the same accepted B1 base-URL convention; do not derive allowed origin from untrusted Host, forwarded headers, referrer, suffix matching or wildcard CORS. Compare submitted x-b1-csrf against current session.csrf only after fixed expected hexadecimal shape/length validation; use timing-safe comparison. GET /api/v2/session remains the existing private/no-store source. No token in query/body/Location/log; JSON posts do not gain logout's form-token fallback.

Body limit:8 KiB of actual UTF-8 request bytes, enforced while reading, not solely from Content-Length. Overflow413; malformed JSON, unsupported content type (only application/json with optional charset), unknown/server-owned fields and scalar/array bodies400. No silent truncation. Invalid body requests do not mutate. Request bodies, CSRF, session handles/digests/cookies, credentials and raw constraint details are absent from public errors/access logs/traces.

Every success/error/action-capability response is private/no-store/max-age0 with Vary:Cookie as in B1. No cross-origin credential allowance or shared/static capability cache. Missing config/DB fails closed503. Existing B1 expiry/revocation/logout is authoritative for the next request; CSRF does not substitute for authorization.

## 13. Web behavior and admin-action affordance

Reuse the workspace: 내 조직 → 건물 목록 → 건물 등록 → 건물 상세 → 호실 목록 → 호실 등록 → 호실 상세. A Property save commits independently before Unit registration; if the later Unit command fails, preserve the already successful Property and show the Unit error. Do not claim a combined atomic wizard.

Select **server-derived action response headers** on existing reads: `X-B3-Can-Create-Property: true|false` on the organization Property collection and `X-B3-Can-Create-Unit: true|false` on Property detail and Unit collection. Derive these from the narrow port capability methods in current DB context; never from a supplied role or provider claim. Only successful visible-context responses carry the appropriate header; failures carry none. JSON Property/Page DTOs remain unchanged, avoiding strict B1 schema breakage or an extra authorization URL. GET projections recheck current authority; any projection race is harmless because POST independently checks again.

Alternatives considered: raw role DTO rejected as unnecessary role coupling; adding fields to strict existing JSON envelopes would force unrelated consumers to change; a separate staff/admin management API or server-business page import is unnecessary. Headers are advisory UI metadata, not credentials. Ignoring or forging them cannot pass the POST boundary.

UI starts with create controls hidden, shows them only for an exact true header from the scoped successful response, and clears on navigation, logout,401/403/404 or abort. False/missing/malformed header stays hidden. Staff sees no persistent create controls. Direct/manual navigation to a registration view performs the same protected HTTP read and renders no form without capability; it does not import DB/application code from page/layout. A stale admin button receives the actual POST denial and drops its capability state.

Property form labels the value as an unverified manual reference; validation examples are synthetic, never real addresses. No verified badge, ownership claim, map, provider search or role badge. Unit form collects label only. Use accessible loading/errors and role-neutral empty copy: “조회 가능한 건물이 없습니다.” / “조회 가능한 호실이 없습니다.” Both admin/staff navigate visible Unit details. No raw server fields are editable.

Disable duplicate submit while in flight. On known409 show a general duplicate Unit-label message without other tenant detail; on uncertain503/network outcome do not auto-retry a create. Reload the scoped list for operator reconciliation before an explicit new submission. No fake exactly-once claim or hidden address dedupe.

## 14. Transaction / concurrency / error semantics

### Command atomicity and readback

Reuse withB1OrgTransaction and its actual READ COMMITTED selection. Add the admin/parent checks to B3 operations without reinterpreting the frozen context guard. Allocate the new UUID on the database connection with `SELECT uuidv7()`; server supplies that id in a narrow INSERT with validated route-derived org/parent, validated text and literal ACTIVE. Omit created_at. Use a plain INSERT **without RETURNING or ON CONFLICT**. Read the created resource by id in a following statement through the same explicit predicate/RLS boundary, then commit. Return201/Location only after withTransaction confirms COMMIT.

This intentionally avoids depending on a same-statement Property self-lookup through frozen can_read_property during INSERT RETURNING's SELECT-policy check. Do not weaken b1_property_ceiling to make RETURNING work. Column/default/RETURNING privilege distinctions follow [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html). A failed readback or mapping error before commit rolls back the inserted row. UUID generation without a row is not a partial business success.

Unit unique index is final authority: ordinary INSERT of a case-insensitive duplicate raises23505. Map only the known unit_active_label_unique conflict in an already authorized parent transaction to409 CONFLICT; do not map every unique/FK error to a caller-visible existence fact. Different Property scope remains allowed. No SELECT-then-INSERT uniqueness assumption, overwrite or ON CONFLICT success swallowing.

### Visibility and revocation point

The decisive write authorization is the INSERT statement's current READ COMMITTED policy snapshot, not an earlier page or application guard. Revocation committed before that statement must deny. Readback runs a later statement and may deny/roll back if relationships change. A write already authorized before concurrent revocation can finish as an overlapping operation; this B3 contract does not promise commit-order serialization against all future mutation commands. Subsequent requests reauthorize. No claim to recover past transmitted bytes.

PF01 §8.2's locking protocol explicitly addresses invitation acceptance/ticket/message workflows, which are excluded here. B3 does not silently add UPDATE/locking rights to capability owner or rewrite B1 logout/revocation to obtain that stronger protocol. Future strong serialization and mutation lifecycle need their own scoped design; this limitation is explicit, not a claim that a read guard locks relationships. Expiry/current session is checked by the existing registry and again by SQL capability during each protected operation.

### Required future concurrency evidence

- Actual two PostgreSQL backends: A inserts label and holds its transaction; B issues the conflicting insert; observe B waiting on A through pg_locks/pg_stat_activity before releasing A's commit barrier. Then exactly one ACTIVE row and B23505/adapter409. Also rollback-winner variant permits B to succeed. Bounded observation deadlines may fail a test; sleeps are not sequencing evidence.
- Pause an actual B3 adapter after guard, commit assignment/membership/org change in another backend, then release final SELECT/INSERT; assert raw DB and adapter visibility/denial. SHOW transaction_isolation must report read committed. Staff writes fail with real bm_b1_web even when application guard is bypassed.
- Pool max1: authorized admin, assigned staff, wrong parent, failed insert, rollback and anonymous operations; assert app.org_id/session digest reset and visible row sets independent. Savepoint/nested controls follow existing transaction abstraction, not a new nested transaction system.
- A failed confirmed transaction leaves no new Property/Unit. A connection loss around COMMIT can have an unknown outcome:503 is not proof of rollback. Never retry such a create automatically or display success without confirmed commit. Preserve existing uncertain-connection disposal behavior.

| HTTP | Public flat error / meaning |
| --- | --- |
|401|UNAUTHENTICATED: absent/invalid current session (when earlier method/Origin check passed)|
|403|FORBIDDEN: Origin/CSRF failure, or admin-only action in a context already visible to staff|
|404|NOT_FOUND: valid selector but non-visible/missing/foreign/inactive org/parent/Unit; same body for all hidden-resource causes|
|400|INVALID_INPUT: strict body/query/path validation failure; never echo inputs|
|409|CONFLICT: known ACTIVE Unit label conflict within already authorized parent; no SQL constraint/raw detail|
|413|PAYLOAD_TOO_LARGE: actual JSON body exceeds8 KiB|
|503|DEPENDENCY_UNAVAILABLE: DB/config/unknown storage or commit outcome; not an empty success|
|405|METHOD_NOT_ALLOWED: unsupported method, including PATCH/DELETE; Allow advertises only supported application methods|

B3 defines its own mutation/error response vocabulary and must not modify the frozen `B1ErrorCode` or `B1ErrorSchema`. The pre-existing direct HTTP405 `METHOD_NOT_ALLOWED` response in the B1 HTTP layer is historical B1 behavior, outside B3 scope; do not reconcile or refactor that existing discrepancy as part of B3.

B3's error schema extends its own response vocabulary for409/413/405; it must not alter existing B1 errors/logout semantics. Unit FK23503 is a DB invariant; normal API parent authorization hides invalid/foreign parent as404 before INSERT. Unexpected database failures stay503, sanitized. Late RLS failure after earlier valid guard rolls back; a fresh read-only authority classification may return401/404/403 without retrying the write, otherwise503. No foreign resource leaks through conflict messages or action headers. Ordinary framework HEAD/OPTIONS behavior must not invoke mutations; explicit unsupported application methods remain405.

## 15. Freeze / migration compatibility

Migrations0001–0007 are **FROZEN / BYTE-IDENTICAL**. No old SQL/policy-function bytes are edited. Their exact SHA-256 preconditions, calculated from TARGET_REF Git blob bytes, are recorded below; implementation must compare these at candidate HEAD. Historical B1/PF02-A table-count evidence remains unchanged; B3 retains current exact eight tables and original privilege matrix except the explicit bm_b1_web additions in0008.

| Frozen migration | UTF-8 bytes | SHA-256 |
| --- | --- | --- |
| 0001_core_identity_organization.sql | 1706 | `e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1` |
| 0002_property_unit_occupancy.sql | 3118 | `1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a` |
| 0003_runtime_isolation.sql | 1823 | `649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6` |
| 0004_b1_identity_sessions.sql | 3259 | `2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a` |
| 0005_b1_auth_capabilities.sql | 5800 | `22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33` |
| 0006_b1_organization_access.sql | 5779 | `a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe` |
| 0007_b2_property_assignment_scope.sql | 9808 | `4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2` |

Fresh disposable DB: existing approved role provisioning/attribute checks, full0001–0008 chain passes; missing roles fail closed. Upgrade disposable DB at0007:0008 passes with same resulting catalogs. Inject failure after partial0008 changes inside the migration transaction: full rollback, no partial helper/policy/ACL, no applied0008 history row. Fresh full-chain failure rolls back app/authn schema changes; the runner's pre-transaction empty migration metadata is not a partial migration success. Upgrade failure leaves prior0007 catalogs unchanged. Require positive catalog readback before and after, not merely “no exception”.

No new runner, changed role inheritance, migration-owner runtime or production provisioning. B1/B2 auth/session/proxy/replay/logout and Property visibility regressions remain applicable. B2 assignment mutation remains absent. Existing original tenant-table PF02-A SELECT/INSERT/UPDATE tests keep their meaning; new ceilings cannot target that runtime. Catalog ownership and column grants are tested, not inferred from SQL text alone.

## 16. B3 acceptance matrix — DESIGN EXPECTATION / NOT_RUN

Every row below is a **DESIGN EXPECTATION**, not B3 runtime evidence. PG means actual non-superuser PostgreSQL18.6; Web means actual app+PostgreSQL with synthetic authenticated session. B2 tests are dependencies, never substitute B3 passes.

| ID | Required assertion / boundary | Future evidence | Status |
| --- | --- | --- | --- |
| AC01 | ACTIVE admin creates own-org Property,201 only after commit; GET/list and Web readback match persisted row | PG + API + Web | NOT_RUN |
| AC02 | Staff in visible own org Property create403; raw/adapter no inserted row | PG + API | NOT_RUN |
| AC03 | Foreign/PENDING/SUSPENDED/ARCHIVED org create404, no row and no existence detail | PG + API | NOT_RUN |
| AC04 | Strict reference input, code-point/trim/control/length boundaries and every server-owned field rejected400; existing null rows still readable | Contract + API + PG | NOT_RUN |
| AC05 | Admin creates Unit in own ACTIVE Property;201/readback/list/detail, no automatic assignment or Occupancy | PG + API + Web | NOT_RUN |
| AC06 | Assigned staff Unit create403; same-org unassigned create404; both no row | PG + API + Web | NOT_RUN |
| AC07 | Foreign or archived Property createUnit404; no row, uniform error | PG + API | NOT_RUN |
| AC08 | Duplicate ACTIVE label/case variant409; same label in another Property allowed; archived history does not collide | PG + API | NOT_RUN |
| AC09 | Separately exercise cross-org parent FK23503 under approved isolated owner test context with org GUC, not an earlier Web RLS denial; rollback leaves no Unit | PG constraint | NOT_RUN |
| AC10 | Admin Unit list/detail returns only own ACTIVE Units under ACTIVE parent, including authorized empty list | PG + Web | NOT_RUN |
| AC11 | Staff sees only ACTIVE Units of currently assigned ACTIVE Property; unassigned/foreign/archived denied and zero-assignment cannot enumerate | PG + API + Web | NOT_RUN |
| AC12 | Raw bm_b1_web SELECT with valid staff digest/own org cannot expose peer unassigned Unit, even without application predicate | PG RLS | NOT_RUN |
| AC13 | Bypass app guard with staff raw runtime SQL: Property/Unit INSERT denied; forged GUC/digest/status cannot help; no UPDATE/DELETE grant | PG RLS/ACL | NOT_RUN |
| AC14 | Missing/wrong Origin and CSRF403 before mutation; valid Origin invalid session401; body-limit413 and parse400 do not mutate | HTTP + Web + PG | NOT_RUN |
| AC15 | Failure/readback rollback/savepoint/pool-max1 sequences leave no GUC/row-scope leak, unknown commit not falsely labeled rollback | PG + adapter | NOT_RUN |
| AC16 | Two real backends, observed lock wait plus commit barrier: one ACTIVE Unit winner; loser23505→409; no sleep ordering | PG + adapter | NOT_RUN |
| AC17 | Seven hashes preserved;0008 fresh/upgrade/failure atomic; exact8 inventory and scoped function/policy/column ACL catalog | Git + PG | NOT_RUN |
| AC18 | Frozen B1 auth/session/logout/replay and B2 Property admin/staff/zero-assignment/revocation controls retain results | Existing + extended PG/Web | NOT_RUN |
| AC19 | Hidden Unit IDs never emitted as items/cursor/counts/action metadata; list/detail/error non-disclosure and UUID pagination match | PG + API + Web | NOT_RUN |
| AC20 | Synthetic references/labels/identities only; provider calls0, real address/PII/credential use0, no demo/test-header fallback | Fixture/graph + Web + public scan | NOT_RUN |
| AC21 | Admin create affordance true; staff false/hidden, direct registration view denied; forged/stale action header never authorizes POST; clearing on navigation/logout | Web + HTTP | NOT_RUN |
| AC22 | Commit revoke after guard before final statement: current-state write/read denial; pre-revoke completed readback classified as overlapping; subsequent new request denied | PG barriers + real adapter | NOT_RUN |
| AC23 | Plain INSERT followed by next-statement RLS readback works for Property and Unit with actual bm_b1_web, defaults and column grants; failed readback rolls back | PG + API | NOT_RUN |

## 17. Canonical F-case mapping / CI / security/privacy

The [canonical case registry](../../production-foundation/acceptance_cases.json) is unchanged. F01 currently NOT_RUN: PF02-A's DB prerequisite alone did not execute admin Property/Unit registration across the full API/Web chain. Future F01 promotion is reviewable only after actual Web/API/PostgreSQL creation/readback and cross-org isolation (AC01/03/05/07/09/10/13/19), acceptance at a fixed implementation HEAD and explicit evidence reconciliation. This design promotes nothing and does not rewrite PF02-A history.

F43 remains **NOT_RUN**. It includes registration **and search** for the same public reference in two orgs. B3 permits separate scoped registrations, but implements no external/address search. A synthetic equal-reference control is useful isolation evidence, not the whole F43. Do not narrow canonical wording or repurpose B3 list pagination as address search to obtain a PASS.

Future CI responsibilities: PG migration/constraints/ACL/RLS/transactions/races and frozen regressions in postgres-integration (existing25min); application/contracts/Web unit/build in apps; browser registration/navigation/denial in existing web-e2e (30min); architecture/public checks in verify/repository-safety; Mobile gates unchanged/required. Keep verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate. No new job or timeout adjustment is designed; no Chromium/build duplication into PG.

Evidence classes: DOCUMENT_EVIDENCE (this source inspection/spec), INDEPENDENT_REVIEW (future fixed-ref design/implementation review), EXECUTOR_LOCAL, HOSTED_CI (exact run/head/event), SYNTHETIC_AUTH, ACTUAL_WEB_POSTGRES, LIVE_PROVIDER. This task's product runtime tests, B3 behavior, live provider interactions and migration execution are all NOT_RUN. Auth0 remains frozen; a B3 live Auth0 rerun is not required to prove this data-scope slice. B2 green CI does not verify B3. Hosted docs checks do not make future APIs implemented or production ready.

Only synthetic resources and test-only authenticated sessions in later validation. Never emit request bodies/references, real addresses, email, provider credentials, session/CSRF material or raw SQL exception data into logs/public PR. No new external account, paid service, OAuth/IAM operation or provider request. Existing B1 LOW6/B2 LOW4, npm14moderate/install-script/Actions runtime warnings, Windows-mounted Ubuntu root-cause uncertainty, Auth0 entitlement and operational/privacy risks remain open; this design closes none of them.

## 18. Implementation-plan handoff conditions / self-check

Next: **independent design review → operator acceptance → design publication/merge → separately authorized implementation plan**. No implementation plan is authored now. A later planner must bind exact paths/signatures/SQL/catalogs/test commands to its then-approved base, preserve all seven hashes, validate current session/ACL/statement semantics with real PG, and map AC01–AC23 to behavioral tests. Do not count missing imports, config errors or absent containers as behavioral RED. New product/security/provider requirements outside this spec are not preapproved.

State-router candidate changes only: STATUS adds B3 design state and review gate; manifest.current_product_task names B3 with implementation_authorized=false and an optional design_candidate pointer (not approved_specs); handoff's Current authorized next task points here without repeating scope. Historical B2 milestone tables and snapshot baseline retain their provenance; “later slices” in the older frozen summary is overridden only for B3 design by the explicit current task, not evidence of implementation. Later slices beyond B3 remain unscoped. Log/pending rows are append-only actual design events, UTC time observed at recording, tokens unknown, sync pending. These documents are a candidate until merged.

| Self-audit question | Resolution in this candidate |
| --- | --- |
| A. Staff-capable authorize_org mistaken for write authority? | No; separate explicit admin predicate, §9/10; AC02/06/13 |
| B. Org-only Unit SELECT leaks peer Units? | No; parent-aware restrictive ceiling and explicit predicate, §10/11; AC11/12 |
| C. Cookie-only POST? | No; exact Origin + current session + session-bound CSRF before mutation, §12; AC14 |
| D. Client role/body grants authority? | No; strict body and current DB relationship, §8/9; AC04/13 |
| E. Address provider scope expansion? | None; §5/8/17; AC20 |
| F. Reference treated as verification or ownership? | Explicitly unverified/manual, no merge, §8/13 |
| G. Duplicate race ends at DB index? | Yes; two-backend observed wait/barrier, §14; AC08/16 |
| H. Old migrations changed? | No; new0008 only, §10/15; AC17 |
| I. F01/F43 prematurely promoted? | Neither; §17, registry unchanged |
| J. Implementation approved? | No; status and next gate explicitly design-only |
| K. Frozen B1/B2 redesigned? | No; additive B3 grants/policies/ports, no auth/session/Property-read reinterpretation |
| L. Web trusts client role? | No; server-derived advisory header and authoritative POST, §13; AC21 |

Pre-publication design self-audit: **BLOCKER0 / HIGH0 / MEDIUM0 / LOW2**. These are executor document conclusions, not independent approval or runtime proof.

- B3D-L01 — No CommandReceipt/exactly-once retry: connection-loss outcome and duplicate manual Property resubmission remain possible. Mitigation is no automatic retry, explicit reconciliation and accurate uncertain-outcome UI (§13/14). Durable idempotency needs a later separately approved scope; address dedupe is not a substitute.
- B3D-L02 — Registration linearizes authority at the final INSERT statement, not a universal revoke/write commit-order lock protocol (§14). Future mutation workflows must design their conflicting locks/lifecycle; no privileged locking expansion or B1 redesign here. This does not weaken deny-after-prior-revoke or B2 read semantics.

Before any branch/commit/push, complete the design self-audit and stop on a remaining BLOCKER/HIGH. For the document candidate run repository scanner/tree/history, scanner unit tests3+14, strict manifest JSON, internal links, exact six-path allowlist, diff check, public-data scan, protected-file comparisons and final UTF-8 bytes/SHA readback. No product runtime suite is required for this docs task. Google Sheets/Drive writes0; OAuth/IAM changes0; EXTERNAL_SYNC=PENDING.

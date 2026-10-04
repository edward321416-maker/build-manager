# Unit Maintenance Fact Timeline v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manager-only, unit-level maintenance fact timeline where an authorized manager explicitly records a minimal structured fact from a completed ticket, corrects mistakes through an append-only revision chain, and sees current tenant outcome/follow-up context without copying person-linked or manager-private ticket content.

**Architecture:** Add a dedicated maintenance-fact contract/application boundary and additive PostgreSQL ledger (`0018`) alongside the existing ticket, manager-work, public-Q&A, and outcome subsystems. Root facts and correction rows are immutable; current state is the correction-chain leaf. Tenant outcome and previous/follow-up ticket relations are projected at read time from existing `0017` data rather than copied into fact rows. The Web adds a manager-only `업무함 / 호실 정비 이력` view plus completed-ticket fact creation/correction controls.

**Tech Stack:** TypeScript 6.0.3, Zod, React 19.2.3, Next.js Web workspace, PostgreSQL 18.x synthetic integration, Vitest 5, Playwright, existing B1/RC1 session/RLS infrastructure, Node >=24 <25.

**Spec:** Approved artifact `2026-10-04-unit-maintenance-fact-timeline-v1-design-reviewed.md` (SHA-256 `77e645fcbf438987192c5ef851c48fdb4e3ecdcd803f97890d5983cafaa4c956`); Task 0 materializes it to `docs/superpowers/specs/2026-10-04-unit-maintenance-fact-timeline-v1-design.md` before product code.

## Global Constraints

- `POLICY_REF`: `e9144fac807f39544932baac25b11f836658dbb3`; re-read current `main` policies before implementation.
- `TARGET_REF`: `c60501a6e59f0572d98e2f1cb7be96d3db7d1545`; re-read actual local/remote lineage before editing and preserve newer authorized work.
- Expected next additive migration: `0018_core_unit_maintenance_fact.sql`; migrations `0001`–`0017` are frozen.
- v1 is **manager-only**. No tenant maintenance-fact endpoint, count, correction timestamp, or UI.
- Facts are **explicitly manager-recorded**, never auto-created from completed tickets.
- Source must be `COMPLETED`; source `issueType`, `unitId`, organization, and `sourceCompletedAt` are server-derived.
- `sourceCompletedAt` means **manager handling completion record time**, not certified physical repair time.
- Action kinds are exactly `INSPECTION | REPAIR | PART_REPLACEMENT | ADJUSTMENT | OTHER`.
- Optional `componentLabel`: trimmed, 1–80 chars when present, no Unicode control/format chars; never auto-exposed to tenants.
- No tenant raw text, protocol answers, public-Q&A text, photos, tenant identity, private notes, priority, assignee, or internal due time is copied into the fact table/DTO.
- Corrections are append-only rows. No fact UPDATE/DELETE API.
- One root fact chain per source ticket. A correction can have only one child; no branch.
- Current tenant outcome and previous/follow-up ticket relation are derived at read time from existing outcome/follow-up tables.
- Existing RC1 ticket, Q&A, outcome, work queue, photo, handling, onboarding and authorization behavior must remain unchanged.
- No new dependency, Auth0/IAM change, Expo/native work, production deploy, Ready conversion, or main merge.
- Normal push to the currently authorized Draft branch is allowed only after local final candidate verification and concurrency preflight.
- Final published candidate must receive fresh exact-head required CI **9/9 SUCCESS**.
- Preserve pre-existing dirty work; no reset/rebase/stash/force push/history rewrite.

## Review Focus

1. **Completion timestamp provenance:** the fact must persist the source ticket's completed `updated_at`; tests must prove a manager cannot submit another timestamp and that later outcome/follow-up activity does not alter the stored fact timestamp.
2. **Correction-chain branching:** two corrections from the same current fact must serialize so one wins and one returns `409`; the database must make a two-child branch impossible even under direct SQL.
3. **Projection privacy:** timeline outcome/relation projection must never pull tenant text, public message body, photo metadata, internal notes, priority, assignee, due time, actor IDs, or tenant IDs into the maintenance DTO.
4. **Authorization after lock wait:** PROPERTY_STAFF assignment revocation while waiting on the source-ticket lock must be rechecked before root fact/correction commit.
5. **Response-loss / replay authorization:** first create/correction may commit while HTTP response is lost; retry with the same request UUID must recover the same fact/correction only while current authorization still holds. Changed payload returns `409`; replay after scope revocation is denied.

---

## File Map

### New files

- `packages/api-contracts/src/core-maintenance-fact.ts` — strict Zod contracts and DTO/input types.
- `packages/api-contracts/src/core-maintenance-fact.test.ts` — contract privacy/strictness tests.
- `packages/application/src/core-maintenance-fact.ts` — application types/scope and manager role guards.
- `packages/api-client/src/core-maintenance-fact.ts` — manager maintenance API client.
- `packages/persistence-postgres/migrations/0018_core_unit_maintenance_fact.sql` — append-only fact ledger, correction chain, RLS/functions.
- `tests/postgres/core-maintenance-fact.test.ts` — database, concurrency, privacy and projection tests.
- `apps/web/src/server/core-flow/maintenance-fact.test.ts` — HTTP/role/input/error tests.
- `apps/web/src/app/core/manager-maintenance-timeline.tsx` — manager timeline + completed-ticket fact editor/correction UI.
- `apps/web/src/app/core/manager-maintenance-timeline.module.css` — scoped timeline/editor presentation.
- `apps/web/src/app/core/manager-maintenance-timeline.test.tsx` — focused UI behavior tests.
- `apps/web/tests/core-e2e/maintenance-fact.spec.ts` — actual synthetic Core Web flow.
- `apps/web/tests/core-login-e2e/maintenance-fact.spec.ts` — B1 SDK/current-scope/negative controls.
- `scripts/core-maintenance-fact-restart-check.mjs` — owned-server persistence proof.
- `ops/core_flow_rc1_unit_maintenance_fact.md` — execution/AC evidence map.

### Existing files to modify

- `packages/api-contracts/src/index.ts` — export maintenance contract.
- `packages/application/src/core-flow.ts` — add `maintenance: CoreMaintenanceFactScope` to `CoreScope`.
- `packages/application/src/index.ts` — export application maintenance types.
- `packages/api-client/src/core-flow.ts` — expose `maintenance`.
- `packages/persistence-postgres/src/core-flow.ts` — bind maintenance scope functions.
- `tests/postgres/core-flow.test.ts` — update the exact global core-flow table/function inventory for additive `0018` objects.
- `apps/web/src/server/core-flow/http.ts` — manager-only maintenance routes.
- `apps/web/src/app/core/core-screen.tsx` — manager `업무함 / 호실 정비 이력` navigation and integration.
- `apps/web/src/app/core/core-design.module.css` — only minimal current-design integration if needed.
- exact catalog/inventory tests that enumerate core-flow tables/functions — additive updates only.
- `docs/core-flow-rc1-running.md` — only if actual reproduction commands or UI path need documenting.
- append-only project bookkeeping paths required by current policy.

---

### Task 0: Canonicalize the approved spec/plan and freeze the execution baseline

**Files:**
- Create: `docs/superpowers/specs/2026-10-04-unit-maintenance-fact-timeline-v1-design.md`
- Create: `docs/superpowers/plans/2026-10-04-unit-maintenance-fact-timeline-v1.md`

**Interfaces:**
- Consumes: the operator-approved reviewed design artifact SHA-256 `77e645fcbf438987192c5ef851c48fdb4e3ecdcd803f97890d5983cafaa4c956` and the operator-approved implementation-plan artifact supplied with the execution packet.
- Produces: repository-local canonical design/plan bytes for later task receipts; no product/runtime behavior.

- [ ] **Step 1: Re-read policy and repository lineage**

Record current `main` policy ref, local HEAD, remote PR #70 HEAD, branch, staged paths and dirty/untracked paths. Confirm the approved target `c60501a6e59f0572d98e2f1cb7be96d3db7d1545` is safely in the local lineage or explicitly account for a newer authorized descendant. Do not reset/rebase/stash to manufacture the expected state.

- [ ] **Step 2: Materialize the approved design and plan bytes**

Write the supplied approved design into the canonical spec path and the supplied approved plan into the canonical plan path. If either path already exists with different content, stop that documentation write and report `PLAN_ARTIFACT_CONFLICT`; do not overwrite an independently changed canonical artifact.

- [ ] **Step 3: Verify the design bytes**

Run SHA-256 on the canonical spec and require:

```text
77e645fcbf438987192c5ef851c48fdb4e3ecdcd803f97890d5983cafaa4c956
```

For the plan, record the actual SHA-256 after materialization in the execution receipt; the plan does not self-embed its own hash.

- [ ] **Step 4: Commit documentation only**

Stage only the two canonical documentation paths and commit:

```text
docs(core): freeze unit maintenance fact design
```

No product code, migration, runtime, DB, PR state or deployment change belongs in this commit.

---

### Task 1: Define strict maintenance contracts and application boundary

**Files:**
- Create: `packages/api-contracts/src/core-maintenance-fact.ts`
- Create: `packages/api-contracts/src/core-maintenance-fact.test.ts`
- Modify: `packages/api-contracts/src/index.ts`
- Create: `packages/application/src/core-maintenance-fact.ts`
- Modify: `packages/application/src/core-flow.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**

- Produces `CoreMaintenanceActionKind`:
  `INSPECTION | REPAIR | PART_REPLACEMENT | ADJUSTMENT | OTHER`.
- Produces `CoreMaintenanceCorrectionReason`:
  `ACTION_CLASSIFICATION | COMPONENT_LABEL | OTHER`.
- Produces `CoreUnitMaintenanceFact`.
- Produces `CoreMaintenanceFactRevision`.
- Produces `CoreMaintenanceFactDetail`.
- Produces `CoreMaintenanceFactCreate`.
- Produces `CoreMaintenanceFactCorrection`.
- Produces `CoreMaintenanceFactScope`.
- `CoreScope` gains `maintenance: CoreMaintenanceFactScope`.

- [ ] **Step 1: Write contract RED tests**

Create tests asserting:

```ts
CoreMaintenanceFactCreateSchema.parse({
  clientRequestId: randomUUID(),
  actionKind: "REPAIR",
  componentLabel: "보일러 순환펌프",
});
```

passes, while each of these fails:

```ts
{ ...valid, actionKind: "REPLACE" }
{ ...valid, componentLabel: " " }
{ ...valid, componentLabel: "x".repeat(81) }
{ ...valid, componentLabel: "a\u200bb" }
{ ...valid, tenantId: randomUUID() }
{ ...valid, sourceCompletedAt: "2026-10-04T00:00:00Z" }
```

Also assert the public fact DTO has exactly the selected manager-facing fields and contains none of:

```text
tenantId
actorId
rawUserText
message
photo
internalNote
priority
assigneeLabel
dueAt
recordedBy
```

- [ ] **Step 2: Run contract RED**

Run:

```powershell
npm run test:shared -- packages/api-contracts/src/core-maintenance-fact.test.ts
```

Expected: behavioral RED because schemas/types do not yet exist. Do not count a missing import alone as sufficient RED; add the file skeleton if needed and confirm the intended assertions fail.

- [ ] **Step 3: Implement contract types and strict schemas**

Implement:

```ts
CoreMaintenanceActionKindSchema
CoreMaintenanceCorrectionReasonSchema
CoreMaintenanceComponentLabelSchema
CoreMaintenanceFactCreateSchema
CoreMaintenanceFactCorrectionSchema
CoreUnitMaintenanceFactSchema
CoreMaintenanceFactRevisionSchema
CoreMaintenanceFactDetailSchema
CoreUnitMaintenanceFactsSchema
```

`CoreUnitMaintenanceFact` fields:

```ts
factId:string;
unitId:string;
buildingId:string;
buildingName:string;
unitLabel:string;
sourceTicketId:string;
issueType:"HEATING"|"LEAK";
actionKind:CoreMaintenanceActionKind;
componentLabel:string|null;
sourceCompletedAt:string;
recordedAt:string;
corrected:boolean;
correctionCount:number;
tenantOutcome:"UNCONFIRMED"|"RESOLVED"|"UNRESOLVED"|"RECURRENCE_CLAIM";
previousTicketId:string|null;
followUpTicketId:string|null;
```

`CoreMaintenanceFactRevision` fields:

```ts
factId:string;
actionKind:CoreMaintenanceActionKind;
componentLabel:string|null;
recordedAt:string;
correctionReason:CoreMaintenanceCorrectionReason|null;
current:boolean;
```

`CoreMaintenanceFactDetail`:

```ts
{current:CoreUnitMaintenanceFact|null;revisions:CoreMaintenanceFactRevision[]}
```

Correction input:

```ts
{
  clientRequestId:string;
  expectedCurrentFactId:string;
  actionKind:CoreMaintenanceActionKind;
  componentLabel:string|null;
  correctionReason:CoreMaintenanceCorrectionReason;
}
```

- [ ] **Step 4: Add application scope and role guards**

Create:

```ts
export type CoreMaintenanceFactScope = {
  listUnit(unitId:string):Promise<CoreUnitMaintenanceFact[]>;
  readForTicket(ticketId:string):Promise<CoreMaintenanceFactDetail>;
  create(ticketId:string,input:CoreMaintenanceFactCreate):
    Promise<{fact:CoreUnitMaintenanceFact;created:boolean}>;
  correct(factId:string,input:CoreMaintenanceFactCorrection):
    Promise<{fact:CoreUnitMaintenanceFact;created:boolean}>;
};
```

Add manager-only wrappers:

```ts
createCoreMaintenanceFact(scope,ticketId,input)
correctCoreMaintenanceFact(scope,factId,input)
```

Both reject TENANT with `CoreFlowError("FORBIDDEN")`.

Reads are also manager-only at the HTTP boundary; application scope itself stays persistence-oriented.

Public HTTP mutation responses are intentionally the strict `CoreUnitMaintenanceFact` DTO only; `created:boolean` remains an application/persistence concern used to select HTTP `201` vs exact-replay `200`. The typed API client returns `Promise<CoreUnitMaintenanceFact>` for both create and correction and does not infer idempotency from status.

- [ ] **Step 5: Run focused GREEN**

Run:

```powershell
npm run test:shared -- packages/api-contracts/src/core-maintenance-fact.test.ts
npm run typecheck:tests
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Stage only Task 1 paths.

Suggested commit:

```text
feat(core): define maintenance fact contracts
```

---

### Task 2: Add append-only PostgreSQL fact ledger and correction chain

**Files:**
- Create: `packages/persistence-postgres/migrations/0018_core_unit_maintenance_fact.sql`
- Create: `tests/postgres/core-maintenance-fact.test.ts`
- Modify: `tests/postgres/core-flow.test.ts` — exact global table/function inventory.
- Modify other catalog/inventory tests only if a fresh search proves they enumerate the exact object set touched by `0018`; name every such path in the task receipt before editing it.

**Interfaces:**

Migration creates `core_flow.unit_maintenance_fact` and runtime functions:

```text
read_unit_maintenance_facts
read_ticket_maintenance_fact
create_unit_maintenance_fact
correct_unit_maintenance_fact
```

Private helpers may include:

```text
maintenance_ticket
maintenance_current_fact
maintenance_fact_json
maintenance_request_fingerprint
```

Private helpers must not be executable by `bm_b1_web`.

- [ ] **Step 1: Write PostgreSQL RED for base schema/security**

Tests must prove:

- table owner is `bm_core_flow_owner`;
- RLS enabled and forced;
- org ceiling policy exists;
- `bm_b1_web` has no direct table privileges;
- PUBLIC has no table/function access;
- private/public function EXECUTE lists are exact;
- migration `0018` is additive and older migration bytes are untouched.

- [ ] **Step 2: Write PostgreSQL RED for root fact creation**

Create a completed synthetic source ticket.

Assert manager create:

```ts
{
  clientRequestId:key,
  actionKind:"REPAIR",
  componentLabel:"합성 보일러 밸브",
}
```

produces one fact whose server-derived fields match:

- source org;
- source unit;
- source `issueType`;
- source completed ticket `updated_at`.

Snapshot before/after must prove source ticket, source events, photos, Q&A, outcome, work metadata and notes are unchanged by fact creation.

- [ ] **Step 3: Add Review Focus test — completion timestamp provenance**

Before fact creation, capture:

```sql
SELECT updated_at FROM core_flow.ticket WHERE id=$1
```

After fact creation and after an outcome/follow-up projection changes, assert:

- stored `source_completed_at` equals the original completed `updated_at`;
- fact bytes remain unchanged;
- client cannot supply/override the timestamp through SQL runtime function input.

- [ ] **Step 4: Write root eligibility/authorization RED**

Assert:

- OPEN source → `STATE_CONFLICT`;
- IN_PROGRESS source → `STATE_CONFLICT`;
- TENANT runtime function call → forbidden/no route;
- other-org manager → non-disclosure;
- PROPERTY_STAFF assigned property succeeds;
- unassigned property fails.

- [ ] **Step 5: Write root idempotency/concurrency RED**

Cases:

1. same actor + same request UUID + same payload → one row, replay same fact;
2. same UUID + changed action/component/source → `STATE_CONFLICT`;
3. two managers/staff at same no-fact source with different requests → exactly one root fact;
4. no duplicate root fact under direct concurrent SQL.

Pin one root per source using a partial unique index or equivalent database constraint.

- [ ] **Step 6: Add Review Focus test — assignment revoked during lock wait**

Using two controlled PostgreSQL clients:

1. manager A locks source ticket;
2. staff B begins fact creation and waits;
3. revoke staff property assignment;
4. release A;
5. B must fail authorization after wake;
6. no fact row exists for B's attempt.

Also create a successful root fact and correction as PROPERTY_STAFF, then revoke that assignment and replay each exact request UUID. Both replays must be denied after current authorization recheck; an old request UUID is never an access bypass.

- [ ] **Step 7: Write correction-chain RED**

Create root fact, then correction:

```ts
{
  expectedCurrentFactId:root.factId,
  actionKind:"PART_REPLACEMENT",
  componentLabel:"합성 순환펌프",
  correctionReason:"ACTION_CLASSIFICATION",
}
```

Assert:

- root row bytes unchanged;
- correction row references root;
- current projection is correction;
- revision list contains both rows oldest→newest;
- current flags are `[false,true]`;
- source ticket/unit/issue/completion timestamp identical across chain.

- [ ] **Step 8: Add Review Focus test — no branch under concurrent corrections**

Controlled race:

- both managers read same current fact;
- A correction commits;
- B correction waits on same source/current chain;
- B returns `STATE_CONFLICT`;
- exactly one child references the old current fact;
- direct SQL attempt to insert a second child violates a unique/FK/check constraint.

- [ ] **Step 9: Write correction replay/stale RED**

Assert:

- exact same correction request UUID returns saved correction;
- same UUID changed payload → `409` equivalent application error;
- stale `expectedCurrentFactId` → `STATE_CONFLICT`;
- path `factId` must identify the same current fact named by `expectedCurrentFactId`; contradictory/stale path+body pairs return `STATE_CONFLICT`;
- same action kind + same component label as the current fact → `INVALID_INPUT`;
- correction cannot change source dimensions.

- [ ] **Step 10: Write projection privacy RED**

Seed source with:

- raw tenant issue text;
- protocol answer;
- public Q&A body;
- photo;
- internal note;
- URGENT priority;
- assignee label;
- due time;
- tenant/outcome identity data.

`read_unit_maintenance_facts` and `read_ticket_maintenance_fact` JSON must contain none of those private/person-linked values or keys.

It may contain only the approved fact fields and current outcome/relation identifiers.

- [ ] **Step 11: Write dynamic outcome/relation projection RED**

Create root fact before tenant outcome.

Then change existing source outcome using current RC1 flow:

- `UNCONFIRMED → RESOLVED`, or
- completed source → recurrence follow-up.

Assert the fact table row hash is unchanged while timeline DTO updates:

```text
tenantOutcome
followUpTicketId
previousTicketId
```

from existing `0017` state.

- [ ] **Step 12: Write replacement-tenant isolation RED**

A replacement tenant on same unit:

- cannot invoke/list/read maintenance manager functions;
- receives no maintenance API surface;
- old source ticket protections remain intact.

- [ ] **Step 13: Implement `0018`**

Table design decisions:

```text
id uuid PK
org_id uuid
unit_id uuid
source_ticket_id text
issue_type text
action_kind text
component_label text NULL
source_completed_at timestamptz
recorded_by uuid
recorded_at timestamptz
replaces_fact_id uuid NULL
correction_reason text NULL
client_request_id uuid
request_fingerprint bytea
```

Constraints:

- root row: `replaces_fact_id IS NULL` and `correction_reason IS NULL`;
- correction row: both non-null;
- `CHECK (replaces_fact_id IS NULL OR replaces_fact_id <> id)` prevents a self-cycle;
- one root per `(org_id,source_ticket_id)`;
- one child per replaced fact;
- unique `(org_id,recorded_by,client_request_id)`;
- `request_fingerprint` must be exactly 32 bytes;
- add a composite UNIQUE key on the immutable fact dimensions needed by the correction FK, and make each correction reference the replaced row through those same `org_id/unit_id/source_ticket_id/issue_type/source_completed_at` dimensions so direct SQL cannot silently change them;
- source ticket/unit relation and `COMPLETED` status are validated by the mutation function after the source-ticket lock and authority recheck;
- action/component validation exists both contract-side and SQL-side;
- a correction where both `action_kind` and `component_label` equal the current fact is `INVALID_INPUT` (no-op corrections are not records).

Root create derives:

```text
org_id
unit_id
issue_type = ticket.body->>'issueType'
source_completed_at = completed ticket.updated_at
recorded_by = current actor
```

Correction copies immutable source dimensions from current fact.

- [ ] **Step 14: Implement current projection SQL**

Timeline/read functions compute:

- current leaf fact;
- correction count;
- latest tenant outcome from `ticket_outcome_assertion`;
- previous source ticket from `ticket_follow_up.target_ticket_id = source_ticket_id`;
- next target from `ticket_follow_up.source_ticket_id = source_ticket_id`.

Do not copy these into fact rows.

Current-leaf and revision-chain rules:

- select the current fact as the row in the source chain for which no child row has `replaces_fact_id = current.id`;
- build revision order by chain traversal/depth, not by timestamp alone;
- `correctionCount = chain row count - 1`;
- `corrected = correctionCount > 0`.

- [ ] **Step 15: Pin timeline ordering and the 100-row bound**

Seed at least 101 synthetic completed-source fact chains for one authorized unit using fixture/admin setup that does not bypass the runtime read function under test. Assert `read_unit_maintenance_facts` returns exactly 100 **current** leaf rows ordered by:

```text
sourceCompletedAt DESC
factId ASC
```

A correction must not move a source to the top merely because the correction was recorded later.

- [ ] **Step 16: Run focused PostgreSQL GREEN**

Run:

```powershell
npm run test:postgres -- tests/postgres/core-maintenance-fact.test.ts
```

Expected: all focused tests PASS.

Then run:

```powershell
npm run test:postgres
```

Expected: full PostgreSQL suite PASS with no previous regression removed.

- [ ] **Step 17: Commit Task 2**

Suggested commit:

```text
feat(core): persist unit maintenance facts
```

---

### Task 3: Bind persistence scope, HTTP routes and typed API client

**Files:**
- Modify: `packages/persistence-postgres/src/core-flow.ts`
- Create: `packages/api-client/src/core-maintenance-fact.ts`
- Modify: `packages/api-client/src/core-flow.ts`
- Modify: `apps/web/src/server/core-flow/http.ts`
- Create: `apps/web/src/server/core-flow/maintenance-fact.test.ts`

**Interfaces:**

`createCoreFlowClient(...).maintenance` exposes:

```ts
listUnit(unitId:string):Promise<CoreUnitMaintenanceFact[]>
readForTicket(ticketId:string):Promise<CoreMaintenanceFactDetail>
create(ticketId:string,input:CoreMaintenanceFactCreate):Promise<CoreUnitMaintenanceFact>
correct(factId:string,input:CoreMaintenanceFactCorrection):Promise<CoreUnitMaintenanceFact>
```

The correction call uses the current fact ID in both the route and `expectedCurrentFactId`; the server treats any mismatch as stale/conflicting state.

Routes:

```text
GET  /api/v2/core/manager/units/:unitId/maintenance-timeline
GET  /api/v2/core/manager/tickets/:ticketId/maintenance-fact
POST /api/v2/core/manager/tickets/:ticketId/maintenance-fact
POST /api/v2/core/manager/maintenance-facts/:factId/corrections
```

- [ ] **Step 1: Write HTTP RED for manager routes**

Tests assert:

- ORG_ADMIN GET list/detail → 200;
- PROPERTY_STAFF scoped GET → 200;
- TENANT every maintenance route → 403 before persistence call;
- invalid UUID/path → 400 or current consistent sanitized route behavior;
- `Cache-Control: private, no-store`;
- source/actor/org/server-derived fields in mutation bodies are rejected by strict schemas;
- the unit timeline returns at most 100 facts and preserves the DB-defined `sourceCompletedAt DESC, factId ASC` order without client-side resorting.

- [ ] **Step 2: Write HTTP RED for create/replay/conflict**

Mock scope results:

- first create application result `{fact,created:true}` → HTTP 201 with **fact DTO only**;
- exact replay `{fact,created:false}` → HTTP 200 with the same **fact DTO only**;
- `CoreFlowError("STATE_CONFLICT")` → sanitized 409;
- raw database/stack strings never appear.

- [ ] **Step 3: Write HTTP RED for correction**

Assert strict correction input:

- valid current fact UUID/reason/action/component accepted;
- missing expected current ID rejected;
- extra `recordedBy`, `tenantId`, `unitId`, `sourceTicketId` rejected;
- stale scope error → 409.

- [ ] **Step 4: Implement persistence scope binding**

In `createCoreFlowPort` add:

```ts
maintenance:{
  listUnit: ...,
  readForTicket: ...,
  create: ...,
  correct: ...,
}
```

Use only SQL functions from Task 2.

No direct table query in application/Web.

- [ ] **Step 5: Implement typed API client**

`coreMaintenanceFact(fetcher,baseUrl)` uses the new strict schemas and routes.

Attach it to `createCoreFlowClient` as:

```ts
maintenance:coreMaintenanceFact(fetcher,options.baseUrl)
```

- [ ] **Step 6: Implement HTTP routes**

Keep the existing manager-role guard:

```ts
ORG_ADMIN | PROPERTY_STAFF
```

Route new manager requests before the old `segments[1] === "tickets" && length === 4` narrow branch so the current manager router does not reject the new unit/fact paths.

Do not globally relax query parsing.

- [ ] **Step 7: Run focused GREEN**

Run:

```powershell
npm --workspace @build-manager/web run test -- src/server/core-flow/maintenance-fact.test.ts
npm run test:shared
npm run typecheck:tests
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Suggested commit:

```text
feat(core): expose maintenance fact API
```

---

### Task 4: Add manager completed-ticket fact creation and append-only correction UI

**Files:**
- Create: `apps/web/src/app/core/manager-maintenance-timeline.tsx`
- Create: `apps/web/src/app/core/manager-maintenance-timeline.module.css`
- Create: `apps/web/src/app/core/manager-maintenance-timeline.test.tsx`
- Modify: `apps/web/src/app/core/core-screen.tsx`
- Modify: `apps/web/src/app/core/core-design.module.css` only if current composition requires it.

**Interfaces:**

Export focused components:

```ts
ManagerMaintenanceFactEditor
ManagerMaintenanceTimeline
```

`ManagerMaintenanceFactEditor` receives:

```ts
client:CoreFlowClient;
ticket:CoreTicketDto;
revision:number;
onOpenTicket(id:string):void;
onChanged():void;
```

Only render mutation controls for manager roles through its manager-only parent.

- [ ] **Step 1: Write UI RED — no fact / completed eligibility**

For `COMPLETED` manager ticket with detail `{current:null}` assert:

- title `정비 사실 기록`;
- action-kind selector has exactly five choices;
- optional component input;
- warning `개인 이름·연락처·출입정보는 적지 마세요.`;
- save button.

For `OPEN/IN_PROGRESS`, no create form.

- [ ] **Step 2: Write UI RED — current fact**

When fact exists, assert:

- action label;
- component label if present;
- source completion-record time;
- tenant outcome wording;
- correction indicator/count;
- `호실 이력에서 보기`;
- `정정 기록 추가`;
- no edit/delete button.

- [ ] **Step 3: Write UI RED — correction form and stale state**

Correction form:

- initializes current action/component for convenience;
- requires a changed value;
- requires correction reason;
- submits `expectedCurrentFactId=current.factId`.

On 409:

- preserves local inputs;
- reloads latest detail;
- displays “다른 정정이 먼저 저장됨” semantics;
- does not auto-submit again.

- [ ] **Step 4: Add component-label safety test**

Use synthetic long/unbroken and HTML-like input.

Assert:

- maxLength 80;
- React renders as text;
- no DOM injection;
- warning visible;
- invalid control char never reaches client call after contract parsing.

- [ ] **Step 5: Implement editor**

Use existing `ApiClientError` handling conventions.

Generate mutation request UUID once per attempt.

For uncertain failures do not silently create a new UUID and resubmit.

A refresh/re-read of `maintenance.readForTicket` is the recovery source of truth.

For an uncertain response, matching visible values alone are not proof that this actor's request committed. The UI may present the server's current fact, but it must not claim an exact replay was recovered unless the same request UUID is retried and the server returns success. If server state differs from the attempted input, retain the user's input for review and surface conflict rather than auto-resubmitting.

- [ ] **Step 6: Integrate editor into completed manager ticket detail**

In the current manager inspector/detail hierarchy, add `ManagerMaintenanceFactEditor` adjacent to manager operational controls, but visually separate it from:

- private work metadata/internal notes;
- public conversation;
- handling history.

Do not put it in tenant detail.

- [ ] **Step 7: Run focused GREEN**

Run:

```powershell
npm --workspace @build-manager/web run test -- src/app/core/manager-maintenance-timeline.test.tsx
npm --workspace @build-manager/web run typecheck
npm --workspace @build-manager/web run lint
```

Expected: test PASS, typecheck PASS, lint 0 errors.

- [ ] **Step 8: Commit Task 4**

Suggested commit:

```text
feat(web): record maintenance facts on completed tickets
```

---

### Task 5: Add manager unit maintenance timeline view

**Files:**
- Modify: `apps/web/src/app/core/manager-maintenance-timeline.tsx`
- Modify: `apps/web/src/app/core/manager-maintenance-timeline.module.css`
- Modify: `apps/web/src/app/core/manager-maintenance-timeline.test.tsx`
- Modify: `apps/web/src/app/core/core-screen.tsx`

**Interfaces:**

`ManagerMaintenanceTimeline` receives:

```ts
client:CoreFlowClient;
units:CoreUnitDto[];
revision:number;
disabled:boolean;
onOpenTicket(id:string):void;
```

- [ ] **Step 1: Write timeline RED**

Assert states:

- loading is distinct from empty;
- error has retry;
- no facts → `아직 기록된 정비 사실이 없습니다.`;
- loaded rows newest-first;
- selected unit changes request unit ID;
- row displays only approved fact fields.

- [ ] **Step 2: Write privacy rendering RED**

Seed DTO-like fixture strings containing recognizable synthetic private values in non-contract source context and assert the timeline component never accepts/renders fields for:

```text
tenant
raw text
Q&A body
photo
note
priority
assignee
due
```

The component should accept only the strict maintenance fact DTO.

- [ ] **Step 3: Write recurrence-chain wording RED**

For:

```text
tenantOutcome=RECURRENCE_CLAIM
previousTicketId!=null
followUpTicketId!=null
```

assert UI uses claim-safe wording:

- `세입자가 다시 문제가 생겼다고 응답`
- `이전 완료 접수에서 이어진 건`
- `후속 접수 있음`

and never `재발 확인`, `수리 실패`, or `동일 원인`.

- [ ] **Step 4: Add manager workspace switch**

Add a small manager-only switch:

```text
업무함 | 호실 정비 이력
```

Rules:

- add explicit local view state `WORK_QUEUE | MAINTENANCE`;
- default remains `WORK_QUEUE`;
- current Manager Work Queue behavior is untouched;
- tenant never sees this switch;
- switching views never mutates server ticket/session data;
- an existing selected-ticket object may remain in memory but is hidden while `MAINTENANCE` is active;
- `근거 접수 보기` switches to `WORK_QUEUE` and opens the authorized source ticket through the existing `client.read` path;
- returning to `WORK_QUEUE` restores the existing queue/detail behavior rather than creating a second manager shell.

- [ ] **Step 5: Implement timeline cards**

Each card shows:

- issue type;
- action kind;
- component label if non-null;
- `관리자 처리 완료 기록` time;
- tenant outcome;
- relation indicators;
- correction indicator;
- `근거 접수 보기`.

`onOpenTicket(sourceTicketId)` uses the existing authorized ticket detail path.

- [ ] **Step 6: Add 390px component test/probe support**

CSS requirements:

- single-column cards;
- no fixed wide grid;
- `overflow-wrap:anywhere` or equivalent for component label/ticket IDs where needed;
- controls minimum current design touch target;
- no horizontal scroll introduced.

- [ ] **Step 7: Run focused GREEN**

Run:

```powershell
npm --workspace @build-manager/web run test -- src/app/core/manager-maintenance-timeline.test.tsx
npm --workspace @build-manager/web run typecheck
npm --workspace @build-manager/web run lint
```

Expected: PASS, no new lint errors.

- [ ] **Step 8: Commit Task 5**

Suggested commit:

```text
feat(web): add unit maintenance timeline
```

---

### Task 6: Add actual browser flows and scope/privacy regressions

**Files:**
- Create: `apps/web/tests/core-e2e/maintenance-fact.spec.ts`
- Create: `apps/web/tests/core-login-e2e/maintenance-fact.spec.ts`
- Modify: existing browser fixtures/helpers only if the new tests need reusable synthetic setup; no weakening of old assertions.

**Interfaces:**

Browser uses actual current Web routes/UI and existing synthetic sessions.

- [ ] **Step 1: Add Core browser happy path**

Actual flow:

1. manager opens completed ticket;
2. creates `REPAIR` fact + synthetic component;
3. source remains completed;
4. opens `호실 정비 이력`;
5. selects unit;
6. fact appears;
7. opens source ticket;
8. adds correction to `PART_REPLACEMENT`;
9. returns timeline;
10. corrected fact is current and correction indicator visible.

- [ ] **Step 2: Add actual outcome/follow-up projection flow**

Use current completion-follow-up behavior:

1. fact exists;
2. tenant outcome changes;
3. manager refreshes timeline;
4. outcome projection changes;
5. fact action/component/recorded timestamps remain unchanged;
6. follow-up relation appears with claim-safe wording.

- [ ] **Step 3: Add manager-private/person-linked non-copy browser assertion**

Source contains synthetic:

- raw issue text;
- public message;
- photo;
- internal note;
- URGENT work metadata.

Timeline DOM must not contain those recognizable values.

Opening source ticket separately may contain authorized source context; timeline itself must not.

- [ ] **Step 4: Add 390px actual browser case**

At viewport 390px:

- switch to maintenance view;
- select unit;
- inspect long synthetic component label;
- open correction form;
- verify no horizontal overflow;
- primary controls visible/usable.

- [ ] **Step 5: Add B1 SDK staff-scope case**

PROPERTY_STAFF:

- assigned unit timeline loads;
- unassigned unit request is denied/non-disclosed;
- revoke assignment;
- next timeline/detail/create/correct operation is denied;
- protected timeline state is cleared/not retained in DOM.

- [ ] **Step 6: Add tenant negative control**

Tenant cannot use:

```text
GET manager/units/:unitId/maintenance-timeline
GET/POST manager/tickets/:ticketId/maintenance-fact
POST manager/maintenance-facts/:factId/corrections
```

Verify 403/404 semantics match the manager router and no fact IDs/body leak.

- [ ] **Step 7: Run targeted browser GREEN**

After re-reading the current configs, run from the repository root:

```powershell
npm exec --workspace @build-manager/web -- playwright test --config playwright.core.config.ts tests/core-e2e/maintenance-fact.spec.ts
npm exec --workspace @build-manager/web -- playwright test --config playwright.core-login.config.ts tests/core-login-e2e/maintenance-fact.spec.ts
```

Expected:

- new Core maintenance cases PASS;
- new B1 SDK maintenance cases PASS.

If the installed Playwright CLI at the execution HEAD resolves test paths differently, use `Push-Location apps/web` plus the same config and workspace-relative `tests/...` path, record the exact working command, and do not broaden the run merely to hide a path-resolution error.

Do not alter timeouts to make them pass.

- [ ] **Step 8: Commit Task 6**

Suggested commit:

```text
test(web): cover maintenance fact workflows
```

---

### Task 7: Add restart/idempotency runtime proof and full regression

**Files:**
- Create: `scripts/core-maintenance-fact-restart-check.mjs`
- Modify/Create: `ops/core_flow_rc1_unit_maintenance_fact.md`
- Modify: `docs/core-flow-rc1-running.md` only if the reproduction path gains a new manager view instruction.

**Interfaces:**

Restart helper records synthetic IDs outside Git/private temp only and verifies across distinct owned server processes.

- [ ] **Step 1: Implement restart helper**

Persist before restart:

- root fact;
- one correction;
- source ticket;
- source tenant outcome;
- source/follow-up relation if present.

After owned-server restart, verify:

- same root/correction fact IDs;
- same current fact;
- same source-completion timestamp;
- same revision chain;
- same dynamic outcome/relation projection.

Do not terminate unrelated/shared processes.

- [ ] **Step 2: Add response-loss replay runtime proof**

For create and correction, simulate commit + lost response through existing test/harness technique.

Then replay same request UUID.

Assert:

- same fact/correction returned;
- no duplicate rows;
- changed replay returns 409.

- [ ] **Step 3: Run full local standard gates**

At final local candidate:

```powershell
npm run test:postgres
npm run test:shared
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run verify
```

Also run:

- current Core browser suite;
- current B1 SDK browser suite;
- standard Web E2E with the existing `BUILD_MANAGER_E2E_PREBUILT=1` convention after a fresh Web build;
- standard B1 E2E with the same prebuilt convention, followed by `node apps/web/tests/b1-e2e/check-results.mjs`;
- Mobile once with a fresh private cache path when the current canonical procedure requires cold-cache evidence;
- scanner regression suites;
- all relevant existing RC1 restart helpers;
- new maintenance restart helper.

Record actual counts; do not predict them.

- [ ] **Step 4: Run preservation regressions**

Explicitly verify existing:

- Manager Work Queue;
- public Q&A;
- completion outcome/follow-up;
- photos;
- protocol;
- handling;
- onboarding/auth boundaries.

No migration/lock/workflow/dependency drift.

- [ ] **Step 5: Build the 34-AC evidence map**

In `ops/core_flow_rc1_unit_maintenance_fact.md`, map every design AC01–AC34 to:

- DB;
- HTTP;
- unit/component;
- actual browser;
- restart;
- hosted CI where applicable.

Keep executor evidence distinct from independent review.

- [ ] **Step 6: Commit Task 7**

Suggested commit:

```text
test(core): verify maintenance fact persistence
```

---

### Task 8: Freeze public candidate, push Draft branch, and verify exact-head 9/9 CI

**Files:**
- Modify append-only operational records required by current project policy.
- Update PR #70 body/receipt.
- No new product behavior unless final verification finds a scoped BLOCKER/HIGH.

**Interfaces:**

Final success label:

`UNIT_MAINTENANCE_FACT_TIMELINE_V1_RUNNABLE`

- [ ] **Step 1: Pre-publication concurrency/Git check**

Record:

```powershell
git status --short
git branch --show-current
git log --oneline --decorate -15
git diff --check
```

Preserve unrelated dirty paths.

Never bulk-stage.

- [ ] **Step 2: Run public/staged/history safety gates**

Use current canonical scanner commands from the repository.

Verify:

- candidate index/tree;
- internal links;
- reachable history;
- no real PII/secrets/private screenshots.

Scanner exceptions are not added to make the candidate pass.

- [ ] **Step 3: Fix final candidate commit(s) only if needed**

If no product bytes changed since Task 7 verification, do not manufacture a no-op commit.

If an actual final scoped defect is fixed, rerun the affected + standard gates before publication.

- [ ] **Step 4: Normal push**

Before push:

- fetch remote;
- verify PR #70 lineage;
- ensure no unexpected remote divergence.

Use normal push only.

No force push.

- [ ] **Step 5: Re-read remote PR exact head**

Confirm remote PR #70 points to final candidate SHA.

Keep:

```text
OPEN
DRAFT
NOT_ACCEPTED
NOT_MERGED
```

No Ready/merge/deploy.

- [ ] **Step 6: Verify fresh exact-head required CI**

Final candidate requires:

- Repository checks: 1 job SUCCESS;
- App checks: 8 jobs SUCCESS;
- total required 9/9;
- same exact candidate head SHA;
- record attempt numbers;
- record merge-test SHA/tree relation when available;
- do not omit failed/cancelled/retried attempts.

- [ ] **Step 7: Final execution receipt**

Report:

- START_HEAD;
- FINAL_HEAD;
- commits;
- changed paths;
- migration `0018`;
- actual Web URL/port;
- root fact creation;
- correction chain;
- dynamic outcome/follow-up projection;
- privacy/non-copy;
- staff scope/revocation;
- response-loss/idempotency;
- restart;
- 390px;
- actual test counts;
- scanner result;
- hosted CI run IDs / 9/9;
- preserved dirty paths;
- historical limitations;
- Draft/Ready/merge/deploy state;
- BLOCKER/HIGH count.

- [ ] **Step 8: Stop**

Do not automatically add:

- tenant-facing maintenance history;
- cost/vendor/invoice/warranty fields;
- analytics;
- preventive maintenance;
- retention/deletion policy implementation.

---

## Self-Review

### 1. Spec coverage

Covered:

- approved spec/plan canonicalization and lineage freeze → Task 0;
- explicit manager-reviewed facts → Tasks 2, 4;
- completed-only source → Task 2;
- exact action taxonomy/component label → Tasks 1, 2, 4;
- append-only corrections → Tasks 2, 4;
- one chain/no branch → Task 2;
- source-derived immutable dimensions → Task 2;
- dynamic outcome/follow-up projection → Tasks 2, 6;
- manager-only API → Tasks 2, 3, 6;
- no tenant/person/private-copy → Tasks 1, 2, 5, 6;
- manager timeline → Tasks 5, 6;
- 390px → Tasks 5, 6;
- response loss/idempotency → Tasks 2, 7;
- restart → Task 7;
- RLS/ACL → Task 2;
- full regressions → Tasks 6, 7;
- exact-head CI → Task 8.

No design requirement is intentionally deferred except the spec's explicit non-goals.

### 2. Step scan

Each implementation task follows test RED → implementation → focused GREEN → commit. No task requires the implementer to invent a product decision left open by the approved spec.

### 3. Type consistency

The plan consistently uses:

```text
CoreMaintenanceActionKind
CoreMaintenanceCorrectionReason
CoreUnitMaintenanceFact
CoreMaintenanceFactRevision
CoreMaintenanceFactDetail
CoreMaintenanceFactCreate
CoreMaintenanceFactCorrection
CoreMaintenanceFactScope
```

and exposes the client as:

```text
client.maintenance
```

### 4. Review Focus coverage

- completion timestamp provenance → Task 2 Steps 2–3;
- correction branching → Task 2 Steps 7–9;
- projection privacy → Task 2 Step 10 + Task 6 Step 3;
- revocation after lock wait → Task 2 Step 6;
- response-loss/replay authorization → Task 2 Step 6 + Task 7 Step 2.

### 5. Proportion

The plan specifies interfaces, tests, commands and task boundaries without writing implementation bodies. SQL/function names are decisions; internal bodies remain for the executor.

---

## Full-Audit Amendments Applied

The operator requested a full pre-approval review. This revision fixes execution-level ambiguities without changing the approved product direction:

1. approved Spec status/next gate corrected;
2. focused Web Vitest commands made workspace-relative;
3. exact global PostgreSQL inventory test path named;
4. correction path/current-ID, no-op rejection, self-cycle and immutable-dimension constraints pinned;
5. timeline 100-row bound and deterministic ordering added to DB/HTTP tests;
6. exact replay after PROPERTY_STAFF revocation added;
7. HTTP mutation response shape and typed-client return type fixed;
8. current leaf/revision order pinned to chain topology rather than timestamps;
9. manager view-state/navigation behavior made explicit;
10. uncertain-response UI must not overclaim request recovery.

No new product scope was added.

---

## Execution Handoff

The operator has consistently selected **Astra as the implementation executor** for the current RC1 branch. Preserve that execution method after plan approval.

This implementation plan is not implementation authorization by itself.

Next gate:

`USER_PLAN_REVIEW`

After the operator approves this plan, prepare the Astra execution packet in `.md`, carrying both the approved design spec and this plan's exact constraints. Do not ask the operator to choose a new execution method unless they explicitly change it.

---

## Artifact Metadata

- `POLICY_REF`: `e9144fac807f39544932baac25b11f836658dbb3`
- `TARGET_REF`: `c60501a6e59f0572d98e2f1cb7be96d3db7d1545`
- approved reviewed design spec SHA-256: `77e645fcbf438987192c5ef851c48fdb4e3ecdcd803f97890d5983cafaa4c956`
- plan status: `READY_FOR_USER_PLAN_REVIEW_AFTER_FULL_AUDIT`
- implementation: `NOT_RUN`
- expected migration: `0018_core_unit_maintenance_fact.sql`
- execution method after approval: Astra, preserving current single-writer/concurrency rules.

`CHECKPOINT | Unit Maintenance Fact Timeline v1 implementation plan | evidence=approved design + TARGET_REF c60501a + policy preflight | tokens=unknown`

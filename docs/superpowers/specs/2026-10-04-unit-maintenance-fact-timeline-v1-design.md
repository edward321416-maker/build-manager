# Unit Maintenance Fact Timeline v1 — Design Specification

**Status:** `APPROVED_SPEC`  
**Project:** 모두의 창업 2기 / `build-manager`  
**Repository:** `edward321416-maker/build-manager`  
**POLICY_REF at authoring:** `e9144fac807f39544932baac25b11f836658dbb3`  
**TARGET_REF at authoring:** `c60501a6e59f0572d98e2f1cb7be96d3db7d1545`  
**Current completed gate:** `COMPLETION_CONFIRMATION_FOLLOWUP_V1_RUNNABLE`  
**Design class:** Architectural — new durable unit-level operational record layer  
**Operator approval:** 2026-10-04

---

## 1. Purpose

The product charter requires the service to retain resolution history at the **unit level**, not merely as a list of tenant tickets.

Current RC1 already has:

- tenant issue intake;
- structured protocol;
- photos;
- manager work queue;
- manager private metadata and notes;
- ticket-scoped public Q&A;
- manager handling completion;
- tenant outcome confirmation;
- atomic unresolved/recurrence follow-up relations.

However, these objects remain **ticket-centric** and contain person-linked or operationally private content.

`Unit Maintenance Fact Timeline v1` introduces a distinct manager-facing record:

> a reviewed, structured maintenance fact attached to a unit and backed by a completed source ticket.

The purpose is to let a manager answer:

- What maintenance issue has this unit experienced?
- What kind of maintenance action was recorded?
- When was the manager's handling completed?
- What did the tenant later report about the result?
- Did that completed case lead to another follow-up ticket?
- Was a previously recorded maintenance fact corrected?

without exposing or copying tenant conversation, raw descriptions, photos, internal notes, or personal details into the unit history itself.

---

## 2. Product decision

### Selected approach

**Explicit reviewed fact ledger.**

A maintenance fact is created only when an authorized manager explicitly records a structured fact from a **COMPLETED** source ticket.

A completed ticket does **not** automatically become a maintenance fact.

### Why

Automatic materialization would risk promoting:

- tenant wording;
- manager handling prose;
- unverified repair claims;
- transient operational metadata;

into an asset-level history without human review.

A purely derived ticket timeline would also fail to create a clean boundary between:

1. person-linked ticket content;
2. durable unit maintenance facts;
3. manager-private operational content.

The explicit reviewed fact ledger creates that boundary.

---

## 3. Alternatives considered

### A. Derived ticket timeline only

Build a unit view by querying completed tickets, handling events, outcome assertions and follow-up relations without a new fact entity.

**Advantages**
- smallest implementation;
- no new write flow;
- always reflects current source objects.

**Rejected because**
- remains ticket-centric;
- cannot distinguish reviewed unit facts from raw person-linked history;
- difficult to support corrections cleanly;
- invites future UI to expose source data directly.

### B. Explicit reviewed fact ledger — selected

Manager reviews a completed ticket and records a structured maintenance fact.

**Advantages**
- clear data boundary;
- durable unit-oriented history;
- append-only correction model;
- future tenant-safe projection can be designed separately;
- no automatic promotion of private content.

**Trade-off**
- manager must take one explicit recording action.

### C. Automatic fact creation at handling completion

Create a fact as soon as a manager marks a ticket complete.

**Rejected because**
- completion is a manager handling record, not proof of physical repair;
- action classification may be unknown at completion time;
- creates false precision;
- makes correction and privacy semantics harder.

---

## 4. Scope

### 4.1 Included in v1

1. manager-only unit maintenance timeline;
2. explicit fact creation from a completed ticket;
3. controlled maintenance-action classification;
4. optional short equipment/component label;
5. source-ticket provenance;
6. source manager-completion timestamp;
7. current tenant outcome projection;
8. source/follow-up relationship projection;
9. append-only fact correction;
10. correction history;
11. unit/building navigation;
12. ORG_ADMIN and PROPERTY_STAFF current-scope authorization;
13. concurrency and idempotency;
14. persistence/restart;
15. 390px Web support;
16. existing RC1 regressions.

### 4.2 Explicitly excluded

- tenant-facing maintenance history;
- new-tenant access to old unit history;
- automated extraction from messages/photos;
- AI maintenance summarization;
- automatic component classification;
- auto-generated facts on completion;
- vendor/invoice/warranty data;
- costs;
- maintenance scheduling;
- preventive maintenance;
- IoT;
- building-wide analytics;
- deletion/edit-in-place of historical fact rows;
- production retention-policy finalization.

---

## 5. Data-boundary definitions

### 5.1 Person-linked content

Examples:

- tenant raw issue description;
- protocol answers;
- ticket public conversation;
- photos;
- tenant identity;
- tenant-specific circumstances.

These remain attached to the source ticket.

They are **not copied into a maintenance fact**.

### 5.2 Unit maintenance fact

A manager-reviewed structured statement that:

- a completed ticket for this unit existed;
- its issue category was the source ticket's category;
- the manager classified the recorded maintenance action;
- the source handling completion was recorded at a specific timestamp.

It may carry a short component/equipment label.

It is not an objective engineering certification.

### 5.3 Manager-private operational content

Examples:

- priority;
- assignee display label;
- internal due time;
- internal notes.

These remain in Manager Work Queue/private contracts.

They are **not copied into a maintenance fact**.

---

## 6. Maintenance fact semantics

A fact should be presented as:

> a manager-reviewed maintenance record derived from a completed operational ticket.

Do not present it as:

- certified defect diagnosis;
- proof that the repair physically succeeded;
- proof of legal responsibility;
- warranty determination;
- tenant-fault determination.

### Source issue type

The fact's `issueType` is copied from the completed source ticket:

```text
HEATING
LEAK
```

It is not manually editable.

### Maintenance action kind

Manager selects one:

```text
INSPECTION
REPAIR
PART_REPLACEMENT
ADJUSTMENT
OTHER
```

Suggested Korean UI:

- 점검
- 수리
- 부품 교체
- 조정
- 기타

### Optional component label

Manager may add a short unit/equipment label, for example:

- 보일러 순환펌프
- 싱크대 트랩
- 난방 밸브

Constraints:

- optional;
- trimmed;
- max 80 characters;
- no control/format characters;
- UI explicitly warns not to enter resident names, phone numbers, access codes or personal circumstances.

This field is manager-only in v1 and must never be automatically reused in a future tenant projection.

---

## 7. Time semantics

Do not ask the manager to invent a physical repair timestamp in v1.

Use:

`sourceCompletedAt`

derived from the completed source ticket's persisted completion state.

At the current RC1 boundary, the ticket's `updated_at` is changed by normal ticket state mutation, and no further ticket mutation is permitted after completion.

The UI label should therefore be:

`관리자 처리 완료 기록`

not:

`실제 수리 완료 시각`

The fact also has:

`recordedAt`

which means when the maintenance fact itself was recorded.

---

## 8. Data model

Use the next additive migration:

`0018_core_unit_maintenance_fact.sql`

Do not modify migrations `0001`–`0017`.

### 8.1 `core_flow.unit_maintenance_fact`

Suggested columns:

```text
id uuid PRIMARY KEY DEFAULT uuidv7()
org_id uuid NOT NULL
unit_id uuid NOT NULL
source_ticket_id text NOT NULL
issue_type text NOT NULL
action_kind text NOT NULL
component_label text NULL
source_completed_at timestamptz NOT NULL
recorded_by uuid NOT NULL
recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
replaces_fact_id uuid NULL
correction_reason text NULL
client_request_id uuid NOT NULL
request_fingerprint bytea NOT NULL
```

### Allowed `issue_type`

```text
HEATING
LEAK
```

### Allowed `action_kind`

```text
INSPECTION
REPAIR
PART_REPLACEMENT
ADJUSTMENT
OTHER
```

### Allowed `correction_reason`

For a correction row:

```text
ACTION_CLASSIFICATION
COMPONENT_LABEL
OTHER
```

For a root fact:

`NULL`

No free-text correction explanation in v1.

---

## 9. Fact chain

A source completed ticket has at most one fact chain.

### Root fact

```text
replaces_fact_id = NULL
```

Only one root fact may exist for a source ticket.

Recommended partial uniqueness:

```text
UNIQUE (org_id, source_ticket_id)
WHERE replaces_fact_id IS NULL
```

### Correction

A correction creates a **new immutable fact row**.

It references the current fact:

```text
replaces_fact_id = current_fact_id
```

The old fact remains.

`replaces_fact_id` must be unique so two corrections cannot both replace the same fact.

### Current fact

The current fact is the leaf row in the chain.

No UPDATE endpoint edits the historical record.

No DELETE endpoint exists in v1.

---

## 10. Correction rules

A correction may change:

- `actionKind`;
- `componentLabel`.

It may not change:

- organization;
- unit;
- source ticket;
- source issue type;
- source completion timestamp.

Every correction must have:

- current manager authorization;
- `expectedCurrentFactId`;
- a `correctionReason`;
- a client request UUID.

If the active fact changed before the correction commits:

`409 STATE_CONFLICT`

The UI retains the user's correction inputs for review.

---

## 11. Source-ticket eligibility

A manager may create a root fact only when:

1. source ticket exists;
2. source ticket is `COMPLETED`;
3. current manager can read the unit under current organization/property scope;
4. no root fact exists for this source ticket, unless this is an exact idempotent replay.

An OPEN or IN_PROGRESS ticket cannot create a fact.

Tenant sessions cannot create or read manager maintenance facts in v1.

---

## 12. Idempotency

All mutations use `clientRequestId`.

Persist an input fingerprint.

### Root fact creation

Same:

- actor;
- client request ID;
- source ticket;
- action kind;
- component label

returns the existing saved fact.

Same request ID with changed payload:

`409`

### Correction

Same:

- actor;
- client request ID;
- expected current fact;
- replacement values;
- correction reason

returns the same saved correction.

Changed replay:

`409`

Authorization is rechecked before returning old success.

---

## 13. Concurrency

Use the **source ticket row lock** for initial fact creation and corrections.

### Two initial fact creates

Both start from a source with no fact.

Exactly one root fact may commit.

The loser:

- exact same request → same saved result;
- different request → `409`.

### Two concurrent corrections

Both reference the same current fact.

Exactly one correction becomes the new current fact.

The second gets:

`409`

No branching correction chain.

### Assignment revocation during wait

If a PROPERTY_STAFF assignment is revoked while waiting for the source lock:

- recheck authority after the lock;
- mutation is denied;
- no fact is written.

---

## 14. Source consistency

At fact creation, server derives and persists:

- `org_id`;
- `unit_id`;
- `issue_type`;
- `source_completed_at`.

The client cannot supply these as authoritative fields.

The client supplies only:

```ts
{
  clientRequestId: string;
  actionKind: CoreMaintenanceActionKind;
  componentLabel: string | null;
}
```

For correction:

```ts
{
  clientRequestId: string;
  expectedCurrentFactId: string;
  actionKind: CoreMaintenanceActionKind;
  componentLabel: string | null;
  correctionReason: CoreMaintenanceCorrectionReason;
}
```

---

## 15. Current outcome and recurrence projection

Do not copy tenant outcome into the fact table.

At timeline read time, derive:

- current outcome kind;
- follow-up target if authorized;
- source relation if this source ticket itself came from a follow-up.

This ensures:

- a later `RESOLVED → RECURRENCE_CLAIM` transition appears automatically;
- fact history does not need mutation when tenant outcome changes.

Suggested fields:

```ts
tenantOutcome:
  | "UNCONFIRMED"
  | "RESOLVED"
  | "UNRESOLVED"
  | "RECURRENCE_CLAIM";

followUpTicketId: string | null;
previousTicketId: string | null;
```

These are operational projections, not stored maintenance facts.

---

## 16. Manager DTO

Suggested current-fact DTO:

```ts
type CoreUnitMaintenanceFact = {
  factId: string;
  unitId: string;
  buildingId: string;
  buildingName: string;
  unitLabel: string;

  sourceTicketId: string;
  issueType: "HEATING" | "LEAK";

  actionKind:
    | "INSPECTION"
    | "REPAIR"
    | "PART_REPLACEMENT"
    | "ADJUSTMENT"
    | "OTHER";

  componentLabel: string | null;

  sourceCompletedAt: string;
  recordedAt: string;

  corrected: boolean;
  correctionCount: number;

  tenantOutcome:
    | "UNCONFIRMED"
    | "RESOLVED"
    | "UNRESOLVED"
    | "RECURRENCE_CLAIM";

  previousTicketId: string | null;
  followUpTicketId: string | null;
};
```

No:

- tenant ID;
- tenant name;
- public-message text;
- ticket raw text;
- photo URL;
- internal-note text;
- assignee;
- priority;
- internal due time.

---

## 17. Correction-history DTO

A manager may inspect the correction chain.

Suggested:

```ts
type CoreMaintenanceFactRevision = {
  factId: string;
  actionKind: CoreMaintenanceActionKind;
  componentLabel: string | null;
  recordedAt: string;
  correctionReason: CoreMaintenanceCorrectionReason | null;
  current: boolean;
};
```

Do not expose `recordedBy` user ID in the public API response in v1.

The database retains `recorded_by` for audit.

---

## 18. Persistence security

Use existing:

`bm_core_flow_owner`

Do not create a new login role.

New table:

- RLS enabled;
- FORCE RLS enabled;
- organization ceiling;
- PUBLIC privileges revoked;
- `bm_b1_web` no direct table DML;
- exact runtime functions only;
- SECURITY DEFINER functions use `search_path=pg_catalog`.

Manager operations must reuse existing current authority.

An organization match alone is insufficient.

PROPERTY_STAFF must remain inside current active property assignment.

---

## 19. Application boundary

Create a separate concern, for example:

```ts
type CoreMaintenanceFactScope = {
  listUnit(unitId:string): Promise<CoreUnitMaintenanceFact[]>;

  readForTicket(ticketId:string): Promise<{
    current: CoreUnitMaintenanceFact | null;
    revisions: CoreMaintenanceFactRevision[];
  }>;

  create(
    ticketId:string,
    input:CoreMaintenanceFactCreate
  ): Promise<{
    fact:CoreUnitMaintenanceFact;
    created:boolean;
  }>;

  correct(
    factId:string,
    input:CoreMaintenanceFactCorrection
  ): Promise<{
    fact:CoreUnitMaintenanceFact;
    created:boolean;
  }>;
};
```

Expose as:

`CoreScope.maintenance`

Do not add maintenance facts to:

- `CoreTicketDto`;
- public communication DTO;
- tenant outcome DTO;
- manager work item DTO.

---

## 20. API boundary

All endpoints are manager-only.

Prefix:

`/api/v2/core/manager`

### Unit timeline

```text
GET /manager/units/:unitId/maintenance-timeline
```

Returns current fact rows ordered:

1. `sourceCompletedAt DESC`
2. `factId`

Bounded maximum:

100 current facts per unit in v1.

No cross-unit pagination redesign.

### Ticket fact

```text
GET /manager/tickets/:ticketId/maintenance-fact
```

Returns:

- current fact or null;
- correction revisions.

### Create fact

```text
POST /manager/tickets/:ticketId/maintenance-fact
```

Body:

```ts
{
  clientRequestId: string;
  actionKind: CoreMaintenanceActionKind;
  componentLabel: string | null;
}
```

First success:

`201`

Exact replay:

`200`

### Correct fact

```text
POST /manager/maintenance-facts/:factId/corrections
```

Body:

```ts
{
  clientRequestId: string;
  expectedCurrentFactId: string;
  actionKind: CoreMaintenanceActionKind;
  componentLabel: string | null;
  correctionReason: CoreMaintenanceCorrectionReason;
}
```

First success:

`201`

Exact replay:

`200`

Stale current fact:

`409`

---

## 21. Tenant API boundary

There is **no tenant maintenance-fact endpoint in v1**.

Tenant:

- cannot list;
- cannot read;
- cannot infer count;
- cannot infer correction timestamps;
- cannot access a source through maintenance APIs.

Future tenant-facing history requires a separate design and approval.

Do not reuse the manager DTO for a future tenant route.

---

## 22. Manager UI

### 22.1 Entry point

Add a manager navigation action:

`호실 정비 이력`

Do not replace Manager Work Queue.

Recommended layout:

```text
업무함
호실 정비 이력
```

This may be a compact segmented/tab-like switch inside the existing manager workspace.

Do not create a new global app shell.

### 22.2 Unit selector

Reuse current authorized `units()` context.

Show:

- building name;
- unit label.

PROPERTY_STAFF sees only assigned property units.

### 22.3 Timeline

For the selected unit, show current facts newest first.

Each entry displays:

- issue category;
- action kind;
- component label if present;
- manager handling completion-record timestamp;
- tenant outcome;
- prior/follow-up relation indicators;
- correction indicator;
- `근거 접수 보기`.

Do not render source raw text or message text in timeline cards.

### 22.4 Empty state

`아직 기록된 정비 사실이 없습니다.`

Explain:

`완료된 접수에서 관리자가 정비 사실을 기록하면 여기에 쌓입니다.`

### 22.5 Loading/error

Loading must not appear as empty.

Error offers retry.

Unauthorized/removed assignment clears timeline state.

---

## 23. Completed ticket manager UI

On an authorized completed ticket:

### No fact

Show:

`정비 사실 기록`

Form:

- action kind;
- optional component label.

Copy:

`세입자 대화나 내부메모가 아니라, 호실에 남길 최소한의 정비 사실만 기록하세요.`

### Existing fact

Show current fact.

Actions:

- `호실 이력에서 보기`
- `정정 기록 추가`

No direct edit/delete.

---

## 24. Correction UI

When `정정 기록 추가` is selected:

- start from current values as convenience;
- require changed value;
- require correction reason;
- submit with expected current fact ID.

On `409`:

- keep user input;
- reload latest current fact;
- tell manager another correction was stored first;
- require review before another submission.

Do not auto-merge corrections.

---

## 25. Recurrence / chain presentation

Existing source/follow-up relation is a user claim, not confirmed root-cause recurrence.

Timeline wording examples:

- `이전 완료 접수에서 이어진 건`
- `후속 접수 있음`
- `세입자: 다시 문제가 생겼다고 응답`

Avoid:

- `동일 고장 확정`
- `재발 원인 확인`
- `이전 수리 실패`

The timeline may visually connect ticket relations but must preserve the claim boundary.

---

## 26. Privacy

### Timeline never contains

- tenant name;
- tenant contact;
- tenant raw issue text;
- Q&A body;
- protocol answer;
- photo;
- manager private note;
- priority;
- assignee label;
- internal due time.

### Component label

Manager-entered and potentially sensitive.

UI warning:

`개인 이름·연락처·출입정보는 적지 마세요.`

No future tenant projection may automatically expose this field.

---

## 27. Tenant turnover

A new tenant receives **no maintenance-fact API or UI access in v1**.

Manager facts remain manager-operational data.

Old source ticket access rules remain unchanged.

If a future public unit-history feature is designed, it must use a new explicitly reviewed projection rather than this manager contract.

---

## 28. Data retention boundary

This v1 does not establish legal retention periods.

`append-only` means product editing behavior, not indefinite legal retention authority.

Before real customer deployment:

- retention;
- correction;
- deletion;
- data-subject procedures;
- future tenant disclosure;

require separate policy review.

Synthetic development does not resolve this issue.

---

## 29. Web responsiveness

Manager timeline must work at:

- desktop;
- 390px Web.

390px requirements:

- no horizontal overflow;
- unit selector usable;
- timeline entries stack vertically;
- long component label wraps safely;
- action buttons remain reachable;
- correction form remains usable;
- no source/private text leaks due to responsive alternate layout.

---

## 30. Error model

Use existing sanitized application errors.

Expected:

- `400` invalid input;
- `401` unauthenticated;
- `403` forbidden/session/org;
- `404` unauthorized resource/non-disclosure where existing semantics use it;
- `409` stale fact or conflicting creation;
- `503` dependency failure.

Do not return database details.

---

## 31. Mutation response-loss behavior

Use client-generated request UUID.

### Root fact create

If response is uncertain:

- do not auto-generate a new request ID;
- reload `maintenance-fact` for source ticket;
- if fact exists with the intended current values, present saved state;
- otherwise explicitly retry the same request.

### Correction

If response is uncertain:

- reload current fact chain;
- if new correction appears, use server truth;
- otherwise retry same request ID.

No duplicate fact/correction rows.

No raw component input needs to persist in sessionStorage in v1.

---

## 32. Acceptance criteria

### AC01 create reviewed fact
Completed authorized ticket → manager creates root fact → current timeline row exists.

### AC02 completed-only
OPEN/IN_PROGRESS source creation rejected.

### AC03 tenant denied
Tenant cannot call any maintenance-fact route.

### AC04 cross-org nondisclosure
Foreign org ticket/unit/fact cannot be read or mutated.

### AC05 staff scope
PROPERTY_STAFF only sees assigned property; revocation blocks next read/write.

### AC06 source-derived immutable fields
Client cannot override org/unit/issue type/completion time.

### AC07 no person-linked copy
Fact/timeline contains no raw description, Q&A, answers or photo data.

### AC08 no private-work copy
No priority, assignee, due or internal-note data.

### AC09 root idempotency
Exact replay produces one root fact and same result.

### AC10 changed replay
Same key with changed payload → 409.

### AC11 concurrent root create
At most one root fact chain per source.

### AC12 correction append-only
Correction creates a new row; old row remains unchanged.

### AC13 correction current projection
Timeline reads corrected leaf as current.

### AC14 correction history
Manager can inspect revision chain in order.

### AC15 stale correction
Two concurrent corrections from the same current fact → one succeeds, one 409.

### AC16 correction invariant
Correction cannot change source ticket/unit/issue/completion timestamp.

### AC17 outcome projection
Later tenant outcome change appears in timeline without changing fact bytes.

### AC18 follow-up projection
Existing source/follow-up relation is shown without copying target/source content.

### AC19 recurrence wording
RECURRENCE_CLAIM is displayed as tenant report, not confirmed recurrence.

### AC20 current authorization
Assignment/member revocation during/after wait is rechecked.

### AC21 restart
Fact/revision chain persists across owned-server restart.

### AC22 manager unit selector
Only currently authorized units available.

### AC23 empty/loading/error
Three states are distinct and usable.

### AC24 390px Web
Timeline/create/correction flows are usable without overflow.

### AC25 source navigation
`근거 접수 보기` uses separate authorized ticket read.

### AC26 future-tenant isolation
No tenant endpoint exists; replacement tenant cannot access maintenance fact routes.

### AC27 Manager Work Queue regression
Existing queue semantics unchanged.

### AC28 Public Q&A regression
Communication semantics/privacy unchanged.

### AC29 Completion Follow-up regression
RESOLVED/UNRESOLVED/RECURRENCE flow and source immutability unchanged.

### AC30 photo/protocol/handling regression
Existing behavior unchanged.

### AC31 RLS/ACL
FORCE RLS, owner, exact function grants and no runtime direct DML verified.

### AC32 scanner/public-data safety
No real PII/secrets/private screenshots enter public Git.

### AC33 restart + response-loss idempotency
Uncertain create/correction does not duplicate data.

### AC34 exact-head CI
Published candidate gets fresh required 9/9 SUCCESS.

---

## 33. Actual synthetic Web verification

Required runtime scenario:

1. manager opens completed synthetic ticket;
2. no fact exists;
3. records `REPAIR` + synthetic component label;
4. source ticket remains unchanged;
5. manager opens unit maintenance timeline;
6. fact appears;
7. source ticket navigation works;
8. tenant outcome projection is visible;
9. source/follow-up relation is visible when present;
10. manager creates correction;
11. old revision remains;
12. current timeline shows corrected fact;
13. stale correction conflict is exercised;
14. response-loss replay produces no duplicate;
15. PROPERTY_STAFF assigned property succeeds;
16. unassigned/revoked property fails;
17. tenant route attempt fails;
18. synthetic replacement tenant route attempt fails;
19. 390px manager timeline passes;
20. owned-server restart preserves facts and corrections;
21. existing work queue/Q&A/outcome/photo/protocol flows still pass.

---

## 34. Migration and compatibility

Expected migration:

`0018_core_unit_maintenance_fact.sql`

Requirements:

- additive only;
- no rewrite of old migrations;
- no backfill of all completed tickets;
- existing completed tickets remain valid without facts;
- history begins when managers explicitly record facts.

Do not silently create facts for historical tickets during migration.

---

## 35. Implementation boundaries

Expected new files may include:

- `packages/api-contracts/src/core-maintenance-fact.ts`
- `packages/application/src/core-maintenance-fact.ts`
- `packages/persistence-postgres/migrations/0018_core_unit_maintenance_fact.sql`
- `packages/api-client/src/core-maintenance-fact.ts`
- `apps/web/src/app/core/manager-maintenance-timeline.tsx`
- focused tests.

Expected integration edits:

- application exports/CoreScope;
- persistence port;
- Web HTTP;
- core client;
- manager workspace;
- completed manager ticket detail.

The implementation plan will resolve exact paths after re-reading the final implementation HEAD.

---

## 36. Non-goals / frozen future decisions

Do not include in this v1:

- tenant-visible fact projection;
- tenant disclosure policy;
- building-wide analytics dashboard;
- cost/invoice/vendor fields;
- maintenance recommendation AI;
- component taxonomy expansion beyond optional label;
- preventive maintenance schedule;
- fact deletion UI;
- real-data retention policy.

These require separate future design decisions.

---

## 37. Success definition

A successful v1 proves:

> An authorized manager can convert a completed maintenance ticket into a minimal, structured, correctable unit-level maintenance fact; see that fact in a unit timeline with current outcome/follow-up context; and do so without carrying tenant conversation, photos or private operational content into the ledger.

The resulting timeline is a manager operational record, not yet a tenant-facing building history.

---

## 38. Design evidence boundary

This spec is grounded in:

- current Project Charter purpose and unit-history objective;
- current RC1 ticket/work/Q&A/outcome contracts at `c60501a...`;
- Codex successor research separating person-linked content, unit maintenance facts and manager-private operational content;
- existing scope/authorization/privacy patterns.

It does **not** claim:

- user-validated demand;
- WTP;
- legal retention compliance;
- real customer performance;
- a tenant-safe public history policy.

---

## 39. Self-review

### Placeholder scan
PASS — no TBD/TODO required for v1 implementation.

### Internal consistency
PASS — manager-only fact ledger, append-only correction, derived outcome relations and no tenant route are consistent.

### Scope
PASS — one subsystem: manager-reviewed unit maintenance fact timeline.

### Ambiguity decisions fixed
- facts are explicit, not automatic;
- only completed tickets create facts;
- issue type and completion time derive from source;
- action kind + optional component label are the only manager content fields;
- correction is append-only;
- one fact chain per source ticket;
- tenant access is excluded;
- future public projection cannot reuse manager DTO automatically.

---

## 40. Next gate

`USER_PLAN_REVIEW`

The operator approved this design specification on 2026-10-04.

Implementation must still wait for a separately reviewed and approved implementation plan. The approved spec itself does not authorize product code, migration, push, Ready, merge, or deployment.

---

`CHECKPOINT | Unit Maintenance Fact Timeline v1 design spec | evidence=TARGET_REF c60501a + Project Charter + Codex successor research | tokens=unknown`

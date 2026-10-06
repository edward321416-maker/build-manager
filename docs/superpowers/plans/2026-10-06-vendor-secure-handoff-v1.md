# Vendor Secure Handoff v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** CANDIDATE_FOR_INDEPENDENT_REVIEW — PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED

**Goal:** Implement the frozen Vendor Secure Handoff v1 experience: an authorized Manager publishes a minimum-data Work Packet and one-time Vendor link; one no-account Vendor coordinates a visit with the current Tenant, records bounded work/completion evidence, and the Manager atomically closes the ticket without collapsing Vendor report, Manager completion, Tenant outcome, or Maintenance Fact semantics.

**Architecture:** Keep authenticated Manager/Tenant traffic on the existing B1/Auth0-backed `/api/v2/core` boundary, but introduce a separate Vendor capability/session boundary under `/api/v2/vendor` with a distinct PostgreSQL runtime role and pool configuration. Persist VendorAssignment, immutable Work Packet revisions, scheduling, appointments, append-only work evidence, completion-report revisions, idempotency receipts, capability/session state, and closeout evidence in an additive `vendor_handoff` schema; integrate with frozen Core Flow only through narrowly granted helper/capability functions and the existing ticket/Q&A/outcome/Maintenance Fact contracts.

**Tech Stack:** TypeScript 6; Next.js/React at the live pinned repository versions; Zod contracts; PostgreSQL 18.x with explicit SQL and node-pg-migrate; `pg`; `sharp` for the already-accepted bounded image decode/re-encode path; Vitest; Playwright. No ORM and no new product dependency unless separately authorized.

**Spec:** `docs/superpowers/specs/2026-10-05-vendor-secure-handoff-scheduling-closeout-v1-design.md`, approved checkpoint `5dd8c4654e110215e50b0471564a1817daf78c18`, approved blob `ce0ad01a532e6d7230d441f6a580ea0c6ea5e11e`.

**Frozen Design Package:** `VENDOR_SECURE_HANDOFF_D9R1_FINAL_DEVELOPMENT_HANDOFF_PACKAGE.zip`, SHA-256 `bd191175ba687081eb5a3a18df0d3686458334c2c1d8a01fdca1fe96ffd474b7`, 31,067,351 bytes.

**Drafting POLICY_REF / TARGET_REF:** `954ef347efef9db29465aefa2e72003b176ee150`.

## Global Constraints

- Product implementation is **NOT authorized by this plan candidate**. This file may be reviewed, amended, committed on a docs-only branch, and independently reviewed; source/SQL/migration/test/dependency/workflow implementation starts only after separate operator authorization.
- At implementation start, execute **Task 0** before touching code. If live `main`, migration head, dependency pins, or CI workflow moved, reconcile the plan against live truth before implementation. Do not assume drafting-time `0019` or Next.js `16.3.4` is still current.
- The historical post-`5dd8c` plan at `docs/superpowers/plans/2026-10-05-vendor-secure-handoff-scheduling-closeout-v1.md` is **QUARANTINED / NOT_AUTHORIZED / DO_NOT_EXECUTE**. It is not a template or implementation authority.
- Preserve frozen B1–B5, RC1, public Q&A, Tenant outcome/follow-up, and Unit Maintenance Fact behavior. Reopen a frozen boundary only on new specific reproducible evidence.
- Vendor capability/session identity is separate from B1/Auth0 identity. A Vendor request never becomes `TENANT`, `ORG_ADMIN`, or `PROPERTY_STAFF`.
- Use a separate Vendor DB runtime role/configuration. Manager/Tenant Core HTTP continues through `bm_b1_web`; external Vendor HTTP uses `bm_vendor_web`. Neither runtime role may SET ROLE to `bm_vendor_handoff_owner`, and neither receives direct Vendor table DML.
- Production credential/IAM provisioning is outside this plan. Test/local role provisioning may create disposable credentials; repository code accepts configuration but never commits credentials.
- All new database changes are additive. At drafting time migrations `0001–0018` are frozen; planned files are `0019–0022`. If Task 0 finds a newer live migration head, renumber the four new migrations without rewriting any existing migration.
- Manager/Vendor/Tenant consequential mutations require a `clientRequestId` UUID and exact request fingerprint. Exact replay returns the same durable result; changed replay returns conflict.
- Raw capability tokens, raw Vendor session values, CSRF values, real tenant/vendor data, reusable access secrets, and private completion photos never enter Git, public logs, public receipts, screenshots, or durable plaintext database fields.
- Raw Vendor link is transient and one-time redeem with the frozen default raw-link expiry of 72 hours. Reissue invalidates the old unredeemed capability but does not terminate a currently active Vendor session until replacement redemption; Revoke terminates access immediately.
- Vendor session absolute lifetime is at most 7 days, and v1 permits at most one active Vendor browser session per assignment.
- Vendor link delivery is manual. No SMS/Kakao/email/push subsystem or delivery claim.
- Work Packet revisions are immutable. Current Vendor sees the current published revision by default; older revisions remain Manager audit history.
- Vendor DTO is a minimum-data DTO, not a filtered Ticket/LandlordRepairPacket. Tenant contact/raw text/full Q&A/private Manager fields never enter it.
- Work Packet `accessPolicy` is exactly `TENANT_PRESENT_REQUIRED | TENANT_PREAUTHORIZATION_ALLOWED`. Effective scheduling mode is exactly `RESIDENT_CONFIRMATION_REQUIRED | PREAUTHORIZED_ENTRY_WINDOW`.
- Availability submission and unattended-entry consent are separate mutations. Consent defaults OFF and only the current Tenant can authorize explicitly selected windows.
- Appointment start/end are immutable. Before confirmation an incompatible proposal may be invalidated/restarted; after confirmation use RESCHEDULE. FOLLOW_UP requires a prior OCCURRED visit and preserves that visit.
- Work/blocker/report history is append-only. Vendor Completion Report is not Manager completion.
- Manager closeout must atomically produce ticket `COMPLETED` + current VendorAssignment `ENDED/CLOSED`, reconcile current public communication version, and revoke Vendor access. It must not write Tenant outcome or Maintenance Fact.
- Existing direct Manager completion remains valid when no non-ended VendorAssignment exists. Historical ENDED assignments do not create a Vendor completion prerequisite.
- Existing Tenant `RESOLVED / UNRESOLVED / RECURRENCE_CLAIM` and Maintenance Fact flows remain separate and unchanged.
- Completion photos use the accepted JPEG/PNG byte/pixel bounds and decode/re-encode sanitizer; EXIF/GPS metadata must not survive stored/served output.
- Visible scheduling uses deterministic Asia/Seoul Korean formatting. Same-day AM→PM ranges must show both meridiems; cross-day intervals show both dates; different-year dates include year. Validation compares absolute instants, never display strings.
- Preserve the frozen RC1 visual system, Manager 1440/1280 ownership, below-1120 list-to-detail behavior, 390 px single-column flows, 200% text behavior, 50 px minimum controls, no sticky bottom CTA, and no horizontal scheduling grid.
- Any unexpected required gate failure is a STOP. Do not pass-seek by weakening assertions, increasing retries/timeouts, widening roles, or bypassing security.

## Review Focus

1. **Raw-link response loss:** if link issuance commits but the HTTP response is lost, authoritative state must prove issuance while raw bytes remain unrecoverable; exact replay must not mint or reconstruct a second raw link, and UI must require explicit Reissue.
2. **Tenant authority changes after consent:** preauthorized Appointment creation may succeed only from current-Tenant consent, and `VISIT_STARTED` must recheck that exact occupancy/member relationship after lock waits; ended/stale occupancy must block entry.
3. **Cross-assignment probing:** a Vendor session for assignment A must receive non-disclosing failure for packet/photo/appointment/report IDs from assignment B; manager/tenant IDs supplied by a Vendor never create authority.
4. **Closeout/public-Q&A race:** new public communication versus Manager closeout must serialize so exactly one wins; no state may persist where the ticket is COMPLETED but the assignment remains ACTIVE, or vice versa.
5. **Time-boundary rendering/validation:** same-day AM→PM, cross-midnight, and different-year windows must preserve absolute containment and explicit Korean presentation at 390 px / 200% text.

---

## Planned File Structure

### Shared contracts/application

- Create `packages/api-contracts/src/vendor-handoff.ts`
- Create `packages/api-contracts/src/vendor-handoff.test.ts`
- Modify `packages/api-contracts/src/index.ts`
- Create `packages/application/src/vendor-handoff.ts`
- Create `packages/application/src/vendor-handoff.test.ts`
- Modify `packages/application/src/index.ts`

### PostgreSQL

- Create `packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql`
- Create `packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql`
- Create `packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql`
- Create `packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql`
- Create `packages/persistence-postgres/src/vendor-handoff/index.ts`
- Create `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Create `packages/persistence-postgres/src/vendor-handoff/tenant.ts`
- Create `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Create `packages/persistence-postgres/src/vendor-handoff/common.ts`
- Create `packages/persistence-postgres/src/testing/vendor-handoff-roles.ts`
- Modify `packages/persistence-postgres/src/testing/index.ts`
- Modify `packages/persistence-postgres/package.json`

### Manager/Tenant Core integration

- Create `packages/api-client/src/core-vendor-handoff.ts`
- Modify `packages/api-client/src/index.ts`
- Create `apps/web/src/server/core-flow/vendor-handoff.ts`
- Create `apps/web/src/server/core-flow/vendor-handoff.test.ts`
- Modify `apps/web/src/server/core-flow/container.ts`
- Modify `apps/web/src/server/core-flow/http.ts`
- Create `apps/web/src/app/core/vendor-handoff-manager.tsx`
- Create `apps/web/src/app/core/vendor-handoff-manager.test.tsx`
- Create `apps/web/src/app/core/vendor-handoff-tenant.tsx`
- Create `apps/web/src/app/core/vendor-handoff-tenant.test.tsx`
- Create `apps/web/src/app/core/vendor-handoff.module.css`
- Modify `apps/web/src/app/core/core-screen.tsx`

### External Vendor Web

- Create `packages/api-client/src/vendor-job.ts`
- Create `apps/web/src/server/vendor-handoff/container.ts`
- Create `apps/web/src/server/vendor-handoff/http.ts`
- Create `apps/web/src/server/vendor-handoff/http.test.ts`
- Create `apps/web/src/server/vendor-handoff/token.ts`
- Create `apps/web/src/server/vendor-handoff/token.test.ts`
- Create `apps/web/src/server/vendor-handoff/photos.ts`
- Create `apps/web/src/app/api/v2/vendor/[...path]/route.ts`
- Create `apps/web/src/app/vendor/job/page.tsx`
- Create `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Create `apps/web/src/app/vendor/job/vendor-job-screen.test.tsx`
- Create `apps/web/src/app/vendor/job/vendor-job.module.css`
- Create `apps/web/src/lib/vendor-time.ts`
- Create `apps/web/src/lib/vendor-time.test.ts`
- Modify `apps/web/next.config.ts`

### Verification/evidence

- Create `tests/postgres/vendor-handoff-foundation.test.ts`
- Create `tests/postgres/vendor-handoff-scheduling.test.ts`
- Create `tests/postgres/vendor-handoff-work.test.ts`
- Create `tests/postgres/vendor-handoff-completion.test.ts`
- Create `tests/postgres/vendor-handoff-security.test.ts`
- Create `tests/postgres/helpers/vendor-handoff-fixture.ts`
- Create `tests/architecture/vendor-handoff-boundary.test.ts`
- Create `apps/web/tests/core-e2e/vendor-handoff.spec.ts`
- Create `apps/web/tests/core-login-e2e/vendor-handoff.spec.ts`
- Create `apps/web/tests/vendor-e2e/vendor-job.spec.ts`
- Create `apps/web/playwright.vendor.config.ts`
- Create `scripts/vendor-handoff-dev.mjs`
- Create `scripts/vendor-handoff-restart-check.mjs`
- Modify `apps/web/package.json`
- Modify root `package.json`
- Modify `.github/workflows/app-check.yml`
- Create `ops/vendor_secure_handoff_v1.md`
- Modify `ops/AI_Execution_Log.csv` append-only

---

### Task 0: Implementation-start live-main revalidation

**Files:** No product file changes. Update this plan only if live facts force a path/number correction.

**Interfaces:**
- Consumes: frozen D9R1 package SHA `bd191175...`, approved spec blob `ce0ad01a...`.
- Produces: fixed `IMPLEMENTATION_BASE_SHA`, live migration sequence, live dependency/workflow inventory, and an explicit go/stop receipt for Task 1.

- [ ] **Step 1: Re-read repository rules and live main**

Run from repository root:
```bash
git fetch origin main
git rev-parse origin/main
git status --short
```

Read live `AGENTS.md`, `governance/ai_delivery_rules.md`, `governance/project_policy.md`, current Development handoff, package manifests, migration directory, and `.github/workflows/app-check.yml`.

Expected: record `POLICY_REF` and `IMPLEMENTATION_BASE_SHA`; do not mutate the current user checkout.

- [ ] **Step 2: Revalidate migration/dependency/workflow assumptions**

Confirm:
- existing migrations are contiguous and determine the first four free numbers;
- current Next/React/Playwright/TypeScript/sharp pins;
- current hosted job set and current `web-e2e` commands;
- whether RR01 PR #73 or any successor landed.

If migration numbers changed, rename planned `0019–0022` paths to the next four free numbers before implementation. If security/CI architecture changed materially, STOP for plan delta review.

- [ ] **Step 3: Create isolated implementation worktree only after separate product-implementation authorization**

Use `superpowers:using-git-worktrees`. Do not create implementation commits during planning review.

**STOP condition:** Product implementation authorization is absent, live main contradicts a frozen design rule, or exact migration/runtime role assumptions cannot be reconciled additively.

---

### Task 1: Freeze strict Vendor contracts and application ports

**Files:**
- Create: `packages/api-contracts/src/vendor-handoff.ts`
- Create: `packages/api-contracts/src/vendor-handoff.test.ts`
- Modify: `packages/api-contracts/src/index.ts`
- Create: `packages/application/src/vendor-handoff.ts`
- Create: `packages/application/src/vendor-handoff.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Produces exact enums/types:
  - `VendorAssignmentStatus = "PREPARING"|"OFFERED"|"ACTIVE"|"ENDED"`
  - `VendorAssignmentEndReason = "DECLINED"|"WITHDRAWN"|"REVOKED"|"SUPERSEDED"|"CLOSED"`
  - `VendorAccessPolicy = "TENANT_PRESENT_REQUIRED"|"TENANT_PREAUTHORIZATION_ALLOWED"`
  - `VendorSchedulingMode = "RESIDENT_CONFIRMATION_REQUIRED"|"PREAUTHORIZED_ENTRY_WINDOW"`
  - `VendorSchedulingPurpose = "INITIAL"|"RESCHEDULE"|"FOLLOW_UP"`
  - `VendorSchedulingRoundStatus = "OPEN"|"CONFIRMED"|"SUPERSEDED"|"CANCELLED"`
  - `VendorAppointmentStatus = "SCHEDULED"|"OCCURRED"|"SUPERSEDED"|"CANCELLED"`
- Produces DTOs `ManagerVendorHandoffDto`, `TenantVendorSchedulingDto`, `VendorJobDto`, `VendorLinkIssueDto`, `VendorCompletionReportDto`.
- Contract bounds fixed by this plan: `vendorLabel` plain text 1–80 characters; optional `accessInstruction` plain text 1–500 characters; optional decline/withdraw/blocker operational note 1–500 characters; Vendor/Manager work/completion summaries retain the frozen 1–1000-character bound. Control/format characters are rejected consistently with existing text validators.
- Produces strict mutation schemas with required `clientRequestId` and expected version/revision fields for assignment create, packet publish, link issue/reissue/revoke, accept/decline/withdraw, availability, unattended-entry authorization, proposal, slot confirmation/selection, visit start, blocker record/clear, completion report, correction, more-work and closeout.
- Produces application ports `VendorHandoffManagerPort`, `VendorHandoffTenantPort`, `VendorHandoffExternalPort` and `VendorHandoffError`.
- No raw capability/session/CSRF type appears in any durable DTO.

- [ ] **Step 1: Write strict contract RED tests**

Tests must assert:
- unknown keys reject;
- 1–5 proposal slots only;
- `workSummary` trims/validates to 1–1000 characters;
- completion evidence is either 1–5 upload IDs or one approved omission reason, never neither/both;
- Manager cannot submit Tenant consent fields;
- Vendor/Manager payloads cannot submit org/property/unit/ticket authority fields where server derives them;
- exact enum values above;
- all consequential commands require UUID `clientRequestId`.

Run:
```bash
npm run test:shared -- packages/api-contracts/src/vendor-handoff.test.ts
```
Expected: RED because module/schemas do not exist.

- [ ] **Step 2: Define the contracts and application port signatures**

Keep DTOs role-specific; do not create one union DTO that exposes private optional fields.

- [ ] **Step 3: Add application-level invariant tests**

Pin pure validation helpers for:
- `redeem !== accept`;
- correction versus more-work disposition;
- same request key + changed normalized payload fingerprint conflict;
- allowed transition vocabulary only.

Run:
```bash
npm run test:shared -- packages/api-contracts/src/vendor-handoff.test.ts packages/application/src/vendor-handoff.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api-contracts/src/vendor-handoff.ts packages/api-contracts/src/vendor-handoff.test.ts packages/api-contracts/src/index.ts packages/application/src/vendor-handoff.ts packages/application/src/vendor-handoff.test.ts packages/application/src/index.ts
git commit -m "feat(vendor): define secure handoff contracts"
```

---

### Task 2: Add the isolated Vendor DB security/foundation boundary

**Files:**
- Create: `packages/persistence-postgres/src/testing/vendor-handoff-roles.ts`
- Modify: `packages/persistence-postgres/src/testing/index.ts`
- Create: `packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql`
- Create: `packages/persistence-postgres/src/vendor-handoff/common.ts`
- Create: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Create: `packages/persistence-postgres/src/vendor-handoff/tenant.ts`
- Create: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Create: `packages/persistence-postgres/src/vendor-handoff/index.ts`
- Modify: `packages/persistence-postgres/package.json`
- Create: `tests/postgres/helpers/vendor-handoff-fixture.ts`
- Create: `tests/postgres/vendor-handoff-foundation.test.ts`
- Create: `tests/postgres/vendor-handoff-security.test.ts`

**Interfaces:**
- Disposable tests provision:
  - `bm_vendor_handoff_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`
  - `bm_vendor_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`
- Production migrations **preflight** these roles; they do not provision passwords/credentials.
- New schema `vendor_handoff` is PUBLIC-revoked.
- Foundation tables:
  - `vendor_assignment` — ticket-scoped history, max one non-ended assignment.
  - `work_packet_revision` — immutable published snapshots.
  - `work_packet_source_photo` — explicit packet/photo allowlist.
  - `vendor_capability` — digest/issuance/redeem/supersede/revoke metadata only.
  - `vendor_session` — session digest + CSRF digest + absolute expiry/revocation; max one active session.
  - `command_receipt` — actor scope/id + request key + SHA-256 fingerprint + safe result JSON.
- Manager/Tenant runtime remains `bm_b1_web`; external Vendor runtime gets EXECUTE only on external functions through `bm_vendor_web`.
- Neither runtime has direct table DML or SET ROLE to owner.
- Cross-schema Core helpers project only the minimum manager-authorized source and current-Tenant occupancy identity. Foundation signatures are `core_flow.vendor_handoff_source(p_digest bytea,p_ticket text,p_photo_ids uuid[],p_lock boolean) RETURNS jsonb` and `core_flow.vendor_handoff_current_tenant(p_digest bytea,p_ticket text,p_lock boolean) RETURNS jsonb`, owned by `bm_core_flow_owner` and executable only by the Vendor handoff owner/runtime path that needs them. Do not grant Vendor owner broad Core table access.
- `vendor_handoff.guard_direct_completion(p_digest bytea,p_ticket text) RETURNS void` shares the same per-ticket advisory-lock key used by assignment create/reassign/closeout. It returns conflict while any non-ended assignment exists, so legacy direct completion and assignment creation cannot win concurrently.
- Persistence factories:
  - `createVendorHandoffManagerPort(database, orgId): VendorHandoffManagerPort`
  - `createVendorHandoffTenantPort(database, orgId): VendorHandoffTenantPort`
  - `createVendorHandoffExternalPort(database): VendorHandoffExternalPort`

- [ ] **Step 1: Write PostgreSQL RED tests**

Cover AC01–AC16, AC47–AC49 foundation cases:
- manager role eligibility and property scope;
- route exactly GENERAL_VENDOR/MANUFACTURER_AS;
- SAFETY_ESCALATED denial;
- concurrent create => at most one non-ended assignment;
- no vendor IAM/app user/org membership row;
- token/session digest only;
- one-time redeem and replacement-session uniqueness;
- cross-assignment hidden-resource behavior;
- packet minimum-data projection/provenance/address;
- explicit source-photo allowlist;
- immutable packet revisions;
- stale expected packet/assignment version conflict;
- direct table DML denied to both runtime roles;
- PUBLIC EXECUTE absent;
- role membership/SET ROLE denied.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-foundation.test.ts tests/postgres/vendor-handoff-security.test.ts
```
Expected: RED because roles/schema/functions do not exist.

- [ ] **Step 2: Implement migration 0019 and bounded port adapters**

Rules:
- original `0001–0018` bytes unchanged;
- assignment create/publish/link operations recheck current Manager authorization after waits;
- canonical building/serviceAddress/unit/issue identity comes from server-side Core source;
- tenant raw text is never address fallback;
- packet publish fails safe when canonical address is unavailable;
- first link issue transitions `PREPARING→OFFERED` and changes ticket `OPEN→IN_PROGRESS` through existing Core handling capability without copying Vendor metadata into public events;
- exact link replay returns safe issuance metadata with `created:false`; raw link bytes are never recoverable from DB/receipt.

- [ ] **Step 3: Run focused DB/security tests**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-foundation.test.ts tests/postgres/vendor-handoff-security.test.ts
```
Expected: PASS, zero skipped/todo.

- [ ] **Step 4: Run frozen foundation regressions**

```bash
npm run test:postgres -- tests/postgres/b1-access.test.ts tests/postgres/b2-capabilities.test.ts tests/postgres/b5-capabilities.test.ts tests/postgres/core-flow-access.test.ts tests/postgres/core-flow.test.ts tests/postgres/core-flow-photos.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql packages/persistence-postgres/src/vendor-handoff packages/persistence-postgres/src/testing/vendor-handoff-roles.ts packages/persistence-postgres/src/testing/index.ts packages/persistence-postgres/package.json tests/postgres/helpers/vendor-handoff-fixture.ts tests/postgres/vendor-handoff-foundation.test.ts tests/postgres/vendor-handoff-security.test.ts
git commit -m "feat(vendor): add secure handoff persistence boundary"
```

---

### Task 3: Add Manager handoff, Work Packet, and secure-link integration

**Files:**
- Create: `packages/api-client/src/core-vendor-handoff.ts`
- Modify: `packages/api-client/src/index.ts`
- Create: `apps/web/src/server/core-flow/vendor-handoff.ts`
- Create: `apps/web/src/server/core-flow/vendor-handoff.test.ts`
- Modify: `apps/web/src/server/core-flow/container.ts`
- Modify: `apps/web/src/server/core-flow/http.ts`
- Create: `apps/web/src/app/core/vendor-handoff-manager.tsx`
- Create: `apps/web/src/app/core/vendor-handoff-manager.test.tsx`
- Create: `apps/web/src/app/core/vendor-handoff.module.css`
- Modify: `apps/web/src/app/core/core-screen.tsx`

**Interfaces:**
- Core Manager endpoints under existing authenticated boundary:
  - `GET /api/v2/core/manager/tickets/:ticketId/vendor-handoff`
  - `POST .../vendor-assignment`
  - `POST .../work-packets`
  - `POST .../secure-link`
  - `POST .../secure-link/reissue`
  - `POST .../revoke`
- Link issue response is `VendorLinkIssueDto`: on first committed issue it carries a one-time deliverable `/vendor/job#<raw-token>`; replay/reconciliation carries issuance metadata but no recoverable raw token.
- Manager UI lives in the existing private Inspector/action rail; no fifth pane and no global Vendor dashboard.

- [ ] **Step 1: Write HTTP/UI RED tests**

Assert:
- ORG_ADMIN/current PROPERTY_STAFF only;
- Origin/session/CSRF precedence stays frozen;
- completed/unsafe/ineligible route does not render handoff CTA;
- packet preview shows exact Vendor-visible fields and provenance before publish;
- Manager must explicitly select source photos;
- accessPolicy is policy only, never Tenant consent;
- link issue response-loss reconciliation says original link cannot be shown and exposes Reissue, not blind retry;
- no UI claims SMS/Kakao/email/push delivery;
- active/non-ended assignment hides legacy direct-completion bypass;
- historical ENDED assignment does not.

Run:
```bash
npm run test:web -- apps/web/src/server/core-flow/vendor-handoff.test.ts apps/web/src/app/core/vendor-handoff-manager.test.tsx
```
Expected: RED.

- [ ] **Step 2: Implement Core handler/client integration**

Keep `http.ts` change to route dispatch only; place Vendor-specific parsing/error mapping in `server/core-flow/vendor-handoff.ts`.

- [ ] **Step 3: Implement Manager Inspector UI**

Preserve current Task Zone ownership:
- public content shows only current Manager-owned next action;
- private Inspector owns Vendor handoff controls;
- completed tickets never show a fresh handoff task;
- raw link is visible only in the immediate successful issue/reissue result and never recoverable after navigation/refresh.

- [ ] **Step 4: Run focused and Core regression tests**

```bash
npm run test:web -- apps/web/src/server/core-flow/vendor-handoff.test.ts apps/web/src/app/core/vendor-handoff-manager.test.tsx
npm run test:web -- apps/web/src/app/core/manager-work-order.test.ts apps/web/src/app/core/manager-maintenance-timeline.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/core-vendor-handoff.ts packages/api-client/src/index.ts apps/web/src/server/core-flow/vendor-handoff.ts apps/web/src/server/core-flow/vendor-handoff.test.ts apps/web/src/server/core-flow/container.ts apps/web/src/server/core-flow/http.ts apps/web/src/app/core/vendor-handoff-manager.tsx apps/web/src/app/core/vendor-handoff-manager.test.tsx apps/web/src/app/core/vendor-handoff.module.css apps/web/src/app/core/core-screen.tsx
git commit -m "feat(vendor): add manager secure handoff flow"
```

---

### Task 4: Add the standalone no-account Vendor capability/session Web boundary

**Files:**
- Create: `packages/api-client/src/vendor-job.ts`
- Modify: `packages/api-client/src/index.ts`
- Create: `apps/web/src/server/vendor-handoff/container.ts`
- Create: `apps/web/src/server/vendor-handoff/http.ts`
- Create: `apps/web/src/server/vendor-handoff/http.test.ts`
- Create: `apps/web/src/server/vendor-handoff/token.ts`
- Create: `apps/web/src/server/vendor-handoff/token.test.ts`
- Create: `apps/web/src/app/api/v2/vendor/[...path]/route.ts`
- Create: `apps/web/src/app/vendor/job/page.tsx`
- Create: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Create: `apps/web/src/app/vendor/job/vendor-job-screen.test.tsx`
- Create: `apps/web/src/app/vendor/job/vendor-job.module.css`
- Modify: `apps/web/next.config.ts`
- Create: `tests/architecture/vendor-handoff-boundary.test.ts`

**Interfaces:**
- `VENDOR_HANDOFF_DATABASE_CONFIG` supplies the separate runtime DB config. Test/dev may provision it; no credential is committed.
- `POST /api/v2/vendor/redeem` consumes the raw fragment token once, sets HttpOnly Strict `vendor_session` cookie scoped to `/api/v2/vendor`, and returns current job + fresh CSRF.
- `GET /api/v2/vendor/session` authenticates the session and rotates/returns a fresh server-issued CSRF value.
- Vendor mutations require `X-Vendor-CSRF`.
- `GET /api/v2/vendor/job`, `POST /job/accept`, `POST /job/decline`, `POST /job/withdraw`.
- `GET /api/v2/vendor/job/source-photos/:photoId` serves only an explicitly allowlisted current Work Packet source photo after assignment/session recheck; guessed or cross-assignment photo IDs use the same hidden-resource response.
- `/vendor/job#<raw-token>` extracts the fragment client-side, calls redeem, and executes `history.replaceState` after successful redemption.
- Vendor surface headers: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, frame embedding denied. No analytics/CDN/external scripts.

- [ ] **Step 1: Write token/session/HTTP RED tests**

Assert:
- cryptographically random token material and SHA-256 digest;
- raw token/session/CSRF never appears in thrown/public error text;
- first redeem succeeds; second redeem of same capability fails;
- replacement redeem invalidates previous session;
- Reissue alone does not invalidate current active session;
- Revoke does;
- assignment ENDED denies read/mutation;
- assignment A session cannot probe B;
- opening/redeeming leaves assignment OFFERED until explicit accept;
- Decline only before accept; Withdraw only after accept.

Run:
```bash
npm run test:web -- apps/web/src/server/vendor-handoff/token.test.ts apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
npm run test:shared -- tests/architecture/vendor-handoff-boundary.test.ts
```
Expected: RED.

- [ ] **Step 2: Implement external container/route/page**

Vendor container uses only `createVendorHandoffExternalPort` with `VENDOR_HANDOFF_DATABASE_CONFIG`; it does not import B1/Auth0 session helpers.

- [ ] **Step 3: Add exact response/security headers**

Test both page and API route. Do not add third-party resources.

- [ ] **Step 4: Run focused tests**

Commands from Step 1; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/vendor-job.ts packages/api-client/src/index.ts apps/web/src/server/vendor-handoff apps/web/src/app/api/v2/vendor apps/web/src/app/vendor/job apps/web/next.config.ts tests/architecture/vendor-handoff-boundary.test.ts
git commit -m "feat(vendor): add capability job session"
```

---

### Task 5: Persist Tenant/Vendor scheduling, consent, and immutable Appointments

**Files:**
- Create: `packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql`
- Modify: `packages/persistence-postgres/src/vendor-handoff/tenant.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Create: `tests/postgres/vendor-handoff-scheduling.test.ts`
- Extend: `packages/api-contracts/src/vendor-handoff.test.ts`

**Interfaces:**
- Tables/resources: `scheduling_round`, `tenant_availability_submission`, `tenant_availability_window`, `tenant_entry_authorization`, `tenant_entry_authorization_window`, `vendor_slot_proposal`, `vendor_slot`, `appointment`.
- One OPEN round per assignment by partial unique constraint plus lock/recheck.
- Tenant availability mutation never creates unattended authorization.
- Authorization references exact selected windows and current occupancy member.
- Resident-confirmation proposal has 1–5 candidate slots; Tenant selects one current valid slot.
- Preauthorized Vendor selection must be fully contained in one authorized window and creates an Appointment without second Tenant confirmation.
- Appointment timestamps never UPDATE. RESCHEDULE creates a new round/appointment and supersedes the old future Appointment; FOLLOW_UP requires prior OCCURRED.

- [ ] **Step 1: Write DB RED tests**

Cover AC20–AC27:
- one OPEN round under concurrency;
- current Tenant only;
- consent OFF/no authorization by default;
- exact-window containment;
- stale/foreign window denial;
- 1–5 proposal bound;
- tenant final selection;
- no Manager-written consent;
- immutable appointment time;
- pre-confirmation restart is not RESCHEDULE;
- RESCHEDULE/FOLLOW_UP distinction.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-scheduling.test.ts
```
Expected: RED.

- [ ] **Step 2: Implement migration 0020 and persistence methods**

All stored times are `timestamptz`; reject non-finite values and `startAt >= endAt`; compare absolute instants.

- [ ] **Step 3: Run scheduling + security regression**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-scheduling.test.ts tests/postgres/vendor-handoff-security.test.ts tests/postgres/core-ticket-outcome.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql packages/persistence-postgres/src/vendor-handoff packages/api-contracts/src/vendor-handoff.test.ts tests/postgres/vendor-handoff-scheduling.test.ts
git commit -m "feat(vendor): persist scheduling and consent"
```

---

### Task 6: Integrate Tenant/Vendor scheduling UI and Korean time semantics

**Files:**
- Create: `apps/web/src/lib/vendor-time.ts`
- Create: `apps/web/src/lib/vendor-time.test.ts`
- Create: `apps/web/src/app/core/vendor-handoff-tenant.tsx`
- Create: `apps/web/src/app/core/vendor-handoff-tenant.test.tsx`
- Modify: `apps/web/src/app/core/core-screen.tsx`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.ts`
- Modify: `packages/api-client/src/core-vendor-handoff.ts`
- Modify: `packages/api-client/src/vendor-job.ts`

**Interfaces:**
- Tenant Core endpoints:
  - `GET /api/v2/core/tickets/:ticketId/vendor-scheduling`
  - `POST .../availability`
  - `POST .../entry-authorization`
  - `POST .../confirm-slot`
- Vendor endpoints:
  - `POST /api/v2/vendor/job/proposals`
  - `POST /api/v2/vendor/job/preauthorized-appointment`
- `formatVendorInterval(startAt,endAt,now?)` is the single deterministic Asia/Seoul formatter used by Manager/Tenant/Vendor Vendor-Handoff UI.

- [ ] **Step 1: Write time/UI RED tests**

Required exact cases:
- current-year same-meridiem: `10월 7일(수) 오후 2:00–3:00`;
- same-day AM→PM: both `오전` and `오후` shown;
- 2027 date includes year;
- cross-midnight shows both dates;
- absolute containment rejects a visually similar but out-of-window instant;
- Tenant consent default OFF and consequence confirmation repeats exact selected windows.

Run:
```bash
npm run test:web -- apps/web/src/lib/vendor-time.test.ts apps/web/src/app/core/vendor-handoff-tenant.test.tsx apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
```
Expected: RED.

- [ ] **Step 2: Implement formatter and Tenant Task Zone**

Current Appointment remains visible outside Task Zone. Scheduling/consent action stays inside conditional Task Zone.

- [ ] **Step 3: Implement Vendor proposal/preauthorized selection**

No horizontal scheduling grid; current action dominates history.

- [ ] **Step 4: Run focused UI tests**

Command from Step 1; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/vendor-time.ts apps/web/src/lib/vendor-time.test.ts apps/web/src/app/core/vendor-handoff-tenant.tsx apps/web/src/app/core/vendor-handoff-tenant.test.tsx apps/web/src/app/core/core-screen.tsx apps/web/src/app/vendor/job/vendor-job-screen.tsx apps/web/src/server/core-flow/vendor-handoff.ts packages/api-client/src/core-vendor-handoff.ts packages/api-client/src/vendor-job.ts
git commit -m "feat(vendor): add tenant vendor scheduling"
```

---

### Task 7: Add append-only visit and blocker evidence

**Files:**
- Create: `packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `packages/api-client/src/vendor-job.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.ts`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Create: `tests/postgres/vendor-handoff-work.test.ts`

**Interfaces:**
- Append-only `work_event` records `VISIT_STARTED`, `BLOCKER_RECORDED`, `BLOCKER_CLEARED`.
- One `VISIT_STARTED` per Appointment.
- At most one uncleared blocker; clear references exact blocker event.
- `POST /api/v2/vendor/job/visits/start`
- `POST /api/v2/vendor/job/blockers`
- `POST /api/v2/vendor/job/blockers/:blockerId/clear`
- PREAUTHORIZED visit start rechecks the exact authorizing current occupancy relationship after locks.
- Starting a visit marks the selected Appointment OCCURRED without rewriting prior Appointment time.

- [ ] **Step 1: Write DB RED tests**

Cover AC23, AC28–AC31:
- duplicate visit start;
- stale/ended occupancy after preauthorization;
- blocker overlay and one-current-blocker invariant;
- blocker clear exact reference/history;
- FOLLOW_UP keeps prior Appointment OCCURRED.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-work.test.ts
```
Expected: RED.

- [ ] **Step 2: Implement migration/work port**

Do not UPDATE/delete historical work events.

- [ ] **Step 3: Implement Vendor work UI/API**

A blocker changes current task state but never rewrites lifecycle/history.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-work.test.ts
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql packages/persistence-postgres/src/vendor-handoff/external.ts packages/api-client/src/vendor-job.ts apps/web/src/server/vendor-handoff/http.ts apps/web/src/app/vendor/job/vendor-job-screen.tsx tests/postgres/vendor-handoff-work.test.ts
git commit -m "feat(vendor): record visit and blocker evidence"
```

---

### Task 8: Add bounded completion reports, photo sanitization, and correction revisions

**Files:**
- Create: `packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Create: `apps/web/src/server/vendor-handoff/photos.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.ts`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Modify: `packages/api-client/src/vendor-job.ts`
- Create: `tests/postgres/vendor-handoff-completion.test.ts`

**Interfaces:**
- Tables `completion_report`, `completion_photo`, `manager_disposition`.
- Report revision chain is append-only; correction creates a new report referencing prior report.
- Submission requires valid OCCURRED visit, no current blocker, no OPEN SchedulingRound, current packet acknowledgment, and either 1–5 sanitized photos or one approved omission reason.
- Vendor photo upload uses the accepted `normalizePhoto` decode/re-encode path from Core photo handling without changing the frozen Core photo implementation.
- `COMPLETION_REPORTED` is a derived presentation/eligibility phase from the current pending report, not a fifth `VendorAssignment.status`; durable assignment status remains `ACTIVE` until an allowed end transition.
- Vendor report moves assignment presentation to `COMPLETION_REPORTED` read-mostly state without ending assignment or ticket.
- Manager disposition is exactly `CLOSEOUT | REQUEST_CORRECTION | MORE_WORK`.
- Completion photo routes are exact: Vendor upload `POST /api/v2/vendor/job/completion-photos` with `X-Upload-Id`; Vendor own read `GET /api/v2/vendor/job/completion-photos/:photoId`; Manager read `GET /api/v2/core/manager/tickets/:ticketId/vendor-completion-photos/:photoId`. There is no Tenant completion-photo route.

- [ ] **Step 1: Write RED tests for report prerequisites and revisions**

Cover AC32–AC37:
- blocker/open round rejects report;
- 0 or >5 photos rejects without omission reason;
- omission reason versus photos is exclusive;
- workSummary 1–1000;
- packet acknowledgment must be current;
- correction preserves prior report and creates new current revision;
- COMPLETION_REPORTED rejects scheduling/visit/blocker/withdraw/unrelated report actions.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts
```
Expected: RED.

- [ ] **Step 2: Write image metadata RED test**

Upload synthetic JPEG containing EXIF/GPS markers, submit through Vendor photo route, then read stored/served output and assert GPS/EXIF fields are absent while valid pixels remain.

Run:
```bash
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts
```
Expected: RED until Vendor completion-photo route exists.

- [ ] **Step 3: Implement migration/report/photo path**

Do not expose raw Vendor completion photos through Tenant endpoints.

- [ ] **Step 4: Run focused DB/Web tests**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql packages/persistence-postgres/src/vendor-handoff apps/web/src/server/vendor-handoff/photos.ts apps/web/src/server/vendor-handoff/http.ts apps/web/src/app/vendor/job/vendor-job-screen.tsx packages/api-client/src/vendor-job.ts tests/postgres/vendor-handoff-completion.test.ts
git commit -m "feat(vendor): add completion report evidence"
```

---

### Task 9: Make Manager correction/more-work/closeout/reassign atomic

**Files:**
- Modify: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Modify: `packages/persistence-postgres/src/core-flow.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.ts`
- Modify: `apps/web/src/app/core/vendor-handoff-manager.tsx`
- Modify: `packages/api-client/src/core-vendor-handoff.ts`
- Extend: `tests/postgres/vendor-handoff-completion.test.ts`
- Extend: `tests/postgres/vendor-handoff-security.test.ts`

**Interfaces:**
- `REQUEST_CORRECTION`: preserves report; only exact correction report becomes actionable.
- `MORE_WORK`: preserves prior report/visit and opens FOLLOW_UP round.
- `CLOSEOUT`: in one DB transaction:
  1. recheck current Manager authority;
  2. lock/read current ticket, assignment, report and public communication version;
  3. use existing Core public-Q&A completion guard;
  4. record Manager-authored completion text through existing Core handling semantics;
  5. set assignment `ENDED/CLOSED`;
  6. revoke all capabilities/sessions;
  7. persist disposition/receipt;
  8. expose one authoritative result.
- Reassignment atomically ends old assignment `SUPERSEDED`, revokes old capabilities/sessions, and creates a new PREPARING assignment without rewriting old evidence.
- Existing direct `HANDLING status=COMPLETED` stays on the frozen application path, but `createCoreFlowPort(...).communication.guardCompletion` must, in the same existing transaction, run both `core_flow.guard_communication_completion(...)` and `vendor_handoff.guard_direct_completion(...)` before `scope.store(...)`. This rejects backend direct-completion bypass whenever a non-ended VendorAssignment exists and serializes with assignment create/reassign/closeout without changing the public Core action contract.

- [ ] **Step 1: Write concurrency/atomicity RED tests**

Cover AC38–AC42 and reassignment:
- communication-first => closeout conflict/no partial transition;
- closeout-first => later message conflict/no partial message;
- Manager auth revocation while waiting => no closeout;
- current report changed while waiting => no closeout;
- ticket COMPLETED iff assignment CLOSED in successful closeout;
- Vendor access denied after closeout;
- active assignment => existing direct Manager completion returns STATE_CONFLICT with no partial completion;
- assignment-create versus direct-completion race => exactly one wins under the shared per-ticket advisory lock;
- no active assignment => existing direct Manager completion still works;
- historical ENDED assignment => direct Manager completion still works;
- reassign preserves old visits/reports and revokes old access.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts tests/postgres/vendor-handoff-security.test.ts tests/postgres/core-ticket-communication.test.ts
```
Expected: RED for new Vendor cases.

- [ ] **Step 2: Implement manager dispositions/reassignment**

Manager completion text is never prefilled from Vendor workSummary.

- [ ] **Step 3: Implement Manager UI**

After successful closeout, show `COMPLETED` and assignment `ENDED/CLOSED` as one result. No optimistic partial-success screen.

- [ ] **Step 4: Run focused + direct-completion regressions**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts tests/postgres/vendor-handoff-security.test.ts tests/postgres/core-flow.test.ts tests/postgres/core-ticket-communication.test.ts
npm run test:web -- apps/web/src/server/core-flow/vendor-handoff.test.ts apps/web/src/app/core/vendor-handoff-manager.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/persistence-postgres/src/vendor-handoff packages/persistence-postgres/src/core-flow.ts apps/web/src/server/core-flow/vendor-handoff.ts apps/web/src/app/core/vendor-handoff-manager.tsx packages/api-client/src/core-vendor-handoff.ts tests/postgres/vendor-handoff-completion.test.ts tests/postgres/vendor-handoff-security.test.ts
git commit -m "feat(vendor): add atomic manager disposition"
```

---

### Task 10: Preserve Tenant outcome, follow-up tickets, Maintenance Fact, and role privacy

**Files:**
- Extend: `apps/web/src/app/core/vendor-handoff-tenant.test.tsx`
- Extend: `apps/web/src/app/core/vendor-handoff-manager.test.tsx`
- Extend: `apps/web/src/server/core-flow/vendor-handoff.test.ts`
- Extend: `tests/postgres/vendor-handoff-security.test.ts`
- No new product capability unless a failing regression demonstrates the integration needs a minimal projection fix.

**Interfaces:**
- After Manager closeout, existing Tenant outcome component becomes available unchanged.
- `UNRESOLVED / RECURRENCE_CLAIM` creates a fresh linked ticket; source ticket/assignment stay closed.
- Maintenance Fact remains explicit Manager action; no Vendor report/photo/text auto-copy.
- Tenant DTO/surface never contains `vendorLabel`, Vendor private note, raw Vendor completion photos, Manager private fields, or assignment audit history.
- Vendor DTO/surface never contains Tenant name/contact/rawUserText/full public Q&A/private Manager fields/unrelated resources/Maintenance Fact history/costs.

- [ ] **Step 1: Add privacy/regression assertions**

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-security.test.ts tests/postgres/core-ticket-outcome.test.ts tests/postgres/core-maintenance-fact.test.ts
npm run test:web -- apps/web/src/app/core/vendor-handoff-tenant.test.tsx apps/web/src/app/core/vendor-handoff-manager.test.tsx
```
Expected: existing outcome/fact tests remain PASS; new Vendor privacy assertions PASS only after correct projections exist.

- [ ] **Step 2: Run API contract serialization checks**

Parse each role DTO and assert forbidden field names are absent from serialized output, not merely undefined.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/core/vendor-handoff-tenant.test.tsx apps/web/src/app/core/vendor-handoff-manager.test.tsx apps/web/src/server/core-flow/vendor-handoff.test.ts tests/postgres/vendor-handoff-security.test.ts
git commit -m "test(vendor): lock outcome and privacy regressions"
```

---

### Task 11: Prove idempotency, response-loss recovery, restart persistence, and frozen boundaries

**Files:**
- Create: `scripts/vendor-handoff-restart-check.mjs`
- Create: `scripts/vendor-handoff-dev.mjs`
- Extend: `tests/postgres/vendor-handoff-security.test.ts`
- Extend: `tests/architecture/vendor-handoff-boundary.test.ts`
- Create/update recovery helpers only under Vendor-specific Web files; do not alter frozen Q&A/outcome recovery semantics unless a directly failing regression requires it.

**Interfaces:**
- Every consequential mutation persists/reconciles a safe receipt.
- Same key + same fingerprint => same durable logical result.
- Same key + changed fingerprint => conflict.
- Unknown HTTP result => UI enters result-checking/reconciling state and reads authoritative state/receipt before any retry.
- Link issue/reissue is the special unrecoverable-raw-byte case.
- Restart check covers assignment, packet revisions, capability/session state, scheduling, appointments, work events, report revisions, closeout history and safe receipts.

- [ ] **Step 1: Write idempotency/response-loss RED tests**

Include two real requests across separate app/service instances where applicable; do not use a mock-only proof.

- [ ] **Step 2: Add restart script**

The script must:
- start owned PostgreSQL/server;
- construct only synthetic data;
- complete the full resident-confirmation flow plus a separate preauthorization case;
- restart the owned server;
- re-read all durable history;
- prove old Vendor session is denied after closeout;
- prove direct Manager completion still works on no-assignment ticket.

Run:
```bash
node --experimental-transform-types scripts/vendor-handoff-restart-check.mjs
```
Expected: one explicit `VENDOR_HANDOFF_RESTART_PASS` summary and exit 0.

- [ ] **Step 3: Architecture/security negative probes**

`tests/architecture/vendor-handoff-boundary.test.ts` must prove:
- external Vendor server modules do not import B1/Auth0 session/container;
- no Vendor route lives under authenticated Core session by accident;
- `bm_vendor_web` grants are EXECUTE-only;
- `bm_b1_web` cannot SET ROLE into Vendor owner/runtime;
- Vendor server graph imports no analytics/third-party tracking module;
- no new route exposes Tenant raw Vendor photos.

- [ ] **Step 4: Run focused verification**

```bash
npm run test:shared -- tests/architecture/vendor-handoff-boundary.test.ts
npm run test:postgres -- tests/postgres/vendor-handoff-security.test.ts
node --experimental-transform-types scripts/vendor-handoff-restart-check.mjs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/vendor-handoff-dev.mjs scripts/vendor-handoff-restart-check.mjs tests/postgres/vendor-handoff-security.test.ts tests/architecture/vendor-handoff-boundary.test.ts
git commit -m "test(vendor): prove recovery and restart boundaries"
```

---

### Task 12: Add complete browser acceptance, responsive checks, and hosted CI enforcement

**Files:**
- Create: `apps/web/playwright.vendor.config.ts`
- Create: `apps/web/tests/vendor-e2e/vendor-job.spec.ts`
- Create: `apps/web/tests/core-e2e/vendor-handoff.spec.ts`
- Create: `apps/web/tests/core-login-e2e/vendor-handoff.spec.ts`
- Modify: `apps/web/package.json`
- Modify: root `package.json`
- Modify: `.github/workflows/app-check.yml`
- Create: `ops/vendor_secure_handoff_v1.md`
- Modify: `ops/AI_Execution_Log.csv` append-only

**Interfaces:**
- New script `test:e2e:vendor` runs the standalone Vendor browser suite against owned synthetic PostgreSQL + server.
- Existing Core and Core-login suites receive integrated Manager/Tenant Vendor handoff scenarios; do not delete/reduce current assertions.
- Hosted `web-e2e` job preserves all live pre-existing gates and adds the Vendor suite after the single Web build. If Task 0 finds RR01 has changed this job, preserve the successor Core/SDK/Web/B1 order and append the Vendor gate without removing it.
- No retry increase and no timeout increase without separate evidence/authorization.

- [ ] **Step 1: Write the full browser scenario**

Required synthetic resident-confirmation path:
1. manager opens approved GENERAL_VENDOR ticket;
2. creates PREPARING assignment;
3. packet preview proves forbidden data absent;
4. publishes revision 1;
5. issues link; OPEN ticket becomes IN_PROGRESS;
6. first raw token redeem succeeds; token reuse fails;
7. Vendor sees one job only;
8. Vendor accepts;
9. Tenant submits availability;
10. Vendor proposes 1–5 slots;
11. Tenant confirms one;
12. immutable Appointment appears;
13. Vendor starts visit;
14. records + clears blocker;
15. FOLLOW_UP preserves first OCCURRED Appointment;
16. Vendor starts follow-up;
17. submits completion with sanitized synthetic photo;
18. Manager requests correction;
19. Vendor submits new report revision;
20. Manager closes out;
21. ticket COMPLETED + assignment ENDED/CLOSED appear together;
22. Vendor session loses access;
23. Tenant records an existing outcome flow;
24. Manager optionally records Maintenance Fact separately;
25. no Vendor data auto-copies into fact;
26. separate ticket with no active Vendor uses existing direct completion.

Required separate preauthorization path:
- current Tenant submits windows;
- consent starts OFF;
- explicit selected-window confirmation;
- Vendor selects contained slot;
- Appointment links exact authorization;
- same-day AM→PM label displays both meridiems;
- current occupancy recheck blocks visit after synthetic occupancy end.

Required negative probes:
- assignment A Vendor session probes B packet/photo/appointment/report IDs;
- SAFETY_ESCALATED and non-external route show no handoff;
- stale packet/round/report/communication versions conflict;
- link issue response-loss reconciles to unrecoverable raw link + explicit Reissue.

- [ ] **Step 2: Add responsive/accessibility checks**

At minimum:
- Manager 1440 and 1280 ownership;
- Manager/Tenant/Vendor 390 px;
- 200% root text at 390 px;
- no horizontal overflow;
- no sticky bottom CTA;
- action-point consent copy visible;
- current task before history;
- dialog focus trap/return and keyboard-only critical actions;
- real device/IME and real screen reader remain explicitly NOT_TESTED unless separately executed.

- [ ] **Step 3: Run local complete gates once**

Run from clean exact implementation HEAD:
```bash
npm run verify
npm run test:web
npm run test:postgres
npm run test:e2e:web
npm run test:e2e:b1
npm run test:e2e:vendor
node --experimental-transform-types scripts/vendor-handoff-restart-check.mjs
PYTHONPATH="$PWD" python3 scripts/verify_repository.py --history
git diff --check
```

Expected: all commands exit 0 with no skipped/todo in required Vendor suites. Preserve first unexpected failure and STOP; do not rerun to seek green.

- [ ] **Step 4: Publish Draft candidate only**

Before commit/push:
- inspect exact changed paths;
- scan public tree/history;
- confirm no raw token/session/CSRF, real personal data, or private completion image bytes in public artifacts;
- append `ops/vendor_secure_handoff_v1.md` with actual evidence classifications.

Commit:
```bash
git add <reviewed named paths only>
git commit -m "feat: implement vendor secure handoff v1"
```

Push dedicated branch and open/retain a **Draft PR**. No Ready, merge, or deploy.

- [ ] **Step 5: Hosted exact-head CI**

Require fresh required checks on exact candidate HEAD. Inspect the actual `web-e2e` log and prove Core/SDK/Web/B1/Vendor commands really executed; job green alone is not enough.

- [ ] **Step 6: Freeze implementation candidate and STOP**

Publish:
- BASE_SHA / candidate HEAD;
- exact changed paths and commits;
- all local test generations;
- hosted run IDs and exact-head proof;
- AC01–AC57 traceability;
- retained D7-L01, D8-L01, D8-L02 limits;
- production credential/IAM/deploy/real data NOT_AUTHORIZED.

Next gate:
`INDEPENDENT_FIXED_CANDIDATE_REVIEW_VENDOR_SECURE_HANDOFF_V1`.

No Ready / merge / deploy.

---

## AC01–AC57 Traceability

| AC | Owning task(s) | Primary evidence |
|---|---|---|
| AC01 Manager authorization | T2,T3,T9 | PG foundation/security + Core HTTP |
| AC02 External-route gate | T2,T3 | PG foundation + Manager UI |
| AC03 Safety gate | T2,T3,T12 | PG + browser negative |
| AC04 One current assignment | T2,T9 | concurrent PG |
| AC05 No Vendor IAM | T2,T4 | role/schema + Vendor browser |
| AC06 Token storage | T2,T4,T11 | catalog/data scan |
| AC07 One-time redeem | T2,T4 | external HTTP/PG |
| AC08 Session replacement | T2,T4 | PG + HTTP |
| AC09 Assignment scope | T2,T4,T11,T12 | hidden-resource probes |
| AC10 Packet minimum data | T1,T2,T3 | contracts/PG/UI |
| AC11 Private data absent | T1,T2,T10,T12 | serialization/browser |
| AC12 Provenance | T1,T2,T3 | contract/packet UI |
| AC13 Address provenance | T2,T3 | PG publish tests |
| AC14 Photo allowlist | T2,T3,T11 | PG/security |
| AC15 Packet immutability | T2 | PG revision tests |
| AC16 Stale packet | T2,T3,T12 | PG/HTTP/browser |
| AC17 Redeem ≠ Accept | T1,T4 | HTTP/UI |
| AC18 Decline | T1,T4 | HTTP/PG |
| AC19 Withdraw | T1,T4 | HTTP/PG |
| AC20 One OPEN round | T5 | concurrent PG |
| AC21 Tenant slot confirmation | T5,T6,T12 | PG/UI/browser |
| AC22 Preauth containment | T5,T6,T12 | PG/time/browser |
| AC23 Occupancy recheck | T5,T7,T12 | PG/browser |
| AC24 Immutable Appointment | T5,T6 | PG/UI |
| AC25 RESCHEDULE≠FOLLOW_UP | T5,T6,T7 | PG/UI |
| AC26 No Manager scheduling relay | T6,T12 | browser flow |
| AC27 No notification claim | T3,T4,T6,T12 | copy/browser |
| AC28 Visit start once | T7 | PG/HTTP |
| AC29 Blocker overlay | T7 | PG/UI |
| AC30 Blocker history | T7 | PG/UI |
| AC31 Follow-up visit | T5,T7,T12 | PG/browser |
| AC32 Completion eligibility | T8 | PG |
| AC33 Photo/omission contract | T1,T8 | contract/PG |
| AC34 Metadata stripping | T8 | real decode/re-encode test |
| AC35 Report correction | T8,T9 | PG/browser |
| AC36 Report ≠ closeout | T8,T9 | PG/UI |
| AC37 Completion-reported freeze | T8 | PG/HTTP/UI |
| AC38 Atomic closeout | T9 | concurrent PG |
| AC39 Communication guard | T9 | concurrent PG + browser |
| AC40 Access revoked | T9,T12 | PG/Vendor browser |
| AC41 Direct Manager regression | T3,T9,T12 | Core PG/browser |
| AC42 Historical ENDED regression | T3,T9,T12 | PG/browser |
| AC43 Tenant outcome unchanged | T10,T12 | existing PG/browser |
| AC44 Fresh follow-up ticket | T10,T12 | existing PG/browser |
| AC45 Maintenance Fact explicit | T10,T12 | existing PG/browser |
| AC46 Tenant photo isolation | T8,T10,T12 | HTTP/browser |
| AC47 RLS/ACL | T2,T5,T7,T8,T11 | catalog/negative roles |
| AC48 Idempotency | T2,T5,T7,T8,T9,T11 | receipts/replays |
| AC49 Changed replay | T1,T2,T11 | fingerprint conflict |
| AC50 Stale concurrency | T2,T5,T8,T9,T11 | PG/HTTP |
| AC51 Response-loss | T3,T11,T12 | recovery/browser |
| AC52 Vendor 390 | T4,T6,T12 | Playwright |
| AC53 Manager/Tenant 390 | T3,T6,T12 | Playwright |
| AC54 Restart persistence | T11 | restart script |
| AC55 Synthetic/public safety | T11,T12 | scanner/history |
| AC56 Existing regressions | T10,T12 | full local suites |
| AC57 Hosted exact-head CI | T12 | fresh hosted run/logs |

## Candidate Review Gates

Independent plan review must reject the plan if any of these are true:

- any AC01–AC57 lacks an owning task and concrete evidence path;
- Vendor external HTTP can authenticate through B1/Auth0 or `bm_b1_web`;
- Manager/Tenant API can impersonate Vendor session authority;
- raw Vendor capability/session/CSRF is durably stored or logged;
- Manager can author Tenant unattended-entry consent;
- Appointment time is updated in place;
- Vendor report can directly complete the ticket or write Tenant outcome/Maintenance Fact;
- closeout is not atomic with assignment CLOSED/access revocation/public-Q&A guard;
- active assignment leaves the legacy direct-completion bypass visible;
- old ENDED assignment blocks direct Manager completion;
- photo metadata stripping is asserted only by mock/filename rather than actual decoded output;
- response-loss handling blindly retries or can mint duplicate logical actions;
- plan requires modifying `0001–0018` or any then-existing migration;
- plan removes/weakens existing frozen tests, security roles, hosted checks, timeouts, or retry settings;
- product implementation is started before separate operator authorization after independent plan review.

## Plan Self-Review Checklist

Before requesting independent review, the plan author must record:
- Spec/D9R1 coverage: every frozen section represented; AC traceability 57/57.
- Step scan: no unresolved placeholder markers or unowned signatures.
- Type consistency: contract enum/DTO/port names match every later task.
- Review Focus: each of the five items has an explicit owning test task.
- Proportion: code bodies are not pre-written; plan contains signatures, assertions, commands and frozen values only.
- Repository truth: all existing paths cited above were observed at `954ef347...`; future paths are clearly marked Create.
- Authority: product implementation remains NOT_AUTHORIZED at plan-candidate publication.

## Execution Handoff

After independent plan review passes, STOP. A passing plan review does **not** authorize Task 0 or product implementation. The operator must separately authorize product implementation and choose the execution method.

Recommended future execution method: **Subagent-driven**, because the subsystem crosses four DB migrations, three security identities, three role-specific UIs, concurrency/idempotency, binary evidence and full browser/restart/CI gates; per-task fresh review materially reduces cross-boundary security regressions.

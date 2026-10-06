# Vendor Secure Handoff v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** REMEDIATION_SUCCESSOR_CANDIDATE_FOR_DELTA_REVIEW — PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED

**Reviewed predecessor:** HEAD `32ea0d151cc74e03878823860c429a580216f1ef`, plan blob `a6aa1d111dec67ee80b7f687000af087b3bf1ce6`, independent review `6007733166` (`FIX_REQUIRED / B0 / H4 / M2`). This successor resolves that review under remediation gate `6007888778` and authorization `6007894685`; the predecessor remains immutable history.

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
- All new database changes are additive. At drafting time migrations `0001–0018` are frozen; planned files are `0019–0023`. If Task 0 finds a newer live migration head, renumber the **next five** new migrations without rewriting any existing migration.
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
- All VendorAssignment/direct-completion races serialize on the source `core_flow.ticket` row lock first; do not introduce a second per-ticket advisory-lock order. After the ticket row is locked, lock/recheck current VendorAssignment and subordinate Vendor resources in that order.
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
- Create `packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql`
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
- existing migrations are contiguous and determine the first five free numbers;
- current Next/React/Playwright/TypeScript/sharp pins;
- current hosted job set and current `web-e2e` commands;
- whether RR01 PR #73 or any successor landed.

If migration numbers changed, rename planned `0019–0023` paths to the next five free numbers before implementation. Preserve the task-to-migration ownership: foundation, scheduling, work, completion, then manager-actions. If security/CI architecture changed materially, STOP for plan delta review.

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
  - `VendorDeclineReason = "NO_CAPACITY"|"OUT_OF_SERVICE_AREA"|"SKILL_MISMATCH"|"CANNOT_MEET_TIMING"|"OTHER"`
  - `VendorBlockerCode = "PARTS_REQUIRED"|"ACCESS_BLOCKED"|"SCOPE_REVIEW_REQUIRED"|"FOLLOW_UP_VISIT_REQUIRED"|"OTHER"`
  - `VendorSharedDetailSourceType = "TENANT_REPORTED"|"BUILDING_VERIFIED"|"MANAGER_REVIEWED"`
  - `VendorPhotoOmissionReason = "NOT_APPLICABLE"|"SAFETY_OR_PRIVACY"|"TECHNICAL_FAILURE"`
  - `VendorAppointmentConfirmationMode = "TENANT_CONFIRMED"|"PREAUTHORIZED_ENTRY"`
  - `VendorManagerDisposition = "CLOSEOUT"|"REQUEST_CORRECTION"|"MORE_WORK"`
- Produces DTOs `ManagerVendorHandoffDto`, `TenantVendorSchedulingDto`, `VendorJobDto`, `VendorLinkIssueDto`, `VendorCompletionReportDto`.
- Contract bounds fixed by this plan: `vendorLabel` plain text 1–80 characters; optional `accessInstruction` plain text 1–500 characters; optional decline/withdraw/blocker operational note 1–500 characters; report-correction Manager reason is required plain text 1–500 characters; optional `componentOrPartNote` is plain text 1–500 characters and is never inventory/warranty/cost data; Vendor/Manager work/completion summaries retain the frozen 1–1000-character bound. Control/format characters are rejected consistently with existing text validators.
- Produces strict mutation schemas and exact command matrix below. Every consequential mutation carries UUID `clientRequestId` plus the listed stale-state guards; server-derived authority IDs are never accepted as client authority.

| Actor | Command schema | Application port method | HTTP route | Required stale-state fields | Durable result |
|---|---|---|---|---|---|
| Manager | `VendorCreateAssignmentCommand` | `manager.createAssignment(ticketId,input)` | `POST /api/v2/core/manager/tickets/:ticketId/vendor-assignment` | expected ticket version | PREPARING assignment |
| Manager | `VendorPublishPacketCommand` | `manager.publishPacket(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/packet-revisions` | expectedAssignmentVersion, expectedPacketRevisionId/null | immutable current packet revision |
| Manager | `VendorIssueLinkCommand` | `manager.issueLink(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/link` | expectedAssignmentVersion, expectedPacketRevisionId | first OFFERED capability; OPEN→IN_PROGRESS when needed |
| Manager | `VendorReissueLinkCommand` | `manager.reissueLink(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/link/reissue` | expectedAssignmentVersion, expectedPacketRevisionId | old unredeemed capability invalidated; new capability |
| Manager | `VendorRevokeCommand` | `manager.revoke(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/revoke` | expectedAssignmentVersion | ENDED/REVOKED + future scheduling cancelled |
| Manager | `VendorReassignCommand` | `manager.reassign(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/reassign` | expectedAssignmentVersion | old ENDED/SUPERSEDED + new PREPARING |
| Manager | `VendorRequestCorrectionCommand` | `manager.requestCorrection(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/completion-correction` | expectedAssignmentVersion, expectedCompletionReportId | durable correction request |
| Manager | `VendorRequireFollowUpCommand` | `manager.requireFollowUp(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/follow-up` | expectedAssignmentVersion, expectedCompletionReportId | FOLLOW_UP round with report provenance |
| Manager | `VendorManagerRescheduleCommand` | `manager.reschedule(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/reschedule` | expectedAssignmentVersion, expectedRoundVersion, expectedAppointmentId, expectedPacketRevisionId | future appointment superseded + RESCHEDULE round |
| Manager | `VendorCloseoutCommand` | `manager.closeout(assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/closeout` | expectedAssignmentVersion, expectedCompletionReportId, expectedCommunicationVersion | ticket COMPLETED + assignment ENDED/CLOSED atomically |
| Tenant | `VendorAvailabilityCommand` | `tenant.submitAvailability(ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/availability` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId | immutable availability submission |
| Tenant | `VendorEntryAuthorizationCommand` | `tenant.authorizeEntry(ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/entry-authorization` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId, availabilitySubmissionId | exact selected-window authorization |
| Tenant | `VendorConfirmSlotCommand` | `tenant.confirmSlot(ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/confirm` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId, proposalId | TENANT_CONFIRMED Appointment |
| Tenant | `VendorTenantRescheduleCommand` | `tenant.reschedule(ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/reschedule` | expectedAssignmentVersion, expectedRoundVersion, expectedAppointmentId, expectedPacketRevisionId | future appointment superseded + RESCHEDULE round |
| Vendor | `VendorRedeemCommand` | `external.redeem(tokenDigest,clientRequestId,sessionDigest,csrfDigest)` | `POST /api/v2/vendor/session/redeem` | clientRequestId; raw one-time token only; no assignment ID authority | vendor session / exact-replay replacement session |
| Vendor | `VendorLogoutCommand` | `external.logout(sessionDigest,clientRequestId)` | `POST /api/v2/vendor/session/logout` | clientRequestId; session + CSRF | idempotent current-session revocation |
| Vendor | `VendorAcceptCommand` | `external.accept(sessionDigest,input)` | `POST /api/v2/vendor/job/accept` | expectedAssignmentVersion, expectedPacketRevisionId | OFFERED→ACTIVE + first INITIAL/OPEN round atomically |
| Vendor | `VendorDeclineCommand` | `external.decline(sessionDigest,input)` | `POST /api/v2/vendor/job/decline` | expectedAssignmentVersion, expectedPacketRevisionId | ENDED/DECLINED |
| Vendor | `VendorWithdrawCommand` | `external.withdraw(sessionDigest,input)` | `POST /api/v2/vendor/job/withdraw` | expectedAssignmentVersion, expectedPacketRevisionId | ENDED/WITHDRAWN |
| Vendor | `VendorProposalCommand` | `external.proposeSlots(sessionDigest,input)` | `POST /api/v2/vendor/scheduling/proposals` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId | 1–5 current proposal slots |
| Vendor | `VendorPreauthorizedAppointmentCommand` | `external.selectPreauthorizedSlot(sessionDigest,input)` | `POST /api/v2/vendor/scheduling/preauthorized-appointment` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId, availabilitySubmissionId, selectedWindowId | PREAUTHORIZED_ENTRY Appointment |
| Vendor | `VendorRescheduleCommand` | `external.reschedule(sessionDigest,input)` | `POST /api/v2/vendor/scheduling/reschedule` | expectedAssignmentVersion, expectedRoundVersion, expectedAppointmentId, expectedPacketRevisionId | future appointment superseded + RESCHEDULE round |
| Vendor | `VendorVisitStartCommand` | `external.startVisit(sessionDigest,appointmentId,input)` | `POST /api/v2/vendor/appointments/:appointmentId/visit-start` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId | Appointment OCCURRED + VISIT_STARTED |
| Vendor | `VendorBlockerCommand` | `external.recordBlocker(sessionDigest,input)` | `POST /api/v2/vendor/blockers` | expectedAssignmentVersion, expectedPacketRevisionId | append-only blocker evidence |
| Vendor | `VendorClearBlockerCommand` | `external.clearBlocker(sessionDigest,blockerId,input)` | `POST /api/v2/vendor/blockers/:blockerId/clear` | expectedAssignmentVersion, expectedPacketRevisionId | append-only clear evidence |
| Vendor | `VendorCompletionReportCommand` | `external.submitCompletionReport(sessionDigest,input)` | `POST /api/v2/vendor/completion-reports` | expectedAssignmentVersion, expectedPacketRevisionId, expectedAppointmentId, expectedCorrectionRequestId/null | append-only current report revision |

Read-only routes and exact port methods are: `manager.readHandoff(ticketId)` → `GET /api/v2/core/manager/tickets/:ticketId/vendor-handoff`; `tenant.readScheduling(ticketId)` → `GET /api/v2/core/tickets/:ticketId/vendor-scheduling`; `external.session(sessionDigest)` → `GET /api/v2/vendor/session`; `external.readJob(sessionDigest)` → `GET /api/v2/vendor/job`.

`clientRequestId` is mandatory for every state-changing command in the table, including redeem and logout. Redeem remains one-time capability authority: first success stores only token/session digests plus the redeem request identity; an exact replay with the same token digest + same `clientRequestId` after uncertain delivery may atomically revoke the session created by that same redemption and return one fresh replacement session cookie, while a different request ID cannot redeem the already-consumed capability. Logout exact replay with the same request ID returns the same logical revoked result.
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
- exact enum values above, including decline/blocker/shared-detail/photo-omission/confirmation/disposition enums;
- correction reason and `componentOrPartNote` bounds above;
- command-matrix schema names, exact application port method names, routes, stale-state fields and durable results above;
- every state-changing command in the matrix requires UUID `clientRequestId`, including redeem/logout; redeem exact replay is bounded to the same token digest + request ID and never revives the raw capability.

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
- All assignment create/reassign/revoke/closeout/direct-completion races use the source `core_flow.ticket` row `FOR UPDATE` as the universal first serialization lock. After that lock, recheck B1 Manager authority, then lock current VendorAssignment and subordinate Vendor resources. Do not add a separate per-ticket advisory-lock order.
- Core-owned SECURITY DEFINER bridge helpers are narrow capabilities, never broad Core-table grants:
  - `core_flow.vendor_handoff_source(p_digest bytea,p_ticket text,p_photo_ids uuid[],p_lock boolean) RETURNS jsonb`: Manager-authorized source snapshot and selected-photo metadata for packet publication.
  - `core_flow.vendor_handoff_current_tenant(p_org uuid,p_ticket text,p_lock boolean) RETURNS jsonb`: server-derived current occupancy/member identity for Tenant authority and preauthorized visit recheck; callable only by `bm_vendor_handoff_owner`.
  - `core_flow.vendor_handoff_source_photo(p_org uuid,p_ticket text,p_photo uuid) RETURNS TABLE(metadata jsonb,content bytea)`: exact same-ticket binary read used only after `vendor_handoff` has validated current Vendor session/current packet/exact allowlist.
  - `core_flow.vendor_handoff_mark_offered(p_digest bytea,p_ticket text) RETURNS jsonb`: first-link capability that rechecks Manager authority under the ticket lock and applies the existing HANDLING `OPEN→IN_PROGRESS` semantics with a fixed safe public handling message; Vendor label/private metadata cannot enter that event.
- `vendor_handoff.guard_direct_completion(p_digest bytea,p_ticket text) RETURNS void` is the one narrow Vendor-schema capability callable by the ordinary B1 Core path. It acquires **no earlier competing lock**; after the caller already holds the source ticket row lock, it conflicts if any non-ended VendorAssignment exists.
- Grant the four Core bridge helpers above only to `bm_vendor_handoff_owner`; do not grant them directly to `bm_b1_web` or `bm_vendor_web`. Grant only `vendor_handoff.guard_direct_completion` to `bm_b1_web`.
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
- assignment create/publish/link operations take the source ticket row lock first and recheck current Manager authorization after waits;
- canonical building/serviceAddress/unit/issue identity comes from server-side Core source;
- tenant raw text is never address fallback;
- packet publish fails safe when canonical address is unavailable;
- first link issue transitions `PREPARING→OFFERED` and changes ticket `OPEN→IN_PROGRESS` through existing Core handling capability without copying Vendor metadata into public events;
- exact link replay returns safe issuance metadata with `created:false`; raw link bytes are never recoverable from DB/receipt;
- first successful link issue calls the narrow Core `vendor_handoff_mark_offered(...)` capability in the same transaction so PREPARING→OFFERED and OPEN→IN_PROGRESS (when applicable) cannot split.

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
- Core Manager endpoints under existing authenticated boundary use the exact Task 1 matrix routes:
  - `GET /api/v2/core/manager/tickets/:ticketId/vendor-handoff`
  - `POST /api/v2/core/manager/tickets/:ticketId/vendor-assignment`
  - `POST /api/v2/core/manager/vendor-assignments/:assignmentId/packet-revisions`
  - `POST /api/v2/core/manager/vendor-assignments/:assignmentId/link`
  - `POST /api/v2/core/manager/vendor-assignments/:assignmentId/link/reissue`
  - `POST /api/v2/core/manager/vendor-assignments/:assignmentId/revoke`
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
- `POST /api/v2/vendor/session/redeem` consumes the raw fragment token once, sets HttpOnly Strict `vendor_session` cookie scoped to `/api/v2/vendor`, and returns current job + fresh CSRF.
- `GET /api/v2/vendor/session` authenticates the session and rotates/returns a fresh server-issued CSRF value without extending the absolute session expiry.
- `POST /api/v2/vendor/session/logout` requires session + `X-Vendor-CSRF` and revokes only the current Vendor browser session.
- Vendor mutations require `X-Vendor-CSRF`.
- Task 4 owns `GET /api/v2/vendor/job` and `POST /api/v2/vendor/job/decline` only. `POST /api/v2/vendor/job/accept` and `POST /api/v2/vendor/job/withdraw` are contract-defined in Task 1 but are implemented in Task 5, because Accept must atomically create the first INITIAL SchedulingRound and Withdraw is only valid after that ACTIVE transition.
- `GET /api/v2/vendor/job/source-photos/:photoId` serves only an explicitly allowlisted current Work Packet source photo after assignment/session recheck; guessed or cross-assignment photo IDs use the same hidden-resource response.
- `/vendor/job#<raw-token>` extracts the fragment client-side, calls redeem, and executes `history.replaceState` after successful redemption.
- Vendor surface headers: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, frame embedding denied. No analytics/CDN/external scripts.

- [ ] **Step 1: Write token/session/HTTP RED tests**

Assert:
- cryptographically random token material and SHA-256 digest;
- raw token/session/CSRF never appears in thrown/public error text;
- first redeem succeeds; an independent second redeem of the same capability fails;
- simulated redeem response loss + exact same token/clientRequestId reconciles by replacing only the session created by that same redemption, leaves at most one active session, and does not reactivate the capability;
- same consumed token with a different clientRequestId fails;
- deterministic clock: raw capability redeem succeeds immediately before 72-hour expiry and fails immediately after it;
- deterministic clock: session read/mutation succeeds immediately before the 7-day absolute expiry and fails immediately after it;
- `GET /api/v2/vendor/session` / CSRF refresh does not extend the absolute expiry;
- expired capability/session replay does not resurrect authority; reissue after expiry creates only a new capability;
- replacement redeem invalidates previous session;
- Reissue alone does not invalidate current active session;
- Revoke does;
- explicit Vendor logout revokes the current session but does not end the assignment; exact same logout request ID is idempotent;
- assignment ENDED denies read/mutation;
- assignment A session cannot probe B;
- opening/redeeming leaves assignment OFFERED; Task 4 does not implement Accept as a partial mutation;
- Decline works only while OFFERED;
- the Task 1 accept/withdraw routes remain unimplemented until Task 5 owns their atomic scheduling-aware transitions.

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

### Task 5: Persist Tenant/Vendor scheduling, consent, immutable Appointments, and atomic Accept/Withdraw

**Files:**
- Create: `packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql`
- Modify: `packages/persistence-postgres/src/vendor-handoff/tenant.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Modify: `packages/api-client/src/vendor-job.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.test.ts`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.test.tsx`
- Create: `tests/postgres/vendor-handoff-scheduling.test.ts`
- Extend: `packages/api-contracts/src/vendor-handoff.test.ts`

**Interfaces:**
- Tables/resources: `scheduling_round`, `tenant_availability_submission`, `tenant_availability_window`, `tenant_entry_authorization`, `tenant_entry_authorization_window`, `vendor_slot_proposal`, `vendor_slot`, `appointment`.
- Task 5 implements `external.accept(sessionDigest,input)` and `POST /api/v2/vendor/job/accept`; successful Vendor Accept atomically transitions OFFERED→ACTIVE and creates the first `SchedulingRound purpose=INITIAL,status=OPEN`. There is no separate INITIAL-round command. Exact replay returns the same logical accept/round result. One OPEN round per assignment is enforced by partial unique constraint plus source-ticket/assignment lock+recheck.
- Task 5 also implements `external.withdraw(sessionDigest,input)` and `POST /api/v2/vendor/job/withdraw`; Withdraw is allowed only from ACTIVE, transitions to ENDED/WITHDRAWN, revokes Vendor access, atomically marks any OPEN round CANCELLED and any future SCHEDULED Appointment CANCELLED, preserves OCCURRED/work/report history, and leaves the source ticket unfinished.
- Tenant availability mutation never creates unattended authorization.
- Authorization references exact selected windows and current occupancy member.
- Resident-confirmation proposal has 1–5 candidate slots; Tenant selects one current valid slot.
- Preauthorized Vendor selection must be fully contained in one authorized window and creates an Appointment without second Tenant confirmation.
- Appointment timestamps never UPDATE. RESCHEDULE creates a new round/appointment and supersedes the old future Appointment; FOLLOW_UP requires prior OCCURRED.

- [ ] **Step 1: Write DB RED tests**

Cover AC20–AC27:
- Vendor Accept creates ACTIVE + exactly one INITIAL/OPEN round in one transaction; concurrent/replayed Accept cannot create a second round;
- Vendor Withdraw is rejected before Accept, succeeds only from ACTIVE, revokes access, cancels any OPEN round/future SCHEDULED Appointment, preserves OCCURRED/work/report evidence, and leaves ticket unfinished;
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
- Tenant, Vendor and Manager RESCHEDULE commands all require a future SCHEDULED Appointment, atomically mark it SUPERSEDED, create one new `purpose=RESCHEDULE,status=OPEN` round, and preserve the old Appointment;
- concurrent Accept/first scheduling actions cannot create two INITIAL OPEN rounds;
- RESCHEDULE/FOLLOW_UP distinction.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-scheduling.test.ts
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
```
Expected: RED.

- [ ] **Step 2: Implement migration 0020, atomic Accept/Withdraw, and persistence methods**

All stored times are `timestamptz`; reject non-finite values and `startAt >= endAt`; compare absolute instants. Accept and first INITIAL round must commit together; never expose ACTIVE with no INITIAL round. Withdraw ends the assignment without deleting prior round/appointment/work history; only still-actionable OPEN/SCHEDULED records receive CANCELLED disposition.

- [ ] **Step 3: Run scheduling + Vendor HTTP/UI + security regression**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-scheduling.test.ts tests/postgres/vendor-handoff-security.test.ts tests/postgres/core-ticket-outcome.test.ts
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql packages/persistence-postgres/src/vendor-handoff packages/api-contracts/src/vendor-handoff.test.ts packages/api-client/src/vendor-job.ts apps/web/src/server/vendor-handoff/http.ts apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.tsx apps/web/src/app/vendor/job/vendor-job-screen.test.tsx tests/postgres/vendor-handoff-scheduling.test.ts
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
  - `POST .../confirm`
  - `POST .../reschedule`
- Vendor endpoints:
  - `POST /api/v2/vendor/scheduling/proposals`
  - `POST /api/v2/vendor/scheduling/preauthorized-appointment`
  - `POST /api/v2/vendor/scheduling/reschedule`
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
- `scheduling_round` FOLLOW_UP provenance is exact: a FOLLOW_UP round has exactly one of `source_blocker_id` or `source_completion_report_id`; INITIAL/RESCHEDULE have neither.
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
- blocker-driven FOLLOW_UP atomically appends `BLOCKER_CLEARED` for that exact blocker and creates the new FOLLOW_UP/OPEN round with `sourceBlockerId`; the original blocker event remains history;
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

### Task 8: Add bounded initial completion reports, photo sanitization, and Manager review projection

**Files:**
- Create: `packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Create: `apps/web/src/server/vendor-handoff/photos.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.ts`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Modify: `packages/api-client/src/vendor-job.ts`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.ts`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.test.ts`
- Modify: `packages/api-client/src/core-vendor-handoff.ts`
- Modify: `apps/web/src/app/core/vendor-handoff-manager.tsx`
- Modify: `apps/web/src/app/core/vendor-handoff-manager.test.tsx`
- Create: `tests/postgres/vendor-handoff-completion.test.ts`

**Interfaces:**
- Tables `completion_report`, `completion_photo`, `manager_disposition`. The schema includes nullable revision/provenance columns needed by Task 9, but Task 8 only accepts an initial report with no correction request and `supersedesReportId = null`.
- Report history is append-only. The actual Manager correction-request + Vendor correction-report transition is owned by Task 9 so it cannot precede the durable Manager disposition that authorizes it.
- Submission requires valid OCCURRED visit, no current blocker, no OPEN SchedulingRound, current packet acknowledgment, and either 1–5 sanitized photos or one approved omission reason.
- Vendor photo upload uses the accepted `normalizePhoto` decode/re-encode path from Core photo handling without changing the frozen Core photo implementation.
- `COMPLETION_REPORTED` is a derived presentation/eligibility phase from the current pending report, not a fifth `VendorAssignment.status`; durable assignment status remains `ACTIVE` until an allowed end transition.
- Vendor report moves assignment presentation to `COMPLETION_REPORTED` read-only in Task 8 without ending assignment or ticket. Task 9 later enables the one exact correction-report exception only after a durable REQUEST_CORRECTION.
- Manager disposition is exactly `CLOSEOUT | REQUEST_CORRECTION | MORE_WORK`. `REQUEST_CORRECTION` stores the required 1–500-character Manager reason; `MORE_WORK` preserves the prior report and creates a FOLLOW_UP round with `sourceCompletionReportId`.
- Completion photo routes are exact: Vendor upload `POST /api/v2/vendor/job/completion-photos` with `X-Upload-Id`; Vendor own read `GET /api/v2/vendor/job/completion-photos/:photoId`; Manager read `GET /api/v2/core/manager/tickets/:ticketId/vendor-completion-photos/:photoId`. Task 8 owns all three server/client projections and Manager report/photo review UI. There is no Tenant completion-photo route.

- [ ] **Step 1: Write RED tests for report prerequisites and revisions**

Cover Task-8 portions of AC32–AC37:
- blocker/open round rejects initial report;
- 0 or >5 photos rejects without omission reason;
- omission reason versus photos is exclusive;
- workSummary 1–1000 and optional `componentOrPartNote` bound;
- packet acknowledgment must be current;
- initial report requires `supersedesReportId = null` and no pending correction request;
- Manager can read the current report and raw completion photos; Tenant cannot;
- COMPLETION_REPORTED rejects packet publication, scheduling/visit/blocker/withdraw, reassignment, revoke, and any second unrelated report. The exact correction exception is deliberately RED/absent until Task 9 creates the durable correction request.

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
git add packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql packages/persistence-postgres/src/vendor-handoff apps/web/src/server/vendor-handoff/photos.ts apps/web/src/server/vendor-handoff/http.ts apps/web/src/app/vendor/job/vendor-job-screen.tsx packages/api-client/src/vendor-job.ts apps/web/src/server/core-flow/vendor-handoff.ts apps/web/src/server/core-flow/vendor-handoff.test.ts packages/api-client/src/core-vendor-handoff.ts apps/web/src/app/core/vendor-handoff-manager.tsx apps/web/src/app/core/vendor-handoff-manager.test.tsx tests/postgres/vendor-handoff-completion.test.ts
git commit -m "feat(vendor): add completion report evidence"
```

---

### Task 9: Make Manager correction/more-work/closeout/reassign atomic

**Files:**
- Create: `packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql`
- Modify: `packages/persistence-postgres/src/vendor-handoff/manager.ts`
- Modify: `packages/persistence-postgres/src/core-flow.ts`
- Modify: `packages/persistence-postgres/src/vendor-handoff/external.ts`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.ts`
- Modify: `apps/web/src/app/core/vendor-handoff-manager.tsx`
- Modify: `packages/api-client/src/core-vendor-handoff.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.ts`
- Modify: `apps/web/src/server/vendor-handoff/http.test.ts`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.test.tsx`
- Modify: `packages/api-client/src/vendor-job.ts`
- Extend: `tests/postgres/vendor-handoff-completion.test.ts`
- Extend: `tests/postgres/vendor-handoff-security.test.ts`

**Interfaces:**
- Migration `0023_vendor_handoff_manager_actions.sql` owns all new Manager disposition/reassign/revoke/closeout SQL introduced by this task; do not back-edit `0019–0022` to add Task 9 behavior.
- Universal lock order for direct completion, assignment create, reassign, revoke and closeout is: source `core_flow.ticket FOR UPDATE` → current VendorAssignment → current round/appointment/blocker/report as required → command receipt. No new per-ticket advisory lock.
- `REQUEST_CORRECTION`: preserves the current report, stores a required Manager reason (1–500 plain text), and creates the only durable authorization for a correction report. Task 9 extends `external.submitCompletionReport(...)` so that an exact `expectedCorrectionRequestId` creates a new report revision with `supersedesReportId` equal to the report named by that request; no other report mutation is re-enabled.
- `MORE_WORK`: preserves prior report/visit and atomically creates FOLLOW_UP/OPEN with `sourceCompletionReportId`.
- Core-owned closeout bridge: `core_flow.vendor_handoff_complete(p_digest bytea,p_ticket text,p_expected_communication_version bigint,p_message text) RETURNS jsonb`, SECURITY DEFINER owned by `bm_core_flow_owner`, EXECUTE granted only to `bm_vendor_handoff_owner`. It rechecks current Manager B1 authorization, participates in the already-held ticket-row lock, runs the frozen public-Q&A completion guard, enforces `IN_PROGRESS→COMPLETED`, records the existing Manager-authored HANDLING event/message semantics, and never invokes `vendor_handoff.guard_direct_completion`.
- `vendor_handoff.closeout(...)` is the sole Vendor-managed closeout command. In one transaction it:
  1. locks source ticket row first and rechecks Manager authority;
  2. locks/rechecks current assignment/report/blocker/round/correction state;
  3. invokes `core_flow.vendor_handoff_complete(...)`;
  4. sets assignment `ENDED/CLOSED`;
  5. revokes all assignment capabilities/sessions;
  6. persists disposition/idempotency receipt;
  7. returns one authoritative result.
- Ordinary existing `HANDLING status=COMPLETED` stays on the frozen application path. After the ticket row is already locked, `createCoreFlowPort(...).communication.guardCompletion` runs both `core_flow.guard_communication_completion(...)` and `vendor_handoff.guard_direct_completion(...)` before `scope.store(...)`; this path cannot invoke the closeout bridge.
- Reassign atomically: old assignment `ENDED/SUPERSEDED`; old Vendor capability/session revoked; OPEN round `SUPERSEDED`; future SCHEDULED Appointment `SUPERSEDED`; OCCURRED Appointments/Work Events/Reports preserved; new assignment PREPARING.
- Revoke atomically: assignment `ENDED/REVOKED`; Vendor access immediately revoked; OPEN round `CANCELLED`; future SCHEDULED Appointment `CANCELLED`; OCCURRED/history preserved; no actionable scheduling remains.

- [ ] **Step 1: Write concurrency/atomicity RED tests**

Cover the remaining correction portion of AC35 plus AC38–AC42, reassignment/revoke, and Manager reschedule:
- REQUEST_CORRECTION reason is durable; exact Vendor correction produces a new current report revision, preserves the old report, and consumes only that request; stale/wrong correction request conflicts;
- communication-first => closeout conflict/no partial transition;
- closeout-first => later message conflict/no partial message;
- Manager auth revocation while waiting => no closeout;
- current report changed while waiting => no closeout;
- ticket COMPLETED iff assignment CLOSED in successful closeout;
- Vendor access denied after closeout;
- active assignment => existing direct Manager completion returns STATE_CONFLICT with no partial completion;
- direct-completion wins source-ticket lock first => assignment create recheck fails with no partial assignment;
- assignment create wins source-ticket lock first => direct completion recheck fails with no partial completion;
- valid Vendor closeout succeeds despite active assignment because it uses the closeout-only Core capability, not the direct-completion guard;
- no active assignment => existing direct Manager completion still works;
- historical ENDED assignment => direct Manager completion still works;
- reassign supersedes OPEN round/future SCHEDULED Appointment, preserves OCCURRED/work/report history, revokes old access and creates one PREPARING replacement;
- revoke cancels OPEN round/future SCHEDULED Appointment and leaves no actionable scheduling.

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
git add packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql packages/persistence-postgres/src/vendor-handoff packages/persistence-postgres/src/core-flow.ts apps/web/src/server/core-flow/vendor-handoff.ts apps/web/src/app/core/vendor-handoff-manager.tsx packages/api-client/src/core-vendor-handoff.ts apps/web/src/server/vendor-handoff/http.ts apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.tsx apps/web/src/app/vendor/job/vendor-job-screen.test.tsx packages/api-client/src/vendor-job.ts tests/postgres/vendor-handoff-completion.test.ts tests/postgres/vendor-handoff-security.test.ts
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
- link issue response-loss reconciles to unrecoverable raw link + explicit Reissue;
- deterministic 72h capability and 7d absolute-session expiry boundaries;
- Tenant/Vendor/Manager RESCHEDULE each preserves the old future Appointment and creates one RESCHEDULE round;
- reassign/revoke remove stale actionable future scheduling while preserving OCCURRED history.

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
- copy assertions forbid pre-outcome semantic collapse: `수리 완료`, `문제 해결 완료`, `완전히 해결됨`, `업체 완료`;
- preauthorization action-point copy forbids `상시 출입 허용`, `언제든 출입 허용`, `자동 출입 허용`;
- Reissue UI forbids `링크 다시 보기`, `링크 복구` and uses explicit Reissue semantics;
- Vendor report and Manager closeout result elements use existing neutral/primary status treatment, not a success-green treatment; component/static-style assertions reject a Vendor-specific green/success token or class and preferred role-appropriate terms include `업체 연결 / 작업 요청`, `방문 일정 조율`, `작업 보고`, `처리 완료 기록`;
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

Recommended future execution method: **Subagent-driven**, because the subsystem crosses five DB migrations, three security identities, three role-specific UIs, concurrency/idempotency, binary evidence and full browser/restart/CI gates; per-task fresh review materially reduces cross-boundary security regressions.

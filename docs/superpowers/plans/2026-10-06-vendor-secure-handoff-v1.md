# Vendor Secure Handoff v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** DELTA4_REMEDIATION_SUCCESSOR_CANDIDATE — PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED

**Reviewed delta3 successor:** HEAD `ad895049154f532b822c1cc160399d7fb39f46c2`, plan blob `ab6bc6aa67f578d575bfb984604d8df2dbdd9779`, independent delta3 review `6009584060` (`FIX_REQUIRED / B0 / H1 / M2`). Delta4 plan-only remediation is authorized by `6009777390`; earlier generations remain immutable history.

**Reviewed delta2 successor:** HEAD `47eb9ce06e76d38fc2d5a5dfe4f4cdb166516e41`, plan blob `2b4685970df845aa3f469b9c67383eb1f5942ef9`, independent delta2 review `6008938628`. Delta3 plan-only remediation is authorized by `6009009124` under canonical directive `6009037256`; earlier generations remain immutable history. Publication stops at `INDEPENDENT_DELTA_REVIEW_VENDOR_SECURE_HANDOFF_PLAN_DELTA3_REMEDIATION`; neither Task 0 nor product implementation is authorized.

**Reviewed remediation successor:** HEAD `ab22f9b30906e0efaf2961f9c312abc0908210ac`, plan blob `59ae7fe2cac932bb67536992c3bb8dc850d5c831`, delta review `6008734683` (`FIX_REQUIRED / B0 / H3 / M2`). Delta2 remediation is authorized by comment `6008805573`; the reviewed successor remains immutable history.

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
- Every state-changing Vendor Handoff command uses the Task 2 ticket-first transaction preamble. External Vendor commands obtain the Core row lock only through `core_flow.vendor_handoff_lock_ticket(orgId,ticketId)`, never direct Core SQL; Tenant commands use the digest-bound `vendor_handoff_tenant_context(...,true)` and Manager commands use their digest-authorized Core bridge. Routing lookups take no subordinate locks and confer no authority. After the ticket-lock wait, recheck current authority and assignment relationship, lock current VendorAssignment, then SchedulingRound → Appointment → blocker/correction/report as needed, with command receipt reconciliation/persistence last. No assignment/round/Appointment lock may precede the source-ticket lock; no second per-ticket advisory-lock order is introduced.
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
- Produces DTOs `ManagerVendorHandoffDto`, `TenantVendorSchedulingDto`, `VendorJobDto`, `VendorSessionDto`, `VendorLinkIssueDto`, `VendorCompletionReportDto`, `VendorCompletionPhotoDto`.
- Contract bounds fixed by this plan: `vendorLabel` plain text 1–80 characters; optional `accessInstruction` plain text 1–500 characters; optional decline/withdraw/blocker operational note 1–500 characters; report-correction Manager reason is required plain text 1–500 characters; optional `componentOrPartNote` is plain text 1–500 characters and is never inventory/warranty/cost data; Vendor/Manager work/completion summaries retain the frozen 1–1000-character bound. Control/format characters are rejected consistently with existing text validators.
- Produces strict mutation schemas and exact command matrix below. Every consequential mutation carries UUID `clientRequestId` plus the listed stale-state guards; server-derived authority IDs are never accepted as client authority.

| Actor | Command schema | Application port method | HTTP route | Required stale-state fields | Durable result |
|---|---|---|---|---|---|
| Manager | `VendorCreateAssignmentCommand` | `manager.createAssignment(digest,ticketId,input)` | `POST /api/v2/core/manager/tickets/:ticketId/vendor-assignment` | expectedTicketVersion | PREPARING assignment |
| Manager | `VendorPublishPacketCommand` | `manager.publishPacket(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/packet-revisions` | expectedAssignmentVersion, expectedPacketRevisionId/null | immutable current packet revision |
| Manager | `VendorIssueLinkCommand` | `manager.issueLink(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/link` | expectedAssignmentVersion, expectedPacketRevisionId | first OFFERED capability; OPEN→IN_PROGRESS when needed |
| Manager | `VendorReissueLinkCommand` | `manager.reissueLink(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/link/reissue` | expectedAssignmentVersion, expectedPacketRevisionId | old unredeemed capability invalidated; new capability |
| Manager | `VendorRevokeCommand` | `manager.revoke(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/revoke` | expectedAssignmentVersion | ENDED/REVOKED + future scheduling cancelled |
| Manager | `VendorReassignCommand` | `manager.reassign(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/reassign` | expectedAssignmentVersion | old ENDED/SUPERSEDED + new PREPARING |
| Manager | `VendorRequestCorrectionCommand` | `manager.requestCorrection(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/completion-correction` | expectedAssignmentVersion, expectedCompletionReportId | durable correction request |
| Manager | `VendorRequireFollowUpCommand` | `manager.requireFollowUp(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/follow-up` | expectedAssignmentVersion, expectedCompletionReportId | FOLLOW_UP round with report provenance |
| Manager | `VendorManagerRescheduleCommand` | `manager.reschedule(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/reschedule` | expectedAssignmentVersion, expectedRoundVersion, expectedAppointmentId, expectedPacketRevisionId | future appointment superseded + RESCHEDULE round |
| Manager | `VendorCloseoutCommand` | `manager.closeout(digest,assignmentId,input)` | `POST /api/v2/core/manager/vendor-assignments/:assignmentId/closeout` | expectedAssignmentVersion, expectedCompletionReportId, expectedCommunicationVersion | ticket COMPLETED + assignment ENDED/CLOSED atomically |
| Tenant | `VendorAvailabilityCommand` | `tenant.submitAvailability(digest,ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/availability` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId | immutable availability submission |
| Tenant | `VendorEntryAuthorizationCommand` | `tenant.authorizeEntry(digest,ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/entry-authorization` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId, availabilitySubmissionId | exact selected-window authorization |
| Tenant | `VendorConfirmSlotCommand` | `tenant.confirmSlot(digest,ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/confirm` | expectedAssignmentVersion, expectedRoundVersion, expectedPacketRevisionId, proposalId | TENANT_CONFIRMED Appointment |
| Tenant | `VendorTenantRescheduleCommand` | `tenant.reschedule(digest,ticketId,input)` | `POST /api/v2/core/tickets/:ticketId/vendor-scheduling/reschedule` | expectedAssignmentVersion, expectedRoundVersion, expectedAppointmentId, expectedPacketRevisionId | future appointment superseded + RESCHEDULE round |
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
| Vendor | `VendorCompletionPhotoUploadCommand` | `external.uploadCompletionPhoto(sessionDigest,input,sanitized)` | `POST /api/v2/vendor/job/completion-photos` | clientRequestId: UUID, expectedAssignmentVersion, expectedPacketRevisionId, expectedAppointmentId, expectedCorrectionRequestId: UUID|null; X-Upload-Id == clientRequestId | one sanitized durable photo in the exact initial/correction upload context + safe receipt; exact replay returns the same photo |
| Vendor | `VendorCompletionReportCommand` | `external.submitCompletionReport(sessionDigest,input)` | `POST /api/v2/vendor/completion-reports` | expectedAssignmentVersion, expectedPacketRevisionId, expectedAppointmentId, expectedCorrectionRequestId/null | append-only current report revision |

Read-only routes and exact port methods are: `manager.readHandoff(digest,ticketId): Promise<ManagerVendorHandoffDto>` → `GET /api/v2/core/manager/tickets/:ticketId/vendor-handoff`; `tenant.readScheduling(digest,ticketId): Promise<TenantVendorSchedulingDto>` → `GET /api/v2/core/tickets/:ticketId/vendor-scheduling`; `external.session(sessionDigest): Promise<VendorSessionDto>` → `GET /api/v2/vendor/session`; `external.readJob(sessionDigest): Promise<VendorJobDto>` → `GET /api/v2/vendor/job`.

`clientRequestId` is mandatory for every state-changing command in the table, including redeem and logout. Redeem remains one-time capability authority: first success stores only token/session digests plus the redeem request identity; an exact replay with the same token digest + same `clientRequestId` after uncertain delivery may atomically revoke the session created by that same redemption and return one fresh replacement session cookie, while a different request ID cannot redeem the already-consumed capability. Logout exact replay with the same request ID returns the same logical revoked result.
- Produces application ports `VendorHandoffManagerPort`, `VendorHandoffTenantPort`, `VendorHandoffExternalPort` and `VendorHandoffError`.
- `VendorCompletionPhotoUploadCommand` has exactly `clientRequestId: UUID`, `expectedAssignmentVersion`, `expectedPacketRevisionId`, `expectedAppointmentId`, and `expectedCorrectionRequestId: UUID | null`, with the same strict version/identifier validators used by the other commands. Its exact port is `external.uploadCompletionPhoto(sessionDigest: string, input: VendorCompletionPhotoUploadCommand, sanitized: SanitizedVendorPhoto): Promise<VendorCompletionPhotoDto>`.
- `SanitizedVendorPhoto` is a server-only application input containing re-encoded `bytes: Uint8Array`, `mime: "image/jpeg" | "image/png"`, `byteSize`, decoded `width`/`height`, and server-computed `sha256` of sanitized bytes. It is not a client-trusted DTO or a log/receipt payload. Task 8 owns its construction and persistence. The handler requires `X-Upload-Id == clientRequestId`; mismatch rejects before durable persistence.
- Exact Manager/Tenant application-port signatures are request-authority explicit:
  - `VendorHandoffManagerPort`:
    - `readHandoff(digest:string,ticketId:string): Promise<ManagerVendorHandoffDto>`
    - `createAssignment(digest:string,ticketId:string,input:VendorCreateAssignmentCommand): Promise<ManagerVendorHandoffDto>`
    - `publishPacket(digest:string,assignmentId:string,input:VendorPublishPacketCommand): Promise<ManagerVendorHandoffDto>`
    - `issueLink(digest:string,assignmentId:string,input:VendorIssueLinkCommand): Promise<VendorLinkIssueDto>`
    - `reissueLink(digest:string,assignmentId:string,input:VendorReissueLinkCommand): Promise<VendorLinkIssueDto>`
    - `revoke(digest:string,assignmentId:string,input:VendorRevokeCommand): Promise<ManagerVendorHandoffDto>`
    - `reassign(digest:string,assignmentId:string,input:VendorReassignCommand): Promise<ManagerVendorHandoffDto>`
    - `requestCorrection(digest:string,assignmentId:string,input:VendorRequestCorrectionCommand): Promise<ManagerVendorHandoffDto>`
    - `requireFollowUp(digest:string,assignmentId:string,input:VendorRequireFollowUpCommand): Promise<ManagerVendorHandoffDto>`
    - `reschedule(digest:string,assignmentId:string,input:VendorManagerRescheduleCommand): Promise<ManagerVendorHandoffDto>`
    - `closeout(digest:string,assignmentId:string,input:VendorCloseoutCommand): Promise<ManagerVendorHandoffDto>`
    - `completionPhoto(digest:string,ticketId:string,photoId:string): Promise<{photo:VendorCompletionPhotoDto;bytes:Uint8Array}>`
  - `VendorHandoffTenantPort`:
    - `readScheduling(digest:string,ticketId:string): Promise<TenantVendorSchedulingDto>`
    - `submitAvailability(digest:string,ticketId:string,input:VendorAvailabilityCommand): Promise<TenantVendorSchedulingDto>`
    - `authorizeEntry(digest:string,ticketId:string,input:VendorEntryAuthorizationCommand): Promise<TenantVendorSchedulingDto>`
    - `confirmSlot(digest:string,ticketId:string,input:VendorConfirmSlotCommand): Promise<TenantVendorSchedulingDto>`
    - `reschedule(digest:string,ticketId:string,input:VendorTenantRescheduleCommand): Promise<TenantVendorSchedulingDto>`
  - Factories are configuration/database scoped only: `createVendorHandoffManagerPort(database): VendorHandoffManagerPort` and `createVendorHandoffTenantPort(database): VendorHandoffTenantPort`; no caller-supplied `orgId` is captured as authority.
  - Every B1-backed SQL capability receives the request digest, establishes/rechecks the current B1 session/org/property/unit/occupancy context inside SECURITY DEFINER code, and never trusts a client-provided org/property/unit authority identifier.
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
- Manager/Tenant method signatures require request-scoped `digest: string`, exact return types above, and `VendorCreateAssignmentCommand` uses the exact field name `expectedTicketVersion`;
- type-level tests reject a Manager/Tenant port shape that omits the digest parameter or reintroduces caller-supplied `orgId` authority;
- every state-changing command in the matrix requires UUID `clientRequestId`, including redeem/logout; redeem exact replay is bounded to the same token digest + request ID and never revives the raw capability.
- photo upload rejects a missing/non-UUID request identity, missing expected assignment/packet/Appointment/correction-context intent, unknown command keys, or `X-Upload-Id` mismatch; its fingerprint includes sanitized-byte SHA-256 plus all normalized command fields including `expectedCorrectionRequestId`. Raw photo metadata is never request authority.

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
- Schema ACL matrix is explicit and PUBLIC remains revoked:
  - `bm_vendor_web`: `USAGE ON SCHEMA vendor_handoff`; EXECUTE only the exact external Vendor functions exposed by `VendorHandoffExternalPort`; no CREATE and no table privileges.
  - `bm_b1_web`: `USAGE ON SCHEMA vendor_handoff`; EXECUTE only the exact Manager/Tenant B1-facing Vendor functions plus `vendor_handoff.guard_direct_completion`; no CREATE and no table privileges.
  - `bm_vendor_handoff_owner`: owner rights inside `vendor_handoff`; `USAGE ON SCHEMA core_flow, app`; EXECUTE only approved Core bridge helpers plus `app.current_org_id()`; no CREATE on `core_flow` or `app`, and no Core/app table SELECT/DML beyond privileges already required by approved helpers.
  - `bm_core_flow_owner`: retains existing Core ownership; no broad `vendor_handoff` table privilege is added.
- Neither Web runtime has direct table SELECT/INSERT/UPDATE/DELETE, ownership, BYPASSRLS, or SET ROLE to `bm_vendor_handoff_owner`.
- Every durable Vendor Handoff table carries `org_id uuid NOT NULL`, has `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`, and is owned/operated only through `bm_vendor_handoff_owner` SECURITY DEFINER functions.
- Exact RLS table inventory by migration:
  - 0019: `vendor_assignment`, `work_packet_revision`, `work_packet_source_photo`, `vendor_capability`, `vendor_session`, `command_receipt`.
  - 0020: `scheduling_round`, `tenant_availability_submission`, `tenant_availability_window`, `tenant_entry_authorization`, `tenant_entry_authorization_window`, `vendor_slot_proposal`, `vendor_slot`, `appointment`.
  - 0021: `work_event`.
  - 0022: `completion_report`, `completion_photo`, `manager_disposition`.
  - 0023 introduces Manager-action functions/constraints only unless Task0/live truth forces a separately reviewed additive table.
- Standard permissive policy `vendor_handoff_org_scope` applies to every table for `bm_vendor_handoff_owner`: `USING (org_id = app.current_org_id()) WITH CHECK (org_id = app.current_org_id())`. Every non-bootstrap table also has restrictive `vendor_handoff_org_ceiling AS RESTRICTIVE FOR ALL` with the same org predicate, mirroring the accepted Core restrictive-ceiling pattern.
- `vendor_capability` additionally has permissive SELECT-only `vendor_capability_digest_bootstrap`: the owner may see only the row whose digest equals `decode(current_setting('app.vendor_capability_digest',true),'hex')`. Restrictive `vendor_capability_bootstrap_ceiling FOR SELECT` allows only `(org_id=app.current_org_id() OR digest=that_exact_digest)`. Writes are separately bounded by org-only restrictive `vendor_capability_insert_ceiling`, `vendor_capability_update_ceiling`, and `vendor_capability_delete_ceiling`. `vendor_session` mirrors this exactly with SELECT-only `vendor_session_digest_bootstrap`, restrictive SELECT `vendor_session_bootstrap_ceiling`, org-only `vendor_session_insert_ceiling` / `vendor_session_update_ceiling` / `vendor_session_delete_ceiling`, and transaction-local `app.vendor_session_digest`. Bootstrap policies grant no write.
- Redeem/session functions set only the digest setting from hashed request material, SELECT exactly one bootstrap row, take its `org_id`, set transaction-local `app.org_id`, then re-read/recheck under org scope before any write. Session/capability update, session insertion, assignment/resource read and command receipt access occur only after org binding.
- `bm_vendor_handoff_owner` receives the minimum `USAGE`/`EXECUTE` needed for `app.current_org_id()` and the approved Core bridge functions; Web runtimes do not receive table privileges.
- Every later migration that creates a Vendor Handoff table must add it to the canonical RLS catalog assertion in `tests/postgres/vendor-handoff-security.test.ts`; no new table is allowed to exist without both `relrowsecurity=true` and `relforcerowsecurity=true`.
- Every external Vendor state-changing persistence method, including redeem, logout, scheduling/work/report commands and completion-photo upload, uses this exact transaction preamble:
  1. Bootstrap the Vendor session/capability digest to candidate `orgId + assignmentId + ticketId`; take **no subordinate row lock**, including capability/session locks. Candidate IDs come from the digest-bound row/assignment, never an arbitrary client target. This lookup is routing only, not authority.
  2. Call `core_flow.vendor_handoff_lock_ticket(orgId,ticketId)` for the source ticket lock; no direct Core-table access is permitted.
  3. After the ticket-lock wait, revalidate the Vendor session (capability for redeem), current VendorAssignment and ticket/assignment relationship. Rebind/recheck org scope and reject revoked, expired, superseded or mismatched authority without disclosing another resource.
  4. Lock/recheck the current VendorAssignment.
  5. When needed, lock subordinate `SchedulingRound → Appointment → blocker/correction/report` in that order; session/capability or receipt writes must never introduce a lock before the ticket.
  6. Apply the authorized mutation subject to current expected state.
  7. Reconcile/persist the safe command receipt atomically with the mutation; an exact replay has only one durable result, and changed replay rolls back without an additional action. Task 8 spells out the upload's receipt reconciliation before its photo/receipt insertion.
  Never lock assignment, round or Appointment first and subsequently request the ticket lock. Manager/Tenant commands use the same source-ticket-first/subordinate order through their digest-authorized Core bridge, with current B1 authorization rechecked after waits. No separate per-ticket advisory-lock order is introduced.
- Core-owned SECURITY DEFINER bridge helpers are narrow capabilities, never broad Core-table grants:
  - `core_flow.vendor_handoff_source(p_digest bytea,p_ticket text,p_photo_ids uuid[],p_lock boolean) RETURNS jsonb`: Manager-authorized source snapshot and selected-photo metadata for packet publication.
  - `core_flow.vendor_handoff_lock_ticket(p_org uuid,p_ticket text) RETURNS jsonb`: `SECURITY DEFINER`, owner `bm_core_flow_owner`, EXECUTE only `bm_vendor_handoff_owner`. Validate `ticket.org_id = p_org`, acquire `FOR UPDATE` on that exact source ticket, and return **only** `orgId`, `ticketId`, `unitId`, `workStatus`, `ticketVersion`. Never return raw user text, Q&A contents, photos, Manager private data or unrelated ticket data. The helper is a lock capability, not Vendor/Manager/Tenant authentication; the calling Vendor function must bind candidate IDs to its session/capability and perform the post-wait authority check above.
  - `core_flow.vendor_handoff_tenant_context(p_digest bytea,p_ticket text,p_lock boolean) RETURNS jsonb`: Core-owned `SECURITY DEFINER`, owner `bm_core_flow_owner`, EXECUTE only `bm_vendor_handoff_owner`. Derive current org/unit/occupancy/member from the B1 digest and verify the caller is the current authorized Tenant for this ticket/unit. With `p_lock=true`, take the source ticket lock before any subordinate lock and repeat final current-session/occupancy authorization after the wait. Return **only** `orgId`, `ticketId`, `unitId`, `occupancyId`, `occupancyMemberId`, `ticketVersion`. Client org/unit/member IDs cannot supply authority. Read-only Tenant context uses `p_lock=false`; every Tenant mutation uses `true`.
  - `core_flow.vendor_handoff_recheck_occupancy(p_org uuid,p_ticket text,p_occupancy_member uuid) RETURNS boolean`: Core-owned `SECURITY DEFINER`, owner `bm_core_flow_owner`, EXECUTE only `bm_vendor_handoff_owner`. Requires the source ticket already locked by `vendor_handoff_lock_ticket`; checks the **exact stored Tenant authorization occupancyMemberId** is still a current occupancy member for this ticket unit. Ended, replaced or stale membership returns `false`; never substitute the unit's new current member. This helper authenticates neither Vendor nor Tenant caller. PREAUTHORIZED_ENTRY `VISIT_STARTED` uses it after Vendor authentication and the ticket lock.
  - `core_flow.vendor_handoff_manager_context(p_digest bytea,p_ticket text) RETURNS jsonb`: Core-owned `SECURITY DEFINER`, owner `bm_core_flow_owner`, EXECUTE only `bm_vendor_handoff_owner`. Used when ordinary Core completion already holds the source ticket lock; revalidate current B1 `ORG_ADMIN` or eligible/currently scoped `PROPERTY_STAFF` authorization, and return **only** `orgId`, `ticketId`, `unitId`.
  - `core_flow.vendor_handoff_source_photo(p_org uuid,p_ticket text,p_photo uuid) RETURNS TABLE(metadata jsonb,content bytea)`: exact same-ticket binary read used only after `vendor_handoff` has validated current Vendor session/current packet/exact allowlist.
  - `core_flow.vendor_handoff_mark_offered(p_digest bytea,p_ticket text) RETURNS jsonb`: first-link capability that rechecks Manager authority under the ticket lock and applies the existing HANDLING `OPEN→IN_PROGRESS` semantics with a fixed safe public handling message; Vendor label/private metadata cannot enter that event.
- `vendor_handoff.guard_direct_completion(p_digest bytea,p_ticket text) RETURNS void` is the one narrow Vendor-schema capability callable by the ordinary B1 Core path. With the caller already holding the source ticket row lock, call `vendor_handoff_manager_context(p_digest,p_ticket)` to reauthorize and derive org, then inspect non-ended VendorAssignments for **that org/ticket** and conflict if one exists. Stale/unauthorized Manager digest denies even when no current assignment exists. It acquires **no earlier competing lock** and never reuses the packet-publication helper for direct-completion authorization.
- All Core bridge helpers above are `SECURITY DEFINER` owned by `bm_core_flow_owner`; revoke PUBLIC EXECUTE and grant EXECUTE only to `bm_vendor_handoff_owner`, never directly to `bm_b1_web` or `bm_vendor_web`. Grant `vendor_handoff.guard_direct_completion` to `bm_b1_web` for the ordinary Core guard, not to the external Vendor runtime. Neither `bm_vendor_web` nor `bm_vendor_handoff_owner` receives Core table direct/broad SELECT or DML privileges; helper grants are not table grants. Preserve fixed safe search paths and org-bound Core RLS.
- Persistence factories:
  - `createVendorHandoffManagerPort(database): VendorHandoffManagerPort`
  - `createVendorHandoffTenantPort(database): VendorHandoffTenantPort`
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
- catalog inventory proves every expected Vendor table has `relrowsecurity=true` and `relforcerowsecurity=true`;
- `pg_policies` proves the permissive org policy plus restrictive ceiling exist on every table, and only `vendor_capability`/`vendor_session` have the additional digest bootstrap + digest-or-org restrictive SELECT ceiling while their writes remain org-only;
- cross-org hostile probes through Manager/Tenant digest, Vendor capability digest and Vendor session digest cannot read/mutate another org's resources;
- capability/session bootstrap exposes at most the exact digest row before org binding and cannot update it until `app.org_id` is set/rechecked;
- `has_schema_privilege` probes prove PUBLIC has no vendor_handoff USAGE/CREATE; `bm_vendor_web` and `bm_b1_web` have vendor_handoff USAGE but not CREATE; `bm_vendor_handoff_owner` has core_flow/app USAGE but not CREATE; no unexpected role has schema CREATE;
- function privilege probes prove each runtime can EXECUTE only its approved function set and cannot execute owner-only Core bridges directly;
- direct SELECT/INSERT/UPDATE/DELETE denied to both runtime roles;
- PUBLIC EXECUTE absent;
- role membership/SET ROLE denied.
- Vendor session A attempts to lock/read assignment/ticket B, including a known B ID: non-disclosing denial before a client-selected target can supply bridge authority; another org's ticket is denied.
- Vendor mutation waits on the source ticket while Manager Revoke commits: after the wait, session/current-assignment recheck conflicts with no durable Vendor action; Manager Reassign committing first similarly makes the old Vendor mutation conflict. Task 9 repeats these against the final Manager-action implementation.
- catalog/hostile SQL proves `bm_vendor_web` cannot directly execute the Core bridges or access Core tables; `bm_b1_web` cannot execute the bridges directly; `bm_vendor_handoff_owner` has no broad Core SELECT/DML. Only the Core owner holds table authority and bridge returns contain only their specified fields.
- Tenant B1 context: another Tenant digest denies; ended-occupancy digest denies; knowing only `p_org` cannot authorize any Tenant command; current authorized Tenant digest + correct ticket passes. Recheck after the ticket-lock wait, not merely before it.
- occupancy helper returns false for the exact authorizing member after end/replacement, even if another current Tenant exists in the unit; this boolean cannot substitute for caller authentication. Task 7 proves `VISIT_STARTED` denial using it.
- stale/unauthorized Manager digest makes the direct-completion guard deny; the guard obtains org only from the dedicated Manager context, never packet publication or caller-supplied org.

Foundation ownership boundary: Task 2 tests the available bridge/auth/ACL contract and ticket-wait recheck with controlled foundation fixtures. Full Manager Reassign, final Revoke integration, PREAUTHORIZED_ENTRY `VISIT_STARTED`, and durable completion-photo race tests run in Tasks 7–9/11 when their commands exist; their RED/PASS obligations below must not be simulated as already implemented in Task 2.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-foundation.test.ts tests/postgres/vendor-handoff-security.test.ts
```
Expected: RED because roles/schema/functions do not exist.

- [ ] **Step 2: Implement migration 0019 and bounded port adapters**

Rules:
- original `0001–0018` bytes unchanged;
- add `org_id`, ENABLE/FORCE RLS and the exact policy model above in the same migration that creates each table; no deferred unsecured table generation;
- every state-changing Manager/Tenant/Vendor function follows the shared source-ticket-first transaction preamble above;
- assignment create/publish/link operations take the source ticket row lock first and recheck current Manager authorization after waits;
- canonical building/serviceAddress/unit/issue identity comes from server-side Core source;
- tenant raw text is never address fallback;
- packet publish fails safe when canonical address is unavailable;
- first link issue transitions `PREPARING→OFFERED` and changes ticket `OPEN→IN_PROGRESS` through existing Core handling capability without copying Vendor metadata into public events;
- exact link replay returns safe issuance metadata with `created:false`; raw link bytes are never recoverable from DB/receipt;
- first successful link issue calls the narrow Core `vendor_handoff_mark_offered(...)` capability in the same transaction so PREPARING→OFFERED and OPEN→IN_PROGRESS (when applicable) cannot split.

- [ ] **Step 3: Run focused DB/security and catalog-policy tests**

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
- Manager HTTP passes the request-scoped B1 digest to every `VendorHandoffManagerPort` read/mutation; handler/client code never substitutes `orgId` as authority;
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
- Extend: `tests/postgres/vendor-handoff-security.test.ts`
- Extend: `packages/api-contracts/src/vendor-handoff.test.ts`

**Interfaces:**
- Tables/resources: `scheduling_round`, `tenant_availability_submission`, `tenant_availability_window`, `tenant_entry_authorization`, `tenant_entry_authorization_window`, `vendor_slot_proposal`, `vendor_slot`, `appointment`.
- Because blocker/report tables are created in later migrations, `0020` creates nullable `scheduling_round.source_blocker_id` and `source_completion_report_id` UUID slots without forward foreign keys. Its checks require non-FOLLOW_UP rounds to have both null and never allow both non-null. Task 5 creates no FOLLOW_UP round. Task 7 adds the blocker FK when `work_event` exists; Task 8 adds the completion-report FK and tightens the final FOLLOW_UP XOR constraint.
- Task 5 implements `external.accept(sessionDigest,input)` and `POST /api/v2/vendor/job/accept`; successful Vendor Accept atomically transitions OFFERED→ACTIVE and creates the first `SchedulingRound purpose=INITIAL,status=OPEN`. There is no separate INITIAL-round command. Exact replay returns the same logical accept/round result. One OPEN round per assignment is enforced by partial unique constraint plus source-ticket/assignment lock+recheck.
- Task 5 also implements `external.withdraw(sessionDigest,input)` and `POST /api/v2/vendor/job/withdraw`; Withdraw is allowed only from ACTIVE, transitions to ENDED/WITHDRAWN, revokes Vendor access, atomically marks any OPEN round CANCELLED and any future SCHEDULED Appointment CANCELLED, preserves OCCURRED/work/report history, and leaves the source ticket unfinished.
- Tenant availability mutation never creates unattended authorization.
- Every Tenant scheduling read/command passes the request-scoped B1 digest through `vendor_handoff_tenant_context(digest,ticketId,p_lock)`: reads use `false`, mutations use `true` and recheck current occupancy/member after the source-ticket wait before locking assignment/round. Store the derived exact `occupancyMemberId` on Tenant authorization; neither org knowledge nor a Vendor session authenticates a Tenant.
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
- different Tenant digest, ended-occupancy digest and org-only command attempts deny; current Tenant digest + correct ticket succeeds, with final current authorization rechecked after a lock wait;
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

- [ ] **Step 2: Implement migration 0020, atomic Accept/Withdraw, persistence methods, and RLS catalog extension**

All stored times are `timestamptz`; reject non-finite values and `startAt >= endAt`; compare absolute instants. Accept and first INITIAL round must commit together; never expose ACTIVE with no INITIAL round. Withdraw ends the assignment without deleting prior round/appointment/work history; only still-actionable OPEN/SCHEDULED records receive CANCELLED disposition. Extend `vendor-handoff-security.test.ts` so every 0020 table is asserted `ENABLE + FORCE RLS`, org-scoped, restrictive-ceiling protected, and inaccessible by direct Web-runtime table SQL.

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
- Tenant HTTP passes the request-scoped B1 digest to every `VendorHandoffTenantPort` read/mutation; no Tenant route supplies org/unit authority in place of the digest;
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
- Extend: `tests/postgres/vendor-handoff-security.test.ts`

**Interfaces:**
- Append-only `work_event` records `VISIT_STARTED`, `BLOCKER_RECORDED`, `BLOCKER_CLEARED`.
- `0021_vendor_handoff_work.sql` adds the foreign key from `scheduling_round.source_blocker_id` to the newly created blocker/work evidence identity. Blocker-driven FOLLOW_UP requires `source_blocker_id` and `source_completion_report_id IS NULL`; INITIAL/RESCHEDULE still have neither.
- One `VISIT_STARTED` per Appointment.
- At most one uncleared blocker; clear references exact blocker event.
- `POST /api/v2/vendor/appointments/:appointmentId/visit-start`
- `POST /api/v2/vendor/blockers`
- `POST /api/v2/vendor/blockers/:blockerId/clear`
- PREAUTHORIZED_ENTRY visit start follows Task 2's external Vendor preamble, then invokes `vendor_handoff_recheck_occupancy(orgId,ticketId,storedAuthorization.occupancyMemberId)` under the source ticket lock. This checks the exact stored authorizing member, independently of Vendor-session authentication; `false` denies `VISIT_STARTED` with no durable visit.
- Starting a visit marks the selected Appointment OCCURRED without rewriting prior Appointment time.

- [ ] **Step 1: Write DB RED tests**

Cover AC23, AC28–AC31:
- duplicate visit start;
- stale/ended occupancy after preauthorization;
- occupancy ends immediately before preauthorized visit start or the authorizing member is replaced: both deny `VISIT_STARTED`; a different newly current member cannot satisfy the stored authorization;
- blocker overlay and one-current-blocker invariant;
- blocker clear exact reference/history;
- blocker-driven FOLLOW_UP atomically appends `BLOCKER_CLEARED` for that exact blocker and creates the new FOLLOW_UP/OPEN round with `sourceBlockerId`; the original blocker event remains history;
- FOLLOW_UP keeps prior Appointment OCCURRED.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-work.test.ts
```
Expected: RED.

- [ ] **Step 2: Implement migration/work port and extend the RLS catalog assertion**

Do not UPDATE/delete historical work events. Add `work_event` to the canonical FORCE-RLS/org-policy catalog test and preserve zero direct Web-runtime table privileges.

- [ ] **Step 3: Implement Vendor work UI/API**

A blocker changes current task state but never rewrites lifecycle/history.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-work.test.ts tests/postgres/vendor-handoff-security.test.ts
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
- Modify: `apps/web/src/server/vendor-handoff/http.test.ts`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.test.tsx`
- Modify: `packages/api-client/src/vendor-job.ts`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.ts`
- Modify: `apps/web/src/server/core-flow/vendor-handoff.test.ts`
- Modify: `packages/api-client/src/core-vendor-handoff.ts`
- Modify: `apps/web/src/app/core/vendor-handoff-manager.tsx`
- Modify: `apps/web/src/app/core/vendor-handoff-manager.test.tsx`
- Create: `tests/postgres/vendor-handoff-completion.test.ts`
- Extend: `tests/postgres/vendor-handoff-security.test.ts`

**Interfaces:**
- Tables `completion_report`, `completion_photo`, `manager_disposition`. The schema includes nullable revision/provenance columns needed by Task 9, but Task 8 only accepts an initial report with no correction request and `supersedesReportId = null`.
- `0022_vendor_handoff_completion.sql` adds the foreign key from `scheduling_round.source_completion_report_id` to `completion_report` and replaces the provisional 0020 provenance check with the final invariant: FOLLOW_UP has exactly one of `source_blocker_id` or `source_completion_report_id`; INITIAL/RESCHEDULE have neither.
- Report history is append-only. The actual Manager correction-request + Vendor correction-report transition is owned by Task 9 so it cannot precede the durable Manager disposition that authorizes it.
- Submission requires valid OCCURRED visit, no current blocker, no OPEN SchedulingRound, current packet acknowledgment, and either 1–5 sanitized photos or one approved omission reason.
- Vendor photo upload uses the accepted `normalizePhoto` decode/re-encode path from Core photo handling without changing the frozen Core photo implementation.
- Exact upload command/port is Task 1's `VendorCompletionPhotoUploadCommand` and `external.uploadCompletionPhoto(sessionDigest: string, input: VendorCompletionPhotoUploadCommand, sanitized: SanitizedVendorPhoto): Promise<VendorCompletionPhotoDto>`. Require `X-Upload-Id == input.clientRequestId`; reject mismatch before persistence.
- Binary preprocessing may occur before the durable transaction: accept only JPEG/PNG; enforce accepted Core `CORE_PHOTO_MAX_BYTES = 5 * 1024 * 1024` on input/output and `CORE_PHOTO_MAX_PIXELS = 20_000_000`; require positive finite decoded width/height, each bounded by that pixel ceiling and their product at most the ceiling. Actually decode and re-encode, dropping EXIF, GPS and equivalent metadata; malformed/unsupported/oversized input creates no durable photo. Use the accepted Core sanitizer unchanged and validate its output bounds before constructing server-only `SanitizedVendorPhoto`.
- Compute the idempotency fingerprint from **sanitized bytes SHA-256 + normalized command fields**, including expected assignment version, packet revision and Appointment intent. Never log raw binary, EXIF, GPS, session cookie, capability token or CSRF. Receipt/DTO contain safe photo identity/metadata, not image bytes or credentials.
- Exact completion-photo durable transaction:
  1. Prepare validated/sanitized binary outside the durable transaction.
  2. Bootstrap candidate org/ticket/assignment from the Vendor session; no subordinate lock and no client-ID authority.
  3. Call `core_flow.vendor_handoff_lock_ticket(orgId,ticketId)`.
  4. After the wait, revalidate current Vendor session and ticket/assignment relationship.
  5. Lock/recheck the current assignment is `ACTIVE` under Task 2's ordering.
  6. Check `expectedAssignmentVersion`.
  7. Check `expectedPacketRevisionId` is current.
  8. Lock/check `expectedAppointmentId` belongs to this current assignment and is `OCCURRED`; when other subordinate state needs locking, preserve SchedulingRound → Appointment → blocker/correction/report order.
  9. Reconcile `clientRequestId` and fingerprint within the current authorized assignment scope.
  10. Persist sanitized photo + safe receipt atomically. Same request ID + same fingerprint returns the **same durable photo**; same ID + different sanitized bytes or version/packet/Appointment intent returns `STATE_CONFLICT`, with no additional photo.
- Upload alone does not create a VendorCompletionReport, bypass blocker/open-round/report-correction eligibility, or mark a ticket `COMPLETED`. Report submission still separately enforces OCCURRED/current packet, photo ownership/count or omission, and all report/correction prerequisites; photo bytes do not constitute a report or authorize its submission.
- `COMPLETION_REPORTED` is a derived presentation/eligibility phase from the current pending report, not a fifth `VendorAssignment.status`; durable assignment status remains `ACTIVE` until an allowed end transition.
- Vendor report moves assignment presentation to `COMPLETION_REPORTED` read-only in Task 8 without ending assignment or ticket. Task 9 later enables the one exact correction-report exception only after a durable REQUEST_CORRECTION.
- Manager disposition is exactly `CLOSEOUT | REQUEST_CORRECTION | MORE_WORK`. `REQUEST_CORRECTION` stores the required 1–500-character Manager reason; `MORE_WORK` preserves the prior report and creates a FOLLOW_UP round with `sourceCompletionReportId`.
- Completion photo routes are exact: Vendor upload `POST /api/v2/vendor/job/completion-photos` with `X-Upload-Id` equal to command `clientRequestId`; Vendor own read `GET /api/v2/vendor/job/completion-photos/:photoId`; Manager read `GET /api/v2/core/manager/tickets/:ticketId/vendor-completion-photos/:photoId`. Task 8 owns all three server/client projections and Manager report/photo review UI. There is no Tenant completion-photo route.

- [ ] **Step 1: Write RED tests for report prerequisites and revisions**

Cover Task-8 portions of AC32–AC37, AC46–AC51:
- blocker/open round rejects initial report;
- 0 or >5 photos rejects without omission reason;
- omission reason versus photos is exclusive;
- workSummary 1–1000 and optional `componentOrPartNote` bound;
- packet acknowledgment must be current;
- initial report requires `supersedesReportId = null` and no pending correction request;
- Manager can read the current report and raw completion photos; Tenant cannot;
- COMPLETION_REPORTED rejects packet publication, scheduling/visit/blocker/withdraw, reassignment, revoke, and any second unrelated report. The exact correction exception is deliberately RED/absent until Task 9 creates the durable correction request.
- exact upload replay returns the same photo ID and one durable photo/receipt; same request ID + changed sanitized bytes conflicts; same request ID + changed version/packet/Appointment intent conflicts;
- stale assignment version, stale packet revision, or wrong/non-OCCURRED Appointment creates no durable photo; a session for assignment A probing B produces non-disclosing denial;
- upload waiting on a ticket lock rechecks session/assignment after Manager Revoke/Reassign commits: the revoked/superseded assignment gains no new durable photo. Repeat against Task 9's final Manager-action functions;
- header/command ID mismatch rejects before persistence; rejected preprocessing creates neither photo nor receipt; upload success alone leaves report/ticket state unchanged and cannot bypass report/correction eligibility;
- simulate lost upload response, read authoritative job/photo receipt state before retry, and prove exact authorized replay returns that same photo rather than another upload. Task 11 repeats recovery across separate service instances; Task 12 checks the browser recovery state.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts
```
Expected: RED.

- [ ] **Step 2: Write image metadata RED test**

Upload synthetic JPEG containing EXIF/GPS markers and PNG with equivalent metadata through the actual Vendor photo route, then read stored/served output and assert metadata is absent while valid decoded pixels remain. Check accepted byte, decoded width/height and total-pixel limits, malformed decode rejection, and the same sanitized-byte SHA-256 used for replay. Confirm no Tenant raw completion-photo route exists and unauthorized/cross-assignment reads do not disclose a photo.

Run:
```bash
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts
```
Expected: RED until Vendor completion-photo route exists.

- [ ] **Step 3: Implement migration/report/photo path and extend the RLS catalog assertion**

Do not expose raw Vendor completion photos through Tenant endpoints. Add `completion_report`, `completion_photo`, and `manager_disposition` to the canonical FORCE-RLS/org-policy catalog test.

- [ ] **Step 4: Run focused DB/Web tests**

```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts tests/postgres/vendor-handoff-security.test.ts
npm run test:web -- apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql packages/persistence-postgres/src/vendor-handoff apps/web/src/server/vendor-handoff/photos.ts apps/web/src/server/vendor-handoff/http.ts apps/web/src/server/vendor-handoff/http.test.ts apps/web/src/app/vendor/job/vendor-job-screen.tsx apps/web/src/app/vendor/job/vendor-job-screen.test.tsx packages/api-client/src/vendor-job.ts apps/web/src/server/core-flow/vendor-handoff.ts apps/web/src/server/core-flow/vendor-handoff.test.ts packages/api-client/src/core-vendor-handoff.ts apps/web/src/app/core/vendor-handoff-manager.tsx apps/web/src/app/core/vendor-handoff-manager.test.tsx tests/postgres/vendor-handoff-completion.test.ts
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
- The direct-completion guard uses Task 2's `core_flow.vendor_handoff_manager_context(p_digest,p_ticket)` to revalidate B1 authorization and derive org before checking that org/ticket's non-ended assignments. It never obtains authorization from packet publication or client org; historical ENDED assignments do not block an authorized Manager.
- Reassign atomically: old assignment `ENDED/SUPERSEDED`; old Vendor capability/session revoked; OPEN round `SUPERSEDED`; future SCHEDULED Appointment `SUPERSEDED`; OCCURRED Appointments/Work Events/Reports preserved; new assignment PREPARING.
- Revoke atomically: assignment `ENDED/REVOKED`; Vendor access immediately revoked; OPEN round `CANCELLED`; future SCHEDULED Appointment `CANCELLED`; OCCURRED/history preserved; no actionable scheduling remains.

- [ ] **Step 1: Write concurrency/atomicity RED tests**

Cover the remaining correction portion of AC35 plus AC38–AC42, reassignment/revoke, and Manager reschedule:
- REQUEST_CORRECTION reason is durable; exact Vendor correction produces a new current report revision, preserves the old report, and consumes only that request; stale/wrong correction request conflicts;
- communication-first => closeout conflict/no partial transition;
- closeout-first => later message conflict/no partial message;
- Manager auth revocation while waiting => no closeout;
- current report changed while waiting => no closeout;
- Vendor proposal vs Manager Revoke => source-ticket-first serialization leaves either the proposal committed before revoke then inaccessible, or revoke wins and proposal conflicts; no deadlock/partial state;
- repeat H-D2-01 ticket-wait Revoke and committed-first Reassign probes through `vendor_handoff_lock_ticket`; after either Manager action wins, post-wait Vendor-session/current-assignment recheck conflicts before subordinate mutation;
- completion-photo upload vs Revoke/Reassign: if the Manager action commits first, no new durable photo or upload receipt is added to the revoked/superseded assignment; upload-first leaves at most its already committed photo/history and subsequent access is denied;
- Tenant confirm and Vendor preauthorized selection vs Manager Reassign => exactly one current assignment/scheduling history wins; old assignment cannot gain a new actionable Appointment after supersession;
- VISIT_STARTED vs Manager Revoke => exactly one valid result; revoked assignment cannot gain a new OCCURRED visit after revoke commits;
- completion report vs Closeout/Reassign => no report can become current after assignment close/reassign; closeout cannot use a report that lost the race;
- Withdraw vs availability/proposal/reschedule mutation => exactly one wins; ENDED/WITHDRAWN cannot retain or gain actionable scheduling;
- ticket COMPLETED iff assignment CLOSED in successful closeout;
- Vendor access denied after closeout;
- active assignment => existing direct Manager completion returns STATE_CONFLICT with no partial completion;
- direct-completion wins source-ticket lock first => assignment create recheck fails with no partial assignment;
- assignment create wins source-ticket lock first => direct completion recheck fails with no partial completion;
- valid Vendor closeout succeeds despite active assignment because it uses the closeout-only Core capability, not the direct-completion guard;
- no active assignment => existing direct Manager completion still works;
- historical ENDED assignment => direct Manager completion still works;
- stale/unauthorized Manager B1 digest => direct-completion guard denial even for no-assignment or historical-ENDED tickets; packet-publication capability is never invoked for this authorization;
- reassign supersedes OPEN round/future SCHEDULED Appointment, preserves OCCURRED/work/report history, revokes old access and creates one PREPARING replacement;
- revoke cancels OPEN round/future SCHEDULED Appointment and leaves no actionable scheduling.

Run:
```bash
npm run test:postgres -- tests/postgres/vendor-handoff-completion.test.ts tests/postgres/vendor-handoff-security.test.ts tests/postgres/core-ticket-communication.test.ts
```
Expected: RED for new Vendor cases.

- [ ] **Step 2: Implement manager dispositions/reassignment under the universal transaction preamble**

Manager completion text is never prefilled from Vendor workSummary. All Task 9 commands and all cross-race partners above must derive ticket identity without subordinate locks, take the source ticket row first, recheck authority/session, and only then lock assignment/subordinate rows.

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

Include Task 8 completion-photo upload: lost response → authoritative job/photo receipt reconciliation → same request/fingerprint returns the same durable photo. Changed sanitized bytes or expected version/packet/Appointment intent conflicts; no blind retry or duplicate photo. Repeat Task 2 ticket-lock bootstrap and post-wait auth checks, including Task 9 Revoke/Reassign races, with no direct Core-table grant. Restart coverage includes sanitized completion-photo identity/metadata/content and safe upload receipt; never emit image bytes or credential material in evidence.

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
17. uploads a sanitized synthetic photo with the exact upload command, reconciles an injected upload response loss without duplication, then separately submits its Completion Report;
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
- replacing the authorizing occupancy member also blocks visit; Tenant commands with another/ended digest deny while a current authorized Tenant digest for the correct ticket succeeds.

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
| AC05 No Vendor IAM | T2,T4,T12 | role/schema + external session/UI + no-account Vendor browser |
| AC06 Token storage | T2,T4,T11 | catalog/data scan |
| AC07 One-time redeem | T2,T4 | external HTTP/PG |
| AC08 Session replacement | T2,T4 | PG + HTTP |
| AC09 Assignment scope | T2,T4,T8,T11,T12 | session-bound ticket-lock and cross-assignment job/photo upload/read hidden-resource probes |
| AC10 Packet minimum data | T1,T2,T3 | contracts/PG/UI |
| AC11 Private data absent | T1,T2,T10,T12 | serialization/browser |
| AC12 Provenance | T1,T2,T3 | contract/packet UI |
| AC13 Address provenance | T2,T3 | PG publish tests |
| AC14 Photo allowlist | T2,T3,T4,T11 | PG allowlist + Vendor source-photo hidden-resource/security |
| AC15 Packet immutability | T2 | PG revision tests |
| AC16 Stale packet | T2,T3,T8,T12 | packet revision PG/HTTP/browser + stale upload packet creates no durable photo |
| AC17 Redeem ≠ Accept | T1,T4,T5,T12 | redeem/session UI + atomic Accept/browser |
| AC18 Decline | T1,T4,T12 | contract + pre-accept HTTP/PG/browser |
| AC19 Withdraw | T1,T5,T12 | contract + scheduling-aware Withdraw PG/HTTP/browser |
| AC20 One OPEN round | T5 | concurrent PG |
| AC21 Tenant slot confirmation | T2,T5,T6,T12 | digest-bound Tenant context + explicit current-slot confirmation PG/UI/browser |
| AC22 Preauth containment | T2,T5,T6,T12 | current Tenant digest + explicit exact-window consent/containment PG/time/browser |
| AC23 Occupancy recheck | T2,T5,T7,T12 | separate recheck_occupancy bridge with exact stored occupancyMemberId; ended/replaced authorizing member denies VISIT_STARTED PG/browser |
| AC24 Immutable Appointment | T5,T6,T12 | PG/UI/browser |
| AC25 RESCHEDULE≠FOLLOW_UP | T5,T6,T7,T9,T12 | PG/UI/provenance/browser |
| AC26 No Manager scheduling relay | T6,T12 | browser flow |
| AC27 No notification claim | T3,T4,T6,T12 | copy/browser |
| AC28 Visit start once | T7 | PG/HTTP |
| AC29 Blocker overlay | T7 | PG/UI |
| AC30 Blocker history | T7 | PG/UI |
| AC31 Follow-up visit | T5,T7,T9,T12 | scheduling + blocker/report provenance + browser |
| AC32 Completion eligibility | T8 | PG |
| AC33 Photo/omission contract | T1,T8 | strict upload command/port + report references 1–5 sanitized assignment-owned images XOR explicit omission; upload alone creates no report |
| AC34 Metadata stripping | T8 | actual JPEG/PNG decode/re-encode + byte/dimension/pixel bounds; stored/served EXIF/GPS/equivalent metadata absent |
| AC35 Report correction | T8,T9,T12 | initial report + durable correction + browser |
| AC36 Report ≠ closeout | T8,T9 | PG/UI |
| AC37 Completion-reported freeze | T8,T9,T12 | initial freeze + exact correction exception + browser |
| AC38 Atomic closeout | T9 | concurrent PG |
| AC39 Communication guard | T9,T12 | Q&A-version concurrent PG + closeout browser |
| AC40 Access revoked | T9,T12 | PG/Vendor browser |
| AC41 Direct Manager regression | T2,T3,T9,T12 | dedicated B1 Manager context + ordinary Core direct-completion guard PG/browser; unauthorized digest denied |
| AC42 Historical ENDED regression | T2,T3,T9,T12 | reauthorized org/ticket guard ignores historical ENDED assignments; Core PG/browser |
| AC43 Tenant outcome unchanged | T10,T12 | existing PG/browser |
| AC44 Fresh follow-up ticket | T10,T12 | existing PG/browser |
| AC45 Maintenance Fact explicit | T10,T12 | existing PG/browser |
| AC46 Tenant photo isolation | T8,T10,T12 | HTTP/browser |
| AC47 RLS/ACL | T2,T5,T7,T8,T9,T11 | FORCE-RLS/ACL catalog; no runtime/owner broad Core grants; owner-only lock/Tenant/occupancy/Manager bridges; cross-org/assignment upload denial |
| AC48 Idempotency | T2,T4,T5,T7,T8,T9,T11 | redeem/logout/domain receipts + same upload request ID/fingerprint returns one durable photo and same result |
| AC49 Changed replay | T1,T2,T4,T8,T11 | contract/domain conflicts + same upload request ID with changed sanitized bytes or version/packet/Appointment intent => STATE_CONFLICT |
| AC50 Stale concurrency | T2,T5,T7,T8,T9,T11 | source-ticket-first races + post-wait auth; stale upload versions/wrong visit and Revoke/Reassign-first create no durable photo |
| AC51 Response-loss | T3,T4,T8,T11,T12 | link/redeem/session recovery + authoritative upload/photo receipt reconciliation across instances/browser; no blind retry/duplicate photo |
| AC52 Vendor 390 | T4,T6,T12 | Playwright |
| AC53 Manager/Tenant 390 | T3,T6,T12 | Playwright |
| AC54 Restart persistence | T11 | restart script re-reads assignment/packet/scheduling/visit/report history plus sanitized photo/upload receipt |
| AC55 Synthetic/public safety | T11,T12 | scanner/history |
| AC56 Existing regressions | T10,T12 | full local suites |
| AC57 Hosted exact-head CI | T12 | fresh hosted run/logs |

## Candidate Review Gates

Independent plan review must reject the plan if any of these are true:

- any AC01–AC57 lacks a **semantically current** owning task and concrete evidence path after task moves; syntactic presence of 57 AC labels is insufficient;
- Vendor external HTTP can authenticate through B1/Auth0 or `bm_b1_web`;
- Manager/Tenant API can impersonate Vendor session authority, or any Manager/Tenant port method omits the request-scoped B1 digest/current-auth recheck;
- external Vendor ticket locking requires a Core table grant, uses client target IDs as authority, or fails to recheck its session/current assignment after waiting;
- Tenant caller authentication is conflated with stored-occupancy recheck, or the ordinary completion guard derives org through packet publication rather than the dedicated B1 Manager context;
- raw Vendor capability/session/CSRF is durably stored or logged;
- Manager can author Tenant unattended-entry consent;
- Appointment time is updated in place;
- Vendor report can directly complete the ticket or write Tenant outcome/Maintenance Fact;
- any state-changing Vendor Handoff command can lock assignment/round/Appointment before the source ticket row, or closeout is not atomic with assignment CLOSED/access revocation/public-Q&A guard;
- active assignment leaves the legacy direct-completion bypass visible;
- old ENDED assignment blocks direct Manager completion;
- photo metadata stripping is asserted only by mock/filename rather than actual decoded output;
- completion-photo upload lacks Task 1's command/port, matching upload/request ID, sanitized-byte+intent fingerprint, or Task 8's exact ticket-first durable transaction/replay/negative tests;
- response-loss handling blindly retries or can mint duplicate logical actions;
- plan requires modifying `0001–0018` or any then-existing migration;
- any new Vendor durable table lacks ENABLE+FORCE RLS, org scope/restrictive ceiling or exact bootstrap-digest policy where applicable; or the plan removes/weakens existing frozen tests, security roles, hosted checks, timeouts, or retry settings;
- product implementation is started before separate operator authorization after independent plan review.

## Plan Self-Review Checklist

Before requesting independent review, the plan author must record:
- Spec/D9R1 coverage: every frozen section represented; AC traceability 57/57 **and every row's task owner/evidence remains semantically current after task moves**.
- Step scan: no unresolved placeholder markers or unowned signatures.
- Type consistency: contract enum/DTO/port names match every later task; Manager/Tenant methods retain explicit `digest:string`, exact return types and exact stale-field identifiers such as `expectedTicketVersion`.
- Review Focus: each of the five items has an explicit owning test task.
- Proportion: code bodies are not pre-written; plan contains signatures, assertions, commands and frozen values only.
- Repository truth: all existing paths cited above were observed at `954ef347...`; future paths are clearly marked Create.
- Delta3 audit: H-D2-01/02/03 resolved in plan; Tasks 0–12 present; AC01–AC57 semantic rows 57/57 with missing/duplicate/owner mismatch zero; no unresolved placeholders, create-path collision, modify-before-create, broad Core grants, digest-less Manager/Tenant ports, or state-changing command without request identity/ticket-first durable ordering. Recheck the unchanged approved spec/D9/D9R1 blobs before successor publication. These are plan assertions, not implemented/runtime test results.
- Authority: product implementation remains NOT_AUTHORIZED at plan-candidate publication.

## Execution Handoff

After independent plan review passes, STOP. A passing plan review does **not** authorize Task 0 or product implementation. The operator must separately authorize product implementation and choose the execution method.

Recommended future execution method: **Subagent-driven**, because the subsystem crosses five DB migrations, three security identities, three role-specific UIs, concurrency/idempotency, binary evidence and full browser/restart/CI gates; per-task fresh review materially reduces cross-boundary security regressions.

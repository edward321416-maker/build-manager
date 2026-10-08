# Vendor Secure Handoff v1 — reviewed implementation and acceptance map

Canonical BASE/POLICY_REF: `4f3d3dbdf57c7d537ad6b79674b05b29888c44e1`.
Reviewed Task12 source HEAD: `006d256b6ee81131cb7cc421e26c56496b8f90e7`.
Authority: [accepted plan](../docs/superpowers/plans/2026-10-06-vendor-secure-handoff-v1.md), [Design](../docs/superpowers/specs/2026-10-05-vendor-secure-handoff-scheduling-closeout-v1-design.md), [D9](../docs/superpowers/specs/2026-10-06-vendor-secure-handoff-d9-freeze.md), [D9R1 closure](vendor_secure_handoff_d9r1_freeze_closure.md), and PR75 directives6013570160/6013595548 plus the operator's Task9-to-final continuation.

This document records the implemented contract, independently reviewed task evidence and exact source inventory. The final clean candidate includes this receipt and append-only execution metadata. Its actual SHA, complete local gate generation, hosted run/check identities, merge-checkout reconciliation and whole-candidate review belong in the exact-candidate receipt on [Draft PR75](https://github.com/edward321416-maker/build-manager/pull/75). This document does not promote earlier task runs or CI configuration into final exact-head execution proof. No Ready conversion, merge, deployment, production credentials/IAM/provider or real actor/property data is authorized.

## Implemented boundary

- Manager/Tenant use current B1 request digests and selected-organization binding inside the actual Vendor transaction. External Vendor authority is a separate capability/session/CSRF boundary, with no Auth0 account or organization membership creation.
- Five additive migrations0019–0023 implement minimal immutable packets, explicit photo allowlists, consent/immutable scheduling, visit/blocker history, sanitized completion evidence and atomic Manager disposition. Migrations0001–0018 and all frozen authority blobs remain unchanged.
- Every mutation follows source-ticket-first locking and current authority/version checks after waits. Exact request/fingerprint replay preserves one durable action; changed intent conflicts. Runtime roles receive only bounded functions, with exact schema/table/function grants, FORCE RLS and owner-only Core bridges.
- Tenant selected-window consent is separate from policy. RESCHEDULE preserves old future Appointment provenance; FOLLOW_UP preserves OCCURRED history. Vendor report never completes the ticket. Exact manager_disposition correction identity is consumed once by a superseding report. Closeout atomically completes the Core ticket, closes/revokes assignment and respects current public communication.
- Tenant outcomes and fresh follow-up tickets stay separate; Maintenance Fact is explicitly authored. Raw completion evidence is limited to selected ATTACHED reports for authorized Manager audit, with no Tenant or peer access.
- Ambiguous upload recovery reads current exact context before replaying the original command/File into the existing receipt. Raw link bytes remain unrecoverable and require explicit Reissue. Real browser tests cover mounted link lifetime, response loss, cross-assignment controls, responsive layouts and bounded keyboard behavior.

## Independent task closure

Tasks2–8 remain preserved; continuation started from Task8 closure `7bf2dcdb132037eacfcffbf45d5783c13bdffd65`.

| Task | Reviewed final source / result | Durable evidence |
| --- | --- | --- |
|9|`f8d5c0177559ce5859b5b08f440e4ec0d609be93`; initialB0/H0/M2/L1 repaired toB0/H0/M0/L0|[Task9 checkpoint](vendor_secure_handoff_task9_checkpoint.md)|
|10|`8be5a3860bb2230105c5d765d1d2b6467cff6cd3`; initialLOW assertion gap repaired toB0/H0/M0/L0|[Task10 checkpoint](vendor_secure_handoff_task10_checkpoint.md)|
|11|`e15a54e45641fc47238de26de38b68f355f8d948`; missing runtime-role negative proof repaired toB0/H0/M0/L0|[Task11 checkpoint](vendor_secure_handoff_task11_checkpoint.md)|
|12|`006d256b6ee81131cb7cc421e26c56496b8f90e7`; independent spec/qualityB0/H0/M0/L0|Task12 scope and actual evidence below|

## Task12 source and evidence generations

Fifteen source paths add actual Vendor acceptance, separate legacy Core and SDK/B1 boundaries, fresh owned fixtures and Core/SDK/Web/B1/Vendor hosted command wiring. Existing timeouts/retries and assertions remain intact. Two real browser failures justified bounded product fixes: the shared single-control photo dialog now retains Tab/Shift+Tab focus; Vendor form/fieldset/input sizing prevents390px/200percent cross-date overflow. Existing owned Core fixtures provision the exact trusted Vendor-role pair only when both are absent, and reject partial/conflicting attributes/membership read-only. No unknown-role repair, extra grants or migration edit occurs.

| Observed task generation | Result and limitation |
| --- | --- |
|Vendor browser21|17passed/0skipped/retries0, exit0; real resident/preauthorized flows, response loss, supported peer-ID mutations with own positives, responsive/copy/keyboard probes. Covers final Vendor-consumed code.|
|Core focused04|1passed, exit0; includes the later owned-Core role guard. Legacy missing-port503 is environment absence, not B1-authentication proof.|
|SDK focused01|1passed, exit0; real synthetic SDK/B1 Manager PREPARING and Tenant403. Earlier than final Core role guard.|
|Web regression|65files/789tests passed, exit0 after product repairs; earlier than reporter/fixture-guard-only changes.|
|Types/lint|Final Web typecheck and lint exit0. Four existing Web warnings remain; no new warnings introduced.|
|Final stable staged tree|734files/336internal links/0findings, exit0; history_blobs0. This is not full-history evidence.|
|Frozen audit at source006d256|28/28PASS; five Vendor migrations; protected authority/history bytes preserved.|

These are separate task generations, not one complete execution at committed HEAD. Initial fixture/status/selector/typing/discovery failures remain preserved privately and are not product RED. Genuine modal focus RED and intrinsic-width overflow RED preceded their fixes. A superseded history scan ran with mutable staging, was interrupted with observed exit-1 and proves no fixed tree/history result. Final exact-head history must run independently.

Browser evidence distinguishes real UI actions from API/DB prerequisites and negative probes. Unsupported packet/Appointment/report GET404 means route absence only. Supported scoped mutations use an otherwise valid own context and own-ID positives. Image proof uses actual JPEG/PNG decode/re-encode and stored/served metadata/hash/pixel checks. Keyboard coverage is focused controls plus Enter and real modal Tab/Shift+Tab/Escape/focus return; it is not an entire Tab-only journey or a screen-reader test.

## Acceptance traceability

The57 rows below connect the frozen requirement to production paths and concrete regression assertions. They describe what the committed evidence tests assert; final execution status is supplied by the exact-candidate local/hosted receipt. AC57 requires observed hosted execution, not workflow text. Source links identify the implementation; evidence aliases below identify actual test files.

| AC / frozen requirement | Implementation paths | Concrete assertion / evidence |
| --- | --- | --- |
| AC01 — ORG_ADMIN and currently scoped PROPERTY_STAFF can act only on currently authorized source tickets. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts)<br>[vendor-handoff.ts](../apps/web/src/server/core-flow/vendor-handoff.ts)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql) | Current ORG_ADMIN/property staff scope; selected-organization binding in actual Vendor transaction; T9-K03 membership revoked during ticket-lock wait denies closeout without partial effects. Evidence: F, MH, C. |
| AC02 — No VendorAssignment can be created unless the human-selected route is GENERAL_VENDOR or MANUFACTURER_AS. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx) | Only GENERAL_VENDOR or MANUFACTURER_AS permits preparation; current route is rechecked before issue; other routes show no new handoff. Evidence: F, MU. |
| AC03 — SAFETY_ESCALATED prevents ordinary assignment, packet publish and link issue. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx) | Safety escalation blocks assignment and later publish/issue after source change; B11 shows no handoff for SAFETY_ESCALATED. Evidence: F, B. |
| AC04 — Concurrent create/reassign attempts commit at most one non-ended assignment. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | Concurrent create and T9-E01 concurrent Reassign leave one non-ended assignment, no losing receipt and no duplicate logical action. Evidence: F, C. |
| AC05 — A vendor completes the accepted flow without Auth0/user/org membership creation. | [container.ts](../apps/web/src/server/vendor-handoff/container.ts)<br>[proxy.ts](../apps/web/src/proxy.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts) | Standalone Vendor completes browser flow through capability/session without Auth0 login or new user/organization membership; runtime graph and identity rows stay separated. Evidence: F, A, B. |
| AC06 — Database/public logs contain only token digest/metadata, never raw capability. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[token.ts](../apps/web/src/server/vendor-handoff/token.ts)<br>[vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs) | Capability/session/CSRF are persisted as digests; T11-P01 known raw values are absent from durable authority and receipts; exact link replay cannot recover raw bytes. Evidence: F, E, S. |
| AC07 — A redeemed raw link cannot be redeemed again. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts) | B01 fresh raw link redeems once; another request cannot redeem it; exact response-loss request replay stays in its original lineage and absolute expiry. Evidence: F, E, B. |
| AC08 — Redeeming a replacement link revokes the previous vendor session. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts) | Reissue alone preserves an active session; redeeming the replacement invalidates the old session; revocation ends access. Evidence: F, E. |
| AC09 — A vendor session for assignment A cannot read/write assignment B even with a known ID. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs) | Known peer packet/source-photo/completion-photo/Appointment/report IDs are hidden or denied for session A; own positive controls succeed and post-wait authority remains current. Evidence: E, S, C, B. |
| AC10 — Vendor job DTO contains only the fields defined by this design. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx) | Strict Vendor DTO and real canonical packet projection contain only approved minimal fields; unpublished preview uses the same bounded source projection. Evidence: CT, F, P. |
| AC11 — Raw ticket text, full Q&A, private manager data, tenant contact data and unrelated history are absent from vendor responses. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts) | T10-P03 actual serialized role DTOs exclude populated raw Tenant/Q&A/private Manager/unrelated Fact markers; browser preview/job preserves the privacy boundary. Evidence: CT, S, B. |
| AC12 — TENANT_REPORTED / BUILDING_VERIFIED / MANAGER_REVIEWED remains visible and is not silently promoted. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx) | Selected details retain TENANT_REPORTED, BUILDING_VERIFIED or MANAGER_REVIEWED provenance through preview/publication without silent promotion. Evidence: CT, F, MU. |
| AC13 — Vendor service address is server-derived; missing canonical address blocks publication. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx) | Service address derives from canonical server data; missing canonical address blocks preview/publication rather than accepting client authority. Evidence: F, P. |
| AC14 — Only manager-selected same-ticket input photos are vendor-readable. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs) | Explicit same-ticket photo allowlist only; unknown/peer/unselected photos deny; restart serves selected200 and unselected404 before and after new Next PID. Evidence: F, E, S, R. |
| AC15 — Publishing a packet creates a new immutable revision; prior revision remains unchanged. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql) | Publishing appends immutable packet revisions and photo mappings; old revision/allowlist cannot update/delete; four revisions survive restart. Evidence: F, S, R. |
| AC16 — Vendor mutation against an obsolete packet revision returns a conflict and does not commit. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | Stale packet guard conflicts without mutation; upload creates no photo; acknowledgment follows exact revision and B13 exercises browser transport conflict. Evidence: F, C, VU, B. |
| AC17 — Opening/redeeming a link leaves the assignment OFFERED until explicit vendor accept. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts) | B01 redeem leaves OFFERED; explicit Accept atomically creates ACTIVE and exactly one INITIAL OPEN round. Evidence: E, SC, B. |
| AC18 — Vendor decline ends assignment as DECLINED without completing/cancelling the source ticket. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | B05 explicit pre-accept Decline ends DECLINED/access while source ticket remains uncompleted; stale/post-wait authority is denied. Evidence: E, S, B. |
| AC19 — Accepted vendor withdrawal ends assignment as WITHDRAWN and preserves all prior evidence. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | B05 accepted Withdraw ends WITHDRAWN/access while retaining scheduling/work history and unchanged source ticket state. Evidence: SC, B. |
| AC20 — Only one OPEN SchedulingRound exists per assignment. | [0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql) | Concurrent Accept and concurrent Tenant/Vendor RESCHEDULE cannot create a second OPEN scheduling round. Evidence: SC. |
| AC21 — RESIDENT_CONFIRMATION_REQUIRED requires explicit tenant slot confirmation before Appointment creation. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[tenant.ts](../packages/persistence-postgres/src/vendor-handoff/tenant.ts)<br>[vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx)<br>[vendor-handoff.ts](../apps/web/src/server/core-flow/vendor-handoff.ts)<br>[http.ts](../apps/web/src/server/core-flow/http.ts) | Resident mode requires current correct Tenant digest and explicit choice from the current non-expired proposal before an Appointment exists. Evidence: SC, TH, B. |
| AC22 — PREAUTHORIZED_ENTRY_WINDOW is possible only when accessPolicy permits it and the current tenant explicitly authorized the relevant window; the confirmed vendor slot must be fully contained inside that window. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[tenant.ts](../packages/persistence-postgres/src/vendor-handoff/tenant.ts)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-time.ts](../apps/web/src/lib/vendor-time.ts) | B03 consent starts OFF and separately authorizes exact selected windows for current occupancy; selected Vendor slot is fully contained in permitted authorization. Evidence: SC, TU, VU, B. |
| AC23 — If the authorizing tenant is no longer current for the unit, vendor VISIT_STARTED is denied. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts) | B03 ended or replaced stored authorizing member denies visit, even with another current member; source-lock wait rechecks and entry-window boundaries remain enforced. Evidence: SC, W, B. |
| AC24 — Changing a scheduled time preserves the old Appointment and creates a new one. | [0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx) | B04 each actor reschedules through a new round/Appointment while old future Appointment timestamps/provenance remain immutable. Evidence: SC, B. |
| AC25 — An occurred visit remains OCCURRED when a later FOLLOW_UP visit is scheduled. | [0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[tenant.ts](../packages/persistence-postgres/src/vendor-handoff/tenant.ts)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts)<br>[vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql) | B02 FOLLOW_UP preserves old OCCURRED visit; B04 RESCHEDULE supersedes only future SCHEDULED appointment; the two round purposes stay distinct. Evidence: SC, C, B. |
| AC26 — Normal vendor/tenant scheduling succeeds without manager confirmation at each step. | [vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-handoff.ts](../apps/web/src/server/core-flow/vendor-handoff.ts)<br>[http.ts](../apps/web/src/server/core-flow/http.ts) | Resident browser scheduling is direct Tenant availability, Vendor proposal and Tenant confirmation; Manager observes or requests rescheduling without entering Tenant consent. Evidence: TH, TU, VU, B. |
| AC27 — No test or UI claims SMS/Kakao/email/push delivery in v1. | [vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx) | Scheduling/result copy remains neutral and never claims unsupported delivery/notification or automatic unattended-entry permission. Evidence: TU, VU, B. |
| AC28 — Valid ACTIVE assignment/current Appointment permits exactly one VISIT_STARTED. | [0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | Explicit VISIT_STARTED records exactly one occurrence for current scheduled Appointment with exact replay; stale/wrong/blocked starts deny. Evidence: W, VU, B. |
| AC29 — A blocker does not erase the current operational phase/history. | [0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | B02 blocker overlays work while preserving Appointment and source state; blocked work cannot start or report completion. Evidence: W, VU, B. |
| AC30 — Clearing a blocker references the exact blocker and preserves both events. | [0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | B02 clear targets the exact active blocker, appends history and preserves the old blocker event; optional note remains separate. Evidence: W, VU, B. |
| AC31 — A real prior visit plus additional work creates FOLLOW_UP history rather than rewriting the old Appointment. | [0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | B02 schedules and starts a later FOLLOW_UP visit; C08 MORE_WORK requires a new occurred visit before a new report while retaining earlier evidence. Evidence: W, C, B. |
| AC32 — Vendor cannot submit Completion Report with an active blocker or OPEN SchedulingRound. | [0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx) | Completion report requires current ACTIVE accepted work, acknowledged packet, eligible occurred visit, no active blocker/OPEN round and correct report/correction context. Evidence: C, VU. |
| AC33 — Completion Report has one to five sanitized images or an explicit omission reason. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[vendor-handoff.ts](../packages/application/src/vendor-handoff.ts)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[photos.ts](../apps/web/src/server/vendor-handoff/photos.ts)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | Initial/correction staging has ten-photo cap; report selects one-to-five valid sanitized photos XOR explicit omission reason; upload alone creates no report. Evidence: CT, C, VU. |
| AC34 — Stored/served completion photos do not preserve EXIF/GPS metadata from the vendor input. | [photos.ts](../apps/web/src/server/vendor-handoff/photos.ts)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts) | Real JPEG/PNG decode-reencode strips EXIF/GPS/XMP metadata, enforces byte/dimension/pixel bounds and preserves sanitized digest through stored/served evidence. Evidence: VH, E, B. |
| AC35 — Manager correction request preserves old report; vendor submits a new report revision. | [0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | Exact manager_disposition.id correction retains old report, permits only scoped evidence and is consumed once by superseding report; concurrent/foreign context attempts deny. Evidence: C, B, R. |
| AC36 — Vendor Completion Report leaves ticket IN_PROGRESS and assignment ACTIVE. | [0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | Vendor report leaves ticket IN_PROGRESS and assignment ACTIVE with COMPLETION_REPORTED work state; upload/report never create Tenant outcome or Fact. Evidence: C, B. |
| AC37 — Packet/scheduling/visit mutations are rejected while manager disposition of the current report is pending. | [0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | Current pending report freezes unrelated packet/scheduling/visit/blocker/withdraw/report operations; only exact correction-scoped upload/new report exceptions remain. Evidence: C, VU, B. |
| AC38 — Successful closeout commits ticket COMPLETED and assignment ENDED/CLOSED together. | [0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | T9-K01 and B02 closeout atomically pair ticket COMPLETED with assignment ENDED/CLOSED and revoked authority; stale losers leave no partial disposition/message/receipt. Evidence: C, B. |
| AC39 — A stale public-Q&A expectedCommunicationVersion prevents manager closeout with no partial vendor/ticket transition. | [0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | T9-K02 both observed lock orders and B13 stale expectedCommunicationVersion reject closeout without partial ticket or Vendor transition. Evidence: C, B. |
| AC40 — Vendor capability/session cannot read the job after assignment CLOSED. | [0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | After CLOSED, old Vendor session/capability cannot read job; browser and restarted server retain this denial. Evidence: C, B, R. |
| AC41 — A ticket with no non-ended VendorAssignment can still use the accepted manager-only completion flow. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts)<br>[vendor-handoff.ts](../packages/application/src/vendor-handoff.ts)<br>[core-flow.ts](../packages/persistence-postgres/src/core-flow.ts) | Active assignment blocks actual ordinary completion; correctly authorized Manager completes no-current-assignment ticket; stale/unauthorized digest and racing create remain guarded. Evidence: F, S, C, B, R. |
| AC42 — An old DECLINED/REVOKED/SUPERSEDED assignment does not prevent later manager-only completion. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts)<br>[vendor-handoff.ts](../packages/application/src/vendor-handoff.ts)<br>[core-flow.ts](../packages/persistence-postgres/src/core-flow.ts) | DECLINED/REVOKED/SUPERSEDED historical assignments do not block ordinary Manager completion after all current assignments end; occurred history stays preserved. Evidence: C, B. |
| AC43 — Tenant RESOLVED / UNRESOLVED / RECURRENCE_CLAIM semantics remain unchanged after vendor closeout. | [core-ticket-outcome.ts](../packages/application/src/core-ticket-outcome.ts)<br>[core-flow.ts](../packages/persistence-postgres/src/core-flow.ts)<br>[http.ts](../apps/web/src/server/core-flow/http.ts)<br>[ticket-outcome.tsx](../apps/web/src/app/core/ticket-outcome.tsx) | After Vendor closeout, Tenant RESOLVED remains separate with exact replay; existing UNRESOLVED/RECURRENCE semantics and closed source/assignment stay unchanged. Evidence: S, TU, B. |
| AC44 — UNRESOLVED / RECURRENCE creates a new linked ticket and does not reopen the completed source ticket/assignment. | [core-ticket-outcome.ts](../packages/application/src/core-ticket-outcome.ts)<br>[core-flow.ts](../packages/persistence-postgres/src/core-flow.ts)<br>[http.ts](../apps/web/src/server/core-flow/http.ts) | UNRESOLVED/RECURRENCE creates a fresh linked OPEN ticket with new Tenant input and no copied photos/Q&A/private work/Fact, without reopening source. Evidence: S, TU, B. |
| AC45 — Manager completion/vendor report does not auto-create Unit Maintenance Fact. | [core-maintenance-fact.ts](../packages/application/src/core-maintenance-fact.ts)<br>[core-flow.ts](../packages/persistence-postgres/src/core-flow.ts)<br>[manager-maintenance-timeline.tsx](../apps/web/src/app/core/manager-maintenance-timeline.tsx) | Report/closeout create zero Fact; explicit Manager Fact starts blank with INSPECTION default and stores only separately entered data. Evidence: S, MU, B. |
| AC46 — Tenant cannot call the raw vendor completion-photo endpoint. | [0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts)<br>[vendor-handoff.ts](../apps/web/src/server/core-flow/vendor-handoff.ts)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql) | Only authorized Manager can retrieve report-selected ATTACHED photos, including historical reports; Tenant/peer/staged/unattached-retained access denies without disclosure. Evidence: C, S, CH, B. |
| AC47 — New resources enforce exact org/assignment authorization, FORCE RLS where applicable, no PUBLIC runtime DML and bounded EXECUTE grants. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql) | Exact owner/schema/function/table ACL catalogs, FORCE RLS/restrictive org boundaries and owner-only Core bridges; actual runtime DML/owner/runtime SET ROLE escalation deny. Evidence: F, S, A. |
| AC48 — Exact mutation replay produces one durable action and the same receipt/result. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[external.ts](../packages/persistence-postgres/src/vendor-handoff/external.ts)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts)<br>[vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs) | Exact identities/fingerprints replay one durable action and same receipt; uploads across independent services/Next PIDs consume one photo and one staging slot. Evidence: F, E, SC, W, C, S, R. |
| AC49 — Same idempotency key with changed payload returns conflict. | [vendor-handoff.ts](../packages/api-contracts/src/vendor-handoff.ts)<br>[0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql) | Same idempotency key with changed payload, sanitized bytes or assignment/packet/Appointment/correction intent returns STATE_CONFLICT with no extra durable action. Evidence: CT, F, E, C, S. |
| AC50 — Concurrent manager/vendor mutations with stale expected versions do not overwrite newer state. | [0019_vendor_handoff_foundation.sql](../packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql)<br>[0020_vendor_handoff_scheduling.sql](../packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql)<br>[0021_vendor_handoff_work.sql](../packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql)<br>[0022_vendor_handoff_completion.sql](../packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql)<br>[0023_vendor_handoff_manager_actions.sql](../packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql)<br>[manager.ts](../packages/persistence-postgres/src/vendor-handoff/manager.ts) | Ticket-first lock races recheck caller/session/current assignment and versions after wait; Revoke/Reassign-first uploads and stale closeout/correction losers create no partial state. Evidence: S, SC, W, C. |
| AC51 — Ambiguous response is reconciled from authoritative state before retry; no duplicate action appears. | [vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[http.ts](../apps/web/src/server/vendor-handoff/http.ts)<br>[vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs) | Ambiguous upload reads current exact context before original receipt replay; unknown/changed context cannot POST; B06 issued raw link remains unrecoverable and explicit Reissue is required. Evidence: VU, S, B, R. |
| AC52 — Vendor accept/schedule/work/blocker/completion flow is usable at 390 px without horizontal overflow. | [vendor-job-screen.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.tsx)<br>[vendor-job.module.css](../apps/web/src/app/vendor/job/vendor-job.module.css) | Actual Vendor accept/schedule/work/blocker/report browser controls operate at390px and200% root text without horizontal overflow or sticky bottom CTA; current task precedes history. Evidence: B. |
| AC53 — Manager handoff/closeout and tenant scheduling controls remain usable at 390 px within the accepted Web shell. | [core-photos.tsx](../apps/web/src/components/core-photos.tsx)<br>[core-screen.tsx](../apps/web/src/app/core/core-screen.tsx)<br>[vendor-handoff-manager.tsx](../apps/web/src/app/core/vendor-handoff-manager.tsx)<br>[vendor-handoff-tenant.tsx](../apps/web/src/app/core/vendor-handoff-tenant.tsx)<br>[vendor-handoff.module.css](../apps/web/src/app/core/vendor-handoff.module.css) | Actual Manager1280/1440 and Manager/Tenant390/200% controls retain shell ownership and usable scheduling/closeout; native photo dialog traps and returns keyboard focus. Evidence: B. |
| AC54 — Assignment, packet revisions, scheduling, appointments, work events and completion-report history survive the owned-server restart scenario. | [vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs)<br>[vendor-handoff-dev.mjs](../scripts/vendor-handoff-dev.mjs) | Distinct owned Next PIDs preserve all18 durable table histories, immutable packet/report revisions, correction consumption and sanitized served-photo hashes/receipt identity. Evidence: R. |
| AC55 — Public Git/test fixtures/screenshots contain no real tenant/vendor data, real access secrets or raw capability/session values. | [vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs)<br>[vendor-handoff-dev.mjs](../scripts/vendor-handoff-dev.mjs)<br>[vendor-handoff-browser.mjs](../scripts/vendor-handoff-browser.mjs) | Synthetic owned fixtures only; credential-bearing artifacts disabled/private and authority outside Git; final public-tree/reachable-history scanner has zero findings. Evidence: H, A, B, R. |
| AC56 — Accepted RC1 manager queue, public Q&A, tenant outcome, photos, route/safety and Maintenance Fact Timeline behavior remains green. | [core-browser-run.mjs](../scripts/core-browser-run.mjs) | Exact-candidate complete shared/Web/PostgreSQL/Core/SDK/Web/B1/Vendor and restart gates preserve queue, public Q&A, outcomes, photos, route/safety and Maintenance Fact regressions. Evidence: LEGACY, SDK, CI. |
| AC57 — The eventual published implementation candidate must obtain fresh required hosted checks on the exact candidate HEAD. | [app-check.yml](../.github/workflows/app-check.yml)<br>[core-browser-run.mjs](../scripts/core-browser-run.mjs)<br>[playwright.vendor.config.ts](../apps/web/playwright.vendor.config.ts) | Fresh required hosted checks associate with exact candidate; actual raw Core/SDK/Web/B1/Vendor commands pass and PR merge checkout parents/tree are independently reconciled. Evidence: CI. |

### Evidence file aliases

| Alias | Committed evidence |
| --- | --- |
| F | [tests/postgres/vendor-handoff-foundation.test.ts](../tests/postgres/vendor-handoff-foundation.test.ts) |
| S | [tests/postgres/vendor-handoff-security.test.ts](../tests/postgres/vendor-handoff-security.test.ts) |
| E | [tests/postgres/vendor-handoff-external-http.test.ts](../tests/postgres/vendor-handoff-external-http.test.ts) |
| MH | [tests/postgres/vendor-handoff-manager-http.test.ts](../tests/postgres/vendor-handoff-manager-http.test.ts) |
| P | [tests/postgres/vendor-handoff-manager-preview.test.ts](../tests/postgres/vendor-handoff-manager-preview.test.ts) |
| SC | [tests/postgres/vendor-handoff-scheduling.test.ts](../tests/postgres/vendor-handoff-scheduling.test.ts) |
| TH | [tests/postgres/vendor-handoff-tenant-http.test.ts](../tests/postgres/vendor-handoff-tenant-http.test.ts) |
| W | [tests/postgres/vendor-handoff-work.test.ts](../tests/postgres/vendor-handoff-work.test.ts) |
| C | [tests/postgres/vendor-handoff-completion.test.ts](../tests/postgres/vendor-handoff-completion.test.ts) |
| CT | [packages/api-contracts/src/vendor-handoff.test.ts](../packages/api-contracts/src/vendor-handoff.test.ts) |
| VH | [apps/web/src/server/vendor-handoff/http.test.ts](../apps/web/src/server/vendor-handoff/http.test.ts) |
| CH | [apps/web/src/server/core-flow/vendor-handoff.test.ts](../apps/web/src/server/core-flow/vendor-handoff.test.ts) |
| MU | [apps/web/src/app/core/vendor-handoff-manager.test.tsx](../apps/web/src/app/core/vendor-handoff-manager.test.tsx) |
| TU | [apps/web/src/app/core/vendor-handoff-tenant.test.tsx](../apps/web/src/app/core/vendor-handoff-tenant.test.tsx) |
| VU | [apps/web/src/app/vendor/job/vendor-job-screen.test.tsx](../apps/web/src/app/vendor/job/vendor-job-screen.test.tsx) |
| A | [tests/architecture/vendor-handoff-boundary.test.ts](../tests/architecture/vendor-handoff-boundary.test.ts) |
| B | [apps/web/tests/vendor-e2e/vendor-job.spec.ts](../apps/web/tests/vendor-e2e/vendor-job.spec.ts) |
| SDK | [apps/web/tests/core-login-e2e/vendor-handoff.spec.ts](../apps/web/tests/core-login-e2e/vendor-handoff.spec.ts) |
| LEGACY | [apps/web/tests/core-e2e/vendor-handoff.spec.ts](../apps/web/tests/core-e2e/vendor-handoff.spec.ts) |
| R | [scripts/vendor-handoff-restart-check.mjs](../scripts/vendor-handoff-restart-check.mjs) |
| H | [scripts/verify_repository.py](../scripts/verify_repository.py) |
| CI | [.github/workflows/app-check.yml](../.github/workflows/app-check.yml) |

## Complete fixed-candidate gate protocol

Freeze the clean receipt-inclusive HEAD, then record actual argv/cwd/exit/counts/log hashes and HEAD before/after for: `npm run verify`, `npm run test:web`, `npm run test:postgres`, `npm run test:e2e:core`, `npm run test:e2e:sdk`, `npm run test:e2e:web`, `npm run test:e2e:b1`, `npm run test:e2e:vendor`, `node --experimental-transform-types scripts/vendor-handoff-restart-check.mjs`, `PYTHONPATH=<repo> python scripts/verify_repository.py --history`, and `git diff --check`. Core/SDK wrappers perform required fresh preparation and execute distinct existing configs. The preceding Web build is reused with BUILD_MANAGER_E2E_PREBUILT=1. Required Vendor suites must have nonzero executed tests and zero skipped/todo/retries.

Preserve each first failure; diagnose and minimally repair accepted-scope defects, then validate a new complete candidate generation. Never relabel an earlier run as a later HEAD. Nonforce publication is only to the existing Draft branch. Fresh hosted required checks must name the candidate and show actual Core/SDK/Web/B1/Vendor command execution/results. For PR synthetic merge checkout, reconcile actual checkout parents and tree against fixed base+candidate rather than claim checkout SHA equals PR head. A fresh whole-candidate independent review must close all BLOCKER/HIGH/MEDIUM and known safely fixable LOW findings before the final authorized marker is published.

## Retained limits and public safety

D7-L01 historical harness timeout remains preserved. D8-L01 real device/IME and D8-L02 real screen reader remain NOT_TESTED. Desktop Chromium viewport/text/keyboard checks do not establish these platforms. Existing Vite/experimental notices and four Web plus one Mobile lint warning remain known baseline limits. Private synthetic authority and raw images stay outside public artifacts; navigation/assertion outputs and browser artifacts are constrained accordingly. No paid API/account/OAuth installation occurred. External Google sync remains pending without authorized working access; token usage is unknown, never fabricated.

## Source inventory through reviewed Task12 HEAD

This source inventory is pinned to006d256. The final exact-candidate PR receipt adds its receipt-only bookkeeping commits/paths and any subsequently reviewed remediation, with actual final SHA and checks. All historical STOP and failed-generation receipts remain intact.

### Exact changed paths from canonical base through Task12

```text
M	.github/workflows/app-check.yml
M	apps/web/next.config.ts
M	apps/web/package.json
A	apps/web/playwright.vendor.config.ts
A	apps/web/src/app/api/v2/vendor/[...path]/route.ts
M	apps/web/src/app/core/core-screen.tsx
A	apps/web/src/app/core/vendor-handoff-manager-recovery.test.tsx
A	apps/web/src/app/core/vendor-handoff-manager-schedule.test.tsx
A	apps/web/src/app/core/vendor-handoff-manager.test.tsx
A	apps/web/src/app/core/vendor-handoff-manager.tsx
A	apps/web/src/app/core/vendor-handoff-tenant.test.tsx
A	apps/web/src/app/core/vendor-handoff-tenant.tsx
A	apps/web/src/app/core/vendor-handoff.module.css
A	apps/web/src/app/vendor/job/page.tsx
A	apps/web/src/app/vendor/job/vendor-job-screen.test.tsx
A	apps/web/src/app/vendor/job/vendor-job-screen.tsx
A	apps/web/src/app/vendor/job/vendor-job.module.css
M	apps/web/src/components/core-photos.tsx
A	apps/web/src/components/vendor-interval-fields.tsx
A	apps/web/src/lib/vendor-blocker.ts
A	apps/web/src/lib/vendor-time.test.ts
A	apps/web/src/lib/vendor-time.ts
A	apps/web/src/proxy.test.ts
M	apps/web/src/proxy.ts
M	apps/web/src/server/core-flow/container.ts
M	apps/web/src/server/core-flow/http.ts
A	apps/web/src/server/core-flow/vendor-handoff.test.ts
A	apps/web/src/server/core-flow/vendor-handoff.ts
A	apps/web/src/server/vendor-handoff/container.test.ts
A	apps/web/src/server/vendor-handoff/container.ts
A	apps/web/src/server/vendor-handoff/http.test.ts
A	apps/web/src/server/vendor-handoff/http.ts
A	apps/web/src/server/vendor-handoff/photos.ts
A	apps/web/src/server/vendor-handoff/token.test.ts
A	apps/web/src/server/vendor-handoff/token.ts
A	apps/web/tests/core-e2e/vendor-handoff.spec.ts
A	apps/web/tests/core-login-e2e/vendor-handoff.spec.ts
A	apps/web/tests/vendor-e2e/coverage-reporter.ts
A	apps/web/tests/vendor-e2e/global-setup.ts
A	apps/web/tests/vendor-e2e/harness.ts
A	apps/web/tests/vendor-e2e/vendor-job.spec.ts
M	ops/AI_Execution_Log.csv
M	ops/pending_external_sync.md
A	ops/vendor_secure_handoff_task0_implementation_start.md
A	ops/vendor_secure_handoff_task10_checkpoint.md
A	ops/vendor_secure_handoff_task11_checkpoint.md
A	ops/vendor_secure_handoff_task1_contracts.md
A	ops/vendor_secure_handoff_task2_checkpoint.md
A	ops/vendor_secure_handoff_task2_resume_stop.md
A	ops/vendor_secure_handoff_task2_stop.md
A	ops/vendor_secure_handoff_task2_syntax_revalidation_stop.md
A	ops/vendor_secure_handoff_task3_checkpoint.md
A	ops/vendor_secure_handoff_task4_checkpoint.md
A	ops/vendor_secure_handoff_task5_checkpoint.md
A	ops/vendor_secure_handoff_task6_checkpoint.md
A	ops/vendor_secure_handoff_task7_checkpoint.md
A	ops/vendor_secure_handoff_task8_checkpoint.md
A	ops/vendor_secure_handoff_task9_checkpoint.md
M	package.json
M	packages/api-client/src/core-flow.ts
M	packages/api-client/src/core-photos.ts
A	packages/api-client/src/core-vendor-handoff.ts
M	packages/api-client/src/index.ts
A	packages/api-client/src/vendor-completion.test.ts
A	packages/api-client/src/vendor-job.ts
M	packages/api-contracts/src/index.ts
A	packages/api-contracts/src/vendor-handoff.test.ts
A	packages/api-contracts/src/vendor-handoff.ts
M	packages/application/src/index.ts
A	packages/application/src/vendor-handoff.test.ts
A	packages/application/src/vendor-handoff.ts
A	packages/persistence-postgres/migrations/0019_vendor_handoff_foundation.sql
A	packages/persistence-postgres/migrations/0020_vendor_handoff_scheduling.sql
A	packages/persistence-postgres/migrations/0021_vendor_handoff_work.sql
A	packages/persistence-postgres/migrations/0022_vendor_handoff_completion.sql
A	packages/persistence-postgres/migrations/0023_vendor_handoff_manager_actions.sql
M	packages/persistence-postgres/package.json
M	packages/persistence-postgres/src/core-flow.ts
M	packages/persistence-postgres/src/testing/index.ts
A	packages/persistence-postgres/src/testing/vendor-handoff-roles.ts
A	packages/persistence-postgres/src/vendor-handoff/common.ts
A	packages/persistence-postgres/src/vendor-handoff/external.ts
A	packages/persistence-postgres/src/vendor-handoff/index.ts
A	packages/persistence-postgres/src/vendor-handoff/manager.ts
A	packages/persistence-postgres/src/vendor-handoff/tenant.ts
A	scripts/core-browser-run.mjs
M	scripts/core-flow-dev.mjs
A	scripts/vendor-handoff-browser.mjs
A	scripts/vendor-handoff-dev.mjs
A	scripts/vendor-handoff-restart-check.mjs
M	tests/architecture/b1-boundary.test.ts
M	tests/architecture/b5-boundary.test.ts
A	tests/architecture/vendor-handoff-boundary.test.ts
M	tests/postgres/b2-capabilities.test.ts
M	tests/postgres/core-flow.test.ts
A	tests/postgres/helpers/vendor-handoff-fixture.ts
A	tests/postgres/vendor-handoff-completion.test.ts
A	tests/postgres/vendor-handoff-external-http.test.ts
A	tests/postgres/vendor-handoff-foundation.test.ts
A	tests/postgres/vendor-handoff-manager-http.test.ts
A	tests/postgres/vendor-handoff-manager-preview.test.ts
A	tests/postgres/vendor-handoff-scheduling.test.ts
A	tests/postgres/vendor-handoff-security.test.ts
A	tests/postgres/vendor-handoff-tenant-http.test.ts
A	tests/postgres/vendor-handoff-work.test.ts
```

### Ordered source/task commits through Task12

```text
9bb116eda3bf53a12a2b1c79c4ca9bfbba07e0e6 docs(ops): record Vendor handoff implementation start
255e400e9468f29feab3e11fc28a2e270b296d98 docs(ops): log Vendor implementation Task0
d870452b78f8be47fd54a2511792ed063ff8416f test(vendor): define secure handoff contract red
d4c6646b3d72361cd05a0a80da62dfda9d54f6cf feat(vendor): add secure handoff contracts
0e5193378b2b2d1aa8448d12530e51cb666c6cbe feat(vendor): export secure handoff contracts
81921c76ff66ef8a5cfb1bf10587a492348d035d fix(vendor): repair contract export newline
758594d30cade7bcb2e67d4cc1cb2436e13ee880 test(vendor): define application invariants red
33bd36aa6ad43cc443e21403a7a465c36b6cd93f feat(vendor): add application handoff ports
a3a6260d58a297e14c06c178e6e2e94b3f3a5074 feat(vendor): export application handoff ports
5b3c519278cb04ca8caa3e8de21fbd930738e265 fix(vendor): type handoff error messages
e00dd1958cda0de847f0f7f1fcd0e06b173c178c test(vendor): type transition cases explicitly
6d3b5c26680ad5cb80d8b5a96927115558961fb4 docs(ops): record Vendor handoff Task1
393205fe6b6acfdcd8bfc348c449fbeabb80e3e5 docs(ops): log Vendor implementation Task1
aae9755e8144c49d470b21d9ddbf68081c850f4c merge: reconcile Vendor implementation with canonical plan main
255fc5aad75cb246ae8b26e0abb7e4163a310f66 test(vendor): add Task2 foundation RED
d3253624b6d096b1a7a169bd0c4a93011710575b test(vendor): add Task2 security RED
90cb0eda40cc06c22b9039489a73172553a13f0f test(vendor): provision isolated database roles
0ae6864406c503e6c32cc24dd4de2e5977ee7196 test(vendor): include Vendor roles in common bootstrap
a86ac573aa5278bfaf0508b88cc443a6c5fa6de5 feat(vendor): add foundation security migration
0d7b9b6e041b12506d0264c0b84549b2bab31f4e fix(vendor): retain owner rights inside Vendor schema
3ee8957a83efa570be52eb5334b33c30c9c4ca9b feat(vendor): add persistence security helpers
af74f7d175fece2ff2608947e6bf4af75e12d3d1 feat(vendor): add Manager persistence adapter
a088463dadba41308d18ac5211decdaf31558340 feat(vendor): add Tenant persistence boundary
37b2255ca9167a6d03e47f631603eb06bb6e4c24 feat(vendor): add external capability persistence adapter
b7726bd10b833198bbf5483009e33090e539d2da feat(vendor): export persistence ports
16469ad71f7071bfe835554c6c6c614fd7940209 feat(vendor): export Vendor persistence boundary
813f415f8edb7c87e4967625c0bbfb76b1b9880c test(vendor): add synthetic foundation fixture
4bc2ad580261e10db92bf45b17a869ec3a7ecbba fix(vendor): set synthetic Vendor role password safely
6abbd2ebb894b7045beff4c10451a2c64b511366 test(vendor): inspect PUBLIC schema ACL without role lookup
caa72b679b66b4521dab553457acebea536dafdb feat(vendor): add secure capability issuance foundation
c4d44529363a8b1e61454cdb836ed8ef20e8dea2 feat(vendor): bind Manager routing and secure link issuance
5c1500a65449e318df5ca8241a47bd4662804c92 docs(ops): record Vendor Task2 stop
3649e461b3f740a7d070b45f5c9ddab117a1e9a8 docs(ops): log Vendor Task2 stop
a213cd755d8d3d7d89b3287f85aa33c6c4e30f0b test(architecture): normalize Vendor persistence successor export
46845230f075a0b737b19ee35f04807639da5296 fix(vendor): order schema grants before owner transfer
7bf0d8c9ba09cbfd10ed099c32b6e3a9e7110f87 docs(ops): preserve Vendor Task2 focused PostgreSQL stop
1823f107b50d5045eca1fd6c1d054a72537e0974 fix(vendor): correct Task2 foundation SQL syntax
4fa4265d5c55aff22ff4f9d8fa0deb8f5719e0c8 docs(ops): preserve Vendor Task2 syntax revalidation stop
186c27f86954f82c740380e5b09fbd6bc5f79ee3 fix(vendor): complete foundation replay and security boundaries
fa5216936584e76dbeccdd50c1087d149ad3859e docs(ops): record verified vendor foundation checkpoint
fc5d0f28a33402bfc4cfe26666df195f74d838b9 fix(vendor): bind redemption retries to current session lineage
0177cb0e70966eee6110c2b51bebc107a8e97ef5 docs(ops): append vendor foundation review remediation evidence
4f214d79107a5bd6e6c2ac15fa345591a432fbc7 test(vendor): redact unexpected issuance assertion results
840b3aebc3454d9a82c31a62467309159dda2290 docs(ops): record vendor test evidence safety correction
bad90482a20e4dd1ccf0adb2d82781bf19452c71 feat(vendor): add manager secure handoff flow
7680b31c8e04c55a40918f267c146724717617c6 docs(ops): record manager handoff task checkpoint
acc43fa6fbb83657873427694d8bb9c7de7e0301 fix(vendor): isolate manager organization and recover link requests
de46e21831b45bc6f6f7782992cacea9d125dbd3 docs(ops): record manager handoff review remediation
b3d9c035206596344d8c44eed8073725ddcbcb0e fix(vendor): clear link loss on assignment replacement
80cfb0d7a140c6b449dc74dbf2218a1cb434d2eb docs(ops): record assignment link loss recovery
3c7d3ad471b35a072f67fb4b701517aef9f357ef fix(vendor): discard link loss from historical receipts
fe64d6d303517c06c25b1ba637d91da6bf9897fd docs(ops): record Task3 final review closure
88b5bf9bae05109138eed0456635ae70ccb62d59 feat(vendor): add capability job session
baee4df648a0abb1e8388fc0e764520463fc9d13 fix(vendor): distinguish stale CSRF and harden vendor session edges
dc29c47fb39fb2e66346db94762654c427fba195 fix(vendor): scope pending decline to its assignment
0e4c2da3b8b0a1783eaa789123e6d01d2d7cebc8 docs(ops): record Task4 vendor session boundary closure
52e6af58b5830fdb5a18a171e7638914689c3ece feat(vendor): persist scheduling and consent
bac8cda9c4e7e8471d40b25ea1ddc711310ea3e5 fix(vendor): harden scheduling replay, consent projection and history
6b4eaf1256378aa5bb753b7ef08bbc7125ef9ec6 docs(ops): record Task5 vendor scheduling closure
efd630544a51ebd71061a8a26dce0aadc481e49a feat(vendor): add tenant vendor scheduling
a0fdfc96c5e0868b7da0840d3752ffab59fb41f7 fix(vendor): align tenant consent and scheduling copy with review
afb8cb7a5aea57f99ae1589def5dc4e97ea7753a fix(vendor): clarify consent wording and expired preauthorized status
3953d755e79e8105678ad4146bb040b8ee8ebbbc docs(ops): record Task6 vendor scheduling UI closure
6129c0b5b4f47ac378153adf328a9be212510453 feat(vendor): record visit and blocker evidence
10b66ecbdd912b22863cee848611e70573684bd9 fix(vendor): keep work evidence org-bound and clarify work states
d80c9e4e4a233436c7f6eba3937759f5a7ddd694 test(vendor): pin the cross-organization work evidence refusal
75d29d0c45311b46f2d3cd8fb5c341867abf0c56 docs(ops): record Task7 visit and blocker evidence closure
6b066016b763ea21432eb0e44c89f2fa63ac9287 feat(vendor): add completion report evidence
085c090e5de9ed28cc63d1e2b79eb9b4d28591ba fix(vendor): harden completion uploads and align work report terms
7bf2dcdb132037eacfcffbf45d5783c13bdffd65 docs(ops): record Task8 completion evidence closure
498ffc30490a6c9508ca744e4d4669f644eb4d1f feat(vendor): add atomic manager disposition
f8d5c0177559ce5859b5b08f440e4ec0d609be93 fix(vendor): validate text and bind manager action intent
f0bf4dc4d8f71c1b7cd5d37f55722522ccc68adb docs(vendor): close Task9 review and evidence
947c79e649c387c9c1c04b26e1b778450d279cc2 test(vendor): lock outcome and privacy regressions
8be5a3860bb2230105c5d765d1d2b6467cff6cd3 test(vendor): deny label values in tenant projections
a35d15c759a4accca9c8960153579d278664c975 docs(vendor): close Task10 outcome privacy review
b45300aebd4c59c607b6c3bb5b9532896c64230d fix(vendor): reconcile upload context before receipt replay
db370d98c4eb812852a91c25edd1741673d77e05 test(vendor): prove recovery and restart boundaries
e15a54e45641fc47238de26de38b68f355f8d948 test(vendor): deny B1 runtime role switching
a5f57caa7a25e00729440f95f3dc91d5c3151eac docs(ops): close vendor recovery and restart task
006d256b6ee81131cb7cc421e26c56496b8f90e7 test: enforce vendor browser acceptance and recovery
```

# Vendor Secure Handoff v1 — Plan Remediation Successor Receipt

**Status:** `SUCCESSOR_READY_FOR_INDEPENDENT_DELTA_REVIEW / PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED`

## Reviewed predecessor

- fixed HEAD: `32ea0d151cc74e03878823860c429a580216f1ef`
- fixed plan blob: `a6aa1d111dec67ee80b7f687000af087b3bf1ce6`
- independent review: PR #74 comment `6007733166`
- verdict: `FIX_REQUIRED / BLOCKER0 / HIGH4 / MEDIUM2`

The predecessor generation is preserved in Git history and its review comment is not rewritten.

## Remediation authority

- pre-authorization gate review PASS: `6007888778`
- operator remediation authorization: `6007894685`
- remediation scope: plan + remediation receipt/review bookkeeping + append-only AI execution log only
- product implementation: `NOT_AUTHORIZED`

## Successor plan

- path: `docs/superpowers/plans/2026-10-06-vendor-secure-handoff-v1.md`
- successor plan blob: `7ea63fdd0112b97a9f0eb733cd08ec71519cc3bb`
- remediation commits before receipt:
  - `534484d03b33079c4b2c6ac217fcfb427f1db25d`
  - `f9586d1218548d86e9e9465a3d3fe6e9b899d71e`

## H01 resolved — closeout/direct-completion separation and lock order

The predecessor's advisory-lock wording was not retained.

Successor plan now fixes one universal lock order:

`source core_flow.ticket FOR UPDATE → current VendorAssignment → subordinate Vendor resources → receipt`

It defines:
- ordinary direct Manager completion: existing Core action path + `vendor_handoff.guard_direct_completion` after the source ticket row is already locked;
- Vendor closeout: separate Core-owned `core_flow.vendor_handoff_complete(...)` SECURITY DEFINER capability executable only by `bm_vendor_handoff_owner`;
- closeout helper preserves the existing public-Q&A guard and Manager-authored HANDLING COMPLETED meaning but never calls the direct-completion guard;
- create-vs-direct-complete and closeout-vs-Q&A race tests are explicit.

No second per-ticket advisory-lock order is authorized.

## H02 resolved — complete command/API ownership

Task 1 now contains an exact Manager/Tenant/Vendor command matrix with:
- schema/type name;
- actor;
- route;
- required stale-state/version fields;
- durable result.

It includes Manager create/publish/issue/reissue/revoke/reassign/correction/follow-up/reschedule/closeout, Tenant availability/preauthorization/confirm/reschedule, Vendor redeem/session/logout/read/accept/decline/withdraw/propose/preauthorized-selection/reschedule/visit/blocker/report.

Successful Vendor Accept atomically creates the first `INITIAL / OPEN` SchedulingRound. There is no separate INITIAL-round command.

Session-boundary redeem/logout commands explicitly define `clientRequestId=N/A`; the domain mutation request-id requirement begins after session establishment.

## H03 resolved — exact frozen contracts

Task 1 now pins:
- `VendorDeclineReason`
- `VendorBlockerCode`
- `VendorSharedDetailSourceType`
- `VendorPhotoOmissionReason`
- `VendorAppointmentConfirmationMode`
- `VendorManagerDisposition`
- report-correction Manager reason 1–500 plain text
- `componentOrPartNote` optional 1–500 plain text and not inventory/warranty/cost data

Strict enum/unknown-key/bounds tests are required.

## H04 resolved — reassignment/revoke/follow-up side effects

Successor plan fixes:
- Reassign: old assignment ENDED/SUPERSEDED; access revoked; OPEN round SUPERSEDED; future SCHEDULED Appointment SUPERSEDED; OCCURRED/work/report history retained; new PREPARING assignment.
- Revoke: assignment ENDED/REVOKED; access revoked; OPEN round CANCELLED; future SCHEDULED Appointment CANCELLED; OCCURRED/history retained.
- FOLLOW_UP: exactly one of `sourceBlockerId` or `sourceCompletionReportId`; blocker-driven follow-up may atomically append BLOCKER_CLEARED + create FOLLOW_UP while preserving original blocker; MORE_WORK preserves prior report and records report provenance.

## M01 resolved — expiry evidence

Task 4 requires deterministic-clock tests for:
- capability redeem immediately before/after 72-hour expiry;
- session read/mutation immediately before/after 7-day absolute expiry;
- GET/session or CSRF refresh cannot extend absolute lifetime;
- expired capability/session cannot be resurrected by replay;
- reissue after expiry creates only a new capability.

## M02 resolved — frozen trust/content/visual assertions

Task 12 now asserts:
- forbidden pre-outcome semantic-collapse terms;
- forbidden unattended-entry wording;
- forbidden Reissue recovery wording;
- neutral/primary result treatment, not green success treatment;
- role-appropriate preferred terms.

## Additional completeness items resolved

### Fifth additive migration

Planned migration chain is now drafting-time:
- `0019_vendor_handoff_foundation.sql`
- `0020_vendor_handoff_scheduling.sql`
- `0021_vendor_handoff_work.sql`
- `0022_vendor_handoff_completion.sql`
- `0023_vendor_handoff_manager_actions.sql`

Task 0 re-resolves the **next five** free migration numbers if live main moves.

Task 9 owns `0023`; prior migrations are not back-edited for Task 9 behavior.

### Core bridge capabilities

The successor plan defines narrow Core-owned helpers for:
- Manager-authorized source snapshot;
- current-Tenant occupancy identity;
- exact allowlisted source-photo binary read;
- first-offer `OPEN→IN_PROGRESS` using fixed safe public HANDLING semantics;
- closeout-only `IN_PROGRESS→COMPLETED`.

Vendor Web and B1 Web do not receive direct EXECUTE on Vendor-only Core bridge helpers. Only the narrow direct-completion guard is granted to the ordinary B1 Core runtime.

## Self-audit evidence

- plan tasks: `0–12`
- AC traceability: `57/57`
- missing AC: `0`
- unresolved `TBD/TODO/FIXME`: `0`
- required remediation anchors missing: `0`
- rejected advisory-lock wording remaining: `0`
- predecessor→successor plan delta before this receipt: one file only, `+115/-38`
- approved spec blob remains `ce0ad01a532e6d7230d441f6a580ea0c6ea5e11e`
- frozen D9 snapshot blob remains `67d5ec480db3464eebdf51842905526f0de91b26`
- D9R1 closure receipt blob remains `8bec733aac1a18b8b5dd6b03488acaafe96c8eb0`

## Authority boundary

- `PRODUCT_IMPLEMENTATION_AUTHORIZED = false`
- Task 0: NOT_AUTHORIZED
- source/SQL/migration/test/dependency/workflow implementation: NOT_AUTHORIZED
- Ready / merge / deploy: NOT_AUTHORIZED

## Next gate

`INDEPENDENT_DELTA_REVIEW_VENDOR_SECURE_HANDOFF_PLAN_REMEDIATION`

Delta reviewer must compare predecessor HEAD `32ea0d151cc74e03878823860c429a580216f1ef` with the final successor HEAD and verify the approved spec/D9/D9R1 authority artifacts are unchanged.

CHECKPOINT | Vendor Secure Handoff plan remediation successor | evidence=old32ea0d15/new_plan_blob7ea63fdd/gate6007888778/auth6007894685 | tokens=unknown

# Vendor Secure Handoff plan delta3 remediation receipt

## Scope and fixed authority

Status: `DELTA3_PLAN_SELF_AUDIT_PASS / INDEPENDENT_DELTA_REVIEW_PENDING`.
This receipt records plan remediation, not implemented capabilities or runtime acceptance.

- Repository: `edward321416-maker/build-manager`; PR #74.
- BASE / POLICY_REF and live main observed before editing: `954ef347efef9db29465aefa2e72003b176ee150`.
- Branch: `docs/vendor-secure-handoff-v1-implementation-plan-d9r1`.
- Fixed reviewed delta2 HEAD: `47eb9ce06e76d38fc2d5a5dfe4f4cdb166516e41`.
- Fixed reviewed delta2 plan blob: `2b4685970df845aa3f469b9c67383eb1f5942ef9`.
- Independent delta2 review: [6008938628](https://github.com/edward321416-maker/build-manager/pull/74#issuecomment-6008938628), `FIX_REQUIRED / BLOCKER0 / HIGH3 / MEDIUM0 / LOW0`.
- Delta3 authorization: [6009009124](https://github.com/edward321416-maker/build-manager/pull/74#issuecomment-6009009124).
- Canonical directive: [6009037256](https://github.com/edward321416-maker/build-manager/pull/74#issuecomment-6009037256).
- Successor plan blob: `ab6bc6aa67f578d575bfb984604d8df2dbdd9779`.
- Successor HEAD is the commit containing this receipt and that exact plan blob. The immutable publication marker on PR #74 records its resolved full SHA and remote readback; no self-referential commit hash is fabricated in this file.

Only these repository paths belong to this generation:

1. `docs/superpowers/plans/2026-10-06-vendor-secure-handoff-v1.md`
2. `ops/vendor_secure_handoff_plan_delta3_remediation.md` (new)
3. `ops/AI_Execution_Log.csv` (one append-only row)

An isolated documentation worktree was created from the fixed reviewed HEAD. Existing dirty worktrees and historical receipts were not edited. Product implementation Task 0 was not executed.

## Remediation evidence

| Review finding | Plan resolution | Required future verification owners |
|---|---|---|
| H-D2-01 | Task 2 pins `core_flow.vendor_handoff_lock_ticket(p_org uuid,p_ticket text) RETURNS jsonb`, Core-owned SECURITY DEFINER, owner-only EXECUTE, exact org/ticket FOR UPDATE and five-field minimum return. All external commands bootstrap routing without subordinate locks, acquire this bridge lock, recheck session/current assignment/relationship after waiting, then lock assignment and ordered subordinates. No broad Core table privilege is introduced. | T2 foundation/security bridge and ACL probes; T9 final Revoke/Reassign races; T8/T9 upload races; T11 cross-instance recovery. |
| H-D2-02 | Task 2 splits digest-bound `vendor_handoff_tenant_context` from stored exact-member `vendor_handoff_recheck_occupancy`; T5 uses current Tenant digest and T7 uses exact consent provenance. Dedicated `vendor_handoff_manager_context` derives authorized org for the ordinary direct-completion guard, independently of packet publication. | T2 auth/ACL tests; T5 other/ended Tenant and correct Tenant tests; T7 ended/replaced authorizing member denies visit; T9 stale/unauthorized Manager guard and historical-ENDED regression; T12 browser negatives. |
| H-D2-03 | T1 adds exact upload command, UUID identity, expected assignment/packet/Appointment fields, port and result. T8 pins matching `X-Upload-Id`, accepted Core sanitization bounds, sanitized-byte SHA-256 + normalized intent, ten-step ticket-first durable transaction, exact/changed replay and no report/closeout side effect. | T1 contracts; T8 PostgreSQL and actual HTTP image/metadata/replay/negative tests; T9 Revoke/Reassign races; T11 separate-instance/restart recovery; T12 uncertain-result browser flow. |

All three findings are **resolved in the plan author's self-audit**, pending independent delta review. No runtime result is implied. Existing delta2 FORCE-RLS/digest/bootstrap ceilings, one-time capability semantics, report/correction task ownership and frozen Design remain in place.

Within the same plan, Task 7's stale visit/blocker route spellings were aligned to the already accepted Task 1 command matrix. Task 8 now explicitly lists/stages its existing HTTP and Vendor UI test paths. Neither correction creates a product file or changes the approved behavior.

Core photo bounds were checked against the fixed baseline: `packages/api-contracts/src/core-flow.ts` defines 5 MiB and 20,000,000 pixels; `apps/web/src/server/core-flow/photos.ts` already performs JPEG/PNG decode/re-encode and rejects malformed/oversized content. The plan preserves this implementation and requires positive bounded decoded dimensions and metadata-free stored/served output.

## Semantic AC audit

The author compared every acceptance criterion in the approved spec with the successor plan's owning tasks, task-local assertions and planned evidence files. This is a semantic plan check; the following obligations are **planned**, not executed product tests. Task numbers refer to the plan's exact file inventories and commands.

| AC | Owner(s) | Requirement-to-evidence inspection |
|---|---|---|
| AC01 | T2,T3,T9 | Current ORG_ADMIN/scoped PROPERTY_STAFF authority appears in foundation/security, Core HTTP and post-wait completion checks. |
| AC02 | T2,T3 | GENERAL_VENDOR/MANUFACTURER_AS create gate has PG denial and Manager UI evidence. |
| AC03 | T2,T3,T12 | SAFETY_ESCALATED blocks assignment/publication/link; PG and browser negative coverage remains. |
| AC04 | T2,T9 | Partial uniqueness plus ticket-first create/reassign races preserve one non-ended assignment. |
| AC05 | T2,T4,T12 | Role/schema and external session boundary permit no-account full browser flow without Vendor IAM. |
| AC06 | T2,T4,T11 | Digest-only storage and public/log scans cover capability/session secrets. |
| AC07 | T2,T4 | One-time redemption and bounded same-request response-loss session replacement remain distinct. |
| AC08 | T2,T4 | Replacement redemption revokes prior session; reissue alone does not. |
| AC09 | T2,T4,T8,T11,T12 | Session A cannot choose B as lock/read/write authority, including upload and image reads. |
| AC10 | T1,T2,T3 | Minimum Vendor DTO and packet projection have strict contracts, PG and preview evidence. |
| AC11 | T1,T2,T10,T12 | Serialized role DTO and browser probes omit raw text/Q&A/private/contact/unrelated data. |
| AC12 | T1,T2,T3 | Three provenance labels remain explicit in contract, packet persistence and preview. |
| AC13 | T2,T3 | Canonical server address only; missing address blocks publication without raw-text fallback. |
| AC14 | T2,T3,T4,T11 | Manager-selected same-ticket source-photo allowlist and hidden-resource read checks remain. |
| AC15 | T2 | Published packet revision append/immutability is asserted in PG foundation tests. |
| AC16 | T2,T3,T8,T12 | Stale packet mutation conflicts; photo upload explicitly creates no durable photo. |
| AC17 | T1,T4,T5,T12 | Redeem remains OFFERED; Task 5 alone owns atomic Accept plus INITIAL round. |
| AC18 | T1,T4,T12 | Pre-accept Decline ends DECLINED without source ticket completion/cancellation. |
| AC19 | T1,T5,T12 | ACTIVE Withdraw ends WITHDRAWN and preserves evidence while cancelling actionable scheduling. |
| AC20 | T5 | Concurrent Accept/scheduling retains one OPEN round. |
| AC21 | T2,T5,T6,T12 | Digest-authenticated current Tenant explicitly confirms a valid proposal before Appointment creation. |
| AC22 | T2,T5,T6,T12 | Policy permission, current Tenant consent and full selected-window containment are separate checks. |
| AC23 | T2,T5,T7,T12 | Exact stored authorizing occupancyMemberId, not a replacement occupant, controls post-lock visit recheck. |
| AC24 | T5,T6,T12 | Rescheduling creates new Appointment and preserves old immutable times. |
| AC25 | T5,T6,T7,T9,T12 | FOLLOW_UP retains the OCCURRED visit; RESCHEDULE affects a future confirmed Appointment. |
| AC26 | T6,T12 | Tenant/Vendor normal browser scheduling needs no routine Manager relay. |
| AC27 | T3,T4,T6,T12 | Copy and browser assertions contain no external notification delivery claim. |
| AC28 | T7 | ACTIVE/current Appointment permits exactly one VISIT_STARTED. |
| AC29 | T7 | One blocker overlays operational phase without erasing history. |
| AC30 | T7 | Clear refers to exact blocker and retains record plus clear event. |
| AC31 | T5,T7,T9,T12 | Schema/provenance and later blocker/report actions create FOLLOW_UP only after a real visit. |
| AC32 | T8 | Report rejects active blocker or OPEN round; upload cannot bypass this gate. |
| AC33 | T1,T8 | Strict upload identity/port yields sanitized assignment-owned images; report uses 1–5 XOR approved omission. |
| AC34 | T8 | Actual JPEG/PNG decode/re-encode, accepted limits, stored/served metadata inspection; no mock-only proof. |
| AC35 | T8,T9,T12 | Initial report exists before durable correction request; exact new revision preserves prior report. |
| AC36 | T8,T9 | Report leaves ticket IN_PROGRESS/assignment ACTIVE; upload creates neither report nor closeout. |
| AC37 | T8,T9,T12 | Pending report freezes packet/scheduling/visit operations; exact requested correction is the bounded exception. |
| AC38 | T9 | One transaction commits COMPLETED plus ENDED/CLOSED and revokes access. |
| AC39 | T9,T12 | Current Q&A version and both race orders prevent partial closeout; browser checks stale communication. |
| AC40 | T9,T12 | CLOSED denies old capability/session read and mutation. |
| AC41 | T2,T3,T9,T12 | Dedicated digest-authorized Manager context preserves ordinary completion with no current assignment. |
| AC42 | T2,T3,T9,T12 | Same authorized guard ignores historical ENDED assignments; stale Manager digest still denies. |
| AC43 | T10,T12 | Existing Tenant outcome choices and semantics remain in regression scope. |
| AC44 | T10,T12 | UNRESOLVED/RECURRENCE produces a new linked ticket, without reopening source/assignment. |
| AC45 | T10,T12 | Maintenance Fact stays explicit; Vendor report/Manager completion do not auto-create or auto-copy. |
| AC46 | T8,T10,T12 | No Tenant raw completion-photo route or projection; HTTP/browser denial coverage. |
| AC47 | T2,T5,T7,T8,T9,T11 | Every migration's FORCE RLS/catalog ceiling, bounded owner-only bridges and hostile role/upload probes. |
| AC48 | T2,T4,T5,T7,T8,T9,T11 | All command identities/receipts retained; exact upload replay yields same photo and one durable action. |
| AC49 | T1,T2,T4,T8,T11 | Same key with changed payload, sanitized bytes or expected upload intent conflicts. |
| AC50 | T2,T5,T7,T8,T9,T11 | Ticket-first post-wait authority/version guards and Revoke/Reassign races prevent stale durable effects. |
| AC51 | T3,T4,T8,T11,T12 | Authoritative receipt/state recovery before retry includes photo upload, not only link/session recovery. |
| AC52 | T4,T6,T12 | Standalone Vendor 390 px full workflow is in actual browser suite. |
| AC53 | T3,T6,T12 | Manager/Tenant 390 px controls remain in accepted shell and browser coverage. |
| AC54 | T11 | Owned restart rereads assignment/packet/scheduling/visit/report history plus photo and upload receipt. |
| AC55 | T11,T12 | Synthetic fixtures/evidence, public scanner/history and no credential/image-byte publication. |
| AC56 | T10,T12 | Existing RC1/Q&A/outcome/photos/route/safety/Maintenance Fact full regression gates retained. |
| AC57 | T12 | Future implementation requires fresh exact-head hosted checks and actual job-log inspection. |

Result: **57 rows; missing = 0; duplicate = 0; owner mismatch = 0**. AC33/34/47/48/50/51 were specifically rechecked for upload ownership; AC09/16/49 also carry upload evidence. T12 browser ownership was made explicit for AC05/39, and T2 auth ownership for AC21/22/41/42. No criterion was satisfied by label count alone.

## Self-audit and verification boundary

| Check | Result and scope |
|---|---|
| H-D2-01 / H-D2-02 / H-D2-03 | Resolved in successor plan; independent review pending. |
| Tasks 0–12 | All 13 present; none executed. |
| AC01–AC57 | Semantic review 57/57; missing0 / duplicate0 / owner mismatch0. |
| Unresolved placeholder markers | TBD0 / TODO0 / FIXME0 in plan. |
| Explicit future create paths | 51; compared to fixed main tree and task creation order: create collision0 / modify-before-create0. |
| Manager/Tenant digest ports | All listed signatures remain request-digest explicit; omissions0. |
| State-changing command matrix | 27 unique commands; request identity omissions0; ticket-first durable-order omissions0, including upload/redeem/logout. |
| Core direct grants | No direct/broad Core table SELECT/DML grant to Vendor runtime/owner; Core owner-only bridge contracts explicit. |
| FORCE RLS | Existing table inventory, org ceilings and capability/session digest-bootstrap restrictions preserved. |
| Photo command | Command/port/header identity/fingerprint, ten-step durable order, replay and all required negative tests specified. |
| Public scanner regression | `tests/test_verify_repository.py`: 3/3 PASS; `scripts/tests/test_verify_repository.py`: 14/14 PASS. |
| Plan content scan / whitespace | Existing `scan_content` on modified plan PASS; `git diff --check` PASS. |
| Final candidate public tree/history | Must PASS against the staged/committed three-path candidate before push; publication marker records actual result. |
| Product/runtime/SQL/browser tests | NOT_RUN; only future test obligations were changed in the plan. |
| Google execution sync | Pending; one local CSV row only. No external account/sync operation or extra repository path is required. |

Authority blob readback before publication must remain:

| Authority | Exact blob |
|---|---|
| Approved spec | `ce0ad01a532e6d7230d441f6a580ea0c6ea5e11e` |
| D9 snapshot | `67d5ec480db3464eebdf51842905526f0de91b26` |
| D9R1 closure receipt | `8bec733aac1a18b8b5dd6b03488acaafe96c8eb0` |

All three matched the fixed predecessor and current worktree bytes during this self-audit. Any unexpected live-main/PR movement, authority change or need for another path is a STOP, not permission to retarget.

## Publication and stop

Publish only the three-path successor and a concise PR #74 marker containing its full HEAD, plan blob, these authority blobs, checks and readback. Preserve the reviewed delta2 history. PR #74 remains **OPEN / DRAFT / NOT_READY / NOT_MERGED**; lifecycle observation belongs to the publication marker.

Next gate: `INDEPENDENT_DELTA_REVIEW_VENDOR_SECURE_HANDOFF_PLAN_DELTA3_REMEDIATION`.

`PRODUCT_IMPLEMENTATION_AUTHORIZED=false`. No Task 0, product/SQL/migration/test implementation, dependency/lockfile/workflow change, Ready, merge or deployment.

CHECKPOINT | Vendor plan delta3 remediation self-audit | evidence=auth6009009124 / review6008938628 / fixed47eb9ce0 / directive6009037256 | tokens=unknown

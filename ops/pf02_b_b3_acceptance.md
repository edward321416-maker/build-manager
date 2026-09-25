# PF02-B B3 implementation acceptance and actual-main publication

Snapshot: 2026-09-25. POLICY_REF / documentation TARGET_REF: `741997d93015991c1c89716a3ca93b662a8be0d8`.
Repository: `edward321416-maker/build-manager`.

This is a record of implementation acceptance and merge **with disclosed limitations**, not B3 canonical closure or VERIFIED/FROZEN promotion. `MERGED_WITH_DISCLOSED_LOW` is the descriptive state introduced by this reconciliation candidate. It records completed facts; it does not authorize additional implementation.

## Disposition and authority

PF00 FROZEN; PF01 REVIEW_DRAFT; PF02-A VERIFIED / FROZEN; PF02-B IN_PROGRESS; B1/B2 VERIFIED / FROZEN. B3 is MERGED_WITH_DISCLOSED_LOW. Slices beyond B3 remain NOT_STARTED / NOT_YET_SCOPED.

**CURRENT ADDITIONAL PRODUCT TASK = NONE_AUTHORIZED.** The operator authorized this documentation reconciliation, commit/push and Draft PR submission only. Its stopping point is OPEN / DRAFT / NOT_MERGED. LOW remediation, B3 formal closure, VERIFIED/FROZEN promotion, F01/F43 promotion and later slices are not authorized.

Historical authority is preserved in the [plan acceptance/implementation authorization](pf02_b_b3_plan_acceptance.md), [approved design](../docs/superpowers/specs/2026-09-25-pf02-b-b3-building-registration-foundation-design.md) and [approved plan](../docs/superpowers/plans/2026-09-25-pf02-b-b3-building-registration-foundation.md). Their earlier status labels describe their own snapshots; they are not instructions to restart completed implementation.

- Approved design blob: `7c59b43ec0e818d1f81243122693a858614d9a35`.
- Approved plan blob: `885cd49a93aea0f6eb54cbd00815c2104bd1aa53`.
- [Exact-head operator acceptance and independent-review receipt](https://github.com/edward321416-maker/build-manager/pull/42#issuecomment-5831953075).
- [Actual merge-main publication receipt](https://github.com/edward321416-maker/build-manager/pull/42#issuecomment-5832041814).

## Exact Git publication

| Fact | Exact value |
| --- | --- |
| Implementation base / merge parent 1 | `0535be88bb9291e60b42b9c327d9eb13124d2d09` |
| Accepted candidate / merge parent 2 | `2252929b56f375a4fe8f19858c23b8d2e92c7845` |
| Implementation PR | [#42](https://github.com/edward321416-maker/build-manager/pull/42), MERGED |
| Actual implementation merge/main | `741997d93015991c1c89716a3ca93b662a8be0d8` |
| Merged at | `2026-09-25T11:56:19Z` |
| Candidate and merge tree | `6d3da8f29a795676a64d8997131be02199b052c6` |

Readback confirms both parents and exact tree equality. The merge used an exact-head guard and merge-commit mode; no acceptance/log-only candidate commit was added. The feature branch was preserved. This is the actual main merge, not a synthetic PR test-merge SHA.

## Independent review succession and roles

The independent full review covered `0535be88...7368cd3dad83ea7e120b9195f22ecfbb1a8f93f8`: 56 changed files / 36 commits. Its original verdict was CHANGES_REQUIRED, with M02 the sole MEDIUM and M01/M03/M04 already LOW. After M02 correction, the independent delta reviewed `7368cd3...2252929...`, returned DELTA_ACCEPTED and revised the overall disposition to **NO_BLOCKING_FINDINGS**: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 3. The final candidate has 56 changed files / 38 commits. Original verdicts are retained as history, not overwritten.

Local originals were accessible and rehashed during reconciliation; they match the accepted receipt:

| Original | Bytes | SHA-256 |
| --- | --- | --- |
| Full implementation review | 32930 | `dcc85977ae7ee8d17fe63c44dd2e8303b2a83363527fe2df268b6bf2b58a124e` |
| M02 delta review | 16903 | `467223969b4be16fc80955a8c831abd82c039d816e2b905f60326815cdbc5678` |

The reviewer disclosed prior independent design review, but no B3 product implementation/edit/commit participation. Reviewer runtime execution = NOT_RUN. Review means fixed-ref source analysis and hosted evidence readback, not independent PostgreSQL/browser execution. Codex records and publishes these received results; Opus is the independent reviewer; the coordinator mediates operator approval/scope. Account identity alone does not attribute authorship; this receipt does not claim Codex authored previous coordinator changes.

## Findings and acceptance limitations

| Finding | Disposition | Meaning |
| --- | --- | --- |
| B3SR-B01 | RESOLVED | Reviewed one-path B2 test-support exception, [scope record](https://github.com/edward321416-maker/build-manager/pull/42#issuecomment-5830785362); no general freeze waiver |
| B3SR-H01 | RESOLVED | Registration request cancellation and stale-response lifecycle guards; eight browser regressions retained |
| B3SR-M02 | RESOLVED | Executing migration-owner privilege preflight before every grant/role transition |
| B3SR-M01 | LOW / OPEN | Denied registration view logout affordance; operator-approved deferral |
| B3SR-M03 | LOW / OPEN | Exact policy-expression/function-ACL assertion gaps; operator-approved deferral |
| B3SR-M04 | LOW / OPEN | PostgreSQL Unicode boundary-value roundtrip evidence; operator-approved deferral |

**AC04 = PARTIAL.** The other 22 ACs were reported COVERED by the independent review. This is not 23/23 PASS, source-code coverage, an independent runtime reproduction, or closure. Canonical **F01/F43 = NOT_RUN**; [acceptance_cases.json](../docs/production-foundation/acceptance_cases.json) is unchanged.

M02 RED `dfe1958614f8bea7bd645a5c1f55f415ab63fee3` failed the new designated executor-error expectation because the existing privileged fixture was already rejected by a later `B3_ROLE_CONTRACT_INVALID` check. It did not demonstrate previously successful superuser migration or RLS bypass. GREEN `2252929...` adds the required preflight. Non-superuser/BYPASSRLS-only runtime negative control remains NOT_RUN; the separate predicate is protected by a source pin, not claimed as that runtime control.

## Candidate and actual-main CI generations

These are HOSTED_CI readbacks, with all named jobs completed/success, no missing/skipped/cancelled required job. Both generations use attempt 1.

| Generation | HEAD | Event / branch | Repository run | App run |
| --- | --- | --- | --- | --- |
| Implementation candidate | `2252929b56f375a4fe8f19858c23b8d2e92c7845` | pull_request / feature branch | [36128244741](https://github.com/edward321416-maker/build-manager/actions/runs/36128244741) | [36128243625](https://github.com/edward321416-maker/build-manager/actions/runs/36128243625) |
| Actual implementation main | `741997d93015991c1c89716a3ca93b662a8be0d8` | push / main | [36132125772](https://github.com/edward321416-maker/build-manager/actions/runs/36132125772) | [36132125715](https://github.com/edward321416-maker/build-manager/actions/runs/36132125715) |

| Required job | Candidate job ID | Actual-main job ID | Both conclusions |
| --- | --- | --- | --- |
| verify | 108049254242 | 108061569620 | SUCCESS |
| repository-safety | 108049253131 | 108061569783 | SUCCESS |
| apps | 108049252943 | 108061569746 | SUCCESS |
| mobile-cold-linux | 108049253219 | 108061569590 | SUCCESS |
| install-mobile-windows | 108049253086 | 108061569869 | SUCCESS |
| web-e2e | 108049253209 | 108061569749 | SUCCESS |
| mobile-health | 108049253124 | 108061569633 | SUCCESS |
| postgres-integration | 108049253143 | 108061569821 | SUCCESS |
| foundation-gate | 108050599562 | 108062812331 | SUCCESS |

Candidate 9/9 and actual-main 9/9 are separate evidence. Candidate receipt/review reports PostgreSQL 183/183 tests and authenticated browser 42/42 (including eight H01 cases), not code coverage. Authentication classification is SYNTHETIC_AUTH + ACTUAL_WEB_POSTGRES, not LIVE_PROVIDER. No live Auth0 rerun or new executor-local product runtime suite is claimed by this documentation task.

This document candidate's future/actual CI is a separate DOCUMENTATION_PUBLICATION generation to be read at its exact PR HEAD. The implementation runs above cannot substitute for it; it is not B3 closure-main CI.

## Migration and protected-byte preservation

Migrations 0001–0007 were rehashed against the implementation base and remain byte-identical. B3 adds only 0008. At accepted HEAD / actual main, raw Git bytes of `0008_b3_building_registration.sql` were recomputed:

- Git blob: `3ba77df8e151e8e5b5b4650f0602ab600c23fd8c`.
- Bytes: **4798**.
- SHA-256: `c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986`.

These are Git blob bytes, not Windows checkout newline assumptions. All migrations 0001–0008 are unchanged by this documentation reconciliation. Approved design/plan, historical plan/B1/B2 receipts, F-case registry, product source/tests/dependencies/workflows and policies are outside its changes. This preservation statement does not promote the entire B3 slice to FROZEN.

## Remaining risks and publication boundary

Retain approved B3D-L01/L02 from the design and B1/B2 deferred findings from their historical receipts. Dependency advisories/install-script warnings, CI runtime maintenance, Mobile Windows-mounted timeout ROOT_CAUSE_NOT_ESTABLISHED, Auth0 entitlement, operational session/retention and incomplete security/privacy work are not resolved by this record; see [STATUS](../STATUS.md), [B1 receipt](pf02_b_b1_acceptance.md), [B2 receipt](pf02_b_b2_acceptance.md) and the approved design.

REAL_TENANT_DATA = NOT_AUTHORIZED. PRODUCTION_DB_HOSTING = NOT_AUTHORIZED. No real-data pilot, provider/IAM change, additional product scope, LOW repair or later slice is authorized. B3 canonical closure and VERIFIED/FROZEN promotion remain unapproved. This receipt is documentation of acceptance/integration with limitations, not a release-readiness or security-completion claim.

The documentation candidate carries accessible acceptance/merge/main-CI queue events into the repository CSV append-only. Candidate publication is distinct from main integration; inaccessible prior-session queues are not claimed synchronized. External Google Sheets/Drive synchronization remains PENDING; no Google writes or OAuth/IAM changes. See [pending queue](pending_external_sync.md). This Draft PR must remain OPEN / DRAFT / NOT_MERGED pending review and separate merge authorization.

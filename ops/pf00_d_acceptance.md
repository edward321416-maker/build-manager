# PF00-D independent acceptance and freeze receipt

Snapshot: **2026-09-19**. PF00: **FROZEN / VERIFIED BASELINE**. PF00-D: **ACCEPTED_AND_INTEGRATED**.

## Authority and evidence classification

- POLICY_REF: `333228163227d55d13e514fb9311ecb8b9dea615`; canonical AGENTS, AI delivery rules and project policy were read from the initial current main. Their bytes are unchanged in the resulting merge.
- Initial TARGET_REF / independently accepted [PR #24](https://github.com/edward321416-maker/build-manager/pull/24) head: `f8cbcdbd0c3ec7fde2e298a78f8c809caa1c2e19`.
- Freeze-record TARGET_REF / `PF00_D_MERGE_SHA`: `6669c50ee5c2a07d40412a7162ddf381fa4698b1`.
- **OPERATOR_SIDE_INDEPENDENT_ACCEPTANCE:** the operator supplied acceptance of the exact PR #24 head after independently inspecting remote Git evidence, all eight CI checks and actual logs, seven documentation/ops paths, revision 0.5 UTF-8 bytes/hashes, and C/F case provenance. This executor records that acceptance; it does not claim to have performed the operator-side review.
- **EXECUTOR_REMOTE_READBACK:** this run freshly rechecked the PR refs/state/checks, merged with expected-head protection, verified parents/tree/branch preservation, fetched resulting main, and inspected the new main CI logs. An executor checksum recheck is separate from operator-side independent acceptance.
- **ACCEPTED_EXECUTOR_EVIDENCE:** PF00-A/B local receipts remain attributed to their original executor via [A/B acceptance](pf00_ab_acceptance.md). No local application rerun or new Windows/WSL reproduction is claimed by this documentation task.

## Exact merge and publication

PR #24 was OPEN, NOT MERGED, MERGEABLE/CLEAN with base `333228163227d55d13e514fb9311ecb8b9dea615` and head `f8cbcdbd0c3ec7fde2e298a78f8c809caa1c2e19` immediately before its authorized merge commit. The accepted PR CI remained current and successful; it was not rerun as a substitute for new main evidence.

`PF00_D_MERGE_SHA=6669c50ee5c2a07d40412a7162ddf381fa4698b1`

Merge parents, in order:

1. Previous main: `333228163227d55d13e514fb9311ecb8b9dea615`.
2. Accepted PR head: `f8cbcdbd0c3ec7fde2e298a78f8c809caa1c2e19`.

The accepted and merged trees both equal `d74e511ee3e4e154fc527a5593261cfb4ef7cc85`. Remote branch `docs/pf00-finalization` remains at the accepted head. No squash, rebase, force push, history rewrite or branch deletion was used.

## Accepted PR CI and fresh actual-main CI

| Evidence | App checks | Repository checks | Event / exact source |
| --- | --- | --- | --- |
| Accepted PR #24 | [35441574734](https://github.com/edward321416-maker/build-manager/actions/runs/35441574734) | [35441574769](https://github.com/edward321416-maker/build-manager/actions/runs/35441574769) | pull_request; `f8cbcdbd0c3ec7fde2e298a78f8c809caa1c2e19` |
| Actual merged main | [35442667639](https://github.com/edward321416-maker/build-manager/actions/runs/35442667639) | [35442667660](https://github.com/edward321416-maker/build-manager/actions/runs/35442667660) | push to main; `6669c50ee5c2a07d40412a7162ddf381fa4698b1` |

All four runs are **SUCCESS, attempt 1**. PR CI is not promoted to main publication evidence. The executor inspected actual main job output:

| Required check | Main result | Actual execution evidence |
| --- | --- | --- |
| verify | SUCCESS | Scanner direct processes: 3 + 14 tests; public/history gate: 285 files, 103 internal links, 566 reachable blobs, zero findings |
| repository-safety | SUCCESS | Scanner 3 + 14, public/history and whitespace gates |
| apps | SUCCESS | Shared 301, Web unit 256; lint, typecheck, Web build and dependency tree passed |
| mobile-cold-linux | SUCCESS | 13 suites / 133 tests; fresh cache; zero failures, pending or todo |
| install-mobile-windows | SUCCESS | Install/build/dependencies and cold Mobile 13 suites / 133 tests; zero failures, pending or todo |
| web-e2e | SUCCESS | 21 tests through the existing synthetic-state configuration |
| mobile-health | SUCCESS | Expo Doctor 1.20.4: 21/21, failed 0; both export commands actually executed |
| foundation-gate | SUCCESS | All six dependency results explicitly logged as success |

Android export produced **29 files** and iOS export **25 files**. These are JS/assets bundle results only, not native compilation, device execution, signing or store readiness. Counts are observations at these SHAs, not permanent inventory requirements. Node24.21.0 / bundled npm11.19.0 remains the selected runtime.

## Accepted revision 0.5 and unchanged case provenance

The operator independently read actual remote UTF-8 bytes for **all 12** revision 0.5 manifest entries: **12/12 SHA-256 matches and 12/12 byte-count matches**. This executor also recomputed them from fetched Git blobs. These are distinct verifications of the same accepted bytes.

[The canonical case registry](../docs/production-foundation/acceptance_cases.json) remains byte-for-byte unchanged by the freeze-record task:

| Cases | Status / provenance |
| --- | --- |
| C01–C04 | PASS_ACCEPTED_EXECUTOR_EVIDENCE |
| C05–C09 | PASS_GITHUB_CI |
| C10 | PASS_MERGED_MAIN_PUBLIC_GATE |
| C11 | PASS_PF00_D_EVIDENCE_RECONCILIATION |
| C12 | PASS_PF00_C_PUBLICATION |
| F01–F44 | NOT_RUN, 44/44; PF02 not executed |

C12 continues to mean PR #23's PF00-C publication. It is not redefined as PR #24 acceptance or this freeze-record PR. Revision **0.6 supersedes 0.5** for current README/audit/status reconciliation. Its existing 12-entry manifest is freshly recomputed from final UTF-8 bytes, preserving entry set and self-exclusion; historical design documents and case evidence are not rewritten.

[PF00-C acceptance](pf00_c_acceptance.md) retains the original RED head `8ccdcb3...`, failed App run **35438808876**, Repository run **35438808911**, Doctor dependency mismatch, mobile-health/foundation failure and exports NOT_RUN. The subsequent accepted GREEN at `33d1d77...` (runs **35440280982 / 35440280999**) and actual main GREEN at `3332281...` (runs **35440841108 / 35440841105**) remain separate historical evidence.

## CodeRabbit and open risks

`CODERABBIT_STATUS=SUCCESS_STATUS`; `CODERABBIT_REVIEW=SKIPPED`. The [PR #24 comment](https://github.com/edward321416-maker/build-manager/pull/24#issuecomment-5741666364) says automatic review was skipped because the repository has fewer than 10 stars. It is not independent code-review evidence.

- **OPEN_RISK / dependency-security-triage:** npm reports 14 moderate vulnerabilities; the unrs-resolver install-script warning requires a separate review. No audit fix, dependency upgrade or script approval is part of this task.
- **OPEN_RISK / ci-supply-chain-maintenance:** pinned Actions v4 target an older internal runtime; GitHub hosted execution forces Node24. Action-major upgrades remain separately scoped.

Both risks remain follow-up hardening work before private beta/release. They do not retroactively erase the observed CI results.

## Freeze boundary and next authorization

The freeze becomes effective only after operator-side PR #24 acceptance, its merge, and all required actual merged-main checks succeed. Those conditions are satisfied at `6669c50ee5c2a07d40412a7162ddf381fa4698b1`. **PF00 is FROZEN:** the production development/verification foundation is a verified baseline. The available checks run automatically and the aggregate fails closed; branch-protection/merge enforcement was not changed.

This does **not** mean production-ready, launch-ready, real-user-ready, security-complete or privacy-complete. Production auth/database, real identity and real property/unit/occupancy persistence are not implemented. Actual tenant data is **not authorized**. Synthetic prototype persistence is not production persistence.

PF00-A remains VERIFIED_FROM_ACCEPTED_EXECUTOR_EVIDENCE; PF00-B remains NOT_REPRODUCED_AT_SELECTED_TOOLCHAIN; PF00-C and PF00-D are ACCEPTED_AND_INTEGRATED. **PF01 remains REVIEW_DRAFT; PF02 remains NOT_AUTHORIZED / NOT_STARTED.** The next activity is a PF01 consequential-decision review that preserves operator-resolved decisions and asks only about genuinely unresolved high-impact product/security/privacy choices. No PF01/PF02 implementation is authorized here.

Freeze-record publication has its own PR and fresh post-merge main gates. Its eventual merge SHA/run receipts belong to Git/PR publication evidence; they are not fabricated in this pre-publication file. Raw receipts, absolute local/cache paths, auth values and private data stay outside public Git. Google Sheets/Drive remains **PENDING**, using the existing [event queue](pending_external_sync.md).

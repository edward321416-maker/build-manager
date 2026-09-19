# PF00-C acceptance and publication evidence

Snapshot: 2026-09-19. PF00-C is **ACCEPTED_AND_INTEGRATED**. PF00-D records evidence reconciliation and remains subject to independent acceptance of its documentation PR. PF00 is **READY_TO_FREEZE_AFTER_PF00_D_ACCEPTANCE**, not yet frozen.

## Authority and exact refs

- Pre-merge POLICY_REF: `067985d07b1f3aba69b46374f567545b734d4b64`.
- Pre-merge TARGET_REF / accepted PR #23 head: `33d1d77e913692fefb61550984353645b4574409`.
- Current POLICY_REF and PF00-D TARGET_REF: `333228163227d55d13e514fb9311ecb8b9dea615`. The three canonical policy files were checked at merged main; their bytes match the policies read before merge.
- `PF00_C_MERGE_SHA=333228163227d55d13e514fb9311ecb8b9dea615`.
- [PR #23](https://github.com/edward321416-maker/build-manager/pull/23) was merged using a merge commit with expected-head protection. Parents are exactly `067985d07b1f3aba69b46374f567545b734d4b64` and `33d1d77e913692fefb61550984353645b4574409`.
- Accepted PR tree and merged-main tree both equal `dc110bdb3d979690e26ae9f38368a095fbd0a555`. Remote main was fetched and read back after merge. The `chore/pf00-ci-foundation` branch remains at the accepted head.
- PF00-D uses `docs/pf00-finalization` from that exact merge baseline. It changes documentation/evidence only and does not authorize PF01 implementation or PF02.

## PR CI evidence

### First attempt — preserved RED

Head: `8ccdcb3c7e1fbba055bdfc5217cb7c3f4a610208`.

- [App checks 35438808876](https://github.com/edward321416-maker/build-manager/actions/runs/35438808876): FAILURE, attempt 1.
- [Repository checks 35438808911](https://github.com/edward321416-maker/build-manager/actions/runs/35438808911): SUCCESS, attempt 1.
- `mobile-health`: FAIL. Expo Doctor 1.20.4 reported 20/21 checks passed and four SDK 57 direct dependency mismatches.
- `foundation-gate`: FAIL, correctly propagating the failed dependency.
- Android/iOS exports: NOT_RUN after Doctor failed.
- Classification: `EXPO_SDK_57_DIRECT_DEPENDENCY_COMPATIBILITY_DRIFT`. This was not a product/Jest/CI wiring defect. No Doctor exclusion, SDK major upgrade, timeout change, or retry of the failed workflow was used.

| Dependency | RED locked version | Accepted GREEN version |
| --- | --- | --- |
| @expo/ui | 57.0.18 | 57.0.19 |
| expo | 57.0.23 | 57.0.24 |
| expo-constants | 57.0.18 | 57.0.19 |
| expo-router | 57.0.21 | 57.0.22 |

The operator separately authorized these four manifest ranges and required transitive lock changes. Cross-platform package keys were derived from the original lockfile: baseline 67, candidate 67, missing 0. Their preservation was rechecked against the merged tree; the count is an observation, not a permanent hard-coded requirement.

### Accepted fresh GREEN

Head: `33d1d77e913692fefb61550984353645b4574409`.

- [App checks 35440280982](https://github.com/edward321416-maker/build-manager/actions/runs/35440280982): SUCCESS, attempt 1, `pull_request`.
- [Repository checks 35440280999](https://github.com/edward321416-maker/build-manager/actions/runs/35440280999): SUCCESS, attempt 1, `pull_request`.
- All eight required checks succeeded. This new-head result preserves rather than replaces the first attempt's failure evidence.

## Actual merged-main CI evidence

The PR result was not promoted to main evidence. New `push` workflows executed on actual main SHA `333228163227d55d13e514fb9311ecb8b9dea615`:

- [App checks 35440841108](https://github.com/edward321416-maker/build-manager/actions/runs/35440841108): SUCCESS, attempt 1, `push` to `main`.
- [Repository checks 35440841105](https://github.com/edward321416-maker/build-manager/actions/runs/35440841105): SUCCESS, attempt 1, `push` to `main`.

| Required check | Accepted PR | Actual merged main | Observed evidence on both |
| --- | --- | --- | --- |
| verify | SUCCESS | SUCCESS | Direct scanner files: 3 + 14 tests; public tree/history; whitespace |
| repository-safety | SUCCESS | SUCCESS | Same scanner inventory guards and public gates |
| apps | SUCCESS | SUCCESS | Shared 21 files / 301 tests; Web 19 files / 256 tests; lint, typecheck, Web build, dependency check |
| mobile-cold-linux | SUCCESS | SUCCESS | 13 suites / 133 tests; zero failed, pending, or todo; fresh cache, no warm retry |
| install-mobile-windows | SUCCESS | SUCCESS | Install/build/dependencies and fresh-cache Mobile: 13 suites / 133 tests; zero failed, pending, or todo |
| web-e2e | SUCCESS | SUCCESS | 21 tests, existing disposable synthetic state and one worker |
| mobile-health | SUCCESS | SUCCESS | Doctor 1.20.4: 21/21, failed 0; Android/iOS export steps actually succeeded |
| foundation-gate | SUCCESS | SUCCESS | Each of its six dependency results was explicitly `success` |

Node v24.21.0 and bundled npm 11.19.0 were checked in every Node job. Linux jobs use `ubuntu-24.04`; the Windows job uses `windows-2025`. Successful installation guards found no tracked manifest/lock drift. Root lock SHA-256: `b2e6eafb994e39e8f964653d460b0a0df85fea1930f0db9aa83beb0ecce47071`.

The actual main public gate reported 284 indexed files, 90 internal links, 559 reachable history blobs, zero findings. These regex/public-tree checks are not a comprehensive security or privacy audit.

Both actual export commands ran after Doctor passed and generated **29 Android files / 25 iOS files** in fresh runner-temporary destinations. This is JS/assets bundle evidence only; no native compilation, device execution, signing, or store readiness is claimed.

Workflow inspection and executed receipts establish `CHECKS_AVAILABLE` and `CHECKS_EXECUTED`. Permissions remain `contents: read`; checkout disables persisted credentials; checkout/setup-node retain the reviewed full v4 commit pins; PR jobs do not use production secrets or `pull_request_target`. `MERGE_ENFORCED` is unchanged: the aggregate fails closed, but branch-protection enforcement was not added.

## Executor-local evidence

[PF00-A/B acceptance](pf00_ab_acceptance.md) remains accepted executor evidence at baseline `067985d07b1f3aba69b46374f567545b734d4b64`: Windows 11 x64 and Ubuntu 26.04 WSL2 x64, Node24.21.0/npm11.19.0, clean installs/builds/dependency checks, and three independent cold starts plus warm comparisons per lane. PF00-B is `NOT_REPRODUCED_AT_SELECTED_TOOLCHAIN`; root cause remains `NOT_ESTABLISHED`, and no timeout/configuration change was justified.

The later SDK compatibility executor locally recorded npm ci with unchanged candidate bytes, exact direct versions, Doctor 21/21, Shared 301, Web 256, Mobile 133, lint/typecheck/build/dependency success, Chromium E2E 21, and fresh Android/iOS exports with 29/25 files. PF00-D did not independently rerun those application commands locally. Their local receipts remain separate from the fresh GitHub-hosted main evidence above.

Raw receipts/logs remain private. This document contains no local receipt/cache paths or private destination identifiers. Historical append-only events retain their original IDs and timestamps; an event describing an uncommitted checkpoint describes its state at that event's time.

## Independent acceptance evidence

The operator-side independent PF00-C review assessed Git evidence, workflow logs, manifest/lockfile deltas, and CI results, and explicitly accepted PF00-C before authorizing this merge/finalization run. This record attributes that acceptance to the operator; it does not claim an additional independent application rerun by the PF00-D executor.

`CODERABBIT_STATUS=SUCCESS_STATUS` and `CODERABBIT_REVIEW=SKIPPED`. The [actual PR comment](https://github.com/edward321416-maker/build-manager/pull/23#issuecomment-5741256447) states automatic review was skipped because the repository had fewer than 10 stars. A green status is not a completed independent code review.

## Acceptance-case reconciliation

[Canonical cases](../docs/production-foundation/acceptance_cases.json) retain their requirements and evidence provenance:

- C01–C04: `PASS_ACCEPTED_EXECUTOR_EVIDENCE`.
- C05–C09: `PASS_GITHUB_CI` (C07 additionally uses exact workflow inspection; it is not a security certification).
- C10: `PASS_MERGED_MAIN_PUBLIC_GATE` for the implementation/CI publication above.
- C11: `PASS_PF00_D_EVIDENCE_RECONCILIATION` for the current status, workflow, receipt, and open-risk reconciliation.
- C12: `PASS_PF00_C_PUBLICATION` for PR #23's actual main merge, parents, equal tree, preserved branch, and remote readback. It does not assert that the PF00-D documentation PR has been merged.
- F01–F44: `NOT_RUN`, unchanged. PF01 remains `REVIEW_DRAFT`; PF02 remains `NOT_AUTHORIZED / NOT_STARTED`.

## Open risks and completion boundary

- **OPEN_RISK / dependency-security-triage:** npm currently reports 14 moderate vulnerabilities; the `unrs-resolver` install-script warning requires separate review. No audit fix or install-script approval was performed here.
- **OPEN_RISK / ci-supply-chain-maintenance:** the pinned v4 Actions target an older internal Node runtime; GitHub hosted execution forces their action runtime to Node 24. Any action-major upgrade is a separate future task.
- These risks do not retroactively invalidate the observed PF00-C checks. They remain visible before private beta/release.
- PF00 completion means the development and verification foundation is reproducible and its available checks automatically enforce the stated test gates. It does not mean production/launch/real-user readiness, completed security/privacy review, implemented production auth/database architecture, or readiness for actual tenant data.
- Real identity, property/unit/occupancy authorization, production PostgreSQL/auth, privacy operations, and real tenant data remain future work. Synthetic prototype data and JS exports do not establish those capabilities.
- PF00-D finalization is recorded in its documentation branch and requires independent acceptance; final freeze follows that acceptance. No PF01 implementation or PF02 work starts here.
- External Google Sheets/Drive synchronization remains **PENDING**; the [existing event queue](pending_external_sync.md) applies. No external synchronization is claimed.

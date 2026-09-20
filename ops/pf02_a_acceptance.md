# PF02-A PostgreSQL foundation acceptance and main publication

Snapshot: 2026-09-20
POLICY_REF: `08b99623eaec9b654eebeb30854374194ab49233` (main policy read before merge).
IMPLEMENTATION_BASE: `08b99623eaec9b654eebeb30854374194ab49233`.
ACCEPTED_HEAD: `0fa5a9c14c9b57c6362f048b611c0148a3a76132`.
TARGET_REF / PF02_A_MERGE_SHA: `63c619c6bfa451155249ebc458b9d3ac053d0ed7`.

Implementation disposition: **IMPLEMENTATION_VERIFIED / VERIFIED_BY_FRESH_MAIN_CI**.
This evidence-finalization document is a separate PR candidate for independent acceptance; its own merge is not authorized. PF00 stays FROZEN and PF01 stays REVIEW_DRAFT.

## Authority and evidence classification

- **OPERATOR_SIDE_INDEPENDENT_ACCEPTANCE:** the operator explicitly accepted the exact corrected PR #27 head above after independent re-review. This executor does not claim to have performed that operator-side review.
- **REMOTE_GIT_EVIDENCE:** [PR #27](https://github.com/edward321416-maker/build-manager/pull/27) was freshly checked OPEN / NOT_MERGED with the exact head and successful nine required checks, then merged using merge commit and expected-head protection. No squash, rebase, force push or branch deletion was used.
- **ACTUAL_MERGED_MAIN_CI:** new push-to-main workflows on the actual merge SHA passed all nine required checks. Their logs were inspected; PR CI was not promoted into main evidence.
- **EXECUTOR_LOCAL_EVIDENCE / HISTORICAL:** prior native Ubuntu ext4 regression and the first Windows-mounted Ubuntu Mobile failure remain separate historical receipts. No new full local application regression is claimed for this documentation-only phase.
- Raw logs/receipts remain private or in their original GitHub job logs. No local receipt/cache paths, generated database secrets or authentication values are copied here.

The merge commit has exactly these parents, in order:

1. Previous main: `08b99623eaec9b654eebeb30854374194ab49233`.
2. Accepted PR head: `0fa5a9c14c9b57c6362f048b611c0148a3a76132`.

The implementation branch `feat/pf02-a-postgres-foundation` remains at the accepted head. The resulting main tree matches that accepted implementation tree.

## Preserved PR provenance

| Candidate | Evidence | Meaning |
| --- | --- | --- |
| Original `363fd3ddaff08237c480bccaa369b07c2ee219d1` | [App 35461960342](https://github.com/edward321416-maker/build-manager/actions/runs/35461960342), [Repository 35461960290](https://github.com/edward321416-maker/build-manager/actions/runs/35461960290) | Nine CI checks passed, but operator review subsequently found the missing H01/H02 error-path coverage. These results do not prove the corrected candidate. |
| Corrected `0fa5a9c14c9b57c6362f048b611c0148a3a76132` | [App 35489701368](https://github.com/edward321416-maker/build-manager/actions/runs/35489701368), [Repository 35489701438](https://github.com/edward321416-maker/build-manager/actions/runs/35489701438) | Fresh attempt-1 PR CI: nine checks passed; subsequently accepted by operator-side independent re-review. |
| Actual main `63c619c6bfa451155249ebc458b9d3ac053d0ed7` | [App 35491995616](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616), [Repository 35491995683](https://github.com/edward321416-maker/build-manager/actions/runs/35491995683) | Separate fresh attempt-1 `push` / `main` executions on the merge SHA; publication proof. |

CodeRabbit on the accepted PR is **SUCCESS_STATUS / REVIEW_SKIPPED**. Its actual comment says automatic review was skipped because the repository has fewer than 10 stars. It is not independent code-review or acceptance evidence.

## Actual main checks

| Check | Result | Evidence |
| --- | --- | --- |
| verify | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995683/job/106028416182) |
| repository-safety | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416099) |
| apps | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416112) |
| mobile-cold-linux | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416027) |
| install-mobile-windows | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416125) |
| web-e2e | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416105) |
| mobile-health | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416118) |
| postgres-integration | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416097) |
| foundation-gate | SUCCESS | [actual job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028873758) |

The actual `foundation-gate` log reports all seven dependencies as `success`: repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health and postgres-integration. No missing, failed, cancelled or skipped result is counted as success. Branch-protection/merge-enforcement settings were not changed.

## PostgreSQL runtime and regression evidence

Pinned runtime/dependencies remain Node **24.21.0**, npm **11.19.0**, PostgreSQL **18.6**, pg **8.23.0**, @types/pg **8.23.1**, @testcontainers/postgresql **12.1.0**, and node-pg-migrate **9.0.0**. Explicit SQL, no ORM.

Actual [main PostgreSQL job](https://github.com/edward321416-maker/build-manager/actions/runs/35491995616/job/106028416097) ran `npm run test:postgres`: **1 file / 86 tests passed**, zero failed or skipped tests. The log prints PostgreSQL **18.6 (Debian 18.6-1.pgdg13+2)**. Exact numeric proof is the executed `runs the exact PostgreSQL 18.6 server` test in [foundation.test.ts](../tests/postgres/foundation.test.ts), which queries `SHOW server_version_num` and requires **180006**; it is not claimed as a separately printed numeric log line.

| Regression | Actual main evidence |
| --- | --- |
| R27-H01 swallowed SQL error | Executed/PASS: wrapper rejects the server's non-COMMIT outcome and the preceding write is absent. The prior actual-server RED returned false success; that history is retained. No claim is made to preserve the SQL error swallowed by the callback. |
| R27-H01 SAVEPOINT control | Executed/PASS: recovering with ROLLBACK TO SAVEPOINT still allows COMMIT and the write persists. |
| R27-H02 real idle backend termination | Executed/PASS: only a confirmed test-owned runtime PID in the ephemeral container is terminated; a production diagnostic is observed, a replacement backend restores isolated transactions, and the worker exits 0. No global exception suppression or test-only Pool listener masks the production behavior. |
| R27-H02 diagnostic injection | Three separate marker-redaction tests PASS. These injected-event checks do not replace the actual server termination test. |
| F23 concurrency | Backend B is observed waiting on a **Lock** through a third diagnostic connection while A holds its transaction. After A commits, B fails **SQLSTATE 23505** and **exactly one ACTIVE occupancy** remains. This is actual overlap, not sequential insertion. |

## Canonical case promotion

Only the following three cases are promoted in the [canonical registry](../docs/production-foundation/acceptance_cases.json), after accepted implementation merge and fresh actual-main CI:

| Case | Status | Scope proved |
| --- | --- | --- |
| F18 | PASS_POSTGRES_INTEGRATION | Runtime max-1 pool reuse clears transaction-local organization context after commit/rollback; org B and missing context cannot see A. |
| F19 | PASS_POSTGRES_INTEGRATION | Separate non-owner runtime role has no superuser/BYPASSRLS/privileged inheritance or schema CREATE; forced RLS and exact scoped grants are tested with runtime credentials. Migration-owner/admin execution does not substitute for runtime proof. |
| F23 | PASS_POSTGRES_INTEGRATION | Three-backend lock observation, unique-index conflict and one ACTIVE occupancy, as above. |

**F01/F16/F41/F43 remain NOT_RUN.** A-ISO-01, A-TX-01, A-FK-01 and A-ADDRESS-01 pass only as DB prerequisites. Active ORG_ADMIN/application/API behavior, Invitation consumption, application guards and product registration/search are not implemented by this slice. All other unexecuted F cases remain NOT_RUN: **3 of 44 promoted, 41 of 44 NOT_RUN**. C01–C12 statuses and provenance are unchanged.

## Other actual-main gates

- Shared: **22 files / 321 tests**; Web unit: **19 files / 256 tests**.
- Mobile Linux and Windows: **13 suites / 133 tests each**, zero failures/pending/todo, one fresh cache run per hosted lane.
- Web E2E: **21 tests**; lint/typecheck/Web build/dependency checks pass. The existing unused-import lint warning remains.
- Scanner direct files: **3 + 14 tests**; public gate: **304 files / 112 internal links / 612 reachable blobs / 0 findings** at implementation main.
- Expo Doctor **1.20.4**, **21/21** checks; Android/iOS JS/assets exports actually executed with **29 / 25 files**. These are bundle exports, not native builds, signing or device readiness.
- Protected platform lock set: **67 baseline / 67 candidate / 0 missing**, derived from actual lock keys rather than a permanent hard-coded count.

## Preserved Mobile limitation

The first Windows-mounted Ubuntu Mobile run failed **2/133 tests in 2/13 suites**, with 131 tests passing, at the unchanged 5000 ms timeout (tenant ticket loading and initial role navigation; Jest 151.706 seconds). Its pre-run cache state was unrecorded: cold status is **UNKNOWN**. This record is not deleted or reclassified.

The separate exact-head native ext4 lane and subsequent hosted lanes passed. Historical classification remains **TIMEOUT_NOT_REPRODUCED_ON_NATIVE_EXT4 / ROOT_CAUSE_NOT_ESTABLISHED**. Filesystem/transform cost is a hypothesis, not an established cause. No warm retry or timeout/config change replaces the original failure.

## Remaining risks and limits

- **OPEN_RISK / dependency-security-triage:** npm reports 14 moderate vulnerabilities; the unrs-resolver install-script warning remains. Earlier dependency receipts separately attribute protobufjs/ssh2 hooks, optional cpu-features build omission and nested glob deprecation/security warning. No audit fix, script approval or dependency change occurs here.
- **OPEN_RISK / ci-supply-chain-maintenance:** pinned Actions v4 target an older internal Node runtime and hosted execution forces Node24. No Action-major update occurs here.
- **OPEN / LOW:** container startup/cleanup failure injection and concurrent stop are not separately covered; transaction/idle-Pool tests do not close this different-layer limitation.
- PF00 remains FROZEN. PF02-A implementation verification establishes the approved PostgreSQL foundation only; production readiness, security/privacy completion and full authorization behavior are not established.
- `PF01 = REVIEW_DRAFT`; `PF02-B = NOT_STARTED / D01 REQUIRED`. The next permitted activity is a consequential D01 review, not auth implementation.
- `REAL_IDENTITY = NOT_IMPLEMENTED`; `REAL_TENANT_DATA = NOT_AUTHORIZED`; `PRODUCTION_DB_HOSTING = NOT_AUTHORIZED`.
- Existing demo-v1 SQLite behavior is unchanged. Production hosting, real identity/property/unit/occupancy operations and real-data authorization remain future work.
- `EXTERNAL_SYNC = PENDING`; the [existing event queue](pending_external_sync.md) applies. This executor performed no Google write.

Revision **0.7** of the registered production-foundation evidence recomputes all 12 existing manifest entries from final UTF-8 bytes, retaining the entry set and self-exclusion. Historical audits remain intact below the current reconciliation. This documentation PR changes no product code, dependencies, schema, workflow, scanner or tests and remains open for independent acceptance.

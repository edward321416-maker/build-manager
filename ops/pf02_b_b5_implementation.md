# PF02-B/B5 implementation evidence

Status: REVIEW_CANDIDATE / NOT_ACCEPTED. This is executor evidence, not independent review. The original local Mobile failure remains FAILED/OPEN; the later candidate-specific operator exception below permits review-only publication after the public-safety gate.

- POLICY_REF: `211d84ead3e65f328da648d1cc9f3e050c326c1a`.
- Approved plan HEAD: `857b1f409c304c1a4835691352b59a91c5111958`; blob `61f44c6dc50d04e978602cfcd914ba85baba8721`.
- Approved spec blob: `3c33c817236f7b9d3c6a404125f94e48913d7a8f`.
- Implementation authority: [operator receipt 5936216651](https://github.com/edward321416-maker/build-manager/pull/67#issuecomment-5936216651).
- IMPLEMENTATION_BASE_SHA: `397fa5a08897f70ada025a5fde931b9aec1179a9`.
- Branch: `feat/pf02-b-b5-membership-termination`.
- Plan publication merge: `9ee208b996ad945e0e8dea828d3f0e77b6ccbe42`. Base delta from POLICY_REF is docs/ops only; plan and spec blobs preserved.

## Environment preflight

Official Windows x64 Node 24.21.0 ZIP was downloaded from nodejs.org and matched its official SHASUMS256 entry: `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`. Project-isolated executable reports v24.21.0; bundled npm reports 11.19.0; explicit transform-types option launch exits 0. Global runtime/configuration unchanged. This launch is not the later real B5-entry smoke or warning evidence.

Docker Desktop engine 29.8.0 started for disposable synthetic PostgreSQL 18.6 fixtures. `npm ci --ignore-scripts --no-audit --no-fund` completed with 1380 packages and no manifest/lockfile change.

Publication-base hosted CI: Repository 36896269436 and App 36896269307, all nine job conclusions SUCCESS at the base SHA. Conclusions only; not implementation-candidate CI or local Mobile resolution.

## Task 1

PowerShell / isolated Node 24.21.0 / npm 11.19.0 / synthetic PostgreSQL 18.6:

- `npm run test:postgres -- tests/postgres/b5-schema.test.ts tests/postgres/b5-capabilities.test.ts`: initial RED exit 1, 4 failed / 2 files. Existing bootstrap returned no B5 roles; assertion mismatch, not missing import.
- After the allowed bootstrap import/await and additive helper/export: `npm run test:postgres -- tests/postgres/b5-schema.test.ts`: role/attribute/membership assertions pass; missing migration 0010 remains RED (1 failed, exit 1).
- After migration: initial same two-file command exit 0, 4 tests / 2 files PASS.
- Expanded B5 plus frozen B2/B3 capability regression command: 39 passed / 1 failed, 4 files, exit 1. Failure was the new catalog test decoding PostgreSQL `name[]` as a string. Fixed the test query with explicit `roles::text[]`, preserving exact role/equality assertions; no policy change.
- Rerun `npm run test:postgres -- tests/postgres/b5-capabilities.test.ts`: exit 0, 5/5 PASS. Other three files passed in the expanded run: 26 B5 schema/bootstrap/atomicity/frozen-byte tests and 9 B2/B3 capability tests. This is combined scoped evidence, not a claimed all-green rerun of that four-file command.
- `npm run typecheck:tests`: exit 0.

AC14/AC15 evidence is in `tests/postgres/b5-capabilities.test.ts`: exact privileges and policies, real SET ROLE positive mutation and isolated negative statements, history byte preservation, effective-admin user-state positives/negatives and probe visibility. Full AC completion remains pending later tasks.

## Installed driver inspection

Locked and installed pg 8.23.0 / pg-pool 3.14.0 inspected directly:

- `node_modules/pg-pool/index.js:335-344`: release closure assigned, idle error listener removed on checkout.
- `node_modules/pg-pool/index.js:369-397`: release-once guard; idle listener installed before release event and removal/destruction.
- `node_modules/pg-pool/index.js:172-186`: client removed from pool before end callback.
- `node_modules/pg-pool/index.js:51-62`: idle error handler installs repeated-error handling before removing client and emitting pool error.
- `node_modules/pg/lib/client.js:202-228,416-422,781-815`: socket end errors queued work; error event marks client unqueryable; end marks ending and destroys dead/active connections.

No contradiction with the planned persistent listener-through-release handoff was observed. Fake-client repeated-error and real child runtime evidence remain required; source inspection is not that evidence.

## Task 2

- Executable scaffolds produced behavioral RED: application 9 failed/2 passed, transaction 5 failed; both exit 1, no missing-import failures.
- Implemented application validation/session precheck and sanitized error contract, independent B5 transaction wrapper and single-command persistence port.
- Application focused GREEN: 11/11; transaction focused GREEN: 20/20, including real PostgreSQL fixture-side READ COMMITTED probe after the third timeout statement. Persistent repeated-error/release handoff, no post-termination commit/rollback, one release, unknown COMMIT/no retry and SQL-state sanitization are covered.
- `npm run test:shared`: exit 0, 34 files / 432 tests PASS.
- The fixture probe initially hit a TypeScript overloaded-method `.call` type error after passing runtime; corrected to `Reflect.apply` with unchanged SQL/behavior. Final typecheck result is recorded with the task commit.

## Task 3

- HTTP executable scaffold RED: 24 failed, exit 1; route inventory RED: expected 10, received 9. Final HTTP 24 PASS; full Web 459 PASS and shared 432 PASS. Full typecheck and Web build exit 0.
- Actual synthetic Web/PostgreSQL B5 run initially failed all 3 on an overly strict E2E Vary equality: Next adds its existing RSC Vary entries. Corrected only the new browser assertion to require the Cookie token, as the approved contract specifies; unit header equality remains exact. Targeted rerun: 3 PASS, exit 0.
- Full `npm run test:e2e:b1`: 60 PASS, zero failed/skipped/retries, exit 0. Subsequent `node apps/web/tests/b1-e2e/check-results.mjs`: exit 0; exact 60 tests, 21 negative controls. This full report, not the targeted report, was checked.
- B5 browser DB readback covers membership history/version, last-admin, zero mutation on denials, preserved assignments, revocation and unrelated organization/session access. Existing 57 cases remain present and passed.

## Task 4

- Direct real bm_b1_web READ COMMITTED command tests use distinct backend PIDs, pg_blocking_pids and pg_stat_activity. Organization-first waiters have no membership RowShareLock yet. Exact self/cross/staff outcomes and three-admin ENDED/ENDED/LAST_ADMIN are asserted; effective-admin count never reaches zero.
- Initial 14-test run: 13 PASS/1 FAIL because the third queued waiter was checked against the original holder, while PostgreSQL reports the preceding queued waiter. Corrected the fixture observation to B then re-observed B after A commits. No product SQL change.
- Expanded run: 16 PASS/1 FAIL due to a test calling currentActor on the bootstrap-only port. Corrected to the existing session registry port. Final three-file command: 17/17 PASS, exit 0.
- Caller ended/demoted, target ended and organization inactivated during measured lock waits produce exact NOT_FOUND/FORBIDDEN without rewrites. Both controlled B4/B5 commit orders preserve ACTIVE assignment history while frozen access denies the ended membership. Unrelated membership and the same session remain usable.

## Task 5 preliminary evidence

- Actual import graph adds domain/src to the finite persistence/application resolver roots. Initial no-DB native smoke exited 1 with ERR_MODULE_NOT_FOUND: existing domain versioned basenames heating.v1/leak.v1 required explicit finite resolution entries. Corrected only the new B5 worker. No frozen source/export changes.
- Repeated load-only smoke after the identified correction: module-loaded IPC, Node v24.21.0, execArgv exactly [--experimental-transform-types], exit 0. Parent captured stderr privately and retained only warningPresent=true, category ExperimentalWarning, no warning code. No raw stderr/stack/path retained. Warning count is not the oracle.
- Native active and idle-after-command failures both observed 25P04, sanitized DEPENDENCY_UNAVAILABLE, command once, zero COMMIT/ROLLBACK, exactly one release(true), terminated backend absent, different healthy replacement backend, unchanged membership history and child exit 0. Production 2000/5000/7000ms budgets unchanged.
- Full B5 timeout file: 10/10 PASS, exit 0, including actual 55P03, 57014, 40P01, 23514, 22003 and unknown COMMIT before/after delivery with fresh-state readback. Fixture-only privileged deadlock_timeout selects the product connection as victim; no production timeout override.
- Architecture/canonical frozen inventory: 53 existing files plus persistence manifest equal to base except the approved ./b5 export. Shared tests 435/435 across 35 files; test typecheck exit 0. Exact Git-byte exclusion check remains a final candidate gate.

## Task 6 initial stop receipt (historical, failure retained)

Task5 bounded integration RED (recorded before editing the additional path): targeted B1–B5 regression exited 1, 208 PASS/1 FAIL across 27 files. `tests/postgres/b1-capabilities.test.ts:62` applies the legacy B1 owner/search_path oracle to every authn function except B4. New B5 commands intentionally have distinct owners and pg_catalog,pg_temp. Under approved plan section 3's RED-proven additional integration exception, exclude exactly the three new B5 function names from this legacy query, retaining every existing B1 assertion/negative control. Exact B5 owner/config/ACL remains asserted by b5-capabilities.test.ts. This test path is not one of the frozen sources; no implementation or old migration is changed.

After the bounded inventory correction, `npm run test:postgres -- tests/postgres/b1-capabilities.test.ts tests/postgres/b5-capabilities.test.ts`: exit 0, 11/11 PASS across 2 files. The other 25 files passed in the original run. This is combined scoped regression evidence, not a claim that the entire 27-file command was rerun green. Scanner regression tests: 3/3 and 14/14 PASS, exit 0.

Native Windows / isolated Node v24.21.0 / npm 11.19.0, fresh unique Jest cache:

- `npm run test:mobile -- --cacheDirectory <new-private-cache> --json --outputFile <private-result>`: exit 1; 13 suites (12 passed, 1 failed), 133 tests (132 passed, 1 failed), zero pending/todo. Failure: `apps/mobile/src/features/tenant/tenant-ticket.test.ts:78`, `tenant ticket — loading loads the ticket named by the route`, exceeded unchanged 5000ms timeout.
- Mobile files, root manifest/lock and workflows have zero diff from IMPLEMENTATION_BASE_SHA. This is current local failed evidence, not a proven B5 regression or a resolved historical risk. ROOT_CAUSE_NOT_ESTABLISHED. Previous accepted Mobile exceptions are historical and are not silently extended to B5.
- Per operator handoff section 7, a mandatory-check failure requires stopping with evidence. No warm retry, timeout increase, Mobile edit, frozen edit or pass-through-hosted substitution was performed. Candidate freeze, push, Draft PR and new hosted CI remain NOT_PERFORMED / NOT_RUN.
- Other completed final checks: lint exit 0 (existing unused imports in B3 Web and Mobile tests remain warnings); full typecheck exit 0; `npm run test:e2e:web` exit 0, 23/23 PASS. Task3 build/Web/60-browser evidence remains valid for unchanged product source; not represented as a new rerun.
- Git filtered blob comparison against base: 53 frozen inventory paths, zero mismatches, including migrations 0001–0009, frozen application/persistence, R27-H02 worker/foundation, Web startup, migration runner, manifests/lock/workflows. Approved plan and spec Git blobs still exactly match the pinned approved blobs. Architecture hash assertions also passed.
- Full `npm run test:postgres`, `npm run check:deps`, local Expo Doctor/exports, local Linux cold Mobile and implementation exact-head nine-job gate: NOT_RUN at this stop. The collected targeted B1–B5 result above is not full foundation coverage.

## AC evidence index (executor evidence; no acceptance promotion)

Commands: P1 = Task1 schema/capability runs; P2 = Task2 transaction run; P4 = the three Task4 PostgreSQL files (17 PASS); P5 = b5-timeout.test.ts (10 PASS); W = actual b5.spec.ts (3 PASS), full B1 suite (60 PASS) and exact result checker; A = shared architecture suite (435 PASS total).

| AC | Evidence file and observed command/result |
| --- | --- |
| AC01 | b5-boundary.test.ts and b1-boundary.test.ts; A PASS, exact individual route only |
| AC02 | b5-membership-termination.test.ts; P4 PASS, admin success/staff FORBIDDEN |
| AC03 | b5-membership-termination.test.ts, b5.spec.ts; P4/W PASS, missing/foreign/ended NOT_FOUND and no mutation |
| AC04 | b5-membership-termination.test.ts; P4 PASS, preserved identity/history and exactly one version increment |
| AC05 | b5-membership-termination.test.ts; P4 PASS, admin termination with effective peer |
| AC06 | b5-membership-termination.test.ts; P4 PASS, sole/SUSPENDED/DELETION_PENDING peer denial |
| AC07 | b5-concurrency.test.ts; P4 PASS, observed distinct backend/lock queue and exact ordered business results |
| AC08 | b5-concurrency.test.ts; P4 PASS, caller-ended NOT_FOUND and caller-demoted FORBIDDEN |
| AC09 | b5-concurrency.test.ts; P4 PASS, target-ended no rewrite and inactive-org return |
| AC10 | b5-revocation.test.ts; P4 PASS, both B4/B5 commit orders and preserved assignment bytes |
| AC11 | b5-revocation.test.ts, b5.spec.ts; P4/W PASS, foreign membership unchanged |
| AC12 | b5-revocation.test.ts, b5.spec.ts; P4/W PASS, same session and unrelated-org access maintained |
| AC13 | apps/web/src/server/b5/http.test.ts (24 PASS), b5.spec.ts; W PASS, precedence/body/cache/non-disclosure/readback |
| AC14 | b5-capabilities.test.ts; P1 PASS, exact catalog/ACL and effective-admin helper positives/negatives |
| AC15 | b5-capabilities.test.ts; P1 PASS, real SET ROLE behavior and unchanged-row negative controls |
| AC16 | b5-transaction.test.ts (20 PASS), b5-timeout.test.ts and real b5-timeout-worker.ts; P2/P5 PASS, real load/phase/25P04/replacement and COMMIT uncertainty |
| AC17 | b5-boundary.test.ts; A PASS; 53 base Git blob comparisons PASS |
| AC18 | P1/common bootstrap and unchanged Web setup/W PASS; prior targeted208/209 and corrected11/11 retained; resumed full PostgreSQL295/295 PASS; local Mobile FAILED; exact-head nine-job receipt recorded separately in Draft PR |
| AC19 | Explicit authority/base, initial stop and candidate-specific review-publication exception recorded; original five commits preserved; fixed candidate CI/independent review gate tracked in Draft PR, Ready/merge unauthorized |

## External bookkeeping readback

Native Google Docs revision-guarded rolling handoff update: 18 exact-text replacements, fresh readback confirmed implementation base/current task; subsequent stop-state update was also read back. Native Google Sheets append: current Task1–4 and Task5 preflight summaries read back at AI_Execution_Log A141:D145; mandatory local-Mobile stop event separately appended/read back at A146:D146. No raw errors/configuration/private IDs published. Historical pending entries remain historical; new readback does not clear unrelated backlog. Final local checkpoint SHA and focused inventory result are synchronized after the checkpoint commit, without implying a remote implementation branch.

## Remaining gates

The operator subsequently authorized bounded diagnosis, remaining verification and conditional Draft publication for this candidate despite unresolved local Mobile timeout. This supersedes the publication stop only; it is neither a failure waiver nor acceptance. B5PDR2-L01 implementation handling is evidenced by the real smoke above; independent disposition remains for the fixed-head reviewer. B5D2-L02 and prior B3/B4/Mobile risks remain. F15/F25/F39/F43 are not promoted.

Current external preflight summary and authorization handoff were written through Google Drive native Sheets/Docs actions and read back. The preflight Sheet timestamp is checkpoint metadata, not measured exact operation timing. Historical sync backlog remains separate; no private destination IDs or raw inputs are published.

NEXT_GATE: FIXED_HEAD_WHOLE_IMPLEMENTATION_REVIEW after fixed implementation candidate and nine required CI jobs. Implementation PR Ready/merge: NOT_AUTHORIZED / NOT_PERFORMED.

## Resume authorization and bounded Mobile diagnosis

The operator explicitly authorized preservation of base `397fa5a08897f70ada025a5fde931b9aec1179a9`, checkpoint `186843f6a7ff0881645ab0824a7d1fb4fb6bb24b` and all five existing commits; bounded diagnosis of this failure only; completion of remaining checks; then push/Draft PR for review if other applicable local and public-safety checks pass. Unresolved local Mobile timeout alone no longer forbids this candidate's review publication. No repeated plan approval, history rewriting, timeout increase, skip, weaker assertion, CI relaxation or repeat-until-green is authorized. Ready/merge/production/real data remain unauthorized. Live main is still the fixed base; pinned POLICY_REF and live-main AGENTS/delivery/project-policy blobs match.

The debugging-wizard skill was applied for evidence/hypothesis separation. The original failed HEAD-side execution is reused, not rerun: Windows PowerShell, isolated Node v24.21.0/npm 11.19.0, dependency installation `npm ci --ignore-scripts --no-audit --no-fund`, root command `npm run test:mobile -- --cacheDirectory <fresh-unique-private-cache> --json --outputFile <private-result>`. The root script passes `--runInBand`; the cache path was checked absent before launch. Exact expanded command/cache path and raw result remain in the private original log/JSON. Original log SHA256 `89cf7bf22e0e22943fc8453e0404d85eb9c81ee853589b402be04cf041743ac4`; original JSON SHA256 `432668b919dbdb48702d68f2a318939f83de3ca94a8e4e1614cc453d518c55a3`.

The original execution occurred before the final checkpoint commit, with Task5 test/evidence work in progress. The checkpoint's Mobile files, direct runtime graph and configuration are unchanged from that execution; this justifies reusing its Mobile result, not claiming the original whole working tree was a clean checkout at checkpoint SHA.

BASE vs checkpoint inspection:
- `apps/mobile`, `packages/api-client`, `packages/domain`, `packages/fixtures`, root/mobile manifests, lockfile and TypeScript base configuration: no changes.
- Mobile imports api-client and api-contracts. api-client imports runtime schemas from api-contracts. The direct shared-graph delta is the additive `api-contracts/src/b5.ts` strict Zod error schema and its index export. It has no timer/network/DB action. Application B5 additions are not a runtime dependency of this inspected Mobile/api-client/contracts graph. This inspection does not prove performance equivalence.
- A separate detached BASE worktree used the same isolated Node/npm, same installation flags and unchanged lock/configuration. One full fresh-cache Mobile run was performed at BASE; no warm retry or repeated HEAD run. Private environment receipt records exact base, cwd, runtime, command and new absent cache path.
- Subsequent read-only `--showConfig` outputs match after normalizing worktree path and per-run id/seed. These are current default configuration observations, not retroactive captures of every original process setting. Both actual test commands explicitly used runInBand and fresh cache directories.

| Execution | Suites | Tests | Result | Failing test |
| --- | --- | --- | --- | --- |
| Original HEAD-side result, reused | 12 PASS / 1 FAIL | 132 PASS / 1 FAIL | exit 1 | tenant ticket loading: loads the ticket named by the route; unchanged 5000ms limit; measured test duration 6072ms |
| BASE single cold comparison | 12 PASS / 1 FAIL | 132 PASS / 1 FAIL | exit 1 | same test title/5000ms timeout; measured test duration 5611ms |

Both executions have zero skipped/pending/todo tests. BASE result JSON SHA256 `ee611a60a15b7290d6208386616c6835e7428dd944ea97596d9fb0c2012339f3`. Wall-clock time, system load and file-system/cache conditions beyond the fresh Jest directories were not experimentally controlled. The same symptom on both refs is not proof of identical cause or non-regression. Additional schema transform cost/system-load hypotheses remain unproven. No B5 regression is established by this bounded evidence; **ROOT_CAUSE_NOT_ESTABLISHED / LOCAL_MOBILE_FAILED / OPEN** remains. Historical B3 diagnostics were not repeated.

## Resumed verification receipts

All local commands use the isolated pinned runtime. Product/test changes since checkpoint: none; resumed changes are evidence/ops only. Earlier valid shared435/Web459/typecheck/lint/build/B5 browser3/full60-checker and demo Web E2E23 results are retained, not relabeled fresh runs.

- `npm run test:postgres`: fresh full suite after the B1 catalog correction, exit 0, **295/295 tests across 28/28 files PASS**, duration 515.67s. This includes all B1–B5 and frozen foundation tests; prior failed/partial runs remain historical evidence.
- `npm run check:deps`: exit 0; installed React/React DOM/React Native/Expo trees checked.
- `npx --yes expo-doctor@1.20.4 --version`: exact 1.20.4, exit 0. `npx --yes expo-doctor@1.20.4 .` in apps/mobile: 21/21 PASS, exit 0.
- With scoped `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000`, `npx expo export --platform android --output-dir <fresh-private-dir>` and corresponding ios command: both exit 0, non-empty exports of 29/25 files. These are JS/assets exports, not native device builds.
- Native Linux cold Mobile and hosted Windows cold Mobile remain separate hosted workflow evidence; no local Linux execution is claimed.
- Fresh public index/reachable-history scan and exact candidate nine-job CI remain publication gates. Required jobs: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate. Exact fixed HEAD/run IDs and post-freeze CI receipts belong in the Draft PR body/comment and rolling handoff so recording them does not mutate the reviewed HEAD.

Resume/diagnosis external receipts: native Google Docs revision-guarded resumed-state update and fresh readback succeeded; Google Sheets events were appended/read back at A150:D151. Existing coordinator rows A148:D149 were preserved. No custom plugin was downloaded, so no new downloaded-schema cache artifact is required. Historical external backlog is not cleared. Detailed private logs and hashes remain outside the public repository; only sanitized summaries are published.

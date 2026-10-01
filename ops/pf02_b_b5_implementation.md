# PF02-B/B5 implementation evidence

Status: IN_PROGRESS / NOT_ACCEPTED. This is executor evidence, not independent review.

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

## Remaining gates

Tasks 3–6 and AC01–AC19 full completion: NOT_RUN / NOT_VERIFIED beyond the scoped evidence above. B5PDR2-L01 remains OPEN_NON_BLOCKING / IMPLEMENTATION_PREFLIGHT. B5D2-L02 and prior B3/B4/Mobile risks remain. F15/F25/F39/F43 are not promoted.

Current external preflight summary and authorization handoff were written through Google Drive native Sheets/Docs actions and read back. The preflight Sheet timestamp is checkpoint metadata, not measured exact operation timing. Historical sync backlog remains separate; no private destination IDs or raw inputs are published.

NEXT_GATE: FIXED_HEAD_WHOLE_IMPLEMENTATION_REVIEW after fixed implementation candidate and nine required CI jobs. Implementation PR Ready/merge: NOT_AUTHORIZED / NOT_PERFORMED.

# Manager Work Queue v1 execution evidence

POLICY_REF: `e9144fac807f39544932baac25b11f836658dbb3` (live main and all three policy blobs verified).
IMPLEMENTATION_BASE_SHA: `2c84291e9f06d506b1312ef8119f9155af91e986`; descendant of remote `c32890e`, preserving the local UI implementation. Existing five uncommitted runtime-record paths are retained. Product paths were clean at entry.

Authority: operator's immediate execution instruction and `ASTRA_RC1_MANAGER_WORK_QUEUE_IMPLEMENT_NOW.md`. Same branch and Draft PR70; no Ready/main merge/deployment or further account work.

Implementation sequence: behavioral HTTP RED; additive migration0015 with manager-only capabilities, separate contracts and transaction methods; existing Web queue/detail integration; focused PostgreSQL/API/browser privacy and concurrency checks; combined-candidate regressions, public/history scan, normal publication and exact-head nine required jobs. No changes to migrations0001–0014, tenant ticket DTO, B1–B5 semantics or existing shared events. Internal notes remain separate, append-only and manager-only. Ticket-row locking serializes metadata against handling completion and expectedVersion prevents lost updates. The existing session/org/property capability chain remains authoritative on every operation.

Skills: Fullstack Guardian security checklist and Playwright Expert selectors/autowaiting, reused without installation. New design approval or separate review handoff is not required by the operator. Execution results below are appended as measured; current status IN_PROGRESS.

## Local execution, 2026-10-04

Environment: Windows PowerShell, project-isolated Node24.21.0/npm11.19.0, locked dependencies, Docker PostgreSQL18.6. Browser fixtures and screenshots are synthetic. Actual Auth0 manager authentication is not claimed or required for this service-content slice. No account/provider settings changed. Expo/native/device execution was not attempted.

Behavioral RED: four new HTTP tests exercised the existing handler and failed on absent manager routes (404 instead of authorized success/denial). All four pass after implementation. No timeout, skip or existing expected behavior was weakened.

| Command / check | Result (exit0 unless noted) |
| --- | --- |
| `npm run test:postgres -- tests/postgres/core-manager-work.test.ts` | 12 tests / 1 suite: defaults, exact capabilities/RLS, tenant/foreign/unassigned denial, B5/B4 revocation, completion immutability, concurrent optimistic writes and private projection |
| `npm run test:postgres` | 342 tests / 33 suites; complete PostgreSQL regression |
| `npm run test:web` | 493 tests / 44 suites at execution; final focused HTTP + ordering run: 6 tests / 2 suites |
| `npm run test:shared` | 440 tests / 37 suites |
| `npm run test:mobile -- --cacheDirectory=<fresh-private-cache> --json --outputFile=<private-result>` | 142 tests / 16 suites; fresh candidate run, 0 skipped/todo, 36.863s. Historical B5 failure / AC18 PARTIAL unchanged |
| `npm run lint` | PASS; existing Web4 / Mobile1 warnings, no errors |
| `npm run typecheck` | PASS, including new browser fixtures |
| `npm run build:web` | PASS, including preserved manager unit selector |
| `npm run check:deps` | PASS |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core.config.ts` | 13 passed; final35.2s, no retries; existing photo/onboarding/core cases + new queue case |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core-login.config.ts` | 19 passed, 40.3s; B1 synthetic SDK session, org/CSRF/private API and UI |
| `npm run test:e2e:web`, existing `BUILD_MANAGER_E2E_PREBUILT=1` | 23 passed, 23.6s |
| `npm run test:e2e:b1` | 60 passed, 43s |
| `node apps/web/tests/b1-e2e/check-results.mjs` | full report: expected60, skipped0, retries0, negativeControls21 |
| `node scripts/core-manager-work-restart-check.mjs` | PASS on both saved browser cases: distinct owned server PIDs, identical work/note/ticket/photo readbacks, tenant manager reads403 |
| Repository scanner unit checks | root3 and scripts14 passed |
| `python scripts/verify_repository.py --history`, backend staged candidate | PASS: files576 / links280 / history blobs1458 / findings0; final combined index scanned separately before publication |

All attempts remain in private numbered logs01–37. Browser runs use copies of existing fixture state under a process-only test home, the same marked persistent database and renewed development sessions. No credential, raw identity or private destination is published.

Retained failures and corrections:

- Initial PostgreSQL setup failed before execution because a fixture parameter had ambiguous uuid/text types; explicit casts fixed it. Early TypeScript/build failures were missing client return generics; later typecheck/build passed.
- Core browser attempt1: 12 passed / 1 failed; new locator corrected to accessible combobox role. Attempt2: 10 passed / 3 failed; two existing cases encountered codes revoked by the prior suite, and a new ordering assertion ran before list load. Fresh session preparation and a state-based assertion fixed these causes. Attempt3 and final attempt: 13 passed each. No success-until-retry loop.
- B1 core attempt1: 14 passed / 5 failed. A real regression removed the existing manager unit selector. Product selector restored with all authorized units as default; unchanged five tests pass in final19.
- Additional exact ACL assertion initially had 11 passed / 1 failed because the driver returned a `name[]` as text. Casting catalog names to text preserves the exact assertion; final12 passed.

## Actual browser and preservation evidence

Three new synthetic tickets demonstrate different status/priority/deadline combinations. The browser saves metadata, exercises stale409 without overwrite, appends and reloads a private note, checks filters/order, reads the attached photo, records handling, and verifies completed work and notes reject writes. SQL tests cover assigned staff and membership/assignment revocation.

Actual desktop1440 and width390 screenshots show the manager queue and private detail. Width390 controls stack without horizontal overflow. Tenant detail includes the stored photo and shared handling history but excludes priority, assignee and internal memo. DOM absence is supplemented by tenant API projection checks and all three manager GETs returning403. Private screenshot names: `manager-queue-desktop.png`, `manager-queue-390.png`, `manager-queue-cards-390.png`, `manager-work-detail-desktop.png`, `manager-work-detail-390.png`, `tenant-ticket-390.png`.

Existing rows were fingerprinted before runtime work across13 identity/organization/membership/property/unit/occupancy/assignment/ticket/event/photo/invitation tables. Readback after regressions found zero existing rows changed/missing per table; only synthetic fixture rows were added. Final readback and publication receipts are appended to execution logs/PR without replacing this evidence generation. Only outstanding migration0015 was applied to the marked persistent DB. Migrations0001–0014 and existing photo ownership remain unchanged.

## Concurrent work and publication boundary

After task entry, another active UI writer added opt-in styles in `core-design.module.css` and created `ui/core-display.tsx` / `ui/core-display.test.tsx`. The operator confirmed work remains in progress. These three files are preserved and excluded from this task's commits. Their components are not imported by the runtime; this queue uses its own stylesheet. The committed presentation base2c84291 is included in candidate checks. Existing dirty runtime records remain local and are not swept into feature commits.

Same Draft PR70 remains NOT_ACCEPTED / NOT_MERGED. The subsequent PR execution receipt identifies the exact published SHA and nine hosted job/run conclusions; local checks above are not a hosted9/9 claim. AC-D06 remains NOT_VERIFIED; desktop acceptance, prior actual-manager account constraint, and Expo host restriction remain unchanged. No Ready/main merge/deployment is performed.

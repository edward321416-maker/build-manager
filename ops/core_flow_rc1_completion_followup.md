# Completion confirmation and follow-up v1 execution evidence

Current integration receipt: [verified local integration and publication checks](#final-ui-integration--2026-10-04). Exact-head hosted CI is recorded after candidate fixation.

Backend-phase snapshot retained below — Date: 2026-10-04. Status then: **COMPLETION_CONFIRMATION_FOLLOWUP_V1_BLOCKED** at Web integration, not a new approval gate.

## Authority and preserved work

The operator dispatched `ASTRA_RC1_COMPLETION_CONFIRMATION_FOLLOWUP_V1_IMPLEMENT_NOW.md` and authorized bounded implementation, tests, commits, normal push and the existing [Draft PR70](https://github.com/edward321416-maker/build-manager/pull/70). The subsequent operator reply confirms that a concurrent UI writer remains active and directs continuation on nonoverlapping backend work. No Ready, merge, deployment, Auth0 expansion, Expo retry or Unit Maintenance Fact Timeline is authorized.

- POLICY_REF/main: `e9144fac807f39544932baac25b11f836658dbb3`.
- START_HEAD: `5032e9b3d080cfcfe4148819f5138e47679298e0`.
- Concurrent presentation commit observed: `d27247fae77cda37bd092cf4bb31ef1c6bd09663`, a direct child of START_HEAD. Its 24 UI/browser paths and presentation receipt are preserved; a commit alone is not a writer handoff.
- Backend checkpoint: the commit containing this receipt and its 15 named backend/contract/test paths. The exact backend SHA is recorded after commit in the local execution receipt; it is not the final integrated IMPLEMENTATION_HEAD. Isolated outcome/recovery UI drafts remain outside this checkpoint. No final exact-head CI exists yet, and the concurrent presentation commit does not contain this feature.
- Branch: `feat/core-flow-rc1`, existing workspace. No reset, rebase, stash, force push or bulk staging.

The initial five dirty runtime records were byte-identical at the backend verification checkpoint. Subsequent task-log additions are append-only and excluded from a candidate until separately reviewed. Existing rows in all 17 baseline tables, including ticket/photo/Q&A records, remain present with their original row fingerprints. Other concurrent synthetic runs added rows, so whole-table equality is not claimed. No existing development data was modified by this backend phase. Migrations 0001–0016 remain byte-identical.

## Implemented backend

Additive migration [0017](../packages/persistence-postgres/migrations/0017_core_ticket_outcome_followup.sql) stores immutable outcome assertions and one direct source-to-target relation. Source ticket rows, events, work metadata, notes, conversation and photos are never updated by an outcome command. Historical RESOLVED remains separate from a subsequent RECURRENCE_CLAIM. Managers have read-only projections; current tenant ownership, unit authority and manager assignment ceilings are rechecked.

The [application concern](../packages/application/src/core-ticket-outcome.ts), [adapter](../packages/persistence-postgres/src/core-flow.ts), [strict contracts](../packages/api-contracts/src/core-ticket-outcome.ts), [typed client](../packages/api-client/src/core-ticket-outcome.ts) and [HTTP handler](../apps/web/src/server/core-flow/http.ts) are connected. Existing normal intake domain logic builds a fresh target; source text, protocol answers, photos, conversation and notes are not copied.

`create_ticket_follow_up(..., NULL)` first authorizes, locks and rechecks without writes. The adapter holds that source lock inside the same existing transaction, constructs the fresh domain Ticket, then invokes the command with that Ticket. Target, normal CREATED event, assertion and relation commit together. There is no intermediate commit or automatic retry. Saved exact requests are checked before the one-target guard so a successful replay can return its original target. Changed payload/source returns409; new conflicting requests return409.

New public routes under `/api/v2/core`:

- GET `tickets/:id/outcome`.
- POST `tickets/:id/outcome/resolved`: first201, exact replay200.
- POST `tickets/:id/follow-up`: first201, exact replay200.
- GET `tickets/:id/outcome/requests/:key`: own saved receipt, no request body.
- GET `tickets/:id/follow-up`: authorized neutral source ID only.

Existing Origin, B1 CSRF/session, developer transport, strict query parsing and private/no-store behavior remain. Both new tables use FORCE RLS with an organization ceiling. The nine exact functions use the existing owner and `search_path=pg_catalog`; four private helpers have no runtime EXECUTE. Runtime roles have no direct table privileges.

Isolated outcome/recovery components exist and pass focused checks, but **are not wired into either active screen**. Metadata recovery stores only source ticket ID, request UUID and claim kind. It does not persist description or photos and does not automatically resend a mutation. No actual new Web flow or screenshot is claimed.

## Commands and results

Environment: Windows, isolated official Node24.21.0, npm11.19.0, local synthetic Docker PostgreSQL18.6. Tests use independently provisioned fixture databases; existing development server, shared build and concurrent UI/browser tests were not restarted or overwritten. Logs remain in the private task evidence directory; raw settings, identities and request content are not public artifacts.

| Command / scope | Exit and observed count |
| --- | --- |
| `npm run test:postgres -- tests/postgres/core-ticket-outcome.test.ts tests/postgres/core-ticket-communication.test.ts tests/postgres/core-flow.test.ts` | 0;43 tests/3 files |
| `npm run test:postgres` | 0;377 tests/35 files;467.57s |
| `npm run test:shared` (final backend/client tests) | 0;447 tests/40 files |
| Web outcome HTTP, existing B1 guard, isolated recovery and summary tests | 0;15 tests/4 files |
| `tsc -p tsconfig.packages.json --noEmit` | 0 |
| `npm run typecheck:tests` | 0 |
| `tsc -p apps/web/tsconfig.json --noEmit --incremental false` | 0; no shared incremental cache write |
| focused ESLint on six owned Web files | 0;0 errors/warnings |
| `npm run check:deps` | 0; installed dependency graph unchanged |
| `git diff --check` | 0; pre-existing mixed-log CRLF notices retained |

This is workspace evidence, not a final immutable candidate. Full Web/Mobile/build/verify/browser checks, actual owned-server restart, screenshots and exact-head9CI are **NOT_RUN_THIS_SLICE** pending integration. Earlier5032e9b results remain historical only.

Initial failures are retained: HTTP behavioral RED4 and PostgreSQL table RED1; additive catalog inventory mismatch in the first combined regression (41 pass/1 fail), corrected by extending exact lists without deleting old controls; PostgreSQL test-helper UUID type inference; client return-type RED5 corrected by explicit DTO generics; synthetic B1 fixture incorrectly used a3300-second transport lifetime, corrected to the existing exact3600-second contract; two new HTTP test typing errors and isolated component effect lint failure, corrected without changing frozen guards or weakening expectations. A private scan-setup helper attempted unavailable runtime environment access; the unintended read-only historical scan was cancelled and the isolated-index setup was corrected. Re-execution followed concrete fixes; no skip, timeout increase, warning suppression or success-only reporting.

## Acceptance evidence map

`DB` below means [the new PostgreSQL suite](../tests/postgres/core-ticket-outcome.test.ts). `HTTP` means [the new handler suite](../apps/web/src/server/core-flow/ticket-outcome.test.ts). These are self-checks, not an independent review or actual browser evidence.

| AC | Backend evidence and remaining runtime status |
| --- | --- |
| 01 | DB RESOLVED/manager read/source hash PASS; actual outcome card NOT_VERIFIED |
| 02 | DB same request returns one assertion/same result PASS |
| 03 | DB observed source-lock exact concurrent replay PASS |
| 04 | DB OPEN/IN_PROGRESS deny both mutations PASS |
| 05 | DB + HTTP admin/staff writes denied PASS |
| 06 | DB co-occupant, other tenant and replacement denial PASS |
| 07 | DB other-organization source nondisclosure PASS |
| 08 | DB staff assignment removal denies outcome and relation reads PASS |
| 09 | DB UNRESOLVED target/CREATED/assertion/relation and forced rollback PASS |
| 10 | DB RECURRENCE_CLAIM atomic path PASS; actual claim wording NOT_VERIFIED |
| 11 | DB rich source with old answer/photo/Q&A/note yields fresh target/default work PASS |
| 12 | DB new target photo belongs only to target PASS; actual upload UI NOT_VERIFIED |
| 13 | DB seven source-table fingerprint sets unchanged PASS |
| 14 | DB second direct follow-up denied/no second target PASS |
| 15 | DB same follow-up request returns same target PASS |
| 16 | DB same key changed text/issue/kind/source denied PASS |
| 17 | DB observed lock races, one target maximum and no orphan PASS |
| 18 | DB historical RESOLVED retained then recurrence/latest projection PASS |
| 19 | DB RESOLVED then UNRESOLVED denied PASS |
| 20 | DB follow-up then RESOLVED denied PASS |
| 21 | DB forged location/target/content denied, relation constraints and RLS PASS |
| 22 | DB subsequent transaction readback PASS; browser refresh NOT_VERIFIED |
| 23 | Owned-server restart NOT_RUN; later transaction read is not restart proof |
| 24 | DB actual occupancy turnover and lock-wait authority recheck PASS; actual Web NOT_VERIFIED |
| 25 | DB/strict contract neutral source context and current source/target authorization PASS; navigation UI NOT_VERIFIED |
| 26 | Full PostgreSQL Q&A/completion guard regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 27 | Full PostgreSQL work queue regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 28 | Full PostgreSQL photo regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 29 | Full PostgreSQL handling regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 30 | Shared/DB normal protocol and safety intake PASS; actual browser protocol NOT_VERIFIED |
| 31 | Actual390px NOT_RUN |
| 32 | DB saved replay, typed-client no retry and metadata-only helper PASS; actual response-loss UX NOT_VERIFIED |
| 33 | HTTP exact Origin/B1 CSRF, session expiry, strict inputs,201/200 and private projection PASS |
| 34 | Final public candidate/history scan NOT_VERIFIED until candidate fixation; bounded phase scan recorded separately |

Concurrency tests observe backend PIDs and actual PostgreSQL lock waits in controlled READ COMMITTED transactions. Cases cover same/different resolved keys, same/different follow-up keys, both resolved/follow-up orders, resolved-before-recurrence, a shared request across two sources, and revocation while waiting. Rollback tests fail final relation insertion and abort the outer port operation; no target or receipt survives either failure.

## Remaining integration boundary

The operator explicitly confirmed the UI writer is active. Preserve its committed and subsequent local work. After an actual handoff, reread both screens and integrate only bounded outcome/fresh-intake/recovery controls, including session/organization/logout cleanup. Then execute synthetic browser flows, source/target navigation, response-loss recovery, turnover, owned restart,390px and prior browser regressions. Freeze the final candidate, scan public code and reachable history, normally push/update Draft PR70 and verify all nine exact-head hosted jobs. A presentation commit alone does not authorize overwriting an active writer.

Existing3130 runtime remains its prior build; these new controls are not available there. No fresh launch claim is made. AC-D06 NOT_VERIFIED, historical B5 Mobile/AC18 PARTIAL, existing desktop verdict, actual-manager Auth0 constraint and Expo/native/device/APK NOT_RUN remain unchanged. Ready/merge/deploy: NOT_PERFORMED.

CHECKPOINT | Completion follow-up backend verified; UI handoff pending | evidence=0017 + PostgreSQL377/35 + shared447/40 + HTTP/helper15/4 | tokens=unknown


## Final UI integration — 2026-10-04

This successor execution supersedes the earlier integration block above. The operator supplied `ASTRA_RC1_COMPLETION_FOLLOWUP_FINAL_INTEGRATE_NOW.md`, confirmed `UI_WRITER_HANDOFF_READY`, and separately approved including the four additional local presentation deltas. No new approval/review gate was introduced.

START_HEAD/UI checkpoint: `09bbd6ab87b468d0aa3eed51e04dbdf0578118d8`. Backend checkpoint `c374f4c189c37a9bf32244723f08691b193c3371` is its ancestor. POLICY_REF/base remains `e9144fac807f39544932baac25b11f836658dbb3`; pre-publication remote PR70 head remains `5032e9b3d080cfcfe4148819f5138e47679298e0`. Both existing commits and all prior history are retained. The exact final commit/CI receipts belong in the Draft execution receipt and rolling handoff after fixation.

### Product behavior

- The [outcome card](../apps/web/src/app/core/ticket-outcome.tsx) follows the current ticket summary. Loading and read errors do not imply UNCONFIRMED. Tenants see the three distinct assertions; authorized managers see read-only tenant wording. RESOLVED permits only a later recurrence; a linked source points at the exact target.
- The current [intake controller](../apps/web/src/app/core/core-screen.tsx) reuses its issue/text/photo form with a fixed source/unit context, editable issue type and empty new body/photo selection. A single atomic endpoint creates the target/assertion/relation. Only newly selected photos upload afterwards. Source body, photos, Q&A, protocol answers, work metadata and notes are never prefilled or copied.
- [Recovery metadata](../apps/web/src/app/core/outcome-recovery.ts) contains only source ID, request ID and claim kind. An uncertain in-memory payload stays fixed. [Explicit retry](../apps/web/src/app/core/follow-up-request.ts) checks the receipt before resending the same key/payload; a committed but unreadable target never causes another POST. Refresh never reconstructs raw input. Session denial, logout and organization/session changes clear the protected state.
- The approved presentation delta retains compact photo selection, keyboard-accessible account navigation and a contextual manager inspector with persistent unsaved inputs. Existing presentation assertions remain intact; the old completed-ticket navigation assertion now selects the explicit UNRESOLVED action.

### Integrated local evidence

Windows PowerShell, official isolated Node24.21.0/npm11.19.0, local synthetic Docker PostgreSQL18.6. All commands run at the repository root unless a workspace flag selects Web. No global runtime/dependency/workflow changes. No test skip, timeout increase, expected-result weakening or success-only reporting.

| Command / oracle | Observed result |
| --- | --- |
| `npm run test:postgres` |377 tests /35 files PASS; includes20 outcome tests, observed lock ordering, replay, atomic rollback, current authority and turnover |
| `npm run test:shared` through `npm run verify` |447 tests /40 files PASS |
| `npm run test:web` after final helper correction |533 tests /52 files PASS |
| `npm run test:mobile -- --cacheDirectory <new-private-cache> --json --outputFile <private-result>` |142 tests /16 suites PASS; fresh cache;0 failed/pending/todo; result JSON independently checked |
| `npm run verify` |PASS: shared, root lint, package/test/Web/Mobile types, Web build and dependency tree; Web4/Mobile1 existing warnings,0errors |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core.config.ts` |27/27 PASS, including9 new outcome browser cases |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core-login.config.ts` |30/30 PASS, including2 new outcome/turnover cases and4 approved presentation cases |
| `BUILD_MANAGER_E2E_PREBUILT=1 npm run test:e2e:web` |23/23 PASS using the existing canonical prebuilt option |
| `BUILD_MANAGER_E2E_PREBUILT=1 npm run test:e2e:b1`, then `node apps/web/tests/b1-e2e/check-results.mjs` |60/60 PASS;0 failed/skipped/retries;21 negative controls |
| `node scripts/core-ticket-outcome-restart-check.mjs` |5 saved cases identical across2 distinct owned server processes; source hashes, assertion, one direct relation, exact target, receipt, Q&A and photo bytes retained |
| Existing `core-ticket-communication-restart-check.mjs` |PASS restart and observed HTTP/SQL lock races: message-first201/409, completion-first200/409 |
| Existing `core-manager-work-restart-check.mjs`, `core-flow-restart-check.mjs` |PASS work/notes/photo/ticket/event readback across owned restarts |
| `PYTHONPATH=<repository> python tests/test_verify_repository.py -v`; `python scripts/tests/test_verify_repository.py -v` |3+14 scanner regression tests PASS |
| Public candidate/index and reachable history |Final staged scan is recorded at fixation below; not replaced by these scanner unit tests |

Real [Core browser cases](../apps/web/tests/core-e2e/ticket-outcome.spec.ts) cover RESOLVED/re-entry/manager read, UNRESOLVED, RECURRENCE_CLAIM, RESOLVED-to-recurrence, rejection of RESOLVED-to-unresolved and a second target, seven source-table fingerprint sets, fresh photo/Q&A/protocol/work state, long Korean/unbroken text at390px, loading/error retry, post-commit response loss, exact replay, pre-commit uncertainty with unchanged key/payload, and401/403 cleanup. The [B1 SDK cases](../apps/web/tests/core-login-e2e/ticket-outcome.spec.ts) retain Origin/CSRF checks and actually end only a newly created synthetic occupancy member, add the replacement member, and prove the prior owner/replacement/foreign manager cannot read the old source/target/outcome/relation/receipt/photos/conversation. The replacement creates an independent ticket without a source relation. This is synthetic SDK authentication, not a new actual Auth0 execution.

Private screenshots capture the running app, never generated images. The390px source and target links, retry controls, long conversation, photo controls and manager projection are usable without horizontal overflow. Runtime commands remain in the [running guide](../docs/core-flow-rc1-running.md); the local development entry is `http://127.0.0.1:3130/core`.

### Retained failures and preservation

Initial UI tests correctly failed tenant wording and malformed-storage recovery (3pass/2fail); both were fixed. Two lint iterations rejected a ref passed through a fetch factory and direct state-object mutation; an opaque request fence now handles late-response invalidation without suppressing rules. Two targeted browser runs each had7pass/2fail because the new test used a nonexistent protocol button and then an imprecise select locator; tests now submit the real protocol control and use the existing combobox semantics. The first full Core run had25pass/2fail: an earlier frozen regression intentionally revoked a shared negative-control session, yielding401 instead of authenticated404. The new suite now mints its own authorized synthetic sessions; the404 oracle was preserved and the full27 passed. No failure was hidden by a later run.

Entry fingerprints covered5033 existing rows across19 tables. Existing ticket/photo/body/message/identity/relationship rows remain present. One pre-existing communication-thread projection changed with one concurrent message at18:35:30 KST, before this execution's first browser mutation; all older message rows remain present. Read-only reconstruction matches the original thread fingerprint exactly at version4, followed by the retained appended message/version5. This is recorded separately from this task's isolated test additions; whole-table byte equality is not claimed. No existing source or photo was restored, reassigned or deleted.

All backend/API/persistence/PostgreSQL test files remain byte-identical to the backend checkpoint. Migrations0001–0017, runtime pins, lockfile and workflows are unchanged. The existing prepare path reported no outstanding migration, and actual outcome commands exercise0017 in the synthetic database.

Pre-existing mixed STATUS/execution/handoff/onboarding/pending-sync records and local UI ownership metadata remain preserved outside the implementation commit; only append-only current receipts are added. The existing untracked handoff pointer is retained. Named reviewed implementation/test/runbook/evidence paths are staged individually; no bulk add, reset, rebase, stash, force push, Ready, merge or deployment.

### 34-AC integration closure map

The earlier backend table remains its historical snapshot. Here DB means the rerun377/35 PostgreSQL result above; Web means the actual Core/SDK browser files linked above; restart means the5-case owned-process helper.

| AC | Final integrated evidence |
| --- | --- |
|01|DB + Web tenant assertion and manager read |
|02|DB + saved RESOLVED receipt/replay |
|03|DB observed concurrent identical resolved requests |
|04|DB OPEN/IN_PROGRESS mutation denial |
|05|DB/HTTP + SDK manager write403 |
|06|DB + authenticated peer404 and actual replacement404 |
|07|DB + Web/SDK foreign organization404/non-disclosure |
|08|DB staff assignment removal and current-authority recheck |
|09|DB atomic UNRESOLVED/rollback + Web fresh target |
|10|DB + Web RECURRENCE_CLAIM wording and target |
|11|DB + Web no old body/answer/photo/Q&A/note/work copy |
|12|DB + Web new target photo and manager read; restart byte hash |
|13|DB + Web seven immutable source fingerprints; restart |
|14|DB + Web second different direct target409; restart exact count1 |
|15|DB + Web same-key exact target replay200 |
|16|DB changed payload/source/key conflict |
|17|DB observed source-lock races and no orphan/duplicate |
|18|DB + Web resolved history followed by recurrence |
|19|DB + Web resolved-to-unresolved409 |
|20|DB follow-up-to-resolved409 |
|21|DB forced RLS/grants/FK/forged target/location/content denial |
|22|DB + actual refresh/re-entry and saved receipt |
|23|5-case owned server restart |
|24|DB authority-after-wait + SDK actual isolated-unit turnover |
|25|DB + actual source/target navigation, neutral authorized context |
|26|PG + full Core/SDK Q&A + existing HTTP lock-race/restart helper |
|27|PG + full Core/SDK manager work + owned restart |
|28|PG + full Core/SDK photos + exact-byte owned restart |
|29|PG + full browser handling + source/target event preservation |
|30|shared + PG + actual fresh target protocol answer + standard safety browser |
|31|actual390px, long Korean/unbroken text, error/retry, photos and manager controls |
|32|DB + focused helper + actual pre/post-commit response loss, no raw storage, no auto retry |
|33|HTTP + SDK Origin/CSRF/auth boundaries and actual401/403 cleanup |
|34|Final candidate/index/reachable history scan and exact-head CI receipt required at publication |

AC-D06 NOT_VERIFIED, historical B5 Mobile/AC18 PARTIAL, existing desktop verdict, actual-manager account limitation and Expo/native/device/APK NOT_RUN remain unchanged. The current cold Mobile test success does not resolve the historical B5 failure. Local Doctor/export is not a new Expo execution claim; hosted mobile-health evidence is recorded with the final9jobs. No production or real-tenant test data is used. This is implementation self-verification, not an independent review.

CHECKPOINT | Completion follow-up integrated local evidence | evidence=PG377/35 shared447/40 Web533/52 Mobile142/16 Core27 SDK30 standard23 B1=60 + owned restart | tokens=unknown


### Pre-freeze public safety and live entry

The staged candidate scanner `python scripts/verify_repository.py --history` exited0:624 files,300 internal links,1614 reachable history blobs,0 findings. Both scanner regression suites passed3+14 cases. The final committed-head recheck and9hosted jobs are recorded in the Draft receipt without manufacturing another code change.

The final local build is serving `http://127.0.0.1:3130/core`. Separate visible synthetic tenant390px and manager1440px browser contexts read the saved follow-up photo, its previous completed source and the reciprocal link;390px has no horizontal overflow. These are actual Web screenshots with synthetic authentication, not Auth0 or Expo/device execution.

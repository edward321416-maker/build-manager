# Ticket public Q&A and next action v1 execution evidence

POLICY_REF: `e9144fac807f39544932baac25b11f836658dbb3`, live main verified without changing the worktree. Instruction TARGET_REF and initial remote PR70 HEAD: `7370dc4097e7cd73277eb93bff9664272e35496c`. Implementation starts from preserved local UI commit `9c1fa3e0864ff33aff6ea34b91fed709d0ef041e`, a direct descendant. The operator dispatched `ASTRA_RC1_TICKET_PUBLIC_QA_NEXT_ACTION_V1_IMPLEMENT_NOW.md` and explicitly authorized implementation, tests, normal push and the same Draft PR. No new plan approval is required.

Five existing dirty runtime-record paths remain preserved. The other UI writer committed14 paths as9c1fa3e during preflight; its layout, display components, photo styling and existing browser assertions are retained. Hashes precede minimal additive edits to the three integration screens. No reset, rebase, stash, force push or bulk stage. Migrations0001–0015, provider configuration, lockfile, dependencies and workflows remain unchanged.

## Behavior and boundaries

The new conversation is ticket-specific plain text shared with the original tenant and currently authorized managers. `waitingFor` expresses who needs to respond; it never changes protocol MORE_INFO/ANSWER, route decisions, work status or HANDLING events. Private notes and manager priority/assignee/deadline remain outside every public communication DTO. Four intents have separate transitions; repeated tenant messages preserve the first pending anchor, and manager replies refer to that anchor.

Additive migration0016 creates two FORCE-RLS tables under the existing owner. Runtime has only the exact capability EXECUTE grants. Each send checks current ticket authority, locks the existing ticket row, rechecks access, checks the actor-owned receipt, then validates completion/version/intent before atomic message/thread storage. A saved request replays without a write even after completion; revoked access cannot recover its receipt. Same-key changed payload or ticket conflicts without revealing the original receipt.

Completion uses the same ticket lock. With a thread, the current communication version is required; a missing/stale version conflicts. Pending conversation does not veto an informed manager's completion, which remains a manager handling record, not tenant confirmation or proof of repair. Tickets with no thread retain the previous completion behavior.

Web displays the latest50 messages with sequence pagination, viewer-specific badges, plain-text rendering, manual refresh and focus/re-entry refresh. Uncertain sends keep only ticket/request/intent/version metadata in sessionStorage, never a body. Receipt lookup recovers a committed request without resending. An absent receipt remains unconfirmed and requires an explicit new draft. Logout, denied access and org/session changes clear recovery metadata. Completed conversation is read-only; the recurrence entry opens an empty new intake without copying or altering the old ticket/photos.

## Environment and execution

Windows PowerShell; isolated official Node24.21.0/npm11.19.0; locked dependencies; Docker PostgreSQL18.6. Synthetic development sessions and synthetic B1 SDK cookies are distinct from actual Auth0 login. No actual-manager authentication, new account/provider work or Expo execution is claimed.

Skills: existing Fullstack Guardian security checklist and Playwright Expert locators/autowaiting. No installation, independent review claim or approval loop. Numbered raw execution logs, private fixture state, screenshots and row fingerprints stay outside Git.

Behavioral RED: seven new HTTP/contract tests failed against the old handler/handling input. GREEN:7/7. PostgreSQL RED: the expected two new forced-RLS catalog rows were absent; no import error is presented as behavioral evidence. Focused persistence then passed12 tests, followed by23 tests across the expanded new suite and existing core regression. Focused Web contracts/recovery/badges passed12 across3 suites.

Actual new Web browser run:5/5. It exercised question/answer/reply/update, list badges, independent structured questions, photo readback, tenant privacy, stale409 with draft retention, completed read-only and empty new intake. A post-commit aborted response recovered one saved receipt after reload, with exactly four non-body metadata fields. A pre-commit abort remained unconfirmed after reload. Denied401/403 receipt responses cleared protected content and recovery state. Width390 long Korean text, literal HTML-like text and stale-error controls had no horizontal overflow; HTML did not execute or create image DOM.

Retained failures: first lint found two new React effect/ref errors; fixed without changing lint rules, then passed with the existing warnings. The first integrated `npm run verify`, running alongside full PostgreSQL and Web suites, stopped at shared440 passed/2 failed: B3/B4 production-graph scans exceeded the unchanged5s timeout. The unchanged command passed when run serially; this comparison does not establish the original failure's cause. The first HTTP race/restart helper assumed the wrong blocker for the second queued request and masked its assertion during cleanup; observing the first queued backend as its blocker and settling fetches before stopping the owned server corrected the helper. Product timeouts were unchanged. Later turnover coverage initially attempted a second active occupancy and failed the existing unique constraint (full suite356 pass/1 fail). The corrected fixture joins the different actor to the still-active occupancy after the original member ends; focused15/15 passed. All failed logs are retained. No timeout, skip, assertion or CI condition was weakened.

## Local command results

| Command / actual environment | Measured result |
| --- | --- |
| `npm run test:shared` through serial `npm run verify` |442 tests /38 suites, PASS |
| `npm run test:web` |510 tests /48 suites, PASS |
| `npm run test:postgres` after the simultaneous replay/turnover coverage and fixture correction |357 tests /34 suites, PASS,472.60s; earlier full357 PASS and intermediate356 PASS/1 fixture failure are retained |
| `npm run test:postgres -- tests/postgres/core-ticket-communication.test.ts` after fixture correction |15 tests /1 suite, PASS |
| `npm run test:mobile -- --cacheDirectory=<new private empty cache> --json --outputFile=<private result>` |142 tests /16 suites, PASS, no skipped/todo; Windows cold cache,33.362s |
| `npm run verify` serial control |PASS: shared, lint, typecheck, build:web and check:deps; existing Web4/Mobile1 lint warnings retained |
| `npm run typecheck:tests` after strengthened coverage |PASS |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core.config.ts` |18 PASS, including all old core/photo/queue/UI cases and5 new communication cases |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core-login.config.ts` |22 PASS, including2 new B1 SDK communication/lifecycle cases; synthetic provider logout503 follows local revocation |
| `npm run test:e2e:web` with the existing prebuilt flag |23 PASS |
| `npm run test:e2e:b1` and `node apps/web/tests/b1-e2e/check-results.mjs` |60 PASS; checker failed0/skipped0/retries0/negativeControls21 |
| `node scripts/core-ticket-communication-restart-check.mjs` with the prepared private home |PASS: actual HTTP message-first201/409 and completion-first200/409; observed backend waits; distinct owned server processes retain identical thread/message/receipt/ticket/photo/work/note readbacks |
| Existing repository scanner tests |3 root tests and14 scripts tests PASS |

Manual runtime pagination additionally displayed the latest50 of53 messages, then all53 in sequence after requesting older messages. This is actual API/PostgreSQL/Web evidence; it does not replace the automated cursor tests. Small-screen evidence uses390 CSS pixels, with manual browser and assertion evidence kept privately. Local Doctor/native-device/Expo execution is not claimed; the existing hosted mobile-health job supplies its own pinned Doctor and JS-export evidence.

## Run the delivered Web flow

Use the existing project-isolated Node24.21.0 and Docker database. From the implementation worktree, `node --experimental-transform-types scripts/core-flow-dev.mjs --prepare` applies only outstanding migrations and renews the existing synthetic sessions, preserving stored tickets/photos; `node --experimental-transform-types scripts/core-flow-dev.mjs --serve` serves `http://127.0.0.1:3130/core`. Do not launch another server while3130 is occupied. The existing [run instructions](../docs/core-flow-rc1-running.md) explain the private code file and55minute session lifetime. The already running evidence server uses its separate private browser-test home; its exact local command and captures are delivered privately, with no code or credential published.

Open manager and tenant in separate browser profiles. Open the same ticket, use **세입자와 공유하는 대화**, ask a question, refresh the tenant and send a response, then refresh the manager and use **답변**. **진행 안내** leaves the response owner unchanged. List badges show the next actor. If a send result is uncertain, use **저장 여부 확인**; it does not resend. Handling remains a separate action; refresh the conversation before completing a stale ticket. Completed messages remain readable and **아직 문제 있음 / 다시 발생** opens a blank new intake.

## AC evidence map

| AC | Required behavior | Executable evidence |
| --- | --- | --- |
| 01 | Question, tenant answer, manager reply, handling | `core-e2e/ticket-communication.spec.ts`, round trip; PostgreSQL transitions and completion |
| 02 | Current original tenant only | PostgreSQL own read/receipt and public summaries; B1 browser own read |
| 03 | Same-unit co-occupant and other tenant denied | PostgreSQL ownership and B1 peer denial |
| 04 | Foreign organization/context denied without existence leak | PostgreSQL foreign context; B1 foreign read/send and omitted summaries |
| 05 | Staff assignment ceiling, immediate revocation | PostgreSQL observed ticket wait with assignment revocation, followed by B5 termination |
| 06 | Private note body/count/time absent | Strict DTO key assertions; tenant API/DOM round trip; existing private-note regression |
| 07 | Priority, assignee and due absent from public data | Strict DTO/SQL projection and actual tenant DOM/API |
| 08 | Exact replay is one row; changed request conflicts | PostgreSQL simultaneous same-key sends yield one created result and the same receipt; actor/key/payload/ticket conflicts |
| 09 | Two managers, same version, one winner | PostgreSQL observed blocking PID and one append/stale conflict |
| 10 | Lost post-commit response recovers without duplication | Browser abort after route.fetch commit, reload and receipt lookup |
| 11 | Reload uses server truth; absent receipt is not success | Browser committed and uncommitted uncertainty cases |
| 12 | Real server restart keeps messages, thread and receipt | `scripts/core-ticket-communication-restart-check.mjs`; distinct owned server processes |
| 13 | Completed new sends rejected; prior replay immutable | PostgreSQL and actual Web completion/read-only |
| 14 | Recurrence entry only opens empty intake | Browser old ticket equality, empty new body; photo restart hash |
| 15 |390px long text, messages, error and primary actions | Actual round-trip/conflict screenshots plus geometry assertions |
| 16 | Existing photo count/type/size/auth/privacy | Existing photo PostgreSQL/Web/browser regression, new attached-photo round trip |
| 17 | Existing queue filter/order/metadata/version/private notes | Existing manager work suites retained and executed on candidate |
| 18 | Messages do not append HANDLING | PostgreSQL unchanged CoreRecord; actual final history has exactly two handling events |
| 19 | Revocation/session denies read/send/receipt and clears cache | PostgreSQL ended/revoked actors; browser401/403 recovery cleanup |
| 20 | Structured MORE_INFO and communication wait independent | Browser structured request leaves communication equal; conversation replies do not resolve protocol |
| 21 | Both completion/message commit orders | Controlled SQL and actual HTTP requests with pg_blocking_pids; message-first201/409, completion-first200/409 |
| 22 | Current version allows pending completion | PostgreSQL and Web completion with pending question, no automatic tenant confirmation |
| 23 | Refresh/re-entry/focus only; no notification/read oracle | Actual focus fetch and list re-entry, no realtime transport or read receipt |
| 24 | Bounded text, literal HTML, strict identity, Origin/CSRF | HTTP/contracts/SQL input tests, B1 endpoint checks, actual literal rendering |
| 25 | Turnover never transfers old ticket/photo/message/receipt | PostgreSQL ends original member, then admits a different actor to the unit; both co-occupant/new actor can list the unit but cannot read old ticket/photo/message/receipt, and summaries omit it |
| 26 | Recovery cleared on logout/denial/org/session change | Recovery helper tests, denied browser cases and B1 lifecycle test |

All26 ACs have passed the cited local executable/runtime checks. This is local evidence, not a substitute for exact-head hosted CI or user acceptance. Test filenames without a repository prefix refer to `apps/web/tests/`; persistence assertions are in `tests/postgres/core-ticket-communication.test.ts`. No existing assertion, negative control, test inventory or timeout is weakened.

## Preservation and final publication gate

Initial fingerprints cover15 existing identity, membership, property, unit, occupancy, assignment, ticket, event, photo, invitation, manager-work and internal-note tables. Runtime preparation applied only outstanding0016 to the marked local synthetic database. Measured readback found zero changed or missing prior rows in each table; only new synthetic test data was added. Frozen migration0001–0015 hashes match. Existing dirty `STATUS.md`, `ops/AI_Execution_Log.csv`, `ops/CHAT_HANDOFF.md`, `ops/core_flow_rc1_onboarding.md` and `ops/pending_external_sync.md` remain local. Only this slice's explicitly named additions are staged; old mixed runtime receipts are not swept into the implementation commit.

Required exact-head jobs remain: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate. The final candidate needs9/9 success associated with its exact HEAD. Local browser execution and hosted jobs are separate evidence generations; prior7370dc4 CI is not reused. The PR receipt will identify final HEAD, commit tree, all runs/attempts and conclusions after readback.

Preserved risks: Draft/NOT_ACCEPTED; AC-D06 NOT_VERIFIED and prior desktop acceptance; historical B5 Mobile failures/AC18 PARTIAL; actual-manager Auth0 limitation; Expo/native/device/APK NOT_RUN and the earlier host policy restriction, without retry or bypass. No Ready/main merge/deployment. Stop after this bounded v1; related-ticket and maintenance-fact timeline work are not started.

Execution status before publication: local implementation, all26 ACs, actual runtime and final strengthened PostgreSQL regression passed. Public index/reachable-history scan and exact-head CI are recorded by the publication receipt. This document does not substitute local results for the required nine hosted jobs. The candidate remains Draft/NOT_ACCEPTED; no acceptance, Ready, merge or deployment is claimed.

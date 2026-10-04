# Core flow RC1 execution evidence

POLICY_REF / IMPLEMENTATION_BASE: `e9144fac807f39544932baac25b11f836658dbb3`.
Authority: [issue69](https://github.com/edward321416-maker/build-manager/issues/69), operator-delivered `ASTRA_CORE_FLOW_RC1_IMPLEMENT_NOW.md`.
Status: WEB_RUNNABLE / EXPO_EXECUTION_BLOCKED / NOT_ACCEPTED. Web execution and persistence are verified; Expo/native execution is not. No final merge or production authorization. Fixed HEAD and hosted job receipts are recorded on the Draft PR after candidate freeze.

Current wiring: existing ticket protocols/use cases and Web/Mobile components work in the separate demo; the authenticated PostgreSQL property/occupancy foundation has no persistent ticket adapter. RC1 adds a scoped ticket adapter, separate handling status/history and synthetic-development authentication backed by the existing B1 session registry. Roles are read from active DB relationships, never selected by a client. Tenant access requires current occupancy and ownership; manager access follows B1/B2/B5 membership/property assignment checks. Existing migrations and authority semantics remain unchanged.

Implementation order: additive schema/transaction adapter with real PostgreSQL permission and persistence tests; authenticated API and shared client; reuse intake/review components plus unit selection/history/handling surfaces; launch persistent synthetic local database and Web, connect Expo to the same API; run integrated round-trip/restart/denial and applicable regression gates, publish Draft.

Security preflight (fullstack-guardian): authenticate every request against current_actor, derive organization from server-stored session scope, recheck unit/owner/assignment on every transaction; parameterized SQL; schema-validated inputs and role-specific DTOs; no raw error or token logs; same-origin mutation checks for cookie transport and explicit bearer transport for Mobile. Photo upload and live-provider login remain unsupported; synthetic evidence stays labeled. APPROVED/OVERRIDDEN retain recommendation-decision meaning; handling completion is a separate human-recorded state.

Existing B5 local Mobile failures remain historical FAILED/OPEN/ROOT_CAUSE_NOT_ESTABLISHED. B5 was accepted/merged before this successor authorization; this RC does not rewrite its records or inherit a merge waiver.

## Implemented flow

`/core` and `/api/v2/core/[...path]` connect authorized unit selection, HEATING/LEAK intake, existing protocol questions/safety and manual route decisions, manager follow-up, separate human-recorded handling, tenant result and unit history. Web and Expo source use the same API client and PostgreSQL store. The three transport forms are Web HttpOnly/SameSite cookie, Mobile bearer session and explicit-origin CORS. A client cannot choose its organization, owner or role. Revoked sessions clear protected screens when refreshed. No photos, LLM inference, dispatch, notifications, live-provider authentication or native readiness are claimed.

Migration0011 creates only the additive core_flow schema and limited owner grants. Migrations0001–0010, existing B1–B5 production paths, common transaction/pool and frozen native worker remain unchanged. RC1 owner provisioning follows the existing synthetic bootstrap. The persistence manifest gains only `./core-flow`; its original root exports remain byte-identical. Exact architecture/function-grant inventories add the new route/entry/owner without removing prior assertions. No dependency, lockfile or workflow change.

## Measured local execution

Environment: Windows PowerShell; isolated official Node24.21.0 / npm11.19.0; installed lockfile via `npm ci --ignore-scripts --no-audit --no-fund`; Docker PostgreSQL18.6. Tests use synthetic data. Private raw logs are outside Git; public receipt hashes are in `core_flow_rc1_checks.json`.

| Command | Result |
| --- | --- |
| `npm run test:postgres` | 305/305, 29 files, exit0; full second run430.70s |
| `npm run test:shared` | 435/435, 35 files, exit0 |
| `npm run test:web` | 465/465, 39 files, exit0 |
| `npm run test:mobile` | Initial132/133 failed at tenant-ticket.test.tsx:78, 5000ms timeout; retained separately |
| fresh-cache Mobile after adding RC1 tests | 136/136, 14 suites, exit0; cache did not exist before the run |
| final Mobile after denial-clearing change/test | 137/137, 14 suites, exit0, warm/default cache; not substituted for cold run |
| `npm run test:e2e:web` | 23/23, exit0 |
| `npm run test:e2e:b1` + result checker | 60/60, 21 negative controls, zero failed/skipped/retries, exit0 |
| `npx --no-install playwright test --config playwright.core.config.ts` in apps/web | New RC1 4/4, exit0, actual Web/PostgreSQL; screenshots stored privately |
| `node scripts/core-flow-restart-check.mjs` | Distinct actual Next server PIDs; exact ticket/version/events survive restart and tenant/manager reread, exit0 |
| lint / typecheck / build:web / check:deps | PASS; two pre-existing unused-import lint warnings retained |
| `npx --yes expo-doctor@1.20.4 .` in apps/mobile | 21/21, exit0 |
| Expo Android/iOS JS/assets exports | exit0; 29/25 files, no native build/device claim |
| public-scanner regressions | 3+14 tests PASS; candidate index/history scan recorded before publication |

Observed RED/fix history: early focused PG setup failed on owner EXECUTE grants, then a PL/pgSQL variable ambiguity; targeted7 passed after fixes. Initial complete PG301passed/3failed: root export enlarged the frozen worker graph/public root, plus exact B2 role inventory; isolated subpath and additive catalog oracle restored full305pass. The unchanged frozen foundation tests and worker were not edited. First RC1 browser run1pass/2fail exposed missing required synthetic building passport fields; fixture metadata corrected, preserving existing local data; next3pass, then final4pass including revocation. Initial new Mobile test harness omitted awaited RNTL operations; corrected harness3pass, later denial-clearing test added. Shared architecture red434/435 after new subpath was resolved by asserting that exact new export while retaining the prior manifest equality and53 frozen hashes. Initial build/type errors are retained in the private logs. No skip, timeout increase, weakened expectation or success-until-retry loop.

The persisted development DB was created while migration0011 was being developed. Seven core_flow function definitions were refreshed there from the final uncommitted migration, preserving all records; disposable PostgreSQL tests separately validate a fresh migration. This development refresh is not a migration-runner/redeployment claim.

## Remaining limits and execution blocker

In the initial execution, two local Expo dev-server startup requests were rejected by automatic approval review (`blocked by policy`), including a narrower offline/loopback attempt. That execution made no further startup attempts. The separately authorized resumed attempt is recorded below. Expo Web interaction, physical-device LAN reachability, APK and native-device runtime remain NOT_RUN. Android/iOS exports and React Native component tests do not replace runtime evidence. Available interface inspection found no verified phone-accessible private LAN; PC localhost is not asserted to work on a phone.

The first RC1 Mobile failure remains FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED. Later RC1 cold and warm passes neither diagnose that failure nor resolve the original B5/B3 failures. No BASE re-diagnosis was performed. No new security/data-loss failure is known from the executed checks, but this is not independent review or acceptance.

The launcher defaults to loopback. An explicit private interface is required for LAN serving; public interfaces and wildcard hosts are rejected. Synthetic codes expire after55minutes and are renewed by `--prepare`, preserving users and tickets. Development startup does not delete containers/volumes or overwrite a pre-existing setup without its matching private state.

Next work: run the blocked Expo UI against the same API, verify an actual phone-accessible address/device if available, then consolidate user feedback. Pagination beyond100 tickets/200 units, real photo upload, provider login, notifications and visual polish remain backlog. Do not mark RUNNABLE_CORE_FLOW_RC1_DELIVERED for both platforms until Expo runtime is actually verified.

## 2026-10-03 resumed runtime check

The operator renewed the same RC1 implementation/startup authorization. Live main remained `e9144fac807f39544932baac25b11f836658dbb3`; local and Draft PR70 HEAD both remained `256f47dd64b8f9f316bbb6669774efd1b29d34ea`, with a clean worktree before this documentation delta. Existing three commits and all product bytes are preserved. Fullstack-guardian remains the applied implementation skill; no new tool installation or redesign was needed.

The previous exact-HEAD runs36993344577/36993344588 were re-read as SUCCESS, and their [fixed receipt](https://github.com/edward321416-maker/build-manager/pull/70#issuecomment-5950048391) was read back. Those tests were not rerun locally or attributed to this later documentation candidate. A new published HEAD requires its own hosted receipts.

| Resumed action | Observed result |
| --- | --- |
| `node --version` / `npm --version` | Project-isolated24.21.0 /11.19.0; no global/version/lock/workflow changes |
| `npx --no-install expo start --web --offline --localhost --port 8081` from apps/mobile | Process creation rejected by automatic approval review: `blocked by policy`; no process exit code, app log or runtime evidence exists for this attempt. No detailed reason was supplied. No alternate startup was used to bypass rejection. |
| `npx --no-install expo export --platform web --output-dir <private-output>` from apps/mobile | Exit0; nine static routes including `/core`; Web910 modules and server renderer959 modules. `EXPO_PUBLIC_API_URL` was loopback3130; CI=1. Static compilation only, no served UI claim. |
| `node --experimental-transform-types scripts/core-flow-dev.mjs --prepare` | Exit0; no pending migrations; same synthetic accounts renewed for55minutes and existing database retained |
| HTTP GET `http://127.0.0.1:3130/core` | 200 from the existing built Web server; not a new round-trip test |

The private export log `rc1-resume-web-export-20261003.log` has SHA256 `6eabab8718fdcabaa86f27b410a55d73895bdc761300e9c089e549e2dd28ae8c`. Original failed logs remain intact. The rejected startup did not create its proposed redirected log; the tool rejection is the evidence. No new Mobile Jest run or root-cause conclusion is claimed. Expo/device/APK runtime and phone-accessible LAN remain NOT_RUN; the two-platform delivery goal remains unachieved because of the actual execution constraint. Web remains available independently.

This documentation delta also corrects the obsolete current-task B5 remediation paragraph in STATUS; original B5 evidence and acceptance are unchanged. Prior native Google sync remains historical verified evidence. Google Docs/Sheets transports are not exposed in this resumed session; this new event is PENDING_SYNC in the local queue, without replacing prior receipts.

## 2026-10-03 Web usability implementation

Operator scope: preserve PR70 and continue the working Web flow while retaining the Expo host restriction. No Expo startup request, alternate port, serving method or bypass was attempted in this phase. POLICY_REF/main stayed e9144fa; starting local/remote PR70 HEAD was91db051. The installed playwright-expert skill guided actual browser checks, semantic locators and condition-based waits. Traces/videos stayed off to keep private synthetic access codes out of artifacts; only post-login or cleared-code screens were captured privately.

Observed at320px before changes: no horizontal overflow, but primary buttons were40.375px high and inherited centered layout separated controls excessively. A saved intake showed raw `CREATED`; initial network failure silently showed login; a missing session during the embedded ticket refresh left protected parent content visible with a generic child error. These are measured UI findings, not a new authorization/data-storage design.

Changes are limited to the Web core page, core-scoped CSS and its browser checks:44px minimum action targets; compact wrapping controls and full-width fields; explicit saved intake/handling feedback and unit/issue/result summary; Korean event labels; focus on the opened result or error; role-specific empty-list/no-unit next steps; explicit connection/session/access/not-found/conflict guidance; read-only recovery that never automatically repeats a POST. Failed saves keep input and instruct checking history before resubmission. Initial session loading disables the code field. Both parent and embedded requests clear protected state on401/403. Full refresh also reloads authorized units. The shared API, authorization/DB semantics, safety protocol, original components and Expo source remain unchanged.

| Local command/check | Result |
| --- | --- |
| New usability browser checks against prior build | Corrected locator run3failed:40.375px target, missing connection explanation, nested session-loss handling. Initial harness also encountered Next's separate route-announcer alert; locator was scoped without weakening its message assertion. |
| Focused checks after first changes | Initial2pass/1selector ambiguity between saved/live loading status; precise receipt locator corrected, then3pass |
| Full core browser first integration | 5pass/2fail: initial login click remained disabled; peer-list empty premise was invalid after the actual audit saved that peer's own ticket |
| `npx --no-install playwright test --config playwright.core.config.ts` in apps/web after fixes | 7/7 PASS,8.6s, exit0; original4 plus new3, zero retries |
| `npm run test:web` | 465/465,39files, exit0 |
| `npm run test:e2e:web` | Existing23/23, exit0 |
| `npm run typecheck`, `npm run lint`, `npm run build:web` | Final source PASS, exit0; only the same two pre-existing lint warnings |

The login input was enabled while initial session loading was pending; it is now disabled until loading settles, with a controlled pending-request test. The one initial-login timeout is preserved, not labeled as a general timing root-cause diagnosis. The peer list oracle now compares the exact before/after response and explicitly excludes the other tenant's new ticket, while retaining all original401/403/404 controls. This preserves existing synthetic tickets instead of clearing data to satisfy an empty-list assumption. No timeout increase, skip, permissive count or weakened access-denial expectation.

Actual new browser coverage:320px tenant create → separate manager browser starts/completes handling → tenant rereads the same database ticket; buttons fit and are at least44px; completed result also fits390/768/1280px. A real server401 after browser cookies are cleared exercises nested session loss. Controlled network-abort/empty response cases separately exercise startup retry, retained input, no repeated POST and no-unit guidance; those cases are not persistence/authorization evidence. Screenshots `usability-tenant-result-320.png`, `usability-manager-active-320.png`, `usability-manager-result-320.png`, `usability-empty-320.png`, `usability-save-error-320.png` and `usability-session-ended-320.png` are stored outside Git. The tested Web was rebuilt/restarted on the same loopback3130 address with the persistent database preserved.

Private log SHA256 receipts:

- `rc1-usability-red-corrected.log`: adb46f8fa6a9a4b9ee8ea9aa4d54b712ed9f19fbf5f9a117e22bd04958058f58
- `rc1-usability-core-full.log` (5pass/2fail): 768f8f75994a1d59069eb2224021f7543e861972e88cd1a2dad23b7dd152120f
- `rc1-usability-core-final.log` (7pass): b8b5da0a0d1188e68380ef7dd8e7d28e464702a49ad756bc46fb5198bb44522a
- `rc1-usability-final2-build.log`: dddc3e6decfc5f1eebdcc579d76ae539d14a8711c1dd8d0145c70a88111855b8
- `rc1-usability-final2-typecheck.log`: c6c909ba49a145b7e844339fefe2c22478aa8aca8d9664fabfa28d6abaca407d
- `rc1-usability-final-lint.log`: b5b353c83a056b4f5f398df005c2823e32ad558019dfc65a1a5206b3b7842a85
- `rc1-usability-web-unit.log`: 5edacd0bad8f2d54640fec6866b250b87502756dd67f36b3a768add66b24346f
- `rc1-usability-existing-browser.log`: 4361beb64d5336be6513fd3402ad44fdc2aafe3a5cece8cbfbae8d4853b34ae5

Local PostgreSQL/Mobile/Doctor/export were not rerun for this Web-only delta; their previous results stay attributed to their original generation. New-head required CI is recorded on PR70 after publication, separately from prior91db051/256f47d runs. Original Mobile timeouts and Expo runtime NOT_RUN remain unchanged; no full two-platform delivery, final merge or production claim. External Google sync for this phase remains pending because the transport is unavailable.

## 2026-10-03 protected photo successor

The operator's subsequent photo instruction authorizes the bounded addition from3b71970. See [photo execution evidence](core_flow_rc1_photos.md) for implementation, actual screens, full regressions and retained new Mobile failures. Earlier unsupported-photo statements describe their original execution generation and are not rewritten. Current Web photo flow is runnable; Expo startup was neither retried nor bypassed. No final merge or production.

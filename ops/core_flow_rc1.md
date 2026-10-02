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

Two local Expo dev-server startup requests were rejected by automatic approval review (`blocked by policy`), including a narrower offline/loopback attempt. No more startup attempts were made. Thus Expo Web interaction, physical-device LAN reachability, APK and native-device runtime remain NOT_RUN. Android/iOS exports and React Native component tests do not replace runtime evidence. Available interface inspection found no verified phone-accessible private LAN; PC localhost is not asserted to work on a phone.

The first RC1 Mobile failure remains FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED. Later RC1 cold and warm passes neither diagnose that failure nor resolve the original B5/B3 failures. No BASE re-diagnosis was performed. No new security/data-loss failure is known from the executed checks, but this is not independent review or acceptance.

The launcher defaults to loopback. An explicit private interface is required for LAN serving; public interfaces and wildcard hosts are rejected. Synthetic codes expire after55minutes and are renewed by `--prepare`, preserving users and tickets. Development startup does not delete containers/volumes or overwrite a pre-existing setup without its matching private state.

Next work: run the blocked Expo UI against the same API, verify an actual phone-accessible address/device if available, then consolidate user feedback. Pagination beyond100 tickets/200 units, real photo upload, provider login, notifications and visual polish remain backlog. Do not mark RUNNABLE_CORE_FLOW_RC1_DELIVERED for both platforms until Expo runtime is actually verified.

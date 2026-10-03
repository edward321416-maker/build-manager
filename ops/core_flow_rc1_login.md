# RC1 existing-login bridge execution

Authorization: operator's delivered existing-login directive on2026-10-03; continue the same Draft PR70 immediately. POLICY_REF/main e9144fac807f39544932baac25b11f836658dbb3; LOGIN_DELTA_BASE df922d73404875f9c845b8e11aa6e1936a5ae44e; feat/core-flow-rc1 initially clean. Seven prior commits, existing photo records, identity issuers and persistent PostgreSQL volume are preserved. No Expo startup/retry/bypass, new provider/account/IAM, real data, Ready, merge or deployment.

Skills: fullstack-guardian security checklist and playwright-expert applied; existing Google native transport reused for records. Node24.21.0/npm11.19.0 isolated shell, Windows, PostgreSQL18.6 synthetic development DB. Active process contains none of the seven B1 configuration variables inspected; no project env file or existing private Auth0 configuration identified. LIVE_AUTH0 remains NOT_RUN / CONFIGURATION_REQUIRED. Installed SDK4.30.0 is reused; [current official documentation](https://auth0.github.io/nextjs-auth0/) reports4.31.0 and is not substituted for installed contracts.

## Implementation

Thin core adapter calls frozen B1 requireCurrentSession, using SDK cookies plus registry actor/digest. Server mode selects B1 versus explicit development code; B1 never falls back to bearer or rc1_session. All mutations require exact configured Origin and existing x-b1-csrf. Scoped GETs also match current session CSRF, so an account switch cannot reuse the previous screen's request context. Only headers are copied into the SDK request: copying the original Request transferred/locked the JSON/photo body and was fixed with a stream-preservation regression.

Additive0013 introduces a separate non-login, non-inheriting discovery owner with actor-specific restrictive RLS ceilings, fixed-search-path/PUBLIC-revoked capabilities and no runtime table grants. Tenant-only valid occupancy is included; no association returns an empty list. Every selected org is revalidated. Binding plus core reads/writes run under a digest advisory transaction lock; requests and tabs carry their own org rather than trusting a shared selected-org cookie. Photo preflight and final storage each rebind/recheck. Original migrations0001–0012 and B1–B5 security modules are unchanged; workspace adds only an entry link.

Existing tenant/manager/photo screen is reused. Login mode has account login, no-association/logout, validated organization choice, session-error recovery and state clearing on actor/org change. Existing completion303/workspace and POST logout revoke-before-provider behavior remain intact. Provider logout failure is exercised separately from successful registry revocation. Separate synthetic SDK actors/data are seeded under their own synthetic issuer; no existing development identity/ticket/photo is reassigned. Existing DEMO launcher is retained. New B1 launcher requires the existing configured loopback callback origin for live mode and fails closed if missing. Its explicit synthetic SDK mode uses localhost3133, without contacting a real provider.

## Development evidence (not final candidate acceptance)

- Initial adapter test discovery failed on missing new module: scaffolding RED only, not behavioral evidence. After implementation focused Web136 passed. Later full Web475/41suites passed including body-stream preservation.
- First migration run failed on missing temporary schema CREATE for existing core owner; additive0013 corrected and CREATE revoked afterward. No applied old migration changed.
- Next PG run4pass/1fail: new test used nonexistent revoked_at; corrected to existing ENDED/ended_at. Next run16pass/2fail: exact role/function inventories identified new authorized additions; original entries/count controls retained, new discovery catalog assertions added. Final focused PG18/3files passed, including observed ungranted advisory lock for the competing org transaction.
- Initial browser0/4: POST body transfer issue above. Next browser3/4: actual tenant photo/manager/reconnect/logout, no-association/account switch and two-tab flows passed; expiry fixture used two clock_timestamp calls causing the existing one-hour duration check to fail. Corrected fixture to one statement_timestamp, without relaxing DB constraint.
- Initial typecheck failed on a new test header union; corrected. Initial lint and follow-up flagged render refs/effect state/lifetime mutation; lifecycle generation handling corrected without disabling rules.
- All private failed logs retained under the existing project runtime directory. No timeout increases, test skips, expectation weakening, automatic command replay or successful-run selection.

The subsequent5-case run found a test interaction race: visibility revalidation had already removed the previous actor's refresh button. The test now atomically triggers refresh only if still mounted and retains the same login/old-content-absence oracle. Final5/5 PASS. Visual screenshot inspection found an inherited full-viewport gap above the core screen; a scoped CSS fix removes it, with a320px region-height/no-overflow assertion. This was an actual screen finding, not a cosmetic-only commit.

## Final local validation

| Check | Actual result |
| --- | --- |
| `npm run test:shared` |438tests /36files PASS, exit0 |
| `npm run test:web` |475tests /41files PASS, exit0 |
| `npm run test:postgres` |315tests /31files PASS, exit0;410.75s |
| New `playwright.core-login.config.ts` |5/5 PASS; synthetic SDK completion, photos, manager/reconnect/local logout, revoked access, no association, account switch, CSRF/Origin, expiry and multi-org |
| Existing `playwright.core.config.ts` |11/11 PASS, including partial upload/manual retry/no duplicate/completed invariants |
| Existing `test:e2e:web` |23/23 PASS |
| Existing `test:e2e:b1` + exact checker |60/60 PASS;0failed/skipped/retries;21negative controls |
| `core-flow-restart-check.mjs` |Distinct server PIDs; exact ticket/version/events and photo metadata/JPEG hash retained; tenant/manager reread PASS |
| `npm run test:mobile` |139/139,15/15suites PASS; fresh unique cache,24.802s, exit0; no skipped/todo; prior Mobile failures unchanged |
| `typecheck`, `lint`, `build:web`, `check:deps` |PASS, exit0. Existing lint warnings retained |
| Frozen source/dependency/workflow comparison |0001–0012 all12migration bytes unchanged; B1–B5 security modules, proxy, dependency manifests/lock and workflows unchanged |
| Live Auth0 launcher preflight |Expected exit1 CONFIGURATION_REQUIRED; no provider login/settings change |
| Synthetic B1 launcher and browser helper |Server3133 starts; tenant and manager helper completion/core entry verified, private390px screenshots captured |
| Pinned Doctor / static exports |Doctor1.20.4:21/21 PASS; fresh Android29files and iOS25files PASS. JS/assets only, not Expo runtime/native builds |
| Native Google execution log |Current implementation summary appended/read back at A185:D185; earlier coordinator and photo records retained |

Actual private screenshots: login-tenant-photo-320, login-manager-photo-320, login-reconnected-320, login-logged-out-320, login-no-association-320 and login-launcher-tenant/manager-390. These are captured browser screens with synthetic reference-image fixtures, not generated UI images or live property evidence. No credentials appear in screenshots. Current401 rejects old raw photos after registry revoke even when provider discovery fails; provider success remains NOT_RUN.

LOGIN_BRIDGE_IMPLEMENTED=PASS; SYNTHETIC_SESSION_CORE_FLOW=PASS; LIVE_AUTH0=NOT_RUN/CONFIGURATION_REQUIRED; EXPO_RUNTIME=NOT_RUN/BLOCKED_BY_EXISTING_HOST_POLICY. No Expo retry or alternative startup. NOT_ACCEPTED; B5 AC18 PARTIAL and historical Mobile risks remain. Required CI is recorded on the actual committed head after publication; these local results are not substituted for hosted jobs.

Actual headed tenant helper was also launched successfully at3133 after capture-mode validation. The live-mode launcher returned the expected sanitized configuration-required exit1. Public scanner and exact-head hosted receipts are attached to PR70 after committing this evidence; no old photo CI is relabeled as login CI.

## Actual tenant photo flow — 2026-10-03

Event `RC1-LIVE-TENANT-FLOW-PASS-5968939198`: **LIVE_TENANT_PHOTO_FLOW_PASS**, under [explicit authorization](https://github.com/edward321416-maker/build-manager/pull/70#issuecomment-5968939198), unchanged product HEAD `2d63b6f58fdf7683fe055c59dab20e32f1f1ea3c`. Existing worktree and earlier uncommitted runtime records preserved.

The tenant used actual Auth0 Database authentication, matched to the prior successful run and the exact existing issuer/subject mapping before any fixture write. The manager used the existing separate synthetic Auth0 SDK account against the same loopback marked PostgreSQL database. These authentication methods are not interchangeable evidence.

Preparation added one dedicated synthetic unit, one occupancy and one occupancy-member relationship. Private stable task IDs, transaction checks and post-commit readback prevent duplicate preparation. No organization membership/admin role, DB grants, external identity or existing ticket/photo ownership was changed. The original zero-association result remains the historical pre-connection state.

Actual UI flow: dedicated unit -> synthetic text/PNG selection and preview -> one ticket/one stored photo -> eight protocol answers and submission -> existing manager reads the same ticket/photo and records start/completion -> actual tenant reloads and re-enters from workspace -> same result/photo/unit history -> existing POST logout/provider return. Protocol status remains PARTIAL because reference photos do not satisfy verified required evidence. Work status COMPLETED records the human synthetic manager action; no real repair, dispatch or automated image analysis is claimed.

Bounded checks passed: manager ticket/photo200 with stored/served photo-byte equality; same-org other tenant and other-org tenant ticket/photo404 each; ticket1/photo1/handling events2 DB readback; every pre-existing ticket/photo/event, identity, membership and assignment fingerprint preserved. After logout, the exact actual session was revoked and current_actor returned NULL; unauthenticated session/raw-photo requests returned401. Old-cookie HTTP replay and server restart were NOT_RUN in this phase, not inferred from prior execution.

Execution qualifications remain visible: first controller stopped on a mismatched preview locator after the one fixture connection and before ticket creation. The second reached manager completion before an exact-text locator missed the event's time/role prefix. The existing tenant browser was continued through native UI Automation without a third login or duplicate ticket. A read-only proof initially omitted established CSRF/Origin headers, then passed after that helper correction. These were execution-tool corrections, not product changes. Occluded desktop and blank window captures were excluded; actual Playwright captures and verified target-window rendering were retained privately. No actor identifiers, cookies, credentials or private destination IDs are in this record.

Existing live app remains on `http://localhost:3100/core`; the tenant browser ends logged out. Existing synthetic manager remains on3133. No new full regression or hosted CI was run for this runtime-only task. Previous exact-head CI is historical. Product code is unchanged; runtime log additions remain uncommitted. Native execution Sheet A204:D204 and nine rolling fields were written/read back. AC-D06 NOT_VERIFIED, desktop acceptance, historical Mobile risks and Expo/native NOT_RUN remain unchanged; no Expo retry, Ready conversion, merge or deployment.

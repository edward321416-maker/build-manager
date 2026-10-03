# RC1 protected photo execution evidence

Operator authorization on2026-10-03: implement the delivered RC1 photo directive immediately, preserve the existing Web, publish ordinary commits on the same Draft PR70, and retain the Expo host restriction. Main/POLICY_REF is e9144fac807f39544932baac25b11f836658dbb3. Delta base is3b71970289be38797aa659b60036895cd4b8f4a9 on feat/core-flow-rc1; the five existing commits, synthetic accounts, tickets and PostgreSQL volume are preserved. No reset, rebase, force push, Expo startup/bypass, final merge or deployment.

Status: **WEB_PHOTO_FLOW_RUNNABLE / EXPO_RUNTIME_NOT_RUN / NOT_ACCEPTED**. Final two-platform RUNNABLE_CORE_FLOW_RC1_DELIVERED is not claimed. The original Mobile failures and the new local failures below remain unresolved.

## Implemented behavior

Web selects/previews JPEG/PNG files, saves text first, then uploads optional reference photos to that exact ticket. Stable UUID upload IDs survive manual retry while the page stays open. Partial failures retain only remaining Files; readback reconciles a lost successful response. No automatic POST replay or repeated CREATE. Stored thumbnails/enlargement appear in tenant/manager detail and unit history;401/403 clears protected content and selections. Closing/reloading loses unsent selections, never persisted photos. Managers/staff read only; the owning tenant uploads only before COMPLETED.

The shared client separates raw binary transport from the existing16,384-byte JSON helper, supports Web cookies and native bearer headers, and carries no credentials in URLs. Mobile adds protected list/read/enlargement with reload caching and denied-session clearing, without a picker dependency or runtime claim.

Additive migration0012 stores normalized bytea, metadata and author/time with ticket FK, FORCE RLS, fixed search_path, PUBLIC revocations and four scoped runtime capabilities. Original migrations0001–0011 and B1–B5 product sources are unchanged. Preflight authorization completes before bounded streaming/decode; a separate final transaction rechecks session/access/state and locks the same ticket used by handling. Ticket+uploadId uniqueness, exact duplicate recognition and the three-photo limit are serialized by that lock. Original ticket body/evidence/decision/status/version/events remain unchanged by attachment writes.

Installed sharp0.35.4 was loaded under isolated Node24.21.0/npm11.19.0 and retained as an exact Web direct dependency. The minimal lock delta adds that direct edge, registry integrity and required flags for its existing transitive nodes; no version upgrades or install scripts. Apache-2.0 codec. Input MIME, signature and real decode are checked;5MiB streamed bytes,20MP, one image, JPEG/PNG only; orientation is applied and output is re-encoded without original metadata. See [sharp output](https://sharp.pixelplumbing.com/api-output/) and [orientation](https://sharp.pixelplumbing.com/api-operation/). Tests use real synthetic decoded images; no LLM/photo-diagnosis claim.

The53-entry B5 frozen inventory retains every original hash. A narrowly asserted inverse of the explicitly authorized sharp manifest/lock delta is applied before the two original dependency hashes; all other bytes and original negative controls remain checked. RC1 catalog inventory expands to the exact new table/four functions. No broad skip, relaxed count, timeout increase or workflow change.

## Local evidence on the candidate source

Windows, project-isolated Node24.21.0/npm11.19.0; synthetic PostgreSQL18.6 containers. Logs remain private, with concise receipts only. All entries below are distinct executions, not copied from earlier PR70 CI.

| Command/check | Result |
| --- | --- |
| Initial typecheck | FAILED: binary HeadersInit typing; corrected without changing transport authority |
| Focused photo PostgreSQL |5/5,1file PASS, exit0 |
| Focused Web photo/HTTP |11pass/1fail: old exact CORS header inventory; add X-Upload-Id explicitly, retain exact comparison |
| Initial shared |437pass/1fail: expected B5 manifest byte freeze; narrow authorized inverse added, all original hashes retained |
| Initial/follow-up lint | FAILED on state updates in effects; Web/native galleries now remount by ticket/revision and clean object URLs/listeners normally |
| Later typecheck attempts | FAILED on two new test-only generic/literal annotations; corrected; final typecheck exit0 |
| `npm run test:shared` |438/438,36files PASS, exit0 |
| `npm run test:web` |471/471,40files PASS, exit0 |
| `npm run test:postgres` |310/310,30files PASS, exit0,403.55s; complete regression |
| `npm run typecheck`, `npm run lint`, `npm run build:web`, `npm run check:deps` | PASS, exit0; lint retains two pre-existing warnings plus three private-blob img optimization warnings |
| `playwright test --config playwright.core.config.ts` in apps/web | Initial10/10 and second10/10 PASS; after partial-batch visibility improvement final11/11 PASS,13.3s, zero retries; original7 retained |
| `node scripts/core-flow-restart-check.mjs` | PASS, exit0; two distinct owned server PIDs, exact ticket/version/events plus exact JPEG bytes/metadata, tenant and manager reread |
| `npm run test:e2e:web` with BUILD_MANAGER_E2E_PREBUILT=1 |23/23 PASS, exit0 |
| `npm run test:e2e:b1` with BUILD_MANAGER_E2E_PREBUILT=1 |60/60 PASS, exit0; full-result checker60tests/21negative controls/0fail/0skip/0retry |
| `npm run test:mobile -- --no-cache` | FAILED, exit1:138pass/1fail,14pass/1failed suite; existing tenant-ticket loading test exceeded5000ms,46.102s. Failure retained. |
| Focused changed Mobile after gallery lifecycle fix, `jest --runInBand --no-cache src/features/core-photos.test.tsx src/features/core-flow.test.tsx` | FAILED, exit1:5pass/1fail; both new photo cases pass, existing core-flow first render/sign-in test exceeded5000ms. Separate from earlier whole-suite failure. |
| One bounded instrumented cold Mobile diagnostic | FAILED, exit1:3pass/1fail; first render4692ms and sign-in4922ms from test start, first test6437ms. Temporary timing marks were removed; no credentials or native execution. Timing observation does not establish the original whole-suite cause. |
| Focused Mobile after rendering the enlargement Modal only when opened |6/6,2suites PASS, exit0,10.462s; original timeout values/assertions retained. Not a replacement for the failed whole-suite run. |
| Final `npm run test:mobile -- --no-cache` after that code change |139/139,15suites PASS, exit0,28.778s. A required regression after a real implementation change; no retry loop. Earlier failures remain recorded with their own evidence and unresolved general cause. |
| `expo-doctor@1.20.4 --version` and `expo-doctor@1.20.4 .` | Exact1.20.4;21/21 PASS, exit0 |
| `expo export --platform android` / `--platform ios` to new private directories | PASS, exit0;29/25files, JS/assets only. No dev server, phone or APK execution. |
| Scanner regression tests |3+14 PASS, exit0; full staged public/history scan recorded at publication |

Private log SHA256 receipts (original failed logs retained):

- photo-mobile-cold.log:9c548d02ca5879f58f706346f39dc594ab84dca41cb2374507b126e7309579b1
- photo-mobile-targeted-final.log:0b483d67761dc5d588b9d369abbeabbc13ec0881e1d38f48c82c489e5e09bdcd
- photo-mobile-bounded-diagnostic.log:2dcc92fbdc99d955c0fd50f06467f0427f6e5df12df8e7206d388e61d17c9602
- photo-mobile-targeted-lazy-modal.log:02f8dfa10f15fb190a54036640f029a38c73a7011b9c518578e0a010378b063e
- photo-mobile-final-cold.log:e06e2e926542829bd4dc04ec310c36468513ec1a5a662d9d88d922385df956ca
- photo-postgres-full.log:796c7cf8ba4aed6f77379ddeb36854af97223e58e61a2caa8d8a5c21b4ffbe69
- photo-browser-delivery.log:d7893c2844e0484cf95b9a691654006c12fc8ea52010b9a3e9a77829d0a6af0b
- photo-restart.log:c0b663eb935581c8e50c5c869394473da23277e0280ee03b9eae77a91ac027c3

After the final Mobile change, typecheck/lint and both platform exports were repeated successfully on that source (Android29/iOS25 files). The final Web build is running on loopback3130. A separate live3130 capture reopened the existing two-photo ticket as tenant and manager, waited for real image decoding, and wrote private390px screenshots; no generated image is used as application execution evidence.

The Web browser cases save actual generated PNG/JPEG fixtures via the API/DB, then render them on320px/390px tenant and manager screens, enlarge them, and reopen them in a fresh browser. Stored images load with nonzero natural dimensions; horizontal overflow is absent. Separate controlled network failures test retained selections, partially saved batches and response-loss reconciliation, not network reliability. API checks cover201/200 idempotence,409 different-image/limit/completed conflicts, simultaneous third/fourth requests,401anonymous,403manager/staff writes,404co-occupant/foreign reads/writes, malformed/oversized/MIME-mismatched input and private no-store/nosniff responses. Codec tests verify20MP rejection, false/missing Content-Length, orientation and EXIF/GPS removal. PostgreSQL checks cover pool restart, exact body/evidence/version/event preservation, binding photo to its ticket, ended assignment/membership/occupancy, expired/revoked sessions, direct-table denial and exact catalog exposure.

## Retained limits and publication boundary

The earlier local Mobile failures are retained as FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED evidence; final source passed139/139 after the new enlargement window was deferred until use. This observed improvement does not diagnose or erase the initial whole-suite timeout. The original tenant test/component/config bytes match the starting HEAD; common API client/contracts gained photo transport/types, so unchanged test source alone does not establish non-regression. No prior B3/B5 BASE comparison was repeated. No timeout, skip, expectation or CI setting was weakened. Hosted success will not resolve the retained local failures.

Final exact HEAD, ordinary push/readback, public scanner counts and required nine job/run IDs are recorded on [Draft PR70](https://github.com/edward321416-maker/build-manager/pull/70) after freeze. Previous3b71970 CI is a different generation. No commit is added solely to embed its own resulting SHA. Remaining work: resolve/accept the disclosed current Mobile failures, formally permitted Expo/device execution, and later real login/push/photo lifecycle or pagination scope. No real personal data or operational service was used.

Installed fullstack-guardian and playwright-expert guided implementation and actual browser validation. Initial bookkeeping incorrectly reported Google transports unavailable. Narrower discovery found the native Google Drive connectors; google-docs/google-sheets skills were read, the existing approved destinations were inspected, and the current photo summaries plus correction were written/read back at AI_Execution_Log A179:D180. Historical queues remain separate. The optional Docs file bridge encountered a Windows mkdir permission error; the native full document read already exposed its single plain-text tab and exact current fields. Final rolling handoff/CI reconciliation follows publication, with revision guard/readback and no private destination IDs in Git. See [run instructions](../docs/core-flow-rc1-running.md). Original evidence logs and queues remain intact.

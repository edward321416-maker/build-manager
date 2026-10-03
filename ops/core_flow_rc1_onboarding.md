# RC1 invitation and tenant connection execution

Authorization: [PR70 operator receipt5969526294](https://github.com/edward321416-maker/build-manager/pull/70#issuecomment-5969526294). Start HEAD `2d63b6f58fdf7683fe055c59dab20e32f1f1ea3c`; policy/base `e9144fac807f39544932baac25b11f836658dbb3`. Existing worktree, branch and prior uncommitted runtime receipts are preserved. No additional planning/review gate is introduced.

The implementation adds a separate B1-only capability owner and migration0014. Actor-scoped inspect/claim/status precede organization selection. Only a current ORG_ADMIN can create or decide invitations for a vacant ACTIVE unit. The exact creating membership must remain valid. Organization, unit and invitation locks serialize decisions with B5; approval and the new occupancy/member are atomic. Existing migrations0001–0013 and B1–B5 product source remain frozen.

Tokens use Node crypto32bytes as lowercase hex and SHA256-only DB storage; TTL is24hours from the DB clock. Actor attempts use a shared rolling60second DB window capped at20. The fragment is removed before explicit inspection; opening a link never submits a request. Raw links exist only in the create response and browser memory, with manual clipboard delivery. Lists use20-row cursor pages. Current request number confirmation, no self approval, no existing-occupancy changes, and read-before-retry recovery are enforced. No provider callback/returnTo or session-key changes.

## Development evidence

All commands use isolated Node24.21.0/npm11.19.0 on Windows; PostgreSQL18.6 disposable test containers. These are development results, not final integrated acceptance or new hosted CI.

- Behavioral RED: Web onboarding test with a valid authenticated zero-org actor expected its requests200; existing organization gate returned400. Exit1,1test failed, no import error.
- First SQL implementation run:15failed due to a missing runtime schema USAGE grant and test name-array decoding. Corrected only the new migration/test. Second run14passed/1failed because the B5 race fixture omitted required digest context. The corrected fixture calls existing authorization/context and asserts ENDED before observing the actual lock wait. Third run15/15PASS,1suite,exit0.
- Web targeted boundary:12/12PASS,1suite,exit0; prior B1 session boundary4/4 also passed. CoreB1zero-org regression is GREEN.
- Initial typecheck failed on an overly narrow route-map key assertion; fixed the typed action map. Web typecheck passed afterward.
- First integrated verify:shared437passed/1failed,36suites,exit1. The exact frozen package manifest inventory detected the authorized additional export. Added an assertion for precisely that export before the existing unchanged manifest comparison; no original hash or negative control removed.

- B2/B3/onboarding combined24tests:23passed/1failed at the newly added owner membership inventory. Exact owner/current_actor grant and six named restrictive-policy additions were incorporated while retaining all original assertions; B2+onboarding20/20PASS afterward. New capability tests assert all10new policies and the exact owner membership.
- Integrated verify subsequently passed shared438/36suites, lint, all typechecks, production Web build and dependency checks; exit0. Existing lint warnings remain.
- Local migration0014-only application succeeded. All existing rows in12tables matched their pre-migration fingerprints; no reseed or session renewal performed.
- First B1 browser run:9passed/6failed of15,exit1. Three old round-trips assumed the manager's first sorted unit was the tenant test unit; the preceding authorized live dedicated unit changed that ordering. The tests now select their existing fixture unit explicitly, retaining assertions. Account-switch failure exposed a real duplicate React sibling key in the new panel; distinct keys fix stale protected UI. Reopening a fragment link in the same tab exposed missing hash-change handling; a fresh document now consumes it. Lost-create-response test selected Next's global empty alert before the business error, prematurely removing its route handler; scoped error assertions fix that test race. No timeout, skip or expected result was weakened. Private first-run artifacts retained.

## Integrated checks and local runtime

| Command / environment | Observed result |
|---|---|
| `npm run test:postgres` / isolated Node24.21.0, PostgreSQL18.6 disposable containers |330tests,32suites PASS,450.20s,exit0 |
| B1 login/browser configuration after corrections |15tests PASS,26.0s,exit0; original8 retained plus7onboarding cases |
| Final B1 login/browser configuration including clipboard denial |16tests PASS,24.0s,exit0; original8 retained plus8onboarding cases |
| `npm exec --workspace @build-manager/web -- playwright test --config playwright.core.config.ts` |11tests PASS,15.1s,exit0 |
| `npm run test:web` |487tests,42suites PASS,exit0 |
| `npm run test:mobile -- --cacheDirectory <new-private-task-cache>` |Fresh unique cache,139tests/15suites PASS,29.479s,exit0; prior failures remain historical |
| `npm run verify` |438shared tests/36suites, lint, all typechecks, production build and dependency checks PASS,exit0 |
| `npm run test:e2e:b1` + `node apps/web/tests/b1-e2e/check-results.mjs` |60tests PASS,38.0s; checker60/0failed/0skipped/0retries with21negative controls,exit0 |
| `npm run test:e2e:web` |First start NOT_RUN: concurrent B1 build held the shared build lock,exit1. Sequential run after B1 completion23tests PASS,25.1s,exit0. No build-lock deletion or timeout change |
| Pre-existing local rows |All recorded old rows across12tables preserved; new isolated SDK fixture rows and test tickets are additive |
| Repository scanner regressions |3 original tests and14 scanner regression tests PASS,exit0; public index/history scan is a separate pre-push check |

The old DEMO browser regression required renewing its existing synthetic access-code sessions with the existing `--prepare` path. It reported no migrations and did not reseed any existing fixture. Actual Auth0 settings/cookie keys and prior relationships were not changed. Separate synthetic browser fixtures create their own organization/actors, with no privilege additions to existing accounts.

Actual-use preparation verified the existing approved manager scope and found no vacant unit there, so exactly one empty synthetic unit was added. The manager created its invitation through the new app screen. No occupancy/member was inserted by runtime preparation. Browser clipboard writing initially returned NotAllowedError; after allowing clipboard-write only for that controlled local browser origin, the actual copy button succeeded. The UI now explains a blocked copy without suggesting a duplicate create, and a focused regression covers the denied-copy case. Raw token remains absent from DOM/screenshots/logs and DB storage.

An actual Auth0 browser was opened for the existing test account; the operator login response is pending. The real-account invitation request/approval/photo continuation is NOT_VERIFIED yet, separate from the passing synthetic SDK browser flow and preceding actual Auth0/photo evidence. No replacement synthetic tenant authentication will be presented as real login. Publication and new fixed-head hosted CI follow the final candidate checks.

Earlier actual tenant/photo execution and historical Mobile failures retain their original evidence generation. AC-D06 NOT_VERIFIED, desktop acceptance and Expo policy restriction remain unchanged. No Ready conversion, merge or deployment is authorized.

Execution summary was appended to the existing authorized native Google Sheet at A208:D208 and read back. No token, account identifier, credential or private destination identifier was published. Rolling handoff synchronization and the final candidate receipt are recorded separately as they complete.

## Publication safety checkpoint

Named paths only were staged. `git diff --cached --check` passed. The staged tree preserved all55selected frozen paths against START_HEAD, including all13existing migrations, B1–B5 product modules, the common transaction module, lock/runtime pins and workflows. Existing architecture byte-hash tests also passed. `python scripts/verify_repository.py --history` inspected561public files,280internal links and1409reachable historical blobs with0findings,exit0. Subsequent receipt-only edits are checked again before committing; the committed tree must equal the checked index tree. The existing Draft still points at START_HEAD before publication. New fixed-head CI is NOT_RUN at this checkpoint.

Native Google execution A208:D208 and eight rolling handoff fields were written and read back. Earlier queues remain unchanged. Actual Auth0 tenant continuation still awaits operator login, with no fabricated completion or synthetic substitution.

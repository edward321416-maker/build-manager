# RR01 Web predeployment hardening candidate

Snapshot:2026-10-05. Local candidate verification is complete. Publication is **Draft only / NOT_READY / NOT_MERGED / NOT_DEPLOYED**; independent fixed-candidate review is pending. Exact candidate SHA, Draft PR and fresh hosted results are recorded in the subsequent [Issue72 candidate packet](https://github.com/edward321416-maker/build-manager/issues/72), outside this self-referencing commit. This receipt does not claim hosted success before those checks finish.

## Authority and preserved state

BASE_MAIN / POLICY_REF: `954ef347efef9db29465aefa2e72003b176ee150`.
Branch: `chore/rr01-predeploy-next-16-3-8-ci-gates`.

Issue72 authority: [predeployment authorization5995544213](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5995544213), [original directive5995575544](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5995575544), [first STOP5995952967](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5995952967), [independent STOP acceptance5996025572](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5996025572), [AC17 gate review5996143273](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5996143273), [AC17 authorization5996150407](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5996150407), [successor directive5996165910](https://github.com/edward321416-maker/build-manager/issues/72#issuecomment-5996165910).

Live main and preserved branch HEAD both matched the exact base at continuation entry. The previously uncommitted three-file patch matched the original private unified diff exactly; the first STOP receipt and failed log were fingerprinted before editing. Existing worktrees, dirty records, private settings, prior test artifacts, database and photos were preserved. No reset/rebase/stash/clean/history rewrite occurred.

## Exact candidate scope

Changed paths:
- `apps/web/package.json`
- `package-lock.json`
- `.github/workflows/app-check.yml`
- `tests/architecture/b5-boundary.test.ts`
- `ops/rr01_predeployment_hardening.md`
- append-only task records in `ops/AI_Execution_Log.csv` and `ops/pending_external_sync.md`.

Both direct versions change16.3.4 ->16.3.8: `next` and `eslint-config-next`. The latter remains a devDependency. React/react-dom, Auth0, TypeScript, Playwright, Expo and every other direct declaration are unchanged. The existing sharp0.35.4 addition is preserved and is not part of this new successor delta.

The lock was generated once by the authorized package-manager command, then installed once with `npm ci --ignore-scripts --no-audit --no-fund`; both exited0 in the prior attempt and were not repeated. Install did not modify the lock. Independent JSON comparison derived **72 changed fields across25 package entries**: the Web workspace declaration,12 Next-family version updates, and12 resolution/integrity-only entries in the approved dependency closure. Reversing exactly those fields reproduces the base JSON. No package entry or unrelated graph change is ignored.

Only four logical steps were inserted in existing `web-e2e`, in this order: single existing build -> Core prepare -> Core -> SDK prepare -> SDK Core -> unchanged standard Web -> unchanged B1/checker. Job names/count, runners, timeouts, Node/npm verification, npm ci, Chromium, existing commands and other jobs are preserved. The acceptance set remains9 jobs. Branch protection/settings were not modified.

## AC17 acceptance-oracle change

**Original B5 hashes changed = NO. Frozen assertions removed/weakened = NO.**

The only newly authorized technical file is `tests/architecture/b5-boundary.test.ts`. Imports/frozen map and the code after the bounded normalization section retain their original bytes. The original final full-file SHA256 assertion remains.

- Workflow: a literal exact18-line successor block is asserted once; the seven build/Core/SDK/Web/B1 anchors are unique, ordered and inside existing web-e2e. Only that exact block is removed in memory before the original hash comparison.
- Manifest: Next and eslint-config-next must each equal16.3.8; only those values revert to16.3.4 in memory, then the existing exact sharp normalization runs unchanged.
- Lock: the complete sorted72-row JSON-path table is explicit in the test. Every path must exist with its exact successor value. Only that field is restored to its exact baseline, or deleted for baseline ABSENT. Existing sharp normalization then runs unchanged. Unlisted drift is still rejected by the original whole-file hash.

Original baseline hashes remain:
- workflow: `ab681452c8acb317fc2d00bd43d07b23b3f4c048c9799341be70812e701dd6f3`;
- Web manifest: `b9281baa310f2772de79d47fe9f31bb74dbdf25798259db9732940830162c7b0`;
- lock: `772e2956bfd8689bb382a2d8c4a9103f8a126d72dcb05449f9863d176d2d450f`.

No candidate-hash bypass, version range, wildcard package deletion, ignored integrity/resolved value or broad exemption was added. This acceptance-oracle change itself is part of the candidate requiring independent review; executor checks are not an independent review.

## Verification generations

Environment: Windows/PowerShell7.6.6, project-isolated Node24.21.0/npm11.19.0, Playwright1.63.0, Docker29.8.0, retained marked synthetic PostgreSQL18.6. Commands ran on the preserved base worktree plus the exact candidate delta later committed. No technical edit followed the test generation.

Historical failed generation:
- `npm run verify`:457/458 Shared tests;40/41 files; exit1 at AC17 workflow frozen hash.
- Observed workflow hash: `f20da2142908e54eee80979ae52c5db626d76e0c2673a896d19b490469511601`.
- Rerun at that authority stage: **NO**. All then-later phases remained NOT_RUN and STOP5995952967 was published/read back.
- Raw failed log SHA256: `b6339286c3ad3087100eeb8c19f7b6766c91b95ea06eaf57fb36df199149a5b3`.

Successor-normalized generation, separately authorized by5996150407:

| Command | Actual result | Class |
| --- | --- | --- |
| `npm run test:shared -- tests/architecture/b5-boundary.test.ts -t "AC17 frozen foundation, dependency and workflow inventory retains canonical bytes"` |Once; exit0;1 targeted PASS,2 non-target cases filtered by the prescribed selector; no skip added|EXECUTOR_LOCAL|
| `npm run verify` |Once; exit0; Shared458/41; lint/typecheck/build:web/check:deps all passed;5 existing non-error lint warnings retained|EXECUTOR_LOCAL|
| `npm run test:web` |Once; exit0;551 tests/54 files PASS|EXECUTOR_LOCAL|
| `npm run test:postgres` |Once; exit0;396 tests/36 files PASS;479.58s reported|EXECUTOR_LOCAL + ACTUAL_WEB_POSTGRES|
| `node --experimental-transform-types scripts/core-flow-dev.mjs --prepare` |Once; exit0; read-only prerequisite found all7 existing access sessions expired; marker verified; DB retained|SYNTHETIC_AUTH setup|
| `npm exec -- playwright test --config playwright.core.config.ts --workers=1 --retries=0` |Once;32 PASS; exit0;1.1m|EXECUTOR_LOCAL + SYNTHETIC_AUTH + ACTUAL_WEB_POSTGRES|
| `node --experimental-transform-types scripts/core-flow-b1-dev.mjs --prepare-synthetic-sdk` |Once; exit0|SYNTHETIC_AUTH setup|
| `npm exec -- playwright test --config playwright.core-login.config.ts --workers=1 --retries=0` |Once;34 PASS; exit0;1.3m|EXECUTOR_LOCAL + SYNTHETIC_AUTH + ACTUAL_WEB_POSTGRES|
| `npm exec -- playwright test --config playwright.config.ts --workers=1 --retries=0` |Once;23 PASS; exit0;23.7s|EXECUTOR_LOCAL; standard demo/SQLite Web|
| `npm exec -- playwright test --config playwright.b1.config.ts --workers=1 --retries=0` |Once;60 PASS; exit0;35.0s|EXECUTOR_LOCAL + SYNTHETIC_AUTH + ACTUAL_WEB_POSTGRES|
| `node apps/web/tests/b1-e2e/check-results.mjs` |exit0;60 expected/failed0/skipped0/retries0/negativeControls21|EXECUTOR_LOCAL exact-report validation|

Browser commands ran from apps/web with artifact-only `--output <new-private-evidence>/<suite>-test-results` and separate last-run destinations. All other commands ran from root. Standard/B1 used process-local BUILD_MANAGER_E2E_PREBUILT=1 and the single patched build produced by verify. Environment values were restored. No historical artifact was overwritten; the new worktree had no preexisting B1 result directory. Counts are tests, not coverage. No new LIVE_PROVIDER evidence is claimed.

All five restart helpers ran sequentially once, with3132 checked free before each. Each exited0:
- `node scripts/core-flow-restart-check.mjs`: RC1_PHOTO_RESTART_PASS / RC1_SERVER_RESTART_PASS.
- `node scripts/core-manager-work-restart-check.mjs`: MANAGER_WORK_RESTART_PASS.
- `node scripts/core-ticket-communication-restart-check.mjs`: PUBLIC_QA_HTTP_RACES_PASS / PUBLIC_QA_RESTART_PASS.
- `node scripts/core-ticket-outcome-restart-check.mjs`:5 cases PASS; source immutability, one direct target, photo bytes and receipts persisted.
- `node scripts/core-maintenance-fact-restart-check.mjs`:3 cases PASS; append-only chain, completion time, dynamic outcome/relations, exact replay and changed-input409 persisted.

Auxiliary evidence-tool loader/binding and old-receipt-location errors were retained separately. They occurred outside repository commands; read-only observations/readbacks used the matching existing pg client and exact discovered receipt. No repository test, prepare, helper or audit command was repeated because of them.

## Fresh security evidence

Both audits ran once, returned valid advisory JSON with exit1 and no transport error:

| Command | Critical | High | Moderate | Total affected entries |
| --- | ---: | ---: | ---: | ---: |
| `npm audit --json --ignore-scripts` |0|54|11|65|
| `npm audit --omit=dev --json --ignore-scripts` |0|47|11|58|

Neither reports `next`. There are7 distinct remaining advisory URLs. The [maintainer16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8) identifies its security fixes; the earlier [ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) has a16.3.6 patch floor. Installed Next/eslint-config-next16.3.8 was directly read back. No new release-blocking Web advisory was established in this bounded audit; this is not a complete exploitability/security-program certification.

Prior R02 full66/omit-dev60 inventories remain prior-generation evidence. Current full inventory drops Next. Current omit-dev drops Next and no longer lists @testing-library/react-native; no unrelated package was upgraded, and the second inventory difference is not credited as remediation.

`npm explain next braces brace-expansion node-forge decode-uri-component uuid --json` exited0. Remaining relevant ancestry:
- braces3.0.3 and affected brace-expansion5.0.9: Web ESLint/TypeScript-ESLint development paths plus Mobile/tooling paths;
- node-forge1.4.0: Expo CLI/code-signing ancestry;
- decode-uri-component0.2.2 and uuid7.0.3: Mobile query-string/router and xcode/config-plugin ancestry.

These remain **MAINTENANCE_BACKLOG**; severity alone is not asserted to prove Web exploitability. All observed non-Next ancestry reaching the Web workspace went through a dev dependency.41 production NFT manifests had0 installed-package-path matches for those five names. That bounded check does not inventory every framework-bundled copy or constitute exploit testing. Mobile production ancestry remains present in omit-dev; no audit fix or additional dependency upgrade occurred.

## Public safety and lifecycle

Canonical scanner regressions: root3 PASS, scripts14 PASS. `python -B scripts/verify_repository.py --history` exited0 on the staged technical delta plus base public tree:642 files/324 internal links/1748 reachable history blobs/findings0. This receipt and append-only bookkeeping are then staged and the final complete public tree is rechecked with the same canonical scanner before commit/push; its exact result belongs to the candidate packet. `git diff --check` passed. Publication additionally uses the canonical content scanner and known-private-value guard.

No application/API/SQL/migration/browser-test/Playwright/runtime-config change. The explicitly authorized dependency/workflow and AC17 oracle changes are disclosed above. No frozen hash/test deletion, timeout/retry increase, provider/IAM/account work, ad hoc permission/relationship change, retained relationship cleanup, DB/volume reset/delete, real tenant/property/address data, Expo dev-server/native/device/APK execution, Ready, merge or deployment. Normal supported synthetic preparation and repository-test/helper-owned synthetic writes remain separate from actual identities.

AC-D06 remains **NOT_VERIFIED / ACCEPTED_NON_BLOCKING_HISTORICAL_RESIDUAL_FOR_WEB_PRIVATE_BETA**. No PASS promotion, historical-origin attribution or CSS workaround. Historical B5 Mobile failures/ROOT_CAUSE_NOT_ESTABLISHED, AC18 PARTIAL, Expo/native/device/APK NOT_RUN and phone LAN NOT_VERIFIED remain unchanged. Existing Action/runtime/glob/non-error lint warnings remain maintenance backlog. Existing static lint/typecheck and later fixed hosted Mobile jobs do not prove native runtime.

Historical failed verify, the new focused/full verify and later hosted candidate checks are separate evidence generations. Required hosted set remains verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate. The candidate packet must prove9/9 and actual hosted Core32/SDK34/Web23/B1 60/checker21 execution, not infer it from job green. Prior candidate/implementation-main/closure-main CI cannot substitute.

Focused log SHA256: `4680b4bb505bc8a777dd1d5b97ad4f45409170292d7870c535433624ba950c4d`.
New verify log SHA256: `88f1a4fd26c0c861f386f130abc6f9702974061682f8d091f2acfdd16728b2ae`.
Complete derived72-field delta artifact SHA256: `ba3f38168e44fec8f2a284f445237075fb9cd75b1dae1ddf873fe8a060ab4f1a`.
Raw screenshots/traces/private receipts/settings remain private. External Google sync is PENDING; no new transport/readback or skill installation is claimed.

Next gate after candidate publication and exact hosted verification: **INDEPENDENT_FIXED_CANDIDATE_REVIEW_RR01_PREDEPLOYMENT_HARDENING**. The executor stops there. Ready/merge/deploy remain separately unauthorized.

CHECKPOINT | RR01 hardening local candidate verified after exact AC17 normalization | evidence=base954ef347 / auth5996150407 / focused1 / Shared458 Web551 PostgreSQL396 / Core32 SDK34 Web23 B1-60 checker21 / restart5 / audit65-58 | tokens=unknown

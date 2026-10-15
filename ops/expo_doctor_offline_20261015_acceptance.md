# Expo Doctor offline check and weekly Expo patch alert, acceptance

Snapshot: **2026-10-15 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. One manual run of the new weekly workflow follows the merge and is recorded afterwards.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: changes `.github/workflows/app-check.yml`, which B5 AC17 freezes (`STATUS.md` FROZEN scope), and adds a workflow (DEV-01, DEV-10) |
| Operator decisions | 2026-10-15, in session: "이어서 진행해줘" after the session recommended this item first among four; design "A안 승인 (추천)" (other options: "B안: 오프라인 점검만", "C안: 지금처럼 두기"), decided from the visual page of the design |
| Origin | Expo's SDK 57 patch releases of 2026-10-12 and 2026-10-14 each failed `mobile-health` on every PR until high-risk PRs #130 and #158 took them; both design records left this follow-up open |
| Design and plan | [Design](../docs/superpowers/specs/2026-10-15-expo-doctor-offline-design.md), [plan](../docs/superpowers/plans/2026-10-15-expo-doctor-offline.md) (written after the approval, before the implementation) |
| Policy | `POLICY_REF` main `1684080`; the rulebooks are unchanged since `446ee50` |
| Base | main `1684080` |
| Independent review | Fresh-context review agent, read-only, on `509d5a9`: **With fixes**, nothing blocking. Four LOW findings, all fixed before the merge: (1) the weekly run passed silently when Expo's service could not be reached, because @expo/cli then falls back to the local list and exits 0; (2) the workflow test pinned less than claimed (a single-space line ended the trigger capture, `uses:` with two spaces and `secrets['X']` slipped past, a step-level `if: false` went unseen); (3) the "moved step" case only copied the step, and the design said "3줄" for two added lines; (4) the replay ran @expo/cli 57.0.29, not 57.0.30. Nits taken: the base and DEV-06 timing note below, and the wording on `expo config`. Delta review of `25870e8..f5ff040`: **APPROVE**; all four fixed, the three fallback strings are exactly @expo/cli 57.0.30's and no live `install --check` path prints them; one optional LOW (a quoted `"uses":` key went unseen) and a nit (a list-item `- if:` went unseen) were fixed afterwards in the test, with two more mutants |
| PR | Recorded in the PR body with its final head and that head's CI |

## Facts read from the installed versions

- Expo Doctor 1.20.4 (MIT), check "Check that packages match versions required by installed Expo SDK": it runs the project's own `expo/bin/cli install --check --json` and passes the environment through.
- @expo/cli 57.0.30 (the locked version): with `EXPO_OFFLINE` set it fetches neither the native-module list nor the SDK related-package list and compares with `expo/bundledNativeModules.json` from the installed `expo` 57.0.29; it warns "Dependency validation is unreliable in offline-mode".
- Doctor's own bundle has no offline switch, so its network checks (for example React Native Directory) stay online. The variable also reaches the `expo config` run that the checks share; the result was the same both ways (21/21).
- When Expo's service cannot be reached with `ENOTFOUND`, `EAI_AGAIN` or `UND_ERR_CONNECT_TIMEOUT` (`api/rest/client.js`), @expo/cli logs "Networking has been disabled", switches itself to offline mode, falls back to the local list ("Unable to reach well-known versions endpoint", "Dependency validation is unreliable in offline-mode") and `install --check` still exits 0. A refused connection fails instead. Its API responses are cached under the Expo home directory unless `EXPO_NO_CACHE` is set.
- Offline, 24 of the 32 mobile dependencies are still compared. `expo` itself, `typescript` and `@types/react` are compared only online, which the weekly run does. The other 5 are not in any Expo list.

## Change

- `.github/workflows/app-check.yml`: the `mobile-health` step "Verify pinned Expo Doctor and run health checks" alone gets `env: EXPO_OFFLINE: "1"`. Every other byte is unchanged.
- `tests/architecture/b5-boundary.test.ts`: `projectExpoDoctorOffline` requires that exact step once and no other `EXPO_OFFLINE`, reverses only the env block, and runs before the Task12 projection in the inventory and Task12 tests. A new test rejects other values, an unquoted value, an extra variable, the block on the export step or workflow-wide, a changed Doctor pin, a swallowed Doctor failure, a removed block, a second copy of the Doctor step and the Doctor step moved after the export step.
- `.github/workflows/expo-updates.yml` (new, "Expo updates"): Mondays 00:41 UTC and manual runs only, this repository only, `contents: read`, no secrets, the same pinned action commits as `app-check.yml`, `persist-credentials: false`; Node 24.21.0 and npm 11.19.0 checked, `npm ci`, then `npx expo install --check` online in `apps/mobile` with `EXPO_NO_CACHE: "1"`, its output saved, and a failure when that output shows the offline fallback. A failed run makes GitHub notify the user who last changed the cron line.
- `tests/architecture/expo-updates-workflow.test.ts` (new): pins the triggers (any key under `on:`), the single `if:` (also in quoted or list-item form), the token, both action commits, the runtime, `npm ci`, `concurrency`, the 20-minute limit and the whole last step byte for byte; comment lines are ignored for the content checks.
- `STATUS.md`: one paragraph in the dependency-security risk item.
- Unchanged: lockfile, every `package.json`, `app.json`, app and web code, deployment, the demo.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | The offline check misses a real version problem | It still compares with the installed `expo` package's list; the live list moves to the weekly run | Verification 4 and 5 |
| T2 | Other workflow changes slip in with the frozen-file edit | The projection reverses only the env block; every other byte stays hashed | 9 negative candidates, a copied and a moved Doctor step all fail |
| T3 | The new workflow misuses its token or runs untrusted code | Schedule and manual runs only, read-only token, no secrets, pinned commits, no `pull_request` trigger | Workflow test; 30-mutant run |
| T4 | The weekly alert stops without anyone noticing | The 60-day inactivity rule and `gh workflow enable expo-updates.yml` are in the file header; `gh workflow list` shows its state | File header |
| T5 | Patch releases are noticed but never taken | The alert only notifies; taking a release stays an operator-approved high-risk change like #158 | Design |
| T6 | Expo's service is unreachable on a Monday, so the weekly run passes without having looked | No cache; the step fails on the offline-fallback messages | Verification 6 |

## Verification

All local runs on 2026-10-15 KST with Node 24.21.0 and npm 11.19.0.

1. Baseline at main `1684080` (`apps/mobile`): Doctor online 21/21, with `EXPO_OFFLINE=1` 21/21.
2. AC17 first failure: with only the workflow change, `b5-boundary.test.ts` failed 2 of 9 on the `app-check.yml` hash (the inventory test and the Task12 projection test). With the projection and the new test: 10/10.
3. Workflow test first failure: the file was missing (structural). After the workflow: 4/4. A mutation run of 18 one-change copies (extra trigger, daily cron, write token, tag or other commit, a secret, `EXPO_OFFLINE`, `|| true`, `--fix`, no repository guard, 60-minute limit, kept credentials, `npm install`, Node 24.14.0, root directory, `continue-on-error`, `cancel-in-progress: true`, no npm version check) killed all 18. After the review fixes the run had 28 copies, adding: no `pipefail`, the offline guard removed, the guard narrowed to one message, the guard exiting 0, the cache allowed, a step-level `if: false`, a `push:` trigger after a single-space line, `uses:` with two spaces, `secrets['X']`, and an extra step after the check. All 28 were killed. After the delta review, a quoted `"uses":` key and a list-item `- if: false` made 30, all killed. The file was restored byte for byte each time.
4. Incident replay: a scratch clone at main `1d88457` (the state Expo's 2026-10-14 releases broke; expo 57.0.28 and @expo/cli 57.0.29 in that lockfile, while CI now locks 57.0.30, whose offline code paths read the same), `npm ci` in 3 minutes.
   - Doctor online: exit 1, "5 packages out of date": @expo/ui, expo, expo-constants, expo-linking, expo-router, the same five as the PR #155 and #156 failures.
   - Doctor with `EXPO_OFFLINE=1`: exit 0, 21/21.
   - `npx expo install --check` online: exit 1, the same five with their expected versions. This is what the weekly run would have reported.
5. The offline check is still a check: in that clone, `expo-router` in `node_modules/expo/bundledNativeModules.json` changed from `~57.0.26` to `~57.0.99` made the offline Doctor fail on expo-router (20/21, "1 package out of date"); with the original bytes back it passed 21/21.
6. The weekly step itself, taken byte for byte from the workflow and run under `bash --noprofile --norc -eo pipefail` with `CI` and `RUNNER_TEMP` set, in this worktree (@expo/cli 57.0.30):
   - Live: exit 0, "Dependencies are up to date".
   - Expo unreachable (a preload made DNS lookups of `*.expo.dev` fail with `ENOTFOUND`): the three fallback messages, "Dependencies are up to date", then the step's own error, exit 1. Before the fix the same simulation without the guard exited 0; with the local cache it did not even reach the network, which is why the step now sets `EXPO_NO_CACHE`.
   - One package behind (`node_modules/expo-linking/package.json` version set to 57.0.12, then restored byte for byte): "expo-linking@57.0.12 - expected version: ~57.0.13", exit 1.
7. DEV-06, run at `efc3a97` (base `1684080`) before main was merged in:
   - `test:shared`: 53 files, 674 tests passed.
   - `lint`: 0 errors (8 existing warnings, none in a changed file).
   - `typecheck`: exit 0.
   - `python scripts/verify_repository.py --history`: PASS.
   - No package file differs from main (`package.json`, `package-lock.json`, `apps/mobile/package.json`, `apps/mobile/app.json`).
   - `test:web`, `build:web` and `check:deps` were not run; no web code or dependency changed.
   - After merging main (`cb3c4f7`, then `7db1787`; neither touches the rulebooks, `.github/` or the AC17 test) and after the review fixes: the two architecture tests 14/14 and `verify_repository.py --history` PASS, rerun each time.
8. CI at `f5ff040` (run 38722413392): all 9 check runs passed; the `mobile-health` log shows `EXPO_OFFLINE: 1` on the Doctor step, `expo-doctor=1.20.4` and "21/21 checks passed". The final head adds only the two test-regex changes and this record, and its own CI is in the PR body.
9. DEV-04 step 4: no database or screen code changed, so `test:postgres` and the screen suites run as the PR's CI jobs (`postgres-integration`, `web-e2e`) on the final head; the `mobile-health` log of that head shows the offline Doctor result.

## Rollback

- `git revert -m 1` of the merge commit restores the workflow line, removes the projection, the tests and the weekly workflow. No data, deployment or lockfile changes.
- After a revert, the next Expo patch release fails every PR again.

## Retained risks and not verified

- Doctor's network-dependent checks that ignore `EXPO_OFFLINE` (for example the React Native Directory check) can still change their result without a repository change.
- The weekly run only notifies; nobody is forced to act, and a scheduled run that GitHub skips or delays gives no signal.
- The offline-fallback guard matches @expo/cli 57's messages; a later CLI that words them differently would pass silently again. The workflow test pins the messages, so a change to them is a reviewed change.
- Not verified before the merge: the weekly workflow on GitHub (the manual run follows the merge) and that GitHub's notification reaches the operator.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

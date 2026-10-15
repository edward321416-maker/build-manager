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
| Independent review | Recorded below before the merge |
| PR | Recorded in the PR body with its final head and that head's CI |

## Facts read from the installed versions

- Expo Doctor 1.20.4 (MIT), check "Check that packages match versions required by installed Expo SDK": it runs the project's own `expo/bin/cli install --check --json` and passes the environment through.
- @expo/cli 57.0.30 (the locked version): with `EXPO_OFFLINE` set it fetches neither the native-module list nor the SDK related-package list and compares with `expo/bundledNativeModules.json` from the installed `expo` 57.0.29; it warns "Dependency validation is unreliable in offline-mode".
- Doctor's other 20 checks do not read `EXPO_OFFLINE`; its own bundle has no offline switch.
- Offline, 24 of the 32 mobile dependencies are still compared. `expo` itself, `typescript` and `@types/react` are compared only online, which the weekly run does. The other 5 are not in any Expo list.

## Change

- `.github/workflows/app-check.yml`: the `mobile-health` step "Verify pinned Expo Doctor and run health checks" alone gets `env: EXPO_OFFLINE: "1"`. Every other byte is unchanged.
- `tests/architecture/b5-boundary.test.ts`: `projectExpoDoctorOffline` requires that exact step once and no other `EXPO_OFFLINE`, reverses only the env block, and runs before the Task12 projection in the inventory and Task12 tests. A new test rejects other values, an unquoted value, an extra variable, the block on the export step or workflow-wide, a changed Doctor pin, a swallowed Doctor failure, a removed block and a moved step.
- `.github/workflows/expo-updates.yml` (new, "Expo updates"): Mondays 00:41 UTC and manual runs only, this repository only, `contents: read`, no secrets, the same pinned action commits as `app-check.yml`, `persist-credentials: false`; Node 24.21.0 and npm 11.19.0 checked, `npm ci`, then `npx expo install --check` online in `apps/mobile`. A failed run makes GitHub notify the user who last changed the cron line.
- `tests/architecture/expo-updates-workflow.test.ts` (new): pins those triggers, token, actions, runtime, command, `concurrency` and the 20-minute limit; comment lines are ignored for the content checks.
- `STATUS.md`: one paragraph in the dependency-security risk item.
- Unchanged: lockfile, every `package.json`, `app.json`, app and web code, deployment, the demo.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | The offline check misses a real version problem | It still compares with the installed `expo` package's list; the live list moves to the weekly run | Verification 4 and 5 |
| T2 | Other workflow changes slip in with the frozen-file edit | The projection reverses only the env block; every other byte stays hashed | 9 negative candidates and a moved step all fail |
| T3 | The new workflow misuses its token or runs untrusted code | Schedule and manual runs only, read-only token, no secrets, pinned commits, no `pull_request` trigger | Workflow test; 18-mutant run |
| T4 | The weekly alert stops without anyone noticing | The 60-day inactivity rule and `gh workflow enable expo-updates.yml` are in the file header; `gh workflow list` shows its state | File header |
| T5 | Patch releases are noticed but never taken | The alert only notifies; taking a release stays an operator-approved high-risk change like #158 | Design |

## Verification

All local runs on 2026-10-15 KST with Node 24.21.0 and npm 11.19.0.

1. Baseline at main `1684080` (`apps/mobile`): Doctor online 21/21, with `EXPO_OFFLINE=1` 21/21.
2. AC17 first failure: with only the workflow change, `b5-boundary.test.ts` failed 2 of 9 on the `app-check.yml` hash (the inventory test and the Task12 projection test). With the projection and the new test: 10/10.
3. Workflow test first failure: the file was missing (structural). After the workflow: 4/4. A mutation run of 18 one-change copies (extra trigger, daily cron, write token, tag or other commit, a secret, `EXPO_OFFLINE`, `|| true`, `--fix`, no repository guard, 60-minute limit, kept credentials, `npm install`, Node 24.14.0, root directory, `continue-on-error`, `cancel-in-progress: true`, no npm version check) killed all 18; the file was restored byte for byte.
4. Incident replay: a scratch clone at main `1d88457` (the state Expo's 2026-10-14 releases broke; expo 57.0.28), `npm ci` in 3 minutes.
   - Doctor online: exit 1, "5 packages out of date": @expo/ui, expo, expo-constants, expo-linking, expo-router, the same five as the PR #155 and #156 failures.
   - Doctor with `EXPO_OFFLINE=1`: exit 0, 21/21.
   - `npx expo install --check` online: exit 1, the same five with their expected versions. This is what the weekly run would have reported.
5. The offline check is still a check: in that clone, `expo-router` in `node_modules/expo/bundledNativeModules.json` changed from `~57.0.26` to `~57.0.99` made the offline Doctor fail on expo-router (20/21, "1 package out of date"); with the original bytes back it passed 21/21.
6. DEV-06 at the implementation head:
   - `test:shared`: 53 files, 674 tests passed.
   - `lint`: 0 errors (8 existing warnings, none in a changed file).
   - `typecheck`: exit 0.
   - `python scripts/verify_repository.py --history`: PASS.
   - No package file differs from main (`package.json`, `package-lock.json`, `apps/mobile/package.json`, `apps/mobile/app.json`).
   - `test:web`, `build:web` and `check:deps` were not run; no web code or dependency changed.
7. DEV-04 step 4: no database or screen code changed, so `test:postgres` and the screen suites run as the PR's CI jobs (`postgres-integration`, `web-e2e`) on the final head; the `mobile-health` log of that head shows the offline Doctor result.

## Rollback

- `git revert -m 1` of the merge commit restores the workflow line, removes the projection, the tests and the weekly workflow. No data, deployment or lockfile changes.
- After a revert, the next Expo patch release fails every PR again.

## Retained risks and not verified

- Doctor's network-dependent checks that ignore `EXPO_OFFLINE` (for example the React Native Directory check) can still change their result without a repository change.
- The weekly run only notifies; nobody is forced to act, and a scheduled run that GitHub skips or delays gives no signal.
- Not verified before the merge: the weekly workflow on GitHub (the manual run follows the merge) and that GitHub's notification reaches the operator.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

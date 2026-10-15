# Expo SDK 57 patch update (2026-10-15) acceptance

Snapshot: **2026-10-15 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once the independent review below is clean and CI passes on the final head. This changes the mobile app's dependencies only. No deployment is needed: the hosted demo runs the Web server, which loads none of the changed packages.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: reopens the B5 AC17 frozen dependency inventory (DEV-01, `STATUS.md` FROZEN scope) |
| Operator decisions | 2026-10-15 KST, in session: take the Expo SDK 57 patch releases ("패치 올리기 (추천)"; other options: also design a way to stop the recurrence; later); then approve the [design](../docs/superpowers/specs/2026-10-15-expo-sdk57-patch-design.md) ("승인 (추천)") |
| Precedent | PR #130 (`c55010b`), [design](../docs/superpowers/specs/2026-10-13-expo-sdk57-patch-design.md), [acceptance](expo_sdk57_patch_20261013_acceptance.md) |
| Base | main `1d88457` |
| Independent review | Fresh-context review agent, read-only, on `1d88457..c07b0bc`: **With fixes**. Verified: exactly the 13 lock entries changed (of 1489); every fixture `before` equals main and every successor hash matches; the full projection chain gives the frozen lock hash and removing only the 2026-10-15 step gives main's lock byte for byte; the manifest chain gives the frozen bytes; all 12 integrity values match the registry (and the expo and xcpretty tarballs' sha512); publishers, licenses and the absence of install scripts as stated. One blocking finding: three 2026-10-13 negative cases (apps/mobile, expo, @expo/cli) now tripped the 2026-10-15 step first, so they no longer tested their own record; moved to babel-preset-expo, react-native-web and @expo/devcert. Nits taken: the projection order in the spec, the xcpretty `prepare` note, the revert caveat and the test count wording; kept: merging the two manifest projection helpers |
| PR | Recorded in the PR body with its final head and that head's CI |

## Why

Expo published SDK 57 patch releases on 2026-10-14 between 16:31 and 16:50 UTC. CI's `mobile-health` runs the pinned Expo Doctor 1.20.4, which compares installed versions with what Expo's service expects for SDK 57, so every PR failed with "5 packages out of date" and `foundation-gate` failed with it (PR #156 run 38661248322, PR #155 run 38660815789). main `1d88457`'s last CI had passed.

## Change

`npx expo install --fix` in `apps/mobile` (DEV-10), with Node 24.21.0 and the CI-pinned npm 11.19.0.

| Package | Before | After | Manifest |
| --- | --- | --- | --- |
| @expo/ui | 57.0.23 | 57.0.24 | `~57.0.23` → `~57.0.24` |
| expo | 57.0.28 | 57.0.29 | `~57.0.28` → `~57.0.29` |
| expo-constants | 57.0.21 | 57.0.22 | `~57.0.20` (unchanged; the new version fits) |
| expo-linking | 57.0.12 | 57.0.13 | `~57.0.11` → `~57.0.13` |
| expo-router | 57.0.26 | 57.0.27 | `~57.0.26` → `~57.0.27` |

- 13 lock entries changed (the `apps/mobile` workspace entry and 12 packages: also @expo/cli 57.0.30, @expo/metro-runtime 57.0.17, @expo/prebuild-config 57.0.19, @expo/xcpretty 4.4.7, expo-asset 57.0.20, expo-modules-autolinking 57.0.16, expo-modules-core 57.0.23). None were added or removed; none has an install script; all are MIT.
- `app.json` did not change; jest-expo stays the exact pin `57.0.6`.
- B5 AC17: `tests/architecture/expo-sdk57-patch-20261015-lock.json` records each entry's previous value and the hash of its new value. `projectReviewedLocks` now reverses 2026-10-15 first, then the older fixtures; `projectReviewedMobileManifest` puts the 2026-10-15 and then the 2026-10-13 manifest lines back as raw text. A new negative test covers this fixture. The 2026-10-08 negatives that used expo-asset and expo-linking (moved again here) now use @expo/metro-config, @expo/require-utils and @expo/router-server, which only that fixture reviews; the 2026-10-13 manifest negative moved from expo to expo-splash-screen.

## Supply chain

- Official registry. Publishers: alanhughes for the 11 Expo packages, as for the previous releases; philpl for @expo/xcpretty 4.4.7, one of its 13 listed maintainers and the publisher of the 4.4.6 already in use.
- The install printed install-script warnings for unrs-resolver, cpu-features, protobufjs and ssh2; all four were already in the lock before this update.
- @expo/xcpretty 4.4.7 adds a `prepare` script (`bun run clean && bun run build`) that 4.4.6 did not have. npm does not run it for registry tarball installs, so no changed entry runs a script at install. Its code change is a lookahead added to three regular expressions in `build/Matchers.js` (independent review).
- The lock's integrity values pin the downloaded files.

## Verification

All runs on 2026-10-15 KST with Node 24.21.0 and npm 11.19.0.

- Before the change: `npx expo install --check` listed the same 5 packages as CI.
- RED: with the updated lock and no fixture, 5 lock-dependent AC17 tests failed (the inventory rejected the unreviewed change).
- GREEN: `tests/architecture/b5-boundary.test.ts` 9/9 (7 AC17 tests and 2 others; again 9/9 after the review fix); `npx expo install --check` "Dependencies are up to date"; `npx --yes expo-doctor@1.20.4 .` 21/21.
- Checks at `c07b0bc` (the review fix after it changes only three negative cases in the test file, run again in `test:shared`):
  - `test:mobile`: 17 suites, 173 tests passed.
  - `test:postgres`: 49 files, 652 tests passed.
  - `test:web`: 1050 tests passed. `build:web`: compiled. `typecheck`: exit 0. `lint`: 0 errors (8 existing warnings). `check:deps`: exit 0.
  - `python scripts/verify_repository.py --history`: PASS.
  - `test:shared`: 655/658 at `c07b0bc` (three 5 s graph timeouts, #119, while a review script ran on the same machine); after the review fix, the one allowed rerun passed 658/658.
  - `npm audit --omit=dev`: 61 (16 moderate, 45 high) on this branch and on main `1d88457`; unchanged.
  - Package files unchanged after the checks. Screen suites run in CI (`web-e2e`); the changed packages are not on the Web path.

## Rollback

- `git revert -m 1` of the merge restores the lock, `apps/mobile/package.json`, the fixture and the tests together. Data and deployments are unchanged.
- After a revert, CI's `mobile-health` fails again until the patches are taken.
- If a later PR adds a review fixture whose `before` values are these versions, a plain revert of this merge also needs that later fixture reverted, or its AC17 check fails.

## Retained risks and not verified

- Every future Expo patch release will fail CI the same way until it is taken; running Expo Doctor with `EXPO_OFFLINE=1` would stop that but touches the AC17-frozen workflow and needs a separate operator decision.
- Device runs: NOT_RUN (unit tests and CI's Android and iOS exports only).
- The review fixtures grow by one per patch; an SDK 58 upgrade can reset the frozen inventory.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

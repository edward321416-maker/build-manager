# Expo SDK 57 patch update acceptance

Snapshot: **2026-10-13 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This changes the mobile app's dependencies only. No deployment is needed: the hosted demo runs the Web server, which loads none of the changed packages.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: reopens the B5 AC17 frozen dependency inventory (DEV-01, `STATUS.md` FROZEN scope) |
| Operator decisions | 2026-10-13 KST, in session: take the Expo SDK 57 patch releases ("올리기 (추천)"); then approve the [design](../docs/superpowers/specs/2026-10-13-expo-sdk57-patch-design.md) with its threats, abuse cases and rollback ("승인 (추천)") |
| Base | main `f5ff1ce` |
| Reviewed candidate | `6556962`, CI with every required check SUCCESS |
| PR | #130; its final head and that head's CI are recorded there |

## Why

Expo published SDK 57 patch releases on 2026-10-12 between 14:25 and 14:31 UTC. CI's `mobile-health` runs the pinned Expo Doctor 1.20.4, which compares installed versions with what Expo's service expects for SDK 57, so it failed on every PR without any repository change. main `f5ff1ce` passed at 14:37 UTC; PR #128 failed at 15:31 UTC with five mismatches.

## Change

`npx expo install --fix` in `apps/mobile` (DEV-10), with the lockfile written by the CI-pinned npm 11.19.0.

| Package | Before | After | How |
| --- | --- | --- | --- |
| expo | 57.0.27 (`~57.0.26`) | 57.0.28 (`~57.0.28`) | `expo install --fix` |
| @expo/ui | 57.0.22 (`~57.0.21`) | 57.0.23 (`~57.0.23`) | same |
| expo-router | 57.0.25 (`~57.0.24`) | 57.0.26 (`~57.0.26`) | same |
| expo-splash-screen | 57.0.9 (`~57.0.9`) | 57.0.10 (`~57.0.10`) | same |
| jest-expo | 57.0.5 | 57.0.6 | same; kept as an exact pin, as before |
| react-native-web | 0.21.2 | 0.21.4 | `npm update react-native-web --package-lock-only --ignore-scripts`, so it pairs with babel-plugin-react-native-web 0.21.4, which babel-preset-expo 57.0.15 pulls in |

- `expo install` also added the `expo-splash-screen` config plugin to `apps/mobile/app.json`. That is a native build change outside this scope, so it was undone; `app.json` matches main.
- 26 lock entries changed, none were added or removed, and none of the changed entries has an install script.
  - 13 transitive Expo packages moved up one or two patch releases.
  - 6 entries kept their version and only gained `resolved` and `integrity`.
- License: @expo/xcpretty changed from BSD-3-Clause to MIT (both allowed by REF-07). The others stay MIT.
- B5 AC17: `tests/architecture/expo-sdk57-patch-20261013-lock.json` records each entry's previous value and the hash of its new value.
  - One `projectReviewedLock` helper and one `projectReviewedLocks` chain reverse the reviewed fixtures newest first. The frozen check and all four negative tests use the same chain.
  - `apps/mobile/package.json` is projected as raw text: each reviewed range line must appear exactly once.
  - A negative test rejects another version, integrity, dependency range or install-script flag, react-native-web put back, a removed entry, drift outside every fixture, a changed or shortened fixture, and other manifest bytes (spacing, a duplicate key).

## Threats

| Threat | Exposure here | After |
| --- | --- | --- |
| A compromised patch release (supply chain) | Official registry. The Expo packages were published by the same account as the previous releases (alanhughes). react-native-web 0.21.4 (2026-10-08) was published by zoontek, one of its three listed maintainers, who also published 0.21.3. No changed entry has an install script. | Integrity values in the lockfile pin the downloaded files. |
| Unreviewed drift hidden in the update | Any other lock or manifest change | AC17 fails on anything outside the 26 reviewed entries and the five manifest lines. |
| The running Web server executes the new code | `apps/web` depends on neither Expo nor react-native-web. The demo image installs every workspace (`deploy/vm/Dockerfile`), but the server never loads these packages. | No runtime exposure on the hosted demo. |
| A behavior change in the app | Patch releases inside SDK 57 | Mobile unit tests and CI's Android and iOS exports. Device runs are NOT_RUN, as before. |

## Deviations, disclosed

- **DEV-05**: before redoing the update, `package-lock.json` and `apps/mobile/package.json` were reset to main's bytes with `git show … >` and `cp`, a shell edit of rule-covered files. Their final content comes from `expo install`, npm and the edit tool, and AC17 pins it. Recorded here as an exception; the operator is told in the session summary.
- **DEV-04 step 2 (implementation plan)**: no separate plan file. The design's 바꾸는 것 and 시험 sections are the plan, as for PR #97 and PR #110.
- **DEV-04 step 3 (tests first)**: the failing state was CI `mobile-health` on PR #128 and `npx expo install --check` on main's tree, which listed the five packages. Expo Doctor then passed 21/21 after the change.

## Checks

On the pinned Node 24.21.0 / npm 11.19.0, on the tree committed as `6556962`:

- `npm ci` left `package.json`, `package-lock.json`, `apps/mobile/package.json` and `apps/mobile/app.json` unchanged (sha256 compared).
- `npx --yes expo-doctor@1.20.4 .` in `apps/mobile`: 21/21.
- `b5-boundary.test.ts`: 8/8.
- `test:shared` 656/656, `test:web` 939/939, `test:mobile` 142/142, `test:postgres` 633/633.
- `lint`: 0 errors (1 existing warning). `typecheck`, `build:web`, `check:deps`: passed.
- `npm audit --omit=dev`: 16 moderate, 45 high, 0 critical, the same as main.
- `python scripts/verify_repository.py --history`: PASS, 0 findings (run by the independent reviewer on `6556962`: 834 files, 740 links, 2994 history blobs).
- CI on `6556962`: every required check SUCCESS, including `mobile-health` (Doctor and both exports), `postgres-integration` and `web-e2e`.

## Independent review

- First review at `a3cef6c`: 10 findings. Fixed: the react-native-web pair, the license record, the risk tier (high-risk flow with an approved design), the byte-exact manifest check, negative cases that reach each fixture, `npx expo install` (DEV-10), one shared projection chain, `STATUS.md`, and where the checks ran. Deferred by operator decision: running Expo Doctor with `EXPO_OFFLINE=1` (the workflow is also AC17-frozen, and offline checks would stop reporting new patch releases).
- Delta review at `6556962`: every correctness problem resolved; it re-verified the fixture against main and HEAD, the react-native-web pair, `app.json` and the test. Its six record gaps are handled by this record, a follow-up execution-log row with the current time, a follow-up sync line, and the design's corrected check list.

## Rollback

Revert the PR #130 merge commit with `git revert -m 1`. That restores the lockfile, `apps/mobile/package.json`, the fixture and the tests together. No data or deployment changes. CI `mobile-health` then fails again until the patch releases are taken another way.

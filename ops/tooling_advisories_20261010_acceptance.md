# Development and mobile tooling advisory update acceptance

Snapshot: **2026-10-11 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This is a lockfile-only change. No deployment is needed, because the running Web server executes none of the changed packages.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: reopens the B5 AC17 frozen dependency inventory |
| Operator decisions | 2026-10-10, in session: start issue #95. The spec was approved before implementation, with shell-quote at npm's default resolution 1.12.0 |
| Issue | #95, which stays open for the deferred alerts |
| Base | main `e72636d` |
| Reviewed candidate | `86df0e8`, CI with every required check SUCCESS |
| PR | #110; its final head and that head's CI are recorded there |

## Change

The lockfile was written with the CI-pinned npm 11.19.0: `npm update shell-quote source-map-js brace-expansion --package-lock-only --ignore-scripts`.

- Exactly six lock entries change, and each stays inside the range its dependents declare.
- No `package.json` file changes.

| Package | Change | Advisories | Lock entry used by |
| --- | --- | --- | --- |
| shell-quote | 1.10.0 → 1.12.0 | critical GHSA-pqg4-j6r4-53mv | react-devtools-core (`^1.6.1`), but see the threat table: no installed code loads this copy |
| brace-expansion | 5.0.9 → 5.0.12 (three paths) | high GHSA-6j4f-fj2g-mc7p and GHSA-qhr7-859c-m2p7; medium GHSA-q2hr-2g5m-vwhr | minimatch in glob, @expo/fingerprint and @typescript-eslint (`^5.0.8`) |
| brace-expansion | 1.1.18 → 1.1.21 | the same three advisories, all fixed by 1.1.21 | minimatch 3 (`^1.1.7`) |
| source-map-js | 1.2.1 → 1.2.2 | high GHSA-68fv-2mgg-jv7q | postcss and @tailwindcss/node (`^1.2.1`), run by `next build` |

- The six entries also gain the `resolved` and `integrity` fields they were missing.
- B5 AC17: `tests/architecture/tooling-advisories-20261010-lock.json` records each entry's previous value and the hash of its new value.
  - `projectToolingAdvisories20261010` checks those hashes and restores the previous values. The original frozen hash stays in force.
  - A negative test rejects each of these:
    - an unreviewed version
    - changed integrity
    - a dropped entry
    - unrelated lock drift
    - a tampered fixture
    - a shortened fixture

## Threats

| Threat | Exposure here | After |
| --- | --- | --- |
| shell-quote `quote()` command injection | No installed file loads the lockfile copy. React Native DevTools (`react-devtools-core/dist/standalone.js`) and Next.js bundle their own copies, so the update clears the alert but changes no code that runs. | The alert is cleared. |
| A bundled old shell-quote copy (GHSA-395f-4hp3-45gv, high `parse()` DoS, fixed in 1.9.0) | DevTools bundles a copy that Dependabot cannot see. It only parses the developer's own `REACT_EDITOR` variable. | Unchanged; tracked in issue #95. |
| brace-expansion and source-map-js denial of service | Development and build tools whose inputs are repository files | Fixed versions |
| Supply chain of the new versions | The same maintainers published them as patch and minor releases, and the licenses (MIT, BSD-3-Clause) are unchanged. shell-quote 1.12.0 (2026-10-02, ljharb, with a registry signature) is newer than the minimal fix 1.11.0; pinning 1.11.0 would have needed `overrides`. | The lockfile integrity hashes pin them. |

## Deferred, tracked in issue #95

- No fixed release yet:
  - node-forge (high) is used by the @expo/cli code-signing certificate paths. The mobile app configures neither expo-updates nor code signing, so those paths exit before reaching node-forge.
  - braces (high) comes in through micromatch, which jest, metro-file-map and fast-glob use.
  - sprintf-js (medium) comes in through js-yaml 3 and argparse.
- These would need forcing past the range their dependents declare. That conflicts with the Expo SDK alignment rule (DEV-10), so both wait for an Expo SDK update:
  - decode-uri-component (medium) comes in through expo-router and query-string `^0.2.2`; query-string 7.1.3, the newest 7.x, still allows only `^0.2.2`. The mobile app runs this code when it parses links. The app is a synthetic MVP and is not publicly released.
  - uuid (medium) comes in through @expo/config-plugins and xcode `^7.0.3`. xcode only calls `uuid.v4()`, which is outside the affected v3/v5/v6 `buf` path.

## Checks

- RED: with only the lockfile updated, three AC17 checks failed on the `package-lock.json` hash.
- GREEN: `b5-boundary.test.ts` passed 7/7.
- `npm ci` with npm 11.19.0 left every manifest unchanged.
- Local runs:
  - `lint`: 0 errors.
  - `typecheck`, `check:deps` and `build:web`: passed.
  - `test:web`: 856/856. `test:shared`: 573/573.
  - `test:mobile`: 142/142.
  - Expo Doctor 1.20.4: 21/21. `expo export`: Android and iOS.
  - Web e2e: 26/26.
  - `test:postgres`: 622/627. The 5 failures are the known Node v24.21.0 assertion.
- `npm audit --omit=dev`, lockfile-based and measured at the same time: 64 findings (critical 1, high 47) → 61 (critical 0, high 45).
- CI on `86df0e8`: every required check SUCCESS. That covers mobile-health (manifest drift, Expo Doctor, export), the Windows and Linux mobile installs, postgres-integration and web-e2e.

## Independent review

A fresh-context reviewer at `86df0e8` returned **APPROVE**: BLOCKER 0, HIGH 0, MEDIUM 0, LOW 1, Nit 4.

- The reviewer verified:
  - the six entries changed only in `version`, `resolved` and `integrity`, inside every declared range
  - the integrity values match the registry
  - the fixture matches the base lockfile byte for byte
  - extra probes were rejected
  - the projection order does not matter
- LOW: the spec named the wrong shell-quote threat path. Fixed in the threat table above.
- Nits:
  - brace-expansion 1.x was also in the two high advisory ranges. The change table now lists all three advisories.
  - braces also comes in through metro-file-map and fast-glob. The deferred list now says so.
  - `STATUS.md` was updated with this record.
  - The AC17 comment and the negative test title were updated.

## Rollback

Revert PR #110 with a new PR. Only the lockfile and the AC17 test files change.

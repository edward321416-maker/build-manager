# Hosted demo checks and hourly health check acceptance

Snapshot: **2026-10-11 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This PR adds files and documents only. The running demo does not change. The hourly check starts once the workflow is on main, using the repository secret the operator approved.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: deployment, infrastructure and a repository secret (DEV-01) |
| Operator decisions | All on 2026-10-11, in session: "1번 진행하자" (demo operations reliability); the hourly check runs on "GitHub Actions (추천)"; the spec was approved with "승인 (추천)"; the `DEMO_ORIGIN` secret was registered before the merge with "등록하고 진행 (추천)" |
| Spec and plan | `docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md`, `docs/superpowers/plans/2026-10-11-demo-ops-reliability.md` (PR A of two; PR B, the redeploy script, follows) |
| Base | main `16fae5f` |
| Reviewed candidate | `496f161` |
| Independent review | Fresh context, on `ad47756`: REQUEST_CHANGES (HIGH 1, MEDIUM 3, LOW 3, Nit 5). Fixed in `32cc21a`, where a delta re-review gave APPROVE with three Nits. Two of those were fixed in `9fd0747`. The reviewer then found a regression there: a path that does not parse surfaced the URL parser's error, which names the demo origin. It was fixed in `496f161`. |
| PR | #114. The PR records its final head and that head's CI. |

## Change

- `scripts/demo-smoke.mjs` takes the demo origin from `DEMO_ORIGIN` only. It prints one PASS/FAIL line per check and exits 0, 1 or 2.
  - HTTP checks:
    - the first page, `/core`, `/vendor/job` and one static chunk answer 200;
    - `/api/v2/core/access` answers 401 when signed out;
    - `/demo/landlord` answers 404;
    - the three `/_next/image` probes answer 404;
    - the HTTPS certificate has 7 or more days left.
  - Browser checks (not with `--http-only`): both demo entries, the manager work queue at 1280 px, the tenant repair intake at 390 px, no 5xx responses and no page errors.
  - `--expect-text` proves a release reached the site. `--write-check` saves one synthetic request and is meant for right after a deploy.
- `.github/workflows/demo-health.yml` runs `--http-only` at minute 23 of every hour and on manual dispatch.
  - It runs in this repository only, with `contents: read` and `persist-credentials: false`.
  - Its actions are pinned to the same commit SHAs as `app-check.yml`, and the step uses `shell: bash`.
  - It has `timeout-minutes: 10` and one retry after 60 seconds, but only for exit 1.
- `development/DEVELOPMENT_RULES.md` 1.0.3 (DEV-12) and `deploy/vm/README.md` (Checks) name the script and the hourly check. The check items and the record they require are unchanged.

## Threats

| Threat | Control | Evidence |
| --- | --- | --- |
| The demo address appears in a log, PR or commit | It lives only in the secret and a private file on the operator's machine. The script masks the origin, host, resolved addresses and both spellings of an sslip.io address. A line is masked before it is shortened, and escaped errors are printed masked. | A test fails when a printed line skips the mask: the mask was removed to confirm it. Live runs printed the address 0 times. The diff and commit messages hold only 127.0.0.1, 203.0.113.7 and `.invalid` names. |
| A fork, a PR or a third party gets the secret or the token | Only `schedule` and `workflow_dispatch` trigger it; dispatch needs write access. It has a repository guard, a read-only token, SHA pins and no `pull_request_target`. The secret is passed only through `env`. | The workflow test pins each of these. |
| The check is turned against another host | Every `--expect-text` path must resolve to the demo's origin, so `//host`, `/\host`, paths with tabs and paths that do not parse are rejected with exit 2 before any request. An unknown `--x=value` option prints only its name. | The usage tests confirm each case makes no request and prints no address. |
| A hung demo yields "cancelled" runs that do not notify | The 15-second request timeout and two runs with the minute between them fit inside 10 minutes. | The reviewer measured a hung run at about 150 seconds at most. |
| False alarms | One retry after 60 seconds, for check failures only. | A shell simulation covered exits 0, 1 then 0, 1 then 1, 2 and 137. |
| Load or junk data on the demo | The hourly check sends about ten GET requests. The write check runs only when asked for and cannot be combined with `--http-only`. | Usage test |

## Verification

- RED, then GREEN: every new test failed before its change.
  - The demo-smoke tests failed because the module was missing.
  - The masking tests failed because `maskerFor` was missing.
  - The workflow test failed because the file was missing.
  - Each review-driven case failed before its fix.
  - The targeted tests now pass 25/25, and the test typecheck passes.
- `npm run test:shared` on Windows: 590/593. The three failures are import-graph tests that time out at 5 seconds.
  - They also time out on unchanged main (569/573), and they pass when run alone (54/54).
  - CI on Linux passes them. This was recorded as the one allowed rerun (DEV-06).
- `npm run typecheck` and `python scripts/verify_repository.py --history` both exit 0.
- CI: every required check passed on `ad47756` and on `32cc21a`. The PR records the final head.
- Live demo, with the address read from the private file:
  - the full run passed all 15 checks, before and after the review fixes;
  - `--http-only` passed;
  - `--expect-text` passed on the P3b Vendor chunk;
  - no output named the address.

## Secret

- `DEMO_ORIGIN` was registered at 2026-10-11T04:10:24Z with `gh secret set`.
- The value came from the private file over standard input and was never printed. Only its name was listed afterwards.
- Remove it with `gh secret delete DEMO_ORIGIN`.

## Rollback

- Revert the PR. The running demo is not affected.
- To stop only the hourly check, run `gh workflow disable demo-health.yml`.

## Not verified

- `--write-check` has never run. Its selectors and the 201 response match the Web source, and it runs for the first time at the next deploy.
- The browser checks have no unit test; the live runs above cover them.
- The first manual and first scheduled runs of `demo-health.yml` happen after the merge. Their result is recorded with the merge.

# Demo write check closes its own synthetic request, acceptance

Snapshot: **2026-10-15 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. The live check on the hosted demo follows the merge, within the operator's approval, and is recorded afterwards.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: the deploy check tool gains an action that changes demo data (DEV-01 deploy and infrastructure; when unsure, high-risk) |
| Operator decisions | 2026-10-15, in session: "스스로 닫게 고치기 (추천)" (other options: stop using the write check; keep it and clean up now and then); spec "승인 (추천)", including one live `--write-check` run on the demo after the merge (other option: verify at the next deploy) |
| Origin | The write check left one 제출 전 request per deploy; seven piled up on the tenant's 알림 until the operator-approved cleanup of 2026-10-14 (log row `DEMO-SYNTHETIC-CLEANUP-20261014`) |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-15-smoke-write-check-closes-design.md), [plan](../docs/superpowers/plans/2026-10-15-smoke-write-check-closes.md) |
| Policy | `POLICY_REF` main `0f5f48d`; the rulebooks are unchanged at the base `1d88457` |
| Base | main `1d88457` |
| Independent review | Fresh-context review agent, read-only. On `1d88457..2c11833`: **With fixes**; one blocking finding (a failure from a screen wait or a page error did not name the ticket, against the spec and README) and six nits. Fixed in `5185dbe`. Delta review of `2c11833..5185dbe`: code correct and safe; one process finding, that DEV-04 step 4 asks for `test:postgres` and the relevant screen tests (handled below), and three nits (the plan now records the second round and that it was written alongside the implementation; the dropped error `cause` is kept as is) |
| PR | Recorded in the PR body with its final head and that head's CI |

## Change

- `scripts/demo-smoke.mjs`
  - The save step reads `ticketId` from its own 201 answer before its screen checks; a 201 without an id fails.
  - Two new steps run only when an id exists: as the demo manager, `closeAsManager` records 처리 시작 and, only if that was accepted, 처리 완료; only if that passed, as the demo tenant, `confirmAsTenant` confirms the result and reads the work status back, which must be `COMPLETED`.
  - Both functions run in the demo page through `page.evaluate`, with the page's own fetch (session cookie, same origin) and the headers the `/core` screen sends (`x-core-organization`, `x-b1-csrf`). Each request stops after 15 s. They return status codes and the work status only; a session without an organisation throws `NO_ORGANIZATION`.
  - `namingTicket` puts `ticket <first six id characters>:` in front of any failure while closing, so the request can be closed by hand.
  - `step()` returns whether it passed; `enterManager` and `enterTenant` are shared with the existing steps.
  - The handling messages avoid the safety text scan: `배포 점검용 합성 요청이라 정리해요.`, `배포 점검용 합성 요청 정리를 마쳤어요.`
- `scripts/demo-smoke.d.mts`: types for the new exports.
- `deploy/vm/README.md`: the `--write-check` line describes the closing and what to do when it fails.
- Unchanged: the server, API, database, screens, the hourly `demo-health.yml` check (`--http-only`) and every other check.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | The script closes a real user's request | Only the id from this run's own 201 answer; no option passes an id in | Paths use that id, URL-encoded |
| T2 | Closing stops halfway and leaves a request open | The run fails and names the id's first six characters with the status codes, for every kind of failure | `namingTicket` test; 처리 완료 is not sent when 처리 시작 is refused |
| T3 | The address, CSRF value or session leaks into output | The page functions return status codes and the work status only; output masking unchanged | Results never contain the CSRF value |
| T4 | A handling message trips the safety scan | Fixed messages | `evaluateSafety` test |
| T5 | Another origin imitates these requests | Sent from inside the demo page, same origin; the server's Origin and CSRF checks are unchanged | Header tests |

## Verification

All local runs on 2026-10-15 KST with Node 24.21.0 and npm 11.19.0. The demo was not touched before the merge.

- First failure (`a73b948`): the 5 new tests failed because the functions did not exist (structural, not behaviour evidence).
- After the implementation (`729831f`): 27/27 in `tests/architecture/demo-smoke.test.ts`. A 6-mutant run killed 5; the survivor assumed `COMPLETED` instead of reading it back, so a test now feeds `IN_PROGRESS` (`2c11833`), and all 6 were killed.
- After the review fixes (`5185dbe`): 33/33; a 12-mutant run (the first six plus: read-back without headers, tenant without a session check, no time limit, an empty organisation, no ticket naming, a module constant read inside the page) killed all 12.
- Checks at `5185dbe`, run with nothing else on the machine (an earlier run at `2c11833` overlapped with the mutation run and timed out under that load):
  - `python scripts/verify_repository.py --history`: PASS.
  - `test:shared`: 666/668, then 668/668 on the one allowed rerun. The two failures were 5 s timeouts in architecture graph tests (`b1-boundary` R12, `b3-boundary` B3; #119). The six `*-boundary.test.ts` files one at a time: 67/67.
  - `test:web`: 89 files, 1050 tests passed. `lint`: 0 errors (8 existing warnings, none in a changed file). `typecheck` (includes `typecheck:tests`): exit 0.
  - `build:web` and `check:deps` passed at `2c11833`; `5185dbe` changes only the script, its types, its tests and the plan, which neither reads.
  - Package files unchanged after `npm ci`.
- DEV-04 step 4: this change touches no database or screen code, so `test:postgres` and the screen suites run as the PR's CI jobs (`postgres-integration`, `web-e2e`) on the final head. No local suite drives the script's browser path; the post-merge live run covers it.

## Rollback

- A revert PR of the script restores the old behaviour. Nothing on the demo or in the database changes with this PR.
- A request left open by a failed run is closed the way the 2026-10-14 cleanup did it: manager 처리 시작 and 처리 완료, then tenant 해결 확인.

## Retained risks and not verified

- Each write check leaves one closed synthetic request on the tenant's 요청 list (끝난 요청); none is deleted.
- A change to the demo screens or API can break the closing steps first; the failure line names the request.
- The plan was written alongside the implementation, not before it (DEV-04 step 2 order); the order test first, implementation second was kept.
- Not verified before the merge: the browser path against the hosted demo (the live run follows the merge).
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

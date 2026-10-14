# Core unit list past 200 units, acceptance

Snapshot: **2026-10-14 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once the independent review below is clean and CI passes on the final head. Nothing is deployed. The hosted demo gets migration 0026 only at a later deploy, with the operator's confirmation right before it runs (DEV-04, DEV-12).

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: a migration that replaces a `SECURITY DEFINER` function and recomputes who can see which unit (DEV-01, DEV-04, DEV-08) |
| Operator decisions | 2026-10-14, in session: next development task "호실 200개 제한 고치기 (추천)"; spec approved as option A, "A안 승인 (추천)" (remove the cut and check access once per building; B was removing the cut only, C a building-then-unit picker with search) |
| Origin | PR #134 body (the manager unit list reads only 200 units, left as a separate task); local sdk failures in `ops/navigation_shell_p5_20261013_acceptance.md` and `ops/navigation_shell_p5_home_20261014_acceptance.md` |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md), [plan](../docs/superpowers/plans/2026-10-14-unit-list-over-200.md) |
| Policy | `POLICY_REF` main `0f5f48d`; the rulebooks are unchanged at main `f2023bd` |
| Base | main `0f5f48d`, with main `f2023bd` (PR #147, migration 0025) merged in as `f971dca` |
| Depends on | PR #147 (C1 step 1, 0025), which replaced `core_flow.units` with a left join and kept `LIMIT 200`; 0026 replaces it again on top |
| Independent review | Fresh-context review agent, read-only, 2026-10-14. On `f2023bd..a3a4d3e`: **With fixes**, no Critical; the migration matches `can_unit` on every reachable role and state, and RLS, ownership, grants and response shape are unchanged. One Important (the `can_unit` comparison lacked the spec's ended assignment and ended occupancy) and ten Minors, among them the uuidv7 correction (the cut kept the oldest units), `MATERIALIZED`, and a call-count guard. All fixed in `0194a1d` except grouping same-name buildings, left as an operator choice. Delta review of `a3a4d3e..0194a1d`: **Yes**, no new problems; its two record-wording notes are fixed here. Not exercised alone (optional, from the delta review): an occupancy with status `ENDED` and a member whose `joined_at` is in the future. |
| PR | Recorded in the PR body with its final head and that head's CI |

## Cause

- `core_flow.units` (0011, then 0025) selected the units passing `core_flow.can_unit` with `ORDER BY u.id LIMIT 200`. Real unit ids are time-ordered (`uuidv7()` is the `app.unit` default, and B3's `allocateUuid` runs `SELECT uuidv7()`), so an organisation with more than 200 readable units kept its 200 oldest units and every newly registered unit was left out. Fixture ids are random v4 UUIDs, which is why the local screen tests failed at random. (The independent review corrected the first draft, which said "random".)
- After 0025, units of buildings without a building context row are listed too, and they shared the same 200 places (PR #147 review, passed on by its session).
- Building registration does not cap units, so nothing kept an organisation under 200.
- Every Core screen that names or picks a unit reads this list: the intake unit picker, the work queue unit filter, the maintenance history unit picker, request names, the units view and the mobile unit buttons.
- `can_unit` ran once per unit of the organisation (each call repeats the session and building checks), so the list's cost grew with the organisation's units even with the cut.

## Change

- **Migration** `0026_core_units_all.sql` replaces `core_flow.units(bytea)` with the same signature, owner (`bm_core_flow_owner`), `SECURITY DEFINER`, `search_path=pg_catalog` and grants.
  - One `core_flow.session` call. Managers and staff: the organisation's `ACTIVE` buildings that `authn.can_read_property` allows, one call per building; the `readable` CTE is `MATERIALIZED` so that holds whatever the plan. Tenants: units of `ACTIVE` buildings with a current occupancy and membership, the condition copied from `can_unit`.
  - `ACTIVE` units only, no limit, ordered by building name, unit label, unit id. The building name keeps the 0025 fallback `coalesce(c.body->>'displayName','건물')`.
  - `core_flow.can_unit` and every other function are unchanged.
- **Tests** `tests/postgres/core-unit-list.test.ts`, 8 tests on a fixture with 234 readable units: the admin's full list, the order (with the id tie-break between two `건물 · 101호` units), a staff member's single building, tenants including a future occupancy and an ended membership, other organisations, equality with `can_unit` for every fixture account, the function's owner, definer, search path and execute rights, and a call count: one list calls `can_unit` zero times and `can_read_property` at most once per building.
- `scripts/hosted-demo-provision.mjs`: a comment now says migrations 0001-0026.
- API contract, web, mobile, RLS and roles are unchanged.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | Another organisation sees these units | Every read is scoped to the session's organisation; `core_flow.session` is unchanged | Organisation B's manager and tenant list only their own unit; organisation A's manager does not list it |
| T2 | Staff see units of a building they are not assigned to | Building access only through the unchanged `authn.can_read_property` | Staff assigned to building A get all 232 of its units and nothing from the other buildings; after an extra assignment they also get that building's unit |
| T3 | A tenant sees another unit of the organisation | The occupancy condition is copied from `can_unit`, including start and end times | A tenant lists only their units; a future occupancy is not listed; an ended membership drops the unit |
| T4 | The new computation drifts from `can_unit` | Pinned by a comparison test | For all 7 fixture accounts the listed ids equal the ids for which `can_unit` is true. The data holds an archived unit, a unit in an archived building, two buildings without context rows, an extra and an ended staff assignment, a staff member who also lives in a building they are not assigned to, and an occupancy whose end time has passed |
| T5 | An organisation admin creates very many units to slow the list | Cost stays inside that organisation; the per-building check keeps it small; the 5 s statement timeout stays | Measurement below. No timing test (CI timing varies); the call-count test fails if the list goes back to a per-unit check |
| T6 | `CREATE OR REPLACE` changes owner, definer or search path | Same role and signature | Owner, `prosecdef`, `proconfig`, `bm_b1_web` execute and no `PUBLIC` execute pinned; the full function baseline in `core-flow.test.ts` still passes |

## Verification

All runs on 2026-10-14 KST on synthetic testcontainers databases (`postgres:18.6`). The shared fixture `build-manager-core-flow-rc1` and the hosted demo were not used.

- Measurements, each with a temporary uncommitted test on the fixture plus N units (and a second building of 100 units), medians of 3 calls after a warm-up, in ms, manager / staff / tenant.
  - Before the spec, on main `0f5f48d` (the 0011 body with the inner join), Node 24.14.0; the per-building column is the draft SQL:

| Units in the organisation | 0011 (cut at 200) | Cut removed only | Per building (draft) |
| ---: | --- | --- | --- |
| 1,000 | 235 / 242 / 198 | 209 / 256 / 157 | 16 / 16 / 13 |
| 3,000 | 540 / 638 / 438 | 565 / 676 / 463 | 27 / 25 / 15 |
| 10,000 | 1,816 / 2,226 / 1,313 | 2,023 / 2,247 / 1,451 | 93 / 78 / 31 |

  - After the merge, on `a3a4d3e`, Node 24.21.0: the 0025 body against the final 0026:

| Units in the organisation | 0025 (cut at 200) | 0026 |
| ---: | --- | --- |
| 1,000 | 66 / 323 / 150 | 15 / 13 / 10 |
| 3,000 | 40 / 47 / 178 | 23 / 23 / 14 |
| 10,000 | 37 / 47 / 565 | 79 / 72 / 27 |

  - With 0025's left join the planner walks units in id order and stops at 200 matches, so manager and staff lists stopped growing with the organisation; a tenant still scans every unit. The spec's 5 s estimate is about the 0011 body. 0026 stays under 0.1 s at 10,000 units for all three and returns every unit.

- RED on main before 0025 (`ff3b573`): 5 of 7 failed; three on the 200 cut, one because units without a building context row were missing (C1), and the `can_unit` comparison. The other organisation and metadata tests passed. Reference only.
- A preview on top of 0025 showed the test image's default collation skips Hangul at the first comparison (`건물` before `RC1 합성 건물 A`; `합성 호실 1` between `대량 호실 099` and `100`). The order test now compares the list with the database's own resort, and the tenant test compares sets (`93b2dd0`). This is test data handling, not a change of expected behaviour.
- RED on 0025 (`f971dca`): 4 of 7 failed, all on the 200 cut: `expected [ …(200) ] to have a length of 234 but got 200`; building A's labels 198 of 232 (the two units without context took two places); staff `… of 232 but got 200`; `manager: expected [ …(200) ] to deeply equal [ …(234) ]`. The tenant, other organisation and metadata tests passed.
- GREEN with 0026 (`a3a4d3e`): `core-unit-list` 7/7 and `core-building-context-fallback` 7/7 (the 0025 isolation and HTTP manager tests).
- Full checks at `a3a4d3e` (`0194a1d` then changed the migration's CTE and the tests, checked again below; later commits change records and docs only):
  - `test:postgres` (Node 24.14.0): 47 of 48 files passed, 643 of 648 tests (725 s). The 48th, `b5-timeout.test.ts`, failed 5 tests only on its runtime pin (`expected 'v24.14.0' to be 'v24.21.0'`); with Node 24.21.0 it passed 12/12.
  - The rest with Node 24.21.0 and npm 11.19.0:
    - `python scripts/verify_repository.py --history`: PASS (879 files, 3504 history blobs, no findings).
    - `test:web`: 87 files, 1016 tests passed. `build:web`: compiled.
    - `lint`: 0 errors; 8 existing warnings (7 web, 1 mobile), none in a changed file; again 0 errors after `0194a1d`. `typecheck` (includes `typecheck:tests`) and `check:deps`: exit 0; `typecheck:tests` again exit 0 after `0194a1d`.
    - `test:shared`: 656/657, rerun once 654/657. Every failure was a 5 s timeout in an architecture graph test (`b1-boundary` R12, then also `b3-boundary` B3 and `b4-boundary` B4), the parallel-load issue tracked in #119; another session's tests were running on the same machine. The six `*-boundary.test.ts` files run one file at a time: 67/67 passed. This change touches no TypeScript source those graphs read.
    - `package.json`, `package-lock.json`, `apps/mobile/package.json`, `apps/mobile/app.json`: unchanged after `npm ci`.
- After the review fixes (`0194a1d`, Node 24.21.0):
  - With 0026 held out of the migrations folder (the 0025 body): the whole file failed 5 of 8, the four above on the 200 cut and the new call-count test. After its assertions were reordered so the call count is checked first, that test alone (`-t "once per building"`, so test 6's extra unit was absent) failed on its target, `expected 236 to be +0`: `can_unit` ran once for each of the organisation's 236 units.
  - With 0026: `core-unit-list` 8/8, `core-building-context-fallback` 7/7.
  - Delta regression: every `tests/postgres/core-*.test.ts` and `vendor-handoff-*.test.ts` file, 20 files, 352 tests passed (246 s). The full `test:postgres` above ran before `MATERIALIZED`; CI runs it again on the final head.
- Not run locally: `test:e2e:core` and `test:e2e:sdk`, which use the shared fixture that must not receive a migration before it is merged; CI's `web-e2e` job runs them on a fresh database. `test:e2e:b1`, `test:e2e:vendor` and `test:mobile`: not run, no web, vendor or mobile code changed.

## Rollback

- The response shape is unchanged, so an older image on a database with 0026 still works; it only receives a longer list. The demo uses the Rollback procedure in `deploy/vm/README.md`.
- The database moves forward only (DEV-08). To undo, a new migration recreates the 0025 body of `core_flow.units`, which stays in `0025_core_building_context_fallback.sql`.
- No data changes.
- 2026-10-14, correcting the C1 record by a later record (DEV-14; asked by the C1 session): the rollback in `ops/building_context_fallback_c1_20261014_acceptance.md` names "a new migration 0026". With this 0026 merged, that means the next free number. Its `core_flow.units` must start from this 0026 body, not from 0011: only the `building_context` left join and the `건물` fallback go back to the pre-0025 inner join; the per-building check and the absent cut stay.

## Retained risks and not verified

- An organisation with thousands of units gets a long picker. A building-then-unit picker with search (option C) is offered as later design work.
- Korean text order follows the database default collation, which skips Hangul at the first comparison in the test image. The demo runs the same image with no locale setting, so it likely sorts the same way (not checked on the demo). Unchanged by this PR; a Korean collation would be a separate operator decision.
- No timing test. The call-count test stops a return to per-unit checks, not other slow-downs.
- With no limit a 10,000-unit organisation gets about 1.5 MB of JSON, and the mobile app draws one button per unit without list virtualisation (`apps/mobile/src/app/core.tsx:50`). Part of the long-picker follow-up.
- Units of buildings with the same name (after 0025 every unnamed building reads `건물`) interleave by label. C1 step 2 (building names) removes it; adding the building id to the order would group them earlier, an operator choice offered separately.
- Migration 0026 has not run on the hosted demo database. The rollback migration is planned, not rehearsed.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

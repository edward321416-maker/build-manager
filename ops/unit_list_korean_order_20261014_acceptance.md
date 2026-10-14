# Core unit list in Korean order, same-name buildings together, acceptance

Snapshot: **2026-10-14 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once the independent review below is clean and CI passes on the final head. Nothing is deployed; migration 0027 reaches the hosted demo only at a later deploy the operator confirms (DEV-04, DEV-12).

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: a migration that adds a database object (a collation) and replaces the `SECURITY DEFINER` function `core_flow.units` (DEV-01, DEV-04, DEV-08) |
| Operator decisions | 2026-10-14, in session: Korean text order "고쳐줘"; same-name buildings "건물별로 묶어"; spec "승인 (추천)" (the other option was a custom rule to put `101호` before `101-1호`) |
| Origin | The 0026 spec's remaining risks (`docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md`) |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-14-unit-list-korean-order-design.md), [plan](../docs/superpowers/plans/2026-10-14-unit-list-korean-order.md) |
| Policy | `POLICY_REF` main `0f5f48d`; the rulebooks are unchanged at the base `0b8fd15` |
| Base | main `0b8fd15` |
| Independent review | Fresh-context review agent, read-only, 2026-10-15, on `0b8fd15..73b207a`: **With fixes**, no blocking issue. The function body matches 0026 except the ORDER BY; the collation DDL is valid in the runner's single transaction, owned by `bm_core_flow_owner`, needs no grants and is safe under `search_path=pg_catalog`; no inventory needs updating; RED comes from the order itself. Nits fixed here: a deterministic same-name tie test, the T3 and rollback wording (a failed start leaves the demo down until rollback; an image rollback keeps the Korean order; drop the collation only after replacing the function), the ICU version-mismatch note, the test file name in the spec, and a determinism check. Kept: the `ko-u-kn-true` spelling, which prints one harmless NOTICE |
| PR | Recorded in the PR body with its final head and that head's CI |

## Cause

- `core_flow.units` (0026) ordered by `building_name, label, id` under the database default collation. The test image and the demo run `postgres:18.6` with no locale setting, so that collation is `en_US.utf8` (libc; checked in the test image, the demo assumed from the same image). It skips Hangul at the first comparison and compares digits as text: `건물 | 가나 빌라 | 대량 호실 099 | 합성 호실 1 | … | 10호 | … | 1001호 | 101호 | … | 2호 | … | RC1 합성 건물 A`.
- Since 0025 every building without building information reads `건물`, so several of them interleaved their units by label.

## Change

- **Migration** `0027_core_units_korean_order.sql`, run as `bm_core_flow_owner` like 0025 and 0026:
  - `CREATE COLLATION core_flow.unit_name_order (provider = icu, locale = 'ko-u-kn-true')`: ICU Korean with numbers compared by value. Used only in an `ORDER BY`, never in an index.
  - `core_flow.units` keeps the 0026 body, signature, owner, `SECURITY DEFINER`, `search_path` and grants; only the order changes to building name, building id, unit label and unit id, the two names under the new collation.
- **Tests**
  - New `tests/postgres/core-unit-order.test.ts` (3): label order `2호, 10호, 101호, 1001호, 가동 2호, 가동 10호, 나동 1호, 합성 호실 1, 합성 호실 2, B1호`; building order `가나 빌라 → 건물 → 건물 → RC1 합성 건물 A` with each unnamed building's `101호, 102호` together in building-id order (inserted in reverse so insertion order cannot pass); the collation's owner, provider and locale.
  - `tests/postgres/core-unit-list.test.ts`: the order test re-sorts the returned rows with the new collation and the building id; the two `건물 · 101호` units now follow building-id order.
- `scripts/hosted-demo-provision.mjs`: a comment now says migrations 0001-0027.
- Screens, API, mobile, other functions and other unit lists are unchanged.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | The order change alters who sees which unit | Only the `ORDER BY` line changes | The body differs from 0026 only there (diff); the 0026 tests (full list, staff, tenants, other organisations, equality with `can_unit`, call count) pass |
| T2 | Owner, definer or search path of the definer function changes | Same role and signature; the collation is schema-qualified | Function metadata test; collation owner test |
| T3 | ICU is missing and the migration stops start-up | Tests and demo use the same `postgres:18.6` image, which has ICU. The migration is one transaction, so a failure leaves the database at 0026; `redeploy.sh` then stops with `REDEPLOY_NOT_READY` and prints the rollback command. The web container was already recreated, so the demo is down until that rollback runs; the old image is kept | The migration applies in every test database |
| T4 | Another role changes the collation | Owned by `bm_core_flow_owner`; the web role has no CREATE on the schema | Collation owner test |

## Verification

All runs on 2026-10-14 KST with Node 24.21.0 and npm 11.19.0 on synthetic testcontainers databases (`postgres:18.6`). The shared fixture and the hosted demo were not used.

- Probe (temporary uncommitted test): ICU collations for Korean exist in the image; `ko-u-kn-true` is stored as `ko-u-kn`, deterministic, version 153.128.46, and orders `2호 | 10호 | 101-1호 | 101-2호 | 101-10호 | 101호 | 1001호 | 가나 빌라 | 가동 2호 | 가동 10호 | 건물 | 나동 1호 | … | 합성 호실 1 | Ａ동 1호 | B1호 | b2호 | RC1 합성 건물 A`.
- RED on 0026 (`a070a19`): 4 failed, 7 passed. The two order tests failed on the order (`expected [ '합성 호실 1', '나동 1호', '가동 10호', … ]`; same-name units interleaved); the collation test and the re-sort test failed because the collation did not exist (structural, not behaviour evidence).
- GREEN with 0027 (`73b207a`): `core-unit-order` 3/3, `core-unit-list` 8/8, `core-building-context-fallback` 7/7.
- Full checks at `73b207a` (later commits change two test files and records; those two files were run again):
  - `test:postgres`: 49 files, 652 tests passed (725 s).
  - `python scripts/verify_repository.py --history`: PASS.
  - `test:web`: 89 files, 1050 tests passed. `build:web`: compiled.
  - `lint`: 0 errors (8 existing warnings, none in a changed file). `typecheck` (includes `typecheck:tests`) and `check:deps`: exit 0.
  - `test:shared`: 652/657, rerun once 653/657. Every failure was a 5 s timeout in an architecture graph test (`b1-boundary` R12, `b3-boundary` B3, `b4-boundary` B4, `vendor-handoff-boundary`), the parallel-load issue tracked in #119. The six `*-boundary.test.ts` files run one at a time: 67/67 passed. This change touches no TypeScript source those graphs read.
  - Package files unchanged after `npm ci`.
- After the review's test nits (`bareUnits` in ascending id order so a unit-id tie-break fails; the collation must be deterministic): `core-unit-order` 3/3 and `core-unit-list` 8/8.
- Not run locally: `test:e2e:core` and `test:e2e:sdk` (shared fixture; CI's `web-e2e` runs them). The order changes which unit the pages preselect first (`u[0]`), which is intended; the screen tests pick units by id.

## Rollback

- The response shape is unchanged, so an older image on a database with 0027 still works. The database keeps the 0027 function, so the order stays Korean after an image rollback.
- The database moves forward only (DEV-08). To undo the order, a new migration puts back the 0026 body of `core_flow.units` (it stays in `0026_core_units_all.sql`). The collation can stay; to drop it, that migration replaces the function first and then runs `DROP COLLATION core_flow.unit_name_order` as `bm_core_flow_owner`. plpgsql bodies record no dependency on it, so dropping it while the function still uses it would make the unit list fail at run time.
- No data changes.

## Retained risks and not verified

- `101-1호` sorts before `101호` (punctuation before Hangul in this collation); kept by decision.
- Same-name buildings are grouped but still not told apart; C1 step 2 (building names) does that.
- An ICU version change could shift the order slightly; no index or stored data depends on it. After a database image with a different ICU version, PostgreSQL warns about a collation version mismatch on first use in a session; `ALTER COLLATION core_flow.unit_name_order REFRESH VERSION` (owner or superuser) clears it.
- The migration prints one harmless NOTICE when PostgreSQL rewrites `ko-u-kn-true` to its standard form `ko-u-kn`.
- The demo's default collation was not read on the demo itself; 0027 sets the order regardless.
- Migration 0027 has not run on the hosted demo database. The rollback migration is planned, not rehearsed.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

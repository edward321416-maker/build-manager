# C1 step 1: units without building information, acceptance

Snapshot: **2026-10-14 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once the independent review below is clean and CI passes on the final head. Nothing is deployed. The hosted demo gets migration 0025 only at a later deploy, with the operator's confirmation right before it runs (DEV-04, DEV-12).

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: a migration that replaces `SECURITY DEFINER` functions in the FROZEN RC1 Core flow (DEV-01, DEV-04, DEV-08) |
| Operator decisions | 2026-10-14, in session: "건물 정보 확인부터 (추천)" and "지금 시작 (추천)" (reproduce C1 before P5 PR 2); fix approach "둘 다, 나눠서 (추천)" (step 1 here, building information inputs in step 2 with P6); spec approved with "승인 (추천)", D1 fixed name `건물`, D2 vendor handoff stays blocked without an address, D3 no screen copy change |
| Research | [Feature connection gap analysis](../research/ux/2026-10-14-feature-connection-gap-analysis.md) §4 L-01, CLM-113–CLM-115; this PR adds SRC-152 and CLM-133 |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md), [plan](../docs/superpowers/plans/2026-10-14-building-context-fallback-c1.md) |
| Policy | `POLICY_REF` main `0f5f48d`; the rulebooks are identical at the branch base `48aa7cf` |
| Base | main `48aa7cf`, with main `0f5f48d` merged in (`3345b86`, ops and docs files only) |
| Commits | `a7ff0d1` reproduction, `6a1e3dc` spec, `0dc30d9` approval and plan, `c96d932` and `970c877` failing tests, `5bad588` migration, `17e9aa7` vendor control |
| Independent review | Pending; written here before the merge |
| PR | Recorded in the PR body with its final head and that head's CI |

## Cause

- Building registration (`/workspace`, B3) writes `app.property` and `app.unit` only. Only fixtures and the demo scripts insert `core_flow.building_context`.
- Five Core functions assumed that row: `units` and `manager_work_json` and `maintenance_fact_json` inner-joined it, `building` raised `NOT_FOUND`, and `vendor_handoff_source` returned a null building.
- So a tenant connected to a registered building got the `TENANT` role but an empty unit list, and could not create a request.

## Change

- **Migration** `0025_core_building_context_fallback.sql`
  - New private helper `core_flow.building_body(org, property)`: the stored body, or `{id, displayName: 건물, demo: false, sourceNativeIds: {}, context: []}`. `EXECUTE` is revoked from `PUBLIC` and granted to nobody, so only the owner's functions call it.
  - `units`, `building`, `manager_work_json`, `maintenance_fact_json` and `vendor_handoff_source` are replaced with the same signatures, owner, `SECURITY DEFINER`, `search_path` and grants. Only the building read changes: a left join with `coalesce(…,'건물')`, or `building_body`.
  - No address is derived. Publishing a vendor packet without a stored address stays `ADDRESS_REQUIRED`.
- **Tests**
  - `tests/postgres/core-building-context-fallback.test.ts` (grown from the reproduction): unit list and fallback building, heating and leak requests, manager queue and work read, maintenance history, isolation, a stored-row control, and the helper's privileges.
  - `tests/postgres/vendor-handoff-manager-preview.test.ts`: the vendor section reads with no building row, `serviceAddress` is null, no `BUILDING_VERIFIED` detail, publishing is refused, and the same command publishes once the row is back.
  - `tests/postgres/core-flow.test.ts:87`: `building_body` added to the exact function baseline as not web-executable. This is an intended catalogue change, not a fixture correction.
- `scripts/hosted-demo-provision.mjs`: a comment now says migrations 0001-0025.
- Domain, questions, route recommendation, safety, screens, B3 registration and RLS are unchanged.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1, T2 | Another organisation, another tenant or unassigned staff sees the new unit | Unit scope (`org_id`, `can_unit`, `app.current_org_id()`) is unchanged; the helper looks up only `(org, property)` | `tenantOther`, `otherTenant` and `staff` do not list the unit, and `building` is `NOT_FOUND` for them |
| T3 | The fallback reads as verified building facts and suggests a wrong route | The fallback has an empty `context` | Heating gets `HEATING_UNKNOWN_V1` on the server and from `selectProtocol` |
| T4 | A vendor packet goes out without a confirmed address | The address exists only in a stored row; `ADDRESS_REQUIRED` stays | The publish is refused, and a positive control with the row back publishes the same command |
| T5 | Another role calls the helper | `EXECUTE` held by the owner only | ACL query: executors are `bm_core_flow_owner` only; `bm_b1_web` and `bm_vendor_handoff_owner` cannot execute it |
| T6 | `CREATE OR REPLACE` changes owner, definer or search path | Same role, same signatures | Owner, `prosecdef`, `proconfig` and web/vendor execute rights pinned for the six functions, plus the full baseline in `core-flow.test.ts` |
| T7 | A null entry breaks the whole manager queue or history | All five functions change in one migration | The whole queue parses with `CoreManagerWorkItemsSchema`; maintenance facts parse with `CoreUnitMaintenanceFactSchema` |

## Verification

All runs on 2026-10-14 KST with Node 24.21.0 and npm 11.19.0 on synthetic testcontainers databases. The shared fixture `build-manager-core-flow-rc1` and the hosted demo were not used.

- Reproduction (`a7ff0d1`, 17:13): `units` returned `[]` for the onboarded tenant; the control with a copied context row passed.
- RED before 0025:
  - `c96d932`: the unit list failed at `toContainEqual` (no entry); heating and queue tests failed with `NOT_FOUND` at the tenant's `CREATE`; the helper test failed because `building_body` was missing (structural RED, not behaviour evidence). The isolation guard and the stored-row control passed, as planned.
  - `970c877`: the vendor test failed at the schema check (`buildingName` null); the baseline expected 47 functions and found 46.
- GREEN after 0025 (`5bad588`): the three files 18/18. Again 18/18 at `17e9aa7` with the vendor control, and `typecheck:tests` passed.
- Full checks at `5bad588` (the later commits change one test and merge ops/docs files):
  - `test:postgres`: 47 files, 640 tests passed (655 s).
  - `test:e2e:b1`: 60 passed. `test:e2e:vendor`: 18 of 18 passed (owned container).
  - `test:web`: 87 files, 1013 tests passed. `build:web`: compiled.
  - `lint`: 0 errors (7 existing web warnings). `typecheck` and `check:deps`: exit 0.
  - `test:shared`: 654/656, rerun once 653/656. Every failure was a 5 s timeout in an architecture graph test (`b1-boundary` R12, `b3-boundary` B3, `b4-boundary` B4), the parallel-load issue tracked in #119. The five graph files run one file at a time: 47/47 passed.
- Not run locally: `test:e2e:core` and `test:e2e:sdk`. They use the shared fixture, which must not receive an unmerged migration. CI's `web-e2e` job runs them on a fresh database.
- `python scripts/verify_repository.py --history`: run on the staged records before the PR (result in the PR body).

## Rollback

- No application code changes, so an image rollback leaves the database functions as they are.
- The database moves forward only (DEV-08). To undo, a new migration 0026 recreates the five functions from 0011, 0015, 0018 and 0019 and drops the helper.
- Before such a rollback, insert building rows for any building that has requests but no row; otherwise the old bodies put null entries in the manager queue (T7).
- Every hosted demo building has a stored row, so the demo's screens do not change.

## Retained risks and not verified

- D1: several unnamed buildings all read `건물` in the manager lists until step 2 adds a name input.
- D2: a building without an address cannot be handed to a vendor until step 2.
- Step 2 (building information inputs with P6) has no spec yet.
- The spec's "recommendation is landlord review or none" is checked through the protocol choice here and through the unchanged domain tests (`recommend-route.test.ts`), not by finishing a request in PostgreSQL. The per-request maintenance read (`read_ticket_maintenance_fact`) builds its result with the same `maintenance_fact_json` tested here, but the new test does not call it.
- Migration 0025 has not run on the hosted demo database. The 0026 rollback is planned, not rehearsed.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

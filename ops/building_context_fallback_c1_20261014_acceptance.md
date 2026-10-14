# C1 step 1: units without building information, acceptance

Snapshot: **2026-10-14 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once the independent review below is clean and CI passes on the final head. Nothing is deployed. The hosted demo gets migration 0025 only at a later deploy, with the operator's confirmation right before it runs (DEV-04, DEV-12).

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: a migration that replaces `SECURITY DEFINER` functions in the FROZEN RC1 Core flow, and an API contract change for that flow (DEV-01, DEV-04, DEV-08) |
| Operator decisions | 2026-10-14, in session: "건물 정보 확인부터 (추천)" and "지금 시작 (추천)" (reproduce C1 before P5 PR 2); fix approach "둘 다, 나눠서 (추천)" (step 1 here, building information inputs in step 2 with P6); spec approved with "승인 (추천)", D1 fixed name `건물`, D2 vendor handoff stays blocked without an address, D3 no screen copy change. After the independent review's HIGH: "이 PR에 같이 고치기 (추천)" (spec section "보완"), which replaces "no application code changes" and keeps D3 |
| Research | [Feature connection gap analysis](../research/ux/2026-10-14-feature-connection-gap-analysis.md) §4 L-01, CLM-113–CLM-115; this PR adds SRC-152 and CLM-133 |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md), [plan](../docs/superpowers/plans/2026-10-14-building-context-fallback-c1.md) |
| Policy | `POLICY_REF` main `0f5f48d`; the rulebooks are identical at the branch base `48aa7cf` |
| Base | main `48aa7cf`, with main `0f5f48d` merged in (`3345b86`, ops and docs files only) |
| Commits | `a7ff0d1` reproduction, `6a1e3dc` spec, `0dc30d9` approval and plan, `c96d932` and `970c877` failing tests, `5bad588` migration, `17e9aa7` vendor control (it also carried the SRC-152 and CLM-133 rows staged earlier), `c15a19b` records, `f788cf8` spec amendment, `542c5d8` failing tests for the amendment, `bd754c5` contract and presenter fix |
| Independent review | Fresh context on `c15a19b`: REQUEST_CHANGES. HIGH 1: the landlord passport schema (`demo` must be true, four facts required) rejects the fallback building, so one request in an unnamed building made every manager ticket response a 503 (list, detail, decision and handling). Confirmed in code and reproduced over HTTP (`542c5d8`); fixed in `bd754c5` after the operator widened the scope. MEDIUM 1 (tests stopped at the port layer): fixed by the HTTP test. LOW-MEDIUM 1 (`LIMIT 200` shared with newly visible units): recorded below; 0026 removes the limit. LOW 1 (thinner coverage than the spec's list): recorded below. Nit 2: STATUS states the post-merge state as the repo's records do; the "screens unchanged" line is corrected. Delta review (fresh context, `c15a19b..bd754c5` plus these records, read-only): APPROVE. MEDIUM 1 (step 2 must widen the contract first): recorded in the spec and below. LOW 1 (nothing pinned the presenter condition) and LOW 1 (the HTTP test projected only a leak ticket of its own): fixed by two presenter cases and a heating ticket in the HTTP test (`1580e09`). LOW 1 (full checks pending): filled in below. Nit 2: the `542c5d8` message overstates the failing run (worded correctly here); a schema could reuse fields with `pick`, left as is |
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
- **Contract and presenter** (spec "보완")
  - `UnverifiedBuildingDtoSchema` in `packages/api-contracts/src/building.ts`: `buildingId`, `displayName`, `demo: false`, `contextVerified: false`, `routingEligibleFields: []`, strict, with no fact fields.
  - `LandlordTicketDetailDtoSchema.building` takes the full passport or that form. `BuildingPassportDtoSchema` is unchanged.
  - `presentLandlordTicket` gives the unverified form only for a non-demo building with empty context (the 0025 fallback). Any other building must still parse as a full passport.
  - Screens read only `ticket.building.displayName`, so nothing visible changes; `npm run typecheck` covers web and mobile.
- Domain, questions, route recommendation, safety, screen code, B3 registration and RLS are unchanged.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1, T2 | Another organisation, another tenant or unassigned staff sees the new unit | Unit scope (`org_id`, `can_unit`, `app.current_org_id()`) is unchanged; the helper looks up only `(org, property)` | `tenantOther`, `otherTenant` and `staff` do not list the unit, and `building` is `NOT_FOUND` for them |
| T3 | The fallback reads as verified building facts and suggests a wrong route | The fallback has an empty `context` | Heating gets `HEATING_UNKNOWN_V1` on the server and from `selectProtocol` |
| T4 | A vendor packet goes out without a confirmed address | The address exists only in a stored row; `ADDRESS_REQUIRED` stays | The publish is refused, and a positive control with the row back publishes the same command |
| T5 | Another role calls the helper | `EXECUTE` held by the owner only | ACL query: executors are `bm_core_flow_owner` only; `bm_b1_web` and `bm_vendor_handoff_owner` cannot execute it |
| T6 | `CREATE OR REPLACE` changes owner, definer or search path | Same role, same signatures | Owner, `prosecdef`, `proconfig` and web/vendor execute rights pinned for the six functions, plus the full baseline in `core-flow.test.ts` |
| T7 | A null entry or a failed schema check breaks the whole manager queue, history or ticket responses | All five functions change in one migration; the landlord detail accepts the unverified form | The whole queue parses with `CoreManagerWorkItemsSchema`; maintenance facts parse with `CoreUnitMaintenanceFactSchema`; over HTTP the manager's ticket list, detail and handling answer 200 |
| T8 | The unverified building reads as verified facts | No fact fields; `contextVerified` and `routingEligibleFields` are fixed | The contract rejects a fact field, `demo: true`, `contextVerified: true` and a routing field; the passport schema rejects the unverified form |

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
- Amendment RED (`542c5d8`): the contract test failed at its first expectation (the landlord detail rejected the unverified building), so its four rejection cases first ran after the fix; the presenter threw a `ZodError` on `demo`, `primaryUse`, `approvalYear`, `managementMode` and `heatingType` while the passport guard passed; over HTTP the manager's ticket list answered 503 (test line 92) while the other six tests in the file passed.
- Amendment GREEN (`bd754c5`): contracts 53/53, presenters 8/8, and PostgreSQL `core-building-context-fallback`, `vendor-handoff-manager-preview`, `core-flow` and `core-flow-photo-evidence` 25/25.
- Full checks again at `bd754c5`, one after another (19:22–19:38 KST):
  - `typecheck` (packages, tests, web, mobile) and `check:deps`: exit 0. `lint`: 0 errors (the same 7 web warnings).
  - `test:web`: 87 files, 1015 tests passed. `test:mobile`: 17 suites, 173 tests passed. `build:web`: compiled.
  - `test:postgres`: 47 files, 641 tests passed (670 s).
  - `test:shared`: the first run had six 5 s timeouts in architecture graph tests (#119) while a read-only review ran beside it; the one allowed rerun passed 52 files, 657 tests. The five graph files one at a time: 47/47.
- Delta-review fixes (`1580e09`): presenters 9/9, and weakening the condition to only `!demo` or only empty context fails the new case each time (mutation check, original restored); the HTTP test alone (`-t "over HTTP"`) passes, the C1 file 7/7; `typecheck:tests` and the web typecheck exit 0.
- CI on `c15a19b` (before the amendment): every check passed, which shows the e2e suites did not reach a fallback building.
- Not run locally: `test:e2e:core` and `test:e2e:sdk`. They use the shared fixture, which must not receive an unmerged migration. CI's `web-e2e` job runs them on a fresh database.
- `python scripts/verify_repository.py --history`: run on the staged records before the PR (result in the PR body).

## Rollback

- An image rollback leaves the database functions as they are. Rolling the image back to a build before this PR while 0025 stays applied brings the manager 503 back, so apply the 0026 rollback or insert building rows first.
- The database moves forward only (DEV-08). To undo, a new migration 0026 recreates the five functions from 0011, 0015, 0018 and 0019 and drops the helper.
- Before such a rollback, insert building rows for any building that has requests but no row; otherwise the old bodies put null entries in the manager queue (T7).
- Every hosted demo building has a stored row, so the demo's screens do not change.

## Retained risks and not verified

- D1: several unnamed buildings all read `건물` in the manager lists until step 2 adds a name input.
- D2: a building without an address cannot be handed to a vendor until step 2.
- Step 2 (building information inputs with P6) has no spec yet. It must widen the landlord building contract before it stores any fact for a non-demo building: such a building has non-empty context, goes to the full passport check (`demo` must be true, four facts required) and would bring the manager 503 back.
- After 0025, units without building information share `units()`'s `LIMIT 200` with the others, so in an organisation with more than 200 units some units with building information can drop out of the list. The development session's 0026 (operator-approved) removes the limit.
- Isolation is checked for `tenantOther`, `otherTenant` and `staff`; another organisation's manager is not in the test.
- The spec's "recommendation is landlord review or none" is checked through the protocol choice here and through the unchanged domain tests (`recommend-route.test.ts`), not by finishing a request in PostgreSQL. The per-request maintenance read (`read_ticket_maintenance_fact`) builds its result with the same `maintenance_fact_json` tested here, but the new test does not call it.
- Migration 0025 has not run on the hosted demo database. The 0026 rollback is planned, not rehearsed.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

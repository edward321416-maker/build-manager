# Building info save path (P6 + C1 step 2, PR 1), acceptance

Snapshot: **2026-10-15 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. No screen uses the new routes until PR 2; nothing is deployed.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: new migration with permission-checking `SECURITY DEFINER` functions, a manager response contract change, building facts that drive tenant questions and route recommendations, and the FROZEN B3 HTTP boundary (DEV-01) |
| Operator decisions | 2026-10-15, in session: "4번 ㄱㄱ"; "정보 입력 + 새 화면 먼저 (추천)"; "추천에 쓴다 (추천)"; "A. 목록 → 건물 화면 (추천)"; "체험에서는 보기만 (추천)"; design "승인 (추천)" |
| Design and plan | [Design](../docs/superpowers/specs/2026-10-15-building-setup-p6-design.md) (API lines corrected to the implementation: POST and the existing Core error codes), [plan](../docs/superpowers/plans/2026-10-15-building-info-save.md) (written after the approval, before the implementation) |
| Policy | `POLICY_REF` main `faf1737`; the rulebooks are unchanged since `446ee50` (main merged in again at `b10e685`, docs only) |
| Base | Implemented on main `2b872de`; main `7969f4c` (#168) merged in at `bb4f45f` before the PR |
| Independent review | Fresh-context review agent, read-only, on `b134a40`: **With fixes**, no blocking or high findings. MEDIUM: the save filter refused only ASCII controls while the vendor packet refuses `\p{Cc}\p{Cf}`, so a pasted zero-width space or direction override in an address could later fail the manager's vendor handoff read (503); fixed in contract and SQL with tests. LOW: demo detection fails open if the demo configuration is switched off while a demo cookie lives (retained risk below); record counts and base (fixed here); spec lines on empty address and route files (fixed); the vendor-source check used `building_body` instead of `vendor_handoff_source` (the test now calls the real source). Nits (unpaged list, whole-body replace) are recorded as risks. |
| PR | Recorded in the PR body with its final head and that head's CI |

## Change

- Manager response: `UnverifiedBuildingDtoSchema` becomes `OrgBuildingDtoSchema`. A non-demo building may carry the `managementMode` and `heatingType` an organisation admin verified (none, one or both); `routingEligibleFields` names exactly those and `contextVerified` means both. Demo buildings keep the full passport. This is the C1 step 1 condition for step 2: widen the response before any fact is saved.
- Migration `0028_core_building_info.sql` (owner `bm_core_flow_owner`, `SECURITY DEFINER`, `search_path=pg_catalog`, no `PUBLIC` execute; `bm_b1_web` may execute only the three entry points):
  - `org_buildings(digest)`: the organisation's active buildings with name (or `null`), active unit count and `needsInfo` (no name or no vendor address), ordered by name with `core_flow.unit_name_order`.
  - `building_info(digest, property)`: name, vendor address, verified heating and management, `demo`, `version`, unit count.
  - `save_building_info(digest, property, expected_version, name, address, heating, management)`: ORG_ADMIN of the session's organisation only (`42501`), other organisations' or missing buildings `P0002`, demo rows refused (`42501`), bounds and single line (`22023`), stale version `P0001`, and an advisory lock per building so two admins cannot both make the first save. The body keeps the 0011 building shape (`displayName`, `demo:false`, `sourceNativeIds`, `context`) plus `serviceAddress`, `version`, `updatedAt`; heating and management are `OWNER_VERIFIED`, `verified:true`, `routingEligible:true` facts, and `null` removes the fact.
  - Helpers `require_org_admin`, `verified_fact`, `building_info_json` are owner-only.
- Core API (B1 only, ORG_ADMIN): `GET /api/v2/core/buildings` (`{editable, items}`), `GET /api/v2/core/buildings/{id}` (info plus `editable`), `POST /api/v2/core/buildings/{id}` (save). Contracts in `packages/api-contracts/src/core-building.ts`.
- Demo read-only (D4): `requireCoreB1Session` marks a session whose user is a configured login-free demo subject (`isDemoEntrySession`). Such a session reads `editable:false`, its saves are 403, and B3 property and unit creation answer 403 before any port call, with the create-capability headers `false`. B3 domain and storage code is unchanged.
- `STATUS.md` row 35; one typed vendor test double gains `demo:false`.
- Unchanged: lockfile and every `package.json`, screens, the mobile app, deployment, the demo.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | Another organisation's admin reads or edits a building | Session organisation, ORG_ADMIN check and `authn.can_read_property`; the table policy also binds the organisation | Postgres: other-org admin gets `NOT_FOUND` and cannot list it |
| T2 | Property staff or a tenant edits building info | ORG_ADMIN only, in SQL and in the route | Postgres and HTTP 403 |
| T3 | A public demo visitor defaces names or addresses other visitors see | Demo sessions cannot save or register (403), and demo buildings cannot be saved by anyone | HTTP and B3 tests |
| T4 | A wrong heating answer leads to wrong questions or route advice | Recommendations always need manager review; `null` (모름) keeps today's behaviour | Domain check in the Postgres file |
| T5 | The vendor address reaches the wrong people | Only the existing vendor handoff reads it; tenant responses and the building list never carry it; nothing logs it | Response shapes; `vendor_handoff_source` carries the saved name and address for the manager's ticket |
| T6 | Two admins overwrite each other | Version check and a per-building advisory lock for the first save | Two-admin test, five rounds |
| T7 | Long, multi-line, control or invisible format characters | Contract (`trim`, length, no `\p{Cc}\p{Cf}`, the vendor packet's own rule) and the same set in SQL (`core_flow.has_invisible`, Unicode 17.0 ranges written as code point numbers), parameterised SQL | Contract and SQL bound tests (zero-width space, direction override, U+0085, soft hyphen, BOM, tag character); a test compares `has_invisible` with the JS rule over every code point (a copy without U+FEFF fails it) |
| T8 | The manager response 503s once facts exist (C1 step 1 hand-over) | Widened response first, tested with zero, one and two facts | Contract and presenter tests |

## Verification

All local runs on 2026-10-15 KST with Node 24.21.0 and npm 11.19.0.

1. Response widening first failure: the contract test rejected one- and two-fact buildings, and the presenter threw a ZodError on a non-demo building with a fact. After: contracts 53/53, presenters 9/9. The old presenter expectation "a building with some context must fail" is replaced on purpose (design D2).
2. Save path first failure: `tests/postgres/core-building-info.test.ts` failed structurally (no `buildings` scope, no functions), then 6/6; with the HTTP test added in task 3 the file has 7 tests, 7/7.
   - One assertion first failed because the test read `building_body` without the organisation setting the vendor path uses; the test then set `app.org_id` in a transaction (test fix, not a code change). After review it calls `core_flow.vendor_handoff_source` instead.
3. Demo marker first failure: the B1 access test lacked `demo`, then 5/5. B3 demo guard first failure: 201 for a demo session, then 35/35.
4. The HTTP route was written before its HTTP test ran. Its failure was shown afterwards by mutation: of 5 route mutants, 4 were killed (route removed, demo save allowed, demo shown editable, body unchecked); the ORG_ADMIN check in the route survives removal because the SQL function refuses the same sessions (equivalent). The same delta run re-ran the lock mutant from item 5 (6 mutants, 5 killed).
5. Migration mutation, 9 copies: org-admin check removed, demo save allowed, version check removed, first-save lock removed, property permission skipped, control characters allowed, heating unchecked, facts not routing-eligible, helper executable by the web role. 8 killed at first. The surviving lock mutant ran under one admin session whose digest lock already serialised both saves; with a second admin session and five rounds the test kills it. All files were restored byte for byte.
6. Related Postgres suites: `core-building-context-fallback`, `core-unit-list`, `core-unit-order`, `vendor-handoff-foundation` 42/42.
7. DEV-06 / DEV-04 at the implementation head `5e34965` (base `2b872de`), run one after another on 2026-10-15 to 10-16 KST:
   - `test:shared`: 53 files, 674 tests passed. After merging main (`bb4f45f`) the full run timed out 7 graph-boundary tests at 5 s (#119, parallel load); the four files run one at a time passed 39/39, and typecheck and the targeted web tests (56/56) passed.
   - `test:web`: the first run failed under host load from other sessions (a local model run and folder deletion): forks workers timed out on start and the photo decoding test hit its 5 s limit. The one allowed rerun passed 96 files, 1103 tests (DEV-06).
   - `lint`: 0 errors (8 existing warnings, none in a changed file). `typecheck`: exit 0. `build:web`: compiled. `check:deps`: exit 0.
   - `test:postgres`: 50 files, 658 of 659 passed. The failure was `tests/postgres/core-flow.test.ts` "pins RC1 owner, membership, FORCE RLS and exact capability exposure", which pins every `core_flow` function: the six 0028 functions were not in it. The pin now lists them, with web execute only on `building_info`, `org_buildings` and `save_building_info` (intended change, not a fixture fix); that file then passed 8/8. The full suite runs again as the PR's `postgres-integration` job.
   - `verify_repository.py --history` failed in this worktree on another session's unmerged branch (`tests/architecture/ai-draft-eval.test.ts`, email pattern); it is recorded with the branch-only result in the PR body.
   - No package file differs from the base.

## Rollback

- Revert the merge commit. The new functions remain in the database with no caller.
- Do not revert the response widening alone after a non-demo building has saved facts: that building's manager responses would fail again. To undo fully, first clear `context` on those rows with a new migration.
- Demo read-only reverts with the code; no data changes.

## Retained risks and not verified

- Adding a building is two calls in PR 2 (B3 create, then name save); a failed second call leaves a nameless building that the screen reports.
- The building list is not paged.
- No rename or delete for buildings and units.
- Org-admin facts are not checked against public registers; `OWNER_VERIFIED` means "an admin confirmed it".
- Demo detection reads the demo configuration at request time. If demo entry is switched off (or its subject list stops parsing) while a demo session cookie is still valid (up to 1 hour), that session is treated as a normal admin and could save; the demo is synthetic and the window is short (review LOW, accepted).
- A save replaces the whole stored body of a non-demo building; future non-demo facts written elsewhere would need merging first.
- Not verified: any screen (PR 2), the hosted demo.
- Review fixes (after `b134a40`): contract and SQL now refuse `\p{Cc}\p{Cf}` (first failure: contract 1 test and the SQL bounds test, then contracts 54/54 and the Postgres file 7/7), and the vendor-source check calls `core_flow.vendor_handoff_source`.
- Delta review of `b134a40..1039d4e`: **APPROVE**, with two LOW notes, both fixed. (1) The editing tool had written most escapes in the SQL class, and some test strings, as raw invisible characters (GitHub's bidirectional-text warning; an editor could drop one unseen). The class is now `core_flow.has_invisible` with code point numbers (`0x200B`), the tests build the characters with `String.fromCodePoint`, and a scan finds no raw invisible character in the changed files. (2) This record's stale sentence on `app.org_id` (fixed above). Contracts 54/54; `core-building-info` 8/8 and `core-flow` 8/8 (the pin lists `has_invisible` as owner-only).
- Deviation (DEV-05): two test lines holding raw invisible characters were replaced by a checked script (it compared each old line by code points before writing), because the editing tool could not target those characters; the change is the two lines shown in the diff.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

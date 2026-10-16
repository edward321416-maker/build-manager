# Building and unit screen (P6 + C1 step 2, PR 2), acceptance

Snapshot: **2026-10-16 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. Nothing is deployed; the hosted demo runs main `7969f4c`, which has neither PR 1 nor this screen.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: a new screen inside the FROZEN RC1 `/core` flow that saves the building facts tenant questions and route recommendations use, and that registers buildings and units through the FROZEN B3 API (DEV-01, "when unsure, high-risk") |
| Operator decisions | 2026-10-15 (design, see [PR 1 acceptance](building_info_save_20261015_acceptance.md)); 2026-10-16 before this PR, D5 "메뉴만 바꾸기 (추천)": the `/workspace` addresses stay as they are, the menu row opens the new screen, and cleaning up the old pages gets its own design. Other choices were "건물 화면 주소만 이동" and "설계대로 전부 이동" |
| Why D5 was asked | The design said every `/workspace` address would redirect to the new screen. `/workspace` is where B1 sign-in lands (`apps/web/src/server/b1/complete-session.ts`, checked by `core-login-e2e/session.ts` as `B1_FIXED_COMPLETION_REDIRECT_CHANGED`), and the FROZEN B1–B4 browser suites (`apps/web/tests/b1-e2e/b1·b2·b3·b4.spec.ts`, run in CI) drive those pages |
| Design and plan | [Design](../docs/superpowers/specs/2026-10-15-building-setup-p6-design.md) (D5 and the choices made while building, dated 2026-10-16), [plan](../docs/superpowers/plans/2026-10-16-building-setup-screen.md) (written before the screen code), [visual page](https://claude.ai/artifact/DDeoMxCmVQLK18LUvbfThL) (republished as version 3) |
| Policy | `POLICY_REF` main `32f8e15`; the rulebooks are unchanged since `446ee50`. Design rules v1 and development rules read in this session before the screen work |
| Base | main `32f8e15` (#170, PR 1) |

## Change

- Menu: the organisation admin's 더 보기 row 건물·호실 관리 is a `/core` screen (`view=buildings`, left-menu icon `layout-grid`) instead of a link to `/workspace`. The `href` menu row kind had no other use and is removed.
- Screen (`apps/web/src/app/core/buildings/`): list (`건물 {n}곳`, rows with name or `건물`, `호실 {n}개` or `이름 없음 · 호실 {n}개`, status label `정보 입력 필요`) → building (facts 건물 이름 · 업체에 알려 줄 주소 · 난방 방식 · 관리 방식, then the building's units) → info form (name, vendor address, heating and management tiles) / add building / add unit. From 1120px the list and the building sit side by side; on phones the one action is a bar fixed at the bottom. The public demo (and demo buildings) show `체험에서는 바꿀 수 없어요.` where the buttons would be.
- Steps inside the screen are history entries on the same address (`history.state.building`, validated on read), so browser back walks up one step; the address keeps P5's `tab`/`view` only.
- Data: building list and info from PR 1's Core API; saves send the shown version (`expectedVersion`), so a concurrent change is a 409 with "다른 관리자가 먼저 고쳤어요…" and a reload; an unknown save result is treated as saved only when a reload shows exactly that save at a newer version. Adding a building is B3 create (the name as its reference) then a Core name save; a failed second step opens the building with "건물은 추가했어요. 이름을 저장하지 못했어요. 건물 정보에서 다시 저장해 주세요."; an unknown first step never saves a name. Units come from the session's Core unit list (0026: building, unit name, id order, all units) filtered to the building, instead of the B3 unit API, which orders by id.
- Unit names are checked on the screen by B3's limits plus the vendor packet's `\p{Cc}\p{Cf}` rule; B3 itself is unchanged.
- API client: `client.buildings` (list, read, save; B3 create and add unit), contracts parsed before sending.
- Design audit: the demo manager's read-only list and building, and a non-demo organisation admin's list, add-building (empty and with a field error), building, info form and add-unit screens, at every audited width in Chromium and WebKit; building rows read from the left in the `center` check.
- Unchanged: server code, migrations, B3 domain and storage, `/workspace` pages, the mobile app, package files.

## Threats

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | A demo visitor edits shared names (the screen offers a way) | The screen shows no input when `editable` is false, including on an input step restored from history; the server refuses anyway (PR 1) | Unit test over edit/add/addUnit steps; mutant "demo session gets the info form" killed |
| T2 | Two admins overwrite each other | The form sends the version it showed; 409 keeps the input and offers a reload | Unit test; mutant "save ignores the version" killed |
| T3 | An unknown save result is shown as saved | Saved only when the reload shows the same values at a newer version | Unit test; mutant "any newer version counts as our save" killed |
| T4 | A building is created twice or named wrongly after an unknown create | No name save after an unknown create; the message says to check the list first | Unit test; mutant killed |
| T5 | A name, address or unit name later breaks the vendor packet | The same `\p{Cc}\p{Cf}` rule on the screen as the vendor packet (names and addresses also on the server since PR 1) | Form tests with zero-width space, direction override, soft hyphen, BOM; mutants killed |
| T6 | Forged history state opens something unexpected | Only five shapes with UUID ids are read; the server checks every read and write | Unit test; mutant "history state accepts any id" killed |
| T7 | The vendor address shows where it should not | Only the admin's building screen shows it; tenant responses are unchanged | Response shapes from PR 1; this PR adds no tenant view |

## Verification

All local runs on 2026-10-16 KST with Node 24.21.0.

1. First failures (test before code): API client (`client.buildings` undefined, 3 failed), menu (6 failed: row kind, allowed views, left menu, links), place (module missing), views (module missing; the views file was written first and was moved aside before its test ran), forms (module missing), screen (module missing). After the code: client 65/65 in `packages/api-client`, `src/app/core` 38 files / 333 tests.
2. Mutation, 13 copies of the screen code (each weakens one rule): 13 killed by the unit tests; every file restored byte for byte.
3. Browser (`test:e2e:sdk` with `buildings.spec.ts` and `navigation.spec.ts`, production build): 7/7. A new admin in a new organisation (organisation A is not grown) adds a building, saves address and heating, adds a unit, walks back with the browser, sees the name in the Core unit list and the facts in the building info, and gets the side-by-side layout at 1280px; a duplicate unit name stays on the form. Screenshots (synthetic) in the private evidence folder.
4. Design audit (`scripts/design-audit.mjs`, Chromium 320–1440px and WebKit 320–430px, port 3144): the first run, 330 screens, had 1 finding (`center`, 768px info form: the 건물주 직접 관리 tile wrapped beside its inline radio). Looking at the screenshots also showed the tiles one per row at 320px, against rule 8.3 (two on phones). Fixed by putting the radio on its own line above the name and an 8rem column floor (`b4320fa`); the second run: 330 screens, **0 findings**, no coverage gap (every new screen reached in both engines).
5. DEV-06 / DEV-04 at `b4320fa` (base `32f8e15`), 2026-10-16 KST, one after another in the foreground (the first background attempt of lint and the shared and web tests was stopped by Claude Code under host memory pressure, 3.7 GB of 31.8 GB free, before any result):
   - `lint`: 0 errors; 8 warnings, all in files this PR does not touch.
   - `typecheck`: exit 0. `build:web`: compiled (twice, before each audit run). `check:deps`: exit 0.
   - `test:shared`: 54 files, 674 of 678 passed; the 4 failures were the graph-boundary tests timing out at 5 s under load (#119). The four files run one at a time passed 39/39.
   - `test:web`: the first run had 1 failure, a 5 s timeout loading the Vendor container module (`src/server/vendor-handoff/container.test.ts`), untouched here; the one allowed rerun passed 107 files, 1171 tests (DEV-06).
   - `verify_repository.py --history` on a clone of this branch only: PASS (967 files, 969 internal links, 3820 history blobs, 0 findings).
   - `test:postgres`: not run locally, since this PR changes no database code; the PR's CI job `postgres-integration` runs it.
   - No package file differs from the base.
6. After merging main `5972770` (#171, scripts and docs only; the two ops files resolved as main's file plus this PR's own line) at `653d3c1`: `typecheck` exit 0; the merged `tests/architecture/ai-draft-eval.test.ts` with `packages/api-client` 112/112; `build:web` compiled; `test:e2e:core` 65/65; `test:e2e:sdk` 44 of 45.
   - The one SDK failure is `core-login-e2e/login.spec.ts` at 390px, line 31 (every control in view must be hit-testable). It also fails, at the same line, with main's own app code built in this worktree, so it is not from this PR. A diagnostic sampled right after load (not committed) showed why: for about 50–300 ms the tenant's photo picker input sits at y 766–816, its centre under the fixed tab bar, until the request cards load and push the form down; the local shared fixture holds many old requests, so the timing differs from CI's fresh fixture. Recorded as a pre-existing local issue; this PR's CI runs the suite on a fresh fixture.
7. Process notes (DEV-05): the views file was written before its test; it was moved out of the tree, the test was run and failed (module missing), and the same file was moved back. The 13 mutants were applied by a script that checks each pattern is unique and restores every file byte for byte; nothing a script wrote is committed.

## Rollback

- Revert the merge commit. The menu row opens `/workspace` again, which D5 left working; no data changes (buildings and units added on the screen stay, as with `/workspace`).

## Retained risks and not verified

- D5: the old `/workspace` pages remain, reachable from the sign-in landing page; a building made there has no name and shows as `정보 입력 필요` on the new screen. Their clean-up needs its own design (it moves FROZEN B1–B4 browser tests).
- Adding a building is two calls; a failed second call leaves a nameless building, which the screen reports and lets the admin name.
- A building's units are all shown at once (no paging); the building list is not paged either.
- No rename or delete for buildings and units; no unit detail screen.
- Not verified: the hosted demo (not deployed), the mobile app (out of scope), a real phone.
- AI-written (Claude Opus 5.5, Claude Code). Human review: NOT_RUN.

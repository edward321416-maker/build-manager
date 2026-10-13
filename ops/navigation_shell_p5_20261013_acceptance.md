# P5 navigation shell (tab bar and left menu), wiring, acceptance

Snapshot: **2026-10-13 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This is PR 1a-2 ("메뉴 붙이기") of the P5 bundle. PR 1a-1 (the parts, #136) is already on main. PR 1b (우리 집 cards, 내 요청 in two groups, the to-do line) and PR 2 (per-request to-do reasons) follow. Nothing is deployed. The operator is asked before any demo deploy, after the bundle.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk (DEV-04): it replaces the navigation of every `/core` screen, including FROZEN screens and their browser tests |
| Operator decisions | 2026-10-10 menu audit: tenant tabs 우리 집 · 내 요청 · 알림 · 내 정보, manager tabs 업무함 · 알림 · 더 보기. 2026-10-13, in session: web first and the app in app v2 ("웹 먼저, 앱은 앱 v2 때 (추천)"), a to-do list under 알림 ("처리할 일 모아 보기 (추천)"), spec approved after two full reviews ("전수점검하고 통과하면 승인할게"), icons D9 "문서 · 열쇠 · 네 칸 (추천)", execution "단계마다 새 도우미에게 맡기기 (추천)" |
| Spec and plan | `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md` and `docs/superpowers/plans/2026-10-13-navigation-shell-p5-skeleton.md`, Tasks 7–14 |
| POLICY_REF | main `48d2516` (the rulebooks were read at this commit; main `37aac2d`, merged in before the PR, changed no rulebook) |
| Base | main `48d2516`, then main `37aac2d` merged in (records only) |
| TARGET_REF | `6bfae1a` (reviewed candidate). The PR records its final head and that head's CI. |
| Independent review | See Reviews |
| PR | Recorded on the PR itself |

## Change

- **Menu on `/core`** (web only)
  - Up to 767px a bottom tab bar, from 768px a 248px left menu. Both are one `<nav aria-label="주 메뉴">` (rules 8.10, 8.13–8.16, 12).
  - Tenant: 우리 집 (intake), 내 요청 (recent requests), 알림 (to-do list), 내 정보 (내 호실, 내 소속, 호실 연결, 오픈소스 라이선스, 로그아웃).
  - Manager: 업무함, 알림, 더 보기 (호실 정비 이력, 입주 연결, 건물·호실 관리, 내 정보). From 768px the 더 보기 rows sit in the left menu with the D9 icons.
  - The place lives in the address (`/core?tab=&view=`). An open request is one history entry marked in `history.state`, never in the address.
- **Removed**: the old top menu (관리자 보기, 작업 이동), the 40px phone menu links and the view switch.
- **Moved, unchanged inside**: the work queue, the maintenance history, the onboarding panel (embedded, titled 입주 연결 or 호실 연결), the organisation select and sign-out (both now in 내 정보).
- **Rules and tools**
  - `design/DESIGN_RULES.md` records the P5 decision, dated to the 2026-10-10 decision. It also adds the §8.13 rows, the §8.14 role tabs and the §16 navigation.
  - `scripts/design-audit.mjs` drops the 40px exception, so tap targets are 50x50 everywhere, and it reads the new screens.
  - `scripts/demo-smoke.mjs` signs out through the logout form when the page has one.
- **Spec corrections** (final review): during 1a, 우리 집 shows only the intake form, and 최근 접수 moved to 내 요청. The single-organisation text row arrives in PR 1b; until then the select stays.

## FROZEN scope change

The screens did not change inside; only the way to reach them did. The browser tests keep their assertions and reach the screens through four helpers in `apps/web/tests/core-e2e/presentation.ts`: `openTab`, `openMoreRow`, `openAccount` and `openTicketRow`.

Where a check lost its meaning it was replaced, not dropped:

- `responsive-polish.spec.ts`: the "submit above 최근 접수" check is gone, because 최근 접수 moved to 내 요청.
- `core-login-e2e/maintenance-fact.spec.ts`: the old privacy check used a wide-only link that is hidden at 320px, so it could not fail. It now asserts that the replacement occupant sees the tenant menu and the tenant screen.
- `core-login-e2e/design.spec.ts`:
  - A sub-screen title is checked as the 15px subheading and a first-screen title as the 20px title (spec §2, rules 8.10).
  - The 내 정보 region is checked for B1/RC1 data, like the rest of the screen.
- `usability.spec.ts` and `ticket-communication.spec.ts` used to read rows in the hidden 내 요청 list. They now open that tab and assert the rows are visible.

New tests: `core-e2e/navigation.spec.ts` (with its own session) and `core-login-e2e/navigation.spec.ts` (4 tests).

## Threats

| Threat | Control | Evidence |
| --- | --- | --- |
| A hand-made address opens another role's screen | `parseNavLocation` accepts only the role's own tabs and allowed views, and falls back to the first tab. The render also gates role-only screens. | `nav-location.test.ts`; mutation 4 below |
| A screen from the previous organisation shows after a switch | The org switch replaces the address with `/core` and remounts the page under a new key | Final review trace; `core-login-e2e/navigation.spec.ts` |
| History state carries data | It holds only two booleans (`coreNav`, `detail`), and links come from fixed values | `use-nav-location.test.ts` |
| A menu tap loses unsent photos | The menu, the 알림 rows and back all go through the photo guard | Task 8 fix round; `core-e2e/navigation.spec.ts` |
| A replacement occupant sees manager navigation | The menu follows the session role | `core-login-e2e/maintenance-fact.spec.ts` |

No endpoint, database or server code changed.

## Reviews

- Every task had a fresh-context review. These tasks needed fix rounds:
  - Task 7 (2 rounds): a race in the first-screen helper.
  - Task 8: 알림 rows bypassed the photo guard, and 알림 was not re-read when opened.
  - Task 10: the top bar was 60px instead of 56px.
  - Task 11: a privacy check could not fail.
  - Task 12: a caption style leaked into `/core/join`.
  - Task 13: the 2026-10-10 date was dropped from the decision record.
- Whole-branch review on `ad14de2`, fresh context, most capable model:
  - Verdict: "ready with fixes".
  - History handling, role gating, org-switch isolation and security held.
  - Two Important findings were spec drift (the spec corrections above).
  - The rest was fixed before merge: the audit header comment, two hidden-row assertions, the 내 정보 leak check and a CSS comment.
- The fixes are in `9c6795c` and `6bfae1a`. A scoped re-review found all six addressed and nothing new broken.

## Verification

- Mutations (plan Task 14 Step 2): four deliberate breaks, each caught by its named test and then reverted. The clean tree then passed `src/app/core/nav` (6 files, 44 tests).
  - Removing `aria-current` → `core-nav.test.tsx` "marks only the current place".
  - Counting an unconfirmed reply as a to-do → `todo-list.test.ts` "marks the list partial …".
  - Reversing the to-do sort → `todo-list.test.ts` "sorts urgent first …".
  - Allowing another role's tab → `nav-location.test.ts` "falls back …".
- Local checks (Node 24.21.0). The fix wave changed only tests, docs and comments. History check, unit suites and lint were re-run on `6bfae1a`. Typecheck was re-run after the fix wave. build:web, check:deps and test:postgres ran on `ad14de2`. The e2e runs and the audit used the tree with the fix wave.
  - `verify_repository.py --history`: PASS (3,291 history blobs, 0 findings)
  - test:shared: 48 of 52 files passed. In the full run, four graph-boundary tests hit the 5s limit, both in the first run (alongside the final review) and in the rerun alone (#119, parallel host load). `tests/architecture` alone with the same config passed: 13 files, 236 tests.
  - test:web: 85 files, 998 tests passed in the rerun. The first run had one 5s timeout under load.
  - lint: 0 errors and 7 warnings, all in files this branch does not touch
  - typecheck, build:web and check:deps: passed
  - both verifier self-tests: OK
  - test:postgres: 46 files, 633 tests passed
  - test:e2e:core: 45 passed, 2 failed (see below)
  - test:e2e:sdk: 35 passed, 5 failed (see below)
  - test:e2e:vendor: 18/18 passed
  - design audit: 231 screens, 0 findings
- The fix wave's test edits were saved before the e2e runs started, so those runs exercised them. The edited `usability.spec.ts` test passed. `ticket-communication.spec.ts` passed its edited lines and then failed later, at the known fixture step. The new 내 정보 check in `design.spec.ts` passed: the capture that follows it was written during the run.
- CI: recorded on the PR.

## Known local failures

The shared local Core fixture keeps growing. CI uses a fresh database. Resetting the fixture is data deletion and needs the operator, so it was not reset. No run on main against the same fixture was made for comparison.

| Test | Cause |
| --- | --- |
| core `manager-work.spec.ts:13`, `ticket-communication.spec.ts:27` | More than 2,000 tickets in the test organisation. Each queue reload sweeps the summaries in about 5s, the whole expect window. Both passed in a diagnostic run with longer timeouts. |
| sdk `login.spec.ts:35` (320, 390, 1280), `design.spec.ts:53` | More than 200 units against the unit query's `LIMIT 200`, so the new unit can be missing from `건물·호실` (`did not find some options`). They passed in a diagnostic run without that select line. |
| sdk `design.spec.ts:112` | Invitations are paged 20 at a time in random UUID order, so the new one can land on page 2 |

## Rollback

- Revert the PR. There is no database or API change.
- Old `/core` bookmarks have no `tab`, so they open the first tab.
- `demo-smoke.mjs` signs out on both the old and the new screen.

## Not verified

- The new sign-out path in `demo-smoke.mjs` has not run against the demo (nothing is deployed) and has no unit test. The first check after the next deploy runs it.
- These were checked by hand only, not automated:
  - a focused control is not hidden by the tab bar (`scroll-padding-bottom`)
  - a wide-screen menu click with unsent photos does not close the request
  - the 320px/200% tab label: 우리 집 measures about 73.6px in an 80px slot, so it fits but is tight

## Deferred to PR 1b and PR 2

- PR 1b:
  - the single-organisation text row
  - the duplicate history entry when a request is closed through its own tab
  - focus after the place changes from inside the content
  - a reason line for disabled 내 요청 rows
  - consistent wide-screen title sizes
  - one refresh button on the link screens
- PR 2:
  - per-request to-do reasons
  - sharing the manager's conversation summaries with the work queue

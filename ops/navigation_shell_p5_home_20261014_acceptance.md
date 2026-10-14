# P5 PR 1b: 우리 집 in-progress requests, 내 요청 in two groups, single-organisation name, acceptance

Snapshot: **2026-10-14 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This is PR 1b of the P5 bundle; PR 1a (#136 parts, #139 wiring) is on main and on the demo. PR 2 (per-request to-do reasons) follows. Nothing is deployed; the operator is asked before any demo deploy.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk (DEV-04): FROZEN `/core` screens and their browser tests change |
| Operator decisions | 2026-10-13: spec approved ("전수점검하고 통과하면 승인할게"); next plan "그래 다음 계획 ㄱ"; plan and its three new texts "이대로 진행 (추천)". 2026-10-14: the 우리 집 rows are whole-row buttons, as rule 8.5 says ("줄 전체를 누르게 (추천)"), instead of the spec's separate 열기 button |
| Spec and plan | `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md` (amended by this PR) and `docs/superpowers/plans/2026-10-13-navigation-shell-p5-home.md` |
| POLICY_REF | main `f08345d` (rulebooks read at `81c6d39`; `f08345d` changed records only) |
| Base | main `81c6d39`, then main `f08345d` merged in |
| TARGET_REF | `7a08d62` (reviewed candidate). The PR records its final head and that head's CI. |
| PR | Recorded on the PR itself |

## Change

- **우리 집** (tenant)
  - A to-do line "처리할 일 N건 · 알림에서 보기". It is a link to 알림 with the look of a secondary button, and it shows once the conversation summaries are read.
  - "진행 중인 요청": at most 3 unfinished requests of the chosen unit, ordered to-dos first, then most recent activity.
    - Each row is one button with the request name, its status label and a next-step line (`nav/tenant-home.ts`).
    - "내 요청에서 모두 보기" shows when there are more than 3.
    - The section shows once the summaries are read. If the read fails, the rows stay reachable without next-step lines, under the same alert 내 요청 uses.
- **내 요청**: the old 최근 접수 list is split into "진행 중" and "끝난 요청". Rows are unchanged.
- **Lock hint**: "고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요." on 우리 집, 내 요청 and 알림 while picked photos lock the rows.
- **내 소속**: one organisation shows as its name and role in text; two or more keep the choice.
- **History**: the screen remembers, in memory only (not the address, not `history.state`), the address a request was opened over. That screen's menu item then steps one entry back, so a back press never shows the same screen twice. This also covers a manager's request opened from 알림 or 호실 정비 이력.
- **Focus**: when an in-content control that moved the place disappears (a 더 보기 or 내 정보 row, closing a request, 모두 보기), focus goes to the new screen's title. After choosing an organisation, the new page starts at its title.
- **Titles and bars**: from 768px, screens the left menu lists keep the first-screen title. Inside the menu, the link screens draw one top bar, and "연결 상태 새로고침" is a button in the content.
- **Audit**: `scripts/design-audit.mjs` reads `[data-home-card]` rows from the left.

## Deviations from the plan, and why

| Plan | Shipped | Why |
| --- | --- | --- |
| `samePlace` boolean in `history.state` | `detailOrigin` kept in memory | Task 5 review: `samePlace` left a dead back step for a manager's request opened from 알림 or 호실 정비 이력. History state stays boolean-only. |
| Separate 열기 button per row | Whole-row button | Final review found the rule 8.5 conflict, and the operator decided on 2026-10-14. It also cleared 22 `center` audit findings. |
| CSS for the to-do line and the form gap | Specificity fixed, 30px section gap | Task 3 review: the plan's own CSS lost to an existing link rule and left the form flush against the rows. |
| Tab-bar test checks 20px clearance | Same, plus a scroll check | `scroll-margin-block` on focused controls also keeps the 20px. The test checks what the user sees and fails when both guards are removed. |
| Rows render at once | Rows render after the summaries read | Final review: a failed read must not produce an unconfirmed next step (rules 10 and 8.11). |

## FROZEN test changes

Assertions keep their intent; only the way to reach a screen or the copy they read changed.

- `core-e2e/core.spec.ts`: the 내 요청 check reads the "진행 중" region. The logout check, which could no longer fail because the old heading was gone, now checks that region's count is 0.
- `core-e2e/usability.spec.ts`, `core-login-e2e/ticket-outcome.spec.ts`: the old empty text "선택한 호실의 접수 내역이 없어요…" is now the two group texts.
- `core-login-e2e/design.spec.ts`:
  - For the single-organisation account, 내 정보 shows the name as text and no choice.
  - The focus-ring check on the wrapped current name moved to a new two-organisation test.
  - The title-size check reads the new `data-menu-screen` mark.
- `core-login-e2e/ticket-communication.spec.ts`: the organisation-drop test runs on a two-organisation account (`twoOrgSession`), since one organisation has nothing to choose.
- `core-login-e2e/navigation.spec.ts`: 내 정보 shows 내 소속 as text. It uses the shared two-organisation helper, and focus lands on the title after a switch.

## Threats

| Threat | Control | Evidence |
| --- | --- | --- |
| History state carrying data | Still only `coreNav` and `detail` booleans; the origin lives in module memory | `use-nav-location.test.tsx` |
| A to-do line or next step overstating what is confirmed | Shown only after the summaries read; on failure the next steps are left out and an alert says so | `home.spec.ts` failed-summaries test |
| Links built from data | In-content links come from `navHref` with fixed places | Code review |

No endpoint, database or server code changed.

## Reviews

- Task reviews, each with a fresh context: Tasks 1, 4, 6 and 8 were clean. Fix rounds were needed on these tasks:
  - Task 2 (1 round): the row button name was not pinned.
  - Task 3 (1 round): CSS specificity and gap, plus a check that could not fail.
  - Task 5 (2 rounds): test isolation, the manager dead back step, and an e2e test that could not fail on the old code.
  - Task 7 (1 round): the 20px clearance and the scroll proof.
- The whole-branch review on `2579fed` (most capable model) returned "ready with fixes":
  - Focus after 모두 보기.
  - An unconfirmed next step when the summary read fails.
  - The rule 8.5 conflict, which went to the operator.
  - Four minors to fix before merge.
- One fix wave (`1a25407`, `7a08d62`) and a scoped re-review followed. Every item was addressed and nothing new broke.

## Verification

- Mutations, each reverted after its test caught it:
  - `homeCards` without "to-dos first" → `tenant-home.test.ts`
  - `tenantNextStep` repeating 제출 전 → `tenant-home.test.ts`
  - `go()` without the origin step-back → `use-nav-location.test.tsx`
  - the single-organisation branch removed → `login-screen.test.tsx`
  - `>` turned into `>=` for 모두 보기 → `home.spec.ts` (exactly-3 test, fix wave)
- Local checks on `2579fed` (Node 24.21.0):
  - `verify_repository.py --history` PASS
  - test:shared 656/656
  - test:web 1010/1010
  - lint 0 errors (7 warnings in untouched files)
  - typecheck, build:web, check:deps and both verifier self-tests passed
  - test:postgres 633/633
  - e2e core 55/57, sdk 36/41: the failures are the known local list below
  - e2e vendor 18/18
  - design audit 231 screens, 22 findings, all fixed in the fix wave
- After the fix wave (`7a08d62`):
  - unit `src/app/core` 235/235
  - core e2e `home`, `navigation` and `usability` 17/17
  - sdk `ticket-outcome` 2/2
  - design audit 231 screens, 0 findings
  - delta re-run on `7a08d62`:
    - `verify_repository.py --history` PASS, lint 0 errors, typecheck clean, test:web 1010/1010.
    - e2e core 55/58: the two known fixture failures, plus `manager-next-step.spec.ts:114`. That one passed on its single re-run (DEV-06; the file went 6/6, the test took 12s under the large local queue).
    - e2e sdk 33/41: the five known failures, plus `core-login-e2e/maintenance-fact.spec.ts:5` (×3). Those stopped at the known `건물·호실` select (`did not find some options`, over 200 units).
- CI: recorded on the PR.

## Known local failures

The shared local Core fixture keeps growing. CI uses a fresh database. A reset is data deletion and needs the operator.

- core `manager-work.spec.ts:13` and `ticket-communication.spec.ts:27`: over 2,000 tickets.
- sdk `login.spec.ts:35` (×3), `design.spec.ts:53` and, in the delta run, `maintenance-fact.spec.ts:5` (×3): over 200 units against the units `LIMIT 200`. A test passes or fails depending on whether its new random unit falls inside the first 200.
- sdk `design.spec.ts:107`: invitation paging.

## Rollback

Revert the PR; no database or API change. Old `/core` bookmarks still open the first tab.

## Not verified, and left for later

- The rows' screen-reader names and Safari's tap focus (links are not focused on tap, so the title takes focus) were not checked on a device.
- The 진행 중인 요청 section remounts when the request set changes while summaries reload, so a row that held focus loses it.
- In follow-up mode, "원본 접수로 돌아가기" sits flush against the form heading. This was already the case on main.
- The spec does not yet describe the failed-summaries state on 우리 집.
- The tenant wording for 처리 중 differs between the row ("처리 중이에요.") and the request's own status line ("관리자가 확인하고 있어요."). This predates this PR and is for the operator.
- PR 2: per-request to-do reasons, and sharing the manager's summaries with the work queue.

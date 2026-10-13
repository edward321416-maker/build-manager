# 하단 탭바·왼쪽 메뉴 뼈대 (P5 PR 1a) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹 `/core`에 역할별 하단 탭바(767px 이하)와 왼쪽 메뉴(768px 이상)를 붙이고, 알림 탭에 이미 있는 데이터로 만든 처리할 일 목록과 배지를 보인다.

**Architecture:** 순수 모듈(메뉴 정의, 주소 읽기, 아이콘, 처리할 일 계산)과 화면 부품(메뉴, 목록 화면)을 `apps/web/src/app/core/nav/`에 새로 만든다. `CoreFlowPage`가 메뉴와 탭 화면을 그리고, 로그인 화면은 소속 선택·연결 화면·로그아웃을 `account`로 넘긴다. 메뉴 위치는 주소 `?tab=&view=`에 두고 `useSyncExternalStore`로 읽는다. 요청 상세는 주소에 넣지 않고 기록 상태(`history.state.detail`)로만 표시한다.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, CSS Modules, vitest 5 (node와 jsdom), Playwright 1.63.

- 스펙: [P5 설계](../specs/2026-10-13-navigation-shell-p5-design.md)(운영자 승인 2026-10-13 "전수점검하고 통과하면 승인할게", 두 번의 전수점검 통과).
- 이 계획은 스펙의 PR 1a(뼈대, 기존 화면 옮기기, 알림 기본 이유)만 다룬다. PR 1b(우리 집 카드, 내 요청 두 묶음, 처리할 일 한 줄)와 PR 2(처리할 일 보강)는 이 PR이 병합된 뒤 따로 계획한다.

## Global Constraints

- 위험 등급: 고위험(DEV-04). 순서: 실패하는 시험 먼저 → 전체 검사(`test:postgres`, 관련 `test:e2e:*` 포함) → 새 문맥 독립 리뷰 → `ops/` 수락 기록 → 병합. 데모 배포는 이 계획에 없다. 하려면 실행 직전에 운영자에게 묻는다.
- 작업 위치: worktree `D:\Users\admin\Desktop\모두의 창업 2기\worktree\build-manager-mobile-design`, 브랜치 `feat/navigation-shell-p5`. 다른 세션의 worktree와 브랜치는 건드리지 않는다.
- 명령은 worktree 루트에서 고정 Node로 돌린다: `export PATH="/c/Users/admin/AppData/Local/build-manager-b5-runtime/node-24.21.0/node-v24.21.0-win-x64:$PATH"`.
- 규칙 파일(`apps/**`, `scripts/**`, `design/**`, `docs/**`)은 Edit/Write 도구로만 고친다. 셸로 고치지 않는다.
- 커밋은 이름을 댄 경로만 올린다(`git add -A` 금지). 커밋 메시지 끝에 `Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>`. 강제 푸시와 이력 고치기 금지.
- 새 패키지를 더하지 않는다. 아이콘은 Tabler 3.49.0 SVG 경로를 코드로 옮기고 REF-07 SPDX 표시를 붙인다.
- 새 API, DB 변경, 서버 변경이 없다.
- 화면 값은 디자인 규칙의 토큰과 글자 스타일만 쓴다: 탭바 높이 56 + `env(safe-area-inset-bottom, 0px)`, 칸 5·24·5·17·5, 왼쪽 메뉴 248px, 항목 높이 50, 좌우 안쪽 15, 아이콘 20(탭바 24), 아이콘과 라벨 사이 5, 배지 18·최소 18·좌우 5·모서리 5·바탕 `badge`(`#C8231A`), 층 10, `scroll-padding-bottom` = 탭바 높이 + 20.
- 문구는 해요체(`haeyo-copy.test.ts`가 `app/core` 아래 모든 파일을 본다).
- 이름: 탭 `우리 집 · 내 요청 · 알림 · 내 정보`, `업무함 · 알림 · 더 보기`. 행 `호실 정비 이력`, `입주 연결`, `건물·호실 관리`, `내 정보`, `내 호실`, `내 소속`, `호실 연결`, `오픈소스 라이선스`, `로그아웃`. 왼쪽 메뉴 아이콘 `file-text`, `key`, `layout-grid`(D9).
- 데모 주소나 IP를 새 문서·커밋·PR에 적지 않는다.

## 파일 구조

새 파일(`apps/web/src/app/core/nav/`)

| 파일 | 맡는 일 |
| --- | --- |
| `nav-config.ts` | 역할별 탭, 더 보기·내 정보 행, 허용 행 화면, 부모 화면, 화면 이름. 순수 데이터와 함수. |
| `nav-location.ts` | 주소 `?tab=&view=` 읽기와 쓰기. 순수 함수. |
| `nav-icons.tsx` | Tabler 아이콘 9개(SPDX 표시). |
| `open-source-notice.tsx` | 오픈소스 라이선스 화면(MIT 원문). |
| `todo-list.ts` | 처리할 일 목록 계산(PR 1 이유 다섯 종류). 서버를 부르지 않는다. |
| `use-nav-location.ts` | 주소를 읽는 hook과 기록 상태(상세) 함수. |
| `core-nav.tsx` | `CoreNav`(탭바·왼쪽 메뉴), `BackButton`, `plainClick`. |
| `nav-screens.tsx` | `MenuList`(더 보기·내 정보), `TodoScreen`(알림), `UnitsScreen`(내 호실). |
| `core-nav.module.css` | 메뉴, 배지, 목록 행, 뼈대 배치. |
| 각 `*.test.ts(x)` | 위 모듈의 시험. |

고치는 파일

| 파일 | 바꾸는 것 |
| --- | --- |
| `apps/web/src/app/tokens.css` | `--color-badge` 토큰 추가. |
| `apps/web/src/components/status-names.ts` | 처리할 일 이유 이름 `TODO_REASON_NAMES`. |
| `apps/web/src/app/core/ticket-communication.tsx` | 이름을 `TODO_REASON_NAMES`에서 가져옴, 요약 hook에 `ready`. |
| `apps/web/src/app/core/manager-work.tsx` | "처리 방법 결정 필요"를 `TODO_REASON_NAMES.DECIDE`로. |
| `apps/web/src/app/core/core-screen.tsx` | 메뉴·탭 화면·상세 기록·처리할 일. `managerView` 삭제. |
| `apps/web/src/app/core/login-screen.tsx` | 소속을 고른 뒤 위쪽 막대 대신 `account`를 넘김. |
| `apps/web/src/app/core/onboarding-panel.tsx` | 제목 이름 맞춤, `embedded`. |
| `apps/web/src/app/core/core-design.module.css` | 40px 예외·옛 메뉴·보기 전환 스타일 삭제, 탭 화면 묶음 스타일. |
| `apps/web/tests/core-e2e/presentation.ts` | 메뉴 도우미 함수. |
| e2e 시험 파일들 | Task 10 목록. |
| `apps/web/tests/core-login-e2e/navigation.spec.ts`, `apps/web/tests/core-e2e/navigation.spec.ts` | 새 메뉴 시험. |
| `scripts/design-audit.mjs` | `phoneMenu` 예외 삭제, 왼쪽 정렬 줄, 새 화면. |
| `scripts/demo-smoke.mjs` | 로그아웃 정리를 숨은 로그아웃 양식으로. |
| `design/DESIGN_RULES.md` | [DECISION] 두 줄, 역할별 탭, 8.13 아이콘 세 줄, 16절. |
| `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md` | 계획 중 확인한 사실 반영. |
| `ops/` | 실행 기록, 수락 기록. |

## PR 나누기

- PR 1a-1 "메뉴 부품": Task 1–6. 화면은 바뀌지 않는다.
- PR 1a-2 "메뉴 붙이기": Task 7–13.
- Task 6 끝에서 `git diff --stat origin/main...HEAD`의 합계가 1000줄을 넘으면 Task 1–4와 Task 5–6을 각각 PR로 낸다(DEV-02).

---

### Task 0: 시작 전 확인

**Files:** 없음

- [ ] **Step 1: 2-b6 세션에 알린다**

`ListAgents`로 2-b6 세션 이름을 찾고 `SendMessage`로 보낸다:

```text
P5 메뉴(하단 탭바·왼쪽 메뉴) 구현을 시작해요. 브랜치 feat/navigation-shell-p5에서 apps/web/src/app/core/{core-screen,login-screen,onboarding-panel}.tsx, core-design.module.css, scripts/design-audit.mjs, apps/web/tests/core-e2e/*, apps/web/tests/core-login-e2e/*(design.spec.ts 포함), apps/web/tests/vendor-e2e/demo-entry.spec.ts를 고쳐요. PR #134의 join-screen.tsx와 design.spec.ts 한 줄과 겹치면 알려 주세요. 먼저 병합되는 쪽에 맞춰 뒤에 오는 쪽이 고칠게요.
```

- [ ] **Step 2: 기준 화면을 찍어 둔다(메뉴 점검 303행 "P5 전")**

```bash
cd "D:/Users/admin/Desktop/모두의 창업 2기/worktree/build-manager-mobile-design"
export PATH="/c/Users/admin/AppData/Local/build-manager-b5-runtime/node-24.21.0/node-v24.21.0-win-x64:$PATH"
git status --short && git log --oneline -1
```

Expected: 작업 트리가 깨끗하고 HEAD가 스펙 커밋(`f2c5b14`)이다. Docker Desktop이 꺼져 있으면 `"$LOCALAPPDATA/Programs/DockerDesktop/Docker Desktop.exe"`로 켠다.

`node --experimental-transform-types scripts/design-audit.mjs "$HOME/.build-manager-rc1-private/p5-before"`를 돌려 지금 화면의 캡처를 남긴다(결과 0건이 아니어도 된다. 비교용이다). 390px WebKit 캡처와 별도로, 390px 크롬에서 글자 200%(`document.documentElement.style.fontSize="200%"`)로 세입자 첫 화면과 상세를 Playwright로 한 장씩 찍어 같은 폴더에 둔다.

---

### Task 1: 배지 토큰과 메뉴 정의

**Files:**
- Modify: `apps/web/src/app/tokens.css:19`
- Create: `apps/web/src/app/core/nav/nav-config.ts`
- Test: `apps/web/src/app/core/nav/nav-config.test.ts`

**Interfaces:**
- Produces: `CoreRole`, `TabId`, `ViewId`, `NavIconName`, `NavLocation`, `NavContext`, `NavTab`, `MenuRow`, `VIEW_LABELS`, `isTenant`, `roleName`, `navTabs`, `firstTab`, `rowTab`, `accountLocation`, `moreRows`, `meRows`, `allowedViews`, `inLeftMenu`, `parentOf`, `navTitle`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/nav-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { accountLocation, allowedViews, firstTab, inLeftMenu, meRows, moreRows, navTabs, navTitle, parentOf, roleName, type CoreRole } from "./nav-config";

const ctx = (role: CoreRole, b1 = true) => ({ role, b1 });

describe("menu definition (P5 spec §1)", () => {
  it("gives the tenant four tabs and managers three, in the decided order", () => {
    expect(navTabs("TENANT").map(tab => tab.label)).toEqual(["우리 집", "내 요청", "알림", "내 정보"]);
    expect(navTabs("ORG_ADMIN").map(tab => tab.label)).toEqual(["업무함", "알림", "더 보기"]);
    expect(navTabs("PROPERTY_STAFF")).toEqual(navTabs("ORG_ADMIN"));
    expect(navTabs("TENANT").map(tab => tab.icon)).toEqual(["home", "clipboard-list", "bell", "user"]);
    expect(navTabs("ORG_ADMIN").map(tab => tab.icon)).toEqual(["clipboard-list", "bell", "dots"]);
  });

  it("keeps 3–5 tabs and labels within four characters (rules 8.14)", () => {
    for (const role of ["TENANT", "ORG_ADMIN"] as const) {
      const tabs = navTabs(role);
      expect(tabs.length).toBeGreaterThanOrEqual(3);
      expect(tabs.length).toBeLessThanOrEqual(5);
      for (const tab of tabs) expect([...tab.label].length).toBeLessThanOrEqual(4);
    }
  });

  it("starts each role on its first tab and puts 내 정보 last (rules 8.14)", () => {
    expect(firstTab("TENANT")).toBe("home");
    expect(firstTab("PROPERTY_STAFF")).toBe("work");
    expect(accountLocation("TENANT")).toEqual({ tab: "me", view: null });
    expect(accountLocation("ORG_ADMIN")).toEqual({ tab: "more", view: "me" });
    expect(moreRows(ctx("ORG_ADMIN")).at(-1)?.label).toBe("내 정보");
  });

  it("shows move-in links and building setup only to organisation admins after login", () => {
    expect(moreRows(ctx("ORG_ADMIN")).map(row => row.label)).toEqual(["호실 정비 이력", "입주 연결", "건물·호실 관리", "내 정보"]);
    expect(moreRows(ctx("PROPERTY_STAFF")).map(row => row.label)).toEqual(["호실 정비 이력", "내 정보"]);
    expect(moreRows(ctx("ORG_ADMIN", false)).map(row => row.label)).toEqual(["호실 정비 이력", "내 정보"]);
    expect(moreRows(ctx("TENANT"))).toEqual([]);
    expect(moreRows(ctx("ORG_ADMIN")).flatMap(row => "icon" in row && row.icon ? [row.icon] : [])).toEqual(["file-text", "key", "layout-grid"]);
  });

  it("lists 내 정보 with the licence notice for every role and logout last (rules 8.13, 8.16)", () => {
    expect(meRows(ctx("TENANT")).map(row => row.label)).toEqual(["내 호실", "내 소속", "호실 연결", "오픈소스 라이선스", "로그아웃"]);
    expect(meRows(ctx("ORG_ADMIN")).map(row => row.label)).toEqual(["내 소속", "오픈소스 라이선스", "로그아웃"]);
    expect(meRows(ctx("TENANT", false)).map(row => row.label)).toEqual(["내 호실", "오픈소스 라이선스", "로그아웃"]);
    expect(meRows(ctx("PROPERTY_STAFF", false)).map(row => row.label)).toEqual(["오픈소스 라이선스", "로그아웃"]);
  });

  it("knows which row screens a role may open", () => {
    expect(allowedViews(ctx("TENANT"))).toEqual(["units", "link", "licenses"]);
    expect(allowedViews(ctx("ORG_ADMIN"))).toEqual(["maintenance", "invitations", "me", "licenses"]);
    expect(allowedViews(ctx("PROPERTY_STAFF"))).toEqual(["maintenance", "me", "licenses"]);
  });

  it("treats left-menu rows as first screens on wide screens and the rest as sub-screens (rules 8.10)", () => {
    expect(inLeftMenu(ctx("ORG_ADMIN"), "maintenance")).toBe(true);
    expect(inLeftMenu(ctx("ORG_ADMIN"), "invitations")).toBe(true);
    expect(inLeftMenu(ctx("ORG_ADMIN"), "me")).toBe(true);
    expect(inLeftMenu(ctx("ORG_ADMIN"), "licenses")).toBe(false);
    expect(inLeftMenu(ctx("TENANT"), "units")).toBe(false);
  });

  it("goes one step up from a row screen", () => {
    expect(parentOf(ctx("TENANT"), { tab: "me", view: "licenses" })).toEqual({ tab: "me", view: null });
    expect(parentOf(ctx("ORG_ADMIN"), { tab: "more", view: "licenses" })).toEqual({ tab: "more", view: "me" });
    expect(parentOf(ctx("ORG_ADMIN"), { tab: "more", view: "me" })).toEqual({ tab: "more", view: null });
    expect(parentOf(ctx("ORG_ADMIN"), { tab: "more", view: "maintenance" })).toEqual({ tab: "more", view: null });
  });

  it("names screens and roles", () => {
    expect(navTitle("TENANT", { tab: "alerts", view: null })).toBe("알림");
    expect(navTitle("ORG_ADMIN", { tab: "more", view: "invitations" })).toBe("입주 연결");
    expect(["TENANT", "ORG_ADMIN", "PROPERTY_STAFF"].map(role => roleName(role as CoreRole))).toEqual(["세입자", "조직 관리자", "건물 담당자"]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/nav-config.test.ts`
Expected: FAIL, `Failed to resolve import "./nav-config"`.

- [ ] **Step 3: 토큰과 메뉴 정의를 쓴다**

`apps/web/src/app/tokens.css`의 `--color-danger-soft` 줄 바로 아래에 더한다(값은 디자인 규칙 2절 `badge`):

```css
  --color-badge: #C8231A;
```

`apps/web/src/app/core/nav/nav-config.ts`:

```ts
import type { CoreSessionDto } from "@build-manager/api-contracts";

// P5 (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md §1): one menu definition per role draws the phone
// tab bar, the wide-screen left menu, the 더 보기 and 내 정보 lists and the address check (design rules 8.10, 8.14, 8.16).
export type CoreRole = CoreSessionDto["role"];
export type TabId = "home" | "requests" | "alerts" | "me" | "work" | "more";
export type ViewId = "units" | "link" | "licenses" | "maintenance" | "invitations" | "me";
export type NavIconName = "home" | "clipboard-list" | "bell" | "user" | "dots" | "file-text" | "key" | "layout-grid";
export type NavLocation = { tab: TabId; view: ViewId | null };
/** `b1`: signed in through the login flow, which alone has organisations and move-in links. */
export type NavContext = { role: CoreRole; b1: boolean };
export type NavTab = { id: TabId; label: string; icon: NavIconName };
export type MenuRow =
  | { kind: "view"; label: string; to: NavLocation; icon?: NavIconName }
  | { kind: "href"; label: string; href: string; icon: NavIconName }
  | { kind: "organization"; label: string }
  | { kind: "logout"; label: string };

const TENANT_TABS: readonly NavTab[] = [
  { id: "home", label: "우리 집", icon: "home" },
  { id: "requests", label: "내 요청", icon: "clipboard-list" },
  { id: "alerts", label: "알림", icon: "bell" },
  { id: "me", label: "내 정보", icon: "user" },
];
const MANAGER_TABS: readonly NavTab[] = [
  { id: "work", label: "업무함", icon: "clipboard-list" },
  { id: "alerts", label: "알림", icon: "bell" },
  { id: "more", label: "더 보기", icon: "dots" },
];
export const VIEW_LABELS: Record<ViewId, string> = {
  units: "내 호실", link: "호실 연결", licenses: "오픈소스 라이선스", maintenance: "호실 정비 이력", invitations: "입주 연결", me: "내 정보",
};

export const isTenant = (role: CoreRole) => role === "TENANT";
export const roleName = (role: CoreRole) => role === "TENANT" ? "세입자" : role === "ORG_ADMIN" ? "조직 관리자" : "건물 담당자";
export const navTabs = (role: CoreRole): readonly NavTab[] => isTenant(role) ? TENANT_TABS : MANAGER_TABS;
export const firstTab = (role: CoreRole): TabId => isTenant(role) ? "home" : "work";
/** Row screens hang under 내 정보 for the tenant and under 더 보기 for managers. */
export const rowTab = (role: CoreRole): TabId => isTenant(role) ? "me" : "more";
/** 내 정보 is the tenant's last tab and the last 더 보기 row for managers (rules 8.14). */
export const accountLocation = (role: CoreRole): NavLocation => isTenant(role) ? { tab: "me", view: null } : { tab: "more", view: "me" };

/** 더 보기 rows, top to bottom. Rows with an icon are also spread into the wide-screen left menu (rules 8.10, spec D9). */
export function moreRows(ctx: NavContext): MenuRow[] {
  if (isTenant(ctx.role)) return [];
  const rows: MenuRow[] = [{ kind: "view", label: VIEW_LABELS.maintenance, to: { tab: "more", view: "maintenance" }, icon: "file-text" }];
  // Move-in links and building setup exist only behind the login flow, and only an organisation admin manages them.
  if (ctx.role === "ORG_ADMIN" && ctx.b1) {
    rows.push({ kind: "view", label: VIEW_LABELS.invitations, to: { tab: "more", view: "invitations" }, icon: "key" });
    rows.push({ kind: "href", label: "건물·호실 관리", href: "/workspace", icon: "layout-grid" });
  }
  rows.push({ kind: "view", label: VIEW_LABELS.me, to: { tab: "more", view: "me" } });
  return rows;
}

/** 내 정보 rows (rules 8.16), top to bottom; 로그아웃 is always last. */
export function meRows(ctx: NavContext): MenuRow[] {
  const at = (view: ViewId): NavLocation => ({ tab: rowTab(ctx.role), view });
  const rows: MenuRow[] = [];
  if (isTenant(ctx.role)) rows.push({ kind: "view", label: VIEW_LABELS.units, to: at("units") });
  if (ctx.b1) rows.push({ kind: "organization", label: "내 소속" });
  if (isTenant(ctx.role) && ctx.b1) rows.push({ kind: "view", label: VIEW_LABELS.link, to: at("link") });
  rows.push({ kind: "view", label: VIEW_LABELS.licenses, to: at("licenses") });
  rows.push({ kind: "logout", label: "로그아웃" });
  return rows;
}

const viewsOf = (rows: MenuRow[]) => rows.flatMap(row => row.kind === "view" && row.to.view ? [row.to.view] : []);
/** Row screens this role may open; anything else in the address is dropped (spec §3). */
export const allowedViews = (ctx: NavContext): ViewId[] => [...new Set([...viewsOf(moreRows(ctx)), ...viewsOf(meRows(ctx))])];

/** Row screens the left menu lists are first screens on wide screens, so they get no back button there (rules 8.10). */
export function inLeftMenu(ctx: NavContext, view: ViewId): boolean {
  if (view === "me") return !isTenant(ctx.role);
  return moreRows(ctx).some(row => row.kind === "view" && row.to.view === view && row.icon !== undefined);
}

/** One step up: a manager's 내 정보 rows go back to 내 정보, every other row screen to its tab's first screen. */
export function parentOf(ctx: NavContext, location: NavLocation): NavLocation {
  if (!location.view) return location;
  const underMe = !isTenant(ctx.role) && location.view !== "me" && viewsOf(meRows(ctx)).includes(location.view);
  return underMe ? { tab: "more", view: "me" } : { tab: location.tab, view: null };
}

/** The top bar's screen name (spec §2): the row name on a row screen, otherwise the tab name. */
export function navTitle(role: CoreRole, location: NavLocation): string {
  if (location.view) return VIEW_LABELS[location.view];
  return navTabs(role).find(tab => tab.id === location.tab)?.label ?? "";
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/nav-config.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: 커밋한다**

```bash
git add apps/web/src/app/tokens.css apps/web/src/app/core/nav/nav-config.ts apps/web/src/app/core/nav/nav-config.test.ts
git commit -m "feat(web): P5 menu definition per role and the badge token

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 2: 주소 읽기·쓰기

**Files:**
- Create: `apps/web/src/app/core/nav/nav-location.ts`
- Test: `apps/web/src/app/core/nav/nav-location.test.ts`

**Interfaces:**
- Consumes: `allowedViews`, `firstTab`, `navTabs`, `rowTab`, `NavContext`, `NavLocation` (Task 1).
- Produces: `parseNavLocation(search: string, ctx: NavContext): NavLocation`, `navHref(location: NavLocation): string`, `sameLocation(a, b): boolean`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/nav-location.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { navHref, parseNavLocation, sameLocation } from "./nav-location";

const tenant = { role: "TENANT", b1: true } as const, admin = { role: "ORG_ADMIN", b1: true } as const, staff = { role: "PROPERTY_STAFF", b1: true } as const;

describe("menu address (P5 spec §3)", () => {
  it("reads a valid tab and row screen", () => {
    expect(parseNavLocation("?tab=alerts", tenant)).toEqual({ tab: "alerts", view: null });
    expect(parseNavLocation("?tab=more&view=invitations", admin)).toEqual({ tab: "more", view: "invitations" });
    expect(parseNavLocation("?tab=me&view=units", tenant)).toEqual({ tab: "me", view: "units" });
  });

  it("falls back to the role's first tab for a missing, unknown or other-role tab, without an error", () => {
    expect(parseNavLocation("", tenant)).toEqual({ tab: "home", view: null });
    expect(parseNavLocation("?tab=..%2F..%2Fx", admin)).toEqual({ tab: "work", view: null });
    expect(parseNavLocation("?tab=work", tenant)).toEqual({ tab: "home", view: null });
    expect(parseNavLocation("?tab=home", admin)).toEqual({ tab: "work", view: null });
  });

  it("drops a row screen outside its tab or hidden from the role", () => {
    expect(parseNavLocation("?tab=alerts&view=licenses", tenant)).toEqual({ tab: "alerts", view: null });
    expect(parseNavLocation("?tab=more&view=invitations", staff)).toEqual({ tab: "more", view: null });
    expect(parseNavLocation("?tab=me&view=maintenance", tenant)).toEqual({ tab: "me", view: null });
    expect(parseNavLocation("?tab=more&view=invitations", { role: "ORG_ADMIN", b1: false })).toEqual({ tab: "more", view: null });
  });

  it("writes the address back the way it reads it", () => {
    expect(navHref({ tab: "home", view: null })).toBe("/core?tab=home");
    expect(navHref({ tab: "more", view: "me" })).toBe("/core?tab=more&view=me");
    for (const search of ["?tab=requests", "?tab=me&view=units"]) expect(navHref(parseNavLocation(search, tenant))).toBe("/core" + search);
    expect(sameLocation({ tab: "me", view: null }, { tab: "me", view: null })).toBe(true);
    expect(sameLocation({ tab: "me", view: null }, { tab: "me", view: "units" })).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/nav-location.test.ts`
Expected: FAIL, `Failed to resolve import "./nav-location"`.

- [ ] **Step 3: 구현한다**

`apps/web/src/app/core/nav/nav-location.ts`:

```ts
import { allowedViews, firstTab, navTabs, rowTab, type NavContext, type NavLocation } from "./nav-config";

/** Reads `/core?tab=&view=` (P5 spec §3). Unknown values, another role's values and row screens outside their tab fall
 * back to the role's first tab or to the tab's first screen, without an error. */
export function parseNavLocation(search: string, ctx: NavContext): NavLocation {
  const params = new URLSearchParams(search), rawTab = params.get("tab"), rawView = params.get("view");
  const tab = navTabs(ctx.role).find(item => item.id === rawTab)?.id ?? firstTab(ctx.role);
  const view = allowedViews(ctx).find(item => item === rawView) ?? null;
  return { tab, view: view && rowTab(ctx.role) === tab ? view : null };
}

/** The address of a menu place; the only query this screen writes. */
export function navHref(location: NavLocation): string {
  return "/core?tab=" + location.tab + (location.view ? "&view=" + location.view : "");
}

export const sameLocation = (a: NavLocation, b: NavLocation) => a.tab === b.tab && a.view === b.view;
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/nav-location.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋한다**

```bash
git add apps/web/src/app/core/nav/nav-location.ts apps/web/src/app/core/nav/nav-location.test.ts
git commit -m "feat(web): read and write the P5 menu address

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 3: 아이콘과 라이선스 화면

**Files:**
- Create: `apps/web/src/app/core/nav/nav-icons.tsx`
- Create: `apps/web/src/app/core/nav/open-source-notice.tsx`
- Create: `apps/web/src/app/core/nav/core-nav.module.css` (이 Task에서는 라이선스 화면 스타일만; Task 6에서 채운다)
- Test: `apps/web/src/app/core/nav/nav-icons.test.tsx`

**Interfaces:**
- Consumes: `NavIconName` (Task 1).
- Produces: `NavIcon({ name: NavIconName | "chevron-left"; filled?: boolean })`, `OpenSourceNotice()`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/nav-icons.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavIcon } from "./nav-icons";
import { OpenSourceNotice } from "./open-source-notice";

const MENU_ICONS = ["home", "clipboard-list", "bell", "user", "dots", "file-text", "key", "layout-grid"] as const;

describe("menu icons (rules 8.13, REF-07)", () => {
  it("draws outlines at stroke 1.5 in the text colour, hidden from screen readers", () => {
    const html = renderToStaticMarkup(<NavIcon name="bell" />);
    expect(html).toContain('stroke-width="1.5"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("data-filled");
  });

  it("has a filled shape for every menu icon and fills only on request", () => {
    for (const name of MENU_ICONS) {
      const html = renderToStaticMarkup(<NavIcon name={name} filled />);
      expect(html, name).toContain('data-filled="true"');
      expect(html, name).toContain('fill="currentColor"');
      expect(html, name).toMatch(/<path d="M/);
    }
  });

  it("keeps the back chevron outline only", () => {
    expect(renderToStaticMarkup(<NavIcon name="chevron-left" filled />)).not.toContain("data-filled");
  });

  it("marks the copied Tabler paths with their source and licence", () => {
    const source = readFileSync(new URL("./nav-icons.tsx", import.meta.url), "utf8");
    for (const line of ["// SPDX-SnippetBegin", "// SPDX-SnippetCopyrightText: 2020-2026 Paweł Kuna", "// SPDX-License-Identifier: MIT", "// SPDX-SnippetEnd"]) expect(source).toContain(line);
    expect(source).toMatch(/\/\/ Source: https:\/\/github\.com\/tabler\/tabler-icons .*\(확인 2026-10-13\)/);
  });

  it("shows the MIT notice the icons require", () => {
    const html = renderToStaticMarkup(<OpenSourceNotice />);
    expect(html).toContain('aria-label="오픈소스 라이선스"');
    expect(html).toContain("Copyright (c) 2020-2026 Paweł Kuna");
    expect(html).toContain("MIT License");
    expect(html).toContain("THE SOFTWARE IS PROVIDED");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/nav-icons.test.tsx`
Expected: FAIL, `Failed to resolve import "./nav-icons"`.

- [ ] **Step 3: 아이콘을 쓴다**

경로는 2026-10-13에 `npm pack @tabler/icons@3.49.0`으로 받은 `icons/outline/*.svg`, `icons/filled/*.svg`에서 첫 빈 경로(`M0 0h24v24H0z`)를 뺀 것이다. 다시 받아 대조하려면 scratchpad에서 `npm pack @tabler/icons@3.49.0 && tar -xzf tabler-icons-3.49.0.tgz`.

`apps/web/src/app/core/nav/nav-icons.tsx`:

```tsx
import type { NavIconName } from "./nav-config";

// SPDX-SnippetBegin
// SPDX-SnippetCopyrightText: 2020-2026 Paweł Kuna
// SPDX-License-Identifier: MIT
// Source: https://github.com/tabler/tabler-icons npm @tabler/icons 3.49.0 icons/outline, icons/filled (확인 2026-10-13)
const OUTLINE: Record<NavIconName | "chevron-left", readonly string[]> = {
  home: ["M5 12l-2 0l9 -9l9 9l-2 0", "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7", "M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"],
  "clipboard-list": ["M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2", "M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2", "M9 12l.01 0", "M13 12l2 0", "M9 16l.01 0", "M13 16l2 0"],
  bell: ["M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6", "M9 17v1a3 3 0 0 0 6 0v-1"],
  user: ["M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0", "M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"],
  dots: ["M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"],
  "file-text": ["M14 3v4a1 1 0 0 0 1 1h4", "M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2", "M9 9l1 0", "M9 13l6 0", "M9 17l6 0"],
  key: ["M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0", "M15 9h.01"],
  "layout-grid": ["M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4", "M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4", "M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4", "M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"],
  "chevron-left": ["M15 6l-6 6l6 6"],
};
const FILLED: Record<NavIconName, readonly string[]> = {
  home: ["M12.707 2.293l9 9c.63 .63 .184 1.707 -.707 1.707h-1v6a3 3 0 0 1 -3 3h-1v-7a3 3 0 0 0 -2.824 -2.995l-.176 -.005h-2a3 3 0 0 0 -3 3v7h-1a3 3 0 0 1 -3 -3v-6h-1c-.89 0 -1.337 -1.077 -.707 -1.707l9 -9a1 1 0 0 1 1.414 0m.293 11.707a1 1 0 0 1 1 1v7h-4v-7a1 1 0 0 1 .883 -.993l.117 -.007z"],
  "clipboard-list": ["M17.997 4.17a3 3 0 0 1 2.003 2.83v12a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 2.003 -2.83a4 4 0 0 0 3.997 3.83h4a4 4 0 0 0 3.98 -3.597zm-8.987 10.83h-.01a1 1 0 0 0 -.117 1.993l.127 .007a1 1 0 0 0 0 -2m5.99 0h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0 -2m-5.99 -4h-.01a1 1 0 0 0 -.117 1.993l.127 .007a1 1 0 0 0 0 -2m5.99 0h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0 -2m-1 -9a2 2 0 1 1 0 4h-4a2 2 0 1 1 0 -4z"],
  bell: ["M14.235 19c.865 0 1.322 1.024 .745 1.668a3.992 3.992 0 0 1 -2.98 1.332a3.992 3.992 0 0 1 -2.98 -1.332c-.552 -.616 -.158 -1.579 .634 -1.661l.11 -.006h4.471z", "M12 2c1.358 0 2.506 .903 2.875 2.141l.046 .171l.008 .043a8.013 8.013 0 0 1 4.024 6.069l.028 .287l.019 .289v2.931l.021 .136a3 3 0 0 0 1.143 1.847l.167 .117l.162 .099c.86 .487 .56 1.766 -.377 1.864l-.116 .006h-16c-1.028 0 -1.387 -1.364 -.493 -1.87a3 3 0 0 0 1.472 -2.063l.021 -.143l.001 -2.97a8 8 0 0 1 3.821 -6.454l.248 -.146l.01 -.043a3.003 3.003 0 0 1 2.562 -2.29l.182 -.017l.176 -.004z"],
  user: ["M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z", "M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"],
  dots: ["M7 12a2 2 0 1 1 -4 0q 0 -.053 .005 -.102a1.996 1.996 0 0 1 1.995 -1.898a2 2 0 0 1 2 2", "M14 12a2 2 0 1 1 -4 0q 0 -.053 .005 -.102a1.996 1.996 0 0 1 1.995 -1.898a2 2 0 0 1 2 2", "M21 12a2 2 0 1 1 -4 0q 0 -.053 .005 -.102a1.996 1.996 0 0 1 1.995 -1.898a2 2 0 0 1 2 2"],
  "file-text": ["M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm3 14h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m-5 -4h-1a1 1 0 1 0 0 2h1a1 1 0 0 0 0 -2", "M19 7h-4l-.001 -4.001z"],
  key: ["M14.52 2c1.029 0 2.015 .409 2.742 1.136l3.602 3.602a3.877 3.877 0 0 1 0 5.483l-2.643 2.643a3.88 3.88 0 0 1 -4.941 .452l-.105 -.078l-5.882 5.883a3 3 0 0 1 -1.68 .843l-.22 .027l-.221 .009h-1.172c-1.014 0 -1.867 -.759 -1.991 -1.823l-.009 -.177v-1.172c0 -.704 .248 -1.386 .73 -1.96l.149 -.161l.414 -.414a1 1 0 0 1 .707 -.293h1v-1a1 1 0 0 1 .883 -.993l.117 -.007h1v-1a1 1 0 0 1 .206 -.608l.087 -.1l1.468 -1.469l-.076 -.103a3.9 3.9 0 0 1 -.678 -1.963l-.007 -.236c0 -1.029 .409 -2.015 1.136 -2.742l2.643 -2.643a3.88 3.88 0 0 1 2.741 -1.136m.495 5h-.02a2 2 0 1 0 0 4h.02a2 2 0 1 0 0 -4"],
  "layout-grid": ["M9 3a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z", "M19 3a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z", "M9 13a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z", "M19 13a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"],
};
// SPDX-SnippetEnd

/** Tabler icons (rules 8.13): outline at stroke 1.5 in the text colour; the filled shape marks only the current menu place.
 * Decorative: the link or button around it carries the name. Its size comes from the surrounding CSS. */
export function NavIcon({ name, filled = false }: { name: NavIconName | "chevron-left"; filled?: boolean }) {
  const solid = filled && name !== "chevron-left";
  const paths = solid ? FILLED[name as NavIconName] : OUTLINE[name];
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" data-icon={name} data-filled={solid ? "true" : undefined}
    fill={solid ? "currentColor" : "none"} stroke={solid ? "none" : "currentColor"} strokeWidth={solid ? undefined : 1.5} strokeLinecap="round" strokeLinejoin="round">
    {paths.map(d => <path key={d} d={d} />)}
  </svg>;
}
```

- [ ] **Step 4: 라이선스 화면과 그 스타일을 쓴다**

`apps/web/src/app/core/nav/core-nav.module.css`(Task 6에서 이어 쓴다):

```css
/* P5 navigation (design rules 3.2, 4, 6, 8.5, 8.10, 8.14, 8.15; spec docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md). */
/* Open-source notice: body text for the Korean line, caption size for the English licence (rules 3.2). */
.notice { padding: 1.25rem; }
.notice > * + * { margin-top: .625rem; }
.licenseText { color: var(--color-text-secondary); font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; overflow-wrap: anywhere; }
.licenseText > p + p { margin-top: .625rem; }
@media (min-width: 768px) { .notice { padding: 1.875rem; } }
@media (min-width: 1440px) { .notice { padding: 2.5rem; } }
```

`apps/web/src/app/core/nav/open-source-notice.tsx`:

```tsx
import styles from "./core-nav.module.css";

// The MIT text shipped with @tabler/icons 3.49.0 (LICENSE), one paragraph per entry.
const TABLER_LICENSE = [
  "MIT License",
  "Copyright (c) 2020-2026 Paweł Kuna",
  "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:",
  "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
];

/** The notice the copied Tabler icons require (rules 8.13, REF-07). */
export function OpenSourceNotice() {
  return <section className={styles.notice} aria-label="오픈소스 라이선스">
    <p>메뉴 아이콘은 Tabler Icons 3.49.0에서 가져왔어요. 아래는 그 라이선스 원문이에요.</p>
    <h2>Tabler Icons</h2>
    <p><a href="https://github.com/tabler/tabler-icons">github.com/tabler/tabler-icons</a></p>
    <div lang="en" className={styles.licenseText}>{TABLER_LICENSE.map(line => <p key={line}>{line}</p>)}</div>
  </section>;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/nav-icons.test.tsx src/app/core/haeyo-copy.test.ts`
Expected: PASS. 해요체 시험이 새 파일의 한국어 문장을 받아들인다.

- [ ] **Step 6: 커밋한다**

```bash
git add apps/web/src/app/core/nav/nav-icons.tsx apps/web/src/app/core/nav/nav-icons.test.tsx apps/web/src/app/core/nav/open-source-notice.tsx apps/web/src/app/core/nav/core-nav.module.css
git commit -m "feat(web): Tabler menu icons with SPDX marks and the licence notice

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 4: 처리할 일 계산과 이름 한 벌

**Files:**
- Modify: `apps/web/src/components/status-names.ts` (INTAKE_STATUS_NAMES 정의 아래)
- Modify: `apps/web/src/app/core/ticket-communication.tsx:12`
- Modify: `apps/web/src/app/core/manager-work.tsx:40`
- Create: `apps/web/src/app/core/nav/todo-list.ts`
- Test: `apps/web/src/app/core/nav/todo-list.test.ts`

**Interfaces:**
- Consumes: `isTenant`, `CoreRole` (Task 1); `intakeDisplayStatus`, `isIntakeDraft` (`../ui/work-status-badge`); `managerRowHint` (`../manager-next-step`).
- Produces: `TODO_REASON_NAMES`; `TodoReason = "SAFETY" | "REPLY" | "DECIDE" | "DRAFT" | "MORE_INFO"`; `TodoItem = { ticketId; unitId; issueType; reasons: TodoReason[]; lastActivity: string | null }`; `TodoList = { items: TodoItem[]; partial: boolean }`; `buildTodoList({ role, tickets, summaries, summariesFailed }): TodoList`; `todoReasonName(role, reason): string`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/todo-list.test.ts`:

```ts
import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { buildTodoList, todoReasonName } from "./todo-list";

// Only the fields the to-do rules read; the rest of the DTO is irrelevant here.
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], status: string, events: [string, string][] = [["CREATED", "2026-10-13T01:00:00Z"]]): CoreTicketDto {
  return { ticketId: id, unitId: "unit-1", workStatus, detail: { status, issueType: "LEAK", decision: null, repairPacket: null }, events: events.map(([kind, at]) => ({ kind, at })) } as unknown as CoreTicketDto;
}
const summary = (id: string, waitingFor: CoreCommunicationSummary["waitingFor"], readOnly = false) => ({ [id]: { ticketId: id, version: 1, waitingFor, readOnly } });
const sent = (at = "2026-10-13T02:00:00Z"): [string, string][] => [["CREATED", "2026-10-13T01:00:00Z"], ["FINALIZED", at]];
const reasons = (list: ReturnType<typeof buildTodoList>) => list.items.map(item => [item.ticketId, item.reasons]);

describe("to-do list (P5 spec §5)", () => {
  it("gives the tenant drafts, more-info rounds, safety checks and replies", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false,
      tickets: [ticket("draft", "OPEN", "IN_PROGRESS"), ticket("more", "OPEN", "NEEDS_MORE_INFO", sent()), ticket("safe", "OPEN", "SAFETY_ESCALATED"), ticket("reply", "OPEN", "READY_FOR_REVIEW", sent()), ticket("idle", "OPEN", "READY_FOR_REVIEW", sent())],
      summaries: summary("reply", "TENANT") });
    expect(Object.fromEntries(reasons(list))).toEqual({ draft: ["DRAFT"], more: ["MORE_INFO"], safe: ["SAFETY"], reply: ["REPLY"] });
  });

  it("gives managers decisions, safety checks and replies, never the tenant's draft", () => {
    const list = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false,
      tickets: [ticket("decide", "OPEN", "PARTIAL", sent()), ticket("safe", "OPEN", "SAFETY_ESCALATED"), ticket("reply", "IN_PROGRESS", "APPROVED", sent()), ticket("draft", "OPEN", "IN_PROGRESS")],
      summaries: { ...summary("reply", "MANAGER"), ...summary("draft", "TENANT") } });
    expect(Object.fromEntries(reasons(list))).toEqual({ decide: ["DECIDE"], safe: ["SAFETY"], reply: ["REPLY"] });
  });

  it("puts every reason of one request on one row, so the badge counts it once", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false, tickets: [ticket("both", "OPEN", "IN_PROGRESS")], summaries: summary("both", "TENANT") });
    expect(reasons(list)).toEqual([["both", ["REPLY", "DRAFT"]]]);
  });

  it("ignores finished conversations and finished requests", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false,
      tickets: [ticket("readonly", "OPEN", "READY_FOR_REVIEW", sent()), ticket("done", "COMPLETED", "APPROVED", sent())],
      summaries: { ...summary("readonly", "TENANT", true), ...summary("done", "TENANT") } });
    expect(list.items).toEqual([]);
  });

  it("sorts urgent first, then replies and decisions, then the rest, newest first within each", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false,
      tickets: [
        ticket("old-draft", "OPEN", "IN_PROGRESS", [["CREATED", "2026-10-10T00:00:00Z"]]),
        ticket("new-draft", "OPEN", "IN_PROGRESS", [["CREATED", "2026-10-12T00:00:00Z"]]),
        ticket("reply", "OPEN", "READY_FOR_REVIEW", sent("2026-10-11T00:00:00Z")),
        ticket("safe", "OPEN", "SAFETY_ESCALATED", [["CREATED", "2026-10-09T00:00:00Z"]]),
      ],
      summaries: summary("reply", "TENANT") });
    expect(list.items.map(item => item.ticketId)).toEqual(["safe", "reply", "new-draft", "old-draft"]);
    expect(list.items[0].lastActivity).toBe("2026-10-09T00:00:00Z");
  });

  it("marks the list partial when the summaries failed and still lists what the request list confirms", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: true, tickets: [ticket("draft", "OPEN", "IN_PROGRESS")], summaries: {} });
    expect(list.partial).toBe(true);
    expect(reasons(list)).toEqual([["draft", ["DRAFT"]]]);
  });

  it("names reasons the way the request rows already do (rules 8.7)", () => {
    expect(todoReasonName("TENANT", "REPLY")).toBe("내 답변 필요");
    expect(todoReasonName("ORG_ADMIN", "REPLY")).toBe("관리자 답변 대기");
    expect(todoReasonName("ORG_ADMIN", "DECIDE")).toBe("처리 방법 결정 필요");
    expect(["SAFETY", "DRAFT", "MORE_INFO"].map(reason => todoReasonName("TENANT", reason as "SAFETY"))).toEqual(["긴급 확인 필요", "제출 전", "추가 확인 필요"]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/todo-list.test.ts`
Expected: FAIL, `Failed to resolve import "./todo-list"`.

- [ ] **Step 3: 이름 한 벌을 만들고 기존 두 곳이 쓰게 한다**

`apps/web/src/components/status-names.ts`에서 `INTAKE_STATUS_NAMES` 정의 바로 아래에 더한다:

```ts
/** Names of what someone has to do next (P5 spec §5): the request rows and the 알림 to-do list share them (rules 8.7). */
export const TODO_REASON_NAMES = {
  SAFETY: INTAKE_STATUS_NAMES.SAFETY_ESCALATED, DRAFT: INTAKE_STATUS_NAMES.IN_PROGRESS, MORE_INFO: INTAKE_STATUS_NAMES.NEEDS_MORE_INFO,
  DECIDE: "처리 방법 결정 필요", REPLY_TENANT: "내 답변 필요", REPLY_MANAGER: "관리자 답변 대기", WAITING_TENANT: "세입자 답변 대기",
} as const;
```

`apps/web/src/app/core/ticket-communication.tsx` 12행을 바꾼다(위에 `import { TODO_REASON_NAMES } from "../../components/status-names";`를 더한다):

```tsx
  return <span className={styles.badge}>{summary.waitingFor==="TENANT"?(tenant?TODO_REASON_NAMES.REPLY_TENANT:TODO_REASON_NAMES.WAITING_TENANT):TODO_REASON_NAMES.REPLY_MANAGER}</span>;
```

`apps/web/src/app/core/manager-work.tsx`: `import { WORK_STATUS_NAMES } from "../../components/status-names";`를 `import { TODO_REASON_NAMES,WORK_STATUS_NAMES } from "../../components/status-names";`로, 40행의 `<small className={styles.rowHint}>처리 방법 결정 필요</small>`를 `<small className={styles.rowHint}>{TODO_REASON_NAMES.DECIDE}</small>`로 바꾼다.

- [ ] **Step 4: 처리할 일 계산을 쓴다**

`apps/web/src/app/core/nav/todo-list.ts`:

```ts
import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { TODO_REASON_NAMES } from "../../../components/status-names";
import { managerRowHint } from "../manager-next-step";
import { intakeDisplayStatus, isIntakeDraft } from "../ui/work-status-badge";
import { isTenant, type CoreRole } from "./nav-config";

/** Why a request is on the 알림 to-do list (P5 spec §5). PR 1 uses only what the request list and the conversation
 * summaries already carry; the per-request reads (visit times, results, Vendor, due dates, link requests) come in PR 2. */
export type TodoReason = "SAFETY" | "REPLY" | "DECIDE" | "DRAFT" | "MORE_INFO";
export type TodoItem = { ticketId: string; unitId: string; issueType: CoreTicketDto["detail"]["issueType"]; reasons: TodoReason[]; lastActivity: string | null };
export type TodoList = { items: TodoItem[]; partial: boolean };

// Sort groups (spec §5): urgent checks, then the replies and decisions someone waits on, then the rest. Group 1 is kept
// for PR 2's 기한 지남.
const GROUP: Record<TodoReason, number> = { SAFETY: 0, REPLY: 2, DECIDE: 2, DRAFT: 3, MORE_INFO: 3 };

export const todoReasonName = (role: CoreRole, reason: TodoReason): string =>
  reason === "REPLY" ? (isTenant(role) ? TODO_REASON_NAMES.REPLY_TENANT : TODO_REASON_NAMES.REPLY_MANAGER) : TODO_REASON_NAMES[reason];

const lastActivity = (ticket: CoreTicketDto) =>
  ticket.events.reduce<string | null>((latest, event) => latest === null || Date.parse(event.at) > Date.parse(latest) ? event.at : latest, null);

function reasonsFor(role: CoreRole, ticket: CoreTicketDto, summary: CoreCommunicationSummary | undefined): TodoReason[] {
  const waiting = summary && !summary.readOnly ? summary.waitingFor : "NONE", reasons: TodoReason[] = [];
  if (isTenant(role)) {
    const open = ticket.workStatus === "OPEN", intake = intakeDisplayStatus(ticket);
    if (open && intake === "SAFETY_ESCALATED") reasons.push("SAFETY");
    if (waiting === "TENANT") reasons.push("REPLY");
    if (isIntakeDraft(ticket)) reasons.push("DRAFT");
    if (open && intake === "NEEDS_MORE_INFO") reasons.push("MORE_INFO");
    return reasons;
  }
  // The tenant's turn (제출 전, 추가 확인) is not the manager's to-do.
  const hint = managerRowHint(ticket);
  if (hint === "SAFETY_ESCALATED") reasons.push("SAFETY");
  if (waiting === "MANAGER") reasons.push("REPLY");
  if (hint === "DECIDE") reasons.push("DECIDE");
  return reasons;
}

/** Builds the list from data the screen already loaded and never calls the server, so the badge counts only what was
 * confirmed. A failed summary read leaves the list partial: replies may be missing, never invented. */
export function buildTodoList({ role, tickets, summaries, summariesFailed }: {
  role: CoreRole; tickets: readonly CoreTicketDto[]; summaries: Readonly<Record<string, CoreCommunicationSummary>>; summariesFailed: boolean;
}): TodoList {
  const items = tickets.filter(ticket => ticket.workStatus !== "COMPLETED").flatMap(ticket => {
    const reasons = reasonsFor(role, ticket, summaries[ticket.ticketId]);
    return reasons.length ? [{ ticketId: ticket.ticketId, unitId: ticket.unitId, issueType: ticket.detail.issueType, reasons, lastActivity: lastActivity(ticket) }] : [];
  });
  const group = (item: TodoItem) => Math.min(...item.reasons.map(reason => GROUP[reason]));
  const time = (item: TodoItem) => item.lastActivity ? Date.parse(item.lastActivity) : 0;
  items.sort((a, b) => group(a) - group(b) || time(b) - time(a) || a.ticketId.localeCompare(b.ticketId));
  return { items, partial: summariesFailed };
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/todo-list.test.ts src/app/core/ticket-communication.test.tsx src/app/core/manager-next-step.test.ts`
Expected: PASS. 기존 두 시험은 이름이 그대로라 바뀌지 않는다.

- [ ] **Step 6: 커밋한다**

```bash
git add apps/web/src/components/status-names.ts apps/web/src/app/core/ticket-communication.tsx apps/web/src/app/core/manager-work.tsx apps/web/src/app/core/nav/todo-list.ts apps/web/src/app/core/nav/todo-list.test.ts
git commit -m "feat(web): P5 to-do list from loaded requests and one set of to-do names

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 5: 주소 hook과 상세 기록

**Files:**
- Create: `apps/web/src/app/core/nav/use-nav-location.ts`
- Test: `apps/web/src/app/core/nav/use-nav-location.test.tsx`

**Interfaces:**
- Consumes: `parentOf`, `NavContext`, `NavLocation`, `TabId` (Task 1); `navHref`, `parseNavLocation`, `sameLocation` (Task 2).
- Produces:
  - `useNavLocation(ctx: NavContext | null, onPop: (detail: boolean) => void): { location: NavLocation; go(next: NavLocation): void; back(): void }`
  - `showDetailEntry(tab?: TabId): void`, `hideDetailEntry(): void`, `detailEntryOnTop(): boolean`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/use-nav-location.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NavContext } from "./nav-config";
import { detailEntryOnTop, hideDetailEntry, showDetailEntry, useNavLocation } from "./use-nav-location";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Api = ReturnType<typeof useNavLocation>;
const tenant: NavContext = { role: "TENANT", b1: true }, admin: NavContext = { role: "ORG_ADMIN", b1: true };
let root: Root | undefined, host: HTMLDivElement | undefined;
function Probe({ ctx, onPop, api }: { ctx: NavContext; onPop(detail: boolean): void; api: RefObject<Api | null> }) {
  const nav = useNavLocation(ctx, onPop);
  api.current = nav;
  return <p data-tab={nav.location.tab} data-view={nav.location.view ?? ""} />;
}
async function mount(ctx: NavContext, onPop = vi.fn()) {
  const api: RefObject<Api | null> = { current: null };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<Probe ctx={ctx} onPop={onPop} api={api} />));
  return { api, onPop, shown: () => [host!.querySelector("p")!.dataset.tab, host!.querySelector("p")!.dataset.view] };
}
beforeEach(() => { window.history.replaceState(null, "", "/core"); vi.spyOn(window, "scrollTo").mockImplementation(() => undefined); });
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; host?.remove(); vi.restoreAllMocks(); });

it("corrects a bare or wrong address in place to the role's first tab", async () => {
  window.history.replaceState(null, "", "/core?tab=work");
  const before = window.history.length, view = await mount(tenant);
  expect(view.shown()).toEqual(["home", ""]);
  expect(window.location.search).toBe("?tab=home");
  expect(window.history.length).toBe(before);
});

it("pushes a menu move and scrolls a repeated tap to the top", async () => {
  const view = await mount(tenant), before = window.history.length;
  await act(async () => view.api.current!.go({ tab: "alerts", view: null }));
  expect(view.shown()).toEqual(["alerts", ""]);
  expect(window.history.length).toBe(before + 1);
  expect(window.history.state).toEqual({ coreNav: true });
  await act(async () => view.api.current!.go({ tab: "alerts", view: null }));
  expect(window.history.length).toBe(before + 1);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0 });
});

it("goes back through history after an in-page move and replaces to the parent after a direct link", async () => {
  window.history.replaceState(null, "", "/core?tab=more&view=licenses");
  const view = await mount(admin), back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  await act(async () => view.api.current!.back());
  expect(back).not.toHaveBeenCalled();
  expect(window.location.search).toBe("?tab=more&view=me");
  await act(async () => view.api.current!.go({ tab: "more", view: "licenses" }));
  await act(async () => view.api.current!.back());
  expect(back).toHaveBeenCalledOnce();
});

it("keeps one history entry per open request and clears it without a new entry", async () => {
  await mount(admin);
  const before = window.history.length;
  act(() => showDetailEntry("work"));
  expect(window.location.search).toBe("?tab=work");
  expect(detailEntryOnTop()).toBe(true);
  act(() => showDetailEntry("work"));
  expect(window.history.length).toBe(before + 1);
  act(() => hideDetailEntry());
  expect(detailEntryOnTop()).toBe(false);
  expect(window.history.length).toBe(before + 1);
});

it("reports a browser back with the entry's request mark and re-reads the address", async () => {
  const view = await mount(admin);
  window.history.replaceState({ coreNav: true }, "", "/core?tab=alerts");
  await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(view.onPop).toHaveBeenLastCalledWith(false);
  expect(view.shown()).toEqual(["alerts", ""]);
  window.history.replaceState({ coreNav: true, detail: true }, "", "/core?tab=work");
  await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(view.onPop).toHaveBeenLastCalledWith(true);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/use-nav-location.test.tsx`
Expected: FAIL, `Failed to resolve import "./use-nav-location"`.

- [ ] **Step 3: 구현한다**

`apps/web/src/app/core/nav/use-nav-location.ts`:

```ts
"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { parentOf, type NavContext, type NavLocation, type TabId } from "./nav-config";
import { navHref, parseNavLocation, sameLocation } from "./nav-location";

// History entries this screen writes carry `coreNav`; an open request adds `detail` (P5 spec §3). The request itself is
// never in the address: a reload shows the tab, and the request is always read again from the server.
type Entry = { coreNav?: true; detail?: true };
const NAV_EVENT = "core-nav";
const entry = (): Entry => { const state: unknown = window.history.state; return state !== null && typeof state === "object" ? state as Entry : {}; };
const here = () => window.location.pathname + window.location.search;
function write(mode: "push" | "replace", state: Entry, href: string) {
  if (mode === "push") window.history.pushState(state, "", href); else window.history.replaceState(state, "", href);
  window.dispatchEvent(new Event(NAV_EVENT));
}
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify); window.addEventListener(NAV_EVENT, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(NAV_EVENT, notify); };
};

/** Marks the open request with one history entry, so browser back closes it; a manager's request opens in 업무함. */
export function showDetailEntry(tab?: TabId) {
  if (entry().detail) return;
  write("push", { coreNav: true, detail: true }, tab ? navHref({ tab, view: null }) : here());
}
/** Drops the request mark from the current entry when the request closed some other way, without a new entry. */
export function hideDetailEntry() {
  const current = entry();
  if (current.detail) write("replace", current.coreNav ? { coreNav: true } : {}, here());
}
export const detailEntryOnTop = () => Boolean(entry().detail);

const NO_PLACE: NavLocation = { tab: "home", view: null };

/** The menu place lives in the address (`/core?tab=&view=`), so browser back and new-tab links work (spec §3). */
export function useNavLocation(ctx: NavContext | null, onPop: (detail: boolean) => void) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const location = useMemo(() => ctx ? parseNavLocation(search, ctx) : NO_PLACE, [ctx, search]);
  const popped = useRef(onPop);
  useEffect(() => { popped.current = onPop; });
  // An address another role or an old link wrote is corrected in place, without a new history entry.
  useEffect(() => { if (ctx && window.location.pathname === "/core" && here() !== navHref(location)) write("replace", entry(), navHref(location)); }, [ctx, location]);
  useEffect(() => {
    const pop = () => popped.current(Boolean(entry().detail));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  /** A menu link: a new history entry; tapping the current first screen again scrolls it to the top (rules 8.14). */
  const go = useCallback((next: NavLocation) => {
    if (!sameLocation(next, location) || entry().detail) write("push", { coreNav: true }, navHref(next));
    window.scrollTo({ top: 0 });
  }, [location]);
  /** The top bar's back button on a row screen: history back after an in-page move, else one step up in place. */
  const back = useCallback(() => {
    if (!ctx) return;
    if (entry().coreNav) window.history.back(); else write("replace", {}, navHref(parentOf(ctx, location)));
  }, [ctx, location]);
  return useMemo(() => ({ location, go, back }), [location, go, back]);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/use-nav-location.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋한다**

```bash
git add apps/web/src/app/core/nav/use-nav-location.ts apps/web/src/app/core/nav/use-nav-location.test.tsx
git commit -m "feat(web): keep the P5 menu place in the address and the open request in history

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 6: 메뉴와 목록 화면 부품

**Files:**
- Create: `apps/web/src/app/core/nav/core-nav.tsx`
- Create: `apps/web/src/app/core/nav/nav-screens.tsx`
- Modify: `apps/web/src/app/core/nav/core-nav.module.css` (Task 3 내용 뒤에 이어 쓴다)
- Modify: `apps/web/src/app/core/ticket-communication.tsx:14-28` (`ready`)
- Test: `apps/web/src/app/core/nav/core-nav.test.tsx`

**Interfaces:**
- Consumes: Task 1–5의 모든 이름; `DateTime` (`../../../components/date-time`).
- Produces:
  - `CoreNav({ ctx, location, badge, caption, onNavigate }: { ctx: NavContext; location: NavLocation; badge: number; caption: string; onNavigate(next: NavLocation): void })`
  - `BackButton({ onClick, disabled, wide }: { onClick(): void; disabled?: boolean; wide: boolean })`
  - `plainClick(event: MouseEvent): boolean`
  - `MenuList({ label, rows, organization, onOpen, onLogout }: { label: string; rows: MenuRow[]; organization?: ReactNode; onOpen(to: NavLocation): void; onLogout(): void })`
  - `TodoScreen({ role, list, ready, units, onOpen, onRetry }: { role: CoreRole; list: TodoList; ready: boolean; units: readonly CoreUnitDto[]; onOpen(ticketId: string): void; onRetry(): void })`
  - `UnitsScreen({ units }: { units: readonly CoreUnitDto[] })`
  - `useCommunicationSummaries(...)`가 `{ summaries, error, ready }`를 돌려준다.
  - CSS 클래스: `shell`, `content`, `pane`, `nav`, `items`, `label`, `badge`, `caption`, `account`, `back`, `menuList`, `row`, `rowBlock`, `todo`, `todoRow`, `todoTitle`, `reasons`, `reasonBadge`, `todoTime`, `partial`, `empty`. 데이터 속성: `data-nav="on"`, `data-sub="true"`, `data-device="phone|wide"`, `data-menu-row`, `data-todo-ticket`, `data-reason`.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/core-nav.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackButton, CoreNav } from "./core-nav";
import { meRows, moreRows } from "./nav-config";
import { MenuList, TodoScreen } from "./nav-screens";

const noop = () => undefined;
const nav = (role: "TENANT" | "ORG_ADMIN", location: { tab: "home" | "alerts" | "more" | "me" | "work"; view: null | "maintenance" | "me" }, badge = 0) =>
  renderToStaticMarkup(<CoreNav ctx={{ role, b1: true }} location={location} badge={badge} caption="합성 조직 · 세입자" onNavigate={noop} />);

describe("main menu (rules 8.10, 8.14, 8.15, 12)", () => {
  it("is one labelled navigation with real addresses", () => {
    const html = nav("TENANT", { tab: "home", view: null });
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('aria-label="주 메뉴"');
    for (const href of ["/core?tab=home", "/core?tab=requests", "/core?tab=alerts", "/core?tab=me"]) expect(html).toContain(`href="${href}"`);
  });

  it("marks only the current place, with the filled icon", () => {
    const html = nav("TENANT", { tab: "alerts", view: null });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*><svg[^>]*data-icon="bell"[^>]*data-filled="true"/);
    expect(html.match(/data-filled="true"/g)).toHaveLength(1);
  });

  it("puts 내 정보 in the tab bar on phones and in the account area on wide screens", () => {
    const html = nav("TENANT", { tab: "me", view: null });
    expect(html).toMatch(/<li data-device="phone"><a href="\/core\?tab=me"/);
    expect(html).toMatch(/data-device="wide"[^]*합성 조직 · 세입자[^]*href="\/core\?tab=me"/);
  });

  it("spreads a manager's 더 보기 rows into the left menu with their icons", () => {
    const html = nav("ORG_ADMIN", { tab: "more", view: "maintenance" });
    expect(html).toMatch(/<li data-device="phone"><a href="\/core\?tab=more"/);
    for (const [href, icon] of [["/core?tab=more&amp;view=maintenance", "file-text"], ["/core?tab=more&amp;view=invitations", "key"], ["/workspace", "layout-grid"]]) {
      expect(html).toMatch(new RegExp(`<li data-device="wide"><a href="${href.replace(/[?]/g, "\\?")}"[^>]*><svg[^>]*data-icon="${icon}"`));
    }
    expect(html).toMatch(/aria-current="page"[^>]*><svg[^>]*data-icon="file-text"/);
  });

  it("names the badge with its count and caps it at 99+", () => {
    expect(nav("TENANT", { tab: "home", view: null }, 2)).toContain('aria-label="알림, 처리할 일 2건"');
    expect(nav("TENANT", { tab: "home", view: null }, 120)).toContain(">99+</span>");
    expect(nav("TENANT", { tab: "home", view: null }, 0)).not.toContain("처리할 일");
  });

  it("gives the back button a name and hides it on wide screens for left-menu screens", () => {
    expect(renderToStaticMarkup(<BackButton wide onClick={noop} />)).toContain('aria-label="뒤로"');
    expect(renderToStaticMarkup(<BackButton wide={false} onClick={noop} />)).toContain('data-device="phone"');
  });
});

describe("menu screens (rules 8.5, 8.11, 8.16)", () => {
  it("lists 내 정보 rows with the organisation field and logout last", () => {
    const html = renderToStaticMarkup(<MenuList label="내 정보" rows={meRows({ role: "TENANT", b1: true })} organization={<select aria-label="내 소속" />} onOpen={noop} onLogout={noop} />);
    expect(html).toContain('aria-label="내 정보"');
    expect(html).toContain('aria-label="내 소속"');
    expect(html.lastIndexOf("로그아웃")).toBeGreaterThan(html.lastIndexOf("오픈소스 라이선스"));
    expect(html).toContain('href="/core?tab=me&amp;view=licenses"');
  });

  it("links 더 보기 rows, including the building setup page", () => {
    const html = renderToStaticMarkup(<MenuList label="더 보기" rows={moreRows({ role: "ORG_ADMIN", b1: true })} onOpen={noop} onLogout={noop} />);
    expect(html).toContain('href="/workspace"');
    expect(html).toContain('href="/core?tab=more&amp;view=me"');
  });

  it("shows loading, empty, partial and filled to-do states", () => {
    const empty = { items: [], partial: false };
    expect(renderToStaticMarkup(<TodoScreen role="TENANT" list={empty} ready={false} units={[]} onOpen={noop} onRetry={noop} />)).toContain("불러오는 중이에요");
    expect(renderToStaticMarkup(<TodoScreen role="TENANT" list={empty} ready units={[]} onOpen={noop} onRetry={noop} />)).toContain("지금 처리할 일이 없어요. 새 문제가 생기면 우리 집에서 접수해 주세요.");
    expect(renderToStaticMarkup(<TodoScreen role="ORG_ADMIN" list={empty} ready units={[]} onOpen={noop} onRetry={noop} />)).toContain("지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요.");
    const partial = renderToStaticMarkup(<TodoScreen role="TENANT" list={{ items: [], partial: true }} ready units={[]} onOpen={noop} onRetry={noop} />);
    expect(partial).toContain("일부를 확인하지 못했어요.");
    expect(partial).toContain(">다시 불러오기</button>");
    const filled = renderToStaticMarkup(<TodoScreen role="TENANT" ready onOpen={noop} onRetry={noop}
      units={[{ id: "u1", label: "101호", buildingName: "합성 건물" } as never]}
      list={{ partial: false, items: [{ ticketId: "t1", unitId: "u1", issueType: "HEATING", reasons: ["REPLY", "DRAFT"], lastActivity: "2026-10-13T01:00:00Z" }] }} />);
    expect(filled).toContain('data-todo-ticket="t1"');
    expect(filled).toContain("난방 · 101호");
    expect(filled).toContain("내 답변 필요");
    expect(filled).toContain("제출 전");
    expect(filled).toContain('dateTime="2026-10-13T01:00:00Z"');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/core-nav.test.tsx`
Expected: FAIL, `Failed to resolve import "./core-nav"`.

- [ ] **Step 3: 메뉴를 쓴다**

`apps/web/src/app/core/nav/core-nav.tsx`:

```tsx
"use client";
import type { MouseEvent } from "react";
import { accountLocation, isTenant, moreRows, navTabs, type NavContext, type NavIconName, type NavLocation } from "./nav-config";
import { navHref } from "./nav-location";
import { NavIcon } from "./nav-icons";
import styles from "./core-nav.module.css";

/** A plain left click stays on this page; a modified click (new tab, new window) follows the real address. */
export const plainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
const count = (n: number) => n > 99 ? "99+" : String(n);

/** The one `<nav aria-label="주 메뉴">` (rules 12): the bottom tab bar up to 767px and the 248px left menu from 768px
 * (rules 8.10, 8.14). Items marked `data-device` show at one width only, so the same names keep the same order. */
export function CoreNav({ ctx, location, badge, caption, onNavigate }: {
  ctx: NavContext; location: NavLocation; badge: number; caption: string; onNavigate(next: NavLocation): void;
}) {
  const tenant = isTenant(ctx.role);
  const accountCurrent = tenant ? location.tab === "me" : location.tab === "more" && (location.view === "me" || location.view === "licenses");
  const item = (key: string, to: NavLocation, label: string, icon: NavIconName, current: boolean, device?: "phone" | "wide", n = 0) =>
    <li key={key} data-device={device}>
      <a href={navHref(to)} aria-current={current ? "page" : undefined} aria-label={n ? `${label}, 처리할 일 ${n}건` : undefined}
        onClick={event => { if (plainClick(event)) { event.preventDefault(); onNavigate(to); } }}>
        <NavIcon name={icon} filled={current} /><span className={styles.label}>{label}</span>
        {n ? <span className={styles.badge} aria-hidden="true">{count(n)}</span> : null}
      </a>
    </li>;
  return <nav aria-label="주 메뉴" className={styles.nav}>
    <ul className={styles.items}>
      {navTabs(ctx.role).map(tab => item(tab.id, { tab: tab.id, view: null }, tab.label, tab.icon,
        location.tab === tab.id && (tab.id !== "more" || location.view === null),
        tab.id === "me" || tab.id === "more" ? "phone" : undefined, tab.id === "alerts" ? badge : 0))}
      {moreRows(ctx).map(row => row.kind === "view" && row.icon && row.to.view
        ? item(row.to.view, row.to, row.label, row.icon, location.tab === "more" && location.view === row.to.view, "wide")
        : row.kind === "href" ? <li key={row.href} data-device="wide"><a href={row.href}><NavIcon name={row.icon} /><span className={styles.label}>{row.label}</span></a></li> : null)}
    </ul>
    <div className={styles.account} data-device="wide">
      <p className={styles.caption}>{caption}</p>
      <ul className={styles.items}>{item("account", accountLocation(ctx.role), "내 정보", "user", accountCurrent)}</ul>
    </div>
  </nav>;
}

/** The top bar's back button (rules 8.10): a 24px chevron in a 50px target. `wide={false}` hides it from 768px, where the
 * left menu lists the screen and it is a first screen. */
export function BackButton({ onClick, disabled, wide }: { onClick(): void; disabled?: boolean; wide: boolean }) {
  return <button type="button" className={styles.back} aria-label="뒤로" disabled={disabled} data-device={wide ? undefined : "phone"} onClick={onClick}><NavIcon name="chevron-left" /></button>;
}
```

- [ ] **Step 4: 목록 화면을 쓴다**

`apps/web/src/app/core/nav/nav-screens.tsx`:

```tsx
"use client";
import type { ReactNode } from "react";
import type { CoreUnitDto } from "@build-manager/api-contracts";
import { DateTime } from "../../../components/date-time";
import { isTenant, type CoreRole, type MenuRow, type NavLocation } from "./nav-config";
import { navHref } from "./nav-location";
import { plainClick } from "./core-nav";
import { todoReasonName, type TodoList } from "./todo-list";
import styles from "./core-nav.module.css";

/** 더 보기 and 내 정보 as list rows (rules 8.5, 8.16): a row opens its screen; 로그아웃 is the last row. */
export function MenuList({ label, rows, organization, onOpen, onLogout }: {
  label: string; rows: MenuRow[]; organization?: ReactNode; onOpen(to: NavLocation): void; onLogout(): void;
}) {
  return <section className={styles.menuList} aria-label={label}><ul>{rows.map(row => <li key={row.label}>{
    row.kind === "view" ? <a className={styles.row} data-menu-row href={navHref(row.to)} onClick={event => { if (plainClick(event)) { event.preventDefault(); onOpen(row.to); } }}>{row.label}</a>
    : row.kind === "href" ? <a className={styles.row} data-menu-row href={row.href}>{row.label}</a>
    : row.kind === "organization" ? <div className={styles.rowBlock}>{organization}</div>
    : <button type="button" className={styles.row} data-menu-row onClick={onLogout}>{row.label}</button>
  }</li>)}</ul></section>;
}

/** 내 호실: the buildings and units this account may use. */
export function UnitsScreen({ units }: { units: readonly CoreUnitDto[] }) {
  return <section className={styles.menuList} aria-label="내 호실">{units.length
    ? <ul>{units.map(unit => <li key={unit.id} className={styles.rowBlock}><strong>{unit.label}</strong><span>{unit.buildingName}</span></li>)}</ul>
    : <p className={styles.empty}>연결된 호실이 없어요. 관리자에게 호실 연결을 확인해 주세요.</p>}</section>;
}

/** 알림 (spec §5): one row per request with every reason; a partial read says so instead of inventing a count. */
export function TodoScreen({ role, list, ready, units, onOpen, onRetry }: {
  role: CoreRole; list: TodoList; ready: boolean; units: readonly CoreUnitDto[]; onOpen(ticketId: string): void; onRetry(): void;
}) {
  if (!ready) return <p role="status">불러오는 중이에요</p>;
  const unitLabel = (id: string) => units.find(unit => unit.id === id)?.label;
  return <section className={styles.todo} aria-label="처리할 일">
    {list.partial ? <div className={styles.partial} role="alert"><p>일부를 확인하지 못했어요.</p><button type="button" onClick={onRetry}>다시 불러오기</button></div> : null}
    {list.items.length ? <ul>{list.items.map(item => <li key={item.ticketId}>
      <button type="button" className={styles.todoRow} data-todo-ticket={item.ticketId} onClick={() => onOpen(item.ticketId)}>
        <span className={styles.todoTitle}>{item.issueType === "HEATING" ? "난방" : "누수"}{unitLabel(item.unitId) ? ` · ${unitLabel(item.unitId)}` : ""}</span>
        <span className={styles.reasons}>{item.reasons.map(reason => <span key={reason} className={styles.reasonBadge} data-reason={reason}>{todoReasonName(role, reason)}</span>)}</span>
        {item.lastActivity ? <span className={styles.todoTime}><DateTime at={item.lastActivity} /></span> : null}
      </button>
    </li>)}</ul>
    : list.partial ? null : <p className={styles.empty}>{isTenant(role) ? "지금 처리할 일이 없어요. 새 문제가 생기면 우리 집에서 접수해 주세요." : "지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요."}</p>}
  </section>;
}
```

`<DateTime at=…/>`가 `dateTime` 속성을 쓰는지 `apps/web/src/components/date-time.tsx`에서 확인한다. 다른 이름이면 시험의 `dateTime=` 기대값을 그 출력에 맞춘다(동작은 그대로).

- [ ] **Step 5: 메뉴 스타일을 쓴다**

`apps/web/src/app/core/nav/core-nav.module.css` 끝에 더한다. 선택자는 `.root a:not(.primary-button)`(밑줄 파랑 링크)와 `.root button`(테두리 상자)보다 구체적이어야 해서 `.shell .nav a`, `.menuList li a.row`처럼 쓴다.

```css
/* Shell: the menu beside or below the content (rules 7, 8.10, 8.14). */
.shell { min-height: 100vh; }
.content { min-width: 0; background: var(--color-surface); }
.pane { min-width: 0; }
.shell .nav { background: var(--color-surface); }
.items { margin: 0; padding: 0; list-style: none; }
.items > li { margin: 0; }
.shell .nav a { position: relative; display: flex; text-decoration: none; color: var(--color-text-secondary); }
.shell .nav a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.shell .nav svg { flex: none; }
.label { white-space: nowrap; }
/* Badge (8.15): count only, 18 high, at least 18 wide, 5 inside on each side, 5 corners, centred. */
.badge { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: 1.125rem; min-width: 1.125rem; padding: 0 .3125rem; border-radius: .3125rem; background: var(--color-badge); color: var(--color-text-inverse); font-size: .8125rem; line-height: 1.0625rem; font-weight: 600; letter-spacing: 0; font-variant-numeric: tabular-nums; }
.caption { margin: 0; padding: .625rem .9375rem; color: var(--color-text-secondary); font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; overflow-wrap: anywhere; }
.back svg { width: 1.5rem; height: 1.5rem; }

/* List rows (8.5): 50 high at least, 15 above and below, subheading names. */
.menuList > ul, .todo > ul { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--color-border); }
.menuList > ul > li, .todo > ul > li { margin: 0; border-bottom: 1px solid var(--color-border); }
.menuList li a.row, .menuList li button.row { display: flex; align-items: center; width: 100%; min-height: 3.125rem; padding: .9375rem 1.25rem; border: 0; border-radius: 0; background: transparent; color: var(--color-text); text-align: left; text-decoration: none; font-size: .9375rem; line-height: 1.5625rem; font-weight: 600; letter-spacing: -0.01em; }
.menuList li a.row:hover, .menuList li button.row:hover:not(:disabled) { background: var(--color-fill-hover); }
.rowBlock { display: grid; gap: .3125rem; padding: .9375rem 1.25rem; }
.rowBlock > span { color: var(--color-text-secondary); font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; }
.empty { padding: 1.25rem; }
.todo li button.todoRow { display: grid; gap: .3125rem; width: 100%; min-height: 3.125rem; padding: .9375rem 1.25rem; border: 0; border-radius: 0; background: transparent; color: var(--color-text); text-align: left; font-weight: 400; }
.todo li button.todoRow:hover:not(:disabled) { background: var(--color-fill-hover); }
.todoTitle { font-size: .9375rem; line-height: 1.5625rem; font-weight: 600; letter-spacing: -0.01em; }
.reasons { display: flex; flex-wrap: wrap; gap: .3125rem; }
/* Status labels (2.3, 8.7): text plus a soft fill; urgent red, the rest the waiting amber. */
.reasonBadge { display: inline-flex; align-items: center; justify-content: center; padding: .3125rem .625rem; border-radius: .3125rem; color: var(--status-wait-text); background: var(--status-wait-bg); font-size: .9375rem; line-height: 1.25rem; font-weight: 600; }
.reasonBadge[data-reason="SAFETY"] { color: var(--status-urgent-text); background: var(--status-urgent-bg); }
.todoTime { color: var(--color-text-secondary); font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; }
.partial { margin: 1.25rem; }
.partial > * + * { margin-top: .625rem; }

@media (max-width: 767px) {
  /* Bottom tab bar (8.14): 5 · icon 24 · 5 · label 17 · 5 = 56, plus the bottom safe area; the top line sits inside. */
  .shell .nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; padding-bottom: env(safe-area-inset-bottom, 0px); box-shadow: inset 0 1px 0 var(--color-border); }
  .nav > .items { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
  .nav [data-device="wide"] { display: none; }
  .shell .nav a { flex-direction: column; align-items: center; gap: .3125rem; min-height: 3.5rem; padding: .3125rem 0; font-size: .8125rem; line-height: 1.0625rem; font-weight: 400; letter-spacing: 0; }
  .shell .nav a svg { width: 1.5rem; height: 1.5rem; }
  .shell .nav a[aria-current="page"] { color: var(--color-primary); font-weight: 600; }
  /* Badge: left edge 19 right of the icon's left edge, top 5 above the icon's top (8.15). */
  .shell .nav .badge { position: absolute; top: 0; left: calc(50% + .4375rem); }
  .shell[data-nav="on"]:not([data-sub="true"]) .content { padding-bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px)); }
  .shell[data-sub="true"] .nav { display: none; }
  :global(html):has(.shell[data-nav="on"]:not([data-sub="true"])) { scroll-padding-bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px)); }
}
@media (min-width: 768px) {
  /* Left menu (8.10): 248px; items 50 high, 15 inside left and right, icon 20, 5 to the label; account area last. */
  .shell[data-nav="on"] { display: grid; grid-template-columns: 248px minmax(0, 1fr); }
  .shell .nav { position: sticky; top: 0; display: flex; flex-direction: column; height: 100vh; overflow-y: auto; padding: 1.25rem .625rem; border-right: 1px solid var(--color-border); }
  .nav [data-device="phone"] { display: none; }
  .shell .nav a { align-items: center; gap: .3125rem; min-height: 3.125rem; padding: 0 .9375rem; border-radius: .625rem; color: var(--color-text); font-size: .9375rem; line-height: 1.5625rem; letter-spacing: -0.01em; }
  .shell .nav a svg { width: 1.25rem; height: 1.25rem; }
  .shell .nav a:hover { background: var(--color-fill-hover); }
  .shell .nav a[aria-current="page"] { font-weight: 600; background: var(--color-fill-hover); }
  .shell .nav .badge { margin-left: auto; }
  .account { margin-top: auto; padding-top: .625rem; border-top: 1px solid var(--color-border); }
  .back[data-device="phone"] { display: none; }
  .menuList li a.row, .menuList li button.row, .rowBlock, .todo li button.todoRow, .empty { padding-inline: 1.875rem; }
}
@media (min-width: 1440px) {
  .menuList li a.row, .menuList li button.row, .rowBlock, .todo li button.todoRow, .empty { padding-inline: 2.5rem; }
}
```

- [ ] **Step 6: 대화 요약 hook에 `ready`를 더한다**

`apps/web/src/app/core/ticket-communication.tsx`의 `useCommunicationSummaries`를 이렇게 바꾼다(처음 읽기가 끝났는지 알려 알림 탭이 "불러오는 중이에요"를 보일 수 있게):

```tsx
export function useCommunicationSummaries(client:CoreFlowClient,ids:string[],revision:number){
  const [summaries,setSummaries]=useState<Record<string,CoreCommunicationSummary>>({}),[error,setError]=useState(false),[ready,setReady]=useState(false);
  const key=ids.join(",");
  useEffect(()=>{
    let live=true,generation=0;
    const load=async()=>{const current=++generation;try{
      const list=key?key.split(","):[],all:CoreCommunicationSummary[]=[];
      for(let i=0;i<list.length;i+=50)all.push(...await client.communication.summaries(list.slice(i,i+50)));
      if(live&&current===generation){setSummaries(Object.fromEntries(all.map(s=>[s.ticketId,s])));setError(false);setReady(true);}
    }catch{if(live&&current===generation){setSummaries({});setError(true);setReady(true);}}};
    const focus=()=>{if(!document.hidden)void load();};void load();window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    return()=>{live=false;generation++;window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[client,key,revision]);
  return {summaries,error,ready};
}
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav src/app/core/ticket-communication.test.tsx src/app/core/haeyo-copy.test.ts`
Expected: PASS.

Run: `npm --workspace @build-manager/web run typecheck && npm --workspace @build-manager/web run lint`
Expected: 0 errors.

- [ ] **Step 8: 커밋하고 크기를 잰다**

```bash
git add apps/web/src/app/core/nav/core-nav.tsx apps/web/src/app/core/nav/nav-screens.tsx apps/web/src/app/core/nav/core-nav.module.css apps/web/src/app/core/nav/core-nav.test.tsx apps/web/src/app/core/ticket-communication.tsx
git commit -m "feat(web): P5 main menu, back button and menu screens

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
git diff --stat origin/main...HEAD | tail -1
```

합계가 1000줄을 넘으면 Task 1–4와 Task 5–6을 각각 PR로 낸다(PR 나누기 절). 부품 PR은 화면이 바뀌지 않으므로 Task 11의 검사 중 `test:shared`, `test:web`, `lint`, `typecheck`, `build:web`, `check:deps`, `verify_repository.py --history`를 돌리고, 독립 리뷰를 받은 뒤 병합한다. 다음 Task는 부품 PR이 병합된 main에서 이어 간다(`git merge origin/main`, 충돌 없음 확인).

---

### Task 7: 새 메뉴 화면 시험(먼저 실패)

**Files:**
- Modify: `apps/web/tests/core-e2e/presentation.ts` (도우미 함수)
- Create: `apps/web/tests/core-login-e2e/navigation.spec.ts`
- Create: `apps/web/tests/core-e2e/navigation.spec.ts`

**Interfaces:**
- Produces (`presentation.ts`): `expectSignedIn(page)`, `openTab(page, name)`, `openAccount(page)`, `openMoreRow(page, name)`, `openTicketRow(page, id)`. Task 11이 기존 시험에서 쓴다.

- [ ] **Step 1: 시작 전에 main을 합친다**

```bash
git fetch origin && git merge --no-edit origin/main
```

Expected: 충돌 없음. 브랜치는 2026-10-13에 `b1a4aa6`(PR #134) 위에서 다시 만들었으므로, 그 뒤 main에 들어온 것만 합쳐진다. 디자인 규칙이 바뀌었으면(2-b6의 PR #135 등) 훅이 다시 읽기를 요구한다.

- [ ] **Step 2: 메뉴 도우미를 더한다**

`apps/web/tests/core-e2e/presentation.ts` 끝에 더한다:

```ts
const mainMenu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
/** P5: a signed-in /core shows the main menu. Before P5 the check waited for the logout button, now inside 내 정보. */
export async function expectSignedIn(page: Page) {
  await expect(mainMenu(page)).toBeVisible();
}
/** On a phone a request or row screen hides the tab bar (rules 8.14); go back until the menu shows. */
async function toFirstScreen(page: Page) {
  const back = page.getByRole("button", { name: "뒤로", exact: true });
  for (let i = 0; i < 3 && !(await mainMenu(page).isVisible()) && await back.isVisible(); i++) await back.click();
  await expectSignedIn(page);
}
/** Clicks a main-menu item by name; the 알림 item may carry a count ("알림, 처리할 일 2건"). */
export async function openTab(page: Page, name: string) {
  await toFirstScreen(page);
  await mainMenu(page).getByRole("link", { name: new RegExp(`^${name}(, |$)`) }).click();
}
/** Opens a 더 보기 row: from the left menu on wide screens, through the 더 보기 tab on phones. */
export async function openMoreRow(page: Page, name: string) {
  await toFirstScreen(page);
  const direct = mainMenu(page).getByRole("link", { name, exact: true });
  if (await direct.count()) { await direct.click(); return; }
  await openTab(page, "더 보기");
  await page.getByRole("region", { name: "더 보기", exact: true }).getByRole("link", { name, exact: true }).click();
}
/** Opens 내 정보: the tenant's tab or the wide account item, else 더 보기 › 내 정보 on a manager's phone. */
export async function openAccount(page: Page) {
  await openMoreRow(page, "내 정보");
}
/** Opens a request row on the current screen, or from 내 요청, where the tenant's list lives since P5. */
export async function openTicketRow(page: Page, id: string) {
  await toFirstScreen(page);
  const requests = mainMenu(page).getByRole("link", { name: "내 요청", exact: true });
  if (await requests.count() && await requests.getAttribute("aria-current") !== "page") await requests.click();
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
}
```

`openAccount`가 `openMoreRow`를 쓰는 이유: 세입자는 메뉴에 "내 정보" 링크가 보이고(탭바 또는 넓은 화면 계정 영역), 관리자는 넓은 화면에서 계정 영역에, 휴대폰에서는 더 보기 목록에 있다. 메뉴의 `getByRole`은 `display:none`인 항목을 세지 않으므로 폭마다 하나만 잡힌다.

- [ ] **Step 3: 로그인 화면 메뉴 시험을 쓴다**

`apps/web/tests/core-login-e2e/navigation.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { sdkSession } from "./session";

// P5 (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md): tab bar up to 767px, left menu from 768px.
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
const link = (page: Page, name: string | RegExp) => typeof name === "string" ? menu(page).getByRole("link", { name, exact: true }) : menu(page).getByRole("link", { name });
const round = (n: number) => Math.round(n);

test("phone tab bar: tabs, current mark, badge, re-tap to top, request screens without the bar", async ({ browser }) => {
  const tenant = await sdkSession(browser);
  try {
    // A saved request that was never sent is the tenant's own to-do (제출 전).
    const made = await tenant.context.request.post("/api/v2/core/tickets", { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: "LEAK", rawUserText: "합성 메뉴 처리할 일" } });
    expect(made.status()).toBe(201); const id = (await made.json()).ticketId as string;
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/core");
    await expect(page).toHaveURL(/\/core\?tab=home$/);
    await expect(menu(page).getByRole("link")).toHaveText(["우리 집", "내 요청", /^알림/, "내 정보"]);
    await expect(link(page, "우리 집")).toHaveAttribute("aria-current", "page");
    const bar = (await menu(page).boundingBox())!;
    expect(round(bar.height)).toBe(56); expect(round(bar.y + bar.height)).toBe(844);
    expect(new Set(await menu(page).getByRole("link").evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().width)))).size).toBe(1);
    // Rules 8.14: the content keeps the bar's height free at the bottom.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const footer = (await page.locator("footer.core-environment").boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(bar.y + 1);
    // Tapping the current tab again goes to the top.
    await page.evaluate(() => { document.body.style.minHeight = "3000px"; scrollTo(0, 600); });
    await link(page, "우리 집").click(); await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    // Keyboard: Tab walks the bar in order and Enter opens the tab.
    await link(page, "우리 집").focus(); await page.keyboard.press("Tab"); await expect(link(page, "내 요청")).toBeFocused();
    await page.keyboard.press("Enter"); await expect(page).toHaveURL(/tab=requests$/);
    // The badge sits 19 right and 5 above the icon, and its count is the number of to-do rows (rules 8.15).
    const alerts = link(page, /^알림, 처리할 일 \d+건$/); await expect(alerts).toBeVisible();
    const count = Number((await alerts.getAttribute("aria-label"))!.match(/(\d+)건/)![1]);
    const icon = (await alerts.locator("svg").boundingBox())!, badge = (await alerts.locator("span[aria-hidden]").boundingBox())!;
    expect(round(badge.x - icon.x)).toBe(19); expect(round(icon.y - badge.y)).toBe(5); expect(round(badge.height)).toBe(18);
    await alerts.click(); await expect(page).toHaveURL(/tab=alerts$/);
    await expect(page.locator("[data-todo-ticket]")).toHaveCount(count);
    const row = page.locator(`[data-todo-ticket="${id}"]`); await expect(row).toContainText("제출 전");
    // A request is a sub-screen: no tab bar, a back button, and browser back returns to 알림.
    await row.click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await expect(menu(page)).toBeHidden(); await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeVisible();
    await page.evaluate(() => history.back()); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
    await expect(link(page, /^알림/)).toHaveAttribute("aria-current", "page");
    // Unsent photos keep the request open on browser back, as the back button does.
    await row.click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await page.getByLabel("참고 사진 선택", { exact: true }).setInputFiles({ name: "nav-pending.png", mimeType: "image/png", buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: "#84aa96" } }).png().toBuffer() });
    await page.evaluate(() => history.back());
    await expect(page.getByText("목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.")).toBeVisible();
    await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await page.getByRole("button", { name: "사진 1 선택 취소", exact: true }).click();
    await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
  } finally { await tenant.close(); }
});

test("left menu from 768px: 248px, 더 보기 rows spread with icons, account area, first screens without back", async ({ browser }) => {
  const manager = await sdkSession(browser, "manager");
  try {
    const page = await manager.context.newPage(); await page.setViewportSize({ width: 768, height: 900 }); await page.goto("/core");
    await expect(menu(page)).toBeVisible();
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(round((await menu(page).boundingBox())!.width)).toBe(248);
      await expect(menu(page).getByRole("link")).toHaveText(["업무함", /^알림/, "호실 정비 이력", "입주 연결", "건물·호실 관리", "내 정보"]);
      expect(round((await link(page, "업무함").boundingBox())!.height)).toBe(50);
      await expect(menu(page).getByText(/ · 조직 관리자$/)).toBeVisible();
    }
    await link(page, "호실 정비 이력").click(); await expect(page).toHaveURL(/tab=more&view=maintenance$/);
    await expect(link(page, "호실 정비 이력")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeHidden();
    await link(page, "내 정보").click(); await expect(page.getByRole("heading", { level: 1, name: "내 정보" })).toBeVisible();
    const account = page.getByRole("region", { name: "내 정보", exact: true });
    await expect(account.getByLabel("내 소속", { exact: true })).toBeVisible();
    await account.getByRole("link", { name: "오픈소스 라이선스", exact: true }).click();
    await expect(page.getByText("Copyright (c) 2020-2026 Paweł Kuna")).toBeVisible();
    await expect(page.getByRole("button", { name: "뒤로", exact: true })).toBeVisible();
    await expect(link(page, "내 정보")).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(page).toHaveURL(/tab=more&view=me$/);
    await link(page, "건물·호실 관리").click(); await expect(page).toHaveURL(/\/workspace$/);
  } finally { await manager.close(); }
});

test("a manager's to-do opens in 업무함 and browser back returns to 알림", async ({ browser }) => {
  const tenant = await sdkSession(browser), manager = await sdkSession(browser, "manager");
  try {
    const made = await tenant.context.request.post("/api/v2/core/tickets", { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: "HEATING", rawUserText: "합성 관리자 답변 대기" } });
    expect(made.status()).toBe(201); const id = (await made.json()).ticketId as string;
    const asked = await tenant.context.request.post(`/api/v2/core/tickets/${id}/communication/messages`, { headers: tenant.headers, data: { clientRequestId: randomUUID(), expectedVersion: 0, intent: "TENANT_MESSAGE", body: "합성 세입자 문의예요." } });
    expect(asked.status()).toBe(201);
    const page = await manager.context.newPage(); await page.setViewportSize({ width: 1280, height: 900 }); await page.goto("/core?tab=alerts");
    const row = page.locator(`[data-todo-ticket="${id}"]`); await expect(row).toContainText("관리자 답변 대기");
    await row.click(); await expect(page).toHaveURL(/tab=work$/); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await expect(link(page, "업무함")).toHaveAttribute("aria-current", "page");
    await page.evaluate(() => history.back()); await expect(page).toHaveURL(/tab=alerts$/); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
    // Closing a request through the menu replaces its history entry, so one browser back returns to the screen before it.
    await row.click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
    await link(page, "호실 정비 이력").click(); await expect(page).toHaveURL(/tab=more&view=maintenance$/); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
    await page.evaluate(() => history.back()); await expect(page).toHaveURL(/tab=alerts$/); await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
  } finally { await tenant.close(); await manager.close(); }
});

test("the address keeps the menu place, wrong places fall back, and an organisation change starts on the first tab", async ({ browser }) => {
  const tenant = await sdkSession(browser), two = await sdkSession(browser, "none");
  try {
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/core"); await expect(page).toHaveURL(/\/core\?tab=home$/); await page.reload(); await expect(page).toHaveURL(/\/core\?tab=home$/);
    await page.goto("/core?tab=work"); await expect(page).toHaveURL(/\/core\?tab=home$/);
    await page.goto("/core?tab=more&view=invitations"); await expect(page).toHaveURL(/\/core\?tab=home$/);
    await page.goto("/core?tab=me&view=licenses"); await expect(page.getByText("Copyright (c) 2020-2026 Paweł Kuna")).toBeVisible();
    await expect(menu(page)).toBeHidden();
    await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(page).toHaveURL(/\/core\?tab=me$/);
    await expect(page.getByRole("region", { name: "내 정보", exact: true })).toBeVisible();
    // An account in two organisations: switching from 내 정보 lands on that role's first tab (rules 8.16).
    const actor = (await two.admin.query("SELECT authn.current_actor($1) AS id", [two.digest])).rows[0].id;
    for (const org of [two.fixture.orgA, two.fixture.orgB]) await two.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')", [org, actor]);
    const admin = await two.context.newPage(); await admin.setViewportSize({ width: 1280, height: 900 }); await admin.goto("/core");
    await admin.getByLabel("내 소속", { exact: true }).selectOption(two.fixture.orgA); await expect(link(admin, "업무함")).toHaveAttribute("aria-current", "page");
    await link(admin, /^알림/).click(); await link(admin, "내 정보").click();
    await admin.getByRole("region", { name: "내 정보", exact: true }).getByLabel("내 소속", { exact: true }).selectOption(two.fixture.orgB);
    await expect(admin).toHaveURL(/\/core\?tab=work$/); await expect(link(admin, "업무함")).toHaveAttribute("aria-current", "page");
  } finally { await tenant.close(); await two.close(); }
});
```

배지 링크의 화면 읽기 이름에는 99를 넘어도 실제 건수가 들어가므로(보이는 글자만 `99+`), 알림 목록의 행 수와 늘 같아야 한다.

- [ ] **Step 4: 개발 모드 메뉴 시험을 쓴다**

`apps/web/tests/core-e2e/navigation.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const codes = async () => JSON.parse(await readFile(join(homedir(), ".build-manager-rc1-private", "access-codes.json"), "utf8")) as Record<string, string>;
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
async function login(page: Page, who: string) {
  await page.goto("/core"); await page.getByLabel("개발 접근 코드").fill((await codes())[who]);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}

test("development sign-in gets the same menu without organisations or move-in links (P5 spec D11)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, "tenant");
  await menu(page).getByRole("link", { name: "내 정보", exact: true }).click();
  await expect(page.getByRole("region", { name: "내 정보", exact: true }).locator("[data-menu-row]")).toHaveText(["내 호실", "오픈소스 라이선스", "로그아웃"]);
  await expect(page.getByLabel("내 소속", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click(); await expect(page.getByLabel("개발 접근 코드")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page, "manager");
  await expect(menu(page).getByRole("link")).toHaveText(["업무함", /^알림/, "호실 정비 이력", "내 정보"]);
  await expect(menu(page).getByText(/^(조직 관리자|건물 담당자)$/)).toBeVisible();
});
```

- [ ] **Step 5: 실패를 확인한다**

Run: `npm run test:e2e:sdk -- navigation.spec.ts` 그리고 `npm run test:e2e:core -- navigation.spec.ts`
Expected: 모든 시험이 FAIL. 첫 실패는 `navigation "주 메뉴"`를 찾지 못하는 것(또는 주소가 `?tab=`으로 바뀌지 않는 것)이어야 한다. 다른 이유(서버 시작 실패, 시험 데이터)로 실패하면 고친 뒤 다시 돌린다.

- [ ] **Step 6: 커밋한다**

```bash
git add apps/web/tests/core-e2e/presentation.ts apps/web/tests/core-login-e2e/navigation.spec.ts apps/web/tests/core-e2e/navigation.spec.ts
git commit -m "test(web): P5 menu browser tests, failing before the menu exists

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 8: `CoreFlowPage`에 메뉴 붙이기

**Files:**
- Modify: `apps/web/src/app/core/core-screen.tsx`

**Interfaces:**
- Consumes: Task 1–6의 부품.
- Produces: `export type CoreAccount = { caption: string; organization?: ReactNode; linkPanel?: ReactNode; logout(): void }`; `CoreFlowPage({ b1, onDenied, onLogout, account })`.

아래 바꾸기는 지금 파일의 정확한 글자를 기준으로 한다. 줄 번호는 main `7256df7` 기준이다.

- [ ] **Step 1: import와 타입**

5행 `import { useCallback,useEffect,useMemo,useRef,useState } from "react";`를 `import { useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from "react";`로 바꾸고, 25행(`import { DateTime } …`) 아래에 더한다:

```ts
import { BackButton,CoreNav } from "./nav/core-nav";
import { MenuList,TodoScreen,UnitsScreen } from "./nav/nav-screens";
import { OpenSourceNotice } from "./nav/open-source-notice";
import { inLeftMenu,meRows,moreRows,navTitle,roleName,type NavLocation } from "./nav/nav-config";
import { detailEntryOnTop,hideDetailEntry,showDetailEntry,useNavLocation } from "./nav/use-nav-location";
import { buildTodoList } from "./nav/todo-list";
import navStyles from "./nav/core-nav.module.css";
```

56행의 함수 머리를 바꾸고 바로 위에 타입을 둔다:

```ts
/** What the login screen hands the menu (P5 spec §1): the account-area caption, the 내 소속 field, this organisation's
 * move-in link screen, and logout. Development sign-in passes none of it. */
export type CoreAccount={caption:string;organization?:ReactNode;linkPanel?:ReactNode;logout():void};
export default function CoreFlowPage({b1,onDenied,onLogout,account}:{b1?:{orgId:string;csrf:string};onDenied?:()=>void;onLogout?:()=>void;account?:CoreAccount}={}){
```

- [ ] **Step 2: 관리자 보기 상태를 없앤다**

- 60행 `const [managerView,setManagerView]=useState<"WORK_QUEUE"|"MAINTENANCE">("WORK_QUEUE"),[maintenanceUnit,setMaintenanceUnit]=useState("");` → `const [maintenanceUnit,setMaintenanceUnit]=useState("");`
- 74행 `clearAccess` 안의 `setManagerView("WORK_QUEUE");`를 지운다.
- 177행 `openMaintenanceTicket` 안의 `setManagerView("WORK_QUEUE");`를 지운다(관리자의 요청은 상세 기록이 업무함으로 옮긴다).

- [ ] **Step 3: 대화 요약을 처리할 일에도 쓴다**

90행을 바꾼다:

```ts
  const tenant=session?.role==="TENANT";
  // Tenant rows show every request's conversation state; a manager's to-dos need only unfinished requests. Opening and
  // closing a request re-reads them, as before P5, so a row shows the reply just sent.
  const summaryIds=useMemo(()=>tickets.filter(t=>tenant||t.workStatus!=="COMPLETED").map(t=>t.ticketId),[tickets,tenant]);
  // null until the session is known, so the 알림 tab shows "불러오는 중이에요" instead of an empty list (parts review).
  const conversationSummaries=useCommunicationSummaries(client,session?summaryIds:null,selected?revision+.5:revision);
```

- [ ] **Step 4: 메뉴 상태, 상세 기록, 처리할 일**

98행(`run` 정의의 끝 `};`) 바로 아래에 더한다:

```ts
  // P5 menu (spec §2–§3): the place lives in the address; an open request is one history entry, so browser back closes it.
  const role=session?.role??null;
  const navContext=useMemo(()=>role?{role,b1:Boolean(b1)}:null,[role,b1]);
  const selectedRef=useRef<CoreTicketDto|null>(null),pendingRef=useRef<PendingPhoto[]>([]);
  useEffect(()=>{selectedRef.current=selected;pendingRef.current=pending;});
  const leaveDetail=()=>void run(async()=>{setSelected(null);setPhotoMessage("");setTickets(await client.tickets());});
  const nav=useNavLocation(navContext,detail=>{
    if(detail){if(!selectedRef.current)hideDetailEntry();return;}
    if(!selectedRef.current)return;
    // Unsent photos keep the request open, as the back button does: put its history entry back.
    if(pendingRef.current.length){showDetailEntry(role==="TENANT"?undefined:"work");return;}
    leaveDetail();
  });
  const detailId=selected?.ticketId??null;
  useEffect(()=>{if(!role)return;if(detailId)showDetailEntry(role==="TENANT"?undefined:"work");else hideDetailEntry();},[detailId,role]);
  const closeDetail=()=>{if(detailEntryOnTop())window.history.back();else leaveDetail();};
  /** A menu link. An open request closes first; unsent photos keep it open, and the request says why. */
  const navigate=(next:NavLocation)=>{
    if(selected){if(pending.length)return;setSelected(null);setPhotoMessage("");}
    nav.go(next);
  };
  const todo=useMemo(()=>role?buildTodoList({role,tickets,summaries:conversationSummaries.summaries,summariesFailed:conversationSummaries.error}):{items:[],partial:false},[role,tickets,conversationSummaries.summaries,conversationSummaries.error]);
  const logout=account?.logout??(()=>{if(onLogout){clearAccess();onLogout();}else void run(async()=>{await client.logout();clearAccess();});});
```

- [ ] **Step 5: 후속 접수와 정비 이력 이동**

- 180행 `beginFollowUp` 끝의 `setSelected(null);};`를 `setSelected(null);nav.go({tab:"home",view:null});};`로 바꾼다(후속 접수 칸은 우리 집에 있다).
- 261행 `onViewUnit={id=>{setMaintenanceUnit(id);setManagerView("MAINTENANCE");}}`를 `onViewUnit={id=>{setMaintenanceUnit(id);navigate({tab:"more",view:"maintenance"});}}`로 바꾼다.

- [ ] **Step 6: 화면 구조를 바꾼다**

201행 `return <Workspace …>`부터 284행 `</Workspace>;`까지를 아래로 바꾼다. `{selected?<section className={styles.selectedPane} aria-label="선택한 접수">`부터 그 `</section>`까지(223–268행, Step 5의 `onViewUnit` 수정 포함)와 개발 접근 코드 양식(213–217행)은 글자 그대로 옮긴다. 아래에서 `/* 223–268행 그대로 */`, `/* 213–217행 그대로 */`라고 적은 자리다.

```tsx
  const location=nav.location,tab=location.tab,view=location.view;
  const sub=Boolean(selected)||Boolean(view);
  const title=!session?"수리 접수":selected?(tenant?"접수 내용":"업무함"):tenant&&tab==="home"&&!view?(units.find(u=>u.id===unit)?.label??"수리 접수"):navTitle(session.role,location);
  const openFromList=(id:string)=>void run(async()=>{await openWithList(id);setMessage("");});
  // The request list area: the tenant's 우리 집 and 내 요청, the manager's 업무함, or any open request.
  const workVisible=Boolean(selected)||(!view&&(tenant?tab==="home"||tab==="requests":tab==="work"));
  return <div className={navStyles.shell} data-nav={navContext?"on":undefined} data-sub={sub?"true":undefined}>
    {navContext&&session?<CoreNav ctx={navContext} location={location} badge={conversationSummaries.ready?todo.items.length:0} caption={account?.caption??roleName(session.role)} onNavigate={navigate}/>:null}
    <div className={navStyles.content}>
    <Workspace id="core-tickets" className="page-shell core-flow" aria-label="수리 접수 작업" data-role={session?.role}>
    <header className={styles.heading} data-testid="unit-context" data-sub={sub?"true":undefined}><div className={styles.toolbarLeading}>{selected?<BackButton wide disabled={busy||pending.length>0} onClick={closeDetail}/>:view&&navContext?<BackButton wide={!inLeftMenu(navContext,view)} onClick={nav.back}/>:null}<div><h1>{title}</h1>
    {tenant&&!selected&&tab==="home"&&!view?<p>{units.find(u=>u.id===unit)?.buildingName}</p>:null}
    </div></div>
    {!b1?<EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않아요.</EnvironmentNote>:null}
    {session?<nav className="core-actions" aria-label="접속 및 새로고침">{selected&&!tenant?<button id="ticket-inspector-trigger" aria-controls="ticket-inspector" aria-expanded={inspectorExpanded} onClick={()=>{if(window.matchMedia("(min-width: 1120px) and (max-width: 1439px)").matches)setInspectorExpanded(value=>!value);else{setInspectorExpanded(true);/* Menu audit F-20: show the panel's content, not just its heading at the bottom edge. */requestAnimationFrame(()=>{const inspector=document.getElementById("ticket-inspector");inspector?.scrollIntoView({block:"start"});inspector?.querySelector("summary")?.focus({preventScroll:true});});}}}>업무 정보</button>:null}
        <button disabled={busy} onClick={()=>void run(refresh)}>새로고침</button>
      </nav>:null}
    </header>
    {error?<div className="state-error" role="alert" tabIndex={-1} ref={errorPanel}><p>{error}</p><button disabled={busy} onClick={()=>void run(session?refresh:restore)}>다시 불러오기</button></div>:null}
    {busy?<p role="status">불러오는 중…</p>:notice?<p className="save-ok" role="status">{notice}</p>:null}
    {!session?(b1?<p>내 소속·호실을 확인하고 있어요.</p>:/* 213–217행 그대로: <form onSubmit=…>…</form> */):<>
      {tenant?<OutcomeRecoveryPanel client={client} onOpen={openOutcome}/>:null}
      <div className={tenant?styles.tenantWorkspace:styles.managerWorkspace} data-detail={Boolean(selected)} hidden={!workVisible}>
      {!tenant?<div className={styles.queuePane}><ManagerWorkQueue key={`${selected?.ticketId??"list"}-${selected?.version??0}`} client={client} units={units} tickets={tickets} revision={revision} disabled={busy} selectedId={selected?.ticketId} onOpen={openFromList}/></div>:null}
      {selected?/* 223–268행 그대로: <section className={styles.selectedPane} …>…</section> */:!tenant?null:<>
        {units.length!==1?<label>건물·호실 <select aria-label="건물·호실" disabled={!units.length||Boolean(followUp)} value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>:null}
        <div className={styles.tenantHome} hidden={tab!=="home"}>
          {followUp?<><FollowUpContext kind={followUp.claimKind}/><button disabled={busy||Boolean(followAttempt)} onClick={()=>openOutcome(followUp.sourceTicketId)}>원본 접수로 돌아가기</button></>:null}
          {!units.length?<p>접근 가능한 호실이 없어요. 관리자에게 소속·호실 배정을 확인한 뒤 새로고침을 눌러 주세요.</p>:null}
          {unit?<form onSubmit={e=>{e.preventDefault();submit();}}>
            <h2>어떤 문제가 있나요?</h2><fieldset disabled={Boolean(followAttempt)} className={styles.issueChoice}><legend>문제 유형</legend>{(["HEATING","LEAK"] as const).map(value=><label key={value} data-tile><input type="radio" name="issueType" value={value} checked={issue===value} onChange={e=>setIssue(e.target.value as "HEATING"|"LEAK")}/><span>{value==="HEATING"?"난방":"누수"}</span></label>)}</fieldset>
            <label>문제 설명 <textarea aria-label="문제 설명" readOnly={Boolean(followAttempt)} value={text} maxLength={2000} required onChange={e=>setText(e.target.value)} /></label>
            <PhotoPicker files={pending} onChange={setPending} disabled={busy||Boolean(followAttempt)} compact />
            <div className={styles.submitZone}><button className={styles.primary} disabled={busy||!text.trim()}>{followAttempt?"같은 후속 접수 다시 확인·전송":"접수하기"}</button></div>
          </form>:null}
        </div>
        <div className={styles.tenantRequests} hidden={tab!=="requests"}>
          <h2>최근 접수 <small>{tickets.filter(t=>t.unitId===unit).length}건</small></h2>
          {conversationSummaries.error?<p role="alert">대화 대기 상태를 확인하지 못했어요. 새로고침을 눌러 주세요.</p>:null}
          {tickets.filter(t=>t.unitId===unit).length===0?<p>{!unit?"호실 배정 후 접수 이력을 볼 수 있어요.":"선택한 호실의 접수 내역이 없어요. 우리 집에서 문제를 접수해 주세요."}</p>:<ul className={styles.ticketList}>{tickets.filter(t=>t.unitId===unit).map(t=><li key={t.ticketId} data-ticket-id={t.ticketId}><button data-open-ticket className={styles.ticketRow} disabled={busy||pending.length>0} onClick={()=>void run(async()=>{setSelected(await client.read(t.ticketId));setMessage("");})}><span className={styles.ticketTitle}>{t.detail.issueType==="HEATING"?"난방":"누수"}</span><span> · </span>{isIntakeDraft(t)?<DraftBadge/>:<WorkStatusBadge status={t.workStatus}/>}<CommunicationBadge summary={conversationSummaries.summaries[t.ticketId]} tenant/></button><PhotoGallery compact client={client} ticketId={t.ticketId} revision={revision} /></li>)}</ul>}
        </div>
      </>}
      </div>
      {navContext&&!selected&&!view&&tab==="alerts"?<div className={navStyles.pane}><TodoScreen role={session.role} list={todo} ready={conversationSummaries.ready} units={units} onOpen={openFromList} onRetry={()=>void run(refresh)}/></div>:null}
      {navContext&&!selected&&(tenant?tab==="me"&&!view:view==="me")?<div className={navStyles.pane}><MenuList label="내 정보" rows={meRows(navContext)} organization={account?.organization} onOpen={navigate} onLogout={logout}/></div>:null}
      {navContext&&!selected&&!tenant&&tab==="more"&&!view?<div className={navStyles.pane}><MenuList label="더 보기" rows={moreRows(navContext)} onOpen={navigate} onLogout={logout}/></div>:null}
      {!tenant&&!selected&&view==="maintenance"?<ManagerMaintenanceTimeline key={maintenanceUnit} client={client} units={units} revision={revision} disabled={busy} initialUnit={maintenanceUnit} onOpenTicket={openMaintenanceTicket}/>:null}
      {!selected&&view==="units"?<div className={navStyles.pane}><UnitsScreen units={units}/></div>:null}
      {!selected&&view==="licenses"?<div className={navStyles.pane}><OpenSourceNotice/></div>:null}
      {account?.linkPanel?<div hidden={Boolean(selected)||view!==(tenant?"link":"invitations")}>{account.linkPanel}</div>:null}
    </>}
    </Workspace>
    {b1?<footer className="core-environment"><EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않아요.</EnvironmentNote></footer>:null}
    </div>
  </div>;
```

바뀐 점(리뷰어가 대조할 것):
- 위쪽 `← 목록으로` 글자 버튼 → `BackButton`(이름 "뒤로"). 사용 가능 조건 `busy||pending.length>0`은 그대로다. 관리자 상세에서 뒤로 버튼이 `managerView==="WORK_QUEUE"`일 때만 있던 조건은 정비 이력이 행 화면이 되면서 필요 없어졌다.
- 개발 모드의 머리글 `로그아웃` 버튼은 '내 정보'로 옮겼다(`logout`).
- `관리자 보기` 전환(220행)을 지웠다. 정비 이력은 `view==="maintenance"`이다.
- 세입자 비어 있는 목록 문구의 "위의 문제 접수에서 첫 내용을 남겨 주세요."는 목록이 다른 탭으로 옮겨 "우리 집에서 문제를 접수해 주세요."로 바꿨다. 관리자 쪽 문구 갈래는 이 목록이 세입자 전용이라 지웠다.
- 연결 화면(`account.linkPanel`)은 지금처럼 늘 그려 두고 감춘다. 정비 이력은 지금처럼 열 때만 그린다. 나머지 목록 화면은 상태가 없어 열 때만 그린다.

- [ ] **Step 7: 형 검사와 단위 시험**

Run: `npm --workspace @build-manager/web run typecheck && npm --workspace @build-manager/web run lint && npm --workspace @build-manager/web run test`
Expected: 0 errors, 모든 시험 PASS. lint가 `react-hooks` 규칙(렌더 중 ref 읽기, effect 안 setState)으로 막으면 그 줄을 이벤트 처리기나 effect로 옮겨 고친다. 규칙을 끄지 않는다.

- [ ] **Step 8: 커밋한다**

```bash
git add apps/web/src/app/core/core-screen.tsx
git commit -m "feat(web): /core draws the P5 menu, tab screens, request history entry and to-do list

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 9: 로그인 화면, 연결 화면, 가입 화면 문구

**Files:**
- Modify: `apps/web/src/app/core/login-screen.tsx` (전체)
- Modify: `apps/web/src/app/core/onboarding-panel.tsx:23,47`
- Modify: `apps/web/src/app/core/join/join-screen.tsx` (#134 문구), 그 문구를 확인하는 시험
- Test: `apps/web/src/app/core/login-screen.test.tsx` (그대로 통과해야 함)

**Interfaces:**
- Consumes: `CoreAccount` (Task 8), `roleName` (Task 1).

- [ ] **Step 1: 로그인 화면을 바꾼다**

`apps/web/src/app/core/login-screen.tsx`에서:

1. `const orgRole=…`(10행)을 지우고 import에 `import { roleName } from "./nav/nav-config";`를 더한다. 파일 안의 `orgRole(`을 모두 `roleName(`으로 바꾼다.
2. `const [view,setView]=useState<"tickets"|"invitations">("tickets");`(17행)를 지운다.
3. `select` 함수의 첫 줄 `clearCommunicationRecovery();clearOutcomeRecovery();` 뒤에 더한다:

```ts
  // Another organisation may mean another role: start on that role's first tab, in place of this entry (rules 8.16).
  window.history.replaceState(null,"","/core");
```

4. `return` 위에 소속 칸과 지금 소속을 만든다(60행의 JSX를 옮긴 것):

```tsx
 const current=access?.organizations.find(o=>o.id===scope?.orgId);
 // One 내 소속 field: in the sign-in column before an organisation is chosen, and in 내 정보 after (rules 8.16).
 const organizationField=access?.organizations.length?<><label><span className="core-org-label">내 소속</span><span className="core-org-field"><select aria-label="내 소속" value={scope?.orgId??""} onChange={e=>void select(e.target.value)}><option value="">소속을 선택해 주세요</option>{access.organizations.map(o=><option key={o.id} value={o.id}>{o.name} · {roleName(o.role)}</option>)}</select>{/* The current choice wraps in a select-like box, so a long organisation name is never cut. */}<span className="core-org-current" aria-hidden="true">{current?`${current.name} · ${roleName(current.role)}`:"소속을 선택해 주세요"}</span></span></label>
  {access.organizations.length>1?<p>소속을 바꾸면 저장하지 않은 입력과 사진 선택은 초기화돼요. 저장된 접수·사진은 해당 소속의 이력에 남아요.</p>:null}</>:null;
```

5. `return`을 바꾼다. 위쪽 소속·로그아웃 막대와 `작업 이동` 메뉴는 소속을 고르기 전에만 그린다. 로그아웃 양식은 막대 밖으로 옮겨 늘 있게 한다.

```tsx
 return <div className="core-b1-shell" data-phase={phase} data-scoped={scope?"true":undefined}>
  {scope?null:<section className="page-shell core-flow core-account" aria-label="로그인과 내 소속">
   {/* 50–58행 그대로: 제목, 오류, 불러오는 중, 체험 시작, 로그인, 연결 다시 확인, 로그아웃 안내 */}
   {phase==="ready"&&access?<>
    {!access.organizations.length?<p>연결된 소속·호실이 없어요. 관리자에게 기존 계정의 소속·입주 연결을 확인해 주세요.</p>:organizationField}
    <button className="core-logout" onClick={logout}>로그아웃</button>
   </>:null}
  </section>}
  <form ref={logoutForm} action="/api/v2/session/logout" method="post" hidden><input type="hidden" name="csrf" value={logoutCsrf}/></form>
  <div className="core-workspace">
   {scope&&access&&current?<CoreFlowPage key={scope.orgId+scope.csrf} b1={scope} onDenied={scopedDenied} onLogout={logout} account={{caption:`${current.name} · ${roleName(current.role)}`,organization:organizationField,logout,
    // Building staff have no move-in screen (spec D10); the tenant's 호실 연결 and the admin's 입주 연결 share the panel.
    linkPanel:current.role==="PROPERTY_STAFF"?undefined:<OnboardingPanel key={"onboarding-"+scope.orgId+access.csrf} embedded csrf={access.csrf} orgId={scope.orgId} manager={current.role==="ORG_ADMIN"} onRefreshAccess={()=>void load()} onDenied={denied}/>}}/>:null}
   {!scope&&phase==="ready"&&access?<OnboardingPanel key={"onboarding-none"+access.csrf} csrf={access.csrf} manager={false} onRefreshAccess={()=>void load()} onDenied={denied}/>:null}
   {scope?null:<footer className="core-environment"><EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않아요.</EnvironmentNote></footer>}
  </div>
 </div>;
```

`{/* 50–58행 그대로 … */}` 자리에는 지금 파일 50–58행(`<h1>`부터 `phase==="logout"` 안내까지)을 글자 그대로 둔다.

- [ ] **Step 2: 연결 패널 제목을 행 이름에 맞춘다**

`apps/web/src/app/core/onboarding-panel.tsx`:
- 23행 함수 머리: `export function OnboardingPanel({csrf,orgId,manager,embedded=false,onRefreshAccess,onDenied}:{csrf:string;orgId?:string;manager:boolean;/** Inside the P5 menu the top bar already names the screen. */embedded?:boolean;onRefreshAccess:()=>void;onDenied:()=>void}){`
- 47행: `<header className={styles.heading}><h1>{manager?"입주 연결":"내 호실 연결 요청"}</h1>` → `<header className={styles.heading}>{embedded?null:<h1>{manager?"입주 연결":"호실 연결"}</h1>}`

- [ ] **Step 3: 가입 화면 안내를 새 메뉴 자리에 맞춘다**

Run: `git grep -n "입주 연결' 메뉴" -- apps`
Expected: `apps/web/src/app/core/join/join-screen.tsx`의 상수 `statusHint`(45행 근처, 위 주석도 '입주 연결'을 말함)와 `join-screen.test.tsx` 맨 위의 상수 `hint`(시험 4개가 씀). `core-login-e2e/design.spec.ts`는 이 문장을 확인하지 않는다(2-b6 확인).

`statusHint`의 "소속이 선택돼 있다면 '입주 연결' 메뉴 안에 있어요."를 "소속이 선택돼 있다면 '내 정보'의 '호실 연결'에 있어요."로, 위 주석의 '입주 연결' 메뉴 설명도 '내 정보 › 호실 연결'로 바꾼다. `join-screen.test.tsx`의 `hint`를 같은 글자로 바꾼다. 앞 문장("…'내 연결 요청'에서 상태를 확인할 수 있어요.")과 "소속이 선택돼 있다면" 조건은 둔다. 소속이 없는 세입자는 메뉴 없이 `/core`에서 바로 연결 패널(제목 "호실 연결", 소제목 "내 연결 요청")을 보기 때문이다. 2-b6가 이 문구를 이 PR에서 고치는 데 동의했다(2026-10-13).

- [ ] **Step 4: 단위 시험과 형 검사**

Run: `npm --workspace @build-manager/web run test -- src/app/core/login-screen.test.tsx src/app/core/onboarding-panel.test.tsx src/app/core/join && npm --workspace @build-manager/web run typecheck && npm --workspace @build-manager/web run lint`
Expected: PASS, 0 errors.

- [ ] **Step 5: 커밋한다**

```bash
git add apps/web/src/app/core/login-screen.tsx apps/web/src/app/core/onboarding-panel.tsx apps/web/src/app/core/join/join-screen.tsx apps/web/src/app/core/join/join-screen.test.tsx
git commit -m "feat(web): login hands 내 소속, move-in links and logout to the P5 menu

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 10: 옛 메뉴 스타일 정리와 40px 예외 삭제

**Files:**
- Modify: `apps/web/src/app/core/core-design.module.css`

- [ ] **Step 1: 지운다(main `7256df7` 줄 번호)**

- 53–55행: `.core-account nav`, `.core-account nav a`, `.core-account nav a:hover`.
- 158–160행: `.core-account nav`, `nav a`, `nav a[aria-current="page"]`.
- 232–238행 블록 안의 234행(`.core-account nav`)과 235–236행(주석과 `nav a`).
- 296행: `.root :global(.core-account nav) { display: grid; }`.
- 318–320행: 주석 두 줄과 `.root :global(.core-account nav) { min-height: 0; }`.
- 322–326행: 40px 예외 주석과 `@media (max-width: 767px)` 블록 전체.
- 342–347행: `관리자 보기` 전환 스타일(`.core-view-switch` 다섯 줄과 주석).

- [ ] **Step 2: 바꾼다**

- 237행 `.root :global(.core-org-label) { position: absolute; … }` → `.root :global(.core-account .core-org-label) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }` (좁은 위쪽 막대에서만 숨기고, 내 정보에서는 보인다).
- 366–369행: 선택자 앞의 `.core-account `를 지운다. 예: `.root :global(.core-account .core-org-field)` → `.root :global(.core-org-field)`. 네 줄 모두.
- 146행 `.root .heading { min-height: 3.75rem; …}`의 `3.75rem` → `3.5rem` (상단 바 56px, 규칙 8.10).
- 201–203행:

```css
.root .tenantHome > form { margin-top: 0; gap: 1.25rem; }
.root .tenantRequests > h2 { display: flex; justify-content: space-between; align-items: center; gap: .625rem; }
.root .tenantRequests > h2 small { color: var(--color-text-readable); font-weight: 400; }
.tenantHome > * + *, .tenantRequests > * + * { margin-top: 1.25rem; }
```

- [ ] **Step 3: 더한다(파일 끝)**

```css
/* P5: after an organisation is chosen the menu replaces the account column (spec §2). */
.root :global(.core-b1-shell[data-scoped="true"]) { grid-template-columns: minmax(0,1fr); }
/* A sub-screen's top bar title is a subheading (rules 8.10); first screens keep their page title. */
.root .heading[data-sub="true"] h1 { font-size: .9375rem; line-height: 1.5625rem; font-weight: 600; letter-spacing: -0.01em; }
```

- [ ] **Step 4: 남은 참조가 없는지 확인한다**

Run: `git grep -n "core-view-switch\|core-account nav\|min-height: 2\.5rem" -- apps/web/src/app/core/core-design.module.css`
Expected: 결과 없음.

- [ ] **Step 5: 커밋한다**

```bash
git add apps/web/src/app/core/core-design.module.css
git commit -m "style(web): drop the old /core top menu, its 40px phone exception and the view switch

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

- [ ] **Step 6: 새 메뉴 시험이 통과하는지 본다**

Run: `npm run test:e2e:sdk -- navigation.spec.ts` 그리고 `npm run test:e2e:core -- navigation.spec.ts`
Expected: PASS. 실패하면 화면 코드를 고친다(시험의 기대값을 낮추지 않는다).

---

### Task 11: 기존 화면 시험을 새 메뉴에 맞춘다

**Files:** 아래 표. 도우미 import는 `core-e2e`에서 `./presentation`, `core-login-e2e`·`vendor-e2e`에서 `../core-e2e/presentation`이다.

공통 규칙
- R1 개발 모드 로그인 확인 `await expect(<page>.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();` → `await expectSignedIn(<page>);` (core.spec 8, maintenance-fact 21, manager-next-step 10·140, manager-work 10, photo-evidence 11, photos 10, ticket-communication 21, ticket-outcome 29, usability 16).
- R2 `"← 목록으로"` → `"뒤로"` (core-e2e design 75·78, manager-next-step 138, manager-work 60·85, ticket-communication 46, usability 97, core-login-e2e spatial 63).

| 파일:행 | 지금 | 바꿀 것 |
| --- | --- | --- |
| core-e2e/core.spec.ts:19 | `await page.reload();await page.locator(\`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]\`).click();` | `await page.reload();await openTicketRow(page,ticket.ticketId);` |
| core-e2e/core.spec.ts:61 | `await row.locator("[data-open-ticket]").click();` | `await openTicketRow(page,t.ticketId);` |
| core-e2e/core.spec.ts:85 | `await login(page,"tenantOther");await expect(page.getByRole("heading",{name:/^최근 접수/})).toBeVisible();` | `await login(page,"tenantOther");await openTab(page,"내 요청");await expect(page.getByRole("heading",{name:/^최근 접수/})).toBeVisible();` |
| core-e2e/maintenance-fact.spec.ts:46 | `await page.getByRole("navigation",{name:"관리자 보기"}).getByRole("button",{name:"호실 정비 이력",exact:true}).click();` (두 번) | `await openMoreRow(page,"호실 정비 이력");` (두 번) |
| core-e2e/manager-work.spec.ts:78 | `await tenant.locator(\`[data-ticket-id="${tickets[0]}"] [data-open-ticket]\`).click();` | `await openTicketRow(tenant,tickets[0]);` |
| core-e2e/usability.spec.ts:118 | `await expect(page.getByText("선택한 호실의 접수 내역이 없어요. 위의 문제 접수에서 첫 내용을 남겨 주세요.",{exact:true})).toBeVisible();` | `await openTab(page,"내 요청");await expect(page.getByText("선택한 호실의 접수 내역이 없어요. 우리 집에서 문제를 접수해 주세요.",{exact:true})).toBeVisible();` |
| core-e2e/photos.spec.ts:31 | `try{await login(reconnected);const row=` | `try{await login(reconnected);await openTab(reconnected,"내 요청");const row=` |
| core-e2e/ticket-communication.spec.ts:22 | `open()` 안의 `await page.locator(\`[data-ticket-id="${id}"] [data-open-ticket]\`).click();` | `await openTicketRow(page,id);` |
| core-e2e/ticket-outcome.spec.ts:30 | `open()` 안의 같은 줄 | `await openTicketRow(page,id);` |
| core-login-e2e/design.spec.ts:32–34 | `account` 영역 너비 248·배경 `rgb(242, 242, 247)` 검사 세 줄 | `const menu=page.getByRole("navigation",{name:"주 메뉴"});` / `if(viewport.width>=768)expect((await menu.boundingBox())!.width).toBe(248);else expect(Math.round((await menu.boundingBox())!.height)).toBe(56);` / `await expect(menu).toHaveCSS("background-color","rgb(255, 255, 255)");` |
| core-login-e2e/design.spec.ts:53 | `const account=page.getByRole("region",{name:"로그인과 내 소속"}).getByRole("combobox");` | `await openAccount(page);const account=page.getByRole("region",{name:"내 정보"}).getByRole("combobox",{name:"내 소속"});` |
| core-login-e2e/design.spec.ts:58 | `const currentOrg=page.getByRole("region",{name:"로그인과 내 소속"}).locator(".core-org-current");` | `const currentOrg=page.getByRole("region",{name:"내 정보"}).locator(".core-org-current");` |
| core-login-e2e/design.spec.ts:61 | `await page.getByLabel("문제 설명").fill("합성 디자인 상태 구분 검사");` | `await openTab(page,"우리 집");await page.getByLabel("문제 설명").fill("합성 디자인 상태 구분 검사");` |
| core-login-e2e/design.spec.ts:63 | `await expect(page.getByRole("region",{name:"로그인과 내 소속"})).not.toContainText(/B1\|RC1 합성 주거 데이터/);` | `await expect(page.getByRole("navigation",{name:"주 메뉴"})).not.toContainText(/B1\|RC1 합성 주거 데이터/);` |
| core-login-e2e/design.spec.ts:114 | `await page.getByRole("link",{name:"입주 연결",exact:true}).click();` | `await openMoreRow(page,"입주 연결");` |
| core-login-e2e/login.spec.ts:11–23 | `layout()`의 로그아웃 개수, `로그인과 내 소속` 상자 비교 | 아래 "login.spec layout" 코드 |
| core-login-e2e/login.spec.ts:42–43 | `const accountBox=…로그인과 내 소속…; if(width<1024)…else expect(accountBox.width).toBe(248);` | `const menuBox=(await page.getByRole("navigation",{name:"주 메뉴"}).boundingBox())!;if(width<768)expect(Math.round(menuBox.height)).toBe(56);else expect(menuBox.width).toBe(248);` |
| core-login-e2e/login.spec.ts:60 | `await page.reload();await page.locator(\`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]\`).click();` | `await page.reload();await openTicketRow(page,ticket.ticketId);` |
| core-login-e2e/login.spec.ts:63 | `const ending=page.waitForResponse(r=>r.url().endsWith("/api/v2/session/logout"));await page.getByRole("button",{name:"로그아웃",exact:true}).click();` | `await page.goto("/core?tab=me");const ending=page.waitForResponse(r=>r.url().endsWith("/api/v2/session/logout"));await page.getByRole("button",{name:"로그아웃",exact:true}).click();` |
| core-login-e2e/maintenance-fact.spec.ts:51 | `await expect(page.getByRole("navigation",{name:"관리자 보기"})).toHaveCount(0);` | `await expect(page.getByRole("navigation",{name:"주 메뉴"}).getByRole("link",{name:"호실 정비 이력"})).toHaveCount(0);` |
| core-login-e2e/manager-work.spec.ts:14 | `const org=page.getByLabel("내 소속",{exact:true});await expect(org).toBeVisible();await org.selectOption(manager.fixture.orgA);` | `await expectSignedIn(page);` (관리자 계정은 소속이 하나라 자동으로 고른다. 소속 칸은 이제 내 정보에 있다) |
| core-login-e2e/onboarding.spec.ts:19 | `await page.getByRole("link",{name:"입주 연결",exact:true}).click();` | `await openMoreRow(page,"입주 연결");` |
| core-login-e2e/onboarding.spec.ts:46 | `await f.page.getByRole("link",{name:"업무함",exact:true}).click();` | `await openTab(f.page,"업무함");` |
| core-login-e2e/onboarding.spec.ts:47 | `await tenant.reload();await tenant.locator(\`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]\`).click();` | `await tenant.reload();await openTicketRow(tenant,ticket.ticketId);` |
| core-login-e2e/responsive-polish.spec.ts:8–33 | 첫 시험(위쪽 막대) 전체 | 아래 "responsive-polish 첫 시험" 코드 |
| core-login-e2e/responsive-polish.spec.ts:74–76 | `recent` 제목 위치 비교 | `recent` 변수와 `c`, `expect(b.y + b.height).toBeLessThan(c.y);`를 지운다(최근 접수는 이제 내 요청 탭) |
| core-login-e2e/spatial.spec.ts:19 | `await t.locator(\`[data-ticket-id="${id}"] [data-open-ticket]\`).click();` | `await openTicketRow(t,id);` |
| core-login-e2e/spatial.spec.ts:58–59 | `입주 연결` 링크와 `접수` 링크로 오가며 초안 유지 확인 | 아래 "spatial 초안 유지" 코드 |
| core-login-e2e/ticket-communication.spec.ts:22 | `await page.locator(\`[data-ticket-id="${id}"] [data-open-ticket]\`).click();` | `await openTicketRow(page,id);` |
| core-login-e2e/ticket-communication.spec.ts:31 | `await expect(page.getByLabel("내 소속",{exact:true})).toBeVisible();` | `await openAccount(page);await expect(page.getByLabel("내 소속",{exact:true})).toBeVisible();` |
| core-login-e2e/ticket-communication.spec.ts:39 | `await page.getByRole("button",{name:"로그아웃",exact:true}).click();` | `await openAccount(page);await page.getByRole("button",{name:"로그아웃",exact:true}).click();` |
| core-login-e2e/ticket-outcome.spec.ts:14 | `await page.locator(\`[data-ticket-id="${id}"] [data-open-ticket]\`).click();` | `await openTicketRow(page,id);` |
| core-login-e2e/ticket-outcome.spec.ts:32 | `…selectOption(unit);await oldPage.locator(\`[data-ticket-id="${source}"] [data-open-ticket]\`).click();` | `…selectOption(unit);await openTicketRow(oldPage,source);` |
| core-login-e2e/ticket-outcome.spec.ts:39 | `…selectOption(unit);await expect(page.locator(…)).toHaveCount(0);await expect(page.getByText("선택한 호실의 접수 내역이 없어요. 위의 문제 접수에서 첫 내용을 남겨 주세요.",{exact:true})).toBeVisible();` | `…selectOption(unit);await expect(page.locator(…)).toHaveCount(0);await openTab(page,"내 요청");await expect(page.getByText("선택한 호실의 접수 내역이 없어요. 우리 집에서 문제를 접수해 주세요.",{exact:true})).toBeVisible();await openTab(page,"우리 집");` (`…`는 지금 줄 그대로) |
| core-login-e2e/vendor-handoff.spec.ts:13 | `await page.getByLabel('내 소속', { exact: true }).selectOption(manager.fixture.orgA);` | `await expectSignedIn(page);` |
| vendor-e2e/harness.ts:71 | `await page.locator(\`[data-ticket-id="${id}"] [data-open-ticket]\`).click();` | `await openTicketRow(page, id);` |
| vendor-e2e/demo-entry.spec.ts:24 | `await manager.getByRole('button', { name: '로그아웃', exact: true }).click();` | `await openAccount(manager); await manager.getByRole('button', { name: '로그아웃', exact: true }).click();` |

ticket-communication.spec.ts:35의 `selectOption("")`은 31행에서 연 내 정보의 소속 칸을 비운다. 그러면 소속 고르기 전 화면이 나오고, 같은 줄의 `selectOption(manager.fixture.orgA)`가 그 화면의 칸을 고른다. 그대로 둔다.

- [ ] **Step 1: login.spec layout을 바꾼다**

`apps/web/tests/core-login-e2e/login.spec.ts`의 `layout()` 첫 줄부터 `}else{ … }` 블록 끝까지(11–23행)를 바꾼다:

```ts
 await expect(page.locator("main main")).toHaveCount(0);
 const menu=page.getByRole("navigation",{name:"주 메뉴"}),workspace=await page.getByRole("region",{name:"수리 접수 작업",exact:true}).boundingBox();
 expect(workspace).not.toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width>=768){
  // P5: the 248px left menu sits beside the work area (rules 8.10).
  const box=(await menu.boundingBox())!;
  expect(box.width).toBe(248);expect(box.x+box.width).toBeLessThanOrEqual(workspace!.x);
  expect(workspace!.width).toBeGreaterThan(width*.6);
 }else{
  // Phones: the work area is full width; a request screen hides the tab bar (rules 8.14).
  expect(workspace!.width).toBeGreaterThan(width*.9);
 }
```

- [ ] **Step 2: responsive-polish 첫 시험을 바꾼다**

`apps/web/tests/core-login-e2e/responsive-polish.spec.ts` 8–33행을 바꾼다:

```ts
test("compact tab bar keeps the four tenant tabs in keyboard order at 320 and 390", async ({ browser }) => {
  const tenant = await sdkSession(browser);
  try {
    const page = await tenant.context.newPage(); await page.goto("/core");
    const nav = page.getByRole("navigation", { name: "주 메뉴", exact: true });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 }); await fits(page);
      const links = nav.getByRole("link"); await expect(links).toHaveText(["우리 집", "내 요청", /^알림/, "내 정보"]);
      const boxes = await links.evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ x: r.x, width: r.width, height: r.height })));
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
      for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(50); expect(Math.round(box.height)).toBe(56); }
      await nav.getByRole("link", { name: "우리 집", exact: true }).focus();
      for (const name of ["내 요청", /^알림/, "내 정보"]) { await page.keyboard.press("Tab"); await expect(nav.getByRole("link", { name })).toBeFocused(); }
      await page.keyboard.press("Enter"); await expect(page.getByRole("heading", { level: 1, name: "내 정보" })).toBeVisible();
      await page.getByRole("region", { name: "내 정보", exact: true }).getByRole("link", { name: "호실 연결", exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: "호실 연결" })).toBeVisible();
      await page.getByRole("button", { name: "뒤로", exact: true }).click();
      await nav.getByRole("link", { name: "우리 집", exact: true }).click(); await expect(nav.getByRole("link", { name: "우리 집", exact: true })).toHaveAttribute("aria-current", "page");
    }
  } finally { await tenant.close(); }
});
```

- [ ] **Step 3: spatial 초안 유지를 바꾼다**

`apps/web/tests/core-login-e2e/spatial.spec.ts` 58–59행을 바꾼다:

```ts
    await page.getByLabel("문제 설명").fill("화면 이동에도 남을 합성 입력");await openTab(page,"내 정보");
    await page.getByRole("region",{name:"내 정보",exact:true}).getByRole("link",{name:"호실 연결",exact:true}).click();await expect(page.getByRole("heading",{level:1,name:"호실 연결"})).toBeVisible();
    await page.getByRole("button",{name:"뒤로",exact:true}).click();await openTab(page,"우리 집");await expect(page.getByLabel("문제 설명")).toHaveValue("화면 이동에도 남을 합성 입력");
```

- [ ] **Step 4: 표의 나머지를 바꾸고 import를 더한다**

각 파일에서 쓰는 도우미만 import한다. `core-e2e` 파일의 기존 `import { openInspector } from "./presentation";` 같은 줄에 이름을 더한다.

- [ ] **Step 5: 남은 옛 참조가 없는지 확인한다**

Run: `git grep -n "← 목록으로\|작업 이동\|관리자 보기\|로그인과 내 소속\|내 호실 연결 요청\|위의 문제 접수에서" -- apps/web/tests scripts`
Expected: 결과 없음. 단, `core-login-e2e/design.spec.ts`·`login.spec.ts`의 소속 고르기 전 화면(`로그인과 내 소속` 영역이 그대로 있는 화면) 시험이 남아 있으면 그 줄은 둔다.

- [ ] **Step 6: 화면 시험 전체를 돌린다**

Run(하나씩, 단위 시험과 동시에 돌리지 않는다): `npm run test:e2e:core`, `npm run test:e2e:sdk`, `npm run test:e2e:vendor`
Expected: PASS. 알려진 로컬 실패: 공유 시험 데이터의 시험 조직 호실이 214개라 호실 목록 한도(200)를 넘어 `core-login-e2e/design.spec.ts:47`과 `login.spec.ts:35`가 로컬에서만 시간 초과로 실패한다(2-b6 확인, 새 DB를 쓰는 CI는 통과). 이 두 곳이 그 이유로만 실패하면 실행 기록에 적고 넘어간다. 그 밖의 실패는 화면 코드를 고친다. 한 번 실패한 시험은 1회만 다시 돌리고 그 사실을 PR에 적는다(DEV-06).

- [ ] **Step 7: 커밋한다**

```bash
git add apps/web/tests/core-e2e apps/web/tests/core-login-e2e apps/web/tests/vendor-e2e/harness.ts apps/web/tests/vendor-e2e/demo-entry.spec.ts
git commit -m "test(web): follow the P5 menu in the existing browser tests

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

`git add`에 디렉터리를 쓰기 전에 `git status --short apps/web/tests`로 이 Task에서 고친 파일만 있는지 확인한다.

---

### Task 12: 디자인 점검과 데모 점검 스크립트

**Files:**
- Modify: `scripts/design-audit.mjs:108-113,155-157,251-270`
- Modify: `scripts/demo-smoke.mjs:171-173`

- [ ] **Step 1: 40px 예외를 지운다**

`scripts/design-audit.mjs` 108–113행(주석 두 줄, `phoneMenu`, 반복문)을 바꾼다:

```js
  for (const el of taps) {
    const r = el.getBoundingClientRect();
    if (r.width < 49.5 || r.height < 49.5) result.push({ check: "tap", where: label(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}px, needs 50x50` });
  }
```

- [ ] **Step 2: 왼쪽부터 읽는 줄에 새 메뉴를 넣는다**

155–157행의 주석과 `leftStart`를 바꾼다:

```js
  // Rows read from the left compare only top and bottom: summary rows, list rows that open a request or a to-do, menu
  // list rows (rules §8.5), checkbox and radio rows (§8.4), the sign-in column's logout once it sticks to the side, and
  // the P5 left menu (sticky from 768px; the phone tab bar is fixed and stays centred). A selection tile (§8.3) is
  // marked data-tile and is centred both ways like a button.
  const mainMenu = el => el.closest('nav[aria-label="주 메뉴"]');
  const leftStart = el => el.matches("summary, [data-open-ticket], [data-todo-ticket], [data-menu-row], .field-check label, label:has(input[type=checkbox], input[type=radio]):not([data-tile])")
    || (el.matches(".core-account .core-logout") && getComputedStyle(el.closest(".core-account")).position === "sticky")
    || (mainMenu(el) !== null && getComputedStyle(mainMenu(el)).position === "sticky");
```

- [ ] **Step 3: 화면을 더한다**

251–270행(데이터가 있는 화면 반복)에서 세입자 요청 열기를 내 요청 탭으로 옮기고, 탭과 행 화면을 더한다. `for (const width of widths) {` 블록 안을 이렇게 바꾼다:

```js
      const t = await page(width, "tenant"); await audit(t, `${engine}-${width}-tenant-intake`);
      // P5: the tenant's request list lives under 내 요청.
      await t.goto(origin + "/core?tab=requests"); await t.getByRole("heading", { name: /^최근 접수/ }).waitFor({ timeout: 20000 }); await audit(t, `${engine}-${width}-tenant-requests`);
      const open = t.locator(baseTicket ? `[data-ticket-id="${baseTicket}"] [data-open-ticket]` : "[data-open-ticket]").first();
      if (await open.count()) { await open.click(); await audit(t, `${engine}-${width}-tenant-ticket`); } else missing(`${engine}-${width}-tenant-ticket`, "no ticket row to open");
      for (const [query, name, heading] of [["?tab=alerts", "tenant-alerts", "알림"], ["?tab=me", "tenant-me", "내 정보"], ["?tab=me&view=units", "tenant-units", "내 호실"], ["?tab=me&view=link", "tenant-link", "호실 연결"], ["?tab=me&view=licenses", "tenant-licenses", "오픈소스 라이선스"]]) {
        await t.goto(origin + "/core" + query); await t.getByRole("heading", { level: 1, name: heading, exact: true }).waitFor({ timeout: 20000 });
        if (name === "tenant-alerts") await t.getByRole("region", { name: "처리할 일", exact: true }).waitFor({ timeout: 20000 });
        if (name === "tenant-link") await t.getByRole("button", { name: "연결 상태 새로고침", exact: true }).waitFor({ timeout: 20000 });
        await audit(t, `${engine}-${width}-${name}`);
      }
      await t.context().close();
      if (evidenceTicket) {
        const e = await page(width, "tenant");
        try {
          await e.goto(origin + "/core?tab=requests");
          await e.locator(`[data-ticket-id="${evidenceTicket}"] [data-open-ticket]`).click({ timeout: 20000 });
          await e.getByRole("radio", { name: "사진 1", exact: true }).waitFor({ timeout: 20000 });
          await audit(e, `${engine}-${width}-tenant-evidence`);
        } catch { missing(`${engine}-${width}-tenant-evidence`, "the evidence step with its photo tile did not show"); }
        await e.context().close();
      }
      const m = await page(width, "manager");
      const row = m.locator("[data-open-ticket]").first();
      try { await row.waitFor({ timeout: 20000 }); } catch { /* reported below */ }
      await audit(m, `${engine}-${width}-manager-queue`);
      await m.getByRole("combobox", { name: "긴급도 필터" }).selectOption("URGENT");
      try { await m.getByText("선택한 조건의 업무가 없어요", { exact: false }).waitFor({ timeout: 10000 }); await audit(m, `${engine}-${width}-manager-filter-empty`); }
      catch { missing(`${engine}-${width}-manager-filter-empty`, "the no-result filter message did not appear"); }
      await m.getByRole("combobox", { name: "긴급도 필터" }).selectOption("ALL");
      if (await row.count()) { await row.click(); await audit(m, `${engine}-${width}-manager-detail`); } else missing(`${engine}-${width}-manager-detail`, "no ticket row to open");
      for (const [query, name, heading] of [["?tab=alerts", "manager-alerts", "알림"], ["?tab=more", "manager-more", "더 보기"], ["?tab=more&view=maintenance", "manager-maintenance", "호실 정비 이력"], ["?tab=more&view=invitations", "manager-onboarding", "입주 연결"], ["?tab=more&view=me", "manager-me", "내 정보"], ["?tab=more&view=licenses", "manager-licenses", "오픈소스 라이선스"]]) {
        await m.goto(origin + "/core" + query); await m.getByRole("heading", { level: 1, name: heading, exact: true }).waitFor({ timeout: 20000 });
        if (name === "manager-alerts") await m.getByRole("region", { name: "처리할 일", exact: true }).waitFor({ timeout: 20000 });
        if (name === "manager-onboarding") await m.getByRole("button", { name: "연결 상태 새로고침", exact: true }).waitFor({ timeout: 20000 });
        await audit(m, `${engine}-${width}-${name}`);
      }
      await m.context().close();
```

체험 관리자가 조직 관리자가 아니면 `manager-onboarding`의 제목 대기가 실패한다. 그때는 `missing(...)`로 보고하는 `try/catch`로 감싸고 이유를 실행 기록에 적는다.

- [ ] **Step 4: 데모 점검의 로그아웃 정리를 바꾼다**

`scripts/demo-smoke.mjs` 171–173행(주석과 `signOut` 두 줄)을 바꾼다:

```js
      // Leave no demo session behind. Since P5 the logout button sits in 내 정보, so submit the page's own logout form
      // (the button does the same); the entry-only step never signed in and has no token, so nothing is sent.
      const signOut = page.locator('form[action="/api/v2/session/logout"]');
      const token = await signOut.locator('input[name="csrf"]').inputValue({ timeout: 1_000 }).catch(() => "");
      if (token) await Promise.all([page.waitForResponse((response) => response.url().endsWith("/api/v2/session/logout"), { timeout: 5_000 }).catch(() => {}), signOut.evaluate((form) => form.submit()).catch(() => {})]);
```

- [ ] **Step 5: 점검을 돌린다**

Run: `node --experimental-transform-types scripts/design-audit.mjs "$HOME/.build-manager-rc1-private/p5-after"` 그리고 `npx vitest run --config vitest.shared.config.ts tests/architecture/demo-smoke.test.ts`
Expected: `DESIGN_AUDIT | N screens | 0 findings`, 시험 PASS. 발견이 있으면 화면 CSS를 고친다. 오탐이면 이유를 PR에 적는다(규칙 15절).

Task 0에서 찍은 `p5-before`와 같은 조건(390px WebKit, 390px 글자 200%의 첫 화면과 상세)으로 다시 찍어 비교한다. 320px 글자 200%에서 "우리 집" 라벨이 칸을 넘으면 Task 14 보고에 넣어 운영자에게 묻는다(스펙 남은 위험).

- [ ] **Step 6: 커밋한다**

```bash
git add scripts/design-audit.mjs scripts/demo-smoke.mjs
git commit -m "chore(scripts): audit the P5 menu screens and drop the 40px phone menu exception

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 13: 디자인 규칙과 스펙을 맞춘다

**Files:**
- Modify: `design/DESIGN_RULES.md` (맨 위 [DECISION], 8.13 표, 8.14, 16절)
- Modify: `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`

- [ ] **Step 1: 규칙을 읽고 고친다**

`design/DESIGN_RULES.md`를 처음부터 끝까지 다시 읽은 뒤(규칙 17절, 훅) 고친다.

1. 맨 위 2026-10-12 [DECISION] 줄(휴대폰 메뉴 링크 40px)을 지우고, 그 자리에 둔다:

```markdown
- [DECISION] 2026-10-13 운영자 결정(P5 메뉴): 웹 `/core`의 1차 메뉴는 세입자 '우리 집 · 내 요청 · 알림 · 내 정보', 관리자(조직 관리자·건물 담당자) '업무함 · 알림 · 더 보기'입니다(탭 구성은 2026-10-10 메뉴 점검 결정). 관리자 '더 보기'는 '호실 정비 이력 · 입주 연결 · 건물·호실 관리 · 내 정보' 순이고, 768px 이상 왼쪽 메뉴에 펼칠 때 아이콘은 `file-text` · `key` · `layout-grid`입니다(운영자 선택 "문서 · 열쇠 · 네 칸"). 하단 탭바가 들어와 2026-10-12의 휴대폰 메뉴 링크 40px 예외는 끝났습니다. 근거는 [P5 설계](../docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md)에 있습니다.
```

2. 8.13 아이콘 표의 `| 설정 | settings | 있음 |` 아래에 세 줄을 더한다:

```markdown
| 호실 정비 이력 | `file-text` | 있음 |
| 입주 연결 | `key` | 있음 |
| 건물·호실 관리 | `layout-grid` | 있음 |
```

3. 8.14의 "같은 역할이면 앱 탭바, …" 줄 아래에 더한다:

```markdown
- 역할별 탭(2026-10-13, P5)
  - 세입자: 우리 집(`home`) · 내 요청(`clipboard-list`) · 알림(`bell`) · 내 정보(`user`).
  - 조직 관리자·건물 담당자: 업무함(`clipboard-list`) · 알림(`bell`) · 더 보기(`dots`). '더 보기'에는 그 역할에 권한이 있는 행만 둡니다.
  - '알림'의 배지는 처리할 일 건수입니다(8.15).
```

4. 16절 '내비게이션' 항목(현재 네 줄)을 바꾼다:

```markdown
- 내비게이션
  - 웹 `/core`는 2026-10-13에 하단 탭바(767px 이하)와 왼쪽 메뉴(768px 이상, 248px)로 옮겼습니다(P5). 아이콘은 쓰는 것만 Tabler 3.49.0에서 코드로 옮겨 씁니다(패키지 없음, SPDX 표시, 라이선스 화면 '내 정보 › 오픈소스 라이선스').
  - 남은 것: 모바일 앱의 하단 탭바(앱 v2), `/workspace` 화면(옛 디자인), 도움말·문의·약관·알림 설정 행(내용이 생긴 뒤).
```

5. 16절 '`/core`에 남은 것'의 "768~1023px의 왼쪽 메뉴는 위 내비게이션 항목과 함께 만듭니다."를 "768~1023px의 왼쪽 메뉴도 2026-10-13에 옮겼습니다(P5)."로 바꾼다.

- [ ] **Step 2: 스펙에 계획 중 확인한 사실을 반영한다**

`docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`:

- 1절 '더 보기' 표의 입주 연결 행 '보이는 역할'을 "`ORG_ADMIN`, B1 모드"로 바꾼다(연결 화면은 로그인 흐름에만 있다).
- 1절 `/workspace` 줄의 "PR 1에서 체험 세션으로 열리는지 확인한다. … PR에 이유를 적는다."를 "체험 세션도 로그인 흐름과 같은 세션이라(`apps/web/src/server/b1/demo-entry.ts`) 열린다. 화면 시험이 링크 이동을 확인한다."로 바꾼다.
- 3절 소속 전환 줄을 "주소는 `replaceState`로 `/core`로 바꿔 새 역할의 첫 탭에서 시작한다. 그 앞의 기록은 남지만, 열면 새 소속의 화면이다."로 바꾼다.
- 4절 우리 집 1번을 "결과 확인 이어하기 안내(지금의 `OutcomeRecoveryPanel`). 지금처럼 세입자 화면 맨 위에 둔다."로 바꾼다.
- 6절 첫 줄을 "우리 집 접수 칸, 내 요청 목록, 업무함은 늘 그려 두고 `hidden`으로 감춘다. 그래서 탭을 옮겨도 쓴 글과 고른 사진이 남는다. 연결 화면도 지금처럼 늘 그려 둔다. 정비 이력은 지금처럼 열 때만 그리고, 상태가 없는 목록 화면(알림, 내 정보, 더 보기, 내 호실, 라이선스)도 열 때만 그린다."로 바꾼다.
- '남은 위험'의 '관리자 대화 요약' 항목을 "관리자 대화 요약: 업무함이 이미 같은 요약을 읽는다(`manager-work.tsx`의 `useCommunicationSummaries`). 확인됨."으로 바꾼다.
- '범위' 절 첫 문단 끝에 "구현 계획(`docs/superpowers/plans/2026-10-13-navigation-shell-p5-skeleton.md`)은 PR 1a를 다시 '메뉴 부품'과 '메뉴 붙이기'로 나눈다."를 더한다.

- [ ] **Step 3: 커밋한다**

```bash
git add design/DESIGN_RULES.md docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md
git commit -m "docs(design): P5 role tabs, menu icons and the end of the 40px phone exception

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 14: 전체 검사, 망가뜨려 보기, 리뷰, 기록, 병합

**Files:**
- Create: `ops/navigation_shell_p5_20261013_acceptance.md`
- Modify: `ops/AI_Execution_Log.csv` (행 추가만)

- [ ] **Step 1: 전체 검사(DEV-06, DEV-04 4단계)**

하나씩 돌리고 종료 코드와 결과 문구를 적는다. 파이프로 가리지 않는다.

```bash
python scripts/verify_repository.py --history
npm run test:shared
npm run test:web
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run test:postgres
npm run test:e2e:core
npm run test:e2e:sdk
npm run test:e2e:vendor
PYTHONPATH="$PWD" python tests/test_verify_repository.py
PYTHONPATH="$PWD" python scripts/tests/test_verify_repository.py
node --experimental-transform-types scripts/design-audit.mjs "$HOME/.build-manager-rc1-private/p5-after"
```

Expected: 모두 통과. Task 11 Step 6의 알려진 로컬 실패 두 곳만 예외로 적는다.

- [ ] **Step 2: 일부러 망가뜨려 시험이 잡는지 본다**

하나씩 바꾸고, 그 시험이 실패하는지 보고, `git checkout -- <파일>`로 되돌린다.

| 망가뜨리기 | 잡아야 하는 시험 |
| --- | --- |
| `core-nav.tsx`에서 `aria-current={current ? "page" : undefined}`를 `aria-current={undefined}`로 | `core-nav.test.tsx` "marks only the current place" |
| `todo-list.ts`의 `reasonsFor`에서 `if (waiting === "TENANT") reasons.push("REPLY");`를 `if (waiting !== "MANAGER") reasons.push("REPLY");`로(확인 안 된 답변을 셈) | `todo-list.test.ts` "marks the list partial …" |
| `todo-list.ts` 정렬의 `group(a) - group(b)`를 `group(b) - group(a)`로 | `todo-list.test.ts` "sorts urgent first …" |
| `nav-location.ts`에서 `navTabs(ctx.role)`를 `[...navTabs("TENANT"), ...navTabs("ORG_ADMIN")]`로(다른 역할 탭 허용) | `nav-location.test.ts` "falls back …" |

결과 표를 PR 본문에 넣는다.

- [ ] **Step 3: 새 문맥 독립 리뷰(DEV-04 5단계)**

리뷰 에이전트(새 문맥)에 스펙, 이 계획, `git diff origin/main...HEAD`를 주고 보안(주소·권한·기록 상태), 규칙 8.10·8.13–8.16·12 준수, 접근성, 회귀(FROZEN 화면 시험 변경 이유), 해요체를 보게 한다. 지적은 고치고, 고친 부분만 다시 리뷰받는다(delta).

- [ ] **Step 4: 수락 기록(DEV-04 6단계)**

`ops/intake_photo_evidence_p1b_server_20261011_acceptance.md`의 구성을 따라 `ops/navigation_shell_p5_20261013_acceptance.md`를 쓴다: 대상 커밋(`TARGET_REF`), 정책 커밋(`POLICY_REF`, main의 규칙 커밋), 운영자 승인(2026-10-13 스펙 승인, D9), FROZEN 화면을 바꾼 범위와 이유, 실행한 검사와 결과(Step 1), 망가뜨려 보기(Step 2), 리뷰 결과(Step 3), 알려진 로컬 실패, 데모 배포 안 함. `ops/AI_Execution_Log.csv`에는 Edit 도구로 행만 더한다(기존 행을 다시 쓰지 않는다. 시각은 UTC `+00:00`).

- [ ] **Step 5: PR을 연다**

```bash
git push -u origin feat/navigation-shell-p5
gh pr create --base main --title "feat(web): P5 bottom tab bar and left menu skeleton" --body-file <scratchpad의 본문 파일>
```

본문(한국어): 목적, 스펙·계획 링크, 바뀐 화면(390px·1280px 캡처, 합성 데이터만), 바뀐 시험 파일과 이유(Task 11 표 요약), REF-06 평가(필요성: 아이콘 9개뿐이라 패키지 대신 경로 복사 / 진위: 공식 저장소 tabler/tabler-icons, npm `@tabler/icons` / 유지 관리: 3.49.0 2026-10-05, 관리자 2명 / 안정성: 3.x 안정판 / 보안: 코드 실행 없는 SVG 경로 / 라이선스: MIT, SPDX 표시와 라이선스 화면 / 채택도: 주간 내려받기 수 / 무게: 패키지 없음), 검사 결과, 망가뜨려 보기 표, 알려진 로컬 실패, 데모 배포 안 함. 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 6: CI 통과 후 병합한다**

정확한 head에서 CI(`app-check.yml`, `repository-check.yml`)가 통과하면:

```bash
gh pr merge <번호> --merge --match-head-commit <head SHA>
```

병합 뒤 바깥 체크아웃을 앞으로 감는다: `node "$LOCALAPPDATA/build-manager-maintenance/outer-ff.cjs" <병합 커밋 전체 SHA> outer-checkout-update-20261010-30` (2-b6가 -29를 썼다. 다음 번호를 쓰기 전에 `outer-checkout-update-20261010-*` 백업 목록을 확인한다).

- [ ] **Step 7: 운영자에게 보고한다**

쉬운 한국어로: 무엇이 바뀌었는지(휴대폰 아래 메뉴, 넓은 화면 왼쪽 메뉴, 알림 처리할 일), 캡처, 검사 결과, 남은 일(PR 1b 우리 집 카드·내 요청 두 묶음, PR 2 처리할 일 보강), 데모에는 아직 올리지 않았다는 것. 320px 글자 200% 라벨이 넘쳤다면 그 결정을 묻는다.

## 자체 점검 결과(계획 작성 뒤)

- 스펙 대응: 1절(Task 1, 6, 8, 9), 2절(Task 6, 8, 10), 3절(Task 2, 5, 8, 9), 4절(Task 8; 우리 집 카드·내 요청 두 묶음은 PR 1b), 5절의 PR 1 이유 일곱 가지(Task 4; PR 2 이유 다섯은 PR 2), 6절(Task 8), 7절(Task 3), 위협·남용(Task 2 시험, Task 7 주소 시험, Task 14 리뷰), 테스트 절(Task 1–7, 11, 12, 14), PR 1 5–7번(Task 10, 12, 13), D9(Task 13), D10(Task 9), D11(Task 1, 7).
- 이름 일관성: `useNavLocation`이 돌려주는 것은 `location`, `go`, `back`뿐이고 상세 기록은 모듈 함수(`showDetailEntry`, `hideDetailEntry`, `detailEntryOnTop`)다. Task 8은 이 이름만 쓴다. `useCommunicationSummaries`의 `ready`는 Task 6에서 더하고 Task 8에서 쓴다. `TODO_REASON_NAMES`는 Task 4에서 만들고 Task 4·6에서 쓴다.
- 스펙과 다르게 정한 것(Task 13에서 스펙에 반영): 연결 화면을 늘 그려 둠(지금 동작 유지), 결과 확인 이어하기 안내 위치(지금처럼), 입주 연결은 B1에서만, 소속 전환의 기록 처리.

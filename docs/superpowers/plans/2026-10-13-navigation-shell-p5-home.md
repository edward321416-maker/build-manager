# P5 PR 1b: 우리 집 진행 중 요청·내 요청 두 묶음 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세입자 우리 집에 처리할 일 한 줄과 진행 중 요청(최대 3개)을 넣고, 내 요청을 '진행 중'·'끝난 요청'으로 나누고, 소속이 하나인 계정의 내 소속을 글자로 보이며, PR #139 끝 리뷰가 PR 1b로 미룬 다섯 가지를 고친다.

**Architecture:** 화면 순서·문구는 순수 함수 하나(`nav/tenant-home.ts`)가 정하고 `core-screen.tsx`가 그린다. 서버를 새로 부르지 않고, 이미 읽은 요청 목록과 처리할 일 목록(`buildTodoList`)만 쓴다. 기록 표시에 불리언 하나(`samePlace`)를 더해 같은 탭으로 요청을 닫을 때 뒤로 가기 한 번이 헛돌지 않게 한다.

**Tech Stack:** Next.js 16, React 19, CSS Modules, vitest 5(jsdom), Playwright 1.63(`test:e2e:core` 개발 모드 3131, `test:e2e:sdk` B1 3133).

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`(운영자 2026-10-13 승인). 이 계획은 그 스펙의 "PR 1: 메뉴 뼈대" 2번(우리 집 진행 중 카드, 내 요청 두 묶음, 처리할 일 한 줄)과 1절의 "소속이 하나면 이름만 글자로"를 만든다.
- 위험 등급: 고위험(DEV-04). FROZEN 화면과 그 시험을 바꾼다. 데모 배포는 이 계획에 없다(스펙: P5 묶음이 모두 병합된 뒤 운영자에게 묻는다).
- 새 패키지, 새 API, DB 변경, 서버 변경이 없다.
- 화면 값은 디자인 규칙의 토큰과 글자 스타일만 쓴다. 누르는 칸은 50×50 이상, 글자는 상자 가운데(4절), 목록은 행(8.5), 카드 안에 카드 없음(6.3).
- 문구는 해요체(`haeyo-copy.test.ts`가 `app/core` 아래 모든 파일을 본다). 상태 이름은 `status-names.ts`의 이름만 쓴다(8.7).
- 정해진 문구(스펙 4절, 그대로 쓴다)
  - 처리할 일 한 줄: `처리할 일 N건 · 알림에서 보기`
  - 넘칠 때 링크: `내 요청에서 모두 보기`
  - 다음 할 일 기본값: `관리자가 확인하고 있어요.`(접수됨), `처리 중이에요.`(처리 중)
  - 내 요청 묶음: `진행 중`, `끝난 요청`
  - 빈 묶음: `진행 중인 요청이 없어요. 문제가 생기면 우리 집에서 접수해 주세요.`, `끝난 요청이 없어요.`
- 이 계획이 새로 정하는 문구(Task 8에서 스펙에 적는다)
  - 진행 중 요청 구역 이름: `진행 중인 요청`
  - 제출 전 요청의 다음 할 일: `아직 보내지 않았어요. 열어서 제출해 주세요.`
  - 고른 사진 때문에 행이 잠길 때: `고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요.`
- 기록 상태(`history.state`)에는 불리언 표시만 둔다(스펙 위협 표).
- 데모 주소나 IP, 이메일 주소를 문서·커밋·PR에 적지 않는다. 커밋 끝줄은 작업 환경이 정한 공동 작성자 줄이다(`Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>`).
- 저장소 파일(`apps/**`, `scripts/**`, `design/**`, `docs/**`)은 Edit/Write 도구로만 고친다. 바꾼 경로만 이름으로 스테이징한다(`git add -A`, `git add .` 금지). amend·force·이력 고쳐 쓰기 금지.
- 브라우저 시험과 vitest를 동시에 돌리지 않는다(5초 시험이 부하로 실패한다). 로컬 공용 시험 데이터는 지우지 않는다(데이터 삭제는 운영자 승인 필요).

## 작업 위치와 기준

- 작업 트리: `worktree/build-manager-mobile-design`, 가지 `feat/navigation-shell-p5-home`(main `81c6d39`에서 만듦).
- "P5 전" 캡처: PR #139 끝의 디자인 점검 결과(`~/.build-manager-rc1-private/p5-final`, 231개 화면, 발견 0건)를 이 PR의 비교 기준으로 쓴다.

## 파일 구조

| 파일 | 할 일 |
| --- | --- |
| Create `apps/web/src/app/core/nav/tenant-home.ts` | 우리 집 진행 중 요청 고르기·정렬, 다음 할 일 한 줄 문구 |
| Create `apps/web/src/app/core/nav/tenant-home.test.ts` | 위 순수 함수 시험 |
| Modify `apps/web/src/app/core/nav/todo-list.ts` | `lastActivity`를 내보냄 |
| Modify `apps/web/src/app/core/core-screen.tsx` | 처리할 일 한 줄, 진행 중 요청, 내 요청 두 묶음, 잠김 안내, 제목 포커스, 넓은 화면 제목 표시 |
| Modify `apps/web/src/app/core/nav/nav-screens.tsx` | `TodoScreen`의 `notice`(잠김 안내) |
| Modify `apps/web/src/app/core/core-design.module.css` | 새 구역 모양, 넓은 화면 제목, 제목 포커스 표시 |
| Modify `apps/web/src/app/core/login-screen.tsx` | 소속 하나면 글자 행, 고른 뒤 제목 포커스 |
| Modify `apps/web/src/app/core/login-screen.test.tsx` | 글자 행·선택 상자 시험 |
| Modify `apps/web/src/app/core/nav/use-nav-location.ts` (+ test) | `samePlace` 표시와 같은 곳 닫기 |
| Modify `apps/web/src/app/core/onboarding-panel.tsx` (+ test) | 메뉴 안에서는 두 번째 상단 바를 그리지 않음 |
| Create `apps/web/tests/core-e2e/own-session.ts` | 시험 파일마다 쓰는 개발 모드 세션 만들기(navigation.spec에서 옮김) |
| Create `apps/web/tests/core-e2e/home.spec.ts` | 우리 집·내 요청 화면 시험 |
| Modify `apps/web/tests/core-e2e/navigation.spec.ts` | 세션 도우미 사용, 포커스·같은 곳 닫기·제목·손 확인 자동화 시험 |
| Modify `apps/web/tests/core-e2e/core.spec.ts`, `usability.spec.ts` | 옛 '최근 접수' 문구 |
| Modify `apps/web/tests/core-login-e2e/session.ts` | `twoOrgSession` |
| Modify `apps/web/tests/core-login-e2e/design.spec.ts`, `ticket-communication.spec.ts`, `navigation.spec.ts` | 단일 소속 선택 상자에 기대던 검사를 두 소속 세션으로 |
| Modify `scripts/design-audit.mjs` | 내 요청 화면 기다림 |
| Modify `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`, `design/DESIGN_STATUS.md` | 결정과 현황 |
| Create `ops/navigation_shell_p5_home_20261013_acceptance.md`, Modify `ops/AI_Execution_Log.csv` | 수락 기록 |

줄 수 어림: 코드 약 250줄, 시험 약 300줄, 문서 약 100줄. 1000줄 안이라 PR 하나다(DEV-02).

---

### Task 0: 준비

**Files:** 없음(확인만)

- [ ] **Step 1: 가지와 기준 확인**

Run: `git status --short && git log --oneline -1 && git rev-parse --abbrev-ref HEAD`
Expected: 깨끗한 트리, `81c6d39` 위, 가지 `feat/navigation-shell-p5-home`.

- [ ] **Step 2: 규칙집을 읽는다**

`design/DESIGN_RULES.md`(2026-10-13 #140으로 바뀜), `development/DEVELOPMENT_RULES.md`를 처음부터 끝까지 Read 도구로 읽는다. 프로젝트 훅이 막으면 그 규칙집을 다시 읽고 재시도한다.

---

### Task 1: 우리 집 진행 중 요청과 다음 할 일 (순수 함수)

**Files:**
- Create: `apps/web/src/app/core/nav/tenant-home.ts`
- Create: `apps/web/src/app/core/nav/tenant-home.test.ts`
- Modify: `apps/web/src/app/core/nav/todo-list.ts` (`lastActivity` 내보내기)

**Interfaces:**
- Consumes: `buildTodoList`, `todoReasonName`, `TodoList`, `TodoReason` (`nav/todo-list.ts`), `isIntakeDraft` (`ui/work-status-badge`).
- Produces:
  - `export const lastActivity: (ticket: CoreTicketDto) => string | null` (todo-list.ts)
  - `export const HOME_CARD_LIMIT = 3`
  - `export type HomeCard = { ticket: CoreTicketDto; next: string }`
  - `export function tenantNextStep(ticket: CoreTicketDto, reasons: readonly TodoReason[]): string`
  - `export function homeCards(input: { tickets: readonly CoreTicketDto[]; todo: TodoList; unitId: string }): { cards: HomeCard[]; total: number }`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/tenant-home.test.ts`:

```ts
import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { buildTodoList } from "./todo-list";
import { HOME_CARD_LIMIT, homeCards, tenantNextStep } from "./tenant-home";

// Only the fields these rules read; the rest of the DTO is irrelevant here (same shape as todo-list.test.ts).
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], status: string, at: string, unitId = "unit-1", sent = true): CoreTicketDto {
  const events = sent ? [{ kind: "CREATED", at }, { kind: "FINALIZED", at }] : [{ kind: "CREATED", at }];
  return { ticketId: id, unitId, workStatus, detail: { status, issueType: "LEAK", decision: null, repairPacket: null }, events } as unknown as CoreTicketDto;
}
const replyFrom = (id: string): Record<string, CoreCommunicationSummary> => ({ [id]: { ticketId: id, version: 1, waitingFor: "TENANT", readOnly: false } as CoreCommunicationSummary });
const todoOf = (tickets: CoreTicketDto[], summaries: Record<string, CoreCommunicationSummary> = {}) =>
  buildTodoList({ role: "TENANT", tickets, summaries, summariesFailed: false });

describe("우리 집 next step (P5 spec §4)", () => {
  it("names every to-do reason on one line", () => {
    expect(tenantNextStep(ticket("a", "OPEN", "SAFETY_ESCALATED", "2026-10-13T01:00:00Z"), ["SAFETY", "REPLY"])).toBe("긴급 확인 필요 · 내 답변 필요");
    expect(tenantNextStep(ticket("b", "OPEN", "NEEDS_MORE_INFO", "2026-10-13T01:00:00Z"), ["MORE_INFO"])).toBe("추가 확인 필요");
  });

  it("does not repeat 제출 전, which the draft's own status label already says", () => {
    const draft = ticket("d", "OPEN", "IN_PROGRESS", "2026-10-13T01:00:00Z", "unit-1", false);
    expect(tenantNextStep(draft, ["DRAFT"])).toBe("아직 보내지 않았어요. 열어서 제출해 주세요.");
    expect(tenantNextStep(draft, ["REPLY", "DRAFT"])).toBe("내 답변 필요");
  });

  it("says who has it when nothing waits on the tenant", () => {
    expect(tenantNextStep(ticket("o", "OPEN", "READY_FOR_REVIEW", "2026-10-13T01:00:00Z"), [])).toBe("관리자가 확인하고 있어요.");
    expect(tenantNextStep(ticket("p", "IN_PROGRESS", "APPROVED", "2026-10-13T01:00:00Z"), [])).toBe("처리 중이에요.");
  });
});

describe("우리 집 in-progress requests (P5 spec §4)", () => {
  it("lists this unit's unfinished requests only, with the total", () => {
    const tickets = [ticket("mine", "OPEN", "READY_FOR_REVIEW", "2026-10-13T01:00:00Z"), ticket("other-unit", "OPEN", "READY_FOR_REVIEW", "2026-10-13T02:00:00Z", "unit-2"), ticket("done", "COMPLETED", "APPROVED", "2026-10-13T03:00:00Z")];
    const result = homeCards({ tickets, todo: todoOf(tickets), unitId: "unit-1" });
    expect(result.cards.map(card => card.ticket.ticketId)).toEqual(["mine"]);
    expect(result.total).toBe(1);
  });

  it("puts to-dos first in the 알림 order, then the most recent activity, and keeps three", () => {
    const tickets = [
      ticket("quiet-new", "OPEN", "READY_FOR_REVIEW", "2026-10-13T09:00:00Z"),
      ticket("quiet-old", "IN_PROGRESS", "APPROVED", "2026-10-13T01:00:00Z"),
      ticket("reply", "OPEN", "READY_FOR_REVIEW", "2026-10-13T02:00:00Z"),
      ticket("safety", "OPEN", "SAFETY_ESCALATED", "2026-10-13T03:00:00Z"),
    ];
    const result = homeCards({ tickets, todo: todoOf(tickets, replyFrom("reply")), unitId: "unit-1" });
    expect(result.cards.map(card => card.ticket.ticketId)).toEqual(["safety", "reply", "quiet-new"]);
    expect(result.cards).toHaveLength(HOME_CARD_LIMIT);
    expect(result.total).toBe(4);
    expect(result.cards.map(card => card.next)).toEqual(["긴급 확인 필요", "내 답변 필요", "관리자가 확인하고 있어요."]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/tenant-home.test.ts`
Expected: FAIL. `./tenant-home` 모듈이 없다.

- [ ] **Step 3: 구현한다**

`apps/web/src/app/core/nav/todo-list.ts`에서 `const lastActivity =`를 `export const lastActivity =`로 바꾼다(본문은 그대로).

`apps/web/src/app/core/nav/tenant-home.ts`:

```ts
import type { CoreTicketDto } from "@build-manager/api-contracts";
import { isIntakeDraft } from "../ui/work-status-badge";
import { lastActivity, todoReasonName, type TodoList, type TodoReason } from "./todo-list";

/** 우리 집 shows at most this many unfinished requests (P5 spec §4); the rest are one link away in 내 요청. */
export const HOME_CARD_LIMIT = 3;
export type HomeCard = { ticket: CoreTicketDto; next: string };

/** The request's next step in one line (spec §4): the 알림 reason names, or who has the request now. A draft's own
 * status label already reads 제출 전, so a draft with no other reason says what to do instead of repeating it. */
export function tenantNextStep(ticket: CoreTicketDto, reasons: readonly TodoReason[]): string {
  const names = reasons.filter(reason => reason !== "DRAFT").map(reason => todoReasonName("TENANT", reason));
  if (names.length) return names.join(" · ");
  if (isIntakeDraft(ticket)) return "아직 보내지 않았어요. 열어서 제출해 주세요.";
  return ticket.workStatus === "IN_PROGRESS" ? "처리 중이에요." : "관리자가 확인하고 있어요.";
}

/** This unit's unfinished requests: to-dos first in the 알림 order, then the most recent activity (spec §4). */
export function homeCards({ tickets, todo, unitId }: { tickets: readonly CoreTicketDto[]; todo: TodoList; unitId: string }): { cards: HomeCard[]; total: number } {
  const order = new Map(todo.items.map((item, index) => [item.ticketId, index]));
  const reasons = new Map(todo.items.map(item => [item.ticketId, item.reasons]));
  const open = tickets.filter(ticket => ticket.unitId === unitId && ticket.workStatus !== "COMPLETED");
  const rank = (ticket: CoreTicketDto) => order.get(ticket.ticketId) ?? Number.MAX_SAFE_INTEGER;
  const time = (ticket: CoreTicketDto) => { const at = lastActivity(ticket); return at ? Date.parse(at) : 0; };
  const sorted = [...open].sort((a, b) => rank(a) - rank(b) || time(b) - time(a) || a.ticketId.localeCompare(b.ticketId));
  return { cards: sorted.slice(0, HOME_CARD_LIMIT).map(ticket => ({ ticket, next: tenantNextStep(ticket, reasons.get(ticket.ticketId) ?? []) })), total: open.length };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav src/app/core/haeyo-copy.test.ts`
Expected: PASS(기존 nav 시험 44개 + 새 시험 5개, 해요체 시험 포함).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/core/nav/tenant-home.ts apps/web/src/app/core/nav/tenant-home.test.ts apps/web/src/app/core/nav/todo-list.ts
git commit -m "feat(web): pick 우리 집's in-progress requests and their next step

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 2: 우리 집·내 요청 화면 시험을 먼저 쓴다

**Files:**
- Create: `apps/web/tests/core-e2e/own-session.ts`
- Modify: `apps/web/tests/core-e2e/navigation.spec.ts` (세션 만들기를 도우미로 옮김, 시험 본문은 그대로)
- Create: `apps/web/tests/core-e2e/home.spec.ts`

**Interfaces:**
- Produces: `own-session.ts`의 `privateRoot: string`, `accessCodes(): Promise<Record<string, string>>`, `mintOwnSession(who?: string): Promise<string>`(개발 접근 코드로 쓰는 세션 값).
- 화면이 지켜야 할 표시(Task 3이 만든다)
  - 우리 집 구역 `<section aria-label="진행 중인 요청">`, 제목 `진행 중인 요청 N건`, 행마다 `data-home-card="<ticketId>"`와 `열기` 버튼
  - 처리할 일 한 줄 링크 이름 `처리할 일 N건 · 알림에서 보기`, 넘칠 때 링크 `내 요청에서 모두 보기`
  - 내 요청 구역 `<section aria-label="진행 중">`, `<section aria-label="끝난 요청">`(행 표시는 지금처럼 `[data-ticket-id] [data-open-ticket]`)

- [ ] **Step 1: 세션 도우미를 만든다**

`apps/web/tests/core-e2e/own-session.ts`에 `navigation.spec.ts`의 `root`, `codes`, `test.beforeAll` 본문을 옮긴다.

```ts
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { Client } from "pg";

export const privateRoot = join(homedir(), ".build-manager-rc1-private");
export const accessCodes = async () => JSON.parse(await readFile(join(privateRoot, "access-codes.json"), "utf8")) as Record<string, string>;

/** A development session of its own for a fixture account. A test that signs out, or files that change what the account
 * sees, then leave the shared access code alive for the files after them (as maintenance-fact.spec.ts does). */
export async function mintOwnSession(who = "tenant"): Promise<string> {
  const state = JSON.parse(await readFile(join(privateRoot, "state.json"), "utf8")); expect(state.admin.host).toBe("127.0.0.1"); expect(state.admin.database).toBe("core_flow_synthetic");
  const admin = new Client(state.admin), login = new Client(state.roles.b1.loginConfig); await admin.connect(); await login.connect();
  try {
    expect((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
    const account = state.fixture.accounts[who], identity = (await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'", [account.userId])).rows[0];
    expect(identity.issuer).toBe("https://rc1.synthetic.invalid/");
    const handle = randomBytes(32).toString("hex"), digest = createHash("sha256").update(handle).digest();
    await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes')", [identity.issuer, identity.subject, digest]);
    await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)", [digest, account.orgId]);
    return handle;
  } finally { await login.end(); await admin.end(); }
}
```

`navigation.spec.ts`: `readFile`, `homedir`, `join`, `createHash`, `randomBytes`, `Client` import와 `root`, `codes`를 지우고, `import { accessCodes, mintOwnSession } from "./own-session";`을 더한다. `test.beforeAll`은 `test.beforeAll(async () => { ownTenant = await mintOwnSession("tenant"); });` 한 줄이 된다. 본문의 `(await codes())`는 `(await accessCodes())`로 바꾼다. 주석(`// The logout below ends ...`)은 남긴다.

- [ ] **Step 2: 우리 집·내 요청 시험을 쓴다**

`apps/web/tests/core-e2e/home.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { accessCodes, mintOwnSession } from "./own-session";
import { openTab } from "./presentation";

// P5 PR 1b (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md §4): 우리 집's to-do line and in-progress
// requests, 내 요청 in two groups, and why request rows wait while photos are picked.
let code = "";
test.beforeAll(async () => { code = await mintOwnSession("tenant"); });
const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
const pendingHint = "고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요.";
const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#759cac" } }).png().toBuffer();
async function login(page: Page) {
  await page.goto("/core"); await page.getByLabel("개발 접근 코드").fill(code);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}
/** Lists only the requests this test made. The shared fixture keeps every other file's requests, which would change the
 * order; a controlled list exercises the screen, not persistence (as usability.spec.ts does). */
async function onlyMine(page: Page, mine: string[]) {
  await page.route("**/api/v2/core/tickets", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(), all = await response.json() as { ticketId: string }[];
    await route.fulfill({ response, json: all.filter(ticket => mine.includes(ticket.ticketId)) });
  });
}
async function create(page: Page, text: string) {
  const units = await (await page.request.get("/api/v2/core/units", { headers: bearer(code) })).json() as { id: string }[];
  const response = await page.request.post("/api/v2/core/tickets", { headers: bearer(code), data: { unitId: units[0].id, issueType: "LEAK", rawUserText: text } });
  expect(response.status()).toBe(201); return (await response.json() as { ticketId: string }).ticketId;
}

test("우리 집 shows three in-progress requests with their next step, the to-do line and a way to all of them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  for (const n of [1, 2, 3, 4]) mine.push(await create(page, `합성 우리 집 진행 중 요청 ${n}`));
  await login(page);
  const going = page.getByRole("region", { name: "진행 중인 요청", exact: true }), cards = going.locator("[data-home-card]");
  // All four are drafts, so the to-do order is newest first (spec §4: to-dos first, then the most recent).
  await expect(cards).toHaveCount(3);
  expect(await cards.evaluateAll(rows => rows.map(row => row.getAttribute("data-home-card")))).toEqual([mine[3], mine[2], mine[1]]);
  await expect(cards.first()).toContainText("아직 보내지 않았어요. 열어서 제출해 주세요.");
  await expect(going.getByRole("heading", { level: 2 })).toHaveText("진행 중인 요청 4건");
  const line = page.getByRole("link", { name: "처리할 일 4건 · 알림에서 보기", exact: true });
  await expect(line).toBeVisible();
  await going.getByRole("link", { name: "내 요청에서 모두 보기", exact: true }).click();
  await expect(page).toHaveURL(/tab=requests$/);
  await expect(page.getByRole("region", { name: "진행 중", exact: true }).locator("[data-ticket-id]")).toHaveCount(4);
  await openTab(page, "우리 집"); await line.click(); await expect(page).toHaveURL(/tab=alerts$/);
  await openTab(page, "우리 집"); await cards.first().getByRole("button").click();
  await expect(page.getByTestId("ticket-heading")).toBeVisible();
  await page.getByRole("button", { name: "뒤로", exact: true }).click(); await expect(cards).toHaveCount(3);
  // Three or fewer: no link to all of them.
  mine.splice(1, 3); await page.getByRole("navigation", { name: "접속 및 새로고침" }).getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(cards).toHaveCount(1); await expect(going.getByRole("link", { name: "내 요청에서 모두 보기", exact: true })).toHaveCount(0);
});

test("내 요청 lists 진행 중 and 끝난 요청 apart and says why rows wait while photos are picked", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  const open = await create(page, "합성 진행 중 요청"), done = await create(page, "합성 끝난 요청"); mine.push(open, done);
  const manager = bearer((await accessCodes()).manager);
  for (const status of ["IN_PROGRESS", "COMPLETED"]) expect((await page.request.post(`/api/v2/core/tickets/${done}/handling`, { headers: manager, data: { status, message: "합성 처리 기록" } })).status()).toBe(200);
  await login(page); await openTab(page, "내 요청");
  const going = page.getByRole("region", { name: "진행 중", exact: true }), ended = page.getByRole("region", { name: "끝난 요청", exact: true });
  await expect(going.locator("[data-ticket-id]")).toHaveCount(1); await expect(going.locator(`[data-ticket-id="${open}"]`)).toBeVisible();
  await expect(ended.locator(`[data-ticket-id="${done}"]`)).toContainText("처리 완료");
  mine.splice(1, 1); await page.getByRole("navigation", { name: "접속 및 새로고침" }).getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(ended).toContainText("끝난 요청이 없어요.");
  // Photos picked on 우리 집 keep every request shut; the lists say why (final review of PR 139).
  await openTab(page, "우리 집"); await page.getByLabel("참고 사진 선택", { exact: true }).setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: await png() });
  await openTab(page, "내 요청"); await expect(going.locator("[data-open-ticket]")).toBeDisabled();
  // The hidden 우리 집 says it too, so count only the visible copy.
  await expect(page.getByText(pendingHint, { exact: true }).filter({ visible: true })).toHaveCount(1);
  await openTab(page, "알림"); await expect(page.getByRole("region", { name: "처리할 일", exact: true })).toContainText(pendingHint);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npm run test:e2e:core -- home.spec.ts navigation.spec.ts`
Expected: `home.spec.ts`의 두 시험은 FAIL(`진행 중인 요청`, `진행 중` 구역이 없다). `navigation.spec.ts`는 도우미로 옮긴 뒤에도 PASS.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/tests/core-e2e/own-session.ts apps/web/tests/core-e2e/navigation.spec.ts apps/web/tests/core-e2e/home.spec.ts
git commit -m "test(web): expect 우리 집's in-progress requests and 내 요청 in two groups (P5 PR 1b)

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 3: 우리 집·내 요청 화면을 만든다

**Files:**
- Modify: `apps/web/src/app/core/core-screen.tsx`
- Modify: `apps/web/src/app/core/nav/nav-screens.tsx` (`TodoScreen`)
- Modify: `apps/web/src/app/core/core-design.module.css`
- Modify: `apps/web/tests/core-e2e/core.spec.ts:85`, `apps/web/tests/core-e2e/usability.spec.ts:120`, `scripts/design-audit.mjs:251`

**Interfaces:**
- Consumes: Task 1의 `homeCards`, `HOME_CARD_LIMIT`; `plainClick`(`nav/core-nav.tsx`); `navHref`(`nav/nav-location.ts`).
- Produces: `TodoScreen`의 새 prop `notice?: string`. Task 2가 정한 화면 표시.

- [ ] **Step 1: 가져오기와 계산을 더한다**

`core-screen.tsx` 맨 위

```tsx
import { BackButton,CoreNav,plainClick } from "./nav/core-nav";   // 기존 줄에 plainClick 추가
import { navHref } from "./nav/nav-location";
import { homeCards,HOME_CARD_LIMIT } from "./nav/tenant-home";
```

`sessionMessage` 위에 상수 하나를 더한다.

```tsx
// Photos picked but not sent would become the opened request's photos, so every request stays shut until they are sent
// or dropped; the lists say why (final review of PR 139).
const pendingPhotosHint="고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요.";
```

`const todo=useMemo(...)` 줄 바로 아래에 더한다.

```tsx
  const home=useMemo(()=>tenant?homeCards({tickets,todo,unitId:unit}):{cards:[],total:0},[tenant,tickets,todo,unit]);
  /** A menu-like link inside the content: the real address for a new tab, this page's own move for a plain click. */
  const placeLink=(to:NavLocation)=>({href:navHref(to),onClick:(event:React.MouseEvent)=>{if(plainClick(event)){event.preventDefault();navigate(to);}}});
```

`React.MouseEvent` 대신 이 파일의 `react` import에 `type MouseEvent`를 더해 `MouseEvent`로 써도 된다(전역 `MouseEvent`와 이름이 겹치므로 `type MouseEvent as ReactMouseEvent`로 가져온다).

`const openFromList=...` 줄 바로 아래에 더한다.

```tsx
  const openTenantTicket=(id:string)=>void run(async()=>{setSelected(await client.read(id));setMessage("");});
  const ticketName=(t:CoreTicketDto)=>{const label=units.find(u=>u.id===t.unitId)?.label;return (t.detail.issueType==="HEATING"?"난방":"누수")+(label?` · ${label}`:"");};
  const unitTickets=tickets.filter(t=>t.unitId===unit);
  const requestGroups=[
    {name:"진행 중",list:unitTickets.filter(t=>t.workStatus!=="COMPLETED"),empty:"진행 중인 요청이 없어요. 문제가 생기면 우리 집에서 접수해 주세요."},
    {name:"끝난 요청",list:unitTickets.filter(t=>t.workStatus==="COMPLETED"),empty:"끝난 요청이 없어요."},
  ];
```

- [ ] **Step 2: 세입자 영역을 바꾼다**

`</section>:!tenant?null:<>`부터 그 짝인 `</>}`까지(지금 314–331행)를 아래로 바꾼다. 접수 칸 `<form>`과 `건물·호실` 선택 줄, `followUp`·호실 없음 안내 줄은 글자 하나 바꾸지 않는다.

```tsx
      </section>:!tenant?null:<>
        {/* P5 PR 1b (spec §4): the to-do line above the unit choice. It counts the 알림 rows, so it waits for the same read. */}
        {tab==="home"&&conversationSummaries.ready&&todo.items.length?<a className={styles.todoLine} {...placeLink({tab:"alerts",view:null})}>처리할 일 {todo.items.length}건 · 알림에서 보기</a>:null}
        {/* 기존 건물·호실 선택 줄 그대로 */}
        <div className={styles.tenantHome} hidden={tab!=="home"}>
          {/* 기존 followUp 줄, 호실 없음 줄 그대로 */}
          {home.cards.length?<section className={styles.homeCards} aria-label="진행 중인 요청">
            <h2>진행 중인 요청 <small>{home.total}건</small></h2>
            {pending.length?<p>{pendingPhotosHint}</p>:null}
            <ul>{home.cards.map(({ticket:t,next})=><li key={t.ticketId} data-home-card={t.ticketId}>
              <div><p className={styles.cardTitle}><span className={styles.ticketTitle}>{ticketName(t)}</span>{isIntakeDraft(t)?<DraftBadge/>:<WorkStatusBadge status={t.workStatus}/>}</p><p className={styles.cardNext}>{next}</p></div>
              <button type="button" aria-label={`${ticketName(t)} 열기`} disabled={busy||pending.length>0} onClick={()=>openTenantTicket(t.ticketId)}>열기</button>
            </li>)}</ul>
            {home.total>HOME_CARD_LIMIT?<a className={styles.moreLink} {...placeLink({tab:"requests",view:null})}>내 요청에서 모두 보기</a>:null}
          </section>:null}
          {/* 기존 접수 칸 form 그대로 */}
        </div>
        <div className={styles.tenantRequests} hidden={tab!=="requests"}>
          {conversationSummaries.error?<p role="alert">대화 대기 상태를 확인하지 못했어요. 새로고침을 눌러 주세요.</p>:null}
          {pending.length?<p>{pendingPhotosHint}</p>:null}
          {!unit?<p>호실 배정 후 접수 이력을 볼 수 있어요.</p>:requestGroups.map(group=><section key={group.name} aria-label={group.name}>
            <h2>{group.name} <small>{group.list.length}건</small></h2>
            {group.list.length?<ul className={styles.ticketList}>{group.list.map(t=><li key={t.ticketId} data-ticket-id={t.ticketId}><button data-open-ticket className={styles.ticketRow} disabled={busy||pending.length>0} onClick={()=>openTenantTicket(t.ticketId)}><span className={styles.ticketTitle}>{t.detail.issueType==="HEATING"?"난방":"누수"}</span><span> · </span>{isIntakeDraft(t)?<DraftBadge/>:<WorkStatusBadge status={t.workStatus}/>}<CommunicationBadge summary={conversationSummaries.summaries[t.ticketId]} tenant/></button><PhotoGallery compact client={client} ticketId={t.ticketId} revision={revision} /></li>)}</ul>:<p>{group.empty}</p>}
          </section>)}
        </div>
      </>}
```

알림 화면 줄의 `TodoScreen`에 `notice={pending.length?pendingPhotosHint:undefined}`를 더한다.

- [ ] **Step 3: `TodoScreen`에 안내 자리를 더한다**

`nav-screens.tsx`의 `TodoScreen`

- props 타입에 `notice?: string`을 더한다.
- 문서 주석 끝에 "`notice` says why the rows are locked." 한 줄을 더한다.
- `<section className={styles.todo} aria-label="처리할 일">` 바로 안, `list.partial` 줄 앞에 `{notice ? <p className={styles.empty}>{notice}</p> : null}`을 둔다. `styles.empty`는 이미 좌우 안쪽 여백(20/30/40)을 가진 문단 모양이다.

- [ ] **Step 4: 모양을 더한다**

`core-design.module.css`에서 아래 두 줄을

```css
.root .tenantRequests > h2 { display: flex; justify-content: space-between; align-items: center; gap: .625rem; }
.root .tenantRequests > h2 small { color: var(--color-text-readable); font-weight: 400; }
```

이렇게 바꾼다.

```css
.root :is(.tenantRequests,.homeCards) h2 { display: flex; justify-content: space-between; align-items: center; gap: .625rem; }
.root :is(.tenantRequests,.homeCards) h2 small { color: var(--color-text-readable); font-weight: 400; }
.root .tenantRequests > section + section { margin-top: 1.875rem; }
.root :is(.tenantRequests,.homeCards) > section > * + *, .root .homeCards > * + * { margin-top: .625rem; }
/* P5 PR 1b (spec §4): the to-do line is a link shaped like a secondary button (rules 8.1); the in-progress requests are
 * list rows (8.5) with a secondary 열기 button, never boxed cards (6.3). */
.root .todoLine { display: inline-flex; align-items: center; justify-content: center; min-height: 3.125rem; padding: .625rem 1.25rem; border: 1px solid var(--color-border-strong); border-radius: .625rem; background: var(--color-surface); color: var(--color-text); font-size: .9375rem; line-height: 1.25rem; font-weight: 600; letter-spacing: -0.01em; text-decoration: none; }
.root .todoLine:hover { background: var(--color-fill-hover); }
.root .homeCards > ul { list-style: none; padding: 0; border-top: 1px solid var(--color-border); }
.root .homeCards > ul > li { display: flex; align-items: center; justify-content: space-between; gap: .625rem; margin: 0; padding: .9375rem 0; border-bottom: 1px solid var(--color-border); }
.homeCards li > div { min-width: 0; display: grid; gap: .3125rem; }
.root .cardTitle { display: flex; flex-wrap: wrap; align-items: center; gap: .625rem; margin: 0; }
.root .cardNext { margin: 0; color: var(--color-text-readable); }
.root .homeCards li > button { flex: 0 0 auto; }
.root .moreLink { display: inline-flex; align-items: center; min-height: 3.125rem; }
```

`color: var(--color-text)`와 `--color-border-strong`이 `apps/web/src/app/tokens.css`에 있는지 먼저 확인한다. 이름이 다르면 그 파일의 이름을 쓴다(값을 새로 만들지 않는다).

- [ ] **Step 5: 옛 문구를 쓰던 시험과 점검을 고친다**

- `core-e2e/core.spec.ts:85`: `await expect(page.getByRole("heading",{name:/^최근 접수/})).toBeVisible();` → `await expect(page.getByRole("region",{name:"진행 중",exact:true})).toBeVisible();`
- `core-e2e/usability.spec.ts:120`: `"선택한 호실의 접수 내역이 없어요. 우리 집에서 문제를 접수해 주세요."` → `"진행 중인 요청이 없어요. 문제가 생기면 우리 집에서 접수해 주세요."`. 같은 줄 끝에 `await expect(page.getByText("끝난 요청이 없어요.",{exact:true})).toBeVisible();`를 더한다.
- `scripts/design-audit.mjs:251`: `await t.getByRole("heading", { name: /^최근 접수/ }).waitFor({ timeout: 20000 });` → `await t.getByRole("region", { name: "진행 중", exact: true }).waitFor({ timeout: 20000 });`

- [ ] **Step 6: 통과를 확인한다**

Run(차례로, 동시에 돌리지 않는다)
- `npm --workspace @build-manager/web run test -- src/app/core`
- `npm --workspace @build-manager/web run typecheck`
- `npx eslint src/app/core/core-screen.tsx src/app/core/nav/nav-screens.tsx` (apps/web에서, `--quiet` 없이)
- `npm run test:e2e:core -- home.spec.ts core.spec.ts usability.spec.ts navigation.spec.ts`
- `npm run test:e2e:core`(전체)
- `npm run test:e2e:sdk`(전체)

Expected: 새 시험 통과. 전체 실행의 실패는 PR #139 기록의 로컬 시험 데이터 실패(요청 2,000건 이상, 호실 200개 초과, 초대 쪽수)만이다. 다른 실패가 나면 원인을 찾아 고친다. 우리 집 위쪽에 행이 늘어 화면 위치를 재던 시험이 실패하면, 그 시험의 뜻(순서, 겹치지 않음)을 지키도록 고치고 보고서에 이유를 적는다.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/app/core/core-screen.tsx apps/web/src/app/core/nav/nav-screens.tsx apps/web/src/app/core/core-design.module.css apps/web/tests/core-e2e/core.spec.ts apps/web/tests/core-e2e/usability.spec.ts scripts/design-audit.mjs
git commit -m "feat(web): 우리 집 shows the to-do line and in-progress requests; 내 요청 splits 진행 중 and 끝난 요청

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 4: 소속이 하나면 이름만 글자로

**Files:**
- Modify: `apps/web/src/app/core/login-screen.tsx:49-51`
- Modify: `apps/web/src/app/core/login-screen.test.tsx`
- Modify: `apps/web/tests/core-login-e2e/session.ts` (`twoOrgSession`)
- Modify: `apps/web/tests/core-login-e2e/design.spec.ts:59-66`
- Modify: `apps/web/tests/core-login-e2e/ticket-communication.spec.ts:28-31`
- Modify: `apps/web/tests/core-login-e2e/navigation.spec.ts:75` and `:115-116`

**Interfaces:**
- Produces: 단일 소속의 `organizationField` = `<span className="core-org-label">내 소속</span><strong className="core-org-name">{이름} · {역할}</strong>`. `twoOrgSession(browser: Browser, role?: "ORG_ADMIN"|"PROPERTY_STAFF"|"TENANT")` → `sdkSession`과 같은 모양(조직 A·B에 같은 역할로 속한 계정).

- [ ] **Step 1: 실패하는 단위 시험을 쓴다**

`login-screen.test.tsx`에 더한다.

```tsx
const ORG_A="00000000-0000-4000-8000-00000000000a",ORG_B="00000000-0000-4000-8000-00000000000b";
async function mountAccess(organizations:{id:string;name:string;role:"TENANT"|"ORG_ADMIN"}[]){
  vi.stubGlobal("fetch",vi.fn((input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.endsWith("/api/v2/core/access"))return Promise.resolve(new Response(JSON.stringify({authentication:"B1",synthetic:true,csrf:"c".repeat(64),organizations}),{status:200}));
    // The organisation choice stays pending, so the sign-in column keeps showing the 내 소속 field.
    if(url.endsWith("/api/v2/core/organization"))return new Promise<Response>(()=>{});
    return Promise.resolve(new Response(JSON.stringify({error:"UNAUTHENTICATED"}),{status:401}));
  }));
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<CoreLoginScreen/>));
  await act(async()=>{for(let i=0;i<5;i++)await Promise.resolve();});
  return host;
}

it("a single organisation shows its name as text, with nothing to choose (P5 spec §1)",async()=>{
  const page=await mountAccess([{id:ORG_A,name:"합성 소속 A",role:"TENANT"}]);
  expect(page.querySelector("select")).toBeNull();
  expect(page.querySelector(".core-org-name")?.textContent).toBe("합성 소속 A · 세입자");
});

it("two organisations keep the 내 소속 choice",async()=>{
  const page=await mountAccess([{id:ORG_A,name:"합성 소속 A",role:"ORG_ADMIN"},{id:ORG_B,name:"합성 소속 B",role:"ORG_ADMIN"}]);
  expect([...page.querySelectorAll('select[aria-label="내 소속"] option')].map(option=>option.textContent)).toEqual(["소속을 선택해 주세요","합성 소속 A · 조직 관리자","합성 소속 B · 조직 관리자"]);
});
```

Run: `npm --workspace @build-manager/web run test -- src/app/core/login-screen.test.tsx`
Expected: 첫 시험 FAIL(선택 상자가 있다), 둘째 PASS.

- [ ] **Step 2: 구현한다**

`login-screen.tsx`의 `// One 내 소속 field ...` 주석과 `const organizationField=...` 문장(49–51행)을 아래로 바꾼다. 여러 소속 쪽 JSX는 지금 그대로다.

```tsx
 // One 내 소속 field: in the sign-in column before an organisation is chosen, and in 내 정보 after (rules 8.16). One
 // organisation leaves nothing to choose, so it is its name as text (P5 spec §1, PR 1b).
 const only=access?.organizations.length===1?access.organizations[0]:null;
 const organizationField=only?<><span className="core-org-label">내 소속</span><strong className="core-org-name">{only.name} · {roleName(only.role)}</strong></>:access?.organizations.length?<>{/* 지금의 label·select·안내 문단 그대로 */}</>:null;
```

Run: 같은 시험. Expected: PASS.

- [ ] **Step 3: 두 소속 세션 도우미를 더한다**

`core-login-e2e/session.ts` 끝에 더한다.

```ts
/** An account in organisations A and B with one role (P5 PR 1b): one organisation shows only its name, so checks of the
 * 내 소속 choice need two. */
export async function twoOrgSession(browser:Browser,role:"ORG_ADMIN"|"PROPERTY_STAFF"|"TENANT"="ORG_ADMIN"){
 const session=await sdkSession(browser,"none");
 const actor=(await session.admin.query("SELECT authn.current_actor($1) AS id",[session.digest])).rows[0].id;
 for(const org of [session.fixture.orgA,session.fixture.orgB])await session.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,$3,'ACTIVE')",[org,actor,role]);
 return session;
}
```

`core-login-e2e/navigation.spec.ts`의 두 소속 준비 두 줄(지금 115–116행의 `const actor=...`와 `for (const org ...)`)은 `two`를 `twoOrgSession(browser)`로 만들고 지운다. `import { sdkSession } from "./session";`을 `import { sdkSession, twoOrgSession } from "./session";`으로 바꾼다.

- [ ] **Step 4: 단일 소속 선택 상자에 기대던 검사를 옮긴다**

1. `core-login-e2e/navigation.spec.ts:75`
   - 바꿀 줄: `await expect(account.getByLabel("내 소속", { exact: true })).toBeVisible();`
   - 새 줄: `await expect(account.getByText("내 소속", { exact: true })).toBeVisible(); await expect(account.getByRole("combobox")).toHaveCount(0);`
2. `core-login-e2e/design.spec.ts`
   - 지금 59–66행: `openAccount` 뒤의 `account` 선택 상자 포커스 검사, `.core-org-current` 외곽선 검사 세 줄.
   - 이 자리에는 단일 소속 글자 행 검사를 둔다.

     ```ts
     await openAccount(page);const account=page.getByRole("region",{name:"내 정보"});
     // One organisation: its name as text, nothing to choose (spec §1, PR 1b).
     await expect(account.getByRole("combobox",{name:"내 소속"})).toHaveCount(0);await expect(account.locator(".core-org-name")).toContainText("세입자");
     ```

   - 67행의 `내 정보` 유출 검사는 그대로 둔다.
   - 옮긴 포커스·외곽선 검사는 같은 파일 끝에 새 시험으로 둔다. 59–66행의 검사문을 그대로 옮긴다. import에 `twoOrgSession`을 더한다.

     ```ts
     test("two organisations keep the 내 소속 choice with its focus ring on the wrapped current name",async({browser})=>{
       const two=await twoOrgSession(browser);
       try{
         const page=await two.context.newPage();await page.goto("/core");
         await page.getByLabel("내 소속",{exact:true}).selectOption(two.fixture.orgA);
         await openAccount(page);const account=page.getByRole("region",{name:"내 정보"}).getByRole("combobox",{name:"내 소속"});
         // 옮긴 검사: account.focus() … currentOrg 외곽선 세 줄
       }finally{await two.close();}
     });
     ```

3. `core-login-e2e/ticket-communication.spec.ts`의 "B1 organization change, session replacement and POST logout ..." 시험
   - `const manager=await sdkSession(browser,"manager");` → `const manager=await twoOrgSession(browser);`
   - 첫 줄 `await page.goto("/core");` 바로 뒤에 `await page.getByLabel("내 소속",{exact:true}).selectOption(manager.fixture.orgA);`를 더한다(두 소속이라 자동으로 고르지 않는다).
   - 나머지 줄은 그대로다. import에 `twoOrgSession`을 더한다.

- [ ] **Step 5: 통과를 확인한다**

Run(차례로)
- `npm --workspace @build-manager/web run test -- src/app/core`
- `npm --workspace @build-manager/web run typecheck`
- `npm run test:e2e:sdk -- design.spec.ts ticket-communication.spec.ts navigation.spec.ts`

Expected: 바꾼 시험 통과. `design.spec.ts:53`처럼 호실 선택(호실 200개 초과)에서 멈추는 로컬 실패가 계속되면, 새 검사가 그 단계보다 앞에서 통과했는지 확인한다. 예: 그 뒤 캡처 파일 `b1-tenant-*.png`가 이번 실행 시각에 생겼는지 본다. 결과는 보고서에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/app/core/login-screen.tsx apps/web/src/app/core/login-screen.test.tsx apps/web/tests/core-login-e2e/session.ts apps/web/tests/core-login-e2e/design.spec.ts apps/web/tests/core-login-e2e/ticket-communication.spec.ts apps/web/tests/core-login-e2e/navigation.spec.ts
git commit -m "feat(web): show a single organisation as its name in 내 소속

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 5: 같은 곳으로 닫기와 화면 제목 포커스

**Files:**
- Modify: `apps/web/src/app/core/nav/use-nav-location.ts`
- Modify: `apps/web/src/app/core/nav/use-nav-location.test.tsx`
- Modify: `apps/web/src/app/core/core-screen.tsx` (h1 ref, 포커스 효과, `focusTitle` prop)
- Modify: `apps/web/src/app/core/login-screen.tsx` (`chosen` → `focusTitle`)
- Modify: `apps/web/src/app/core/core-design.module.css:21` (`h1[tabindex]` 포커스 표시)
- Modify: `apps/web/tests/core-e2e/navigation.spec.ts`, `apps/web/tests/core-login-e2e/navigation.spec.ts`

**Interfaces:**
- Produces: 기록 표시 `{ coreNav?: true; detail?: true; samePlace?: true }`. `CoreFlowPage` prop `focusTitle?: boolean`.

- [ ] **Step 1: 실패하는 단위 시험을 쓴다**

`use-nav-location.test.tsx` 끝에 더한다.

```tsx
it("leaving a request through its own place's menu item steps back to that place instead of stacking a copy", async () => {
  window.history.replaceState({ coreNav: true }, "", "/core?tab=requests");
  const view = await mount(tenant);
  await act(async () => showDetailEntry());
  expect(window.history.state).toEqual({ coreNav: true, detail: true, samePlace: true });
  const popped = new Promise(resolve => window.addEventListener("popstate", resolve, { once: true }));
  await act(async () => view.api.current!.go({ tab: "requests", view: null }));
  await act(async () => { await popped; });
  expect(window.history.state).toEqual({ coreNav: true });
  expect(window.location.search).toBe("?tab=requests");
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
});

it("a manager's request opened from 알림 still replaces its entry, so back returns to 알림", async () => {
  window.history.replaceState({ coreNav: true }, "", "/core?tab=alerts");
  const view = await mount(admin), before = window.history.length;
  await act(async () => showDetailEntry("work"));
  expect(window.history.state).toEqual({ coreNav: true, detail: true });
  await act(async () => view.api.current!.go({ tab: "work", view: null }));
  expect(window.history.length).toBe(before + 1);
  expect(window.history.state).toEqual({ coreNav: true });
  expect(window.location.search).toBe("?tab=work");
});
```

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/use-nav-location.test.tsx`
Expected: 첫 시험 FAIL(`samePlace` 없음), 둘째 PASS.

- [ ] **Step 2: 기록 표시를 구현한다**

`use-nav-location.ts`

- `type Entry = { coreNav?: true; detail?: true; samePlace?: true };`
- `marksOnly`에 `if (source.samePlace) out.samePlace = true;`를 더한다.
- `showDetailEntry`

  ```ts
  /** Marks the open request with one history entry, so browser back closes it; a manager's request opens in 업무함.
   * `samePlace`: the entry below shows the same screen, so leaving through that screen's own menu item steps back to it
   * instead of leaving two identical entries (final review of PR 139). */
  export function showDetailEntry(tab?: TabId) {
    if (entry().detail) return;
    const href = tab ? navHref({ tab, view: null }) : here();
    write("push", href === here() ? { coreNav: true, detail: true, samePlace: true } : { coreNav: true, detail: true }, href);
  }
  ```

- `go`

  ```ts
  const go = useCallback((next: NavLocation) => {
    const top = entry();
    if (top.detail && top.samePlace && sameLocation(next, location)) {
      // The screen below is this one: step back to it, then show its top (rules 8.14).
      const toTop = () => { window.removeEventListener("popstate", toTop); window.scrollTo({ top: 0 }); };
      window.addEventListener("popstate", toTop); window.history.back(); return;
    }
    if (top.detail) write("replace", { coreNav: true }, navHref(next));
    else if (!sameLocation(next, location)) write("push", { coreNav: true }, navHref(next));
    window.scrollTo({ top: 0 });
  }, [location]);
  ```

- `go`의 문서 주석에 "A request opened over the same place steps back instead." 한 문장을 더한다.

Run: 같은 시험. Expected: PASS(기존 시험 포함).

- [ ] **Step 3: 화면 제목 포커스를 구현한다**

`core-screen.tsx`

- props에 `focusTitle?:boolean`을 더한다.
  - 타입: `{b1?:…;onDenied?:…;onLogout?:…;account?:CoreAccount;focusTitle?:boolean}`
  - 구조 분해: `{b1,onDenied,onLogout,account,focusTitle}`
- `detailHeading` 옆에 `titleRef=useRef<HTMLHeadingElement>(null)`을 더한다.
- `useEffect(()=>{if(selected?.ticketId)detailHeading.current?.focus();},[selected?.ticketId]);` 줄 바로 아래(단, `location`·`selected`·`navContext`·`session`이 정의된 뒤여야 하므로 `const location=nav.location,...` 줄 아래가 맞으면 그 아래)에 더한다.

  ```tsx
  // When the place changes from inside the content (a 더 보기 or 내 정보 row, closing a request), the control that had
  // focus is gone. Focus the new screen's title instead of leaving it on the page body (final review of PR 139).
  const place=`${tab}|${view??""}|${selected?"detail":""}`,lastPlace=useRef<string|null>(null);
  useEffect(()=>{if(!navContext)return;const before=lastPlace.current;lastPlace.current=place;if(before===null||before===place||selected)return;
    const active=document.activeElement;if(!active||active===document.body)titleRef.current?.focus({preventScroll:true});},[navContext,place,selected]);
  // After an organisation is chosen the whole page is new: start keyboard and screen reader at its title, once.
  const titleFocused=useRef(false);
  useEffect(()=>{if(focusTitle&&session&&!titleFocused.current){titleFocused.current=true;titleRef.current?.focus({preventScroll:true});}},[focusTitle,session]);
  ```

  React 훅 규칙(조건 없이 같은 순서로 부름)을 지킨다. `return` 앞의 계산 줄들(`location`, `tab`, `view`)보다 아래에 두되 JSX 반환보다 위에 둔다.
- `<h1>{title}</h1>`을 `<h1 ref={titleRef} tabIndex={-1}>{title}</h1>`로 바꾼다.

`core-design.module.css:21`의 포커스 표시 목록 `h2[tabindex]` 옆에 `h1[tabindex]`를 더한다.

`login-screen.tsx`

- `const [chosen,setChosen]=useState(false);`를 더한다.
- `select` 함수 맨 앞에서 `setChosen(true);`을 부른다(자동 선택 `load()`는 부르지 않음).
- `CoreFlowPage`에 `focusTitle={chosen}`을 넘긴다.

- [ ] **Step 4: 화면 시험을 더한다**

`core-e2e/navigation.spec.ts`

- `let ownTenant = "";` 아래에 `let tenantCode = "";`을 더한다.
- `beforeAll` 안에 `tenantCode = await mintOwnSession("tenant");`을 더한다. 로그아웃 시험이 `ownTenant`를 끝내므로, 아래 시험들은 `tenantCode`를 쓴다.
- 파일 끝에 더한다.

```ts
const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });
async function createOwn(page: Page, text: string) {
  const units = await (await page.request.get("/api/v2/core/units", { headers: bearer(tenantCode) })).json() as { id: string }[];
  const response = await page.request.post("/api/v2/core/tickets", { headers: bearer(tenantCode), data: { unitId: units[0].id, issueType: "LEAK", rawUserText: text } });
  expect(response.status()).toBe(201); return (await response.json() as { ticketId: string }).ticketId;
}

test("closing a request through its own tab leaves no dead back step (final review of PR 139)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createOwn(page, "합성 같은 탭으로 닫기"); await login(page, tenantCode); await expect(page).toHaveURL(/tab=home$/);
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click(); await expect(page).toHaveURL(/tab=requests$/);
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click();
  await expect(page.getByTestId("ticket-heading")).toHaveCount(0); await expect(page).toHaveURL(/tab=requests$/);
  await page.goBack(); await expect(page).toHaveURL(/tab=home$/);
});

test("opening a 더 보기 row puts focus on the new screen's title", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, (await accessCodes()).manager);
  await menu(page).getByRole("link", { name: "더 보기", exact: true }).click();
  await page.getByRole("region", { name: "더 보기", exact: true }).getByRole("link", { name: "호실 정비 이력", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "호실 정비 이력" })).toBeFocused();
});

test("closing a request with the back button puts focus on the list's title", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await createOwn(page, "합성 닫은 뒤 포커스"); await login(page, tenantCode);
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click(); await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "내 요청" })).toBeFocused();
});
```

`core-login-e2e/navigation.spec.ts`의 두 소속 시험에서, 내 정보에서 orgB로 바꾼 뒤 줄 끝에 `await expect(admin.getByRole("heading", { level: 1, name: "업무함" })).toBeFocused();`를 더한다.

- [ ] **Step 5: 통과를 확인한다**

Run(차례로)
- `npm --workspace @build-manager/web run test -- src/app/core`
- `npm --workspace @build-manager/web run typecheck`
- `npm run test:e2e:core -- navigation.spec.ts home.spec.ts`
- `npm run test:e2e:sdk -- navigation.spec.ts`

Expected: PASS(SDK는 로컬 시험 데이터 실패만 예외).

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/app/core/nav/use-nav-location.ts apps/web/src/app/core/nav/use-nav-location.test.tsx apps/web/src/app/core/core-screen.tsx apps/web/src/app/core/login-screen.tsx apps/web/src/app/core/core-design.module.css apps/web/tests/core-e2e/navigation.spec.ts apps/web/tests/core-login-e2e/navigation.spec.ts
git commit -m "fix(web): close a request into its own place in one back step and keep focus on the screen title

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 6: 넓은 화면 제목 크기와 연결 화면의 상단 바 하나

**Files:**
- Modify: `apps/web/src/app/core/core-screen.tsx` (머리글 `data-menu-screen`)
- Modify: `apps/web/src/app/core/core-design.module.css` (끝에 한 규칙, 연결 화면 머리글 규칙)
- Modify: `apps/web/src/app/core/onboarding-panel.tsx`, `apps/web/src/app/core/onboarding-panel.test.tsx`
- Modify: `apps/web/tests/core-e2e/navigation.spec.ts`, `apps/web/tests/core-login-e2e/design.spec.ts:41-43`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`onboarding-panel.test.tsx` 끝에 더한다.

```tsx
describe("onboarding panel inside the P5 menu", () => {
  const props = { csrf: "c".repeat(64), orgId: "00000000-0000-4000-8000-00000000000a", onRefreshAccess: () => undefined, onDenied: () => undefined };
  it("draws no second top bar and keeps its own refresh in the content", () => {
    const html = renderToStaticMarkup(<OnboardingPanel {...props} manager embedded />);
    expect(html).not.toContain("<header");
    expect(html).toContain("연결 상태 새로고침");
  });
  it("on its own keeps its titled top bar", () => {
    const html = renderToStaticMarkup(<OnboardingPanel {...props} manager={false} />);
    expect(html).toMatch(/<header[^>]*><h1>호실 연결<\/h1>/);
  });
});
```

`core-e2e/navigation.spec.ts` 끝에 더한다.

```ts
test("from 768px a screen the left menu lists keeps the first-screen title (rules 8.10)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await login(page, (await accessCodes()).manager);
  const font = () => page.getByRole("heading", { level: 1 }).evaluate(h => { const s = getComputedStyle(h); return `${s.fontSize} ${s.fontWeight} ${s.letterSpacing}`; });
  const first = await font();
  await menu(page).getByRole("link", { name: "호실 정비 이력", exact: true }).click(); await expect(page.getByRole("heading", { level: 1, name: "호실 정비 이력" })).toBeVisible();
  expect(await font()).toBe(first);
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "15px");
});
```

Run
- `npm --workspace @build-manager/web run test -- src/app/core/onboarding-panel.test.tsx`
- `npm run test:e2e:core -- navigation.spec.ts -g "first-screen title"`

Expected: 단위 첫 시험 FAIL(`<header>`가 있다), 화면 시험 FAIL(15px로 다르다).

- [ ] **Step 2: 구현한다**

`core-screen.tsx`의 `<header className={styles.heading} data-testid="unit-context" data-sub={sub?"true":undefined}>`에 `data-menu-screen={view&&navContext&&inLeftMenu(navContext,view)?"true":undefined}`를 더한다.

`core-design.module.css` 맨 끝(`.root .heading[data-sub="true"] h1` 규칙 뒤)에 더한다.

```css
/* From 768px a screen the left menu lists is a first screen (rules 8.10), so its title matches 업무함's and 알림's. */
@media (min-width: 768px) { .root .heading[data-menu-screen="true"] h1 { font-size: 1.25rem; line-height: 1.875rem; font-weight: 700; letter-spacing: -0.02em; } }
```

`onboarding-panel.tsx`의 머리글 줄을 바꾼다.

```tsx
  <div id="core-invitations">{embedded?null:<header className={styles.heading}><h1>{manager?"입주 연결":"호실 연결"}</h1><button disabled={busy} onClick={()=>void run(load)}>연결 상태 새로고침</button></header>}
   <p>초대는 24시간 동안 유효해요. 로그인 후 신청하고 관리자가 확인 번호와 호실을 확인해야 연결돼요.</p>
   {/* Inside the P5 menu the page's top bar is the only bar; this refresh moves into the content (final review of PR 139). */}
   {embedded?<button disabled={busy} onClick={()=>void run(load)}>연결 상태 새로고침</button>:null}
```

`embedded` prop 주석을 "Inside the P5 menu the page's top bar names the screen, so the panel draws no bar of its own."로 고친다.

`core-login-e2e/design.spec.ts`의 제목 크기 검사(지금 41–43행 `const sub=…` 두 줄)를 아래로 바꾼다.

```ts
const header=page.getByTestId("unit-context"),sub=await header.getAttribute("data-sub")==="true"&&!(viewport.width>=768&&await header.getAttribute("data-menu-screen")==="true");
await expect(workspace.getByRole("heading",{level:1})).toHaveCSS("font-size",sub?"15px":"20px");
```

- [ ] **Step 3: 통과를 확인한다**

Run(차례로)
- `npm --workspace @build-manager/web run test -- src/app/core`
- `npm run test:e2e:core -- navigation.spec.ts`
- `npm run test:e2e:sdk -- onboarding.spec.ts design.spec.ts`

Expected: PASS(SDK의 로컬 시험 데이터 실패만 예외). `onboarding.spec.ts`는 버튼 이름으로 누르므로 그대로 통과해야 한다.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/core/core-screen.tsx apps/web/src/app/core/core-design.module.css apps/web/src/app/core/onboarding-panel.tsx apps/web/src/app/core/onboarding-panel.test.tsx apps/web/tests/core-e2e/navigation.spec.ts apps/web/tests/core-login-e2e/design.spec.ts
git commit -m "fix(web): left-menu screens keep the first-screen title from 768px; the link screens draw one top bar

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 7: 손으로만 확인하던 것을 자동 시험으로

**Files:**
- Modify: `apps/web/tests/core-e2e/navigation.spec.ts`

PR #139은 세 가지를 손으로만 확인했다(수락 기록 "Not verified"). 화면 코드는 바꾸지 않는다. 시험이 실패하면 화면 문제이므로 고치지 말고 보고한다(NEEDS_CONTEXT).

- [ ] **Step 1: 시험을 더한다**

```ts
const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#759cac" } }).png().toBuffer();

test("a focused control on a first screen is never under the tab bar (rules 8.14)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 }); await login(page, tenantCode);
  await page.getByLabel("문제 설명").fill("합성 탭바 가림 확인");
  const submit = page.getByRole("button", { name: "접수하기", exact: true });
  await page.getByLabel("문제 설명").focus();
  for (let i = 0; i < 12 && !(await submit.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  const bar = (await menu(page).boundingBox())!, box = (await submit.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
});

test("on a wide screen a menu click keeps a request with unsent photos open (spec §3)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createOwn(page, "합성 미전송 사진과 메뉴"); await login(page, tenantCode);
  await menu(page).getByRole("link", { name: "내 요청", exact: true }).click();
  await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click(); await expect(page.getByTestId("ticket-heading")).toBeVisible();
  await page.getByLabel("참고 사진 선택", { exact: true }).setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: await png() });
  await menu(page).getByRole("link", { name: "우리 집", exact: true }).click();
  await expect(page.getByTestId("ticket-heading")).toBeVisible(); await expect(page).toHaveURL(/tab=requests$/);
  await expect(page.getByText("목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.", { exact: true })).toBeVisible();
});

test("at 320px with 200% text every tab label stays on one line inside its cell (rules 8.14, 12)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await login(page, tenantCode);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const cells = await menu(page).getByRole("link").evaluateAll(links => links.filter(a => a.getClientRects().length).map(a => {
    const label = a.querySelector("span")!;
    return { text: label.textContent, lines: label.getClientRects().length, fits: label.getBoundingClientRect().width <= a.getBoundingClientRect().width + 0.5 };
  }));
  expect(cells.map(cell => cell.text)).toEqual(["우리 집", "내 요청", "알림", "내 정보"]);
  for (const cell of cells) expect(cell).toMatchObject({ lines: 1, fits: true });
});
```

import에 `import sharp from "sharp";`을 더한다.

- [ ] **Step 2: 통과를 확인한다**

Run: `npm run test:e2e:core -- navigation.spec.ts`
Expected: PASS. 처음 둘 중 하나가 실패하면 화면 코드를 고치지 말고 실패 내용을 보고한다. 셋째는 PR #139 때 손으로 잰 값(80px 칸에 약 73.6px)과 맞아야 한다.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/tests/core-e2e/navigation.spec.ts
git commit -m "test(web): automate the P5 checks that were measured by hand

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 8: 스펙과 디자인 현황

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`
- Modify: `design/DESIGN_STATUS.md`

- [ ] **Step 1: 스펙을 고친다**

1. 1절 '내 정보' 목록 아래 첫 글머리: "이 글자 전용 행은 PR 1b에서 들어간다. PR 1a까지는 …(괄호 포함)"을 "이 글자 행은 PR 1b에서 넣었다. 선택 상자를 확인하는 화면 시험은 두 소속 세션으로 옮겼다."로 바꾼다.
2. 4절 우리 집 4번 진행 중 요청 아래에 글머리 셋을 더한다.
   - "카드는 묶음 상자가 아니라 목록 행(규칙 8.5)이다. 구역 이름은 `진행 중인 요청`이고 제목 옆에 전체 건수를 쓴다."
   - "제출 전 요청은 상태 표시가 이미 '제출 전'이라, 다른 이유가 없으면 다음 할 일을 '아직 보내지 않았어요. 열어서 제출해 주세요.'로 쓴다(구현 계획 결정)."
   - "고른 사진이 있어 행이 잠기면 우리 집·내 요청·알림 위에 '고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요.'를 보인다."
3. 4절 우리 집 2번 뒤에 "(보조 버튼 모양의 링크, 규칙 8.1)"을 더한다.
4. 3절 요청 상세 글머리(`history.state`에 상세 표시만)에 "같은 화면 위에 열었으면 `samePlace` 표시를 하나 더 둔다. 그 화면의 메뉴 항목을 누르면 기록을 하나 되돌아가므로, 뒤로 가기가 같은 화면을 한 번 더 보이지 않는다."를 더한다.
5. 위협 표의 "브라우저 기록 상태를 꾸밈" 행: "기록 상태에는 '상세를 열었음'·'같은 화면 위' 불리언 표시만 있다."로 고친다.
6. 범위 절 첫 문단 끝에 "PR 1b(이 묶음의 우리 집 카드·내 요청 두 묶음·처리할 일 한 줄·소속 글자 행)의 구현 계획은 `docs/superpowers/plans/2026-10-13-navigation-shell-p5-home.md`이다."를 더한다.

- [ ] **Step 2: 현황을 고친다**

`design/DESIGN_STATUS.md` '내비게이션' 첫 글머리 뒤에 줄 하나를 더한다.

"우리 집의 처리할 일 한 줄·진행 중인 요청, 내 요청의 '진행 중'·'끝난 요청', 소속이 하나일 때의 글자 행은 PR 1b에서 넣었습니다."

- [ ] **Step 3: 확인하고 커밋한다**

Run: `PYTHONPATH="$PWD" PYTHONIOENCODING=utf-8 python scripts/verify_repository.py`
Expected: `"result": "PASS"`.

```bash
git add docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md design/DESIGN_STATUS.md
git commit -m "docs(p5): record the PR 1b decisions in the spec and the design status

Co-Authored-By: <작업 환경이 정한 공동 작성자 줄>"
```

---

### Task 9: 전체 검사, 망가뜨려 보기, 리뷰, 기록, 병합

**Files:**
- Create: `ops/navigation_shell_p5_home_20261013_acceptance.md`
- Modify: `ops/AI_Execution_Log.csv` (행 추가만, Edit 도구, UTC `+00:00`)

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
node --experimental-transform-types scripts/design-audit.mjs "$HOME/.build-manager-rc1-private/p5-home"
```

- Expected: 모두 통과. 예외는 PR #139 기록의 알려진 것뿐이다.
  - 로컬 시험 데이터 실패: 요청 2,000건 이상, 호실 200개 초과, 초대 쪽수.
  - 그래프 경계 시험의 5초 초과(#119). 전체 실행에서 나면 `tests/architecture`만 같은 설정으로 다시 돌려 확인한다.
- 디자인 점검 뒤 390px·1280px의 `tenant-intake`, `tenant-requests` 캡처를 직접 열어 본다.

- [ ] **Step 2: 일부러 망가뜨려 시험이 잡는지 본다**

하나씩 바꾸고, 그 시험이 실패하는지 보고, `git checkout -- <파일>`로 되돌린다.

| 망가뜨리기 | 잡아야 하는 시험 |
| --- | --- |
| `tenant-home.ts` 정렬에서 `rank(a) - rank(b) \|\|`를 지움(처리할 일 먼저를 없앰) | `tenant-home.test.ts` "puts to-dos first …" |
| `tenantNextStep`에서 `.filter(reason => reason !== "DRAFT")`를 지움 | `tenant-home.test.ts` "does not repeat 제출 전 …" |
| `use-nav-location.ts` `go`의 `samePlace` 분기를 지움 | `use-nav-location.test.tsx` "leaving a request through its own place's menu item …" |
| `login-screen.tsx`의 `only?` 분기를 지움(늘 선택 상자) | `login-screen.test.tsx` "a single organisation shows its name as text …" |

결과 표를 PR 본문과 수락 기록에 넣는다.

- [ ] **Step 3: 새 문맥 독립 리뷰(DEV-04 5단계)**

리뷰 에이전트(새 문맥, 가장 강한 모델)에 아래를 준다.
- 스펙, 이 계획, `git diff origin/main...HEAD`
- 이 묶음에서 미뤄 둔 사소한 지적 목록

다음을 보게 한다.
- 규칙 4절·8.1·8.5·8.10·8.14·8.15·12 준수
- 기록 상태와 포커스
- 접근성
- 회귀(FROZEN 화면 시험을 바꾼 이유)
- 해요체

지적은 한 번에 고치고, 고친 부분만 다시 리뷰받는다(delta).

- [ ] **Step 4: 수락 기록(DEV-04 6단계)**

`ops/navigation_shell_p5_20261013_acceptance.md`(PR #139)의 구성을 따라 `ops/navigation_shell_p5_home_20261013_acceptance.md`를 쓴다.
- `TARGET_REF`, `POLICY_REF`(main의 규칙 커밋)
- 운영자 승인: 2026-10-13 스펙 승인, PR 1b 진행 "그래 다음 계획 ㄱ"
- 이 계획이 새로 정한 문구 세 가지
- FROZEN 시험을 바꾼 범위와 이유(Task 3·4·6)
- 실행한 검사와 결과(Step 1), 망가뜨려 보기(Step 2), 리뷰 결과(Step 3)
- 알려진 로컬 실패, 데모 배포 안 함
- 남은 일
  - PR 2: 요청별 이유 다섯 가지, 관리자 대화 요약을 업무함과 같이 읽기
  - 소속을 바꾸는 동안 로그인 칸이 잠깐 보이는 것
  - 우리 집 상단 바 61px 기록

`ops/AI_Execution_Log.csv`에는 Edit 도구로 행만 더한다. 기존 행을 다시 쓰지 않는다. main과 충돌하면 main 행을 먼저 둔다.

- [ ] **Step 5: PR을 연다**

```bash
git fetch origin && git merge --no-edit origin/main   # main이 움직였으면. 충돌은 main 행 먼저.
git push -u origin feat/navigation-shell-p5-home
gh pr create --base main --title "feat(web): P5 PR 1b — 우리 집 in-progress requests, 내 요청 in two groups, single-organisation name" --body-file <scratchpad의 본문 파일>
```

본문은 한국어로 쓴다. 넣을 것:
- 목적, 스펙·계획 링크
- 바뀐 화면. 390px·1280px 캡처는 직접 보고 첨부하지 않는다(이전 PR들과 같음).
- 바꾼 시험 파일과 이유
- 새로 정한 문구
- 검사 결과, 망가뜨려 보기 표
- 알려진 로컬 실패
- 데모 배포 안 함(PR 2까지 끝난 뒤 묻는다)
- 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

- [ ] **Step 6: CI 통과 후 병합한다**

정확한 head에서 CI(`app-check.yml`, `repository-check.yml`)가 통과하면 아래로 병합한다.

```bash
gh pr merge <번호> --merge --match-head-commit <head SHA>
```

- CI가 실패하면 원인을 찾아 고치고, 같은 방식으로 범위 리뷰를 받고, PR 댓글에 경과를 남긴다.
- 병합 뒤 바깥 체크아웃을 앞으로 감는다.
  - 명령: `node "$LOCALAPPDATA/build-manager-maintenance/outer-ff.cjs" <병합 커밋 전체 SHA> outer-checkout-update-20261010-<N>`
  - `<N>`: 2026-10-13 현재 -35까지 썼다. 먼저 `outer-checkout-update-20261010-*` 목록을 확인하고 다음 번호를 쓴다.

- [ ] **Step 7: 운영자에게 보고한다**

쉬운 한국어로 보고한다.
- 무엇이 바뀌었는지: 우리 집의 진행 중 요청과 처리할 일 한 줄, 내 요청 두 묶음, 소속 이름
- 검사 결과
- 남은 일(PR 2)
- 데모에는 아직 올리지 않았다는 것

## 자체 점검 결과(계획 작성 뒤)

- 스펙 대응
  - 4절 우리 집: 1번은 기존 그대로, 2번 Task 3, 3번은 기존 그대로, 4번 Task 1·3, 5번은 기존 그대로.
  - 4절 내 요청: Task 3. 4절 빈 화면 표의 내 요청 두 줄: Task 3.
  - 1절 소속 글자 행: Task 4.
  - PR #139 끝 리뷰가 PR 1b로 미룬 것
    - 같은 탭으로 닫을 때 생기는 빈 기록: Task 5
    - 포커스: Task 5
    - 잠긴 행의 이유: Task 3
    - 넓은 화면 제목 크기: Task 6
    - 연결 화면의 상단 바 두 개: Task 6
    - 손으로만 확인한 셋: Task 7
- 이름 일관성
  - `homeCards`·`tenantNextStep`·`HOME_CARD_LIMIT`은 Task 1에서 만들고 Task 3에서 쓴다.
  - `notice`는 Task 3에서 만들고 같은 Task에서 쓴다.
  - `twoOrgSession`은 Task 4에서 만들고 Task 4·5에서 쓴다.
  - `mintOwnSession`·`accessCodes`는 Task 2에서 만들고 Task 2·5·6·7에서 쓴다.
  - `samePlace`는 Task 5에서 만든다. `focusTitle`은 Task 5에서 만들고 같은 Task에서 넘긴다.
  - `tenantCode`·`createOwn`·`png`는 Task 5·7에서 `navigation.spec.ts` 안에 만들고 같은 파일에서 쓴다.
- 이 계획이 정한 것(Task 8에서 스펙에 적음)
  - 진행 중 요청은 목록 행, 구역 이름 `진행 중인 요청`
  - 제출 전 요청의 다음 할 일 문구
  - 잠김 안내 문구
  - 처리할 일 한 줄은 보조 버튼 모양 링크
  - 연결 화면의 새로고침은 내용 안 버튼으로 남김(이름으로 누르는 화면 시험이 그대로 통과)
  - `samePlace` 기록 표시
- 범위 밖으로 남김
  - 소속 전환 중 로그인 칸 깜빡임
  - 우리 집 상단 바 61px를 규칙 16절에 적기
  - PR 2 항목

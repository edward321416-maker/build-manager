# P5 PR 2: 처리할 일 보강 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 알림의 처리할 일에 이유 다섯 가지(방문 시간 확정 필요, 결과 확인 필요, 업체 확인 필요, 기한 지남, 연결 요청 확인 필요)를 더한다. 요청마다 읽기는 동시에 4개까지, 끝난 요청은 최근 20건까지만 읽는다. 읽지 못한 것은 "일부를 확인하지 못했어요"로 알린다.

**Architecture:**
- 읽을 대상 고르기, 읽기, 결과 합치기는 순수 함수 파일 `nav/todo-extras.ts`가 맡는다. 서버 호출은 넘겨받은 `reads` 함수로만 한다.
- 훅 `nav/use-todo-extras.ts`가 정해진 시점에 그 함수를 돌린다.
- `buildTodoList`가 PR 1 이유와 새 이유를 한 목록으로 합친다. 연결 요청도 그 목록의 행이 된다.
- `core-screen.tsx`에는 요청마다 읽기 전용 클라이언트를 하나 더 만든다. 이 클라이언트는 403을 "배정 없음"으로 보고 로그아웃하지 않는다.

**Tech Stack:** Next.js 16, React 19, CSS Modules, vitest 5(jsdom), Playwright 1.63.
- `test:e2e:core`: 개발 모드, 포트 3131
- `test:e2e:sdk`: B1, 포트 3133
- `test:e2e:vendor`

## Global Constraints

- **스펙**: `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`(운영자 2026-10-13 승인). 이 계획은 그중 "PR 2: 처리할 일 보강"과 5절의 PR 2 줄을 만든다.
- **위험 등급**: 고위험(DEV-04). FROZEN `/core` 화면과 그 시험을 바꾼다.
- **배포**: 데모 배포는 이 계획에 없다. 스펙에 따라 P5 묶음이 모두 병합된 뒤 운영자에게 묻는다.
- **바꾸지 않는 것**: 새 패키지, 새 API, DB, 서버 코드.
- **이유 이름**: 스펙 5절 표 그대로 쓰고 `status-names.ts`의 `TODO_REASON_NAMES`에 둔다(규칙 8.7).
  - `VISIT`: `방문 시간 확정 필요`
  - `RESULT`: `결과 확인 필요`
  - `VENDOR`: `업체 확인 필요`
  - `OVERDUE`: `기한 지남`
  - `LINK`: `연결 요청 확인 필요`
- **정렬**(스펙 5절): 긴급 확인 → 기한 지남 → 내 답변·관리자 답변·처리 방법 결정 → 나머지. 같은 무리 안에서는 최근 활동 순이다.
- **읽기 한도**(스펙 5절)
  - 요청마다 읽기는 동시에 4개까지다.
  - 결과는 최근 끝난 요청 20건만 읽는다.
  - 연결 요청은 5쪽(20개씩, 100개)까지 읽는다.
- **실패와 권한**(스펙 5절)
  - 요청마다 읽기의 403·404는 실패로 세지 않는다. 401은 다시 로그인 흐름으로 보낸다.
  - 목록 단위로 읽는 것(업무 목록, 연결 요청 목록)의 401·403은 다시 로그인 흐름으로 보낸다.
  - 그 밖의 오류는 목록을 일부만 확인한 상태로 만든다.
- **배지**: 확인된 행만 센다(스펙 5절).
- **읽는 시점**(스펙 5절)
  - 요청 목록을 불러온 직후와 그 목록이 바뀐 뒤(저장 같은 변경 뒤)
  - 새로고침, 알림 탭을 열 때
  - 주기적으로, 또는 창에 돌아올 때마다 읽지 않는다.
- **정해진 문구**(스펙 5절, 그대로 쓴다): `최근 끝난 요청 20건만 확인해요.`, `일부를 확인하지 못했어요.`, `다시 불러오기`
- **이 계획이 새로 정하는 문구**(Task 6에서 스펙에 적는다)
  - 연결 요청 행 제목: `입주 연결 · <호실 이름>`
  - 아직 읽는 중일 때 목록 아래: `처리할 일을 더 확인하고 있어요.`
  - 연결 요청이 100건을 넘을 때: `연결 요청은 100건까지만 확인했어요. 입주 연결에서 모두 볼 수 있어요.`
- **화면 규칙**
  - 화면 값은 디자인 규칙의 토큰과 글자 스타일만 쓴다.
  - 누르는 칸은 50×50 이상, 목록은 행(8.5), 문구는 해요체다. `haeyo-copy.test.ts`가 `app/core` 아래 모든 파일을 본다.
- **문서와 커밋에 적지 않는 것**: 데모 주소나 IP, 이메일 주소.
- **커밋 끝줄**: 어느 모델이 작업하든 이 줄을 쓴다. 꺾쇠 안에는 작업 환경이 정한 주소를 넣는다. 이 문서에는 주소를 적지 않는다(저장소 검사가 지난 커밋의 문서까지 본다).
  ```
  Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>
  ```
- **파일 고치기**
  - 저장소 파일(`apps/**`, `scripts/**`, `design/**`, `docs/**`)은 Edit/Write 도구로만 고친다.
  - 바꾼 경로만 이름으로 스테이징한다. `git add -A`, `git add .`은 쓰지 않는다.
  - amend, force push, 이력 고쳐 쓰기를 하지 않는다.
- **시험 실행**
  - 브라우저 시험과 vitest를 동시에 돌리지 않는다. 5초 시험이 부하로 실패한다.
  - 로컬 공용 시험 데이터는 지우지 않는다. 데이터 삭제는 운영자 승인이 필요하다.

## 작업 위치와 기준

- 작업 트리: `worktree/build-manager-mobile-design`
- 가지: `feat/navigation-shell-p5-reasons`(main `060950d`에서 만듦)
- `POLICY_REF`: main `060950d`
- 비교 기준: 디자인 점검은 PR #145 끝의 결과(231개 화면, 발견 0건)와 비교한다.

## 코드에서 확인한 사실 (2026-10-14, main `060950d`)

계획의 판단 근거다. 구현자는 다시 확인하지 않아도 된다.

- 세입자 업체 일정 읽기(`GET /api/v2/core/tickets/:id/vendor-scheduling`)
  - 배정이 없거나 세입자가 지금 입주자가 아니면 404다(`vendor_handoff.tenant_read`, `core_flow.vendor_handoff_tenant_context`).
  - 배정은 업체에 제안될 때 요청을 처리 중(`IN_PROGRESS`)으로 바꾼다(`core_flow.vendor_handoff_mark_offered`). 그래서 방문 시간을 기다리는 요청은 늘 처리 중이다.
- 관리자 업체 전달 읽기(`GET /api/v2/core/manager/tickets/:id/vendor-handoff`)
  - 배정이 없으면 `assignment: null`, `waitingOn: "NONE"`이다.
  - 요청을 볼 수 없으면 404다(`vendor_handoff.manager_read`).
  - 지금 배정은 가장 최근 배정이다(`ORDER BY created_at DESC`).
  - `waitingOn = MANAGER`는 업체가 완료를 보고했거나 막힘을 관리자가 봐야 할 때다(`0023_vendor_handoff_manager_actions.sql`).
- 결과 읽기(`GET /api/v2/core/tickets/:id/outcome`): 개발 모드와 B1 모두 있다. 세입자가 아직 답하지 않으면 `kind: "UNCONFIRMED"`이다.
- 업무 목록(`client.manager.list()`)
  - 관리자 두 역할 모두 읽는다.
  - 기한 지남 판단은 `manager-work-order.ts`의 `isOverdue(item, now)`를 그대로 쓴다.
- 연결 요청 목록(`createCoreOnboardingClient({csrf, orgId}).list(cursor)`): 20개씩 ID 순이다. 상태 `REQUESTED`가 관리자 승인을 기다리는 요청이다.
- 지금 `core-screen.tsx`의 클라이언트
  - 모든 401·403에서 화면을 비우고 다시 로그인으로 보낸다(`/session`만 예외).
  - 요청마다 읽기에 그대로 쓰면 403 하나로 로그아웃된다. 그래서 요청마다 읽기용 클라이언트를 따로 만든다.
- B1에서 401을 받으면 로그인 화면은 `세션이 만료되었거나 접근 권한이 변경됐어요.`로 시작하는 문구를 보인다(`login-screen.tsx`의 `denied`).

## 파일 구조

| 파일 | 할 일 |
| --- | --- |
| Modify `apps/web/src/components/status-names.ts` | 새 이유 이름 다섯 개 |
| Modify `apps/web/src/app/core/nav/todo-list.ts` (+ test) | 이유 종류, 연결 요청 행, 새 이유 합치기, 정렬 무리, 읽기 상태 전달 |
| Modify `apps/web/src/app/core/nav/tenant-home.ts` (+ test) | 연결 요청 행을 건너뜀 |
| Modify `apps/web/src/app/core/nav/nav-screens.tsx` | 연결 요청 행, 읽는 중·한도 안내 |
| Modify `apps/web/src/app/core/nav/core-nav.module.css` | 링크로 된 처리할 일 행 |
| Modify `apps/web/src/app/core/nav/core-nav.test.tsx` | 알림 화면 그리기 시험 |
| Modify `scripts/design-audit.mjs` | 연결 요청 행도 왼쪽 맞춤 예외 |
| Create `apps/web/src/app/core/nav/todo-extras.ts` (+ test) | 읽을 대상, 읽기(동시 4개), 실패 분류, 역할별 읽기 |
| Create `apps/web/src/app/core/nav/use-todo-extras.ts` (+ test) | 읽는 시점과 최신 결과만 반영 |
| Modify `apps/web/src/app/core/core-screen.tsx` | 요청마다 읽기용 클라이언트, 연결 요청 읽기, 훅 연결, 홈 다음 할 일이 읽기를 기다림 |
| Create `apps/web/tests/core-e2e/todo-extras.spec.ts` | 결과 확인, 20건·동시 4개, 기한 지남(개발 모드) |
| Modify `apps/web/tests/core-login-e2e/navigation.spec.ts` | 요청마다 읽기의 403·500·401(B1) |
| Modify `apps/web/tests/core-login-e2e/onboarding.spec.ts` | 연결 요청 처리할 일(B1) |
| Modify `apps/web/tests/vendor-e2e/vendor-job.spec.ts` | 방문 시간 확정 필요, 업체 확인 필요(B1, 업체 흐름) |
| Modify `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`, `design/DESIGN_STATUS.md` | 결정과 현황 |
| Create `ops/navigation_shell_p5_reasons_20261014_acceptance.md`, Modify `ops/AI_Execution_Log.csv` | 수락 기록 |

---

### Task 0: 준비

**Files:** 없음(확인만)

- [ ] **Step 1: 가지와 기준 확인**

Run: `git status --short && git log --oneline -1 && git rev-parse --abbrev-ref HEAD`
Expected: 깨끗한 트리, 가지 `feat/navigation-shell-p5-reasons`. 이 계획 커밋이 `060950d` 위에 있다.

- [ ] **Step 2: 규칙집을 읽는다**

`design/DESIGN_RULES.md`와 `development/DEVELOPMENT_RULES.md`를 처음부터 끝까지 Read 도구로 읽는다. 프로젝트 훅이 막으면 그 규칙집을 다시 읽고 재시도한다.

---

### Task 1: 처리할 일 목록에 새 이유와 연결 요청 행

**Files:**
- Modify: `apps/web/src/components/status-names.ts:17-20`
- Modify: `apps/web/src/app/core/nav/todo-list.ts`(전체)
- Modify: `apps/web/src/app/core/nav/todo-list.test.ts`
- Modify: `apps/web/src/app/core/nav/tenant-home.ts:19-20`, `apps/web/src/app/core/nav/tenant-home.test.ts`
- Modify: `apps/web/src/app/core/nav/nav-screens.tsx`(`TodoScreen`)
- Modify: `apps/web/src/app/core/nav/core-nav.module.css:43-47,85,88`
- Modify: `apps/web/src/app/core/nav/core-nav.test.tsx:89-116`
- Modify: `apps/web/src/app/core/core-screen.tsx:33,143,383`(빈 목록 값과 새 속성만)
- Modify: `scripts/design-audit.mjs:19,159`

**Interfaces:**
- Produces (`nav/todo-list.ts`, 뒤 Task가 이 이름 그대로 쓴다)
  - `type TodoReason = "SAFETY" | "OVERDUE" | "REPLY" | "DECIDE" | "DRAFT" | "MORE_INFO" | "VISIT" | "RESULT" | "VENDOR" | "LINK"`
  - `type TodoTicketItem = { kind: "ticket"; ticketId: string; unitId: string; issueType: "HEATING" | "LEAK"; reasons: TodoReason[]; lastActivity: string | null }`
  - `type TodoLinkItem = { kind: "link"; invitationId: string; unitLabel: string; reasons: TodoReason[]; lastActivity: string | null }`
  - `type TodoItem = TodoTicketItem | TodoLinkItem`
  - `type TodoList = { items: TodoItem[]; partial: boolean; checking: boolean; resultLimited: boolean; linksLimited: boolean }`
  - `type TodoLinkRequest = { invitationId: string; unitLabel: string; requestedAt: string | null }`
  - `type TodoExtras = { reasons: Readonly<Record<string, readonly TodoReason[]>>; links: readonly TodoLinkRequest[]; failed: boolean; ready: boolean; resultLimited: boolean; linksLimited: boolean }`
  - `NO_TODO_EXTRAS: TodoExtras`: 아무것도 없고 `ready: true`
  - `EMPTY_TODO_LIST: TodoList`
  - `todoItemId(item: TodoItem): string`
  - `buildTodoList({ role, tickets, summaries, summariesFailed, extras? }): TodoList`
- Produces (`nav/nav-screens.tsx`): `TodoScreen`에 필수 속성 `onOpenPlace(to: NavLocation): void`. 연결 요청 행은 `<a data-todo-link="<invitationId>">`이다.

- [ ] **Step 1: 실패하는 시험을 쓴다 — 목록 계산**

`apps/web/src/app/core/nav/todo-list.test.ts`를 고친다.

맨 위 import와 도우미를 바꾼다.

```ts
import { buildTodoList, NO_TODO_EXTRAS, todoItemId, todoReasonName, type TodoExtras } from "./todo-list";
```

```ts
const reasons = (list: ReturnType<typeof buildTodoList>) => list.items.map(item => [todoItemId(item), item.reasons]);
const extras = (patch: Partial<TodoExtras>): TodoExtras => ({ ...NO_TODO_EXTRAS, ...patch });
```

"sorts urgent first …" 시험의 `list.items.map(item => item.ticketId)`를 `list.items.map(todoItemId)`로 바꾼다.

`describe` 안 맨 끝(이름 시험 앞)에 아래 시험을 더한다.

```ts
  it("adds the PR 2 reasons to a request's row, and finished requests only for 결과 확인", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false, summaries: summary("visit", "TENANT"),
      tickets: [ticket("visit", "IN_PROGRESS", "READY_FOR_REVIEW", sent()), ticket("done", "COMPLETED", "APPROVED", sent()), ticket("quiet", "COMPLETED", "APPROVED", sent())],
      extras: extras({ reasons: { visit: ["VISIT"], done: ["RESULT"] } }) });
    expect(Object.fromEntries(reasons(list))).toEqual({ visit: ["REPLY", "VISIT"], done: ["RESULT"] });
  });

  it("puts 기한 지남 right after urgent checks, before replies and decisions, and the Vendor check with the rest", () => {
    const list = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false, summaries: summary("reply", "MANAGER"),
      tickets: [
        ticket("reply", "IN_PROGRESS", "APPROVED", sent("2026-10-13T05:00:00Z")),
        ticket("late", "IN_PROGRESS", "APPROVED", sent("2026-10-10T00:00:00Z")),
        ticket("vendor", "IN_PROGRESS", "APPROVED", sent("2026-10-13T06:00:00Z")),
        ticket("safe", "OPEN", "SAFETY_ESCALATED", [["CREATED", "2026-10-09T00:00:00Z"]]),
      ],
      extras: extras({ reasons: { late: ["OVERDUE"], vendor: ["VENDOR"] } }) });
    expect(list.items.map(todoItemId)).toEqual(["safe", "late", "reply", "vendor"]);
  });

  it("lists a link request as its own row, sorted by when it was requested", () => {
    const list = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false, summaries: {},
      tickets: [ticket("vendor", "IN_PROGRESS", "APPROVED", sent("2026-10-12T00:00:00Z"))],
      extras: extras({ reasons: { vendor: ["VENDOR"] }, links: [{ invitationId: "inv-1", unitLabel: "101호", requestedAt: "2026-10-14T00:00:00Z" }] }) });
    // The request's last activity is its CREATED event (2026-10-13T01:00), so the link request is the newer row.
    expect(list.items).toEqual([
      { kind: "link", invitationId: "inv-1", unitLabel: "101호", reasons: ["LINK"], lastActivity: "2026-10-14T00:00:00Z" },
      expect.objectContaining({ kind: "ticket", ticketId: "vendor", reasons: ["VENDOR"] }),
    ]);
  });

  it("passes on what the reads could not settle: partial, still checking, and the read limits", () => {
    const base = { role: "TENANT" as const, summariesFailed: false, summaries: {}, tickets: [] };
    expect(buildTodoList({ ...base, extras: extras({ failed: true }) }).partial).toBe(true);
    expect(buildTodoList({ ...base, extras: extras({ ready: false }) }).checking).toBe(true);
    expect(buildTodoList({ ...base, extras: extras({ resultLimited: true, linksLimited: true }) })).toMatchObject({ resultLimited: true, linksLimited: true, checking: false, partial: false });
    expect(buildTodoList(base)).toEqual({ items: [], partial: false, checking: false, resultLimited: false, linksLimited: false });
  });
```

이름 시험("names reasons the way …")의 끝에 한 줄을 더한다.

```ts
    expect(["VISIT", "RESULT", "VENDOR", "OVERDUE", "LINK"].map(reason => todoReasonName("ORG_ADMIN", reason as "VISIT"))).toEqual(["방문 시간 확정 필요", "결과 확인 필요", "업체 확인 필요", "기한 지남", "연결 요청 확인 필요"]);
```

`apps/web/src/app/core/nav/tenant-home.test.ts`의 "홈 next step" `describe` 끝에 더한다.

```ts
  it("names a visit time to confirm as the request's next step", () => {
    expect(tenantNextStep(ticket("v", "IN_PROGRESS", "READY_FOR_REVIEW", "2026-10-13T01:00:00Z"), ["VISIT"])).toBe("방문 시간 확정 필요");
  });
```

같은 파일의 홈 카드 `describe`(`homeCards`를 부르는 시험이 있는 곳) 끝에 더한다.

```ts
  it("skips link-request rows, which belong to no request", () => {
    const tickets = [ticket("a", "OPEN", "READY_FOR_REVIEW", "2026-10-13T01:00:00Z")];
    const todo = buildTodoList({ role: "TENANT", tickets, summaries: {}, summariesFailed: false,
      extras: { reasons: {}, links: [{ invitationId: "inv", unitLabel: "101호", requestedAt: null }], failed: false, ready: true, resultLimited: false, linksLimited: false } });
    expect(homeCards({ tickets, todo, unitId: "unit-1" }).cards.map(card => card.ticket.ticketId)).toEqual(["a"]);
  });
```

- [ ] **Step 2: 실패하는 시험을 쓴다 — 알림 화면 그리기**

`apps/web/src/app/core/nav/core-nav.test.tsx`의 "shows loading, empty, partial and filled to-do states"와 "locks every to-do row …" 시험을 아래로 바꾼다.
- 목록 값에 새 필드를 넣는다.
- 행에 `kind`를 붙인다.
- `onOpenPlace`를 넘긴다.

import에 `EMPTY_TODO_LIST`를 더한다: `import { EMPTY_TODO_LIST } from "./todo-list";`

```tsx
  it("shows loading, empty, partial and filled to-do states", () => {
    const empty = EMPTY_TODO_LIST;
    expect(renderToStaticMarkup(<TodoScreen role="TENANT" list={empty} ready={false} units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} />)).toContain("불러오는 중이에요");
    expect(renderToStaticMarkup(<TodoScreen role="TENANT" list={empty} ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} />)).toContain("지금 처리할 일이 없어요. 새 문제가 생기면 홈에서 접수해 주세요.");
    expect(renderToStaticMarkup(<TodoScreen role="ORG_ADMIN" list={empty} ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} />)).toContain("지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요.");
    const partial = renderToStaticMarkup(<TodoScreen role="TENANT" list={{ ...empty, partial: true }} ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} />);
    expect(partial).toContain("일부를 확인하지 못했어요.");
    expect(partial).toContain(">다시 불러오기</button>");
    const filled = renderToStaticMarkup(<TodoScreen role="TENANT" ready onOpen={noop} onOpenPlace={noop} onRetry={noop}
      units={[{ id: "u1", label: "101호", buildingName: "합성 건물" } as never]}
      list={{ ...empty, items: [{ kind: "ticket", ticketId: "t1", unitId: "u1", issueType: "HEATING", reasons: ["REPLY", "DRAFT"], lastActivity: "2026-10-13T01:00:00Z" }] }} />);
    expect(filled).toContain('data-todo-ticket="t1"');
    expect(filled).toContain("난방 · 101호");
    expect(filled).toContain("내 답변 필요");
    expect(filled).toContain("제출 전");
    expect(filled).toContain('dateTime="2026-10-13T01:00:00Z"');
  });

  it("links a link request to 입주 연결 and names the unit", () => {
    const html = renderToStaticMarkup(<TodoScreen role="ORG_ADMIN" ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop}
      list={{ ...EMPTY_TODO_LIST, items: [{ kind: "link", invitationId: "inv-1", unitLabel: "101호", reasons: ["LINK"], lastActivity: "2026-10-13T02:00:00Z" }] }} />);
    expect(html).toMatch(/<a [^>]*data-todo-link="inv-1"[^>]*href="\/core\?tab=more&amp;view=invitations"|<a [^>]*href="\/core\?tab=more&amp;view=invitations"[^>]*data-todo-link="inv-1"/);
    expect(html).toContain("입주 연결 · 101호");
    expect(html).toContain("연결 요청 확인 필요");
  });

  it("says while the rest is still being read, and when a read limit was reached", () => {
    const row = { kind: "ticket" as const, ticketId: "t1", unitId: "u1", issueType: "LEAK" as const, reasons: ["DRAFT" as const], lastActivity: null };
    const checking = renderToStaticMarkup(<TodoScreen role="TENANT" ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} list={{ ...EMPTY_TODO_LIST, checking: true }} />);
    expect(checking).toContain("처리할 일을 더 확인하고 있어요.");
    expect(checking).toContain('aria-busy="true"');
    expect(checking).not.toContain("지금 처리할 일이 없어요");
    const withRow = renderToStaticMarkup(<TodoScreen role="TENANT" ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} list={{ ...EMPTY_TODO_LIST, checking: true, items: [row] }} />);
    expect(withRow.indexOf('data-todo-ticket="t1"')).toBeLessThan(withRow.indexOf("처리할 일을 더 확인하고 있어요."));
    const limited = renderToStaticMarkup(<TodoScreen role="ORG_ADMIN" ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} list={{ ...EMPTY_TODO_LIST, items: [row], resultLimited: true, linksLimited: true }} />);
    expect(limited).toContain("최근 끝난 요청 20건만 확인해요.");
    expect(limited).toContain("연결 요청은 100건까지만 확인했어요. 입주 연결에서 모두 볼 수 있어요.");
    expect(limited).not.toContain("aria-busy");
  });

  it("locks every to-do row while the screen is busy or holds unsent photos, like the 요청 rows", () => {
    const list = { ...EMPTY_TODO_LIST, items: (["t1", "t2"] as const).map(ticketId => ({ kind: "ticket" as const, ticketId, unitId: "u1", issueType: "LEAK" as const, reasons: ["REPLY" as const], lastActivity: null })) };
    const rows = (html: string) => html.match(/<button[^>]*data-todo-ticket="[^"]*"[^>]*>/g) ?? [];
    const locked = rows(renderToStaticMarkup(<TodoScreen role="TENANT" list={list} ready units={[]} disabled onOpen={noop} onOpenPlace={noop} onRetry={noop} />));
    expect(locked).toHaveLength(2);
    for (const row of locked) expect(row).toMatch(/\sdisabled=""/);
    const open = rows(renderToStaticMarkup(<TodoScreen role="TENANT" list={list} ready units={[]} onOpen={noop} onOpenPlace={noop} onRetry={noop} />));
    expect(open).toHaveLength(2);
    for (const row of open) expect(row).not.toContain("disabled");
  });
```

- [ ] **Step 3: 시험이 실패하는지 본다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/todo-list.test.ts src/app/core/nav/tenant-home.test.ts src/app/core/nav/core-nav.test.tsx`
Expected: FAIL. `todoItemId`·`NO_TODO_EXTRAS`·`EMPTY_TODO_LIST`가 없다는 오류, 그리고 새 이름·행·안내 시험이 실패한다.

- [ ] **Step 4: 이름을 더한다**

`apps/web/src/components/status-names.ts`의 `TODO_REASON_NAMES`를 아래로 바꾼다.

```ts
export const TODO_REASON_NAMES = {
  SAFETY: INTAKE_STATUS_NAMES.SAFETY_ESCALATED, DRAFT: INTAKE_STATUS_NAMES.IN_PROGRESS, MORE_INFO: INTAKE_STATUS_NAMES.NEEDS_MORE_INFO,
  DECIDE: "처리 방법 결정 필요", REPLY_TENANT: "내 답변 필요", REPLY_MANAGER: "관리자 답변 대기", WAITING_TENANT: "세입자 답변 대기",
  // P5 PR 2 (spec §5): reasons read per request, from the manager's work list or from the link requests. 기한 지남 is the
  // name the 업무함 row already shows.
  VISIT: "방문 시간 확정 필요", RESULT: "결과 확인 필요", VENDOR: "업체 확인 필요", OVERDUE: "기한 지남", LINK: "연결 요청 확인 필요",
} as const;
```

- [ ] **Step 5: 목록 계산을 고친다**

`apps/web/src/app/core/nav/todo-list.ts` 전체를 아래로 바꾼다.

```ts
import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { TODO_REASON_NAMES } from "../../../components/status-names";
import { managerRowHint } from "../manager-next-step";
import { intakeDisplayStatus, isIntakeDraft } from "../ui/work-status-badge";
import { isTenant, type CoreRole } from "./nav-config";

/** Why a request (or a link request) is on the 알림 to-do list (P5 spec §5). SAFETY to MORE_INFO come from the request
 * list and the conversation summaries (PR 1); the rest from reads per request, the manager's work list and the link
 * requests (PR 2, todo-extras.ts). */
export type TodoReason = "SAFETY" | "OVERDUE" | "REPLY" | "DECIDE" | "DRAFT" | "MORE_INFO" | "VISIT" | "RESULT" | "VENDOR" | "LINK";
export type TodoTicketItem = { kind: "ticket"; ticketId: string; unitId: string; issueType: CoreTicketDto["detail"]["issueType"]; reasons: TodoReason[]; lastActivity: string | null };
/** A tenant's request to join a unit, waiting for the organisation admin (invitation state REQUESTED). */
export type TodoLinkItem = { kind: "link"; invitationId: string; unitLabel: string; reasons: TodoReason[]; lastActivity: string | null };
export type TodoItem = TodoTicketItem | TodoLinkItem;
/** `checking`: the PR 2 reads for these requests have not finished; `resultLimited`/`linksLimited`: a read limit was hit. */
export type TodoList = { items: TodoItem[]; partial: boolean; checking: boolean; resultLimited: boolean; linksLimited: boolean };
export type TodoLinkRequest = { invitationId: string; unitLabel: string; requestedAt: string | null };
/** What the PR 2 reads found (todo-extras.ts). `ready` is false until the reads for the current requests finish. */
export type TodoExtras = {
  reasons: Readonly<Record<string, readonly TodoReason[]>>; links: readonly TodoLinkRequest[];
  failed: boolean; ready: boolean; resultLimited: boolean; linksLimited: boolean;
};
export const NO_TODO_EXTRAS: TodoExtras = { reasons: {}, links: [], failed: false, ready: true, resultLimited: false, linksLimited: false };
export const EMPTY_TODO_LIST: TodoList = { items: [], partial: false, checking: false, resultLimited: false, linksLimited: false };

// Sort groups (spec §5): urgent checks, overdue work, then the replies and decisions someone waits on, then the rest.
const GROUP: Record<TodoReason, number> = { SAFETY: 0, OVERDUE: 1, REPLY: 2, DECIDE: 2, DRAFT: 3, MORE_INFO: 3, VISIT: 3, RESULT: 3, VENDOR: 3, LINK: 3 };
// The order reasons read in within one row.
const ORDER: readonly TodoReason[] = ["SAFETY", "OVERDUE", "REPLY", "DECIDE", "DRAFT", "MORE_INFO", "VISIT", "RESULT", "VENDOR", "LINK"];

export const todoItemId = (item: TodoItem) => item.kind === "ticket" ? item.ticketId : item.invitationId;

export const todoReasonName = (role: CoreRole, reason: TodoReason): string =>
  reason === "REPLY" ? (isTenant(role) ? TODO_REASON_NAMES.REPLY_TENANT : TODO_REASON_NAMES.REPLY_MANAGER) : TODO_REASON_NAMES[reason];

export const lastActivity = (ticket: CoreTicketDto) =>
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
 * confirmed. A failed summary or PR 2 read leaves the list partial: reasons may be missing, never invented. A finished
 * request can only be on the list for 결과 확인, which only the PR 2 reads find. */
export function buildTodoList({ role, tickets, summaries, summariesFailed, extras = NO_TODO_EXTRAS }: {
  role: CoreRole; tickets: readonly CoreTicketDto[]; summaries: Readonly<Record<string, CoreCommunicationSummary>>; summariesFailed: boolean; extras?: TodoExtras;
}): TodoList {
  const requests = tickets.flatMap((ticket): TodoTicketItem[] => {
    const own = ticket.workStatus === "COMPLETED" ? [] : reasonsFor(role, ticket, summaries[ticket.ticketId]);
    const reasons = [...new Set([...own, ...(extras.reasons[ticket.ticketId] ?? [])])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return reasons.length ? [{ kind: "ticket", ticketId: ticket.ticketId, unitId: ticket.unitId, issueType: ticket.detail.issueType, reasons, lastActivity: lastActivity(ticket) }] : [];
  });
  const links = extras.links.map((link): TodoLinkItem => ({ kind: "link", invitationId: link.invitationId, unitLabel: link.unitLabel, reasons: ["LINK"], lastActivity: link.requestedAt }));
  const items: TodoItem[] = [...requests, ...links];
  const group = (item: TodoItem) => Math.min(...item.reasons.map(reason => GROUP[reason]));
  const time = (item: TodoItem) => item.lastActivity ? Date.parse(item.lastActivity) : 0;
  items.sort((a, b) => group(a) - group(b) || time(b) - time(a) || todoItemId(a).localeCompare(todoItemId(b)));
  return { items, partial: summariesFailed || extras.failed, checking: !extras.ready, resultLimited: extras.resultLimited, linksLimited: extras.linksLimited };
}
```

- [ ] **Step 6: 홈 카드가 연결 요청 행을 건너뛰게 한다**

`apps/web/src/app/core/nav/tenant-home.ts`의 import와 `homeCards` 첫 두 줄을 바꾼다.

```ts
import { lastActivity, todoReasonName, type TodoList, type TodoReason, type TodoTicketItem } from "./todo-list";
```

```ts
  const requests = todo.items.filter((item): item is TodoTicketItem => item.kind === "ticket");
  const order = new Map(requests.map((item, index) => [item.ticketId, index]));
  const reasons = new Map(requests.map(item => [item.ticketId, item.reasons]));
```

- [ ] **Step 7: 알림 화면에 연결 요청 행과 안내를 그린다**

`apps/web/src/app/core/nav/nav-screens.tsx`를 고친다.

import 두 줄을 바꾼다.

```ts
import { isTenant, VIEW_LABELS, type CoreRole, type MenuRow, type NavLocation } from "./nav-config";
import { todoReasonName, type TodoItem, type TodoList } from "./todo-list";
```

`TodoScreen` 함수(설명 주석 포함)를 아래로 바꾼다.

```tsx
const INVITATIONS: NavLocation = { tab: "more", view: "invitations" };

/** 알림 (spec §5): one row per request with every reason, and one per link request; a partial read says so instead of
 * inventing a count. `disabled` locks the request rows like the 요청 rows, so photos picked on 홈 never become a
 * request's unsent photos; a link request only opens 입주 연결, so it stays a plain link. `notice` says why the rows are
 * locked. While the PR 2 reads run, the rows already confirmed show and a status line below them says the rest is
 * coming, so the line going away never moves a row. */
export function TodoScreen({ role, list, ready, units, onOpen, onOpenPlace, onRetry, disabled = false, notice }: {
  role: CoreRole; list: TodoList; ready: boolean; units: readonly CoreUnitDto[]; onOpen(ticketId: string): void; onOpenPlace(to: NavLocation): void; onRetry(): void; disabled?: boolean; notice?: string;
}) {
  if (!ready) return <p role="status">불러오는 중이에요</p>;
  const unitLabel = (id: string) => units.find(unit => unit.id === id)?.label;
  const badges = (item: TodoItem) => <span className={styles.reasons}>{item.reasons.map(reason => <span key={reason} className={styles.reasonBadge} data-reason={reason}>{todoReasonName(role, reason)}</span>)}</span>;
  const time = (item: TodoItem) => item.lastActivity ? <span className={styles.todoTime}><DateTime at={item.lastActivity} /></span> : null;
  return <section className={styles.todo} aria-label="처리할 일" aria-busy={list.checking ? "true" : undefined}>
    {notice ? <p className={styles.empty}>{notice}</p> : null}
    {list.partial ? <div className={styles.partial} role="alert"><p>일부를 확인하지 못했어요.</p><button type="button" onClick={onRetry}>다시 불러오기</button></div> : null}
    {list.items.length ? <ul>{list.items.map(item => item.kind === "ticket"
      ? <li key={item.ticketId}><button type="button" className={styles.todoRow} data-todo-ticket={item.ticketId} disabled={disabled} onClick={() => onOpen(item.ticketId)}>
        <span className={styles.todoTitle}>{item.issueType === "HEATING" ? "난방" : "누수"}{unitLabel(item.unitId) ? ` · ${unitLabel(item.unitId)}` : ""}</span>{badges(item)}{time(item)}
      </button></li>
      : <li key={item.invitationId}><a className={styles.todoRow} data-todo-link={item.invitationId} href={navHref(INVITATIONS)} onClick={event => { if (plainClick(event)) { event.preventDefault(); onOpenPlace(INVITATIONS); } }}>
        <span className={styles.todoTitle}>{VIEW_LABELS.invitations} · {item.unitLabel}</span>{badges(item)}{time(item)}
      </a></li>)}</ul>
    : list.partial || list.checking ? null : <p className={styles.empty}>{isTenant(role) ? "지금 처리할 일이 없어요. 새 문제가 생기면 홈에서 접수해 주세요." : "지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요."}</p>}
    {list.checking ? <p className={styles.empty} role="status">처리할 일을 더 확인하고 있어요.</p> : null}
    {list.resultLimited ? <p className={styles.empty}>최근 끝난 요청 20건만 확인해요.</p> : null}
    {list.linksLimited ? <p className={styles.empty}>연결 요청은 100건까지만 확인했어요. 입주 연결에서 모두 볼 수 있어요.</p> : null}
  </section>;
}
```

- [ ] **Step 8: 링크로 된 행의 모양**

`apps/web/src/app/core/nav/core-nav.module.css`에서 `.todo li button.todoRow` 규칙 두 줄(43–44행)을 아래로 바꾼다. 45–47행의 `:disabled` 규칙은 그대로 둔다.

```css
/* A to-do row is a button (a request) or a link (a link request, which opens 입주 연결). The link form beats
 * .root a:not(.primary-button) (0,2,1) in core-design.module.css, so it keeps the row's colour and no underline. */
.todo li button.todoRow, .todo li a.todoRow { display: grid; gap: .3125rem; width: 100%; min-height: 3.125rem; padding: .9375rem 1.25rem; border: 0; border-radius: 0; background: transparent; color: var(--color-text); text-align: left; font-weight: 400; text-decoration: none; }
.todo li button.todoRow:hover:not(:disabled), .todo li a.todoRow:hover { background: var(--color-fill-hover); }
```

85행과 88행의 `.todo li button.todoRow,` 뒤에 `.todo li a.todoRow,`를 더한다.

```css
  .menuList li a.row, .menuList li button.row, .rowBlock, .todo li button.todoRow, .todo li a.todoRow, .empty { padding-inline: 1.875rem; }
```

```css
  .menuList li a.row, .menuList li button.row, .rowBlock, .todo li button.todoRow, .todo li a.todoRow, .empty { padding-inline: 2.5rem; }
```

- [ ] **Step 9: 화면이 새 값으로 컴파일되게 한다**

`apps/web/src/app/core/core-screen.tsx`를 세 곳 고친다.
- 33행 import: `import { buildTodoList,EMPTY_TODO_LIST } from "./nav/todo-list";`
- 143행: `:{items:[],partial:false}`를 `:EMPTY_TODO_LIST`로 바꾼다.
- 383행 `<TodoScreen …>`: `onOpen={openFromList}` 뒤에 `onOpenPlace={navigate}`를 더한다.

`scripts/design-audit.mjs`를 두 곳 고친다.
- 19행 주석: `to-do rows ([data-todo-ticket])`를 `to-do rows ([data-todo-ticket], [data-todo-link])`로 바꾼다.
- 159행 `leftStart` 선택자: `[data-todo-ticket], `를 `[data-todo-ticket], [data-todo-link], `로 바꾼다.

- [ ] **Step 10: 시험이 통과하는지 본다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav src/components/status-names src/app/core/haeyo-copy.test.ts`
Expected: PASS.

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음.

- [ ] **Step 11: 커밋**

```bash
git add apps/web/src/components/status-names.ts apps/web/src/app/core/nav/todo-list.ts apps/web/src/app/core/nav/todo-list.test.ts apps/web/src/app/core/nav/tenant-home.ts apps/web/src/app/core/nav/tenant-home.test.ts apps/web/src/app/core/nav/nav-screens.tsx apps/web/src/app/core/nav/core-nav.module.css apps/web/src/app/core/nav/core-nav.test.tsx apps/web/src/app/core/core-screen.tsx scripts/design-audit.mjs
git commit -m "feat(web): P5 to-do list carries the PR 2 reasons and link-request rows

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 2: 요청마다 읽기

**Files:**
- Create: `apps/web/src/app/core/nav/todo-extras.ts`
- Create: `apps/web/src/app/core/nav/todo-extras.test.ts`

**Interfaces:**
- Consumes (Task 1): `TodoExtras`, `TodoLinkRequest`, `TodoReason`, `lastActivity`
- Produces
  - `READ_LIMIT = 4`, `RESULT_LIMIT = 20`, `LINK_PAGE_LIMIT = 5`
  - `type TodoReads`: 모두 선택 항목
    - `scheduling(ticketId): Promise<TenantVendorSchedulingDto>`
    - `outcome(ticketId): Promise<CoreTicketOutcome>`
    - `handoff(ticketId): Promise<ManagerVendorHandoffDto>`
    - `workItems(): Promise<CoreManagerWorkItem[]>`
    - `invitations(cursor?): Promise<InvitationPage>`
  - `type TodoTargets = { visit: string[]; result: string[]; resultLimited: boolean; vendor: string[] }`
  - `todoTargets(role, tickets): TodoTargets`
  - `hasTodoReads(reads, targets): boolean`
  - `endsSession(status: number, perRequest: boolean): boolean`
  - `runLimited(tasks, limit): Promise<void>`
  - `collectTodoExtras({ role, tickets, reads, now }): Promise<TodoExtras>`: 던지지 않는다.
  - `todoReadsFor({ role, b1, perRequest, list, invitations? }): TodoReads`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/todo-extras.test.ts`를 만든다.

```ts
import { ApiClientError, type CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem, CoreTicketDto, CoreTicketOutcome, InvitationDto, InvitationPage, ManagerVendorHandoffDto, TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { describe, expect, it, vi } from "vitest";
import { collectTodoExtras, endsSession, hasTodoReads, LINK_PAGE_LIMIT, READ_LIMIT, RESULT_LIMIT, todoReadsFor, todoTargets, type TodoReads } from "./todo-extras";

// Only the fields these rules read (same shape as todo-list.test.ts). `vendor` puts a request on a Vendor route.
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], at = "2026-10-13T01:00:00Z", vendor = false): CoreTicketDto {
  const decision = vendor ? { type: "OVERRIDE", routeCode: "GENERAL_VENDOR" } : null;
  return { ticketId: id, unitId: "unit-1", workStatus, detail: { status: "APPROVED", issueType: "LEAK", decision, repairPacket: null }, events: [{ kind: "CREATED", at }] } as unknown as CoreTicketDto;
}
const denied = (status: number) => new ApiClientError("DENIED", "합성 응답", { status });
const schedule = (waitingOn: TenantVendorSchedulingDto["waitingOn"]) => ({ waitingOn }) as TenantVendorSchedulingDto;
const outcome = (kind: CoreTicketOutcome["kind"]) => ({ kind }) as CoreTicketOutcome;
const handoff = (waitingOn: ManagerVendorHandoffDto["waitingOn"], assignment: Partial<NonNullable<ManagerVendorHandoffDto["assignment"]>> | null) =>
  ({ waitingOn, assignment }) as ManagerVendorHandoffDto;
const invitation = (id: string, state: InvitationDto["state"]) => ({ invitationId: id, unitLabel: `${id}호`, state, requestedAt: "2026-10-13T02:00:00Z" }) as InvitationDto;
const now = Date.parse("2026-10-14T00:00:00Z");

describe("which requests the per-request reads cover (P5 spec §5)", () => {
  it("reads a tenant's visit times for requests in progress and the results of the 20 most recent finished ones", () => {
    const finished = Array.from({ length: 21 }, (_, n) => ticket(`done-${n}`, "COMPLETED", new Date(Date.UTC(2026, 9, 1 + n)).toISOString()));
    const targets = todoTargets("TENANT", [ticket("open", "OPEN"), ticket("going", "IN_PROGRESS"), ...finished]);
    expect(RESULT_LIMIT).toBe(20);
    expect(targets.visit).toEqual(["going"]);
    expect(targets.result).toHaveLength(20);
    expect(targets.result[0]).toBe("done-20");
    expect(targets.result).not.toContain("done-0");
    expect(targets.resultLimited).toBe(true);
    expect(todoTargets("TENANT", finished.slice(0, 20)).resultLimited).toBe(false);
  });

  it("reads a manager's Vendor handoff only for unfinished requests on a Vendor route", () => {
    expect(todoTargets("ORG_ADMIN", [ticket("v", "IN_PROGRESS", undefined, true), ticket("plain", "IN_PROGRESS"), ticket("done", "COMPLETED", undefined, true)]))
      .toEqual({ visit: [], result: [], resultLimited: false, vendor: ["v"] });
  });

  it("knows when there is nothing to read", () => {
    expect(hasTodoReads({ outcome: vi.fn() }, todoTargets("TENANT", [ticket("open", "OPEN")]))).toBe(false);
    expect(hasTodoReads({ outcome: vi.fn() }, todoTargets("TENANT", [ticket("done", "COMPLETED")]))).toBe(true);
    expect(hasTodoReads({ workItems: vi.fn() }, todoTargets("ORG_ADMIN", []))).toBe(true);
  });
});

describe("reading the PR 2 reasons", () => {
  it("never has more than four per-request reads in flight, and uses all four", async () => {
    let open = 0, most = 0, calls = 0;
    const reads: TodoReads = { outcome: async () => { calls++; open++; most = Math.max(most, open); await new Promise(resolve => setTimeout(resolve, 5)); open--; return outcome("RESOLVED"); } };
    await collectTodoExtras({ role: "TENANT", now, reads, tickets: Array.from({ length: 10 }, (_, n) => ticket(`d${n}`, "COMPLETED")) });
    expect(READ_LIMIT).toBe(4);
    expect(calls).toBe(10);
    expect(most).toBe(4);
  });

  it("finds the visit times and results a tenant owes, and nothing for 403 or 404", async () => {
    const reads: TodoReads = {
      scheduling: async id => { if (id === "gone") throw denied(404); if (id === "hidden") throw denied(403); return schedule(id === "visit" ? "TENANT" : "VENDOR"); },
      outcome: async id => outcome(id === "result" ? "UNCONFIRMED" : "RESOLVED"),
    };
    const extras = await collectTodoExtras({ role: "TENANT", now, reads,
      tickets: [ticket("visit", "IN_PROGRESS"), ticket("vendor", "IN_PROGRESS"), ticket("gone", "IN_PROGRESS"), ticket("hidden", "IN_PROGRESS"), ticket("result", "COMPLETED"), ticket("answered", "COMPLETED")] });
    expect(extras).toEqual({ reasons: { visit: ["VISIT"], result: ["RESULT"] }, links: [], failed: false, ready: true, resultLimited: false, linksLimited: false });
  });

  it("marks the list partial when a read fails for another reason, and adds nothing after a lost session", async () => {
    const failing = await collectTodoExtras({ role: "TENANT", now, tickets: [ticket("a", "COMPLETED"), ticket("b", "COMPLETED")],
      reads: { outcome: async id => { if (id === "a") throw denied(500); return outcome("UNCONFIRMED"); } } });
    expect(failing).toMatchObject({ failed: true, reasons: { b: ["RESULT"] } });
    const network = await collectTodoExtras({ role: "TENANT", now, tickets: [ticket("a", "COMPLETED")], reads: { outcome: async () => { throw new TypeError("network"); } } });
    expect(network.failed).toBe(true);
    const signedOut = await collectTodoExtras({ role: "TENANT", now, tickets: [ticket("a", "COMPLETED")], reads: { outcome: async () => { throw denied(401); } } });
    expect(signedOut).toMatchObject({ failed: false, reasons: {} });
  });

  it("gives a manager 업체 확인 when the handoff waits on them or the Vendor declined the current assignment", async () => {
    const reads: TodoReads = { handoff: async id =>
      id === "waiting" ? handoff("MANAGER", { status: "ACTIVE" })
      : id === "declined" ? handoff("NONE", { status: "ENDED", endReason: "DECLINED" })
      : id === "withdrawn" ? handoff("NONE", { status: "ENDED", endReason: "WITHDRAWN" })
      : id === "none" ? handoff("NONE", null)
      : handoff("VENDOR", { status: "ACTIVE" }) };
    const extras = await collectTodoExtras({ role: "PROPERTY_STAFF", now, reads, tickets: ["waiting", "declined", "withdrawn", "none", "busy"].map(id => ticket(id, "IN_PROGRESS", undefined, true)) });
    expect(extras.reasons).toEqual({ waiting: ["VENDOR"], declined: ["VENDOR"] });
  });

  it("gives a manager 기한 지남 from one read of the work list", async () => {
    const workItems = vi.fn(async () => [
      { ticketId: "late", workStatus: "IN_PROGRESS", dueAt: "2026-10-13T00:00:00Z" },
      { ticketId: "soon", workStatus: "OPEN", dueAt: "2026-10-15T00:00:00Z" },
      { ticketId: "done", workStatus: "COMPLETED", dueAt: "2026-10-01T00:00:00Z" },
      { ticketId: "none", workStatus: "OPEN", dueAt: null },
    ] as CoreManagerWorkItem[]);
    const extras = await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { workItems } });
    expect(extras.reasons).toEqual({ late: ["OVERDUE"] });
    expect(workItems).toHaveBeenCalledTimes(1);
  });

  it("lists requested links over at most five pages and says when there were more", async () => {
    const page = (n: number, last: number) => ({ items: [invitation(`r${n}`, "REQUESTED"), invitation(`o${n}`, "OPEN")], nextCursor: n < last ? `c${n + 1}` : null }) as InvitationPage;
    const short = vi.fn(async (cursor?: string) => page(cursor ? Number(cursor.slice(1)) : 1, 2));
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: short } })).toMatchObject({
      links: [{ invitationId: "r1", unitLabel: "r1호", requestedAt: "2026-10-13T02:00:00Z" }, { invitationId: "r2", unitLabel: "r2호", requestedAt: "2026-10-13T02:00:00Z" }],
      linksLimited: false });
    expect(short.mock.calls).toEqual([[undefined], ["c2"]]);
    const long = vi.fn(async (cursor?: string) => page(cursor ? Number(cursor.slice(1)) : 1, 9));
    const limited = await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: long } });
    expect(LINK_PAGE_LIMIT).toBe(5);
    expect(long).toHaveBeenCalledTimes(5);
    expect(limited.links).toHaveLength(5);
    expect(limited.linksLimited).toBe(true);
  });

  it("treats a list read's 403 as a lost session and its other errors as a failure", async () => {
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { workItems: async () => { throw denied(403); } } })).toMatchObject({ failed: false });
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { workItems: async () => { throw denied(404); } } })).toMatchObject({ failed: true });
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: async () => { throw denied(500); } } })).toMatchObject({ failed: true });
  });
});

describe("sessions and reads per role", () => {
  it("ends the session on 401 always, and on 403 only for list reads", () => {
    expect([401, 403, 404, 500].map(status => endsSession(status, false))).toEqual([true, true, false, false]);
    expect([401, 403, 404, 500].map(status => endsSession(status, true))).toEqual([true, false, false, false]);
  });

  it("reads Vendor states and link requests only with a B1 sign-in, and link requests only for the admin", () => {
    const perRequest = { outcome: { read: vi.fn() }, vendorHandoff: { readScheduling: vi.fn(), readHandoff: vi.fn() } } as unknown as CoreFlowClient;
    const list = { manager: { list: vi.fn() } } as unknown as CoreFlowClient;
    const invitations = vi.fn();
    const keys = (reads: TodoReads) => Object.keys(reads).sort();
    expect(keys(todoReadsFor({ role: "TENANT", b1: false, perRequest, list, invitations }))).toEqual(["outcome"]);
    expect(keys(todoReadsFor({ role: "TENANT", b1: true, perRequest, list, invitations }))).toEqual(["outcome", "scheduling"]);
    expect(keys(todoReadsFor({ role: "ORG_ADMIN", b1: false, perRequest, list, invitations }))).toEqual(["workItems"]);
    expect(keys(todoReadsFor({ role: "PROPERTY_STAFF", b1: true, perRequest, list, invitations }))).toEqual(["handoff", "workItems"]);
    const admin = todoReadsFor({ role: "ORG_ADMIN", b1: true, perRequest, list, invitations });
    expect(keys(admin)).toEqual(["handoff", "invitations", "workItems"]);
    void admin.handoff!("t1"); void admin.workItems!();
    expect(perRequest.vendorHandoff.readHandoff).toHaveBeenCalledWith("t1");
    expect(list.manager.list).toHaveBeenCalledTimes(1);
    const tenant = todoReadsFor({ role: "TENANT", b1: true, perRequest, list, invitations });
    void tenant.outcome!("t2"); void tenant.scheduling!("t3");
    expect(perRequest.outcome.read).toHaveBeenCalledWith("t2");
    expect(perRequest.vendorHandoff.readScheduling).toHaveBeenCalledWith("t3");
  });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/todo-extras.test.ts`
Expected: FAIL. `./todo-extras`를 찾을 수 없다.

- [ ] **Step 3: 구현한다**

`apps/web/src/app/core/nav/todo-extras.ts`를 만든다.

```ts
import { ApiClientError, type CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem, CoreTicketDto, CoreTicketOutcome, InvitationPage, ManagerVendorHandoffDto, TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { isOverdue } from "../manager-work-order";
import { vendorHandoffEligible } from "../vendor-handoff-manager";
import { isTenant, type CoreRole } from "./nav-config";
import { lastActivity, type TodoExtras, type TodoLinkRequest, type TodoReason } from "./todo-list";

/** P5 spec §5 read limits: per-request reads in flight, finished requests read for 결과 확인, and link-request pages of
 * 20. The 알림 notices (nav-screens.tsx) name the same numbers: 20건, 100건. */
export const READ_LIMIT = 4, RESULT_LIMIT = 20, LINK_PAGE_LIMIT = 5;

/** The server reads behind the PR 2 reasons. Each is present only where the role and sign-in allow it (todoReadsFor). */
export type TodoReads = {
  scheduling?(ticketId: string): Promise<TenantVendorSchedulingDto>;
  outcome?(ticketId: string): Promise<CoreTicketOutcome>;
  handoff?(ticketId: string): Promise<ManagerVendorHandoffDto>;
  workItems?(): Promise<CoreManagerWorkItem[]>;
  invitations?(cursor?: string): Promise<InvitationPage>;
};
export type TodoTargets = { visit: string[]; result: string[]; resultLimited: boolean; vendor: string[] };

/** Which requests the per-request reads cover. A visit time can only wait on a request in progress: offering the job to
 * a Vendor moves it there (vendor_handoff_mark_offered). A Vendor handoff exists only on a Vendor route. 결과 확인 reads
 * the most recent finished requests, by their last activity. */
export function todoTargets(role: CoreRole, tickets: readonly CoreTicketDto[]): TodoTargets {
  if (!isTenant(role)) return { visit: [], result: [], resultLimited: false, vendor: tickets.filter(vendorHandoffEligible).map(ticket => ticket.ticketId) };
  const time = (ticket: CoreTicketDto) => { const at = lastActivity(ticket); return at ? Date.parse(at) : 0; };
  const finished = tickets.filter(ticket => ticket.workStatus === "COMPLETED").sort((a, b) => time(b) - time(a) || a.ticketId.localeCompare(b.ticketId));
  return {
    visit: tickets.filter(ticket => ticket.workStatus === "IN_PROGRESS").map(ticket => ticket.ticketId),
    result: finished.slice(0, RESULT_LIMIT).map(ticket => ticket.ticketId), resultLimited: finished.length > RESULT_LIMIT, vendor: [],
  };
}

export const hasTodoReads = (reads: TodoReads, targets: TodoTargets) => Boolean(reads.workItems || reads.invitations
  || (reads.scheduling && targets.visit.length) || (reads.outcome && targets.result.length) || (reads.handoff && targets.vendor.length));

/** Which statuses end the session. A per-request read's 403 means nothing is assigned there, as on the request screens
 * (vendor-handoff-tenant.tsx, vendor-handoff-manager.tsx), so only its 401 signs out; a list read's 401 and 403 both do. */
export const endsSession = (status: number, perRequest: boolean) => status === 401 || (status === 403 && !perRequest);

/** "none": nothing to do there; "signedOut": the guarded client has already cleared the screen; "failed": say partial. */
function failure(error: unknown, perRequest: boolean): "none" | "signedOut" | "failed" {
  const status = error instanceof ApiClientError ? error.status : undefined;
  if (status !== undefined && endsSession(status, perRequest)) return "signedOut";
  return perRequest && (status === 403 || status === 404) ? "none" : "failed";
}

/** Runs the tasks with at most `limit` in flight. The tasks catch their own errors. */
export async function runLimited(tasks: readonly (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  const worker = async () => { while (next < tasks.length) await tasks[next++](); };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

/** Reads what the request list and the conversation summaries cannot show (spec §5) and never throws. */
export async function collectTodoExtras({ role, tickets, reads, now }: { role: CoreRole; tickets: readonly CoreTicketDto[]; reads: TodoReads; now: number }): Promise<TodoExtras> {
  const targets = todoTargets(role, tickets), reasons: Record<string, TodoReason[]> = {}, links: TodoLinkRequest[] = [];
  let failed = false, linksLimited = false;
  const add = (ticketId: string, reason: TodoReason) => { (reasons[ticketId] ??= []).push(reason); };
  const note = (error: unknown, perRequest: boolean) => { if (failure(error, perRequest) === "failed") failed = true; };
  const each = <T>(ids: readonly string[], read: ((ticketId: string) => Promise<T>) | undefined, due: (value: T) => boolean, reason: TodoReason) =>
    read ? ids.map(id => async () => { try { if (due(await read(id))) add(id, reason); } catch (error) { note(error, true); } }) : [];
  const perRequest = [
    ...each(targets.visit, reads.scheduling, value => value.waitingOn === "TENANT", "VISIT"),
    ...each(targets.result, reads.outcome, value => value.kind === "UNCONFIRMED", "RESULT"),
    // The current assignment is the newest one, so a later assignment replaces a declined one.
    ...each(targets.vendor, reads.handoff, value => value.waitingOn === "MANAGER" || (value.assignment?.status === "ENDED" && value.assignment.endReason === "DECLINED"), "VENDOR"),
  ];
  const overdue = async () => {
    if (!reads.workItems) return;
    try { for (const item of await reads.workItems()) if (isOverdue(item, now)) add(item.ticketId, "OVERDUE"); } catch (error) { note(error, false); }
  };
  const requested = async () => {
    if (!reads.invitations) return;
    try {
      let cursor: string | undefined;
      for (let page = 0; page < LINK_PAGE_LIMIT; page++) {
        const result = await reads.invitations(cursor);
        links.push(...result.items.filter(item => item.state === "REQUESTED").map(item => ({ invitationId: item.invitationId, unitLabel: item.unitLabel, requestedAt: item.requestedAt })));
        if (!result.nextCursor) return;
        cursor = result.nextCursor;
      }
      linksLimited = true;
    } catch (error) { note(error, false); }
  };
  await Promise.all([runLimited(perRequest, READ_LIMIT), overdue(), requested()]);
  return { reasons, links, failed, ready: true, resultLimited: targets.resultLimited && Boolean(reads.outcome), linksLimited };
}

/** The reads for a role: Vendor states and link requests exist only with a B1 sign-in, link requests only for the
 * organisation admin. `perRequest` is the client whose 403 does not sign out (core-screen.tsx); `list` signs out on 403. */
export function todoReadsFor({ role, b1, perRequest, list, invitations }: {
  role: CoreRole; b1: boolean; perRequest: CoreFlowClient; list: CoreFlowClient; invitations?: TodoReads["invitations"];
}): TodoReads {
  if (isTenant(role)) return { outcome: id => perRequest.outcome.read(id), ...(b1 ? { scheduling: (id: string) => perRequest.vendorHandoff.readScheduling(id) } : {}) };
  return {
    workItems: () => list.manager.list(),
    ...(b1 ? { handoff: (id: string) => perRequest.vendorHandoff.readHandoff(id) } : {}),
    ...(b1 && role === "ORG_ADMIN" && invitations ? { invitations } : {}),
  };
}
```

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/todo-extras.test.ts`
Expected: PASS.

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음. 클라이언트 반환 형이 `TodoReads`와 맞지 않으면 `TodoReads`를 클라이언트의 실제 반환 형(`@build-manager/api-contracts`의 같은 이름)으로 맞춘다. 시험의 `as` 변환은 그대로 둔다.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/core/nav/todo-extras.ts apps/web/src/app/core/nav/todo-extras.test.ts
git commit -m "feat(web): read the P5 PR 2 to-do reasons, four at a time, with the spec's limits

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 3: 읽는 시점을 정하는 훅

**Files:**
- Create: `apps/web/src/app/core/nav/use-todo-extras.ts`
- Create: `apps/web/src/app/core/nav/use-todo-extras.test.tsx`

**Interfaces:**
- Consumes (Task 2): `collectTodoExtras`, `todoTargets`, `hasTodoReads`, `TodoReads`
- Consumes (Task 1): `NO_TODO_EXTRAS`, `TodoExtras`
- Produces: `useTodoExtras({ role: CoreRole | null; tickets: readonly CoreTicketDto[]; reads: TodoReads | null; revision: number }): TodoExtras`
  - 같은 입력이면 같은 객체를 돌려준다(`useMemo`).
  - 읽을 것이 없으면 바로 `ready: true`다.
  - 읽을 요청 묶음이 바뀌면 끝날 때까지 `ready: false`이고, 그동안 이전 결과를 그대로 둔다.
  - 같은 묶음을 다시 읽는 동안은 `ready: true`다.

- [ ] **Step 1: 실패하는 시험을 쓴다**

`apps/web/src/app/core/nav/use-todo-extras.test.tsx`를 만든다.

```tsx
// @vitest-environment jsdom
import { act, useEffect, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CoreTicketDto, CoreTicketOutcome } from "@build-manager/api-contracts";
import { afterEach, expect, it } from "vitest";
import type { CoreRole } from "./nav-config";
import type { TodoReads } from "./todo-extras";
import type { TodoExtras } from "./todo-list";
import { useTodoExtras } from "./use-todo-extras";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Props = { role: CoreRole | null; tickets: CoreTicketDto[]; reads: TodoReads | null; revision: number };
let root: Root | undefined, host: HTMLDivElement | undefined;
const seen: RefObject<TodoExtras | null> = { current: null };
function Probe(props: Props) {
  const extras = useTodoExtras(props);
  useEffect(() => { seen.current = extras; });
  return null;
}
const done = (id: string) => ({ ticketId: id, unitId: "u1", workStatus: "COMPLETED", detail: { status: "APPROVED", issueType: "LEAK", decision: null, repairPacket: null }, events: [{ kind: "CREATED", at: "2026-10-13T01:00:00Z" }] }) as unknown as CoreTicketDto;
const unconfirmed = async () => ({ kind: "UNCONFIRMED" }) as CoreTicketOutcome;
function deferred() {
  let resolve: (kind: CoreTicketOutcome["kind"]) => void = () => {};
  const promise = new Promise<CoreTicketOutcome>(done => { resolve = kind => done({ kind } as CoreTicketOutcome); });
  return { promise, resolve };
}
async function render(props: Props) {
  if (!root) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); }
  await act(async () => root!.render(<Probe {...props} />));
}
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; host?.remove(); seen.current = null; });

it("waits for the role and the reads, then reports what it found", async () => {
  await render({ role: null, tickets: [done("a")], reads: null, revision: 0 });
  expect(seen.current).toMatchObject({ ready: false, reasons: {} });
  await render({ role: "TENANT", tickets: [done("a")], reads: { outcome: unconfirmed }, revision: 0 });
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
});

it("is ready at once when there is nothing to read", async () => {
  await render({ role: "TENANT", tickets: [], reads: { outcome: unconfirmed }, revision: 0 });
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
});

it("lets only the latest read land, so a slow earlier one cannot bring old reasons back", async () => {
  const first = deferred(), second = deferred(); let call = 0;
  const reads: TodoReads = { outcome: () => (++call === 1 ? first : second).promise };
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 0 });
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 1 });
  await act(async () => second.resolve("RESOLVED"));
  await act(async () => first.resolve("UNCONFIRMED"));
  expect(call).toBe(2);
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
});

it("keeps the earlier result while a changed set of requests is read, and says it is not ready yet", async () => {
  const later = deferred(); let call = 0;
  const reads: TodoReads = { outcome: async () => call++ === 0 ? { kind: "UNCONFIRMED" } as CoreTicketOutcome : later.promise };
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 0 });
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await render({ role: "TENANT", tickets: [done("a"), done("b")], reads, revision: 0 });
  expect(seen.current).toMatchObject({ ready: false, reasons: { a: ["RESULT"] } });
  await act(async () => later.resolve("RESOLVED"));
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
});

it("re-reads the same requests on a new revision and stays ready while it does", async () => {
  const later = deferred(); let call = 0;
  const reads: TodoReads = { outcome: async () => call++ === 0 ? { kind: "UNCONFIRMED" } as CoreTicketOutcome : later.promise };
  const tickets = [done("a")];
  await render({ role: "TENANT", tickets, reads, revision: 0 });
  await render({ role: "TENANT", tickets, reads, revision: 1 });
  expect(call).toBe(2);
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await act(async () => later.resolve("RESOLVED"));
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
});
```

- [ ] **Step 2: 시험이 실패하는지 본다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/use-todo-extras.test.tsx`
Expected: FAIL. `./use-todo-extras`를 찾을 수 없다.

- [ ] **Step 3: 구현한다**

`apps/web/src/app/core/nav/use-todo-extras.ts`를 만든다.

```ts
"use client";
import { useEffect, useMemo, useState } from "react";
import type { CoreTicketDto } from "@build-manager/api-contracts";
import type { CoreRole } from "./nav-config";
import { collectTodoExtras, hasTodoReads, todoTargets, type TodoReads } from "./todo-extras";
import { NO_TODO_EXTRAS, type TodoExtras } from "./todo-list";

const NOT_READY: TodoExtras = { ...NO_TODO_EXTRAS, ready: false };

/** Runs the PR 2 reads (P5 spec §5) when the requests they cover change, after any change to the request list, and on
 * every refresh (`revision`); never periodically or on focus. Only the latest read lands. While a new set of requests is
 * read, the earlier result stays and `ready` is false; a re-read of the same set stays ready, so rows do not flicker. */
export function useTodoExtras({ role, tickets, reads, revision }: { role: CoreRole | null; tickets: readonly CoreTicketDto[]; reads: TodoReads | null; revision: number }): TodoExtras {
  const targets = useMemo(() => role ? todoTargets(role, tickets) : null, [role, tickets]);
  const key = role && reads && targets && hasTodoReads(reads, targets) ? JSON.stringify([role, targets, Object.keys(reads).sort()]) : null;
  const [state, setState] = useState<{ key: string; value: TodoExtras } | null>(null);
  useEffect(() => {
    if (!key || !role || !reads) return;
    let live = true;
    void collectTodoExtras({ role, tickets, reads, now: Date.now() }).then(value => { if (live) setState({ key, value }); });
    return () => { live = false; };
  }, [key, role, tickets, reads, revision]);
  return useMemo(() => {
    if (!role || !reads) return NOT_READY;
    if (!key) return NO_TODO_EXTRAS;
    return state ? { ...state.value, ready: state.key === key } : NOT_READY;
  }, [role, reads, key, state]);
}
```

- [ ] **Step 4: 시험이 통과하는지 본다**

Run: `npm --workspace @build-manager/web run test -- src/app/core/nav/use-todo-extras.test.tsx`
Expected: PASS(5 tests).

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음. `react-hooks` 규칙 경고도 없음.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/core/nav/use-todo-extras.ts apps/web/src/app/core/nav/use-todo-extras.test.tsx
git commit -m "feat(web): run the P5 PR 2 to-do reads when the requests change or refresh

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 4: 화면 시험을 먼저 쓴다

**Files:**
- Create: `apps/web/tests/core-e2e/todo-extras.spec.ts`
- Modify: `apps/web/tests/core-login-e2e/navigation.spec.ts`(끝에 시험 하나)
- Modify: `apps/web/tests/core-login-e2e/onboarding.spec.ts`(끝에 시험 하나)
- Modify: `apps/web/tests/vendor-e2e/vendor-job.spec.ts`(끝에 시험 둘)

**Interfaces:**
- Consumes (Task 1): 행 표시 `data-todo-ticket`, `data-todo-link`. 안내 `처리할 일을 더 확인하고 있어요.`, `최근 끝난 요청 20건만 확인해요.`. 알림 목록 `section[aria-label="처리할 일"]`는 읽는 중이면 `aria-busy="true"`다.
- 이 Task의 시험은 Task 5 전에는 실패해야 한다(RED). Task 5 뒤에 모두 통과한다.

- [ ] **Step 1: 개발 모드 시험 — 결과 확인, 20건과 동시 4개, 기한 지남**

`apps/web/tests/core-e2e/todo-extras.spec.ts`를 만든다.

```ts
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mintOwnSession } from "./own-session";

// P5 PR 2 (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md §5): 결과 확인 and 기한 지남 on 알림, the
// 20-request limit and four reads at once. Development sign-in: no Vendor or link-request reads here.
let tenant = "", manager = "";
test.beforeAll(async () => { tenant = await mintOwnSession("tenant"); manager = await mintOwnSession("manager"); });
// A list read can still be in flight when a test ends; drop it instead of failing on a route that outlived the test.
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });
const bearer = (code: string) => ({ Authorization: `Bearer ${code}` });
const menu = (page: Page) => page.getByRole("navigation", { name: "주 메뉴", exact: true });
async function login(page: Page, code: string, path = "/core") {
  await page.goto(path); await page.getByLabel("개발 접근 코드").fill(code);
  await page.getByRole("button", { name: "들어가기", exact: true }).click(); await expect(menu(page)).toBeVisible();
}
/** Lists only the requests this test made, as home.spec.ts does: the shared fixture keeps every other file's requests. */
async function onlyMine(page: Page, mine: string[]) {
  await page.route("**/api/v2/core/tickets", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(), all = await response.json() as { ticketId: string }[];
    await route.fulfill({ response, json: all.filter(ticket => mine.includes(ticket.ticketId)) });
  });
}
async function api(page: Page, code: string, path: string, data?: unknown, status = 200) {
  const response = data === undefined ? await page.request.get(`/api/v2/core/${path}`, { headers: bearer(code) })
    : await page.request.post(`/api/v2/core/${path}`, { headers: bearer(code), data });
  expect(response.status()).toBe(status); return response.json();
}
async function create(page: Page, text: string) {
  const units = await api(page, tenant, "units") as { id: string }[];
  return (await api(page, tenant, "tickets", { unitId: units[0].id, issueType: "LEAK", rawUserText: text }, 201)).ticketId as string;
}
/** The manager finishes a request, as ticket-outcome.spec.ts does. */
async function finish(page: Page, id: string) {
  await api(page, manager, `tickets/${id}/handling`, { status: "IN_PROGRESS", message: "합성 처리 시작" });
  const version = (await api(page, tenant, `tickets/${id}/communication`)).version;
  await api(page, manager, `tickets/${id}/handling`, { status: "COMPLETED", message: "합성 완료 기록", expectedCommunicationVersion: version });
}

test("a finished request with an unconfirmed result is the tenant's to-do until they answer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  const id = await create(page, "합성 결과 확인 요청"); mine.push(id); await finish(page, id);
  await login(page, tenant);
  await menu(page).getByRole("link", { name: /^알림/ }).click();
  const row = page.locator(`[data-todo-ticket="${id}"]`);
  await expect(row).toContainText("결과 확인 필요");
  await expect(menu(page).getByRole("link", { name: "알림, 처리할 일 1건", exact: true })).toBeVisible();
  await row.click(); await page.getByRole("button", { name: "해결됐어요", exact: true }).click();
  await expect(page.getByText("해결됐다고 알려주셨어요.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "뒤로", exact: true }).click();
  await expect(page.locator(`[data-todo-ticket="${id}"]`)).toHaveCount(0);
  await expect(page.getByText("지금 처리할 일이 없어요. 새 문제가 생기면 홈에서 접수해 주세요.", { exact: true })).toBeVisible();
});

test("results are read for the 20 most recent finished requests only, four at a time, and 알림 says so", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const mine: string[] = []; await onlyMine(page, mine);
  for (let n = 0; n < 21; n++) { const id = await create(page, `합성 끝난 요청 ${n}`); await finish(page, id); mine.push(id); }
  const read = new Set<string>(); let open = 0, most = 0;
  await page.route("**/api/v2/core/tickets/*/outcome", async route => {
    if (route.request().method() !== "GET") return route.continue();
    read.add(new URL(route.request().url()).pathname.split("/").at(-2)!);
    open++; most = Math.max(most, open);
    await new Promise(resolve => setTimeout(resolve, 150));
    const response = await route.fetch(); open--;
    await route.fulfill({ response });
  });
  // Opened straight on 알림: tapping the tab would start a second pass while the first is in flight.
  await login(page, tenant, "/core?tab=alerts");
  const todo = page.locator('section[aria-label="처리할 일"]');
  await expect(todo).toBeVisible(); await expect(todo).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator("[data-todo-ticket]")).toHaveCount(20);
  await expect(page.getByText("최근 끝난 요청 20건만 확인해요.", { exact: true })).toBeVisible();
  // mine[0] finished first, so it is the one past the limit.
  expect(read.has(mine[0])).toBe(false);
  expect(read.size).toBe(20);
  expect(most).toBe(4);
});

test("a manager's request past its due date is on 알림 as 기한 지남, above the replies", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const mine: string[] = []; await onlyMine(page, mine);
  const late = await create(page, "합성 기한 지남 요청"); mine.push(late);
  await api(page, manager, `manager/tickets/${late}/work`, { priority: "NORMAL", assigneeLabel: "합성 담당", dueAt: new Date(Date.now() - 86_400_000).toISOString(), expectedVersion: 1 });
  const reply = await create(page, "합성 관리자 답변 대기"); mine.push(reply);
  await api(page, tenant, `tickets/${reply}/communication/messages`, { clientRequestId: randomUUID(), expectedVersion: 0, intent: "TENANT_MESSAGE", body: "합성 세입자 문의예요." }, 201);
  await login(page, manager);
  await menu(page).getByRole("link", { name: /^알림/ }).click();
  const todo = page.locator('section[aria-label="처리할 일"]');
  await expect(todo).toBeVisible(); await expect(todo).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator(`[data-todo-ticket="${late}"]`)).toContainText("기한 지남");
  await expect(page.locator("[data-todo-ticket]")).toHaveCount(2);
  expect(await page.locator("[data-todo-ticket]").evaluateAll(rows => rows.map(row => row.getAttribute("data-todo-ticket")))).toEqual([late, reply]);
  await page.locator(`[data-todo-ticket="${late}"]`).click();
  await expect(page).toHaveURL(/tab=work$/); await expect(page.getByTestId("ticket-heading")).toBeVisible();
});
```

- [ ] **Step 2: B1 시험 — 요청마다 읽기의 403·500·401**

`apps/web/tests/core-login-e2e/navigation.spec.ts` 끝에 더한다. 파일 위의 `menu`, `link`, `sdkSession`을 그대로 쓴다.

```ts
test("a refused Vendor schedule read is not a failure, an error is, and a lost session signs out (P5 PR 2)", async ({ browser }) => {
  const tenant = await sdkSession(browser), manager = await sdkSession(browser, "manager");
  try {
    // A request in progress is the tenant's only kind with a Vendor schedule read (spec §5).
    const made = await tenant.context.request.post("/api/v2/core/tickets", { headers: tenant.headers, data: { unitId: tenant.fixture.unitA, issueType: "LEAK", rawUserText: "합성 업체 일정 읽기" } });
    expect(made.status()).toBe(201); const id = (await made.json()).ticketId as string;
    expect((await manager.context.request.post(`/api/v2/core/tickets/${id}/handling`, { headers: manager.headers, data: { status: "IN_PROGRESS", message: "합성 처리 시작" } })).status()).toBe(200);
    const page = await tenant.context.newPage(); await page.setViewportSize({ width: 390, height: 844 });
    let status = 403, seen = 0;
    await page.route("**/api/v2/core/tickets/*/vendor-scheduling", async route => {
      if (route.request().method() !== "GET") return route.continue();
      if (route.request().url().includes(id)) seen++;
      await route.fulfill({ status, json: { error: { code: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "DEPENDENCY_UNAVAILABLE", message: "합성 응답" } } });
    });
    const todo = page.locator('section[aria-label="처리할 일"]');
    await page.goto("/core?tab=alerts");
    await expect.poll(() => seen).toBeGreaterThan(0);
    await expect(todo).toBeVisible(); await expect(todo).not.toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("일부를 확인하지 못했어요.", { exact: true })).toHaveCount(0);
    await expect(menu(page)).toBeVisible();
    // Any other error makes the list partial; tapping 알림 again reads again.
    status = 500; const before = seen;
    await link(page, /^알림/).click(); await expect.poll(() => seen).toBeGreaterThan(before);
    await expect(page.getByText("일부를 확인하지 못했어요.", { exact: true })).toBeVisible();
    // A 401 on a per-request read still signs out.
    status = 401;
    await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
    await expect(page.getByText(/^세션이 만료되었거나 접근 권한이 변경됐어요/)).toBeVisible();
    await expect(menu(page)).toHaveCount(0);
  } finally { await tenant.close(); await manager.close(); }
});
```

- [ ] **Step 3: B1 시험 — 연결 요청 처리할 일**

`apps/web/tests/core-login-e2e/onboarding.spec.ts` 끝에 더한다. 파일 위의 `setup`, `create`, `request`, `approve`를 그대로 쓰고, 이 파일의 짧은 쓰기 방식을 따른다.

```ts
test("a link request is the admin's to-do on 알림 and opens 입주 연결 (P5 PR 2)",async({browser})=>{
 const f=await setup(browser);try{
  const {link,invitation}=await create(f.page),tenant=await f.tenant.context.newPage();await request(tenant,link);
  const menu=f.page.getByRole("navigation",{name:"주 메뉴",exact:true});
  await menu.getByRole("link",{name:/^알림/}).click();
  const row=f.page.locator(`[data-todo-link="${invitation.invitationId}"]`);
  await expect(row).toContainText("입주 연결 · 합성 초대 테스트 호실");await expect(row).toContainText("연결 요청 확인 필요");
  await expect(menu.getByRole("link",{name:"알림, 처리할 일 1건",exact:true})).toBeVisible();
  await row.click();await expect(f.page).toHaveURL(/tab=more&view=invitations$/);
  await approve(f.page);
  await menu.getByRole("link",{name:/^알림/}).click();
  await expect(f.page.locator(`[data-todo-link="${invitation.invitationId}"]`)).toHaveCount(0);
 }finally{await f.close();}
});
```

- [ ] **Step 4: 업체 흐름 시험 — 방문 시간 확정 필요, 업체 확인 필요**

`apps/web/tests/vendor-e2e/vendor-job.spec.ts` 끝에 더한다.
- 파일 위의 import에 `actor`, `core`, `guards`, `job`, `provision`, `safeGoto`, `vendorContext`, `click`, `keyboardClick`, `randomUUID`가 없으면 더한다. `harness.ts`에서 내보내는 이름이다.
- 업체 거절 단계는 이 파일 B05 시험의 거절 단계와 같다.

```ts
test('P5-T01 a Vendor job waiting on the resident puts 방문 시간 확정 필요 on the resident 알림 until they answer', async ({ browser, fixture }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), t = await actor(browser, fixture, 'tenant');
  try {
    await click(v.page, '작업 수락');
    expect((await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling`)).waitingOn).toBe('TENANT');
    await safeGoto(t.page, '/core?tab=alerts', 'open 알림');
    const row = t.page.locator(`[data-todo-ticket="${c.ticketId}"]`);
    await expect(row).toContainText('방문 시간 확정 필요');
    // Once the resident sends their times the Vendor proposes next; tapping 알림 again reads again.
    const startAt = new Date(Date.now() + 86400000).toISOString(), endAt = new Date(Date.now() + 90000000).toISOString();
    await core(fixture, 'tenant', `tickets/${c.ticketId}/vendor-scheduling/availability`, { clientRequestId: randomUUID(), ...guards(await job(v.context)), windows: [{ startAt, endAt }] });
    await t.page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: /^알림/ }).click();
    const todo = t.page.locator('section[aria-label="처리할 일"]');
    await expect(todo).toBeVisible(); await expect(todo).not.toHaveAttribute('aria-busy', 'true');
    await expect(t.page.locator(`[data-todo-ticket="${c.ticketId}"]`)).not.toContainText('방문 시간 확정 필요');
  } finally { await v.close(); await t.close(); }
});

test('P5-T02 a declined Vendor job puts 업체 확인 필요 on the manager 알림 and opens it in 업무함', async ({ browser, fixture }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), m = await actor(browser, fixture, 'manager', 1280);
  try {
    await click(v.page, '작업 거절'); await v.page.getByRole('radio', { name: '일정·인력 여유가 없음', exact: true }).check();
    await click(v.page, '거절 내용 확인'); await keyboardClick(v.page, '거절하기');
    await expect.poll(async () => (await core(fixture, 'manager', `manager/tickets/${c.ticketId}/vendor-handoff`)).assignment?.endReason).toBe('DECLINED');
    await safeGoto(m.page, '/core?tab=alerts', 'open 알림');
    const row = m.page.locator(`[data-todo-ticket="${c.ticketId}"]`);
    await expect(row).toContainText('업체 확인 필요');
    await row.click(); await expect(m.page).toHaveURL(/tab=work$/); await expect(m.page.getByTestId('ticket-heading')).toBeVisible();
  } finally { await v.close(); await m.close(); }
});
```

`not.toContainText`는 그 행이 다른 이유(예: 제출 전)로 남아 있어도 맞다. 행이 아예 사라져도 맞는다(`locator`가 0개면 `not.toContainText`가 통과한다).

- [ ] **Step 5: 시험이 실패하는지 본다(RED)**

하나씩 돌린다. 동시에 돌리지 않는다.

```bash
npm run test:e2e:core -- todo-extras.spec.ts
npm run test:e2e:sdk -- navigation.spec.ts onboarding.spec.ts
npm run test:e2e:vendor -- vendor-job.spec.ts -g "P5-T0"
```

Expected
- 새 시험 일곱 개가 실패한다. 이유는 모두 새 이유 이름이나 행이 화면에 없어서다.
  - core 3개
  - sdk 2개: navigation은 500 뒤에 '일부를 확인하지 못했어요'가 나오지 않아 실패하고, onboarding은 `data-todo-link` 행이 없어 실패한다.
  - vendor 2개
- sdk navigation의 403 단계는 지금도 통과할 수 있다. 지금은 업체 일정을 읽지 않기 때문이다. 그러면 `seen`이 0이라 `expect.poll`에서 실패한다. 그것도 맞는 RED다.
- 기존 시험의 실패는 알려진 로컬 실패만 있어야 한다(Task 7 Step 1 목록).

- [ ] **Step 6: 커밋**

```bash
git add apps/web/tests/core-e2e/todo-extras.spec.ts apps/web/tests/core-login-e2e/navigation.spec.ts apps/web/tests/core-login-e2e/onboarding.spec.ts apps/web/tests/vendor-e2e/vendor-job.spec.ts
git commit -m "test(web): browser tests for the P5 PR 2 to-do reasons (red until wired)

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 5: 화면에 붙인다

**Files:**
- Modify: `apps/web/src/app/core/core-screen.tsx:3,91-105`, `143` 근처, `351`, `360`

**Interfaces:**
- Consumes (Task 2): `endsSession`, `todoReadsFor`
- Consumes (Task 3): `useTodoExtras`
- Consumes (Task 1): `buildTodoList`(`extras`), `EMPTY_TODO_LIST`

- [ ] **Step 1: import**

3행을 바꾼다.

```ts
import { createCoreFlowClient,createCoreOnboardingClient,ApiClientError } from "@build-manager/api-client";
```

`import { buildTodoList,EMPTY_TODO_LIST } from "./nav/todo-list";` 아래에 더한다.

```ts
import { endsSession,todoReadsFor } from "./nav/todo-extras";
import { useTodoExtras } from "./nav/use-todo-extras";
```

- [ ] **Step 2: 요청마다 읽기용 클라이언트**

91–105행(`// The embedded intake/review also uses this client` 주석부터 `const client=useMemo(…);`까지)을 아래로 바꾼다. 요청마다 읽기가 아닌 곳(`checkedFetch(false)`)은 지금과 똑같이 동작한다.

```ts
  // The embedded intake/review also uses this client: a denied nested request
  // must clear the parent screen, not leave old protected content visible.
  // P5 PR 2 (spec §5): the to-do reads per request use their own client. Its 403 means nothing is assigned there, as on
  // the request screens, so it never clears the screen; its 401 still does (endsSession).
  const checkedFetch=useCallback((perRequest:boolean):typeof fetch=>async(input,init)=>{
    const headers=new Headers(init?.headers);if(b1){headers.set("x-core-organization",b1.orgId);headers.set("x-b1-csrf",b1.csrf);}
    const response=await fetch(input,{...init,headers});
    if(endsSession(response.status,perRequest)){
      clearCommunicationRecovery();clearOutcomeRecovery();
      if(b1)onDenied?.();
      if(!String(input).endsWith("/session")){clearAccess();setError(response.status===401?sessionMessage:accessMessage);}
    }
    if(response.status===404&&String(input).includes("/manager/")&&String(input).includes("maintenance")){
      clearAccess();setError(accessMessage);
    }
    return response;
  },[clearAccess,b1,onDenied]);
  const client=useMemo(()=>{const guarded=checkedFetch(false);return createCoreFlowClient({baseUrl:"",fetchImpl:guarded,photoFetchImpl:guarded});},[checkedFetch]);
  const perRequestClient=useMemo(()=>createCoreFlowClient({baseUrl:"",fetchImpl:checkedFetch(true)}),[checkedFetch]);
  // 연결 요청 (B1): a list read, so a 401 or 403 there signs out like the other list reads (spec §5).
  const linkRequests=useMemo(()=>b1?createCoreOnboardingClient({csrf:b1.csrf,orgId:b1.orgId,fetchImpl:checkedFetch(false)}).list:undefined,[b1,checkedFetch]);
```

타입 오류가 나면(`typeof fetch`와 `FetchLike`) `createCoreOnboardingClient`에 넘기는 값만 `checkedFetch(false) as Parameters<typeof createCoreOnboardingClient>[0]["fetchImpl"]`로 맞춘다. 동작은 바꾸지 않는다.

- [ ] **Step 3: 읽기 훅을 목록에 잇는다**

`const todo=useMemo(…)` 줄(143행 근처)을 아래 세 줄로 바꾼다.

```ts
  // P5 PR 2 (spec §5): reads per request, the manager's work list and the link requests, after the request list loads or
  // changes and on every refresh; never periodically.
  const todoReads=useMemo(()=>role?todoReadsFor({role,b1:Boolean(b1),perRequest:perRequestClient,list:client,invitations:linkRequests}):null,[role,b1,perRequestClient,client,linkRequests]);
  const todoExtras=useTodoExtras({role,tickets,reads:todoReads,revision});
  const todo=useMemo(()=>role?buildTodoList({role,tickets,summaries:conversationSummaries.summaries,summariesFailed:conversationSummaries.error,extras:todoExtras}):EMPTY_TODO_LIST,[role,tickets,conversationSummaries.summaries,conversationSummaries.error,todoExtras]);
```

- [ ] **Step 4: 홈의 다음 할 일이 새 이유도 기다리게 한다**

- 351행 `aria-busy={conversationSummaries.ready?undefined:"true"}`를 `aria-busy={conversationSummaries.ready&&todoExtras.ready?undefined:"true"}`로 바꾼다.
- 360행 `{conversationSummaries.ready&&!conversationSummaries.error?`를 `{conversationSummaries.ready&&todoExtras.ready&&!conversationSummaries.error?`로 바꾼다.
- 그 위 주석(356–358행)의 첫 문장을 아래로 바꾼다.
  ```
  {/* Never show a next step the reads have not confirmed yet (the conversation read, and the PR 2 reads such as a visit
    * time to confirm), whether they are still loading or the conversation read failed: an empty span of the same line
  ```
  나머지 문장은 그대로 둔다.

배지(`badge={conversationSummaries.ready?todo.items.length:0}`)와 홈의 처리할 일 한 줄은 바꾸지 않는다. 새 이유가 도착하면 그 수에 더해진다. 둘 다 확인된 행만 센다.

- [ ] **Step 5: 계산 시험과 정적 검사**

```bash
npm --workspace @build-manager/web run test
npm run typecheck
npm run lint
```

Expected: 모두 통과.

- [ ] **Step 6: Task 4 시험이 통과하는지 본다(GREEN)**

하나씩 돌린다.

```bash
npm run test:e2e:core -- todo-extras.spec.ts home.spec.ts navigation.spec.ts
npm run test:e2e:sdk -- navigation.spec.ts onboarding.spec.ts
npm run test:e2e:vendor -- vendor-job.spec.ts
```

Expected
- 새 시험 일곱 개가 통과한다.
- `home.spec.ts`의 '대화 읽기 대기·실패' 시험과 sdk `navigation.spec.ts`의 배지 수 시험도 그대로 통과한다. 둘 다 `aria-busy`가 풀린 뒤를 잰다.
- 실패가 있으면 알려진 로컬 실패(Task 7 Step 1)인지 먼저 확인한다. 아니면 고친다.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/app/core/core-screen.tsx
git commit -m "feat(web): wire the P5 PR 2 to-do reads into /core; per-request 403 no longer signs out

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 6: 스펙과 현황 문서

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`
- Modify: `design/DESIGN_STATUS.md:17-21`

- [ ] **Step 1: 스펙 5절에 구현에서 정한 것을 적는다**

5절 "읽는 양의 한도" 목록의 둘째 줄(`요청마다 읽는 것(PR 2)은 …`)을 아래로 바꾼다.

```markdown
  - 요청마다 읽는 것(PR 2)은 동시에 4개까지다.
    - 업체 일정(세입자)은 처리 중인 요청만 읽는다. 업체에 제안된 요청은 처리 중으로 바뀌므로(`vendor_handoff_mark_offered`) 방문 시간을 기다리는 요청은 늘 처리 중이다.
    - 업체 전달(관리자)은 업체 처리 대상(`vendorHandoffEligible`)인 처리 완료 전 요청만 읽는다.
    - 결과(세입자)는 최근 끝난 요청 20건만 읽는다. 끝난 요청이 20건을 넘을 때만 목록 아래에 "최근 끝난 요청 20건만 확인해요."를 적는다.
```

"읽는 시점" 줄을 아래로 바꾼다.

```markdown
- 읽는 시점: 요청 목록을 불러온 직후와 그 목록이 바뀐 뒤(저장 같은 변경 뒤, 요청을 닫은 뒤), 새로고침, 알림 탭을 열 때. 주기적으로, 또는 창에 돌아올 때마다 다시 읽지 않는다.
```

"일부를 읽지 못하면" 목록 끝에 더한다.

```markdown
  - 요청마다 읽기가 아직 끝나지 않았으면 확인된 행 아래에 "처리할 일을 더 확인하고 있어요."를 둔다. 목록은 `aria-busy`이고, 홈의 다음 할 일 한 줄도 이 읽기를 기다린다.
  - 연결 요청이 100건(5쪽)을 넘으면 "연결 요청은 100건까지만 확인했어요. 입주 연결에서 모두 볼 수 있어요."를 적는다. 다시 불러와도 바뀌지 않으므로 '일부를 확인하지 못했어요'와 따로 둔다.
```

"권한 응답" 목록 끝에 더한다.

```markdown
  - 요청마다 읽기는 403을 로그아웃으로 보지 않는 클라이언트를 따로 쓴다(`core-screen.tsx`의 `checkedFetch(true)`). 다른 모든 읽기와 쓰기는 지금처럼 401·403에서 화면을 비운다.
```

"누르면" 목록의 연결 요청 줄을 아래로 바꾼다.

```markdown
  - 연결 요청은 행마다 하나다. 제목은 "입주 연결 · 호실 이름", 이유는 "연결 요청 확인 필요", 시각은 신청 시각이다. 누르면 '더 보기 › 입주 연결'을 연다(링크).
```

- [ ] **Step 2: 결정 절에 이 계획의 결정을 적는다**

"운영자 결정(2026-10-14, 최종 리뷰 뒤)" 묶음 끝에 더한다. `<운영자 답>`에는 이 계획을 승인할 때 운영자가 한 말을 그대로 옮긴다.

```markdown
- D13(운영자 결정 2026-10-14): PR 2 구현 계획(`docs/superpowers/plans/2026-10-14-navigation-shell-p5-reasons.md`)과 새 문구 세 가지(연결 요청 행 제목, 읽는 중 안내, 연결 요청 100건 안내)를 실제 크기 그림으로 보고 승인했다: "<운영자 답>".
  - 끝난 요청 20건 안내는 20건을 넘을 때만 보인다. 그 밖에는 읽지 않은 요청이 없어 안내가 뜻이 없다.
```

"남은 위험"의 "PR 2의 요청마다 읽기는 …" 줄 뒤에 더한다.

```markdown
- PR 2의 요청마다 읽기는 요청 목록이 바뀔 때마다 다시 돈다. 관리자는 업체 처리 대상 요청 수만큼 읽는다. 큰 조직에서 느리면 업무함과 읽기를 나누는 방법을 운영자와 정한다.
```

- [ ] **Step 3: 현황 문서**

`design/DESIGN_STATUS.md` 내비게이션 항목에서 "홈의 처리할 일 한 줄·…" 줄 뒤에 더한다.

```markdown
  - 알림의 처리할 일에 방문 시간 확정 필요·결과 확인 필요·업체 확인 필요·기한 지남·연결 요청 확인 필요를 PR 2에서 더했습니다(요청마다 동시 4개, 끝난 요청 20건, 연결 요청 100건까지 읽음).
```

- [ ] **Step 4: 문서 검사**

Run: `python scripts/verify_repository.py --history`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md design/DESIGN_STATUS.md
git commit -m "docs: record the P5 PR 2 read rules, copy and decision

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 7: 전체 검사, 망가뜨려 보기, 리뷰, 기록, 병합

**Files:**
- Create: `ops/navigation_shell_p5_reasons_20261014_acceptance.md`
- Modify: `ops/AI_Execution_Log.csv`(행 추가만, Edit 도구, UTC `+00:00`, 따옴표는 `""`로 두 번)

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
node --experimental-transform-types scripts/design-audit.mjs "$HOME/.build-manager-rc1-private/p5-reasons"
```

- Expected: 모두 통과. 예외는 아래 알려진 로컬 실패뿐이다.
  - core: 공용 시험 데이터가 커서 화면 로딩 대기에서 시간 초과로 실패하는 것들(#145 기록: 12~13개).
  - sdk: login:35 ×3, design:53, maintenance-fact:5(호실 200개 초과), design:107·112(초대 쪽수).
  - 그래프 경계 시험의 5초 초과(#119). 전체 실행에서 나면 `tests/architecture`만 같은 설정으로 다시 돌려 확인한다.
- 로컬에서 실패한 새 시험이 있으면 시간 초과인지 내용 실패인지 구별해 적는다. 판정은 CI(새 데이터베이스)다.
- 디자인 점검 뒤 390px·1280px의 알림 캡처를 직접 열어 본다.

- [ ] **Step 2: 일부러 망가뜨려 시험이 잡는지 본다**

하나씩 바꾸고, 그 시험이 실패하는지 보고, `git checkout -- <파일>`로 되돌린다.

| 망가뜨리기 | 잡아야 하는 시험 |
| --- | --- |
| `todo-extras.ts` `READ_LIMIT = 4`를 `5`로 | `todo-extras.test.ts` "never has more than four …" |
| `todoTargets`의 `.slice(0, RESULT_LIMIT)`를 지움 | `todo-extras.test.ts` "reads a tenant's visit times …" |
| `failure()`에서 `perRequest && (status === 403 \|\| status === 404) ? "none" :`을 지움(늘 실패) | `todo-extras.test.ts` "finds the visit times … nothing for 403 or 404" |
| `endsSession`에서 `&& !perRequest`를 지움 | `todo-extras.test.ts` "ends the session …"와 sdk `navigation.spec.ts` 새 시험 |
| `requested()`의 `page < LINK_PAGE_LIMIT`를 `page < 50`으로 | `todo-extras.test.ts` "lists requested links …" |
| `todo-list.ts` `GROUP`의 `OVERDUE: 1`을 `OVERDUE: 3`으로 | `todo-list.test.ts` "puts 기한 지남 right after …" |
| `use-todo-extras.ts`에서 `if (live)`를 지움 | `use-todo-extras.test.tsx` "lets only the latest read land …" |
| `nav-screens.tsx`에서 `list.partial \|\| list.checking ? null :`의 `\|\| list.checking`을 지움 | `core-nav.test.tsx` "says while the rest is still being read …" |

결과 표를 PR 본문과 수락 기록에 넣는다.

- [ ] **Step 3: 새 문맥 독립 리뷰(DEV-04 5단계)**

리뷰 에이전트(새 문맥, 가장 강한 모델)에 아래를 준다.
- 스펙, 이 계획, `git diff origin/main...HEAD`
- 이 묶음에서 미뤄 둔 사소한 지적 목록

다음을 보게 한다.
- 스펙 5절 준수: 이유 조건, 한도, 실패와 권한, 읽는 시점
- 401·403 처리가 요청마다 읽기 밖에서 바뀌지 않았는지(`checkedFetch(false)`가 예전 `guarded`와 같은지)
- 서버 부담: 읽기가 주기적으로 돌거나 겹쳐 돌지 않는지
- 접근성(`aria-busy`, `role="status"`, 링크 행), 규칙 8.5·8.7·8.15, 해요체
- 회귀: FROZEN 화면 시험을 바꾼 이유

지적은 한 번에 고치고, 고친 부분만 다시 리뷰받는다(delta).

- [ ] **Step 4: 수락 기록(DEV-04 6단계)**

`ops/navigation_shell_p5_home_20261014_acceptance.md`의 구성을 따라 `ops/navigation_shell_p5_reasons_20261014_acceptance.md`를 쓴다.
- `TARGET_REF`, `POLICY_REF`(main `060950d` 또는 그 뒤 규칙 커밋)
- 운영자 승인
  - 2026-10-13 스펙 승인
  - 2026-10-14 PR 2 계획 작성 요청: "그래 계획 작성해봐"
  - 계획 승인(D13, 운영자 답 그대로)
- 이 계획이 새로 정한 문구 세 가지와 읽기 규칙(Task 6 Step 1)
- 바꾼 시험 파일과 이유
  - 계산 시험: 목록 값이 새 필드를 가짐
  - 화면 시험: 새 시험만 더함. 기존 시험은 고치지 않음
- 실행한 검사와 결과(Step 1), 망가뜨려 보기(Step 2), 리뷰 결과(Step 3)
- 알려진 로컬 실패, 데모 배포 안 함
- 남은 일
  - 처리 중 문구 차이: 홈 행 "처리 중이에요." ↔ 상세 "관리자가 확인하고 있어요." 운영자에게 묻는다.
  - 홈의 대화 요약 실패 상태가 스펙에 없음
  - 관리자 대화 요약을 업무함과 같이 읽기
  - 공용 로컬 시험 데이터 정리(운영자 승인 필요)

`ops/AI_Execution_Log.csv`에는 Edit 도구로 행만 더한다.
- 기존 행을 다시 쓰지 않는다.
- 따옴표 안의 따옴표는 `""`로 쓴다(`\"` 금지).
- main과 충돌하면 main 행을 먼저 둔다.

- [ ] **Step 5: PR을 연다**

```bash
git fetch origin && git merge --no-edit origin/main   # main이 움직였으면. 충돌은 main 행 먼저.
git push -u origin feat/navigation-shell-p5-reasons
gh pr create --base main --title "feat(web): P5 PR 2 — per-request to-do reasons on 알림" --body-file <scratchpad의 본문 파일>
```

본문은 한국어로 쓴다. 넣을 것:
- 목적, 스펙·계획 링크
- 새 이유 다섯 가지와 읽기 규칙
- 새로 정한 문구
- 바꾼 시험 파일과 이유
- 검사 결과, 망가뜨려 보기 표
- 알려진 로컬 실패
- 데모 배포 안 함(운영자에게 따로 묻는다)
- 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

- [ ] **Step 6: CI 통과 후 병합한다**

정확한 head에서 CI(`app-check.yml`, `repository-check.yml`)가 통과하면 아래로 병합한다.

```bash
gh pr merge <번호> --merge --match-head-commit <head SHA>
```

- CI가 실패하면 원인을 찾아 고치고, 같은 방식으로 범위 리뷰를 받고, PR 댓글에 경과를 남긴다.
- 병합 뒤 바깥 체크아웃을 앞으로 감는다.
  - 먼저 `git fetch`를 한다(안 하면 "Not a valid commit name"으로 실패한다).
  - 명령: `node "$LOCALAPPDATA/build-manager-maintenance/outer-ff.cjs" <병합 커밋 전체 SHA> outer-checkout-update-20261010-<N>`
  - `<N>`: 2026-10-14 현재 다음 번호는 -40이다. `outer-checkout-update-20261010-*` 목록을 확인하고 쓴다.

- [ ] **Step 7: 운영자에게 보고한다**

쉬운 한국어로 보고한다.
- 무엇이 바뀌었는지: 알림에 새로 뜨는 다섯 가지 일
- 검사 결과
- 남은 일
- 데모에는 아직 올리지 않았다는 것. P5 묶음이 모두 병합됐으므로 데모 배포를 할지 묻는다.

## 자체 점검 결과(계획 작성 뒤)

- **스펙 대응**
  - 5절 표의 PR 2 다섯 줄
    - 이름: Task 1
    - 조건: Task 2. 업체 일정 대상은 처리 중 요청, 업체 전달 대상은 업체 처리 대상 요청으로 좁혔다(코드에서 확인한 사실).
  - 정렬(기한 지남이 둘째 무리): Task 1
  - 읽기 한도(동시 4개, 20건, 5쪽): Task 2
  - 일부 실패 안내와 다시 불러오기를 요청마다 읽기까지: Task 1(`partial`)과 Task 5(다시 불러오기가 `revision`을 올림)
  - 403·404는 실패 아님, 401은 다시 로그인: Task 2(`failure`, `endsSession`)와 Task 5(`checkedFetch(true)`)
  - 목록 단위 401·403은 다시 로그인: Task 2와 Task 5(`checkedFetch(false)`)
  - 읽는 시점: Task 3. 주기 읽기와 창 복귀 읽기는 없다.
  - 배지는 확인된 행만: Task 1·5. 읽는 중에는 확인된 행만 센다.
  - 연결 요청은 '더 보기 › 입주 연결'을 엶: Task 1
  - 테스트 절의 PR 2 줄
    - 동시 4개·20건 한도·일부 실패·403/404/401·5쪽 한도: Task 2(계산), Task 4(화면)
    - 업체 일정·결과의 끝에서 끝까지 시험(기존 업체 시험 도구): Task 4
  - 위협 표 "요청마다 읽기가 서버에 부담을 줌": Task 2·3
- **이름 일관성**
  - Task 1이 만드는 것: `TodoExtras`, `NO_TODO_EXTRAS`, `EMPTY_TODO_LIST`, `TodoLinkRequest`, `todoItemId`. Task 2·3·5가 같은 이름으로 쓴다.
  - Task 2가 만드는 것: `TodoReads`, `todoTargets`, `hasTodoReads`, `collectTodoExtras`, `endsSession`, `todoReadsFor`. Task 3·5가 쓴다.
  - Task 3이 만드는 것: `useTodoExtras`. Task 5가 쓴다.
  - `onOpenPlace`는 Task 1에서 만들고, 같은 Task에서 `core-screen.tsx`가 `navigate`를 넘긴다.
- **이 계획이 정한 것**(Task 6에서 스펙에 적음)
  - 문구 세 가지
  - 업체 일정·업체 전달의 대상 좁히기
  - 20건 안내는 20건을 넘을 때만
  - 읽는 중 안내는 목록 아래
  - 요청마다 읽기용 클라이언트
  - 홈의 다음 할 일 한 줄이 새 이유를 기다림
- **범위 밖으로 남김**
  - 관리자 대화 요약을 업무함과 같이 읽기
  - 업무함 행의 '기한 지남' 글자를 이름 파일로 옮기기(같은 글자라 화면은 같다)
  - 처리 중 문구 차이, 홈 대화 요약 실패 상태(운영자에게 물을 것)

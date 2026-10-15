# 소개 페이지 스크롤 장면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 화면 `/`을 토스식 스크롤 장면(첫 장면, 세입자, 관리자, 업체, 결과와 기록, 마지막 입구)으로 바꾼다. 움직임은 디자인 규칙 9.1(이 계획이 추가)이 허용하는 곳에서만 돌고, 움직이지 않을 때도 모든 내용을 보여 준다.

**Architecture:**
- 계산은 순수 함수 파일 `landing/scene-motion.ts`가 맡는다.
- 클라이언트 부품 `landing/scroll-scenes.tsx`는 장면마다 `data-motion`을 켜고, 스크롤에 따라 CSS 변수(`--p`, `--a`, `--b`, `--s`)와 `data-step`·`data-side`를 바꾼다.
- 장면 마크업(`landing/scenes.tsx`)과 그림(`landing/drawings.tsx`)은 서버 부품이고, 서버는 늘 움직이지 않는 모양으로 그린다.
- 모양은 `home.module.css` 하나가 정한다. 기본은 움직이지 않는 모양이고, `[data-motion="on"]`일 때만 장면 칸이 붙고 움직인다.

**Tech Stack:** Next.js 16(App Router), React 19, CSS Modules, vitest 5(jsdom), Playwright 1.63.

## Global Constraints

- **스펙**: `docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md`(운영자 승인 2026-10-15 "승인할게", 문서 검토 "진행해").
- **등급**: 일반(DEV-01). 서버, API, 권한, 저장 데이터, 패키지는 바꾸지 않는다. 새 의존성을 넣지 않는다.
- **운영자 결정**
  - D1: 토스를 첫 화면의 참고 사이트로 지정하고 구분 장치를 둔다("지정하고 구분 장치 두기 (추천)").
  - D2: 스크롤 장면 움직임은 소개용 웹사이트 페이지에서만 쓴다("웹사이트에서만 허용하고 어차피 앱 버전은 그 구조가 웹사이트랑 다를거야"). 앱과 웹 서비스 화면은 9절 그대로다.
- **구분 장치**: 토스의 이름·로고·글꼴·사진·문구, 사람 사진 첫 장면, 상자·지구본·점 물결, 왼쪽 진행 눈금, 어두운 마지막 장면을 쓰지 않는다. 이름은 '자취사무소', 글꼴은 Pretendard, 그림은 우리 앱 화면과 앱 문구만 쓴다.
- **문구**: 스펙 "문구(그대로 쓴다)" 절과 이 계획의 코드 블록을 글자 그대로 쓴다. 상태 이름은 `apps/web/src/components/status-names.ts`에서 가져온다(규칙 8.7). 해요체다.
- **값**: 디자인 규칙 토큰만 쓴다. 움직임 숫자는 규칙 9.1(Task 1)과 `scene-motion.ts`(Task 2)의 값이다.
  - 장면 칸: 위쪽 막대(56px = 3.5rem) 아래에 붙고 높이 `100vh − 3.5rem`.
  - 첫 장면 250vh, 단계 장면 `3 × 85vh + 100vh`, 기록 장면 230vh.
  - 휴대폰 그림 17.5rem × 35rem(움직일 때), 관리자 창 37.5rem × 25rem(움직일 때). 그림자는 쓰지 않는다(6.3).
- **움직이지 않는 경우**(규칙 9.1): `prefers-reduced-motion: reduce`, 화면 높이 600px 미만, 구역 내용이 장면 칸보다 큼(첫 장면 제외), 자바스크립트 없음. 서버는 늘 움직이지 않는 모양으로 그린다.
- **입구**: 첫 장면 설명 아래에는 모드별 버튼(actions)만, 마지막 입구에는 제목·설명·버튼·안내 전체가 놓인다. 위쪽 막대 버튼은 보조 버튼이다. 채운 파란 버튼은 한 화면에 하나만 보인다.
- **접근성**
  - 모든 글은 처음부터 문서에 있다.
  - 좁은 화면에서 지나간 단계는 화면에서만 숨기고 `display: none`을 쓰지 않는다.
  - 첫 장면 설명은 `p < 0.3`이면 보이지 않고 마우스로 누를 수 없다. 키보드 포커스가 들어오면 바로 보인다.
  - 그림은 `figure`에 이름 하나, 안은 `aria-hidden="true"`다.
- **문서와 커밋에 적지 않는 것**: 데모 주소, IP, 이메일 주소. 커밋 끝줄은 작업 환경이 정한 공동 작성자 줄이다(`Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>`). 이 문서와 저장소 파일에는 주소를 적지 않는다.
- **파일 고치기**
  - 저장소 파일(`apps/**`, `scripts/**`, `design/**`, `docs/**`, `STATUS.md`, `ops/**`)은 Edit/Write 도구로만 고친다.
  - 바꾼 경로만 이름으로 스테이징한다. `git add -A`나 `git add .`을 쓰지 않는다.
  - amend, force push, 이력 고쳐 쓰기를 하지 않는다.
- **시험 실행**
  - vitest와 브라우저 시험을 동시에 돌리지 않는다.
  - 브라우저 시험과 디자인 점검은 고정 Node를 PATH 맨 앞에 둔다: `C:\Users\admin\AppData\Local\build-manager-b5-runtime\node-24.21.0\node-v24.21.0-win-x64`.
  - 웹 브라우저 시험(`npm --workspace @build-manager/web run test:e2e`)은 DEMO 모드로 빌드한 뒤 돈다. 업체 시험(`npm run test:e2e:vendor`)은 B1 체험 모드다.

## 작업 위치와 기준

- worktree `worktree/build-manager-mobile-design`, 브랜치 `feat/landing-scroll-scenes`(main `1d88457`에서 시작). 스펙 커밋 `b7f67af`.

## 파일 구조

| 파일 | 할 일 |
| --- | --- |
| `design/DESIGN_RULES.md` | [DECISION] 한 줄, 1절 토스 지정 한 문단, 5절 그림 크기, 9.1 스크롤 장면 |
| `design/DESIGN_STATUS.md` | 첫 화면 변경과 남은 일 한 줄 |
| `docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md` | 입구 배치와 첫 장면 설명 숨김 방식 두 곳을 이 계획에 맞춰 바로잡음 |
| `apps/web/src/app/landing/scene-motion.ts` | 진행값·지금 단계·첫 장면 단계·기록 줄·움직임 허용·내용 맞음 계산(순수 함수) |
| `apps/web/src/app/landing/scene-motion.test.ts` | 위 계산 시험 |
| `apps/web/src/app/landing/scroll-scenes.tsx` | `<main>`을 그리고, 붙은 뒤 장면을 켜고 스크롤을 따라가는 클라이언트 부품 |
| `apps/web/src/app/landing/scroll-scenes.test.tsx` | 켜기·끄기·스크롤·해제 시험(jsdom) |
| `apps/web/src/app/landing/drawings.tsx` | 장면 그림 다섯 개(서버 부품) |
| `apps/web/src/app/landing/scenes.tsx` | 첫 장면·단계 장면·기록 장면 마크업(서버 부품) |
| `apps/web/src/app/page.tsx` | 모드별 입구와 장면 조립 |
| `apps/web/src/app/home.module.css` | 첫 화면 모양 전체(기존 내용을 바꿈) |
| `apps/web/src/app/page.test.tsx` | 첫 화면 렌더 시험(바꿈) |
| `apps/web/tests/e2e/landing-scenes.spec.ts` | 장면 브라우저 시험(새로) |
| `apps/web/tests/e2e/web-milestone.spec.ts` | 데모 시작 링크를 마지막 입구(`#entry`) 안에서 찾게 함 |
| `scripts/design-audit.mjs` | 첫 화면을 움직임 줄이기 상태로도 잼 |
| `STATUS.md`, `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md` | 기록(Task 7) |

---

### Task 0: 준비

- [ ] **Step 1: 상태 확인**

```bash
git status --short
git log --oneline -2
```

Expected: 바뀐 파일 없음, 맨 위 커밋은 이 계획 커밋, 그 아래는 `b7f67af`.

- [ ] **Step 2: 규칙 읽기**

`AGENTS.md`, `development/DEVELOPMENT_RULES.md`, `design/DESIGN_RULES.md`, `references/REFERENCE_RULES.md`를 처음부터 끝까지 읽는다. 읽기 전에는 프로젝트 게이트가 편집을 막는다.

---

### Task 1: 디자인 규칙과 현황, 스펙 바로잡기

**Files:**
- Modify: `design/DESIGN_RULES.md`(맨 위 DECISION 목록 끝, 1절 48행 문단 뒤, 5절 "소개 페이지 그림" 줄, 9절 끝)
- Modify: `design/DESIGN_STATUS.md`
- Modify: `docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md`

**Interfaces:**
- Produces: 규칙 9.1(뒤 Task들이 값의 근거로 인용한다).

- [ ] **Step 1: DECISION 한 줄**

맨 위 `[DECISION]` 목록의 마지막 줄(2026-10-13 파일 크기 한도 결정) 바로 아래에 더한다.

```markdown
- [DECISION] 2026-10-15 운영자 결정: 첫 화면 `/`의 참고 사이트를 토스(toss.im)로 바꾸고 구분 장치를 둡니다(1절). 스크롤에 따라 장면이 바뀌는 움직임은 소개용 웹사이트 페이지에서만 씁니다(9.1). 근거는 [설계 문서](../docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md)에 있습니다.
```

- [ ] **Step 2: 1절 한 문단**

1절의 "브랜드 파랑이 토스와 비슷하다는 점은 알고 정한 것입니다. …" 문단 바로 아래에 빈 줄 하나를 두고 더한다.

```markdown
2026-10-15 운영자는 이 위험을 알고 `/`의 참고 사이트로 토스를 골랐습니다. 이름·글꼴·사진·문구는 우리 것만 쓰고, 토스의 대표 장면(사람 사진 첫 장면, 상자, 지구본, 점 물결, 왼쪽 진행 눈금)은 가져오지 않습니다.
```

- [ ] **Step 3: 5절 그림 크기**

5절 표의 이 줄을

```markdown
| 소개 페이지 그림 | 휴대폰 폭 17.5rem, 작은 상자 폭 20rem, 카드 그림 높이 18.75rem | 해당 없음 |
```

이렇게 바꾼다.

```markdown
| 소개 페이지 그림 | 휴대폰 폭 17.5rem(스크롤 장면에서는 높이 35rem), 작은 상자 폭 20rem, 카드 그림 높이 18.75rem, 스크롤 장면 관리자 창 37.5rem×25rem | 해당 없음 |
```

- [ ] **Step 4: 9.1 스크롤 장면**

9절 마지막 줄("`prefers-reduced-motion: reduce`이면 움직임을 끕니다(누름 크기 변화 포함).") 바로 아래, `## 10. 문구` 위에 더한다.

```markdown

### 9.1 소개용 웹사이트의 스크롤 장면
- 소개용 웹사이트 페이지(지금은 `/`)만 스크롤에 따라 장면을 바꿉니다. 앱과 웹 서비스 화면은 위 규칙 그대로입니다.
- 장면 칸은 위쪽 막대 아래에 붙고(화면 높이 − 56px), 진행값 p(0–1)는 구역을 지나간 비율입니다. 스크롤을 멈추면 멈추고, 처음 열 때는 움직이지 않습니다. `transform`·`opacity`만 바꾸고, 그림에 그림자를 쓰지 않습니다.
- 첫 장면(화면 높이의 250%): a = p/0.45, b = (p − 0.28)/0.25(0–1로 자름). 768px 이상: 판 `scale(1 − 0.42a)`·`translateX(2a vw)`, 그림 `scale(1 + 0.1a)`, 제목 투명도 1 − 4p, 설명 투명도 b·`translateY((1 − b)×20px)`. 768px 미만: 판 `scale(1 − 0.2a)`, 휴대폰 그림 `scale(0.82)`(화면 높이 760px 이하 0.7). p < 0.3이면 설명을 숨기되, 키보드로 닿으면 바로 보여 줍니다.
- 단계 장면(단계 수×85% + 100%): 지금 단계 = floor(p×단계 수). 그림 화면과 목록 설명은 `motion-base`로 바뀌고 그림은 10px 아래에서 올라옵니다.
- 쌓이는 장면(230%): k번째 줄은 s = (p − 0.14k)/0.12로 투명도 s, `translateY((1 − s)×20px)`.
- 움직이지 않는 경우: `prefers-reduced-motion: reduce`, 화면 높이 600px 미만, 구역 내용이 장면 칸보다 큼, 자바스크립트 없음. 이때는 보통 구역으로 모든 단계와 그림 화면을 차례로 보여 줍니다.
```

- [ ] **Step 5: 현황 문서**

`design/DESIGN_STATUS.md`에서 첫 화면 `/`를 말하는 줄(10행 "… 첫 화면 `/`, `/core`, `/vendor/job`은 2026-10-10에 규칙으로 옮겼습니다. …")이 들어 있는 목록의 끝에 더한다. 그 목록의 들여쓰기와 말투를 따른다.

```markdown
- 첫 화면 `/`은 2026-10-15 운영자 결정으로 토스 배치와 스크롤 장면(규칙 9.1)으로 바뀝니다. 남은 일: 실제 현장 사진이 생기면 첫 장면 그림 판을 사진으로 바꿀지 정합니다(8.12).
```

- [ ] **Step 6: 스펙 바로잡기 두 곳**

스펙 "모드별 입구" 절의 둘째 줄

```markdown
- 입구는 첫 장면 설명 아래와 마지막 입구 두 곳에 같은 내용으로 놓인다. 두 곳의 제목 id는 서로 다르다.
```

을 이렇게 바꾼다(시안 2판과 같은 배치이고, 같은 안내 글이 두 번 읽히지 않게 한다).

```markdown
- 첫 장면 설명 아래에는 모드별 버튼(actions)만 놓고, 마지막 입구에는 제목·설명·버튼·안내 전체를 놓는다(시안 2판과 같다). 마지막 입구의 묶음 id는 지금처럼 `entry`다.
```

"움직임" 절의 첫 장면 마지막 줄

```markdown
  - 설명은 `p < 0.3`이면 `visibility: hidden`이라 키보드로 닿지 않는다.
```

을 이렇게 바꾼다(숨긴 채로 포커스가 닿는 일을 막되, 화면 읽기와 키보드 사용자가 설명과 버튼을 잃지 않게 한다).

```markdown
  - 설명은 `p < 0.3`이면 보이지 않고 마우스로 누를 수 없다. 키보드 포커스가 들어오면 바로 보인다.
```

"접근성" 절의 "첫 장면 설명은 보이기 전에는 키보드로 닿지 않는다." 문장을 "첫 장면 설명은 보이기 전에도 키보드가 닿으면 바로 보인다."로 바꾼다.

- [ ] **Step 7: 규칙 파일 크기 시험**

```bash
npx vitest run tests/architecture/rules-gate.test.ts
```

Expected: 통과. `design/DESIGN_RULES.md`는 48,000바이트 이하(지금 44,611 + 약 2,300).

- [ ] **Step 8: 커밋**

```bash
git add design/DESIGN_RULES.md design/DESIGN_STATUS.md docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md
git commit -m "docs(design): allow scroll scenes on the landing page and pick Toss as its reference (operator 2026-10-15)

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 2: 움직임 계산

**Files:**
- Create: `apps/web/src/app/landing/scene-motion.ts`
- Test: `apps/web/src/app/landing/scene-motion.test.ts`

**Interfaces:**
- Produces:
  - `clamp01(value: number): number`
  - `sceneProgress(top: number, height: number, viewport: number): number`
  - `activeStep(progress: number, steps: number): number`
  - `type HeroPhase = { shrink: number; side: number; sideShown: boolean }`
  - `heroPhase(progress: number): HeroPhase`
  - `recordRow(progress: number, index: number): number`
  - `motionAllowed(reducedMotion: boolean, viewportHeight: number): boolean`
  - `sceneFits(contentHeight: number, stageHeight: number): boolean`

- [ ] **Step 1: 실패하는 시험**

`apps/web/src/app/landing/scene-motion.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { activeStep, clamp01, heroPhase, motionAllowed, recordRow, sceneFits, sceneProgress } from "./scene-motion";

describe("landing scroll scenes (design rules 9.1)", () => {
  it("measures progress from the scene top meeting the screen top to its end meeting the screen bottom", () => {
    expect(sceneProgress(0, 2000, 900)).toBe(0);
    expect(sceneProgress(-550, 2000, 900)).toBeCloseTo(0.5);
    expect(sceneProgress(-1100, 2000, 900)).toBe(1);
    expect(sceneProgress(300, 2000, 900)).toBe(0);
    expect(sceneProgress(-5000, 2000, 900)).toBe(1);
    // A scene no taller than the screen never moves.
    expect(sceneProgress(-10, 900, 900)).toBe(0);
  });

  it("shows one step per equal share of the scene and ends on the last", () => {
    expect([0, 0.32, 0.34, 0.66, 0.67, 0.99, 1].map(p => activeStep(p, 3))).toEqual([0, 0, 1, 1, 2, 2, 2]);
  });

  it("shrinks the first scene's board by 0.45 and fades the explanation in from 0.28 over 0.25", () => {
    expect(heroPhase(0)).toEqual({ shrink: 0, side: 0, sideShown: false });
    expect(heroPhase(0.225).shrink).toBeCloseTo(0.5);
    expect(heroPhase(0.45).shrink).toBe(1);
    expect(heroPhase(0.28).side).toBe(0);
    expect(heroPhase(0.405).side).toBeCloseTo(0.5);
    expect(heroPhase(0.53).side).toBeCloseTo(1);
    expect(heroPhase(0.29).sideShown).toBe(false);
    expect(heroPhase(0.3).sideShown).toBe(true);
  });

  it("brings the record rows in one after another", () => {
    expect(recordRow(0, 0)).toBe(0);
    expect(recordRow(0.06, 0)).toBeCloseTo(0.5);
    expect(recordRow(0.12, 0)).toBe(1);
    expect(recordRow(0.14, 1)).toBe(0);
    expect(recordRow(0.26, 1)).toBeCloseTo(1);
    expect(recordRow(0.5, 3)).toBeCloseTo(0.6667, 3);
  });

  it("moves only when the reader allows motion and the screen is at least 600px tall", () => {
    expect(motionAllowed(false, 600)).toBe(true);
    expect(motionAllowed(false, 599)).toBe(false);
    expect(motionAllowed(true, 900)).toBe(false);
  });

  it("keeps a scene still when its content is taller than its stage", () => {
    expect(sceneFits(600, 600)).toBe(true);
    expect(sceneFits(601, 600)).toBe(false);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm --workspace @build-manager/web run test -- src/app/landing/scene-motion.test.ts
```

Expected: FAIL, `./scene-motion`을 찾지 못함.

- [ ] **Step 3: 구현**

`apps/web/src/app/landing/scene-motion.ts`

```ts
// Scroll-linked scenes on the landing page (design rules 9.1; spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md).
// Numbers only: ScrollScenes applies them to the page, and home.module.css turns them into movement.

/** The first scene's board finishes shrinking at this progress. */
export const HERO_SHRINK_END = 0.45;
/** The first scene's explanation starts to appear here and takes this much progress to appear fully. */
export const HERO_SIDE_START = 0.28;
export const HERO_SIDE_SPAN = 0.25;
/** Below this progress the explanation is not shown (keyboard focus still shows it at once). */
export const HERO_SIDE_SHOWN_FROM = 0.3;
/** Each record row starts this much progress after the one before it and takes this much to arrive. */
export const RECORD_ROW_DELAY = 0.14;
export const RECORD_ROW_SPAN = 0.12;
/** Screens shorter than this never move. */
export const MIN_MOTION_HEIGHT = 600;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 when the scene's top meets the screen's top, 1 when the scene's end meets the screen's bottom. */
export function sceneProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  return travel > 0 ? clamp01(-top / travel) : 0;
}

/** The step a step scene shows: one equal share of the progress each, ending on the last step. */
export function activeStep(progress: number, steps: number): number {
  return Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
}

export type HeroPhase = { shrink: number; side: number; sideShown: boolean };

export function heroPhase(progress: number): HeroPhase {
  return {
    shrink: clamp01(progress / HERO_SHRINK_END),
    side: clamp01((progress - HERO_SIDE_START) / HERO_SIDE_SPAN),
    sideShown: progress >= HERO_SIDE_SHOWN_FROM,
  };
}

/** How far the record row at `index` (from 0) has arrived. */
export function recordRow(progress: number, index: number): number {
  return clamp01((progress - RECORD_ROW_DELAY * index) / RECORD_ROW_SPAN);
}

export function motionAllowed(reducedMotion: boolean, viewportHeight: number): boolean {
  return !reducedMotion && viewportHeight >= MIN_MOTION_HEIGHT;
}

export function sceneFits(contentHeight: number, stageHeight: number): boolean {
  return contentHeight <= stageHeight;
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm --workspace @build-manager/web run test -- src/app/landing/scene-motion.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/landing/scene-motion.ts apps/web/src/app/landing/scene-motion.test.ts
git commit -m "feat(web): scroll scene numbers for the landing page (rules 9.1)

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 3: 스크롤을 따라가는 부품

**Files:**
- Create: `apps/web/src/app/landing/scroll-scenes.tsx`
- Test: `apps/web/src/app/landing/scroll-scenes.test.tsx`

**Interfaces:**
- Consumes (Task 2): `activeStep`, `heroPhase`, `motionAllowed`, `recordRow`, `sceneFits`, `sceneProgress`.
- Produces: `ScrollScenes({ className?: string; children: ReactNode })`. `<main>`을 그린다. 그 안의 마크업 약속은 다음과 같다(Task 5가 지킨다).
  - `[data-scene="<이름>"]`: 장면. 첫 장면은 `data-scene="hero"`다.
  - `data-steps="<수>"`: 단계 장면에만 붙인다.
  - `[data-stage]`: 장면 칸. 그 첫 자식이 내용 묶음이다.
  - `[data-row="<k>"]`: 쌓이는 줄.
  - 부품이 붙이는 것: 장면의 `data-motion="on|off"`, `data-step`, 첫 장면의 `data-side="shown|hidden"`, CSS 변수 `--p`, `--a`, `--b`, 줄의 `--s`.

- [ ] **Step 1: 실패하는 시험**

`apps/web/src/app/landing/scroll-scenes.test.tsx`

```tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollScenes } from "./scroll-scenes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let reduced = false;
const changes = new Set<() => void>();

beforeEach(() => {
  reduced = false;
  changes.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") ? reduced : false, media: query,
    addEventListener: (_: string, listener: () => void) => changes.add(listener),
    removeEventListener: (_: string, listener: () => void) => changes.delete(listener),
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function Page() {
  return (
    <ScrollScenes>
      <section data-scene="hero"><div data-stage><div>hero</div></div></section>
      <section data-scene="tenant" data-steps="3"><div data-stage><div>steps</div></div></section>
      <section data-scene="record"><div data-stage><div><p data-row="0">a</p><p data-row="1">b</p></div></div></section>
    </ScrollScenes>
  );
}
const scene = (name: string) => host.querySelector<HTMLElement>(`[data-scene="${name}"]`)!;
const box = (top: number, height: number) => () => ({ top, height }) as DOMRect;
async function mount() { await act(async () => root.render(<Page />)); }

describe("ScrollScenes (design rules 9.1)", () => {
  it("sends every scene still from the server", () => {
    expect(renderToStaticMarkup(<Page />)).not.toContain("data-motion");
  });

  it("turns the scenes on after mount and starts each at its beginning", async () => {
    await mount();
    expect(scene("hero").dataset.motion).toBe("on");
    expect(scene("tenant").dataset.step).toBe("0");
    expect(scene("hero").style.getPropertyValue("--a")).toBe("0.0000");
    expect(scene("hero").dataset.side).toBe("hidden");
  });

  it("follows the scroll", async () => {
    await mount();
    scene("hero").getBoundingClientRect = box(-900, 2000);
    scene("tenant").getBoundingClientRect = box(-550, 2000);
    scene("record").getBoundingClientRect = box(-550, 2000);
    await act(async () => { window.dispatchEvent(new Event("scroll")); });
    expect(scene("tenant").dataset.step).toBe("1");
    expect(scene("hero").style.getPropertyValue("--a")).toBe("1.0000");
    expect(scene("hero").dataset.side).toBe("shown");
    expect(host.querySelector<HTMLElement>('[data-row="1"]')!.style.getPropertyValue("--s")).toBe("1.0000");
  });

  it("keeps every scene still for reduced motion and re-decides when that setting changes", async () => {
    reduced = true;
    await mount();
    expect(scene("tenant").dataset.motion).toBe("off");
    expect(scene("tenant").dataset.step).toBeUndefined();
    reduced = false;
    await act(async () => { changes.forEach(listener => listener()); });
    expect(scene("tenant").dataset.motion).toBe("on");
  });

  it("keeps every scene still on a screen under 600px tall", async () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 599 });
    await mount();
    expect(scene("hero").dataset.motion).toBe("off");
  });

  it("keeps a scene still when its content is taller than its stage, but never the first scene", async () => {
    await mount();
    for (const name of ["hero", "tenant"]) {
      const stage = scene(name).querySelector<HTMLElement>("[data-stage]")!;
      Object.defineProperty(stage, "clientHeight", { configurable: true, value: 600 });
      Object.defineProperty(stage.firstElementChild!, "offsetHeight", { configurable: true, value: 601 });
    }
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(scene("tenant").dataset.motion).toBe("off");
    expect(scene("hero").dataset.motion).toBe("on");
  });

  it("stops following the scroll once it is gone", async () => {
    await mount();
    const tenant = scene("tenant");
    act(() => root.unmount());
    tenant.getBoundingClientRect = box(-1100, 2000);
    window.dispatchEvent(new Event("scroll"));
    expect(tenant.dataset.step).toBe("0");
    root = createRoot(host);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm --workspace @build-manager/web run test -- src/app/landing/scroll-scenes.test.tsx
```

Expected: FAIL, `./scroll-scenes`를 찾지 못함.

- [ ] **Step 3: 구현**

`apps/web/src/app/landing/scroll-scenes.tsx`

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { activeStep, heroPhase, motionAllowed, recordRow, sceneFits, sceneProgress } from "./scene-motion";

/**
 * The landing page's scroll scenes (design rules 9.1). The server sends every [data-scene] still, so the page reads in
 * full without JavaScript. After mount a scene gets data-motion="on" when motion is allowed and its content fits its
 * [data-stage] (the first scene is never measured), else "off". While on, the scroll sets --p, the first scene's --a and
 * --b and data-side, each [data-row]'s --s, and a step scene's data-step. Reduced motion, a resize or a short screen
 * decides again.
 */
export function ScrollScenes({ className, children }: { className?: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scenes = Array.from(host.querySelectorAll<HTMLElement>("[data-scene]"));
    let frame = 0;
    const paint = () => {
      frame = 0;
      const viewport = window.innerHeight;
      for (const scene of scenes) {
        if (scene.dataset.motion !== "on") continue;
        const area = scene.getBoundingClientRect();
        const progress = sceneProgress(area.top, area.height, viewport);
        scene.style.setProperty("--p", progress.toFixed(4));
        const steps = Number(scene.dataset.steps ?? 0);
        if (steps > 0) scene.dataset.step = String(activeStep(progress, steps));
        if (scene.dataset.scene === "hero") {
          const phase = heroPhase(progress);
          scene.style.setProperty("--a", phase.shrink.toFixed(4));
          scene.style.setProperty("--b", phase.side.toFixed(4));
          scene.dataset.side = phase.sideShown ? "shown" : "hidden";
        }
        for (const row of scene.querySelectorAll<HTMLElement>("[data-row]")) {
          row.style.setProperty("--s", recordRow(progress, Number(row.dataset.row)).toFixed(4));
        }
      }
    };
    const request = () => { if (!frame) frame = window.requestAnimationFrame(paint); };
    const still = (scene: HTMLElement) => {
      scene.dataset.motion = "off";
      delete scene.dataset.step;
      delete scene.dataset.side;
      for (const name of ["--p", "--a", "--b"]) scene.style.removeProperty(name);
    };
    const layout = () => {
      const allowed = motionAllowed(reduced.matches, window.innerHeight);
      for (const scene of scenes) {
        if (!allowed) { still(scene); continue; }
        scene.dataset.motion = "on";
        if (scene.dataset.scene === "hero") continue;
        const stage = scene.querySelector<HTMLElement>("[data-stage]");
        const content = stage?.firstElementChild as HTMLElement | null | undefined;
        if (stage && content && !sceneFits(content.offsetHeight, stage.clientHeight)) still(scene);
      }
      paint();
    };
    layout();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", layout);
    reduced.addEventListener("change", layout);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", layout);
      reduced.removeEventListener("change", layout);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return <main ref={root} className={className}>{children}</main>;
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm --workspace @build-manager/web run test -- src/app/landing/scroll-scenes.test.tsx
npm --workspace @build-manager/web run typecheck
```

Expected: 7 passed, 타입 검사 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/landing/scroll-scenes.tsx apps/web/src/app/landing/scroll-scenes.test.tsx
git commit -m "feat(web): follow the scroll on the landing scenes, still by default (rules 9.1)

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 4: 브라우저 시험 먼저

**Files:**
- Create: `apps/web/tests/e2e/landing-scenes.spec.ts`
- Modify: `apps/web/tests/e2e/web-milestone.spec.ts`(데모 시작 링크 네 곳)

**Interfaces:**
- Consumes (Task 5가 만든다): `[data-scene="hero|tenant|manager|vendor|record"]`, `[data-hero-side]`, `[data-screen="<i>"]`, `[data-step-item="<i>"]`, `#entry`, 그림 이름 "세입자 접수 화면 세 단계 예시 · 체험용 데이터".
- 이 Task의 새 시험은 Task 5 전에는 실패해야 한다(RED). Task 5 뒤에 모두 통과한다.

- [ ] **Step 1: 장면 시험**

`apps/web/tests/e2e/landing-scenes.spec.ts`

```ts
import { test, expect, type Page } from "@playwright/test";

// Landing scroll scenes (spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md, design rules 9.1).
const scene = (page: Page, name: string) => page.locator(`[data-scene="${name}"]`);
const opacity = (page: Page, selector: string) => page.locator(selector).evaluate(el => getComputedStyle(el).opacity);

/** Scrolls so that the scene's progress is `p`: 0 at its top, 1 at its end. */
async function scrollScene(page: Page, name: string, p: number) {
  await page.evaluate(([n, q]) => {
    const el = document.querySelector<HTMLElement>(`[data-scene="${n}"]`)!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (el.offsetHeight - window.innerHeight) * Number(q));
  }, [name, String(p)] as const);
}

test("a step scene shows one step at a time and follows the scroll both ways", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const tenant = scene(page, "tenant");
  await expect(tenant).toHaveAttribute("data-motion", "on");
  for (const [p, step] of [[0.1, "0"], [0.5, "1"], [0.9, "2"], [0.1, "0"]] as const) {
    await scrollScene(page, "tenant", p);
    await expect(tenant).toHaveAttribute("data-step", step);
    await expect.poll(() => opacity(page, `[data-scene="tenant"] [data-screen="${step}"]`)).toBe("1");
  }
  await expect.poll(() => opacity(page, '[data-scene="tenant"] [data-screen="2"]')).toBe("0");
});

test("the first scene keeps its explanation out of sight until it shrinks, and shows it at once to the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hero = scene(page, "hero");
  await expect(hero).toHaveAttribute("data-motion", "on");
  await expect(hero).toHaveAttribute("data-side", "hidden");
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("0");
  await page.locator("[data-hero-side] a").first().focus();
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("1");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await scrollScene(page, "hero", 0.8);
  await expect(hero).toHaveAttribute("data-side", "shown");
  await expect.poll(() => opacity(page, "[data-hero-side]")).toBe("1");
});

test("reduced motion shows every scene still, with every step and every screen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  for (const name of ["hero", "tenant", "manager", "vendor", "record"]) await expect(scene(page, name)).toHaveAttribute("data-motion", "off");
  for (const step of ["문제를 고르고 사진과 함께 접수해요", "위험한 신호부터 확인해요", "건물에 맞춘 질문에 답하고 보내요"]) {
    await expect(page.getByText(step, { exact: true })).toBeVisible();
  }
  for (const index of ["0", "1", "2"]) expect(await opacity(page, `[data-scene="vendor"] [data-screen="${index}"]`)).toBe("1");
});

test("a screen too short for the phone scenes keeps them still, and under 600px nothing moves", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(scene(page, "hero")).toHaveAttribute("data-motion", "on");
  await expect(scene(page, "tenant")).toHaveAttribute("data-motion", "off");
  await page.setViewportSize({ width: 390, height: 560 });
  await expect(scene(page, "hero")).toHaveAttribute("data-motion", "off");
});

test("no width scrolls sideways, at the top or in the middle of the scenes", async ({ page }) => {
  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/");
    for (const p of [0, 0.5]) {
      await scrollScene(page, "manager", p);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${width}px at ${p}`).toBe(0);
    }
  }
});

test("each drawing has one name, and a narrow screen hides past steps from the eye only", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("figure", { name: "세입자 접수 화면 세 단계 예시 · 체험용 데이터" })).toBeVisible();
  await expect(scene(page, "tenant")).toHaveAttribute("data-step", "0");
  expect(await page.locator('[data-scene="tenant"] [data-step-item="2"]').evaluate(el => getComputedStyle(el).display)).not.toBe("none");
  await expect(page.getByRole("listitem").filter({ hasText: "건물에 맞춘 질문에 답하고 보내요" })).toHaveCount(1);
});
```

- [ ] **Step 2: 데모 시작 링크를 마지막 입구에서 찾기**

새 첫 화면은 첫 장면 설명 아래에도 같은 버튼을 둔다. 그래서 `apps/web/tests/e2e/web-milestone.spec.ts`의 아래 네 곳을 마지막 입구(`#entry`) 안에서 찾게 바꾼다. 지금 첫 화면에도 `id="entry"`가 있어서, 이 시험은 바꾼 뒤에도 지금처럼 통과한다.

- `page.getByRole("link", { name: "세입자 데모 시작" })` → `page.locator("#entry").getByRole("link", { name: "세입자 데모 시작" })` (두 곳)
- `page.getByRole("link", { name: "임대인 데모 시작" })` → `page.locator("#entry").getByRole("link", { name: "임대인 데모 시작" })` (두 곳)

`apps/web/tests/vendor-e2e/demo-entry.spec.ts`는 바꾸지 않는다. 그 시험은 `/`에서 안내 글 하나(한 번만 나옴)만 확인하고, 버튼은 `/core`에서 누른다.

- [ ] **Step 3: 실패 확인(RED)**

```bash
npm --workspace @build-manager/web run test:e2e -- landing-scenes.spec.ts web-milestone.spec.ts
```

Expected
- `landing-scenes.spec.ts` 6개가 모두 실패한다. 이유는 `[data-scene]`이나 그림 이름이 없어서다(시간 초과 메시지에 그 선택자가 나온다).
- `web-milestone.spec.ts`는 통과한다.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/tests/e2e/landing-scenes.spec.ts apps/web/tests/e2e/web-milestone.spec.ts
git commit -m "test(web): browser tests for the landing scroll scenes (red until the page lands)

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 5: 첫 화면

**Files:**
- Create: `apps/web/src/app/landing/drawings.tsx`, `apps/web/src/app/landing/scenes.tsx`
- Modify(전체 교체): `apps/web/src/app/page.tsx`, `apps/web/src/app/home.module.css`, `apps/web/src/app/page.test.tsx`

**Interfaces:**
- Consumes (Task 3): `ScrollScenes`. Consumes: `ACCESS_POLICY_NAMES`, `TODO_REASON_NAMES`, `WORK_STATUS_NAMES`(`apps/web/src/components/status-names.ts`).
- Produces: Task 3 마크업 약속과 Task 4 선택자.

- [ ] **Step 1: 렌더 시험을 먼저 바꾼다**

`apps/web/src/app/page.test.tsx`를 통째로 바꾼다.

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

function markup(): string {
  return renderToStaticMarkup(<Home />);
}

const STEPS = [
  "문제를 고르고 사진과 함께 접수해요", "위험한 신호부터 확인해요", "건물에 맞춘 질문에 답하고 보내요",
  "할 일은 알림에 모여요", "부족하면 다시 묻고, 처리 방법을 정해요", "업체에 보안 링크를 보내요",
  "링크로 작업을 열고 수락해요", "세입자가 보낸 시간 안에서 방문을 정해요", "방문하고 사진과 함께 보고해요",
];

describe("product root", () => {
  beforeEach(() => vi.stubEnv("BUILD_MANAGER_MODE", "DEMO"));
  afterEach(() => vi.unstubAllEnvs());

  it("leads with what the service does and tells it in the order the app handles a request", () => {
    const html = markup().replaceAll("<br/>", "");
    const order = [
      "세입자 수리 요청, 문자 대신 여기서 받아요", "세입자와 관리자가 같은 요청을 함께 봐요", "사진과 몇 가지 답이면 접수가 끝나요",
      "확인부터 업체 연결까지 이어서 처리해요", "업체는 로그인 없이 링크 하나로 일해요", "결과를 확인하면 세대마다 이력이 남아요",
      "오늘 들어온 수리 요청부터 여기서 받아 보세요",
    ];
    const at = order.map(text => html.indexOf(text));
    expect(at.every(index => index >= 0), at.join(",")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("sends every step and every drawn screen still, without motion", () => {
    const html = markup();
    expect(html).not.toContain("data-motion=");
    for (const step of STEPS) expect(html).toContain(step);
    expect(html.match(/data-step-item="/g)).toHaveLength(9);
    expect(html.match(/data-screen="/g)).toHaveLength(9);
  });

  it("uses the app's own names and words on the drawn screens", () => {
    const html = markup();
    expect(html).toContain('data-state="progress">처리 중</span>');
    for (const words of [
      "난방 · 101동 1203호", "관리자가 처리하고 있어요.", "가스 냄새가 나나요?", "수리 요청 제출", "추가 정보 요청",
      "보안 링크를 발급했어요. 업체에 직접 전달하세요.", "작업 수락", "확정된 방문 일정", "세입자가 있을 때만 방문",
      "작업 보고를 제출했어요.", "해결됐어요",
    ]) expect(html).toContain(words);
  });

  it("names each drawing once and hides its parts from screen readers", () => {
    const html = markup();
    expect(html.match(/<figure[^>]*aria-label="[^"]+"/g)).toHaveLength(5);
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(7);
  });

  it("gives every element its own id", () => {
    const ids = [...markup().matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("speaks in 해요체 (rules §10)", () => {
    expect(markup()).not.toMatch(/습니다|십시오/);
  });

  it("offers a visible way into the tenant demo", () => {
    const html = markup();
    expect(html).toContain('href="/demo/tenant"');
    expect(html).toContain("세입자 데모 시작");
  });

  it("offers a visible way into the landlord demo", () => {
    const html = markup();
    expect(html).toContain('href="/demo/landlord"');
    expect(html).toContain("임대인 데모 시작");
  });

  it("says the data is synthetic and what the demo does not do", () => {
    const html = markup();
    expect(html).toContain("합성 데이터");
    expect(html).toContain("업체 배정");
  });

  it("does not claim the product skips hazard gating", () => {
    const html = markup();
    // It does gate on hazard signals, so the looser disclaimer would be untrue.
    expect(html).not.toContain("안전 판정 기능 아님");
    expect(html).toContain("중단");
  });
});
it('B1 root presents authentication/workspace without demo data',()=>{vi.stubEnv('BUILD_MANAGER_MODE','B1');try{const html=markup();expect(html).toContain('href="/auth/login"');expect(html).toContain('href="/workspace"');expect(html).not.toContain('/demo/');}finally{vi.unstubAllEnvs();}});
it("B1 demo root offers both login-free roles as same-origin forms and says which issues exist",()=>{
  vi.stubEnv("BUILD_MANAGER_MODE","B1");vi.stubEnv("BUILD_MANAGER_DEMO_ENTRY","1");vi.stubEnv("B1_AUTH0_DOMAIN","b1.synthetic.invalid");
  vi.stubEnv("BUILD_MANAGER_DEMO_SUBJECTS",JSON.stringify({manager:"auth0|synthetic-demo-manager",tenant:"auth0|synthetic-demo-tenant"}));
  try{const html=markup();
    // Two forms under the first scene's explanation and two in the closing entry (spec: actions in both places).
    expect(html.split('action="/api/v2/session/demo"').length-1).toBe(4);
    expect(html).toContain('value="manager"');expect(html).toContain('value="tenant"');
    expect(html).toContain("관리자로 체험하기");expect(html).toContain("세입자로 체험하기");
    expect(html).toContain("난방과 누수 두 가지");expect(html).not.toContain('href="/auth/login"');
  }finally{vi.unstubAllEnvs();}
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm --workspace @build-manager/web run test -- src/app/page.test.tsx
```

Expected: 새 시험(순서, 단계 9개, 앱 문구, 그림 이름, B1 체험 양식 4개)이 실패한다. 모드·데모 링크·합성 데이터·중단 시험은 통과한다.

- [ ] **Step 3: 그림**

`apps/web/src/app/landing/drawings.tsx`

```tsx
import type { ReactNode } from "react";
import { ACCESS_POLICY_NAMES, TODO_REASON_NAMES, WORK_STATUS_NAMES } from "../../components/status-names";
import styles from "../home.module.css";

// Drawn screens for the landing scenes. They are pictures: each figure carries one name and its parts are hidden from
// screen readers. Every word on them is the app's own (checked against main 1d88457); the data is synthetic.

type State = "progress" | "done" | "wait" | "urgent" | "open";
const DONE = `✓ ${WORK_STATUS_NAMES.COMPLETED}`;

function Status({ state, children }: { state: State; children: ReactNode }) {
  return <span className={styles.status} data-state={state}>{children}</span>;
}

/** One screen of a step scene; the scene shows the screen whose index is its step. */
function Screen({ index, children }: { index: number; children: ReactNode }) {
  return <div className={styles.screen} data-screen={index}>{children}</div>;
}

function Phone({ top, children }: { top: string; children: ReactNode }) {
  return <div className={styles.phone} aria-hidden="true"><p className={styles.phoneTop}>{top}</p>{children}</div>;
}

function Window({ top, children }: { top: string; children: ReactNode }) {
  return <div className={styles.window} aria-hidden="true"><p className={styles.windowTop}>{top}</p>{children}</div>;
}

function Row({ title, meta, state, status, row }: { title: string; meta: string; state: State; status: string; row?: number }) {
  return <li data-row={row}><span className={styles.rowTitle}>{title}</span><span className={styles.rowMeta}>{meta}</span><Status state={state}>{status}</Status></li>;
}

/** First scene: one request as the tenant's 홈 and the manager's 업무함 show it. */
export function HomePair() {
  return (
    <figure className={styles.pair} aria-label="같은 요청을 보는 세입자 홈 화면과 관리자 업무함 예시 · 체험용 데이터">
      <Phone top="홈">
        <div className={styles.screen}>
          <p className={styles.screenTitle}>101동 1203호</p>
          <p className={styles.label}>진행 중인 요청 2건</p>
          <ul className={`${styles.rows} ${styles.homeRows}`}>
            <li><span className={styles.rowTitle}>난방 · 101동 1203호 <Status state="progress">{WORK_STATUS_NAMES.IN_PROGRESS}</Status></span><span className={styles.rowMeta}>관리자가 처리하고 있어요.</span></li>
            <li><span className={styles.rowTitle}>누수 · 101동 1203호 <Status state="open">{WORK_STATUS_NAMES.OPEN}</Status></span><span className={styles.rowMeta}>관리자 확인을 기다리고 있어요.</span></li>
          </ul>
        </div>
      </Phone>
      <Window top="업무함">
        <div className={styles.screen}>
          <ul className={styles.rows}>
            <Row title="난방 · 101동 1203호" meta="10월 8일 (목) 오전 9:12 접수" state="progress" status={WORK_STATUS_NAMES.IN_PROGRESS} />
            <Row title="누수 · 101동 1203호" meta="10월 8일 (목) 오전 10:20 접수" state="open" status={WORK_STATUS_NAMES.OPEN} />
            <Row title="누수 · 102동 803호" meta="10월 6일 (화) 오후 3:30 접수" state="done" status={DONE} />
          </ul>
        </div>
      </Window>
    </figure>
  );
}

export function TenantPhone() {
  return (
    <figure className={styles.device} aria-label="세입자 접수 화면 세 단계 예시 · 체험용 데이터">
      <Phone top="홈">
        <Screen index={0}>
          <p className={styles.screenTitle}>어떤 문제가 있나요?</p>
          <div className={styles.tiles}><span data-selected="">난방</span><span>누수</span></div>
          <p className={styles.label}>문제 설명</p>
          <p className={styles.field}>거실 보일러가 켜지지 않아요. 온수도 미지근해요.</p>
          <div className={styles.thumbs}><span>사진 1</span><span>사진 2</span><span>＋</span></div>
          <p className={styles.label}>사진 2장 선택됨</p>
          <span className={styles.fakeButton}>접수하기</span>
        </Screen>
        <Screen index={1}>
          <p className={styles.label}>지금 할 일</p>
          <p className={styles.screenTitle}>가스 냄새가 나나요?</p>
          <div className={styles.tiles}><span>예</span><span>아니오</span></div>
          <p className={styles.label}>연기나 불꽃이 보이나요?</p>
        </Screen>
        <Screen index={2}>
          <p className={styles.label}>지금 할 일</p>
          <p className={styles.screenTitle}>보일러 또는 조절기 전원이 켜져 있나요?</p>
          <div className={styles.tiles}><span>예</span><span>아니오</span></div>
          <p className={styles.label}>{"질문에 답하고 필요한 사진을 고르면 '수리 요청 제출' 버튼이 나와요."}</p>
          <span className={styles.fakeButton}>수리 요청 제출</span>
        </Screen>
      </Phone>
    </figure>
  );
}

export function ManagerWindow() {
  return (
    <figure className={styles.device} aria-label="관리자 화면 세 단계 예시 · 체험용 데이터">
      <Window top="관리자 · 체험용 데이터">
        <Screen index={0}>
          <p className={styles.screenTitle}>처리할 일</p>
          <ul className={styles.rows}>
            <Row title="누수 · 103동 201호" meta="방금 (오후 1:58)" state="urgent" status={TODO_REASON_NAMES.SAFETY} />
            <Row title="난방 · 101동 1203호" meta="25분 전 (오후 1:33)" state="wait" status={TODO_REASON_NAMES.DECIDE} />
            <Row title="누수 · 102동 803호" meta="10월 13일 (화) 오후 5:40" state="wait" status={TODO_REASON_NAMES.VENDOR} />
          </ul>
        </Screen>
        <Screen index={1}>
          <p className={styles.screenTitle}>난방 · 101동 1203호</p>
          <p className={styles.label}>추가 정보를 요청하는 이유</p>
          <p className={styles.field}>보일러 상태를 한 번 더 확인하고 싶어요.</p>
          <p className={styles.label}>다시 확인할 질문</p>
          <p className={styles.check}>온수도 나오지 않나요?</p>
          <span className={styles.fakeButton} data-kind="secondary">추가 정보 요청</span>
        </Screen>
        <Screen index={2}>
          <p className={styles.screenTitle}>업체 연결 및 작업 요청</p>
          <p className={styles.label}>공유할 원본 사진 선택</p>
          <p className={styles.check}>원본 사진 1</p>
          <p className={styles.label}>사진은 선택한 것만 업체에 공개돼요.</p>
          <p className={styles.note}>보안 링크를 발급했어요. 업체에 직접 전달하세요.</p>
        </Screen>
      </Window>
    </figure>
  );
}

export function VendorPhone() {
  return (
    <figure className={styles.device} aria-label="업체 작업 화면 세 단계 예시 · 체험용 데이터">
      <Phone top="작업 요청">
        <Screen index={0}>
          <p className={styles.screenTitle}>난방 · 101동 1203호</p>
          <p className={styles.label}>접수 요약</p>
          <p className={styles.note}>거실 보일러가 켜지지 않아요. 온수도 미지근해요.</p>
          <div className={styles.thumbs}><span>사진 1</span></div>
          <span className={styles.fakeButton}>작업 수락</span>
          <span className={styles.fakeButton} data-kind="secondary">작업 거절</span>
        </Screen>
        <Screen index={1}>
          <p className={styles.screenTitle}>확정된 방문 일정</p>
          <p className={styles.field}>10월 9일 (금) 오후 2:00–4:00</p>
          <p className={styles.label}>{ACCESS_POLICY_NAMES.TENANT_PRESENT_REQUIRED}</p>
          <span className={styles.fakeButton}>방문 시작</span>
        </Screen>
        <Screen index={2}>
          <p className={styles.screenTitle}>작업 보고</p>
          <p className={styles.label}>작업 내용</p>
          <p className={styles.field}>순환 펌프를 교체했어요.</p>
          <p className={styles.label}>사용한 부품·자재</p>
          <p className={styles.field}>순환 펌프 1개</p>
          <div className={styles.thumbs}><span>사진 1</span><span>사진 2</span></div>
          <p className={styles.note}>작업 보고를 제출했어요.</p>
        </Screen>
      </Phone>
    </figure>
  );
}

/** Result and record: the tenant's result question, then the unit's history rows, arriving one by one. */
export function RecordPanel() {
  return (
    <figure className={styles.record} aria-label="결과 확인과 101동 1203호 정비 이력 예시 · 체험용 데이터">
      <div className={styles.resultCard} data-row={0} aria-hidden="true">
        <Status state="done">{DONE}</Status>
        <p>관리자가 남긴 완료 기록을 확인하고 현재 상태를 알려주세요.</p>
        <div className={styles.tiles}><span>해결됐어요</span><span>아직 문제가 있어요</span></div>
      </div>
      <ul className={`${styles.rows} ${styles.history}`} aria-hidden="true">
        <Row row={1} title="난방 · 부품 교체" meta="10월 9일 (금)" state="done" status={DONE} />
        <Row row={2} title="누수 · 점검" meta="3월 4일 (수)" state="done" status={DONE} />
        <Row row={3} title="난방 · 수리" meta="2025년 12월 2일" state="done" status={DONE} />
      </ul>
    </figure>
  );
}
```

- [ ] **Step 4: 장면 마크업**

`apps/web/src/app/landing/scenes.tsx`

```tsx
import type { ReactNode } from "react";
import styles from "../home.module.css";

// Scene markup for the landing page (design rules 9.1). The server sends it still; ScrollScenes turns each scene on.

export type Step = { title: string; detail: string };
type Lines = [string, string];

function TwoLines({ lines }: { lines: Lines }) {
  return <>{lines[0]}<br />{" "}{lines[1]}</>;
}

/** First scene: the board with both sides of one request and the title, then the explanation and the way in. */
export function HeroScene({ title, lead, actions, drawing }: { title: Lines; lead: string; actions: ReactNode; drawing: ReactNode }) {
  return (
    <section className={`${styles.scene} ${styles.heroScene}`} data-scene="hero" aria-labelledby="home-title">
      <div className={styles.stage} data-stage>
        <div className={styles.container}>
          <div className={styles.board}>
            {drawing}
            <h1 id="home-title" className={styles.heroTitle}><TwoLines lines={title} /></h1>
          </div>
          <div className={styles.heroSide} data-hero-side>
            <p className={styles.sideTitle}><TwoLines lines={["세입자와 관리자가", "같은 요청을 함께 봐요"]} /></p>
            <p className={styles.lead}>{lead}</p>
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A step scene: the steps on one side, the drawing on the other; the step follows the scroll. */
export function StepScene({ id, eyebrow, title, steps, drawing, reverse = false }: {
  id: string; eyebrow: string; title: Lines; steps: readonly Step[]; drawing: ReactNode; reverse?: boolean;
}) {
  return (
    <section id={id} className={`${styles.scene} ${styles.stepScene}`} data-scene={id} data-steps={steps.length} aria-labelledby={`${id}-title`}>
      <div className={styles.stage} data-stage>
        <div className={`${styles.container} ${styles.split}`} data-reverse={reverse ? "" : undefined}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h2 id={`${id}-title`} className={styles.headline}><TwoLines lines={title} /></h2>
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li key={step.title} data-step-item={index}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepDetail}><span>{step.detail}</span></span>
                </li>
              ))}
            </ol>
          </div>
          {drawing}
        </div>
      </div>
    </section>
  );
}

/** Result and record: the rows of the drawing arrive one by one with the scroll. */
export function RecordScene({ drawing }: { drawing: ReactNode }) {
  return (
    <section id="record" className={`${styles.scene} ${styles.recordScene}`} data-scene="record" aria-labelledby="record-title">
      <div className={styles.stage} data-stage>
        <div className={`${styles.container} ${styles.split}`}>
          <div>
            <p className={styles.eyebrow}>결과와 기록</p>
            <h2 id="record-title" className={styles.headline}><TwoLines lines={["결과를 확인하면", "세대마다 이력이 남아요"]} /></h2>
            <p className={`${styles.lead} ${styles.sectionLead}`}>관리자가 완료로 기록하면 세입자에게 결과 확인이 와요. 같은 문제가 다시 생기면 지난 기록부터 볼 수 있어요.</p>
          </div>
          {drawing}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: 페이지 조립**

`apps/web/src/app/page.tsx`를 통째로 바꾼다.

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { parseApplicationMode } from "../runtime/application-mode";
import { demoEntryMode } from "../runtime/demo-entry-mode";
import { HomePair, ManagerWindow, RecordPanel, TenantPhone, VendorPhone } from "./landing/drawings";
import { HeroScene, RecordScene, StepScene, type Step } from "./landing/scenes";
import { ScrollScenes } from "./landing/scroll-scenes";
import styles from "./home.module.css";
export const dynamic = "force-dynamic";

// First-visitor page (spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md). The layout follows the
// reference site the operator picked on 2026-10-15 (design rules §1, Toss), told in the order the app handles a request.
// The scenes move with the scroll only where rules 9.1 allow it; still, the page shows everything in the same order.

const TITLE: [string, string] = ["세입자 수리 요청,", "문자 대신 여기서 받아요"];
const LEAD = "세입자가 사진과 함께 접수하면 건물 정보에 맞춘 질문으로 필요한 내용이 채워져요. 관리자는 확인하고 업체에 방문을 맡기고, 처리 과정은 세입자도 함께 봐요.";

const TENANT_STEPS: readonly Step[] = [
  { title: "문제를 고르고 사진과 함께 접수해요", detail: "난방과 누수 중에서 고르고, 사진은 최대 3장까지 함께 보내요." },
  { title: "위험한 신호부터 확인해요", detail: "가스 냄새나 연기가 있으면 일반 접수를 멈추고 안전 안내부터 보여 줘요." },
  { title: "건물에 맞춘 질문에 답하고 보내요", detail: "중앙난방인지 개별난방인지에 따라 묻는 내용이 달라요. 다 답하면 수리 요청을 제출해요." },
];
const MANAGER_STEPS: readonly Step[] = [
  { title: "할 일은 알림에 모여요", detail: "긴급 확인, 처리 방법 결정, 업체 확인처럼 지금 해야 할 일만 순서대로 보여요." },
  { title: "부족하면 다시 묻고, 처리 방법을 정해요", detail: "다시 확인할 질문을 골라 세입자에게 보내고, 답이 오면 처리 방법을 정해요." },
  { title: "업체에 보안 링크를 보내요", detail: "공유할 사진을 고르고 링크를 발급해 업체에 직접 전달해요." },
];
const VENDOR_STEPS: readonly Step[] = [
  { title: "링크로 작업을 열고 수락해요", detail: "접수 요약과 관리자가 고른 사진만 보여요. 수락하거나 사유를 골라 거절해요." },
  { title: "세입자가 보낸 시간 안에서 방문을 정해요", detail: "세입자가 가능한 시간을 보내면 그 안에서 방문 일정이 확정돼요." },
  { title: "방문하고 사진과 함께 보고해요", detail: "방문을 시작하고, 작업 내용과 사진을 보고하면 관리자가 검토해요." },
];

// The way in for the page mode: the top bar button, the buttons under the first scene's explanation, and the closing entry.
type Entry = { cta: { label: string; href: string }; title: string; text: string; actions: ReactNode; note?: ReactNode };

function Landing({ entry }: { entry: Entry }) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={`${styles.container} ${styles.barInner}`}>
          <p className={styles.wordmark}>자취사무소</p>
          <nav className={styles.nav} aria-label="페이지 안내">
            <a href="#tenant">세입자</a>
            <a href="#manager">관리자</a>
            <a href="#vendor">업체</a>
            <a href="#record">수리 기록</a>
          </nav>
          <a className={styles.secondary} href={entry.cta.href}>{entry.cta.label}</a>
        </div>
      </header>
      <ScrollScenes>
        <HeroScene title={TITLE} lead={LEAD} actions={entry.actions} drawing={<HomePair />} />
        <StepScene id="tenant" eyebrow="세입자" title={["사진과 몇 가지 답이면", "접수가 끝나요"]} steps={TENANT_STEPS} drawing={<TenantPhone />} />
        <StepScene id="manager" eyebrow="관리자" title={["확인부터 업체 연결까지", "이어서 처리해요"]} steps={MANAGER_STEPS} drawing={<ManagerWindow />} reverse />
        <StepScene id="vendor" eyebrow="업체" title={["업체는 로그인 없이", "링크 하나로 일해요"]} steps={VENDOR_STEPS} drawing={<VendorPhone />} />
        <RecordScene drawing={<RecordPanel />} />
        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={`${styles.container} ${styles.closingInner}`}>
            <h2 id="closing-title" className={styles.headline}>오늘 들어온 수리 요청부터<br />{" "}여기서 받아 보세요</h2>
            <div id="entry" className={styles.entry}>
              <h3 id="entry-title" className={styles.entryTitle}>{entry.title}</h3>
              <p>{entry.text}</p>
              {entry.actions}
              {entry.note}
            </div>
          </div>
        </section>
      </ScrollScenes>
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <p className={styles.wordmark}>자취사무소</p>
          <p className={styles.caption}>이 페이지의 화면 예시는 모두 체험용 가짜 건물·세대 데이터예요.</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const mode=parseApplicationMode(process.env.BUILD_MANAGER_MODE);
  if(mode==='B1'&&demoEntryMode())return <Landing entry={{
    cta:{label:"체험하기",href:"#entry"}, title:"로그인 없이 바로 써 보기", text:"체험용 가짜 건물·세대 데이터로 들어가요. 누구나 바꿀 수 있어요.",
    actions:<div className={styles.actions}>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="manager"/><button className={styles.primary} type="submit">관리자로 체험하기</button></form>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="tenant"/><button className={styles.secondary} type="submit">세입자로 체험하기</button></form>
    </div>,
    note:<p className={styles.caption}>지금 접수할 수 있는 문제는 난방과 누수 두 가지예요. 업체 화면은 관리자가 업체에 방문을 맡길 때 만들어지는 링크로 열려요.</p>,
  }}/>;
  if(mode==='B1')return <Landing entry={{
    cta:{label:"로그인하기",href:"/auth/login"}, title:"내 조직으로 들어가기", text:"로그인하면 내 조직의 건물과 접수 내용을 볼 수 있어요.",
    actions:<div className={styles.actions}>
      <a className={styles.primary} href="/auth/login">로그인하기</a>
      <Link className={styles.textLink} href="/workspace">내 조직으로 이동</Link>
    </div>,
  }}/>;
  if(mode!=='DEMO')return <div className={styles.page}><main className={`${styles.container} ${styles.hero}`}><h1 className={styles.heroTitle}>서비스를 준비하고 있어요.</h1></main></div>;
  return <Landing entry={{
    cta:{label:"데모 시작하기",href:"#entry"}, title:"데모 시작하기",
    text:"합성 데이터로 만든 데모예요. 실제 인증과 업체 배정은 하지 않아요. 안전 진단을 대신하지 않으며, 위험 신호가 보이면 일반 절차를 중단해요.",
    actions:<div className={styles.actions}>
      <Link className={styles.primary} href="/demo/tenant">세입자 데모 시작</Link>
      <Link className={styles.secondary} href="/demo/landlord">임대인 데모 시작</Link>
    </div>,
    note:process.env.CORE_FLOW_MODE === "SYNTHETIC_LOCAL" ? <p><Link className={styles.textLink} href="/core">RC1 수리 접수·처리 시작</Link></p> : null,
  }}/>;
}
```

- [ ] **Step 6: 모양**

`apps/web/src/app/home.module.css`를 통째로 바꾼다.

```css
/* First-visitor page (design rules §1 and 9.1, operator decision 2026-10-15; spec
   docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md). Every value is a rules token (§2–§6, §9).
   The page is still by default; a scene moves only while ScrollScenes has set data-motion="on" on it. */
.page {
  min-height: 100vh; background: var(--color-surface); color: var(--color-text); font-family: var(--font-sans);
  font-size: .9375rem; line-height: 1.5625rem; letter-spacing: -0.01em; word-break: keep-all; overflow-wrap: anywhere;
}
/* Resets carry no element weight, so each block's own spacing below wins. */
.page :where(h1, h2, h3, p, ol, ul, figure) { margin: 0; }
.page :where(ol, ul) { padding: 0; list-style: none; }
/* Anchored sections and keyboard focus stop below the sticky 56px bar plus 20px (§7). */
.page [id], .page :is(a, button) { scroll-margin-block: calc(3.5rem + 1.25rem); }
/* Content column: at most 82.5rem, side margins 20 / 30 / 40px (§5, §7). */
.container { width: min(100% - 2.5rem, 82.5rem); margin-inline: auto; }

/* Top bar (§8.10): 56px, wordmark, page links from 1024px, and a secondary button so the page shows one filled blue button (§8.1). */
.bar { position: sticky; top: 0; z-index: 10; background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
.barInner { display: flex; align-items: center; gap: .625rem; min-height: 3.5rem; }
.wordmark { margin-right: auto; font-size: 1.25rem; line-height: 1.875rem; font-weight: 600; letter-spacing: -0.02em; }
.nav { display: none; }
.nav a {
  display: inline-flex; align-items: center; justify-content: center; min-width: 3.125rem; min-height: 3.125rem; padding-inline: .9375rem;
  border-radius: .625rem; color: var(--color-text); font-size: .9375rem; line-height: 1.25rem; font-weight: 600; text-decoration: none;
  transition: background-color var(--motion-fast) var(--ease);
}
.nav a:hover { background: var(--color-fill-hover); }

/* Buttons (§8.1). */
.primary, .secondary {
  display: inline-flex; align-items: center; justify-content: center; min-height: 3.125rem; padding: .625rem 1.25rem;
  border: 1px solid var(--color-border-strong); border-radius: .625rem; background: var(--color-surface); color: var(--color-text);
  font: inherit; font-size: .9375rem; line-height: 1.25rem; font-weight: 600; letter-spacing: -0.01em; text-decoration: none; text-align: center; cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease);
}
.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-text-inverse); }
.primary:hover { background: var(--color-primary-hover); }
.secondary:hover { background: var(--color-fill-hover); }
.primary:active, .secondary:active { transform: scale(.98); }
.textLink { color: var(--color-primary); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 5px; }
.page :is(a, button):focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.caption { font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; color: var(--color-text-secondary); }
.actions { display: grid; gap: .625rem; }
.actions form { margin: 0; }
.actions :is(.primary, .secondary) { width: 100%; }

/* Scene text (§3.2). */
.scene { padding-block: 3.125rem; }
.eyebrow { font-size: .9375rem; line-height: 1.25rem; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text-secondary); }
.headline { margin-top: .625rem; font-size: 1.5625rem; line-height: 2.1875rem; font-weight: 700; letter-spacing: -0.02em; text-wrap: balance; }
.lead { max-width: 34rem; font-size: 1.125rem; line-height: 1.75rem; letter-spacing: -0.01em; color: var(--color-text-secondary); }
.sectionLead { margin-top: .625rem; }

/* First scene, still: the board (§6.2 30px) with the drawing and the title, then the explanation and the way in. */
.board { display: grid; justify-items: center; gap: 1.875rem; padding: 1.875rem 1.25rem; background: var(--color-page); border-radius: 1.875rem; }
/* The pair spans the board, so the phone can shrink to it on a 320px screen (no sideways scroll, rules §7). */
.pair { display: flex; align-items: center; justify-content: center; justify-self: stretch; }
.pair > .window { display: none; }
.heroTitle { justify-self: start; font-size: 2rem; line-height: 2.625rem; font-weight: 700; letter-spacing: -0.03em; }
.heroSide { display: grid; gap: 1.25rem; margin-top: 1.875rem; }
.sideTitle { font-size: 1.5625rem; line-height: 2.1875rem; font-weight: 700; letter-spacing: -0.02em; }

/* Step scenes, still: text and every step with its detail, then every screen of the drawing one after another. */
.split { display: grid; gap: 1.875rem; }
.steps { display: grid; margin-top: 1.875rem; border-top: 1px solid var(--color-border); }
.steps li { display: grid; gap: .3125rem; padding-block: .9375rem; border-bottom: 1px solid var(--color-border); transition: color var(--motion-base) var(--ease); }
.stepTitle { font-size: 1.25rem; line-height: 1.875rem; font-weight: 600; letter-spacing: -0.02em; }
.stepDetail { display: grid; grid-template-rows: 1fr; transition: grid-template-rows var(--motion-base) var(--ease); }
.stepDetail > span { overflow: hidden; color: var(--color-text-secondary); }
.device { display: grid; justify-items: center; padding: 1.25rem; background: var(--color-page); border-radius: 1.875rem; }

/* Drawn screens (§5: phone 17.5rem; in a moving scene 35rem tall; manager window 37.5rem × 25rem). No shadow (§6.3). */
.phone { position: relative; width: min(100%, 17.5rem); background: var(--color-surface); border: 1px solid var(--color-border-strong); border-radius: 1.875rem; overflow: hidden; }
.window { position: relative; width: min(100%, 37.5rem); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: .9375rem; overflow: hidden; }
.pair > .phone { flex: none; width: min(17.5rem, 100%); }
.phoneTop, .windowTop {
  display: flex; align-items: center; min-height: 2.8125rem; padding-inline: .9375rem; border-bottom: 1px solid var(--color-border);
  font-size: .8125rem; line-height: 1.125rem; font-weight: 600; letter-spacing: 0;
}
.phoneTop { justify-content: center; }
.windowTop { color: var(--color-text-secondary); }
.screen { display: grid; gap: .625rem; align-content: start; padding: 1.25rem; transition: opacity var(--motion-base) var(--ease), transform var(--motion-base) var(--ease); }
.screen + .screen { border-top: 1px solid var(--color-border); }
.screenTitle { font-weight: 600; }
.label { font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; color: var(--color-text-secondary); }
/* Two answers side by side; they stack once enlarged text no longer fits two (rules §12, 200%). */
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 5rem), 1fr)); gap: .625rem; }
.tiles span {
  display: flex; align-items: center; justify-content: center; min-height: 3.125rem; padding: .9375rem;
  border: 1px solid var(--color-border-control); border-radius: .625rem; font-weight: 600; line-height: 1.25rem; text-align: center;
}
.tiles span[data-selected] { border: 2px solid var(--color-primary); background: var(--color-primary-soft); padding: calc(.9375rem - 1px); }
.field { padding: .625rem .9375rem; border: 1px solid var(--color-border-control); border-radius: .625rem; }
.note { padding: .9375rem; background: var(--color-fill-subtle); border-radius: .625rem; }
.check { display: flex; align-items: center; gap: .625rem; }
.check::before {
  content: "✓"; display: grid; place-items: center; flex: none; width: 1.25rem; height: 1.25rem; border-radius: .3125rem;
  background: var(--color-primary); color: var(--color-text-inverse); font-size: .8125rem; line-height: 1;
}
.fakeButton {
  display: flex; align-items: center; justify-content: center; min-height: 3.125rem; padding: .625rem 1.25rem; border: 1px solid var(--color-primary);
  border-radius: .625rem; background: var(--color-primary); color: var(--color-text-inverse); font-weight: 600; line-height: 1.25rem; text-align: center;
}
.fakeButton[data-kind="secondary"] { border-color: var(--color-border-strong); background: var(--color-surface); color: var(--color-text); }
.thumbs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .625rem; }
.thumbs span {
  display: grid; place-items: center; aspect-ratio: 4 / 3; border-radius: .9375rem; background: var(--color-fill-subtle);
  color: var(--color-text-secondary); font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0;
}
.rows li { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: .625rem; align-items: center; padding-block: .9375rem; border-bottom: 1px solid var(--color-border); }
.rows li:last-child { border-bottom: 0; }
.rows .status { grid-column: 2; grid-row: 1 / span 2; }
.rowTitle { grid-column: 1; font-weight: 600; }
.rowMeta { grid-column: 1; font-size: .8125rem; line-height: 1.125rem; letter-spacing: 0; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.homeRows li { grid-template-columns: minmax(0, 1fr); row-gap: .3125rem; }
.homeRows .rowTitle { display: flex; flex-wrap: wrap; align-items: center; gap: .625rem; }
.homeRows .status { grid-column: auto; grid-row: auto; }

/* Status labels (§8.7): the app's own names and colour pairs. */
.status {
  display: inline-flex; align-items: center; justify-content: center; justify-self: start; padding: .3125rem .625rem; border-radius: .3125rem;
  font-size: .9375rem; line-height: 1.25rem; font-weight: 600; text-align: center;
}
.status[data-state="progress"] { color: var(--status-progress-text); background: var(--status-progress-bg); }
.status[data-state="done"] { color: var(--status-done-text); background: var(--status-done-bg); }
.status[data-state="wait"] { color: var(--status-wait-text); background: var(--status-wait-bg); }
.status[data-state="urgent"] { color: var(--status-urgent-text); background: var(--status-urgent-bg); }
.status[data-state="open"] { color: var(--color-text-secondary); background: var(--color-fill-subtle); }

/* Result and record. */
.record { display: grid; gap: .9375rem; padding: 1.25rem; background: var(--color-page); border-radius: 1.875rem; }
.resultCard, .history { padding: .9375rem 1.25rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: .9375rem; }
.resultCard { display: grid; gap: .625rem; }

/* Closing: the way in. It never moves. */
.closing { padding-block: 3.125rem; background: var(--color-page); }
.closingInner { display: grid; gap: 1.25rem; }
.entry { display: grid; gap: .625rem; max-width: 40rem; padding: 1.875rem 1.25rem; background: var(--color-surface); border-radius: 1.875rem; }
.entryTitle { font-size: 1.25rem; line-height: 1.875rem; font-weight: 600; letter-spacing: -0.02em; }
.footer { padding-block: 1.875rem 3.125rem; border-top: 1px solid var(--color-border); }
.footerInner { display: grid; gap: .625rem; }
/* The page shown when no mode is set. */
.hero { padding-top: 3.125rem; }

@media (min-width: 768px) {
  .container { width: min(100% - 3.75rem, 82.5rem); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; }
  .actions :is(.primary, .secondary) { width: auto; }
  .board { padding: 3.125rem; }
  .device, .record { padding: 1.875rem; }
  .entry { padding: 1.875rem; }
}
@media (min-width: 1024px) {
  .nav { display: flex; gap: .3125rem; margin-right: auto; }
  .scene, .closing { padding-block: 6.25rem; }
  .heroTitle { font-size: 3.375rem; line-height: 4.375rem; }
  .headline, .sideTitle { font-size: 2.75rem; line-height: 3.875rem; letter-spacing: -0.03em; }
  .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 3.125rem; align-items: center; }
  .split[data-reverse] > figure { order: -1; }
  .pair > .window { display: block; margin-left: -3.75rem; }
  .pair > .phone { position: relative; z-index: 1; }
}
@media (min-width: 1440px) {
  .container { width: min(100% - 5rem, 82.5rem); }
}

/* ---- Moving scenes (rules 9.1): only inside a scene ScrollScenes turned on. ---- */
.scene[data-motion="on"] { padding-block: 0; }
.scene[data-motion="on"] .stage { position: sticky; top: 3.5rem; height: calc(100vh - 3.5rem); overflow: hidden; }

/* First scene: 250% of the screen. a = --a, b = --b, p = --p (rules 9.1). */
.heroScene[data-motion="on"] { height: 250vh; }
.heroScene[data-motion="on"] .board {
  position: absolute; inset: .9375rem 1.25rem 1.25rem; display: block; padding: 0; transform-origin: 100% 50%;
  transform: translateX(calc(var(--a, 0) * 2vw)) scale(calc(1 - .42 * var(--a, 0)));
}
.heroScene[data-motion="on"] .pair { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) scale(calc(1 + .1 * var(--a, 0))); }
/* Absolutely placed, the pair takes its content's width, so the phone needs a fixed one here (a percentage would collapse it). */
.heroScene[data-motion="on"] .pair > .phone { width: 17.5rem; height: 35rem; }
.heroScene[data-motion="on"] .heroTitle { position: absolute; left: 3.125rem; right: 3.125rem; bottom: 2.8125rem; opacity: calc(1 - 4 * var(--p, 0)); }
.heroScene[data-motion="on"] .heroSide {
  position: absolute; left: 1.25rem; top: 50%; width: min(36rem, 44%); margin: 0;
  opacity: var(--b, 0); transform: translateY(calc(-50% + (1 - var(--b, 0)) * 1.25rem));
}
/* Out of sight, out of reach for the pointer; keyboard focus shows it at once (rules 9.1). */
.heroScene[data-motion="on"][data-side="hidden"] .heroSide { pointer-events: none; }
.heroScene[data-motion="on"] .heroSide:focus-within { opacity: 1; transform: translateY(-50%); pointer-events: auto; }
@media (min-width: 768px) {
  .heroScene[data-motion="on"] .board { inset: .9375rem 1.875rem 1.25rem; }
  .heroScene[data-motion="on"] .heroSide { left: 1.875rem; }
}
@media (min-width: 1440px) {
  .heroScene[data-motion="on"] .board { inset: .9375rem 2.5rem 1.25rem; }
  .heroScene[data-motion="on"] .heroSide { left: 2.5rem; }
}
@media (max-width: 767px) {
  .heroScene[data-motion="on"] .board { inset: .625rem .625rem .9375rem; transform-origin: 50% 0; transform: scale(calc(1 - .2 * var(--a, 0))); }
  .heroScene[data-motion="on"] .pair { top: 42%; transform: translate(-50%, -50%) scale(.82); }
  .heroScene[data-motion="on"] .heroTitle { left: 1.5625rem; right: 1.5625rem; bottom: 1.875rem; }
  .heroScene[data-motion="on"] .heroSide {
    left: 1.25rem; right: 1.25rem; top: auto; bottom: 1.25rem; width: auto; padding-top: .9375rem; background: var(--color-surface);
    transform: translateY(calc((1 - var(--b, 0)) * 1.25rem));
  }
  .heroScene[data-motion="on"] .heroSide:focus-within { transform: none; }
}
@media (max-width: 767px) and (max-height: 760px) {
  .heroScene[data-motion="on"] .pair { transform: translate(-50%, -50%) scale(.7); }
}

/* Step scenes: 3 steps × 85% + 100% of the screen (every step scene has three steps, spec D3). */
.stepScene[data-motion="on"] { height: calc(3 * 85vh + 100vh); }
.stepScene[data-motion="on"] .stage { display: grid; align-items: center; }
.stepScene[data-motion="on"] .steps li { color: var(--color-text-secondary); }
.stepScene[data-motion="on"] .stepDetail { grid-template-rows: 0fr; }
.stepScene[data-motion="on"] .phone { height: 35rem; }
.stepScene[data-motion="on"] .window { height: 25rem; }
.stepScene[data-motion="on"] .screen { position: absolute; inset: 2.8125rem 0 0; opacity: 0; transform: translateY(.625rem); }
.stepScene[data-motion="on"] .screen + .screen { border-top: 0; }
.stepScene[data-motion="on"][data-step="0"] [data-step-item="0"],
.stepScene[data-motion="on"][data-step="1"] [data-step-item="1"],
.stepScene[data-motion="on"][data-step="2"] [data-step-item="2"] { color: var(--color-text); }
.stepScene[data-motion="on"][data-step="0"] [data-step-item="0"] .stepDetail,
.stepScene[data-motion="on"][data-step="1"] [data-step-item="1"] .stepDetail,
.stepScene[data-motion="on"][data-step="2"] [data-step-item="2"] .stepDetail { grid-template-rows: 1fr; }
.stepScene[data-motion="on"][data-step="0"] [data-screen="0"],
.stepScene[data-motion="on"][data-step="1"] [data-screen="1"],
.stepScene[data-motion="on"][data-step="2"] [data-screen="2"] { opacity: 1; transform: none; }
@media (max-width: 1023px) {
  .stepScene[data-motion="on"] .stage { align-items: start; padding-top: .9375rem; }
  .stepScene[data-motion="on"] .split { gap: 1.25rem; }
  .stepScene[data-motion="on"] .steps { margin-top: .625rem; border-top: 0; }
  /* Only the current step shows; the others stay readable to screen readers (§12). */
  .stepScene[data-motion="on"] .steps li { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  .stepScene[data-motion="on"][data-step="0"] [data-step-item="0"],
  .stepScene[data-motion="on"][data-step="1"] [data-step-item="1"],
  .stepScene[data-motion="on"][data-step="2"] [data-step-item="2"] { position: static; width: auto; height: auto; padding-block: .3125rem; overflow: visible; clip-path: none; white-space: normal; }
  .stepScene[data-motion="on"] .device { padding: .9375rem; }
}

/* Record: 230% of the screen; row k arrives with --s (rules 9.1). */
.recordScene[data-motion="on"] { height: 230vh; }
.recordScene[data-motion="on"] .stage { display: grid; align-content: center; }
.recordScene[data-motion="on"] [data-row] { opacity: var(--s, 0); transform: translateY(calc((1 - var(--s, 0)) * 1.25rem)); }
@media (max-width: 1023px) {
  .recordScene[data-motion="on"] .stage { align-content: start; padding-top: .9375rem; }
}

@media (prefers-reduced-motion: reduce) {
  .primary, .secondary, .nav a, .screen, .steps li, .stepDetail { transition: none; }
  .primary:active, .secondary:active { transform: none; }
}
```

- [ ] **Step 7: 계산·렌더 시험과 정적 검사**

```bash
npm --workspace @build-manager/web run test -- src/app/page.test.tsx src/app/landing
npm run typecheck
npm run lint
```

Expected: 모두 통과(`page.test.tsx` 12개, `landing` 13개). lint 오류 0.

- [ ] **Step 8: 브라우저 시험(GREEN)**

하나씩 돌린다.

```bash
npm --workspace @build-manager/web run test:e2e -- landing-scenes.spec.ts web-milestone.spec.ts
npm run test:e2e:vendor -- demo-entry.spec.ts
```

Expected: `landing-scenes.spec.ts` 6개, `web-milestone.spec.ts`, `demo-entry.spec.ts`가 통과한다. 실패하면 화면을 열어(1440×900, 390×844) 원인을 확인하고 고친다. 시험을 느슨하게 바꾸지 않는다.

- [ ] **Step 9: 눈으로 보기**

`npm --workspace @build-manager/web run dev`로 띄운 첫 화면을 1440×900과 390×844에서 연다. 장면마다 맨 위·가운데·끝을 캡처해 `~/.build-manager-rc1-private/landing-scenes/`에 둔다(저장소 밖). 시안 2판과 배치가 같은지 본다. 다 본 뒤 개발 서버를 끈다. `next dev`가 만든 `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`는 커밋하지 않는다.

- [ ] **Step 10: 커밋**

```bash
git add apps/web/src/app/landing/drawings.tsx apps/web/src/app/landing/scenes.tsx apps/web/src/app/page.tsx apps/web/src/app/home.module.css apps/web/src/app/page.test.tsx
git commit -m "feat(web): landing page told in scroll scenes, in the order the app handles a request (operator 2026-10-15)

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 6: 디자인 점검

**Files:**
- Modify: `scripts/design-audit.mjs`(첫 화면 점검 줄)

- [ ] **Step 1: 움직임 줄이기 상태도 잰다**

`scripts/design-audit.mjs`에서 이 줄을

```js
      await p.goto(origin + "/"); await audit(p, `${engine}-${width}-home`);
```

이렇게 바꾼다.

```js
      await p.goto(origin + "/"); await audit(p, `${engine}-${width}-home`);
      // The landing scenes still (rules 9.1): every step and screen shows, so the audit measures all of them once.
      await p.emulateMedia({ reducedMotion: "reduce" }); await p.goto(origin + "/"); await audit(p, `${engine}-${width}-home-static`); await p.emulateMedia({ reducedMotion: null });
```

- [ ] **Step 2: 점검 실행**

Docker Desktop이 켜져 있어야 한다. 고정 Node를 PATH 맨 앞에 둔다.

```bash
node --experimental-transform-types scripts/design-audit.mjs "$HOME/.build-manager-rc1-private/landing-scenes-audit"
```

Expected: 발견 0건, 종료 코드 0. 발견이 있으면 화면(CSS)을 고치고 다시 돌린다. 오탐이면 이유를 Task 7 PR 본문에 적는다. `home`과 `home-static` 캡처를 390px과 1280px에서 직접 열어 본다.

- [ ] **Step 3: 커밋**

고친 파일이 있으면 그 경로도 함께 스테이징한다.

```bash
git add scripts/design-audit.mjs
git commit -m "chore(tooling): audit the landing page still as well as at its first scene

Co-Authored-By: Claude Opus 5.5 <작업 환경이 정한 주소>"
```

---

### Task 7: 전체 검사, 망가뜨려 보기, 리뷰, 기록, 병합

- [ ] **Step 1: 전체 검사(DEV-06)**

하나씩 돌리고 종료 코드와 결과 문구를 적는다.

```bash
python scripts/verify_repository.py --history
npm run test:shared
npm run test:web
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm --workspace @build-manager/web run test:e2e
npm run test:e2e:vendor -- demo-entry.spec.ts
```

- Expected: 모두 통과.
- 5초 그래프 경계 시험(#119)이나 업체 컨테이너 시험이 이 PC 부하로 시간 초과가 나면 그 시험만 한 번 따로 다시 돌려 확인하고 적는다(DEV-06).

- [ ] **Step 2: 일부러 망가뜨려 시험이 잡는지 본다**

하나씩 바꾸고, 그 시험이 실패하는지 보고, `git checkout -- <파일>`로 되돌린다.

| 망가뜨리기 | 잡아야 하는 시험 |
| --- | --- |
| `scene-motion.ts` `activeStep`의 `Math.floor`를 `Math.round`로 | `scene-motion.test.ts` "shows one step per equal share …" |
| `MIN_MOTION_HEIGHT = 600`을 `500`으로 | `scene-motion.test.ts` "moves only when …" |
| `motionAllowed`에서 `!reducedMotion &&`를 지움 | `scene-motion.test.ts` "moves only when …", `scroll-scenes.test.tsx` "keeps every scene still for reduced motion …" |
| `scroll-scenes.tsx`에서 `sceneFits` 검사 줄을 지움 | `scroll-scenes.test.tsx` "keeps a scene still when its content is taller …" |
| `scroll-scenes.tsx` 해제에서 `removeEventListener("scroll", request)`를 지움 | `scroll-scenes.test.tsx` "stops following the scroll once it is gone" |
| `home.module.css` 좁은 화면 지난 단계 규칙의 `position: absolute; … clip-path: inset(50%)`를 `display: none`으로 | `landing-scenes.spec.ts` "each drawing has one name, and a narrow screen …" |

결과 표를 PR 본문에 넣는다.

- [ ] **Step 3: 새 문맥 끝 리뷰(DEV-03 5단계)**

리뷰 에이전트(새 문맥)에 스펙, 이 계획, `git diff origin/main...HEAD`를 준다. 다음을 보게 한다.
- 스펙과 규칙 9.1 준수: 숫자, 움직이지 않는 경우, 구분 장치
- 문구가 스펙·앱과 같은지, 해요체
- 접근성: 그림 이름, `aria-hidden`, 숨긴 단계가 화면 읽기에 남는지, 첫 장면 설명과 키보드
- 디자인 규칙: 토큰, 채운 파란 버튼 하나, 그림자 없음, 누르는 칸 50px 이상
- 세 모드의 입구와 기존 시험

지적은 한 번에 고치고, 고친 부분만 다시 리뷰받는다.

- [ ] **Step 4: 기록**

- `STATUS.md` 23행: "Remaining: `/demo/*` (to be removed with DEMO mode in app v2)" 바로 앞에 이 문장을 넣는다(Edit 도구, 그 행의 다른 글자는 건드리지 않는다).

  ```text
  Since PR <번호> the home page `/` follows the operator-picked Toss layout with scroll-linked scenes (operator decision 2026-10-15, rules 9.1); not on the hosted demo yet.
  ```

- `ops/AI_Execution_Log.csv`: 행 하나 추가(Edit 도구, UTC `+00:00`, 따옴표 안 따옴표는 `""`). event_id `LANDING-SCROLL-SCENES-20261015`.
- `ops/pending_external_sync.md`: 같은 event_id로 한 줄 추가.

- [ ] **Step 5: PR을 연다**

```bash
git fetch origin && git merge --no-edit origin/main   # main이 움직였으면. 기록 파일 충돌은 main 줄 먼저.
python scripts/verify_repository.py --history
git push -u origin feat/landing-scroll-scenes
gh pr create --base main --title "feat(web): landing page told in scroll scenes (Toss reference, rules 9.1)" --body-file <scratchpad의 본문 파일>
```

본문은 한국어다. 넣을 것:
- 첫 줄 `Risk tier: 일반 (…)`
- 목적과 운영자 결정 D1·D2, 스펙·계획 링크
- 장면 순서
- 규칙 변경(DECISION, 1절, 5절, 9.1)
- 바꾼 시험과 이유(첫 화면 렌더 시험, web-milestone 링크 범위, 새 장면 시험)
- 검사 결과, 망가뜨려 보기 표, 디자인 점검 결과
- R05 자체 점검(C01–C12)
- 구분 장치
- 데모 배포 안 함(운영자에게 따로 묻는다)
- 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

- [ ] **Step 6: CI 통과 후 병합한다**

정확한 head에서 CI(`app-check.yml`, `repository-check.yml`)가 통과하면 병합한다.

```bash
gh pr merge <번호> --merge --match-head-commit <head SHA>
```

- 병합 뒤 바깥 체크아웃을 앞으로 감는다.
  - 먼저 `git fetch`를 한다.
  - 명령: `node "$LOCALAPPDATA/build-manager-maintenance/outer-ff.cjs" <병합 커밋 전체 SHA> outer-checkout-update-20261010-<N>`
  - `<N>`은 `outer-checkout-update-20261010-*` 목록의 다음 번호다(2026-10-15 현재 -47).

- [ ] **Step 7: 운영자에게 보고한다**

쉬운 한국어로 보고한다.
- 바뀐 것: 첫 화면이 스크롤 장면으로 바뀐 것과 움직이지 않는 경우
- 검사 결과
- 남은 일(실제 현장 사진)
- 데모에 아직 올리지 않았다는 것. 데모 배포를 할지 묻는다.

## 자체 점검 결과(계획 작성 뒤)

- **스펙 대응**
  - 결정 D1·D2 → Task 1(규칙)·Task 5(구분 장치: 이름·글꼴·그림·문구)
  - D3 장면 구성과 문구 → Task 5(`page.tsx`, `scenes.tsx`, `drawings.tsx`)
  - D4 새 패키지 없음 → Task 2·3(직접 코드)
  - D5 기본은 움직이지 않음 → Task 3(서버 렌더 시험), Task 5(CSS 기본 모양)
  - 움직임 숫자 → Task 1(9.1)·Task 2(`scene-motion.ts`)·Task 5(CSS 계수)
  - 움직이지 않는 경우 네 가지 → Task 3(움직임 줄이기, 600px, 내용 넘침)·Task 5(서버 렌더)·Task 4(브라우저)
  - 접근성 → Task 4·5(그림 이름, 숨긴 단계, 첫 장면 설명과 키보드)
  - 모드별 입구 → Task 5(`page.tsx`, 렌더 시험)·Task 4(web-milestone)
  - 규칙 변경 → Task 1, 테스트 절 → Task 2–6, 디자인 점검 → Task 6
- **이름 일관성**
  - Task 2가 만드는 것: `sceneProgress`, `activeStep`, `heroPhase`, `recordRow`, `motionAllowed`, `sceneFits`, `clamp01`. Task 3이 같은 이름으로 쓴다.
  - Task 3이 읽는 마크업: `data-scene`, `data-steps`, `data-stage`, `data-row`. Task 5가 만든다.
  - Task 4가 쓰는 선택자: `data-scene`, `data-hero-side`, `data-screen`, `data-step-item`, `#entry`. Task 5가 만든다.
- **스펙과 다르게 정한 것**(Task 1 Step 6에서 스펙을 바로잡음)
  - 첫 장면 설명 아래에는 버튼만 둔다.
  - 첫 장면 설명은 `visibility: hidden` 대신 보이지 않게만 하고 포인터를 막는다. 키보드 포커스가 들어오면 바로 보인다.
  - 휴대폰 그림은 화면 높이 760px 이하에서 0.7배다(9.1에 적음).

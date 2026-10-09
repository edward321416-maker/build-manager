# 작업 규칙 v1 — 읽기 전 게이트 일반화 계획 (PR-2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 디자인 규칙 v1의 읽기 전 차단 게이트를 규칙 목록 기반의 게이트 하나로 일반화한다. 대상은 디자인·개발·연구·레퍼런스 규칙집 4개이고, 안내 문서(AGENTS.md·CLAUDE.md)에 작업별 규칙 표를 넣는다.

**Architecture:**
- 규칙집·편집 경로·도구·명령의 대응은 데이터 파일 `.claude/rules-gate.json`에 둔다.
- 동작은 `.claude/hooks/rules-gate.mjs` 하나가 맡는다.
  - `record`: 전체 읽기의 해시를 기록한다.
  - `check`: 필요한 규칙이 하나라도 읽히지 않았으면 exit 2로 막는다.
- PR #79 디자인 게이트의 동작(해시, 세션별 상태, 저장소 루트 탐색, fail-open)은 그대로 유지한다. 디자인 게이트 스크립트와 그 테스트는 이 게이트로 대체한다.

**Tech Stack:** Node 24(`node:` 모듈만 사용, 의존성 추가 없음), Vitest(`npm run test:shared`), TypeScript(`npm run typecheck:tests`), Claude Code hooks(PreToolUse·PostToolUse)

**Spec:** [작업 규칙 v1 설계](../specs/2026-10-10-work-rules-v1-design.md) §게이트·§안내·§검증

## Global Constraints

- **위험 등급**: 일반. 개발 도구와 문서만 바꾸고 제품 동작은 바꾸지 않는다.
- **크기**: DEV-02에 따라 PR 변경 합계는 1000줄 이하로 한다.
- **차단 조건**
  - 편집 대상, `WebSearch`·`WebFetch`, 패키지 추가 명령에 필요한 규칙 중 현재 해시로 읽지 않은 것이 있으면 막는다.
  - 규칙 파일이 없으면 그 규칙은 건너뛴다.
  - 저장소 밖에서는 막지 않는다.
  - 예상하지 못한 오류가 나면 통과시킨다(fail-open).
- **상태 저장**: `%TEMP%/build-manager-rules-gate/<session>.json`. Windows에서는 키를 소문자로 저장한다.
- **크기 상한**: 목록의 모든 규칙 파일은 600줄·48,000바이트 이하다.
- **Codex**: hook을 쓰지 않으므로 AGENTS.md 표가 유일한 안내다. 표에는 규칙 본문을 복사하지 않는다.

## File Structure

| 파일 | 변경 | 책임 |
| --- | --- | --- |
| `.claude/rules-gate.json` | 생성 | 규칙집 목록과 편집 glob·제외·도구·명령 |
| `.claude/hooks/rules-gate.mjs` | 생성 | `record`·`check` hook |
| `.claude/hooks/design-rules-gate.mjs` | 삭제 | rules-gate로 대체 |
| `.claude/settings.json` | 수정 | 두 hook을 rules-gate로 바꾸고 PreToolUse matcher 확장 |
| `tests/architecture/rules-gate.test.ts` | 생성 | 실제 `rules-gate.json`을 임시 저장소에 복사해 검증 |
| `tests/architecture/design-rules-gate.test.ts` | 삭제 | 사례를 rules-gate 테스트로 옮김 |
| `AGENTS.md`, `CLAUDE.md` | 수정 | 작업별 규칙 표. AGENTS의 evidence policy 링크를 RESEARCH_RULES로 |
| `design/DESIGN_RULES.md:7` | 수정 | 게이트 스크립트 경로만 갱신 |
| `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md` | 수정 | 실행 기록 |

---

### Task 1: 규칙 목록과 실패하는 테스트

**Files:**
- Create: `.claude/rules-gate.json`, `tests/architecture/rules-gate.test.ts`

**Interfaces:**
- Produces:
  - `rules-gate.json`의 형식은 `{ "commands": { [이름]: 정규식 }, "rules": [{ id, name, file, edit?: glob[], exclude?: glob[], tools?: string[], commands?: 이름[] }] }`이다.
  - 스크립트는 `node rules-gate.mjs record|check`로 실행하고, 표준 입력으로 hook JSON을 받는다.

- [ ] **Step 1: 규칙 목록 작성**
  - design: PR #79의 UI 패턴. `edit`는 `apps/web/src/app/**/*.{tsx,css}`, `apps/web/src/components/**/*.{tsx,css}`, `apps/mobile/src/**/*.tsx`이고, `exclude`는 `**/*.test.tsx`, `**/*.spec.tsx`다.
  - development: `edit`는 스펙 §게이트 표와 같다. `commands`는 `package-add`다.
  - research: `research/**`, `submission/**`, `product/**`
  - reference: `edit`는 `references/**`, `**/package.json`이다. `tools`는 `WebSearch`, `WebFetch`이고, `commands`는 `package-add`다.
  - `package-add` 정규식:

```text
(?:^|[\s;&|(])(?:(?:npm|pnpm|yarn)\s+(?:install|i|add)|npx\s+expo\s+install)(?:\s+-\S+)*\s+[^-\s;&|]
```

- [ ] **Step 2: 테스트 작성**
  - 각 테스트는 임시 저장소를 만들고, 그 안에 실제 `.claude/rules-gate.json`을 복사하고 4개 규칙 파일을 생성한다.
  - 상태 폴더는 `TMP`·`TEMP`·`TMPDIR`를 임시 폴더로 바꿔 격리한다.
  - 사례(기대 결과):

| # | 입력 | 기대 |
| --- | --- | --- |
| 1 | 아무것도 읽지 않고 `apps/web/src/app/core/page.tsx` Edit | 2, 메시지에 디자인과 개발 규칙 경로 |
| 2 | 1에 필요한 두 규칙을 전체 읽은 뒤 같은 Edit | 0 |
| 3 | `limit`이나 `offset`을 준 부분 읽기 | 기록하지 않음(여전히 2) |
| 4 | 읽은 뒤 개발 규칙 내용 변경 | 2, 개발 규칙만 다시 요구 |
| 5 | 다른 세션 | 2 |
| 6 | 경로별 요구 규칙: `apps/web/src/server/b1/config.ts`→개발, `apps/web/src/app/core/login-screen.test.tsx`→개발, `apps/mobile/src/features/core-ui.tsx`→디자인·개발, `packages/domain/src/a.ts`→개발, `docs/superpowers/specs/a.md`→개발, `.claude/settings.json`→개발, `research/a.md`·`submission/a.md`·`product/mvp_scope.md`→연구, `package.json`·`apps/web/package.json`→개발·레퍼런스, `references/a.md`→레퍼런스, `README.md`·`ops/AI_Execution_Log.csv`·`design/DESIGN_RULES.md`·`governance/project_policy.md`→없음(0) | 표와 같음 |
| 7 | `WebSearch`·`WebFetch`(cwd가 저장소 하위 폴더) | 2(레퍼런스). 읽은 뒤 0. cwd가 저장소 밖이면 0 |
| 8 | Bash: `npm install zod`, `npm i -D vitest`, `cd apps/web && npm install zod`, `npx expo install expo-camera`, `yarn add react` | 2(개발·레퍼런스) |
| 9 | Bash: `npm install`, `npm ci`, `npm run test:shared`, `npm install && npm test`, `npx expo install --check`, `git status` | 0 |
| 10 | PowerShell 도구로 `npm install zod` | 2 |
| 11 | 레퍼런스 규칙 파일을 지운 뒤 `package.json` Edit | 2, 개발 규칙만 요구 |
| 12 | 저장소 밖 파일 Edit | 0 |
| 13 | JSON이 아닌 입력 | 0, 경고 `rules-gate` |
| 14 | 실제 저장소의 목록에 있는 규칙 파일들 | 모두 600줄·48,000바이트 이하 |

- [ ] **Step 3: 실패 확인** — `npx vitest run tests/architecture/rules-gate.test.ts`. 기대 결과: 스크립트가 없으므로 실패한다.

### Task 2: 게이트 구현

**Files:**
- Create: `.claude/hooks/rules-gate.mjs`
- Delete: `.claude/hooks/design-rules-gate.mjs`, `tests/architecture/design-rules-gate.test.ts`

- [ ] **Step 1: 구현**
  - **구조**: PR #79 스크립트의 `rulesRoot`·`posix`·`digest`·`stateFile`·`stateKey`·`loadState`와 stdin 처리를 그대로 일반화한다.
  - **저장소 루트**: 편집 도구는 대상 파일의 폴더부터, 그 밖의 도구는 hook 입력의 `cwd`부터 위로 올라가며 `.claude/rules-gate.json`을 찾는다.
  - **glob 변환**
    - `**/` → `(?:.*/)?`, 끝에 오는 `**` → `.*`
    - `*` → `[^/]*`, `?` → `[^/]`, `{a,b}` → `(?:a|b)`
    - Windows에서는 대소문자를 구분하지 않는다.
  - **대상 판정**
    - 편집 도구(`Edit|Write|MultiEdit|NotebookEdit`): `file_path`나 `notebook_path`의 저장소 상대 경로를 `edit`에 맞춰 보고, `exclude`에 걸리면 뺀다.
    - `Bash|PowerShell`: `command`를 `commands` 정규식에 맞춘다.
    - 그 밖: `tools`에 도구 이름이 있으면 해당한다.
  - **차단**: 파일이 있는 규칙 중 현재 해시가 상태와 다르면 exit 2로 막는다. 메시지는 한국어로 쓰고, 읽어야 할 규칙 이름과 경로를 모두 적는다.
- [ ] **Step 2: 통과 확인** — `npx vitest run tests/architecture/rules-gate.test.ts` → 14개 PASS. 이어서 `npm run test:shared`, `npm run typecheck:tests`
- [ ] **Step 3: 커밋** — `feat(tooling): gate work on reading the matching rulebook`

### Task 3: 등록과 안내

**Files:**
- Modify: `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md`, `design/DESIGN_RULES.md:7`, `ops/*`

- [ ] **Step 1: 프로젝트 hook 등록**
  - PostToolUse `Read` → `node "$CLAUDE_PROJECT_DIR/.claude/hooks/rules-gate.mjs" record`
  - PreToolUse `Edit|Write|MultiEdit|NotebookEdit|WebSearch|WebFetch|Bash|PowerShell` → `… check`
  - timeout은 10이다.
- [ ] **Step 2: AGENTS.md** — "Mandatory design read" 절을 "Work rulebooks — read before that work" 절로 바꾼다.
  - 4행 표를 둔다(작업 종류 → 규칙집 링크).
  - 게이트 동작 2문장을 쓴다(대상, 다시 읽기, 셸 편집 미차단).
  - 디자인 규칙에 없는 값은 운영자 결정 전까지 쓰지 않는다는 기존 문장은 유지한다.
  - `[evidence policy](research/README.md)`는 `research/RESEARCH_RULES.md`로 바꾼다.
- [ ] **Step 3: CLAUDE.md** — 디자인 규칙 문장을 같은 4행 표와 게이트 한 문장으로 바꾼다.
- [ ] **Step 4: 디자인 규칙 7행** — 스크립트 경로만 `.claude/hooks/rules-gate.mjs`로 바꾼다. 규칙 내용은 바꾸지 않는다.
- [ ] **Step 5: 검사**
  - `python scripts/verify_repository.py --history` → PASS
  - `git diff --check`
  - 변경 합계 1000줄 이하
  - 실행 로그 1행(sync pending)
- [ ] **Step 6: 커밋** — `docs: point every agent at the work rulebooks and the rules gate`

### Task 4: 공개와 사용자 설정

- [ ] **Step 1: 끝 리뷰** — 새 문맥에서 diff와 테스트를 스펙 §게이트에 비추어 검토한다. 정확성 문제만 고친다.
- [ ] **Step 2: PR·CI·병합** — PR #82가 병합된 뒤 base를 main으로 열고, CI 통과 후 `--merge --match-head-commit`으로 병합한다.
- [ ] **Step 3: 사용자 설정**(`update-config` 스킬 사용)
  1. `~/.claude/settings.json`을 백업한다.
  2. 디자인 게이트 사본 등록을 `~/.claude/hooks/build-manager-rules-gate.mjs`(main의 스크립트 사본) 등록으로 바꾼다. 다른 hook은 그대로 둔다.
- [ ] **Step 4: 실측**
  - 개발 파일 Write 차단 → 개발 규칙 읽기 → 허용
  - `WebSearch` 차단 → 레퍼런스 규칙 읽기 → 허용
  - `echo npm install x` 차단 → 레퍼런스·개발 규칙 읽기 → 허용
  - 규칙 수정 후 다시 차단
  - 결과를 STATUS·실행 로그에 기록한다.

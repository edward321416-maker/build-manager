# Design rules v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `design/DESIGN_RULES.md` and a Claude Code hook that blocks UI edits until the rules were fully read in the session ([spec](../specs/2026-10-09-design-rules-v1-design.md)).

**Architecture:** One dependency-free Node script, `.claude/hooks/design-rules-gate.mjs`, with two modes. `record` runs after `Read` and stores the rules file hash per session in the OS temp directory. `check` runs before `Edit|Write|MultiEdit|NotebookEdit` and exits 2 when a UI file is edited without a matching record. The repository root is found by walking up from the edited path to `design/DESIGN_RULES.md`. Pointers in `AGENTS.md` and `CLAUDE.md` cover agents without hooks.

**Tech Stack:** Node 24 (`node:` built-ins only), Vitest (shared config, `tests/architecture/**`), Claude Code hooks.

## Global Constraints

- Brand colour stays `#0064FF` (operator decision 2026-10-09, option A).
- References: Toss·Daangn-family principles only; never copy another company's logo, copy, illustrations, icon or emoji fonts.
- UI files: `apps/web/src/app/**` and `apps/web/src/components/**` ending `.tsx`/`.css`, `apps/mobile/src/**/*.tsx`; `*.test.tsx`/`*.spec.tsx` excluded.
- A read counts only when `Read` had no `offset` and no `limit`.
- Unexpected errors fail open (exit 0, warning on stderr); only a confirmed unread rule exits 2.
- No secrets, emails, phone numbers or street addresses in any committed file (`scripts/verify_repository.py`).
- Run Node commands with the pinned runtime on PATH: `export PATH="/c/Users/admin/AppData/Local/build-manager-b5-runtime/node-24.21.0/node-v24.21.0-win-x64:$PATH"`.

---

### Task 1: Gate script with tests

**Files:**
- Create: `.claude/hooks/design-rules-gate.mjs`
- Test: `tests/architecture/design-rules-gate.test.ts`

**Interfaces:**
- Produces: CLI `node .claude/hooks/design-rules-gate.mjs <record|check>`, hook JSON on stdin (`session_id`, `tool_name`, `tool_input.file_path`/`notebook_path`, `tool_input.offset`, `tool_input.limit`). Exit 0 = allow, exit 2 = block with a Korean stderr message containing `design/DESIGN_RULES.md`. State: `<os.tmpdir()>/build-manager-design-rules/<session>.json` = `{ "<absolute rules path>": "<sha256 hex>" }`.

- [ ] **Step 1: Write the failing tests** (`tests/architecture/design-rules-gate.test.ts`): each test builds a temporary repository with `design/DESIGN_RULES.md` and runs the script with `spawnSync(process.execPath, [SCRIPT, mode], { input, env: { ...process.env, TMP: state, TEMP: state, TMPDIR: state }, encoding: "utf8" })`. Cases:
  1. unread rules block an `Edit` of `apps/web/src/app/core/page.tsx` (status 2, stderr mentions `design/DESIGN_RULES.md`);
  2. a full `Read` of the rules unlocks that edit (status 0);
  3. a `Read` with `limit` does not unlock;
  4. changing the rules after reading blocks again;
  5. another session is not unlocked;
  6. a `Write` of a new file in a missing folder `apps/web/src/components/new/Widget.tsx` and an edit of `apps/mobile/src/features/x.tsx` are blocked; `apps/web/src/server/x.ts`, `apps/web/src/app/core/a.test.tsx` and a `.tsx` outside any rules repository pass;
  7. malformed stdin fails open (status 0, stderr warning).
- [ ] **Step 2: Run and confirm failure** — `npx vitest run tests/architecture/design-rules-gate.test.ts`; expected: all fail because the script does not exist.
- [ ] **Step 3: Implement the script** (walk-up root finder, posix-relative UI regex, sha256 of the rules bytes, per-session JSON state, `main()` wrapped in try/catch that exits 0 on unexpected errors).
- [ ] **Step 4: Run tests until green**, then `npm run test:shared`.
- [ ] **Step 5: Commit** `feat(tooling): gate UI edits on reading the design rules`.

### Task 2: Design rules and pointers

**Files:**
- Create: `design/DESIGN_RULES.md`
- Modify: `AGENTS.md` (one paragraph), `CLAUDE.md` (one sentence)

- [ ] **Step 1: Write `design/DESIGN_RULES.md`** in Korean with these sections and values:
  - 0 적용 범위와 읽는 법 (all web/mobile/landing UI; rules beat older screens; Read the whole file before UI work; the hook enforces it in Claude Code).
  - 1 레퍼런스 원칙 (one emphasised action per screen, big plain titles, 해요체, generous space, bottom-fixed primary action on mobile; what not to borrow).
  - 2 색: page `#F2F2F7`, surface `#FFFFFF`, text `#202632`, secondary `rgba(32,38,50,.62)`, readable-muted `color-mix(in srgb, #202632 70%, #FFFFFF)`, tertiary `rgba(32,38,50,.42)` (non-essential only), border `rgba(32,38,50,.12)`, border-strong `rgba(32,38,50,.20)`, fill-subtle `.04`, fill-hover `.06`, primary `#0064FF`, primary-hover `#0056D8`, primary-soft `rgba(0,100,255,.08)`, danger `#FF3B30` (borders, icons, fills only), status pairs (text on soft fill, each ≥ 4.5:1): 긴급 `#C8231A`/`#FFF0EF`, 대기 `#9A5B00`/`#FFF3DC`, 진행 `#0056D8`/`#EEF4FF`, 완료 `#17754F`/`#E7F5EE`; blue only for action, selection and progress.
  - 3 글꼴: Pretendard → Noto Sans KR → Apple SD Gothic Neo → system-ui; web h1 25/35 700, h2 20/30 600, h3 15/25 600, body 15/25 400, label 15/20; mobile heading 24/32 700, body 16/24; landing display 32/42 700; letter-spacing normal; no Inter.
  - 4 간격·크기: 5 px scale (5, 10, 15, 20, 25, 30, 40, 50); touch targets ≥ 50 px web, ≥ 48 px native; paragraphs ≤ 75ch; forms ≤ 40rem; detail ≤ 50rem.
  - 5 모서리·깊이: 5 status labels/small, 10 buttons/inputs/tiles, 15 photos and grouped blocks, 20 sheets/dialogs; shadow only on floating layers `0 20px 50px rgba(32,38,50,.20)`; otherwise separate by tone and 1 px lines.
  - 6 레이아웃: mobile first; checks at 320, 390, 768, 1280, 1440 and 200% text; list rows over cards; one primary button per view.
  - 7 컴포넌트: buttons, inputs, choice tiles, list rows, status labels, dialogs/sheets, empty/error/loading/uncertain-save states.
  - 8 문구: 해요체, concrete, verb buttons, numbers and times explicit, banned words.
  - 9 AI 티 금지 목록 (gradients, gradient text, Inter, three icon cards, one-side thick border, uniform big radius, sparkles/AI glyphs, emoji as icons, AI/stock 3D art, fake live badges, decorative blobs, centred marketing hero with vague slogan, auto letter-spacing).
  - 10 접근성, 11 모션 (120–200 ms ease-out, no bounce/parallax, reduced motion honoured), 12 웹·앱 일관성, 13 마무리 체크리스트, 14 아직 규칙을 따르지 않는 화면 (home/demo `globals.css`, mobile `core-ui.tsx` Tailwind-like palette), 15 규칙 변경 절차.
- [ ] **Step 2: Add the pointers** to `AGENTS.md` and `CLAUDE.md`.
- [ ] **Step 3: Verify** `python scripts/verify_repository.py` (no findings, links resolve).
- [ ] **Step 4: Commit** `docs: add design rules v1`.

### Task 3: Register the gate and prove it live

**Files:**
- Create: `.claude/settings.json`
- Operator machine (not committed): `~/.claude/hooks/build-manager-design-rules-gate.mjs` copy and a matching entry in `~/.claude/settings.json`.

- [ ] **Step 1: Project hooks** in `.claude/settings.json`: `PostToolUse` matcher `Read` → `node "$CLAUDE_PROJECT_DIR/.claude/hooks/design-rules-gate.mjs" record`; `PreToolUse` matcher `Edit|Write|MultiEdit|NotebookEdit` → `... check`.
- [ ] **Step 2: User hooks** (load the `update-config` skill; merge, never overwrite existing settings) pointing to the copied script by absolute path.
- [ ] **Step 3: Live check** in a session that has the hook loaded: an `Edit` of a UI file before reading is blocked; after a full `Read` of the rules it is allowed.
- [ ] **Step 4: Commit** `feat(tooling): register the design rules gate`.

### Task 4: Verify, PR, merge

- [ ] `npm run test:shared`, `python scripts/verify_repository.py`, `python scripts/verify_repository.py --history`.
- [ ] Push `feat/design-rules-v1`, open a PR, wait for hosted checks, merge with `--match-head-commit`.

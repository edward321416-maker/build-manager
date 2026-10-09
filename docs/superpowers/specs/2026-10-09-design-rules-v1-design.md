# Design rules v1 and the read-before-design gate

Date: 2026-10-09. Base: main `f73e3c32d3fb39ade98d02d9fedfb27b01525c01`.

## Decisions

- [DECISION] 2026-10-09: the operator asked for design rules first, and for every design task to read them before starting ("우선은 디자인 규칙부터 만들고 항상 디자인을 할 때 디자인 규칙을 읽고 시작하도록 만들자").
- [DECISION] Same day: references follow current, trend-forward Korean everyday apps in the Toss·Daangn family (chosen over Linear/Notion-style work tools and 오늘의집/Airbnb-style photo-led products), and the result must look as little AI-made as possible.
- [DECISION] Same day: brand colour stays the current `/core` blue `#0064FF` (option A), chosen over a deep green and an ink-plus-status-colour option after a side-by-side mockup. The operator accepted the stated risk that the blue resembles Toss; other identity cues (voice, layout, no borrowed assets) carry the difference.
- [DECISION] Same day: enforcement is option B, written pointers plus a Claude Code hook that blocks UI edits until the rules were read in the session.

## Observed starting point

- [FACT] Three visual languages ship today: the home page and the older demo screens use the green/beige `apps/web/src/app/globals.css` palette; `/core` uses `core-design.module.css` (Apple-style light surfaces, `#0064FF`, Pretendard, a 5 px spacing scale, 50 px touch targets); the mobile app has its own primitives in `apps/mobile/src/features/core-ui.tsx`.
- [FACT] `/core` presentation was implemented on 2026-10-04 with browser checks at 320/390/768/1280/1440 px, 200% text, focus and contrast samples ([receipt](../../../ops/core_design_implementation.md)).

## Deliverables

1. `design/DESIGN_RULES.md` (Korean): reference principles and what not to borrow; colour, type, spacing, radius, elevation and motion tokens codified from `/core` plus status colours; layout and responsive rules; component rules (buttons, inputs, choice tiles, list rows, status labels, dialogs, empty/error/loading states); UX-writing rules; an explicit "AI look" ban list; accessibility floor; web/mobile parity; a finishing checklist; the list of legacy screens that do not follow the rules yet; and how the rules change.
2. Pointers: `AGENTS.md` (all agents, including Codex) and `CLAUDE.md` require reading `design/DESIGN_RULES.md` before any UI work.
3. Gate: `.claude/hooks/design-rules-gate.mjs` with `.claude/settings.json`.
   - `PostToolUse` on `Read`: when the whole rules file was read (no `offset`/`limit`), record `{sha256 of the rules file}` for that session in the OS temp directory.
   - `PreToolUse` on `Edit|Write|MultiEdit|NotebookEdit`: if the target is a UI file of a repository that contains `design/DESIGN_RULES.md` and the session has no record matching the file's current hash, exit 2 with a Korean message naming the rules path. A changed rules file therefore has to be read again.
   - UI files: `apps/web/src/app/**` and `apps/web/src/components/**` ending in `.tsx` or `.css`, and `apps/mobile/src/**/*.tsx`; `*.test.tsx` and `*.spec.tsx` are excluded.
   - The repository root is found by walking up from the edited path, so the gate works from any start directory and worktree; files outside such a repository are never blocked.
   - Unexpected internal errors fail open (exit 0 with a warning on stderr) so a broken environment cannot freeze all editing; only a confirmed unread rule blocks.
   - The same script is registered in the operator's user settings so sessions started in the outer workspace folder are covered.
4. Test: `tests/architecture/design-rules-gate.test.ts` runs the script as a child process against temporary repositories: unread blocks, full read allows, partial read does not count, changed rules re-block, non-UI and test files pass, files outside a rules repository pass, malformed input fails open.

## Out of scope

Migrating the home page, older demo screens and mobile primitives to the rules (listed in the rules as the next task), a shared design-token package, an icon set, new issue types, and automated visual linting. Edits made through shell commands are not intercepted by the gate; the written rule still applies.

## Verification

Gate tests; `python scripts/verify_repository.py` and `--history` (public tree, links, no secrets); `npm run test:shared`; a live check in this session that an unread UI edit is blocked and passes after reading.

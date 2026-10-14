# Pretendard font-family name fix, acceptance

Snapshot: **2026-10-14 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. Nothing is deployed. The demo picks this up at the next deploy, which the operator approves separately.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk (DEV-04). The glyphs on every web screen change, FROZEN screens included. No layout, API, DB or server change. |
| Operator decision | 2026-10-14, after the P5 PR 1b report: "글꼴 오류부터 고칠까요?" → "오케이". |
| Found by | PR #143 CI on Linux. Every Pretendard face stayed `unloaded`, and 우리 집 measured 87.1px against an 80px cell at 320px with text at 200%. |
| POLICY_REF | main `0514c5b` |
| Base | main `0514c5b` |
| TARGET_REF | `5b5a12f` (reviewed candidate). The PR records its final head and that head's CI. |

## The bug

- `apps/web/src/app/layout.tsx` loads Pretendard 1.3.9 from jsDelivr (`pretendardvariable-dynamic-subset.min.css`). That stylesheet declares all 92 `@font-face` rules as `font-family:'Pretendard Variable'` (checked 2026-10-14).
- `tokens.css` (`--font-sans`) and `globals.css` named only `Pretendard`.
- Result: the downloaded font never applied.
  - Devices with the static Pretendard family installed matched it locally. This development PC is one of them, which is why local captures looked right.
  - Every other device, including phones and the CI runners, fell back to the system font.

## Change

- **Font stack** in both files: `"Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif`. Plain `Pretendard` stays second, for an installed static family.
- **`layout.tsx`**: a comment notes the stylesheet's family name.
- **Design rules**:
  - §3.1 shows the new stack and says the CDN font's name is 'Pretendard Variable'.
  - A top `[DECISION]` line (2026-10-14) records the fix.
  - The file is 44,611 bytes, under the 48,000 cap.
- **Tests**:
  - `apps/web/src/app/font-stack.test.ts` checks that both stacks start with `"Pretendard Variable", Pretendard,` and match, and that the layout still loads the variable stylesheet.
  - `core-e2e/navigation.spec.ts` checks that on `/core` a "Pretendard Variable" face reaches `loaded` (polling up to 15s) and that the title's computed font starts with it.

## Verification

- **RED, then GREEN**: the unit test (3 cases) and the browser test failed before the fix and pass after it. Pretendard loaded in about 4s locally.
- **Unit and web suites**: test:web 1013/1013; web e2e 26/26; vendor e2e 18/18.
- **sdk e2e**: 36/41. The five failures are the known local fixture failures.
- **core e2e**: failed locally 12/60, then 13 on the re-run.
  - Every failure is an element-not-found wait or a 30s timeout while the shared local fixture loaded slowly. One snapshot showed the manager queue still "불러오는 중…" with 32 to-dos and a 13,750-line DOM.
  - None is a clipping, wrapping or position failure.
  - CI's fresh database is the verdict; the PR records it.
- **Design audit**: 231 screens, 0 findings, the same as before the fix.
- **Before/after captures**: same page heights and layout; the difference is in the glyph outlines. This PC has Pretendard installed, so its captures barely change; devices without it now show Pretendard instead of the system font.
- **First-visitor page `/`**: checked against session 2-b6's checklist at 320, 390, 768, 1280 and 1909px (Chromium) and 390px (WebKit), at normal and 200% text. All items hold: the hero break after the comma, the 2.5rem phone overlap from 64em, the 36rem queue container query, the tile stacking below 5rem, no sideways scroll and no cut labels.
- Review: a fresh-context review approved the fix with no Critical or Important findings. It reproduced RED on the old files, re-checked the CDN family name (92 of 92), and checked for SSR, CSP and mobile impact. Minor notes: thin timeout headroom if the CDN takes close to 15s; the font test lives in `navigation.spec.ts`.

## Rollback

Revert the PR. Pages then fall back to the system font again, as before.

## Notes

- The fix commit's trailer reads "Claude Sonnet 5", the subagent that wrote it, not the project's usual line. It was left as is rather than rewriting history.
- The shared local Core fixture now makes many core browser tests time out locally. A reset would delete data and needs the operator.

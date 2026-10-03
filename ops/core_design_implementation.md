# Core presentation implementation receipt

Date: 2026-10-04. Scope: the operator-supplied design research and implementation instructions; presentation and regression checks only.

## Authority and source

- POLICY_REF: `e9144fac807f39544932baac25b11f836658dbb3` (live main, read without changing the worktree).
- DESIGN_BASE_SHA: `c32890ec6110f90917bc8446aff9f182a28ce6d2`.
- CURRENT_BRANCH: `feat/core-flow-rc1`; existing Draft PR: [70](https://github.com/edward321416-maker/build-manager/pull/70).
- HANDOFF_OWNER: the current Codex design session is the sole writer of this presentation delta. Existing runtime records remain owned by their execution session.
- Source documents: `BUILD_MANAGER_DESIGN_RESEARCH_AND_PLAN.md` and `CODEX_ASTRA_UIUX_IMPLEMENTATION_INSTRUCTIONS.md`, supplied together by the operator. They authorize implementation without another planning/B5 review gate. They do not authorize final merge or production deployment.
- IMPLEMENTATION_HEAD: the commit containing this receipt and the named presentation/test files. No self-referential SHA is inserted by an additional documentation commit. The final local SHA is reported to the operator; the remote PR remains at the design base unless separately published.

## Implemented screens and changed paths

Web `/core` now uses a route-local navy account frame (248 CSS px at desktop), a light work surface, clear controls, compact ticket/photo rows, separate handling and intake status, and a responsive detail layout. The original list-to-detail branch remains. `/core/join` and existing invitation cards retain the six distinct states and show the existing request numbers, expiry and confirmation controls. No extra categories, dashboard totals, identity fields, navigation or functionality were added.

Presentation paths:

- `apps/web/src/app/core/core-design.module.css`
- `apps/web/src/app/core/ui/core-design-root.tsx`
- `apps/web/src/app/core/ui/work-status-badge.tsx`
- `apps/web/src/app/core/core-screen.tsx`
- `apps/web/src/app/core/page.tsx`
- `apps/web/src/app/core/onboarding-panel.tsx`
- `apps/web/src/app/core/join/join-screen.tsx`
- `apps/web/src/app/core/join/page.tsx`
- `apps/mobile/src/features/core-ui.tsx`
- `apps/mobile/src/app/core.tsx`

Tests:

- `apps/web/tests/core-e2e/design.spec.ts`
- `apps/web/tests/core-login-e2e/design.spec.ts`
- `apps/mobile/src/features/core-design.test.tsx`

Records: this receipt and additive design events in `AI_Execution_Log.csv` / `pending_external_sync.md`. Pre-existing and concurrently appended runtime records are preserved and are not part of the presentation commit.

Native source uses core-local scroll/text/button/header/status primitives. Existing roles, selection states, disabled/onPress behavior, long labels and text scaling remain. Native Auth0, invitations and upload are not added. Shared native `components/ui.tsx` and the existing protocol children remain unchanged.

## Behavior and protected boundaries

PROTECTED_PATH_DELTA: **0** for server/API, contracts/client/application/persistence, migrations, scripts, manifests/lockfiles/workflows, provider/session/config, global CSS and shared native UI. The login controller and photo component are also unchanged. This comparison is against DESIGN_BASE_SHA, not the feature PR's cumulative changes against main.

An AST comparison of five integration controllers preserves 307 state/request/control calls and 146 behavioral/identity attributes (callbacks, keys, disabled, labels and input constraints). Native `work-status` moves into the pure badge and is covered by component/flow tests. This static comparison complements, and does not replace, runtime regression.

The real protocol endpoints establish `PARTIAL`, then the manager records `COMPLETED`. The UI displays both “처리 완료 (관리자 기록)” and “접수·검토 상태: 정보 부족”. No status is fabricated in a response or converted to another domain state.

Browser checks preserve saved photos and partial upload recovery, no automatic duplicate CREATE/POST, pending-photo navigation guards, tenant/manager separation, scope changes and denied-session clearing, invitation request/approval/rejection/revocation/expiry, one-time clipboard recovery, uncertain-write reconciliation and existing pagination controls.

CURRENT_SOURCE_DRIFT_HANDLED: the original five dirty runtime-record paths were fingerprinted before editing. The runtime session added further documentation while design ran; those additions were preserved. Integration source callbacks were compared to the fixed base. Neither source reset nor stash, new Git worktree, clone, rebase or merge was used.

## Execution environment and actual captures

Node 24.21.0 / npm 11.19.0 were selected in the command-local PATH from the existing isolated installation. No installation, dependency, global configuration or original test configuration changed.

Existing localhost3100 and localhost3133 servers and their browser sessions were preserved. Build/browser execution used a private, byte-compared source snapshot of the same implementation, with existing installed dependencies. The snapshot is an execution artifact, not another Git worktree or implementation branch. Its only execution adaptations were:

1. A private Next configuration supplies the common Turbopack filesystem root so existing installed dependencies can be resolved through junctions. The source checkout's Next configuration is unchanged.
2. The private synthetic login launcher, Playwright base URL and session helper use localhost3135 instead of occupied3133. Test assertions, retries, timeout and discovery are otherwise retained.
3. The original development-code sessions returned401 because their55-minute lifetime had elapsed. A separate synthetic fixture and private state/code files were created for the core suite. The original identities, access codes and state files were not renewed or overwritten. Test-fixture data is not product placeholder content.

Core and login browser suites ran sequentially against a production build. The demo and fixed B1 suites reuse that verified private build through their existing `BUILD_MANAGER_E2E_PREBUILT` option.

Actual browser captures cover 320×844,390×844,768×1024,1280×900 and1440×900: tenant form/draft, manager detail, tenant completed record, zero-association guidance, join guidance and photo dialog. Additional existing onboarding cases capture requested/approved/re-entry screens. All captures are private synthetic SDK/development data; no actual Auth0 identity, cookie or invitation token is published.

The design checks exercise unchanged DOM input identity and selected File preview across widths,200% root text scaling,320 CSS px reflow, Tab/Shift+Tab and visible focus, Escape/dialog focus return, and rendered primary-button/completed-badge/join-guidance contrast. Visual review found the navy-header text selector also reached the light join header; that selector was narrowed, the build rerun and all18 login/onboarding cases passed again. A320 CSS px viewport is the reflow condition associated with1280/400%; it is not a claim that browser zoom automation ran. Contrast samples are not a complete WCAG audit.

## Local checks

| Check | Result and evidence scope |
| --- | --- |
| `npm run test:web` | PASS:487 tests,42 files; final presentation source |
| `npm run test:mobile` with fresh private Jest cache | PASS:142 tests,16 suites; source/component execution, not native startup |
| `npm run test:shared` | PASS:438 tests,36 files; unchanged shared source in private snapshot |
| `npm run lint` | PASS,0 errors; one pre-existing unused-import warning in landlord Mobile test retained |
| `npm run typecheck` | PASS:packages/tests/Web/Mobile |
| `npm run build:web` | PASS:production Turbopack build in private snapshot, with the disclosed filesystem-root setting |
| `npm run check:deps` | PASS; existing installation reused |
| `npm run verify` | Initial aggregate reached and passed shared/lint/typecheck, then failed on a cross-volume dependency junction in the first snapshot. The corrected private build and dependency check passed separately. No claim of an unmodified in-place aggregate run |
| Core browser | PASS:12 cases, including new reflow/File/focus/dialog case |
| Login/onboarding browser | PASS:18 cases, including2 new design cases; private port3135 |
| `npm run test:postgres` | PASS:330 tests,32 files,439.26s; original worktree harness |
| `npm run test:e2e:web` | PASS:23 cases; original demo routes remain functional |
| `npm run test:e2e:b1` | PASS:60 cases; unchanged fixed B1 case inventory |
| Whitespace/public index/history | `git diff --cached --check` PASS; history scan:569 files,280 internal links,1444 historical blobs,0 findings. Final index recheck after the join-contrast/test refinements:569 files,280 internal links,0 findings,PASS |

Failed setup/diagnostic attempts remain in private logs: initial npm invocation from the evidence directory (no package manifest), unsupported cross-volume Turbopack junction, abandoned private dependency materialization, private helper import-shape corrections, expired original development codes, and two new assertion-timing mistakes. The focus check was corrected to assert after actual keyboard traversal; the contrast check polls the existing short color transition. No existing test expectation, skip, timeout or retry was weakened. Final successful executions are identified separately above.

## Delivery limits

- LIVE_AUTH0 / EXPO_NATIVE / USER_STUDY: **NOT_RUN_THIS_TASK**. Existing runtime receipts retain their own evidence; this task neither revalidates nor reverses them.
- Existing AC-D06 and earlier Mobile/B5 dispositions are unchanged. Passing current component tests does not erase historical failures or authorize an Expo startup retry.
- EXACT_HEAD_CI: **NOT_RUN** for this local design delta. The nine hosted checks at the remote feature base are historical and are not relabeled as design CI.
- EXTERNAL_SYNC: **EXECUTION_LOG_SYNCED**. Native Google Sheets appended the current design checkpoint summaries to existing `AI_Execution_Log!A216:D217`; a separate CellData read matched all8 values exactly. Existing row formatting was preserved and no validation/chips/formulas were changed. This is API metadata/value verification, not native spreadsheet visual inspection. No new plugin/schema was downloaded or uploaded. The earlier local pending entries remain as historical checkpoints; their current design events are reconciled by the later sync receipt. Older backlog and the other session's rolling handoff remain unchanged.
- READY / MERGE / DEPLOY: **NOT_PERFORMED**. No source push or PR mutation is included in this local implementation task. Existing3100/3133 continue their prior builds; the new design was verified in the separate private execution environment.

Implementation disposition: **DESIGN_IMPLEMENTED_WITH_DECLARED_LIMITS** for the tested Web presentation and native source/component scope. This is not native-device, real-provider, whole-product acceptance or release approval.

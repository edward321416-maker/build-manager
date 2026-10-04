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

## Second-pass integration receipt — 2026-10-04

This section records fresh Web second-pass evidence. The first-pass checks above are historical and are not reused as second-pass verification.

- Design ancestor retained: `2c84291e9f06d506b1312ef8119f9155af91e986`.
- Feature baseline retained: `7370dc4097e7cd73277eb93bff9664272e35496c` (Manager Work Queue).
- Authority: the operator's `CODEX_ASTRA_UIUX_SECOND_PASS_RESUME_AFTER_MANAGER_QUEUE.md` and its explicit integration/resource handoff. The earlier HOLD ended at that handoff.
- Validation identity: the presentation and test blobs in the commit containing this receipt. A private post-commit manifest compares those blobs with the tested source snapshot, normalizing only Git CRLF/LF checkout conversion.

### Applied presentation and preserved behavior

The prepared `core-display.tsx`, its tests and the prepared CSS delta were reused. The queue presents priority, building/unit and issue, work state, assignee, due/overdue and short ID; completed rows retain their actions with quieter styling. The native filters, pending-first comparator, minute refresh, request callbacks and persisted metadata remain unchanged.

Desktop detail places photos beside the existing work-information, internal-note and handling controls; history remains below. Narrow screens stack these sections. The native file input covers its visible label surface with opacity rather than a one-pixel clipped control; its accept/multiple/disabled attributes, onChange body, File objects, upload IDs, preview/remove/save and pending-navigation rules remain. Work and intake states remain independent, including COMPLETED/PARTIAL.

Loaded REQUESTED invitation cards appear before creation without changing each subset's server order or pagination. Complete request references and actual timestamps remain visible. Join guidance precedes secondary metadata. The header retains a visible synthetic-environment badge and moves lengthy limitations into disclosure. Navy account controls now receive the intended light keyboard-focus outline.

Static AST comparison against the feature baseline preserves all52 event-handler attributes and78 React hook calls across core screen, manager work, onboarding, join and photos. This complements fresh browser evidence rather than replacing it. Backend/API, DTO/client/persistence, migrations001–015, auth/session/provider/config, manifests/lockfile/scripts/workflows, Mobile, global CSS, login controller and work-order comparator have no task delta. No generated product data or unsupported function was added.

Exact changed paths:

- `apps/web/src/app/core/ui/core-display.tsx`
- `apps/web/src/app/core/ui/core-display.test.tsx`
- `apps/web/src/app/core/core-design.module.css`
- `apps/web/src/app/core/core-screen.tsx`
- `apps/web/src/app/core/manager-work.tsx`
- `apps/web/src/app/core/manager-work.module.css`
- `apps/web/src/app/core/onboarding-panel.tsx`
- `apps/web/src/app/core/join/join-screen.tsx`
- `apps/web/src/components/core-photos.tsx`
- `apps/web/tests/core-e2e/design.spec.ts`
- `apps/web/tests/core-e2e/manager-work.spec.ts`
- `apps/web/tests/core-login-e2e/design.spec.ts`
- `apps/web/tests/core-login-e2e/onboarding.spec.ts`
- `ops/core_design_implementation.md`

The extra `onboarding.spec.ts` change is the small presentation-test correction permitted by resume instruction section18: wait until the existing refresh button is enabled before confirming the request. The prior helper could check an old card while its in-flight refresh subsequently cleared confirmation. Product `load()` and approval callbacks are unchanged; no functional assertion, retry or timeout was weakened. The new design test also verifies that refresh clears confirmation and uses a distinct synthetic unit label per execution.

### Fresh local verification

Evidence root: private `design-second-pass-20261004/resume/` beneath `.build-manager-rc1-private`.

| Gate | Final result | Private log |
| --- | --- | --- |
| Focused display and queue-order tests |7 passed,2 files; `npm exec --workspace @build-manager/web -- vitest run --config vitest.config.ts src/app/core/ui/core-display.test.tsx src/app/core/manager-work-order.test.ts` |`focused-final.log` |
| `npm run test:web` |498 passed,45 files |`test-web-attempt4.log` |
| `npm run lint` |0 errors;6 pre-existing warnings retained |`lint-attempt6.log` |
| `npm run typecheck` |PASS, repo gate |`typecheck-attempt6.log` |
| `npm run build:web` |PASS, final product CSS/TSX |`build-web-attempt4.log` |
| `npm run check:deps` |PASS, unchanged installed dependency tree |`check-deps.log` |
| Core Playwright |13 passed,22.0s; original functional inventory retained |`core-browser-attempt4.log` |
| B1 SDK Playwright |20 passed,35.8s; existing19 plus invitation-presentation case |`login-browser-attempt3.log` |
| Same-record actual capture and keyboard checks |PASS; queue Tab/Shift+Tab/Enter, action controls and light/navy focus |`after-capture-attempt7.log` |
| Settled390px queue capture |PASS; all6 synthetic records loaded before capture |`mobile-capture-final-attempt2.log` |

Browser coverage preserves queue filters/order/open, metadata save/stale recovery, internal notes, tenant privacy, stored photos, handling start/completion, invitation approval/rejection/revocation/expiry, uncertain-write recovery, exact CSRF/Origin and organization separation. Responsive checks cover320/390/768/1280/1440 CSS px,200% root text scaling, draft/File identity, keyboard Space and label file selection, dialog Escape/focus return and visible focus. This is not a full WCAG conformance claim.

The original3130 listener (PID19588 at verification) and its `.next/BUILD_ID` were preserved. Validation used a private snapshot of the feature baseline plus the reviewed presentation files, existing installed dependencies and Node24.21.0. The only private build setting adds a common Turbopack filesystem root for dependency junctions. The existing module-resolution hook was supplied through process-local NODE_OPTIONS. Existing core3131 and synthetic-SDK3133 Playwright launchers ran sequentially with independent private synthetic fixtures; original credentials, state and real identities were not renewed or replaced. Captures use another independent fixture so regression mutations cannot change comparison records.

Failed attempts remain recorded separately: initial private module-resolution setup failure; an early separate-profile preparation failure with no confirmed diagnostic cause; capture setup expecting200 instead of the existing201 note-create response; one-pixel native-input target failure; a new Enter-only chooser assertion timeout (the final native keyboard assertion uses Space after bounded native diagnostics); reuse of a deliberately revoked synthetic code before renewal; a repeated synthetic unit-label collision; refresh/confirmation test timing; and the navy focus-specificity defect. Corrections are explicit; earlier green runs are not substituted for the final executions. Synthetic-provider discovery/Fontconfig/tooling warnings remain in logs. A mobile capture caught the existing queue refresh loading state; that candidate and initial ZIP were preserved privately, and the delivered mobile image waits for all records. A private capture grep typo also remains logged.

### Capture delivery and limits

The share directory is `%USERPROFILE%/.build-manager-rc1-private/design-second-pass-after/`. Seven current PNGs and seven baseline PNGs under `before-7370dc4/` show the same persisted synthetic ticket/photo/invitation records. The `build-manager-uiux-second-pass.zip` allowlist contains only those14 PNGs, separated into before/after directories. Every source capture is preserved. Private hash receipts verify copied PNGs and ZIP inventory. Visual review found synthetic building/unit labels and verification photos only; no real identity, credential, cookie, code or raw invitation token required redaction. No generated-image tool was used.

The other session's five dirty runtime documents were byte-preserved and excluded from staging: STATUS, CHAT_HANDOFF, onboarding runbook, execution CSV and pending-sync record. This owned receipt carries the design checkpoint; external Google synchronization was not run or claimed for this pass.

Local disposition: **UI_SECOND_PASS_LOCAL_VERIFIED**. Actual Auth0 manager, Expo/native/device and hosted CI are **NOT_RUN_THIS_PASS**. No source push is included; hosted feature-base checks are not attributed to this design change. AC-D06 is unchanged. No Ready transition, merge or deployment is included. The original running server continues its earlier build; the new UI was verified in the isolated production build.

CHECKPOINT | UI second pass integration | evidence=containing commit + fresh local tests + private capture package | tokens=unknown

## Apple-Toss local redesign receipt — 2026-10-04

Disposition: **APPLE_TOSS_UI_LOCAL_VERIFIED**, limited to the frozen Web candidate described below. Earlier first-pass and second-pass evidence remains historical and is not reused as verification of this change.

- Authority: `CODEX_ASTRA_APPLE_TOSS_UI_REDESIGN_OPERATOR_AUTHORIZED.md`, with the operator's explicit transfer of overlapping UI writer ownership. No further feature-session handoff was required.
- Policy reference: `e9144fac807f39544932baac25b11f836658dbb3`.
- Feature base and observed remote Draft PR70 HEAD: `5032e9b3d080cfcfe4148819f5138e47679298e0` (public Q&A / next-action v1 included).
- First-pass ancestor `2c84291e9f06d506b1312ef8119f9155af91e986` and Manager Work Queue ancestor `7370dc4097e7cd73277eb93bff9664272e35496c` remain in history. No reset or history rewrite occurred.
- Candidate identity: the commit containing this receipt. A private post-commit receipt compares its24 Web blobs against the tested isolated source, normalizing only CRLF/LF checkout conversion.

### Applied design system and screens

Official sources consulted were [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views), [Apple lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Apple branding](https://developer.apple.com/design/human-interface-guidelines/branding), [Toss brand](https://brand.toss.im), [Toss design system accessibility](https://toss.tech/article/toss-design-system), and [Toss semantic color guidance](https://toss.tech/article/43385). Reference assets stayed in private research storage and were not copied into the product.

The main application uses a light250px sidebar, white content panes, separators and compact queue rows. At1280px and above the queue remains beside the selected detail; narrow layouts retain the existing back navigation. The action column becomes separate only when enough width exists. Ordinary rows have no decorative shadow or nested cards. Ticket IDs move into detail disclosure while complete invitation confirmation numbers remain visible and selectable.

The base palette is exactly `#F2F2F7`, `#FFFFFF`, `#202632`, `#0064FF`, and `#FF3B30`. Blue denotes primary actions, selection/focus and active progress; red denotes urgent/overdue or destructive actions. Completion uses a neutral check and text rather than a colored pill. The prescribed62% secondary text blend measured about4.40:1 on white; displayed small secondary text instead uses a70% blend of the same text/surface colors, without adding another hue. Final contrast checks use composited rendered colors.

Visible text uses15/20/25/30px equivalents in rem, with20/25/30/35/40px line heights; spacing uses5px increments, radii5/10/15px and ordinary action controls50px. One-pixel borders remain the explicit exception. Visible text and line-height checks passed across the sampled final screens. Long content can increase row height rather than clip or shrink text.

Seven required screens were redesigned: desktop manager queue, manager detail,390px manager queue,390px tenant intake, tenant ticket/photos, invitation request and manager approval. Public Q&A also received the same surfaces, typography and restrained primary-action emphasis. Development disclosure moves to the footer; account/scope controls stay available. Photos retain the real native file input under the visible action. Request confirmations emphasize the result and next action before technical metadata.

### Function preservation

- Manager queue: existing pending-first ordering, filters, timer, overdue calculation, metadata save and stale handling remain. The persistent split view refreshes queue state on selection/version/back, preserving the prior remount refresh behavior.
- Tenant: existing intake/protocol questions, status axes, draft recovery, processing history and new-ticket path remain. COMPLETED/PARTIAL still coexist independently; the completion explanation still states that it is a manager record.
- Photos: accept/multiple/disabled/onChange, File identity, previews/removal, limits, upload identifiers, pending navigation, saved-photo checks, failure/uncertain-write recovery and dialog keyboard behavior remain.
- Onboarding: exact full request references, direct-confirmation checkbox, expiry, approval/rejection/revocation, unknown-outcome recovery and raw-token protections remain.
- Privacy and communication: private notes stay manager-only; public Q&A intents, version guard, waiting state, session/organization boundaries, CSRF/Origin, recovery and read-only completion behavior remain.

AST comparison against5032e9b preserved70 existing event-handler attributes and106 React hook calls across seven integration components, after explicitly normalizing Korean presentation-copy substitutions. One navigation handler opens the existing onboarding disclosure. This is supporting static evidence, not a claim of byte-identical presentation callbacks or a replacement for browser tests.

No backend/API/client/DTO/persistence/migration/auth/session/provider/config/global CSS/Mobile/manifests/lockfile/workflow/script change is part of this design commit. Another feature session began ticket-outcome work during validation; its foreign dirty and untracked files were excluded from the candidate and staging. Its new functionality is not included in this receipt's success claims.

### Exact changed paths

- `apps/web/src/app/core/core-design.module.css`
- `apps/web/src/app/core/core-screen.tsx`
- `apps/web/src/app/core/join/join-screen.tsx`
- `apps/web/src/app/core/login-screen.tsx`
- `apps/web/src/app/core/manager-work.module.css`
- `apps/web/src/app/core/manager-work.tsx`
- `apps/web/src/app/core/onboarding-panel.tsx`
- `apps/web/src/app/core/ticket-communication.module.css`
- `apps/web/src/app/core/ticket-communication.tsx`
- `apps/web/src/app/core/ui/core-display.test.tsx`
- `apps/web/src/app/core/ui/core-display.tsx`
- `apps/web/src/app/core/ui/work-status-badge.tsx`
- `apps/web/src/components/core-photos.tsx`
- `apps/web/tests/core-e2e/core.spec.ts`
- `apps/web/tests/core-e2e/design.spec.ts`
- `apps/web/tests/core-e2e/manager-work.spec.ts`
- `apps/web/tests/core-e2e/photos.spec.ts`
- `apps/web/tests/core-e2e/ticket-communication.spec.ts`
- `apps/web/tests/core-e2e/usability.spec.ts`
- `apps/web/tests/core-login-e2e/design.spec.ts`
- `apps/web/tests/core-login-e2e/login.spec.ts`
- `apps/web/tests/core-login-e2e/manager-work.spec.ts`
- `apps/web/tests/core-login-e2e/onboarding.spec.ts`
- `apps/web/tests/core-login-e2e/ticket-communication.spec.ts`
- `ops/core_design_implementation.md`

### Fresh verification of the final candidate

Evidence root: private `apple-toss-20261004/` beneath `.build-manager-rc1-private`. All final gates below use Node24.21.0 and a private5032e9b archive plus the24 reviewed Web paths. Internal workspace packages resolve into that frozen archive; only installed third-party dependencies use junctions. The private Turbopack root setting accommodates those junctions; product configuration is unchanged.

| Gate | Final result | Private log |
| --- | --- | --- |
| Focused display presentation tests |5 passed,1 file |`focused-presentation.log` |
| `npm run test:web` |510 passed,48 files |`test-web-attempt4.log` |
| `npm run lint` |0 errors;6 pre-existing warnings retained |`lint-attempt4.log` |
| `npm run typecheck` |PASS |`typecheck-attempt5.log` |
| `npm run build:web` |PASS, final product source |`build-web-attempt7.log` |
| `npm run check:deps` |PASS |`check-deps-attempt2.log` |
| Core Playwright |18 passed,28.2s |`core-browser-attempt3.log` |
| B1 SDK Playwright |22 passed,34.3s |`login-browser-attempt4.log` |
| Final actual browser capture and visual audit |PASS |`after-capture-attempt5.log`, `after-final/visual-audit.json` |
| Static callback/hook preservation |PASS,70 handlers and106 hooks |`contract-preservation.json` |

Browser tests preserve the existing behavioral assertions; presentation locators were migrated to accessible names, semantic regions and stable ticket attributes. The SDK Q&A assertion now waits for a persisted message list item, avoiding a false match on text still inside the composer. The same version2/waiting-manager/message-count assertions remain. No retry, timeout increase or skip was added.

Responsive/keyboard checks cover320/390/768/1280/1440 CSS pixels,200% root text, long Korean text, draft/File identity, queue Enter, visible focus, native photo Space/label activation, dialog Escape/focus return and invitation checkbox gates. The final capture audit adds18 screen/viewport cases with no horizontal overflow; visible font and line-height checks found no out-of-grid values. Contrast assertions cover selected final rendered controls and text; this is not full WCAG conformance.

Playwright used independent synthetic profiles and its existing3131 core /3133 SDK launchers sequentially. The original3130 process (PID55228 at verification), its build identifier and original runtime profile were preserved. No server restart or browser action targeted3130. Captures and regression use separate synthetic fixtures so test mutations cannot change the comparison records.

Earlier failed attempts are preserved in private logs and are not presented as final evidence. An initially shared internal-package junction picked up another session's `CoreScope.outcome` delta; the final environment freezes all internal packages. Other corrected attempts include presentation locators/layout oracles, a CSS decorative pseudo-element that altered an approval button's accessible name, the pre-existing Q&A composer/persistence race, and a private capture helper accidentally making a new invitee identity. The final capture preserves the original invitee session. Fontconfig, tooling and intentionally unreachable synthetic-provider discovery diagnostics remain in logs; the final suites passed.

### Actual captures and delivery

The share directory is `%USERPROFILE%/.build-manager-rc1-private/apple-toss-design-review/`. Root PNGs are the final candidate; `before-5032e9b/` contains seven newly captured baseline PNGs from the feature base. The same persisted synthetic ticket/photo/invitation records were used. The after set additionally records a real synthetic Q&A question through the existing API, so the conversation content is intentionally richer than the empty baseline.

1. `01-manager-queue-desktop-1440.png`
2. `02-manager-detail-desktop.png`
3. `03-manager-queue-mobile-390.png`
4. `04-tenant-intake-mobile-390.png`
5. `05-tenant-ticket-photo-mobile-390.png`
6. `06-tenant-invitation-request-390.png`
7. `07-manager-invitation-approval-desktop.png`
8. `08-ticket-public-qa-mobile-or-desktop.png` (390px viewport,350px conversation-region crop)

`build-manager-apple-toss-ui.zip` includes exactly15 PNGs (8 after +7 before), with no logs, credentials, profile/state, source, env or database files. All15 images were visually inspected: synthetic names, confirmation references and verification photos only; no real contact data, secrets, codes or raw invitation tokens required redaction. A private package receipt verifies every copied/archived PNG by SHA256. Original captures remain unchanged. No image-generation tool was used. Direct file attachment is unavailable in this environment; local links and absolute paths are the delivery mechanism.

### Preservation and limits

The operator-protected five dirty paths remain byte-identical to the task baseline and excluded from staging: `STATUS.md`, `ops/AI_Execution_Log.csv`, `ops/CHAT_HANDOFF.md`, `ops/core_flow_rc1_onboarding.md`, and `ops/pending_external_sync.md`. This owned receipt carries the checkpoint rather than modifying those mixed-author runtime records. External Google synchronization is **NOT_RUN / PENDING** for this pass.

Actual Auth0 provider login and real manager/tenant accounts, Expo/native/device behavior and hosted CI are **NOT_RUN_THIS_PASS**. AC-D06 remains **NOT_VERIFIED**, unchanged by presentation work. The running3130 still serves its previous build; the redesign was validated in the separate isolated production build. Foreign in-progress ticket-outcome changes are outside this frozen candidate's verification. Existing lint warnings remain. Source push, PR Ready, merge and deployment are **NOT_PERFORMED**.

CHECKPOINT | Apple-Toss UI redesign | evidence=containing commit + fresh local tests + actual before/after capture package | tokens=unknown

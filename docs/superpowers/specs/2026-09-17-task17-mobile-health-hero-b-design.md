# Task 17 Mobile Health + Cross-platform Hero B — Design

Status: **REVIEWED DRAFT — Task 17 scope confirmed; full written design pending operator approval; implementation not started**
Date: 2026-09-17

## Authority and baselines

- Repository: `edward321416-maker/build-manager`
- Current policy ref: `main@9e1a9ba1320bc45c62a704decf415688286fdc0b`
- Product/code TARGET_REF: `feat/building-aware-mvp@9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d`
- Task 16 status: `ACCEPTED_WITH_EXECUTOR_RUNTIME_EVIDENCE / TASK 16 PRODUCT FROZEN`
- Canonical product behavior: `product/05_product_spec_v3_web_mobile_REAUDITED.md`
- Canonical historical implementation plan: `docs/superpowers/plans/2026-09-14-building-aware-web-mobile-mvp.md`
- Task 17 re-sequences the old plan's `Task 18: Cross-platform Contract Parity and Hero Scenarios` plus `Task 19: Mobile Health / Bundle Gates Without EAS` into one current milestone.

Task 16's accepted remote feature ref is the only product baseline for this work. A stale local `feat/building-aware-mvp` pointer must not be treated as authoritative without a fresh remote preflight.

## Goal

Prove, without adding product behavior, that the completed Web Tenant and App Landlord participate in one authoritative Building-Aware workflow and that the Expo Mobile app passes the remaining P0 health/bundle gates.

Task 17 has two coupled outputs:

1. **Cross-platform Hero B composite proof**
   - Web Tenant creates and completes a Building B HEATING request through the real Web UI and authoritative API.
   - The resulting landlord projection is verified as a complete, reviewable `LandlordTicketDetailDto` whose recommended route is `MANAGEMENT_OFFICE`.
   - App Landlord is separately proven to render that same contract meaning and submit the human approval through the shared `ApiClient`.
2. **Fresh Mobile Health proof**
   - dependency tree review;
   - Expo Doctor;
   - fresh Android export;
   - fresh iOS export;
   - generated export output stays outside Git.

This is a verification milestone, not a feature milestone.

## Design principles

1. **Frozen product behavior stays frozen.** Web Tenant, Mobile Tenant, Mobile Landlord, server/domain/application, contracts, fixtures, and API client are read-only unless a newly reproduced BLOCKER/HIGH directly proves the approved P0 flow is broken.
2. **Composite cross-platform evidence is intentional.** One runner does not need to automate Web and native simultaneously. Web Playwright proves the Web Tenant + real API half; Mobile Jest/RNTL proves the App Landlord rendering/action half; the shared public DTO/API contract is the boundary between them.
3. **Do not overclaim a single runtime ticket crossing runners.** Hero B proves contract and scenario parity, not one browser-created ticket being physically opened in a native emulator during the same automated test.
4. **Health gates are fresh.** Task 16's Android export result is prior evidence only and cannot satisfy Task 17. Android and iOS exports are rerun from the Task 17 tree.
5. **Health diagnostics do not auto-upgrade dependencies.** Expo Doctor findings are evidence. Do not run `expo install --fix`, change versions, or add dependencies merely to make the gate green without a separately justified fix.
6. **Bundle export is not native app-store build evidence.** `expo export` proves production JS/assets bundling for the selected platform. It does not prove Xcode/Gradle native compilation, signing, simulator/device execution, EAS, App Store, or Play Store readiness.
7. **No external account requirement.** EAS, Apple developer account, Google Play account, OAuth, and paid services remain outside this task.

## Canonical Hero B scenario

Hero B is fixed as:

```text
Web Tenant
→ Building B (`demo-building-b`)
→ HEATING
→ raw report: ordinary non-safety heating complaint
→ authoritative shared-heating intake
→ required synthetic evidence
→ finalize
→ READY_FOR_REVIEW + COMPLETE
→ landlord API projection
→ recommendation = MANAGEMENT_OFFICE
→ App Landlord contract rendering
→ approve recommendation
→ returned status = APPROVED
```

Building B is currently the synthetic office-managed/shared-heating building. The committed HEATING routing rule uses verified `heatingType=CENTRAL_SHARED` plus `managementMode=MANAGEMENT_OFFICE` and recommends `MANAGEMENT_OFFICE`.

### Web Tenant half

A new Web Playwright test drives the existing tenant UI rather than injecting the final ticket state directly.

Required proof:

- reset DEMO state through the existing reset endpoint;
- open `/demo/tenant`;
- choose Building B using the existing building control;
- choose HEATING;
- submit an ordinary non-safety report such as `난방이 안 돼요`;
- answer all four safety questions `no`;
- complete the returned shared-heating questions without inventing question IDs in product code;
- submit the server-returned `FIXTURE_VIEW` synthetic evidence through the existing UI control;
- finalize through the existing tenant UI;
- assert tenant state is `READY_FOR_REVIEW` and evidence state is `COMPLETE`;
- obtain the `ticketId` from the resulting tenant URL;
- read `/api/v1/tickets/{ticketId}?view=landlord` through Playwright's request context;
- assert the landlord projection parses/behaves as the public landlord contract and contains:
  - Building B identity;
  - `issueType = HEATING`;
  - `status = READY_FOR_REVIEW`;
  - `evidenceStatus = COMPLETE`;
  - non-null Repair Packet;
  - `safetyEscalated = false`;
  - recommendation `routeCode = MANAGEMENT_OFFICE`;
  - non-empty recommendation reasons;
  - provenance reflecting server-returned routing context.

The test must not open Web Landlord to stand in for App Landlord; the next proof layer belongs to Mobile.

### App Landlord half

A new Mobile RNTL integration test targets the existing `TicketReview` component/API-client boundary using a typed Hero B `LandlordTicketDetailDto` fixture whose relevant semantics match the Web/API proof above.

Required proof:

- `getLandlordTicket(heroBTicketId)` returns a contract-valid Building B HEATING landlord DTO with `READY_FOR_REVIEW`, `COMPLETE`, and recommendation `MANAGEMENT_OFFICE`;
- the App Landlord screen renders the management-office recommendation, reasons, provenance, and review-ready state;
- the recommended `MANAGEMENT_OFFICE` route is not presented as a manual override choice;
- pressing approve calls `approveRoute(heroBTicketId)` exactly once;
- the returned `APPROVED` landlord DTO replaces the displayed state;
- no hidden compact-packet fields are surfaced.

This test reuses the actual Task 16 `TicketReview` component. It does not add a second implementation or a Hero-B-specific product branch.

### Meaning of cross-platform proof

Task 17 may claim:

> Web Tenant and App Landlord are verified against the same public landlord contract and authoritative server routing semantics for the Building B HEATING Hero B scenario.

Task 17 may not claim:

- a native emulator consumed the exact browser-created ticket in the same automated session;
- real users completed the flow;
- production authentication/authorization was tested;
- app-store deployment or real device behavior was tested.

## Mobile Health design

The health gate runs against the same Task 17 candidate tree after Hero B tests are green.

### Dependency tree

From repository root:

```text
npm ls react
npm ls react-dom
npm ls react-native
npm ls expo
```

Expected contract remains:

- React 19.2.3 aligned;
- Expo SDK 57 line;
- React Native 0.86.x compatible with the committed Expo SDK;
- no incompatible duplicate native-module tree introduced by Task 17.

### Expo Doctor

Run from `apps/mobile` using the current official Expo Doctor command selected in the implementation plan. The plan must record the exact command and resolved tool/version evidence.

Acceptance semantics:

- command exits successfully;
- no failed Doctor check is silently ignored;
- any compatibility/config finding is reviewed and reported;
- no automatic dependency upgrade/fix is authorized merely because Doctor suggests one.

Current official Expo documentation describes Expo Doctor as checking app config, package/dependency compatibility, React Native Directory compatibility, and project health. Official references checked during design:

- `https://docs.expo.dev/develop/tools/`
- `https://docs.expo.dev/guides/new-architecture/`

### Android and iOS export

Run fresh from `apps/mobile`:

```text
npx expo export --platform android --output-dir .expo-export-android
npx expo export --platform ios --output-dir .expo-export-ios
```

Current official Expo CLI documentation states `expo export` bundles application JavaScript/assets for production environments and supports `ios`, `android`, or `all` via `--platform` plus a configurable `--output-dir`.

Required evidence for each platform:

- command exit code;
- output directory created and non-empty;
- generated bundle/assets correspond to the Task 17 tree;
- output is not staged or committed;
- output directory is removed after evidence capture if the executor does not need to retain it locally.

No Xcode signing, native `.app`, APK/AAB, simulator, device, or EAS conclusion may be inferred from export success.

## Export-ignore correction

Task 16 established that `.expo-export-android` was not actually ignored even though the old v3 plan assumed generated export directories were ignored.

Task 17 is the approved scope to close that LOW operational gap.

Modify only `apps/mobile/.gitignore` to add explicit local generated-output patterns for:

```text
/.expo-export-android/
/.expo-export-ios/
```

The implementation must verify the rules with `git check-ignore` against representative paths before or during export. Do not broaden the ignore pattern to unrelated files.

## File boundaries

### Expected Task 17 working set

Create/modify primarily:

```text
apps/web/tests/e2e/cross-platform-hero-b.spec.ts
apps/mobile/src/testing/cross-platform-hero-b.test.tsx
apps/mobile/.gitignore
```

The implementation plan may choose a tests-only helper under existing Web E2E or Mobile testing directories if duplication would otherwise make the Hero B scenario ambiguous. Any helper must remain test-only and must not become a new product/shared-package API.

### Frozen / prohibited by default

```text
apps/web/src/**
apps/mobile/src/features/tenant/**
apps/mobile/src/app/tenant/**
apps/mobile/src/features/landlord/**
apps/mobile/src/app/landlord/**
packages/domain/**
packages/application/**
packages/fixtures/**
packages/api-contracts/**
packages/api-client/**
package.json
package-lock.json
apps/mobile/package.json
apps/mobile/app.json
.github/workflows/**
```

A newly reproduced BLOCKER/HIGH may stop Task 17 and justify a separate reopening decision. It does not silently authorize fixing frozen product code inside this verification milestone.

No new dependency is expected or approved.

## Test and verification strategy

Task 17 implementation follows TDD for new verification behavior.

### Hero B Web test

The new Playwright scenario should first fail because the dedicated Hero B proof does not exist, not because production code is intentionally broken. Existing helpers may be copied or factored only inside the Web E2E test area.

The test must use real Web Tenant controls and real HTTP API state. It must not create the final reviewable ticket solely through direct API setup and then claim Web Tenant proof.

### Hero B Mobile test

The new Mobile test uses the existing `TicketReview` implementation and a stubbed typed `ApiClient`. It proves App Landlord semantics at the public-client boundary, not server routing itself.

The test must not duplicate routing logic. The fixture states the server result; Mobile only renders and submits the human decision.

### Regression gates

Before Task 17 may be accepted, fresh evidence should include at minimum:

```text
new Web Hero B Playwright test
new Mobile Hero B RNTL test
full Web E2E suite
full Mobile Jest suite
shared/architecture tests
lint
typecheck
dependency tree check
Expo Doctor
fresh Android export
fresh iOS export
repository/history public-data gate
changed-file/frozen-scope check
```

`test:web` and `build:web` may be included as broader regression in the implementation plan if current manifests and runtime cost support it, but Task 17 does not modify Web product code and does not replace the later final integrated-CI milestone.

## Error handling and stop conditions

Return `STOP_AND_REPORT` instead of widening scope when:

- remote feature baseline is not the pinned Task 17 TARGET_REF;
- an existing Web Tenant/App Landlord behavior fails and fixing it requires frozen product-code changes;
- the authoritative API does not produce the expected Building B HEATING `MANAGEMENT_OFFICE` recommendation;
- the App Landlord existing component cannot render/approve the contract-valid Hero B DTO without product changes;
- Expo Doctor reports a failed check that cannot be resolved without dependency/config/product changes outside approved Task 17 scope;
- Android or iOS export fails for a Task 17 candidate tree;
- health remediation would require automatic SDK/dependency upgrade;
- repository/history scan finds public-data/secret issues;
- the remote feature branch moves before an authorized normal fast-forward publication.

Do not reinterpret a health failure as permission to run `expo install --fix`, upgrade Expo, generate native projects, or connect EAS.

## Commit strategy

Prefer reviewable verification commits, for example:

```text
test: lock cross-platform hero b
chore: ignore mobile export artifacts
```

A separate documentation-only commit is optional if the implementation plan requires a durable Task 17 verification report. Commit count is not an acceptance requirement.

## Acceptance criteria

Task 17 may be reported **FROZEN / VERIFIED** only when all are true:

1. Hero B Web proof creates Building B HEATING through the actual Web Tenant UI and reaches `READY_FOR_REVIEW + COMPLETE`.
2. The landlord API projection for that ticket recommends `MANAGEMENT_OFFICE` with a non-null Repair Packet and non-empty reasons.
3. App Landlord RNTL proof renders the equivalent contract semantics and successfully records approval through `approveRoute()` using the server-returned-state pattern.
4. No Task 15/16 or shared product implementation file changed.
5. Mobile dependency tree remains aligned.
6. Expo Doctor passes under the recorded command/version without silently ignored failed checks.
7. Fresh Android export succeeds.
8. Fresh iOS export succeeds.
9. Export directories are explicitly ignored and no generated export artifact is committed.
10. Required regression/type/lint/repository gates are green with fresh evidence.
11. Final changed-file scope is tests + approved ignore/docs only.
12. Runtime evidence, remote Git evidence, and any executor-reported evidence are labeled separately and truthfully.

## Explicitly deferred

Not Task 17 completion requirements:

- Hero A reimplementation;
- simultaneous browser + native-emulator end-to-end automation;
- Android emulator execution;
- iOS Simulator execution;
- physical-device execution;
- native Xcode/Gradle release build;
- Apple/Google signing;
- EAS Build/Submit/Update;
- Maestro;
- production authentication/authorization;
- final Integrated CI/workflow expansion;
- final contest-wide P0 verification report/status update.

The next milestone after Task 17 is the remaining integrated CI + fresh final P0 verification milestone, corresponding to the old v3 plan's Task 20.

## Decision and approval record

The operator confirmed the next milestone as **Task 17 — Mobile Health + Cross-platform Hero B 통합 검증** on 2026-09-17.

The selected design is the composite approach:

- real Web Tenant + real API for the browser/server half;
- existing App Landlord + typed public landlord DTO for the native presentation/action half;
- no requirement for one runner to automate both surfaces simultaneously;
- fresh Expo Doctor + Android/iOS export;
- minimal export-ignore correction;
- frozen product behavior otherwise remains untouched.

This written design remains a **reviewed draft** until the operator explicitly approves the full spec. No Task 17 implementation plan or implementation execution should start before that approval.

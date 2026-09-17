# Task 16 Landlord Mobile — Design

Status: **REVIEWED DRAFT — approach A approved; full written design pending operator approval; implementation not started**
Date: 2026-09-17

## Authority and baselines

- Repository: `edward321416-maker/build-manager`
- Policy baseline at design authoring: `main@da834638e0b22dd347d9c8524a6edb2dbb437bc1`
- Audit policy refresh: `main@ab86f6d4791d8683b347a5f272a27dc80557fe92`
- The audit comparison from `da834638…` to `ab86f6d…` changed only `ops/AI_Execution_Log.csv`; the governing `AGENTS.md`, `governance/ai_delivery_rules.md`, and `governance/project_policy.md` content did not change.
- Frozen Task 15 product implementation baseline: `feat/building-aware-mvp@5b7a87414dda29ca91058d62c847fc7140117ea1`
- Pre-audit design-document HEAD: `feat/building-aware-mvp@d4d03ee893d33ac23e299f4e49912601a82f0200`
- Task 15 status: `ACCEPTED_WITH_RECORDED_DEVIATIONS / FROZEN`
- User-selected approach: **A. Mobile-native parity**
- Canonical product behavior remains `product/05_product_spec_v3_web_mobile_REAUDITED.md`.
- The existing Web Landlord implementation is a behavior/reference surface only; Task 16 does not reopen Web.

The frozen product baseline identifies the code Task 16 extends; it is **not** an instruction to reset the branch to `5b7a874…`. The implementation plan must refresh `TARGET_REF` from the then-current `feat/building-aware-mvp` HEAD and preserve these design-only commits.

This design supersedes the old plan numbering only for execution order: the capability originally described as `Task 17: App Landlord Capability` is executed now as **Task 16 — Landlord App** because Task 15 Tenant App has been accepted and frozen.

## Goal

Replace the current Landlord Mobile placeholder with a native Expo/React Native landlord flow that exposes the already-approved P0 landlord capabilities through the existing typed API client, without duplicating server-side Safety, Protocol, Evidence, Repair Packet, or Routing decisions.

Task 16 ends when Landlord Mobile is behaviorally complete for the approved P0 capability, its task-level regression gates are green, and the feature branch is frozen for the next cross-platform/mobile-health milestone. It does not include cross-platform Hero B integration, production authentication, real media, vendor dispatch, payment, push, or visual redesign of frozen Web/Tenant surfaces.

## Design principles

1. **Server authority remains absolute.** Mobile renders and submits already-defined DTOs and decision requests. It does not decide safety, protocol, evidence completeness, recommendation, route provenance, or ticket lifecycle.
2. **Mobile-native UI, contract parity.** The Mobile Landlord flow uses platform-native React Native controls and navigation. It does not copy Web component code or require identical layout.
3. **Frozen surfaces stay frozen.** `apps/web/**` and Task 15 Tenant behavior are not changed unless a newly reproduced BLOCKER/HIGH directly proves a contract or safety defect.
4. **No new API surface by default.** The existing `ApiClient` already supplies all Task 16 calls. New server/domain/application/contract behavior is outside Task 16 unless a verified blocker proves the approved flow cannot be implemented.
5. **Validated server responses replace optimistic guesses.** After context confirmation or a landlord decision, the UI renders the DTO returned by the server.
6. **P0 stays synthetic.** Two demo buildings, HEATING/LEAK, synthetic evidence metadata, and no real tenant PII/media remain the public-demo boundary.
7. **Context confirmation is not identity verification.** `verifyBuildingContext()` confirms routing-relevant building context supplied in the demo. It does not authenticate a landlord, verify ownership, or establish authorization.

## Architecture

```text
Expo Router
  └─ apps/mobile/src/app/landlord/**
        └─ apps/mobile/src/features/landlord/**
              ├─ useMobileApiClient()
              ├─ describeMobileError()
              └─ @build-manager/api-client
                    └─ existing /api/v1 endpoints
                          └─ authoritative Web server/application/domain
```

Allowed Mobile imports are `@build-manager/api-contracts` and `@build-manager/api-client`. Mobile continues to forbid direct imports from `@build-manager/domain`, `@build-manager/application`, and `@build-manager/fixtures`.

The implementation may add pure **presentation guards** under `apps/mobile/src/features/landlord/` when needed to decide what controls are visible or enabled. Such guards may inspect returned DTO state, but may not recompute business outcomes. Examples: whether an approve button may be offered from a returned `READY_FOR_REVIEW` ticket, whether any returned safety-escalation flag hides manual override, or which already-enumerated route codes are offered as manual choices.

## Route and screen model

### 1. `/landlord` — Landlord Home

Purpose: provide the landlord entry point, synthetic building list, and current landlord ticket list.

Data reads:

```text
client.listDemoBuildings()
client.listTickets({ view: "landlord" })
```

Required behavior:

- Show the existing DEMO boundary visibly.
- Show the two server-returned demo buildings; do not hard-code building identity as business behavior.
- Show current landlord tickets using `LandlordTicketDetailDto[]` only.
- Building navigation uses the server-returned `buildingId`.
- Ticket navigation uses the server-returned `ticketId`.
- Loading, sanitized error, retry, and empty-ticket states are explicit.
- The screen must not fetch or render the tenant projection.
- The role-return action goes to `/`.

Navigation:

```text
building -> /landlord/buildings/[buildingId]
ticket   -> /landlord/tickets/[ticketId]
role back -> /
```

### 2. `/landlord/buildings/[buildingId]` — Building Passport + Owner Context Confirmation

Purpose: let the landlord inspect the Building Passport and confirm only the context fields already approved for routing. This screen must not imply actual ownership, identity, or authorization verification.

Initial read:

```text
client.getBuilding(buildingId)
```

Editable request shape:

```ts
{
  managementMode,
  heatingType,
  ownerSuppliedBoiler?
}
```

Submit call:

```text
client.verifyBuildingContext(buildingId, request)
```

Required behavior:

- Render the full returned Building Passport.
- Clearly distinguish routing-eligible owner-confirmed context from informational fields.
- `managementMode` and `heatingType` use only the public contract vocabulary.
- `ownerSuppliedBoiler` is optional in both DTO and request. If the returned passport has `ownerSuppliedBoiler === undefined`, Mobile must not silently coerce it to `false`; omit the property from the request unless an approved UI explicitly collects a value. For the current Task 16 UI, render/edit this control only when the returned value is defined.
- `primaryUse` and `approvalYear` are informational only; they are never editable routing controls.
- Include a visible landlord-specific note that this is DEMO building-context confirmation, not ownership/authentication verification.
- On save, replace displayed state with the **server-returned `BuildingPassportDto`**.
- Disable duplicate submission while saving.
- A failure keeps the previous validated passport visible and shows only sanitized error text.
- No local code claims that editing approval year or primary use changes the route.
- Because the Landlord Stack has `headerShown: false`, provide an explicit route back to `/landlord`.

### 3. `/landlord/tickets/[ticketId]` — Repair Packet Review + Human Decision

Purpose: expose the landlord projection of one maintenance ticket and the three approved human decision paths.

Initial read:

```text
client.getLandlordTicket(ticketId)
```

The compact screen renders from `LandlordTicketDetailDto`:

- ticket/building identity needed for the demo;
- issue type, protocol, ticket status, evidence status;
- Repair Packet revision and summary when present;
- safety-escalated state;
- recommendation and recommendation reasons when present;
- provenance strings;
- follow-up questions/evidence options returned by the server;
- existing decision state when present.

For parity with the frozen Web compact Repair Packet, Task 16 does not surface `internalNotes`, `estimatedCost`, `affectedUnits`, or `hiddenContacts`. The DTO may carry those fields; their presence does not expand this screen's approved presentation scope.

The Mobile UI does **not** calculate a recommendation, reconstruct protocol logic, create evidence requirements, or infer provenance.

Because the Landlord Stack has `headerShown: false`, provide an explicit route back to `/landlord`.

## Landlord decision behavior

### Approve recommendation

Call:

```text
client.approveRoute(ticketId)
```

Presentation guard:

- Offer/enable only when the returned ticket is `READY_FOR_REVIEW` and `repairPacket.recommendation` exists.
- The server remains authoritative and may reject a stale action.

On success: replace screen state with the returned `LandlordTicketDetailDto`.

### Override route

Call:

```text
client.overrideRoute(ticketId, { routeCode, reason })
```

Presentation behavior:

- Safety escalation suppresses ordinary manual-route controls. Treat any returned safety indicator as authoritative presentation input: `status === "SAFETY_ESCALATED"`, `evidenceStatus === "SAFETY_ESCALATED"`, or `repairPacket?.safetyEscalated === true`.
- When a recommendation exists, the recommended route is not offered as an override choice because approval is the explicit path for that route.
- When no recommendation exists and the ticket is not safety-escalated, Mobile offers the closed public `RouteCode` vocabulary as manual choices.
- This follows the frozen Web presentation policy. `repairPacket.routeAlternatives` is not used as a narrower authorization list for the Mobile override selector.
- The UI enables submission only when `reason.trim().length > 0`, but sends the user's entered reason string unchanged. Server validation owns trimming/normalization.
- Route labels are presentation copy; route codes come from the public contract vocabulary, never an app-invented string.

On success: replace screen state with the returned `LandlordTicketDetailDto`.

### Request more information

Call:

```text
client.requestMoreInfo(ticketId, {
  reason,
  requestedQuestionIds,
  requestedEvidenceTypes
})
```

Presentation behavior:

- Offer only for returned review states already allowed by the approved behavior (`READY_FOR_REVIEW` or `PARTIAL`).
- The UI enables submission only when `reason.trim().length > 0`, but sends the user's entered reason string unchanged. Server validation owns trimming/normalization.
- At least one question ID or evidence type is required.
- Question IDs and evidence types are selectable only from `ticket.followUpOptions`; Mobile does not invent follow-up items.
- Empty arrays are omitted/undefined in the request shape where appropriate, preserving the current API-client contract.

On success: replace screen state with the returned `LandlordTicketDetailDto`.

## Presentation logic boundary

Task 16 may create a small `apps/mobile/src/features/landlord/logic.ts` with pure functions equivalent in semantics to the frozen Web presentation guards. It must remain a **view-policy adapter**, not domain logic.

Permitted examples:

```text
canApprove(ticket)
canRequestMoreInfo(ticket)
overrideOptions(ticket)
recommendationState(ticket)
contextRows(passport)
```

Requirements:

- Inputs are public API DTOs only.
- No imports from domain/application/fixtures.
- No building-ID branching.
- No protocol-specific recomputation.
- No recommendation generation.
- No safety signal interpretation beyond returned DTO/status/packet safety fields.
- Tests prove safety has precedence over ordinary manual routing for each returned safety-indicator location used by the DTO.

Web source may be read as a frozen reference, but Task 16 does not move, refactor, or share Web implementation code.

## Error and runtime handling

Task 16 reuses existing Mobile infrastructure:

```text
useMobileApiClient()
describeMobileError()
```

Rules:

- Missing/invalid `EXPO_PUBLIC_API_URL` results in the existing `ConfigErrorScreen` rather than a crash on **all three Landlord routes**.
- `ApiClientError` sanitized messages may be shown.
- Arbitrary errors are replaced by the generic Mobile error copy.
- Do not display raw hosts, response bodies, Zod input, stack traces, tenant answer payloads, or request payload dumps.
- Each initial-load failure supplies a user-visible retry.
- Mutating-action failures leave the most recent validated DTO on screen and allow retry.
- Busy actions prevent duplicate submissions.

Task 16 does not add retry/backoff frameworks, offline queues, telemetry, or persistence.

## File boundaries

### Expected Task 16 working set

Create/modify primarily:

```text
apps/mobile/src/app/landlord/index.tsx
apps/mobile/src/app/landlord/buildings/[buildingId].tsx
apps/mobile/src/app/landlord/tickets/[ticketId].tsx
apps/mobile/src/features/landlord/logic.ts
apps/mobile/src/features/landlord/logic.test.ts
apps/mobile/src/features/landlord/landlord-home.tsx
apps/mobile/src/features/landlord/landlord-home.test.tsx
apps/mobile/src/features/landlord/building-detail.tsx
apps/mobile/src/features/landlord/building-detail.test.tsx
apps/mobile/src/features/landlord/ticket-review.tsx
apps/mobile/src/features/landlord/ticket-review.test.tsx
apps/mobile/src/testing/role-navigation.test.tsx
apps/mobile/README.md                             # only if runtime instructions materially change
```

`apps/mobile/src/testing/role-navigation.test.tsx` is a required Task 16 change because it currently locks the Landlord placeholder behavior. Replace only the obsolete placeholder assertions and add route/config coverage; preserve the existing Tenant and role-entry assertions.

`apps/mobile/src/components/ui.tsx` may change only for a generic primitive genuinely required by Landlord Mobile and only if existing Tenant behavior remains unchanged under regression tests.

### Frozen / prohibited by default

```text
apps/web/**
apps/mobile/src/features/tenant/**
apps/mobile/src/app/tenant/**
packages/domain/**
packages/application/**
packages/fixtures/**
packages/api-contracts/**
packages/api-client/**
```

A directly reproduced BLOCKER/HIGH in an existing contract may stop the affected Task 16 work for reporting. It does not silently authorize widening the implementation scope.

No new dependencies are expected. A dependency addition requires separate justification and must not be introduced merely for UI convenience.

## UX scope

Task 16 is a functional native-parity milestone, not the final visual-design pass.

- Reuse the current Mobile DEMO banner, screen container, buttons, and safe typography patterns where practical.
- Preserve the approved product hierarchy: building context first, Repair Packet/reasons second, human decision last.
- Keep safety states visually unmistakable from ordinary review states.
- On Landlord context screens, explicitly distinguish **context confirmation** from actual landlord identity, ownership, or authorization verification.
- Avoid implying automatic dispatch, diagnosis, liability allocation, vendor booking, or cost certainty.
- Do not add camera/gallery, file upload, OCR, QR, push notifications, authentication, payment, or marketplace UI.

## Test design

Strict TDD applies to Task 16 behavior. Tests use jest-expo + React Native Testing Library and the real typed `ApiClient` interface through injected/stub clients where appropriate.

### Presentation logic tests

Must cover at minimum:

- recommendation + `READY_FOR_REVIEW` -> approve allowed;
- missing recommendation -> approve unavailable;
- each returned safety indicator (`status`, `evidenceStatus`, packet `safetyEscalated`) -> manual override unavailable;
- recommendation route excluded from override alternatives;
- no recommendation + non-safety -> closed route vocabulary available for manual selection;
- `READY_FOR_REVIEW` / `PARTIAL` -> more-info presentation allowed;
- terminal/non-review state -> more-info presentation unavailable;
- routing-eligible Building Passport rows separated from informational rows.

### Landlord Home tests

Must cover at minimum:

- loading state;
- calls `listDemoBuildings()` and `listTickets({ view: "landlord" })`;
- does not request tenant projection;
- renders server-returned building/ticket identities;
- building navigation uses returned `buildingId`;
- ticket navigation uses returned `ticketId`;
- role-return navigation goes to `/`;
- empty tickets state;
- sanitized failure and retry.

### Building Detail tests

Must cover at minimum:

- fetches exact route `buildingId` through `getBuilding()`;
- initializes fields from returned DTO;
- informational fields are not submitted as editable routing inputs;
- when `ownerSuppliedBoiler` is defined, sends its exact selected boolean value;
- when `ownerSuppliedBoiler` is undefined, does not silently submit `false` and omits the optional property for the current UI;
- sends the exact owner-context confirmation request;
- save result is replaced by server-returned passport;
- duplicate save prevented while busy;
- sanitized action failure preserves last validated state;
- copy does not claim real ownership/authentication verification;
- explicit navigation returns to `/landlord`.

### Ticket Review tests

Must cover at minimum:

- fetches exact route `ticketId` through `getLandlordTicket()`;
- renders Repair Packet recommendation reasons/provenance from DTO;
- does not surface compact-packet-excluded fields (`internalNotes`, `estimatedCost`, `affectedUnits`, `hiddenContacts`);
- approve calls `approveRoute()` only when offered;
- override sends the exact selected route code and exact entered reason string; whitespace-only reason is blocked before the API call;
- each returned safety indicator suppresses override and does not call `overrideRoute()`;
- more-info options come from `followUpOptions` only;
- more-info cannot submit with no selected item or whitespace-only reason;
- exact entered more-info reason plus selected question IDs/evidence types are sent;
- each successful decision renders the returned landlord DTO rather than local optimistic state;
- sanitized action error behavior;
- explicit navigation returns to `/landlord`.

### Route/config regression tests

`apps/mobile/src/testing/role-navigation.test.tsx` must:

- preserve role-entry -> `/tenant` and role-entry -> `/landlord` assertions;
- remove the obsolete assertion that Landlord is a placeholder and makes no API call;
- preserve the explicit route back to role selection;
- prove missing `EXPO_PUBLIC_API_URL` renders `ConfigErrorScreen` for `/landlord`, `/landlord/buildings/[id]`, and `/landlord/tickets/[id]` as well as preserving existing Tenant config-error coverage.

### Regression and architecture gates

Task 16 completion requires fresh evidence for:

```text
Mobile Landlord tests
all existing Mobile Tenant tests
Mobile route/navigation tests
full existing shared test suite
lint
typecheck (including configured test typecheck)
architecture/dependency boundary checks
root dependency tree check
Android Expo/Metro export as the Task 16 task-level bundle smoke
repository/public-history gate required by project policy
```

The exact executable commands are fixed in the implementation plan after reading the current root/mobile manifests. Do not silently substitute a different gate.

The canonical v3 product spec also defines Expo Doctor plus Android and iOS export/bundle smoke for the later Mobile Health / integrated verification milestone. Task 16 intentionally does **not** claim Expo Doctor or iOS bundle verification merely because the task-level Android export succeeds. Those gates remain mandatory before final cross-platform P0 completion.

Cross-platform Web-to-App Hero B is **not** part of the Task 16 freeze gate; it remains the next integration milestone after both role apps are frozen. Web E2E is therefore not reopened merely to finish Task 16.

## Commit strategy

Prefer meaningful reviewable commits aligned to behavior, for example:

```text
feat: add landlord mobile home
feat: add landlord building context confirmation
feat: add landlord ticket review
test: lock landlord mobile behavior
```

This is a suggested decomposition, not a numeric acceptance requirement. Do not create empty commits, rewrite already-published history, or distort changes merely to reach a target count.

## Acceptance and freeze criteria

Task 16 may be reported **FROZEN** only when all of the following are true:

1. `/landlord` is no longer a placeholder and the three approved Landlord Mobile routes work through the typed API client.
2. Building Passport context confirmation uses the exact existing optional owner-context contract, does not invent an absent `ownerSuppliedBoiler=false`, and renders the returned server state.
3. The Landlord UI does not imply production identity, ownership, or authorization verification.
4. Ticket review exposes approve, override, and more-info only within the approved presentation guards.
5. No client-side Safety/Protocol/Evidence/Recommendation/Route computation has been introduced.
6. No forbidden Mobile imports or new unapproved dependencies are introduced.
7. Existing Task 15 Tenant behavior remains green under fresh Mobile regression tests.
8. Required Task 16 lint/typecheck/dependency/Android-export/repository gates pass or any unrelated baseline exception is explicitly separated with evidence.
9. No real private data, credential, raw media, or unsafe error payload is added to public Git/history.
10. Final feature HEAD and commit/tree evidence are recorded; execution-reported evidence is distinguished from independently rechecked evidence.
11. Web and Tenant remain frozen unless a newly proven BLOCKER/HIGH was separately handled.
12. Expo Doctor, iOS export/bundle, and cross-platform Hero B are explicitly reported as deferred rather than silently treated as verified.

## Explicitly deferred

The following are not Task 16 completion requirements:

- Cross-platform Hero B (`Web Tenant -> Building B HEATING -> API -> App Landlord -> MANAGEMENT_OFFICE -> decision`).
- Simultaneous Web/native end-to-end runner.
- Expo Doctor and iOS export/bundle smoke; these remain mandatory later Mobile Health / integrated P0 gates and are **not verified by Task 16**.
- Production authentication/authorization.
- Real landlord/tenant identity.
- Camera/gallery/upload or real evidence storage.
- Vendor contact/dispatch/marketplace.
- Push notifications.
- Payment.
- OCR/QR/weather.
- EAS account connection or cloud build.
- Final visual-polish/design-system pass.
- Recovery/import of the Task 15 local pending execution-log source; that remains provenance follow-up and does not reopen Task 15.

## Decision and approval record

The operator selected **A. Mobile-native parity** on 2026-09-17. The rejected alternatives were:

- extracting frozen Web landlord presentation logic into shared code, which would unnecessarily reopen Web/refactor boundaries;
- implementing only a compact ticket-review screen, which would omit the already-approved Building Passport and owner-context confirmation capability.

Approach approval is not the same as approval of every detail in the subsequently written design. After this audit, this document remains a **reviewed draft** until the operator explicitly approves the written design. No implementation plan or implementation execution should start before that approval.

This design therefore keeps the shared API contract as the cross-platform boundary while allowing independent Web and Mobile presentation implementations.
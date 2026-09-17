# Task 16 Landlord Mobile — Design

Status: **APPROVED DESIGN — implementation not started**
Date: 2026-09-17

## Authority and baselines

- Repository: `edward321416-maker/build-manager`
- Policy baseline read for this task: `main@da834638e0b22dd347d9c8524a6edb2dbb437bc1`
- Product/code baseline: `feat/building-aware-mvp@5b7a87414dda29ca91058d62c847fc7140117ea1`
- Task 15 status: `ACCEPTED_WITH_RECORDED_DEVIATIONS / FROZEN`
- User-selected approach: **A. Mobile-native parity**
- Canonical product behavior remains `product/05_product_spec_v3_web_mobile_REAUDITED.md`.
- The existing Web Landlord implementation is a behavior/reference surface only; Task 16 does not reopen Web.

This design supersedes the old plan numbering only for execution order: the capability originally described as `Task 17: App Landlord Capability` is executed now as **Task 16 — Landlord App** because Task 15 Tenant App has been accepted and frozen.

## Goal

Replace the current Landlord Mobile placeholder with a native Expo/React Native landlord flow that exposes the already-approved P0 landlord capabilities through the existing typed API client, without duplicating server-side Safety, Protocol, Evidence, Repair Packet, or Routing decisions.

Task 16 ends when Landlord Mobile is behaviorally complete for the approved P0 capability, its regression gates are green, and the feature branch is frozen for the next cross-platform milestone. It does not include cross-platform Hero B integration, production authentication, real media, vendor dispatch, payment, push, or visual redesign of frozen Web/Tenant surfaces.

## Design principles

1. **Server authority remains absolute.** Mobile renders and submits already-defined DTOs and decision requests. It does not decide safety, protocol, evidence completeness, recommendation, route provenance, or ticket lifecycle.
2. **Mobile-native UI, contract parity.** The Mobile Landlord flow uses platform-native React Native controls and navigation. It does not copy Web component code or require identical layout.
3. **Frozen surfaces stay frozen.** `apps/web/**` and Task 15 Tenant behavior are not changed unless a newly reproduced BLOCKER/HIGH directly proves a contract or safety defect.
4. **No new API surface by default.** The existing `ApiClient` already supplies all Task 16 calls. New server/domain/application/contract behavior is outside Task 16 unless a verified blocker proves the approved flow cannot be implemented.
5. **Validated server responses replace optimistic guesses.** After verification or a landlord decision, the UI renders the DTO returned by the server.
6. **P0 stays synthetic.** Two demo buildings, HEATING/LEAK, synthetic evidence metadata, and no real tenant PII/media remain the public-demo boundary.

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

The implementation may add pure **presentation guards** under `apps/mobile/src/features/landlord/` when needed to decide what controls are visible or enabled. Such guards may inspect returned DTO state, but may not recompute business outcomes. Examples: whether an approve button may be offered from a returned `READY_FOR_REVIEW` ticket, whether safety escalation hides manual override, or which already-enumerated route alternatives are shown.

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

Navigation:

```text
building -> /landlord/buildings/[buildingId]
ticket   -> /landlord/tickets/[ticketId]
back     -> /
```

### 2. `/landlord/buildings/[buildingId]` — Building Passport + Owner Verification

Purpose: let the landlord inspect the Building Passport and confirm only the context fields already approved for routing.

Initial read:

```text
client.getBuilding(buildingId)
```

Editable fields sent to the server:

```ts
{
  managementMode,
  heatingType,
  ownerSuppliedBoiler
}
```

Submit call:

```text
client.verifyBuildingContext(buildingId, request)
```

Required behavior:

- Render the full returned Building Passport.
- Clearly distinguish routing-eligible owner-verified fields from informational fields.
- `managementMode` and `heatingType` use only the contract vocabulary.
- `ownerSuppliedBoiler` is included when supported by the DTO/request contract.
- `primaryUse` and `approvalYear` are informational only; they are never editable routing controls.
- On save, replace displayed state with the **server-returned `BuildingPassportDto`**.
- Disable duplicate submission while saving.
- A failure keeps the previous validated passport visible and shows only sanitized error text.
- No local code claims that editing approval year or primary use changes the route.

### 3. `/landlord/tickets/[ticketId]` — Repair Packet Review + Human Decision

Purpose: expose the landlord projection of one maintenance ticket and the three approved human decision paths.

Initial read:

```text
client.getLandlordTicket(ticketId)
```

The screen renders from `LandlordTicketDetailDto`:

- ticket/building identity needed for the demo;
- issue type, protocol, ticket status, evidence status;
- compact Repair Packet summary;
- safety-escalated state;
- recommendation and recommendation reasons when present;
- route alternatives already returned by the server;
- provenance strings;
- follow-up questions/evidence options returned by the server;
- existing decision state when present.

The Mobile UI does **not** calculate a recommendation, reconstruct protocol logic, create evidence requirements, or infer provenance.

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

- Safety escalation suppresses ordinary manual-route controls.
- When a recommendation exists, the recommended route is not offered as an override choice because approval is the explicit path for that route.
- When no recommendation exists and the ticket is not safety-escalated, Mobile may offer the closed `RouteCode` vocabulary as a manual route choice, matching the approved Web behavior.
- A non-empty reason is required before submission.
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
- A non-empty reason is required.
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
- No safety signal interpretation beyond returned DTO/status flags.
- Tests prove safety has precedence over ordinary manual routing.

Web source may be read as a frozen reference, but Task 16 does not move, refactor, or share Web implementation code.

## Error and runtime handling

Task 16 reuses existing Mobile infrastructure:

```text
useMobileApiClient()
describeMobileError()
```

Rules:

- Missing/invalid `EXPO_PUBLIC_API_URL` results in the existing configuration state rather than a crash.
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
apps/mobile/src/testing/role-navigation.test.tsx   # only if needed to replace placeholder assertions
apps/mobile/README.md                             # only if runtime instructions materially change
```

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
- Avoid implying automatic dispatch, diagnosis, liability allocation, vendor booking, or cost certainty.
- Do not add camera/gallery, file upload, OCR, QR, push notifications, authentication, payment, or marketplace UI.

## Test design

Strict TDD applies to Task 16 behavior. Tests use jest-expo + React Native Testing Library and the real typed `ApiClient` interface through injected/stub clients where appropriate.

### Presentation logic tests

Must cover at minimum:

- recommendation + `READY_FOR_REVIEW` -> approve allowed;
- missing recommendation -> approve unavailable;
- safety-escalated ticket -> manual override unavailable;
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
- empty tickets state;
- sanitized failure and retry.

### Building Detail tests

Must cover at minimum:

- fetches exact route `buildingId` through `getBuilding()`;
- initializes fields from returned DTO;
- informational fields are not submitted as editable routing inputs;
- sends exact owner-verification request;
- save result is replaced by server-returned passport;
- duplicate save prevented while busy;
- sanitized action failure preserves last validated state.

### Ticket Review tests

Must cover at minimum:

- fetches exact route `ticketId` through `getLandlordTicket()`;
- renders Repair Packet recommendation reasons/provenance from DTO;
- approve calls `approveRoute()` only when offered;
- override sends exact route code and trimmed/non-empty user reason according to current input policy;
- safety escalation does not call override;
- more-info options come from `followUpOptions` only;
- more-info cannot submit with no selected item;
- exact selected question IDs/evidence types are sent;
- each successful decision renders the returned landlord DTO rather than local optimistic state;
- sanitized action error behavior.

### Regression and architecture gates

Task 16 completion requires fresh evidence for:

```text
Mobile Landlord tests
all existing Mobile Tenant tests
Mobile route/navigation tests
shared tests relevant to public DTO/API contracts
lint
typecheck
test typecheck if configured
architecture/dependency boundary checks
Android Expo/Metro export
repository/public-history gate required by project policy
```

The exact executable commands are fixed in the implementation plan after reading the current root/mobile manifests. Do not silently substitute a different gate.

Cross-platform Web-to-App Hero B is **not** part of the Task 16 freeze gate; it remains the next integration milestone after both role apps are frozen. Web E2E is therefore not reopened merely to finish Task 16.

## Commit strategy

Prefer meaningful reviewable commits aligned to behavior, for example:

```text
feat: add landlord mobile home
feat: add landlord building verification
feat: add landlord ticket review
test: lock landlord mobile behavior
```

This is a suggested decomposition, not a numeric acceptance requirement. Do not create empty commits, rewrite already-published history, or distort changes merely to reach a target count.

## Acceptance and freeze criteria

Task 16 may be reported **FROZEN** only when all of the following are true:

1. `/landlord` is no longer a placeholder and the three approved Landlord Mobile routes work through the typed API client.
2. Building Passport verification uses the exact existing owner-verification contract and renders the returned server state.
3. Ticket review exposes approve, override, and more-info only within the approved presentation guards.
4. No client-side Safety/Protocol/Evidence/Recommendation/Route computation has been introduced.
5. No forbidden Mobile imports or new unapproved dependencies are introduced.
6. Existing Task 15 Tenant behavior remains green under fresh Mobile regression tests.
7. Required lint/type/build/export/dependency/repository gates pass or any unrelated baseline exception is explicitly separated with evidence.
8. No real private data, credential, raw media, or unsafe error payload is added to public Git/history.
9. Final feature HEAD and commit/tree evidence are recorded; execution-reported evidence is distinguished from independently rechecked evidence.
10. Web and Tenant remain frozen unless a newly proven BLOCKER/HIGH was separately handled.

## Explicitly deferred

The following are not Task 16 completion requirements:

- Cross-platform Hero B (`Web Tenant -> Building B HEATING -> API -> App Landlord -> MANAGEMENT_OFFICE -> decision`).
- Simultaneous Web/native end-to-end runner.
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

## Decision record

The operator selected **A. Mobile-native parity** on 2026-09-17. The rejected alternatives were:

- extracting frozen Web landlord presentation logic into shared code, which would unnecessarily reopen Web/refactor boundaries;
- implementing only a compact ticket-review screen, which would omit the already-approved Building Passport and owner-context verification capability.

This design therefore keeps the shared API contract as the cross-platform boundary while allowing independent Web and Mobile presentation implementations.

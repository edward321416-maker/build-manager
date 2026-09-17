# Task 16 Landlord Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Landlord Mobile placeholder with the approved native landlord P0 flow: demo building/ticket home, Building Passport context confirmation, compact Repair Packet review, and approve/override/more-info actions through the existing typed API client.

**Architecture:** Expo Router route files remain thin runtime wrappers. New `apps/mobile/src/features/landlord/**` components receive an injected `ApiClient`, render only public DTOs, and use small pure presentation guards that never recompute server Safety, Protocol, Evidence, Repair Packet, Routing, or ticket transitions. Web, Tenant behavior, and shared server/domain/client contracts remain frozen.

**Tech Stack:** Expo SDK 57.0.22; React Native 0.86.3; React 19.2.3; Expo Router 57.0.21; TypeScript 6.0.x; `jest-expo`; React Native Testing Library; npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-17-task16-landlord-mobile-design.md`

**Planning baseline:** `feat/building-aware-mvp@c1eb036d39735c4c45e1ad585c06c13293a22908` contains the operator-approved Task 16 design. The implementation worker must use the exact remote feature HEAD supplied in the handoff as `TARGET_REF`; never reset to the older Task 15 product baseline `5b7a874…`.

## Global Constraints

- Repository: `edward321416-maker/build-manager`; implementation branch: `feat/building-aware-mvp`.
- Before editing, fetch the named branch and prove local `HEAD` equals the handoff `TARGET_REF`. If it differs, stop and report the mismatch; do not merge, rebase, reset, amend, or force-push to make it match.
- Read `main` policy files at the handoff `POLICY_REF` without merging them into the feature branch.
- Task 15 Tenant behavior and all Web behavior stay frozen. Do not edit `apps/web/**`, `apps/mobile/src/features/tenant/**`, or `apps/mobile/src/app/tenant/**`.
- Do not edit `packages/domain/**`, `packages/application/**`, `packages/fixtures/**`, `packages/api-contracts/**`, or `packages/api-client/**` unless a newly reproduced BLOCKER/HIGH proves the approved Task 16 flow is impossible; stop and report instead of widening scope automatically.
- No new npm dependencies. Use existing React Native controls and existing `ActionButton`, `DemoBanner`, `Screen`, `LoadingState`, `ErrorState`, and `ConfigErrorScreen` primitives.
- Mobile may import `@build-manager/api-contracts` and `@build-manager/api-client`; it must not import domain/application/fixtures.
- P0 remains synthetic: no real addresses, people, contacts, media, credentials, auth claims, vendor dispatch, payment, push, OCR, QR, or cloud/EAS connection.
- `verifyBuildingContext()` is demo building-context confirmation, not landlord identity, ownership, or authorization verification.
- `ownerSuppliedBoiler` is optional. An absent value must stay absent; never coerce `undefined` to `false`.
- Route codes are the closed public contract vocabulary. Override UI follows frozen Web semantics: suppress ordinary override on any returned safety escalation; otherwise exclude only the current recommended route. When there is no recommendation, offer the full closed vocabulary.
- For override and more-info reasons, use `trim()` only to decide whether submission is enabled. Send the user's entered string unchanged.
- Every successful mutation replaces UI state with the DTO returned by the API. No optimistic reconstruction.
- Strict TDD for behavior changes. A RED run must fail for the intended missing behavior, not because of a broken import or malformed test setup.
- Make meaningful local Conventional Commits. Commit count is not an acceptance requirement. Never add empty commits or rewrite published history.
- Do not push implementation commits until the final public-history/data gate has passed locally.
- Task 16 task-level bundle smoke is Android export. Expo Doctor and iOS export remain required later Mobile Health/integrated gates and must be reported as deferred, not passed.
- Stop after Task 16 verification/reporting. Do not start cross-platform Hero B or later Mobile Health work.

## File Structure

Create:

```text
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
```

Modify:

```text
apps/mobile/src/app/landlord/index.tsx
apps/mobile/src/testing/role-navigation.test.tsx
apps/mobile/README.md
```

`apps/mobile/src/components/ui.tsx` is not planned for modification. If implementation proves a generic primitive is genuinely required, add the smallest backwards-compatible primitive and rerun all existing Tenant tests; do not change existing primitive behavior merely for Landlord styling.

---

### Task 1: Add Landlord Mobile Presentation Policy

**Files:**
- Create: `apps/mobile/src/features/landlord/logic.test.ts`
- Create: `apps/mobile/src/features/landlord/logic.ts`

**Interfaces:**
- Consumes: `BuildingPassportDto`, `LandlordTicketDetailDto`, `RouteCode`, `RouteCodeSchema` from `@build-manager/api-contracts`.
- Produces: `ALL_ROUTE_CODES`, `routeLabel()`, `isSafetyEscalated()`, `canApprove()`, `canRequestMoreInfo()`, `manualRouteMode()`, `overrideOptions()`, `recommendationState()`, `contextRows()`.
- These functions are presentation policy only. They do not call an API and do not import domain/application/fixtures.

- [ ] **Step 1: Write RED tests for the presentation guards**

Create `apps/mobile/src/features/landlord/logic.test.ts` with typed fixtures that cover all public states used by the UI. The core assertions must include:

```ts
import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import {
  ALL_ROUTE_CODES,
  canApprove,
  canRequestMoreInfo,
  contextRows,
  isSafetyEscalated,
  manualRouteMode,
  overrideOptions,
} from "./logic";

const passport: BuildingPassportDto = {
  buildingId: "building-server-id",
  displayName: "DEMO 건물",
  demo: true,
  primaryUse: "공동주택",
  approvalYear: "2018",
  managementMode: "MANAGEMENT_OFFICE",
  heatingType: "CENTRAL_SHARED",
  contextVerified: true,
  routingEligibleFields: ["managementMode", "heatingType"],
};

function ticket(
  overrides: Partial<LandlordTicketDetailDto> = {},
): LandlordTicketDetailDto {
  return {
    ticketId: "ticket-server-id",
    building: passport,
    issueType: "LEAK",
    protocol: "LEAK_V1",
    status: "READY_FOR_REVIEW",
    evidenceStatus: "COMPLETE",
    activeQuestion: null,
    repairPacket: {
      revision: 1,
      summary: "합성 누수 요청",
      safetyEscalated: false,
      recommendation: {
        routeCode: "MANAGEMENT_OFFICE",
        label: "관리사무소",
        reasons: ["관리 방식이 관리사무소입니다."],
      },
      routeAlternatives: [],
      provenance: ["managementMode"],
      internalNotes: [],
      estimatedCost: null,
      affectedUnits: [],
      hiddenContacts: [],
    },
    decision: null,
    followUpOptions: { questions: [], evidence: [] },
    ...overrides,
  };
}

describe("landlord presentation policy", () => {
  it("allows approve only for READY_FOR_REVIEW with a recommendation", () => {
    expect(canApprove(ticket())).toBe(true);
    expect(canApprove(ticket({ status: "PARTIAL" }))).toBe(false);
    expect(
      canApprove(
        ticket({
          repairPacket: { ...ticket().repairPacket!, recommendation: null },
        }),
      ),
    ).toBe(false);
  });

  it.each([
    { status: "SAFETY_ESCALATED" as const },
    { evidenceStatus: "SAFETY_ESCALATED" as const },
    {
      repairPacket: { ...ticket().repairPacket!, safetyEscalated: true },
    },
  ])("treats every returned safety location as escalated", (override) => {
    const value = ticket(override);
    expect(isSafetyEscalated(value)).toBe(true);
    expect(manualRouteMode(value)).toBe("NONE");
    expect(overrideOptions(value)).toEqual([]);
  });

  it("excludes only the recommended route when a recommendation exists", () => {
    const options = overrideOptions(ticket()).map((item) => item.routeCode);
    expect(options).not.toContain("MANAGEMENT_OFFICE");
    expect(options).toHaveLength(ALL_ROUTE_CODES.length - 1);
  });

  it("offers the closed vocabulary when no recommendation exists", () => {
    const value = ticket({
      status: "PARTIAL",
      evidenceStatus: "MISSING_REQUIRED",
      repairPacket: { ...ticket().repairPacket!, recommendation: null },
    });
    expect(manualRouteMode(value)).toBe("MANUAL_ONLY");
    expect(overrideOptions(value).map((item) => item.routeCode)).toEqual(
      ALL_ROUTE_CODES,
    );
  });

  it("allows more-info only from review states", () => {
    expect(canRequestMoreInfo(ticket())).toBe(true);
    expect(canRequestMoreInfo(ticket({ status: "PARTIAL" }))).toBe(true);
    expect(canRequestMoreInfo(ticket({ status: "APPROVED" }))).toBe(false);
    expect(canRequestMoreInfo(ticket({ status: "NEEDS_MORE_INFO" }))).toBe(false);
  });

  it("separates routing context from informational context", () => {
    const rows = contextRows(passport);
    expect(rows.find((row) => row.key === "managementMode")?.routingEligible).toBe(true);
    expect(rows.find((row) => row.key === "approvalYear")?.routingEligible).toBe(false);
  });
});
```

Do not use actual fixture building IDs in production source. Test-only arbitrary IDs such as `building-server-id` are acceptable.

- [ ] **Step 2: Run the focused test and verify RED**

From repository root:

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/logic.test.ts
```

Expected: FAIL because `./logic` does not exist yet. If it fails for a Jest/configuration error instead, fix the test setup before implementation and rerun until the failure is specifically the missing module/exports.

- [ ] **Step 3: Implement the pure presentation policy**

Create `apps/mobile/src/features/landlord/logic.ts`. Use the public contract as the vocabulary source:

```ts
import {
  RouteCodeSchema,
  type BuildingPassportDto,
  type LandlordTicketDetailDto,
  type RouteCode,
} from "@build-manager/api-contracts";

export const ALL_ROUTE_CODES: readonly RouteCode[] = RouteCodeSchema.options;

const ROUTE_LABELS: Record<RouteCode, string> = {
  LANDLORD_REVIEW: "임대인 검토",
  MANAGEMENT_OFFICE: "관리사무소",
  THIRD_PARTY_MANAGER: "위탁관리",
  MANUFACTURER_AS: "제조사 A/S",
  GENERAL_VENDOR: "일반 수리업체",
};

export function routeLabel(routeCode: RouteCode): string {
  return ROUTE_LABELS[routeCode];
}

export function isSafetyEscalated(ticket: LandlordTicketDetailDto): boolean {
  return (
    ticket.status === "SAFETY_ESCALATED" ||
    ticket.evidenceStatus === "SAFETY_ESCALATED" ||
    ticket.repairPacket?.safetyEscalated === true
  );
}

export function canApprove(ticket: LandlordTicketDetailDto): boolean {
  return (
    ticket.status === "READY_FOR_REVIEW" &&
    ticket.repairPacket?.recommendation != null
  );
}

export function canRequestMoreInfo(ticket: LandlordTicketDetailDto): boolean {
  return ticket.status === "READY_FOR_REVIEW" || ticket.status === "PARTIAL";
}

export type ManualRouteMode = "NONE" | "ALTERNATIVE" | "MANUAL_ONLY";

export function manualRouteMode(ticket: LandlordTicketDetailDto): ManualRouteMode {
  if (isSafetyEscalated(ticket)) return "NONE";
  return ticket.repairPacket?.recommendation == null
    ? "MANUAL_ONLY"
    : "ALTERNATIVE";
}

export function overrideOptions(ticket: LandlordTicketDetailDto) {
  if (isSafetyEscalated(ticket)) return [];
  const recommended = ticket.repairPacket?.recommendation?.routeCode ?? null;
  return ALL_ROUTE_CODES.filter((code) => code !== recommended).map((routeCode) => ({
    routeCode,
    label: routeLabel(routeCode),
  }));
}
```

Also implement `recommendationState()` with the frozen Web precedence `AWAITING_INTAKE -> SAFETY_ESCALATED -> RECOMMENDED -> CONFLICTING -> MISSING_REQUIRED`, and `contextRows()` that renders `managementMode`, `heatingType`, optional `ownerSuppliedBoiler`, `primaryUse`, and `approvalYear`, marking routing eligibility solely from `passport.routingEligibleFields`. Label routing rows as demo owner-confirmed context, not identity/ownership verification.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/logic.test.ts
```

Expected: PASS, 0 failed tests.

- [ ] **Step 5: Commit the presentation policy locally**

```bash
git add apps/mobile/src/features/landlord/logic.ts apps/mobile/src/features/landlord/logic.test.ts
git diff --cached --check
git commit -m "feat: add landlord mobile presentation policy"
```

Do not push yet.

---

### Task 2: Implement Landlord Home and Real Route Entry

**Files:**
- Create: `apps/mobile/src/features/landlord/landlord-home.test.tsx`
- Create: `apps/mobile/src/features/landlord/landlord-home.tsx`
- Modify: `apps/mobile/src/app/landlord/index.tsx`

**Interfaces:**
- `LandlordHome({ client, onBuildingOpen, onTicketOpen, onBackToRoles })`
- `client.listDemoBuildings(): Promise<BuildingPassportDto[]>`
- `client.listTickets({ view: "landlord" }): Promise<LandlordTicketDetailDto[]>`
- Route wrapper owns Expo Router and `useMobileApiClient()` only.

- [ ] **Step 1: Write RED tests for home data, navigation callbacks, retry, and empty state**

Use the existing Tenant test style: inject a partial `ApiClient` stub and inspect calls. The test must prove the landlord projection explicitly:

```ts
const listTickets = jest.fn(async ({ view }: { view: "landlord" | "tenant" }) => {
  if (view !== "landlord") throw new Error("wrong projection");
  return [LANDLORD_TICKET];
});

await render(
  <LandlordHome
    client={stubClient({ listTickets })}
    onBackToRoles={jest.fn()}
    onBuildingOpen={jest.fn()}
    onTicketOpen={jest.fn()}
  />,
);

await screen.findByText("DEMO 건물");
expect(listTickets).toHaveBeenCalledWith({ view: "landlord" });
expect(listTickets).toHaveBeenCalledTimes(1);
```

Add focused cases for:

```text
loading while either home request is unresolved
server-returned building id passed to onBuildingOpen
server-returned ticket id passed to onTicketOpen
onBackToRoles callback invoked
zero-ticket copy rendered when tickets=[]
ApiClientError sanitized message + retry re-runs both reads
arbitrary Error host text not rendered
```

- [ ] **Step 2: Run the focused home test and verify RED**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/landlord-home.test.tsx
```

Expected: FAIL because `LandlordHome` does not exist.

- [ ] **Step 3: Implement `LandlordHome` with existing primitives**

Create `apps/mobile/src/features/landlord/landlord-home.tsx` using this state shape:

```ts
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      buildings: BuildingPassportDto[];
      tickets: LandlordTicketDetailDto[];
    };
```

`fetchHome()` must call both reads with `Promise.all`, wrap failures with `describeMobileError()`, and let `reload()` visibly restore the loading state. Render `Screen` + `DemoBanner`, a landlord header, building buttons keyed by returned `buildingId`, ticket buttons keyed by returned `ticketId`, a clear empty-ticket message, and `역할 선택으로 돌아가기` wired only to `onBackToRoles`.

Do not hard-code either demo building ID, ticket ID, protocol, or recommendation.

- [ ] **Step 4: Replace the placeholder route with the runtime wrapper**

`apps/mobile/src/app/landlord/index.tsx` becomes a wrapper equivalent in responsibility to the Tenant route:

```tsx
import { useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../components/ui";
import { LandlordHome } from "../../features/landlord/landlord-home";
import { useMobileApiClient } from "../../lib/use-api-client";

export default function LandlordHomeRoute() {
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) return <ConfigErrorScreen />;

  return (
    <LandlordHome
      client={client}
      onBackToRoles={() => router.replace("/")}
      onBuildingOpen={(buildingId) =>
        router.push(`/landlord/buildings/${buildingId}`)
      }
      onTicketOpen={(ticketId) => router.push(`/landlord/tickets/${ticketId}`)}
    />
  );
}
```

- [ ] **Step 5: Run home tests and existing role-entry smoke**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/landlord-home.test.tsx src/testing/role-navigation.test.tsx
```

At this stage the old landlord-placeholder assertions in `role-navigation.test.tsx` are expected to fail because Task 5 deliberately updates them. Confirm Tenant/role-entry assertions still pass and the home feature tests are green; do not weaken the new Home behavior to satisfy obsolete placeholder assertions.

- [ ] **Step 6: Commit the home behavior locally**

```bash
git add apps/mobile/src/app/landlord/index.tsx apps/mobile/src/features/landlord/landlord-home.tsx apps/mobile/src/features/landlord/landlord-home.test.tsx
git diff --cached --check
git commit -m "feat: add landlord mobile home"
```

Do not stage `role-navigation.test.tsx` yet; its obsolete assertions are replaced in Task 5.

---

### Task 3: Implement Building Passport Context Confirmation

**Files:**
- Create: `apps/mobile/src/features/landlord/building-detail.test.tsx`
- Create: `apps/mobile/src/features/landlord/building-detail.tsx`
- Create: `apps/mobile/src/app/landlord/buildings/[buildingId].tsx`

**Interfaces:**
- `BuildingDetail({ client, buildingId, onBack })`
- Reads `client.getBuilding(buildingId)`.
- Writes `client.verifyBuildingContext(buildingId, OwnerVerificationRequest)`.
- Route wrapper resolves `buildingId` with `useLocalSearchParams<{ buildingId?: string }>()`, passes a string or `""`, and lets the server own unknown/not-found semantics.

- [ ] **Step 1: Write RED tests for exact optional request semantics**

The tests must include one passport with `ownerSuppliedBoiler: true` and one where the property is absent. Capture requests rather than asserting only rendered text:

```ts
const requests: OwnerVerificationRequest[] = [];
const client = stubClient({
  async verifyBuildingContext(_buildingId, request) {
    requests.push(request);
    return SERVER_RETURNED_PASSPORT;
  },
});
```

Required assertions:

```text
getBuilding receives the exact route buildingId
managementMode/heatingType initialize from the returned DTO
primaryUse/approvalYear are visible but have no editable control
when ownerSuppliedBoiler is true/false, the selected exact boolean is sent
when ownerSuppliedBoiler is undefined, no boiler control is rendered and the request has no ownerSuppliedBoiler key
saved display uses SERVER_RETURNED_PASSPORT, not the local input guess
second save press while the first request is pending does not create a duplicate request
ApiClientError shows sanitized action error and preserves the last passport
copy contains context-confirmation/demo language and does not claim ownership/authentication verification
back callback fires
```

- [ ] **Step 2: Run the focused Building test and verify RED**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/building-detail.test.tsx
```

Expected: FAIL because `BuildingDetail` does not exist.

- [ ] **Step 3: Implement the Building screen without new dependencies**

Use `ActionButton` groups for the two closed public enums:

```ts
const MANAGEMENT_MODES = [
  { value: "OWNER_DIRECT" as const, label: "임대인 직접 관리" },
  { value: "MANAGEMENT_OFFICE" as const, label: "관리사무소" },
];

const HEATING_TYPES = [
  { value: "INDIVIDUAL" as const, label: "개별난방" },
  { value: "CENTRAL_SHARED" as const, label: "중앙·공용난방" },
];
```

State for `ownerSuppliedBoiler` must be `boolean | undefined`. Build the request exactly as:

```ts
const request: OwnerVerificationRequest = {
  managementMode,
  heatingType,
  ...(ownerSuppliedBoiler === undefined ? {} : { ownerSuppliedBoiler }),
};
```

When defined, render two accessible `ActionButton` choices `예` and `아니오`; when undefined, render no boiler mutation control. After a successful save, apply every form field from the returned passport, including returning boiler state to `undefined` if the server response omits it.

Use `contextRows(passport)` from Task 1 to distinguish routing context from informational context. Include visible copy equivalent to `DEMO 건물 정보 확인 · 실제 소유권/본인 인증 기능이 아닙니다.`

- [ ] **Step 4: Add the Building route wrapper**

Create `apps/mobile/src/app/landlord/buildings/[buildingId].tsx`:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../../components/ui";
import { BuildingDetail } from "../../../features/landlord/building-detail";
import { useMobileApiClient } from "../../../lib/use-api-client";

export default function LandlordBuildingRoute() {
  const params = useLocalSearchParams<{ buildingId?: string }>();
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) return <ConfigErrorScreen />;

  const buildingId = typeof params.buildingId === "string" ? params.buildingId : "";
  return (
    <BuildingDetail
      buildingId={buildingId}
      client={client}
      onBack={() => router.replace("/landlord")}
    />
  );
}
```

- [ ] **Step 5: Run the focused tests and typecheck Mobile**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/logic.test.ts src/features/landlord/building-detail.test.tsx
npm --workspace @build-manager/mobile run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the Building flow locally**

```bash
git add apps/mobile/src/app/landlord/buildings/[buildingId].tsx apps/mobile/src/features/landlord/building-detail.tsx apps/mobile/src/features/landlord/building-detail.test.tsx
git diff --cached --check
git commit -m "feat: add landlord building context confirmation"
```

Do not push yet.

---

### Task 4: Implement Compact Repair Packet Review and Human Actions

**Files:**
- Create: `apps/mobile/src/features/landlord/ticket-review.test.tsx`
- Create: `apps/mobile/src/features/landlord/ticket-review.tsx`
- Create: `apps/mobile/src/app/landlord/tickets/[ticketId].tsx`

**Interfaces:**
- `TicketReview({ client, ticketId, onBack })`
- Read: `client.getLandlordTicket(ticketId)`.
- Actions: `client.approveRoute(ticketId)`, `client.overrideRoute(ticketId, { routeCode, reason })`, `client.requestMoreInfo(ticketId, { reason, requestedQuestionIds?, requestedEvidenceTypes? })`.
- Uses Task 1 presentation guards only; it must never import server/domain logic.

- [ ] **Step 1: Write RED tests for packet rendering and all three actions**

Build local test DTOs with arbitrary test-only IDs. Required tests:

```text
loading while getLandlordTicket is unresolved
exact route ticketId is passed to getLandlordTicket
summary, revision, recommendation label, recommendation reasons, provenance, status and evidence status render from DTO
internalNotes/estimatedCost/affectedUnits/hiddenContacts are not rendered
approve calls approveRoute only when canApprove() is true
approve success replaces the displayed DTO with the returned APPROVED DTO
override excludes the recommended route but offers every other public RouteCode
override with no recommendation exposes all 5 public RouteCodes
override whitespace-only reason stays disabled and never calls API
override sends the exact untrimmed entered reason string and exact selected RouteCode
each of status/evidenceStatus/packet safety escalation removes ordinary override controls and never calls overrideRoute
more-info controls are enabled only for READY_FOR_REVIEW or PARTIAL
question and evidence choices are generated only from followUpOptions
more-info requires a non-whitespace reason and at least one selected item
empty selection arrays are omitted; populated IDs/types are sent exactly
successful more-info renders the returned NEEDS_MORE_INFO DTO
ApiClientError mutation failure preserves the current validated DTO and shows sanitized copy
arbitrary error does not reveal host/stack/payload text
back callback fires
```

For exact reason preservation, use a value with surrounding spaces:

```ts
const reason = "  현장 확인 후 임대인이 직접 검토  ";
await fireEvent.changeText(screen.getByTestId("override-reason"), reason);
await fireEvent.press(screen.getByTestId("override-submit"));
await waitFor(() => expect(overrideCalls[0]?.reason).toBe(reason));
```

For more-info, use one returned question ID and one returned evidence type and assert no app-invented item appears.

- [ ] **Step 2: Run the focused Ticket test and verify RED**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/ticket-review.test.tsx
```

Expected: FAIL because `TicketReview` does not exist.

- [ ] **Step 3: Implement the ticket loading and compact packet view**

Create `apps/mobile/src/features/landlord/ticket-review.tsx` with:

```ts
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ticket: LandlordTicketDetailDto };
```

Render only approved compact fields. Never display `internalNotes`, `estimatedCost`, `affectedUnits`, or `hiddenContacts` even though the landlord DTO carries them. Use `recommendationState()` to explain no-recommendation states without inventing a route. Render `repairPacket.provenance` as server-provided keys; do not infer additional provenance.

- [ ] **Step 4: Implement approve and override with returned-state replacement**

Use one helper that accepts an async action and applies the returned DTO:

```ts
async function runAction(
  action: (client: ApiClient) => Promise<LandlordTicketDetailDto>,
) {
  if (busy) return;
  setBusy(true);
  setActionError(null);
  try {
    const next = await action(client);
    setState({ kind: "ready", ticket: next });
    setSelectedRoute(overrideOptions(next)[0]?.routeCode ?? "");
  } catch (error) {
    setActionError(describeMobileError(error));
  } finally {
    setBusy(false);
  }
}
```

`Approve` calls only `client.approveRoute(ticketId)`.

Override uses `overrideOptions(ticket)` from Task 1. Render options as selectable `ActionButton`s; do not add Picker dependencies. Use a `TextInput` for `reason`. Enable submit only when `selectedRoute !== ""`, `reason.trim().length > 0`, and `busy === false`. Send `reason` unchanged.

When `isSafetyEscalated(ticket)` is true, render a clear human-review safety message and no ordinary override choice/submit control. Do not provide emergency instructions such as phone numbers, valve/electrical operating steps, or diagnosis.

- [ ] **Step 5: Implement actionable more-info from `followUpOptions` only**

Maintain selected `requestedQuestionIds: string[]` and `requestedEvidenceTypes: SyntheticEvidenceType[]`. Toggle only values obtained from the current DTO. Submission payload must be:

```ts
client.requestMoreInfo(ticketId, {
  reason: moreInfoReason,
  requestedQuestionIds:
    requestedQuestionIds.length === 0 ? undefined : requestedQuestionIds,
  requestedEvidenceTypes:
    requestedEvidenceTypes.length === 0 ? undefined : requestedEvidenceTypes,
});
```

Do not clear or synthesize follow-up options locally. The returned server DTO becomes the screen state.

- [ ] **Step 6: Add the Ticket route wrapper**

Create `apps/mobile/src/app/landlord/tickets/[ticketId].tsx` using the established Tenant route parameter pattern:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../../components/ui";
import { TicketReview } from "../../../features/landlord/ticket-review";
import { useMobileApiClient } from "../../../lib/use-api-client";

export default function LandlordTicketRoute() {
  const params = useLocalSearchParams<{ ticketId?: string }>();
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) return <ConfigErrorScreen />;

  const ticketId = typeof params.ticketId === "string" ? params.ticketId : "";
  return (
    <TicketReview
      client={client}
      ticketId={ticketId}
      onBack={() => router.replace("/landlord")}
    />
  );
}
```

- [ ] **Step 7: Run Landlord feature tests and Mobile typecheck**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/logic.test.ts src/features/landlord/landlord-home.test.tsx src/features/landlord/building-detail.test.tsx src/features/landlord/ticket-review.test.tsx
npm --workspace @build-manager/mobile run typecheck
```

Expected: 0 test failures and typecheck exit 0.

- [ ] **Step 8: Commit ticket review locally**

```bash
git add apps/mobile/src/app/landlord/tickets/[ticketId].tsx apps/mobile/src/features/landlord/ticket-review.tsx apps/mobile/src/features/landlord/ticket-review.test.tsx
git diff --cached --check
git commit -m "feat: add landlord ticket review"
```

Do not push yet.

---

### Task 5: Replace Placeholder Route Assertions and Update Mobile Documentation

**Files:**
- Modify: `apps/mobile/src/testing/role-navigation.test.tsx`
- Modify: `apps/mobile/README.md`

**Interfaces:**
- Real route tree remains `src/app`.
- Missing `EXPO_PUBLIC_API_URL` must render `ConfigErrorScreen` before feature API calls on every Landlord route.
- Existing Tenant role and config-error tests remain intact.

- [ ] **Step 1: Replace only the obsolete Landlord-placeholder tests**

Delete the assertions for:

```text
"임대인 앱 데모는 다음 단계에서 연결됩니다."
Landlord screen has no loading/error because it calls no API
```

Keep both existing role-entry navigation tests. Add missing-config coverage using the current test environment where `EXPO_PUBLIC_API_URL` is unset:

```ts
it.each([
  "/landlord",
  "/landlord/buildings/server-building-id",
  "/landlord/tickets/server-ticket-id",
])("shows configuration guidance on %s", async (initialUrl) => {
  await renderApp(initialUrl);
  expect(await screen.findByTestId("config-error")).toBeTruthy();
  expect(
    screen.getByText(/EXPO_PUBLIC_API_URL을 설정한 뒤 앱을 다시 실행해 주세요/),
  ).toBeTruthy();
});
```

Preserve the existing Tenant configuration cases and the role-entry -> `/landlord` assertion. The Home feature test, not this missing-config route test, owns the explicit back-to-role callback behavior once a client exists.

- [ ] **Step 2: Run the real-route navigation test and verify GREEN**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/testing/role-navigation.test.tsx
```

Expected: PASS and no placeholder copy remains in the test.

- [ ] **Step 3: Update `apps/mobile/README.md` to describe both roles**

Change the title from `# Tenant demo app` to `# Building-aware mobile demo app`. The opening paragraphs must state:

```text
- Expo Router app contains Tenant and Landlord demo flows.
- Server remains authoritative for Safety / Protocol / Evidence / Routing.
- Landlord App confirms demo building context and records human review decisions; it does not authenticate ownership.
- EXPO_PUBLIC_API_URL remains the only required non-secret runtime configuration.
```

Keep the existing configuration restrictions and test command. Remove the stale statement that describes the app as tenant-only. Do not add a `.env.example`.

- [ ] **Step 4: Run all Mobile tests, lint, and Mobile typecheck**

From repository root:

```bash
npm run test:mobile
npm --workspace @build-manager/mobile run lint
npm --workspace @build-manager/mobile run typecheck
```

Expected: each command exits 0. The full Mobile suite must include the existing Tenant tests and `server-authority.test.ts`, which automatically scans new Landlord production sources for hard-coded demo building IDs, protocol names/question IDs, and evidence fixture IDs.

- [ ] **Step 5: Commit route regression/docs locally**

```bash
git add apps/mobile/src/testing/role-navigation.test.tsx apps/mobile/README.md
git diff --cached --check
git commit -m "test: lock landlord mobile routes"
```

Do not push yet.

---

### Task 6: Run the Task 16 Freeze Gate Before Any Push

**Files:**
- No product-code file is created solely for this task.
- Execution-log rows are operational metadata. If the worker cannot safely append the canonical `main/ops/AI_Execution_Log.csv` without merging or changing branches, queue sanitized event rows locally and report `PENDING`; do not merge `main` into the product branch to satisfy logging.

**Interfaces:**
- Validates all Task 16 changes against the approved design and the frozen Task 15 behavior.
- Produces the exact final HEAD/tree/test evidence used for acceptance.

- [ ] **Step 1: Verify the changed-file scope before full tests**

From repository root:

```bash
git diff --name-only c1eb036d39735c4c45e1ad585c06c13293a22908..HEAD
git diff --check c1eb036d39735c4c45e1ad585c06c13293a22908..HEAD
git status --short
```

Expected implementation paths are limited to the Task 16 design/plan docs already present plus the Mobile files listed in this plan. There must be no implementation edits under frozen Web/Tenant/shared-package paths. `git status --short` must show no unexplained pre-existing work; preserve and report any user-owned changes rather than staging them.

- [ ] **Step 2: Run complete Mobile and shared/architecture regression suites**

```bash
npm run test:mobile
npm run test:shared
```

Expected: both exit 0. Do not report only the new Landlord test count; record the full Mobile suite count and the full shared/architecture suite count.

- [ ] **Step 3: Run root lint, typecheck, and dependency tree checks**

```bash
npm run lint
npm run typecheck
npm run check:deps
```

Expected: all exit 0. `npm run typecheck` already includes package typecheck, configured test typecheck, Web typecheck, and Mobile typecheck. Do not claim `typecheck:tests` separately unless its command output is actually observed through this root command or run directly.

- [ ] **Step 4: Produce the Android task-level bundle smoke**

From repository root:

```bash
cd apps/mobile
npx expo export --platform android --output-dir .expo-export-android
cd ../..
```

Expected: Expo export exits 0 and writes the ignored `.expo-export-android` output. This proves bundle generation only; it does not prove emulator, physical-device, iOS, Expo Doctor, or EAS behavior.

- [ ] **Step 5: Run the public repository/history gate before pushing**

Use the Python launcher already proven in the execution environment. Preferred command from repository root:

```bash
python scripts/verify_repository.py --history
```

If this environment uses `python3` instead of `python`, run `python3 scripts/verify_repository.py --history` and report that exact substitution. Do not weaken patterns or add scan exceptions to make Task 16 pass.

Expected JSON includes:

```json
{"findings": [], "result": "PASS"}
```

Also run:

```bash
git diff --check
git status --short
git log --oneline --decorate c1eb036d39735c4c45e1ad585c06c13293a22908..HEAD
```

- [ ] **Step 6: Inspect staged/committed history and push only after all gates pass**

Verify no real personal data, credential, host-bearing secret, raw media, or unrelated user file appears in Task 16 commits. Then perform one normal fast-forward push:

```bash
git push origin feat/building-aware-mvp
```

No force push, amend, interactive rebase, reset, or history rewrite.

- [ ] **Step 7: Verify the remote ref after push**

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/feat/building-aware-mvp
git rev-parse HEAD^{tree}
git status --short
```

Expected: local HEAD equals the remote feature ref; worktree is clean apart from explicitly reported ignored/export artifacts or unrelated user-owned files.

- [ ] **Step 8: Produce the Task 16 handoff and stop**

Report exactly:

```text
TASK 16 STATUS: FROZEN or STOP_AND_REPORT
START TARGET_REF
FINAL LOCAL HEAD
FINAL REMOTE HEAD
FINAL TREE SHA
COMMITS CREATED (messages + SHAs; no required count)
MOBILE TEST RESULT (full suite count)
SHARED/ARCHITECTURE TEST RESULT (full suite count)
LINT RESULT
TYPECHECK RESULT
DEPENDENCY CHECK RESULT
ANDROID EXPORT RESULT
REPOSITORY/HISTORY SCAN RESULT (history blob count + findings count)
CHANGED FILES
TASK 15 TENANT REGRESSION STATUS
WEB/TENANT/SHARED FROZEN-SCOPE CHECK
DEFERRED: Expo Doctor, iOS export/bundle, cross-platform Hero B, real-device validation
EXECUTION LOG SYNC: synced or PENDING with transport/evidence
```

If any required Task 16 gate fails for a Task 16 cause, status is `STOP_AND_REPORT`, not FROZEN. If an unrelated pre-existing baseline failure appears, separate it with exact command/output evidence; do not silently waive it and do not reopen frozen product scope without BLOCKER/HIGH evidence.

Do not begin Hero B, Expo Doctor/iOS Mobile Health, EAS, or any later task in the same execution.
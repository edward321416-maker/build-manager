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
- Every local implementation commit must leave the tests relevant to that commit green. Do not intentionally commit obsolete failing assertions for a later task to repair.
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
  recommendationState,
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
    expect(recommendationState(value)).toBe("SAFETY_ESCALATED");
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
    expect(recommendationState(value)).toBe("MISSING_REQUIRED");
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

Create `apps/mobile/src/features/landlord/logic.ts`:

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

export type RecommendationState =
  | "RECOMMENDED"
  | "SAFETY_ESCALATED"
  | "MISSING_REQUIRED"
  | "CONFLICTING"
  | "AWAITING_INTAKE";

export function recommendationState(
  ticket: LandlordTicketDetailDto,
): RecommendationState {
  if (ticket.repairPacket === null) return "AWAITING_INTAKE";
  if (isSafetyEscalated(ticket)) return "SAFETY_ESCALATED";
  if (ticket.repairPacket.recommendation !== null) return "RECOMMENDED";
  if (ticket.evidenceStatus === "CONFLICTING") return "CONFLICTING";
  return "MISSING_REQUIRED";
}

export type ContextRow = {
  key: string;
  label: string;
  value: string;
  routingEligible: boolean;
};

const CONTEXT_LABELS: Record<string, string> = {
  managementMode: "관리 방식",
  heatingType: "난방 방식",
  ownerSuppliedBoiler: "임대인 공급 보일러",
  primaryUse: "주용도",
  approvalYear: "사용승인 연도",
};

const VALUE_LABELS: Record<string, string> = {
  OWNER_DIRECT: "임대인 직접 관리",
  MANAGEMENT_OFFICE: "관리사무소",
  INDIVIDUAL: "개별난방",
  CENTRAL_SHARED: "중앙·공용난방",
};

function display(value: string | boolean): string {
  if (typeof value === "boolean") return value ? "예" : "아니오";
  return VALUE_LABELS[value] ?? value;
}

export function contextRows(passport: BuildingPassportDto): ContextRow[] {
  const rows: Array<{ key: string; value: string }> = [
    { key: "managementMode", value: display(passport.managementMode) },
    { key: "heatingType", value: display(passport.heatingType) },
    ...(passport.ownerSuppliedBoiler === undefined
      ? []
      : [{
          key: "ownerSuppliedBoiler",
          value: display(passport.ownerSuppliedBoiler),
        }]),
    { key: "primaryUse", value: passport.primaryUse },
    { key: "approvalYear", value: passport.approvalYear },
  ];

  return rows.map((row) => ({
    ...row,
    label: CONTEXT_LABELS[row.key] ?? row.key,
    routingEligible: passport.routingEligibleFields.some(
      (field) => field === row.key,
    ),
  }));
}
```

Do not add `contextVerified` interpretation beyond displaying returned context. The routing eligibility list already comes from the server DTO.

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

### Task 2: Implement Landlord Home and Replace the Placeholder Route Contract

**Files:**
- Create: `apps/mobile/src/features/landlord/landlord-home.test.tsx`
- Create: `apps/mobile/src/features/landlord/landlord-home.tsx`
- Modify: `apps/mobile/src/app/landlord/index.tsx`
- Modify: `apps/mobile/src/testing/role-navigation.test.tsx`

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

Add concrete tests using unresolved promises and callbacks:

```ts
it("shows loading until home reads settle", async () => {
  const client = stubClient({
    listDemoBuildings: () => new Promise<BuildingPassportDto[]>(() => {}),
  });
  await render(
    <LandlordHome
      client={client}
      onBackToRoles={jest.fn()}
      onBuildingOpen={jest.fn()}
      onTicketOpen={jest.fn()}
    />,
  );
  expect(screen.getByTestId("loading")).toBeTruthy();
});

it("passes server identities to navigation callbacks", async () => {
  const onBuildingOpen = jest.fn();
  const onTicketOpen = jest.fn();
  await render(
    <LandlordHome
      client={stubClient()}
      onBackToRoles={jest.fn()}
      onBuildingOpen={onBuildingOpen}
      onTicketOpen={onTicketOpen}
    />,
  );
  await fireEvent.press(await screen.findByTestId("building-building-server-id"));
  await fireEvent.press(screen.getByTestId("ticket-ticket-server-id"));
  expect(onBuildingOpen).toHaveBeenCalledWith("building-server-id");
  expect(onTicketOpen).toHaveBeenCalledWith("ticket-server-id");
});
```

Also assert `onBackToRoles` fires, `tickets=[]` renders `접수된 수리 요청이 없습니다.`, `ApiClientError` produces its sanitized message and retry, and an arbitrary `Error("connect ECONNREFUSED 10.0.2.2:3000")` never renders `10.0.2.2`.

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

`fetchHome()` calls both reads with `Promise.all`:

```ts
const fetchHome = useCallback(async (): Promise<LoadState> => {
  try {
    const [buildings, tickets] = await Promise.all([
      client.listDemoBuildings(),
      client.listTickets({ view: "landlord" }),
    ]);
    return { kind: "ready", buildings, tickets };
  } catch (error) {
    return { kind: "error", message: describeMobileError(error) };
  }
}, [client]);
```

Mount uses the same cancellation pattern as `TenantHome`; `reload()` sets `loading` before rerunning `fetchHome()`. Render `Screen` + `DemoBanner`, landlord header copy, building `ActionButton`s with `testID={`building-${building.buildingId}`}`, ticket buttons with `testID={`ticket-${ticket.ticketId}`}`, zero-ticket copy, and `역할 선택으로 돌아가기` wired only to `onBackToRoles`.

Do not hard-code either demo building ID, ticket ID, protocol, or recommendation.

- [ ] **Step 4: Replace the placeholder route with the runtime wrapper**

`apps/mobile/src/app/landlord/index.tsx` becomes:

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

- [ ] **Step 5: Replace the obsolete Home-placeholder route assertions now**

In `apps/mobile/src/testing/role-navigation.test.tsx`, remove only the `describe("landlord placeholder", ...)` block. Preserve role-entry and Tenant tests. Add a Home config-error case:

```ts
it("renders configuration guidance instead of the old landlord placeholder", async () => {
  await renderApp("/landlord");
  expect(await screen.findByTestId("config-error")).toBeTruthy();
  expect(
    screen.getByText(/EXPO_PUBLIC_API_URL을 설정한 뒤 앱을 다시 실행해 주세요/),
  ).toBeTruthy();
  expect(
    screen.queryByText("임대인 앱 데모는 다음 단계에서 연결됩니다."),
  ).toBeNull();
});
```

Do not remove `navigates into the landlord stack`; it must continue to assert `/landlord`.

- [ ] **Step 6: Run Home, route, and full Mobile tests before committing**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/landlord-home.test.tsx src/testing/role-navigation.test.tsx
npm run test:mobile
```

Expected: both commands exit 0. There must be no intentionally failing placeholder assertion left in the commit.

- [ ] **Step 7: Commit the Home behavior locally**

```bash
git add apps/mobile/src/app/landlord/index.tsx apps/mobile/src/features/landlord/landlord-home.tsx apps/mobile/src/features/landlord/landlord-home.test.tsx apps/mobile/src/testing/role-navigation.test.tsx
git diff --cached --check
git commit -m "feat: add landlord mobile home"
```

Do not push yet.

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

Capture requests rather than asserting only rendered text:

```ts
const requests: OwnerVerificationRequest[] = [];
const client = stubClient({
  async verifyBuildingContext(_buildingId, request) {
    requests.push(request);
    return SERVER_RETURNED_PASSPORT;
  },
});
```

For a defined boiler value:

```ts
await fireEvent.press(await screen.findByTestId("management-MANAGEMENT_OFFICE"));
await fireEvent.press(screen.getByTestId("heating-CENTRAL_SHARED"));
await fireEvent.press(screen.getByTestId("boiler-false"));
await fireEvent.press(screen.getByTestId("save-context"));
await waitFor(() => expect(requests).toHaveLength(1));
expect(requests[0]).toEqual({
  managementMode: "MANAGEMENT_OFFICE",
  heatingType: "CENTRAL_SHARED",
  ownerSuppliedBoiler: false,
});
```

For an absent boiler value:

```ts
expect(screen.queryByTestId("boiler-false")).toBeNull();
await fireEvent.press(screen.getByTestId("save-context"));
await waitFor(() => expect(requests).toHaveLength(1));
expect(Object.hasOwn(requests[0], "ownerSuppliedBoiler")).toBe(false);
```

Also assert exact `getBuilding(buildingId)`, informational `primaryUse`/`approvalYear` visibility without mutation controls, returned-passport rendering after save, duplicate-submit prevention while the promise is pending, sanitized mutation failure with the prior passport still visible, context-confirmation copy without ownership/authentication claims, and `onBack` invocation.

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

State for `ownerSuppliedBoiler` is `boolean | undefined`. Build the request exactly as:

```ts
const request: OwnerVerificationRequest = {
  managementMode,
  heatingType,
  ...(ownerSuppliedBoiler === undefined ? {} : { ownerSuppliedBoiler }),
};
```

When defined, render two accessible `ActionButton` choices with `testID="boiler-true"` and `testID="boiler-false"`; when undefined, render no boiler mutation control. After successful save, apply every form field from the returned passport:

```ts
setPassport(saved);
setManagementMode(saved.managementMode);
setHeatingType(saved.heatingType);
setOwnerSuppliedBoiler(saved.ownerSuppliedBoiler);
```

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

- [ ] **Step 5: Run focused, full Mobile, and Mobile typecheck gates**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/logic.test.ts src/features/landlord/building-detail.test.tsx
npm run test:mobile
npm --workspace @build-manager/mobile run typecheck
```

Expected: all commands exit 0.

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

Create typed ticket fixtures with arbitrary test-only IDs. Exact action preservation must include:

```ts
it("sends the selected override route and entered reason unchanged", async () => {
  const calls: Array<{ routeCode: RouteCode; reason: string }> = [];
  const client = stubClient({
    async overrideRoute(_ticketId, input) {
      calls.push(input);
      return OVERRIDDEN_TICKET;
    },
  });
  await render(<TicketReview client={client} ticketId="ticket-server-id" onBack={jest.fn()} />);
  await screen.findByText("합성 누수 요청");

  await fireEvent.press(screen.getByTestId("route-LANDLORD_REVIEW"));
  const reason = "  현장 확인 후 임대인이 직접 검토  ";
  await fireEvent.changeText(screen.getByTestId("override-reason"), reason);
  await fireEvent.press(screen.getByTestId("override-submit"));

  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual({ routeCode: "LANDLORD_REVIEW", reason });
});
```

Safety coverage must parameterize all three returned indicators and prove `overrideRoute` is not called:

```ts
it.each([
  { status: "SAFETY_ESCALATED" as const },
  { evidenceStatus: "SAFETY_ESCALATED" as const },
  { repairPacket: { ...BASE_TICKET.repairPacket!, safetyEscalated: true } },
])("suppresses override for returned safety state", async (override) => {
  const overrideRoute = jest.fn();
  await render(
    <TicketReview
      client={stubClient({
        getLandlordTicket: async () => ({ ...BASE_TICKET, ...override }),
        overrideRoute,
      })}
      ticketId="ticket-server-id"
      onBack={jest.fn()}
    />,
  );
  expect(await screen.findByTestId("override-unavailable")).toBeTruthy();
  expect(screen.queryByTestId("override-submit")).toBeNull();
  expect(overrideRoute).not.toHaveBeenCalled();
});
```

More-info payload coverage must select only returned options:

```ts
await fireEvent.changeText(
  screen.getByTestId("more-info-reason"),
  "  누수 위치를 다시 확인해 주세요  ",
);
await fireEvent.press(screen.getByTestId("followup-question-q-server"));
await fireEvent.press(screen.getByTestId("followup-evidence-LEAK_LOCATION"));
await fireEvent.press(screen.getByTestId("more-info-submit"));
await waitFor(() => expect(moreInfoCalls).toHaveLength(1));
expect(moreInfoCalls[0]).toEqual({
  reason: "  누수 위치를 다시 확인해 주세요  ",
  requestedQuestionIds: ["q-server"],
  requestedEvidenceTypes: ["LEAK_LOCATION"],
});
```

Also assert: loading while `getLandlordTicket` is unresolved; exact route `ticketId`; compact fields render; excluded packet fields never render; approve calls only when offered and uses returned `APPROVED` DTO; manual no-recommendation state exposes all five route codes; whitespace-only override/more-info reasons stay disabled; more-info with no selected item stays disabled; successful more-info renders returned `NEEDS_MORE_INFO` DTO; sanitized errors preserve current DTO; arbitrary error host text is hidden; `onBack` fires.

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

Use `getLandlordTicket(ticketId)` inside a cancellable mount load and `describeMobileError()` for load/action failures. Render only ticket/building identity, issue/protocol/status/evidence status, packet revision/summary, recommendation label/reasons, provenance, follow-up choices, and recorded decision. Never render `internalNotes`, `estimatedCost`, `affectedUnits`, or `hiddenContacts`.

No-recommendation copy must be keyed from `recommendationState(ticket)`:

```ts
const NO_RECOMMENDATION_REASON: Record<RecommendationState, string> = {
  RECOMMENDED: "",
  SAFETY_ESCALATED: "안전 확인이 필요해 일반 추천을 중단했습니다.",
  MISSING_REQUIRED: "필수 정보가 부족해 추천 경로가 없습니다.",
  CONFLICTING: "제출된 정보가 서로 어긋나 추천 경로가 없습니다.",
  AWAITING_INTAKE: "아직 접수가 끝나지 않아 추천 경로가 없습니다.",
};
```

- [ ] **Step 4: Implement approve and override with returned-state replacement**

Use one action helper:

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

`Approve` calls only `client.approveRoute(ticketId)` and is disabled when `!canApprove(ticket)`.

Override options come only from `overrideOptions(ticket)`. Render them as selectable `ActionButton`s with `testID={`route-${option.routeCode}`}`. Use a `TextInput` `testID="override-reason"`. Enable `override-submit` only when `selectedRoute !== ""`, `overrideReason.trim().length > 0`, and not busy. Send `overrideReason` unchanged.

When `isSafetyEscalated(ticket)` is true, render `testID="override-unavailable"` with a human-review safety message and render no ordinary route choice/submit control. Do not add emergency phone numbers, valve/electrical operating instructions, diagnosis, or repair advice.

- [ ] **Step 5: Implement actionable more-info from `followUpOptions` only**

Maintain `requestedQuestionIds: string[]` and `requestedEvidenceTypes: SyntheticEvidenceType[]`. Render only options returned on the DTO with these test IDs:

```text
followup-question-<questionId>
followup-evidence-<evidenceType>
```

Submission is enabled only when `canRequestMoreInfo(ticket)`, the reason is not whitespace-only, at least one item is selected, and not busy. Payload:

```ts
client.requestMoreInfo(ticketId, {
  reason: moreInfoReason,
  requestedQuestionIds:
    requestedQuestionIds.length === 0 ? undefined : requestedQuestionIds,
  requestedEvidenceTypes:
    requestedEvidenceTypes.length === 0 ? undefined : requestedEvidenceTypes,
});
```

Do not clear, invent, or expand follow-up options locally. Use the returned server DTO after success.

- [ ] **Step 6: Add the Ticket route wrapper**

Create `apps/mobile/src/app/landlord/tickets/[ticketId].tsx`:

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

- [ ] **Step 7: Run Landlord feature, full Mobile, and Mobile typecheck gates**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/features/landlord/logic.test.ts src/features/landlord/landlord-home.test.tsx src/features/landlord/building-detail.test.tsx src/features/landlord/ticket-review.test.tsx
npm run test:mobile
npm --workspace @build-manager/mobile run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit ticket review locally**

```bash
git add apps/mobile/src/app/landlord/tickets/[ticketId].tsx apps/mobile/src/features/landlord/ticket-review.tsx apps/mobile/src/features/landlord/ticket-review.test.tsx
git diff --cached --check
git commit -m "feat: add landlord ticket review"
```

Do not push yet.

---

### Task 5: Extend Real-Route Config Regression and Update Mobile Documentation

**Files:**
- Modify: `apps/mobile/src/testing/role-navigation.test.tsx`
- Modify: `apps/mobile/README.md`

**Interfaces:**
- Real route tree remains `src/app`.
- Missing `EXPO_PUBLIC_API_URL` renders `ConfigErrorScreen` before feature API calls on every Landlord route.
- Existing Tenant role and config-error tests remain intact.

- [ ] **Step 1: Extend missing-config coverage to the new detail routes**

Keep the Task 2 `/landlord` config test and add:

```ts
it.each([
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

Preserve role-entry -> `/tenant`, role-entry -> `/landlord`, and both existing Tenant config-error cases. Do not reintroduce the old Landlord placeholder copy.

- [ ] **Step 2: Run the real-route navigation test and verify GREEN**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/testing/role-navigation.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Update `apps/mobile/README.md` to describe both roles and correct the server command**

Change the title to:

```markdown
# Building-aware mobile demo app
```

Opening content must state that Expo Router contains Tenant and Landlord demo flows, the server remains authoritative for Safety/Protocol/Evidence/Routing, and Landlord context confirmation is not ownership authentication.

Preserve the `EXPO_PUBLIC_API_URL` rules and `npm run test:mobile` test command. Keep `.env.local` ignored and do not add `.env.example`.

Replace the stale server instruction `npm run dev:web` with the actual current workspace script:

```bash
npm --workspace @build-manager/web run dev
```

The Mobile run command remains:

```bash
npm --workspace @build-manager/mobile run android
```

- [ ] **Step 4: Run all Mobile tests, lint, and Mobile typecheck**

```bash
npm run test:mobile
npm --workspace @build-manager/mobile run lint
npm --workspace @build-manager/mobile run typecheck
```

Expected: each command exits 0. The full Mobile suite includes existing Tenant tests and `server-authority.test.ts`, which automatically scans new Landlord production sources for hard-coded demo building IDs, protocol names/question IDs, and evidence fixture IDs.

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

Expected paths are limited to the Task 16 design/plan docs already present plus the Mobile files listed in this plan. There must be no implementation edits under frozen Web/Tenant/shared-package paths. `git status --short` must show no unexplained pre-existing work; preserve and report any user-owned changes rather than staging them.

- [ ] **Step 2: Run complete Mobile and shared/architecture regression suites**

```bash
npm run test:mobile
npm run test:shared
```

Expected: both exit 0. Record the full Mobile suite count and the full shared/architecture suite count, not only new Landlord tests.

- [ ] **Step 3: Run root lint, typecheck, and dependency tree checks**

```bash
npm run lint
npm run typecheck
npm run check:deps
```

Expected: all exit 0. `npm run typecheck` already includes package typecheck, configured test typecheck, Web typecheck, and Mobile typecheck.

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

- [ ] **Step 6: Inspect committed history and push only after all gates pass**

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
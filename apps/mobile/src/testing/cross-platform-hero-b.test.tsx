import type { ApiClient } from "@build-manager/api-client";
import { LandlordTicketDetailDtoSchema } from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { TicketReview } from "../features/landlord/ticket-review";

/**
 * Hero B, native-presentation half.
 *
 * The Web proof establishes that the authoritative server produces this
 * landlord contract for Building B heating. This proves the App Landlord screen
 * renders that same public contract and records the human approval through the
 * shared client.
 *
 * The fixture is parsed by the public schema rather than cast, so a contract
 * drift fails here instead of being hidden by a type assertion. It states the
 * server's result; nothing about routing is recomputed on this side.
 */
const HERO_B_TICKET_ID = "hero-b-building-b-heating";

const heroB = LandlordTicketDetailDtoSchema.parse({
  ticketId: HERO_B_TICKET_ID,
  building: {
    buildingId: "demo-building-b",
    displayName: "DEMO 라온하우징",
    demo: true,
    primaryUse: "공동주택",
    approvalYear: "2018",
    managementMode: "MANAGEMENT_OFFICE",
    heatingType: "CENTRAL_SHARED",
    contextVerified: true,
    routingEligibleFields: ["managementMode", "heatingType"],
  },
  issueType: "HEATING",
  protocol: "HEATING_V1",
  status: "READY_FOR_REVIEW",
  evidenceStatus: "COMPLETE",
  activeQuestion: null,
  repairPacket: {
    revision: 1,
    summary: "난방 접수 건입니다. 필수 정보가 준비되었습니다.",
    safetyEscalated: false,
    recommendation: {
      routeCode: "MANAGEMENT_OFFICE",
      label: "관리사무소",
      reasons: [
        "공용난방 및 관리사무소 관리의 검증된 건물 정보를 기준으로 관리사무소 검토가 우선입니다.",
      ],
    },
    routeAlternatives: [{ routeCode: "LANDLORD_REVIEW", label: "임대인 검토" }],
    provenance: ["heatingType", "managementMode"],
    internalNotes: ["HERO_B_INTERNAL_ONLY"],
    estimatedCost: { currency: "KRW", minimum: 10000, maximum: 20000 },
    affectedUnits: ["203호"],
    hiddenContacts: ["HERO_B_HIDDEN_CONTACT"],
  },
  decision: null,
  followUpOptions: {
    questions: [],
    evidence: [],
  },
});

const approvedHeroB = LandlordTicketDetailDtoSchema.parse({
  ...heroB,
  status: "APPROVED",
  decision: { type: "APPROVE" },
});

test("Hero B: App Landlord renders and approves the management-office contract", async () => {
  const getLandlordTicket = jest.fn(async (ticketId: string) => {
    expect(ticketId).toBe(HERO_B_TICKET_ID);
    return heroB;
  });
  const approveRoute = jest.fn(async (ticketId: string) => {
    expect(ticketId).toBe(HERO_B_TICKET_ID);
    return approvedHeroB;
  });

  const client = {
    getLandlordTicket,
    approveRoute,
    overrideRoute: jest.fn(),
    requestMoreInfo: jest.fn(),
  } as unknown as ApiClient;

  await render(
    <TicketReview
      client={client}
      onBack={jest.fn()}
      ticketId={HERO_B_TICKET_ID}
    />,
  );

  expect(await screen.findByText("관리사무소")).toBeTruthy();
  expect(
    screen.getByText(
      "공용난방 및 관리사무소 관리의 검증된 건물 정보를 기준으로 관리사무소 검토가 우선입니다.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("heatingType")).toBeTruthy();
  expect(screen.getByText("managementMode")).toBeTruthy();

  // Approving is the path for the recommended route, so it is not a manual choice.
  expect(screen.queryByTestId("route-MANAGEMENT_OFFICE")).toBeNull();
  expect(screen.getByTestId("route-LANDLORD_REVIEW")).toBeTruthy();

  expect(screen.queryByText("HERO_B_INTERNAL_ONLY")).toBeNull();
  expect(screen.queryByText("HERO_B_HIDDEN_CONTACT")).toBeNull();
  expect(screen.queryByText("203호")).toBeNull();
  expect(screen.queryByText("10,000")).toBeNull();

  await fireEvent.press(screen.getByTestId("approve"));

  await waitFor(() => expect(approveRoute).toHaveBeenCalledTimes(1));
  expect(approveRoute).toHaveBeenCalledWith(HERO_B_TICKET_ID);
  expect(await screen.findByText("상태: 승인됨")).toBeTruthy();
  // This file holds a single test, so a cold Jest transform cache charges the
  // whole React Native module graph to it. Warm runs finish in well under a
  // second; the allowance only covers that first-run compile.
}, 30_000);

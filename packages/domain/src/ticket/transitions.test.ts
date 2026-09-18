import { describe, expect, it } from "vitest";
import { applyRouteDecision, requestMoreInfo } from "./transitions";
import type {
  MoreInfoRequest,
  RepairPacket,
  RouteDecision,
  Ticket,
  TicketStatus,
} from "./types";

const AT = "2026-09-14T03:00:00.000Z";
const LATER = "2026-09-14T04:00:00.000Z";

function packet(overrides: Partial<RepairPacket> = {}): RepairPacket {
  return {
    ticketId: "ticket-a",
    revision: 1,
    issueType: "HEATING",
    userReport: { rawText: "난방이 되지 않습니다." },
    structuredSymptoms: {},
    contextSnapshot: { routingBasis: [], informational: [] },
    evidenceState: "COMPLETE",
    evidence: [],
    safety: { flags: [], escalated: false },
    recommendation: {
      primary: "LANDLORD_REVIEW",
      alternatives: ["MANUFACTURER_AS"],
      rationale: [],
      humanReviewRequired: true,
    },
    generatedSummary: { text: "요약", source: "TEMPLATE" },
    createdAt: AT,
    ...overrides,
  };
}

function ticket(status: TicketStatus, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-a",
    buildingId: "demo-building-a",
    unitId: "demo-unit-a",
    issueType: "HEATING",
    rawUserText: "난방이 되지 않습니다.",
    status,
    protocolId: "HEATING_INDIVIDUAL_V1",
    answers: [],
    evidence: [],
    safetyFlags: [],
    repairPacket: packet(),
    routeDecision: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

const moreInfo: MoreInfoRequest = {
  action: "REQUEST_MORE_INFO",
  reason: "누수 위치 확인이 필요합니다.",
  requestedQuestionIds: ["heating.errorCode"],
  actor: "LANDLORD",
  requestedAt: LATER,
};

const approve: RouteDecision = {
  action: "APPROVE_RECOMMENDATION",
  recommendedRoute: "LANDLORD_REVIEW",
  selectedRoute: "LANDLORD_REVIEW",
  actor: "LANDLORD",
  decidedAt: LATER,
};

describe("requestMoreInfo", () => {
  it.each(["READY_FOR_REVIEW", "PARTIAL"] as const)(
    "moves a %s ticket to NEEDS_MORE_INFO",
    (status) => {
      const updated = requestMoreInfo(ticket(status), moreInfo);

      expect(updated.status).toBe("NEEDS_MORE_INFO");
      expect(updated.moreInfoRequest).toEqual(moreInfo);
      expect(updated.updatedAt).toBe(LATER);
    },
  );

  it.each(["IN_PROGRESS", "APPROVED", "OVERRIDDEN", "SAFETY_ESCALATED"] as const)(
    "refuses to request more info from %s",
    (status) => {
      expect(() => requestMoreInfo(ticket(status), moreInfo)).toThrowError(
        /cannot request more info/i,
      );
    },
  );

  it("does not mutate the ticket it was given", () => {
    const original = ticket("READY_FOR_REVIEW");

    requestMoreInfo(original, moreInfo);

    expect(original.status).toBe("READY_FOR_REVIEW");
    expect(original.moreInfoRequest).toBeUndefined();
  });
});

describe("applyRouteDecision", () => {
  it("approves the exact recommendation the packet carries", () => {
    const updated = applyRouteDecision(ticket("READY_FOR_REVIEW"), approve);

    expect(updated.status).toBe("APPROVED");
    expect(updated.routeDecision).toEqual(approve);
    expect(updated.updatedAt).toBe(LATER);
  });

  it("refuses to approve a route the packet did not recommend", () => {
    expect(() =>
      applyRouteDecision(ticket("READY_FOR_REVIEW"), {
        ...approve,
        selectedRoute: "GENERAL_VENDOR",
        recommendedRoute: "GENERAL_VENDOR",
      }),
    ).toThrowError(/does not match/i);
  });

  it("refuses to approve when there is no recommendation to approve", () => {
    const escalated = ticket("SAFETY_ESCALATED", {
      repairPacket: packet({
        recommendation: null,
        evidenceState: "SAFETY_ESCALATED",
        safety: { flags: ["GAS_SMELL"], escalated: true },
      }),
    });

    expect(() => applyRouteDecision(escalated, approve)).toThrowError(
      /no recommendation/i,
    );
  });

  it("lets a landlord override to a route the system never recommended", () => {
    const escalated = ticket("SAFETY_ESCALATED", {
      repairPacket: packet({
        recommendation: null,
        evidenceState: "SAFETY_ESCALATED",
        safety: { flags: ["GAS_SMELL"], escalated: true },
      }),
    });

    const updated = applyRouteDecision(escalated, {
      action: "OVERRIDE_ROUTE",
      recommendedRoute: null,
      selectedRoute: "MANAGEMENT_OFFICE",
      reason: "현장 확인 후 관리사무소가 적합함",
      actor: "LANDLORD",
      decidedAt: LATER,
    });

    expect(updated.status).toBe("OVERRIDDEN");
    expect(updated.routeDecision?.selectedRoute).toBe("MANAGEMENT_OFFICE");
  });

  it("does not mutate the ticket it was given", () => {
    const original = ticket("READY_FOR_REVIEW");

    applyRouteDecision(original, approve);

    expect(original.status).toBe("READY_FOR_REVIEW");
    expect(original.routeDecision).toBeNull();
  });
});

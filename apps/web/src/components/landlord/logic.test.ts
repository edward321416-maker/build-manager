import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import {
  ALL_ROUTE_CODES,
  canApprove,
  canRequestMoreInfo,
  contextRows,
  manualRouteMode,
  overrideOptions,
  recommendationState,
  routeLabel,
} from "./logic";

const passport: BuildingPassportDto = {
  buildingId: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  primaryUse: "다가구주택",
  approvalYear: "2011",
  managementMode: "OWNER_DIRECT",
  heatingType: "INDIVIDUAL",
  ownerSuppliedBoiler: true,
  contextVerified: true,
  routingEligibleFields: ["managementMode", "heatingType", "ownerSuppliedBoiler"],
};

function ticket(
  overrides: Partial<LandlordTicketDetailDto> = {},
): LandlordTicketDetailDto {
  return {
    ticketId: "ticket-a",
    building: passport,
    issueType: "LEAK",
    protocol: "LEAK_V1",
    status: "READY_FOR_REVIEW",
    evidenceStatus: "COMPLETE",
    activeQuestion: null,
    repairPacket: {
      revision: 1,
      summary: "누수 접수 건입니다.",
      safetyEscalated: false,
      recommendation: {
        routeCode: "MANAGEMENT_OFFICE",
        label: "관리사무소",
        reasons: ["관리사무소 관리 건물의 천장·벽 누수"],
      },
      routeAlternatives: [{ routeCode: "LANDLORD_REVIEW", label: "임대인 검토" }],
      provenance: ["managementMode", "heatingType"],
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

describe("approval availability", () => {
  it("allows approving a reviewable ticket that carries a recommendation", () => {
    expect(canApprove(ticket())).toBe(true);
  });

  it("refuses approval when the server recommended nothing", () => {
    const escalated = ticket({
      status: "SAFETY_ESCALATED",
      evidenceStatus: "SAFETY_ESCALATED",
      repairPacket: {
        ...ticket().repairPacket!,
        safetyEscalated: true,
        recommendation: null,
        routeAlternatives: [],
      },
    });

    expect(canApprove(escalated)).toBe(false);
  });

  it("refuses approval before the ticket reaches review", () => {
    expect(canApprove(ticket({ status: "IN_PROGRESS" }))).toBe(false);
    expect(canApprove(ticket({ status: "PARTIAL" }))).toBe(false);
  });

  it("refuses approval once a decision is recorded", () => {
    expect(
      canApprove(ticket({ status: "APPROVED", decision: { type: "APPROVE" } })),
    ).toBe(false);
    expect(canApprove(ticket({ status: "OVERRIDDEN" }))).toBe(false);
  });

  it("refuses approval when there is no packet at all", () => {
    expect(canApprove(ticket({ repairPacket: null }))).toBe(false);
  });
});

describe("more-info availability", () => {
  it("allows a more-info request from the review states", () => {
    expect(canRequestMoreInfo(ticket())).toBe(true);
    expect(canRequestMoreInfo(ticket({ status: "PARTIAL" }))).toBe(true);
  });

  it("refuses a more-info request outside the review states", () => {
    for (const status of [
      "IN_PROGRESS",
      "NEEDS_MORE_INFO",
      "APPROVED",
      "OVERRIDDEN",
      "SAFETY_ESCALATED",
    ] as const) {
      expect(canRequestMoreInfo(ticket({ status }))).toBe(false);
    }
  });
});

describe("manual override vocabulary", () => {
  it("offers every valid route except the one already recommended", () => {
    expect(overrideOptions(ticket()).map((option) => option.routeCode)).toEqual([
      "LANDLORD_REVIEW",
      "THIRD_PARTY_MANAGER",
      "MANUFACTURER_AS",
      "GENERAL_VENDOR",
    ]);
  });

  it("offers the full closed vocabulary when nothing was recommended", () => {
    const partial = ticket({
      status: "PARTIAL",
      evidenceStatus: "MISSING_REQUIRED",
      repairPacket: {
        ...ticket().repairPacket!,
        recommendation: null,
        routeAlternatives: [],
      },
    });

    expect(overrideOptions(partial).map((option) => option.routeCode)).toEqual([
      ...ALL_ROUTE_CODES,
    ]);
  });

  it("offers the full vocabulary before a packet exists", () => {
    expect(
      overrideOptions(ticket({ status: "IN_PROGRESS", repairPacket: null }))
        .length,
    ).toBe(ALL_ROUTE_CODES.length);
  });

  it("offers no override control at all for a safety-escalated ticket", () => {
    const escalated = ticket({
      status: "SAFETY_ESCALATED",
      evidenceStatus: "SAFETY_ESCALATED",
      repairPacket: {
        ...ticket().repairPacket!,
        safetyEscalated: true,
        recommendation: null,
        routeAlternatives: [],
      },
    });

    expect(overrideOptions(escalated)).toEqual([]);
    expect(manualRouteMode(escalated)).toBe("NONE");
  });

  it("labels every route it offers", () => {
    for (const option of overrideOptions(ticket())) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it("distinguishes an alternative choice from a purely manual one", () => {
    expect(manualRouteMode(ticket())).toBe("ALTERNATIVE");
    expect(
      manualRouteMode(
        ticket({
          status: "PARTIAL",
          evidenceStatus: "MISSING_REQUIRED",
          repairPacket: {
            ...ticket().repairPacket!,
            recommendation: null,
            routeAlternatives: [],
          },
        }),
      ),
    ).toBe("MANUAL_ONLY");
  });
});

describe("route labels", () => {
  it("covers every code in the closed vocabulary", () => {
    for (const routeCode of ALL_ROUTE_CODES) {
      expect(routeLabel(routeCode).length).toBeGreaterThan(0);
    }
  });

  it("uses the approved Korean labels", () => {
    expect(routeLabel("LANDLORD_REVIEW")).toBe("임대인 검토");
    expect(routeLabel("MANAGEMENT_OFFICE")).toBe("관리사무소");
    expect(routeLabel("THIRD_PARTY_MANAGER")).toBe("위탁관리");
    expect(routeLabel("MANUFACTURER_AS")).toBe("제조사 A/S");
    expect(routeLabel("GENERAL_VENDOR")).toBe("일반 수리업체");
  });
});

describe("recommendation state", () => {
  it("reports a real recommendation", () => {
    expect(recommendationState(ticket())).toBe("RECOMMENDED");
  });

  it("reports safety escalation ahead of any other reason", () => {
    expect(
      recommendationState(
        ticket({
          evidenceStatus: "SAFETY_ESCALATED",
          repairPacket: {
            ...ticket().repairPacket!,
            safetyEscalated: true,
            recommendation: null,
          },
        }),
      ),
    ).toBe("SAFETY_ESCALATED");
  });

  it("distinguishes missing evidence from contradictory evidence", () => {
    const withoutRecommendation = {
      ...ticket().repairPacket!,
      recommendation: null,
      routeAlternatives: [],
    };

    expect(
      recommendationState(
        ticket({
          evidenceStatus: "MISSING_REQUIRED",
          repairPacket: withoutRecommendation,
        }),
      ),
    ).toBe("MISSING_REQUIRED");
    expect(
      recommendationState(
        ticket({
          evidenceStatus: "CONFLICTING",
          repairPacket: withoutRecommendation,
        }),
      ),
    ).toBe("CONFLICTING");
  });

  it("reports an unfinalized ticket as awaiting intake", () => {
    expect(
      recommendationState(ticket({ status: "IN_PROGRESS", repairPacket: null })),
    ).toBe("AWAITING_INTAKE");
  });
});

describe("building context rows", () => {
  it("separates routing-eligible context from informational context", () => {
    const rows = contextRows(passport);

    const routing = rows.filter((row) => row.routingEligible).map((row) => row.key);
    const informational = rows
      .filter((row) => !row.routingEligible)
      .map((row) => row.key);

    expect(routing).toEqual([
      "managementMode",
      "heatingType",
      "ownerSuppliedBoiler",
    ]);
    expect(informational).toEqual(["primaryUse", "approvalYear"]);
  });

  it("marks approval year as informational so it cannot look like a routing input", () => {
    const approvalYear = contextRows(passport).find(
      (row) => row.key === "approvalYear",
    );

    expect(approvalYear?.routingEligible).toBe(false);
    expect(approvalYear?.provenance).toBe("INFORMATIONAL");
  });

  it("marks owner-verified routing context with its provenance", () => {
    const heatingType = contextRows(passport).find(
      (row) => row.key === "heatingType",
    );

    expect(heatingType?.routingEligible).toBe(true);
    expect(heatingType?.provenance).toBe("OWNER_VERIFIED");
  });

  it("omits an owner boiler the landlord never claimed", () => {
    const withoutBoiler: BuildingPassportDto = {
      ...passport,
      ownerSuppliedBoiler: undefined,
      routingEligibleFields: ["managementMode", "heatingType"],
    };

    expect(
      contextRows(withoutBoiler).some((row) => row.key === "ownerSuppliedBoiler"),
    ).toBe(false);
  });
});

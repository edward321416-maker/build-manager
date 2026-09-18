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
  routeLabel,
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
    expect(canApprove(ticket({ repairPacket: null }))).toBe(false);
  });

  it.each([
    { status: "SAFETY_ESCALATED" as const },
    { evidenceStatus: "SAFETY_ESCALATED" as const },
    { repairPacket: { ...ticket().repairPacket!, safetyEscalated: true } },
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
    expect(manualRouteMode(ticket())).toBe("ALTERNATIVE");
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

  it("does not narrow manual choices to the packet's route alternatives", () => {
    const value = ticket({
      repairPacket: {
        ...ticket().repairPacket!,
        recommendation: null,
        routeAlternatives: [
          { routeCode: "GENERAL_VENDOR", label: "일반 수리업체" },
        ],
      },
    });

    expect(overrideOptions(value)).toHaveLength(ALL_ROUTE_CODES.length);
  });

  it("names a reason when the packet reports conflicting intake", () => {
    expect(
      recommendationState(
        ticket({
          status: "PARTIAL",
          evidenceStatus: "CONFLICTING",
          repairPacket: { ...ticket().repairPacket!, recommendation: null },
        }),
      ),
    ).toBe("CONFLICTING");
  });

  it("reports an unfinalized ticket as awaiting intake", () => {
    expect(recommendationState(ticket({ repairPacket: null }))).toBe(
      "AWAITING_INTAKE",
    );
  });

  it("allows more-info only from review states", () => {
    expect(canRequestMoreInfo(ticket())).toBe(true);
    expect(canRequestMoreInfo(ticket({ status: "PARTIAL" }))).toBe(true);
    expect(canRequestMoreInfo(ticket({ status: "APPROVED" }))).toBe(false);
    expect(canRequestMoreInfo(ticket({ status: "OVERRIDDEN" }))).toBe(false);
    expect(canRequestMoreInfo(ticket({ status: "NEEDS_MORE_INFO" }))).toBe(
      false,
    );
  });

  it("labels every route in the closed vocabulary", () => {
    for (const routeCode of ALL_ROUTE_CODES) {
      expect(routeLabel(routeCode).length).toBeGreaterThan(0);
    }
  });

  it("separates routing context from informational context", () => {
    const rows = contextRows(passport);

    expect(rows.find((row) => row.key === "managementMode")?.routingEligible).toBe(
      true,
    );
    expect(rows.find((row) => row.key === "heatingType")?.routingEligible).toBe(
      true,
    );
    expect(rows.find((row) => row.key === "approvalYear")?.routingEligible).toBe(
      false,
    );
    expect(rows.find((row) => row.key === "primaryUse")?.routingEligible).toBe(
      false,
    );
  });

  it("omits the boiler row when the server did not supply a value", () => {
    expect(
      contextRows(passport).find((row) => row.key === "ownerSuppliedBoiler"),
    ).toBeUndefined();
  });

  it("shows the boiler row when the server did supply a value", () => {
    const rows = contextRows({
      ...passport,
      ownerSuppliedBoiler: false,
      routingEligibleFields: [
        "managementMode",
        "heatingType",
        "ownerSuppliedBoiler",
      ],
    });
    const row = rows.find((item) => item.key === "ownerSuppliedBoiler");

    expect(row?.routingEligible).toBe(true);
    expect(row?.value).toBe("아니오");
  });
});

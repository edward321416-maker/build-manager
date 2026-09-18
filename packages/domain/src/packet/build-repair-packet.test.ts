import { describe, expect, it } from "vitest";
import type { Building, ContextValue } from "../building/types";
import { evaluateSafety } from "../safety/evaluate-safety";
import type {
  Answer,
  RepairPacket,
  RouteRecommendation,
  Ticket,
} from "../ticket/types";
import { buildRepairPacket } from "./build-repair-packet";

const AT = "2026-09-14T03:00:00.000Z";
const LATER = "2026-09-14T04:00:00.000Z";

function context(
  key: string,
  value: unknown,
  routingEligible: boolean,
): ContextValue<unknown> {
  return {
    key,
    value,
    sourceType: routingEligible ? "OWNER_VERIFIED" : "FIXTURE_OFFICIAL",
    sourceRef: "demo-fixture",
    verified: true,
    routingEligible,
    fetchedAt: null,
    updatedAt: AT,
  };
}

const building: Building = {
  id: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  normalizedAddress: null,
  sourceNativeIds: { jusoBdMgtSn: null, buildingHubId: null, kaptCode: null },
  context: [
    context("approvalYear", "2011", false),
    context("managementMode", "OWNER_DIRECT", true),
    context("heatingType", "INDIVIDUAL", true),
  ],
};

function answer(questionId: string, value: Answer["value"]): Answer {
  return { questionId, value, createdAt: AT, updatedAt: AT };
}

const ticket: Ticket = {
  id: "ticket-a",
  buildingId: building.id,
  unitId: "demo-unit-a",
  issueType: "HEATING",
  rawUserText: "난방이 되지 않습니다.",
  status: "IN_PROGRESS",
  protocolId: "HEATING_INDIVIDUAL_V1",
  answers: [
    answer("safety.gasSmell", false),
    answer("heating.powerOn", true),
    answer("heating.errorCode", "E1"),
  ],
  evidence: [
    {
      id: "control-panel",
      type: "CONTROL_PANEL_PHOTO",
      fixtureRef: "synthetic:control-panel",
      source: "DEMO_FIXTURE",
      createdAt: AT,
    },
  ],
  safetyFlags: [],
  repairPacket: null,
  routeDecision: null,
  createdAt: AT,
  updatedAt: AT,
};

const recommendation: RouteRecommendation = {
  primary: "LANDLORD_REVIEW",
  alternatives: ["MANUFACTURER_AS"],
  rationale: [],
  humanReviewRequired: true,
};

function build(overrides: Partial<Parameters<typeof buildRepairPacket>[0]> = {}) {
  return buildRepairPacket({
    ticket,
    building,
    evidenceState: "COMPLETE",
    safety: evaluateSafety({ gasSmell: false }),
    recommendation,
    createdAt: LATER,
    ...overrides,
  });
}

describe("repair packet contents", () => {
  it("starts at revision 1 and carries the authoritative decision inputs", () => {
    const result = build();

    expect(result.revision).toBe(1);
    expect(result.ticketId).toBe("ticket-a");
    expect(result.issueType).toBe("HEATING");
    expect(result.userReport).toEqual({ rawText: "난방이 되지 않습니다." });
    expect(result.evidenceState).toBe("COMPLETE");
    expect(result.evidence).toEqual(ticket.evidence);
    expect(result.recommendation).toEqual(recommendation);
    expect(result.createdAt).toBe(LATER);
  });

  it("separates the routing basis from informational context", () => {
    const result = build();

    expect(result.contextSnapshot.routingBasis.map((entry) => entry.key)).toEqual([
      "managementMode",
      "heatingType",
    ]);
    expect(
      result.contextSnapshot.informational.map((entry) => entry.key),
    ).toEqual(["approvalYear"]);
  });

  it("summarises without a model", () => {
    expect(build().generatedSummary.source).toBe("TEMPLATE");
    expect(build().generatedSummary.text.length).toBeGreaterThan(0);
  });

  it("keeps safety answers out of the structured symptoms", () => {
    const result = build();

    expect(result.structuredSymptoms).toEqual({
      "heating.powerOn": true,
      "heating.errorCode": "E1",
    });
  });

  it("records an escalated safety result instead of a recommendation", () => {
    const result = build({
      evidenceState: "SAFETY_ESCALATED",
      safety: evaluateSafety({ gasSmell: true }),
      recommendation: null,
    });

    expect(result.safety).toEqual({ escalated: true, flags: ["GAS_SMELL"] });
    expect(result.recommendation).toBeNull();
  });
});

describe("refinalization", () => {
  it("increments the revision each time the packet is rebuilt", () => {
    const first = build();
    const second = build({ ticket: { ...ticket, repairPacket: first } });
    const third = build({ ticket: { ...ticket, repairPacket: second } });

    expect([first.revision, second.revision, third.revision]).toEqual([1, 2, 3]);
  });

  it("does not mutate the previous packet", () => {
    const first: RepairPacket = build();
    const snapshot = JSON.stringify(first);

    build({ ticket: { ...ticket, repairPacket: first } });

    expect(JSON.stringify(first)).toBe(snapshot);
  });
});

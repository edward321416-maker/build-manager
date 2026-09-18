import { describe, expect, it } from "vitest";
import type { Building } from "../building/types";
import { evaluateRuleExpression } from "./evaluate-questions";
import { selectProtocol } from "./select-protocol";

const building: Building = {
  id: "demo-building-b",
  displayName: "DEMO 라온하우징",
  demo: true,
  normalizedAddress: null,
  sourceNativeIds: { jusoBdMgtSn: null, buildingHubId: null, kaptCode: null },
  context: [
    {
      key: "managementMode",
      value: "MANAGEMENT_OFFICE",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
      updatedAt: "2026-09-14T00:00:00.000Z",
    },
  ],
};

describe("leak protocol", () => {
  it("asks electrical-water and uncontrolled-water safety before every other check", () => {
    const protocol = selectProtocol(building, "LEAK");

    expect(protocol.id).toBe("LEAK_V1");
    expect(protocol.safetyChecks.map((check) => check.flag)).toEqual([
      "ELECTRICAL_WATER_RISK",
      "OTHER_URGENT_HAZARD",
      "GAS_SMELL",
      "SMOKE_OR_FIRE",
    ]);
    expect(protocol.safetyChecks.every((check) => check.hardStop)).toBe(true);
    expect(protocol.questions.slice(0, 4).map((question) => question.id)).toEqual(
      [
        "safety.electricalWaterRisk",
        "safety.otherUrgentHazard",
        "safety.gasSmell",
        "safety.smokeOrFire",
      ],
    );
  });

  it("asks the exact leak location, ongoing, appliance-only, and onset questions", () => {
    const ordinaryQuestions = selectProtocol(building, "LEAK").questions.slice(4);

    expect(ordinaryQuestions.map((question) => question.id)).toEqual([
      "leak.location",
      "leak.active",
      "leak.applianceOnly",
      "leak.firstObservedAt",
    ]);
    expect(ordinaryQuestions.every((question) => question.required)).toBe(true);
    expect(ordinaryQuestions[0]?.choices?.map((choice) => choice.value)).toEqual([
      "CEILING_WALL",
      "SINK_BATHROOM_FIXTURE",
      "APPLIANCE",
      "UNKNOWN",
    ]);
  });

  it("requires a leak-area photo and conditionally requires a fixture photo for appliances", () => {
    const protocol = selectProtocol(building, "LEAK");

    expect(protocol.evidence.map((requirement) => requirement.type)).toEqual([
      "LEAK_AREA_PHOTO",
      "FIXTURE_PHOTO",
    ]);
    expect(protocol.evidence[0]).toEqual(
      expect.objectContaining({ required: true }),
    );
    expect(protocol.evidence[0]).not.toHaveProperty("showWhen");
    expect(protocol.evidence[1]?.required).toBe(true);
    expect(
      evaluateRuleExpression(protocol.evidence[1]!.showWhen!, {
        "answer.leak.location": "APPLIANCE",
      }),
    ).toBe(true);
    expect(
      evaluateRuleExpression(protocol.evidence[1]!.showWhen!, {
        "answer.leak.location": "CEILING_WALL",
      }),
    ).toBe(false);
  });

  it("defines management-office and landlord-review candidates without assigning cause", () => {
    const protocol = selectProtocol(building, "LEAK");

    expect(protocol.routeRules).toEqual([
      expect.objectContaining({
        id: "leak.ceiling.managementOffice",
        primary: "MANAGEMENT_OFFICE",
        alternatives: ["LANDLORD_REVIEW"],
      }),
      expect.objectContaining({
        id: "leak.default.landlordReview",
        primary: "LANDLORD_REVIEW",
        alternatives: [],
      }),
    ]);
    expect(
      evaluateRuleExpression(protocol.routeRules[0]!.when, {
        "context.managementMode": "MANAGEMENT_OFFICE",
        "answer.leak.location": "CEILING_WALL",
      }),
    ).toBe(true);
  });

  it("keeps one leak protocol for both buildings while heating branches diverge", () => {
    const ownerDirect: Building = {
      ...building,
      id: "demo-building-a",
      context: [
        {
          key: "heatingType",
          value: "INDIVIDUAL",
          sourceType: "OWNER_VERIFIED",
          verified: true,
          routingEligible: true,
          updatedAt: "2026-09-14T00:00:00.000Z",
        },
      ],
    };

    expect(selectProtocol(ownerDirect, "LEAK").id).toBe("LEAK_V1");
    expect(selectProtocol(ownerDirect, "HEATING").id).toBe(
      "HEATING_INDIVIDUAL_V1",
    );
  });
});

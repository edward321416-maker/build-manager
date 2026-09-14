import { describe, expect, it } from "vitest";

import type { Building } from "@/domain/building/types";
import {
  evaluateRuleExpression,
  getActiveQuestions,
} from "@/domain/protocol/evaluate-questions";
import { selectProtocol } from "@/domain/protocol/select-protocol";
import type { ProtocolQuestion, RuleExpression } from "@/domain/protocol/types";
import { demoBuildingA, demoBuildingB } from "@/fixtures/buildings";

function withHeatingContext(
  building: Building,
  replacement: Building["context"],
): Building {
  return {
    ...building,
    context: [
      ...building.context.filter((entry) => entry.key !== "heatingType"),
      ...replacement,
    ],
  };
}

describe("selectProtocol", () => {
  it("selects individual heating questions and evidence for Building A", () => {
    const protocol = selectProtocol(demoBuildingA, "HEATING");

    expect(protocol.id).toBe("HEATING_INDIVIDUAL_V1");
    expect(protocol.version).toBe("1");
    expect(protocol.questions.map((question) => question.id)).toEqual([
      "safety.gasSmell",
      "safety.smokeOrFire",
      "safety.electricalWaterRisk",
      "safety.otherUrgentHazard",
      "heating.hotWater",
      "heating.allRooms",
      "heating.powerOn",
      "heating.errorCode",
    ]);
    expect(protocol.evidence).toEqual([
      expect.objectContaining({ type: "CONTROL_PANEL_PHOTO", required: true }),
    ]);
    expect(protocol.routeRules).toEqual([
      expect.objectContaining({
        primary: "LANDLORD_REVIEW",
        alternatives: ["MANUFACTURER_AS"],
      }),
    ]);
  });

  it("selects shared heating questions without boiler-model evidence for Building B", () => {
    const protocol = selectProtocol(demoBuildingB, "HEATING");

    expect(protocol.id).toBe("HEATING_SHARED_V1");
    expect(protocol.version).toBe("1");
    expect(protocol.questions.map((question) => question.id)).toEqual([
      "safety.gasSmell",
      "safety.smokeOrFire",
      "safety.electricalWaterRisk",
      "safety.otherUrgentHazard",
      "heating.unitOnly",
      "heating.hotWater",
      "heating.controllerAbnormal",
    ]);
    expect(protocol.evidence.map((evidence) => evidence.type)).toEqual([
      "FIXTURE_PHOTO",
    ]);
    expect(protocol.routeRules).toEqual([
      expect.objectContaining({
        primary: "MANAGEMENT_OFFICE",
        alternatives: ["LANDLORD_REVIEW"],
      }),
    ]);
  });

  it("uses the explicit unknown branch and asks for clarification", () => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "UNKNOWN",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    ]);

    const protocol = selectProtocol(building, "HEATING");

    expect(protocol.id).toBe("HEATING_UNKNOWN_V1");
    expect(protocol.questions.map((question) => question.id)).toEqual([
      "safety.gasSmell",
      "safety.smokeOrFire",
      "safety.electricalWaterRisk",
      "safety.otherUrgentHazard",
      "heating.type",
    ]);
    expect(protocol.routeRules).toEqual([
      expect.objectContaining({
        primary: "LANDLORD_REVIEW",
        alternatives: [],
      }),
    ]);
  });

  it("begins every heating branch with gas and smoke hard stops and covers urgent hazards", () => {
    const branches = [
      selectProtocol(demoBuildingA, "HEATING"),
      selectProtocol(demoBuildingB, "HEATING"),
      selectProtocol(withHeatingContext(demoBuildingA, []), "HEATING"),
    ];

    for (const protocol of branches) {
      expect(protocol.safetyChecks.map((check) => check.flag)).toEqual([
        "GAS_SMELL",
        "SMOKE_OR_FIRE",
        "ELECTRICAL_WATER_RISK",
        "OTHER_URGENT_HAZARD",
      ]);
      expect(protocol.safetyChecks.every((check) => check.hardStop)).toBe(true);
    }
  });

  it.each([
    ["unverified", false, true],
    ["routing-ineligible", true, false],
  ])("does not infer a known branch from %s heating context", (_, verified, routingEligible) => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "INDIVIDUAL",
        sourceType: "TENANT_SUBMITTED",
        verified,
        routingEligible,
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    ]);

    expect(selectProtocol(building, "HEATING").id).toBe("HEATING_UNKNOWN_V1");
  });

  it("does not infer a known branch when eligible heating context conflicts", () => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "INDIVIDUAL",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
      {
        key: "heatingType",
        value: "CENTRAL_SHARED",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    ]);

    expect(selectProtocol(building, "HEATING").id).toBe("HEATING_UNKNOWN_V1");
  });

  it("does not infer a known branch when heating context is missing", () => {
    expect(
      selectProtocol(withHeatingContext(demoBuildingA, []), "HEATING").id,
    ).toBe("HEATING_UNKNOWN_V1");
  });

  it("keeps district heating on manual clarification without inventing a route", () => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "DISTRICT",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    ]);

    expect(selectProtocol(building, "HEATING").id).toBe("HEATING_UNKNOWN_V1");
  });

  it("does not promote a tenant clarification answer into verified building context", () => {
    const building = withHeatingContext(demoBuildingA, []);
    const unknown = selectProtocol(building, "HEATING");
    const answers = { "answer.heating.type": "INDIVIDUAL" } as const;

    expect(getActiveQuestions(unknown.questions, answers).map((question) => question.id)).toContain(
      "heating.type",
    );
    expect(selectProtocol(building, "HEATING").id).toBe("HEATING_UNKNOWN_V1");
  });

  it("rejects unsupported issue types until their protocol is implemented", () => {
    expect(() => selectProtocol(demoBuildingA, "LEAK")).toThrowError(
      "Unsupported issue type: LEAK",
    );
  });
});

describe("typed question conditions", () => {
  const conditions: RuleExpression = {
    op: "and",
    rules: [
      { op: "eq", field: "answer.leak.active", value: true },
      {
        op: "or",
        rules: [
          { op: "eq", field: "answer.leak.location", value: "CEILING" },
          { op: "eq", field: "answer.leak.location", value: "WALL" },
        ],
      },
    ],
  };

  it("evaluates only the typed eq, and, and or condition tree", () => {
    expect(
      evaluateRuleExpression(conditions, {
        "answer.leak.active": true,
        "answer.leak.location": "CEILING",
      }),
    ).toBe(true);
    expect(
      evaluateRuleExpression(conditions, {
        "answer.leak.active": false,
        "answer.leak.location": "CEILING",
      }),
    ).toBe(false);
  });

  it("returns unconditional questions and questions whose conditions are active", () => {
    const questions: ProtocolQuestion[] = [
      {
        id: "leak.active",
        prompt: "Is water actively leaking?",
        type: "YES_NO",
        required: true,
      },
      {
        id: "leak.conditionalLocation",
        prompt: "Where is the active leak?",
        type: "SINGLE_SELECT",
        required: true,
        showWhen: conditions,
      },
    ];

    expect(
      getActiveQuestions(questions, {
        "answer.leak.active": true,
        "answer.leak.location": "WALL",
      }).map((question) => question.id),
    ).toEqual(["leak.active", "leak.conditionalLocation"]);
    expect(
      getActiveQuestions(questions, {
        "answer.leak.active": false,
        "answer.leak.location": "WALL",
      }).map((question) => question.id),
    ).toEqual(["leak.active"]);
  });
});

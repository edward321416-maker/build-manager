import { describe, expect, it } from "vitest";
import type { Building } from "../building/types";
import {
  evaluateRuleExpression,
  getActiveQuestions,
} from "./evaluate-questions";
import { selectHeatingProtocol } from "./select-protocol";
import type { ProtocolQuestion, RuleExpression } from "./types";

const FIXTURE_UPDATED_AT = "2026-09-14T00:00:00.000Z";

const demoBuildingA: Building = {
  id: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  normalizedAddress: null,
  sourceNativeIds: { jusoBdMgtSn: null, buildingHubId: null, kaptCode: null },
  context: [
    {
      key: "managementMode",
      value: "OWNER_DIRECT",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
      updatedAt: FIXTURE_UPDATED_AT,
    },
    {
      key: "heatingType",
      value: "INDIVIDUAL",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
      updatedAt: FIXTURE_UPDATED_AT,
    },
  ],
};

const demoBuildingB: Building = {
  ...demoBuildingA,
  id: "demo-building-b",
  displayName: "DEMO 라온하우징",
  context: [
    {
      key: "managementMode",
      value: "MANAGEMENT_OFFICE",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
      updatedAt: FIXTURE_UPDATED_AT,
    },
    {
      key: "heatingType",
      value: "CENTRAL_SHARED",
      sourceType: "OWNER_VERIFIED",
      verified: true,
      routingEligible: true,
      updatedAt: FIXTURE_UPDATED_AT,
    },
  ],
};

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

const SAFETY_QUESTION_IDS = [
  "safety.gasSmell",
  "safety.smokeOrFire",
  "safety.electricalWaterRisk",
  "safety.otherUrgentHazard",
];

describe("heating protocol branch selection", () => {
  it("selects the individual branch for a building with owner-verified individual heating", () => {
    const protocol = selectHeatingProtocol(demoBuildingA);

    expect(protocol.id).toBe("HEATING_INDIVIDUAL_V1");
    expect(protocol.version).toBe("1");
    expect(protocol.questions.map((question) => question.id)).toEqual([
      ...SAFETY_QUESTION_IDS,
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

  it("selects the shared branch with its own questions and evidence", () => {
    const protocol = selectHeatingProtocol(demoBuildingB);

    expect(protocol.id).toBe("HEATING_SHARED_V1");
    expect(protocol.version).toBe("1");
    expect(protocol.questions.map((question) => question.id)).toEqual([
      ...SAFETY_QUESTION_IDS,
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

  it("gives the same heating report a different branch per building", () => {
    expect(selectHeatingProtocol(demoBuildingA).id).not.toBe(
      selectHeatingProtocol(demoBuildingB).id,
    );
  });

  it("asks for clarification instead of guessing on the unknown branch", () => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "UNKNOWN",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: FIXTURE_UPDATED_AT,
      },
    ]);

    const protocol = selectHeatingProtocol(building);

    expect(protocol.id).toBe("HEATING_UNKNOWN_V1");
    expect(protocol.questions.map((question) => question.id)).toEqual([
      ...SAFETY_QUESTION_IDS,
      "heating.type",
    ]);
    expect(protocol.evidence).toEqual([]);
    expect(protocol.routeRules).toEqual([
      expect.objectContaining({ primary: "LANDLORD_REVIEW", alternatives: [] }),
    ]);
  });
});

describe("heating branches never skip the safety gate", () => {
  it("starts every branch with the same hard-stop safety checks", () => {
    const branches = [
      selectHeatingProtocol(demoBuildingA),
      selectHeatingProtocol(demoBuildingB),
      selectHeatingProtocol(withHeatingContext(demoBuildingA, [])),
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
});

describe("only verified routing-eligible context may pick a branch", () => {
  it.each([
    ["unverified", false, true],
    ["routing-ineligible", true, false],
  ])(
    "does not infer a known branch from %s heating context",
    (_label, verified, routingEligible) => {
      const building = withHeatingContext(demoBuildingA, [
        {
          key: "heatingType",
          value: "INDIVIDUAL",
          sourceType: "TENANT_SUBMITTED",
          verified,
          routingEligible,
          updatedAt: FIXTURE_UPDATED_AT,
        },
      ]);

      expect(selectHeatingProtocol(building).id).toBe("HEATING_UNKNOWN_V1");
    },
  );

  it("does not infer a known branch when eligible heating context conflicts", () => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "INDIVIDUAL",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: FIXTURE_UPDATED_AT,
      },
      {
        key: "heatingType",
        value: "CENTRAL_SHARED",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: FIXTURE_UPDATED_AT,
      },
    ]);

    expect(selectHeatingProtocol(building).id).toBe("HEATING_UNKNOWN_V1");
  });

  it("does not infer a known branch when heating context is missing", () => {
    expect(selectHeatingProtocol(withHeatingContext(demoBuildingA, [])).id).toBe(
      "HEATING_UNKNOWN_V1",
    );
  });

  it("keeps district heating on manual clarification without inventing a branch", () => {
    const building = withHeatingContext(demoBuildingA, [
      {
        key: "heatingType",
        value: "DISTRICT",
        sourceType: "OWNER_VERIFIED",
        verified: true,
        routingEligible: true,
        updatedAt: FIXTURE_UPDATED_AT,
      },
    ]);

    expect(selectHeatingProtocol(building).id).toBe("HEATING_UNKNOWN_V1");
  });

  it("does not promote a tenant clarification answer into verified building context", () => {
    const building = withHeatingContext(demoBuildingA, []);
    const unknown = selectHeatingProtocol(building);

    expect(
      getActiveQuestions(unknown.questions, {
        "answer.heating.type": "INDIVIDUAL",
      }).map((question) => question.id),
    ).toContain("heating.type");
    expect(selectHeatingProtocol(building).id).toBe("HEATING_UNKNOWN_V1");
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
        prompt: "물이 계속 새고 있나요?",
        type: "YES_NO",
        required: true,
      },
      {
        id: "leak.conditionalLocation",
        prompt: "새는 곳은 어디인가요?",
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

import { describe, expect, it } from "vitest";
import { heatingIndividualV1, heatingUnknownV1 } from "../protocol/heating.v1";
import { leakV1 } from "../protocol/leak.v1";
import { evaluateSafety } from "../safety/evaluate-safety";
import type { Answer, AnswerValue, Evidence } from "../ticket/types";
import { activeEvidenceRequirements, evaluateEvidence } from "./evaluate-evidence";

const protocol = leakV1;

const safe = evaluateSafety({
  gasSmell: false,
  smokeOrFire: false,
  electricalWaterRisk: false,
  otherUrgentHazard: false,
});

function answer(questionId: string, value: AnswerValue, minute = 0): Answer {
  const timestamp = `2026-09-14T03:${minute.toString().padStart(2, "0")}:00.000Z`;
  return { questionId, value, createdAt: timestamp, updatedAt: timestamp };
}

function completeAnswers(location = "CEILING_WALL"): Answer[] {
  return [
    answer("safety.electricalWaterRisk", false),
    answer("safety.otherUrgentHazard", false),
    answer("safety.gasSmell", false),
    answer("safety.smokeOrFire", false),
    answer("leak.location", location),
    answer("leak.active", true),
    answer("leak.applianceOnly", false),
    answer("leak.firstObservedAt", "2026-09-14 morning"),
  ];
}

function evidence(
  id: string,
  type: Evidence["type"],
  fixtureRef = `synthetic:${id}`,
): Evidence {
  return {
    id,
    type,
    fixtureRef,
    source: "DEMO_FIXTURE",
    createdAt: "2026-09-14T03:00:00.000Z",
  };
}

/** A photo the tenant named as evidence in the Core flow (P1b). */
function upload(
  id: string,
  type: Evidence["type"],
  storageRef = `core-photo:${id}`,
): Evidence {
  return {
    id,
    type,
    storageRef,
    fixtureRef: null,
    source: "TENANT_UPLOAD",
    createdAt: "2026-09-14T03:00:00.000Z",
  };
}

describe("COMPLETE", () => {
  it("accepts all required answers plus the required leak-area photo", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers(),
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("COMPLETE");
  });

  it("accepts a tenant photo that carries a storage reference", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers(),
        evidence: [upload("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("COMPLETE");
  });

  it("ignores a conditional question whose condition is inactive", () => {
    const conditionalProtocol = {
      ...protocol,
      questions: [
        ...protocol.questions,
        {
          id: "leak.applianceModel",
          prompt: "어떤 기기인가요?",
          type: "SHORT_TEXT" as const,
          required: true,
          showWhen: {
            op: "eq" as const,
            field: "answer.leak.location" as const,
            value: "APPLIANCE",
          },
        },
      ],
    };

    expect(
      evaluateEvidence({
        protocol: conditionalProtocol,
        answers: [...completeAnswers(), answer("leak.applianceModel", null)],
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("COMPLETE");
  });
});

describe("MISSING_REQUIRED", () => {
  it("reports a missing required safety answer", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers().filter(
          (item) => item.questionId !== "safety.smokeOrFire",
        ),
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("MISSING_REQUIRED");
  });

  it("reports a missing ordinary answer and a missing required photo", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers().filter(
          (item) => item.questionId !== "leak.firstObservedAt",
        ),
        evidence: [],
        safety: safe,
      }),
    ).toBe("MISSING_REQUIRED");
  });

  it("requires the fixture photo only while the appliance condition is active", () => {
    const applianceInput = {
      protocol,
      answers: completeAnswers("APPLIANCE"),
      evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
      safety: safe,
    } as const;

    expect(evaluateEvidence(applianceInput)).toBe("MISSING_REQUIRED");
    expect(
      evaluateEvidence({
        ...applianceInput,
        evidence: [
          ...applianceInput.evidence,
          evidence("fixture", "FIXTURE_PHOTO"),
        ],
      }),
    ).toBe("COMPLETE");
  });

  it("reports a required conditional question that became active", () => {
    const conditionalProtocol = {
      ...protocol,
      questions: [
        ...protocol.questions,
        {
          id: "leak.applianceModel",
          prompt: "어떤 기기인가요?",
          type: "SHORT_TEXT" as const,
          required: true,
          showWhen: {
            op: "eq" as const,
            field: "answer.leak.location" as const,
            value: "APPLIANCE",
          },
        },
      ],
    };

    expect(
      evaluateEvidence({
        protocol: conditionalProtocol,
        answers: completeAnswers("APPLIANCE"),
        evidence: [
          evidence("leak-area", "LEAK_AREA_PHOTO"),
          evidence("fixture", "FIXTURE_PHOTO"),
        ],
        safety: safe,
      }),
    ).toBe("MISSING_REQUIRED");
  });
});

describe("CONFLICTING", () => {
  it("reports contradictory duplicate answers", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: [...completeAnswers(), answer("leak.location", "APPLIANCE", 1)],
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("CONFLICTING");
  });

  it("reports an invalid choice value and an unknown question id", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers().map((item) =>
          item.questionId === "leak.location"
            ? answer("leak.location", "ROOFTOP")
            : item,
        ),
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("CONFLICTING");
    expect(
      evaluateEvidence({
        protocol,
        answers: [...completeAnswers(), answer("leak.cause", "upstairs")],
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("CONFLICTING");
  });

  it("reports evidence records that disagree or carry no usable reference", () => {
    const first = evidence("same-id", "LEAK_AREA_PHOTO");

    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers(),
        evidence: [first, { ...first, type: "FIXTURE_PHOTO" }],
        safety: safe,
      }),
    ).toBe("CONFLICTING");
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers(),
        evidence: [
          evidence("leak-area", "LEAK_AREA_PHOTO"),
          {
            id: "empty-ref",
            type: "GENERAL_PHOTO",
            source: "DEMO_FIXTURE",
            createdAt: "2026-09-14T03:00:00.000Z",
          },
        ],
        safety: safe,
      }),
    ).toBe("CONFLICTING");
  });

  it("reports a tenant photo with a stray fixture reference or a blank storage reference", () => {
    for (const item of [
      { ...upload("leak-area", "LEAK_AREA_PHOTO"), fixtureRef: "synthetic:leak-area" },
      upload("leak-area", "LEAK_AREA_PHOTO", "  "),
    ]) {
      expect(
        evaluateEvidence({
          protocol,
          answers: completeAnswers(),
          evidence: [item],
          safety: safe,
        }),
      ).toBe("CONFLICTING");
    }
  });
});

describe("SAFETY_ESCALATED takes precedence", () => {
  it("outranks missing and conflicting data", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: [
          answer("safety.electricalWaterRisk", false),
          answer("safety.electricalWaterRisk", true, 1),
        ],
        evidence: [],
        safety: evaluateSafety({ electricalWaterRisk: true }),
      }),
    ).toBe("SAFETY_ESCALATED");
  });

  it("preserves escalation detected from untrusted issue text", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers(),
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: evaluateSafety({
          rawText: "There is a major uncontrolled water leak",
        }),
      }),
    ).toBe("SAFETY_ESCALATED");
  });

  it("escalates a positive safety answer even when the safety result was clean", () => {
    expect(
      evaluateEvidence({
        protocol,
        answers: completeAnswers().map((item) =>
          item.questionId === "safety.gasSmell"
            ? answer("safety.gasSmell", true)
            : item,
        ),
        evidence: [evidence("leak-area", "LEAK_AREA_PHOTO")],
        safety: safe,
      }),
    ).toBe("SAFETY_ESCALATED");
  });
});

// P1b review: screens and the photo evidence action ask for what the gate enforces.
describe("activeEvidenceRequirements", () => {
  const types = (answers: Answer[], from = protocol) =>
    activeEvidenceRequirements(from, answers).map((item) => item.type);

  it("lists the evidence whose condition holds for the answers", () => {
    expect(types(completeAnswers())).toEqual(["LEAK_AREA_PHOTO"]);
    expect(types(completeAnswers("APPLIANCE"))).toEqual([
      "LEAK_AREA_PHOTO",
      "FIXTURE_PHOTO",
    ]);
    expect(types([], heatingIndividualV1)).toEqual(["CONTROL_PANEL_PHOTO"]);
    expect(types([], heatingUnknownV1)).toEqual([]);
  });

  it("reads each question's first answer and leaves a blank one out, as the gate does", () => {
    expect(
      types([...completeAnswers(), answer("leak.location", "APPLIANCE", 1)]),
    ).toEqual(["LEAK_AREA_PHOTO"]);
    expect(
      types([
        ...completeAnswers("APPLIANCE"),
        answer("leak.location", "CEILING_WALL", 1),
      ]),
    ).toEqual(["LEAK_AREA_PHOTO", "FIXTURE_PHOTO"]);
    expect(
      types([...completeAnswers("  "), answer("leak.location", "APPLIANCE", 1)]),
    ).toEqual(["LEAK_AREA_PHOTO"]);
  });

  it.each(["CEILING_WALL", "SINK_BATHROOM_FIXTURE", "APPLIANCE", "UNKNOWN"])(
    "names exactly the photos the gate requires when the location is %s",
    (location) => {
      const answers = completeAnswers(location);
      const required = activeEvidenceRequirements(protocol, answers)
        .filter((item) => item.required)
        .map((item) => item.type);
      const evaluate = (supplied: Evidence["type"][]) =>
        evaluateEvidence({
          protocol,
          answers,
          evidence: supplied.map((type) => upload(type, type)),
          safety: safe,
        });

      expect(evaluate(required)).toBe("COMPLETE");
      for (const left of required) {
        expect(evaluate(required.filter((type) => type !== left))).toBe(
          "MISSING_REQUIRED",
        );
      }
    },
  );
});

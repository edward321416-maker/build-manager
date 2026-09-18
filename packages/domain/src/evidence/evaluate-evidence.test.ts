import { describe, expect, it } from "vitest";
import { leakV1 } from "../protocol/leak.v1";
import { evaluateSafety } from "../safety/evaluate-safety";
import type { Answer, AnswerValue, Evidence } from "../ticket/types";
import { evaluateEvidence } from "./evaluate-evidence";

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

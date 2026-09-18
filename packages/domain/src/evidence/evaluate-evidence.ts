import {
  evaluateRuleExpression,
  getActiveQuestions,
  type RuleValues,
} from "../protocol/evaluate-questions";
import type { Protocol, ProtocolQuestion, RuleField } from "../protocol/types";
import type { SafetyResult } from "../safety/evaluate-safety";
import type {
  Answer,
  AnswerValue,
  Evidence,
  EvidenceState,
  EvidenceType,
} from "../ticket/types";

export type EvidenceEvaluationInput = {
  protocol: Protocol;
  answers: readonly Answer[];
  evidence: readonly Evidence[];
  safety: SafetyResult;
};

const VALID_EVIDENCE_TYPES: ReadonlySet<EvidenceType> = new Set([
  "CONTROL_PANEL_PHOTO",
  "LEAK_AREA_PHOTO",
  "FIXTURE_PHOTO",
  "GENERAL_PHOTO",
]);

function answerValuesEqual(left: AnswerValue, right: AnswerValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return left === right;
}

function isMissingAnswer(value: AnswerValue): boolean {
  return (
    value === null ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isValidAnswer(question: ProtocolQuestion, value: AnswerValue): boolean {
  if (isMissingAnswer(value)) {
    return true;
  }

  switch (question.type) {
    case "YES_NO":
      return typeof value === "boolean";
    case "SHORT_TEXT":
      return typeof value === "string";
    case "SINGLE_SELECT":
      return (
        typeof value === "string" &&
        question.choices?.some((choice) => choice.value === value) === true
      );
  }
}

function evidenceRecordsEqual(left: Evidence, right: Evidence): boolean {
  return (
    left.type === right.type &&
    (left.storageRef ?? null) === (right.storageRef ?? null) &&
    (left.fixtureRef ?? null) === (right.fixtureRef ?? null) &&
    left.source === right.source &&
    left.createdAt === right.createdAt
  );
}

/** A record must carry exactly one reference matching how it was supplied. */
function hasUsableReference(item: Evidence): boolean {
  const storageRef = item.storageRef?.trim() ?? "";
  const fixtureRef = item.fixtureRef?.trim() ?? "";

  if (item.source === "TENANT_UPLOAD") {
    return storageRef.length > 0 && fixtureRef.length === 0;
  }
  if (item.source === "DEMO_FIXTURE") {
    return fixtureRef.length > 0 && storageRef.length === 0;
  }
  return false;
}

function groupAnswers(answers: readonly Answer[]): Map<string, Answer[]> {
  const grouped = new Map<string, Answer[]>();
  for (const item of answers) {
    const existing = grouped.get(item.questionId);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(item.questionId, [item]);
    }
  }
  return grouped;
}

/**
 * Determines whether the protocol's currently active minimum intake is ready.
 * COMPLETE only means the required answers and evidence are present. It does
 * not establish safety, diagnose the issue, or assign cause or liability.
 *
 * Safety escalation outranks every other state, so a hazard is never hidden
 * behind missing or contradictory intake data.
 */
export function evaluateEvidence(input: EvidenceEvaluationInput): EvidenceState {
  const answersByQuestion = groupAnswers(input.answers);

  if (
    input.safety.escalated ||
    input.safety.flags.length > 0 ||
    input.protocol.safetyChecks.some((check) =>
      answersByQuestion
        .get(check.questionId)
        ?.some((item) => item.value === true),
    )
  ) {
    return "SAFETY_ESCALATED";
  }

  const questionsById = new Map(
    input.protocol.questions.map((question) => [question.id, question]),
  );
  const values: RuleValues = {};

  for (const [questionId, submitted] of answersByQuestion) {
    const question = questionsById.get(questionId);
    if (!question) {
      return "CONFLICTING";
    }

    const firstValue = submitted[0]!.value;
    if (
      submitted.some((item) => !answerValuesEqual(item.value, firstValue)) ||
      !isValidAnswer(question, firstValue)
    ) {
      return "CONFLICTING";
    }

    if (!isMissingAnswer(firstValue)) {
      values[`answer.${questionId}` as RuleField] = firstValue as
        | string
        | boolean;
    }
  }

  const evidenceById = new Map<string, Evidence>();
  for (const item of input.evidence) {
    if (
      item.id.trim().length === 0 ||
      !VALID_EVIDENCE_TYPES.has(item.type) ||
      !hasUsableReference(item)
    ) {
      return "CONFLICTING";
    }

    const existing = evidenceById.get(item.id);
    if (existing && !evidenceRecordsEqual(existing, item)) {
      return "CONFLICTING";
    }
    evidenceById.set(item.id, item);
  }

  for (const question of getActiveQuestions(input.protocol.questions, values)) {
    if (!question.required) {
      continue;
    }
    const submitted = answersByQuestion.get(question.id);
    if (!submitted || isMissingAnswer(submitted[0]!.value)) {
      return "MISSING_REQUIRED";
    }
  }

  const suppliedEvidenceTypes = new Set(
    [...evidenceById.values()].map((item) => item.type),
  );
  for (const requirement of input.protocol.evidence) {
    const active =
      requirement.showWhen === undefined ||
      evaluateRuleExpression(requirement.showWhen, values);
    if (
      active &&
      requirement.required &&
      !suppliedEvidenceTypes.has(requirement.type)
    ) {
      return "MISSING_REQUIRED";
    }
  }

  return "COMPLETE";
}

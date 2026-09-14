import type { Building } from "../building/types";
import {
  evaluateRuleExpression,
  type RuleValues,
} from "../protocol/evaluate-questions";
import type { Protocol, RouteRule, RuleField } from "../protocol/types";
import type {
  Answer,
  EvidenceState,
  IssueType,
  RationaleItem,
  RouteRecommendation,
} from "../ticket/types";

export type RouteRecommendationInput = {
  protocol: Protocol;
  building: Building;
  issueType: IssueType;
  answers: readonly Answer[];
  evidenceState: EvidenceState;
};

/**
 * Answers are namespaced under `answer.`, so a tenant cannot submit a
 * question id that impersonates a `context.` rule field.
 */
function ruleValues(input: RouteRecommendationInput): RuleValues {
  const values: RuleValues = { issueType: input.issueType };

  for (const entry of input.building.context) {
    if (entry.verified && entry.routingEligible && entry.value !== null) {
      values[`context.${entry.key}` as RuleField] = entry.value as
        | string
        | boolean
        | number;
    }
  }

  for (const answer of input.answers) {
    if (answer.value === null || Array.isArray(answer.value)) {
      continue;
    }
    values[`answer.${answer.questionId}` as RuleField] = answer.value;
  }

  return values;
}

function citedContextKeys(rule: RouteRule): string[] {
  const keys: string[] = [];

  const walk = (expression: RouteRule["when"]): void => {
    if (expression.op === "eq") {
      if (expression.field.startsWith("context.")) {
        keys.push(expression.field.slice("context.".length));
      }
      return;
    }
    for (const nested of expression.rules) {
      walk(nested);
    }
  };

  walk(rule.when);
  return keys;
}

function rationaleFor(
  rule: RouteRule,
  building: Building,
): RationaleItem[] {
  const contextKeys = citedContextKeys(rule);
  if (contextKeys.length === 0) {
    return [
      { protocolRuleId: rule.id, explanation: rule.rationaleTemplate },
    ];
  }

  return contextKeys.map((contextKey) => ({
    contextKey,
    protocolRuleId: rule.id,
    explanation: rule.rationaleTemplate,
    sourceType: building.context.find((entry) => entry.key === contextKey)
      ?.sourceType,
  }));
}

/**
 * Proposes a route for human review. Returns `null` — never a guess — whenever
 * the evidence gate is not COMPLETE or no protocol rule matches the verified
 * routing-eligible context.
 */
export function recommendRoute(
  input: RouteRecommendationInput,
): RouteRecommendation | null {
  if (input.evidenceState !== "COMPLETE") {
    return null;
  }

  const values = ruleValues(input);
  const matched = input.protocol.routeRules.find((rule) =>
    evaluateRuleExpression(rule.when, values),
  );

  if (!matched) {
    return null;
  }

  return {
    primary: matched.primary,
    alternatives: [...matched.alternatives],
    rationale: rationaleFor(matched, input.building),
    humanReviewRequired: true,
  };
}

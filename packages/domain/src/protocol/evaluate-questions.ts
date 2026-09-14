import type { ProtocolQuestion, RuleExpression, RuleField } from "./types";

export type RuleValues = Partial<
  Record<RuleField, string | boolean | number | null | undefined>
>;

export function evaluateRuleExpression(
  expression: RuleExpression,
  values: RuleValues,
): boolean {
  switch (expression.op) {
    case "eq":
      return values[expression.field] === expression.value;
    case "and":
      return expression.rules.every((rule) =>
        evaluateRuleExpression(rule, values),
      );
    case "or":
      return expression.rules.some((rule) =>
        evaluateRuleExpression(rule, values),
      );
  }
}

export function getActiveQuestions(
  questions: readonly ProtocolQuestion[],
  values: RuleValues,
): ProtocolQuestion[] {
  return questions.filter(
    (question) =>
      question.showWhen === undefined ||
      evaluateRuleExpression(question.showWhen, values),
  );
}

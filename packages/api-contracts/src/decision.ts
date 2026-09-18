import { z } from "zod";
import { RouteCodeSchema } from "./common";
import { SyntheticEvidenceTypeSchema } from "./question";

const ApproveDecisionRequestSchema = z
  .object({
    type: z.literal("APPROVE"),
  })
  .strict();

const OverrideDecisionRequestSchema = z
  .object({
    type: z.literal("OVERRIDE"),
    routeCode: RouteCodeSchema,
    reason: z.string().trim().min(1),
  })
  .strict();

/**
 * A more-info request names what the tenant must actually do: specific protocol
 * questions, specific synthetic evidence, or both. At least one is required —
 * a request that asks for nothing is not actionable.
 *
 * This remains a review-state change and never produces a RouteDecision.
 */
const MoreInfoDecisionRequestSchema = z
  .object({
    type: z.literal("REQUEST_MORE_INFO"),
    reason: z.string().trim().min(1),
    requestedQuestionIds: z.array(z.string().trim().min(1)).optional(),
    requestedEvidenceTypes: z.array(SyntheticEvidenceTypeSchema).optional(),
  })
  .strict()
  .refine(
    (request) =>
      (request.requestedQuestionIds?.length ?? 0) +
        (request.requestedEvidenceTypes?.length ?? 0) >
      0,
    {
      message:
        "A more-info request must name at least one question or evidence type",
    },
  );

export const DecisionRequestSchema = z.union([
  ApproveDecisionRequestSchema,
  OverrideDecisionRequestSchema,
  MoreInfoDecisionRequestSchema,
]);
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

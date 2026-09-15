import { z } from "zod";
import { RouteCodeSchema } from "./common";

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

const MoreInfoDecisionRequestSchema = z
  .object({
    type: z.literal("REQUEST_MORE_INFO"),
    reason: z.string().trim().min(1),
    requestedItems: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export const DecisionRequestSchema = z.discriminatedUnion("type", [
  ApproveDecisionRequestSchema,
  OverrideDecisionRequestSchema,
  MoreInfoDecisionRequestSchema,
]);
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

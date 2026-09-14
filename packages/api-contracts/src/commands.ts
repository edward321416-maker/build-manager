import { z } from "zod";
import { IssueTypeSchema } from "./common";

/**
 * `rawUserText` is the tenant's own description of the problem.
 *
 * It is untrusted input: the server feeds it to the deterministic safety gate
 * and never follows it as an instruction. It is required, because without it
 * report-text hazard handling cannot run at all. No length ceiling is imposed
 * here — the canonical documents define none.
 *
 * A unit is deliberately absent: P0 has one synthetic unit per demo building
 * and the server derives that identity itself.
 */
export const CreateTicketRequestSchema = z
  .object({
    buildingId: z.string().trim().min(1),
    issueType: IssueTypeSchema,
    rawUserText: z.string().trim().min(1),
  })
  .strict();
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

export const SubmitTenantAnswerRequestSchema = z
  .object({
    questionId: z.string().trim().min(1),
    answer: z.union([z.boolean(), z.string().trim().min(1)]),
  })
  .strict();
export type SubmitTenantAnswerRequest = z.infer<
  typeof SubmitTenantAnswerRequestSchema
>;

export const FinalizeTicketRequestSchema = z.object({}).strict();
export type FinalizeTicketRequest = z.infer<typeof FinalizeTicketRequestSchema>;

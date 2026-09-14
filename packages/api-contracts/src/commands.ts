import { z } from "zod";
import { IssueTypeSchema } from "./common";

export const CreateTicketRequestSchema = z
  .object({
    buildingId: z.string().trim().min(1),
    issueType: IssueTypeSchema,
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

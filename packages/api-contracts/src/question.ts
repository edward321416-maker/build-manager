import { z } from "zod";
import { ProtocolSchema } from "./common";

export const SyntheticEvidenceTypeSchema = z.enum([
  "BOILER_DISPLAY",
  "LEAK_LOCATION",
]);
export type SyntheticEvidenceType = z.infer<
  typeof SyntheticEvidenceTypeSchema
>;

export const SyntheticEvidenceRequirementDtoSchema = z
  .object({
    evidenceType: SyntheticEvidenceTypeSchema,
    label: z.string().trim().min(1),
    required: z.boolean(),
  })
  .strict();
export type SyntheticEvidenceRequirementDto = z.infer<
  typeof SyntheticEvidenceRequirementDtoSchema
>;

const questionBase = {
  questionId: z.string().trim().min(1),
  protocol: ProtocolSchema,
  prompt: z.string().trim().min(1),
  required: z.boolean(),
  evidenceRequirements: z.array(SyntheticEvidenceRequirementDtoSchema),
};

const YesNoQuestionDtoSchema = z
  .object({
    ...questionBase,
    responseType: z.literal("YES_NO"),
  })
  .strict();

const TextQuestionDtoSchema = z
  .object({
    ...questionBase,
    responseType: z.literal("TEXT"),
  })
  .strict();

const SelectOptionDtoSchema = z
  .object({
    value: z.string().trim().min(1),
    label: z.string().trim().min(1),
  })
  .strict();

const SingleSelectQuestionDtoSchema = z
  .object({
    ...questionBase,
    responseType: z.literal("SINGLE_SELECT"),
    options: z.array(SelectOptionDtoSchema).min(2),
  })
  .strict();

export const TenantQuestionDtoSchema = z.discriminatedUnion("responseType", [
  YesNoQuestionDtoSchema,
  TextQuestionDtoSchema,
  SingleSelectQuestionDtoSchema,
]);
export type TenantQuestionDto = z.infer<typeof TenantQuestionDtoSchema>;

export const SubmitSyntheticEvidenceRequestSchema = z
  .object({
    evidenceType: SyntheticEvidenceTypeSchema,
    fixtureId: z.string().trim().min(1),
  })
  .strict();
export type SubmitSyntheticEvidenceRequest = z.infer<
  typeof SubmitSyntheticEvidenceRequestSchema
>;

import { z } from "zod";
import { BuildingPassportDtoSchema } from "./building";
import {
  EvidenceStatusSchema,
  IssueTypeSchema,
  ProtocolSchema,
  TicketStatusSchema,
} from "./common";
import { DecisionRequestSchema } from "./decision";
import {
  SyntheticEvidenceRequirementDtoSchema,
  SyntheticEvidenceTypeSchema,
  TenantQuestionDtoSchema,
} from "./question";

const RouteOptionDtoSchema = z
  .object({
    routeCode: z.string().trim().min(1),
    label: z.string().trim().min(1),
  })
  .strict();

const RouteRecommendationDtoSchema = RouteOptionDtoSchema.extend({
  reasons: z.array(z.string().trim().min(1)).min(1),
}).strict();

const EstimatedCostDtoSchema = z
  .object({
    currency: z.literal("KRW"),
    minimum: z.number().int().nonnegative(),
    maximum: z.number().int().nonnegative(),
  })
  .strict();

const LandlordRepairPacketDtoSchema = z
  .object({
    revision: z.number().int().positive(),
    summary: z.string().trim().min(1),
    safetyEscalated: z.boolean(),
    recommendation: RouteRecommendationDtoSchema.nullable(),
    routeAlternatives: z.array(RouteOptionDtoSchema),
    provenance: z.array(z.string().trim().min(1)),
    internalNotes: z.array(z.string()),
    estimatedCost: EstimatedCostDtoSchema.nullable(),
    affectedUnits: z.array(z.string().trim().min(1)),
    hiddenContacts: z.array(z.string().trim().min(1)),
  })
  .strict();

export const LandlordTicketDetailDtoSchema = z
  .object({
    ticketId: z.string().trim().min(1),
    building: BuildingPassportDtoSchema,
    issueType: IssueTypeSchema,
    protocol: ProtocolSchema,
    status: TicketStatusSchema,
    evidenceStatus: EvidenceStatusSchema,
    activeQuestion: TenantQuestionDtoSchema.nullable(),
    repairPacket: LandlordRepairPacketDtoSchema.nullable(),
    decision: DecisionRequestSchema.nullable(),
  })
  .strict();
export type LandlordTicketDetailDto = z.infer<
  typeof LandlordTicketDetailDtoSchema
>;

export const LandlordTicketListSchema = z.array(LandlordTicketDetailDtoSchema);
export type LandlordTicketList = z.infer<typeof LandlordTicketListSchema>;

const SubmittedSyntheticEvidenceDtoSchema = z
  .object({
    evidenceId: z.string().trim().min(1),
    evidenceType: SyntheticEvidenceTypeSchema,
    label: z.string().trim().min(1),
  })
  .strict();

const TenantRepairPacketDtoSchema = z
  .object({
    revision: z.number().int().positive(),
    summary: z.string().trim().min(1),
    safetyEscalated: z.boolean(),
  })
  .strict();

export const TenantTicketStatusDtoSchema = z
  .object({
    ticketId: z.string().trim().min(1),
    buildingId: z.string().trim().min(1),
    issueType: IssueTypeSchema,
    protocol: ProtocolSchema,
    status: TicketStatusSchema,
    evidenceStatus: EvidenceStatusSchema,
    activeQuestion: TenantQuestionDtoSchema.nullable(),
    evidenceRequirements: z.array(SyntheticEvidenceRequirementDtoSchema),
    submittedEvidence: z.array(SubmittedSyntheticEvidenceDtoSchema),
    packet: TenantRepairPacketDtoSchema.nullable(),
  })
  .strict();
export type TenantTicketStatusDto = z.infer<
  typeof TenantTicketStatusDtoSchema
>;

export const TenantTicketListSchema = z.array(TenantTicketStatusDtoSchema);
export type TenantTicketList = z.infer<typeof TenantTicketListSchema>;

import { z } from "zod";
import { BuildingPassportDtoSchema } from "./building";
import {
  EvidenceStatusSchema,
  IssueTypeSchema,
  ProtocolSchema,
  RouteCodeSchema,
  TicketStatusSchema,
} from "./common";
import { DecisionRequestSchema } from "./decision";
import {
  SyntheticEvidenceRequirementDtoSchema,
  SyntheticEvidenceTypeSchema,
  TenantQuestionDtoSchema,
} from "./question";

export const RouteOptionDtoSchema = z
  .object({
    routeCode: RouteCodeSchema,
    label: z.string().trim().min(1),
  })
  .strict();
export type RouteOptionDto = z.infer<typeof RouteOptionDtoSchema>;

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

/**
 * The protocol questions and synthetic evidence a landlord may ask the tenant
 * for. Derived by the server from the selected protocol, so the review form
 * never has to guess what is askable.
 */
export const FollowUpOptionsDtoSchema = z
  .object({
    questions: z.array(TenantQuestionDtoSchema),
    evidence: z.array(SyntheticEvidenceRequirementDtoSchema),
  })
  .strict();
export type FollowUpOptionsDto = z.infer<typeof FollowUpOptionsDtoSchema>;

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
    followUpOptions: FollowUpOptionsDtoSchema,
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

/**
 * The tenant's current actionable follow-up request — not a history.
 *
 * It carries only what the tenant needs in order to respond: the reason, the
 * questions still outstanding, and the evidence still outstanding. No actor, no
 * timestamps, and nothing landlord-internal.
 */
export const TenantMoreInfoRequestDtoSchema = z
  .object({
    reason: z.string().trim().min(1),
    requestedQuestions: z.array(TenantQuestionDtoSchema),
    requestedEvidence: z.array(SyntheticEvidenceRequirementDtoSchema),
  })
  .strict();
export type TenantMoreInfoRequestDto = z.infer<
  typeof TenantMoreInfoRequestDtoSchema
>;

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
    moreInfoRequest: TenantMoreInfoRequestDtoSchema.nullable(),
  })
  .strict();
export type TenantTicketStatusDto = z.infer<
  typeof TenantTicketStatusDtoSchema
>;

export const TenantTicketListSchema = z.array(TenantTicketStatusDtoSchema);
export type TenantTicketList = z.infer<typeof TenantTicketListSchema>;

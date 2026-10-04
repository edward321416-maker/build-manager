import { z } from "zod";
export const CoreMaintenanceActionKindSchema=z.enum(["INSPECTION","REPAIR","PART_REPLACEMENT","ADJUSTMENT","OTHER"]);
export const CoreMaintenanceCorrectionReasonSchema=z.enum(["ACTION_CLASSIFICATION","COMPONENT_LABEL","OTHER"]);
// Reject controls before trimming: a trailing newline must not become an accepted label.
export const CoreMaintenanceComponentLabelSchema=z.string().refine(v=>!/[\p{Cc}\p{Cf}]/u.test(v)).transform(v=>v.trim()).pipe(z.string().min(1).max(80)).nullable();
export const CoreMaintenanceFactCreateSchema=z.object({clientRequestId:z.string().uuid(),actionKind:CoreMaintenanceActionKindSchema,componentLabel:CoreMaintenanceComponentLabelSchema}).strict();
export const CoreMaintenanceFactCorrectionSchema=CoreMaintenanceFactCreateSchema.extend({expectedCurrentFactId:z.string().uuid(),correctionReason:CoreMaintenanceCorrectionReasonSchema}).strict();
export const CoreUnitMaintenanceFactSchema=z.object({
 factId:z.string().uuid(),unitId:z.string().uuid(),buildingId:z.string().uuid(),buildingName:z.string(),unitLabel:z.string(),sourceTicketId:z.string().uuid(),
 issueType:z.enum(["HEATING","LEAK"]),actionKind:CoreMaintenanceActionKindSchema,componentLabel:CoreMaintenanceComponentLabelSchema,
 sourceCompletedAt:z.string().datetime({offset:true}),recordedAt:z.string().datetime({offset:true}),corrected:z.boolean(),correctionCount:z.number().int().nonnegative(),
 tenantOutcome:z.enum(["UNCONFIRMED","RESOLVED","UNRESOLVED","RECURRENCE_CLAIM"]),previousTicketId:z.string().uuid().nullable(),followUpTicketId:z.string().uuid().nullable(),
}).strict();
export const CoreMaintenanceFactRevisionSchema=z.object({factId:z.string().uuid(),actionKind:CoreMaintenanceActionKindSchema,componentLabel:CoreMaintenanceComponentLabelSchema,recordedAt:z.string().datetime({offset:true}),correctionReason:CoreMaintenanceCorrectionReasonSchema.nullable(),current:z.boolean()}).strict();
export const CoreMaintenanceFactDetailSchema=z.object({current:CoreUnitMaintenanceFactSchema.nullable(),revisions:z.array(CoreMaintenanceFactRevisionSchema)}).strict();
export const CoreUnitMaintenanceFactsSchema=z.array(CoreUnitMaintenanceFactSchema).max(100);
export type CoreMaintenanceActionKind=z.infer<typeof CoreMaintenanceActionKindSchema>;
export type CoreMaintenanceCorrectionReason=z.infer<typeof CoreMaintenanceCorrectionReasonSchema>;
export type CoreMaintenanceFactCreate=z.infer<typeof CoreMaintenanceFactCreateSchema>;
export type CoreMaintenanceFactCorrection=z.infer<typeof CoreMaintenanceFactCorrectionSchema>;
export type CoreUnitMaintenanceFact=z.infer<typeof CoreUnitMaintenanceFactSchema>;
export type CoreMaintenanceFactRevision=z.infer<typeof CoreMaintenanceFactRevisionSchema>;
export type CoreMaintenanceFactDetail=z.infer<typeof CoreMaintenanceFactDetailSchema>;

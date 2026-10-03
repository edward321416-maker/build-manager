import { z } from "zod";
import { CoreUnitSchema } from "./core-flow";

export const InvitationStateSchema=z.enum(["OPEN","REQUESTED","APPROVED","REJECTED","REVOKED","EXPIRED"]);
export const InvitationSchema=z.object({
 invitationId:z.string().uuid(),requestNumber:z.string().uuid().nullable(),
 unitId:z.string().uuid(),buildingId:z.string().uuid(),buildingName:z.string(),unitLabel:z.string(),
 state:InvitationStateSchema,createdAt:z.string().datetime({offset:true}),expiresAt:z.string().datetime({offset:true}),
 requestedAt:z.string().datetime({offset:true}).nullable(),decidedAt:z.string().datetime({offset:true}).nullable(),
}).strict();
export const InvitationPageSchema=z.object({items:z.array(InvitationSchema).max(20),nextCursor:z.string().uuid().nullable()}).strict();
export const InviteUnitsPageSchema=z.object({items:z.array(CoreUnitSchema).max(20),nextCursor:z.string().uuid().nullable()}).strict();
export const CreateInvitationSchema=z.object({unitId:z.string().uuid()}).strict();
export const TokenInvitationSchema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const InvitationDecisionSchema=z.object({invitationId:z.string().uuid(),requestNumber:z.string().uuid().optional()}).strict();
export const CreatedInvitationSchema=z.object({invitation:InvitationSchema,link:z.string().url()}).strict();
export type InvitationDto=z.infer<typeof InvitationSchema>;
export type InvitationPage=z.infer<typeof InvitationPageSchema>;
export type InviteUnitsPage=z.infer<typeof InviteUnitsPageSchema>;

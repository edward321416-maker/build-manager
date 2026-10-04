import { z } from "zod";
import { CoreTicketSchema } from "./core-flow";
import { CoreCommunicationBodySchema } from "./core-ticket-communication";

export const CoreOutcomeKindSchema=z.enum(["UNCONFIRMED","RESOLVED","UNRESOLVED","RECURRENCE_CLAIM"]);
export const CoreFollowUpKindSchema=z.enum(["UNRESOLVED","RECURRENCE_CLAIM"]);
export const CoreTicketOutcomeSchema=z.object({ticketId:z.string().uuid(),kind:CoreOutcomeKindSchema,assertedAt:z.string().datetime({offset:true}).nullable(),followUpTicketId:z.string().uuid().nullable()}).strict();
export const CoreConfirmResolvedSchema=z.object({clientRequestId:z.string().uuid()}).strict();
export const CoreCreateFollowUpSchema=z.object({clientRequestId:z.string().uuid(),claimKind:CoreFollowUpKindSchema,issueType:z.enum(["HEATING","LEAK"]),rawUserText:CoreCommunicationBodySchema}).strict();
export const CoreFollowUpResultSchema=z.object({sourceOutcome:CoreTicketOutcomeSchema,ticket:CoreTicketSchema}).strict();
export const CoreOutcomeReceiptSchema=z.object({outcome:CoreTicketOutcomeSchema,targetTicketId:z.string().uuid().nullable()}).strict();
export const CoreFollowUpSourceSchema=z.object({sourceTicketId:z.string().uuid().nullable()}).strict();
export type CoreTicketOutcome=z.infer<typeof CoreTicketOutcomeSchema>;
export type CoreConfirmResolved=z.infer<typeof CoreConfirmResolvedSchema>;
export type CoreCreateFollowUp=z.infer<typeof CoreCreateFollowUpSchema>;
export type CoreOutcomeReceipt=z.infer<typeof CoreOutcomeReceiptSchema>;
export type CoreFollowUpResultDto=z.infer<typeof CoreFollowUpResultSchema>;
export type CoreFollowUpSource=z.infer<typeof CoreFollowUpSourceSchema>;

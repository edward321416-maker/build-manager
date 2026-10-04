import { z } from "zod";

const version=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const sequence=version.refine(v=>v>0);
export const CoreCommunicationWaitingForSchema=z.enum(["NONE","TENANT","MANAGER"]);
export const CoreCommunicationIntentSchema=z.enum(["REQUEST_REPLY","TENANT_MESSAGE","MANAGER_REPLY","MANAGER_UPDATE"]);
export const CoreCommunicationBodySchema=z.string().trim().min(1).max(2000).refine(v=>!/[\p{Cc}\p{Cf}]/u.test(v.replace(/[\r\n]/g,"")));
export const CorePublicMessageSchema=z.object({
  id:z.string().uuid(),sequence,intent:CoreCommunicationIntentSchema,authorRole:z.enum(["TENANT","MANAGER"]),
  body:CoreCommunicationBodySchema,replyToMessageId:z.string().uuid().nullable(),createdAt:z.string().datetime({offset:true}),
}).strict();
export const CoreCommunicationPageSchema=z.object({version,waitingFor:CoreCommunicationWaitingForSchema,readOnly:z.boolean(),messages:z.array(CorePublicMessageSchema).max(50),nextBeforeSequence:sequence.nullable()}).strict();
export const CoreCommunicationSendSchema=z.object({clientRequestId:z.string().uuid(),expectedVersion:version,intent:CoreCommunicationIntentSchema,body:CoreCommunicationBodySchema}).strict();
export const CoreCommunicationSummarySchema=z.object({ticketId:z.string().uuid(),version,waitingFor:CoreCommunicationWaitingForSchema,readOnly:z.boolean()}).strict();
export const CoreCommunicationSummariesSchema=z.array(CoreCommunicationSummarySchema).max(50);
export type CoreCommunicationWaitingFor=z.infer<typeof CoreCommunicationWaitingForSchema>;
export type CoreCommunicationIntent=z.infer<typeof CoreCommunicationIntentSchema>;
export type CorePublicMessage=z.infer<typeof CorePublicMessageSchema>;
export type CoreCommunicationPage=z.infer<typeof CoreCommunicationPageSchema>;
export type CoreCommunicationSend=z.infer<typeof CoreCommunicationSendSchema>;
export type CoreCommunicationSummary=z.infer<typeof CoreCommunicationSummarySchema>;

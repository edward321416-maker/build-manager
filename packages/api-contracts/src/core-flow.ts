import { z } from "zod";
import { TenantTicketStatusDtoSchema,LandlordTicketDetailDtoSchema } from "./ticket";

export const CoreLoginSchema=z.object({accessCode:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const CoreSessionSchema=z.object({role:z.enum(["TENANT","ORG_ADMIN","PROPERTY_STAFF"]),synthetic:z.literal(true)}).strict();
export const CoreUnitSchema=z.object({id:z.string().uuid(),buildingId:z.string().uuid(),buildingName:z.string(),label:z.string()}).strict();
export const CoreUnitsSchema=z.array(CoreUnitSchema);
export const CoreCreateSchema=z.object({unitId:z.string().uuid(),issueType:z.enum(["HEATING","LEAK"]),rawUserText:z.string().trim().min(1).max(2000)}).strict();
export const CoreHandlingSchema=z.object({status:z.enum(["IN_PROGRESS","COMPLETED"]),message:z.string().trim().min(1).max(2000)}).strict();
export const CoreTicketSchema=z.object({
  ticketId:z.string(),unitId:z.string().uuid(),buildingId:z.string().uuid(),
  workStatus:z.enum(["OPEN","IN_PROGRESS","COMPLETED"]),version:z.number().int().positive(),
  detail:z.union([TenantTicketStatusDtoSchema,LandlordTicketDetailDtoSchema]),
  events:z.array(z.object({id:z.string(),kind:z.string(),actorRole:CoreSessionSchema.shape.role,message:z.string(),at:z.string().datetime({offset:true})}).strict()),
}).strict();
export const CoreTicketsSchema=z.array(CoreTicketSchema);
export type CoreSessionDto=z.infer<typeof CoreSessionSchema>;
export type CoreUnitDto=z.infer<typeof CoreUnitSchema>;
export type CoreTicketDto=z.infer<typeof CoreTicketSchema>;
export type CoreCreateRequest=z.infer<typeof CoreCreateSchema>;
export type CoreHandlingRequest=z.infer<typeof CoreHandlingSchema>;

import { z } from "zod";
import { TenantTicketStatusDtoSchema,LandlordTicketDetailDtoSchema } from "./ticket";

export const CoreLoginSchema=z.object({accessCode:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const CoreSessionSchema=z.object({role:z.enum(["TENANT","ORG_ADMIN","PROPERTY_STAFF"]),synthetic:z.literal(true)}).strict();
export const CoreAccessSchema=z.object({authentication:z.literal("B1"),synthetic:z.literal(true),csrf:z.string().regex(/^[a-f0-9]{64}$/),organizations:z.array(z.object({id:z.string().uuid(),name:z.string(),role:z.enum(["TENANT","ORG_ADMIN","PROPERTY_STAFF"])}).strict())}).strict();
export type CoreAccessDto=z.infer<typeof CoreAccessSchema>;
export const CoreUnitSchema=z.object({id:z.string().uuid(),buildingId:z.string().uuid(),buildingName:z.string(),label:z.string()}).strict();
export const CoreUnitsSchema=z.array(CoreUnitSchema);
export const CoreCreateSchema=z.object({unitId:z.string().uuid(),issueType:z.enum(["HEATING","LEAK"]),rawUserText:z.string().trim().min(1).max(2000)}).strict();
export const CoreHandlingSchema=z.object({status:z.enum(["IN_PROGRESS","COMPLETED"]),message:z.string().trim().min(1).max(2000),expectedCommunicationVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()}).strict();
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

export const CORE_PHOTO_MAX_BYTES=5*1024*1024;
export const CORE_PHOTO_MAX_PIXELS=20_000_000;
export const CORE_PHOTO_MAX_COUNT=3;
export const CorePhotoSchema=z.object({
  photoId:z.string().uuid(),uploadId:z.string().uuid(),createdAt:z.string().datetime({offset:true}),
  mime:z.enum(["image/jpeg","image/png"]),byteSize:z.number().int().positive().max(CORE_PHOTO_MAX_BYTES),
  width:z.number().int().positive(),height:z.number().int().positive(),
  path:z.string().regex(/^\/api\/v2\/core\/tickets\/[a-f0-9-]{36}\/photos\/[a-f0-9-]{36}$/),
}).strict().refine(p=>p.width*p.height<=CORE_PHOTO_MAX_PIXELS);
export const CorePhotosSchema=z.array(CorePhotoSchema).max(CORE_PHOTO_MAX_COUNT);
export type CorePhotoDto=z.infer<typeof CorePhotoSchema>;

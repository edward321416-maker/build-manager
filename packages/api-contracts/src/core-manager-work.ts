import { z } from "zod";

export const CoreManagerPrioritySchema=z.enum(["NORMAL","HIGH","URGENT"]);
const label=z.string().trim().min(1).max(80).refine(v=>!/[\p{Cc}\p{Cf}]/u.test(v));
const note=z.string().trim().min(1).max(2000).refine(v=>!/[\p{Cc}\p{Cf}]/u.test(v.replace(/[\r\n]/g,"")));
const date=z.string().datetime({offset:true});
export const CoreManagerWorkItemSchema=z.object({
  ticketId:z.string().uuid(),unitId:z.string().uuid(),buildingId:z.string().uuid(),buildingName:z.string(),unitLabel:z.string(),
  issueType:z.enum(["HEATING","LEAK"]),workStatus:z.enum(["OPEN","IN_PROGRESS","COMPLETED"]),
  priority:CoreManagerPrioritySchema,assigneeLabel:label.nullable(),dueAt:date.nullable(),
  createdAt:date,updatedAt:date,version:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const CoreManagerWorkItemsSchema=z.array(CoreManagerWorkItemSchema);
export const CoreManagerWorkUpdateSchema=z.object({priority:CoreManagerPrioritySchema,assigneeLabel:label.nullable(),dueAt:date.nullable(),expectedVersion:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict();
export const CoreManagerInternalNoteSchema=z.object({id:z.string().regex(/^[1-9][0-9]*$/),body:note,createdAt:date}).strict();
export const CoreManagerInternalNotesSchema=z.array(CoreManagerInternalNoteSchema);
export const CoreManagerInternalNoteCreateSchema=z.object({body:note}).strict();
export type CoreManagerWorkItem=z.infer<typeof CoreManagerWorkItemSchema>;
export type CoreManagerWorkUpdate=z.infer<typeof CoreManagerWorkUpdateSchema>;
export type CoreManagerInternalNote=z.infer<typeof CoreManagerInternalNoteSchema>;

import { z } from "zod";
import { HeatingTypeSchema,ManagementModeSchema } from "./building";

// P6 + C1 step 2 (docs/superpowers/specs/2026-10-15-building-setup-p6-design.md): organisation admins describe their buildings.
const uuid=z.string().uuid();
// The same filter as the vendor packet's plainSingle (vendor-handoff.ts): a saved name or address is sent to the vendor.
const singleLine=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!/[\p{Cc}\p{Cf}]/u.test(value),{message:"INVALID_INPUT"});
export const CoreBuildingSummarySchema=z.object({buildingId:uuid,displayName:z.string().min(1).nullable(),unitCount:z.number().int().min(0),needsInfo:z.boolean()}).strict();
export const CoreBuildingListSchema=z.object({editable:z.boolean(),items:z.array(CoreBuildingSummarySchema)}).strict();
export const CoreBuildingInfoSchema=z.object({buildingId:uuid,displayName:z.string().min(1).nullable(),serviceAddress:z.string().min(1).nullable(),
  heatingType:HeatingTypeSchema.nullable(),managementMode:ManagementModeSchema.nullable(),demo:z.boolean(),version:z.number().int().min(0),
  unitCount:z.number().int().min(0),editable:z.boolean()}).strict();
export const CoreBuildingInfoSaveSchema=z.object({expectedVersion:z.number().int().min(0).max(2_147_483_646),displayName:singleLine(50),
  serviceAddress:singleLine(200).nullable(),heatingType:HeatingTypeSchema.nullable(),managementMode:ManagementModeSchema.nullable()}).strict();
export type CoreBuildingSummaryDto=z.infer<typeof CoreBuildingSummarySchema>;
export type CoreBuildingListDto=z.infer<typeof CoreBuildingListSchema>;
export type CoreBuildingInfoDto=z.infer<typeof CoreBuildingInfoSchema>;
export type CoreBuildingInfoSave=z.infer<typeof CoreBuildingInfoSaveSchema>;

import { z } from "zod";

export const ManagementModeSchema = z.enum([
  "OWNER_DIRECT",
  "MANAGEMENT_OFFICE",
]);
export type ManagementMode = z.infer<typeof ManagementModeSchema>;

export const HeatingTypeSchema = z.enum(["INDIVIDUAL", "CENTRAL_SHARED"]);
export type HeatingType = z.infer<typeof HeatingTypeSchema>;

export const RoutingEligibleBuildingFieldSchema = z.enum([
  "managementMode",
  "heatingType",
  "ownerSuppliedBoiler",
]);
export type RoutingEligibleBuildingField = z.infer<
  typeof RoutingEligibleBuildingFieldSchema
>;

export const BuildingPassportDtoSchema = z
  .object({
    buildingId: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    demo: z.literal(true),
    primaryUse: z.string().trim().min(1),
    approvalYear: z.string().regex(/^\d{4}$/),
    managementMode: ManagementModeSchema,
    heatingType: HeatingTypeSchema,
    ownerSuppliedBoiler: z.boolean().optional(),
    contextVerified: z.boolean(),
    routingEligibleFields: z.array(RoutingEligibleBuildingFieldSchema),
  })
  .strict();
export type BuildingPassportDto = z.infer<typeof BuildingPassportDtoSchema>;

/**
 * A building with no Core building context (registered on /workspace, C1 step 1). It carries no
 * building facts, so nothing in it can read as verified or routing-eligible.
 */
export const UnverifiedBuildingDtoSchema = z
  .object({
    buildingId: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    demo: z.literal(false),
    contextVerified: z.literal(false),
    routingEligibleFields: z.array(RoutingEligibleBuildingFieldSchema).length(0),
  })
  .strict();
export type UnverifiedBuildingDto = z.infer<typeof UnverifiedBuildingDtoSchema>;

export const BuildingPassportListSchema = z.array(BuildingPassportDtoSchema);
export type BuildingPassportList = z.infer<typeof BuildingPassportListSchema>;

export const OwnerVerificationRequestSchema = z
  .object({
    managementMode: ManagementModeSchema,
    heatingType: HeatingTypeSchema,
    ownerSuppliedBoiler: z.boolean().optional(),
  })
  .strict();
export type OwnerVerificationRequest = z.infer<
  typeof OwnerVerificationRequestSchema
>;

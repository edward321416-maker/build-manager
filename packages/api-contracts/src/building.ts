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

const OrgVerifiedFieldSchema = z.enum(["managementMode", "heatingType"]);

/**
 * A non-demo building (registered on /workspace or the Core setup screen). It carries only the facts an
 * organisation admin verified (P6 + C1 step 2); with none it is the C1 step 1 unverified building.
 */
export const OrgBuildingDtoSchema = z
  .object({
    buildingId: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    demo: z.literal(false),
    managementMode: ManagementModeSchema.optional(),
    heatingType: HeatingTypeSchema.optional(),
    contextVerified: z.boolean(),
    routingEligibleFields: z.array(OrgVerifiedFieldSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const present = OrgVerifiedFieldSchema.options.filter((key) => value[key] !== undefined);
    if (value.routingEligibleFields.join() !== present.join()) context.addIssue({ code: "custom", message: "routingEligibleFields" });
    if (value.contextVerified !== (present.length === OrgVerifiedFieldSchema.options.length)) context.addIssue({ code: "custom", message: "contextVerified" });
  });
export type OrgBuildingDto = z.infer<typeof OrgBuildingDtoSchema>;

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

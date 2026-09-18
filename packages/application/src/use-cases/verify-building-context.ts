import type {
  Building,
  ContextValue,
  HeatingType,
  ManagementMode,
} from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";
import { loadBuilding } from "./ticket-assessment";

export type VerifyBuildingContextInput = {
  buildingId: string;
  managementMode: ManagementMode;
  heatingType: HeatingType;
  ownerSuppliedBoiler?: boolean;
};

/**
 * Records an owner's verification of the few facts routing is allowed to use.
 * A re-verification replaces the previous one rather than stacking context the
 * protocol selector would then read as conflicting.
 */
export async function verifyBuildingContext(
  deps: ApplicationDependencies,
  input: VerifyBuildingContextInput,
): Promise<Building> {
  const building = await loadBuilding(deps, input.buildingId);
  const updatedAt = deps.clock.now();

  const ownerVerified = (
    key: string,
    value: unknown,
  ): ContextValue<unknown> => ({
    key,
    value,
    sourceType: "OWNER_VERIFIED",
    sourceRef: `owner:${building.id}`,
    verified: true,
    routingEligible: true,
    fetchedAt: null,
    updatedAt,
  });

  const verified: ContextValue<unknown>[] = [
    ownerVerified("managementMode", input.managementMode),
    ownerVerified("heatingType", input.heatingType),
  ];
  if (input.ownerSuppliedBoiler !== undefined) {
    verified.push(
      ownerVerified("ownerSuppliedBoiler", input.ownerSuppliedBoiler),
    );
  }

  const updated: Building = {
    ...building,
    context: [
      ...building.context.filter(
        (entry) => entry.sourceType !== "OWNER_VERIFIED",
      ),
      ...verified,
    ],
  };

  await deps.buildings.save(updated);
  return updated;
}

import type { Building } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";

export type GetBuildingInput = {
  buildingId: string;
};

/**
 * Minimal repository read. Returns null rather than throwing, matching
 * `getTicket`, so callers map a missing building to their own not-found
 * response instead of catching an error.
 */
export async function getBuilding(
  deps: ApplicationDependencies,
  input: GetBuildingInput,
): Promise<Building | null> {
  return deps.buildings.findById(input.buildingId);
}

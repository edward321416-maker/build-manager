import type { Building } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";

/**
 * Minimal repository read for building discovery. Role-specific DTO mapping
 * belongs to the API layer, not here.
 */
export async function listBuildings(
  deps: ApplicationDependencies,
): Promise<Building[]> {
  return deps.buildings.list();
}

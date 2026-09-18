import type { Building, ContextValue } from "@build-manager/domain";
import type { ApplicationDependencies, ProviderContextRecord } from "../ports";

export type CreateDemoBuildingInput = {
  displayName: string;
};

/**
 * External provider facts are informational whatever the provider claims. Only
 * an explicit owner verification may make context routing eligible.
 */
function asInformational(
  record: ProviderContextRecord | null,
): ContextValue<unknown>[] {
  if (!record) {
    return [];
  }
  return record.context.map((entry) => ({ ...entry, routingEligible: false }));
}

/**
 * Creates a synthetic public demo building. Demo buildings carry no address,
 * so the address provider is never consulted.
 */
export async function createDemoBuilding(
  deps: ApplicationDependencies,
  input: CreateDemoBuildingInput,
): Promise<Building> {
  const id = deps.ids.next("building");
  const [registry, kapt] = await Promise.all([
    deps.buildingRegistry.fetchContext(id),
    deps.kapt.fetchContext(id),
  ]);

  const building: Building = {
    id,
    displayName: input.displayName,
    demo: true,
    normalizedAddress: null,
    sourceNativeIds: {
      jusoBdMgtSn: null,
      buildingHubId: null,
      kaptCode: null,
    },
    context: [...asInformational(registry), ...asInformational(kapt)],
  };

  await deps.buildings.save(building);
  return building;
}

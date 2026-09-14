import { BuildingPassportListSchema } from "@build-manager/api-contracts";
import { jsonResponse, validateResponse } from "../json";
import { presentBuildingPassport } from "../presenters";
import type { ContainerProvider } from "../request-container";
import { respond } from "./respond";

export function handleListDemoBuildings(
  withContainer: ContainerProvider,
): Promise<Response> {
  return respond(async () => {
    const buildings = await withContainer((container) =>
      container.useCases.listBuildings(),
    );

    return jsonResponse(
      validateResponse(
        BuildingPassportListSchema,
        buildings.map(presentBuildingPassport),
      ),
    );
  });
}

/**
 * Demo-only. Clears synthetic demo state and reseeds the canonical buildings
 * through the application use case; this route runs no DELETE of its own and
 * is not a production destructive endpoint.
 */
export function handleResetDemo(
  withContainer: ContainerProvider,
): Promise<Response> {
  return respond(async () => {
    const reseeded = await withContainer((container) =>
      container.useCases.resetDemo(),
    );

    return jsonResponse(
      validateResponse(
        BuildingPassportListSchema,
        reseeded.map(presentBuildingPassport),
      ),
    );
  });
}

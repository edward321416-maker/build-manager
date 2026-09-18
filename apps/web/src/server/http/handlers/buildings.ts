import {
  BuildingPassportDtoSchema,
  OwnerVerificationRequestSchema,
} from "@build-manager/api-contracts";
import { notFound } from "../errors";
import {
  jsonResponse,
  parseRequest,
  readJsonBody,
  validateResponse,
} from "../json";
import { presentBuildingPassport } from "../presenters";
import type { ContainerProvider } from "../request-container";
import { respond } from "./respond";

export function handleGetBuilding(
  withContainer: ContainerProvider,
  buildingId: string,
): Promise<Response> {
  return respond(async () => {
    const building = await withContainer((container) =>
      container.useCases.getBuilding({ buildingId }),
    );

    if (building === null) {
      throw notFound();
    }

    return jsonResponse(
      validateResponse(
        BuildingPassportDtoSchema,
        presentBuildingPassport(building),
      ),
    );
  });
}

/**
 * Records an owner verification. Registry facts stay informational — this
 * layer never promotes provider context to routing eligible; the application
 * decides what may influence routing.
 */
export function handleVerifyBuildingContext(
  withContainer: ContainerProvider,
  request: Request,
  buildingId: string,
): Promise<Response> {
  return respond(async () => {
    const body = parseRequest(
      OwnerVerificationRequestSchema,
      await readJsonBody(request),
    );

    const building = await withContainer((container) =>
      container.useCases.verifyBuildingContext({ buildingId, ...body }),
    );

    return jsonResponse(
      validateResponse(
        BuildingPassportDtoSchema,
        presentBuildingPassport(building),
      ),
    );
  });
}

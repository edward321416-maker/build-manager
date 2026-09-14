import type { Building } from "../building/types";
import {
  heatingIndividualV1,
  heatingSharedV1,
  heatingUnknownV1,
} from "./heating.v1";
import type { Protocol } from "./types";

/**
 * Picks the heating branch from verified routing-eligible building context
 * only. Unverified, routing-ineligible, missing, conflicting, and unsupported
 * heating types all fall through to the explicit unknown branch, which asks
 * rather than guesses.
 */
export function selectHeatingProtocol(building: Building): Protocol {
  const trustedHeatingTypes = new Set(
    building.context
      .filter(
        (entry) =>
          entry.key === "heatingType" && entry.verified && entry.routingEligible,
      )
      .map((entry) => entry.value),
  );

  if (trustedHeatingTypes.size !== 1) {
    return heatingUnknownV1;
  }

  const [heatingType] = trustedHeatingTypes;
  if (heatingType === "INDIVIDUAL") {
    return heatingIndividualV1;
  }
  if (heatingType === "CENTRAL_SHARED") {
    return heatingSharedV1;
  }
  return heatingUnknownV1;
}

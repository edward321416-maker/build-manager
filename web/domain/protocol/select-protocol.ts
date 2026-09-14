import type { Building } from "@/domain/building/types";
import type { Protocol } from "@/domain/protocol/types";
import type { IssueType } from "@/domain/ticket/types";
import {
  heatingIndividualV1,
  heatingSharedV1,
  heatingUnknownV1,
} from "@/protocols/heating.v1";

export function selectProtocol(building: Building, issueType: IssueType): Protocol {
  if (issueType !== "HEATING") {
    throw new Error(`Unsupported issue type: ${issueType}`);
  }

  const trustedHeatingTypes = new Set(
    building.context
      .filter(
        (entry) =>
          entry.key === "heatingType" &&
          entry.verified &&
          entry.routingEligible,
      )
      .map((entry) => entry.value),
  );

  if (trustedHeatingTypes.size !== 1) return heatingUnknownV1;

  const [heatingType] = trustedHeatingTypes;
  if (heatingType === "INDIVIDUAL") return heatingIndividualV1;
  if (heatingType === "CENTRAL_SHARED") return heatingSharedV1;
  return heatingUnknownV1;
}

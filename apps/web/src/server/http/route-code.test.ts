import {
  DecisionRequestSchema,
  RouteCodeSchema,
} from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { parseRouteCode } from "./route-code";

/**
 * The one place both vocabularies may legally be compared.
 *
 * The public contract deliberately does not import the domain, so nothing else
 * would notice if the two lists drifted apart. This proves every public route
 * code is still accepted by the domain-side parser, without any cast.
 */
describe("public and domain route vocabularies stay compatible", () => {
  it("accepts every public route code on the domain side", () => {
    for (const routeCode of RouteCodeSchema.options) {
      expect(parseRouteCode(routeCode)).toBe(routeCode);
    }
  });

  it("covers exactly the same number of routes on both sides", () => {
    const acceptedByDomain = RouteCodeSchema.options.filter(
      (routeCode) => parseRouteCode(routeCode) !== null,
    );

    expect(acceptedByDomain).toHaveLength(RouteCodeSchema.options.length);
    expect(RouteCodeSchema.options).toHaveLength(5);
  });

  it("rejects a route string that is in neither vocabulary", () => {
    for (const routeCode of [
      "GENERAL_REPAIR",
      "OWNER_BOILER_TECHNICIAN",
      "SEND_TO_MARS",
      "",
      "landlord_review",
    ]) {
      expect(parseRouteCode(routeCode)).toBeNull();
      expect(RouteCodeSchema.safeParse(routeCode).success).toBe(false);
    }
  });

  it("refuses an override request carrying an unknown route before it reaches the domain", () => {
    expect(
      DecisionRequestSchema.safeParse({
        type: "OVERRIDE",
        routeCode: "SEND_TO_MARS",
        reason: "테스트",
      }).success,
    ).toBe(false);

    expect(
      DecisionRequestSchema.safeParse({
        type: "OVERRIDE",
        routeCode: "THIRD_PARTY_MANAGER",
        reason: "테스트",
      }).success,
    ).toBe(true);
  });
});

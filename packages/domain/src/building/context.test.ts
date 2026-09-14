import { describe, expect, it } from "vitest";
import type { Building, ContextValue } from "./types";
import { getBuildingContext, routingEligibleContextKeys } from "./types";

function context(
  key: string,
  value: unknown,
  overrides: Partial<ContextValue<unknown>> = {},
): ContextValue<unknown> {
  return {
    key,
    value,
    sourceType: "OWNER_VERIFIED",
    sourceRef: "demo-fixture:test",
    verified: true,
    routingEligible: true,
    fetchedAt: null,
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  };
}

function building(entries: ContextValue<unknown>[]): Building {
  return {
    id: "demo-building-test",
    displayName: "DEMO 테스트빌라",
    demo: true,
    normalizedAddress: null,
    sourceNativeIds: {
      jusoBdMgtSn: null,
      buildingHubId: null,
      kaptCode: null,
    },
    context: entries,
  };
}

describe("building context lookup", () => {
  it("returns the stored entry for a known context key", () => {
    const subject = building([context("heatingType", "INDIVIDUAL")]);

    expect(getBuildingContext(subject, "heatingType")?.value).toBe("INDIVIDUAL");
  });

  it("returns undefined for a context key the building does not carry", () => {
    const subject = building([context("heatingType", "INDIVIDUAL")]);

    expect(getBuildingContext(subject, "ownerSuppliedBoiler")).toBeUndefined();
  });
});

describe("routing eligibility", () => {
  it("lists only context that is both verified and routing eligible", () => {
    const subject = building([
      context("managementMode", "OWNER_DIRECT"),
      context("heatingType", "INDIVIDUAL"),
      context("approvalYear", "2011", {
        sourceType: "FIXTURE_OFFICIAL",
        routingEligible: false,
      }),
    ]);

    expect(routingEligibleContextKeys(subject)).toEqual([
      "managementMode",
      "heatingType",
    ]);
  });

  it("excludes unverified context even when it is marked routing eligible", () => {
    const subject = building([
      context("managementMode", "OWNER_DIRECT"),
      context("ownerSuppliedBoiler", true, { verified: false }),
    ]);

    expect(routingEligibleContextKeys(subject)).toEqual(["managementMode"]);
  });

  it("excludes routing-eligible context whose value is missing", () => {
    const subject = building([
      context("managementMode", "OWNER_DIRECT"),
      context("heatingType", null),
    ]);

    expect(routingEligibleContextKeys(subject)).toEqual(["managementMode"]);
  });

  it("reports no routing-eligible context for a building without verified owner facts", () => {
    const subject = building([
      context("approvalYear", "2011", {
        sourceType: "FIXTURE_OFFICIAL",
        routingEligible: false,
      }),
    ]);

    expect(routingEligibleContextKeys(subject)).toEqual([]);
  });
});

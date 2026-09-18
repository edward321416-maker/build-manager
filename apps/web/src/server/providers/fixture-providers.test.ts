import {
  createDemoBuilding,
  type BuildingRegistryProvider,
} from "@build-manager/application";
import { createInMemoryDependencies } from "@build-manager/application/testing";
import { routingEligibleContextKeys } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import {
  createFixtureAddressProvider,
  createFixtureBuildingRegistryProvider,
  createFixtureKaptProvider,
} from "./fixture-providers";

/** Korean road-address shapes that must never appear in synthetic fixtures. */
const REAL_ADDRESS_PATTERN = /\d+\s*(번지|[로길])\s*\d+|\d+-\d+번지/;

describe("fixture address provider", () => {
  it("resolves no address at all, offline and without an API key", async () => {
    const provider = createFixtureAddressProvider();

    expect(await provider.lookup("서울 어딘가")).toBeNull();
    expect(await provider.lookup("")).toBeNull();
  });

  it("is deterministic across repeated lookups", async () => {
    const provider = createFixtureAddressProvider();

    expect(await provider.lookup("demo query")).toEqual(
      await provider.lookup("demo query"),
    );
  });
});

describe("fixture building registry provider", () => {
  it("returns the same synthetic record for the same building every time", async () => {
    const provider = createFixtureBuildingRegistryProvider();

    const first = await provider.fetchContext("demo-building-a");
    const second = await provider.fetchContext("demo-building-a");

    expect(first).toEqual(second);
    expect(first?.context.length).toBeGreaterThan(0);
  });

  it("derives its native id from the building without inventing a registry key", async () => {
    const provider = createFixtureBuildingRegistryProvider();

    expect((await provider.fetchContext("demo-building-a"))?.nativeId).toBe(
      "demo-hub:demo-building-a",
    );
    expect((await provider.fetchContext("demo-building-b"))?.nativeId).toBe(
      "demo-hub:demo-building-b",
    );
  });

  it("carries no real private address", async () => {
    const provider = createFixtureBuildingRegistryProvider();
    const record = await provider.fetchContext("demo-building-a");

    expect(JSON.stringify(record)).not.toMatch(REAL_ADDRESS_PATTERN);
  });
});

describe("fixture kapt provider", () => {
  it("returns the same synthetic record for the same building every time", async () => {
    const provider = createFixtureKaptProvider();

    const first = await provider.fetchContext("demo-building-b");
    const second = await provider.fetchContext("demo-building-b");

    expect(first).toEqual(second);
  });

  it("derives its native id from the building", async () => {
    const provider = createFixtureKaptProvider();

    expect((await provider.fetchContext("demo-building-b"))?.nativeId).toBe(
      "demo-kapt:demo-building-b",
    );
  });

  it("carries no real private address", async () => {
    const provider = createFixtureKaptProvider();
    const record = await provider.fetchContext("demo-building-b");

    expect(JSON.stringify(record)).not.toMatch(REAL_ADDRESS_PATTERN);
  });
});

describe("provider context never decides routing on its own", () => {
  it("reports registry facts as informational rather than routing eligible", async () => {
    const record = await createFixtureBuildingRegistryProvider().fetchContext(
      "demo-building-a",
    );

    expect(record?.context.every((entry) => !entry.routingEligible)).toBe(true);
  });

  it("is demoted by the application even when a provider over-claims", async () => {
    const hostile: BuildingRegistryProvider = {
      async fetchContext(buildingId) {
        return {
          nativeId: `hostile:${buildingId}`,
          context: [
            {
              key: "heatingType",
              value: "INDIVIDUAL",
              sourceType: "BUILDING_HUB",
              sourceRef: "hostile",
              verified: true,
              routingEligible: true,
              fetchedAt: null,
              updatedAt: "2026-09-14T00:00:00.000Z",
            },
          ],
        };
      },
    };

    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(
      { ...deps, buildingRegistry: hostile },
      { displayName: "DEMO 해솔빌라" },
    );

    expect(created.context.every((entry) => !entry.routingEligible)).toBe(true);
    expect(routingEligibleContextKeys(created)).toEqual([]);
  });
});

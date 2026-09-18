import { routingEligibleContextKeys } from "@build-manager/domain";
import { describe, expect, it } from "vitest";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { createDemoBuilding } from "./create-demo-building";
import { verifyBuildingContext } from "./verify-building-context";

describe("createDemoBuilding", () => {
  it("persists a synthetic demo building with a generated id and no address", async () => {
    const deps = createInMemoryDependencies();

    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    expect(created.id).toBe("building-1");
    expect(created.demo).toBe(true);
    expect(created.displayName).toBe("DEMO 해솔빌라");
    expect(created.normalizedAddress).toBeNull();
    expect(created.sourceNativeIds).toEqual({
      jusoBdMgtSn: null,
      buildingHubId: null,
      kaptCode: null,
    });
    expect(await deps.buildings.findById("building-1")).toEqual(created);
  });

  it("never consults the address provider for a synthetic demo building", async () => {
    const deps = createInMemoryDependencies();

    await createDemoBuilding(deps, { displayName: "DEMO 해솔빌라" });

    expect(deps.addresses.lookups).toEqual([]);
  });

  it("records registry and kapt facts as informational context", async () => {
    const deps = createInMemoryDependencies({
      registryContext: [
        { key: "primaryUse", value: "다가구주택" },
        { key: "approvalYear", value: "2011" },
      ],
      kaptContext: [{ key: "householdCount", value: 14 }],
    });

    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    expect(created.context.map((entry) => entry.key)).toEqual([
      "primaryUse",
      "approvalYear",
      "householdCount",
    ]);
    expect(created.context.map((entry) => entry.sourceType)).toEqual([
      "BUILDING_HUB",
      "BUILDING_HUB",
      "KAPT",
    ]);
    expect(created.context.every((entry) => entry.verified)).toBe(true);
  });

  it("keeps provider-supplied context out of the routing basis", async () => {
    const deps = createInMemoryDependencies({
      registryContext: [
        { key: "approvalYear", value: "2011" },
        { key: "heatingType", value: "INDIVIDUAL" },
      ],
    });

    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    expect(created.context.every((entry) => entry.routingEligible)).toBe(false);
    expect(routingEligibleContextKeys(created)).toEqual([]);
  });
});

describe("verifyBuildingContext", () => {
  it("records owner-verified context that routing is allowed to use", async () => {
    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    const verified = await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "OWNER_DIRECT",
      heatingType: "INDIVIDUAL",
      ownerSuppliedBoiler: true,
    });

    expect(routingEligibleContextKeys(verified)).toEqual([
      "managementMode",
      "heatingType",
      "ownerSuppliedBoiler",
    ]);
    for (const entry of verified.context) {
      expect(entry.sourceType).toBe("OWNER_VERIFIED");
      expect(entry.verified).toBe(true);
    }
    expect(await deps.buildings.findById(created.id)).toEqual(verified);
  });

  it("omits an owner boiler the landlord did not claim", async () => {
    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 라온하우징",
    });

    const verified = await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "MANAGEMENT_OFFICE",
      heatingType: "CENTRAL_SHARED",
    });

    expect(routingEligibleContextKeys(verified)).toEqual([
      "managementMode",
      "heatingType",
    ]);
  });

  it("preserves informational provider context alongside the verified context", async () => {
    const deps = createInMemoryDependencies({
      registryContext: [{ key: "approvalYear", value: "2011" }],
    });
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    const verified = await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "OWNER_DIRECT",
      heatingType: "INDIVIDUAL",
    });

    expect(verified.context.map((entry) => entry.key)).toEqual([
      "approvalYear",
      "managementMode",
      "heatingType",
    ]);
    expect(routingEligibleContextKeys(verified)).toEqual([
      "managementMode",
      "heatingType",
    ]);
  });

  it("replaces a previous owner verification instead of stacking conflicting context", async () => {
    const deps = createInMemoryDependencies();
    const created = await createDemoBuilding(deps, {
      displayName: "DEMO 해솔빌라",
    });

    await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "OWNER_DIRECT",
      heatingType: "INDIVIDUAL",
    });
    const corrected = await verifyBuildingContext(deps, {
      buildingId: created.id,
      managementMode: "MANAGEMENT_OFFICE",
      heatingType: "CENTRAL_SHARED",
    });

    expect(
      corrected.context.filter((entry) => entry.key === "heatingType"),
    ).toHaveLength(1);
    expect(routingEligibleContextKeys(corrected)).toEqual([
      "managementMode",
      "heatingType",
    ]);
  });

  it("refuses to verify a building that does not exist", async () => {
    const deps = createInMemoryDependencies();

    await expect(
      verifyBuildingContext(deps, {
        buildingId: "missing",
        managementMode: "OWNER_DIRECT",
        heatingType: "INDIVIDUAL",
      }),
    ).rejects.toThrowError(/building missing/i);
  });
});

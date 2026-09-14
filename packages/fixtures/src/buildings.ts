import type {
  Building,
  BuildingContextKey,
  BuildingContextSchema,
  ContextValue,
} from "@build-manager/domain";

const FIXTURE_UPDATED_AT = "2026-09-14T00:00:00.000Z";

/** Official registry-shaped facts: verified, but never routing eligible. */
function officialContext<Key extends BuildingContextKey>(
  buildingId: string,
  key: Key,
  value: BuildingContextSchema[Key],
): ContextValue<BuildingContextSchema[Key]> {
  return {
    key,
    value,
    sourceType: "FIXTURE_OFFICIAL",
    sourceRef: `demo-fixture:${buildingId}`,
    verified: true,
    routingEligible: false,
    fetchedAt: null,
    updatedAt: FIXTURE_UPDATED_AT,
  };
}

/** Owner-verified facts the routing decision is allowed to depend on. */
function ownerContext<Key extends BuildingContextKey>(
  buildingId: string,
  key: Key,
  value: BuildingContextSchema[Key],
): ContextValue<BuildingContextSchema[Key]> {
  return {
    key,
    value,
    sourceType: "OWNER_VERIFIED",
    sourceRef: `demo-fixture:${buildingId}:owner`,
    verified: true,
    routingEligible: true,
    fetchedAt: null,
    updatedAt: FIXTURE_UPDATED_AT,
  };
}

export const demoBuildingA: Building = {
  id: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  normalizedAddress: null,
  sourceNativeIds: {
    jusoBdMgtSn: null,
    buildingHubId: null,
    kaptCode: null,
  },
  context: [
    officialContext("demo-building-a", "primaryUse", "다가구주택"),
    officialContext("demo-building-a", "approvalYear", "2011"),
    officialContext("demo-building-a", "groundFloors", 5),
    officialContext("demo-building-a", "householdCount", 14),
    officialContext("demo-building-a", "elevator", false),
    ownerContext("demo-building-a", "managementMode", "OWNER_DIRECT"),
    ownerContext("demo-building-a", "heatingType", "INDIVIDUAL"),
    ownerContext("demo-building-a", "ownerSuppliedBoiler", true),
  ],
};

export const demoBuildingB: Building = {
  id: "demo-building-b",
  displayName: "DEMO 라온하우징",
  demo: true,
  normalizedAddress: null,
  sourceNativeIds: {
    jusoBdMgtSn: null,
    buildingHubId: null,
    kaptCode: null,
  },
  context: [
    officialContext("demo-building-b", "primaryUse", "공동주택"),
    officialContext("demo-building-b", "approvalYear", "2018"),
    officialContext("demo-building-b", "groundFloors", 12),
    ownerContext("demo-building-b", "managementMode", "MANAGEMENT_OFFICE"),
    ownerContext("demo-building-b", "heatingType", "CENTRAL_SHARED"),
  ],
};

export const demoBuildings: Building[] = [demoBuildingA, demoBuildingB];

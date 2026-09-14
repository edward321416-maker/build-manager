export type ContextSourceType =
  | "JUSO"
  | "BUILDING_HUB"
  | "KAPT"
  | "OWNER_VERIFIED"
  | "TENANT_SUBMITTED"
  | "SYSTEM_DERIVED"
  | "FIXTURE_OFFICIAL";

export type ManagementMode =
  | "OWNER_DIRECT"
  | "MANAGEMENT_OFFICE"
  | "THIRD_PARTY_MANAGER"
  | "UNKNOWN";

export type HeatingType =
  | "INDIVIDUAL"
  | "CENTRAL_SHARED"
  | "DISTRICT"
  | "UNKNOWN";

export type ContextValue<T> = {
  key: string;
  value: T | null;
  sourceType: ContextSourceType;
  sourceRef?: string | null;
  verified: boolean;
  routingEligible: boolean;
  fetchedAt?: string | null;
  updatedAt: string;
};

export type Building = {
  id: string;
  displayName: string;
  demo: boolean;
  normalizedAddress?: string | null;
  sourceNativeIds: {
    jusoBdMgtSn?: string | null;
    buildingHubId?: string | null;
    kaptCode?: string | null;
  };
  context: ContextValue<unknown>[];
};

/**
 * Internal context the server may hold about a building. Only a subset is ever
 * allowed to influence routing; see {@link routingEligibleContextKeys}.
 */
export type BuildingContextSchema = {
  primaryUse: string;
  approvalYear: string;
  groundFloors: number;
  householdCount: number;
  elevator: boolean;
  managementMode: ManagementMode;
  heatingType: HeatingType;
  ownerSuppliedBoiler: boolean;
};

export type BuildingContextKey = keyof BuildingContextSchema;

export function getContextValue<T>(
  context: readonly ContextValue<unknown>[],
  key: string,
): ContextValue<T> | undefined {
  return context.find((entry) => entry.key === key) as
    | ContextValue<T>
    | undefined;
}

export function getBuildingContext<Key extends BuildingContextKey>(
  building: Building,
  key: Key,
): ContextValue<BuildingContextSchema[Key]> | undefined {
  return getContextValue<BuildingContextSchema[Key]>(building.context, key);
}

/**
 * Context keys a routing decision may rely on: present, verified, and
 * explicitly marked routing eligible. Official registry facts stay
 * informational even though they are verified.
 */
export function routingEligibleContextKeys(building: Building): string[] {
  return building.context
    .filter(
      (entry) =>
        entry.routingEligible && entry.verified && entry.value !== null,
    )
    .map((entry) => entry.key);
}

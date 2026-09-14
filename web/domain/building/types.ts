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

export type Unit = {
  id: string;
  buildingId: string;
  unitLabel: string;
  tenantToken: string;
  context: ContextValue<unknown>[];
};

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
  return context.find((entry) => entry.key === key) as ContextValue<T> | undefined;
}

export function getBuildingContext<Key extends BuildingContextKey>(
  building: Building,
  key: Key,
): ContextValue<BuildingContextSchema[Key]> | undefined {
  return getContextValue<BuildingContextSchema[Key]>(building.context, key);
}

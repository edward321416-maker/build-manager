import type {
  IdentitySessionPort,
  Page,
  PageQuery,
  PropertyView,
  SessionDigest,
} from "../b1/ports";

export type PropertyCreateInput = Readonly<{ addressReference: string }>;
export type UnitCreateInput = Readonly<{ label: string }>;
export type UnitView = Readonly<{
  id: string;
  orgId: string;
  propertyId: string;
  label: string;
}>;

export interface BuildingRegistrationPort {
  createProperty(digest: SessionDigest, orgId: string, input: PropertyCreateInput): Promise<PropertyView>;
  createUnit(digest: SessionDigest, orgId: string, propertyId: string, input: UnitCreateInput): Promise<UnitView>;
  canCreateProperty(digest: SessionDigest, orgId: string): Promise<boolean>;
  canCreateUnit(digest: SessionDigest, orgId: string, propertyId: string): Promise<boolean>;
}

export interface UnitReadPort {
  listUnits(digest: SessionDigest, orgId: string, propertyId: string, page: PageQuery): Promise<Page<UnitView>>;
  getUnit(digest: SessionDigest, orgId: string, propertyId: string, unitId: string): Promise<UnitView>;
}

export type B3Dependencies = Readonly<{
  sessions: Omit<IdentitySessionPort, "begin">;
  registration: BuildingRegistrationPort;
  units: UnitReadPort;
}>;

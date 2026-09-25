import type { PageQuery } from "../b1/ports";
import { B3Error } from "./errors";
import type { B3Dependencies, PropertyCreateInput, UnitCreateInput } from "./ports";
import {
  validateB3Digest,
  validateB3Page,
  validateB3Text,
  validateB3Uuid,
} from "./validation";

async function requireActor(dependencies: B3Dependencies, digest: string): Promise<string> {
  const validDigest = validateB3Digest(digest);
  const actor = await dependencies.sessions.currentActor(validDigest);
  if (!actor) throw new B3Error("UNAUTHENTICATED");
  return validDigest;
}

export async function createOrganizationProperty(
  dependencies: B3Dependencies,
  digest: string,
  orgId: string,
  input: PropertyCreateInput,
) {
  const validDigest = await requireActor(dependencies, digest);
  const validOrgId = validateB3Uuid(orgId);
  const validInput = { addressReference: validateB3Text(input.addressReference, 512) };
  return dependencies.registration.createProperty(validDigest, validOrgId, validInput);
}

export async function createPropertyUnit(
  dependencies: B3Dependencies,
  digest: string,
  orgId: string,
  propertyId: string,
  input: UnitCreateInput,
) {
  const validDigest = await requireActor(dependencies, digest);
  const validOrgId = validateB3Uuid(orgId);
  const validPropertyId = validateB3Uuid(propertyId);
  const validInput = { label: validateB3Text(input.label, 80) };
  return dependencies.registration.createUnit(validDigest, validOrgId, validPropertyId, validInput);
}

export async function canCreateOrganizationProperty(
  dependencies: B3Dependencies,
  digest: string,
  orgId: string,
) {
  const validDigest = await requireActor(dependencies, digest);
  return dependencies.registration.canCreateProperty(validDigest, validateB3Uuid(orgId));
}

export async function canCreatePropertyUnit(
  dependencies: B3Dependencies,
  digest: string,
  orgId: string,
  propertyId: string,
) {
  const validDigest = await requireActor(dependencies, digest);
  return dependencies.registration.canCreateUnit(
    validDigest,
    validateB3Uuid(orgId),
    validateB3Uuid(propertyId),
  );
}

export async function listPropertyUnits(
  dependencies: B3Dependencies,
  digest: string,
  orgId: string,
  propertyId: string,
  page: PageQuery,
) {
  const validDigest = await requireActor(dependencies, digest);
  validateB3Uuid(orgId);
  validateB3Uuid(propertyId);
  validateB3Page(page);
  return dependencies.units.listUnits(validDigest, orgId, propertyId, page);
}

export async function getPropertyUnit(
  dependencies: B3Dependencies,
  digest: string,
  orgId: string,
  propertyId: string,
  unitId: string,
) {
  const validDigest = await requireActor(dependencies, digest);
  return dependencies.units.getUnit(
    validDigest,
    validateB3Uuid(orgId),
    validateB3Uuid(propertyId),
    validateB3Uuid(unitId),
  );
}

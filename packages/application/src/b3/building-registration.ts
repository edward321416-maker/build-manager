import type { PageQuery } from "../b1/ports";
import type { B3Dependencies, PropertyCreateInput, UnitCreateInput } from "./ports";

async function requireActor(dependencies: B3Dependencies, digest: string) {
  const actor = await dependencies.sessions.currentActor(digest);
  if (!actor) throw new Error("UNAUTHENTICATED");
}

export async function createOrganizationProperty(dependencies:B3Dependencies,digest:string,orgId:string,input:PropertyCreateInput){
  await requireActor(dependencies,digest);
  return dependencies.registration.createProperty(digest,orgId,input);
}
export async function createPropertyUnit(dependencies:B3Dependencies,digest:string,orgId:string,propertyId:string,input:UnitCreateInput){
  await requireActor(dependencies,digest);
  return dependencies.registration.createUnit(digest,orgId,propertyId,input);
}
export async function canCreateOrganizationProperty(dependencies:B3Dependencies,digest:string,orgId:string){
  await requireActor(dependencies,digest);
  return dependencies.registration.canCreateProperty(digest,orgId);
}
export async function canCreatePropertyUnit(dependencies:B3Dependencies,digest:string,orgId:string,propertyId:string){
  await requireActor(dependencies,digest);
  return dependencies.registration.canCreateUnit(digest,orgId,propertyId);
}
export async function listPropertyUnits(dependencies:B3Dependencies,digest:string,orgId:string,propertyId:string,page:PageQuery){
  await requireActor(dependencies,digest);
  return dependencies.units.listUnits(digest,orgId,propertyId,page);
}
export async function getPropertyUnit(dependencies:B3Dependencies,digest:string,orgId:string,propertyId:string,unitId:string){
  await requireActor(dependencies,digest);
  return dependencies.units.getUnit(digest,orgId,propertyId,unitId);
}

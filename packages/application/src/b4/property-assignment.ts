import { B4Error } from "./errors";
import type { B4Dependencies, EnsurePropertyAssignmentResult, PropertyAssignmentState } from "./ports";
import { validateB4Digest, validateB4Uuid } from "./validation";

async function authorizeInput(dependencies: B4Dependencies, digest: string, orgId: string, propertyId: string, membershipId: string): Promise<void> {
  validateB4Digest(digest);
  validateB4Uuid(orgId);
  validateB4Uuid(propertyId);
  validateB4Uuid(membershipId);
  if (!await dependencies.sessions.currentActor(digest)) throw new B4Error("UNAUTHENTICATED");
}

export async function getPropertyStaffAssignment(dependencies: B4Dependencies, digest: string, orgId: string, propertyId: string, membershipId: string): Promise<PropertyAssignmentState> {
  await authorizeInput(dependencies, digest, orgId, propertyId, membershipId);
  return dependencies.assignments.getCurrent(digest, orgId, propertyId, membershipId);
}

export async function ensurePropertyStaffAssignment(dependencies: B4Dependencies, digest: string, orgId: string, propertyId: string, membershipId: string): Promise<EnsurePropertyAssignmentResult> {
  await authorizeInput(dependencies, digest, orgId, propertyId, membershipId);
  return dependencies.assignments.ensureCurrent(digest, orgId, propertyId, membershipId);
}

export async function endPropertyStaffAssignment(dependencies: B4Dependencies, digest: string, orgId: string, propertyId: string, membershipId: string): Promise<void> {
  await authorizeInput(dependencies, digest, orgId, propertyId, membershipId);
  return dependencies.assignments.endCurrent(digest, orgId, propertyId, membershipId);
}

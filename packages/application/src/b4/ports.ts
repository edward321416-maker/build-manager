import type { IdentitySessionPort } from "../b1/ports";

export type PropertyAssignmentState = Readonly<{ assigned: true }>;
export type EnsurePropertyAssignmentResult = Readonly<{ assigned: true; created: boolean }>;

export interface PropertyAssignmentMutationPort {
  getCurrent(digest: string, orgId: string, propertyId: string, membershipId: string): Promise<PropertyAssignmentState>;
  ensureCurrent(digest: string, orgId: string, propertyId: string, membershipId: string): Promise<EnsurePropertyAssignmentResult>;
  endCurrent(digest: string, orgId: string, propertyId: string, membershipId: string): Promise<void>;
}

export type B4Dependencies = Readonly<{
  sessions: Omit<IdentitySessionPort, "begin">;
  assignments: PropertyAssignmentMutationPort;
}>;

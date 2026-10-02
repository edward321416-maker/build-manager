import type { IdentitySessionPort } from "../b1/ports";
export interface OrganizationMembershipTerminationPort {
  endCurrent(digest: string, orgId: string, membershipId: string): Promise<void>;
}
export type B5Dependencies = Readonly<{
  sessions: Omit<IdentitySessionPort, "begin">;
  memberships: OrganizationMembershipTerminationPort;
}>;

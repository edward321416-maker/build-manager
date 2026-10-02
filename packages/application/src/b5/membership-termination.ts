import type { B5Dependencies } from "./ports";
import { B5Error } from "./errors";
import { validateB5Input } from "./validation";
export async function endOrganizationMembership(dependencies: B5Dependencies, digest: string, orgId: string, membershipId: string): Promise<void> {
  validateB5Input(digest, orgId, membershipId);
  try {
    if (!await dependencies.sessions.currentActor(digest)) throw new B5Error("UNAUTHENTICATED");
    await dependencies.memberships.endCurrent(digest, orgId, membershipId);
  } catch (error) {
    if (error instanceof B5Error) throw error;
    throw new B5Error("DEPENDENCY_UNAVAILABLE");
  }
}

import { B5Error } from "./errors";
export function validateB5Input(digest: string, orgId: string, membershipId: string): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)
    || typeof orgId !== "string" || !uuid.test(orgId)
    || typeof membershipId !== "string" || !uuid.test(membershipId)) throw new B5Error("INVALID_INPUT");
}

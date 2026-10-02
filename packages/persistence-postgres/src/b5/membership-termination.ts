import { B1Error, B5Error, type OrganizationMembershipTerminationPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withB5OrgTransaction } from "./transaction";

export function createOrganizationMembershipTerminationPort(database: PostgresDatabase): OrganizationMembershipTerminationPort {
  return {
    async endCurrent(digest, orgId, membershipId) {
      try {
        await withB5OrgTransaction(database, digest, orgId, async client => {
          const result = await client.query("SELECT authn.b5_end_organization_membership($1::bytea,$2::uuid,$3::uuid) AS state",
            [Buffer.from(digest, "hex"), orgId, membershipId]);
          switch (result.rows[0]?.state) {
            case "ENDED": return;
            case "NOT_FOUND": throw new B5Error("NOT_FOUND");
            case "FORBIDDEN": throw new B5Error("FORBIDDEN");
            case "LAST_ADMIN": throw new B5Error("CONFLICT");
            default: throw new B5Error("DEPENDENCY_UNAVAILABLE");
          }
        });
      } catch (error) {
        if (error instanceof B5Error) throw error;
        if (error instanceof B1Error && (error.code === "UNAUTHENTICATED" || error.code === "NOT_FOUND")) throw new B5Error(error.code);
        throw new B5Error("DEPENDENCY_UNAVAILABLE");
      }
    },
  };
}

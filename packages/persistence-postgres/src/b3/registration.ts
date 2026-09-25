import { B3Error, type BuildingRegistrationPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withB1OrgTransaction } from "../b1/org-transaction";

export function createBuildingRegistrationPort(database: PostgresDatabase): BuildingRegistrationPort {
  const unavailable = <T>(digest: string, orgId: string): Promise<T> =>
    withB1OrgTransaction(database, digest, orgId, async () => {
      throw new B3Error("DEPENDENCY_UNAVAILABLE");
    });
  return {
    createProperty(digest, orgId) { return unavailable(digest, orgId); },
    createUnit(digest, orgId) { return unavailable(digest, orgId); },
    canCreateProperty(digest, orgId) { return unavailable(digest, orgId); },
    canCreateUnit(digest, orgId) { return unavailable(digest, orgId); },
  };
}

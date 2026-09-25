import { B3Error, type UnitReadPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withB1OrgTransaction } from "../b1/org-transaction";

export function createUnitReadPort(database: PostgresDatabase): UnitReadPort {
  const unavailable = <T>(digest: string, orgId: string): Promise<T> =>
    withB1OrgTransaction(database, digest, orgId, async () => {
      throw new B3Error("DEPENDENCY_UNAVAILABLE");
    });
  return {
    listUnits(digest, orgId) { return unavailable(digest, orgId); },
    getUnit(digest, orgId) { return unavailable(digest, orgId); },
  };
}

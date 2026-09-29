import { B1Error, B4Error, type PropertyAssignmentMutationPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withB1OrgTransaction } from "../b1/org-transaction";

function failure(error: unknown): B4Error {
  if (error instanceof B4Error) return error;
  if (error instanceof B1Error && (error.code === "UNAUTHENTICATED" || error.code === "NOT_FOUND")) {
    return new B4Error(error.code);
  }
  if (error && typeof error === "object" && "code" in error && error.code === "28000") {
    return new B4Error("UNAUTHENTICATED");
  }
  return new B4Error("DEPENDENCY_UNAVAILABLE");
}

export function createPropertyAssignmentMutationPort(database: PostgresDatabase): PropertyAssignmentMutationPort {
  async function command<T>(sql: string, digest: string, orgId: string, propertyId: string, membershipId: string, decode: (result: unknown) => T): Promise<T> {
    try {
      return await withB1OrgTransaction(database,digest,orgId,async client => {
        const result = await client.query(sql,[Buffer.from(digest,"hex"),orgId,propertyId,membershipId]);
        const state: unknown = result.rows[0]?.state;
        if (state === "NOT_FOUND" || state === "FORBIDDEN") throw new B4Error(state);
        return decode(state);
      });
    } catch (error) { throw failure(error); }
  }
  return {
    getCurrent(digest,orgId,propertyId,membershipId) {
      return command("SELECT authn.b4_get_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",digest,orgId,propertyId,membershipId,state => {
        if (state === "ABSENT") throw new B4Error("NOT_FOUND");
        if (state !== "ACTIVE") throw new B4Error("DEPENDENCY_UNAVAILABLE");
        return { assigned: true };
      });
    },
    ensureCurrent(digest,orgId,propertyId,membershipId) {
      return command("SELECT authn.b4_ensure_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",digest,orgId,propertyId,membershipId,state => {
        if (state !== "CREATED" && state !== "EXISTS") throw new B4Error("DEPENDENCY_UNAVAILABLE");
        return { assigned: true, created: state === "CREATED" };
      });
    },
    endCurrent(digest,orgId,propertyId,membershipId) {
      return command("SELECT authn.b4_end_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",digest,orgId,propertyId,membershipId,state => {
        if (state !== "ENDED" && state !== "ABSENT") throw new B4Error("DEPENDENCY_UNAVAILABLE");
      });
    },
  };
}

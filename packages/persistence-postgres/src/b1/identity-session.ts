import { B1Error, type IdentitySessionPort } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withTransaction } from "../transaction";
export function createIdentityBootstrapPort(database: PostgresDatabase): Pick<IdentitySessionPort,"begin"> {
  return { async begin(input) {
    try {
      return await withTransaction(database, async client => {
        const result = await client.query<{ id: string }>("SELECT authn.begin_session($1,$2,$3,$4) AS id", [input.identity.issuer,input.identity.subject,Buffer.from(input.digest,"hex"),input.expiresAt]);
        if (!result.rows[0]?.id) throw new B1Error("AUTHENTICATION_REJECTED");
        return { userId: result.rows[0].id };
      });
    } catch(error) {
      if(error instanceof B1Error) throw error;
      if(typeof error === "object" && error !== null && "code" in error && error.code === "28000" && "message" in error && error.message === "AUTHENTICATION_REJECTED") throw new B1Error("AUTHENTICATION_REJECTED");
      throw new B1Error("DEPENDENCY_UNAVAILABLE");
    }
  } };
}

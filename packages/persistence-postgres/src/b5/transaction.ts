import { getInternalPool, type PostgresDatabase } from "../database";
import type { SqlClient } from "../transaction";
import { B1Error, B5Error } from "@build-manager/application";

function sanitized(error: unknown): B5Error {
  if (error instanceof B5Error) return error;
  if (error instanceof B1Error && (error.code === "UNAUTHENTICATED" || error.code === "NOT_FOUND")) return new B5Error(error.code);
  return new B5Error("DEPENDENCY_UNAVAILABLE");
}
function connectionLost(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return typeof error.code === "string" && (error.code === "25P04" || error.code.startsWith("08") || /^(57P01|57P02|57P03)$/.test(error.code));
}

export async function withB5OrgTransaction<T>(database: PostgresDatabase, digest: string, orgId: string, operation: (client: SqlClient) => Promise<T>): Promise<T> {
  const client = await getInternalPool(database).connect().catch(() => { throw new B5Error("DEPENDENCY_UNAVAILABLE"); });
  let terminated = false, destroy = false, begun = false, committing = false;
  let failure: B5Error | undefined;
  let value: T | undefined;
  // Keep this persistent listener through synchronous pool release handoff.
  const onError = () => { terminated = true; };
  client.on("error", onError);
  try {
    await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
    begun = true;
    await client.query("SET LOCAL lock_timeout = '2000ms'");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    await client.query("SET LOCAL transaction_timeout = '7000ms'");
    const proof = Buffer.from(digest, "hex");
    if (!(await client.query("SELECT authn.current_actor($1) AS id", [proof])).rows[0]?.id) throw new B5Error("UNAUTHENTICATED");
    if (!(await client.query("SELECT authn.authorize_org($1,$2) AS allowed", [proof, orgId])).rows[0]?.allowed) throw new B5Error("NOT_FOUND");
    await client.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)", [orgId, digest]);
    value = await operation(client);
    if (terminated) throw new B5Error("DEPENDENCY_UNAVAILABLE");
    committing = true;
    await client.query("COMMIT");
  } catch (error) {
    terminated ||= connectionLost(error);
    failure = terminated ? new B5Error("DEPENDENCY_UNAVAILABLE") : sanitized(error);
    destroy = terminated || !begun || committing;
    if (begun && !committing && !terminated) {
      try { await client.query("ROLLBACK"); }
      catch { destroy = true; failure = new B5Error("DEPENDENCY_UNAVAILABLE"); }
    }
  } finally {
    try { client.release(destroy || terminated); }
    catch { failure = new B5Error("DEPENDENCY_UNAVAILABLE"); }
    finally { client.removeListener("error", onError); }
  }
  if (terminated) throw new B5Error("DEPENDENCY_UNAVAILABLE");
  if (failure) throw failure;
  return value as T;
}

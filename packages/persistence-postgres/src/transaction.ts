import type { PoolClient } from "pg";
import { getInternalPool, type PostgresDatabase } from "./database";
import { assertCanonicalUuid } from "./context";

export type SqlClient = Pick<PoolClient, "query">;

export async function withTransaction<T>(
  database: PostgresDatabase,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await getInternalPool(database).connect();
  const failures: unknown[] = [];
  let began = false;
  let committing = false;
  let destroy = false;
  let result!: T;

  try {
    await client.query("BEGIN");
    began = true;
    result = await operation(client);
    committing = true;
    const completion = await client.query("COMMIT");
    if (completion.command !== "COMMIT") {
      throw new Error("PostgreSQL transaction did not commit");
    }
  } catch (primary) {
    failures.push(primary);
    // Failed BEGIN or COMMIT leaves connection/transaction state uncertain.
    destroy = !began || committing;
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        destroy = true;
        failures.push(rollbackError);
      }
    }
  } finally {
    try {
      client.release(destroy);
    } catch (releaseError) {
      failures.push(releaseError);
    }
  }

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    // Internal diagnostics only: preserve the primary cause, including frozen
    // errors and primitive throws, without exposing cleanup details over HTTP.
    throw new AggregateError(failures, "Transaction failed with cleanup errors", {
      cause: failures[0],
    });
  }
  return result;
}

export async function withOrgTransaction<T>(
  database: PostgresDatabase,
  orgId: string,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T> {
  assertCanonicalUuid(orgId);
  return withTransaction(database, async (client) => {
    await client.query("SELECT pg_catalog.set_config('app.org_id', $1, true)", [orgId]);
    return operation(client);
  });
}

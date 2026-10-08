import { createHash } from "node:crypto";
import { VendorHandoffError, type VendorHandoffErrorCode } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withTransaction, type SqlClient } from "../transaction";

export function vendorDigest(value: string): Buffer {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new VendorHandoffError("UNAUTHENTICATED");
  return Buffer.from(value, "hex");
}

export function vendorFingerprint(value: unknown): Buffer {
  return createHash("sha256").update(JSON.stringify(value)).digest();
}

function mappedCode(error: unknown): VendorHandoffErrorCode | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  switch (error.code) {
    case "28000": return "UNAUTHENTICATED";
    case "42501": return "FORBIDDEN";
    case "P0002": return "NOT_FOUND";
    case "22023":
    case "22P02": return "INVALID_INPUT";
    case "P0001":
    case "23505": return "STATE_CONFLICT";
    default: return null;
  }
}

export async function vendorTransaction<T>(
  database: PostgresDatabase,
  operation: (client: SqlClient) => Promise<T>,
): Promise<T> {
  try {
    return await withTransaction(database, async (client) => {
      await client.query("SET LOCAL lock_timeout='2000ms'");
      await client.query("SET LOCAL statement_timeout='5000ms'");
      return operation(client);
    });
  } catch (error) {
    if (error instanceof VendorHandoffError) throw error;
    const code = mappedCode(error);
    if (code) throw new VendorHandoffError(code);
    throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
  }
}

export async function vendorJson<T>(
  database: PostgresDatabase,
  sql: string,
  values: unknown[],
): Promise<T> {
  return vendorTransaction(database, async (client) => {
    const result = await client.query<{ value: T }>(sql, values);
    const value = result.rows[0]?.value;
    if (value === undefined || value === null) throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    return value;
  });
}

/**
 * Request-scoped B1 digest call (Manager and Tenant). The selected organization is bound and the digest
 * authenticated inside the same transaction as the actual Vendor command; a previously committed
 * session_scope binding is never relied on (Task3 reviewed invariant).
 */
export async function b1DigestCall<T>(
  database: PostgresDatabase,
  digest: string,
  sql: string,
  values: unknown[],
  organization?: string,
): Promise<T> {
  const hash = vendorDigest(digest);
  return vendorTransaction(database, async (client) => {
    if (organization !== undefined) await client.query("SELECT core_flow.bind_organization($1::bytea,$2::uuid)", [hash, organization]);
    await client.query("SELECT core_flow.session($1::bytea)", [hash]);
    const result = await client.query<{ value: T }>(sql, [hash, ...values]);
    const value = result.rows[0]?.value;
    if (value === undefined || value === null) throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
    return value;
  });
}

export function notYetImplemented(): never {
  throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
}

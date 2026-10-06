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

export function notYetImplemented(): never {
  throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
}

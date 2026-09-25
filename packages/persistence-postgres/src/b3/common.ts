import { B1Error, B3Error } from "@build-manager/application";
import type { SqlClient } from "../transaction";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digest = /^[a-f0-9]{64}$/;

export function assertB3Digest(value: string): void {
  if (!digest.test(value)) throw new B3Error("UNAUTHENTICATED");
}

export function assertB3Uuid(value: string): void {
  if (!uuid.test(value)) throw new B3Error("INVALID_INPUT");
}

export function proof(value: string): Buffer {
  assertB3Digest(value);
  return Buffer.from(value, "hex");
}

export async function canReadParent(
  client: SqlClient,
  digestValue: string,
  orgId: string,
  propertyId: string,
): Promise<boolean> {
  return Boolean((await client.query(
    "SELECT authn.can_read_property($1::bytea,$2::uuid,$3::uuid) AS allowed",
    [proof(digestValue), orgId, propertyId],
  )).rows[0]?.allowed);
}

export async function canAdministerOrg(
  client: SqlClient,
  digestValue: string,
  orgId: string,
): Promise<boolean> {
  return Boolean((await client.query(
    "SELECT authn.can_administer_org($1::bytea,$2::uuid) AS allowed",
    [proof(digestValue), orgId],
  )).rows[0]?.allowed);
}

export async function allocateUuid(client: SqlClient): Promise<string> {
  const id = (await client.query<{ id: string }>("SELECT uuidv7() AS id")).rows[0]?.id;
  if (!id || !uuid.test(id)) throw new B3Error("DEPENDENCY_UNAVAILABLE");
  return id;
}

export function postgresFailure(error: unknown): { code?: string; constraint?: string } {
  if (!error || typeof error !== "object") return {};
  const value = error as { code?: unknown; constraint?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    constraint: typeof value.constraint === "string" ? value.constraint : undefined,
  };
}

export function toB3Error(error: unknown): B3Error {
  if (error instanceof B3Error) return error;
  if (error instanceof B1Error) {
    switch (error.code) {
      case "UNAUTHENTICATED":
      case "NOT_FOUND":
      case "INVALID_INPUT":
      case "FORBIDDEN":
      case "DEPENDENCY_UNAVAILABLE":
        return new B3Error(error.code);
      default:
        return new B3Error("DEPENDENCY_UNAVAILABLE");
    }
  }
  if (postgresFailure(error).code === "28000") return new B3Error("UNAUTHENTICATED");
  return new B3Error("DEPENDENCY_UNAVAILABLE");
}

import { B4Error } from "./errors";

export function validateB4Digest(value: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new B4Error("UNAUTHENTICATED");
  return value;
}

export function validateB4Uuid(value: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new B4Error("INVALID_INPUT");
  }
  return value;
}

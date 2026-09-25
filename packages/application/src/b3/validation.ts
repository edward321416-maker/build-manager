import type { PageQuery } from "../b1/ports";
import { B3Error } from "./errors";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function validateB3Digest(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new B3Error("UNAUTHENTICATED");
  return value;
}

export function validateB3Uuid(value: string): string {
  if (!uuid.test(value)) throw new B3Error("INVALID_INPUT");
  return value;
}

export function validateB3Text(value: string, maxCodePoints: number): string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    Array.from(value).length < 1 ||
    Array.from(value).length > maxCodePoints ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(value) ||
    hasUnpairedSurrogate(value)
  ) {
    throw new B3Error("INVALID_INPUT");
  }
  return value;
}

export function validateB3Page(page: PageQuery): PageQuery {
  if (
    !Number.isInteger(page.limit) ||
    page.limit < 1 ||
    page.limit > 50 ||
    (page.after !== undefined && !uuid.test(page.after))
  ) {
    throw new B3Error("INVALID_INPUT");
  }
  return page;
}

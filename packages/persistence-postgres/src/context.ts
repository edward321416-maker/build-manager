const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function assertCanonicalUuid(value: string): void {
  if (typeof value !== "string" || !CANONICAL_UUID.test(value)) {
    throw new TypeError("Expected canonical lowercase UUID");
  }
}

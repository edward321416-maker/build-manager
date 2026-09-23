export type B1ErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID_INPUT" | "DEPENDENCY_UNAVAILABLE" | "AUTHENTICATION_REJECTED" | "FORBIDDEN";
/** Sanitized application categories; never attach raw SQL/provider details. */
export class B1Error extends Error {
  constructor(public readonly code: B1ErrorCode) { super(code); this.name = "B1Error"; }
}

export type B4ErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT"
  | "PAYLOAD_TOO_LARGE" | "DEPENDENCY_UNAVAILABLE" | "METHOD_NOT_ALLOWED";

export class B4Error extends Error {
  constructor(readonly code: B4ErrorCode) {
    super(code);
    this.name = "B4Error";
  }
}

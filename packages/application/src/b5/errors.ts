export type B5ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "CONFLICT"
  | "PAYLOAD_TOO_LARGE" | "DEPENDENCY_UNAVAILABLE" | "METHOD_NOT_ALLOWED";
export class B5Error extends Error {
  readonly code: B5ErrorCode;
  constructor(code: B5ErrorCode) {
    super(code);
    this.name = "B5Error";
    this.code = code;
  }
}

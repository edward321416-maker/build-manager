export type B3ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "DEPENDENCY_UNAVAILABLE"
  | "METHOD_NOT_ALLOWED";

export class B3Error extends Error {
  constructor(public readonly code: B3ErrorCode) {
    super(code);
    this.name = "B3Error";
  }
}

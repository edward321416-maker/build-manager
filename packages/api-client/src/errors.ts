/** Codes this client raises itself. A server code may also appear here. */
export type ApiClientErrorCode =
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE";

export type ApiClientErrorDetails = {
  status?: number;
  requestId?: string;
};

/**
 * The only error this client throws, and deliberately a narrow one.
 *
 * It never retains a raw response body, a raw ZodError, the value that failed
 * validation, a request payload, or the underlying fetch error. Those can carry
 * tenant text, evidence references, or internal infrastructure detail, and this
 * object is routinely logged and rendered by callers.
 */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;

  constructor(
    code: ApiClientErrorCode | string,
    message: string,
    details: ApiClientErrorDetails = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    if (details.status !== undefined) {
      this.status = details.status;
    }
    if (details.requestId !== undefined) {
      this.requestId = details.requestId;
    }
  }
}

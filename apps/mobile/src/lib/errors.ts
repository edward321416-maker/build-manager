import { MOBILE_CONFIG_MESSAGE, isMobileConfigError } from "./api-config";

export const GENERIC_ERROR_MESSAGE =
  "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * Turns a failure into something safe to put on screen.
 *
 * Only two kinds of message are ever shown verbatim: the fixed configuration
 * message, and the api client's own message — which is already sanitized and
 * deliberately carries no body, host, or payload. Anything else is replaced,
 * because an arbitrary Error can name a host, a file path, or a query.
 *
 * Matched by `name` rather than `instanceof` so an error keeps its message when
 * it crosses a module instance boundary.
 */
export function describeMobileError(error: unknown): string {
  if (isMobileConfigError(error)) {
    return MOBILE_CONFIG_MESSAGE;
  }
  if (error instanceof Error && error.name === "ApiClientError") {
    return error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

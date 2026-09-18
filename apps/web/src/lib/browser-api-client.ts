import { createApiClient, type ApiClient } from "@build-manager/api-client";

/**
 * Browser client for the same-origin demo API.
 *
 * An empty base URL keeps every request same-origin, so the browser bundle
 * carries no host and no server configuration. Nothing here reads an
 * environment variable — the database location in particular is server-only
 * and must never reach the client.
 */
export function createBrowserApiClient(): ApiClient {
  return createApiClient({ baseUrl: "" });
}

/** Sanitized message for display; the client never surfaces server internals. */
export function describeApiError(error: unknown): string {
  if (error instanceof Error && error.name === "ApiClientError") {
    return error.message;
  }
  return "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

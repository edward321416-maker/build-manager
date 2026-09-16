import {
  createApiClient,
  type ApiClient,
  type FetchLike,
} from "@build-manager/api-client";
import { resolveMobileApiBaseUrl } from "./api-config";

/**
 * Builds the shared client for an already-known base URL.
 *
 * Kept separate from the environment read so a test can exercise the real
 * composition — validation plus client — without depending on how the bundler
 * supplies environment values.
 */
export function createApiClientForBaseUrl(
  raw: string | undefined,
  fetchImpl?: FetchLike,
): ApiClient {
  return createApiClient({
    baseUrl: resolveMobileApiBaseUrl(raw),
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });
}

/**
 * The one place the app reads its server address.
 *
 * `process.env.EXPO_PUBLIC_API_URL` is written out in full on purpose: Expo
 * replaces that exact expression at bundle time, so a computed key or a
 * destructured read would resolve to nothing in a release build.
 *
 * Throws MobileConfigError when unset or unusable; callers render the
 * configuration screen rather than letting it escape.
 */
export function createMobileApiClient(): ApiClient {
  return createApiClientForBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

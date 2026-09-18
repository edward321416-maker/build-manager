import type { ApiClient } from "@build-manager/api-client";
import { useMemo } from "react";
import { isMobileConfigError } from "./api-config";
import { createMobileApiClient } from "./mobile-api-client";

/**
 * Resolves the runtime client for a screen, or `null` when the demo server
 * address is missing or unusable.
 *
 * Deliberately not a module-scope singleton: building the client at import time
 * would throw while the route module is still evaluating, which crashes the app
 * before any screen can explain what to configure.
 */
export function useMobileApiClient(): ApiClient | null {
  return useMemo(() => {
    try {
      return createMobileApiClient();
    } catch (error) {
      if (isMobileConfigError(error)) {
        return null;
      }
      throw error;
    }
  }, []);
}

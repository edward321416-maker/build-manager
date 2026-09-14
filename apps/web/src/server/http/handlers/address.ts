import {
  AddressSearchQuerySchema,
  AddressSearchResponseSchema,
} from "@build-manager/api-contracts";
import { jsonResponse, parseRequest, validateResponse } from "../json";
import type { ContainerProvider } from "../request-container";
import { requireSingleQueryValue, respond } from "./respond";

/**
 * Resolves through the offline fixture provider only. There is no live
 * registry lookup and no network call in P0.
 */
export function handleSearchAddress(
  withContainer: ContainerProvider,
  url: URL,
): Promise<Response> {
  return respond(async () => {
    const { query } = parseRequest(AddressSearchQuerySchema, {
      query: requireSingleQueryValue(url, "query"),
    });

    const result = await withContainer((container) =>
      container.useCases.searchAddress({ query }),
    );

    return jsonResponse(
      validateResponse(AddressSearchResponseSchema, { result }),
    );
  });
}

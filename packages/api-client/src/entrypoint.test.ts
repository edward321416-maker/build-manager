import {
  ApiClientError,
  createApiClient,
} from "@build-manager/api-client";
import { describe, expect, it } from "vitest";

describe("package public entrypoint", () => {
  it("resolves the client factory through the package name", async () => {
    expect(typeof createApiClient).toBe("function");

    const client = createApiClient({
      baseUrl: "https://example.test",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async text() {
          return "[]";
        },
      }),
    });

    expect(await client.listDemoBuildings()).toEqual([]);
  });

  it("exposes the sanitized error type through the package name", () => {
    expect(typeof ApiClientError).toBe("function");
    expect(new ApiClientError("NETWORK_ERROR", "요청을 완료하지 못했습니다.")).toBeInstanceOf(
      Error,
    );
  });
});

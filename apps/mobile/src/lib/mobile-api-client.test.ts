import type { FetchLike } from "@build-manager/api-client";
import { MobileConfigError } from "./api-config";
import { createApiClientForBaseUrl } from "./mobile-api-client";

/** Records the URL each request was sent to and answers with a valid body. */
function recordingFetch(body: unknown): { calls: string[]; impl: FetchLike } {
  const calls: string[] = [];

  const impl: FetchLike = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify(body);
      },
      headers: { get: () => null },
    } as Awaited<ReturnType<FetchLike>>;
  };

  return { calls, impl };
}

describe("mobile api client", () => {
  it("sends requests to the configured base url", async () => {
    const fetched = recordingFetch([]);
    const client = createApiClientForBaseUrl(
      "http://demo.test:3000",
      fetched.impl,
    );

    await client.listDemoBuildings();

    expect(fetched.calls).toEqual([
      "http://demo.test:3000/api/v1/demo/buildings",
    ]);
  });

  it("keeps a configured base path in front of every route", async () => {
    const fetched = recordingFetch([]);
    const client = createApiClientForBaseUrl(
      "https://demo.test/gateway",
      fetched.impl,
    );

    await client.listDemoBuildings();

    expect(fetched.calls[0]).toBe(
      "https://demo.test/gateway/api/v1/demo/buildings",
    );
  });

  it("refuses to build a client at all when configuration is missing", () => {
    const fetched = recordingFetch([]);

    expect(() => createApiClientForBaseUrl(undefined, fetched.impl)).toThrow(
      MobileConfigError,
    );
    expect(() => createApiClientForBaseUrl("", fetched.impl)).toThrow(
      MobileConfigError,
    );

    // Nothing was attempted against a guessed host.
    expect(fetched.calls).toEqual([]);
  });
});

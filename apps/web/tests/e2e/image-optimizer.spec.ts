import { expect, test } from "@playwright/test";

/**
 * Every <Image> in the app is `unoptimized`, so the Next.js image optimizer is unused. With
 * `images.unoptimized` the server answers 404 before it reads the query or fetches anything, so the
 * route can no longer make the server fetch internal or remote addresses or run the optimizer.
 */
const PROBES = [
  "/_next/image",
  "/_next/image?url=%2F&w=64&q=75",
  // A reserved domain: even a reopened optimizer that allowed it could never reach a real host.
  "/_next/image?url=https%3A%2F%2Fexample.invalid%2Fa.png&w=64&q=75",
];

test.describe("image optimizer route", () => {
  for (const path of PROBES) {
    test(`is closed: ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
      expect(response.headers()["content-type"] ?? "").not.toMatch(/^image\//);
    });
  }
});

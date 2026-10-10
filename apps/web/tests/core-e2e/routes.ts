import type { Page } from "@playwright/test";

/**
 * Aborts only the first matching request, like `page.route(url, handler, { times: 1 })`, but keeps the
 * route registered so later matching requests fall back to the next route or the network.
 *
 * Do not use `{ times: 1 }` when a test adds another route right after that request: when the expiring
 * route is the page's last route, Playwright 1.63 removes request interception asynchronously, and a
 * `page.route()` registered during that window can be cleared. Its request then reaches the server, which
 * in CI showed up as a real 404 instead of the mocked 401/403 receipt response.
 */
export async function abortOnce(page: Page, url: string): Promise<void> {
  let aborted = false;
  await page.route(url, (route) => {
    if (aborted) return route.fallback();
    aborted = true;
    return route.abort("failed");
  });
}

import type { Page, Route } from "@playwright/test";

/**
 * Handles only the first matching request, like Playwright's `times` route option, but keeps the route
 * registered so later matching requests fall back to the next route or the network.
 *
 * Do not use the `times` option. When the expiring route is the page's last route, Playwright 1.63 turns
 * request interception off asynchronously right after the handler returns. Two CI failures came from that
 * window:
 * - A `page.route()` registered in it can be cleared. Its request then reached the server: a real 404
 *   instead of the mocked 401/403 receipt response.
 * - A request the page sends in it can stay paused with no response. After the aborted reissue in
 *   T12-B06, the page's own reconcile read never returned, so the retry button stayed disabled.
 */
export async function routeOnce(page: Page, url: string, handler: (route: Route) => Promise<void>): Promise<void> {
  let used = false;
  await page.route(url, async (route) => {
    if (used) return route.fallback();
    used = true;
    await handler(route);
  });
}

export async function abortOnce(page: Page, url: string): Promise<void> {
  await routeOnce(page, url, (route) => route.abort("failed"));
}

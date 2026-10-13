import { allowedViews, firstTab, navTabs, rowTab, type NavContext, type NavLocation } from "./nav-config";

/** Reads `/core?tab=&view=` (P5 spec §3). Unknown values, another role's values and row screens outside their tab fall
 * back to the role's first tab or to the tab's first screen, without an error. */
export function parseNavLocation(search: string, ctx: NavContext): NavLocation {
  const params = new URLSearchParams(search), rawTab = params.get("tab"), rawView = params.get("view");
  const tab = navTabs(ctx.role).find(item => item.id === rawTab)?.id ?? firstTab(ctx.role);
  const view = allowedViews(ctx).find(item => item === rawView) ?? null;
  return { tab, view: view && rowTab(ctx.role) === tab ? view : null };
}

/** The address of a menu place; the only query this screen writes. */
export function navHref(location: NavLocation): string {
  return "/core?tab=" + location.tab + (location.view ? "&view=" + location.view : "");
}

export const sameLocation = (a: NavLocation, b: NavLocation) => a.tab === b.tab && a.view === b.view;

"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { parentOf, type NavContext, type NavLocation, type TabId } from "./nav-config";
import { navHref, parseNavLocation, sameLocation } from "./nav-location";

// History entries this screen writes carry `coreNav`; an open request adds `detail` (P5 spec §3). The request itself is
// never in the address: a reload shows the tab, and the request is always read again from the server.
type Entry = { coreNav?: true; detail?: true; samePlace?: true };
const NAV_EVENT = "core-nav";
const entry = (): Entry => { const state: unknown = window.history.state; return state !== null && typeof state === "object" ? state as Entry : {}; };
/** Picks only this screen's own marks out of a (possibly foreign) state object, so a replace never carries forward a
 * mark another layer owns — e.g. Next's own `__NA` router mark, which a replace that kept it would cause Next 16 to
 * treat as already synced and skip updating its router URL (finding: review 2026-10-13). */
const marksOnly = (source: Entry): Entry => { const out: Entry = {}; if (source.coreNav) out.coreNav = true; if (source.detail) out.detail = true; if (source.samePlace) out.samePlace = true; return out; };
const here = () => window.location.pathname + window.location.search;
function write(mode: "push" | "replace", state: Entry, href: string) {
  if (mode === "push") window.history.pushState(state, "", href); else window.history.replaceState(state, "", href);
  window.dispatchEvent(new Event(NAV_EVENT));
}
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify); window.addEventListener(NAV_EVENT, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(NAV_EVENT, notify); };
};

/** Marks the open request with one history entry, so browser back closes it; a manager's request opens in 업무함.
 * `samePlace`: the entry below shows the same screen, so leaving through that screen's own menu item steps back to it
 * instead of leaving two identical entries (final review of PR 139). */
export function showDetailEntry(tab?: TabId) {
  if (entry().detail) return;
  const href = tab ? navHref({ tab, view: null }) : here();
  write("push", href === here() ? { coreNav: true, detail: true, samePlace: true } : { coreNav: true, detail: true }, href);
}
/** Drops the request mark from the current entry when the request closed some other way, without a new entry. */
export function hideDetailEntry() {
  const current = entry();
  if (current.detail) write("replace", current.coreNav ? { coreNav: true } : {}, here());
}
export const detailEntryOnTop = () => Boolean(entry().detail);

const NO_PLACE: NavLocation = { tab: "home", view: null };

/** The menu place lives in the address (`/core?tab=&view=`), so browser back and new-tab links work (spec §3). */
export function useNavLocation(ctx: NavContext | null, onPop: (detail: boolean) => void) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const location = useMemo(() => ctx ? parseNavLocation(search, ctx) : NO_PLACE, [ctx, search]);
  const popped = useRef(onPop);
  useEffect(() => { popped.current = onPop; });
  // An address another role or an old link wrote is corrected in place, without a new history entry.
  useEffect(() => { if (ctx && window.location.pathname === "/core" && here() !== navHref(location)) write("replace", marksOnly(entry()), navHref(location)); }, [ctx, location]);
  useEffect(() => {
    const pop = () => popped.current(Boolean(entry().detail));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  /** A menu link: a new history entry; tapping the current first screen again scrolls it to the top (rules 8.14).
   * With a request entry on top, this REPLACES it instead of pushing: a push would leave a stale duplicate of the
   * target behind the request's own entry, so one browser back after the move would land on that duplicate and show
   * the same screen again before a second back reaches the real previous screen (finding: review 2026-10-13).
   * A request opened over the same place steps back instead. */
  const go = useCallback((next: NavLocation) => {
    const top = entry();
    if (top.detail && top.samePlace && sameLocation(next, location)) {
      // The screen below is this one: step back to it, then show its top (rules 8.14).
      const toTop = () => { window.removeEventListener("popstate", toTop); window.scrollTo({ top: 0 }); };
      window.addEventListener("popstate", toTop); window.history.back(); return;
    }
    if (top.detail) write("replace", { coreNav: true }, navHref(next));
    else if (!sameLocation(next, location)) write("push", { coreNav: true }, navHref(next));
    window.scrollTo({ top: 0 });
  }, [location]);
  /** The top bar's back button on a row screen: history back after an in-page move, else one step up in place. */
  const back = useCallback(() => {
    if (!ctx) return;
    if (entry().coreNav) window.history.back(); else write("replace", {}, navHref(parentOf(ctx, location)));
  }, [ctx, location]);
  return useMemo(() => ({ location, go, back }), [location, go, back]);
}

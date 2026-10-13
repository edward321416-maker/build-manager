"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { parentOf, type NavContext, type NavLocation, type TabId } from "./nav-config";
import { navHref, parseNavLocation, sameLocation } from "./nav-location";

// History entries this screen writes carry `coreNav`; an open request adds `detail` (P5 spec §3). The request itself is
// never in the address: a reload shows the tab, and the request is always read again from the server.
type Entry = { coreNav?: true; detail?: true };
const NAV_EVENT = "core-nav";
const entry = (): Entry => { const state: unknown = window.history.state; return state !== null && typeof state === "object" ? state as Entry : {}; };
const here = () => window.location.pathname + window.location.search;
function write(mode: "push" | "replace", state: Entry, href: string) {
  if (mode === "push") window.history.pushState(state, "", href); else window.history.replaceState(state, "", href);
  window.dispatchEvent(new Event(NAV_EVENT));
}
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify); window.addEventListener(NAV_EVENT, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(NAV_EVENT, notify); };
};

/** Marks the open request with one history entry, so browser back closes it; a manager's request opens in 업무함. */
export function showDetailEntry(tab?: TabId) {
  if (entry().detail) return;
  write("push", { coreNav: true, detail: true }, tab ? navHref({ tab, view: null }) : here());
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
  useEffect(() => { if (ctx && window.location.pathname === "/core" && here() !== navHref(location)) write("replace", entry(), navHref(location)); }, [ctx, location]);
  useEffect(() => {
    const pop = () => popped.current(Boolean(entry().detail));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  /** A menu link: a new history entry; tapping the current first screen again scrolls it to the top (rules 8.14). */
  const go = useCallback((next: NavLocation) => {
    if (!sameLocation(next, location) || entry().detail) write("push", { coreNav: true }, navHref(next));
    window.scrollTo({ top: 0 });
  }, [location]);
  /** The top bar's back button on a row screen: history back after an in-page move, else one step up in place. */
  const back = useCallback(() => {
    if (!ctx) return;
    if (entry().coreNav) window.history.back(); else write("replace", {}, navHref(parentOf(ctx, location)));
  }, [ctx, location]);
  return useMemo(() => ({ location, go, back }), [location, go, back]);
}

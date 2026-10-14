// @vitest-environment jsdom
import { act, useEffect, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NavContext } from "./nav-config";
import { detailEntryOnTop, hideDetailEntry, showDetailEntry, useNavLocation } from "./use-nav-location";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Api = ReturnType<typeof useNavLocation>;
const tenant: NavContext = { role: "TENANT", b1: true }, admin: NavContext = { role: "ORG_ADMIN", b1: true };
let root: Root | undefined, host: HTMLDivElement | undefined;
function Probe({ ctx, onPop, api: apiRef }: { ctx: NavContext; onPop(detail: boolean): void; api: RefObject<Api | null> }) {
  const nav = useNavLocation(ctx, onPop);
  useEffect(() => { apiRef.current = nav; });
  return <p data-tab={nav.location.tab} data-view={nav.location.view ?? ""} />;
}
async function mount(ctx: NavContext, onPop = vi.fn()) {
  const api: RefObject<Api | null> = { current: null };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<Probe ctx={ctx} onPop={onPop} api={api} />));
  return { api, onPop, shown: () => [host!.querySelector("p")!.dataset.tab, host!.querySelector("p")!.dataset.view] };
}
// A push drops any forward entries a previous test's real `history.back()` left dangling past the pointer (fix round
// 1, review 2026-10-13): without this, a later test's `history.length`-relative `before` baseline can silently count
// a dangling entry that the next push then absorbs instead of growing the stack, failing under test-order shuffling.
beforeEach(() => { window.history.pushState(null, "", "/core"); window.history.replaceState(null, "", "/core"); vi.spyOn(window, "scrollTo").mockImplementation(() => undefined); });
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; host?.remove(); vi.restoreAllMocks(); });

it("corrects a bare or wrong address in place to the role's first tab", async () => {
  window.history.replaceState(null, "", "/core?tab=work");
  const before = window.history.length, view = await mount(tenant);
  expect(view.shown()).toEqual(["home", ""]);
  expect(window.location.search).toBe("?tab=home");
  expect(window.history.length).toBe(before);
});

it("replaces a wrong address with only its own marks, dropping any other key the previous state carried", async () => {
  // Next 16 patches replaceState and skips its own router sync when the state it is handed still carries its own
  // `__NA` mark, so the correction must never pass the whole previous state back through.
  window.history.replaceState({ coreNav: true, __NA: true }, "", "/core?tab=work");
  await mount(tenant);
  expect(window.location.search).toBe("?tab=home");
  expect(window.history.state).toEqual({ coreNav: true });
});

it("pushes a menu move and scrolls a repeated tap to the top", async () => {
  const view = await mount(tenant), before = window.history.length;
  await act(async () => view.api.current!.go({ tab: "alerts", view: null }));
  expect(view.shown()).toEqual(["alerts", ""]);
  expect(window.history.length).toBe(before + 1);
  expect(window.history.state).toEqual({ coreNav: true });
  await act(async () => view.api.current!.go({ tab: "alerts", view: null }));
  expect(window.history.length).toBe(before + 1);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0 });
});

it("goes back through history after an in-page move and replaces to the parent after a direct link", async () => {
  window.history.replaceState(null, "", "/core?tab=more&view=licenses");
  const view = await mount(admin), back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  await act(async () => view.api.current!.back());
  expect(back).not.toHaveBeenCalled();
  expect(window.location.search).toBe("?tab=more&view=me");
  await act(async () => view.api.current!.go({ tab: "more", view: "licenses" }));
  await act(async () => view.api.current!.back());
  expect(back).toHaveBeenCalledOnce();
});

it("keeps one history entry per open request and clears it without a new entry", async () => {
  await mount(admin);
  const before = window.history.length;
  act(() => showDetailEntry("work"));
  expect(window.location.search).toBe("?tab=work");
  expect(detailEntryOnTop()).toBe(true);
  act(() => showDetailEntry("work"));
  expect(window.history.length).toBe(before + 1);
  act(() => hideDetailEntry());
  expect(detailEntryOnTop()).toBe(false);
  expect(window.history.length).toBe(before + 1);
});

it("replaces a request entry on a menu move instead of leaving a stale duplicate of the target behind it", async () => {
  const view = await mount(admin), before = window.history.length;
  act(() => showDetailEntry("work"));
  expect(window.history.length).toBe(before + 1);
  await act(async () => view.api.current!.go({ tab: "alerts", view: null }));
  expect(window.history.length).toBe(before + 1);
  expect(detailEntryOnTop()).toBe(false);
  expect(window.location.search).toBe("?tab=alerts");
  expect(view.shown()).toEqual(["alerts", ""]);
});

it("reports a browser back with the entry's request mark and re-reads the address", async () => {
  const view = await mount(admin);
  window.history.replaceState({ coreNav: true }, "", "/core?tab=alerts");
  await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(view.onPop).toHaveBeenLastCalledWith(false);
  expect(view.shown()).toEqual(["alerts", ""]);
  window.history.replaceState({ coreNav: true, detail: true }, "", "/core?tab=work");
  await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(view.onPop).toHaveBeenLastCalledWith(true);
});

it("leaving a request through its own place's menu item steps back to that place instead of stacking a copy", async () => {
  window.history.replaceState({ coreNav: true }, "", "/core?tab=requests");
  const view = await mount(tenant);
  await act(async () => showDetailEntry());
  expect(window.history.state).toEqual({ coreNav: true, detail: true });
  await act(async () => view.api.current!.go({ tab: "requests", view: null }));
  // The step-back defers to the eventual popstate (rules 8.14): right after the call, nothing has happened yet.
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(window.history.state).toEqual({ coreNav: true, detail: true });
  const popped = new Promise(resolve => window.addEventListener("popstate", resolve, { once: true }));
  await act(async () => { await popped; });
  expect(window.history.state).toEqual({ coreNav: true });
  expect(window.location.search).toBe("?tab=requests");
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
});

it("a manager's request opened from 알림 also steps back to it instead of stacking a copy (fix round 1)", async () => {
  window.history.replaceState({ coreNav: true }, "", "/core?tab=alerts");
  const view = await mount(admin);
  await act(async () => showDetailEntry("work"));
  expect(window.history.state).toEqual({ coreNav: true, detail: true });
  expect(window.location.search).toBe("?tab=work");
  const popped = new Promise(resolve => window.addEventListener("popstate", resolve, { once: true }));
  await act(async () => view.api.current!.go({ tab: "alerts", view: null }));
  await act(async () => { await popped; });
  expect(window.history.state).toEqual({ coreNav: true });
  expect(window.location.search).toBe("?tab=alerts");
});

it("a manager's request opened from 알림 replaces its entry when moving to 업무함, keeping 알림 behind it", async () => {
  window.history.replaceState({ coreNav: true }, "", "/core?tab=alerts");
  const view = await mount(admin), before = window.history.length;
  await act(async () => showDetailEntry("work"));
  expect(window.history.state).toEqual({ coreNav: true, detail: true });
  await act(async () => view.api.current!.go({ tab: "work", view: null }));
  expect(window.history.length).toBe(before + 1);
  expect(window.history.state).toEqual({ coreNav: true });
  expect(window.location.search).toBe("?tab=work");
});

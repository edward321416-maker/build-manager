// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIST_PLACE, parentPlace, parseBuildingPlace, placeKey, placeTitle, useBuildingPlace, type BuildingPlace } from "./building-place";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const id = "11111111-1111-4111-8111-111111111111";

describe("building places (P6 PR 2)", () => {
  it("reads only the five known shapes and falls back to the list", () => {
    for (const place of [{ kind: "list" }, { kind: "building", id }, { kind: "edit", id }, { kind: "add" }, { kind: "addUnit", id }] as BuildingPlace[])
      expect(parseBuildingPlace(place)).toEqual(place);
    for (const value of [null, undefined, 3, "building", { kind: "other", id }, { kind: "building", id: "x" }, { kind: "edit" }, { kind: "building", id: 7 }])
      expect(parseBuildingPlace(value)).toEqual(LIST_PLACE);
    // Foreign fields never travel with the place.
    expect(parseBuildingPlace({ kind: "add", id, extra: true })).toEqual({ kind: "add" });
  });

  it("goes one step up and names each step for the top bar", () => {
    expect(parentPlace({ kind: "building", id })).toEqual(LIST_PLACE);
    expect(parentPlace({ kind: "edit", id })).toEqual({ kind: "building", id });
    expect(parentPlace({ kind: "addUnit", id })).toEqual({ kind: "building", id });
    expect(parentPlace({ kind: "add" })).toEqual(LIST_PLACE);
    expect(placeTitle(LIST_PLACE, "합성 건물")).toBeNull();
    expect(placeTitle({ kind: "building", id }, "합성 건물")).toBe("합성 건물");
    expect(placeTitle({ kind: "building", id }, null)).toBe("건물");
    expect(placeTitle({ kind: "edit", id }, "합성 건물")).toBe("건물 정보");
    expect(placeTitle({ kind: "add" }, null)).toBe("건물 추가");
    expect(placeTitle({ kind: "addUnit", id }, "합성 건물")).toBe("호실 추가");
    expect(new Set([LIST_PLACE, { kind: "building", id }, { kind: "edit", id }, { kind: "add" }, { kind: "addUnit", id }].map(p => placeKey(p as BuildingPlace))).size).toBe(5);
  });
});

describe("history steps", () => {
  let root: Root | undefined, host: HTMLDivElement | undefined;
  let nav: ReturnType<typeof useBuildingPlace> | undefined;
  function Probe({ active }: { active: boolean }) { nav = useBuildingPlace(active); return <p>{placeKey(nav.place)}</p>; }
  async function mount(active = true) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root!.render(<Probe active={active} />));
  }
  const popped = () => new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }));
  const shown = () => host!.textContent;
  beforeEach(() => { window.history.replaceState({ coreNav: true, other: "kept" }, "", "/core?tab=more&view=buildings"); });
  afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); root = undefined; host = undefined; nav = undefined; });

  it("pushes one entry per step on the same address and keeps other marks", async () => {
    await mount();
    expect(shown()).toBe("list");
    const before = window.history.length;
    await act(async () => nav!.open({ kind: "building", id }));
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toEqual({ coreNav: true, other: "kept", building: { kind: "building", id } });
    expect(window.location.pathname + window.location.search).toBe("/core?tab=more&view=buildings");
    expect(shown()).toBe("building:" + id);
  });

  it("walks back through history to the step below", async () => {
    await mount();
    await act(async () => nav!.open({ kind: "building", id }));
    await act(async () => nav!.open({ kind: "edit", id }));
    expect(shown()).toBe("edit:" + id);
    const back = popped();
    await act(async () => { nav!.back(); await back; });
    expect(shown()).toBe("building:" + id);
  });

  it("replaces without a new entry, and steps up in place when this entry is not one of its steps", async () => {
    await mount();
    await act(async () => nav!.open({ kind: "add" }));
    const length = window.history.length;
    await act(async () => nav!.replace({ kind: "building", id }));
    expect(window.history.length).toBe(length);
    expect(shown()).toBe("building:" + id);
    // A reload of the list entry with a stale step mark is not possible, but an entry without a mark steps up in place.
    window.history.replaceState({ coreNav: true }, "", "/core?tab=more&view=buildings");
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(shown()).toBe("list");
    await act(async () => nav!.back());
    expect(window.history.length).toBe(length);
    expect(shown()).toBe("list");
  });

  it("resets to the list and drops only its own mark", async () => {
    await mount();
    await act(async () => nav!.open({ kind: "edit", id }));
    await act(async () => nav!.reset());
    expect(window.history.state).toEqual({ coreNav: true, other: "kept" });
    expect(shown()).toBe("list");
  });

  it("is always the list outside 건물·호실 관리", async () => {
    window.history.replaceState({ coreNav: true, building: { kind: "edit", id } }, "", "/core?tab=work");
    await mount(false);
    expect(shown()).toBe("list");
  });
});

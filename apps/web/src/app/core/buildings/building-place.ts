"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

// P6 PR 2 (docs/superpowers/plans/2026-10-16-building-setup-screen.md): the place inside 건물·호실 관리 lives in the history
// entry's state, not the address, which P5 keeps to tab and view. Each step down is one entry on the same address, so
// browser back walks up one step and a reload keeps the step. Other layers' marks on the entry are kept as they are.
export type BuildingPlace = { kind: "list" } | { kind: "building"; id: string } | { kind: "edit"; id: string } | { kind: "add" } | { kind: "addUnit"; id: string };
export const LIST_PLACE: BuildingPlace = { kind: "list" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** History state is untrusted: anything but the five known shapes is the list. */
export function parseBuildingPlace(value: unknown): BuildingPlace {
  if (!value || typeof value !== "object") return LIST_PLACE;
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (kind === "add") return { kind };
  if ((kind === "building" || kind === "edit" || kind === "addUnit") && typeof id === "string" && UUID.test(id)) return { kind, id };
  return LIST_PLACE;
}
export function parentPlace(place: BuildingPlace): BuildingPlace {
  return place.kind === "edit" || place.kind === "addUnit" ? { kind: "building", id: place.id } : LIST_PLACE;
}
/** The top bar's name for a step below the list (the approved mockup); the list keeps the menu name. */
export function placeTitle(place: BuildingPlace, name: string | null): string | null {
  switch (place.kind) {
    case "list": return null;
    case "building": return name ?? "건물";
    case "edit": return "건물 정보";
    case "add": return "건물 추가";
    case "addUnit": return "호실 추가";
  }
}
export const placeKey = (place: BuildingPlace) => place.kind + ("id" in place ? ":" + place.id : "");

const EVENT = "core-building-place";
const stateOf = (): Record<string, unknown> => { const state: unknown = window.history.state; return state !== null && typeof state === "object" ? state as Record<string, unknown> : {}; };
const here = () => window.location.pathname + window.location.search;
function write(mode: "push" | "replace", place: BuildingPlace) {
  const state: Record<string, unknown> = { ...stateOf(), coreNav: true };
  if (place.kind === "list") delete state.building; else state.building = place;
  if (mode === "push") window.history.pushState(state, "", here()); else window.history.replaceState(state, "", here());
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify); window.addEventListener(EVENT, notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener(EVENT, notify); };
};
// The store's snapshot is the place key (a string, so React compares it by value); the place is read back from it.
const snapshot = () => placeKey(parseBuildingPlace(stateOf().building));
const fromKey = (key: string) => { const at = key.indexOf(":"); return parseBuildingPlace(at < 0 ? { kind: key } : { kind: key.slice(0, at), id: key.slice(at + 1) }); };

/** `active`: 건물·호실 관리 is the screen shown; anywhere else the place is the list. */
export function useBuildingPlace(active: boolean) {
  const key = useSyncExternalStore(subscribe, snapshot, () => "list");
  const place = useMemo(() => active ? fromKey(key) : LIST_PLACE, [active, key]);
  const open = useCallback((next: BuildingPlace) => write("push", next), []);
  const replace = useCallback((next: BuildingPlace) => write("replace", next), []);
  /** One step up: history back when this entry is a step this screen pushed, otherwise the parent in place. */
  const back = useCallback(() => {
    if (parseBuildingPlace(stateOf().building).kind !== "list") window.history.back(); else write("replace", parentPlace(place));
  }, [place]);
  const reset = useCallback(() => write("replace", LIST_PLACE), []);
  return useMemo(() => ({ place, open, replace, back, reset }), [place, open, replace, back, reset]);
}

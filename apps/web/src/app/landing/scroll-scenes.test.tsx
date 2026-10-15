// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollScenes } from "./scroll-scenes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let reduced = false;
const changes = new Set<() => void>();

beforeEach(() => {
  reduced = false;
  changes.clear();
  // A getter, so the component reads the setting as it is now when the change event fires.
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("reduce") ? reduced : false; }, media: query,
    addEventListener: (_: string, listener: () => void) => changes.add(listener),
    removeEventListener: (_: string, listener: () => void) => changes.delete(listener),
  }));
  // Paints at once; returning 0 leaves no frame pending, so every later scroll paints again.
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function Page() {
  return (
    <ScrollScenes>
      <section data-scene="hero"><div data-stage><div><h1 data-fit>title</h1><div data-fit data-hero-side>side</div></div></div></section>
      <section data-scene="tenant" data-steps="3"><div data-stage><div>steps</div></div></section>
      <section data-scene="record"><div data-stage><div><p data-row="0">a</p><p data-row="1">b</p></div></div></section>
    </ScrollScenes>
  );
}
const scene = (name: string) => host.querySelector<HTMLElement>(`[data-scene="${name}"]`)!;
const box = (top: number, height: number) => () => ({ top, height }) as DOMRect;
async function mount() { await act(async () => root.render(<Page />)); }

describe("ScrollScenes (design rules 9.1)", () => {
  it("sends every scene still from the server", () => {
    expect(renderToStaticMarkup(<Page />)).not.toContain("data-motion");
  });

  it("turns the scenes on after mount and starts each at its beginning", async () => {
    await mount();
    expect(scene("hero").dataset.motion).toBe("on");
    expect(scene("tenant").dataset.step).toBe("0");
    expect(scene("hero").style.getPropertyValue("--a")).toBe("0.0000");
    expect(scene("hero").dataset.side).toBe("hidden");
  });

  it("follows the scroll", async () => {
    await mount();
    scene("hero").getBoundingClientRect = box(-900, 2000);
    scene("tenant").getBoundingClientRect = box(-550, 2000);
    scene("record").getBoundingClientRect = box(-550, 2000);
    await act(async () => { window.dispatchEvent(new Event("scroll")); });
    expect(scene("tenant").dataset.step).toBe("1");
    expect(scene("hero").style.getPropertyValue("--a")).toBe("1.0000");
    expect(scene("hero").dataset.side).toBe("shown");
    expect(host.querySelector<HTMLElement>('[data-row="1"]')!.style.getPropertyValue("--s")).toBe("1.0000");
  });

  it("keeps every scene still for reduced motion and re-decides when that setting changes", async () => {
    reduced = true;
    await mount();
    expect(scene("tenant").dataset.motion).toBe("off");
    expect(scene("tenant").dataset.step).toBeUndefined();
    reduced = false;
    await act(async () => { changes.forEach(listener => listener()); });
    expect(scene("tenant").dataset.motion).toBe("on");
  });

  it("keeps every scene still on a screen under 600px tall", async () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 599 });
    await mount();
    expect(scene("hero").dataset.motion).toBe("off");
  });

  it("clears what it set when a moving scene turns still", async () => {
    await mount();
    scene("hero").getBoundingClientRect = box(-900, 2000);
    scene("tenant").getBoundingClientRect = box(-550, 2000);
    scene("record").getBoundingClientRect = box(-550, 2000);
    await act(async () => { window.dispatchEvent(new Event("scroll")); });
    const row = host.querySelector<HTMLElement>('[data-row="1"]')!;
    expect(scene("hero").style.getPropertyValue("--a")).toBe("1.0000");
    expect(scene("hero").dataset.side).toBe("shown");
    expect(scene("tenant").dataset.step).toBe("1");
    expect(row.style.getPropertyValue("--s")).toBe("1.0000");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 599 });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    for (const name of ["hero", "tenant", "record"]) expect(scene(name).dataset.motion).toBe("off");
    expect(scene("tenant").dataset.step).toBeUndefined();
    expect(scene("hero").dataset.side).toBeUndefined();
    for (const name of ["--p", "--a", "--b"]) expect(scene("hero").style.getPropertyValue(name)).toBe("");
    expect(scene("tenant").style.getPropertyValue("--p")).toBe("");
    expect(row.style.getPropertyValue("--s")).toBe("");
  });

  it("keeps a scene still when its content is taller than its stage, the first scene measured part by part", async () => {
    await mount();
    const tooTall = (name: string, part: string) => {
      Object.defineProperty(scene(name).querySelector("[data-stage]")!, "clientHeight", { configurable: true, value: 600 });
      Object.defineProperty(scene(name).querySelector(part)!, "offsetHeight", { configurable: true, value: 601 });
    };
    tooTall("tenant", "[data-stage] > *");
    tooTall("hero", "[data-stage] > *");
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(scene("tenant").dataset.motion).toBe("off");
    // The first scene's group holds only parts placed on their own, so its own height says nothing.
    expect(scene("hero").dataset.motion).toBe("on");
    tooTall("hero", "[data-hero-side]");
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(scene("hero").dataset.motion).toBe("off");
  });

  it("stops following the scroll once it is gone", async () => {
    await mount();
    const tenant = scene("tenant");
    act(() => root.unmount());
    tenant.getBoundingClientRect = box(-1100, 2000);
    window.dispatchEvent(new Event("scroll"));
    expect(tenant.dataset.step).toBe("0");
    root = createRoot(host);
  });
});

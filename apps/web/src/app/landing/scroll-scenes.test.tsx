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
      <section data-scene="hero"><div data-stage><div><div data-board><figure>drawing</figure><h1 data-fit>title</h1></div><div data-fit data-hero-side>side</div></div></div></section>
      <section data-scene="tenant" data-steps="3"><div data-stage><div>steps<div data-screen="0"><p>a</p><p>b</p></div></div></div></section>
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

  it("measures a step scene with each of its steps shown, so its tallest step decides", async () => {
    await mount();
    const tenant = scene("tenant");
    Object.defineProperty(tenant.querySelector("[data-stage]")!, "clientHeight", { configurable: true, value: 620 });
    // With no step chosen every step is clipped away; the second step's text makes the content taller than the stage.
    const measuredWithTransitionsOff: boolean[] = [];
    Object.defineProperty(tenant.querySelector("[data-stage] > *")!, "offsetHeight", {
      configurable: true,
      get: () => { measuredWithTransitionsOff.push(tenant.dataset.measure !== undefined); return tenant.dataset.step === "1" ? 650 : 600; },
    });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(tenant.dataset.motion).toBe("off");
    expect(tenant.dataset.step).toBeUndefined();
    // Every state was read with transitions off, and they are back on once the scene is painted.
    expect(measuredWithTransitionsOff.length).toBeGreaterThan(0);
    expect(measuredWithTransitionsOff.every(Boolean)).toBe(true);
    expect(tenant.dataset.measure).toBeUndefined();
  });

  it("leaves out the stage's own padding when it measures (the room the content really has)", async () => {
    await mount();
    const tenant = scene("tenant");
    const stage = tenant.querySelector<HTMLElement>("[data-stage]")!;
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 620 });
    stage.style.paddingTop = "15px";
    Object.defineProperty(tenant.querySelector("[data-stage] > *")!, "offsetHeight", { configurable: true, value: 610 });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(tenant.dataset.motion).toBe("off");
  });

  it("measures again once the web font has loaded, since the words may wrap differently", async () => {
    const listeners = new Map<string, () => void>();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        ready: new Promise(() => {}),
        addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
        removeEventListener: (name: string) => listeners.delete(name),
      },
    });
    try {
      await mount();
      const tenant = scene("tenant");
      expect(tenant.dataset.motion).toBe("on");
      Object.defineProperty(tenant.querySelector("[data-stage]")!, "clientHeight", { configurable: true, value: 600 });
      Object.defineProperty(tenant.querySelector("[data-stage] > *")!, "offsetHeight", { configurable: true, value: 601 });
      await act(async () => { listeners.get("loadingdone")?.(); });
      expect(tenant.dataset.motion).toBe("off");
      act(() => root.unmount());
      expect(listeners.has("loadingdone")).toBe(false);
      root = createRoot(host);
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it("keeps a step scene still when a drawn screen's words run past its frame (rules 12: nothing clipped at 320px)", async () => {
    await mount();
    const tenant = scene("tenant");
    const screen = tenant.querySelector<HTMLElement>("[data-screen]")!;
    const last = screen.lastElementChild as HTMLElement;
    Object.defineProperty(screen, "clientHeight", { configurable: true, value: 355 });
    Object.defineProperty(last, "offsetTop", { configurable: true, value: 300 });
    Object.defineProperty(last, "offsetHeight", { configurable: true, value: 45 });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    // 300 + 45 ends 10px inside the 355px frame.
    expect(tenant.dataset.motion).toBe("on");
    Object.defineProperty(last, "offsetHeight", { configurable: true, value: 46 });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(tenant.dataset.motion).toBe("off");
  });

  it("fits the first scene's drawing into the room above its title, and clears it when still", async () => {
    await mount();
    const hero = scene("hero");
    Object.defineProperty(hero.querySelector("h1")!, "offsetTop", { configurable: true, value: 524 });
    Object.defineProperty(hero.querySelector("figure")!, "offsetHeight", { configurable: true, value: 560 });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    // 30px (space-6) above the drawing and between it and the title: 524 − 60 = 464 of 560.
    expect(hero.style.getPropertyValue("--fit")).toBe("0.8286");
    expect(hero.style.getPropertyValue("--fit-top")).toBe("262px");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 599 });
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    expect(hero.style.getPropertyValue("--fit")).toBe("");
    expect(hero.style.getPropertyValue("--fit-top")).toBe("");
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

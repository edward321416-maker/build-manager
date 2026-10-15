"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { activeStep, HERO_FIT_SPACE_REM, heroFit, heroPhase, motionAllowed, recordRow, sceneFits, sceneProgress } from "./scene-motion";

/**
 * The landing page's scroll scenes (design rules 9.1). The server sends every [data-scene] still, so the page reads in
 * full without JavaScript. After mount a scene gets data-motion="on" when motion is allowed and its content fits its
 * [data-stage] (its [data-fit] parts one by one when it marks any, as the first scene does; a step scene with each of
 * its steps shown), else "off". The first scene's [data-board] drawing gets --fit and --fit-top, the room above its
 * title. While on, the scroll sets --p, the first scene's --a and --b and data-side, each [data-row]'s --s, and a step
 * scene's data-step. Reduced motion, a resize or a short screen decides again.
 */
export function ScrollScenes({ className, children }: { className?: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scenes = Array.from(host.querySelectorAll<HTMLElement>("[data-scene]"));
    let frame = 0;
    const paint = () => {
      frame = 0;
      const viewport = window.innerHeight;
      for (const scene of scenes) {
        if (scene.dataset.motion !== "on") continue;
        const area = scene.getBoundingClientRect();
        const progress = sceneProgress(area.top, area.height, viewport);
        scene.style.setProperty("--p", progress.toFixed(4));
        const steps = Number(scene.dataset.steps ?? 0);
        if (steps > 0) scene.dataset.step = String(activeStep(progress, steps));
        if (scene.dataset.scene === "hero") {
          const phase = heroPhase(progress);
          scene.style.setProperty("--a", phase.shrink.toFixed(4));
          scene.style.setProperty("--b", phase.side.toFixed(4));
          scene.dataset.side = phase.sideShown ? "shown" : "hidden";
        }
        for (const row of scene.querySelectorAll<HTMLElement>("[data-row]")) {
          row.style.setProperty("--s", recordRow(progress, Number(row.dataset.row)).toFixed(4));
        }
      }
    };
    const request = () => { if (!frame) frame = window.requestAnimationFrame(paint); };
    const still = (scene: HTMLElement) => {
      scene.dataset.motion = "off";
      delete scene.dataset.step;
      delete scene.dataset.side;
      for (const name of ["--p", "--a", "--b", "--fit", "--fit-top"]) scene.style.removeProperty(name);
      for (const row of scene.querySelectorAll<HTMLElement>("[data-row]")) row.style.removeProperty("--s");
    };
    /** The first scene's drawing shrinks into the room above its title (operator decision 2026-10-15, A). */
    const fitDrawing = (scene: HTMLElement, stage: HTMLElement) => {
      const board = stage.querySelector<HTMLElement>("[data-board]");
      const drawing = board?.querySelector<HTMLElement>("figure");
      const title = board?.querySelector<HTMLElement>("h1");
      if (!drawing || !title) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const { fit, top } = heroFit(title.offsetTop, drawing.offsetHeight, HERO_FIT_SPACE_REM * rem);
      scene.style.setProperty("--fit", fit.toFixed(4));
      scene.style.setProperty("--fit-top", `${Math.round(top)}px`);
    };
    const layout = () => {
      const allowed = motionAllowed(reduced.matches, window.innerHeight);
      for (const scene of scenes) {
        if (!allowed) { still(scene); continue; }
        scene.dataset.motion = "on";
        // data-measure turns transitions off, so each state is read as it ends and opening the page moves nothing.
        scene.dataset.measure = "";
        const stage = scene.querySelector<HTMLElement>("[data-stage]");
        if (!stage) continue;
        const marked = Array.from(stage.querySelectorAll<HTMLElement>("[data-fit]"));
        const content = stage.firstElementChild as HTMLElement | null;
        const parts = marked.length > 0 ? marked : content ? [content] : [];
        // A step scene shows one step at a time, so every step is measured and the tallest decides (rules 9.1).
        const steps = Number(scene.dataset.steps ?? 0);
        const states = steps > 0 ? Array.from({ length: steps }, (_, index) => String(index)) : [undefined];
        const fits = states.every(state => {
          if (state === undefined) delete scene.dataset.step; else scene.dataset.step = state;
          return parts.every(part => sceneFits(part.offsetHeight, stage.clientHeight));
        });
        delete scene.dataset.step;
        if (!fits) still(scene);
        else if (scene.dataset.scene === "hero") fitDrawing(scene, stage);
      }
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      paint();
      // Apply the painted state while transitions are still off, then turn them back on.
      host.getBoundingClientRect();
      for (const scene of scenes) delete scene.dataset.measure;
    };
    layout();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", layout);
    reduced.addEventListener("change", layout);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", layout);
      reduced.removeEventListener("change", layout);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return <main ref={root} className={className}>{children}</main>;
}

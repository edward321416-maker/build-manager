"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { activeStep, heroPhase, motionAllowed, recordRow, sceneFits, sceneProgress } from "./scene-motion";

/**
 * The landing page's scroll scenes (design rules 9.1). The server sends every [data-scene] still, so the page reads in
 * full without JavaScript. After mount a scene gets data-motion="on" when motion is allowed and its content fits its
 * [data-stage] (its [data-fit] parts one by one when it marks any, as the first scene does), else "off". While on, the
 * scroll sets --p, the first scene's --a and --b and data-side, each [data-row]'s --s, and a step scene's data-step.
 * Reduced motion, a resize or a short screen decides again.
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
      for (const name of ["--p", "--a", "--b"]) scene.style.removeProperty(name);
      for (const row of scene.querySelectorAll<HTMLElement>("[data-row]")) row.style.removeProperty("--s");
    };
    const layout = () => {
      const allowed = motionAllowed(reduced.matches, window.innerHeight);
      for (const scene of scenes) {
        if (!allowed) { still(scene); continue; }
        scene.dataset.motion = "on";
        const stage = scene.querySelector<HTMLElement>("[data-stage]");
        if (!stage) continue;
        const marked = Array.from(stage.querySelectorAll<HTMLElement>("[data-fit]"));
        const content = stage.firstElementChild as HTMLElement | null;
        const parts = marked.length > 0 ? marked : content ? [content] : [];
        if (parts.some(part => !sceneFits(part.offsetHeight, stage.clientHeight))) still(scene);
      }
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      paint();
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

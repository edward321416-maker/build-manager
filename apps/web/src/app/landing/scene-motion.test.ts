import { describe, expect, it } from "vitest";
import { activeStep, clamp01, heroFit, heroPhase, motionAllowed, recordRow, sceneFits, sceneProgress, screenFits } from "./scene-motion";

describe("landing scroll scenes (design rules 9.1)", () => {
  it("measures progress from the scene top meeting the screen top to its end meeting the screen bottom", () => {
    expect(sceneProgress(0, 2000, 900)).toBe(0);
    expect(sceneProgress(-550, 2000, 900)).toBeCloseTo(0.5);
    expect(sceneProgress(-1100, 2000, 900)).toBe(1);
    expect(sceneProgress(300, 2000, 900)).toBe(0);
    expect(sceneProgress(-5000, 2000, 900)).toBe(1);
    // A scene no taller than the screen never moves.
    expect(sceneProgress(-10, 900, 900)).toBe(0);
  });

  it("shows one step per equal share of the scene and ends on the last", () => {
    expect([0, 0.32, 0.34, 0.66, 0.67, 0.99, 1].map(p => activeStep(p, 3))).toEqual([0, 0, 1, 1, 2, 2, 2]);
  });

  it("shrinks the first scene's board by 0.45 and fades the explanation in from 0.28 over 0.25", () => {
    expect(heroPhase(0)).toEqual({ shrink: 0, side: 0, sideShown: false });
    expect(heroPhase(0.225).shrink).toBeCloseTo(0.5);
    expect(heroPhase(0.45).shrink).toBe(1);
    expect(heroPhase(0.28).side).toBe(0);
    expect(heroPhase(0.405).side).toBeCloseTo(0.5);
    expect(heroPhase(0.53).side).toBeCloseTo(1);
    expect(heroPhase(0.29).sideShown).toBe(false);
    expect(heroPhase(0.3).sideShown).toBe(true);
  });

  it("fits the first scene's drawing into the room above its title, never larger than drawn (operator 2026-10-15, A)", () => {
    // 1280×800: the title starts 524px down the board, so a 560px drawing gets 524 − 2×30 = 464px.
    expect(heroFit(524, 560, 30).fit).toBeCloseTo(0.8286, 4);
    expect(heroFit(524, 560, 30).top).toBe(262);
    // 1440×900: there is room for the whole drawing.
    expect(heroFit(624, 560, 30)).toEqual({ fit: 1, top: 312 });
    // No room at all, or nothing laid out yet.
    expect(heroFit(50, 560, 30).fit).toBe(0);
    expect(heroFit(524, 0, 30).fit).toBe(1);
  });

  it("brings the record rows in one after another", () => {
    expect(recordRow(0, 0)).toBe(0);
    expect(recordRow(0.06, 0)).toBeCloseTo(0.5);
    expect(recordRow(0.12, 0)).toBe(1);
    expect(recordRow(0.14, 1)).toBe(0);
    expect(recordRow(0.26, 1)).toBeCloseTo(1);
    expect(recordRow(0.5, 3)).toBeCloseTo(0.6667, 3);
  });

  it("moves only when the reader allows motion and the screen is at least 600px tall", () => {
    expect(motionAllowed(false, 600)).toBe(true);
    expect(motionAllowed(false, 599)).toBe(false);
    expect(motionAllowed(true, 900)).toBe(false);
  });

  it("keeps a scene still when its content is taller than its stage", () => {
    expect(sceneFits(600, 600)).toBe(true);
    expect(sceneFits(601, 600)).toBe(false);
    // A drawn screen's words must end at least 10px (rules 4) inside its frame.
    expect(screenFits(345, 355, 10)).toBe(true);
    expect(screenFits(346, 355, 10)).toBe(false);
    // A frame not laid out yet says nothing.
    expect(screenFits(40, 0, 10)).toBe(true);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});

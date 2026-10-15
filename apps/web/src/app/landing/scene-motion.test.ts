import { describe, expect, it } from "vitest";
import { activeStep, clamp01, heroPhase, motionAllowed, recordRow, sceneFits, sceneProgress } from "./scene-motion";

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
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});

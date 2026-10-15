// Scroll-linked scenes on the landing page (design rules 9.1; spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md).
// Numbers only: ScrollScenes applies them to the page, and home.module.css turns them into movement.

/** The first scene's board finishes shrinking at this progress. */
export const HERO_SHRINK_END = 0.45;
/** The first scene's explanation starts to appear here and takes this much progress to appear fully. */
export const HERO_SIDE_START = 0.28;
export const HERO_SIDE_SPAN = 0.25;
/** Below this progress the explanation is not shown (keyboard focus still shows it at once). */
export const HERO_SIDE_SHOWN_FROM = 0.3;
/** Each record row starts this much progress after the one before it and takes this much to arrive. */
export const RECORD_ROW_DELAY = 0.14;
export const RECORD_ROW_SPAN = 0.12;
/** Screens shorter than this never move. */
export const MIN_MOTION_HEIGHT = 600;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 0 when the scene's top meets the screen's top, 1 when the scene's end meets the screen's bottom. */
export function sceneProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;
  return travel > 0 ? clamp01(-top / travel) : 0;
}

/** The step a step scene shows: one equal share of the progress each, ending on the last step. */
export function activeStep(progress: number, steps: number): number {
  return Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
}

export type HeroPhase = { shrink: number; side: number; sideShown: boolean };

export function heroPhase(progress: number): HeroPhase {
  return {
    shrink: clamp01(progress / HERO_SHRINK_END),
    side: clamp01((progress - HERO_SIDE_START) / HERO_SIDE_SPAN),
    sideShown: progress >= HERO_SIDE_SHOWN_FROM,
  };
}

/** The first scene keeps this much space (space-6, in rem) above its drawing and between the drawing and the title. */
export const HERO_FIT_SPACE_REM = 1.875;

export type HeroFit = { fit: number; top: number };

/**
 * From 768px the first scene's drawing shrinks into the room above its title, never past its drawn size
 * (operator decision 2026-10-15, A): `fit` scales it, and `top` is the room's middle, from the board's top.
 */
export function heroFit(titleTop: number, drawingHeight: number, space: number): HeroFit {
  const room = titleTop - 2 * space;
  return { fit: drawingHeight > 0 ? clamp01(room / drawingHeight) : 1, top: space + room / 2 };
}

/** How far the record row at `index` (from 0) has arrived. */
export function recordRow(progress: number, index: number): number {
  return clamp01((progress - RECORD_ROW_DELAY * index) / RECORD_ROW_SPAN);
}

export function motionAllowed(reducedMotion: boolean, viewportHeight: number): boolean {
  return !reducedMotion && viewportHeight >= MIN_MOTION_HEIGHT;
}

export function sceneFits(contentHeight: number, stageHeight: number): boolean {
  return contentHeight <= stageHeight;
}

/** A drawn screen's words end at least this far (rules 4: 10px, in rem) inside its phone or window. */
export const SCREEN_MARGIN_REM = 0.625;

/** Whether a drawn screen's words, ending at `contentBottom`, stay inside its frame; a frame not laid out says nothing. */
export function screenFits(contentBottom: number, frameHeight: number, margin: number): boolean {
  return frameHeight <= 0 || contentBottom + margin <= frameHeight;
}

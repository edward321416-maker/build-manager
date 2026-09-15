import type { Clock, IdGenerator } from "@build-manager/application";
import { randomUUID } from "node:crypto";

/**
 * Real time and identity live in the server layer so the domain and
 * application packages stay deterministic and free of ambient state.
 */
/**
 * Monotonic within the process: never returns the same instant twice.
 *
 * Ordinary millisecond resolution is too coarse here. Several operations can
 * land in the same millisecond, and the follow-up view decides whether an
 * answer arrived at or after a more-info request — with colliding timestamps a
 * pre-existing answer would look like a fresh response and the request would
 * appear satisfied the moment it was made.
 */
export function createSystemClock(): Clock {
  let previous = 0;

  return {
    now() {
      const current = Math.max(Date.now(), previous + 1);
      previous = current;
      return new Date(current).toISOString();
    },
  };
}

/** Unique across restarts, unlike a counter. */
export function createRandomIdGenerator(): IdGenerator {
  return {
    next(prefix: string) {
      return `${prefix}-${randomUUID()}`;
    },
  };
}

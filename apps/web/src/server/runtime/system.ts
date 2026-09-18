import type { Clock, IdGenerator } from "@build-manager/application";
import { randomUUID } from "node:crypto";

/**
 * Real time and identity live in the server layer so the domain and
 * application packages stay deterministic and free of ambient state.
 */
/**
 * Monotonic per Clock instance: one instance never returns the same instant
 * twice. Two instances know nothing about each other.
 *
 * Ordinary millisecond resolution is too coarse here. Several operations can
 * land in the same millisecond, and the follow-up view decides whether an
 * answer arrived after a more-info request — with colliding timestamps a
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

/**
 * Keyed in the global symbol registry so a duplicate evaluation of this module
 * finds the same Clock. Next can bundle route handlers separately, and an
 * ordinary module-local singleton would quietly become one clock per bundle.
 */
const PROCESS_CLOCK_KEY = Symbol.for("build-manager.web.process-clock");

type ProcessClockHost = { [PROCESS_CLOCK_KEY]?: Clock };

/**
 * The process-shared monotonic Clock for the local Node Web demo.
 *
 * Each request builds its own container, so a per-container Clock cannot order
 * two requests that land in the same millisecond. One Clock per process can.
 *
 * Process-shared is all this is: it makes no claim across several processes and
 * none across a restart. Both stay outside P0.
 */
export function getProcessSystemClock(): Clock {
  const host = globalThis as ProcessClockHost;

  const existing = host[PROCESS_CLOCK_KEY];
  if (existing !== undefined) {
    return existing;
  }

  const clock = createSystemClock();
  host[PROCESS_CLOCK_KEY] = clock;
  return clock;
}

/** Unique across restarts, unlike a counter. */
export function createRandomIdGenerator(): IdGenerator {
  return {
    next(prefix: string) {
      return `${prefix}-${randomUUID()}`;
    },
  };
}

import type { Clock, IdGenerator } from "@build-manager/application";
import { randomUUID } from "node:crypto";

/**
 * Real time and identity live in the server layer so the domain and
 * application packages stay deterministic and free of ambient state.
 */
export function createSystemClock(): Clock {
  return {
    now() {
      return new Date().toISOString();
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

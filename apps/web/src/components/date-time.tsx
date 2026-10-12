"use client";
import { useSyncExternalStore } from "react";
import { absoluteDateTime, relativeText } from "../lib/date-text";

// One shared timer re-renders every <DateTime> each minute, so 방금 and N분 전 never outlive the hour they describe.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach(notify => notify()), 30_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) { clearInterval(timer); timer = undefined; }
  };
}
const currentMinute = () => Math.floor(Date.now() / 60_000);

/**
 * One `<time>` for every screen in the design rules section 14 format. When it shows relative time, the title keeps
 * the date and time so the exact moment stays one hover away. `now` pins the clock for tests.
 */
export function DateTime({ at, now, timeZone, relative = true }: { at: string; now?: Date; timeZone?: string; relative?: boolean }) {
  useSyncExternalStore(subscribe, currentMinute, currentMinute);
  const clock = now ?? new Date();
  const full = absoluteDateTime(at, { now: clock, timeZone });
  const shown = (relative ? relativeText(at, clock) : null) ?? full;
  return <time dateTime={at} title={shown === full ? undefined : full}>{shown}</time>;
}

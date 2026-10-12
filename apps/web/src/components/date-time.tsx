"use client";
import { useSyncExternalStore } from "react";
import { formatDateTime } from "../lib/date-text";

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
 * One `<time>` for every screen in the design rules section 14 format, in Seoul time. Within the last hour it reads
 * `10분 전 (오후 1:50)`, so the exact time is on screen without a hover. `now` is a fixed Date (tests) or a clock
 * function, which is read again on every minute's re-render.
 */
export function DateTime({ at, now, timeZone, relative = true }: { at: string; now?: Date | (() => Date); timeZone?: string; relative?: boolean }) {
  useSyncExternalStore(subscribe, currentMinute, currentMinute);
  const clock = typeof now === "function" ? now() : now ?? new Date();
  return <time dateTime={at}>{formatDateTime(at, { now: clock, timeZone, relative })}</time>;
}

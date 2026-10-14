"use client";
import { useEffect, useMemo, useState } from "react";
import type { CoreTicketDto } from "@build-manager/api-contracts";
import type { CoreRole } from "./nav-config";
import { collectTodoExtras, createReadLimiter, hasTodoReads, READ_LIMIT, todoTargets, type TodoReads } from "./todo-extras";
import { NO_TODO_EXTRAS, type TodoExtras } from "./todo-list";

const NOT_READY: TodoExtras = { ...NO_TODO_EXTRAS, ready: false };

/** Runs the PR 2 reads (P5 spec §5) when the requests they cover change, after any change to the request list, and on
 * every refresh (`revision`, which counts refreshes only: core-screen.tsx `todoRevision`, not the screen's general
 * reload counter); never periodically or on focus. Only the latest read lands: a newer read, or leaving the
 * screen, cancels the one before, which starts no more reads, and all reads share four places, so a new read waits for
 * the ones still in flight. While a new set of requests is read, the earlier result stays and `ready` is false; a
 * re-read of the same set stays ready, so rows do not flicker.
 * `tickets` and `reads` must be referentially stable between renders (React state and a caller-memoized reads object):
 * a new `tickets` array means the request list was reloaded, so it reads again by design, and a new `reads` object
 * reads again too. */
export function useTodoExtras({ role, tickets, reads, revision }: { role: CoreRole | null; tickets: readonly CoreTicketDto[]; reads: TodoReads | null; revision: number }): TodoExtras {
  const targets = useMemo(() => role ? todoTargets(role, tickets) : null, [role, tickets]);
  const key = role && reads && targets && hasTodoReads(reads, targets) ? JSON.stringify([role, targets, Object.keys(reads).sort()]) : null;
  const [limiter] = useState(() => createReadLimiter(READ_LIMIT));
  const [state, setState] = useState<{ key: string; value: TodoExtras } | null>(null);
  // Signed out: forget the last result, so the next sign-in on this screen (development sign-in reuses it) never shows it.
  if (!role && state) setState(null);
  useEffect(() => {
    if (!key || !role || !reads) return;
    const run = new AbortController();
    void collectTodoExtras({ role, tickets, reads, now: Date.now(), signal: run.signal, limiter }).then(value => { if (!run.signal.aborted) setState({ key, value }); });
    return () => run.abort();
  }, [key, role, tickets, reads, revision, limiter]);
  return useMemo(() => {
    if (!role || !reads) return NOT_READY;
    if (!key) return NO_TODO_EXTRAS;
    return state ? { ...state.value, ready: state.key === key } : NOT_READY;
  }, [role, reads, key, state]);
}

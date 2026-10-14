"use client";
import { useEffect, useMemo, useState } from "react";
import type { CoreTicketDto } from "@build-manager/api-contracts";
import type { CoreRole } from "./nav-config";
import { collectTodoExtras, hasTodoReads, todoTargets, type TodoReads } from "./todo-extras";
import { NO_TODO_EXTRAS, type TodoExtras } from "./todo-list";

const NOT_READY: TodoExtras = { ...NO_TODO_EXTRAS, ready: false };

/** Runs the PR 2 reads (P5 spec §5) when the requests they cover change, after any change to the request list, and on
 * every refresh (`revision`); never periodically or on focus. Only the latest read lands. While a new set of requests is
 * read, the earlier result stays and `ready` is false; a re-read of the same set stays ready, so rows do not flicker. */
export function useTodoExtras({ role, tickets, reads, revision }: { role: CoreRole | null; tickets: readonly CoreTicketDto[]; reads: TodoReads | null; revision: number }): TodoExtras {
  const targets = useMemo(() => role ? todoTargets(role, tickets) : null, [role, tickets]);
  const key = role && reads && targets && hasTodoReads(reads, targets) ? JSON.stringify([role, targets, Object.keys(reads).sort()]) : null;
  const [state, setState] = useState<{ key: string; value: TodoExtras } | null>(null);
  useEffect(() => {
    if (!key || !role || !reads) return;
    let live = true;
    void collectTodoExtras({ role, tickets, reads, now: Date.now() }).then(value => { if (live) setState({ key, value }); });
    return () => { live = false; };
  }, [key, role, tickets, reads, revision]);
  return useMemo(() => {
    if (!role || !reads) return NOT_READY;
    if (!key) return NO_TODO_EXTRAS;
    return state ? { ...state.value, ready: state.key === key } : NOT_READY;
  }, [role, reads, key, state]);
}

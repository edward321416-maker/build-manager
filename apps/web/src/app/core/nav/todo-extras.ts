import { ApiClientError, type CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem, CoreTicketDto, CoreTicketOutcome, InvitationPage, ManagerVendorHandoffDto, TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { isOverdue } from "../manager-work-order";
import { vendorHandoffEligible } from "../vendor-handoff-manager";
import { isTenant, type CoreRole } from "./nav-config";
import { lastActivity, type TodoExtras, type TodoLinkRequest, type TodoReason } from "./todo-list";

/** P5 spec §5 read limits: per-request reads in flight, finished requests read for 결과 확인, and link-request pages of
 * 20. The 알림 notices (nav-screens.tsx) name the same numbers: 20건, 100건. */
export const READ_LIMIT = 4, RESULT_LIMIT = 20, LINK_PAGE_LIMIT = 5;

/** The server reads behind the PR 2 reasons. Each is present only where the role and sign-in allow it (todoReadsFor). */
export type TodoReads = {
  scheduling?(ticketId: string): Promise<TenantVendorSchedulingDto>;
  outcome?(ticketId: string): Promise<CoreTicketOutcome>;
  handoff?(ticketId: string): Promise<ManagerVendorHandoffDto>;
  workItems?(): Promise<CoreManagerWorkItem[]>;
  invitations?(cursor?: string): Promise<InvitationPage>;
};
export type TodoTargets = { visit: string[]; result: string[]; resultLimited: boolean; vendor: string[] };

/** Which requests the per-request reads cover. A visit time can only wait on a request in progress: offering the job to
 * a Vendor moves it there (vendor_handoff_mark_offered). A Vendor handoff exists only on a Vendor route. 결과 확인 reads
 * the most recent finished requests, by their last activity. */
export function todoTargets(role: CoreRole, tickets: readonly CoreTicketDto[]): TodoTargets {
  if (!isTenant(role)) return { visit: [], result: [], resultLimited: false, vendor: tickets.filter(vendorHandoffEligible).map(ticket => ticket.ticketId) };
  const time = (ticket: CoreTicketDto) => { const at = lastActivity(ticket); return at ? Date.parse(at) : 0; };
  const finished = tickets.filter(ticket => ticket.workStatus === "COMPLETED").sort((a, b) => time(b) - time(a) || a.ticketId.localeCompare(b.ticketId));
  return {
    visit: tickets.filter(ticket => ticket.workStatus === "IN_PROGRESS").map(ticket => ticket.ticketId),
    result: finished.slice(0, RESULT_LIMIT).map(ticket => ticket.ticketId), resultLimited: finished.length > RESULT_LIMIT, vendor: [],
  };
}

export const hasTodoReads = (reads: TodoReads, targets: TodoTargets) => Boolean(reads.workItems || reads.invitations
  || (reads.scheduling && targets.visit.length) || (reads.outcome && targets.result.length) || (reads.handoff && targets.vendor.length));

/** Which statuses end the session. A per-request read's 403 (or 404) means nothing is assigned to this account there, so
 * it is no failure and only its 401 signs out: these reads use the client that does not sign out on 403 (core-screen.tsx
 * `perRequestClient`). The request screens read the same data with the guarded client, which clears the screen on 403
 * instead. A list read's 401 and 403 both sign out. */
export const endsSession = (status: number, perRequest: boolean) => status === 401 || (status === 403 && !perRequest);

/** "none": nothing to do there; "signedOut": the guarded client has already cleared the screen; "failed": say partial. */
function failure(error: unknown, perRequest: boolean): "none" | "signedOut" | "failed" {
  const status = error instanceof ApiClientError ? error.status : undefined;
  if (status !== undefined && endsSession(status, perRequest)) return "signedOut";
  return perRequest && (status === 403 || status === 404) ? "none" : "failed";
}

/** Starts a read when one of `limit` places is free. A read whose run is no longer live when its turn comes never starts. */
export type ReadLimiter = (task: () => Promise<void>, live: () => boolean) => Promise<void>;

/** Shared by every run on one screen (use-todo-extras.ts), so a new run never adds to the reads a superseded run still
 * has in flight: at most `limit` at once in all (spec §5). The tasks catch their own errors. */
export function createReadLimiter(limit: number): ReadLimiter {
  let active = 0;
  const queue: { task: () => Promise<void>; live: () => boolean; done: () => void }[] = [];
  const pump = () => {
    while (active < limit && queue.length) {
      const { task, live, done } = queue.shift()!;
      if (!live()) { done(); continue; }
      active++;
      const release = () => { active--; done(); pump(); };
      void task().then(release, release);
    }
  };
  return (task, live) => new Promise<void>(done => { queue.push({ task, live, done }); pump(); });
}

/** Reads what the request list and the conversation summaries cannot show (spec §5) and never throws. Once `signal` is
 * aborted (a newer run replaced this one, or the screen is gone) or a read finds the session ended, it starts no more
 * reads. Without a `limiter` the run has four places of its own. */
export async function collectTodoExtras({ role, tickets, reads, now, signal, limiter = createReadLimiter(READ_LIMIT) }: {
  role: CoreRole; tickets: readonly CoreTicketDto[]; reads: TodoReads; now: number; signal?: AbortSignal; limiter?: ReadLimiter;
}): Promise<TodoExtras> {
  const targets = todoTargets(role, tickets), reasons: Record<string, TodoReason[]> = {}, links: TodoLinkRequest[] = [];
  let failed = false, linksLimited = false, signedOut = false;
  const live = () => !signedOut && !signal?.aborted;
  const add = (ticketId: string, reason: TodoReason) => { (reasons[ticketId] ??= []).push(reason); };
  const note = (error: unknown, perRequest: boolean) => {
    const result = failure(error, perRequest);
    if (result === "failed") failed = true; else if (result === "signedOut") signedOut = true;
  };
  const each = <T>(ids: readonly string[], read: ((ticketId: string) => Promise<T>) | undefined, due: (value: T) => boolean, reason: TodoReason) =>
    read ? ids.map(id => async () => { try { if (due(await read(id))) add(id, reason); } catch (error) { note(error, true); } }) : [];
  const perRequest = [
    ...each(targets.visit, reads.scheduling, value => value.waitingOn === "TENANT", "VISIT"),
    ...each(targets.result, reads.outcome, value => value.kind === "UNCONFIRMED", "RESULT"),
    // The current assignment is the newest one, so a later assignment replaces a declined one.
    ...each(targets.vendor, reads.handoff, value => value.waitingOn === "MANAGER" || (value.assignment?.status === "ENDED" && value.assignment.endReason === "DECLINED"), "VENDOR"),
  ];
  const overdue = async () => {
    if (!reads.workItems || !live()) return;
    try { for (const item of await reads.workItems()) if (isOverdue(item, now)) add(item.ticketId, "OVERDUE"); } catch (error) { note(error, false); }
  };
  const requested = async () => {
    if (!reads.invitations) return;
    try {
      let cursor: string | undefined;
      for (let page = 0; page < LINK_PAGE_LIMIT; page++) {
        if (!live()) return;
        const result = await reads.invitations(cursor);
        links.push(...result.items.filter(item => item.state === "REQUESTED").map(item => ({ invitationId: item.invitationId, unitLabel: item.unitLabel, requestedAt: item.requestedAt })));
        if (!result.nextCursor) return;
        cursor = result.nextCursor;
      }
      linksLimited = true;
    } catch (error) { note(error, false); }
  };
  await Promise.all([...perRequest.map(task => limiter(task, live)), overdue(), requested()]);
  return { reasons, links, failed, ready: true, resultLimited: targets.resultLimited && Boolean(reads.outcome), linksLimited };
}

/** The reads for a role: Vendor states and link requests exist only with a B1 sign-in, link requests only for the
 * organisation admin. `perRequest` is the client whose 403 does not sign out (core-screen.tsx); `list` signs out on 403. */
export function todoReadsFor({ role, b1, perRequest, list, invitations }: {
  role: CoreRole; b1: boolean; perRequest: CoreFlowClient; list: CoreFlowClient; invitations?: TodoReads["invitations"];
}): TodoReads {
  if (isTenant(role)) return { outcome: id => perRequest.outcome.read(id), ...(b1 ? { scheduling: (id: string) => perRequest.vendorHandoff.readScheduling(id) } : {}) };
  return {
    workItems: () => list.manager.list(),
    ...(b1 ? { handoff: (id: string) => perRequest.vendorHandoff.readHandoff(id) } : {}),
    ...(b1 && role === "ORG_ADMIN" && invitations ? { invitations } : {}),
  };
}

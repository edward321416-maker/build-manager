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

/** Which statuses end the session. A per-request read's 403 means nothing is assigned there, as on the request screens
 * (vendor-handoff-tenant.tsx, vendor-handoff-manager.tsx), so only its 401 signs out; a list read's 401 and 403 both do. */
export const endsSession = (status: number, perRequest: boolean) => status === 401 || (status === 403 && !perRequest);

/** "none": nothing to do there; "signedOut": the guarded client has already cleared the screen; "failed": say partial. */
function failure(error: unknown, perRequest: boolean): "none" | "signedOut" | "failed" {
  const status = error instanceof ApiClientError ? error.status : undefined;
  if (status !== undefined && endsSession(status, perRequest)) return "signedOut";
  return perRequest && (status === 403 || status === 404) ? "none" : "failed";
}

/** Runs the tasks with at most `limit` in flight. The tasks catch their own errors. */
export async function runLimited(tasks: readonly (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  const worker = async () => { while (next < tasks.length) await tasks[next++](); };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

/** Reads what the request list and the conversation summaries cannot show (spec §5) and never throws. */
export async function collectTodoExtras({ role, tickets, reads, now }: { role: CoreRole; tickets: readonly CoreTicketDto[]; reads: TodoReads; now: number }): Promise<TodoExtras> {
  const targets = todoTargets(role, tickets), reasons: Record<string, TodoReason[]> = {}, links: TodoLinkRequest[] = [];
  let failed = false, linksLimited = false;
  const add = (ticketId: string, reason: TodoReason) => { (reasons[ticketId] ??= []).push(reason); };
  const note = (error: unknown, perRequest: boolean) => { if (failure(error, perRequest) === "failed") failed = true; };
  const each = <T>(ids: readonly string[], read: ((ticketId: string) => Promise<T>) | undefined, due: (value: T) => boolean, reason: TodoReason) =>
    read ? ids.map(id => async () => { try { if (due(await read(id))) add(id, reason); } catch (error) { note(error, true); } }) : [];
  const perRequest = [
    ...each(targets.visit, reads.scheduling, value => value.waitingOn === "TENANT", "VISIT"),
    ...each(targets.result, reads.outcome, value => value.kind === "UNCONFIRMED", "RESULT"),
    // The current assignment is the newest one, so a later assignment replaces a declined one.
    ...each(targets.vendor, reads.handoff, value => value.waitingOn === "MANAGER" || (value.assignment?.status === "ENDED" && value.assignment.endReason === "DECLINED"), "VENDOR"),
  ];
  const overdue = async () => {
    if (!reads.workItems) return;
    try { for (const item of await reads.workItems()) if (isOverdue(item, now)) add(item.ticketId, "OVERDUE"); } catch (error) { note(error, false); }
  };
  const requested = async () => {
    if (!reads.invitations) return;
    try {
      let cursor: string | undefined;
      for (let page = 0; page < LINK_PAGE_LIMIT; page++) {
        const result = await reads.invitations(cursor);
        links.push(...result.items.filter(item => item.state === "REQUESTED").map(item => ({ invitationId: item.invitationId, unitLabel: item.unitLabel, requestedAt: item.requestedAt })));
        if (!result.nextCursor) return;
        cursor = result.nextCursor;
      }
      linksLimited = true;
    } catch (error) { note(error, false); }
  };
  await Promise.all([runLimited(perRequest, READ_LIMIT), overdue(), requested()]);
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

import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { TODO_REASON_NAMES } from "../../../components/status-names";
import { managerRowHint } from "../manager-next-step";
import { intakeDisplayStatus, isIntakeDraft } from "../ui/work-status-badge";
import { isTenant, type CoreRole } from "./nav-config";

/** Why a request is on the 알림 to-do list (P5 spec §5). PR 1 uses only what the request list and the conversation
 * summaries already carry; the per-request reads (visit times, results, Vendor, due dates, link requests) come in PR 2. */
export type TodoReason = "SAFETY" | "REPLY" | "DECIDE" | "DRAFT" | "MORE_INFO";
export type TodoItem = { ticketId: string; unitId: string; issueType: CoreTicketDto["detail"]["issueType"]; reasons: TodoReason[]; lastActivity: string | null };
export type TodoList = { items: TodoItem[]; partial: boolean };

// Sort groups (spec §5): urgent checks, then the replies and decisions someone waits on, then the rest. Group 1 is kept
// for PR 2's 기한 지남.
const GROUP: Record<TodoReason, number> = { SAFETY: 0, REPLY: 2, DECIDE: 2, DRAFT: 3, MORE_INFO: 3 };

export const todoReasonName = (role: CoreRole, reason: TodoReason): string =>
  reason === "REPLY" ? (isTenant(role) ? TODO_REASON_NAMES.REPLY_TENANT : TODO_REASON_NAMES.REPLY_MANAGER) : TODO_REASON_NAMES[reason];

const lastActivity = (ticket: CoreTicketDto) =>
  ticket.events.reduce<string | null>((latest, event) => latest === null || Date.parse(event.at) > Date.parse(latest) ? event.at : latest, null);

function reasonsFor(role: CoreRole, ticket: CoreTicketDto, summary: CoreCommunicationSummary | undefined): TodoReason[] {
  const waiting = summary && !summary.readOnly ? summary.waitingFor : "NONE", reasons: TodoReason[] = [];
  if (isTenant(role)) {
    const open = ticket.workStatus === "OPEN", intake = intakeDisplayStatus(ticket);
    if (open && intake === "SAFETY_ESCALATED") reasons.push("SAFETY");
    if (waiting === "TENANT") reasons.push("REPLY");
    if (isIntakeDraft(ticket)) reasons.push("DRAFT");
    if (open && intake === "NEEDS_MORE_INFO") reasons.push("MORE_INFO");
    return reasons;
  }
  // The tenant's turn (제출 전, 추가 확인) is not the manager's to-do.
  const hint = managerRowHint(ticket);
  if (hint === "SAFETY_ESCALATED") reasons.push("SAFETY");
  if (waiting === "MANAGER") reasons.push("REPLY");
  if (hint === "DECIDE") reasons.push("DECIDE");
  return reasons;
}

/** Builds the list from data the screen already loaded and never calls the server, so the badge counts only what was
 * confirmed. A failed summary read leaves the list partial: replies may be missing, never invented. */
export function buildTodoList({ role, tickets, summaries, summariesFailed }: {
  role: CoreRole; tickets: readonly CoreTicketDto[]; summaries: Readonly<Record<string, CoreCommunicationSummary>>; summariesFailed: boolean;
}): TodoList {
  const items = tickets.filter(ticket => ticket.workStatus !== "COMPLETED").flatMap(ticket => {
    const reasons = reasonsFor(role, ticket, summaries[ticket.ticketId]);
    return reasons.length ? [{ ticketId: ticket.ticketId, unitId: ticket.unitId, issueType: ticket.detail.issueType, reasons, lastActivity: lastActivity(ticket) }] : [];
  });
  const group = (item: TodoItem) => Math.min(...item.reasons.map(reason => GROUP[reason]));
  const time = (item: TodoItem) => item.lastActivity ? Date.parse(item.lastActivity) : 0;
  items.sort((a, b) => group(a) - group(b) || time(b) - time(a) || a.ticketId.localeCompare(b.ticketId));
  return { items, partial: summariesFailed };
}

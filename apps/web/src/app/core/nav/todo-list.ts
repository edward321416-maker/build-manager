import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { TODO_REASON_NAMES } from "../../../components/status-names";
import { managerRowHint } from "../manager-next-step";
import { intakeDisplayStatus, isIntakeDraft } from "../ui/work-status-badge";
import { isTenant, type CoreRole } from "./nav-config";

/** Why a request (or a link request) is on the 알림 to-do list (P5 spec §5). SAFETY to MORE_INFO come from the request
 * list and the conversation summaries (PR 1); the rest from reads per request, the manager's work list and the link
 * requests (PR 2, todo-extras.ts). */
export type TodoReason = "SAFETY" | "OVERDUE" | "REPLY" | "DECIDE" | "DRAFT" | "MORE_INFO" | "VISIT" | "RESULT" | "VENDOR" | "LINK";
export type TodoTicketItem = { kind: "ticket"; ticketId: string; unitId: string; issueType: CoreTicketDto["detail"]["issueType"]; reasons: TodoReason[]; lastActivity: string | null };
/** A tenant's request to join a unit, waiting for the organisation admin (invitation state REQUESTED). */
export type TodoLinkItem = { kind: "link"; invitationId: string; unitLabel: string; reasons: TodoReason[]; lastActivity: string | null };
export type TodoItem = TodoTicketItem | TodoLinkItem;
/** `checking`: the PR 2 reads for these requests have not finished; `resultLimited`/`linksLimited`: a read limit was hit. */
export type TodoList = { items: TodoItem[]; partial: boolean; checking: boolean; resultLimited: boolean; linksLimited: boolean };
export type TodoLinkRequest = { invitationId: string; unitLabel: string; requestedAt: string | null };
/** What the PR 2 reads found (todo-extras.ts). `ready` is false until the reads for the current requests finish. */
export type TodoExtras = {
  reasons: Readonly<Record<string, readonly TodoReason[]>>; links: readonly TodoLinkRequest[];
  failed: boolean; ready: boolean; resultLimited: boolean; linksLimited: boolean;
};
export const NO_TODO_EXTRAS: TodoExtras = { reasons: {}, links: [], failed: false, ready: true, resultLimited: false, linksLimited: false };
export const EMPTY_TODO_LIST: TodoList = { items: [], partial: false, checking: false, resultLimited: false, linksLimited: false };

// Sort groups (spec §5): urgent checks, overdue work, then the replies and decisions someone waits on, then the rest.
const GROUP: Record<TodoReason, number> = { SAFETY: 0, OVERDUE: 1, REPLY: 2, DECIDE: 2, DRAFT: 3, MORE_INFO: 3, VISIT: 3, RESULT: 3, VENDOR: 3, LINK: 3 };
// The order reasons read in within one row.
const ORDER: readonly TodoReason[] = ["SAFETY", "OVERDUE", "REPLY", "DECIDE", "DRAFT", "MORE_INFO", "VISIT", "RESULT", "VENDOR", "LINK"];

export const todoItemId = (item: TodoItem) => item.kind === "ticket" ? item.ticketId : item.invitationId;

export const todoReasonName = (role: CoreRole, reason: TodoReason): string =>
  reason === "REPLY" ? (isTenant(role) ? TODO_REASON_NAMES.REPLY_TENANT : TODO_REASON_NAMES.REPLY_MANAGER) : TODO_REASON_NAMES[reason];

export const lastActivity = (ticket: CoreTicketDto) =>
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
 * confirmed. A failed summary or PR 2 read leaves the list partial: reasons may be missing, never invented. A finished
 * request can only be on the list for 결과 확인, which only the PR 2 reads find. */
export function buildTodoList({ role, tickets, summaries, summariesFailed, extras = NO_TODO_EXTRAS }: {
  role: CoreRole; tickets: readonly CoreTicketDto[]; summaries: Readonly<Record<string, CoreCommunicationSummary>>; summariesFailed: boolean; extras?: TodoExtras;
}): TodoList {
  const requests = tickets.flatMap((ticket): TodoTicketItem[] => {
    const finished = ticket.workStatus === "COMPLETED", read = extras.reasons[ticket.ticketId] ?? [];
    const own = finished ? [] : reasonsFor(role, ticket, summaries[ticket.ticketId]);
    // The last read may predate the request finishing (it lands again only after the next read), so only 결과 확인 counts.
    const reasons = [...new Set([...own, ...(finished ? read.filter(reason => reason === "RESULT") : read)])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return reasons.length ? [{ kind: "ticket", ticketId: ticket.ticketId, unitId: ticket.unitId, issueType: ticket.detail.issueType, reasons, lastActivity: lastActivity(ticket) }] : [];
  });
  const links = extras.links.map((link): TodoLinkItem => ({ kind: "link", invitationId: link.invitationId, unitLabel: link.unitLabel, reasons: ["LINK"], lastActivity: link.requestedAt }));
  const items: TodoItem[] = [...requests, ...links];
  const group = (item: TodoItem) => Math.min(...item.reasons.map(reason => GROUP[reason]));
  const time = (item: TodoItem) => item.lastActivity ? Date.parse(item.lastActivity) : 0;
  items.sort((a, b) => group(a) - group(b) || time(b) - time(a) || todoItemId(a).localeCompare(todoItemId(b)));
  return { items, partial: summariesFailed || extras.failed, checking: !extras.ready, resultLimited: extras.resultLimited, linksLimited: extras.linksLimited };
}

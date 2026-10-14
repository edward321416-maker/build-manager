import type { CoreTicketDto } from "@build-manager/api-contracts";
import { intakeDisplayStatus, isIntakeDraft } from "../ui/work-status-badge";
import { lastActivity, todoReasonName, type TodoList, type TodoReason, type TodoTicketItem } from "./todo-list";

/** 홈 shows at most this many unfinished requests (P5 spec §4); the rest are one link away in 요청. */
export const HOME_CARD_LIMIT = 3;
export type HomeCard = { ticket: CoreTicketDto; next: string };

/** The request's next step in one line (spec §4): the 알림 reason names, or who has the request now. A draft's own
 * status label already reads 제출 전, so a draft with no other reason says what to do instead of repeating it. The
 * other lines use the same words as the request's own progress line (operator decision 2026-10-14, spec D14). */
export function tenantNextStep(ticket: CoreTicketDto, reasons: readonly TodoReason[]): string {
  const names = reasons.filter(reason => reason !== "DRAFT").map(reason => todoReasonName("TENANT", reason));
  if (names.length) return names.join(" · ");
  if (isIntakeDraft(ticket)) return "아직 보내지 않았어요. 열어서 제출해 주세요.";
  if (ticket.workStatus === "IN_PROGRESS") return "관리자가 처리하고 있어요.";
  const intake = intakeDisplayStatus(ticket);
  return intake === "APPROVED" || intake === "OVERRIDDEN" ? "처리를 기다리고 있어요." : "관리자 확인을 기다리고 있어요.";
}

/** This unit's unfinished requests: to-dos first in the 알림 order, then the most recent activity (spec §4). */
export function homeCards({ tickets, todo, unitId }: { tickets: readonly CoreTicketDto[]; todo: TodoList; unitId: string }): { cards: HomeCard[]; total: number } {
  const requests = todo.items.filter((item): item is TodoTicketItem => item.kind === "ticket");
  const order = new Map(requests.map((item, index) => [item.ticketId, index]));
  const reasons = new Map(requests.map(item => [item.ticketId, item.reasons]));
  const open = tickets.filter(ticket => ticket.unitId === unitId && ticket.workStatus !== "COMPLETED");
  const rank = (ticket: CoreTicketDto) => order.get(ticket.ticketId) ?? Number.MAX_SAFE_INTEGER;
  const time = (ticket: CoreTicketDto) => { const at = lastActivity(ticket); return at ? Date.parse(at) : 0; };
  const sorted = [...open].sort((a, b) => rank(a) - rank(b) || time(b) - time(a) || a.ticketId.localeCompare(b.ticketId));
  return { cards: sorted.slice(0, HOME_CARD_LIMIT).map(ticket => ({ ticket, next: tenantNextStep(ticket, reasons.get(ticket.ticketId) ?? []) })), total: open.length };
}

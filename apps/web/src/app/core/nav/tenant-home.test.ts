import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { buildTodoList } from "./todo-list";
import { HOME_CARD_LIMIT, homeCards, tenantNextStep } from "./tenant-home";

// Only the fields these rules read; the rest of the DTO is irrelevant here (same shape as todo-list.test.ts).
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], status: string, at: string, unitId = "unit-1", sent = true): CoreTicketDto {
  const events = sent ? [{ kind: "CREATED", at }, { kind: "FINALIZED", at }] : [{ kind: "CREATED", at }];
  return { ticketId: id, unitId, workStatus, detail: { status, issueType: "LEAK", decision: null, repairPacket: null }, events } as unknown as CoreTicketDto;
}
const replyFrom = (id: string): Record<string, CoreCommunicationSummary> => ({ [id]: { ticketId: id, version: 1, waitingFor: "TENANT", readOnly: false } as CoreCommunicationSummary });
const todoOf = (tickets: CoreTicketDto[], summaries: Record<string, CoreCommunicationSummary> = {}) =>
  buildTodoList({ role: "TENANT", tickets, summaries, summariesFailed: false });

describe("우리 집 next step (P5 spec §4)", () => {
  it("names every to-do reason on one line", () => {
    expect(tenantNextStep(ticket("a", "OPEN", "SAFETY_ESCALATED", "2026-10-13T01:00:00Z"), ["SAFETY", "REPLY"])).toBe("긴급 확인 필요 · 내 답변 필요");
    expect(tenantNextStep(ticket("b", "OPEN", "NEEDS_MORE_INFO", "2026-10-13T01:00:00Z"), ["MORE_INFO"])).toBe("추가 확인 필요");
  });

  it("does not repeat 제출 전, which the draft's own status label already says", () => {
    const draft = ticket("d", "OPEN", "IN_PROGRESS", "2026-10-13T01:00:00Z", "unit-1", false);
    expect(tenantNextStep(draft, ["DRAFT"])).toBe("아직 보내지 않았어요. 열어서 제출해 주세요.");
    expect(tenantNextStep(draft, ["REPLY", "DRAFT"])).toBe("내 답변 필요");
  });

  it("says who has it when nothing waits on the tenant", () => {
    expect(tenantNextStep(ticket("o", "OPEN", "READY_FOR_REVIEW", "2026-10-13T01:00:00Z"), [])).toBe("관리자가 확인하고 있어요.");
    expect(tenantNextStep(ticket("p", "IN_PROGRESS", "APPROVED", "2026-10-13T01:00:00Z"), [])).toBe("처리 중이에요.");
  });
});

describe("우리 집 in-progress requests (P5 spec §4)", () => {
  it("lists this unit's unfinished requests only, with the total", () => {
    const tickets = [ticket("mine", "OPEN", "READY_FOR_REVIEW", "2026-10-13T01:00:00Z"), ticket("other-unit", "OPEN", "READY_FOR_REVIEW", "2026-10-13T02:00:00Z", "unit-2"), ticket("done", "COMPLETED", "APPROVED", "2026-10-13T03:00:00Z")];
    const result = homeCards({ tickets, todo: todoOf(tickets), unitId: "unit-1" });
    expect(result.cards.map(card => card.ticket.ticketId)).toEqual(["mine"]);
    expect(result.total).toBe(1);
  });

  it("puts to-dos first in the 알림 order, then the most recent activity, and keeps three", () => {
    const tickets = [
      ticket("quiet-new", "OPEN", "READY_FOR_REVIEW", "2026-10-13T09:00:00Z"),
      ticket("quiet-old", "IN_PROGRESS", "APPROVED", "2026-10-13T01:00:00Z"),
      ticket("reply", "OPEN", "READY_FOR_REVIEW", "2026-10-13T02:00:00Z"),
      ticket("safety", "OPEN", "SAFETY_ESCALATED", "2026-10-13T03:00:00Z"),
    ];
    const result = homeCards({ tickets, todo: todoOf(tickets, replyFrom("reply")), unitId: "unit-1" });
    expect(result.cards.map(card => card.ticket.ticketId)).toEqual(["safety", "reply", "quiet-new"]);
    expect(result.cards).toHaveLength(HOME_CARD_LIMIT);
    expect(result.total).toBe(4);
    expect(result.cards.map(card => card.next)).toEqual(["긴급 확인 필요", "내 답변 필요", "관리자가 확인하고 있어요."]);
  });
});

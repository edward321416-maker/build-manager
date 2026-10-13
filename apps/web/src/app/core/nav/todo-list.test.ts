import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { buildTodoList, todoReasonName } from "./todo-list";

// Only the fields the to-do rules read; the rest of the DTO is irrelevant here.
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], status: string, events: [string, string][] = [["CREATED", "2026-10-13T01:00:00Z"]]): CoreTicketDto {
  return { ticketId: id, unitId: "unit-1", workStatus, detail: { status, issueType: "LEAK", decision: null, repairPacket: null }, events: events.map(([kind, at]) => ({ kind, at })) } as unknown as CoreTicketDto;
}
const summary = (id: string, waitingFor: CoreCommunicationSummary["waitingFor"], readOnly = false) => ({ [id]: { ticketId: id, version: 1, waitingFor, readOnly } });
const sent = (at = "2026-10-13T02:00:00Z"): [string, string][] => [["CREATED", "2026-10-13T01:00:00Z"], ["FINALIZED", at]];
const reasons = (list: ReturnType<typeof buildTodoList>) => list.items.map(item => [item.ticketId, item.reasons]);

describe("to-do list (P5 spec §5)", () => {
  it("gives the tenant drafts, more-info rounds, safety checks and replies", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false,
      tickets: [ticket("draft", "OPEN", "IN_PROGRESS"), ticket("more", "OPEN", "NEEDS_MORE_INFO", sent()), ticket("safe", "OPEN", "SAFETY_ESCALATED"), ticket("reply", "OPEN", "READY_FOR_REVIEW", sent()), ticket("idle", "OPEN", "READY_FOR_REVIEW", sent())],
      summaries: summary("reply", "TENANT") });
    expect(Object.fromEntries(reasons(list))).toEqual({ draft: ["DRAFT"], more: ["MORE_INFO"], safe: ["SAFETY"], reply: ["REPLY"] });
  });

  it("gives managers decisions, safety checks and replies, never the tenant's draft", () => {
    const list = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false,
      tickets: [ticket("decide", "OPEN", "PARTIAL", sent()), ticket("safe", "OPEN", "SAFETY_ESCALATED"), ticket("reply", "IN_PROGRESS", "APPROVED", sent()), ticket("draft", "OPEN", "IN_PROGRESS")],
      summaries: { ...summary("reply", "MANAGER"), ...summary("draft", "TENANT") } });
    expect(Object.fromEntries(reasons(list))).toEqual({ decide: ["DECIDE"], safe: ["SAFETY"], reply: ["REPLY"] });
  });

  it("puts every reason of one request on one row, so the badge counts it once", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false, tickets: [ticket("both", "OPEN", "IN_PROGRESS")], summaries: summary("both", "TENANT") });
    expect(reasons(list)).toEqual([["both", ["REPLY", "DRAFT"]]]);
  });

  it("ignores finished conversations and finished requests", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false,
      tickets: [ticket("readonly", "OPEN", "READY_FOR_REVIEW", sent()), ticket("done", "COMPLETED", "APPROVED", sent())],
      summaries: { ...summary("readonly", "TENANT", true), ...summary("done", "TENANT") } });
    expect(list.items).toEqual([]);
  });

  it("sorts urgent first, then replies and decisions, then the rest, newest first within each", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false,
      tickets: [
        ticket("old-draft", "OPEN", "IN_PROGRESS", [["CREATED", "2026-10-10T00:00:00Z"]]),
        ticket("new-draft", "OPEN", "IN_PROGRESS", [["CREATED", "2026-10-12T00:00:00Z"]]),
        ticket("reply", "OPEN", "READY_FOR_REVIEW", sent("2026-10-11T00:00:00Z")),
        ticket("safe", "OPEN", "SAFETY_ESCALATED", [["CREATED", "2026-10-09T00:00:00Z"]]),
      ],
      summaries: summary("reply", "TENANT") });
    expect(list.items.map(item => item.ticketId)).toEqual(["safe", "reply", "new-draft", "old-draft"]);
    expect(list.items[0].lastActivity).toBe("2026-10-09T00:00:00Z");
  });

  it("marks the list partial when the summaries failed and still lists what the request list confirms", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: true, tickets: [ticket("draft", "OPEN", "IN_PROGRESS")], summaries: {} });
    expect(list.partial).toBe(true);
    expect(reasons(list)).toEqual([["draft", ["DRAFT"]]]);
  });

  it("names reasons the way the request rows already do (rules 8.7)", () => {
    expect(todoReasonName("TENANT", "REPLY")).toBe("내 답변 필요");
    expect(todoReasonName("ORG_ADMIN", "REPLY")).toBe("관리자 답변 대기");
    expect(todoReasonName("ORG_ADMIN", "DECIDE")).toBe("처리 방법 결정 필요");
    expect(["SAFETY", "DRAFT", "MORE_INFO"].map(reason => todoReasonName("TENANT", reason as "SAFETY"))).toEqual(["긴급 확인 필요", "제출 전", "추가 확인 필요"]);
  });
});

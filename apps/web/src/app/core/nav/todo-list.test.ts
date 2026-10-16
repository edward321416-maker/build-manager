import type { CoreCommunicationSummary, CoreTicketDto } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { buildTodoList, NO_TODO_EXTRAS, todoItemId, todoReasonName, type TodoExtras } from "./todo-list";

// Only the fields the to-do rules read; the rest of the DTO is irrelevant here.
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], status: string, events: [string, string][] = [["CREATED", "2026-10-13T01:00:00Z"]]): CoreTicketDto {
  return { ticketId: id, unitId: "unit-1", workStatus, detail: { status, issueType: "LEAK", decision: null, repairPacket: null }, events: events.map(([kind, at]) => ({ kind, at })) } as unknown as CoreTicketDto;
}
const summary = (id: string, waitingFor: CoreCommunicationSummary["waitingFor"], readOnly = false) => ({ [id]: { ticketId: id, version: 1, waitingFor, readOnly } });
const sent = (at = "2026-10-13T02:00:00Z"): [string, string][] => [["CREATED", "2026-10-13T01:00:00Z"], ["FINALIZED", at]];
const reasons = (list: ReturnType<typeof buildTodoList>) => list.items.map(item => [todoItemId(item), item.reasons]);
const extras = (patch: Partial<TodoExtras>): TodoExtras => ({ ...NO_TODO_EXTRAS, ...patch });

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
    expect(list.items.map(todoItemId)).toEqual(["safe", "reply", "new-draft", "old-draft"]);
    expect(list.items[0].lastActivity).toBe("2026-10-09T00:00:00Z");
  });

  it("marks the list partial when the summaries failed and still lists what the request list confirms", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: true, tickets: [ticket("draft", "OPEN", "IN_PROGRESS")], summaries: {} });
    expect(list.partial).toBe(true);
    expect(reasons(list)).toEqual([["draft", ["DRAFT"]]]);
  });

  it("adds the PR 2 reasons to a request's row, and finished requests only for 결과 확인", () => {
    const list = buildTodoList({ role: "TENANT", summariesFailed: false, summaries: summary("visit", "TENANT"),
      tickets: [ticket("visit", "IN_PROGRESS", "READY_FOR_REVIEW", sent()), ticket("done", "COMPLETED", "APPROVED", sent()), ticket("quiet", "COMPLETED", "APPROVED", sent())],
      extras: extras({ reasons: { visit: ["VISIT"], done: ["RESULT"] } }) });
    expect(Object.fromEntries(reasons(list))).toEqual({ visit: ["REPLY", "VISIT"], done: ["RESULT"] });
  });

  it("keeps only 결과 확인 from the reads for a finished request, so a reason read before it finished does not linger", () => {
    const manager = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false, summaries: {},
      tickets: [ticket("late", "COMPLETED", "APPROVED", sent())], extras: extras({ reasons: { late: ["OVERDUE", "VENDOR"] } }) });
    expect(manager.items).toEqual([]);
    const tenant = buildTodoList({ role: "TENANT", summariesFailed: false, summaries: {},
      tickets: [ticket("done", "COMPLETED", "APPROVED", sent())], extras: extras({ reasons: { done: ["VISIT", "RESULT"] } }) });
    expect(reasons(tenant)).toEqual([["done", ["RESULT"]]]);
  });

  it("puts 기한 지남 right after urgent checks, before replies and decisions, and the Vendor check with the rest", () => {
    const list = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false, summaries: summary("reply", "MANAGER"),
      tickets: [
        ticket("reply", "IN_PROGRESS", "APPROVED", sent("2026-10-13T05:00:00Z")),
        ticket("late", "IN_PROGRESS", "APPROVED", sent("2026-10-10T00:00:00Z")),
        ticket("vendor", "IN_PROGRESS", "APPROVED", sent("2026-10-13T06:00:00Z")),
        ticket("safe", "OPEN", "SAFETY_ESCALATED", [["CREATED", "2026-10-09T00:00:00Z"]]),
      ],
      extras: extras({ reasons: { late: ["OVERDUE"], vendor: ["VENDOR"] } }) });
    expect(list.items.map(todoItemId)).toEqual(["safe", "late", "reply", "vendor"]);
  });

  it("lists a link request as its own row, sorted by when it was requested", () => {
    const list = buildTodoList({ role: "ORG_ADMIN", summariesFailed: false, summaries: {},
      tickets: [ticket("vendor", "IN_PROGRESS", "APPROVED", sent("2026-10-12T00:00:00Z"))],
      extras: extras({ reasons: { vendor: ["VENDOR"] }, links: [{ invitationId: "inv-1", unitLabel: "101호", requestedAt: "2026-10-14T00:00:00Z" }] }) });
    // The request's last activity is its CREATED event (2026-10-13T01:00), so the link request is the newer row.
    expect(list.items).toEqual([
      { kind: "link", invitationId: "inv-1", unitLabel: "101호", reasons: ["LINK"], lastActivity: "2026-10-14T00:00:00Z" },
      expect.objectContaining({ kind: "ticket", ticketId: "vendor", reasons: ["VENDOR"] }),
    ]);
  });

  it("passes on what the reads could not settle: partial, still checking, and the read limits", () => {
    const base = { role: "TENANT" as const, summariesFailed: false, summaries: {}, tickets: [] };
    expect(buildTodoList({ ...base, extras: extras({ failed: true }) }).partial).toBe(true);
    expect(buildTodoList({ ...base, extras: extras({ ready: false }) }).checking).toBe(true);
    // A re-read of the same requests keeps the rows and still says the rest is being checked.
    expect(buildTodoList({ ...base, extras: extras({ refreshing: true }) }).checking).toBe(true);
    expect(buildTodoList({ ...base, extras: extras({ resultLimited: true, linksLimited: true }) })).toMatchObject({ resultLimited: true, linksLimited: true, checking: false, partial: false });
    expect(buildTodoList(base)).toEqual({ items: [], partial: false, checking: false, resultLimited: false, linksLimited: false });
  });

  it("names reasons the way the request rows already do (rules 8.7)", () => {
    expect(todoReasonName("TENANT", "REPLY")).toBe("내 답변 필요");
    expect(todoReasonName("ORG_ADMIN", "REPLY")).toBe("관리자 답변 대기");
    expect(todoReasonName("ORG_ADMIN", "DECIDE")).toBe("처리 방법 결정 필요");
    expect(["SAFETY", "DRAFT", "MORE_INFO"].map(reason => todoReasonName("TENANT", reason as "SAFETY"))).toEqual(["긴급 확인 필요", "제출 전", "추가 확인 필요"]);
    expect(["VISIT", "RESULT", "VENDOR", "OVERDUE", "LINK"].map(reason => todoReasonName("ORG_ADMIN", reason as "VISIT"))).toEqual(["방문 시간 확정 필요", "결과 확인 필요", "업체 확인 필요", "기한 지남", "연결 요청 확인 필요"]);
  });
});

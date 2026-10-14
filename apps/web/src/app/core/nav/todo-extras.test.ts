import { ApiClientError, type CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem, CoreTicketDto, CoreTicketOutcome, InvitationDto, InvitationPage, ManagerVendorHandoffDto, TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { describe, expect, it, vi } from "vitest";
import { collectTodoExtras, endsSession, hasTodoReads, LINK_PAGE_LIMIT, READ_LIMIT, RESULT_LIMIT, todoReadsFor, todoTargets, type TodoReads } from "./todo-extras";

// Only the fields these rules read (same shape as todo-list.test.ts). `vendor` puts a request on a Vendor route.
function ticket(id: string, workStatus: CoreTicketDto["workStatus"], at = "2026-10-13T01:00:00Z", vendor = false): CoreTicketDto {
  const decision = vendor ? { type: "OVERRIDE", routeCode: "GENERAL_VENDOR" } : null;
  return { ticketId: id, unitId: "unit-1", workStatus, detail: { status: "APPROVED", issueType: "LEAK", decision, repairPacket: null }, events: [{ kind: "CREATED", at }] } as unknown as CoreTicketDto;
}
const denied = (status: number) => new ApiClientError("DENIED", "합성 응답", { status });
const schedule = (waitingOn: TenantVendorSchedulingDto["waitingOn"]) => ({ waitingOn }) as TenantVendorSchedulingDto;
const outcome = (kind: CoreTicketOutcome["kind"]) => ({ kind }) as CoreTicketOutcome;
const handoff = (waitingOn: ManagerVendorHandoffDto["waitingOn"], assignment: Partial<NonNullable<ManagerVendorHandoffDto["assignment"]>> | null) =>
  ({ waitingOn, assignment }) as ManagerVendorHandoffDto;
const invitation = (id: string, state: InvitationDto["state"]) => ({ invitationId: id, unitLabel: `${id}호`, state, requestedAt: "2026-10-13T02:00:00Z" }) as InvitationDto;
const now = Date.parse("2026-10-14T00:00:00Z");

describe("which requests the per-request reads cover (P5 spec §5)", () => {
  it("reads a tenant's visit times for requests in progress and the results of the 20 most recent finished ones", () => {
    const finished = Array.from({ length: 21 }, (_, n) => ticket(`done-${n}`, "COMPLETED", new Date(Date.UTC(2026, 9, 1 + n)).toISOString()));
    const targets = todoTargets("TENANT", [ticket("open", "OPEN"), ticket("going", "IN_PROGRESS"), ...finished]);
    expect(RESULT_LIMIT).toBe(20);
    expect(targets.visit).toEqual(["going"]);
    expect(targets.result).toHaveLength(20);
    expect(targets.result[0]).toBe("done-20");
    expect(targets.result).not.toContain("done-0");
    expect(targets.resultLimited).toBe(true);
    expect(todoTargets("TENANT", finished.slice(0, 20)).resultLimited).toBe(false);
  });

  it("reads a manager's Vendor handoff only for unfinished requests on a Vendor route", () => {
    expect(todoTargets("ORG_ADMIN", [ticket("v", "IN_PROGRESS", undefined, true), ticket("plain", "IN_PROGRESS"), ticket("done", "COMPLETED", undefined, true)]))
      .toEqual({ visit: [], result: [], resultLimited: false, vendor: ["v"] });
  });

  it("knows when there is nothing to read", () => {
    expect(hasTodoReads({ outcome: vi.fn() }, todoTargets("TENANT", [ticket("open", "OPEN")]))).toBe(false);
    expect(hasTodoReads({ outcome: vi.fn() }, todoTargets("TENANT", [ticket("done", "COMPLETED")]))).toBe(true);
    expect(hasTodoReads({ workItems: vi.fn() }, todoTargets("ORG_ADMIN", []))).toBe(true);
  });
});

describe("reading the PR 2 reasons", () => {
  it("never has more than four per-request reads in flight, and uses all four", async () => {
    let open = 0, most = 0, calls = 0;
    const reads: TodoReads = { outcome: async () => { calls++; open++; most = Math.max(most, open); await new Promise(resolve => setTimeout(resolve, 5)); open--; return outcome("RESOLVED"); } };
    await collectTodoExtras({ role: "TENANT", now, reads, tickets: Array.from({ length: 10 }, (_, n) => ticket(`d${n}`, "COMPLETED")) });
    expect(READ_LIMIT).toBe(4);
    expect(calls).toBe(10);
    expect(most).toBe(4);
  });

  it("finds the visit times and results a tenant owes, and nothing for 403 or 404", async () => {
    const reads: TodoReads = {
      scheduling: async id => { if (id === "gone") throw denied(404); if (id === "hidden") throw denied(403); return schedule(id === "visit" ? "TENANT" : "VENDOR"); },
      outcome: async id => outcome(id === "result" ? "UNCONFIRMED" : "RESOLVED"),
    };
    const extras = await collectTodoExtras({ role: "TENANT", now, reads,
      tickets: [ticket("visit", "IN_PROGRESS"), ticket("vendor", "IN_PROGRESS"), ticket("gone", "IN_PROGRESS"), ticket("hidden", "IN_PROGRESS"), ticket("result", "COMPLETED"), ticket("answered", "COMPLETED")] });
    expect(extras).toEqual({ reasons: { visit: ["VISIT"], result: ["RESULT"] }, links: [], failed: false, ready: true, resultLimited: false, linksLimited: false });
  });

  it("marks the list partial when a read fails for another reason, and adds nothing after a lost session", async () => {
    const failing = await collectTodoExtras({ role: "TENANT", now, tickets: [ticket("a", "COMPLETED"), ticket("b", "COMPLETED")],
      reads: { outcome: async id => { if (id === "a") throw denied(500); return outcome("UNCONFIRMED"); } } });
    expect(failing).toMatchObject({ failed: true, reasons: { b: ["RESULT"] } });
    const network = await collectTodoExtras({ role: "TENANT", now, tickets: [ticket("a", "COMPLETED")], reads: { outcome: async () => { throw new TypeError("network"); } } });
    expect(network.failed).toBe(true);
    const signedOut = await collectTodoExtras({ role: "TENANT", now, tickets: [ticket("a", "COMPLETED")], reads: { outcome: async () => { throw denied(401); } } });
    expect(signedOut).toMatchObject({ failed: false, reasons: {} });
  });

  it("gives a manager 업체 확인 when the handoff waits on them or the Vendor declined the current assignment", async () => {
    const reads: TodoReads = { handoff: async id =>
      id === "waiting" ? handoff("MANAGER", { status: "ACTIVE" })
      : id === "declined" ? handoff("NONE", { status: "ENDED", endReason: "DECLINED" })
      : id === "withdrawn" ? handoff("NONE", { status: "ENDED", endReason: "WITHDRAWN" })
      : id === "none" ? handoff("NONE", null)
      : handoff("VENDOR", { status: "ACTIVE" }) };
    const extras = await collectTodoExtras({ role: "PROPERTY_STAFF", now, reads, tickets: ["waiting", "declined", "withdrawn", "none", "busy"].map(id => ticket(id, "IN_PROGRESS", undefined, true)) });
    expect(extras.reasons).toEqual({ waiting: ["VENDOR"], declined: ["VENDOR"] });
  });

  it("gives a manager 기한 지남 from one read of the work list", async () => {
    const workItems = vi.fn(async () => [
      { ticketId: "late", workStatus: "IN_PROGRESS", dueAt: "2026-10-13T00:00:00Z" },
      { ticketId: "soon", workStatus: "OPEN", dueAt: "2026-10-15T00:00:00Z" },
      { ticketId: "done", workStatus: "COMPLETED", dueAt: "2026-10-01T00:00:00Z" },
      { ticketId: "none", workStatus: "OPEN", dueAt: null },
    ] as CoreManagerWorkItem[]);
    const extras = await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { workItems } });
    expect(extras.reasons).toEqual({ late: ["OVERDUE"] });
    expect(workItems).toHaveBeenCalledTimes(1);
  });

  it("lists requested links over at most five pages and says when there were more", async () => {
    const page = (n: number, last: number) => ({ items: [invitation(`r${n}`, "REQUESTED"), invitation(`o${n}`, "OPEN")], nextCursor: n < last ? `c${n + 1}` : null }) as InvitationPage;
    const short = vi.fn(async (cursor?: string) => page(cursor ? Number(cursor.slice(1)) : 1, 2));
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: short } })).toMatchObject({
      links: [{ invitationId: "r1", unitLabel: "r1호", requestedAt: "2026-10-13T02:00:00Z" }, { invitationId: "r2", unitLabel: "r2호", requestedAt: "2026-10-13T02:00:00Z" }],
      linksLimited: false });
    expect(short.mock.calls).toEqual([[undefined], ["c2"]]);
    const long = vi.fn(async (cursor?: string) => page(cursor ? Number(cursor.slice(1)) : 1, 9));
    const limited = await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: long } });
    expect(LINK_PAGE_LIMIT).toBe(5);
    expect(long).toHaveBeenCalledTimes(5);
    expect(limited.links).toHaveLength(5);
    expect(limited.linksLimited).toBe(true);
  });

  it("starts no further per-request reads once the run is cancelled", async () => {
    const run = new AbortController(); let calls = 0;
    const reads: TodoReads = { outcome: async () => { if (++calls === 1) run.abort(); return outcome("UNCONFIRMED"); } };
    await collectTodoExtras({ role: "TENANT", now, reads, signal: run.signal, tickets: Array.from({ length: 10 }, (_, n) => ticket(`d${n}`, "COMPLETED")) });
    expect(calls).toBe(1);
  });

  it("stops paging link requests once the run is cancelled", async () => {
    const run = new AbortController();
    const pages = vi.fn(async (cursor?: string) => {
      const n = cursor ? Number(cursor.slice(1)) : 1; if (n === 2) run.abort();
      return { items: [invitation(`r${n}`, "REQUESTED")], nextCursor: `c${n + 1}` } as InvitationPage;
    });
    await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: pages }, signal: run.signal });
    expect(pages).toHaveBeenCalledTimes(2);
  });

  it("starts no more per-request reads after one finds the session ended", async () => {
    let calls = 0;
    const reads: TodoReads = { outcome: async id => { calls++; if (id === "d0") throw denied(401); await new Promise(resolve => setTimeout(resolve, 5)); return outcome("UNCONFIRMED"); } };
    const extras = await collectTodoExtras({ role: "TENANT", now, reads, tickets: Array.from({ length: 10 }, (_, n) => ticket(`d${n}`, "COMPLETED")) });
    // The four already in flight finish; none of the other six start.
    expect(calls).toBe(4);
    expect(extras.failed).toBe(false);
  });

  it("treats a list read's 403 as a lost session and its other errors as a failure", async () => {
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { workItems: async () => { throw denied(403); } } })).toMatchObject({ failed: false });
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { workItems: async () => { throw denied(404); } } })).toMatchObject({ failed: true });
    expect(await collectTodoExtras({ role: "ORG_ADMIN", now, tickets: [], reads: { invitations: async () => { throw denied(500); } } })).toMatchObject({ failed: true });
  });
});

describe("sessions and reads per role", () => {
  it("ends the session on 401 always, and on 403 only for list reads", () => {
    expect([401, 403, 404, 500].map(status => endsSession(status, false))).toEqual([true, true, false, false]);
    expect([401, 403, 404, 500].map(status => endsSession(status, true))).toEqual([true, false, false, false]);
  });

  it("reads Vendor states and link requests only with a B1 sign-in, and link requests only for the admin", () => {
    const perRequest = { outcome: { read: vi.fn() }, vendorHandoff: { readScheduling: vi.fn(), readHandoff: vi.fn() } } as unknown as CoreFlowClient;
    const list = { manager: { list: vi.fn() } } as unknown as CoreFlowClient;
    const invitations = vi.fn();
    const keys = (reads: TodoReads) => Object.keys(reads).sort();
    expect(keys(todoReadsFor({ role: "TENANT", b1: false, perRequest, list, invitations }))).toEqual(["outcome"]);
    expect(keys(todoReadsFor({ role: "TENANT", b1: true, perRequest, list, invitations }))).toEqual(["outcome", "scheduling"]);
    expect(keys(todoReadsFor({ role: "ORG_ADMIN", b1: false, perRequest, list, invitations }))).toEqual(["workItems"]);
    expect(keys(todoReadsFor({ role: "PROPERTY_STAFF", b1: true, perRequest, list, invitations }))).toEqual(["handoff", "workItems"]);
    const admin = todoReadsFor({ role: "ORG_ADMIN", b1: true, perRequest, list, invitations });
    expect(keys(admin)).toEqual(["handoff", "invitations", "workItems"]);
    void admin.handoff!("t1"); void admin.workItems!();
    expect(perRequest.vendorHandoff.readHandoff).toHaveBeenCalledWith("t1");
    expect(list.manager.list).toHaveBeenCalledTimes(1);
    const tenant = todoReadsFor({ role: "TENANT", b1: true, perRequest, list, invitations });
    void tenant.outcome!("t2"); void tenant.scheduling!("t3");
    expect(perRequest.outcome.read).toHaveBeenCalledWith("t2");
    expect(perRequest.vendorHandoff.readScheduling).toHaveBeenCalledWith("t3");
  });
});

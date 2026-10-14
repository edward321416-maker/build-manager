// @vitest-environment jsdom
import { act, useEffect, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CoreTicketDto, CoreTicketOutcome } from "@build-manager/api-contracts";
import { afterEach, expect, it } from "vitest";
import type { CoreRole } from "./nav-config";
import type { TodoReads } from "./todo-extras";
import type { TodoExtras } from "./todo-list";
import { useTodoExtras } from "./use-todo-extras";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Props = { role: CoreRole | null; tickets: CoreTicketDto[]; reads: TodoReads | null; revision: number };
let root: Root | undefined, host: HTMLDivElement | undefined;
const seen: RefObject<TodoExtras | null> = { current: null };
function Probe(props: Props) {
  const extras = useTodoExtras(props);
  useEffect(() => { seen.current = extras; });
  return null;
}
const done = (id: string) => ({ ticketId: id, unitId: "u1", workStatus: "COMPLETED", detail: { status: "APPROVED", issueType: "LEAK", decision: null, repairPacket: null }, events: [{ kind: "CREATED", at: "2026-10-13T01:00:00Z" }] }) as unknown as CoreTicketDto;
const unconfirmed = async () => ({ kind: "UNCONFIRMED" }) as CoreTicketOutcome;
function deferred() {
  let resolve: (kind: CoreTicketOutcome["kind"]) => void = () => {};
  const promise = new Promise<CoreTicketOutcome>(done => { resolve = kind => done({ kind } as CoreTicketOutcome); });
  return { promise, resolve };
}
/** Outcome reads that stay open until the test settles them, oldest first, counting how many are in flight at once. */
function heldReads() {
  const calls: string[] = [], held: (() => void)[] = []; let open = 0, most = 0;
  const reads: TodoReads = { outcome: id => {
    calls.push(id); open++; most = Math.max(most, open);
    return new Promise<CoreTicketOutcome>(resolve => { held.push(() => { open--; resolve({ kind: "RESOLVED" } as CoreTicketOutcome); }); });
  } };
  const settleAll = async () => { while (held.length) await act(async () => held.shift()!()); };
  return { reads, calls, settleOne: () => act(async () => held.shift()!()), settleAll, most: () => most };
}
async function render(props: Props) {
  if (!root) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); }
  await act(async () => root!.render(<Probe {...props} />));
}
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; host?.remove(); seen.current = null; });

it("waits for the role and the reads, then reports what it found", async () => {
  await render({ role: null, tickets: [done("a")], reads: null, revision: 0 });
  expect(seen.current).toMatchObject({ ready: false, reasons: {} });
  await render({ role: "TENANT", tickets: [done("a")], reads: { outcome: unconfirmed }, revision: 0 });
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
});

it("is ready at once when there is nothing to read", async () => {
  await render({ role: "TENANT", tickets: [], reads: { outcome: unconfirmed }, revision: 0 });
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
});

it("lets only the latest read land, so a slow earlier one cannot bring old reasons back", async () => {
  const first = deferred(), second = deferred(); let call = 0;
  const reads: TodoReads = { outcome: () => (++call === 1 ? first : second).promise };
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 0 });
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 1 });
  await act(async () => second.resolve("RESOLVED"));
  await act(async () => first.resolve("UNCONFIRMED"));
  expect(call).toBe(2);
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
  // toMatchObject accepts any reasons for {}: the stale read would bring back { a: ["RESULT"] }.
  expect(seen.current?.reasons).toEqual({});
});

it("drops a superseded read's unstarted reads and keeps four in flight across both reads", async () => {
  const held = heldReads(), tickets = ["a", "b", "c", "d", "e", "f"].map(done);
  await render({ role: "TENANT", tickets, reads: held.reads, revision: 0 });
  expect(held.calls).toEqual(["a", "b", "c", "d"]);
  await render({ role: "TENANT", tickets, reads: held.reads, revision: 1 });
  // The first read's four are still in flight, so the new read waits for a free place.
  expect(held.calls).toEqual(["a", "b", "c", "d"]);
  await held.settleOne();
  // The first read's "e" and "f" never start; the new read takes the free place.
  expect(held.calls).toEqual(["a", "b", "c", "d", "a"]);
  await held.settleAll();
  expect(held.calls).toEqual(["a", "b", "c", "d", "a", "b", "c", "d", "e", "f"]);
  expect(held.most()).toBe(4);
  expect(seen.current).toMatchObject({ ready: true });
  expect(seen.current?.reasons).toEqual({});
});

it("starts no more reads once the screen is gone", async () => {
  const held = heldReads();
  await render({ role: "TENANT", tickets: ["a", "b", "c", "d", "e", "f"].map(done), reads: held.reads, revision: 0 });
  expect(held.calls).toHaveLength(4);
  await act(async () => root?.unmount()); root = undefined;
  await held.settleAll();
  expect(held.calls).toHaveLength(4);
});

it("forgets the last result once signed out, so the next sign-in on the same screen never shows it", async () => {
  const later = deferred(); let call = 0;
  const reads: TodoReads = { outcome: async () => call++ === 0 ? { kind: "UNCONFIRMED" } as CoreTicketOutcome : later.promise };
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 0 });
  expect(seen.current?.reasons).toEqual({ a: ["RESULT"] });
  await render({ role: null, tickets: [], reads: null, revision: 0 });
  // Development sign-in reuses the screen: the next account's reads are new, its request IDs may be the same.
  await render({ role: "TENANT", tickets: [done("a")], reads: { ...reads }, revision: 0 });
  expect(call).toBe(2);
  expect(seen.current).toMatchObject({ ready: false });
  expect(seen.current?.reasons).toEqual({});
  await act(async () => later.resolve("RESOLVED"));
  expect(seen.current).toMatchObject({ ready: true });
  expect(seen.current?.reasons).toEqual({});
});

it("keeps the earlier result while a changed set of requests is read, and says it is not ready yet", async () => {
  const later = deferred(); let call = 0;
  const reads: TodoReads = { outcome: async () => call++ === 0 ? { kind: "UNCONFIRMED" } as CoreTicketOutcome : later.promise };
  await render({ role: "TENANT", tickets: [done("a")], reads, revision: 0 });
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await render({ role: "TENANT", tickets: [done("a"), done("b")], reads, revision: 0 });
  expect(seen.current).toMatchObject({ ready: false, reasons: { a: ["RESULT"] } });
  await act(async () => later.resolve("RESOLVED"));
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
  expect(seen.current?.reasons).toEqual({});
});

it("re-reads the same requests on a new revision and stays ready while it does", async () => {
  const later = deferred(); let call = 0;
  const reads: TodoReads = { outcome: async () => call++ === 0 ? { kind: "UNCONFIRMED" } as CoreTicketOutcome : later.promise };
  const tickets = [done("a")];
  await render({ role: "TENANT", tickets, reads, revision: 0 });
  await render({ role: "TENANT", tickets, reads, revision: 1 });
  expect(call).toBe(2);
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await act(async () => later.resolve("RESOLVED"));
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
  expect(seen.current?.reasons).toEqual({});
});

it("does not read again when it re-renders with the same requests, reads and revision", async () => {
  let call = 0;
  const tickets = [done("a")];
  const reads: TodoReads = { outcome: async () => { call++; return { kind: "UNCONFIRMED" } as CoreTicketOutcome; } };
  await render({ role: "TENANT", tickets, reads, revision: 0 });
  expect(call).toBe(1);
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await render({ role: "TENANT", tickets, reads, revision: 0 });
  expect(call).toBe(1);
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
});

it("reads again when the request list is reloaded with the same requests, and stays ready meanwhile", async () => {
  const later = deferred(); let call = 0;
  const tickets = [done("a")];
  const reads: TodoReads = { outcome: async () => call++ === 0 ? { kind: "UNCONFIRMED" } as CoreTicketOutcome : later.promise };
  await render({ role: "TENANT", tickets, reads, revision: 0 });
  expect(call).toBe(1);
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await render({ role: "TENANT", tickets: [...tickets], reads, revision: 0 });
  expect(call).toBe(2);
  expect(seen.current).toMatchObject({ ready: true, reasons: { a: ["RESULT"] } });
  await act(async () => later.resolve("RESOLVED"));
  expect(seen.current).toMatchObject({ ready: true, reasons: {} });
  expect(seen.current?.reasons).toEqual({});
});

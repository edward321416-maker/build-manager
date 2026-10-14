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
});

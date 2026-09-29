import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createPostgresDatabase, withTransaction } from "@build-manager/persistence-postgres";
import { createPropertyAssignmentMutationPort } from "@build-manager/persistence-postgres/b4";
import { createB4Harness, seedB4Scope, assignmentHistory, gateB4Query, waitB4Lock, B4_PROBE, type B4Harness } from "./helpers/b4-fixture";

let h: B4Harness;
beforeAll(async () => { h = await createB4Harness(); },120_000);
afterAll(async () => { await h?.close(); });

it.each(["ensure", "end"] as const)("AC10-11 %s contention uses distinct backends and converges without duplicate history", async operation => {
  const s = await seedB4Scope(h);
  const appA = `b4-a-${randomUUID()}`, appB = `b4-b-${randomUUID()}`;
  const a = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: appA });
  const b = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: appB });
  const args = [s.adminA.digest,s.orgA,s.propertyB,s.staffMembership] as const;
  if (operation === "end") await h.assignments.ensureCurrent(...args);
  const gate = gateB4Query({ sql: `SELECT authn.b4_${operation}_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state`, applicationName: appA, timing: "after" });
  const pending: Promise<unknown>[] = [];
  try {
    await withTransaction(a,client => client.query(B4_PROBE));
    gate.arm();
    const pidB = await withTransaction(b,async client => (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid as number);
    const portA = createPropertyAssignmentMutationPort(a), portB = createPropertyAssignmentMutationPort(b);
    const first = operation === "ensure" ? portA.ensureCurrent(...args) : portA.endCurrent(...args);
    pending.push(first); void first.catch(() => {});
    await Promise.race([gate.reached,first.then(() => { throw new Error("B4 gate not reached"); })]);
    expect(gate.observations.isolation).toBe("read committed");
    expect(gate.observations.backendPid).not.toBe(pidB);
    const second = operation === "ensure" ? portB.ensureCurrent(...args) : portB.endCurrent(...args);
    pending.push(second); void second.catch(() => {});
    await waitB4Lock(h.p.admin,pidB,gate.observations.backendPid!);
    gate.release();
    if (operation === "ensure") {
      await expect(first).resolves.toEqual({ assigned: true, created: true });
      await expect(second).resolves.toEqual({ assigned: true, created: false });
    } else { await expect(first).resolves.toBeUndefined(); await expect(second).resolves.toBeUndefined(); }
    const history = await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe(operation === "ensure" ? "ACTIVE" : "ENDED");
    if (operation === "end") {
      const ended = history[0].bytes;
      await portA.endCurrent(...args);
      expect((await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership))[0].bytes).toBe(ended);
    }
    expect(gate.observations.statementCount).toBe(1);
  } finally {
    gate.release(); await Promise.allSettled(pending); gate.restore();
    await Promise.all([a.close(),b.close()]);
  }
});

it.each(["ensure-then-end", "end-then-ensure"] as const)("AC11 ordered %s reconciles final state with no extra history", async order => {
  const s = await seedB4Scope(h);
  const args = [s.adminA.digest,s.orgA,s.propertyB,s.staffMembership] as const;
  await h.assignments.ensureCurrent(...args);
  const app = `b4-order-${randomUUID()}`;
  const db = createPostgresDatabase({ ...h.roles.b1.webConfig,max: 1,application_name: app });
  const secondMethod = order === "ensure-then-end" ? "end" : "ensure";
  const gate = gateB4Query({ sql: `SELECT authn.b4_${secondMethod}_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state`,applicationName: app,timing: "before" });
  let second: Promise<unknown> | undefined;
  try {
    await withTransaction(db,client => client.query(B4_PROBE)); gate.arm();
    const port = createPropertyAssignmentMutationPort(db);
    second = secondMethod === "end" ? port.endCurrent(...args) : port.ensureCurrent(...args);
    void second.catch(() => {});
    await Promise.race([gate.reached,second.then(() => { throw new Error("B4 order gate missed"); })]);
    if (order === "ensure-then-end") await h.assignments.ensureCurrent(...args);
    else await h.assignments.endCurrent(...args);
    gate.release(); await second;
    const rows = await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership);
    expect(rows.filter(r => r.status === "ACTIVE")).toHaveLength(order === "ensure-then-end" ? 0 : 1);
    expect(rows).toHaveLength(order === "ensure-then-end" ? 1 : 2);
    for (const row of rows) expect(row.ended_at === null).toBe(row.status === "ACTIVE");
    if (order === "ensure-then-end") await expect(h.assignments.getCurrent(...args)).rejects.toMatchObject({ code: "NOT_FOUND" });
    else await expect(h.assignments.getCurrent(...args)).resolves.toEqual({ assigned: true });
  } finally { gate.release(); await Promise.allSettled(second ? [second] : []); gate.restore(); await db.close(); }
});

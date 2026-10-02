import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createB5Harness, seedB5Scope, directB5, observeB5Wait, effectiveCount, membershipRows, type B5Harness } from "./helpers/b5-fixture";
let h: B5Harness;
beforeAll(async () => { h = await createB5Harness(); },120_000);
afterAll(async () => { await h?.close(); });

it.each(["self","cross","staff"])("AC07 observed Organization-first %s contention has exact ordered SQL results", async variant => {
  const s = await seedB5Scope(h);
  const a = await directB5(h,s.adminA.digest,s.orgA), b = await directB5(h,s.adminB.digest,s.orgA);
  let pending: Promise<string> | undefined;
  try {
    expect(a.pid).not.toBe(b.pid); expect([a.isolation,b.isolation]).toEqual(["read committed","read committed"]);
    const targetA = variant === "self" ? s.adminMembership : variant === "cross" ? s.secondMembership : s.staffMembership;
    const targetB = variant === "self" ? s.secondMembership : variant === "cross" ? s.adminMembership : s.staffMembership;
    expect(await a.end(targetA)).toBe("ENDED");
    pending = b.end(targetB); void pending.catch(() => {});
    expect(await observeB5Wait(h,b.pid,a.pid)).toMatchObject({ wait: "Lock" });
    // Waiter has not obtained membership row locks: Organization is the common first lock.
    const locks = await h.p.admin.query("SELECT count(*) FROM pg_locks WHERE pid=$1 AND relation='app.organization_membership'::regclass AND mode='RowShareLock'",[b.pid]);
    expect(Number(locks.rows[0].count)).toBe(0);
    await a.commit(); expect(await pending).toBe(variant === "self" ? "LAST_ADMIN" : "NOT_FOUND"); await b.commit();
    expect(await effectiveCount(h,s.orgA)).toBe(variant === "staff" ? 2 : 1);
  } finally { await a.close(); await Promise.allSettled(pending ? [pending] : []); await b.close(); }
});
it("AC07 three distinct self callers serialize A then B then C with one admin retained", async () => {
  const s = await seedB5Scope(h,3);
  const a = await directB5(h,s.adminA.digest,s.orgA), b = await directB5(h,s.adminB.digest,s.orgA), c = await directB5(h,s.noMember.digest,s.orgA);
  const pending: Promise<string>[] = [];
  try {
    expect(new Set([a.pid,b.pid,c.pid]).size).toBe(3);
    expect(await a.end(s.adminMembership)).toBe("ENDED");
    const second = b.end(s.secondMembership); pending.push(second); void second.catch(() => {}); await observeB5Wait(h,b.pid,a.pid);
    const third = c.end(s.thirdMembership); pending.push(third); void third.catch(() => {}); await observeB5Wait(h,c.pid,b.pid);
    await a.commit(); expect(await second).toBe("ENDED"); await observeB5Wait(h,c.pid,b.pid);
    await b.commit(); expect(await third).toBe("LAST_ADMIN"); await c.commit(); expect(await effectiveCount(h,s.orgA)).toBe(1);
  } finally { await a.close(); await b.close(); await Promise.allSettled(pending); await c.close(); }
});
it.each(["caller-ended","caller-demoted","target-ended","org-inactive"])("AC08-09 %s committed during observed Organization wait is reclassified", async race => {
  const s = await seedB5Scope(h); const gate = new Client(h.p.adminConfig); await gate.connect();
  const a = await directB5(h,s.adminA.digest,s.orgA); let pending: Promise<string> | undefined;
  try {
    await gate.query("BEGIN"); const pid = Number((await gate.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    await gate.query("SELECT id FROM app.organization WHERE id=$1 FOR NO KEY UPDATE",[s.orgA]);
    pending = a.end(s.staffMembership); void pending.catch(() => {}); await observeB5Wait(h,a.pid,pid);
    if (race === "caller-demoted") await gate.query("UPDATE app.organization_membership SET role='PROPERTY_STAFF' WHERE id=$1",[s.adminMembership]);
    else if (race === "org-inactive") await gate.query("UPDATE app.organization SET status='SUSPENDED' WHERE id=$1",[s.orgA]);
    else await gate.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp(),version=version+1 WHERE id=$1",[race === "caller-ended" ? s.adminMembership : s.staffMembership]);
    await gate.query("COMMIT"); const snapshot = await membershipRows(h,s.orgA);
    expect(await pending).toBe(race === "caller-demoted" ? "FORBIDDEN" : "NOT_FOUND"); await a.commit();
    expect(await membershipRows(h,s.orgA)).toEqual(snapshot); expect(await effectiveCount(h,s.orgA)).toBeGreaterThanOrEqual(1);
  } finally { await gate.query("ROLLBACK"); await gate.end(); await Promise.allSettled(pending ? [pending] : []); await a.close(); }
});

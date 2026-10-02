import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createB5Harness, seedB5Scope, membershipRows, effectiveCount, type B5Harness } from "./helpers/b5-fixture";
let h: B5Harness;
beforeAll(async () => { h = await createB5Harness(); },120_000);
afterAll(async () => { await h?.close(); });

it.each(["staff","admin"])("AC02-05 %s end preserves identity/history, increments once and repeated denial changes nothing", async kind => {
  const s = await seedB5Scope(h);
  const target = kind === "staff" ? s.staffMembership : s.secondMembership;
  const before = (await membershipRows(h,s.orgA)).find(r => r.id === target)!;
  await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,target)).resolves.toBeUndefined();
  const after = (await membershipRows(h,s.orgA)).find(r => r.id === target)!;
  const original = JSON.parse(before.bytes), ended = JSON.parse(after.bytes);
  for (const field of ["id","org_id","user_id","role","created_at"]) expect(ended[field]).toEqual(original[field]);
  expect(after.status).toBe("ENDED"); expect(after.ended_at).toBeInstanceOf(Date);
  expect(Number(after.version)).toBe(Number(before.version)+1);
  await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,target)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect((await membershipRows(h,s.orgA)).find(r => r.id === target)).toEqual(after);
  expect(await effectiveCount(h,s.orgA)).toBeGreaterThanOrEqual(1);
});
it.each(["sole","SUSPENDED","DELETION_PENDING"])("AC06 %s leaves last effective admin unchanged", async state => {
  const s = await seedB5Scope(h,state === "sole" ? 1 : 2);
  if (state !== "sole") await h.p.admin.query("UPDATE app.app_user SET status=$1 WHERE id=$2",[state,s.adminB.userId]);
  const before = await membershipRows(h,s.orgA);
  await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,s.adminMembership)).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await membershipRows(h,s.orgA)).toEqual(before); expect(await effectiveCount(h,s.orgA)).toBe(1);
});
it("AC02-03 staff denial and hidden/foreign/missing targets do not expose or mutate rows", async () => {
  const s = await seedB5Scope(h); const before = await membershipRows(h,s.orgA);
  await expect(h.memberships.endCurrent(s.staffA.digest,s.orgA,s.staffNoneMembership)).rejects.toMatchObject({ code: "FORBIDDEN" });
  for (const target of [randomUUID(),s.foreignMembership]) await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,target)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(h.memberships.endCurrent(s.adminA.digest,s.orgB,s.foreignMembership)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(await membershipRows(h,s.orgA)).toEqual(before);
});

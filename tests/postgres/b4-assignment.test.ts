import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createB4Harness, seedB4Scope, assignmentHistory, type B4Harness, type B4Scope } from "./helpers/b4-fixture";
import { changeOrg } from "./helpers/b2-fixture";

let h: B4Harness, s: B4Scope;
beforeAll(async () => { h = await createB4Harness(); },120_000);
beforeEach(async () => { s = await seedB4Scope(h); });
afterAll(async () => { await h?.close(); });
const args = () => [s.adminA.digest,s.orgA,s.propertyB,s.staffMembership] as const;

it("AC05-09 converges, ends under final RLS, and preserves history on reassignment", async () => {
  await expect(h.assignments.getCurrent(...args())).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(h.assignments.ensureCurrent(...args())).resolves.toEqual({ assigned: true, created: true });
  const active = await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership);
  expect(active).toHaveLength(1); expect(active[0].status).toBe("ACTIVE"); expect(active[0].ended_at).toBeNull();
  await expect(h.assignments.ensureCurrent(...args())).resolves.toEqual({ assigned: true, created: false });
  expect(await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership)).toEqual(active);
  await expect(h.assignments.getCurrent(...args())).resolves.toEqual({ assigned: true });
  await expect(h.assignments.endCurrent(...args())).resolves.toBeUndefined();
  const ended = await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership);
  expect(ended).toHaveLength(1); expect(ended[0].id).toBe(active[0].id);
  expect(ended[0].status).toBe("ENDED"); expect(ended[0].ended_at).toBeInstanceOf(Date);
  await expect(h.assignments.endCurrent(...args())).resolves.toBeUndefined();
  expect(await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership)).toEqual(ended);
  await expect(h.assignments.getCurrent(...args())).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(h.assignments.ensureCurrent(...args())).resolves.toEqual({ assigned: true, created: true });
  const reassigned = await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership);
  expect(reassigned).toHaveLength(2);
  expect(reassigned.find(r => r.id === ended[0].id)).toEqual(ended[0]);
  expect(reassigned.filter(r => r.status === "ACTIVE")).toHaveLength(1);
  expect(reassigned.find(r => r.status === "ACTIVE")?.id).not.toBe(ended[0].id);
});

it.each(["foreign", "ended", "admin"])("AC03 hides %s membership and leaves every history row unchanged", async kind => {
  if (kind === "ended") await changeOrg(h.migration,s.orgA,"UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[s.staffMembership]);
  const membership = kind === "foreign" ? s.foreignStaffMembership : kind === "admin" ? s.adminMembership : s.staffMembership;
  const before = await assignmentHistory(h,s.orgA);
  for (const method of ["getCurrent","ensureCurrent","endCurrent"] as const) {
    await expect(h.assignments[method](s.adminA.digest,s.orgA,s.propertyA,membership)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await assignmentHistory(h,s.orgA)).toEqual(before);
  }
});

it("AC02 property visibility precedes admin authority for current staff", async () => {
  for (const method of ["getCurrent","ensureCurrent","endCurrent"] as const) {
    await expect(h.assignments[method](s.staffA.digest,s.orgA,s.propertyA,s.staffMembership)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(h.assignments[method](s.staffA.digest,s.orgA,s.propertyB,s.staffMembership)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});

it.each(["foreign", "archived"])("AC04 hides %s Property and mutates nothing", async kind => {
  const property = kind === "foreign" ? s.foreignProperty : s.propertyA;
  if (kind === "archived") await changeOrg(h.migration,s.orgA,"UPDATE app.property SET status='ARCHIVED' WHERE id=$1",[property]);
  const before = await assignmentHistory(h,s.orgA);
  for (const method of ["getCurrent","ensureCurrent","endCurrent"] as const) {
    await expect(h.assignments[method](s.adminA.digest,s.orgA,property,s.staffMembership)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await assignmentHistory(h,s.orgA)).toEqual(before);
  }
});

it("maps unauthenticated and invisible organization transaction failures to B4", async () => {
  for (const method of ["getCurrent","ensureCurrent","endCurrent"] as const) {
    await expect(h.assignments[method]("0".repeat(64),s.orgA,s.propertyA,s.staffMembership)).rejects.toMatchObject({ name: "B4Error", code: "UNAUTHENTICATED" });
    await expect(h.assignments[method](s.adminA.digest,s.orgB,s.foreignProperty,s.foreignStaffMembership)).rejects.toMatchObject({ name: "B4Error", code: "NOT_FOUND" });
  }
});

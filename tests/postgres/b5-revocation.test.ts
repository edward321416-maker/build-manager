import { afterAll, beforeAll, expect, it } from "vitest";
import { createSessionRegistryPort } from "@build-manager/persistence-postgres/b1";
import { createBuildingRegistrationPort, createUnitReadPort } from "@build-manager/persistence-postgres/b3";
import { createB5Harness, seedB5Scope, directB5, membershipRows, type B5Harness } from "./helpers/b5-fixture";
import { assignmentHistory } from "./helpers/b4-fixture";
let h: B5Harness;
beforeAll(async () => { h = await createB5Harness(); },120_000);
afterAll(async () => { await h?.close(); });

it.each(["B4-first","B5-first"])("AC10 controlled %s commit order retains assignment without authority revival", async order => {
  const s = await seedB5Scope(h);
  const b4 = await directB5(h,s.adminA.digest,s.orgA), b5 = await directB5(h,s.adminA.digest,s.orgA);
  const before = await assignmentHistory(h,s.orgA);
  try {
    expect(b4.pid).not.toBe(b5.pid);
    const put = await b4.client.query("SELECT authn.b4_ensure_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state",[Buffer.from(s.adminA.digest,"hex"),s.orgA,s.propertyB,s.staffMembership]);
    expect(put.rows[0].state).toBe("CREATED");
    expect(await b5.end(s.staffMembership)).toBe("ENDED");
    const activity = await h.p.admin.query("SELECT pid,state FROM pg_stat_activity WHERE pid=ANY($1::int[]) ORDER BY pid",[[b4.pid,b5.pid]]);
    expect(activity.rows).toHaveLength(2); expect(activity.rows.every(r => r.state === "idle in transaction")).toBe(true);
    if (order === "B4-first") {
      await b4.commit();
      expect((await membershipRows(h,s.orgA)).find(r => r.id === s.staffMembership)?.status).toBe("ACTIVE");
      await b5.commit();
    } else {
      await b5.commit();
      expect(await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership)).toHaveLength(0);
      await b4.commit();
    }
    const after = await assignmentHistory(h,s.orgA);
    for (const row of before) expect(after.find(r => r.id === row.id)).toEqual(row);
    expect(after).toHaveLength(before.length+1); expect(after.every(r => r.status === "ACTIVE")).toBe(true);
    await expect(h.reader.getProperty(s.staffA.digest,s.orgA,s.propertyB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.assignments.getCurrent(s.adminA.digest,s.orgA,s.propertyB,s.staffMembership)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.assignments.ensureCurrent(s.adminA.digest,s.orgA,s.propertyB,s.staffMembership)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await assignmentHistory(h,s.orgA)).toEqual(after);
  } finally { await b4.close(); await b5.close(); }
});
it("AC11-12 ended membership loses B1-B4 access but preserves same session, other org and assignment bytes", async () => {
  const s = await seedB5Scope(h);
  const registration = createBuildingRegistrationPort(h.webDb), units = createUnitReadPort(h.webDb);
  const unit = await registration.createUnit(s.adminA.digest,s.orgA,s.propertyA,{ label: "Synthetic B5 unit" });
  const before = await assignmentHistory(h,s.orgA), foreign = await membershipRows(h,s.orgB);
  await expect(h.reader.getProperty(s.staffA.digest,s.orgA,s.propertyA)).resolves.toMatchObject({ id: s.propertyA });
  await expect(units.getUnit(s.staffA.digest,s.orgA,s.propertyA,unit.id)).resolves.toMatchObject({ id: unit.id });
  await h.memberships.endCurrent(s.adminA.digest,s.orgA,s.secondMembership);
  await h.memberships.endCurrent(s.adminA.digest,s.orgA,s.staffMembership);
  await expect(h.reader.getProperty(s.staffA.digest,s.orgA,s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(units.getUnit(s.staffA.digest,s.orgA,s.propertyA,unit.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(registration.createUnit(s.adminB.digest,s.orgA,s.propertyA,{ label: "Denied" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(h.assignments.getCurrent(s.adminB.digest,s.orgA,s.propertyA,s.staffMembership)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(h.reader.getProperty(s.adminB.digest,s.orgB,s.foreignProperty)).resolves.toMatchObject({ id: s.foreignProperty });
  await expect(createSessionRegistryPort(h.webDb).currentActor(s.adminB.digest)).resolves.toMatchObject({ userId: s.adminB.userId });
  expect(await membershipRows(h,s.orgB)).toEqual(foreign); expect(await assignmentHistory(h,s.orgA)).toEqual(before);
});

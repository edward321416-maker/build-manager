import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createPostgresDatabase, withTransaction } from "@build-manager/persistence-postgres";
import { createPropertyAssignmentMutationPort } from "@build-manager/persistence-postgres/b4";
import { createBuildingRegistrationPort, createUnitReadPort } from "@build-manager/persistence-postgres/b3";
import { createB4Harness, seedB4Scope, assignmentHistory, gateB4Query, B4_PROBE, type B4Harness } from "./helpers/b4-fixture";
import { changeOrg } from "./helpers/b2-fixture";

let h: B4Harness;
beforeAll(async () => { h = await createB4Harness(); },120_000);
afterAll(async () => { await h?.close(); });

for (const operation of ["ensure", "end"] as const) {
  it.each(["caller-role", "property", "target"])(`AC12 ${operation} rechecks committed %s revocation at the command statement`, async revocation => {
    const s = await seedB4Scope(h);
    const args = [s.adminA.digest,s.orgA,s.propertyB,s.staffMembership] as const;
    if (operation === "end") await h.assignments.ensureCurrent(...args);
    // Keep this Property visible after the caller becomes staff, isolating 403 from 404.
    await changeOrg(h.migration,s.orgA,"INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')",[s.orgA,s.adminMembership,s.propertyB]);
    const before = await assignmentHistory(h,s.orgA);
    const app = `b4-revoke-${randomUUID()}`;
    const db = createPostgresDatabase({ ...h.roles.b1.webConfig,max: 1,application_name: app });
    const gate = gateB4Query({ sql: `SELECT authn.b4_${operation}_property_staff_assignment($1::bytea,$2::uuid,$3::uuid,$4::uuid) AS state`,applicationName: app,timing: "before" });
    let pending: Promise<unknown> | undefined;
    try {
      await withTransaction(db,client => client.query(B4_PROBE)); gate.arm();
      const port = createPropertyAssignmentMutationPort(db);
      pending = operation === "ensure" ? port.ensureCurrent(...args) : port.endCurrent(...args);
      void pending.catch(() => {});
      await Promise.race([gate.reached,pending.then(() => { throw new Error("B4 revocation gate missed"); })]);
      if (revocation === "caller-role") await changeOrg(h.migration,s.orgA,"UPDATE app.organization_membership SET role='PROPERTY_STAFF' WHERE id=$1",[s.adminMembership]);
      if (revocation === "property") await changeOrg(h.migration,s.orgA,"UPDATE app.property SET status='ARCHIVED' WHERE id=$1",[s.propertyB]);
      if (revocation === "target") await changeOrg(h.migration,s.orgA,"UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[s.staffMembership]);
      gate.release();
      await expect(pending).rejects.toMatchObject({ code: revocation === "caller-role" ? "FORBIDDEN" : "NOT_FOUND" });
      expect(await assignmentHistory(h,s.orgA)).toEqual(before);
      expect(gate.observations.statementCount).toBe(1);
      expect(gate.observations.isolation).toBe("read committed");
    } finally { gate.release(); await Promise.allSettled(pending ? [pending] : []); gate.restore(); await db.close(); }
  });
}

it("AC13 ending an assignment removes the next frozen Property and Unit read", async () => {
  const s = await seedB4Scope(h);
  const registration = createBuildingRegistrationPort(h.webDb), units = createUnitReadPort(h.webDb);
  const unit = await registration.createUnit(s.adminA.digest,s.orgA,s.propertyA,{ label: "Synthetic unit" });
  await expect(h.reader.getProperty(s.staffA.digest,s.orgA,s.propertyA)).resolves.toMatchObject({ id: s.propertyA });
  await expect(units.getUnit(s.staffA.digest,s.orgA,s.propertyA,unit.id)).resolves.toMatchObject({ id: unit.id });
  await h.assignments.endCurrent(s.adminA.digest,s.orgA,s.propertyA,s.staffMembership);
  await expect(h.reader.getProperty(s.staffA.digest,s.orgA,s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(units.getUnit(s.staffA.digest,s.orgA,s.propertyA,unit.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it.each(["before", "after"] as const)("AC22 unknown COMMIT %s delivery returns sanitized failure without retry and GET reconciles", async timing => {
  const s = await seedB4Scope(h);
  const args = [s.adminA.digest,s.orgA,s.propertyB,s.staffMembership] as const;
  const app = `b4-commit-${randomUUID()}`;
  const db = createPostgresDatabase({ ...h.roles.b1.webConfig,max: 1,application_name: app });
  const gate = gateB4Query({ sql: "COMMIT",applicationName: app,timing,
    ...{ failure: new Error("B4_SYNTHETIC_COMMIT_TRANSPORT_LOSS") } });
  let pending: Promise<unknown> | undefined;
  try {
    await withTransaction(db,client => client.query(B4_PROBE)); gate.arm();
    pending = createPropertyAssignmentMutationPort(db).ensureCurrent(...args);
    void pending.catch(() => {});
    await Promise.race([gate.reached,pending.then(() => { throw new Error("B4 COMMIT gate missed"); })]);
    gate.release();
    await expect(pending).rejects.toMatchObject({ name: "B4Error",code: "DEPENDENCY_UNAVAILABLE",message: "DEPENDENCY_UNAVAILABLE" });
    expect(gate.observations.statementCount).toBe(1);
    expect(gate.observations.mutationCount).toBe(1);
    // The frozen helper attempts cleanup. An attempted ROLLBACK is not evidence
    // that the preceding COMMIT did not persist; the fresh GET below decides state.
    expect(gate.observations.rollbackCount).toBe(1);
    if (timing === "after") {
      await expect(h.assignments.getCurrent(...args)).resolves.toEqual({ assigned: true });
      expect(await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership)).toHaveLength(1);
    } else {
      await expect(h.assignments.getCurrent(...args)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await assignmentHistory(h,s.orgA,s.propertyB,s.staffMembership)).toHaveLength(0);
    }
  } finally { gate.release(); await Promise.allSettled(pending ? [pending] : []); gate.restore(); await db.close(); }
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDatabase, withTransaction, type SqlClient } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort, createUnitReadPort } from "@build-manager/persistence-postgres/b3";
import { withB1OrgTransaction } from "../../packages/persistence-postgres/src/b1/org-transaction";
import { changeOrg } from "./helpers/b2-fixture";
import {
  B3_POOLCLIENT_SPY_PROBE,
  createB3Harness,
  gateB3Query,
  inOrg,
  seedB3Scope,
  type B3Harness,
} from "./helpers/b3-fixture";

const propertyInsert = "INSERT INTO app.property(id,org_id,address_reference,status) VALUES($1,$2,$3,'ACTIVE')";
const unitInsert = "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')";
const propertyReadback =
  "SELECT id,org_id,address_reference FROM app.property WHERE org_id=$1 AND id=$2 AND authn.can_read_property($3::bytea,org_id,id)";
const unitSelect =
  "SELECT id,org_id,property_id,label FROM app.unit WHERE org_id=$1 AND property_id=$2 AND id=$3 AND status='ACTIVE' " +
  "AND authn.can_read_property($4::bytea,org_id,property_id)";

async function probe(database: ReturnType<typeof createPostgresDatabase>): Promise<void> {
  await withTransaction(database, client => client.query(B3_POOLCLIENT_SPY_PROBE).then(() => undefined));
}

async function countByReference(h: B3Harness, orgId: string, reference: string): Promise<number> {
  return inOrg(h.migration, orgId, async () =>
    (await h.migration.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM app.property WHERE org_id=$1 AND address_reference=$2",
      [orgId, reference],
    )).rows[0].n);
}

async function countUnitLabel(h: B3Harness, orgId: string, propertyId: string, label: string): Promise<number> {
  return inOrg(h.migration, orgId, async () =>
    (await h.migration.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM app.unit WHERE org_id=$1 AND property_id=$2 AND label=$3",
      [orgId, propertyId, label],
    )).rows[0].n);
}

describe("B3 revocation and transaction boundaries", { concurrent: false }, () => {
  let h: B3Harness;
  beforeAll(async () => { h = await createB3Harness(); }, 120_000);
  afterAll(async () => { await h?.close(); });

  it("AC22 membership revoke after guard denies the final Property INSERT", async () => {
    const s = await seedB3Scope(h);
    const app = "b3_revoke_member_" + randomUUID().slice(0, 8);
    const db = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: app });
    const port = createBuildingRegistrationPort(db);
    const reference = "synthetic-member-revoke";
    const gate = gateB3Query({ sql: propertyInsert, applicationName: app });
    let drain: Promise<void> | undefined;
    try {
      await probe(db);
      gate.arm();
      const outcome = port.createProperty(s.adminA.digest, s.orgA, { addressReference: reference })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      drain = outcome.then(() => {});
      await Promise.race([
        gate.reached,
        outcome.then(() => { throw new Error("B3_PROPERTY_WRITE_FINISHED_BEFORE_GATE"); }),
      ]);
      expect(gate.observations.isolation).toBe("read committed");
      await changeOrg(
        h.migration,
        s.orgA,
        "UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() " +
          "WHERE org_id=$1 AND user_id=$2 AND status='ACTIVE'",
        [s.orgA, s.adminA.userId],
      );
      gate.release();
      const result = await outcome;
      expect(result.value).toBeNull();
      expect(result.error).toMatchObject({ code: "NOT_FOUND" });
      expect(await countByReference(h, s.orgA, reference)).toBe(0);
    } finally {
      gate.release();
      try { await drain; } finally { gate.restore(); await db.close(); }
    }
  }, 30_000);

  it("AC22 organization suspension after guard denies the final Unit INSERT", async () => {
    const s = await seedB3Scope(h);
    const app = "b3_revoke_org_" + randomUUID().slice(0, 8);
    const db = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: app });
    const port = createBuildingRegistrationPort(db);
    const label = "Suspended before insert";
    const gate = gateB3Query({ sql: unitInsert, applicationName: app });
    let drain: Promise<void> | undefined;
    try {
      await probe(db);
      gate.arm();
      const outcome = port.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      drain = outcome.then(() => {});
      await Promise.race([
        gate.reached,
        outcome.then(() => { throw new Error("B3_UNIT_WRITE_FINISHED_BEFORE_GATE"); }),
      ]);
      expect(gate.observations.isolation).toBe("read committed");
      await changeOrg(h.migration, s.orgA, "UPDATE app.organization SET status='SUSPENDED' WHERE id=$1", [s.orgA]);
      gate.release();
      const result = await outcome;
      expect(result.value).toBeNull();
      expect(result.error).toMatchObject({ code: "NOT_FOUND" });
      expect(await countUnitLabel(h, s.orgA, s.propertyA, label)).toBe(0);
    } finally {
      gate.release();
      try { await drain; } finally { gate.restore(); await db.close(); }
    }
  }, 30_000);

  it("AC22 role change to visible PROPERTY_STAFF before INSERT becomes FORBIDDEN", async () => {
    const s = await seedB3Scope(h);
    const app = "b3_revoke_role_" + randomUUID().slice(0, 8);
    const db = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: app });
    const port = createBuildingRegistrationPort(db);
    const reference = "synthetic-role-revoke";
    const gate = gateB3Query({ sql: propertyInsert, applicationName: app });
    let drain: Promise<void> | undefined;
    try {
      await probe(db);
      gate.arm();
      const outcome = port.createProperty(s.adminA.digest, s.orgA, { addressReference: reference })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      drain = outcome.then(() => {});
      await Promise.race([
        gate.reached,
        outcome.then(() => { throw new Error("B3_ROLE_WRITE_FINISHED_BEFORE_GATE"); }),
      ]);
      await changeOrg(
        h.migration,
        s.orgA,
        "UPDATE app.organization_membership SET role='PROPERTY_STAFF' WHERE org_id=$1 AND user_id=$2 AND status='ACTIVE'",
        [s.orgA, s.adminA.userId],
      );
      gate.release();
      const result = await outcome;
      expect(result.value).toBeNull();
      expect(result.error).toMatchObject({ code: "FORBIDDEN" });
      expect(await countByReference(h, s.orgA, reference)).toBe(0);
    } finally {
      gate.release();
      try { await drain; } finally { gate.restore(); await db.close(); }
    }
  }, 30_000);

  it("AC22 assigned staff read is denied when assignment ends before the final Unit SELECT", async () => {
    const s = await seedB3Scope(h);
    const unitId = randomUUID();
    await changeOrg(
      h.migration,
      s.orgA,
      "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'Revoked read','ACTIVE')",
      [unitId, s.orgA, s.propertyA],
    );
    const app = "b3_revoke_read_" + randomUUID().slice(0, 8);
    const db = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: app });
    const reader = createUnitReadPort(db);
    const gate = gateB3Query({ sql: unitSelect, applicationName: app });
    let drain: Promise<void> | undefined;
    try {
      await probe(db);
      gate.arm();
      const outcome = reader.getUnit(s.staffA.digest, s.orgA, s.propertyA, unitId)
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      drain = outcome.then(() => {});
      await Promise.race([
        gate.reached,
        outcome.then(() => { throw new Error("B3_UNIT_READ_FINISHED_BEFORE_GATE"); }),
      ]);
      await changeOrg(
        h.migration,
        s.orgA,
        "UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",
        [s.assignmentA],
      );
      gate.release();
      const result = await outcome;
      expect(result.value).toBeNull();
      expect(result.error).toMatchObject({ code: "NOT_FOUND" });
    } finally {
      gate.release();
      try { await drain; } finally { gate.restore(); await db.close(); }
    }
  }, 30_000);

  it("AC22 permits a pre-revocation readback to commit as an overlapping operation", async () => {
    const s = await seedB3Scope(h);
    const app = "b3_overlap_" + randomUUID().slice(0, 8);
    const db = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: app });
    const port = createBuildingRegistrationPort(db);
    const reference = "synthetic-overlap";
    const gate = gateB3Query({ sql: propertyReadback, applicationName: app, timing: "after" });
    let drain: Promise<void> | undefined;
    try {
      await probe(db);
      gate.arm();
      const outcome = port.createProperty(s.adminA.digest, s.orgA, { addressReference: reference })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      drain = outcome.then(() => {});
      await Promise.race([
        gate.reached,
        outcome.then(() => { throw new Error("B3_OVERLAP_FINISHED_BEFORE_GATE"); }),
      ]);
      expect(gate.observations.isolation).toBe("read committed");
      await changeOrg(
        h.migration,
        s.orgA,
        "UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() " +
          "WHERE org_id=$1 AND user_id=$2 AND status='ACTIVE'",
        [s.orgA, s.adminA.userId],
      );
      gate.release();
      const result = await outcome;
      expect(result.error).toBeNull();
      expect(result.value?.addressReference).toBe(reference);
      expect(await countByReference(h, s.orgA, reference)).toBe(1);
      await expect(port.createProperty(s.adminA.digest, s.orgA, { addressReference: reference + "-next" }))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      gate.release();
      try { await drain; } finally { gate.restore(); await db.close(); }
    }
  }, 30_000);

  it("AC15 restores max-one pool context after success, denial, conflict, invalid digest and SAVEPOINT failure", async () => {
    const s = await seedB3Scope(h);
    const reader = createUnitReadPort(h.webDb);
    let backend: number | undefined;
    const clean = () => withTransaction(h.webDb, async client => {
      const row = (await client.query<{
        pid: number;
        org_clear: boolean;
        digest_clear: boolean;
      }>(`SELECT pg_backend_pid() AS pid,
        NULLIF(current_setting('app.org_id',true),'') IS NULL AS org_clear,
        NULLIF(current_setting('app.b1_session_digest',true),'') IS NULL AS digest_clear`)).rows[0];
      expect(row.org_clear && row.digest_clear).toBe(true);
      if (backend === undefined) backend = row.pid;
      expect(row.pid).toBe(backend);
      expect((await client.query("SELECT id FROM app.property")).rowCount).toBe(0);
      expect((await client.query("SELECT id FROM app.unit")).rowCount).toBe(0);
    });

    await clean();
    await h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "Pool stable" });
    await clean();
    expect((await reader.listUnits(s.staffA.digest, s.orgA, s.propertyA, { limit: 20 })).items).toHaveLength(1);
    await clean();
    await expect(reader.listUnits(s.staffNone.digest, s.orgA, s.propertyA, { limit: 20 }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await clean();
    await expect(h.registration.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "POOL STABLE" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await clean();
    await expect(h.registration.canCreateProperty("not-hex", s.orgA))
      .rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await clean();

    await withB1OrgTransaction(h.webDb, s.adminA.digest, s.orgA, async (client: SqlClient) => {
      await client.query("SAVEPOINT b3_nested");
      await expect(client.query("SELECT 1/0")).rejects.toMatchObject({ code: "22012" });
      await client.query("ROLLBACK TO SAVEPOINT b3_nested");
      expect((await client.query("SELECT current_setting('app.org_id') AS org")).rows[0].org).toBe(s.orgA);
      expect((await client.query("SELECT current_setting('app.b1_session_digest') AS digest")).rows[0].digest)
        .toBe(s.adminA.digest);
    });
    await clean();
  }, 30_000);

  it("AC15 confirmed readback failure rolls back while unknown COMMIT may persist exactly one row", async () => {
    const s = await seedB3Scope(h);

    const rollbackApp = "b3_confirmed_rollback_" + randomUUID().slice(0, 8);
    const rollbackDb = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: rollbackApp });
    const rollbackPort = createBuildingRegistrationPort(rollbackDb);
    const rollbackRef = "synthetic-confirmed-rollback";
    const rollbackGate = gateB3Query({
      sql: propertyReadback,
      applicationName: rollbackApp,
      failure: new Error("B3_SYNTHETIC_READBACK_FAILURE"),
    });
    let rollbackDrain: Promise<void> | undefined;
    try {
      await probe(rollbackDb);
      rollbackGate.arm();
      const outcome = rollbackPort.createProperty(s.adminA.digest, s.orgA, { addressReference: rollbackRef })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      rollbackDrain = outcome.then(() => {});
      await rollbackGate.reached;
      rollbackGate.release();
      const result = await outcome;
      expect(result.value).toBeNull();
      expect(result.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
      expect(await countByReference(h, s.orgA, rollbackRef)).toBe(0);
    } finally {
      rollbackGate.release();
      try { await rollbackDrain; } finally { rollbackGate.restore(); await rollbackDb.close(); }
    }

    const commitApp = "b3_unknown_commit_" + randomUUID().slice(0, 8);
    const commitDb = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: commitApp });
    const commitPort = createBuildingRegistrationPort(commitDb);
    const commitRef = "synthetic-unknown-commit";
    const commitGate = gateB3Query({
      sql: "COMMIT",
      applicationName: commitApp,
      timing: "after",
      failure: new Error("B3_SYNTHETIC_COMMIT_CONNECTION_LOSS"),
    });
    let commitDrain: Promise<void> | undefined;
    let committedPid: number | undefined;
    try {
      await probe(commitDb);
      commitGate.arm();
      const outcome = commitPort.createProperty(s.adminA.digest, s.orgA, { addressReference: commitRef })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      commitDrain = outcome.then(() => {});
      await Promise.race([
        commitGate.reached,
        outcome.then(() => { throw new Error("B3_UNKNOWN_COMMIT_FINISHED_BEFORE_GATE"); }),
      ]);
      committedPid = commitGate.observations.backendPid;
      expect(await countByReference(h, s.orgA, commitRef)).toBe(1);
      commitGate.release();
      const result = await outcome;
      expect(result.value).toBeNull();
      expect(result.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
      expect(commitGate.observations.statementCount).toBe(1);
    } finally {
      commitGate.release();
      try { await commitDrain; } finally { commitGate.restore(); }
    }
    const replacementPid = await withTransaction(commitDb, async client =>
      (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    expect(replacementPid).not.toBe(committedPid);
    expect(await countByReference(h, s.orgA, commitRef)).toBe(1);
    await commitDb.close();
  }, 30_000);
});

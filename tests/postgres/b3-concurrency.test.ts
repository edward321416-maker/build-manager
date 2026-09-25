import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDatabase, withTransaction } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import {
  B3_POOLCLIENT_SPY_PROBE,
  createB3Harness,
  gateB3Query,
  inOrg,
  seedB3Scope,
  type B3Harness,
} from "./helpers/b3-fixture";

const unitReadback =
  "SELECT id,org_id,property_id,label FROM app.unit WHERE org_id=$1 AND property_id=$2 AND id=$3 AND status='ACTIVE' " +
  "AND authn.can_read_property($4::bytea,org_id,property_id)";

async function waitForLock(
  diagnostic: Client,
  waiterPid: number,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const row = (await diagnostic.query<{
      waiting: boolean;
      blockers: number[];
    }>(
      "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted) AS waiting," +
        "pg_blocking_pids($1) AS blockers",
      [waiterPid],
    )).rows[0];
    if (row?.waiting && row.blockers.includes(blockerPid)) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("B3_EXPECTED_SERVER_LOCK_WAIT_NOT_OBSERVED");
}

async function poolBackendPid(database: ReturnType<typeof createPostgresDatabase>): Promise<number> {
  return withTransaction(database, async client =>
    (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid);
}

async function countActiveLabel(
  h: B3Harness,
  orgId: string,
  propertyId: string,
  label: string,
): Promise<number> {
  return inOrg(h.migration, orgId, async () =>
    (await h.migration.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM app.unit " +
        "WHERE org_id=$1 AND property_id=$2 AND status='ACTIVE' AND lower(label) COLLATE \"C\"=lower($3) COLLATE \"C\"",
      [orgId, propertyId, label],
    )).rows[0].n);
}

async function establishRawWebContext(client: Client, digest: string, orgId: string): Promise<void> {
  await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  expect((await client.query("SELECT authn.current_actor($1) AS id", [Buffer.from(digest, "hex")])).rows[0]?.id).toBeTruthy();
  expect((await client.query("SELECT authn.authorize_org($1,$2) AS allowed", [Buffer.from(digest, "hex"), orgId])).rows[0]?.allowed).toBe(true);
  await client.query(
    "SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",
    [orgId, digest],
  );
}

describe("B3 concurrency boundaries", { concurrent: false }, () => {
  let h: B3Harness;
  beforeAll(async () => { h = await createB3Harness(); }, 120_000);
  afterAll(async () => { await h?.close(); });

  it("AC16 observes a real lock wait and maps the commit loser to CONFLICT", async () => {
    const s = await seedB3Scope(h);
    const suffix = randomUUID().slice(0, 8);
    const appA = "b3_lock_a_" + suffix;
    const appB = "b3_lock_b_" + suffix;
    const dbA = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: appA });
    const dbB = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: appB });
    const portA = createBuildingRegistrationPort(dbA);
    const portB = createBuildingRegistrationPort(dbB);
    const gate = gateB3Query({ sql: unitReadback, applicationName: appA });
    let aDrain: Promise<void> | undefined;
    let bDrain: Promise<void> | undefined;
    try {
      await withTransaction(dbA, client => client.query(B3_POOLCLIENT_SPY_PROBE).then(() => undefined));
      gate.arm();
      const a = portA.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "Race label" });
      const aOutcome = a.then(value => ({ value, error: null }), error => ({ value: null, error }));
      aDrain = aOutcome.then(() => {});
      await Promise.race([
        gate.reached,
        aOutcome.then(() => { throw new Error("B3_A_FINISHED_BEFORE_READBACK_GATE"); }),
      ]);
      expect(gate.observations).toMatchObject({
        sentinelCount: 1,
        statementCount: 1,
        isolation: "read committed",
        applicationName: appA,
      });
      expect(gate.observations.backendPid).toEqual(expect.any(Number));

      const bPid = await poolBackendPid(dbB);
      const b = portB.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "RACE LABEL" });
      const bOutcome = b.then(value => ({ value, error: null }), error => ({ value: null, error }));
      bDrain = bOutcome.then(() => {});
      await waitForLock(h.migration, bPid, gate.observations.backendPid!);

      gate.release();
      const aResult = await aOutcome;
      expect(aResult.error).toBeNull();
      expect(aResult.value?.label).toBe("Race label");
      const bResult = await bOutcome;
      expect(bResult.value).toBeNull();
      expect(bResult.error).toMatchObject({ code: "CONFLICT" });
      expect(await countActiveLabel(h, s.orgA, s.propertyA, "race label")).toBe(1);
    } finally {
      gate.release();
      try { await Promise.all([aDrain, bDrain].filter(Boolean) as Promise<void>[]); } finally {
        gate.restore();
        await Promise.all([dbA.close(), dbB.close()]);
      }
    }
  }, 30_000);

  it("AC16 raw control exposes SQLSTATE 23505 and unit_active_label_unique", async () => {
    const s = await seedB3Scope(h);
    const appA = "b3_raw_a_" + randomUUID().slice(0, 8);
    const appB = "b3_raw_b_" + randomUUID().slice(0, 8);
    const a = new Client({ ...h.roles.b1.webConfig, application_name: appA });
    const b = new Client({ ...h.roles.b1.webConfig, application_name: appB });
    try {
      await Promise.all([a.connect(), b.connect()]);
      await establishRawWebContext(a, s.adminA.digest, s.orgA);
      await establishRawWebContext(b, s.adminA.digest, s.orgA);
      await a.query(
        "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",
        [randomUUID(), s.orgA, s.propertyA, "Raw conflict",],
      );
      const bPid = (await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid as number;
      const bInsert = b.query(
        "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",
        [randomUUID(), s.orgA, s.propertyA, "RAW CONFLICT"],
      );
      const bOutcome = bInsert.then(() => ({ error: null }), error => ({ error }));
      const aPid = (await a.query("SELECT pg_backend_pid() AS pid")).rows[0].pid as number;
      await waitForLock(h.migration, bPid, aPid);
      await a.query("COMMIT");
      const result = await bOutcome;
      expect(result.error).toMatchObject({ code: "23505", constraint: "unit_active_label_unique" });
      await b.query("ROLLBACK");
      expect(await countActiveLabel(h, s.orgA, s.propertyA, "raw conflict")).toBe(1);
    } finally {
      await Promise.allSettled([a.query("ROLLBACK"), b.query("ROLLBACK")]);
      await Promise.all([a.end(), b.end()]);
    }
  }, 30_000);

  it("AC16 rollback winner releases the blocked insert and permits B to succeed", async () => {
    const s = await seedB3Scope(h);
    const suffix = randomUUID().slice(0, 8);
    const appA = "b3_rollback_a_" + suffix;
    const appB = "b3_rollback_b_" + suffix;
    const dbA = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: appA });
    const dbB = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1, application_name: appB });
    const portA = createBuildingRegistrationPort(dbA);
    const portB = createBuildingRegistrationPort(dbB);
    const gate = gateB3Query({
      sql: unitReadback,
      applicationName: appA,
      failure: new Error("B3_SYNTHETIC_READBACK_FAILURE"),
    });
    let aDrain: Promise<void> | undefined;
    let bDrain: Promise<void> | undefined;
    try {
      await withTransaction(dbA, client => client.query(B3_POOLCLIENT_SPY_PROBE).then(() => undefined));
      gate.arm();
      const aOutcome = portA.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "Rollback race" })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      aDrain = aOutcome.then(() => {});
      await Promise.race([
        gate.reached,
        aOutcome.then(() => { throw new Error("B3_ROLLBACK_A_FINISHED_BEFORE_GATE"); }),
      ]);

      const bPid = await poolBackendPid(dbB);
      const bOutcome = portB.createUnit(s.adminA.digest, s.orgA, s.propertyA, { label: "ROLLBACK RACE" })
        .then(value => ({ value, error: null }), error => ({ value: null, error }));
      bDrain = bOutcome.then(() => {});
      await waitForLock(h.migration, bPid, gate.observations.backendPid!);
      gate.release();

      const aResult = await aOutcome;
      expect(aResult.value).toBeNull();
      expect(aResult.error).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
      const bResult = await bOutcome;
      expect(bResult.error).toBeNull();
      expect(bResult.value?.label).toBe("ROLLBACK RACE");
      expect(await countActiveLabel(h, s.orgA, s.propertyA, "rollback race")).toBe(1);
    } finally {
      gate.release();
      try { await Promise.all([aDrain, bDrain].filter(Boolean) as Promise<void>[]); } finally {
        gate.restore();
        await Promise.all([dbA.close(), dbB.close()]);
      }
    }
  }, 30_000);
});

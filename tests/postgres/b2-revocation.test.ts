import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createPostgresDatabase, withTransaction, type SqlClient } from "@build-manager/persistence-postgres";
import { createOrganizationReadPort } from "@build-manager/persistence-postgres/b1";
import { withB1OrgTransaction } from "../../packages/persistence-postgres/src/b1/org-transaction";
import { barrier, changeOrg, createB2Harness, gateNextPropertySelect, seedB2Scope, type B2Harness } from "./helpers/b2-fixture";

let h: B2Harness;
beforeAll(async () => { h = await createB2Harness(); }, 120_000);
afterAll(async () => { await h?.close(); });
const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id);

test("AC11 adapterReadCommittedAfterGuard", async () => {
  const s = await seedB2Scope(h);
  const webDb = createPostgresDatabase({ ...h.roles.b1.webConfig, max: 1,
    options: "-c default_transaction_isolation=repeatable\\ read" });
  const reader = createOrganizationReadPort(webDb);
  const writer = new Client(h.roles.migrationConfig);
  try {
    await writer.connect();
    const gate = gateNextPropertySelect(s.orgA);
    let drain: Promise<void> | undefined;
    try {
      await withTransaction(webDb, async c => { await c.query("SELECT 1 /* B2_POOLCLIENT_SPY_PROBE */"); });
      expect(gate.observations.sentinelCount).toBe(1);
      gate.arm();
      const outcome = reader.getProperty(s.staffA.digest, s.orgA, s.propertyA).then(
        () => ({ denied: false, code: null }), error => ({ denied: true, code: error?.code ?? null }));
      drain = outcome.then(() => {});
      await Promise.race([gate.reached, outcome.then(() => { throw new Error("B2_READER_FINISHED_BEFORE_GATE"); })]);
      await changeOrg(writer, s.orgA,
        "UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [s.assignmentA]);
      gate.release();
      expect.soft(await outcome).toEqual({ denied: true, code: "NOT_FOUND" });
      expect(gate.observations).toEqual({ sentinelCount: 1, finalSelectCount: 1,
        isolation: "read committed", rowCount: 0 });
    } finally {
      gate.release();
      try { await drain; } finally { gate.restore(); }
    }
  } finally { await writer.end(); await webDb.close(); }
}, 30_000);

test("AC11 rawSelectAfterGuard", async () => {
  const s = await seedB2Scope(h);
  const a = new Client(h.roles.b1.webConfig), b = new Client(h.roles.migrationConfig);
  const gate = barrier();
  let drain: Promise<void> | undefined;
  try {
    await Promise.all([a.connect(), b.connect()]);
    const read = (async () => {
      await a.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      try {
        expect((await a.query("SHOW transaction_isolation")).rows[0].transaction_isolation).toBe("read committed");
        expect((await a.query("SELECT authn.authorize_org($1,$2) AS ok", [Buffer.from(s.staffA.digest, "hex"), s.orgA])).rows[0].ok).toBe(true);
        await a.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)", [s.orgA, s.staffA.digest]);
        gate.arrive();
        await gate.released;
        return (await a.query("SELECT id FROM app.property WHERE org_id=$1 AND id=$2", [s.orgA, s.propertyA])).rows;
      } finally { await a.query("ROLLBACK"); }
    })();
    const outcome = read.then(rows => ({ rows, error: null }), error => ({ rows: null, error }));
    drain = outcome.then(() => {});
    await Promise.race([gate.reached, outcome.then(() => { throw new Error("B2_RAW_READER_FINISHED_BEFORE_GATE"); })]);
    await changeOrg(b, s.orgA, "UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [s.assignmentA]);
    gate.release();
    const result = await outcome;
    expect(result.error === null).toBe(true);
    expect(result.rows?.length).toBe(0);
  } finally {
    gate.release();
    try { await drain; } finally { await Promise.all([a.end(), b.end()]); }
  }
}, 30_000);

test("AC05 endedAssignmentKeepsContext", async () => {
  const s = await seedB2Scope(h);
  expect((await h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyA)).id === s.propertyA).toBe(true);
  await changeOrg(h.migration, s.orgA, "UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [s.assignmentA]);
  expect(ids((await h.reader.listMine(s.staffA.digest, { limit: 50 })).items).includes(s.orgA)).toBe(true);
  const page = await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50 });
  expect(page.items.length === 1 && page.items[0].id === s.propertyC).toBe(true);
  await expect(h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect((await h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyC)).id === s.propertyC).toBe(true);
});

test("AC06 endedMembershipDeniesBoth", async () => {
  const s = await seedB2Scope(h);
  expect(ids((await h.reader.listMine(s.staffA.digest, { limit: 50 })).items).includes(s.orgA)).toBe(true);
  await h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyA);
  await changeOrg(h.migration, s.orgA, "UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1", [s.staffMembership]);
  expect((await h.reader.listMine(s.staffA.digest, { limit: 50 })).items).toHaveLength(0);
  await expect(h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await changeOrg(h.migration, s.orgA,
    "INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')",
    [randomUUID(), s.orgA, s.staffA.userId]);
  expect(ids((await h.reader.listMine(s.staffA.digest, { limit: 50 })).items).includes(s.orgA)).toBe(true);
  expect(await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50 })).toEqual({ items: [], nextCursor: null });
  for (const id of [s.propertyA, s.propertyC])
    await expect(h.reader.getProperty(s.staffA.digest, s.orgA, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test.each(["SUSPENDED", "ARCHIVED", "PENDING"])("AC07 inactiveOrganizationDeniesBoth %s", async status => {
  const s = await seedB2Scope(h);
  expect(ids((await h.reader.listMine(s.staffA.digest, { limit: 50 })).items).includes(s.orgA)).toBe(true);
  await h.reader.getProperty(s.staffA.digest, s.orgA, s.propertyA);
  await changeOrg(h.migration, s.orgA, "UPDATE app.organization SET status=$1 WHERE id=$2", [status, s.orgA]);
  for (const actor of [s.staffA, s.adminA]) {
    expect((await h.reader.listMine(actor.digest, { limit: 50 })).items).toHaveLength(0);
    await expect(h.reader.listProperties(actor.digest, s.orgA, { limit: 50 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.reader.getProperty(actor.digest, s.orgA, s.propertyA)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});

test("AC12 maxOnePoolContextRestoration", async () => {
  const s = await seedB2Scope(h);
  let backend: number | undefined;
  const assertBoundary = async (c: SqlClient) => {
    const row = (await c.query(`SELECT pg_backend_pid() AS pid,
      NULLIF(current_setting('app.org_id',true),'') IS NULL AS org_clear,
      NULLIF(current_setting('app.b1_session_digest',true),'') IS NULL AS digest_clear`)).rows[0];
    expect(row.org_clear && row.digest_clear).toBe(true);
    if (backend === undefined) backend = row.pid;
    expect(row.pid === backend).toBe(true);
  };
  const clean = () => withTransaction(h.webDb, async c => {
    await assertBoundary(c);
    expect((await c.query("SELECT id FROM app.property")).rowCount).toBe(0);
  });
  const scoped = async () => {
    await clean();
    const staff = await h.reader.listProperties(s.staffA.digest, s.orgA, { limit: 50 });
    expect(JSON.stringify(ids(staff.items)) === JSON.stringify([s.propertyA, s.propertyC])).toBe(true);
    await clean();
    const admin = await h.reader.listProperties(s.adminB.digest, s.orgB, { limit: 50 });
    expect(admin.items.length === 1 && admin.items[0].id === s.foreignProperty).toBe(true);
    await clean();
  };
  await scoped();
  for (const invalid of [undefined, "", "not-hex", "a", "ab".repeat(31)]) {
    await withTransaction(h.webDb, async c => {
      await assertBoundary(c);
      await c.query("SELECT set_config('app.org_id',$1,true)", [s.orgA]);
      if (invalid !== undefined) await c.query("SELECT set_config('app.b1_session_digest',$1,true)", [invalid]);
      expect((await c.query("SELECT authn.context_session_digest() IS NULL AS missing")).rows[0].missing).toBe(true);
      expect((await c.query("SELECT id FROM app.property")).rowCount).toBe(0);
    });
    await clean();
  }
  await expect(withTransaction(h.webDb, async c => {
    await assertBoundary(c);
    await c.query("SELECT set_config('app.org_id','not-a-uuid',true),set_config('app.b1_session_digest',$1,true)", [s.staffA.digest]);
    await c.query("SELECT app.current_org_id()");
  })).rejects.toMatchObject({ code: "22P02" });
  await clean();

  await withB1OrgTransaction(h.webDb, s.adminB.digest, s.orgB, async c => {
    const restored = async () => {
      const row = (await c.query(`SELECT current_setting('app.org_id',true)=$1 AS same_org,
        current_setting('app.b1_session_digest',true)=$2 AS same_digest,pg_backend_pid() AS pid`, [s.orgB, s.adminB.digest])).rows[0];
      expect(row.same_org && row.same_digest && row.pid === backend).toBe(true);
      const rows = (await c.query("SELECT id FROM app.property")).rows;
      expect(rows.length === 1 && rows[0].id === s.foreignProperty).toBe(true);
    };
    const staffProof = Buffer.from(s.staffA.digest, "hex");
    const discovery = await c.query("SELECT * FROM authn.list_my_organizations($1,NULL,50)", [staffProof]);
    expect(discovery.rows.length === 1 && discovery.rows[0].id === s.orgA).toBe(true);
    await restored();
    expect((await c.query("SELECT authn.can_access_org_context($1,$2) AS ok", [staffProof, s.orgA])).rows[0].ok).toBe(true);
    await restored();
    await c.query("SAVEPOINT invalid_limit");
    await expect(c.query("SELECT * FROM authn.list_my_organizations($1,NULL,0)", [staffProof])).rejects.toMatchObject({ code: "22023" });
    await c.query("ROLLBACK TO SAVEPOINT invalid_limit");
    await restored();
    await c.query("SAVEPOINT invalid_session");
    await expect(c.query("SELECT * FROM authn.list_my_organizations($1,NULL,50)", [Buffer.alloc(32)])).rejects.toMatchObject({ code: "28000" });
    await c.query("ROLLBACK TO SAVEPOINT invalid_session");
    await restored();
    expect((await c.query("SELECT authn.can_access_org_context($1,$2) AS ok", [Buffer.alloc(32), s.orgA])).rows[0].ok).toBe(false);
    await restored();
    await c.query("SAVEPOINT bound_failure");
    await c.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)", [s.orgA, s.staffA.digest]);
    await expect(c.query("SELECT 1/0")).rejects.toMatchObject({ code: "22012" });
    await c.query("ROLLBACK TO SAVEPOINT bound_failure");
    await restored();
  });
  await clean();
  await expect(withB1OrgTransaction(h.webDb, s.staffA.digest, s.orgA, async () => {
    throw new Error("SYNTHETIC_ROLLBACK");
  })).rejects.toThrow("SYNTHETIC_ROLLBACK");
  await scoped();
});

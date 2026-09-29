import { randomUUID } from "node:crypto";
import { Client, type QueryResult } from "pg";
import { vi } from "vitest";
import { createPropertyAssignmentMutationPort } from "@build-manager/persistence-postgres/b4";
import { barrier, changeOrg, createB2Harness, seedB2Scope, type B2Harness } from "./b2-fixture";

export async function createB4Harness() {
  const h = await createB2Harness();
  return { ...h, assignments: createPropertyAssignmentMutationPort(h.webDb) };
}
export type B4Harness = Awaited<ReturnType<typeof createB4Harness>>;
export async function seedB4Scope(h: B2Harness) {
  const s = await seedB2Scope(h);
  const adminMembership = (await h.p.admin.query("SELECT id FROM app.organization_membership WHERE org_id=$1 AND user_id=$2", [s.orgA,s.adminA.userId])).rows[0].id as string;
  const foreignStaffMembership = randomUUID();
  await changeOrg(h.migration,s.orgB,"INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')",[foreignStaffMembership,s.orgB,s.staffA.userId]);
  return { ...s, adminMembership, foreignStaffMembership };
}
export type B4Scope = Awaited<ReturnType<typeof seedB4Scope>>;
export async function assignmentHistory(h: B2Harness, org: string, property?: string, membership?: string) {
  await h.migration.query("BEGIN");
  try {
    await h.migration.query("SELECT set_config('app.org_id',$1,true)",[org]);
    return (await h.migration.query<{ id: string; status: string; ended_at: Date | null; bytes: string }>(
      `SELECT a.id,a.status,a.ended_at,row_to_json(a)::text AS bytes FROM app.property_assignment a
       WHERE a.org_id=$1 AND ($2::uuid IS NULL OR a.property_id=$2) AND ($3::uuid IS NULL OR a.membership_id=$3) ORDER BY a.id`,
      [org,property ?? null,membership ?? null])).rows;
  } finally { await h.migration.query("ROLLBACK"); }
}

export const B4_PROBE = "SELECT 1 /* B4_POOLCLIENT_SPY_PROBE */";
export function gateB4Query(options: { sql: string; applicationName: string; timing: "before" | "after"; failure?: Error }) {
  const latch = barrier();
  const observations = { sentinelCount: 0, statementCount: 0, mutationCount: 0, rollbackCount: 0,
    backendPid: undefined as number | undefined, isolation: undefined as string | undefined };
  const original = Client.prototype.query;
  let armed = false;
  let observedClient: Client | undefined;
  const spy = vi.spyOn(Client.prototype,"query").mockImplementation(function(this: Client,...args: unknown[]) {
    const forward = () => Reflect.apply(original,this,args);
    if (args[0] === B4_PROBE) observations.sentinelCount++;
    if (this === observedClient && args[0] === "ROLLBACK") observations.rollbackCount++;
    const mutation = typeof args[0] === "string" && /authn\.b4_(ensure|end)_property_staff_assignment/.test(args[0]);
    if ((!mutation && (!armed || args[0] !== options.sql)) || args.length > 2) return forward();
    return (async () => {
      const app = await Reflect.apply(original,this,["SHOW application_name"]) as QueryResult;
      if (app.rows[0]?.application_name !== options.applicationName) return forward();
      observedClient = this;
      if (mutation) observations.mutationCount++;
      if (!armed || args[0] !== options.sql) return forward();
      armed = false;
      observations.statementCount++;
      observations.backendPid = (await Reflect.apply(original,this,["SELECT pg_backend_pid() AS pid"]) as QueryResult).rows[0].pid;
      observations.isolation = (await Reflect.apply(original,this,["SHOW transaction_isolation"]) as QueryResult).rows[0].transaction_isolation;
      if (options.timing === "before") {
        latch.arrive(); await latch.released;
        if (options.failure) throw options.failure;
        return forward();
      }
      const result = await forward();
      latch.arrive(); await latch.released;
      if (options.failure) throw options.failure;
      return result;
    })();
  } as typeof Client.prototype.query);
  return { observations, reached: latch.reached, release: latch.release,
    arm() { if (observations.sentinelCount !== 1) throw new Error("B4_POOLCLIENT_SPY_NOT_OBSERVED"); armed = true; },
    restore() { latch.release(); spy.mockRestore(); },
  };
}

export async function waitB4Lock(client: Client, waiter: number, blocker: number): Promise<void> {
  const deadline = Date.now()+5000;
  while (Date.now()<deadline) {
    const row = (await client.query("SELECT pg_blocking_pids($1) AS blockers,EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted) AS waiting",[waiter])).rows[0];
    if (row.waiting && row.blockers.includes(blocker)) return;
    await new Promise(resolve => setTimeout(resolve,25));
  }
  throw new Error("B4_DATABASE_CONTENTION_NOT_OBSERVED");
}

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { PoolClient, QueryResult } from "pg";
import { vi } from "vitest";
import { getInternalPool } from "../../../packages/persistence-postgres/src/database";
import { createOrganizationMembershipTerminationPort } from "@build-manager/persistence-postgres/b5";
import { createB4Harness, seedB4Scope, waitB4Lock } from "./b4-fixture";
import { changeOrg } from "./b2-fixture";

export async function createB5Harness() {
  const h = await createB4Harness();
  return { ...h, memberships: createOrganizationMembershipTerminationPort(h.webDb) };
}
export type B5Harness = Awaited<ReturnType<typeof createB5Harness>>;
export async function seedB5Scope(h: B5Harness, admins = 2) {
  const s = await seedB4Scope(h);
  const secondMembership = randomUUID(), thirdMembership = randomUUID();
  for (const [id, actor] of ([[secondMembership,s.adminB],[thirdMembership,s.noMember]] as const).slice(0,admins-1)) {
    await changeOrg(h.migration,s.orgA,"INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[id,s.orgA,actor.userId]);
  }
  return { ...s, secondMembership, thirdMembership };
}
export async function membershipRows(h: B5Harness, org: string) {
  return (await h.p.admin.query<{ id: string; status: string; version: number; ended_at: Date | null; bytes: string }>(
    "SELECT id,status,version,ended_at,row_to_json(m)::text AS bytes FROM app.organization_membership m WHERE org_id=$1 ORDER BY id",[org])).rows;
}
export async function effectiveCount(h: B5Harness, org: string): Promise<number> {
  return Number((await h.p.admin.query("SELECT count(*) FROM app.organization_membership m JOIN app.app_user u ON u.id=m.user_id WHERE m.org_id=$1 AND m.status='ACTIVE' AND m.role='ORG_ADMIN' AND u.status='ACTIVE'",[org])).rows[0].count);
}
export const B5_COMMAND = "SELECT authn.b5_end_organization_membership($1::bytea,$2::uuid,$3::uuid) AS state";

/** Real Web-role SQL semantic evidence; intentionally not the production timeout wrapper. */
export async function directB5(h: B5Harness, digest: string, org: string) {
  const client = new Client(h.roles.b1.webConfig);
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  await client.query("SELECT authn.current_actor($1),authn.authorize_org($1,$2)",[Buffer.from(digest,"hex"),org]);
  await client.query("SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)",[org,digest]);
  const pid = Number((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  const isolation = (await client.query("SHOW transaction_isolation")).rows[0].transaction_isolation;
  const watchdog = setTimeout(() => { void client.end(); },15_000);
  return { client,pid,isolation,
    async end(target: string): Promise<string> { return (await client.query(B5_COMMAND,[Buffer.from(digest,"hex"),org,target])).rows[0].state; },
    async commit() { await client.query("COMMIT"); },
    async close() { clearTimeout(watchdog); try { await client.query("ROLLBACK"); } finally { await client.end(); } },
  };
}
export async function observeB5Wait(h: B5Harness, waiter: number, blocker: number) {
  await waitB4Lock(h.p.admin,waiter,blocker);
  const row = (await h.p.admin.query("SELECT state,wait_event_type,query FROM pg_stat_activity WHERE pid=$1",[waiter])).rows[0];
  if (row.state !== "active" || row.wait_event_type !== "Lock" || !row.query.includes("b5_end_organization_membership")) throw new Error("B5_COMMAND_LOCK_NOT_OBSERVED");
  return { waiter,blocker,state: row.state,wait: row.wait_event_type };
}

export function interceptB5(h: B5Harness, hook: (sql: string, forward: () => Promise<QueryResult>, query: (sql: string) => Promise<QueryResult>) => Promise<QueryResult>) {
  const pool=getInternalPool(h.webDb), connect=pool.connect.bind(pool);
  const observations={ commands:0,commits:0,rollbacks:0,releases:0,destroyed:0,codes:[] as string[] };
  let ready!: (pid: number) => void;
  const pid=new Promise<number>(resolve=>{ ready=resolve; });
  const spy=vi.spyOn(pool,"connect").mockImplementationOnce((async()=>{
    const client=await connect(), original=client.query, release=client.release.bind(client);
    const query=(sql: string) => Reflect.apply(original,client,[sql]) as Promise<QueryResult>;
    ready(Number((await query("SELECT pg_backend_pid() AS pid")).rows[0].pid));
    client.query=(async (...args: unknown[])=>{
      const sql=String(args[0]);
      if (sql.includes("authn.b5_end_organization_membership")) observations.commands++;
      if (sql === "COMMIT") observations.commits++;
      if (sql === "ROLLBACK") observations.rollbacks++;
      try { return await hook(sql,()=>Reflect.apply(original,client,args),query); }
      catch (error) {
        if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)) observations.codes.push(error.code);
        throw error;
      }
    }) as PoolClient["query"];
    client.release=(destroy?: boolean | Error)=>{
      observations.releases++; if(destroy)observations.destroyed++;
      client.query=original; release(destroy);
    };
    return client;
  }) as typeof pool.connect);
  return { observations,pid,restore() { spy.mockRestore(); } };
}

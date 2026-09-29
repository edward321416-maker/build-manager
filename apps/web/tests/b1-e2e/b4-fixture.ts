import { randomUUID } from "node:crypto";
import type { Client,QueryResultRow } from "pg";
import type { Browser,BrowserContext } from "@playwright/test";
import { fixtureSession,baseURL } from "./fixture-session";
import { fixtureB3Session,type B3WebFixture } from "./b3-fixture";

export type B4StaffFixture = { context: BrowserContext; csrf: string; membershipId: string; userId: string; close(): Promise<void> };
export async function createB4StaffSession(browser: Browser,adminFixture: B3WebFixture): Promise<B4StaffFixture> {
  const session = await fixtureSession(browser,"NONE");
  try {
    if (!session.userId) throw new Error("B4_SYNTHETIC_STAFF_REQUIRED");
    const membershipId = randomUUID();
    await adminFixture.change("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')",[membershipId,adminFixture.orgId,session.userId]);
    return { context: session.context,csrf: session.csrf,membershipId,userId: session.userId,close: session.close };
  } catch (error) { await session.close(); throw error; }
}
async function scopedQuery<T extends QueryResultRow>(client: Client,org: string,sql: string,args: unknown[]) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.org_id',$1,true)",[org]);
    const result = await client.query<T>(sql,args);
    await client.query("COMMIT"); return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
export async function createB4Fixture(browser: Browser) {
  const f = await fixtureB3Session(browser);
  let staff: B4StaffFixture | undefined;
  try {
    staff = await createB4StaffSession(browser,f);
    const boundary = async (inactive: boolean) => {
      const tuple = { orgId: randomUUID(),propertyId: randomUUID(),membershipId: randomUUID() };
      const query = (sql: string,args: unknown[]) => scopedQuery(f.migration,tuple.orgId,sql,args);
      await query("INSERT INTO app.organization(id,status,display_name) VALUES($1,$2,'Synthetic boundary')",[tuple.orgId,inactive ? "SUSPENDED" : "ACTIVE"]);
      await query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[tuple.propertyId,tuple.orgId]);
      await query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')",[tuple.membershipId,tuple.orgId,staff!.userId]);
      if (inactive) await query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')",[tuple.orgId,f.userId]);
      for (const status of ["ENDED","ACTIVE"]) await query("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status,ended_at) VALUES($1,$2,$3,$4,CASE WHEN $4='ENDED' THEN clock_timestamp() ELSE NULL END)",[tuple.orgId,tuple.membershipId,tuple.propertyId,status]);
      // Pin the boundary's valid downstream tuple, so denial isolates org access/status.
      const proof = await query(`SELECT o.status AS org_status,p.status AS property_status,m.status AS membership_status,m.role,
        EXISTS(SELECT 1 FROM app.organization_membership a WHERE a.org_id=o.id AND a.user_id=$4 AND a.role='ORG_ADMIN' AND a.status='ACTIVE') AS caller_admin
        FROM app.organization o JOIN app.property p ON p.org_id=o.id JOIN app.organization_membership m ON m.org_id=o.id
        WHERE o.id=$1 AND p.id=$2 AND m.id=$3`,[tuple.orgId,tuple.propertyId,tuple.membershipId,f.userId]);
      const row = proof.rows[0];
      if (proof.rowCount !== 1 || row.property_status !== "ACTIVE" || row.membership_status !== "ACTIVE" || row.role !== "PROPERTY_STAFF" || row.org_status !== (inactive ? "SUSPENDED" : "ACTIVE") || row.caller_admin !== inactive) throw new Error("B4_BOUNDARY_FIXTURE_INVALID");
      return tuple;
    };
    const foreign = await boundary(false),inactive = await boundary(true),target = staff;
    return { ...f,staff: target,foreign,inactive,async close() { try { await target.close(); } finally { await f.close(); } } };
  } catch (error) { await staff?.close(); await f.close(); throw error; }
}
export function assignmentPath(f: { orgId: string; propertyId: string },membershipId: string,propertyId = f.propertyId,orgId = f.orgId) {
  return `/api/v2/organizations/${orgId}/properties/${propertyId}/staff-assignments/${membershipId}`;
}
export async function assignmentSnapshot(f: B3WebFixture,orgId = f.orgId) {
  return (await scopedQuery<{ id: string; status: string; ended_at: Date | null; bytes: string }>(f.migration,orgId,
    "SELECT a.id,a.status,a.ended_at,row_to_json(a)::text AS bytes FROM app.property_assignment a WHERE org_id=$1 ORDER BY id",[orgId])).rows;
}
export function b4Mutation(f: { context: BrowserContext; csrf: string },method: "PUT" | "DELETE",path: string) {
  return f.context.request.fetch(path,{ method,headers: { origin: baseURL,"x-b1-csrf": f.csrf } });
}

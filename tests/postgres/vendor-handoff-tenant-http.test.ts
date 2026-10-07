import { afterAll,beforeAll,expect,it } from "vitest";
import { createHash,randomUUID } from "node:crypto";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort,createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createVendorHandoffManagerPort,createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import type { VendorHandoffTenantPort } from "@build-manager/application";
import type { ManagerVendorHandoffDto,TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { handleCoreFlow } from "../../apps/web/src/server/core-flow/http";
import type { CoreHTTPDependencies } from "../../apps/web/src/server/core-flow/container";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
beforeAll(async()=>{
  f=await createVendorHandoffFixture();
  // The orgB Tenant also occupies an unrelated orgA unit: a real multi-organization Tenant whose selection must bind every call.
  const occupancy=(await f.p.admin.query("SELECT id FROM app.occupancy WHERE org_id=$1 AND unit_id=$2 AND status='ACTIVE'",[f.data.orgA,f.data.unitOther])).rows[0].id as string;
  await f.p.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[f.data.orgA,occupancy,f.data.accounts.otherTenant.userId]);
});
afterAll(async()=>{await f?.close();});
const origin="http://127.0.0.1:3130";
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const hash=(label:string)=>sha(label+randomUUID());
const at=(hours:number)=>new Date(Date.now()+hours*3_600_000).toISOString();
type Database=ReturnType<typeof createPostgresDatabase>;
function dependencies(database:Database,who:string,wrap=(port:VendorHandoffTenantPort,_org:string)=>port):CoreHTTPDependencies{
  return {port:createCoreFlowPort(database),revoke:async()=>{},origins:[origin],
    vendorHandoff:{inOrganization:(org:string)=>createVendorHandoffManagerPort(database,org),tenantInOrganization:(org:string)=>wrap(createVendorHandoffTenantPort(database,org),org)},
    b1:{current:async()=>({digest:f.data.accounts[who].digest,csrf:"synthetic-proof"}),access:createCoreAccessPort(database)}} as unknown as CoreHTTPDependencies;
}
function call(d:CoreHTTPDependencies,org:string,path:string,body?:unknown){
  return handleCoreFlow(new Request(`${origin}/api/v2/core/${path}`,{method:body===undefined?"GET":"POST",
    headers:{Origin:origin,"X-Core-Organization":org,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),()=>d);
}
/** An ACTIVE orgB assignment for the orgB Tenant's ticket, accepted through the real Vendor boundary. */
async function acceptedInB(){
  // B1 selection persists the session's current organization (frozen 0013); fixture ticket creation follows it, so select orgB first.
  await createCoreAccessPort(f.managerDatabase).inOrganization(f.data.orgB).run(f.data.accounts.otherTenant.digest,async()=>undefined);
  const p=await f.published("otherManager","otherTenant");
  const assignmentId=p.handoff.assignment!.id,packetId=p.handoff.currentPacket!.id;
  const link=await f.manager.issueLink(f.data.accounts.otherManager.digest,assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:packetId});
  const session=hash("session"),csrf=hash("csrf"),vendor=f.externalWith(csrf);
  await f.external.redeem(sha(link.link!.split("#")[1]),randomUUID(),session,csrf);
  await vendor.accept(session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId});
  return {ticketId:p.t.ticket.id,assignmentId,packetId,session,vendor,path:`tickets/${p.t.ticket.id}/vendor-scheduling`};
}
const guards=(s:TenantVendorSchedulingDto)=>({expectedAssignmentVersion:s.assignmentVersion,expectedRoundVersion:s.currentRound!.version,expectedPacketRevisionId:s.packetRevisionId});
async function priorA(database:Database){
  expect(await createCoreAccessPort(database).inOrganization(f.data.orgA).run(f.data.accounts.otherTenant.digest,s=>Promise.resolve(s.session.role))).toBe("TENANT");
}

it("schedules a selected-organization Visit end to end after a prior other-organization binding on one pool slot",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:1,connectionTimeoutMillis:500});
  try{
    const c=await acceptedInB();await priorA(database);
    const tenant=dependencies(database,"otherTenant");
    const first=await call(tenant,f.data.orgB,c.path);
    expect(first.status).toBe(200);
    const read=await first.json() as TenantVendorSchedulingDto;
    expect(read).toMatchObject({ticketId:c.ticketId,phase:"SCHEDULING",waitingOn:"TENANT",availability:null});
    const submitted=await call(tenant,f.data.orgB,`${c.path}/availability`,{clientRequestId:randomUUID(),...guards(read),windows:[{startAt:at(24),endAt:at(28)}]});
    expect(submitted.status).toBe(200);
    const withAvailability=await submitted.json() as TenantVendorSchedulingDto;
    expect(withAvailability.availability?.windows).toHaveLength(1);
    const job=await c.vendor.proposeSlots(c.session,{clientRequestId:randomUUID(),...guards(withAvailability),slots:[{startAt:at(25),endAt:at(26)}]});
    const current=await (await call(tenant,f.data.orgB,c.path)).json() as TenantVendorSchedulingDto;
    const confirmed=await call(tenant,f.data.orgB,`${c.path}/confirm`,{clientRequestId:randomUUID(),...guards(current),proposalId:job.proposal!.id,selectedSlotId:job.proposal!.slots[0].id});
    expect(confirmed.status).toBe(200);
    const appointment=(await confirmed.json() as TenantVendorSchedulingDto).appointment!;
    expect(appointment).toMatchObject({status:"SCHEDULED",confirmationMode:"TENANT_CONFIRMED"});
    const manager=dependencies(database,"otherManager");
    const handoff=await (await call(manager,f.data.orgB,`manager/tickets/${c.ticketId}/vendor-handoff`)).json() as ManagerVendorHandoffDto;
    const rescheduled=await call(manager,f.data.orgB,`manager/vendor-assignments/${c.assignmentId}/reschedule`,{clientRequestId:randomUUID(),
      expectedAssignmentVersion:handoff.assignment!.version,expectedRoundVersion:handoff.currentRound!.version,expectedAppointmentId:appointment.id,expectedPacketRevisionId:c.packetId});
    expect(rescheduled.status).toBe(200);
    expect(await rescheduled.json()).toMatchObject({phase:"SCHEDULING",currentRound:{purpose:"RESCHEDULE",status:"OPEN"},appointment:null});
  }finally{await database.close();}
});
it("never reaches an organization B ticket through the same Tenant's organization A selection",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:3});
  try{
    const c=await acceptedInB();
    const tenant=dependencies(database,"otherTenant");
    expect((await call(tenant,f.data.orgA,c.path)).status).toBe(404);
    const read=await (await call(tenant,f.data.orgB,c.path)).json() as TenantVendorSchedulingDto;
    expect((await call(tenant,f.data.orgA,`${c.path}/availability`,{clientRequestId:randomUUID(),...guards(read),windows:[{startAt:at(24),endAt:at(28)}]})).status).toBe(404);
    const rows=await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.tenant_availability_submission WHERE assignment_id=$1",[c.assignmentId]);
    expect(rows.rows[0].n).toBe(0);
  }finally{await database.close();}
});
it("refuses Tenant scheduling routes to a Manager session",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:3});
  try{
    const c=await acceptedInB();
    expect((await call(dependencies(database,"otherManager"),f.data.orgB,c.path)).status).toBe(403);
  }finally{await database.close();}
});
// Last on purpose: it ends the orgB Tenant occupancy for the rest of this file.
it("rejects a Tenant command whose occupancy ended after a successful Core preflight",async()=>{
  const database=createPostgresDatabase({...f.roles.b1.webConfig,max:1});
  try{
    const c=await acceptedInB();
    const read=await (await call(dependencies(database,"otherTenant"),f.data.orgB,c.path)).json() as TenantVendorSchedulingDto;
    const ended=dependencies(database,"otherTenant",port=>({...port,submitAvailability:async(...args)=>{
      await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE org_id=$1 AND user_id=$2 AND status='ACTIVE'",[f.data.orgB,f.data.accounts.otherTenant.userId]);
      return port.submitAvailability(...args);
    }}));
    expect((await call(ended,f.data.orgB,`${c.path}/availability`,{clientRequestId:randomUUID(),...guards(read),windows:[{startAt:at(24),endAt:at(28)}]})).status).toBe(403);
    const rows=await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.tenant_availability_submission WHERE assignment_id=$1",[c.assignmentId]);
    expect(rows.rows[0].n).toBe(0);
  }finally{await database.close();}
});

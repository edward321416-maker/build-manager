import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createHash,randomUUID } from "node:crypto";
import { createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { VendorJobDtoSchema,VendorTenantSchedulingDtoSchema,ManagerVendorHandoffDtoSchema } from "@build-manager/api-contracts";
import type { VendorAccessPolicy,VendorHandoffTenantPort,TenantVendorSchedulingDto } from "@build-manager/application";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
let tenantPort:VendorHandoffTenantPort;
beforeAll(async()=>{f=await createVendorHandoffFixture();tenantPort=createVendorHandoffTenantPort(f.managerDatabase);});
afterAll(async()=>{await f?.close();});

const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const hash=(label:string)=>sha(label+randomUUID());
const at=(hours:number,minutes=0)=>new Date(Date.now()+hours*3_600_000+minutes*60_000).toISOString();
const code=(promise:Promise<unknown>)=>promise.then(()=>"success",(error:{code?:string})=>error.code);
const count=async(sql:string,values:unknown[])=>(await f.p.admin.query(sql,values)).rows[0].n as number;

async function offered(policy:VendorAccessPolicy="TENANT_PRESENT_REQUIRED",who="manager",tenant="tenant"){
  const p=await f.published(who,tenant,{accessPolicy:policy});
  const assignmentId=p.handoff.assignment!.id,packetId=p.handoff.currentPacket!.id;
  const link=await f.manager.issueLink(f.data.accounts[who].digest,assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:packetId});
  const session=hash("session"),csrf=hash("csrf");
  await f.external.redeem(sha(link.link!.split("#")[1]),randomUUID(),session,csrf);
  return {p,assignmentId,packetId,session,csrf,vendor:f.externalWith(csrf),ticketId:p.t.ticket.id,
    tenantDigest:f.data.accounts[tenant].digest,managerDigest:f.data.accounts[who].digest};
}
async function accepted(policy:VendorAccessPolicy="TENANT_PRESENT_REQUIRED",who="manager",tenant="tenant"){
  const o=await offered(policy,who,tenant);
  const job=await o.vendor.accept(o.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId});
  return {...o,job};
}
type Ctx=Awaited<ReturnType<typeof accepted>>;
const read=(c:Ctx)=>tenantPort.readScheduling(c.tenantDigest,c.ticketId);
async function guards(c:Ctx){const s=await read(c);return {expectedAssignmentVersion:s.assignmentVersion,expectedRoundVersion:s.currentRound!.version,expectedPacketRevisionId:s.packetRevisionId};}
async function availability(c:Ctx,windows=[{startAt:at(24),endAt:at(28)},{startAt:at(48),endAt:at(50)}]){
  return tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),windows});
}
async function propose(c:Ctx,slots=[{startAt:at(25),endAt:at(26)},{startAt:at(49),endAt:at(50)}]){
  return c.vendor.proposeSlots(c.session,{clientRequestId:randomUUID(),...await guards(c),slots});
}
async function scheduled(c:Ctx){
  await availability(c);const job=await propose(c);
  const s=await tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),proposalId:job.proposal!.id,selectedSlotId:job.proposal!.slots[0].id});
  return s;
}
/** Throws unless a real lock wait on the source ticket is observed (no silent fall-through). */
async function waitForTicketWait(){
  for(let attempt=0;attempt<200;attempt++){
    await f.p.admin.query("SELECT pg_stat_clear_snapshot()");
    const {rows}=await f.p.admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%vendor_handoff%'");
    if(rows[0].n>0)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error("Expected real source-ticket lock wait was not observed");
}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const at_s=(seconds:number)=>new Date(Date.now()+seconds*1000).toISOString();
const rounds=(assignmentId:string)=>f.p.admin.query("SELECT purpose,status FROM vendor_handoff.scheduling_round WHERE assignment_id=$1 ORDER BY created_at,id",[assignmentId]).then(r=>r.rows);

describe("atomic Accept / Withdraw",()=>{
  it("Accept atomically creates ACTIVE plus exactly one INITIAL OPEN round and replays exactly",async()=>{
    const o=await offered();
    const input={clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId};
    const job=VendorJobDtoSchema.parse(await o.vendor.accept(o.session,input));
    expect(job).toMatchObject({status:"ACTIVE",assignmentVersion:4,phase:"SCHEDULING",waitingOn:"TENANT",effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",availability:null,proposal:null});
    expect(job.currentRound).toMatchObject({purpose:"INITIAL",status:"OPEN",version:1,openedPacketRevisionId:o.packetId});
    expect(await rounds(o.assignmentId)).toEqual([{purpose:"INITIAL",status:"OPEN"}]);
    expect(await o.vendor.accept(o.session,input)).toEqual(job);
    expect(await code(o.vendor.accept(o.session,{...input,expectedPacketRevisionId:randomUUID()}))).toBe("STATE_CONFLICT");
    expect(await code(o.vendor.accept(o.session,{...input,clientRequestId:randomUUID()}))).toBe("STATE_CONFLICT");
    expect(await rounds(o.assignmentId)).toEqual([{purpose:"INITIAL",status:"OPEN"}]);
  });
  it("concurrent Accept requests cannot create a second INITIAL OPEN round",async()=>{
    const o=await offered();
    const results=await Promise.all([1,2].map(()=>code(o.vendor.accept(o.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId}))));
    expect(results.sort()).toEqual(["STATE_CONFLICT","success"]);
    expect(await rounds(o.assignmentId)).toEqual([{purpose:"INITIAL",status:"OPEN"}]);
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status) VALUES($1,$2,$3,'INITIAL','OPEN')",[f.data.orgA,o.assignmentId,o.packetId])).rejects.toMatchObject({code:"23505"});
  });
  it("Accept rejects stale guards and a completed source ticket without side effects",async()=>{
    const o=await offered();
    expect(await code(o.vendor.accept(o.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:o.packetId}))).toBe("STATE_CONFLICT");
    await f.p.admin.query("UPDATE core_flow.ticket SET work_status='COMPLETED' WHERE id=$1",[o.ticketId]);
    expect(await code(o.vendor.accept(o.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId}))).toBe("STATE_CONFLICT");
    expect(await rounds(o.assignmentId)).toEqual([]);
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.vendor_assignment WHERE id=$1",[o.assignmentId])).rows[0].status).toBe("OFFERED");
  });
  it("Withdraw is rejected before Accept and only ends ACTIVE work while preserving history and the ticket",async()=>{
    const o=await offered();
    expect(await code(o.vendor.withdraw(o.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,operationalNote:null}))).toBe("STATE_CONFLICT");
    const second=await accepted();
    await scheduled(second);
    const ticketBefore=(await f.p.admin.query("SELECT work_status,version FROM core_flow.ticket WHERE id=$1",[second.ticketId])).rows[0];
    const input={clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:second.packetId,operationalNote:"합성 철회 메모"};
    const job=VendorJobDtoSchema.parse(await second.vendor.withdraw(second.session,input));
    expect(job).toMatchObject({status:"ENDED",endReason:"WITHDRAWN",phase:"ENDED"});
    expect(await second.vendor.withdraw(second.session,input)).toEqual(job);
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.appointment WHERE assignment_id=$1",[second.assignmentId])).rows).toEqual([{status:"CANCELLED"}]);
    expect(await rounds(second.assignmentId)).toEqual([{purpose:"INITIAL",status:"CONFIRMED"}]);
    expect((await f.p.admin.query("SELECT end_note FROM vendor_handoff.vendor_assignment WHERE id=$1",[second.assignmentId])).rows[0].end_note).toBe("합성 철회 메모");
    expect((await f.p.admin.query("SELECT work_status,version FROM core_flow.ticket WHERE id=$1",[second.ticketId])).rows[0]).toEqual(ticketBefore);
    await expect(second.vendor.readJob(second.session)).rejects.toMatchObject({code:"UNAUTHENTICATED"});
    const third=await accepted();
    await third.vendor.withdraw(third.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:third.packetId,operationalNote:null});
    expect(await rounds(third.assignmentId)).toEqual([{purpose:"INITIAL",status:"CANCELLED"}]);
    const withOccurred=await accepted();
    await scheduled(withOccurred);
    await f.p.admin.query("UPDATE vendor_handoff.appointment SET status='OCCURRED' WHERE assignment_id=$1",[withOccurred.assignmentId]);
    await withOccurred.vendor.withdraw(withOccurred.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:withOccurred.packetId,operationalNote:null});
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.appointment WHERE assignment_id=$1",[withOccurred.assignmentId])).rows).toEqual([{status:"OCCURRED"}]);
  });
});

describe("shared command prologues",()=>{
  it("Accept rechecks the Vendor session after the real source-ticket wait and creates nothing for revoked authority",async()=>{
    const o=await offered(),request=randomUUID();
    await f.p.admin.query("BEGIN");await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE",[o.ticketId]);
    const pending=code(o.vendor.accept(o.session,{clientRequestId:request,expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId}));
    try{
      await waitForTicketWait();
      await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1",[o.assignmentId]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe("UNAUTHENTICATED");
    }finally{await f.p.admin.query("ROLLBACK");}
    expect(await rounds(o.assignmentId)).toEqual([]);
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.vendor_assignment WHERE id=$1",[o.assignmentId])).rows[0].status).toBe("OFFERED");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE request_key=$1",[request])).toBe(0);
  });
  it("the Tenant adapter binds the selected organization inside the command transaction",async()=>{
    const c=await accepted();
    await expect(createVendorHandoffTenantPort(f.managerDatabase,f.data.orgB).readScheduling(c.tenantDigest,c.ticketId)).rejects.toMatchObject({code:"FORBIDDEN"});
    expect((await createVendorHandoffTenantPort(f.managerDatabase,f.data.orgA).readScheduling(c.tenantDigest,c.ticketId)).ticketId).toBe(c.ticketId);
  });
});

describe("current Tenant authority",()=>{
  it("only the current Tenant digest for the correct ticket reads and mutates scheduling",async()=>{
    const c=await accepted();
    const s=VendorTenantSchedulingDtoSchema.parse(await read(c));
    expect(s).toMatchObject({ticketId:c.ticketId,assignmentVersion:4,packetRevisionId:c.packetId,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",accessPolicy:"TENANT_PRESENT_REQUIRED",availability:null,proposal:null,phase:"SCHEDULING",waitingOn:"TENANT"});
    expect(JSON.stringify(s).includes("합성 업체")).toBe(false);
    const g=await guards(c);
    const windows=[{startAt:at(24),endAt:at(26)}];
    expect(await code(tenantPort.submitAvailability(f.data.accounts.otherTenant.digest,c.ticketId,{clientRequestId:randomUUID(),...g,windows}))).toBe("NOT_FOUND");
    expect(await code(tenantPort.submitAvailability(c.managerDigest,c.ticketId,{clientRequestId:randomUUID(),...g,windows}))).toBe("NOT_FOUND");
    expect(await code(tenantPort.readScheduling(f.data.accounts.otherTenant.digest,c.ticketId))).toBe("NOT_FOUND");
    await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[f.data.accounts.tenant.userId]);
    try{expect(await code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...g,windows}))).toBe("FORBIDDEN");}
    finally{await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE user_id=$1",[f.data.accounts.tenant.userId]);}
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.tenant_availability_submission WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    expect((await availability(c,windows)).availability!.windows).toHaveLength(1);
  });
  it("rechecks current Tenant occupancy after the real source-ticket wait",async()=>{
    const c=await accepted();const g=await guards(c);
    await f.p.admin.query("BEGIN");await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE",[c.ticketId]);
    const pending=code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...g,windows:[{startAt:at(24),endAt:at(26)}]}));
    try{
      await waitForTicketWait();
      await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[f.data.accounts.tenant.userId]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe("FORBIDDEN");
    }finally{await f.p.admin.query("ROLLBACK");await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE user_id=$1",[f.data.accounts.tenant.userId]);}
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.tenant_availability_submission WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("availability is separate from consent: default OFF and Tenant replay is exact",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    const input={clientRequestId:randomUUID(),...await guards(c),windows:[{startAt:at(24),endAt:at(28)}]};
    const s=await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,input);
    expect(s).toMatchObject({effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",waitingOn:"VENDOR"});
    expect(s.availability!.authorizedWindowIds).toEqual([]);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.tenant_entry_authorization WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    expect(await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,input)).toEqual(s);
    expect(await code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{...input,windows:[{startAt:at(30),endAt:at(31)}]}))).toBe("STATE_CONFLICT");
  });
  it("rejects invalid, past, overlapping or excessive availability windows",async()=>{
    const c=await accepted();const g=await guards(c);
    const submit=(windows:{startAt:string;endAt:string}[])=>code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...g,windows}));
    expect(await submit([{startAt:at(-2),endAt:at(-1)}])).toBe("INVALID_INPUT");
    expect(await submit([{startAt:at(24),endAt:at(26)},{startAt:at(25),endAt:at(27)}])).toBe("INVALID_INPUT");
    expect(await submit(Array.from({length:6},(_,i)=>({startAt:at(24+i*3),endAt:at(25+i*3)})))).toBe("INVALID_INPUT");
    expect(await submit([])).toBe("INVALID_INPUT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.tenant_availability_submission WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
});

describe("explicit selected-window consent and preauthorized containment",()=>{
  it("only TENANT_PREAUTHORIZATION_ALLOWED accepts explicit current-Tenant window consent bound to the exact occupancy member",async()=>{
    const present=await accepted();
    const s1=await availability(present);
    expect(await code(tenantPort.authorizeEntry(present.tenantDigest,present.ticketId,{clientRequestId:randomUUID(),...await guards(present),availabilitySubmissionId:s1.availability!.id,selectedWindowIds:[s1.availability!.windows[0].id]}))).toBe("STATE_CONFLICT");
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    const s=await availability(c);
    const chosen=s.availability!.windows[0].id;
    const authorized=await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[chosen]});
    expect(authorized).toMatchObject({effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",waitingOn:"VENDOR"});
    expect(authorized.availability!.authorizedWindowIds).toEqual([chosen]);
    const member=(await f.p.admin.query("SELECT m.id FROM app.occupancy_member m WHERE m.user_id=$1 AND m.status='ACTIVE'",[f.data.accounts.tenant.userId])).rows[0].id;
    expect((await f.p.admin.query("SELECT occupancy_member_id FROM vendor_handoff.tenant_entry_authorization WHERE assignment_id=$1",[c.assignmentId])).rows).toEqual([{occupancy_member_id:member}]);
    expect(await code(tenantPort.authorizeEntry(c.managerDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[chosen]}))).toBe("NOT_FOUND");
  });
  it("denies stale or foreign windows and submissions",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");const other=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    const first=await availability(c);const foreign=await availability(other);
    const authorize=async(submission:string,windows:string[])=>code(tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:submission,selectedWindowIds:windows}));
    expect(await authorize(first.availability!.id,[foreign.availability!.windows[0].id])).toBe("STATE_CONFLICT");
    expect(await authorize(foreign.availability!.id,[foreign.availability!.windows[0].id])).toBe("STATE_CONFLICT");
    await availability(c,[{startAt:at(60),endAt:at(62)}]);
    expect(await authorize(first.availability!.id,[first.availability!.windows[0].id])).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.tenant_entry_authorization WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("Vendor preauthorized selection must sit fully inside one authorized window and needs no second Tenant confirmation",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    const s=await availability(c,[{startAt:at(24),endAt:at(28)},{startAt:at(48),endAt:at(50)}]);
    const [authorized,unauthorized]=s.availability!.windows;
    await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[authorized.id]});
    const select=async(window:string,startAt:string,endAt:string)=>c.vendor.selectPreauthorizedSlot(c.session,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowId:window,startAt,endAt});
    const late=new Date(Date.parse(authorized.endAt)+60_000).toISOString();
    expect(await code(select(authorized.id,new Date(Date.parse(authorized.startAt)+3_600_000).toISOString(),late))).toBe("STATE_CONFLICT");
    expect(await code(select(unauthorized.id,unauthorized.startAt,unauthorized.endAt))).toBe("STATE_CONFLICT");
    const start=new Date(Date.parse(authorized.startAt)+3_600_000).toISOString(),end=new Date(Date.parse(authorized.startAt)+7_200_000).toISOString();
    const job=await select(authorized.id,start,end);
    expect(job.appointment).toMatchObject({confirmationMode:"PREAUTHORIZED_ENTRY",availabilitySubmissionId:s.availability!.id,selectedWindowId:authorized.id,status:"SCHEDULED",proposalId:null});
    expect(Date.parse(job.appointment!.startAt)).toBe(Date.parse(start));
    expect(job.currentRound).toMatchObject({status:"CONFIRMED"});
    expect((await read(c))).toMatchObject({phase:"SCHEDULED",effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW"});
    const stored=(await f.p.admin.query("SELECT entry_authorization_id IS NOT NULL AS linked,occupancy_member_id IS NOT NULL AS member FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).rows;
    expect(stored).toEqual([{linked:true,member:true}]);
  });
  it("Vendor preauthorized selection requires the authorizing occupancy member to remain current",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    const s=await availability(c);const w=s.availability!.windows[0];
    await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[w.id]});
    const g=await guards(c);
    await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[f.data.accounts.tenant.userId]);
    try{expect(await code(c.vendor.selectPreauthorizedSlot(c.session,{clientRequestId:randomUUID(),...g,availabilitySubmissionId:s.availability!.id,selectedWindowId:w.id,startAt:w.startAt,endAt:w.endAt}))).toBe("STATE_CONFLICT");}
    finally{await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE user_id=$1",[f.data.accounts.tenant.userId]);}
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
});

describe("resident-confirmation proposals and Tenant selection",()=>{
  it("Vendor proposals contain 1-5 valid future non-overlapping slots",async()=>{
    const c=await accepted();await availability(c);
    const bad=async(slots:{startAt:string;endAt:string}[])=>code(propose(c,slots));
    expect(await bad(Array.from({length:6},(_,i)=>({startAt:at(24+i*2),endAt:at(25+i*2)})))).toBe("INVALID_INPUT");
    expect(await bad([])).toBe("INVALID_INPUT");
    expect(await bad([{startAt:at(-3),endAt:at(-2)}])).toBe("INVALID_INPUT");
    expect(await bad([{startAt:at(24),endAt:at(26)},{startAt:at(25),endAt:at(27)}])).toBe("INVALID_INPUT");
    const job=await propose(c,Array.from({length:5},(_,i)=>({startAt:at(24+i*2),endAt:at(25+i*2)})));
    expect(job.proposal!.slots).toHaveLength(5);
    expect(job).toMatchObject({waitingOn:"TENANT",phase:"SCHEDULING"});
  });
  it("the Tenant must explicitly confirm one slot of the current proposal",async()=>{
    const c=await accepted();await availability(c);
    const first=await propose(c);
    const second=await propose(c,[{startAt:at(30),endAt:at(31)}]);
    expect(await code(tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),proposalId:first.proposal!.id,selectedSlotId:first.proposal!.slots[0].id}))).toBe("STATE_CONFLICT");
    expect(await code(tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),proposalId:second.proposal!.id,selectedSlotId:first.proposal!.slots[0].id}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    const input={clientRequestId:randomUUID(),...await guards(c),proposalId:second.proposal!.id,selectedSlotId:second.proposal!.slots[0].id};
    const s=await tenantPort.confirmSlot(c.tenantDigest,c.ticketId,input);
    expect(s.appointment).toMatchObject({confirmationMode:"TENANT_CONFIRMED",proposalId:second.proposal!.id,status:"SCHEDULED",availabilitySubmissionId:null,selectedWindowId:null});
    expect(s).toMatchObject({phase:"SCHEDULED",currentRound:{status:"CONFIRMED"}});
    expect(await tenantPort.confirmSlot(c.tenantDigest,c.ticketId,input)).toEqual(s);
  });
  it("a pre-confirmation restart supersedes the proposal inside the same OPEN round and is not RESCHEDULE",async()=>{
    const c=await accepted();await availability(c);const job=await propose(c);
    const roundId=job.currentRound!.id;
    const s=await availability(c,[{startAt:at(70),endAt:at(72)}]);
    expect(s.proposal).toBeNull();
    expect(s.currentRound).toMatchObject({id:roundId,purpose:"INITIAL",status:"OPEN"});
    expect(await code(tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),proposalId:job.proposal!.id,selectedSlotId:job.proposal!.slots[0].id}))).toBe("STATE_CONFLICT");
    expect(await rounds(c.assignmentId)).toEqual([{purpose:"INITIAL",status:"OPEN"}]);
  });
});

describe("immutable Appointments, RESCHEDULE and FOLLOW_UP distinction",()=>{
  it("Appointment times and provenance never change in place",async()=>{
    const c=await accepted();const s=await scheduled(c);
    await expect(f.p.admin.query("UPDATE vendor_handoff.appointment SET start_at=start_at+interval '1 hour' WHERE id=$1",[s.appointment!.id])).rejects.toMatchObject({code:"P0001"});
    await expect(f.p.admin.query("DELETE FROM vendor_handoff.appointment WHERE id=$1",[s.appointment!.id])).rejects.toMatchObject({code:"P0001"});
    await expect(f.p.admin.query("UPDATE vendor_handoff.vendor_slot SET start_at=start_at+interval '1 hour'")).rejects.toMatchObject({code:"P0001"});
  });
  it.each(["TENANT","VENDOR","MANAGER"] as const)("%s RESCHEDULE supersedes the future SCHEDULED Appointment and opens one RESCHEDULE round",async actor=>{
    const c=await accepted();const s=await scheduled(c);const old=s.appointment!;
    const input={clientRequestId:randomUUID(),...await guards(c),expectedAppointmentId:old.id};
    const run=()=>actor==="TENANT"?tenantPort.reschedule(c.tenantDigest,c.ticketId,input):actor==="VENDOR"?c.vendor.reschedule(c.session,input):f.manager.reschedule(c.managerDigest,c.assignmentId,input);
    const result=await run();
    expect(await run()).toEqual(result);
    if(actor==="MANAGER")ManagerVendorHandoffDtoSchema.parse(result);
    const appointments=(await f.p.admin.query("SELECT id,status,start_at,end_at FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).rows;
    expect(appointments).toEqual([{id:old.id,status:"SUPERSEDED",start_at:new Date(old.startAt),end_at:new Date(old.endAt)}]);
    expect(await rounds(c.assignmentId)).toEqual([{purpose:"INITIAL",status:"CONFIRMED"},{purpose:"RESCHEDULE",status:"OPEN"}]);
    expect(await code(tenantPort.reschedule(c.tenantDigest,c.ticketId,{...input,clientRequestId:randomUUID()}))).toBe("STATE_CONFLICT");
  });
  it("concurrent Tenant and Vendor RESCHEDULE create exactly one RESCHEDULE round",async()=>{
    const c=await accepted();const s=await scheduled(c);
    const g={...await guards(c),expectedAppointmentId:s.appointment!.id};
    const results=await Promise.all([code(tenantPort.reschedule(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...g})),code(c.vendor.reschedule(c.session,{clientRequestId:randomUUID(),...g}))]);
    expect(results.sort()).toEqual(["STATE_CONFLICT","success"]);
    expect((await rounds(c.assignmentId)).filter(r=>r.status==="OPEN")).toEqual([{purpose:"RESCHEDULE",status:"OPEN"}]);
  });
  it("past or OCCURRED Appointments cannot be rescheduled and OCCURRED history stays OCCURRED",async()=>{
    const c=await accepted();const s=await scheduled(c);
    await f.p.admin.query("UPDATE vendor_handoff.appointment SET status='OCCURRED' WHERE id=$1",[s.appointment!.id]);
    expect(await code(c.vendor.reschedule(c.session,{clientRequestId:randomUUID(),...await guards(c),expectedAppointmentId:s.appointment!.id}))).toBe("STATE_CONFLICT");
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.appointment WHERE id=$1",[s.appointment!.id])).rows[0].status).toBe("OCCURRED");
    await expect(f.p.admin.query("UPDATE vendor_handoff.appointment SET status='SUPERSEDED' WHERE id=$1",[s.appointment!.id])).rejects.toMatchObject({code:"P0001"});
    expect((await rounds(c.assignmentId)).some(r=>r.purpose==="FOLLOW_UP")).toBe(false);
  });
  it("a confirmed Appointment blocks a silent access-policy change but allows non-scheduling packet revisions",async()=>{
    const c=await accepted();await scheduled(c);
    const base={sharedDetailKeys:[],allowedPhotoIds:[],accessInstruction:null};
    expect(await code(f.manager.publishPacket(c.managerDigest,c.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:c.packetId,workSummary:"합성 누수 점검",accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",...base}))).toBe("STATE_CONFLICT");
    const revised=await f.manager.publishPacket(c.managerDigest,c.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:c.packetId,workSummary:"합성 누수 점검 보완",accessPolicy:"TENANT_PRESENT_REQUIRED",...base});
    expect(revised.currentPacket!.revision).toBe(2);
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).rows).toEqual([{status:"SCHEDULED"}]);
  });
  it("an access-policy change before confirmation restarts the OPEN round without RESCHEDULE",async()=>{
    const c=await accepted();await availability(c);await propose(c);
    await f.manager.publishPacket(c.managerDigest,c.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:c.packetId,workSummary:"합성 누수 점검",accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",sharedDetailKeys:[],allowedPhotoIds:[],accessInstruction:null});
    expect(await rounds(c.assignmentId)).toEqual([{purpose:"INITIAL",status:"SUPERSEDED"},{purpose:"INITIAL",status:"OPEN"}]);
    const s:TenantVendorSchedulingDto=await read(c);
    expect(s).toMatchObject({accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",availability:null,proposal:null,assignmentVersion:5});
  });
});

describe("Task5 review remediation",()=>{
  it("exact replay of a committed near-term availability and proposal still returns the committed result after the start passes",async()=>{
    const c=await accepted();
    const availabilityInput={clientRequestId:randomUUID(),...await guards(c),windows:[{startAt:at_s(2),endAt:at_s(3600)}]};
    const first=await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,availabilityInput);
    const proposalInput={clientRequestId:randomUUID(),...await guards(c),slots:[{startAt:at_s(2),endAt:at_s(1800)}]};
    const proposed=await c.vendor.proposeSlots(c.session,proposalInput);
    await sleep(2500);
    expect(await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,availabilityInput)).toEqual(first);
    expect(await c.vendor.proposeSlots(c.session,proposalInput)).toEqual(proposed);
    expect(await code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{...availabilityInput,clientRequestId:randomUUID()}))).toBe("INVALID_INPUT");
  });
  it("rejects offset-less or relative timestamps at the SQL boundary",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    expect(await code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),windows:[{startAt:"tomorrow",endAt:"2099-01-01T00:00:00Z"}]}))).toBe("INVALID_INPUT");
    expect(await code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),windows:[{startAt:"2099-01-01 10:00",endAt:"2099-01-01 11:00"}]}))).toBe("INVALID_INPUT");
    const s=await availability(c);const w=s.availability!.windows[0];
    await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[w.id]});
    expect(await code(c.vendor.selectPreauthorizedSlot(c.session,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowId:w.id,startAt:"2099-01-01 10:00",endAt:"2099-01-01 11:00"}))).toBe("INVALID_INPUT");
  });
  it("projects preauthorized mode only while the authorizing occupancy member is current, and a pending proposal waits on the Tenant",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    const s=await availability(c);
    await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[s.availability!.windows[0].id]});
    expect(await c.vendor.readJob(c.session)).toMatchObject({effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",waitingOn:"VENDOR"});
    await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[f.data.accounts.tenant.userId]);
    try{expect(await c.vendor.readJob(c.session)).toMatchObject({effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",waitingOn:"VENDOR"});}
    finally{await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE user_id=$1",[f.data.accounts.tenant.userId]);}
    await propose(c);
    expect(await c.vendor.readJob(c.session)).toMatchObject({effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",waitingOn:"TENANT"});
  });
  it("authorizes entry only for the Tenant occupancy member that submitted the availability",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED");
    await availability(c);
    const round=(await read(c)).currentRound!;
    const foreign=randomUUID();
    await f.p.admin.query("UPDATE vendor_handoff.scheduling_round SET version=version+1 WHERE id=$1",[round.id]);
    await f.p.admin.query("INSERT INTO vendor_handoff.tenant_availability_submission(id,org_id,assignment_id,round_id,packet_revision_id,occupancy_member_id,round_sequence) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [foreign,f.data.orgA,c.assignmentId,round.id,c.packetId,randomUUID(),round.version+1]);
    const window=randomUUID();
    await f.p.admin.query("INSERT INTO vendor_handoff.tenant_availability_window(id,org_id,submission_id,start_at,end_at) VALUES($1,$2,$3,clock_timestamp()+interval '30 hours',clock_timestamp()+interval '31 hours')",[window,f.data.orgA,foreign]);
    expect(await code(tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),availabilitySubmissionId:foreign,selectedWindowIds:[window]}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.tenant_entry_authorization WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("a past SCHEDULED Appointment cannot be rescheduled",async()=>{
    const c=await accepted();await availability(c);
    const job=await propose(c,[{startAt:at_s(2),endAt:at_s(3600)}]);
    const s=await tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await guards(c),proposalId:job.proposal!.id,selectedSlotId:job.proposal!.slots[0].id});
    await sleep(2500);
    expect(await code(c.vendor.reschedule(c.session,{clientRequestId:randomUUID(),...await guards(c),expectedAppointmentId:s.appointment!.id}))).toBe("STATE_CONFLICT");
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.appointment WHERE id=$1",[s.appointment!.id])).rows[0].status).toBe("SCHEDULED");
  });
  it.each(["serviceAddress","unitLabel"] as const)("a confirmed Appointment blocks a silent %s change",async field=>{
    const c=await accepted();await scheduled(c);
    if(field==="serviceAddress")await f.p.admin.query("UPDATE core_flow.building_context SET body=body||jsonb_build_object('serviceAddress','합성 변경 주소')");
    else await f.p.admin.query("UPDATE app.unit SET label='합성 변경 호실' WHERE id=$1",[f.data.unitA]);
    try{
      expect(await code(f.manager.publishPacket(c.managerDigest,c.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:c.packetId,workSummary:"합성 누수 점검",accessPolicy:"TENANT_PRESENT_REQUIRED",sharedDetailKeys:[],allowedPhotoIds:[],accessInstruction:null}))).toBe("STATE_CONFLICT");
    }finally{
      if(field==="serviceAddress")await f.p.admin.query("UPDATE core_flow.building_context SET body=body||jsonb_build_object('serviceAddress','합성 테스트 주소')");
      else await f.p.admin.query("UPDATE app.unit SET label=$2 WHERE id=$1",[f.data.unitA,c.p.handoff.currentPacket!.unitLabel]);
    }
  });
  it("freezes closed rounds and appointment transition timestamps and keeps round sequences unique",async()=>{
    const c=await accepted();const s=await scheduled(c);
    const round=s.currentRound!;
    await expect(f.p.admin.query("UPDATE vendor_handoff.scheduling_round SET version=version+1 WHERE id=$1",[round.id])).rejects.toMatchObject({code:"P0001"});
    await expect(f.p.admin.query("UPDATE vendor_handoff.scheduling_round SET closed_at=clock_timestamp() WHERE id=$1",[round.id])).rejects.toMatchObject({code:"P0001"});
    await f.p.admin.query("UPDATE vendor_handoff.appointment SET status='OCCURRED',status_changed_at='2000-01-01T00:00:00Z' WHERE id=$1",[s.appointment!.id]);
    const changed=(await f.p.admin.query("SELECT status_changed_at FROM vendor_handoff.appointment WHERE id=$1",[s.appointment!.id])).rows[0].status_changed_at as Date;
    expect(changed.getUTCFullYear()).toBeGreaterThan(2020);
    await expect(f.p.admin.query("UPDATE vendor_handoff.appointment SET status_changed_at=clock_timestamp() WHERE id=$1",[s.appointment!.id])).rejects.toMatchObject({code:"P0001"});
    const open=await accepted();const sub=await availability(open);const r=(await read(open)).currentRound!;
    const seq=(await f.p.admin.query("SELECT round_sequence FROM vendor_handoff.tenant_availability_submission WHERE id=$1",[sub.availability!.id])).rows[0].round_sequence;
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.tenant_availability_submission(org_id,assignment_id,round_id,packet_revision_id,occupancy_member_id,round_sequence) VALUES($1,$2,$3,$4,$5,$6)",
      [f.data.orgA,open.assignmentId,r.id,open.packetId,randomUUID(),seq])).rejects.toMatchObject({code:"23505"});
  });
  it("ties scheduling children to the same round, assignment and authorizing member",async()=>{
    const c=await accepted();const other=await accepted();
    const sub=await availability(other);
    const r=(await read(c)).currentRound!;
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.vendor_slot_proposal(org_id,assignment_id,round_id,packet_revision_id,availability_submission_id,round_sequence) VALUES($1,$2,$3,$4,$5,999)",
      [f.data.orgA,c.assignmentId,r.id,c.packetId,sub.availability!.id])).rejects.toMatchObject({code:"23503"});
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.vendor_slot_proposal(org_id,assignment_id,round_id,packet_revision_id,round_sequence) VALUES($1,$2,$3,$4,998)",
      [f.data.orgA,c.assignmentId,r.id,other.packetId])).rejects.toMatchObject({code:"23503"});
  });
});

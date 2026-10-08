import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createHash,randomUUID } from "node:crypto";
import type { VendorAccessPolicy } from "@build-manager/api-contracts";
import { createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

// Task7: append-only visit/blocker evidence (AC23, AC25, AC28-AC31, AC47, AC48, AC50).
let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
let tenantPort:ReturnType<typeof createVendorHandoffTenantPort>;
beforeAll(async()=>{f=await createVendorHandoffFixture();tenantPort=createVendorHandoffTenantPort(f.managerDatabase);});
afterAll(async()=>{await f?.close();});

const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const hash=(label:string)=>sha(label+randomUUID());
const at=(hours:number,minutes=0)=>new Date(Date.now()+hours*3_600_000+minutes*60_000).toISOString();
const atSeconds=(seconds:number)=>new Date(Date.now()+seconds*1000).toISOString();
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const code=(promise:Promise<unknown>)=>promise.then(()=>"success",(error:{code?:string})=>error.code);
const count=async(sql:string,values:unknown[])=>(await f.p.admin.query(sql,values)).rows[0].n as number;
const events=(assignmentId:string)=>f.p.admin.query("SELECT id,kind,appointment_id,blocker_code,note,clears_event_id FROM vendor_handoff.work_event WHERE assignment_id=$1 ORDER BY created_at,id",[assignmentId]).then(r=>r.rows);

async function accepted(policy:VendorAccessPolicy="TENANT_PRESENT_REQUIRED",tenant="tenant"){
  const p=await f.published("manager",tenant,{accessPolicy:policy});
  const assignmentId=p.handoff.assignment!.id,packetId=p.handoff.currentPacket!.id;
  const link=await f.manager.issueLink(f.data.accounts.manager.digest,assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:packetId});
  const session=hash("session"),csrf=hash("csrf"),vendor=f.externalWith(csrf);
  await f.external.redeem(sha(link.link!.split("#")[1]),randomUUID(),session,csrf);
  await vendor.accept(session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId});
  return {assignmentId,packetId,session,vendor,ticketId:p.t.ticket.id,tenantDigest:f.data.accounts[tenant].digest};
}
type Ctx=Awaited<ReturnType<typeof accepted>>;
async function tenantGuards(c:Ctx){const s=await tenantPort.readScheduling(c.tenantDigest,c.ticketId);return {expectedAssignmentVersion:s.assignmentVersion,expectedRoundVersion:s.currentRound!.version,expectedPacketRevisionId:s.packetRevisionId};}
const job=(c:Ctx)=>c.vendor.readJob(c.session);
async function visitGuards(c:Ctx){const j=await job(c);return {expectedAssignmentVersion:j.assignmentVersion,expectedRoundVersion:j.currentRound!.version,expectedPacketRevisionId:j.currentPacket!.id};}
async function workGuards(c:Ctx){const j=await job(c);return {expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id};}
/** A TENANT_CONFIRMED Appointment through the real Tenant/Vendor scheduling ports. */
async function confirmed(c:Ctx){
  await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:at(24),endAt:at(28)}]});
  const proposed=await c.vendor.proposeSlots(c.session,{clientRequestId:randomUUID(),...await tenantGuards(c),slots:[{startAt:at(25),endAt:at(26)}]});
  const s=await tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),proposalId:proposed.proposal!.id,selectedSlotId:proposed.proposal!.slots[0].id});
  return s.appointment!;
}
async function scheduled(policy:VendorAccessPolicy="TENANT_PRESENT_REQUIRED"){const c=await accepted(policy);return {...c,appointment:await confirmed(c)};}
/** A PREAUTHORIZED_ENTRY Appointment whose authorized window opens `opensIn` seconds from now. */
async function preauthorized(opensIn=2,tenant="tenantPeer"){
  const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED",tenant);
  const s=await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:atSeconds(opensIn),endAt:at(3)}]});
  const w=s.availability!.windows[0];
  await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[w.id]});
  const selected=await c.vendor.selectPreauthorizedSlot(c.session,{clientRequestId:randomUUID(),...await tenantGuards(c),
    availabilitySubmissionId:s.availability!.id,selectedWindowId:w.id,startAt:atSeconds(opensIn+1),endAt:at(2)});
  return {...c,appointment:selected.appointment!,window:w,tenant};
}
async function untilOpen(window:{startAt:string}){const wait=Date.parse(window.startAt)-Date.now()+250;if(wait>0)await sleep(wait);}
async function startVisit(c:Ctx&{appointment:{id:string}},request=randomUUID()){return c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:request,...await visitGuards(c)});}
async function record(c:Ctx,blockerCode:"PARTS_REQUIRED"|"ACCESS_BLOCKED"|"SCOPE_REVIEW_REQUIRED"|"FOLLOW_UP_VISIT_REQUIRED"|"OTHER",note:string|null=null,request=randomUUID()){
  return c.vendor.recordBlocker(c.session,{clientRequestId:request,...await workGuards(c),blockerCode,operationalNote:note});
}
async function clear(c:Ctx,blockerId:string,note:string|null=null,request=randomUUID()){
  return c.vendor.clearBlocker(c.session,blockerId,{clientRequestId:request,...await workGuards(c),operationalNote:note});
}
async function memberOf(userId:string){
  return (await f.p.admin.query("SELECT id,org_id,occupancy_id FROM app.occupancy_member WHERE user_id=$1 AND status='ACTIVE' ORDER BY joined_at,id LIMIT 1",[userId])).rows[0] as {id:string;org_id:string;occupancy_id:string};
}
/** Runs admin statements under an explicit organization binding, as every owner-context path must. */
async function bound<T>(org:string,op:()=>Promise<T>):Promise<T>{
  await f.p.admin.query("SELECT set_config('app.org_id',$1,false)",[org]);
  try{return await op();}finally{await f.p.admin.query("RESET app.org_id");}
}
async function waitForTicketWait(){
  for(let attempt=0;attempt<200;attempt++){
    await f.p.admin.query("SELECT pg_stat_clear_snapshot()");
    const {rows}=await f.p.admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%vendor_handoff%'");
    if(rows[0].n>0)return;
    await sleep(10);
  }
  throw new Error("Expected real source-ticket lock wait was not observed");
}

describe("visit start (AC28)",()=>{
  it("starts exactly one visit for the current SCHEDULED Appointment, keeps its time and replays exactly",async()=>{
    const c=await scheduled();
    const before=await job(c),request=randomUUID();
    const started=await startVisit(c,request);
    expect(started).toMatchObject({phase:"IN_PROGRESS",waitingOn:"VENDOR",assignmentVersion:before.assignmentVersion+1,activeBlocker:null,
      appointment:{id:c.appointment.id,status:"OCCURRED",startAt:c.appointment.startAt,endAt:c.appointment.endAt}});
    expect(await c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:request,expectedAssignmentVersion:before.assignmentVersion,
      expectedRoundVersion:before.currentRound!.version,expectedPacketRevisionId:before.currentPacket!.id})).toEqual(started);
    expect(await code(startVisit(c))).toBe("STATE_CONFLICT");
    expect((await events(c.assignmentId)).map(e=>[e.kind,e.appointment_id])).toEqual([["VISIT_STARTED",c.appointment.id]]);
    const stored=(await f.p.admin.query("SELECT start_at,end_at,status FROM vendor_handoff.appointment WHERE id=$1",[c.appointment.id])).rows[0];
    expect([stored.start_at.toISOString(),stored.end_at.toISOString(),stored.status]).toEqual([new Date(c.appointment.startAt).toISOString(),new Date(c.appointment.endAt).toISOString(),"OCCURRED"]);
  });
  it("concurrent visit starts for one Appointment record exactly one VISIT_STARTED",async()=>{
    const c=await scheduled();const g=await visitGuards(c);
    const results=await Promise.all([1,2].map(()=>code(c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:randomUUID(),...g}))));
    expect(results.sort()).toEqual(["STATE_CONFLICT","success"]);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1 AND kind='VISIT_STARTED'",[c.assignmentId])).toBe(1);
  });
  it("denies stale guards, foreign or superseded Appointments and an active blocker without durable evidence",async()=>{
    const c=await scheduled();const g=await visitGuards(c);
    expect(await code(c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:randomUUID(),...g,expectedAssignmentVersion:g.expectedAssignmentVersion-1}))).toBe("STATE_CONFLICT");
    expect(await code(c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:randomUUID(),...g,expectedRoundVersion:g.expectedRoundVersion+1}))).toBe("STATE_CONFLICT");
    expect(await code(c.vendor.startVisit(c.session,randomUUID(),{clientRequestId:randomUUID(),...g}))).toBe("STATE_CONFLICT");
    const other=await scheduled();
    expect(await code(c.vendor.startVisit(c.session,other.appointment.id,{clientRequestId:randomUUID(),...g}))).toBe("STATE_CONFLICT");
    const blocker=(await record(c,"ACCESS_BLOCKED")).activeBlocker!;
    expect(await code(startVisit(c))).toBe("STATE_CONFLICT");
    await clear(c,blocker.id);
    await c.vendor.reschedule(c.session,{clientRequestId:randomUUID(),...await visitGuards(c),expectedAppointmentId:c.appointment.id});
    expect(await code(startVisit(c))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1 AND kind='VISIT_STARTED'",[c.assignmentId])).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.appointment WHERE assignment_id=$1 AND status='OCCURRED'",[c.assignmentId])).toBe(0);
  });
});

describe("preauthorized-entry occupancy recheck (AC23)",()=>{
  it("starts a PREAUTHORIZED_ENTRY visit inside the authorized window while the authorizing member is current",async()=>{
    const c=await preauthorized();await untilOpen(c.window);
    expect(await startVisit(c)).toMatchObject({phase:"IN_PROGRESS",appointment:{id:c.appointment.id,status:"OCCURRED",confirmationMode:"PREAUTHORIZED_ENTRY"}});
  });
  it("never starts unattended entry before the explicitly authorized window opens",async()=>{
    const c=await preauthorized(3600);
    expect(await code(startVisit(c))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("denies VISIT_STARTED when the authorizing occupancy member has ended",async()=>{
    const c=await preauthorized();await untilOpen(c.window);
    const member=await memberOf(f.data.accounts[c.tenant].userId);
    await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[member.id]);
    try{expect(await code(startVisit(c))).toBe("STATE_CONFLICT");}
    finally{await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE id=$1",[member.id]);}
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.appointment WHERE id=$1 AND status='SCHEDULED'",[c.appointment.id])).toBe(1);
  });
  it("a newly current replacement member cannot satisfy the stored authorization",async()=>{
    const c=await preauthorized();await untilOpen(c.window);
    const member=await memberOf(f.data.accounts[c.tenant].userId);
    await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[member.id]);
    const replacement=(await f.p.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 second','ACTIVE') RETURNING id",
      [member.org_id,member.occupancy_id,f.data.accounts[c.tenant].userId])).rows[0].id as string;
    try{expect(await code(startVisit(c))).toBe("STATE_CONFLICT");}
    finally{
      await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[replacement]);
      await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE id=$1",[member.id]);
    }
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("rechecks the stored authorizing member after the real source-ticket lock wait",async()=>{
    const c=await preauthorized();await untilOpen(c.window);
    const member=await memberOf(f.data.accounts[c.tenant].userId);
    const g=await visitGuards(c);
    await f.p.admin.query("BEGIN");await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE",[c.ticketId]);
    const pending=code(c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:randomUUID(),...g}));
    try{
      await waitForTicketWait();
      await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[member.id]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe("STATE_CONFLICT");
    }finally{
      await f.p.admin.query("ROLLBACK");
      await f.p.admin.query("UPDATE app.occupancy_member SET status='ACTIVE',ended_at=NULL WHERE id=$1",[member.id]);
    }
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
});

describe("blockers overlay work state (AC29, AC30)",()=>{
  it("a blocker overlays the current phase without rewriting lifecycle or history",async()=>{
    const c=await scheduled();const before=await job(c);
    const blocked=await record(c,"PARTS_REQUIRED","합성 부품 대기");
    expect(blocked).toMatchObject({phase:"SCHEDULED",waitingOn:"PARTS",status:"ACTIVE",assignmentVersion:before.assignmentVersion+1,
      appointment:{id:c.appointment.id,status:"SCHEDULED"},activeBlocker:{code:"PARTS_REQUIRED",note:"합성 부품 대기",active:true,clearedAt:null}});
    const manager=await f.manager.readHandoff(f.data.accounts.manager.digest,c.ticketId);
    expect(manager).toMatchObject({phase:"SCHEDULED",waitingOn:"PARTS",activeBlocker:{id:blocked.activeBlocker!.id,code:"PARTS_REQUIRED"}});
    const tenant=await tenantPort.readScheduling(c.tenantDigest,c.ticketId);
    expect(JSON.stringify(tenant).includes("합성 부품 대기")).toBe(false);
  });
  it("keeps at most one current blocker per assignment, also under concurrency",async()=>{
    const c=await scheduled();const g=await workGuards(c);
    const results=await Promise.all(["PARTS_REQUIRED","OTHER"].map(blockerCode=>code(c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),...g,blockerCode:blockerCode as "OTHER",operationalNote:null}))));
    expect(results.sort()).toEqual(["STATE_CONFLICT","success"]);
    expect(await code(record(c,"OTHER"))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1 AND kind='BLOCKER_RECORDED'",[c.assignmentId])).toBe(1);
  });
  it("clearing references the exact blocker, preserves both events and replays exactly",async()=>{
    const c=await scheduled();
    const blocker=(await record(c,"ACCESS_BLOCKED","합성 출입 불가")).activeBlocker!;
    expect(await code(clear(c,randomUUID()))).toBe("STATE_CONFLICT");
    const request=randomUUID(),g=await workGuards(c);
    const cleared=await c.vendor.clearBlocker(c.session,blocker.id,{clientRequestId:request,...g,operationalNote:"합성 출입 확인"});
    expect(cleared).toMatchObject({activeBlocker:null,phase:"SCHEDULED",waitingOn:"VENDOR",assignmentVersion:g.expectedAssignmentVersion+1});
    expect(await c.vendor.clearBlocker(c.session,blocker.id,{clientRequestId:request,...g,operationalNote:"합성 출입 확인"})).toEqual(cleared);
    expect(await code(clear(c,blocker.id))).toBe("STATE_CONFLICT");
    expect((await events(c.assignmentId)).map(e=>({kind:e.kind,code:e.blocker_code,note:e.note,clears:e.clears_event_id}))).toEqual([
      {kind:"BLOCKER_RECORDED",code:"ACCESS_BLOCKED",note:"합성 출입 불가",clears:null},
      {kind:"BLOCKER_CLEARED",code:null,note:"합성 출입 확인",clears:blocker.id},
    ]);
    // A new blocker is allowed only after the previous one is cleared; stale guards are rejected.
    expect(await code(c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),...g,blockerCode:"OTHER",operationalNote:null}))).toBe("STATE_CONFLICT");
    expect((await record(c,"OTHER")).activeBlocker).toMatchObject({code:"OTHER",active:true});
  });
  it("a changed intent under the same request identity is rejected",async()=>{
    const c=await scheduled();const g=await workGuards(c),request=randomUUID();
    await c.vendor.recordBlocker(c.session,{clientRequestId:request,...g,blockerCode:"PARTS_REQUIRED",operationalNote:null});
    expect(await code(c.vendor.recordBlocker(c.session,{clientRequestId:request,...g,blockerCode:"OTHER",operationalNote:null}))).toBe("STATE_CONFLICT");
  });
  it("rejects invalid notes before any durable evidence",async()=>{
    const c=await scheduled();const g=await workGuards(c);
    expect(await code(c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),...g,blockerCode:"OTHER",operationalNote:"x".repeat(501)}))).toBe("INVALID_INPUT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
});

describe("blocker-driven FOLLOW_UP (AC31, AC25)",()=>{
  it("requires an occurred visit before a FOLLOW_UP_VISIT_REQUIRED blocker",async()=>{
    const c=await scheduled();
    expect(await code(record(c,"FOLLOW_UP_VISIT_REQUIRED"))).toBe("STATE_CONFLICT");
  });
  it("clearing FOLLOW_UP_VISIT_REQUIRED appends BLOCKER_CLEARED and opens one FOLLOW_UP round from that exact blocker; the occurred visit stays OCCURRED",async()=>{
    const c=await scheduled();await startVisit(c);
    const blocker=(await record(c,"FOLLOW_UP_VISIT_REQUIRED","합성 추가 방문")).activeBlocker!;
    expect((await job(c))).toMatchObject({phase:"IN_PROGRESS",waitingOn:"VENDOR"});
    const reopened=await clear(c,blocker.id);
    expect(reopened).toMatchObject({phase:"SCHEDULING",waitingOn:"TENANT",activeBlocker:null,currentRound:{purpose:"FOLLOW_UP",status:"OPEN"}});
    const round=(await f.p.admin.query("SELECT source_blocker_id,source_completion_report_id,previous_appointment_id FROM vendor_handoff.scheduling_round WHERE assignment_id=$1 AND purpose='FOLLOW_UP'",[c.assignmentId])).rows;
    expect(round).toEqual([{source_blocker_id:blocker.id,source_completion_report_id:null,previous_appointment_id:null}]);
    expect((await events(c.assignmentId)).map(e=>e.kind)).toEqual(["VISIT_STARTED","BLOCKER_RECORDED","BLOCKER_CLEARED"]);
    const second=await confirmed(c);
    expect(second.id).not.toBe(c.appointment.id);
    const statuses=(await f.p.admin.query("SELECT id,status FROM vendor_handoff.appointment WHERE assignment_id=$1 ORDER BY created_at",[c.assignmentId])).rows;
    expect(statuses).toEqual([{id:c.appointment.id,status:"OCCURRED"},{id:second.id,status:"SCHEDULED"}]);
    expect(await startVisit({...c,appointment:second})).toMatchObject({appointment:{id:second.id,status:"OCCURRED"}});
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.appointment WHERE assignment_id=$1 AND status='OCCURRED'",[c.assignmentId])).toBe(2);
  });
  it("clearing any other blocker never opens a round",async()=>{
    const c=await scheduled();await startVisit(c);
    const blocker=(await record(c,"PARTS_REQUIRED")).activeBlocker!;
    expect(await clear(c,blocker.id)).toMatchObject({phase:"IN_PROGRESS",currentRound:{purpose:"INITIAL",status:"CONFIRMED"}});
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.scheduling_round WHERE assignment_id=$1 AND purpose='FOLLOW_UP'",[c.assignmentId])).toBe(0);
  });
});

describe("append-only evidence and provenance integrity",()=>{
  it("work events can never be updated or deleted",async()=>{
    const c=await scheduled();await startVisit(c);
    const [visit]=await events(c.assignmentId);
    await expect(f.p.admin.query("UPDATE vendor_handoff.work_event SET note='x' WHERE id=$1",[visit.id])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
    await expect(f.p.admin.query("DELETE FROM vendor_handoff.work_event WHERE id=$1",[visit.id])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
  });
  it("a clear must reference a blocker of the same assignment and a FOLLOW_UP round a blocker of the same assignment",async()=>{
    const c=await scheduled();await startVisit(c);const other=await scheduled();
    const [visit]=await events(c.assignmentId);
    const blocker=(await record(other,"OTHER")).activeBlocker!;
    const orgPacket=(await f.p.admin.query("SELECT org_id FROM vendor_handoff.vendor_assignment WHERE id=$1",[c.assignmentId])).rows[0].org_id as string;
    await bound(orgPacket,async()=>{
      await expect(f.p.admin.query("INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,clears_event_id) VALUES($1,$2,'BLOCKER_CLEARED',$3,$4)",
        [orgPacket,c.assignmentId,c.packetId,visit.id])).rejects.toMatchObject({code:"23503"});
      await expect(f.p.admin.query("INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,clears_event_id) VALUES($1,$2,'BLOCKER_CLEARED',$3,$4)",
        [orgPacket,c.assignmentId,c.packetId,blocker.id])).rejects.toMatchObject({code:"23503"});
      await expect(f.p.admin.query("INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,source_blocker_id) VALUES($1,$2,$3,'FOLLOW_UP','OPEN',$4)",
        [orgPacket,c.assignmentId,c.packetId,blocker.id])).rejects.toMatchObject({code:"23503"});
      await expect(f.p.admin.query("INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,source_blocker_id) VALUES($1,$2,$3,'FOLLOW_UP','OPEN',$4)",
        [orgPacket,c.assignmentId,c.packetId,visit.id])).rejects.toMatchObject({code:"23503"});
    });
  });
  it("Withdraw keeps the visit and blocker history",async()=>{
    const c=await scheduled();await startVisit(c);await record(c,"PARTS_REQUIRED");
    await c.vendor.withdraw(c.session,{clientRequestId:randomUUID(),...await workGuards(c),operationalNote:null});
    expect((await events(c.assignmentId)).map(e=>e.kind)).toEqual(["VISIT_STARTED","BLOCKER_RECORDED"]);
  });
});

describe("Task7 review remediation",()=>{
  const orgOf=async(assignmentId:string)=>(await f.p.admin.query("SELECT org_id FROM vendor_handoff.vendor_assignment WHERE id=$1",[assignmentId])).rows[0].org_id as string;
  it("keeps the blocker category out of the Tenant projection while the Vendor sees its overlay (L1)",async()=>{
    const c=await accepted();
    await record(c,"PARTS_REQUIRED","합성 부품 대기");
    expect(await job(c)).toMatchObject({waitingOn:"PARTS"});
    expect(await tenantPort.readScheduling(c.tenantDigest,c.ticketId)).toMatchObject({phase:"SCHEDULING",waitingOn:"TENANT"});
  });
  it("indexes work evidence by assignment (L3)",async()=>{
    const defs=(await f.p.admin.query("SELECT indexdef FROM pg_indexes WHERE schemaname='vendor_handoff' AND tablename='work_event'")).rows.map(r=>r.indexdef as string);
    expect(defs.some(def=>/\(assignment_id, kind, created_at DESC/.test(def))).toBe(true);
  });
  it("the insert guard alone keeps one current blocker for a bound direct insert (L4)",async()=>{
    const c=await scheduled();await record(c,"OTHER");
    const org=await orgOf(c.assignmentId);
    await bound(org,async()=>{
      await expect(f.p.admin.query("INSERT INTO vendor_handoff.work_event(org_id,assignment_id,kind,packet_revision_id,blocker_code) VALUES($1,$2,'BLOCKER_RECORDED',$3,'PARTS_REQUIRED')",
        [org,c.assignmentId,c.packetId])).rejects.toMatchObject({message:"STATE_CONFLICT"});
    });
  });
  it("refuses FOLLOW_UP_VISIT_REQUIRED while a round is OPEN or an Appointment is SCHEDULED (L4)",async()=>{
    const c=await scheduled();await startVisit(c);
    const first=(await record(c,"FOLLOW_UP_VISIT_REQUIRED")).activeBlocker!;
    await clear(c,first.id);
    expect(await code(record(c,"FOLLOW_UP_VISIT_REQUIRED"))).toBe("STATE_CONFLICT");
    await confirmed(c);
    expect(await code(record(c,"FOLLOW_UP_VISIT_REQUIRED"))).toBe("STATE_CONFLICT");
    expect((await record(c,"OTHER")).activeBlocker).toMatchObject({code:"OTHER"});
  });
  it("never starts unattended entry after the authorized window ended (L4)",async()=>{
    const c=await accepted("TENANT_PREAUTHORIZATION_ALLOWED","tenantPeer");
    const s=await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:atSeconds(2),endAt:atSeconds(5)}]});
    const w=s.availability!.windows[0];
    await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[w.id]});
    const selected=await c.vendor.selectPreauthorizedSlot(c.session,{clientRequestId:randomUUID(),...await tenantGuards(c),availabilitySubmissionId:s.availability!.id,
      selectedWindowId:w.id,startAt:atSeconds(3),endAt:atSeconds(4)});
    await sleep(Date.parse(w.endAt)-Date.now()+300);
    expect(await code(startVisit({...c,appointment:selected.appointment!}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("denies every work command after the assignment ended (L4)",async()=>{
    const c=await scheduled();
    const blocker=(await record(c,"OTHER")).activeBlocker!;
    const g=await visitGuards(c);
    await c.vendor.withdraw(c.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:g.expectedAssignmentVersion,expectedPacketRevisionId:g.expectedPacketRevisionId,operationalNote:null});
    const guards={expectedAssignmentVersion:g.expectedAssignmentVersion+1,expectedPacketRevisionId:g.expectedPacketRevisionId};
    expect(await code(c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),...guards,blockerCode:"OTHER",operationalNote:null}))).toBe("UNAUTHENTICATED");
    expect(await code(c.vendor.clearBlocker(c.session,blocker.id,{clientRequestId:randomUUID(),...guards,operationalNote:null}))).toBe("UNAUTHENTICATED");
    expect(await code(c.vendor.startVisit(c.session,c.appointment.id,{clientRequestId:randomUUID(),...g,expectedAssignmentVersion:guards.expectedAssignmentVersion}))).toBe("UNAUTHENTICATED");
  });
  it("concurrent clear and record against the same version settle on exactly one outcome (L4)",async()=>{
    const c=await scheduled();
    const blocker=(await record(c,"OTHER")).activeBlocker!;
    const g=await workGuards(c);
    const results=await Promise.all([
      code(c.vendor.clearBlocker(c.session,blocker.id,{clientRequestId:randomUUID(),...g,operationalNote:null})),
      code(c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),...g,blockerCode:"PARTS_REQUIRED",operationalNote:null})),
    ]);
    expect(results.filter(r=>r==="success")).toHaveLength(1);
    const kinds=(await events(c.assignmentId)).map(e=>e.kind);
    expect(kinds.filter(k=>k==="BLOCKER_RECORDED").length-kinds.filter(k=>k==="BLOCKER_CLEARED").length).toBeLessThanOrEqual(1);
  });
});

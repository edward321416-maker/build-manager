import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createHash,randomBytes,randomUUID } from "node:crypto";
import type { SanitizedVendorPhoto } from "@build-manager/application";
import { createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

// Task8: bounded initial completion reports, staged sanitized photos and Manager review projection
// (AC32-AC37, AC46-AC51 Task8 portions). Correction/disposition behavior is Task9.
let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
let tenantPort:ReturnType<typeof createVendorHandoffTenantPort>;
beforeAll(async()=>{f=await createVendorHandoffFixture();tenantPort=createVendorHandoffTenantPort(f.managerDatabase);});
afterAll(async()=>{await f?.close();});

const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const hash=(label:string)=>sha(label+randomUUID());
const at=(hours:number)=>new Date(Date.now()+hours*3_600_000).toISOString();
const code=(promise:Promise<unknown>)=>promise.then(()=>"success",(error:{code?:string})=>error.code);
const count=async(sql:string,values:unknown[])=>(await f.p.admin.query(sql,values)).rows[0].n as number;
/** Server-side sanitized photo stand-in: the PostgreSQL layer persists exactly what the sanitizer produced. */
function photo(seed=randomBytes(48)):SanitizedVendorPhoto{
  const bytes=new Uint8Array(seed);
  return {bytes,mime:"image/png",byteSize:bytes.byteLength,width:4,height:3,sha256:createHash("sha256").update(bytes).digest("hex")};
}

async function accepted(tenant="tenant"){
  const p=await f.published("manager",tenant);
  const assignmentId=p.handoff.assignment!.id,packetId=p.handoff.currentPacket!.id;
  const link=await f.manager.issueLink(f.data.accounts.manager.digest,assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:packetId});
  const session=hash("session"),csrf=hash("csrf"),vendor=f.externalWith(csrf);
  await f.external.redeem(sha(link.link!.split("#")[1]),randomUUID(),session,csrf);
  await vendor.accept(session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId});
  return {assignmentId,packetId,session,vendor,ticketId:p.t.ticket.id,tenantDigest:f.data.accounts[tenant].digest};
}
type Ctx=Awaited<ReturnType<typeof accepted>>;
const job=(c:Ctx)=>c.vendor.readJob(c.session);
async function tenantGuards(c:Ctx){const s=await tenantPort.readScheduling(c.tenantDigest,c.ticketId);return {expectedAssignmentVersion:s.assignmentVersion,expectedRoundVersion:s.currentRound!.version,expectedPacketRevisionId:s.packetRevisionId};}
async function confirmed(c:Ctx){
  await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:at(24),endAt:at(28)}]});
  const proposed=await c.vendor.proposeSlots(c.session,{clientRequestId:randomUUID(),...await tenantGuards(c),slots:[{startAt:at(25),endAt:at(26)}]});
  const s=await tenantPort.confirmSlot(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),proposalId:proposed.proposal!.id,selectedSlotId:proposed.proposal!.slots[0].id});
  return s.appointment!;
}
/** An ACTIVE assignment whose current Appointment OCCURRED (VISIT_STARTED recorded). */
async function visited(){
  const c=await accepted();const appointment=await confirmed(c);
  const j=await job(c);
  await c.vendor.startVisit(c.session,appointment.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedRoundVersion:j.currentRound!.version,expectedPacketRevisionId:j.currentPacket!.id});
  return {...c,appointmentId:appointment.id};
}
type Visited=Awaited<ReturnType<typeof visited>>;
async function uploadInput(c:Visited,changes:Record<string,unknown>={}){
  const j=await job(c);
  return {clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id,expectedAppointmentId:c.appointmentId,expectedCorrectionRequestId:null,...changes};
}
async function upload(c:Visited,image=photo(),changes:Record<string,unknown>={}){return c.vendor.uploadCompletionPhoto(c.session,await uploadInput(c,changes) as never,image);}
async function reportInput(c:Visited,changes:Record<string,unknown>={}){
  const j=await job(c);
  return {clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id,expectedAppointmentId:c.appointmentId,
    expectedCorrectionRequestId:null,supersedesReportId:null,workSummary:"합성 누수 부위 교체 완료",componentOrPartNote:null,completionPhotoIds:[] as string[],photoOmissionReason:null as string|null,...changes};
}
async function report(c:Visited,changes:Record<string,unknown>={}){return c.vendor.submitCompletionReport(c.session,await reportInput(c,changes) as never);}
const photos=(assignmentId:string)=>f.p.admin.query("SELECT id,disposition FROM vendor_handoff.completion_photo WHERE assignment_id=$1 ORDER BY created_at,id",[assignmentId]).then(r=>r.rows);
const ticketStatus=async(ticketId:string)=>(await f.p.admin.query("SELECT work_status FROM core_flow.ticket WHERE id=$1",[ticketId])).rows[0].work_status as string;

describe("completion photo staging (AC33, AC48)",()=>{
  it("stores one sanitized photo in the exact initial context and replays exactly without consuming another slot",async()=>{
    const c=await visited();const image=photo(),input=await uploadInput(c);
    const first=await c.vendor.uploadCompletionPhoto(c.session,input as never,image);
    expect(first).toMatchObject({mime:"image/png",byteSize:image.byteSize,width:4,height:3});
    expect(await c.vendor.uploadCompletionPhoto(c.session,input as never,image)).toEqual(first);
    expect(await photos(c.assignmentId)).toEqual([{id:first.photoId,disposition:"PENDING"}]);
    const stored=(await f.p.admin.query("SELECT bytes,sha256,correction_request_id FROM vendor_handoff.completion_photo WHERE id=$1",[first.photoId])).rows[0];
    expect([Buffer.from(stored.bytes).equals(Buffer.from(image.bytes)),Buffer.from(stored.sha256).toString("hex"),stored.correction_request_id]).toEqual([true,image.sha256,null]);
  });
  it("conflicts when the same request identity carries different sanitized bytes or intent",async()=>{
    const c=await visited();const input=await uploadInput(c),image=photo();
    await c.vendor.uploadCompletionPhoto(c.session,input as never,image);
    expect(await code(c.vendor.uploadCompletionPhoto(c.session,input as never,photo()))).toBe("STATE_CONFLICT");
    expect(await code(c.vendor.uploadCompletionPhoto(c.session,{...input,expectedAssignmentVersion:input.expectedAssignmentVersion-1} as never,image))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_photo WHERE assignment_id=$1",[c.assignmentId])).toBe(1);
  });
  it("rejects stale guards, a non-OCCURRED or foreign Appointment and every correction context with no durable photo",async()=>{
    const c=await visited();const other=await visited();
    const j=await job(c);
    for(const changes of [{expectedAssignmentVersion:j.assignmentVersion-1},{expectedPacketRevisionId:randomUUID()},{expectedAppointmentId:randomUUID()},
      {expectedAppointmentId:other.appointmentId},{expectedCorrectionRequestId:randomUUID()}])
      expect(await code(upload(c,photo(),changes)),JSON.stringify(changes)).toBe("STATE_CONFLICT");
    const notYet=await accepted();const appointment=await confirmed(notYet);
    expect(await code(upload({...notYet,appointmentId:appointment.id}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_photo WHERE assignment_id IN ($1,$2)",[c.assignmentId,notYet.assignmentId])).toBe(0);
  });
  it("accepts at most ten fresh uploads per context while exact replay of an accepted upload still returns its photo",async()=>{
    const c=await visited();
    const firstInput=await uploadInput(c),firstImage=photo();
    const first=await c.vendor.uploadCompletionPhoto(c.session,firstInput as never,firstImage);
    for(let i=1;i<10;i++)await upload(c);
    expect(await code(upload(c))).toBe("STATE_CONFLICT");
    expect(await c.vendor.uploadCompletionPhoto(c.session,firstInput as never,firstImage)).toEqual(first);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_photo WHERE assignment_id=$1",[c.assignmentId])).toBe(10);
  });
  it("upload alone creates no report, keeps the assignment version and leaves the ticket unchanged",async()=>{
    const c=await visited();const before=await job(c),status=await ticketStatus(c.ticketId);
    await upload(c);
    expect(await job(c)).toMatchObject({assignmentVersion:before.assignmentVersion,phase:"IN_PROGRESS",currentReport:null});
    expect(await ticketStatus(c.ticketId)).toBe(status);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_report WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("rechecks the Vendor session after the real source-ticket lock wait and stores nothing for revoked authority",async()=>{
    const c=await visited();const input=await uploadInput(c);
    await f.p.admin.query("BEGIN");await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE",[c.ticketId]);
    const pending=code(c.vendor.uploadCompletionPhoto(c.session,input as never,photo()));
    try{
      await waitForTicketWait();
      await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1 AND revoked_at IS NULL",[c.assignmentId]);
      await f.p.admin.query("COMMIT");
      expect(await pending).toBe("UNAUTHENTICATED");
    }finally{await f.p.admin.query("ROLLBACK");}
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_photo WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
});

describe("initial completion report (AC32, AC34-AC36)",()=>{
  it("attaches 1-5 same-context photos, retains the rest as unattachable history and moves to COMPLETION_REPORTED without ending anything",async()=>{
    const c=await visited();
    const aImage=photo(),aInput=await uploadInput(c);
    const a=await c.vendor.uploadCompletionPhoto(c.session,aInput as never,aImage),b=await upload(c),unused=await upload(c);
    const before=await job(c),status=await ticketStatus(c.ticketId),request=randomUUID();
    const input=await reportInput(c,{clientRequestId:request,completionPhotoIds:[a.photoId,b.photoId],componentOrPartNote:"합성 밸브"});
    const submitted=await c.vendor.submitCompletionReport(c.session,input as never);
    expect(submitted).toMatchObject({assignmentId:c.assignmentId,appointmentId:c.appointmentId,revision:1,supersedesReportId:null,completionPhotoIds:[a.photoId,b.photoId],photoOmissionReason:null,componentOrPartNote:"합성 밸브"});
    expect(await c.vendor.submitCompletionReport(c.session,input as never)).toEqual(submitted);
    expect(await photos(c.assignmentId)).toEqual([{id:a.photoId,disposition:"ATTACHED"},{id:b.photoId,disposition:"ATTACHED"},{id:unused.photoId,disposition:"UNATTACHED_RETAINED"}]);
    expect(await job(c)).toMatchObject({status:"ACTIVE",phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",assignmentVersion:before.assignmentVersion+1,currentReport:{id:submitted.id}});
    expect(await ticketStatus(c.ticketId)).toBe(status);
    const manager=await f.manager.readHandoff(f.data.accounts.manager.digest,c.ticketId);
    expect(manager).toMatchObject({phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",currentReport:{id:submitted.id,completionPhotoIds:[a.photoId,b.photoId]},reportHistory:[{id:submitted.id}]});
    expect(JSON.stringify(manager).includes(unused.photoId)).toBe(false);
    expect(await code(upload(c))).toBe("STATE_CONFLICT");
    // Exact replay of an accepted upload still returns its photo after the context closed.
    expect(await c.vendor.uploadCompletionPhoto(c.session,aInput as never,aImage)).toEqual(a);
  });
  it("accepts one approved omission reason instead of photos and enforces photos XOR omission",async()=>{
    const c=await visited();const image=await upload(c);
    expect(await code(report(c,{completionPhotoIds:[],photoOmissionReason:null}))).toBe("INVALID_INPUT");
    expect(await code(report(c,{completionPhotoIds:[image.photoId],photoOmissionReason:"NOT_APPLICABLE"}))).toBe("INVALID_INPUT");
    expect(await report(c,{photoOmissionReason:"SAFETY_OR_PRIVACY"})).toMatchObject({completionPhotoIds:[],photoOmissionReason:"SAFETY_OR_PRIVACY"});
    expect(await photos(c.assignmentId)).toEqual([{id:image.photoId,disposition:"UNATTACHED_RETAINED"}]);
  });
  it("bounds workSummary and componentOrPartNote and rejects more than five photos",async()=>{
    const c=await visited();const ids=[];for(let i=0;i<6;i++)ids.push((await upload(c)).photoId);
    expect(await code(report(c,{workSummary:"x".repeat(1001),photoOmissionReason:"NOT_APPLICABLE"}))).toBe("INVALID_INPUT");
    expect(await code(report(c,{workSummary:"  ",photoOmissionReason:"NOT_APPLICABLE"}))).toBe("INVALID_INPUT");
    expect(await code(report(c,{componentOrPartNote:"x".repeat(501),photoOmissionReason:"NOT_APPLICABLE"}))).toBe("INVALID_INPUT");
    expect(await code(report(c,{completionPhotoIds:ids}))).toBe("INVALID_INPUT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_report WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("rejects a current blocker, an OPEN round, a missing visit, a stale packet acknowledgment, supersession or a correction context",async()=>{
    const blocked=await visited();
    const j=await job(blocked);
    await blocked.vendor.recordBlocker(blocked.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id,blockerCode:"OTHER",operationalNote:null});
    expect(await code(report(blocked,{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    const notVisited=await accepted();const appointment=await confirmed(notVisited);
    expect(await code(report({...notVisited,appointmentId:appointment.id},{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    const open=await accepted();
    const openJob=await job(open);
    expect(await code(open.vendor.submitCompletionReport(open.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:openJob.assignmentVersion,expectedPacketRevisionId:openJob.currentPacket!.id,
      expectedAppointmentId:randomUUID(),expectedCorrectionRequestId:null,supersedesReportId:null,workSummary:"합성",componentOrPartNote:null,completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    const c=await visited();
    for(const changes of [{expectedPacketRevisionId:randomUUID()},{supersedesReportId:randomUUID()},{expectedCorrectionRequestId:randomUUID()},{expectedAppointmentId:randomUUID()}])
      expect(await code(report(c,{photoOmissionReason:"NOT_APPLICABLE",...changes})),JSON.stringify(changes)).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_report WHERE assignment_id IN ($1,$2,$3)",[blocked.assignmentId,notVisited.assignmentId,c.assignmentId])).toBe(0);
  });
  it("accepts a report and uploads only for the latest required visit; a SCHEDULED FOLLOW_UP visit blocks it (Task7 N2 gate R1)",async()=>{
    const c=await visited();
    const j=await job(c);
    const blocker=(await c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id,
      blockerCode:"FOLLOW_UP_VISIT_REQUIRED",operationalNote:null})).activeBlocker!;
    const k=await job(c);
    await c.vendor.clearBlocker(c.session,blocker.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:k.assignmentVersion,expectedPacketRevisionId:k.currentPacket!.id,operationalNote:null});
    expect(await code(report(c,{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    const second=await confirmed(c);
    expect(await code(report(c,{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    expect(await code(upload(c))).toBe("STATE_CONFLICT");
    const s=await job(c);
    await c.vendor.startVisit(c.session,second.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:s.assignmentVersion,expectedRoundVersion:s.currentRound!.version,expectedPacketRevisionId:s.currentPacket!.id});
    expect(await code(report(c,{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    const latest={...c,appointmentId:second.id};
    expect(await report(latest,{photoOmissionReason:"NOT_APPLICABLE"})).toMatchObject({appointmentId:second.id,revision:1});
  });
  it("attaches only photos of its own initial context and assignment",async()=>{
    const c=await visited();const other=await visited();const foreign=await upload(other);
    expect(await code(report(c,{completionPhotoIds:[foreign.photoId]}))).toBe("STATE_CONFLICT");
    expect(await code(report(c,{completionPhotoIds:[randomUUID()]}))).toBe("STATE_CONFLICT");
    expect(await photos(other.assignmentId)).toEqual([{id:foreign.photoId,disposition:"PENDING"}]);
  });
  it("a changed intent under the same report identity conflicts",async()=>{
    const c=await visited();const input=await reportInput(c,{photoOmissionReason:"NOT_APPLICABLE"});
    await c.vendor.submitCompletionReport(c.session,input as never);
    expect(await code(c.vendor.submitCompletionReport(c.session,{...input,workSummary:"다른 합성 요약"} as never))).toBe("STATE_CONFLICT");
  });
  it("COMPLETION_REPORTED is read-only for blockers, visits, withdraw, scheduling, packet publication, uploads and another report",async()=>{
    const c=await visited();await report(c,{photoOmissionReason:"NOT_APPLICABLE"});
    const j=await job(c);const g={expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id};
    expect(await code(c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),...g,blockerCode:"OTHER",operationalNote:null}))).toBe("STATE_CONFLICT");
    expect(await code(c.vendor.withdraw(c.session,{clientRequestId:randomUUID(),...g,operationalNote:null}))).toBe("STATE_CONFLICT");
    expect(await code(c.vendor.proposeSlots(c.session,{clientRequestId:randomUUID(),...g,expectedRoundVersion:j.currentRound!.version,slots:[{startAt:at(30),endAt:at(31)}]}))).toBe("STATE_CONFLICT");
    expect(await code(tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...g,expectedRoundVersion:j.currentRound!.version,windows:[{startAt:at(30),endAt:at(31)}]}))).not.toBe("success");
    expect(await code(f.manager.publishPacket(f.data.accounts.manager.digest,c.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,
      expectedPacketRevisionId:j.currentPacket!.id,workSummary:"합성 변경",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null}))).toBe("STATE_CONFLICT");
    expect(await code(upload(c))).toBe("STATE_CONFLICT");
    expect(await code(report(c,{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_report WHERE assignment_id=$1",[c.assignmentId])).toBe(1);
    expect(await job(c)).toMatchObject({status:"ACTIVE",phase:"COMPLETION_REPORTED"});
  });
});

describe("Manager review projection and photo authorization (AC37, AC46)",()=>{
  it("serves only selected ATTACHED photos to the Manager and hides PENDING, retained, guessed and foreign ids identically",async()=>{
    const c=await visited();const a=await upload(c),unused=await upload(c);
    const pendingOnly=await visited();const pending=await upload(pendingOnly);
    const manager=f.data.accounts.manager.digest;
    expect(await code(f.manager.completionPhoto(manager,c.ticketId,a.photoId))).toBe("NOT_FOUND");
    await report(c,{completionPhotoIds:[a.photoId]});
    const served=await f.manager.completionPhoto(manager,c.ticketId,a.photoId);
    expect(served.photo).toMatchObject({photoId:a.photoId,mime:"image/png"});
    expect(served.bytes.byteLength).toBe(a.byteSize);
    for(const [ticket,id] of [[c.ticketId,unused.photoId],[c.ticketId,randomUUID()],[pendingOnly.ticketId,pending.photoId],[pendingOnly.ticketId,a.photoId]] as const)
      expect(await code(f.manager.completionPhoto(manager,ticket,id))).toBe("NOT_FOUND");
    expect(await code(f.manager.completionPhoto(f.data.accounts.otherManager.digest,c.ticketId,a.photoId))).toBe("NOT_FOUND");
  });
  it("never exposes reports or completion photos in the Tenant projection",async()=>{
    const c=await visited();const a=await upload(c);await report(c,{completionPhotoIds:[a.photoId]});
    const tenant=await tenantPort.readScheduling(c.tenantDigest,c.ticketId);
    expect(JSON.stringify(tenant).includes(a.photoId)).toBe(false);
    expect("currentReport" in tenant).toBe(false);
  });
});

describe("append-only evidence and final FOLLOW_UP provenance",()=>{
  it("reports are immutable and photos only move PENDING to ATTACHED or UNATTACHED_RETAINED",async()=>{
    const c=await visited();const a=await upload(c);const submitted=await report(c,{completionPhotoIds:[a.photoId]});
    await expect(f.p.admin.query("UPDATE vendor_handoff.completion_report SET work_summary='x' WHERE id=$1",[submitted.id])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
    await expect(f.p.admin.query("DELETE FROM vendor_handoff.completion_report WHERE id=$1",[submitted.id])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
    await expect(f.p.admin.query("UPDATE vendor_handoff.completion_photo SET disposition='PENDING' WHERE id=$1",[a.photoId])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
    await expect(f.p.admin.query("UPDATE vendor_handoff.completion_photo SET bytes='\\x00' WHERE id=$1",[a.photoId])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
    await expect(f.p.admin.query("DELETE FROM vendor_handoff.completion_photo WHERE id=$1",[a.photoId])).rejects.toMatchObject({message:"IMMUTABLE_HISTORY"});
  });
  it("FOLLOW_UP rounds carry exactly one provenance and other purposes none; report provenance must exist for the same assignment",async()=>{
    const c=await visited();const submitted=await report(c,{photoOmissionReason:"NOT_APPLICABLE"});const other=await visited();
    const org=(await f.p.admin.query("SELECT org_id FROM vendor_handoff.vendor_assignment WHERE id=$1",[c.assignmentId])).rows[0].org_id as string;
    // Closed (CANCELLED) rows isolate the provenance constraints from the one-OPEN-round index; `other` has no report.
    const insert=(assignment:string,packet:string,purpose:string,report:string|null)=>f.p.admin.query(
      "INSERT INTO vendor_handoff.scheduling_round(org_id,assignment_id,opened_packet_revision_id,purpose,status,closed_at,source_completion_report_id) VALUES($1,$2,$3,$4,'CANCELLED',clock_timestamp(),$5)",
      [org,assignment,packet,purpose,report]).then(()=>"success",(error:{code?:string})=>error.code);
    expect(await insert(other.assignmentId,other.packetId,"FOLLOW_UP",null)).toBe("23514");
    expect(await insert(other.assignmentId,other.packetId,"INITIAL",submitted.id)).toBe("23514");
    expect(await insert(other.assignmentId,other.packetId,"FOLLOW_UP",submitted.id)).toBe("23503");
    expect(await insert(c.assignmentId,c.packetId,"FOLLOW_UP",submitted.id)).toBe("success");
  });
  it("creates the manager_disposition resource shape without any Task8 disposition rows",async()=>{
    const columns=(await f.p.admin.query("SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema='vendor_handoff' AND table_name='manager_disposition' ORDER BY column_name")).rows;
    expect(columns).toEqual([
      {column_name:"assignment_id",is_nullable:"NO"},{column_name:"completion_report_id",is_nullable:"NO"},{column_name:"consumed_by_report_id",is_nullable:"YES"},
      {column_name:"created_at",is_nullable:"NO"},{column_name:"id",is_nullable:"NO"},{column_name:"kind",is_nullable:"NO"},{column_name:"org_id",is_nullable:"NO"},{column_name:"reason",is_nullable:"YES"},
    ]);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.manager_disposition",[])).toBe(0);
  });
});

describe("Task8 review remediation",()=>{
  async function followUpOpen(c:Visited){
    const j=await job(c);
    const blocker=(await c.vendor.recordBlocker(c.session,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedPacketRevisionId:j.currentPacket!.id,
      blockerCode:"FOLLOW_UP_VISIT_REQUIRED",operationalNote:null})).activeBlocker!;
    const k=await job(c);
    await c.vendor.clearBlocker(c.session,blocker.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:k.assignmentVersion,expectedPacketRevisionId:k.currentPacket!.id,operationalNote:null});
  }
  it("refuses uploads while a FOLLOW_UP round is OPEN and retires every staged photo of the assignment on report (L1)",async()=>{
    const c=await visited();
    const early=await upload(c);
    await followUpOpen(c);
    expect(await code(upload(c))).toBe("STATE_CONFLICT");
    const second=await confirmed(c);
    const s2=await job(c);
    await c.vendor.startVisit(c.session,second.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:s2.assignmentVersion,expectedRoundVersion:s2.currentRound!.version,expectedPacketRevisionId:s2.currentPacket!.id});
    const latest={...c,appointmentId:second.id};
    const kept=await upload(latest);
    await report(latest,{completionPhotoIds:[kept.photoId]});
    expect(await photos(c.assignmentId)).toEqual([{id:early.photoId,disposition:"UNATTACHED_RETAINED"},{id:kept.photoId,disposition:"ATTACHED"}]);
  });
  it("lets exactly one of two concurrent uploads take the tenth slot (L5)",async()=>{
    const c=await visited();
    for(let i=0;i<9;i++)await upload(c);
    const results=await Promise.all([code(upload(c)),code(upload(c))]);
    expect(results.sort()).toEqual(["STATE_CONFLICT","success"]);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_photo WHERE assignment_id=$1",[c.assignmentId])).toBe(10);
  });
  it("lets exactly one of two concurrent reports become current (L5)",async()=>{
    const c=await visited();
    const results=await Promise.all([code(report(c,{photoOmissionReason:"NOT_APPLICABLE"})),code(report(c,{photoOmissionReason:"TECHNICAL_FAILURE"}))]);
    expect(results.sort()).toEqual(["STATE_CONFLICT","success"]);
    expect(await count("SELECT count(*)::int AS n FROM vendor_handoff.completion_report WHERE assignment_id=$1",[c.assignmentId])).toBe(1);
  });
  it("never leaves an upload that raced a report staged after the report committed (L5)",async()=>{
    const c=await visited();const first=await upload(c);
    const [uploaded,reported]=await Promise.all([code(upload(c)),code(report(c,{completionPhotoIds:[first.photoId]}))]);
    expect(reported).toBe("success");
    expect(["success","STATE_CONFLICT"]).toContain(uploaded);
    expect((await photos(c.assignmentId)).filter(p=>p.disposition==="PENDING")).toEqual([]);
  });
  it("hides another assignment's completion photo from the Vendor own read (L5)",async()=>{
    const c=await visited();const other=await visited();
    const foreign=await upload(other);
    await expect(c.vendor.readCompletionPhoto(c.session,foreign.photoId)).rejects.toMatchObject({code:"NOT_FOUND"});
    expect((await other.vendor.readCompletionPhoto(other.session,foreign.photoId)).photo.photoId).toBe(foreign.photoId);
  });
});

async function waitForTicketWait(){
  for(let attempt=0;attempt<200;attempt++){
    await f.p.admin.query("SELECT pg_stat_clear_snapshot()");
    const {rows}=await f.p.admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%vendor_handoff%'");
    if(rows[0].n>0)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error("Expected real source-ticket lock wait was not observed");
}

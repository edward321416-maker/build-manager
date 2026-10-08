import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createHash,randomBytes,randomUUID } from "node:crypto";
import { ManagerVendorHandoffDtoSchema, VendorReassignCommandSchema, VendorRequestCorrectionCommandSchema } from "@build-manager/api-contracts";
import type { SanitizedVendorPhoto } from "@build-manager/application";
import { createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { performCoreAction } from "@build-manager/application";

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
  return {assignmentId,packetId,session,csrf,vendor,ticketId:p.t.ticket.id,tenantDigest:f.data.accounts[tenant].digest};
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
    const {rows}=await f.p.admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND (query LIKE '%vendor_handoff%' OR query LIKE '%core_flow%')");
    if(rows[0].n>0)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error("Expected real source-ticket lock wait was not observed");
}

// Task9 RED matrix: real adapter/SQL behavior; failures never print session or CSRF material.
const managerDigest=()=>f.data.accounts.manager.digest;
const handoff=(c:Ctx)=>f.manager.readHandoff(managerDigest(),c.ticketId);
async function dispositionInput(c:Ctx){const h=await handoff(c);return {clientRequestId:randomUUID(),expectedAssignmentVersion:h.assignment!.version,expectedCompletionReportId:h.currentReport!.id};}
async function reportedVisit(){const c=await visited();const p=await upload(c);const r=await report(c,{completionPhotoIds:[p.photoId]});return {...c,initialPhoto:p,initialReport:r};}
async function correction(c:Ctx){return f.manager.requestCorrection(managerDigest(),c.assignmentId,{...await dispositionInput(c),reason:"사진과 설명을 수정해 주세요"});}
async function correctionRow(c:Ctx){return (await f.p.admin.query("SELECT id,completion_report_id,consumed_by_report_id FROM vendor_handoff.manager_disposition WHERE assignment_id=$1 AND kind='REQUEST_CORRECTION' ORDER BY created_at DESC",[c.assignmentId])).rows[0];}
async function closeoutInput(c:Ctx){return {...await dispositionInput(c),expectedCommunicationVersion:0,message:"관리자가 현장을 확인했습니다"};}
async function directComplete(ticketId:string){return createCoreFlowPort(f.managerDatabase).run(managerDigest(),s=>performCoreAction(s,{type:"HANDLING",ticketId,status:"COMPLETED",message:"관리자가 확인한 처리 내용",expectedCommunicationVersion:0},{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));}
async function endInput(c:Ctx){return {clientRequestId:randomUUID(),expectedAssignmentVersion:(await handoff(c)).assignment!.version};}
async function lockTicket(c:Ctx){await f.p.admin.query("BEGIN");await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE",[c.ticketId]);}
async function lockedManagerEnd(c:Ctx,kind:"revoke"|"reassign",input:{clientRequestId:string;expectedAssignmentVersion:number}){
  await f.p.admin.query("SET LOCAL ROLE bm_b1_web");await f.p.admin.query("SELECT core_flow.session($1)",[Buffer.from(managerDigest(),"hex")]);
  const args=[Buffer.from(managerDigest(),"hex"),c.assignmentId,input.clientRequestId,input.expectedAssignmentVersion];
  await f.p.admin.query(kind==="revoke"?"SELECT vendor_handoff.manager_revoke($1,$2,$3,$4)":"SELECT vendor_handoff.manager_reassign($1,$2,$3,$4,'합성 새 업체')",args);
  await f.p.admin.query("RESET ROLE");
}
async function assertEnded(c:Ctx,reason:string){
  expect((await f.p.admin.query("SELECT status,end_reason FROM vendor_handoff.vendor_assignment WHERE id=$1",[c.assignmentId])).rows).toEqual([{status:"ENDED",end_reason:reason}]);
  expect(await count("SELECT count(*)::int n FROM vendor_handoff.scheduling_round WHERE assignment_id=$1 AND status='OPEN'",[c.assignmentId])).toBe(0);
  expect(await count("SELECT count(*)::int n FROM vendor_handoff.appointment WHERE assignment_id=$1 AND status='SCHEDULED'",[c.assignmentId])).toBe(0);
  expect(await code(job(c))).toBe("UNAUTHENTICATED");
}

describe("Task9 review text contract",()=>{
  it("T9-M01 matches the API trim/control boundary across every Cc/Cf code point and ECMAScript whitespace",async()=>{
    const values=new Set<string>(["valid", "one\r\ntwo", "x".repeat(501)]);
    for(let cp=1;cp<=0x10ffff;cp++){
      const ch=String.fromCodePoint(cp);
      if(/[\p{Cc}\p{Cf}]/u.test(ch)){values.add(`a${ch}b`);values.add(ch);}
      if(ch.trim()===""){values.add(ch);values.add(`${ch}valid${ch}`);}
    }
    const samples=[...values];
    const rows=(await f.p.admin.query("SELECT value,vendor_handoff.plain_text(value,500) AS accepted FROM unnest($1::text[]) value",[samples])).rows;
    const input={clientRequestId:randomUUID(),expectedAssignmentVersion:1,expectedCompletionReportId:randomUUID()};
    expect(rows.filter(row=>row.accepted!==VendorRequestCorrectionCommandSchema.safeParse({...input,reason:row.value}).success).map(row=>[...row.value].map(ch=>ch.codePointAt(0)!.toString(16)).join("-"))).toEqual([]);
  });
  it.each(["\u{110bd}","\u{e0001}","\u{e0020}","\u00a0","\n\r","\u2028\u2029"])("T9-M01 invalid label/reason %# leaves no assignment, disposition or receipt and parseable DTOs",async bad=>{
    const c=await accepted(),input={...await endInput(c),vendorLabel:bad};
    expect(VendorReassignCommandSchema.safeParse(input).success).toBe(false);
    const before=await handoff(c);
    expect(await code(f.manager.reassign(managerDigest(),c.assignmentId,input))).toBe("INVALID_INPUT");
    expect(await handoff(c)).toEqual(before);
    expect(ManagerVendorHandoffDtoSchema.safeParse(await handoff(c)).success).toBe(true);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1",[c.ticketId])).toBe(1);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[input.clientRequestId])).toBe(0);
    const reported=await reportedVisit(),reason={...await dispositionInput(reported),reason:bad};
    expect(await code(f.manager.requestCorrection(managerDigest(),reported.assignmentId,reason))).toBe("INVALID_INPUT");
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.manager_disposition WHERE assignment_id=$1",[reported.assignmentId])).toBe(0);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[reason.clientRequestId])).toBe(0);
    expect((await handoff(reported)).assignment!.version).toBe(reason.expectedAssignmentVersion);
    expect(ManagerVendorHandoffDtoSchema.safeParse(await handoff(reported)).success).toBe(true);
  });
  it("T9-M01 normalizes Unicode edge whitespace, retains legitimate multiline reason and safely replays normalized intent",async()=>{
    const c=await accepted(),input={...await endInput(c),vendorLabel:"\u00a0\n새 업체\ufeff"};
    const result=await f.manager.reassign(managerDigest(),c.assignmentId,input);
    expect(result.assignment!.vendorLabel).toBe("새 업체");
    expect(await f.manager.reassign(managerDigest(),c.assignmentId,{...input,vendorLabel:"새 업체"})).toEqual(result);
    expect(ManagerVendorHandoffDtoSchema.safeParse(result).success).toBe(true);
    const r=await reportedVisit(),reason={...await dispositionInput(r),reason:"\u00a0\n첫 줄\r\n둘째 줄\u3000"};
    const first=await f.manager.requestCorrection(managerDigest(),r.assignmentId,reason);
    expect(first.correctionRequest!.reason).toBe("첫 줄\r\n둘째 줄");
    expect(await f.manager.requestCorrection(managerDigest(),r.assignmentId,{...reason,reason:"첫 줄\r\n둘째 줄"})).toEqual(first);
    expect(ManagerVendorHandoffDtoSchema.safeParse(first).success).toBe(true);
  });
});

describe("Task9 correction identity and one-way consumption",()=>{
  it("T9-C01 concurrent requests leave exactly one durable unresolved correction and exact/changed replays reconcile",async()=>{
    const c=await reportedVisit(),input={...await dispositionInput(c),reason:"설명을 수정해 주세요"};
    const competing={...input,clientRequestId:randomUUID()};
    const results=await Promise.all([code(f.manager.requestCorrection(managerDigest(),c.assignmentId,input)),code(f.manager.requestCorrection(managerDigest(),c.assignmentId,competing))]);
    const winner=results[0]==="success"?input:competing;
    expect([...results].sort()).toEqual(["STATE_CONFLICT","success"]);
    const first=await correctionRow(c);expect(first.completion_report_id).toBe(c.initialReport.id);expect(first.consumed_by_report_id).toBeNull();
    await f.manager.requestCorrection(managerDigest(),c.assignmentId,winner);expect((await correctionRow(c)).id).toBe(first.id);
    expect(await code(f.manager.requestCorrection(managerDigest(),c.assignmentId,{...winner,reason:"다른 의도"}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.manager_disposition WHERE assignment_id=$1 AND consumed_by_report_id IS NULL",[c.assignmentId])).toBe(1);
    expect(await handoff(c)).toMatchObject({phase:"COMPLETION_REPORTED",waitingOn:"VENDOR",currentReport:{id:c.initialReport.id}});
  });
  it("T9-C02 stale report IDs and blank/control/overlong reasons leave no disposition",async()=>{
    const c=await reportedVisit(),input=await dispositionInput(c);
    expect(await code(f.manager.requestCorrection(managerDigest(),c.assignmentId,{...input,expectedCompletionReportId:randomUUID(),reason:"합성 수정"}))).toBe("STATE_CONFLICT");
    for(const reason of [" ","x".repeat(501),"합성\u0001사유"]){expect(await code(f.manager.requestCorrection(managerDigest(),c.assignmentId,{...input,clientRequestId:randomUUID(),reason}))).toBe("INVALID_INPUT");}
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.manager_disposition WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
  });
  it("T9-C03 unresolved correction blocks closeout/MORE_WORK and preserves report/read-only unrelated commands",async()=>{
    const c=await reportedVisit();await correction(c);
    expect(await code(f.manager.closeout(managerDigest(),c.assignmentId,await closeoutInput(c)))).toBe("STATE_CONFLICT");
    expect(await code(f.manager.requireFollowUp(managerDigest(),c.assignmentId,await dispositionInput(c)))).toBe("STATE_CONFLICT");
    expect(await code(f.manager.revoke(managerDigest(),c.assignmentId,await endInput(c)))).toBe("STATE_CONFLICT");
    expect(await code(f.manager.reassign(managerDigest(),c.assignmentId,{...await endInput(c),vendorLabel:"다른 업체"}))).toBe("STATE_CONFLICT");
    expect(await ticketStatus(c.ticketId)).toBe("IN_PROGRESS");expect((await handoff(c)).currentReport!.id).toBe(c.initialReport.id);
  });
  it("T9-C04 exact correction reuses ATTACHED plus current PENDING, preserves old report and consumes once",async()=>{
    const c=await reportedVisit();await correction(c);const d=await correctionRow(c),image=photo(),input=await uploadInput(c,{expectedCorrectionRequestId:d.id});
    const fresh=await c.vendor.uploadCompletionPhoto(c.session,input,image);
    const corrected=await report(c,{expectedCorrectionRequestId:d.id,supersedesReportId:c.initialReport.id,completionPhotoIds:[c.initialPhoto.photoId,fresh.photoId],workSummary:"수정한 작업 설명"});
    expect(corrected).toMatchObject({revision:2,supersedesReportId:c.initialReport.id});expect((await correctionRow(c)).consumed_by_report_id).toBe(corrected.id);
    expect((await handoff(c)).reportHistory.map(r=>r.id)).toEqual([c.initialReport.id,corrected.id]);
    expect((await c.vendor.uploadCompletionPhoto(c.session,input,image)).photoId).toBe(fresh.photoId);
    expect(await code(upload(c,photo(),{expectedCorrectionRequestId:d.id}))).toBe("STATE_CONFLICT");
    expect(await code(report(c,{expectedCorrectionRequestId:d.id,supersedesReportId:corrected.id,completionPhotoIds:[fresh.photoId]}))).toBe("STATE_CONFLICT");
    await expect(f.p.admin.query("UPDATE vendor_handoff.manager_disposition SET consumed_by_report_id=NULL WHERE id=$1",[d.id])).rejects.toMatchObject({code:"P0001"});
    for(const id of [c.initialPhoto.photoId,fresh.photoId])expect((await f.manager.completionPhoto(managerDigest(),c.ticketId,id)).photo.photoId).toBe(id);
  });
  it("T9-C05 null/wrong/cross-assignment upload contexts never create a photo; correction cap is ten",async()=>{
    const c=await reportedVisit(),other=await reportedVisit();await correction(c);await correction(other);const d=await correctionRow(c),foreign=await correctionRow(other);
    for(const expectedCorrectionRequestId of [null,randomUUID(),foreign.id])expect(await code(upload(c,photo(),{expectedCorrectionRequestId}))).toBe("STATE_CONFLICT");
    expect((await photos(c.assignmentId)).length).toBe(1);
    for(let i=0;i<10;i++)await upload(c,photo(),{expectedCorrectionRequestId:d.id});
    expect(await code(upload(c,photo(),{expectedCorrectionRequestId:d.id}))).toBe("STATE_CONFLICT");
  });
  it("T9-C06 correction A unused photos cannot satisfy B and Manager cannot read staged or retained evidence",async()=>{
    const c=await reportedVisit();await correction(c);const a=await correctionRow(c),unused=await upload(c,photo(),{expectedCorrectionRequestId:a.id});
    expect(await code(f.manager.completionPhoto(managerDigest(),c.ticketId,unused.photoId))).toBe("NOT_FOUND");
    const r=await report(c,{expectedCorrectionRequestId:a.id,supersedesReportId:c.initialReport.id,completionPhotoIds:[c.initialPhoto.photoId]});
    await correction(c);const b=await correctionRow(c);
    expect(await code(report(c,{expectedCorrectionRequestId:b.id,supersedesReportId:r.id,completionPhotoIds:[unused.photoId]}))).toBe("STATE_CONFLICT");
    expect(await code(upload(c,photo(),{expectedCorrectionRequestId:a.id}))).toBe("STATE_CONFLICT");
    expect(await code(f.manager.completionPhoto(managerDigest(),c.ticketId,unused.photoId))).toBe("NOT_FOUND");
    expect(await code(f.manager.completionPhoto(c.tenantDigest,c.ticketId,c.initialPhoto.photoId))).toBe("NOT_FOUND");
  });
  it("T9-C07 same-org/same-assignment constraints reject foreign reports/photos and consumption cannot name an unrelated report",async()=>{
    const c=await reportedVisit(),other=await reportedVisit();await correction(c);const d=await correctionRow(c);
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.manager_disposition(org_id,assignment_id,completion_report_id,kind,reason) SELECT org_id,id,$2,'REQUEST_CORRECTION','합성 사유' FROM vendor_handoff.vendor_assignment WHERE id=$1",[other.assignmentId,c.initialReport.id])).rejects.toMatchObject({code:"23503"});
    await expect(f.p.admin.query("UPDATE vendor_handoff.manager_disposition SET consumed_by_report_id=$2 WHERE id=$1",[d.id,other.initialReport.id])).rejects.toMatchObject({code:"P0001"});
    expect((await correctionRow(c)).consumed_by_report_id).toBeNull();
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.manager_disposition(org_id,assignment_id,completion_report_id,kind,reason) VALUES($1,$2,$3,'REQUEST_CORRECTION','합성 사유')",[f.data.orgB,c.assignmentId,c.initialReport.id])).rejects.toMatchObject({code:"23503"});
    await correction(other);const foreign=await correctionRow(other);
    await expect(f.p.admin.query("INSERT INTO vendor_handoff.completion_photo(org_id,assignment_id,appointment_id,packet_revision_id,correction_request_id,mime,byte_size,width,height,sha256,bytes) SELECT org_id,assignment_id,appointment_id,packet_revision_id,$2,mime,byte_size,width,height,sha256,bytes FROM vendor_handoff.completion_photo WHERE id=$1",[c.initialPhoto.photoId,foreign.id])).rejects.toMatchObject({code:"23503"});
  });
  it("T9-C08 MORE_WORK preserves the report/visit and requires a new FOLLOW_UP visit before next revision",async()=>{
    const c=await reportedVisit();const h=await f.manager.requireFollowUp(managerDigest(),c.assignmentId,await dispositionInput(c));
    expect(h.currentRound).toMatchObject({purpose:"FOLLOW_UP",status:"OPEN"});
    expect((await f.p.admin.query("SELECT source_completion_report_id FROM vendor_handoff.scheduling_round WHERE id=$1",[h.currentRound!.id])).rows[0].source_completion_report_id).toBe(c.initialReport.id);
    expect(h.appointment).toMatchObject({id:c.appointmentId,status:"OCCURRED"});expect(h.currentReport!.id).toBe(c.initialReport.id);
    expect(await code(report(c,{photoOmissionReason:"NOT_APPLICABLE"}))).toBe("STATE_CONFLICT");
    const next=await confirmed(c),j=await job(c);await c.vendor.startVisit(c.session,next.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedRoundVersion:j.currentRound!.version,expectedPacketRevisionId:c.packetId});
    const r=await report({...c,appointmentId:next.id},{photoOmissionReason:"NOT_APPLICABLE"});
    expect(r).toMatchObject({revision:2,appointmentId:next.id,supersedesReportId:null});expect((await handoff(c)).reportHistory).toHaveLength(2);
  });
});

describe("Task9 closeout and ordinary Core completion",()=>{
  it("T9-K01 closeout atomically completes the ticket, closes/revokes assignment and replays without a second HANDLING event",async()=>{
    const c=await reportedVisit(),input=await closeoutInput(c);const result=await f.manager.closeout(managerDigest(),c.assignmentId,input);
    expect(result.assignment).toMatchObject({status:"ENDED",endReason:"CLOSED"});expect(await ticketStatus(c.ticketId)).toBe("COMPLETED");await assertEnded(c,"CLOSED");
    expect((await f.manager.closeout(managerDigest(),c.assignmentId,input)).assignment).toEqual(result.assignment);
    expect(await code(f.manager.closeout(managerDigest(),c.assignmentId,{...input,message:"변경한 의도"}))).toBe("STATE_CONFLICT");
    expect(await count("SELECT count(*)::int n FROM core_flow.ticket_event WHERE ticket_id=$1 AND message=$2",[c.ticketId,input.message])).toBe(1);
  });
  it.each(["communication-first","closeout-first"])("T9-K02 %s uses the source lock and has no partial public message or closeout",async order=>{
    const c=await reportedVisit(),input=await closeoutInput(c);await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{
      if(order==="communication-first"){
        pending=code(f.manager.closeout(managerDigest(),c.assignmentId,input));await waitForTicketWait();
        await f.p.admin.query("SET LOCAL ROLE bm_b1_web");await f.p.admin.query("SELECT core_flow.session($1)",[Buffer.from(managerDigest(),"hex")]);await f.p.admin.query("SELECT core_flow.send_communication($1,$2,$3,0,'TENANT_MESSAGE','합성 추가 설명')",[Buffer.from(c.tenantDigest,"hex"),c.ticketId,randomUUID()]);
      }else{
        pending=code(createCoreFlowPort(f.managerDatabase).run(c.tenantDigest,s=>s.communication.send(c.ticketId,{clientRequestId:randomUUID(),expectedVersion:0,intent:"TENANT_MESSAGE",body:"합성 추가 설명"})));
        await waitForTicketWait();await f.p.admin.query("SET LOCAL ROLE bm_b1_web");await f.p.admin.query("SELECT core_flow.session($1)",[Buffer.from(managerDigest(),"hex")]);await f.p.admin.query("SELECT vendor_handoff.closeout($1,$2,$3,$4,$5,$6,$7)",[Buffer.from(managerDigest(),"hex"),c.assignmentId,input.clientRequestId,input.expectedAssignmentVersion,input.expectedCompletionReportId,0,input.message]);
      }
      await f.p.admin.query("COMMIT");expect(await pending).toBe("STATE_CONFLICT");
      expect(await ticketStatus(c.ticketId)).toBe(order==="closeout-first"?"COMPLETED":"IN_PROGRESS");
      expect(await count("SELECT count(*)::int n FROM core_flow.ticket_public_message WHERE ticket_id=$1",[c.ticketId])).toBe(order==="closeout-first"?0:1);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it("T9-K03 Manager membership revoked while waiting prevents closeout",async()=>{
    const c=await reportedVisit(),input=await closeoutInput(c),events=await count("SELECT count(*)::int n FROM core_flow.ticket_event WHERE ticket_id=$1",[c.ticketId]);await lockTicket(c);let pending:Promise<string|undefined>|undefined;let membership:string|undefined;
    try{pending=code(f.manager.closeout(managerDigest(),c.assignmentId,input));await waitForTicketWait();
      membership=f.data.accounts.manager.membershipId;
      expect(membership).toBeDefined();await f.p.admin.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[membership]);await f.p.admin.query("COMMIT");
      expect(await pending).toBe("FORBIDDEN");expect(await ticketStatus(c.ticketId)).toBe("IN_PROGRESS");
      expect(await count("SELECT count(*)::int n FROM vendor_handoff.manager_disposition WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
      expect(await count("SELECT count(*)::int n FROM core_flow.ticket_event WHERE ticket_id=$1",[c.ticketId])).toBe(events);
      expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[input.clientRequestId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;if(membership)await f.p.admin.query("UPDATE app.organization_membership SET status='ACTIVE',ended_at=NULL WHERE id=$1",[membership]);}
  });
  it("T9-K04 a changed current report while closeout waits refuses the stale report without partial completion",async()=>{
    const c=await reportedVisit(),input=await closeoutInput(c),correctionInput={...await dispositionInput(c),reason:"합성 수정"};
    expect((await handoff(c)).correctionRequest).toBeNull();await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(f.manager.closeout(managerDigest(),c.assignmentId,input));await waitForTicketWait();
      await f.p.admin.query("SET LOCAL ROLE bm_b1_web");await f.p.admin.query("SELECT core_flow.session($1)",[Buffer.from(managerDigest(),"hex")]);
      await f.p.admin.query("SELECT vendor_handoff.manager_request_correction($1,$2,$3,$4,$5,$6)",[Buffer.from(managerDigest(),"hex"),c.assignmentId,correctionInput.clientRequestId,correctionInput.expectedAssignmentVersion,c.initialReport.id,correctionInput.reason]);
      await f.p.admin.query("RESET ROLE");const d=await correctionRow(c);
      await f.p.admin.query("SET LOCAL ROLE bm_vendor_web");
      await f.p.admin.query("SELECT vendor_handoff.submit_completion_report($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",[Buffer.from(c.session,"hex"),Buffer.from(c.csrf,"hex"),randomUUID(),input.expectedAssignmentVersion+1,c.packetId,c.appointmentId,d.id,c.initialReport.id,"수정한 합성 설명",null,[c.initialPhoto.photoId],null]);
      await f.p.admin.query("COMMIT");expect(await pending).toBe("STATE_CONFLICT");expect(await ticketStatus(c.ticketId)).toBe("IN_PROGRESS");expect((await handoff(c)).currentReport!.revision).toBe(2);
      expect(await count("SELECT count(*)::int n FROM vendor_handoff.manager_disposition WHERE assignment_id=$1 AND kind='CLOSEOUT'",[c.assignmentId])).toBe(0);
      expect(await count("SELECT count(*)::int n FROM core_flow.ticket_event WHERE ticket_id=$1 AND message=$2",[c.ticketId,input.message])).toBe(0);
      expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[input.clientRequestId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it("T9-D01 active assignment blocks the actual application completion path without a partial ticket event",async()=>{
    const c=await accepted();const before=await count("SELECT count(*)::int n FROM core_flow.ticket_event WHERE ticket_id=$1",[c.ticketId]);
    expect(await code(directComplete(c.ticketId))).toBe("STATE_CONFLICT");expect(await ticketStatus(c.ticketId)).toBe("IN_PROGRESS");expect(await count("SELECT count(*)::int n FROM core_flow.ticket_event WHERE ticket_id=$1",[c.ticketId])).toBe(before);
  });
  it.each(["none","ended"])("T9-D02 %s assignment preserves existing direct Manager completion",async kind=>{
    const c=await accepted();await f.manager.revoke(managerDigest(),c.assignmentId,await endInput(c));
    const ticketId=kind==="ended"?c.ticketId:(await f.ticket()).ticket.id;
    if(kind==="none")await createCoreFlowPort(f.managerDatabase).run(managerDigest(),s=>performCoreAction(s,{type:"HANDLING",ticketId,status:"IN_PROGRESS",message:"합성 시작"},{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
    expect((await directComplete(ticketId)).workStatus).toBe("COMPLETED");
  });
  it.each(["DECLINED","SUPERSEDED"] as const)("T9-D02 %s history without a current assignment permits direct Manager completion",async reason=>{
    let ticketId:string;
    if(reason==="DECLINED"){
      const p=await f.published(),assignmentId=p.handoff.assignment!.id,packetId=p.handoff.currentPacket!.id;
      const link=await f.manager.issueLink(managerDigest(),assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:packetId});
      const session=hash("session"),csrf=hash("csrf");await f.external.redeem(sha(link.link!.split("#")[1]),randomUUID(),session,csrf);
      await f.externalWith(csrf).decline(session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId,reason:"NO_CAPACITY",operationalNote:null});ticketId=p.t.ticket.id;
    }else{
      const c=await accepted();ticketId=c.ticketId;
      const next=await f.manager.reassign(managerDigest(),c.assignmentId,{...await endInput(c),vendorLabel:"합성 대체 업체"});
      await f.manager.revoke(managerDigest(),next.assignment!.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:next.assignment!.version});
    }
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1 AND end_reason=$2",[ticketId,reason])).toBe(1);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1 AND status<>'ENDED'",[ticketId])).toBe(0);
    expect((await directComplete(ticketId)).workStatus).toBe("COMPLETED");
  });
  it.each(["direct-first","assignment-first"])("T9-D03 %s lock race leaves exactly one action and no partial state",async order=>{
    const t=await f.ticket(),ticketId=t.ticket.id;await createCoreFlowPort(f.managerDatabase).run(managerDigest(),s=>performCoreAction(s,{type:"HANDLING",ticketId,status:"IN_PROGRESS",message:"합성 시작"},{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
    const version=(await f.p.admin.query("SELECT version FROM core_flow.ticket WHERE id=$1",[ticketId])).rows[0].version;await f.p.admin.query("BEGIN");await f.p.admin.query("SELECT id FROM core_flow.ticket WHERE id=$1 FOR UPDATE",[ticketId]);let pending:Promise<string|undefined>|undefined;
    try{pending=order==="direct-first"?code(f.manager.createAssignment(managerDigest(),ticketId,{clientRequestId:randomUUID(),expectedTicketVersion:Number(version),vendorLabel:"합성 업체"})):code(directComplete(ticketId));await waitForTicketWait();await f.p.admin.query("SET LOCAL ROLE bm_b1_web");await f.p.admin.query("SELECT core_flow.session($1)",[Buffer.from(managerDigest(),"hex")]);
      if(order==="direct-first"){
        await f.p.admin.query("SELECT core_flow.guard_communication_completion($1,$2,0)",[Buffer.from(managerDigest(),"hex"),ticketId]);await f.p.admin.query("SELECT vendor_handoff.guard_direct_completion($1,$2)",[Buffer.from(managerDigest(),"hex"),ticketId]);
        await f.p.admin.query("SELECT core_flow.store_ticket($1,$2,'HANDLING','합성 완료','COMPLETED')",[Buffer.from(managerDigest(),"hex"),JSON.stringify(t.ticket)]);
      }else await f.p.admin.query("SELECT vendor_handoff.manager_create_assignment($1,$2,$3,$4,'합성 업체')",[Buffer.from(managerDigest(),"hex"),ticketId,randomUUID(),version]);
      await f.p.admin.query("COMMIT");expect(await pending).toBe("STATE_CONFLICT");expect(await ticketStatus(ticketId)).toBe(order==="direct-first"?"COMPLETED":"IN_PROGRESS");expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1",[ticketId])).toBe(order==="direct-first"?0:1);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
});

describe("Task9 Manager end commands and source-ticket races",()=>{
  it.each(["revoke","reassign"] as const)("T9-E01 %s ends access and actionable scheduling, exact replay creates no duplicate replacement",async kind=>{
    const c=await accepted();const appt=await confirmed(c),input={...await endInput(c),vendorLabel:"합성 새 업체"};
    const first=kind==="revoke"?await f.manager.revoke(managerDigest(),c.assignmentId,input):await f.manager.reassign(managerDigest(),c.assignmentId,input);
    await assertEnded(c,kind==="revoke"?"REVOKED":"SUPERSEDED");
    expect((await f.p.admin.query("SELECT status FROM vendor_handoff.appointment WHERE id=$1",[appt.id])).rows[0].status).toBe(kind==="revoke"?"CANCELLED":"SUPERSEDED");
    const replay=kind==="revoke"?await f.manager.revoke(managerDigest(),c.assignmentId,input):await f.manager.reassign(managerDigest(),c.assignmentId,input);expect(replay.assignment?.id).toBe(first.assignment?.id);
    if(kind==="reassign")expect(first.assignment).toMatchObject({status:"PREPARING",vendorLabel:"합성 새 업체"});
  });
  it("T9-E01 concurrent Reassign commits one current replacement and no losing receipt (AC04)",async()=>{
    const c=await accepted(),input={...await endInput(c),vendorLabel:"합성 새 업체"},other={...input,clientRequestId:randomUUID()};
    const results=await Promise.all([code(f.manager.reassign(managerDigest(),c.assignmentId,input)),code(f.manager.reassign(managerDigest(),c.assignmentId,other))]);
    expect([...results].sort()).toEqual(["STATE_CONFLICT","success"]);
    const winner=results[0]==="success"?input:other,loser=results[0]==="success"?other:input;
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1 AND status<>'ENDED'",[c.ticketId])).toBe(1);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_assignment WHERE ticket_id=$1",[c.ticketId])).toBe(2);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[winner.clientRequestId])).toBe(1);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[loser.clientRequestId])).toBe(0);
    expect((await handoff(c)).assignment!.status).toBe("PREPARING");
  });
  it("T9-E02 Reassign preserves OCCURRED/work/report history after MORE_WORK, superseding only OPEN scheduling",async()=>{
    const c=await reportedVisit();await f.manager.requireFollowUp(managerDigest(),c.assignmentId,await dispositionInput(c));const next=await f.manager.reassign(managerDigest(),c.assignmentId,{...await endInput(c),vendorLabel:"합성 새 업체"});
    expect(next.assignment?.status).toBe("PREPARING");await assertEnded(c,"SUPERSEDED");
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.completion_report WHERE assignment_id=$1",[c.assignmentId])).toBe(1);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.appointment WHERE assignment_id=$1 AND status='OCCURRED'",[c.assignmentId])).toBe(1);
    expect(await count("SELECT count(*)::int n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(1);
  });
  it.each(["revoke","reassign"] as const)("T9-R01 %s wins ticket wait against proposal; no subordinate mutation/receipt",async kind=>{
    const c=await accepted();await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:at(24),endAt:at(28)}]});
    const input={clientRequestId:randomUUID(),...await tenantGuards(c),slots:[{startAt:at(25),endAt:at(26)}]},end=await endInput(c);await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(c.vendor.proposeSlots(c.session,input));await waitForTicketWait();await lockedManagerEnd(c,kind,end);await f.p.admin.query("COMMIT");expect(await pending).toBe("UNAUTHENTICATED");await assertEnded(c,kind==="revoke"?"REVOKED":"SUPERSEDED");
      expect(await count("SELECT count(*)::int n FROM vendor_handoff.vendor_slot_proposal WHERE assignment_id=$1",[c.assignmentId])).toBe(0);expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[input.clientRequestId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it.each(["revoke","reassign"] as const)("T9-R02 %s wins real ticket wait against upload, leaving no new photo or receipt",async kind=>{
    const c=await visited(),input=await uploadInput(c),end=await endInput(c);await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(c.vendor.uploadCompletionPhoto(c.session,input,photo()));await waitForTicketWait();await lockedManagerEnd(c,kind,end);await f.p.admin.query("COMMIT");expect(await pending).toBe("UNAUTHENTICATED");expect(await photos(c.assignmentId)).toEqual([]);expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[input.clientRequestId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it.each(["revoke","reassign"] as const)("T9-R03 upload-first retains only committed history before %s revokes access",async kind=>{
    const c=await visited(),p=await upload(c),input={...await endInput(c),vendorLabel:"합성 새 업체"};
    if(kind==="revoke")await f.manager.revoke(managerDigest(),c.assignmentId,input);else await f.manager.reassign(managerDigest(),c.assignmentId,input);
    expect(await photos(c.assignmentId)).toHaveLength(1);expect(await code(c.vendor.readCompletionPhoto(c.session,p.photoId))).toBe("UNAUTHENTICATED");
  });
  it("T9-R04 Tenant confirm waits behind Reassign and cannot add an old actionable Appointment",async()=>{
    const c=await accepted();await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:at(24),endAt:at(28)}]});
    const proposed=await c.vendor.proposeSlots(c.session,{clientRequestId:randomUUID(),...await tenantGuards(c),slots:[{startAt:at(25),endAt:at(26)}]});
    const input={clientRequestId:randomUUID(),...await tenantGuards(c),proposalId:proposed.proposal!.id,selectedSlotId:proposed.proposal!.slots[0].id},end=await endInput(c);await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(tenantPort.confirmSlot(c.tenantDigest,c.ticketId,input));await waitForTicketWait();await lockedManagerEnd(c,"reassign",end);await f.p.admin.query("COMMIT");expect(await pending).toBe("NOT_FOUND");await assertEnded(c,"SUPERSEDED");expect(await count("SELECT count(*)::int n FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it("T9-R05 preauthorized selection waits behind Reassign and cannot add an old Appointment",async()=>{
    const p=await f.published("manager","tenant",{accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED"}),assignmentId=p.handoff.assignment!.id,packetId=p.handoff.currentPacket!.id;
    const link=await f.manager.issueLink(managerDigest(),assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:packetId});const session=hash("s"),csrf=hash("c"),vendor=f.externalWith(csrf);await f.external.redeem(sha(link.link!.split("#")[1]),randomUUID(),session,csrf);await vendor.accept(session,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:packetId});
    const c={assignmentId,packetId,session,csrf,vendor,ticketId:p.t.ticket.id,tenantDigest:f.data.accounts.tenant.digest};
    const s=await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:at(24),endAt:at(28)}]});
    await tenantPort.authorizeEntry(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),availabilitySubmissionId:s.availability!.id,selectedWindowIds:[s.availability!.windows[0].id]});
    const input={clientRequestId:randomUUID(),...await tenantGuards(c),availabilitySubmissionId:s.availability!.id,selectedWindowId:s.availability!.windows[0].id,startAt:at(25),endAt:at(26)},end=await endInput(c);await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(c.vendor.selectPreauthorizedSlot(c.session,input));await waitForTicketWait();await lockedManagerEnd(c,"reassign",end);await f.p.admin.query("COMMIT");expect(await pending).toBe("UNAUTHENTICATED");expect(await count("SELECT count(*)::int n FROM vendor_handoff.appointment WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it("T9-R06 VISIT_STARTED waits behind Revoke and cannot create OCCURRED history",async()=>{
    const c=await accepted(),a=await confirmed(c),j=await job(c),end=await endInput(c);await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(c.vendor.startVisit(c.session,a.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:j.assignmentVersion,expectedRoundVersion:j.currentRound!.version,expectedPacketRevisionId:c.packetId}));await waitForTicketWait();await lockedManagerEnd(c,"revoke",end);await f.p.admin.query("COMMIT");expect(await pending).toBe("UNAUTHENTICATED");expect(await count("SELECT count(*)::int n FROM vendor_handoff.work_event WHERE assignment_id=$1",[c.assignmentId])).toBe(0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it.each(["reassign","closeout"] as const)("T9-R07 %s ends session authority before a waiting report command resumes",async kind=>{
    const c=await visited();if(kind==="closeout")await report(c,{photoOmissionReason:"NOT_APPLICABLE"});const input=await reportInput(c,{photoOmissionReason:"NOT_APPLICABLE"}),end=await endInput(c),close=kind==="closeout"?await closeoutInput(c):null;await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(c.vendor.submitCompletionReport(c.session,input as never));await waitForTicketWait();if(kind==="reassign")await lockedManagerEnd(c,"reassign",end);else{await f.p.admin.query("SET LOCAL ROLE bm_b1_web");await f.p.admin.query("SELECT core_flow.session($1)",[Buffer.from(managerDigest(),"hex")]);await f.p.admin.query("SELECT vendor_handoff.closeout($1,$2,$3,$4,$5,0,$6)",[Buffer.from(managerDigest(),"hex"),c.assignmentId,close!.clientRequestId,close!.expectedAssignmentVersion,close!.expectedCompletionReportId,close!.message]);}
      await f.p.admin.query("COMMIT");expect(await pending).toBe("UNAUTHENTICATED");expect(await count("SELECT count(*)::int n FROM vendor_handoff.completion_report WHERE assignment_id=$1",[c.assignmentId])).toBe(kind==="closeout"?1:0);
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
  it.each(["availability","proposal","reschedule"] as const)("T9-R08 Withdraw wins source-ticket wait against %s with no actionable scheduling",async operation=>{
    const c=await accepted();if(operation==="reschedule")await confirmed(c);else if(operation==="proposal")await tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:randomUUID(),...await tenantGuards(c),windows:[{startAt:at(24),endAt:at(28)}]});
    const guards=await tenantGuards(c),j=await job(c),requestId=randomUUID();
    const tables=["tenant_availability_submission","vendor_slot_proposal","scheduling_round","appointment"];
    const rowIds=async()=>{const rows=[];for(const table of tables)rows.push((await f.p.admin.query(`SELECT id FROM vendor_handoff.${table} WHERE assignment_id=$1 ORDER BY id`,[c.assignmentId])).rows);return rows;};
    const before=await rowIds();await lockTicket(c);let pending:Promise<string|undefined>|undefined;
    try{pending=code(operation==="availability"?tenantPort.submitAvailability(c.tenantDigest,c.ticketId,{clientRequestId:requestId,...guards,windows:[{startAt:at(24),endAt:at(28)}]}):operation==="proposal"?c.vendor.proposeSlots(c.session,{clientRequestId:requestId,...guards,slots:[{startAt:at(25),endAt:at(26)}]}):f.manager.reschedule(managerDigest(),c.assignmentId,{clientRequestId:requestId,...guards,expectedAppointmentId:j.appointment!.id}));await waitForTicketWait();
      await f.p.admin.query("SET LOCAL ROLE bm_vendor_web");await f.p.admin.query("SELECT vendor_handoff.withdraw($1,$2,$3,$4,$5,'합성 철회 사유')",[Buffer.from(c.session,"hex"),Buffer.from(c.csrf,"hex"),randomUUID(),j.assignmentVersion,c.packetId]);await f.p.admin.query("COMMIT");expect(await pending).toBe(operation==="proposal"?"UNAUTHENTICATED":"NOT_FOUND");
      expect(await rowIds()).toEqual(before);expect(await count("SELECT count(*)::int n FROM vendor_handoff.command_receipt WHERE request_key=$1",[requestId])).toBe(0);await assertEnded(c,"WITHDRAWN");
      const h=await handoff(c);expect(JSON.stringify(h)).toContain("합성 철회 사유");
    }finally{await f.p.admin.query("ROLLBACK");await pending;}
  });
});

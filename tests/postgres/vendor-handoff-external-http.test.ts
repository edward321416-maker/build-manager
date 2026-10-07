import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createHash,randomUUID } from "node:crypto";
import { createVendorHandoffExternalPort,createVendorHandoffTenantPort } from "@build-manager/persistence-postgres/vendor-handoff";
import { VendorJobDtoSchema,VendorRedeemResultDtoSchema,VendorSessionStateDtoSchema } from "@build-manager/api-contracts";
import { handleVendorHandoff,type VendorHTTPDependencies } from "../../apps/web/src/server/vendor-handoff/http";
import { createVendorHandoffFixture } from "./helpers/vendor-handoff-fixture";

let f:Awaited<ReturnType<typeof createVendorHandoffFixture>>;
let deps:VendorHTTPDependencies;
beforeAll(async()=>{
  f=await createVendorHandoffFixture();
  deps={external:(csrf?:string)=>createVendorHandoffExternalPort(f.vendorDatabase,csrf),origin};
});
afterAll(async()=>{await f?.close();});

const origin="http://127.0.0.1:3141";
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const png=Buffer.from("89504e470d0a1a0a","hex");
type Cred={cookie:string;csrf:string};
function send(path:string,init:{method?:string;headers?:Record<string,string>;body?:unknown}={}){
  const headers=new Headers(init.headers);
  if(init.body!==undefined)headers.set("content-type","application/json");
  if((init.method??"GET")==="POST")headers.set("origin",origin);
  return handleVendorHandoff(new Request(`${origin}/api/v2/vendor/${path}`,{method:init.method??"GET",headers,body:init.body===undefined?undefined:JSON.stringify(init.body)}),path.split("/"),()=>deps);
}
async function photo(ticketId:string,org:string,actor:string){
  const id=randomUUID();
  await f.p.admin.query("INSERT INTO core_flow.ticket_photo(id,org_id,ticket_id,upload_id,mime,width,height,content,actor_id) VALUES($1,$2,$3,$4,'image/png',1,1,$5,$6)",[id,org,ticketId,randomUUID(),png,actor]);
  return id;
}
async function offered(who="manager",tenant="tenant",shared=false){
  const prepared=await f.prepared(who,tenant);
  const org=who==="manager"?f.data.orgA:f.data.orgB;
  const actor=f.data.accounts[tenant].userId;
  const kept=shared?await photo(prepared.t.ticket.id,org,actor):null;
  const hidden=shared?await photo(prepared.t.ticket.id,org,actor):null;
  const handoff=await f.manager.publishPacket(f.data.accounts[who].digest,prepared.handoff.assignment!.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:1,
    expectedPacketRevisionId:null,workSummary:"합성 누수 점검",sharedDetailKeys:[],allowedPhotoIds:kept?[kept]:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null});
  const link=await f.manager.issueLink(f.data.accounts[who].digest,handoff.assignment!.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:2,expectedPacketRevisionId:handoff.currentPacket!.id});
  return {who,ticket:prepared.t,handoff,assignmentId:handoff.assignment!.id,packetId:handoff.currentPacket!.id,token:link.link!.split("#")[1],kept,hidden};
}
async function redeem(token:string,clientRequestId=randomUUID()){
  const response=await send("session/redeem",{method:"POST",headers:{authorization:`VendorCapability ${token}`},body:{clientRequestId}});
  const cookie=/^vendor_session=([A-Za-z0-9_-]{43});/.exec(response.headers.get("set-cookie")??"")?.[1];
  const body=response.status===200?VendorRedeemResultDtoSchema.parse(await response.json()):null;
  return {response,status:response.status,body,cred:cookie&&body?{cookie,csrf:body.session.csrf}:null};
}
const read=(cred:Cred,path="job")=>send(path,{headers:{cookie:`vendor_session=${cred.cookie}`}});
const mutate=(cred:Cred,path:string,body:unknown,csrf=cred.csrf)=>send(path,{method:"POST",headers:{cookie:`vendor_session=${cred.cookie}`,"x-vendor-csrf":csrf},body});
const assignment=async(id:string)=>(await f.p.admin.query("SELECT status,end_reason,version FROM vendor_handoff.vendor_assignment WHERE id=$1",[id])).rows[0];
const activeSessions=async(id:string)=>(await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.vendor_session WHERE assignment_id=$1 AND revoked_at IS NULL",[id])).rows[0].n;

describe("Vendor HTTP capability redemption on PostgreSQL",()=>{
  it("redeems once into an OFFERED (not accepted) job and persists only digests",async()=>{
    const o=await offered();
    const first=await redeem(o.token);
    expect(first.status).toBe(200);
    expect(first.body!.job).toMatchObject({assignmentId:o.assignmentId,status:"OFFERED",assignmentVersion:3});
    expect(first.body!.job.currentPacket!.id).toBe(o.packetId);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED",end_reason:null});
    const stored=(await f.p.admin.query("SELECT encode(digest,'hex') AS digest,encode(csrf_digest,'hex') AS csrf FROM vendor_handoff.vendor_session WHERE assignment_id=$1",[o.assignmentId])).rows;
    expect(stored).toEqual([{digest:sha(first.cred!.cookie),csrf:sha(first.cred!.csrf)}]);
    let dump="";
    for(const table of ["vendor_session","vendor_capability","command_receipt","vendor_assignment"])dump+=JSON.stringify((await f.p.admin.query(`SELECT to_jsonb(t)::text AS r FROM vendor_handoff.${table} t`)).rows);
    expect([o.token,first.cred!.cookie,first.cred!.csrf].some(raw=>dump.includes(raw))).toBe(false);
    const second=await redeem(o.token);
    expect(second.status).toBe(401);
    expect(second.response.headers.get("set-cookie")).toBeNull();
    expect((await read(first.cred!)).status).toBe(200);
  });
  it("exact replay after response loss replaces only its own lineage session without extending expiry or reactivating the capability",async()=>{
    const o=await offered(),request=randomUUID();
    const lost=await redeem(o.token,request);
    const replay=await redeem(o.token,request);
    expect(replay.status).toBe(200);
    expect(replay.body!.session.expiresAt).toBe(lost.body!.session.expiresAt);
    expect((await read(lost.cred!)).status).toBe(401);
    expect((await read(replay.cred!)).status).toBe(200);
    expect(await activeSessions(o.assignmentId)).toBe(1);
    const capability=(await f.p.admin.query("SELECT redeem_request_id,redeemed_at IS NOT NULL AS redeemed,count(*) OVER () AS n FROM vendor_handoff.vendor_capability WHERE assignment_id=$1",[o.assignmentId])).rows;
    expect(capability).toEqual([{redeem_request_id:request,redeemed:true,n:"1"}]);
    expect((await redeem(o.token)).status).toBe(401);
  });
  it("applies the exact 72-hour capability boundary",async()=>{
    const live=await offered(),late=await offered();
    expect((await f.p.admin.query("SELECT extract(epoch FROM expires_at-issued_at)::int AS ttl FROM vendor_handoff.vendor_capability WHERE assignment_id=$1",[live.assignmentId])).rows[0].ttl).toBe(72*3600);
    await f.p.admin.query("UPDATE vendor_handoff.vendor_capability SET expires_at=clock_timestamp()+interval '3 seconds' WHERE assignment_id=$1",[live.assignmentId]);
    await f.p.admin.query("UPDATE vendor_handoff.vendor_capability SET expires_at=clock_timestamp()-interval '1 millisecond' WHERE assignment_id=$1",[late.assignmentId]);
    expect((await redeem(live.token)).status).toBe(200);
    expect((await redeem(late.token)).status).toBe(401);
    expect(await activeSessions(late.assignmentId)).toBe(0);
  });
  it("reissue after expiry creates only a new capability and expired replay never resurrects authority",async()=>{
    const o=await offered(),request=randomUUID();
    const first=await redeem(o.token,request);
    await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET expires_at=clock_timestamp()-interval '1 millisecond' WHERE assignment_id=$1",[o.assignmentId]);
    expect((await read(first.cred!)).status).toBe(401);
    expect((await redeem(o.token,request)).status).toBe(401);
    expect(await activeSessions(o.assignmentId)).toBe(1);
    const reissued=await f.manager.reissueLink(f.data.accounts.manager.digest,o.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId});
    const capabilities=(await f.p.admin.query("SELECT superseded_at IS NOT NULL AS superseded FROM vendor_handoff.vendor_capability WHERE assignment_id=$1 ORDER BY issued_at",[o.assignmentId])).rows;
    expect(capabilities).toEqual([{superseded:true},{superseded:false}]);
    expect((await read(first.cred!)).status).toBe(401);
    expect((await redeem(o.token,request)).status).toBe(401);
    const next=await redeem(reissued.link!.split("#")[1]);
    expect(next.status).toBe(200);
    expect(await activeSessions(o.assignmentId)).toBe(1);
  });
});

describe("Vendor HTTP session lifecycle on PostgreSQL",()=>{
  it("rotates CSRF on session read without extending the absolute 7-day expiry",async()=>{
    const o=await offered(),first=(await redeem(o.token)).cred!;
    const before=(await f.p.admin.query("SELECT expires_at,extract(epoch FROM expires_at-created_at)::int AS ttl FROM vendor_handoff.vendor_session WHERE assignment_id=$1",[o.assignmentId])).rows[0];
    expect(before.ttl).toBe(7*86400);
    const response=await read(first,"session");
    expect(response.status).toBe(200);
    const rotated=VendorSessionStateDtoSchema.parse(await response.json());
    expect(rotated.csrf===first.csrf).toBe(false);
    const after=(await f.p.admin.query("SELECT expires_at,encode(csrf_digest,'hex') AS csrf FROM vendor_handoff.vendor_session WHERE assignment_id=$1",[o.assignmentId])).rows[0];
    expect(after.expires_at.toISOString()).toBe(before.expires_at.toISOString());
    expect(new Date(rotated.expiresAt).toISOString()).toBe(before.expires_at.toISOString());
    expect(after.csrf).toBe(sha(rotated.csrf));
    const decline={clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"NO_CAPACITY",operationalNote:null};
    // Stale CSRF on a live session is denied as a distinguishable 403 (review M1), never a commit.
    expect((await mutate(first,"job/decline",decline)).status).toBe(403);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED"});
  });
  it("applies the exact 7-day session boundary to reads, CSRF refresh and mutations",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!;
    await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET expires_at=clock_timestamp()+interval '3 seconds' WHERE assignment_id=$1",[o.assignmentId]);
    expect((await read(cred)).status).toBe(200);
    const rotated=VendorSessionStateDtoSchema.parse(await (await read(cred,"session")).json());
    await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET expires_at=clock_timestamp()-interval '1 millisecond' WHERE assignment_id=$1",[o.assignmentId]);
    const live={...cred,csrf:rotated.csrf};
    // A mutation just before the absolute boundary still succeeds on a separate assignment.
    const early=await offered(),earlyCred=(await redeem(early.token)).cred!;
    await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET expires_at=clock_timestamp()+interval '3 seconds' WHERE assignment_id=$1",[early.assignmentId]);
    expect((await mutate(earlyCred,"job/decline",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:early.packetId,reason:"OTHER",operationalNote:null})).status).toBe(200);
    expect((await read(live)).status).toBe(401);
    expect((await read(live,"session")).status).toBe(401);
    expect((await mutate(live,"job/decline",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"OTHER",operationalNote:null})).status).toBe(401);
    const deadLogout=await mutate(live,"session/logout",{clientRequestId:randomUUID()});
    expect(deadLogout.status).toBe(401);
    expect(deadLogout.headers.get("set-cookie")?.split("; ")).toContain("Max-Age=0");
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED"});
  });
  it("reports a stale CSRF on a live session as 403 without revoking, clearing or ending anything",async()=>{
    const o=await offered(),first=(await redeem(o.token)).cred!;
    const rotated=VendorSessionStateDtoSchema.parse(await (await read(first,"session")).json());
    const staleLogout=await mutate(first,"session/logout",{clientRequestId:randomUUID()});
    expect(staleLogout.status).toBe(403);
    expect(staleLogout.headers.get("set-cookie")).toBeNull();
    const staleDecline=await mutate(first,"job/decline",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"OTHER",operationalNote:null});
    expect(staleDecline.status).toBe(403);
    expect(await activeSessions(o.assignmentId)).toBe(1);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED"});
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE assignment_id=$1 AND actor_scope='VENDOR'",[o.assignmentId])).rows[0].n).toBe(1);
    const current={...first,csrf:rotated.csrf};
    expect((await read(current)).status).toBe(200);
    expect((await mutate(current,"session/logout",{clientRequestId:randomUUID()})).status).toBe(200);
    expect(await activeSessions(o.assignmentId)).toBe(0);
  });
  it("reissue alone keeps the active session; replacement redemption and session revocation end it",async()=>{
    const o=await offered(),old=(await redeem(o.token)).cred!;
    const reissued=await f.manager.reissueLink(f.data.accounts.manager.digest,o.assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId});
    expect((await read(old)).status).toBe(200);
    const next=(await redeem(reissued.link!.split("#")[1])).cred!;
    expect((await read(old)).status).toBe(401);
    expect((await read(next)).status).toBe(200);
    // Task 9 owns the Manager revoke command; its durable session effect is revoked_at.
    await f.p.admin.query("UPDATE vendor_handoff.vendor_session SET revoked_at=clock_timestamp() WHERE assignment_id=$1 AND revoked_at IS NULL",[o.assignmentId]);
    expect((await read(next)).status).toBe(401);
  });
  it("logout revokes only the browser session, replays exactly at HTTP level and never restores authority",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!,request=randomUUID();
    const first=await mutate(cred,"session/logout",{clientRequestId:request});
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({revoked:true});
    const replay=await mutate(cred,"session/logout",{clientRequestId:request});
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({revoked:true});
    expect((await mutate(cred,"session/logout",{clientRequestId:request},cred.csrf.slice(0,-1)+(cred.csrf.endsWith("A")?"B":"A"))).status).toBe(401);
    expect((await read(cred)).status).toBe(401);
    expect((await mutate(cred,"job/decline",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"OTHER",operationalNote:null})).status).toBe(401);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED",end_reason:null});
    expect((await f.p.admin.query("SELECT count(*)::int AS n FROM vendor_handoff.command_receipt WHERE assignment_id=$1 AND actor_scope='VENDOR' AND result=$2::jsonb",[o.assignmentId,JSON.stringify({revoked:true})])).rows[0].n).toBe(1);
  });
});

describe("Vendor external port CSRF binding",()=>{
  it("fails closed for logout and decline when no CSRF digest is bound to the request port",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!;
    const unbound=createVendorHandoffExternalPort(f.vendorDatabase);
    await expect(unbound.logout(sha(cred.cookie),randomUUID())).rejects.toMatchObject({code:"UNAUTHENTICATED"});
    await expect(unbound.decline(sha(cred.cookie),{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"OTHER",operationalNote:null})).rejects.toMatchObject({code:"UNAUTHENTICATED"});
    expect(await activeSessions(o.assignmentId)).toBe(1);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED"});
  });
});

describe("Vendor HTTP decline and assignment scope on PostgreSQL",()=>{
  it("declines only while OFFERED with current guards, preserves the ticket and replays exactly",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!;
    const ticketBefore=(await f.p.admin.query("SELECT work_status,version FROM core_flow.ticket WHERE id=$1",[o.ticket.ticket.id])).rows[0];
    const base={clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"CANNOT_MEET_TIMING",operationalNote:"합성 일정 메모"};
    expect((await mutate(cred,"job/decline",{...base,expectedAssignmentVersion:2})).status).toBe(409);
    expect((await mutate(cred,"job/decline",{...base,expectedPacketRevisionId:randomUUID()})).status).toBe(409);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED",version:"3"});
    const declined=await mutate(cred,"job/decline",base);
    expect(declined.status).toBe(200);
    const body=VendorJobDtoSchema.parse(await declined.json());
    expect(body).toMatchObject({status:"ENDED",endReason:"DECLINED",phase:"ENDED",assignmentVersion:4});
    expect(await assignment(o.assignmentId)).toMatchObject({status:"ENDED",end_reason:"DECLINED",version:"4"});
    expect((await f.p.admin.query("SELECT decline_reason,end_note FROM vendor_handoff.vendor_assignment WHERE id=$1",[o.assignmentId])).rows[0]).toEqual({decline_reason:"CANNOT_MEET_TIMING",end_note:"합성 일정 메모"});
    expect((await f.p.admin.query("SELECT work_status,version FROM core_flow.ticket WHERE id=$1",[o.ticket.ticket.id])).rows[0]).toEqual(ticketBefore);
    const replay=await mutate(cred,"job/decline",base);
    expect(replay.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await replay.json())).toEqual(body);
    expect((await mutate(cred,"job/decline",{...base,reason:"OTHER"})).status).toBe(409);
    expect((await read(cred)).status).toBe(401);
    expect((await read(cred,"session")).status).toBe(401);
    expect((await mutate(cred,"job/decline",{...base,clientRequestId:randomUUID()})).status).toBe(401);
  });
  it("requires a decline reason on every DECLINED assignment row",async()=>{
    const o=await offered();
    await expect(f.p.admin.query("UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason='DECLINED',ended_at=clock_timestamp() WHERE id=$1",[o.assignmentId])).rejects.toMatchObject({code:"23514"});
    await expect(f.p.admin.query("UPDATE vendor_handoff.vendor_assignment SET status='ENDED',end_reason='REVOKED',ended_at=clock_timestamp(),decline_reason='OTHER' WHERE id=$1",[o.assignmentId])).rejects.toMatchObject({code:"23514"});
  });
  it("proposes visit slots through the real HTTP boundary after Tenant availability",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!;
    const accepted=VendorJobDtoSchema.parse(await (await mutate(cred,"job/accept",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId})).json());
    const tenant=createVendorHandoffTenantPort(f.managerDatabase);
    const soon=(hours:number)=>new Date(Date.now()+hours*3_600_000).toISOString();
    const availability=await tenant.submitAvailability(f.data.accounts.tenant.digest,o.ticket.ticket.id,{clientRequestId:randomUUID(),expectedAssignmentVersion:4,
      expectedRoundVersion:accepted.currentRound!.version,expectedPacketRevisionId:o.packetId,windows:[{startAt:soon(24),endAt:soon(28)}]});
    const proposed=await mutate(cred,"scheduling/proposals",{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedRoundVersion:availability.currentRound!.version,
      expectedPacketRevisionId:o.packetId,slots:[{startAt:soon(25),endAt:soon(26)}]});
    expect(proposed.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await proposed.json())).toMatchObject({phase:"SCHEDULING",waitingOn:"TENANT",proposal:{slots:[{}]}});
  });
  it("denies decline after the assignment leaves OFFERED",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!;
    await f.p.admin.query("UPDATE vendor_handoff.vendor_assignment SET status='ACTIVE' WHERE id=$1",[o.assignmentId]);
    expect((await mutate(cred,"job/decline",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId,reason:"OTHER",operationalNote:null})).status).toBe(409);
    expect(await assignment(o.assignmentId)).toMatchObject({status:"ACTIVE",end_reason:null});
  });
  it("accepts and withdraws through the real HTTP boundary while redeem alone leaves the assignment OFFERED",async()=>{
    const o=await offered(),cred=(await redeem(o.token)).cred!;
    expect(await assignment(o.assignmentId)).toMatchObject({status:"OFFERED"});
    const accepted=await mutate(cred,"job/accept",{clientRequestId:randomUUID(),expectedAssignmentVersion:3,expectedPacketRevisionId:o.packetId});
    expect(accepted.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await accepted.json())).toMatchObject({status:"ACTIVE",assignmentVersion:4,currentRound:{purpose:"INITIAL",status:"OPEN"}});
    const withdrawn=await mutate(cred,"job/withdraw",{clientRequestId:randomUUID(),expectedAssignmentVersion:4,expectedPacketRevisionId:o.packetId,operationalNote:null});
    expect(withdrawn.status).toBe(200);
    expect(VendorJobDtoSchema.parse(await withdrawn.json())).toMatchObject({status:"ENDED",endReason:"WITHDRAWN"});
    expect((await read(cred)).status).toBe(401);
    for(const path of [`appointments/${randomUUID()}/visit-start`,"blockers"])expect((await mutate(cred,path,{clientRequestId:randomUUID()})).status).toBe(404);
  });
  it("serves only the current packet's allowlisted source photo and hides other assignment or unshared photos identically",async()=>{
    const a=await offered("manager","tenant",true),b=await offered("otherManager","otherTenant",true);
    const credA=(await redeem(a.token)).cred!,credB=(await redeem(b.token)).cred!;
    const own=await read(credA,`job/source-photos/${a.kept}`);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await own.arrayBuffer())).toEqual(png);
    const probes=await Promise.all([`job/source-photos/${b.kept}`,`job/source-photos/${a.hidden}`,`job/source-photos/${randomUUID()}`,"job/source-photos/not-a-photo"].map(path=>read(credA,path)));
    expect(probes.map(r=>r.status)).toEqual([404,404,404,404]);
    const bodies=await Promise.all(probes.map(r=>r.text()));
    expect(new Set(bodies).size).toBe(1);
    expect(VendorJobDtoSchema.parse(await (await read(credA)).json()).assignmentId).toBe(a.assignmentId);
    expect(VendorJobDtoSchema.parse(await (await read(credB)).json()).assignmentId).toBe(b.assignmentId);
  });
});

import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { CoreFlowError, VendorHandoffError, type CoreFlowPort, type CoreScope, type VendorHandoffManagerPort } from "@build-manager/application";
import { handleCoreFlow } from "./http";
import type { CoreHTTPDependencies } from "./container";
import { VendorLinkIssueDtoSchema } from "@build-manager/api-contracts";
import { coreVendorHandoff } from "@build-manager/api-client";

const ticketId=randomUUID(),assignmentId=randomUUID(),packetId=randomUUID(),orgId=randomUUID();
const digest="b".repeat(64);
const handoff={ticketId,assignment:{id:assignmentId,status:"PREPARING",endReason:null,vendorLabel:"합성 업체",version:1},currentPacket:null,currentRound:null,appointment:null,activeBlocker:null,currentReport:null,reportHistory:[],phase:"IN_PROGRESS",waitingOn:"NONE"};
const input={clientRequestId:randomUUID(),expectedAssignmentVersion:1,expectedPacketRevisionId:packetId};
function setup(role="ORG_ADMIN"){
  const calls:{method:string;digest:string;id:string;input:unknown}[]=[];
  let failure:unknown=null;
  let createdLink=false;
  const manager=new Proxy({}, {get:(_target,method:string)=>async(hash:string,id:string,body:unknown)=>{
    calls.push({method,digest:hash,id,input:body});if(failure)throw failure;
    if(method==="issueLink"||method==="reissueLink")return {created:createdLink,assignmentId,assignmentVersion:2,expiresAt:"2026-10-09T00:00:00Z",...(createdLink?{link:"/vendor/job#synthetic-value"}:{})};
    if(method==="completionPhoto")return {photo:{photoId:body,mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-07T00:00:00Z"},bytes:new Uint8Array([1,2,3])};
    return handoff;
  }}) as VendorHandoffManagerPort;
  const port:CoreFlowPort={run:async(_hash,op)=>op({session:{role}} as CoreScope)};
  let sessionCalls=0;
  const dependencies={port,revoke:async()=>{},origins:["http://127.0.0.1:3130"],vendorHandoff:{inOrganization:()=>manager},b1:{
    current:async(request:Request)=>{sessionCalls++;if(request.headers.get("x-test-session")==="expired")throw new CoreFlowError("UNAUTHENTICATED");if(request.headers.get("x-b1-csrf")!=="synthetic-proof")throw new CoreFlowError("FORBIDDEN");return {digest,csrf:"synthetic-proof"};},
    access:{inOrganization:()=>port,organizations:async()=>[]},
  }} as unknown as CoreHTTPDependencies;
  const call=(path:string,method="GET",body:unknown=undefined,headers:Record<string,string>={})=>handleCoreFlow(new Request("http://127.0.0.1:3130/api/v2/core/"+path,{method,headers:{Origin:"http://127.0.0.1:3130","X-Core-Organization":orgId,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json",...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),()=>dependencies);
  return {calls,call,fail:(error:unknown)=>{failure=error;},setCreatedLink:()=>{createdLink=true;},sessionCalls:()=>sessionCalls};
}
it("dispatches all six manager routes with request-scoped B1 digest, never the organization header",async()=>{
  const s=setup();
  const rows=[
    [`manager/tickets/${ticketId}/vendor-handoff`,"GET",undefined,"readHandoff",ticketId,200],
    [`manager/tickets/${ticketId}/vendor-assignment`,"POST",{clientRequestId:randomUUID(),expectedTicketVersion:1,vendorLabel:"합성 업체"},"createAssignment",ticketId,201],
    [`manager/vendor-assignments/${assignmentId}/packet-revisions`,"POST",{clientRequestId:randomUUID(),expectedAssignmentVersion:1,expectedPacketRevisionId:null,workSummary:"합성 점검",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null},"publishPacket",assignmentId,201],
    [`manager/vendor-assignments/${assignmentId}/link`,"POST",input,"issueLink",assignmentId,200],
    [`manager/vendor-assignments/${assignmentId}/link/reissue`,"POST",input,"reissueLink",assignmentId,200],
    [`manager/vendor-assignments/${assignmentId}/revoke`,"POST",{clientRequestId:randomUUID(),expectedAssignmentVersion:1},"revoke",assignmentId,200],
  ] as const;
  for(const [path,method,body,operation,id,status] of rows){const r=await s.call(path,method,body);expect(r.status).toBe(status);expect(r.headers.get("cache-control")).toBe("private, no-store");const c=s.calls.at(-1);expect(c?.method).toBe(operation);expect(c?.id).toBe(id);expect(c?.digest===digest&&c.digest!==orgId).toBe(true);}
});
it("allows current property staff and rejects Tenant before invoking the Vendor manager port",async()=>{
  expect((await setup("PROPERTY_STAFF").call(`manager/tickets/${ticketId}/vendor-handoff`)).status).toBe(200);
  const s=setup("TENANT");expect((await s.call(`manager/tickets/${ticketId}/vendor-handoff`)).status).toBe(403);expect(s.calls.length).toBe(0);
});
it("preserves Origin then session then CSRF precedence before route parsing",async()=>{
  const s=setup();const path="manager/vendor-assignments/invalid/link";
  expect((await s.call(path,"POST",{}, {Origin:"https://untrusted.invalid","X-Test-Session":"expired"})).status).toBe(403);expect(s.sessionCalls()).toBe(0);
  expect((await s.call(path,"POST",{}, {"X-Test-Session":"expired","X-B1-CSRF":"wrong"})).status).toBe(401);
  expect((await s.call(path,"POST",{}, {"X-B1-CSRF":"wrong"})).status).toBe(403);
  expect(s.calls.length).toBe(0);
});
it("strictly validates IDs, body size, content type and client-authored identity before persistence",async()=>{
  const s=setup(),path=`manager/vendor-assignments/${assignmentId}/link`;
  for(const body of [{...input,orgId},{...input,expectedAssignmentVersion:0},{...input,clientRequestId:"invalid"},{...input,extra:"x".repeat(17000)}])expect((await s.call(path,"POST",body)).status).toBe(400);
  expect((await s.call(path,"POST",input,{"Content-Type":"text/plain"})).status).toBe(400);
  expect((await s.call("manager/tickets/invalid/vendor-handoff")).status).toBe(400);
  expect(s.calls.length).toBe(0);
});
it("maps current property removal, cross-org resources and conflicts to safe responses",async()=>{
  const s=setup();for(const [code,status] of [["NOT_FOUND",404],["STATE_CONFLICT",409],["DEPENDENCY_UNAVAILABLE",503]] as const){s.fail(new VendorHandoffError(code,"PRIVATE_DB_DETAIL"));const r=await s.call(`manager/tickets/${ticketId}/vendor-handoff`);expect(r.status).toBe(status);expect((await r.text()).includes("PRIVATE_DB_DETAIL")).toBe(false);}
});
it("never fabricates a link in replay/reconciliation responses",async()=>{
  const s=setup(),r=await s.call(`manager/vendor-assignments/${assignmentId}/link`,"POST",input);expect(r.status).toBe(200);const data=await r.json();expect(data.created).toBe(false);expect(Object.hasOwn(data,"link")).toBe(false);
});
it("accepts only the exact relative deliverable path, rejecting alternate origins and query tokens",()=>{
  const metadata={created:true,assignmentId,assignmentVersion:2,expiresAt:"2026-10-09T00:00:00Z"};
  expect(VendorLinkIssueDtoSchema.safeParse({...metadata,link:"/vendor/job#synthetic-value"}).success).toBe(true);
  for(const link of ["//untrusted.invalid/vendor/job#value","https://untrusted.invalid/vendor/job#value","/vendor/job?token=value#value","/other#value"]){expect(VendorLinkIssueDtoSchema.safeParse({...metadata,link}).success).toBe(false);}
});
it("returns a one-time relative deliverable on first committed issuance with no-store/referrer protection",async()=>{
  const s=setup();s.setCreatedLink();const response=await s.call(`manager/vendor-assignments/${assignmentId}/link`,"POST",input);
  expect(response.status).toBe(201);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  const value=await response.json();expect(value.created===true&&/^\/vendor\/job#[A-Za-z0-9_-]+$/.test(value.link)).toBe(true);
});
it("runs every SDK operation through the real authenticated dispatcher and strict request/response contracts",async()=>{
  const s=setup(),client=coreVendorHandoff(async(url,init)=>s.call(url.split("/api/v2/core/")[1],init?.method,init?.body?JSON.parse(init.body):undefined,init?.headers),"http://127.0.0.1:3130");
  await client.readHandoff(ticketId);
  await client.createAssignment(ticketId,{clientRequestId:randomUUID(),expectedTicketVersion:1,vendorLabel:"합성 업체"});
  await client.publishPacket(assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:1,expectedPacketRevisionId:null,workSummary:"합성 점검",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null});
  const replay=await client.issueLink(assignmentId,input);expect(replay.created).toBe(false);expect(Object.hasOwn(replay,"link")).toBe(false);
  await client.reissueLink(assignmentId,input);await client.revoke(assignmentId,{clientRequestId:randomUUID(),expectedAssignmentVersion:1});
  expect(s.calls.map(call=>call.method)).toEqual(["readHandoff","createAssignment","publishPacket","issueLink","reissueLink","revoke"]);expect(s.calls.every(call=>call.digest===digest&&call.digest!==orgId)).toBe(true);
});

// Task6: Tenant scheduling and Manager reschedule over the existing B1 Core boundary.
const appointmentId=randomUUID(),submissionId=randomUUID(),windowId=randomUUID(),proposalId=randomUUID(),slotId=randomUUID();
const tenantDto={ticketId,assignmentVersion:4,packetRevisionId:packetId,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",phase:"SCHEDULING",waitingOn:"TENANT",
  currentRound:null,appointment:null,accessPolicy:"TENANT_PRESENT_REQUIRED",availability:null,proposal:null};
const roundGuards={expectedAssignmentVersion:4,expectedRoundVersion:2,expectedPacketRevisionId:packetId};
function setupTenant(role="TENANT"){
  const calls:{method:string;digest:string;id:string;input:unknown;org:string}[]=[];
  const tenantFor=(org:string)=>new Proxy({},{get:(_t,method:string)=>async(hash:string,id:string,body:unknown)=>{calls.push({method,digest:hash,id,input:body,org});return tenantDto;}});
  const managerFor=(org:string)=>new Proxy({},{get:(_t,method:string)=>async(hash:string,id:string,body:unknown)=>{calls.push({method,digest:hash,id,input:body,org});return handoff;}});
  const port:CoreFlowPort={run:async(_hash,op)=>op({session:{role}} as CoreScope)};
  const dependencies={port,revoke:async()=>{},origins:["http://127.0.0.1:3130"],vendorHandoff:{inOrganization:managerFor,tenantInOrganization:tenantFor},b1:{
    current:async()=>({digest,csrf:"synthetic-proof"}),access:{inOrganization:()=>port,organizations:async()=>[]},
  }} as unknown as CoreHTTPDependencies;
  const call=(path:string,method="GET",body:unknown=undefined)=>handleCoreFlow(new Request("http://127.0.0.1:3130/api/v2/core/"+path,{method,
    headers:{Origin:"http://127.0.0.1:3130","X-Core-Organization":orgId,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),()=>dependencies);
  return {calls,call};
}
it("dispatches every Tenant scheduling route with the request-scoped B1 digest and strict bodies",async()=>{
  const s=setupTenant();
  const base=`tickets/${ticketId}/vendor-scheduling`;
  const rows=[
    [base,"GET",undefined,"readScheduling"],
    [`${base}/availability`,"POST",{clientRequestId:randomUUID(),...roundGuards,windows:[{startAt:"2026-10-10T01:00:00Z",endAt:"2026-10-10T03:00:00Z"}]},"submitAvailability"],
    [`${base}/entry-authorization`,"POST",{clientRequestId:randomUUID(),...roundGuards,availabilitySubmissionId:submissionId,selectedWindowIds:[windowId]},"authorizeEntry"],
    [`${base}/confirm`,"POST",{clientRequestId:randomUUID(),...roundGuards,proposalId,selectedSlotId:slotId},"confirmSlot"],
    [`${base}/reschedule`,"POST",{clientRequestId:randomUUID(),...roundGuards,expectedAppointmentId:appointmentId},"reschedule"],
  ] as const;
  for(const [path,method,body,name] of rows){
    const response=await s.call(path,method,body);
    expect(response.status,name).toBe(200);
    expect(await response.json()).toEqual(tenantDto);
    const last=s.calls.at(-1)!;
    expect(last).toMatchObject({method:name,digest,id:ticketId,org:orgId});
    if(body!==undefined)expect(last.input).toEqual(body);
  }
  for(const [path,body] of [[`${base}/availability`,{clientRequestId:randomUUID(),...roundGuards,windows:[{startAt:"2026-10-10T01:00:00Z",endAt:"2026-10-10T03:00:00Z"}],unitId:randomUUID()}],[`${base}/confirm`,{clientRequestId:randomUUID(),...roundGuards,proposalId,selectedSlotId:slotId,orgId}]] as const)
    expect((await s.call(path,"POST",body)).status).toBe(400);
  expect(s.calls).toHaveLength(5);
});
it("denies Tenant scheduling routes to non-Tenant sessions before any Vendor port call",async()=>{
  const s=setupTenant("ORG_ADMIN");
  expect((await s.call(`tickets/${ticketId}/vendor-scheduling`)).status).toBe(403);
  expect(s.calls).toEqual([]);
});
it("dispatches Manager RESCHEDULE with the request-scoped digest",async()=>{
  const s=setupTenant("ORG_ADMIN");
  const body={clientRequestId:randomUUID(),...roundGuards,expectedAppointmentId:appointmentId};
  const response=await s.call(`manager/vendor-assignments/${assignmentId}/reschedule`,"POST",body);
  expect(response.status).toBe(200);
  expect(s.calls.at(-1)).toMatchObject({method:"reschedule",digest,id:assignmentId,input:body,org:orgId});
});
it("exposes Tenant scheduling and Manager reschedule through the typed Core client",async()=>{
  const s=setupTenant();
  const client=coreVendorHandoff(async(input,init)=>{const path=input.replace("http://127.0.0.1:3130/api/v2/core/","");return s.call(path,init?.method??"GET",init?.body?JSON.parse(init.body):undefined);},"http://127.0.0.1:3130");
  expect(await client.readScheduling(ticketId)).toEqual(tenantDto);
  await client.submitAvailability(ticketId,{clientRequestId:randomUUID(),...roundGuards,windows:[{startAt:"2026-10-10T01:00:00Z",endAt:"2026-10-10T03:00:00Z"}]});
  await client.authorizeEntry(ticketId,{clientRequestId:randomUUID(),...roundGuards,availabilitySubmissionId:submissionId,selectedWindowIds:[windowId]});
  await client.confirmSlot(ticketId,{clientRequestId:randomUUID(),...roundGuards,proposalId,selectedSlotId:slotId});
  await client.tenantReschedule(ticketId,{clientRequestId:randomUUID(),...roundGuards,expectedAppointmentId:appointmentId});
  expect(s.calls.map(c=>c.method)).toEqual(["readScheduling","submitAvailability","authorizeEntry","confirmSlot","reschedule"]);
});
it("serves a Manager completion photo through the request-scoped digest with safe headers and no Tenant route (Task8)",async()=>{
  const s=setup();const photoId=randomUUID();
  const r=await s.call(`manager/tickets/${ticketId}/vendor-completion-photos/${photoId}`);
  expect(r.status).toBe(200);
  expect([r.headers.get("content-type"),r.headers.get("cache-control"),r.headers.get("x-content-type-options")]).toEqual(["image/png","private, no-store","nosniff"]);
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
  expect(s.calls.at(-1)).toMatchObject({method:"completionPhoto",digest,id:ticketId,input:photoId});
  const before=s.calls.length;
  expect((await s.call(`manager/tickets/${ticketId}/vendor-completion-photos/not-a-uuid`)).status).toBe(404);
  expect((await s.call(`manager/tickets/${ticketId}/vendor-completion-photos/${photoId}`,"POST",{})).status).toBe(404);
  expect(s.calls.length).toBe(before);
  const tenant=setup("TENANT");
  expect((await tenant.call(`manager/tickets/${ticketId}/vendor-completion-photos/${photoId}`)).status).toBe(403);
  expect((await tenant.call(`tickets/${ticketId}/vendor-completion-photos/${photoId}`)).status).toBe(404);
  expect(tenant.calls).toEqual([]);
});

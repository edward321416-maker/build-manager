import { randomUUID } from "node:crypto";
import { expect,it,vi } from "vitest";
import { CoreFlowError,buildCoreFollowUpTicket,type CoreRecord,type CoreScope,type CoreFlowPort,type CoreSession } from "@build-manager/application";
import { handleCoreFlow } from "./http";
import { requireCoreB1Session } from "./b1-access";

const id=randomUUID(),key=randomUUID();
const empty={ticketId:id,kind:"UNCONFIRMED",assertedAt:null,followUpTicketId:null};
const resolved={...empty,kind:"RESOLVED",assertedAt:"2026-10-04T00:00:00Z"};
function setup(role:CoreSession["role"]="TENANT"){
 const outcome={read:vi.fn().mockResolvedValue(empty),confirmResolved:vi.fn().mockResolvedValue({outcome:resolved,created:true}),createFollowUp:vi.fn(),receipt:vi.fn().mockResolvedValue({outcome:resolved,targetTicketId:null}),source:vi.fn().mockResolvedValue({sourceTicketId:null})};
 const port:CoreFlowPort={run:async(_h,op)=>op({session:{role},outcome} as unknown as CoreScope)};
 const call=(path:string,method="GET",data?:unknown,headers:Record<string,string>={})=>handleCoreFlow(new Request("http://127.0.0.1:3130/api/v2/core/"+path,{method,headers:{Authorization:`Bearer ${"a".repeat(64)}`,"Content-Type":"application/json",...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),path.split("?")[0].split("/"),()=>({port,revoke:vi.fn(),origins:["http://127.0.0.1:3130"]}));
 return {outcome,call,port};
}
it("projects unconfirmed outcome separately, with private no-store headers",async()=>{
 const s=setup(),r=await s.call(`tickets/${id}/outcome`);expect(r.status).toBe(200);expect(await r.json()).toEqual(empty);expect(r.headers.get("cache-control")).toBe("private, no-store");
});
it("confirms only strict tenant requests and returns201 then exact replay200",async()=>{
 const s=setup(),p=`tickets/${id}/outcome/resolved`;
 expect((await s.call(p,"POST",{clientRequestId:key})).status).toBe(201);
 s.outcome.confirmResolved.mockResolvedValue({outcome:resolved,created:false});const r=await s.call(p,"POST",{clientRequestId:key});expect(r.status).toBe(200);expect(await r.json()).toEqual(resolved);
 for(const v of [{},{clientRequestId:"bad"},{clientRequestId:key,actorId:randomUUID()},{clientRequestId:key,kind:"RESOLVED"}])expect((await s.call(p,"POST",v)).status).toBe(400);
});
it("allows scoped manager reads but forbids manager outcome and follow-up writes",async()=>{
 for(const role of ["ORG_ADMIN","PROPERTY_STAFF"] as const){const s=setup(role);expect((await s.call(`tickets/${id}/outcome`)).status).toBe(200);expect((await s.call(`tickets/${id}/outcome/resolved`,"POST",{clientRequestId:key})).status).toBe(403);expect((await s.call(`tickets/${id}/follow-up`,"POST",{clientRequestId:key,claimKind:"UNRESOLVED",issueType:"LEAK",rawUserText:"합성 새 증상"})).status).toBe(403);expect(s.outcome.confirmResolved).not.toHaveBeenCalled();expect(s.outcome.createFollowUp).not.toHaveBeenCalled();}
});
it("rejects identity, context query and private projection fields and sanitizes conflicts",async()=>{
 const s=setup();expect((await s.call(`tickets/${id}/outcome?actorId=x`)).status).toBe(400);
 expect((await s.call(`tickets/${id}/outcome/resolved`,"POST",{clientRequestId:key},{Origin:"http://untrusted.invalid"})).status).toBe(403);
 s.outcome.read.mockResolvedValue({...empty,actorId:randomUUID()} as never);const denied=await s.call(`tickets/${id}/outcome`);expect(denied.status).toBe(503);expect(await denied.text()).not.toContain("actorId");
 s.outcome.confirmResolved.mockRejectedValue(new CoreFlowError("STATE_CONFLICT"));const r=await s.call(`tickets/${id}/outcome/resolved`,"POST",{clientRequestId:key});expect(r.status).toBe(409);expect(await r.text()).not.toContain(key);
});
it("validates fresh follow-up inputs before persistence without relaxing unrelated query routes",async()=>{
 const s=setup(),base={clientRequestId:key,claimKind:"UNRESOLVED",issueType:"LEAK",rawUserText:"새 합성 증상"};
 for(const extra of [{unitId:randomUUID()},{targetTicketId:randomUUID()},{actorId:randomUUID()},{answers:[]},{photos:[]}])expect((await s.call(`tickets/${id}/follow-up`,"POST",{...base,...extra})).status).toBe(400);
 for(const rawUserText of [" ","x".repeat(2001),"a\u200bb"])expect((await s.call(`tickets/${id}/follow-up`,"POST",{...base,rawUserText})).status).toBe(400);
 expect((await s.call(`tickets/${id}/follow-up?unitId=${randomUUID()}`)).status).toBe(400);expect(s.outcome.createFollowUp).not.toHaveBeenCalled();
});
it("returns only own saved receipt and authorized source context, denying unknown keys",async()=>{
 const s=setup(),p=`tickets/${id}/outcome/requests/${key}`;const r=await s.call(p);expect(r.status).toBe(200);expect(await r.json()).toEqual({outcome:resolved,targetTicketId:null});
 s.outcome.receipt.mockRejectedValue(new CoreFlowError("NOT_FOUND"));expect((await s.call(p)).status).toBe(404);
 expect((await s.call(`tickets/${id}/follow-up`)).status).toBe(200);expect((await s.call(p+"?claimKind=RESOLVED")).status).toBe(400);
});
it("returns a normal fresh tenant ticket with201 or replay200 and no private relation payload",async()=>{
 const s=setup(),targetId=randomUUID(),unitId=randomUUID(),building={id:randomUUID(),displayName:"합성 건물",demo:true,sourceNativeIds:{},context:[]};
 const input={clientRequestId:key,claimKind:"UNRESOLVED" as const,issueType:"LEAK" as const,rawUserText:"새 합성 증상"};
 const source:CoreRecord={building,workStatus:"COMPLETED",version:3,events:[],ticket:{id,buildingId:building.id,unitId,issueType:"LEAK",rawUserText:"이전 합성 설명",status:"IN_PROGRESS",protocolId:null,answers:[],evidence:[],safetyFlags:[],repairPacket:null,routeDecision:null,moreInfoRequest:null,createdAt:"2026-10-04T00:00:00Z",updatedAt:"2026-10-04T00:00:00Z"}};
 const ticket=await buildCoreFollowUpTicket(source,input,{now:()=>"2026-10-04T00:00:00Z"},{next:()=>targetId});
 const sourceOutcome={...resolved,kind:"UNRESOLVED",followUpTicketId:targetId};
 const result={sourceOutcome,ticket:{ticket,building,workStatus:"OPEN",version:1,events:[{id:"1",kind:"CREATED",actorRole:"TENANT",message:"",at:ticket.createdAt}]}};
 for(const created of [true,false]){s.outcome.createFollowUp.mockResolvedValue({...result,created});const r=await s.call(`tickets/${id}/follow-up`,"POST",input);expect(r.status).toBe(created?201:200);
  const value=await r.json();expect(Object.keys(value).sort()).toEqual(["sourceOutcome","ticket"]);expect(value.sourceOutcome).toEqual(sourceOutcome);expect(value.ticket).toMatchObject({ticketId:targetId,unitId,workStatus:"OPEN",version:1});expect(value.ticket.detail).not.toHaveProperty("building");
  expect(r.headers.get("cache-control")).toBe("private, no-store");
 }
 s.outcome.createFollowUp.mockResolvedValue({...result,sourceOutcome:{...sourceOutcome,actorId:id},created:true});const invalid=await s.call(`tickets/${id}/follow-up`,"POST",input);expect(invalid.status).toBe(503);expect(await invalid.text()).not.toContain("actorId");
});
it("retains the existing B1 Origin/CSRF guard before either new mutation",async()=>{
 const s=setup(),origin="http://localhost:3133",now=Math.floor(Date.now()/1000),org=randomUUID();
 const sdk={user:{sub:"auth0|synthetic-outcome"},tokenSet:{accessToken:"unused",expiresAt:now+3600},internal:{sid:"synthetic",createdAt:now},b1:{handle:"a".repeat(64),csrf:"b".repeat(64),issuedAt:now,expiresAt:now+3600}};
 const auth={readSession:vi.fn().mockResolvedValue(sdk),sessions:{currentActor:vi.fn().mockResolvedValue("synthetic-actor"),revoke:vi.fn()},appBaseUrl:origin};
 const deps={port:s.port,revoke:vi.fn(),origins:[origin],b1:{current:(r:Request)=>requireCoreB1Session(r,auth),access:{organizations:async()=>[],inOrganization:()=>s.port}}};
 for(const tail of ["outcome/resolved","follow-up"]){const path=`tickets/${id}/${tail}`,input=tail==="follow-up"?{clientRequestId:key,claimKind:"UNRESOLVED",issueType:"LEAK",rawUserText:"새 합성 증상"}:{clientRequestId:key};
  for(const headers of ([{},{Origin:origin},{Origin:origin,"x-b1-csrf":"c".repeat(64)}] as Record<string,string>[])){const r=await handleCoreFlow(new Request(origin+"/api/v2/core/"+path,{method:"POST",headers:{"Content-Type":"application/json","x-core-organization":org,Authorization:`Bearer ${"a".repeat(64)}`,...headers},body:JSON.stringify(input)}),path.split("/"),()=>deps);expect(r.status).toBe(403);}
 }
 expect(s.outcome.confirmResolved).not.toHaveBeenCalled();expect(s.outcome.createFollowUp).not.toHaveBeenCalled();
 const path=`tickets/${id}/outcome/resolved`,headers={"Content-Type":"application/json",Origin:origin,"x-core-organization":org,"x-b1-csrf":sdk.b1.csrf};
 const call=()=>handleCoreFlow(new Request(origin+"/api/v2/core/"+path,{method:"POST",headers,body:JSON.stringify({clientRequestId:key})}),path.split("/"),()=>deps);
 expect((await call()).status).toBe(201);auth.readSession.mockResolvedValue(null);expect((await call()).status).toBe(401);expect(s.outcome.confirmResolved).toHaveBeenCalledTimes(1);
});

import { randomUUID } from "node:crypto";
import { expect,it,vi } from "vitest";
import { CoreFlowError,createCoreMaintenanceFact,correctCoreMaintenanceFact,type CoreFlowPort,type CoreScope,type CoreSession } from "@build-manager/application";
import { handleCoreFlow } from "./http";
import { requireCoreB1Session } from "./b1-access";
const id=randomUUID(),factId=randomUUID(),unitId=randomUUID(),key=randomUUID();
const fact={factId,unitId,buildingId:randomUUID(),buildingName:"합성 건물",unitLabel:"합성 호실",sourceTicketId:id,issueType:"LEAK",actionKind:"INSPECTION",componentLabel:null,sourceCompletedAt:"2026-10-04T00:00:00Z",recordedAt:"2026-10-04T01:00:00Z",corrected:false,correctionCount:0,tenantOutcome:"UNCONFIRMED",previousTicketId:null,followUpTicketId:null};
const input={clientRequestId:key,actionKind:"INSPECTION" as const,componentLabel:null};
const correction={...input,expectedCurrentFactId:factId,actionKind:"REPAIR" as const,correctionReason:"ACTION_CLASSIFICATION" as const};
const paths={list:`manager/units/${unitId}/maintenance-timeline`,detail:`manager/tickets/${id}/maintenance-fact`,correct:`manager/maintenance-facts/${factId}/corrections`};
function setup(role:CoreSession["role"]="ORG_ADMIN"){
 const maintenance={listUnit:vi.fn().mockResolvedValue([fact]),readForTicket:vi.fn().mockResolvedValue({current:fact,revisions:[]}),create:vi.fn().mockResolvedValue({fact,created:true}),correct:vi.fn().mockResolvedValue({fact,created:true})};
 const scope={session:{role},maintenance} as unknown as CoreScope;
 const port:CoreFlowPort={run:async(_hash,op)=>op(scope)};
 const call=(path:string,method="GET",data?:unknown,headers:Record<string,string>={})=>handleCoreFlow(new Request("http://127.0.0.1:3130/api/v2/core/"+path,{method,headers:{Authorization:`Bearer ${"a".repeat(64)}`,"Content-Type":"application/json",...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),path.split("?")[0].split("/"),()=>({port,revoke:vi.fn(),origins:["http://127.0.0.1:3130"]}));
 return {maintenance,call,port,scope};
}
it.each(["ORG_ADMIN","PROPERTY_STAFF"] as const)("serves scoped %s projections with private no-store",async role=>{
 const s=setup(role),r=await s.call(paths.list);expect(r.status).toBe(200);expect(await r.json()).toEqual([fact]);expect(r.headers.get("cache-control")).toBe("private, no-store");
 const detail=await s.call(paths.detail);expect(detail.status).toBe(200);expect(await detail.json()).toEqual({current:fact,revisions:[]});
});
it("denies all tenant routes and both application commands before maintenance persistence",async()=>{
 const s=setup("TENANT");for(const [path,method,data]of [[paths.list,"GET",undefined],[paths.detail,"GET",undefined],[paths.detail,"POST",input],[paths.correct,"POST",correction]] as const)expect((await s.call(path,method,data)).status).toBe(403);
 expect(()=>createCoreMaintenanceFact(s.scope,id,input)).toThrow("FORBIDDEN");expect(()=>correctCoreMaintenanceFact(s.scope,factId,correction)).toThrow("FORBIDDEN");
 for(const fn of Object.values(s.maintenance))expect(fn).not.toHaveBeenCalled();
});
it("returns strict fact-only201 for first writes and200 for exact replays",async()=>{
 const s=setup();for(const [path,body,fn]of [[paths.detail,input,s.maintenance.create],[paths.correct,correction,s.maintenance.correct]] as const){for(const created of [true,false]){fn.mockResolvedValue({fact,created});const r=await s.call(path,"POST",body);expect(r.status).toBe(created?201:200);expect(await r.json()).toEqual(fact);}}
});
it("rejects client source/identity/time injection, invalid correction fields, query and UUIDs",async()=>{
 const s=setup();for(const [path,base]of [[paths.detail,input],[paths.correct,correction]] as const)for(const key of ["actorId","orgId","unitId","sourceTicketId","sourceCompletedAt","recordedBy","tenantId"])expect((await s.call(path,"POST",{...base,[key]:randomUUID()})).status).toBe(400);
 for(const change of [{expectedCurrentFactId:undefined},{correctionReason:"BAD"},{actionKind:"REPLACE"},{componentLabel:"x\u200by"}])expect((await s.call(paths.correct,"POST",{...correction,...change})).status).toBe(400);
 for(const path of [paths.list+"?unitId="+unitId,paths.detail+"?actorId=x",paths.correct+"?tenantId=x",paths.list.replace(unitId,"invalid")])expect((await s.call(path)).status).toBe(400);
 expect(s.maintenance.create).not.toHaveBeenCalled();expect(s.maintenance.correct).not.toHaveBeenCalled();
});
it("preserves database order and fails closed on over-bound or private DTO fields",async()=>{
 const s=setup(),items=[{...fact,factId:randomUUID()},fact];s.maintenance.listUnit.mockResolvedValue(items);expect(await (await s.call(paths.list)).json()).toEqual(items);
 s.maintenance.listUnit.mockResolvedValue(Array(101).fill(fact));expect((await s.call(paths.list)).status).toBe(503);
 for(const fn of [s.maintenance.listUnit,s.maintenance.readForTicket,s.maintenance.create])fn.mockResolvedValue({fact:{...fact,recordedBy:"PRIVATE"},created:true});
 const r=await s.call(paths.detail,"POST",input);expect(r.status).toBe(503);expect(await r.text()).not.toMatch(/PRIVATE|recordedBy|stack/);
});
it("sanitizes unauthorized, missing, stale and infrastructure failures",async()=>{
 const s=setup();for(const [code,status]of [["UNAUTHENTICATED",401],["FORBIDDEN",403],["NOT_FOUND",404],["INVALID_INPUT",400],["STATE_CONFLICT",409]] as const){s.maintenance.correct.mockRejectedValue(new CoreFlowError(code));const r=await s.call(paths.correct,"POST",correction);expect(r.status).toBe(status);expect(await r.text()).not.toContain(factId);}
 s.maintenance.create.mockRejectedValue(new Error("PRIVATE_DATABASE_DETAIL"));const r=await s.call(paths.detail,"POST",input);expect(r.status).toBe(503);expect(await r.text()).not.toContain("PRIVATE_DATABASE_DETAIL");
});
it("keeps B1 Origin and CSRF mandatory for both fact mutations, including replay",async()=>{
 const s=setup(),origin="http://localhost:3133",now=Math.floor(Date.now()/1000),org=randomUUID();
 const sdk={user:{sub:"auth0|synthetic-maintenance"},tokenSet:{accessToken:"unused",expiresAt:now+3600},internal:{sid:"synthetic",createdAt:now},b1:{handle:"a".repeat(64),csrf:"b".repeat(64),issuedAt:now,expiresAt:now+3600}};
 const auth={readSession:vi.fn().mockResolvedValue(sdk),sessions:{currentActor:vi.fn().mockResolvedValue("synthetic-actor"),revoke:vi.fn()},appBaseUrl:origin};
 const deps={port:s.port,revoke:vi.fn(),origins:[origin],b1:{current:(r:Request)=>requireCoreB1Session(r,auth),access:{organizations:async()=>[],inOrganization:()=>s.port}}};
 for(const [path,body]of [[paths.detail,input],[paths.correct,correction]] as const){for(const headers of ([{},{Origin:origin},{Origin:origin,"x-b1-csrf":"c".repeat(64)}] as Record<string,string>[])){
  const r=await handleCoreFlow(new Request(origin+"/api/v2/core/"+path,{method:"POST",headers:{"Content-Type":"application/json","x-core-organization":org,...headers},body:JSON.stringify(body)}),path.split("/"),()=>deps);expect(r.status).toBe(403);
 }}expect(s.maintenance.create).not.toHaveBeenCalled();expect(s.maintenance.correct).not.toHaveBeenCalled();
 const call=()=>handleCoreFlow(new Request(origin+"/api/v2/core/"+paths.detail,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"x-core-organization":org,"x-b1-csrf":sdk.b1.csrf},body:JSON.stringify(input)}),paths.detail.split("/"),()=>deps);
 expect((await call()).status).toBe(201);auth.readSession.mockResolvedValue(null);expect((await call()).status).toBe(401);
});

import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,it,expect } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort,createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreAction,type CoreScope } from "@build-manager/application";
import sharp from "sharp";
import { createB1Fixture } from "./helpers/b1-fixture";
import { handleCoreFlow } from "../../apps/web/src/server/core-flow/http";
import type { CoreHTTPDependencies } from "../../apps/web/src/server/core-flow/container";
// Spec: docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md (PR 1): a tenant names one of the ticket's
// own photos as the required evidence, through the EVIDENCE action and the widened store_ticket (migration 0024).
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,bytes:Buffer;
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);bytes=await sharp({create:{width:20,height:10,channels:3,background:"#197c92"}}).png().toBuffer();});
afterAll(async()=>{await db?.close();await f?.close();});
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const act=(who:string,action:CoreAction)=>run(who,s=>performCoreAction(s,action,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const ANSWERS:[string,string|boolean][]=[["safety.electricalWaterRisk",false],["safety.otherUrgentHazard",false],["safety.gasSmell",false],["safety.smokeOrFire",false],
  ["leak.location","CEILING_WALL"],["leak.active",true],["leak.applianceOnly",false],["leak.firstObservedAt","오늘 아침"]];
const answered=async()=>{const t=await act("tenant",{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"합성 사진 증빙 검사"});for(const [questionId,value] of ANSWERS)await act("tenant",{type:"ANSWER",ticketId:t.ticket.id,questionId,value});return t;};
const photo=async(id:string)=>(await run("tenant",s=>s.savePhoto(id,{uploadId:randomUUID(),mime:"image/png",width:20,height:10,bytes}))).photo.photoId;
const evidence=(who:string,ticketId:string,photoId:string,evidenceType:"LEAK_AREA_PHOTO"|"FIXTURE_PHOTO"="LEAK_AREA_PHOTO")=>act(who,{type:"EVIDENCE",ticketId,evidenceType,photoId});

it("lets the tenant name an uploaded photo as the leak photo, so submitting reaches review with a route",async()=>{
  const t=await answered(),p=await photo(t.ticket.id);
  const named=await evidence("tenant",t.ticket.id,p);
  expect(named.ticket.evidence).toEqual([expect.objectContaining({type:"LEAK_AREA_PHOTO",source:"TENANT_UPLOAD",storageRef:`core-photo:${p}`,fixtureRef:null})]);
  expect(named.events.at(-1)).toMatchObject({kind:"EVIDENCE",actorRole:"TENANT"});
  const done=await act("tenant",{type:"FINALIZE",ticketId:t.ticket.id});
  expect(done.ticket.status).toBe("READY_FOR_REVIEW");
  expect(done.ticket.repairPacket?.recommendation?.primary).toBe("LANDLORD_REVIEW");
});

it("still submits as PARTIAL when no photo is named",async()=>{
  const t=await answered();await photo(t.ticket.id);
  expect((await act("tenant",{type:"FINALIZE",ticketId:t.ticket.id})).ticket.status).toBe("PARTIAL");
});

it("records nothing for a repeated choice and a new event when another photo is named",async()=>{
  const t=await answered(),a=await photo(t.ticket.id),b=await photo(t.ticket.id);
  const first=await evidence("tenant",t.ticket.id,a),again=await evidence("tenant",t.ticket.id,a);
  expect(again.version).toBe(first.version);expect(again.events).toEqual(first.events);
  const changed=await evidence("tenant",t.ticket.id,b);
  expect(changed.events.filter(e=>e.kind==="EVIDENCE")).toHaveLength(2);
  expect(changed.ticket.evidence.map(e=>e.storageRef)).toEqual([`core-photo:${b}`]);
});

it("refuses another ticket's photo, other roles, an unrequested type and completed handling without recording",async()=>{
  const t=await answered(),other=await answered(),foreign=await photo(other.ticket.id),own=await photo(t.ticket.id);
  await expect(evidence("tenant",t.ticket.id,foreign)).rejects.toMatchObject({code:"NOT_FOUND"});
  await expect(evidence("tenant",t.ticket.id,randomUUID())).rejects.toMatchObject({code:"NOT_FOUND"});
  for(const who of ["manager","staff"])await expect(evidence(who,t.ticket.id,own)).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(evidence("tenant",t.ticket.id,own,"FIXTURE_PHOTO")).rejects.toMatchObject({code:"STATE_CONFLICT"});
  const unchanged=await run("tenant",s=>s.read(t.ticket.id));
  expect(unchanged.ticket.evidence).toEqual([]);expect(unchanged.events.some(e=>e.kind==="EVIDENCE")).toBe(false);
  await act("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"IN_PROGRESS",message:"합성 확인"});
  await act("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"COMPLETED",message:"합성 완료"});
  await expect(evidence("tenant",t.ticket.id,own)).rejects.toMatchObject({code:"STATE_CONFLICT"});
});

const origin="http://127.0.0.1:3130";
function http(who:string,path:string,body?:unknown){
  const d={port:createCoreFlowPort(db),revoke:async()=>{},origins:[origin],
    b1:{current:async()=>({digest:data.accounts[who].digest,csrf:"synthetic-proof"}),access:createCoreAccessPort(db)}} as unknown as CoreHTTPDependencies;
  return handleCoreFlow(new Request(`${origin}/api/v2/core/${path}`,{method:body===undefined?"GET":"POST",
    headers:{Origin:origin,"X-Core-Organization":data.accounts[who].orgId,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),()=>d);
}

it("names the photo over HTTP with its public type and shows the choice in the tenant status",async()=>{
  const t=await answered(),p=await photo(t.ticket.id);
  const named=await http("tenant",`tickets/${t.ticket.id}/evidence`,{evidenceType:"LEAK_LOCATION",photoId:p});
  expect(named.status).toBe(200);
  const detail=(await named.json() as {detail:{evidenceStatus:string;submittedEvidence:unknown[]}}).detail;
  expect(detail.evidenceStatus).toBe("COMPLETE");
  expect(detail.submittedEvidence).toEqual([expect.objectContaining({evidenceType:"LEAK_LOCATION",photoId:p})]);
  expect((await http("tenant",`tickets/${t.ticket.id}/evidence`,{evidenceType:"LEAK_LOCATION",photoId:`core-photo:${p}`})).status).toBe(400);
  expect((await http("manager",`tickets/${t.ticket.id}/evidence`,{evidenceType:"LEAK_LOCATION",photoId:p})).status).toBe(403);
});

it("accepts an EVIDENCE event from a tenant session only",async()=>{
  const t=await answered(),record=await run("tenant",s=>s.read(t.ticket.id));
  for(const who of ["manager","staff"])await expect(run(who,s=>s.store(record.ticket,"EVIDENCE",""))).rejects.toMatchObject({code:"FORBIDDEN"});
  await run("tenant",s=>s.store(record.ticket,"EVIDENCE",""));
  expect((await run("tenant",s=>s.read(t.ticket.id))).events.at(-1)).toMatchObject({kind:"EVIDENCE",actorRole:"TENANT"});
});

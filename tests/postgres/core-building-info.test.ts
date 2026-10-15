import { createHash,randomBytes,randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import { createCoreAccessPort,createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreBuildingInfoInput,type CoreScope,type OnboardingAction,type OnboardingResult } from "@build-manager/application";
import { selectProtocol,type Building } from "@build-manager/domain";
import { createB1Fixture } from "./helpers/b1-fixture";
import { handleCoreFlow } from "../../apps/web/src/server/core-flow/http";
import type { CoreHTTPDependencies } from "../../apps/web/src/server/core-flow/container";

// P6 + C1 step 2 (docs/superpowers/specs/2026-10-15-building-setup-p6-design.md): organisation admins save building info.
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const token=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);},120_000);
afterAll(async()=>{await db?.close();await f?.close();});
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const input=(over:Partial<CoreBuildingInfoInput>={}):CoreBuildingInfoInput=>({expectedVersion:0,displayName:"합성 햇살빌라",serviceAddress:"합성 예시로 12",heatingType:"INDIVIDUAL",managementMode:null,...over});
async function registered(label:string){
 const registration=createBuildingRegistrationPort(db),manager=data.accounts.manager.digest;
 const property=await registration.createProperty(manager,data.orgA,{addressReference:`합성 P6 ${label}`});
 const unit=await registration.createUnit(manager,data.orgA,property.id,{label:`합성 P6 ${label} 101`});
 return {property,unit};
}
type View={invitationId:string;requestNumber:string|null;state:string};
const view=(r:OnboardingResult):View=>{expect(r).toHaveProperty("data");return (r as {data:View}).data;};
async function connectedTenant(unitId:string){
 const digest=token();await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour') id",["https://p6.synthetic.invalid/",randomUUID(),Buffer.from(digest,"hex")]);
 const onboard=(action:OnboardingAction,body:Record<string,unknown>,who=data.accounts.manager.digest,org:string|null=data.orgA)=>createCoreOnboardingPort(db).execute(who,action,org,body);
 const tokenDigest=token();
 expect(view(await onboard("CREATE",{unitId,tokenDigest})).state).toBe("OPEN");
 const claim=view(await onboard("CLAIM",{tokenDigest},digest,null));
 expect(view(await onboard("APPROVE",{invitationId:claim.invitationId,requestNumber:claim.requestNumber})).state).toBe("APPROVED");
 return <T>(op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db,data.orgA).run(digest,op);
}

it("lets the organisation admin read, list and save a registered building",async()=>{
 const b=await registered("A");
 expect(await run("manager",s=>s.buildings.read(b.property.id))).toEqual({buildingId:b.property.id,displayName:null,serviceAddress:null,heatingType:null,managementMode:null,demo:false,version:0,unitCount:1});
 expect((await run("manager",s=>s.buildings.list())).find(x=>x.buildingId===b.property.id)).toEqual({buildingId:b.property.id,displayName:null,unitCount:1,needsInfo:true});
 expect(await run("manager",s=>s.buildings.save(b.property.id,input()))).toEqual({buildingId:b.property.id,displayName:"합성 햇살빌라",serviceAddress:"합성 예시로 12",heatingType:"INDIVIDUAL",managementMode:null,demo:false,version:1,unitCount:1});
 expect((await run("manager",s=>s.buildings.list())).find(x=>x.buildingId===b.property.id)).toEqual({buildingId:b.property.id,displayName:"합성 햇살빌라",unitCount:1,needsInfo:false});
 expect(await run("manager",s=>s.buildings.save(b.property.id,input({expectedVersion:1,serviceAddress:null,heatingType:null,managementMode:"MANAGEMENT_OFFICE"})))).toMatchObject({version:2,serviceAddress:null,heatingType:null,managementMode:"MANAGEMENT_OFFICE"});
 expect((await run("manager",s=>s.buildings.list())).find(x=>x.buildingId===b.property.id)?.needsInfo).toBe(true);
},60_000);

it("stores owner-verified facts the tenant's questions, the unit list and the vendor source use",async()=>{
 const b=await registered("B"),tenant=await connectedTenant(b.unit.id);
 await run("manager",s=>s.buildings.save(b.property.id,input({managementMode:"OWNER_DIRECT"})));
 expect((await tenant(s=>s.units())).find(x=>x.id===b.unit.id)?.buildingName).toBe("합성 햇살빌라");
 const building=await tenant(s=>s.building(b.unit.id)) as Building;
 expect(building).toMatchObject({id:b.property.id,displayName:"합성 햇살빌라",demo:false});
 expect(building.context.map(x=>[x.key,x.value,x.sourceType,x.verified,x.routingEligible])).toEqual([["heatingType","INDIVIDUAL","OWNER_VERIFIED",true,true],["managementMode","OWNER_DIRECT","OWNER_VERIFIED",true,true]]);
 expect(selectProtocol(building,"HEATING").id).toBe("HEATING_INDIVIDUAL_V1");
 const created=await tenant(s=>performCoreAction(s,{type:"CREATE",unitId:b.unit.id,issueType:"HEATING",rawUserText:"합성 P6 난방 접수"},{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
 expect(created.ticket.protocolId).toBe("HEATING_INDIVIDUAL_V1");
 // The vendor packet's source (0019/0025, owner-only) carries the saved name and address for the manager's ticket.
 const source=(await f.p.admin.query("SELECT core_flow.vendor_handoff_source($1,$2,NULL,false) s",[Buffer.from(data.accounts.manager.digest,"hex"),created.ticket.id])).rows[0].s;
 expect(source.building).toMatchObject({displayName:"합성 햇살빌라",serviceAddress:"합성 예시로 12"});
 expect(source.unitLabel).toBe("합성 P6 B 101");
 await run("manager",s=>s.buildings.save(b.property.id,input({expectedVersion:1,heatingType:null})));
 expect(selectProtocol(await tenant(s=>s.building(b.unit.id)) as Building,"HEATING").id).toBe("HEATING_UNKNOWN_V1");
},90_000);

it("refuses staff, tenants, other organisations and demo buildings",async()=>{
 const b=await registered("C");
 for(const who of ["staff","tenant"]){
  await expect(run(who,s=>s.buildings.list())).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(run(who,s=>s.buildings.read(b.property.id))).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(run(who,s=>s.buildings.save(b.property.id,input()))).rejects.toMatchObject({code:"FORBIDDEN"});
 }
 await expect(run("otherManager",s=>s.buildings.read(b.property.id))).rejects.toMatchObject({code:"NOT_FOUND"});
 await expect(run("otherManager",s=>s.buildings.save(b.property.id,input()))).rejects.toMatchObject({code:"NOT_FOUND"});
 expect((await run("otherManager",s=>s.buildings.list())).map(x=>x.buildingId)).not.toContain(b.property.id);
 expect(await run("manager",s=>s.buildings.read(data.propertyA))).toMatchObject({demo:true,displayName:"RC1 합성 건물 A",heatingType:"INDIVIDUAL",managementMode:"OWNER_DIRECT",version:0});
 await expect(run("manager",s=>s.buildings.save(data.propertyA,input()))).rejects.toMatchObject({code:"FORBIDDEN"});
 expect((await f.p.admin.query("SELECT body->>'displayName' n FROM core_flow.building_context WHERE property_id=$1",[data.propertyA])).rows[0].n).toBe("RC1 합성 건물 A");
},60_000);

/** A second organisation admin in org A with its own session, so its saves do not queue behind the first admin's session lock. */
async function secondAdmin(){
 const handle=randomBytes(32).toString("hex"),digest=createHash("sha256").update(handle).digest("hex");
 const userId=(await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes') AS id",["https://p6.synthetic.invalid/",`p6-admin-${randomUUID()}`,Buffer.from(digest,"hex")])).rows[0].id;
 await f.p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[randomUUID(),data.orgA,userId]);
 await f.p.admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)",[Buffer.from(digest,"hex"),data.orgA]);
 return <T>(op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(digest,op);
}

it("rejects a stale version, including two admins saving a new building at once",async()=>{
 const other=await secondAdmin();
 for(const round of [1,2,3,4,5]){
  const b=await registered(`D${round}`);
  const both=await Promise.allSettled([run("manager",s=>s.buildings.save(b.property.id,input({displayName:"합성 동시 1"}))),other(s=>s.buildings.save(b.property.id,input({displayName:"합성 동시 2"})))]);
  expect(both.map(x=>x.status).sort(),`round ${round}`).toEqual(["fulfilled","rejected"]);
  expect((both.find(x=>x.status==="rejected") as PromiseRejectedResult).reason).toMatchObject({code:"STATE_CONFLICT"});
  expect((await run("manager",s=>s.buildings.read(b.property.id))).version).toBe(1);
 }
 const b=await registered("D6");
 await run("manager",s=>s.buildings.save(b.property.id,input()));
 await expect(other(s=>s.buildings.save(b.property.id,input()))).rejects.toMatchObject({code:"STATE_CONFLICT"});
},120_000);

it("rejects input outside the bounds",async()=>{
 const b=await registered("E");
 // Format characters too (review MEDIUM): the vendor packet refuses \p{Cc}\p{Cf}, so the database must never store them.
 for(const bad of [{displayName:""},{displayName:" 합성"},{displayName:"합성\n건물"},{displayName:"가".repeat(51)},{serviceAddress:""},{serviceAddress:"가".repeat(201)},{serviceAddress:"합성\t주소"},
  {displayName:"합성​건물"},{displayName:"합성‮건물"},{serviceAddress:"합성\u0085주소"},{serviceAddress:"합성­주소"},{serviceAddress:"합성\u{e0041}주소"},
  {heatingType:"DISTRICT"},{managementMode:"THIRD_PARTY_MANAGER"},{expectedVersion:-1}] as unknown as Partial<CoreBuildingInfoInput>[])
  await expect(run("manager",s=>s.buildings.save(b.property.id,input(bad))),JSON.stringify(bad)).rejects.toMatchObject({code:"INVALID_INPUT"});
 expect(await run("manager",s=>s.buildings.save(b.property.id,input({displayName:"가".repeat(50),serviceAddress:"가".repeat(200)})))).toMatchObject({version:1});
},60_000);

const origin="http://127.0.0.1:3130";
function http(who:string,path:string,body?:unknown,demo=false){
 const account=data.accounts[who];
 const d={port:createCoreFlowPort(db),revoke:async()=>{},origins:[origin],
  b1:{current:async()=>({digest:account.digest,csrf:"synthetic-proof",demo}),access:createCoreAccessPort(db)}} as unknown as CoreHTTPDependencies;
 return handleCoreFlow(new Request(`${origin}/api/v2/core/${path}`,{method:body===undefined?"GET":"POST",
  headers:{Origin:origin,"X-Core-Organization":account.orgId,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),()=>d);
}

it("answers the building routes over HTTP and refuses writes from a demo session",async()=>{
 const b=await registered("H"),path=`buildings/${b.property.id}`;
 const list=await http("manager","buildings");
 expect(list.status).toBe(200);
 expect(await list.json()).toMatchObject({editable:true,items:expect.arrayContaining([{buildingId:b.property.id,displayName:null,unitCount:1,needsInfo:true}])});
 expect(await (await http("manager",path)).json()).toMatchObject({buildingId:b.property.id,version:0,editable:true});
 const saved=await http("manager",path,{...input(),displayName:"  합성 HTTP 빌라  "});
 expect(saved.status).toBe(200);
 expect(await saved.json()).toMatchObject({displayName:"합성 HTTP 빌라",version:1,editable:true});
 expect((await http("manager",path,input())).status).toBe(409);
 expect((await http("manager",path,{...input({expectedVersion:1}),extra:true})).status).toBe(400);
 expect((await http("manager",path,input({expectedVersion:1,displayName:"합성\u0007빌라"}))).status).toBe(400);
 expect((await http("manager",path,input({expectedVersion:1}),true)).status).toBe(403);
 expect((await http("manager",path)).status).toBe(200);
 expect(await (await http("manager",path,undefined,true)).json()).toMatchObject({version:1,editable:false});
 expect(await (await http("manager","buildings",undefined,true)).json()).toMatchObject({editable:false});
 expect(await (await http("manager",`buildings/${data.propertyA}`)).json()).toMatchObject({demo:true,editable:false});
 expect((await http("manager",`buildings/${data.propertyA}`,input())).status).toBe(403);
 expect((await http("staff","buildings")).status).toBe(403);
 expect((await http("tenant",path)).status).toBe(403);
 expect((await http("manager","buildings/not-a-uuid")).status).toBe(400);
 expect((await http("manager",`buildings/${b.property.id}/extra`)).status).toBe(404);
},60_000);

it("adds owner-only definer functions and gives the web role only the three entry points",async()=>{
 const names=["building_info","building_info_json","org_buildings","require_org_admin","save_building_info","verified_fact"];
 const rows=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,has_function_privilege('public',oid,'EXECUTE') pub FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
 expect(rows).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:["building_info","org_buildings","save_building_info"].includes(proname),pub:false})));
 expect((await f.p.admin.query("SELECT has_schema_privilege('bm_core_flow_owner','core_flow','CREATE') c")).rows[0].c).toBe(false);
});

import { createHash,randomBytes,randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreAction,type CoreScope,type OnboardingAction,type OnboardingResult } from "@build-manager/application";
import { CoreManagerWorkItemsSchema,CoreUnitMaintenanceFactSchema,CoreUnitsSchema } from "@build-manager/api-contracts";
import { selectProtocol,type Building } from "@build-manager/domain";
import { createB1Fixture } from "./helpers/b1-fixture";

// C1 step 1 (docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md): a building registered through B3 has
// no core_flow.building_context row. Its units must still work in every Core read, with the fixed name 건물 and no facts.
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const token=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);},120_000);
afterAll(async()=>{await db?.close();await f?.close();});
type View={invitationId:string;requestNumber:string|null;state:string};
function value(r:OnboardingResult):View {expect(r).toHaveProperty("data");return (r as {data:View}).data;}
async function actor(){const digest=token();await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour') id",["https://c1.synthetic.invalid/",randomUUID(),Buffer.from(digest,"hex")]);return {digest};}
const onboard=(action:OnboardingAction,input:Record<string,unknown>,digest=data.accounts.manager.digest,org:string|null=data.orgA)=>createCoreOnboardingPort(db).execute(digest,action,org,input);
const now={now:()=>new Date().toISOString()},ids={next:()=>randomUUID()};
const fixtureRun=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const fixtureAct=(who:string,a:CoreAction)=>fixtureRun(who,s=>performCoreAction(s,a,now,ids));
const contextRows=async(property:string)=>(await f.p.admin.query("SELECT count(*)::int n FROM core_flow.building_context WHERE property_id=$1",[property])).rows[0].n as number;

/** Registers a building and unit as /workspace does, then invites and approves a new tenant for that unit. */
async function registeredAndConnected(label:string){
 const registration=createBuildingRegistrationPort(db),manager=data.accounts.manager.digest;
 const property=await registration.createProperty(manager,data.orgA,{addressReference:`합성 C1 건물 ${label}`});
 const unit=await registration.createUnit(manager,data.orgA,property.id,{label:`합성 C1 ${label}`});
 const tokenDigest=token(),tenant=await actor();
 expect(value(await onboard("CREATE",{unitId:unit.id,tokenDigest})).state).toBe("OPEN");
 const claim=value(await onboard("CLAIM",{tokenDigest},tenant.digest,null));
 expect(value(await onboard("APPROVE",{invitationId:claim.invitationId,requestNumber:claim.requestNumber})).state).toBe("APPROVED");
 const run=<T>(op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db,data.orgA).run(tenant.digest,op);
 return {property,unit,tenant,run,act:(a:CoreAction)=>run(s=>performCoreAction(s,a,now,ids))};
}

it("lists the unit and returns the fallback building with no facts",async()=>{
 const c=await registeredAndConnected("A");
 expect(await contextRows(c.property.id)).toBe(0);
 const units=CoreUnitsSchema.parse(await c.run(s=>s.units()));
 expect(units).toContainEqual({id:c.unit.id,buildingId:c.property.id,label:"합성 C1 A",buildingName:"건물"});
 const building=await c.run(s=>s.building(c.unit.id)) as Building;
 expect(building).toEqual({id:c.property.id,displayName:"건물",demo:false,sourceNativeIds:{},context:[]});
 expect(selectProtocol(building,"HEATING").id).toBe("HEATING_UNKNOWN_V1");
},60_000);

it("lets the tenant create heating and leak requests that ask instead of guessing",async()=>{
 const c=await registeredAndConnected("B");
 const heating=await c.act({type:"CREATE",unitId:c.unit.id,issueType:"HEATING",rawUserText:"합성 C1 난방 접수"});
 expect(heating.ticket.protocolId).toBe("HEATING_UNKNOWN_V1");
 expect(heating.building).toEqual({id:c.property.id,displayName:"건물",demo:false,sourceNativeIds:{},context:[]});
 const leak=await c.act({type:"CREATE",unitId:c.unit.id,issueType:"LEAK",rawUserText:"합성 C1 누수 접수"});
 expect(leak.ticket.protocolId).toBe("LEAK_V1");
 expect((await c.run(s=>s.read(heating.ticket.id))).building.displayName).toBe("건물");
},60_000);

it("keeps the manager queue, the work read and the maintenance history whole",async()=>{
 const c=await registeredAndConnected("C");
 const t=await c.act({type:"CREATE",unitId:c.unit.id,issueType:"LEAK",rawUserText:"합성 C1 관리자 확인"});
 const queue=CoreManagerWorkItemsSchema.parse(await fixtureRun("manager",s=>s.manager.list()));
 expect(queue.find(x=>x.ticketId===t.ticket.id)).toMatchObject({unitId:c.unit.id,buildingId:c.property.id,buildingName:"건물",unitLabel:"합성 C1 C"});
 expect(await fixtureRun("manager",s=>s.manager.read(t.ticket.id))).toMatchObject({ticketId:t.ticket.id,buildingName:"건물"});
 await fixtureAct("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"IN_PROGRESS",message:"합성 처리 시작"});
 const p=await fixtureRun("manager",s=>s.communication.read(t.ticket.id));
 await fixtureAct("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"COMPLETED",message:"합성 완료 기록",expectedCommunicationVersion:p.version});
 const saved=await fixtureRun("manager",s=>s.maintenance.create(t.ticket.id,{clientRequestId:randomUUID(),actionKind:"REPAIR",componentLabel:"합성 배관"}));
 expect(CoreUnitMaintenanceFactSchema.parse(saved.fact)).toMatchObject({unitId:c.unit.id,buildingName:"건물"});
 const history=await fixtureRun("manager",s=>s.maintenance.listUnit(c.unit.id));
 expect(history.map(x=>CoreUnitMaintenanceFactSchema.parse(x).factId)).toEqual([saved.fact.factId]);
},90_000);

it("shows the new unit to nobody outside its tenant and the organisation's managers",async()=>{
 const c=await registeredAndConnected("D");
 for(const who of ["tenantOther","otherTenant","staff"]){
  const units=await fixtureRun(who,s=>s.units());
  expect(units.map(x=>x.id)).not.toContain(c.unit.id);
  await expect(fixtureRun(who,s=>s.building(c.unit.id))).rejects.toMatchObject({code:"NOT_FOUND"});
 }
},60_000);

it("uses a stored building context row instead of the fallback",async()=>{
 const c=await registeredAndConnected("E");
 await f.p.admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) SELECT $1::uuid,$2::uuid,body||jsonb_build_object('id',($2::uuid)::text,'displayName','합성 C1 대조 건물') FROM core_flow.building_context WHERE org_id=$1 AND property_id=$3",[data.orgA,c.property.id,data.propertyA]);
 expect(await contextRows(c.property.id)).toBe(1);
 expect((await c.run(s=>s.units())).find(x=>x.id===c.unit.id)?.buildingName).toBe("합성 C1 대조 건물");
 const building=await c.run(s=>s.building(c.unit.id)) as Building;
 expect(building.displayName).toBe("합성 C1 대조 건물");
 expect(building.context.length).toBeGreaterThan(0);
},60_000);

it("adds only a private owner-only helper and keeps the replaced functions' owner, definer and search path",async()=>{
 const names=["building","building_body","maintenance_fact_json","manager_work_json","units","vendor_handoff_source"];
 const funcs=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,has_function_privilege('bm_vendor_handoff_owner',oid,'EXECUTE') vendor FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
 expect(funcs).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",
  web:proname==="building"||proname==="units",vendor:proname==="vendor_handoff_source"})));
 const helperAcl=(await f.p.admin.query("SELECT array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)) executors FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_flow'::regnamespace AND p.proname='building_body' AND a.privilege_type='EXECUTE'")).rows[0].executors;
 expect(helperAcl).toEqual(["bm_core_flow_owner"]);
});

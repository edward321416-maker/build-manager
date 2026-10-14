import { createHash,randomBytes,randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import type { OnboardingAction,OnboardingResult } from "@build-manager/application";
import { createB1Fixture } from "./helpers/b1-fixture";

// C1 reproduction (research/ux/2026-10-14-feature-connection-gap-analysis.md §4 L-01, CLM-113–CLM-115):
// a building and unit registered through the B3 registration port, with a tenant connected through onboarding,
// should be usable in the core flow. Registration writes no core_flow.building_context row.
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const token=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);},120_000);
afterAll(async()=>{await db?.close();await f?.close();});
type View={invitationId:string;requestNumber:string|null;state:string};
function value(r:OnboardingResult):View {expect(r).toHaveProperty("data");return (r as {data:View}).data;}
async function actor(){const digest=token();await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour') id",["https://c1.synthetic.invalid/",randomUUID(),Buffer.from(digest,"hex")]);return {digest};}
const cmd=(action:OnboardingAction,input:Record<string,unknown>,digest=data.accounts.manager.digest,org:string|null=data.orgA)=>createCoreOnboardingPort(db).execute(digest,action,org,input);

/** Registers a building and unit as /workspace does, then invites and approves a new tenant for that unit. */
async function registeredAndConnected(label:string){
 const registration=createBuildingRegistrationPort(db),manager=data.accounts.manager.digest;
 const property=await registration.createProperty(manager,data.orgA,{addressReference:`합성 C1 재현 건물 ${label}`});
 const unit=await registration.createUnit(manager,data.orgA,property.id,{label:`합성 C1 ${label}`});
 const tokenDigest=token(),tenant=await actor();
 expect(value(await cmd("CREATE",{unitId:unit.id,tokenDigest})).state).toBe("OPEN");
 const claim=value(await cmd("CLAIM",{tokenDigest},tenant.digest,null));
 expect(value(await cmd("APPROVE",{invitationId:claim.invitationId,requestNumber:claim.requestNumber})).state).toBe("APPROVED");
 return {property,unit,tenant};
}
const contextRows=async(property:string)=>(await f.p.admin.query("SELECT count(*)::int n FROM core_flow.building_context WHERE property_id=$1",[property])).rows[0].n as number;

it("C1 reproduction: a tenant connected to a B3-registered unit can see it and its building in the core flow",async()=>{
 const {property,unit,tenant}=await registeredAndConnected("A");
 const access=createCoreAccessPort(db);
 expect(await contextRows(property.id)).toBe(0);
 expect((await access.organizations(tenant.digest)).map(x=>x.role)).toEqual(["TENANT"]);
 const units=await access.inOrganization(data.orgA).run(tenant.digest,s=>s.units());
 expect(units.map(x=>x.id)).toContain(unit.id);
 await expect(access.inOrganization(data.orgA).run(tenant.digest,s=>s.building(unit.id))).resolves.toBeTruthy();
},60_000);

it("positive control: the same unit appears once a building_context row exists for its building",async()=>{
 const {property,unit,tenant}=await registeredAndConnected("B");
 await f.p.admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) SELECT $1::uuid,$2::uuid,body||jsonb_build_object('id',($2::uuid)::text,'displayName','합성 C1 대조 건물') FROM core_flow.building_context WHERE org_id=$1 AND property_id=$3",[data.orgA,property.id,data.propertyA]);
 expect(await contextRows(property.id)).toBe(1);
 const access=createCoreAccessPort(db);
 const units=await access.inOrganization(data.orgA).run(tenant.digest,s=>s.units());
 expect(units.map(x=>x.id)).toContain(unit.id);
 await expect(access.inOrganization(data.orgA).run(tenant.digest,s=>s.building(unit.id))).resolves.toBeTruthy();
},60_000);

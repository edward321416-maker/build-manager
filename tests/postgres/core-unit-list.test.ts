import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { createB1Fixture } from "./helpers/b1-fixture";

// core_flow.units past 200 units: docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,port:ReturnType<typeof createCoreAccessPort>;
const MANY=230;
// Two buildings without a building context row share the fallback name 건물; each has a unit called 101호.
const bare=[randomUUID(),randomUUID()],bareUnits=[randomUUID(),randomUUID()];
const archivedUnit=randomUUID(),archivedProperty=randomUUID(),unitInArchivedProperty=randomUUID();
const padded=(i:number)=>`대량 호실 ${String(i).padStart(3,"0")}`;
const q=(sql:string,values:unknown[])=>f.p.admin.query(sql,values);
const list=(name:string)=>{const a=data.accounts[name];return port.inOrganization(a.orgId).run(a.digest,s=>s.units());};

beforeAll(async()=>{
 f=await createB1Fixture();
 await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
 data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);port=createCoreAccessPort(db);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) SELECT gen_random_uuid(),$1,$2,'대량 호실 '||lpad(g::text,3,'0'),'ACTIVE' FROM generate_series(1,$3::int) g",[data.orgA,data.propertyA,MANY]);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'보관 호실','ARCHIVED')",[archivedUnit,data.orgA,data.propertyA]);
 for(const [i,property] of bare.entries()){
  await q("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,data.orgA]);
  await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'101호','ACTIVE')",[bareUnits[i],data.orgA,property]);
 }
 await q("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ARCHIVED')",[archivedProperty,data.orgA]);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'보관 건물 호실','ACTIVE')",[unitInArchivedProperty,data.orgA,archivedProperty]);
},300_000);
afterAll(async()=>{await db?.close();await f?.close();});

it("lists every active unit an organisation admin can read, past 200",async()=>{
 const ids=(await list("manager")).map(u=>u.id);
 expect(ids).toHaveLength(2+MANY+2);
 expect(new Set(ids).size).toBe(ids.length);
 expect(ids).toEqual(expect.arrayContaining([data.unitA,data.unitOther,...bareUnits]));
 expect(ids).not.toContain(archivedUnit);
 expect(ids).not.toContain(unitInArchivedProperty);
});

it("orders the list by building name, unit label and unit id",async()=>{
 const units=await list("manager");
 expect(units.map(u=>[u.buildingName,u.label])).toEqual([
  ...Array.from({length:MANY},(_,i)=>["RC1 합성 건물 A",padded(i+1)]),
  ["RC1 합성 건물 A","합성 호실 1"],["RC1 합성 건물 A","합성 호실 2"],
  ["건물","101호"],["건물","101호"],
 ]);
 expect(units.slice(-2).map(u=>u.id)).toEqual([...bareUnits].sort());
});

it("gives a property staff member every unit of the assigned building and nothing else",async()=>{
 const units=await list("staff");
 expect(units).toHaveLength(2+MANY);
 expect(new Set(units.map(u=>u.buildingId))).toEqual(new Set([data.propertyA]));
});

it("gives a tenant only the units they live in now",async()=>{
 expect((await list("tenant")).map(u=>u.id)).toEqual([data.unitA]);
 expect((await list("tenantOther")).map(u=>u.id)).toEqual([data.unitOther]);
 const tenant=data.accounts.tenant.userId,now=randomUUID(),later=randomUUID();
 await q("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[now,data.orgA,bareUnits[0]]);
 await q("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()+interval '1 day','ACTIVE')",[later,data.orgA,bareUnits[1]]);
 for(const occupancy of [now,later])await q("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[data.orgA,occupancy,tenant]);
 expect((await list("tenant")).map(u=>u.id)).toEqual([data.unitA,bareUnits[0]]);
 await q("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE occupancy_id=$1",[now]);
 expect((await list("tenant")).map(u=>u.id)).toEqual([data.unitA]);
});

it("keeps each organisation's units to itself",async()=>{
 expect((await list("otherManager")).map(u=>u.id)).toEqual([data.unitB]);
 expect((await list("otherTenant")).map(u=>u.id)).toEqual([data.unitB]);
 expect((await list("manager")).map(u=>u.id)).not.toContain(data.unitB);
});

// The reference answer: every unit of the account's organisation for which core_flow.can_unit is true.
async function allowedByCanUnit(name:string){
 const a=data.accounts[name],hash=Buffer.from(a.digest,"hex");
 await f.p.admin.query("BEGIN");
 try{
  await f.p.admin.query("SELECT core_flow.session($1)",[hash]);
  return (await f.p.admin.query("SELECT u.id FROM app.unit u WHERE u.org_id=$2 AND core_flow.can_unit($1,u.id) ORDER BY u.id",[hash,a.orgId])).rows.map(r=>r.id as string);
 }finally{await f.p.admin.query("ROLLBACK");}
}

it("returns exactly the units core_flow.can_unit allows, for every account",async()=>{
 await q("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')",[data.orgA,data.accounts.staff.membershipId,bare[1]]);
 expect((await list("staff")).map(u=>u.id)).toContain(bareUnits[1]);
 for(const name of Object.keys(data.accounts)){
  const ids=(await list(name)).map(u=>u.id);
  expect([...ids].sort(),name).toEqual(await allowedByCanUnit(name));
 }
});

it("keeps core_flow.units a definer function owned by bm_core_flow_owner with a pinned search path",async()=>{
 const row=(await q("SELECT p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,has_function_privilege('bm_b1_web',p.oid,'EXECUTE') AS web,has_function_privilege('public',p.oid,'EXECUTE') AS everyone FROM pg_proc p WHERE p.oid='core_flow.units(bytea)'::regprocedure",[])).rows[0];
 expect(row).toEqual({prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:true,everyone:false});
});

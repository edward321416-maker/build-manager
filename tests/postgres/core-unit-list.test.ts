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
// The building with the larger id is inserted first, so an order without the building tie-break does not pass by
// insertion order (0027 keeps same-name buildings apart by building id). Unit ids run the other way, so a tie-break
// on unit id instead of building id fails too.
const bare=[randomUUID(),randomUUID()].sort().reverse(),bareUnits=[randomUUID(),randomUUID()].sort();
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

it("orders the list by building name, building, unit label and unit id",async()=>{
 const units=await list("manager");
 expect(units.filter(u=>u.buildingId===data.propertyA).map(u=>u.label).sort()).toEqual([...Array.from({length:MANY},(_,i)=>padded(i+1)),"합성 호실 1","합성 호실 2"].sort());
 // The database sorts the returned rows again with the function's own collation (0027) and the two orders must match;
 // core-unit-order.test.ts pins what that collation does.
 const resorted=(await q("SELECT x->>'id' AS id FROM jsonb_array_elements($1::jsonb) x ORDER BY x->>'buildingName' COLLATE core_flow.unit_name_order,(x->>'buildingId')::uuid,x->>'label' COLLATE core_flow.unit_name_order,(x->>'id')::uuid",[JSON.stringify(units)])).rows.map(r=>r.id as string);
 expect(units.map(u=>u.id)).toEqual(resorted);
 // Same fallback name: the building with the smaller id comes first (bare holds the larger id first).
 expect(units.filter(u=>u.buildingName==="건물").map(u=>u.id)).toEqual([bareUnits[1],bareUnits[0]]);
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
 expect((await list("tenant")).map(u=>u.id).sort()).toEqual([data.unitA,bareUnits[0]].sort());
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

// Runs after the tests above: the assignments and occupancies it adds would change their exact counts.
it("returns exactly the units core_flow.can_unit allows, for every account",async()=>{
 const staff=data.accounts.staff;
 // Staff: an extra active assignment, an ended one, and a home in a building they are not assigned to.
 await q("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')",[data.orgA,staff.membershipId,bare[1]]);
 await q("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status,ended_at) VALUES($1,$2,$3,'ENDED',clock_timestamp())",[data.orgA,staff.membershipId,bare[0]]);
 const home=randomUUID(),homeOccupancy=randomUUID();
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'102호','ACTIVE')",[home,data.orgA,bare[0]]);
 await q("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[homeOccupancy,data.orgA,home]);
 await q("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[data.orgA,homeOccupancy,staff.userId]);
 // Tenant: an occupancy still marked active whose end time has passed.
 const past=(await q("SELECT id FROM app.unit WHERE org_id=$1 AND label='대량 호실 001'",[data.orgA])).rows[0].id as string,pastOccupancy=randomUUID();
 await q("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,ends_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 minute','ACTIVE')",[pastOccupancy,data.orgA,past]);
 await q("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '2 days','ACTIVE')",[data.orgA,pastOccupancy,data.accounts.tenantOther.userId]);
 const staffIds=(await list("staff")).map(u=>u.id);
 expect(staffIds).toContain(bareUnits[1]);
 expect(staffIds).not.toContain(bareUnits[0]);
 expect(staffIds).not.toContain(home);
 expect((await list("tenantOther")).map(u=>u.id)).toEqual([data.unitOther]);
 for(const name of Object.keys(data.accounts)){
  const ids=(await list(name)).map(u=>u.id);
  expect([...ids].sort(),name).toEqual(await allowedByCanUnit(name));
 }
});

it("keeps core_flow.units a definer function owned by bm_core_flow_owner with a pinned search path",async()=>{
 const row=(await q("SELECT p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,has_function_privilege('bm_b1_web',p.oid,'EXECUTE') AS web,has_function_privilege('public',p.oid,'EXECUTE') AS everyone FROM pg_proc p WHERE p.oid='core_flow.units(bytea)'::regprocedure",[])).rows[0];
 expect(row).toEqual({prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:true,everyone:false});
});

// A call count, not a timing: a later change back to a per-unit check fails here.
it("checks building access once per building and never runs can_unit per unit",async()=>{
 const a=data.accounts.manager;
 await f.p.admin.query("BEGIN");
 try{
  await f.p.admin.query("SET LOCAL track_functions='all'");
  const listed=(await f.p.admin.query("SELECT jsonb_array_length(core_flow.units($1)) AS n",[Buffer.from(a.digest,"hex")])).rows[0].n as number;
  const calls=Object.fromEntries((await f.p.admin.query("SELECT schemaname||'.'||funcname AS name,calls::int AS calls FROM pg_stat_xact_user_functions WHERE (schemaname,funcname) IN (('core_flow','can_unit'),('authn','can_read_property'))",[])).rows.map(r=>[r.name as string,r.calls as number]));
  const buildings=(await f.p.admin.query("SELECT count(*)::int AS n FROM app.property WHERE org_id=$1",[a.orgId])).rows[0].n as number;
  expect(calls["core_flow.can_unit"]??0).toBe(0);
  expect(calls["authn.can_read_property"]).toBeGreaterThan(0);
  expect(calls["authn.can_read_property"]).toBeLessThanOrEqual(buildings);
  expect(listed).toBeGreaterThan(200);
 }finally{await f.p.admin.query("ROLLBACK");}
});

import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { createB1Fixture } from "./helpers/b1-fixture";

// 0027: Korean order with numbers by value, and same-name buildings kept together
// (docs/superpowers/specs/2026-10-14-unit-list-korean-order-design.md).
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,port:ReturnType<typeof createCoreAccessPort>;
const LABELS=["10호","2호","101호","1001호","가동 10호","가동 2호","나동 1호","B1호"];
const named=randomUUID();
// Two buildings without a building context row (both read 건물), listed here in id order.
const bare=[randomUUID(),randomUUID()].sort();
const q=(sql:string,values:unknown[])=>f.p.admin.query(sql,values);
const list=()=>{const a=data.accounts.manager;return port.inOrganization(a.orgId).run(a.digest,s=>s.units());};

beforeAll(async()=>{
 f=await createB1Fixture();
 await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
 data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);port=createCoreAccessPort(db);
 for(const label of LABELS)await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",[randomUUID(),data.orgA,data.propertyA,label]);
 await q("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[named,data.orgA]);
 await q("INSERT INTO core_flow.building_context(org_id,property_id,body) VALUES($1,$2,$3)",[data.orgA,named,JSON.stringify({id:named,displayName:"가나 빌라",demo:false,sourceNativeIds:{},context:[]})]);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'1호','ACTIVE')",[randomUUID(),data.orgA,named]);
 // Later building and later label first, so insertion order cannot produce the expected order.
 for(const property of [...bare].reverse()){
  await q("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,data.orgA]);
  for(const label of ["102호","101호"])await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",[randomUUID(),data.orgA,property,label]);
 }
},300_000);
afterAll(async()=>{await db?.close();await f?.close();});

it("orders unit labels the Korean way, with numbers compared by value",async()=>{
 const labels=(await list()).filter(u=>u.buildingId===data.propertyA).map(u=>u.label);
 expect(labels).toEqual(["2호","10호","101호","1001호","가동 2호","가동 10호","나동 1호","합성 호실 1","합성 호실 2","B1호"]);
});

it("orders building names the Korean way and keeps same-name buildings together",async()=>{
 const units=await list();
 expect(units.map(u=>`${u.buildingName} · ${u.label}`)).toEqual([
  "가나 빌라 · 1호",
  "건물 · 101호","건물 · 102호","건물 · 101호","건물 · 102호",
  ...["2호","10호","101호","1001호","가동 2호","가동 10호","나동 1호","합성 호실 1","합성 호실 2","B1호"].map(l=>`RC1 합성 건물 A · ${l}`),
 ]);
 expect(units.filter(u=>u.buildingName==="건물").map(u=>u.buildingId)).toEqual([bare[0],bare[0],bare[1],bare[1]]);
});

it("creates the unit name collation as an ICU Korean numeric collation owned by the Core owner",async()=>{
 const row=(await q("SELECT pg_get_userbyid(c.collowner) AS owner,c.collprovider AS provider,c.colllocale AS locale,c.collisdeterministic AS deterministic FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE n.nspname='core_flow' AND c.collname='unit_name_order'",[])).rows[0];
 expect(row).toEqual({owner:"bm_core_flow_owner",provider:"i",locale:"ko-u-kn",deterministic:true});
});

import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createOrganizationMembershipTerminationPort } from "@build-manager/persistence-postgres/b5";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreScope,type CoreAction } from "@build-manager/application";
import { createB1Fixture } from "./helpers/b1-fixture";

let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,unassignedUnit:string;
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const action=(who:string,a:CoreAction)=>run(who,s=>performCoreAction(s,a,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const create=(who="tenant",unitId=data.unitA)=>action(who,{type:"CREATE",unitId,issueType:"LEAK",rawUserText:"업무함 합성 접수"});
const update={priority:"HIGH" as const,assigneeLabel:"합성 점검 담당",dueAt:"2026-10-06T09:00:00+09:00",expectedVersion:1};
beforeAll(async()=>{
  f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
  data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);
  const property=randomUUID();unassignedUnit=randomUUID();const occupancy=randomUUID();
  await f.p.admin.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,data.orgA]);
  await f.p.admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'미배정 합성 호실','ACTIVE')",[unassignedUnit,data.orgA,property]);
  await f.p.admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) SELECT org_id,$1::uuid,jsonb_set(body,'{id}',to_jsonb(($1::uuid)::text)) FROM core_flow.building_context WHERE property_id=$2",[property,data.propertyA]);
  await f.p.admin.query("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[occupancy,data.orgA,unassignedUnit]);
  await f.p.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[data.orgA,occupancy,data.accounts.tenantOther.userId]);
});
afterAll(async()=>{await db?.close();await f?.close();});

it("projects defaults without historical backfill and lists all authorized units",async()=>{
  const t=await create(),other=await create("tenantOther",unassignedUnit);
  expect(await run("manager",s=>s.manager.read(t.ticket.id))).toMatchObject({priority:"NORMAL",assigneeLabel:null,dueAt:null,version:1,unitId:data.unitA,workStatus:"OPEN"});
  expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_work WHERE ticket_id=$1",[t.ticket.id])).rows[0].n).toBe(0);
  const list=await run("manager",s=>s.manager.list());expect(list.map(x=>x.ticketId)).toEqual(expect.arrayContaining([t.ticket.id,other.ticket.id]));
});
it("updates metadata without changing tenant protocol, shared events, ticket version or ownership",async()=>{
  const t=await create();const before=await run("tenant",s=>s.read(t.ticket.id));
  const work=await run("manager",s=>s.manager.update(t.ticket.id,update));expect(work).toMatchObject({priority:"HIGH",assigneeLabel:update.assigneeLabel,version:2});expect(Date.parse(work.dueAt!)).toBe(Date.parse(update.dueAt));
  expect(await run("tenant",s=>s.read(t.ticket.id))).toEqual(before);
  expect(await run("manager",s=>s.manager.read(t.ticket.id))).toEqual(work);
  expect((await f.p.admin.query("SELECT updated_by FROM core_flow.ticket_work WHERE ticket_id=$1",[t.ticket.id])).rows[0].updated_by).toBe(data.accounts.manager.userId);
});
it("permits staff only in their assigned property and does not disclose other-org IDs",async()=>{
  const t=await create(),other=await create("tenantOther",unassignedUnit);
  expect(await run("staff",s=>s.manager.update(t.ticket.id,update))).toMatchObject({version:2});
  expect((await run("staff",s=>s.manager.list())).map(x=>x.ticketId)).not.toContain(other.ticket.id);
  for(const [who,id] of [["staff",other.ticket.id],["otherManager",t.ticket.id]]){
    for(const op of [(s:CoreScope)=>s.manager.read(id),(s:CoreScope)=>s.manager.update(id,update),(s:CoreScope)=>s.manager.notes(id),(s:CoreScope)=>s.manager.appendNote(id,"숨겨진 합성 메모")])await expect(run<unknown>(who,op)).rejects.toMatchObject({code:"NOT_FOUND"});
  }
});
it("denies every manager operation to tenants even on their own ticket",async()=>{
  const t=await create();for(const op of [(s:CoreScope)=>s.manager.list(),(s:CoreScope)=>s.manager.read(t.ticket.id),(s:CoreScope)=>s.manager.update(t.ticket.id,update),(s:CoreScope)=>s.manager.notes(t.ticket.id),(s:CoreScope)=>s.manager.appendNote(t.ticket.id,"denied")])await expect(run<unknown>("tenant",op)).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("leaves stored bytes unchanged on stale expectedVersion",async()=>{
  const t=await create();await run("manager",s=>s.manager.update(t.ticket.id,update));
  const snapshot=async()=>(await f.p.admin.query("SELECT row_to_json(w) value FROM core_flow.ticket_work w WHERE ticket_id=$1",[t.ticket.id])).rows[0].value;
  const before=await snapshot();await expect(run("manager",s=>s.manager.update(t.ticket.id,{...update,priority:"URGENT"}))).rejects.toMatchObject({code:"STATE_CONFLICT"});expect(await snapshot()).toEqual(before);
});
it("serializes two simultaneous first updates with exactly one winner and no lost update",async()=>{
  const t=await create();const result=await Promise.allSettled([run("manager",s=>s.manager.update(t.ticket.id,{...update,assigneeLabel:"합성 A"})),run("staff",s=>s.manager.update(t.ticket.id,{...update,assigneeLabel:"합성 B"}))]);
  const success=result.filter(r=>r.status==="fulfilled"),failed=result.filter(r=>r.status==="rejected");expect(success).toHaveLength(1);expect(failed).toHaveLength(1);expect(failed[0].reason).toMatchObject({code:"STATE_CONFLICT"});
  expect(await run("manager",s=>s.manager.read(t.ticket.id))).toEqual(success[0].value);expect(success[0].value.version).toBe(2);
});
it("keeps notes manager-only, append-only and newest-first without shared-history leakage",async()=>{
  const t=await create(),before=await run("tenant",s=>s.read(t.ticket.id));
  const first=await run("manager",s=>s.manager.appendNote(t.ticket.id,"합성 관리자 전용\n점검 준비"));
  const second=await run("staff",s=>s.manager.appendNote(t.ticket.id,"두 번째 합성 메모"));
  expect(await run("manager",s=>s.manager.notes(t.ticket.id))).toEqual([second,first]);
  expect(await run("tenant",s=>s.read(t.ticket.id))).toEqual(before);
  const tenantList=await run("tenant",s=>s.list());expect(JSON.stringify(tenantList)).not.toContain(first.body);expect(JSON.stringify(tenantList)).not.toContain("assigneeLabel");
});
it("rejects work and notes after completion while retaining earlier manager metadata",async()=>{
  const t=await create();await run("manager",s=>s.manager.update(t.ticket.id,update));await run("manager",s=>s.manager.appendNote(t.ticket.id,"완료 전 메모"));
  await action("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"IN_PROGRESS",message:"합성 시작"});await action("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"COMPLETED",message:"합성 완료"});
  await expect(run("manager",s=>s.manager.update(t.ticket.id,{...update,expectedVersion:2}))).rejects.toMatchObject({code:"STATE_CONFLICT"});await expect(run("manager",s=>s.manager.appendNote(t.ticket.id,"금지"))).rejects.toMatchObject({code:"STATE_CONFLICT"});
  expect(await run("manager",s=>s.manager.read(t.ticket.id))).toMatchObject({workStatus:"COMPLETED",priority:"HIGH",version:2});expect(await run("manager",s=>s.manager.notes(t.ticket.id))).toHaveLength(1);
});
it("keeps metadata and notes after pool restart",async()=>{
  const t=await create();const work=await run("manager",s=>s.manager.update(t.ticket.id,update));const note=await run("manager",s=>s.manager.appendNote(t.ticket.id,"재시작 보존"));await db.close();db=createPostgresDatabase(f.roles.b1.webConfig);
  expect(await run("manager",s=>s.manager.read(t.ticket.id))).toEqual(work);expect(await run("manager",s=>s.manager.notes(t.ticket.id))).toEqual([note]);
});
it("rejects invalid SQL inputs independently of HTTP validation",async()=>{
  const t=await create();for(const label of [" ","bad\tlabel","x".repeat(81)])await expect(run("manager",s=>s.manager.update(t.ticket.id,{...update,assigneeLabel:label}))).rejects.toMatchObject({code:"INVALID_INPUT"});
  for(const body of [" ","bad\ttext","x".repeat(2001)])await expect(run("manager",s=>s.manager.appendNote(t.ticket.id,body))).rejects.toMatchObject({code:"INVALID_INPUT"});
});
it("rechecks assignment revocation and B5 membership termination on the next operation",async()=>{
  const t=await create();await run("staff",s=>s.manager.appendNote(t.ticket.id,"배정 유효"));
  await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);
  for(const op of [(s:CoreScope)=>s.manager.read(t.ticket.id),(s:CoreScope)=>s.manager.update(t.ticket.id,update),(s:CoreScope)=>s.manager.notes(t.ticket.id),(s:CoreScope)=>s.manager.appendNote(t.ticket.id,"거부")])await expect(run<unknown>("staff",op)).rejects.toMatchObject({code:"NOT_FOUND"});
  expect(await run("staff",s=>s.manager.list())).toEqual([]);
  await createOrganizationMembershipTerminationPort(db).endCurrent(data.accounts.manager.digest,data.orgA,data.accounts.staff.membershipId!);
  await expect(run("staff",s=>s.manager.list())).rejects.toMatchObject({code:"FORBIDDEN"});await expect(run("staff",s=>s.manager.appendNote(t.ticket.id,"거부"))).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("enforces exact private catalogs, org consistency, FORCE RLS and no runtime direct DML",async()=>{
  for(const table of ["ticket_work","ticket_internal_note"]){for(const sql of [`SELECT * FROM core_flow.${table}`,`DELETE FROM core_flow.${table}`,`UPDATE core_flow.${table} SET org_id=gen_random_uuid()`])await expect(f.web.query(sql)).rejects.toMatchObject({code:"42501"});}
  const tables=(await f.p.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) owner FROM pg_class WHERE relnamespace='core_flow'::regnamespace AND relname IN ('ticket_work','ticket_internal_note') ORDER BY relname")).rows;
  expect(tables).toEqual(["ticket_internal_note","ticket_work"].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:true,owner:"bm_core_flow_owner"})));
  const names=["append_internal_note","list_internal_notes","list_manager_work","manager_ticket","manager_work_json","read_manager_work","update_manager_work"];
  const funcs=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,EXISTS(SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee=0) public FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
  expect(funcs).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:!proname.startsWith("manager_"),public:false})));
  const acl=(await f.p.admin.query("SELECT p.proname,array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)) executors,bool_or(a.is_grantable) grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_flow'::regnamespace AND p.proname=ANY($1) AND a.privilege_type='EXECUTE' GROUP BY p.proname ORDER BY p.proname",[names])).rows;
  expect(acl).toEqual(names.map(proname=>({proname,executors:proname.startsWith("manager_")?["bm_core_flow_owner"]:["bm_b1_web","bm_core_flow_owner"],grantable:false})));
  for(const table of ["ticket_work","ticket_internal_note"]){
    const privileges=(await f.p.admin.query("SELECT has_table_privilege('bm_b1_web',$1,privilege) allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege",["core_flow."+table])).rows;
    expect(privileges).toEqual(Array(7).fill({allowed:false}));
  }
  const policies=(await f.p.admin.query("SELECT polname,polpermissive,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check FROM pg_policy WHERE polrelid IN ('core_flow.ticket_work'::regclass,'core_flow.ticket_internal_note'::regclass) ORDER BY polname")).rows;
  expect(policies).toEqual(["internal_note_org","internal_note_org_ceiling","work_org","work_org_ceiling"].map(polname=>({polname,polpermissive:!polname.endsWith("ceiling"),qual:"(org_id = app.current_org_id())",check:"(org_id = app.current_org_id())"})));
  expect((await f.p.admin.query("SELECT has_schema_privilege('bm_core_flow_owner','core_flow','CREATE') allowed")).rows[0].allowed).toBe(false);
  const t=await create();await expect(f.p.admin.query("INSERT INTO core_flow.ticket_work(ticket_id,org_id,updated_by,updated_at) VALUES($1,$2,$3,clock_timestamp())",[t.ticket.id,data.orgB,data.accounts.manager.userId])).rejects.toMatchObject({code:"23503"});
  await run("manager",s=>s.manager.update(t.ticket.id,update));await run("manager",s=>s.manager.appendNote(t.ticket.id,"RLS 합성 점검"));
  await f.migration.query("BEGIN");
  try{
    await f.migration.query("SET LOCAL ROLE bm_core_flow_owner");await f.migration.query("SELECT set_config('app.org_id',$1,true)",[data.orgB]);
    for(const table of ["ticket_work","ticket_internal_note"])expect((await f.migration.query(`SELECT count(*)::int n FROM core_flow.${table} WHERE ticket_id=$1`,[t.ticket.id])).rows[0].n).toBe(0);
    await expect(f.migration.query("INSERT INTO core_flow.ticket_internal_note(ticket_id,org_id,author_id,body) VALUES($1,$2,$3,'denied')",[t.ticket.id,data.orgA,data.accounts.manager.userId])).rejects.toMatchObject({code:"42501"});
  }finally{await f.migration.query("ROLLBACK");}
});

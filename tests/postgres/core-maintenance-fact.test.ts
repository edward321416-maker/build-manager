import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { Client } from "pg";
import sharp from "sharp";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreScope,type CoreAction,type CoreMaintenanceFactCreate,type CoreMaintenanceFactCorrection } from "@build-manager/application";
import { CoreUnitMaintenanceFactSchema } from "@build-manager/api-contracts";
import { selectProtocol } from "@build-manager/domain";
import { createB1Fixture } from "./helpers/b1-fixture";
import { waitB4Lock } from "./helpers/b4-fixture";
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const action=(who:string,a:CoreAction)=>run(who,s=>performCoreAction(s,a,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const input=():CoreMaintenanceFactCreate=>({clientRequestId:randomUUID(),actionKind:"REPAIR",componentLabel:"합성 순환펌프"});
const create=(id:string,r=input(),who="manager")=>run(who,s=>s.maintenance.create(id,r));
const read=(id:string,who="manager")=>run(who,s=>s.maintenance.readForTicket(id));
const list=(unit=data.unitA,who="manager")=>run(who,s=>s.maintenance.listUnit(unit));
const correction=(id:string):CoreMaintenanceFactCorrection=>({...input(),expectedCurrentFactId:id,actionKind:"PART_REPLACEMENT",correctionReason:"ACTION_CLASSIFICATION"});
const correct=(id:string,r=correction(id),who="manager")=>run(who,s=>s.maintenance.correct(id,r));
async function ticket(){return action("tenant",{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"합성 비공개 원문"});}
async function complete(id:string){await action("manager",{type:"HANDLING",ticketId:id,status:"IN_PROGRESS",message:"합성 처리 시작"});const p=await run("manager",s=>s.communication.read(id));return action("manager",{type:"HANDLING",ticketId:id,status:"COMPLETED",message:"합성 완료 기록",expectedCommunicationVersion:p.version});}
async function source(){const t=await ticket();return complete(t.ticket.id);}
async function snapshot(id:string){const result:Record<string,string[]>={};for(const [table,column]of [["ticket","id"],["ticket_event","ticket_id"],["ticket_photo","ticket_id"],["ticket_public_message","ticket_id"],["ticket_communication_thread","ticket_id"],["ticket_work","ticket_id"],["ticket_internal_note","ticket_id"],["ticket_outcome_assertion","ticket_id"],["ticket_follow_up","source_ticket_id"]])result[table]=(await f.p.admin.query(`SELECT md5(row_to_json(t)::text) h FROM core_flow.${table} t WHERE ${column}=$1 ORDER BY 1`,[id])).rows.map(r=>r.h);return result;}
const ledger=async(id:string)=>(await f.p.admin.query("SELECT md5(row_to_json(t)::text) h FROM core_flow.unit_maintenance_fact t WHERE source_ticket_id=$1 ORDER BY id",[id])).rows;
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query('COMMENT ON DATABASE "'+f.p.database.replaceAll('"','""')+'" IS \'CORE_FLOW_SYNTHETIC_LOCAL\'');data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);});
afterAll(async()=>{await db?.close();await f?.close();});
it("adds only the forced-RLS fact ledger owned by the existing nonlogin owner",async()=>{
 const tables=(await f.p.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) owner FROM pg_class WHERE relnamespace='core_flow'::regnamespace AND relname='unit_maintenance_fact'")).rows;
 expect(tables).toEqual([{relname:"unit_maintenance_fact",relrowsecurity:true,relforcerowsecurity:true,owner:"bm_core_flow_owner"}]);
});
it("records explicit completed-ticket facts without modifying the source and replays exactly",async()=>{
 const t=await source(),id=t.ticket.id,before=await snapshot(id),r=input();
 expect(await read(id)).toEqual({current:null,revisions:[]});
 const saved=await create(id,r);expect(saved.created).toBe(true);expect(CoreUnitMaintenanceFactSchema.parse(saved.fact)).toEqual(saved.fact);
 const completed=(await f.p.admin.query("SELECT updated_at FROM core_flow.ticket WHERE id=$1",[id])).rows[0].updated_at.toISOString();
 expect(new Date(saved.fact.sourceCompletedAt).toISOString()).toBe(completed);
 expect(saved.fact).toMatchObject({unitId:data.unitA,buildingId:data.propertyA,sourceTicketId:id,issueType:"LEAK",actionKind:"REPAIR",tenantOutcome:"UNCONFIRMED",corrected:false,correctionCount:0});
 expect(await create(id,r)).toEqual({fact:saved.fact,created:false});expect(await snapshot(id)).toEqual(before);
 expect((await list()).find(x=>x.factId===saved.fact.factId)).toEqual(saved.fact);
});
it("enforces exact ACLs, private helpers, pinned search paths and the restrictive org ceiling",async()=>{
 const names=["correct_unit_maintenance_fact","create_unit_maintenance_fact","maintenance_current_fact","maintenance_fact_json","maintenance_request_fingerprint","maintenance_ticket","maintenance_valid_component","read_ticket_maintenance_fact","read_unit_maintenance_facts"];
 const funcs=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,EXISTS(SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee=0) public FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname LIKE '%maintenance%' ORDER BY proname")).rows;
 expect(funcs).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:!proname.startsWith("maintenance_"),public:false})));
 const acl=(await f.p.admin.query("SELECT p.proname,array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)) executors,bool_or(a.is_grantable) grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_flow'::regnamespace AND p.proname=ANY($1) AND a.privilege_type='EXECUTE' GROUP BY p.proname ORDER BY p.proname",[names])).rows;
 expect(acl).toEqual(names.map(proname=>({proname,executors:proname.startsWith("maintenance_")?["bm_core_flow_owner"]:["bm_b1_web","bm_core_flow_owner"],grantable:false})));
 const privileges=(await f.p.admin.query("SELECT has_table_privilege('bm_b1_web','core_flow.unit_maintenance_fact',p) allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p")).rows;
 expect(privileges).toEqual(Array(7).fill({allowed:false}));
 expect((await f.p.admin.query("SELECT EXISTS(SELECT 1 FROM aclexplode(relacl) a WHERE a.grantee=0) public FROM pg_class WHERE oid='core_flow.unit_maintenance_fact'::regclass")).rows).toEqual([{public:false}]);
 for(const sql of ["SELECT * FROM core_flow.unit_maintenance_fact","UPDATE core_flow.unit_maintenance_fact SET component_label='forbidden'","DELETE FROM core_flow.unit_maintenance_fact"])
  await expect(f.web.query(sql)).rejects.toMatchObject({code:"42501"});
 const policies=(await f.p.admin.query("SELECT polname,polpermissive,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check FROM pg_policy WHERE polrelid='core_flow.unit_maintenance_fact'::regclass ORDER BY polname")).rows;
 expect(policies).toEqual(["maintenance_org","maintenance_org_ceiling"].map(polname=>({polname,polpermissive:!polname.endsWith("ceiling"),qual:"(org_id = app.current_org_id())",check:"(org_id = app.current_org_id())"})));
});
it("rejects non-completed tickets, tenants, foreign orgs and unassigned properties",async()=>{
 const t=await ticket(),id=t.ticket.id;await expect(create(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 await action("manager",{type:"HANDLING",ticketId:id,status:"IN_PROGRESS",message:"합성 진행"});await expect(create(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 const p=await run("manager",s=>s.communication.read(id));await action("manager",{type:"HANDLING",ticketId:id,status:"COMPLETED",message:"합성 완료",expectedCommunicationVersion:p.version});
 const root=await create(id,input(),"staff");
 for(const who of ["tenant","tenantPeer","tenantOther"]){for(const op of [()=>create(id,input(),who),()=>read(id,who),()=>list(data.unitA,who),()=>correct(root.fact.factId,correction(root.fact.factId),who)])await expect(op()).rejects.toMatchObject({code:"FORBIDDEN"});}
 for(const op of [()=>create(id,input(),"otherManager"),()=>read(id,"otherManager"),()=>list(data.unitA,"otherManager"),()=>correct(root.fact.factId,correction(root.fact.factId),"otherManager")])await expect(op()).rejects.toMatchObject({code:"NOT_FOUND"});
 const property=randomUUID(),unit=randomUUID();await f.p.admin.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,data.orgA]);await f.p.admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'합성 미배정 호실','ACTIVE')",[unit,data.orgA,property]);
 expect(await list(unit)).toEqual([]);await expect(list(unit,"staff")).rejects.toMatchObject({code:"NOT_FOUND"});
});
it("rejects changed root request payload or source and SQL-side invalid labels/actions",async()=>{
 const t=await source(),id=t.ticket.id,r=input();await create(id,r);
 for(const change of [{actionKind:"OTHER" as const},{componentLabel:null}])await expect(create(id,{...r,...change})).rejects.toMatchObject({code:"STATE_CONFLICT"});
 await expect(create((await source()).ticket.id,r)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 for(const componentLabel of [" ","\tlabel","a\u200bb","x".repeat(81)])await expect(create(id,{...input(),componentLabel})).rejects.toMatchObject({code:"INVALID_INPUT"});
 await expect(f.web.query("SELECT core_flow.create_unit_maintenance_fact($1,$2,$3,'REPLACE',NULL)",[Buffer.from(data.accounts.manager.digest,"hex"),id,randomUUID()])).rejects.toMatchObject({code:"22023"});
});
it("appends corrections without changing root bytes and uses topology even when timestamps disagree",async()=>{
 const t=await source(),id=t.ticket.id,r=input(),root=await create(id,r),before=await ledger(id),sourceBefore=await snapshot(id),c=correction(root.fact.factId);
 const saved=await correct(root.fact.factId,c);expect(saved.created).toBe(true);expect((await ledger(id))[0]).toEqual(before[0]);expect(await snapshot(id)).toEqual(sourceBefore);
 expect(saved.fact).toMatchObject({sourceTicketId:id,unitId:root.fact.unitId,sourceCompletedAt:root.fact.sourceCompletedAt,issueType:root.fact.issueType,corrected:true,correctionCount:1});
 expect(await correct(root.fact.factId,c)).toEqual({...saved,created:false});expect(await create(id,r)).toEqual({...root,created:false});
 await f.p.admin.query("UPDATE core_flow.unit_maintenance_fact SET recorded_at='2020-01-01' WHERE id=$1",[saved.fact.factId]); // fixture-only adversarial clock order
 const detail=await read(id);expect(detail.current?.factId).toBe(saved.fact.factId);expect(detail.revisions.map(x=>x.factId)).toEqual([root.fact.factId,saved.fact.factId]);expect(detail.revisions.map(x=>x.current)).toEqual([false,true]);
 const third=await correct(saved.fact.factId,{...correction(saved.fact.factId),actionKind:"ADJUSTMENT"});
 expect((await read(id)).revisions.map(x=>x.factId)).toEqual([root.fact.factId,saved.fact.factId,third.fact.factId]);expect(third.fact.correctionCount).toBe(2);
});
it("rejects stale and contradictory correction targets, no-op corrections and changed replays",async()=>{
 const root=(await create((await source()).ticket.id)).fact,c=correction(root.factId),saved=(await correct(root.factId,c)).fact;
 for(const [path,request]of [[root.factId,correction(root.factId)],[root.factId,correction(saved.factId)],[saved.factId,correction(root.factId)],[root.factId,{...c,componentLabel:"다른 합성 부품"}]] as const)
  await expect(correct(path,request)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 await expect(correct(saved.factId,{...correction(saved.factId),actionKind:saved.actionKind,componentLabel:saved.componentLabel})).rejects.toMatchObject({code:"INVALID_INPUT"});
});
it("database constraints reject a second root/child, self-cycle and changed immutable dimensions",async()=>{
 const root=(await create((await source()).ticket.id)).fact;
 const insert=(overrides:string,args:unknown[]=[])=>f.p.admin.query(`INSERT INTO core_flow.unit_maintenance_fact(id,org_id,unit_id,source_ticket_id,issue_type,action_kind,component_label,source_completed_at,recorded_by,replaces_fact_id,correction_reason,client_request_id,request_fingerprint) SELECT ${overrides} FROM core_flow.unit_maintenance_fact WHERE id=$1`,[root.factId,...args]);
 const fields="uuidv7(),org_id,unit_id,source_ticket_id,issue_type,action_kind,component_label,source_completed_at,recorded_by";
 await expect(insert(fields+",NULL,NULL,uuidv7(),request_fingerprint")).rejects.toMatchObject({code:"23505"});
 await expect(insert("id,org_id,unit_id,source_ticket_id,issue_type,action_kind,component_label,source_completed_at,recorded_by,id,'OTHER',uuidv7(),request_fingerprint")).rejects.toMatchObject({code:"23514"});
 await expect(insert(fields.replace("unit_id","$2::uuid")+",id,'OTHER',uuidv7(),request_fingerprint",[data.unitOther])).rejects.toMatchObject({code:"23503"});
 await expect(insert(fields.replace("source_completed_at","source_completed_at+interval '1 second'")+",id,'OTHER',uuidv7(),request_fingerprint")).rejects.toMatchObject({code:"23503"});
 await correct(root.factId);await expect(insert(fields+",id,'OTHER',uuidv7(),request_fingerprint")).rejects.toMatchObject({code:"23505"});
});
async function controlled(who="manager"){
 const client=new Client(f.roles.b1.webConfig);await client.connect();await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");const pid=Number((await client.query("SELECT pg_backend_pid() pid")).rows[0].pid),hash=Buffer.from(data.accounts[who].digest,"hex");
 return {client,pid,create:(id:string,r:CoreMaintenanceFactCreate)=>client.query("SELECT core_flow.create_unit_maintenance_fact($1,$2,$3,$4,$5) value",[hash,id,r.clientRequestId,r.actionKind,r.componentLabel]),
 correct:(id:string,r:CoreMaintenanceFactCorrection)=>client.query("SELECT core_flow.correct_unit_maintenance_fact($1,$2,$3,$4,$5,$6,$7) value",[hash,id,r.clientRequestId,r.expectedCurrentFactId,r.actionKind,r.componentLabel,r.correctionReason]),
 close:async()=>{await client.query("ROLLBACK");await client.end();}};
}
it.each(["root-same","root-different","correction-same","correction-different"])("observes source lock and serializes %s without a duplicate or branch",async mode=>{
 const id=(await source()).ticket.id,root=mode.startsWith("correction")?(await create(id)).fact:null;
 const a=await controlled(),b=await controlled(mode.endsWith("same")?"manager":"staff"),r=root?correction(root.factId):input(),r2=mode.endsWith("same")?r:{...r,clientRequestId:randomUUID()};let pending:Promise<unknown>|undefined;
 try{const first=root?await a.correct(root.factId,r as CoreMaintenanceFactCorrection):await a.create(id,r);pending=root?b.correct(root.factId,r2 as CoreMaintenanceFactCorrection):b.create(id,r2);void pending.catch(()=>{});
  await waitB4Lock(f.p.admin,b.pid,a.pid);expect((await f.p.admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[b.pid])).rows[0].wait_event_type).toBe("Lock");await a.client.query("COMMIT");
  if(mode.endsWith("same")){const replay=await pending as typeof first;expect(replay.rows[0].value).toEqual({...first.rows[0].value,created:false});await b.client.query("COMMIT");}else await expect(pending).rejects.toMatchObject({code:"P0001"});
 }finally{await a.close();await b.close();await pending?.catch(()=>{});}
 expect(await ledger(id)).toHaveLength(root?2:1);
});
it("serializes the same actor UUID across different source locks with one successful receipt",async()=>{
 const ids=[(await source()).ticket.id,(await source()).ticket.id],r=input(),results=await Promise.allSettled(ids.map(id=>create(id,r)));
 expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect(results.find(x=>x.status==="rejected")).toMatchObject({reason:{code:"STATE_CONFLICT"}});
 expect((await ledger(ids[0])).length+(await ledger(ids[1])).length).toBe(1);
});
it("projects rich-source privacy and current outcome/relations without copying into the ledger",async()=>{
 const t=await ticket(),id=t.ticket.id,q=selectProtocol(t.building,"LEAK").questions[0];
 await action("tenant",{type:"ANSWER",ticketId:id,questionId:q.id,value:q.type==="YES_NO"?false:q.type==="SINGLE_SELECT"?q.choices![0].value:"합성 비공개 답변"});
 const bytes=await sharp({create:{width:24,height:16,channels:3,background:"#265b82"}}).png().toBuffer();
 const photo=await run("tenant",s=>s.savePhoto(id,{uploadId:randomUUID(),mime:"image/png",width:24,height:16,bytes}));
 await run("tenant",s=>s.communication.send(id,{clientRequestId:randomUUID(),expectedVersion:0,intent:"TENANT_MESSAGE",body:"합성 비공개 대화"}));await run("manager",s=>s.communication.send(id,{clientRequestId:randomUUID(),expectedVersion:1,intent:"MANAGER_REPLY",body:"합성 비공개 답장"}));
 await run("manager",s=>s.manager.update(id,{priority:"URGENT",assigneeLabel:"합성 담당 표시",dueAt:"2030-01-01T00:00:00Z",expectedVersion:1}));await run("manager",s=>s.manager.appendNote(id,"합성 비공개 내부메모"));await complete(id);
 const before=await snapshot(id),root=await create(id),factBytes=await ledger(id);expect(await snapshot(id)).toEqual(before);
 const publicJson=JSON.stringify({list:await list(),detail:await read(id)});
 for(const forbidden of ["합성 비공개 원문","합성 비공개 대화","합성 비공개 답장","합성 비공개 내부메모","합성 담당 표시","URGENT","rawUserText","answers","internalNote","priority","assigneeLabel","dueAt","recordedBy",photo.photo.photoId,photo.photo.uploadId,data.accounts.tenant.userId,data.accounts.manager.userId])expect(publicJson).not.toContain(forbidden);
 await run("tenant",s=>s.outcome.confirmResolved(id,{clientRequestId:randomUUID()}));expect((await read(id)).current?.tenantOutcome).toBe("RESOLVED");expect(await ledger(id)).toEqual(factBytes);
 const follow=await run("tenant",s=>s.outcome.createFollowUp(id,{clientRequestId:randomUUID(),claimKind:"RECURRENCE_CLAIM",issueType:"HEATING",rawUserText:"합성 새 증상"}));
 expect((await read(id)).current).toMatchObject({tenantOutcome:"RECURRENCE_CLAIM",followUpTicketId:follow.ticket.ticket.id,sourceCompletedAt:root.fact.sourceCompletedAt});expect(await ledger(id)).toEqual(factBytes);
 await complete(follow.ticket.ticket.id);expect((await create(follow.ticket.ticket.id)).fact.previousTicketId).toBe(id);
});
it("bounds 101 source chains to exactly 100 leaves in completion-time then fact-id order",async()=>{
 const template=await source(),id=template.ticket.id;
 // Fixture-only bulk setup in this disposable DB; reads still use the runtime role/function.
 const ids=(await f.p.admin.query("INSERT INTO core_flow.ticket SELECT (jsonb_populate_record(NULL::core_flow.ticket,to_jsonb(t)||jsonb_build_object('id',uuidv7()::text,'updated_at','2040-01-01T00:00:00Z','body',t.body||jsonb_build_object('id',uuidv7()::text)))).* FROM core_flow.ticket t CROSS JOIN generate_series(1,101) WHERE t.id=$1 RETURNING id",[id])).rows.map(r=>r.id as string);
 for(const next of ids)await create(next);
 const first=await list();expect(first).toHaveLength(100);expect(first.map(x=>x.factId)).toEqual(first.map(x=>x.factId).sort());
 const oldest=(await create(id)).fact;await correct(oldest.factId);const result=await list();expect(result).toEqual(first);expect(result.every(x=>new Date(x.sourceCompletedAt).getFullYear()===2040)).toBe(true);
});
it("rechecks assignment after the observed source-lock wait and denies earlier root/correction replays",async()=>{
 const oldId=(await source()).ticket.id,r=input(),root=await create(oldId,r,"staff"),c=correction(root.fact.factId);await correct(root.fact.factId,c,"staff");const id=(await source()).ticket.id;
 const a=await controlled(),b=await controlled("staff");let pending:Promise<unknown>|undefined;
 try{await a.client.query("SELECT core_flow.read_ticket($1,$2,true)",[Buffer.from(data.accounts.manager.digest,"hex"),id]);pending=b.create(id,input());void pending.catch(()=>{});await waitB4Lock(f.p.admin,b.pid,a.pid);
  await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);await a.client.query("COMMIT");await expect(pending).rejects.toMatchObject({code:"P0002"});
 }finally{await a.close();await b.close();await pending?.catch(()=>{});}
 expect(await ledger(id)).toHaveLength(0);for(const op of [()=>create(oldId,r,"staff"),()=>correct(root.fact.factId,c,"staff"),()=>read(oldId,"staff"),()=>list(data.unitA,"staff")])await expect(op()).rejects.toMatchObject({code:"NOT_FOUND"});
});
it("retains manager history across actual tenant turnover without exposing old content or facts to a replacement",async()=>{
 const id=(await source()).ticket.id,root=(await create(id)).fact,before=await snapshot(id),facts=await ledger(id);
 await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[data.accounts.tenant.userId]);
 const occ=(await f.p.admin.query("SELECT id FROM app.occupancy WHERE org_id=$1 AND unit_id=$2 AND status='ACTIVE'",[data.orgA,data.unitA])).rows[0].id;
 await f.p.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp(),'ACTIVE')",[data.orgA,occ,data.accounts.tenantOther.userId]);
 expect((await run("tenantOther",s=>s.units())).map(x=>x.id)).toContain(data.unitA);
 for(const op of [()=>list(data.unitA,"tenantOther"),()=>read(id,"tenantOther"),()=>create(id,input(),"tenantOther"),()=>correct(root.factId,correction(root.factId),"tenantOther")])await expect(op()).rejects.toMatchObject({code:"FORBIDDEN"});
 await expect(run("tenantOther",s=>s.read(id))).rejects.toMatchObject({code:"NOT_FOUND"});expect((await read(id)).current?.factId).toBe(root.factId);expect(await snapshot(id)).toEqual(before);expect(await ledger(id)).toEqual(facts);
 await db.close();db=createPostgresDatabase(f.roles.b1.webConfig);expect((await read(id)).current?.factId).toBe(root.factId);
});

import { beforeAll,afterAll,expect,it } from "vitest";
import { createB1Fixture } from "./helpers/b1-fixture";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { selectProtocol } from "@build-manager/domain";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,buildCoreFollowUpTicket,type CoreScope,type CoreAction,type CoreCreateFollowUp } from "@build-manager/application";
import { waitB4Lock } from "./helpers/b4-fixture";
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const action=(who:string,a:CoreAction)=>run(who,s=>performCoreAction(s,a,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const create=()=>action("tenant",{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"합성 원본 접수"});
const request=(kind:CoreCreateFollowUp["claimKind"]="UNRESOLVED"):CoreCreateFollowUp=>({clientRequestId:randomUUID(),claimKind:kind,issueType:"HEATING",rawUserText:"새로 입력한 합성 난방 증상"});
const follow=(id:string,input=request(),who="tenant")=>run(who,s=>s.outcome.createFollowUp(id,input));
const resolved=(id:string,clientRequestId:string=randomUUID(),who="tenant")=>run(who,s=>s.outcome.confirmResolved(id,{clientRequestId}));
const photoBytes=()=>sharp({create:{width:24,height:16,channels:3,background:"#265b82"}}).png().toBuffer();
async function complete(id:string){await action("manager",{type:"HANDLING",ticketId:id,status:"IN_PROGRESS",message:"합성 처리 시작"});const page=await run("manager",s=>s.communication.read(id));return action("manager",{type:"HANDLING",ticketId:id,status:"COMPLETED",message:"합성 관리자 완료",expectedCommunicationVersion:page.version});}
async function source(){const t=await create();return complete(t.ticket.id);}
async function snapshot(id:string){
 const result:Record<string,string[]>={};
 for(const [table,column]of [["ticket","id"],["ticket_event","ticket_id"],["ticket_photo","ticket_id"],["ticket_public_message","ticket_id"],["ticket_communication_thread","ticket_id"],["ticket_work","ticket_id"],["ticket_internal_note","ticket_id"]]){
  result[table]=(await f.p.admin.query("SELECT md5(row_to_json(t)::text) h FROM core_flow."+table+" t WHERE "+column+"=$1 ORDER BY 1",[id])).rows.map(r=>r.h);
 }return result;
}
const totalTickets=async()=>Number((await f.p.admin.query("SELECT count(*) n FROM core_flow.ticket")).rows[0].n);
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query('COMMENT ON DATABASE "'+f.p.database.replaceAll('"','""')+'" IS \'CORE_FLOW_SYNTHETIC_LOCAL\'');data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);});
afterAll(async()=>{await db?.close();await f?.close();});
it("adds separate forced-RLS outcome and follow-up tables",async()=>{
 const rows=(await f.p.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='core_flow'::regnamespace AND relname IN ('ticket_outcome_assertion','ticket_follow_up') ORDER BY relname")).rows;
 expect(rows).toEqual(["ticket_follow_up","ticket_outcome_assertion"].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:true})));
});
it("records one tenant RESOLVED assertion and exact replay without touching the source",async()=>{
 const t=await source(),id=t.ticket.id,before=await snapshot(id),key=randomUUID();
 expect(await run("tenant",s=>s.outcome.read(id))).toEqual({ticketId:id,kind:"UNCONFIRMED",assertedAt:null,followUpTicketId:null});
 const first=await resolved(id,key);expect(first.created).toBe(true);expect(first.outcome).toMatchObject({ticketId:id,kind:"RESOLVED",followUpTicketId:null});
 expect(await resolved(id,key)).toEqual({...first,created:false});
 for(const who of ["manager","staff"])expect(await run(who,s=>s.outcome.read(id))).toEqual(first.outcome);
 expect(await run("tenant",s=>s.outcome.receipt(id,key))).toEqual({outcome:first.outcome,targetTicketId:null});
 await expect(resolved(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_outcome_assertion WHERE ticket_id=$1",[id])).rows[0].n).toBe(1);
 expect(await snapshot(id)).toEqual(before);
});
it("requires completed status, original tenant and current scope, and denies managers writes",async()=>{
 const open=await create();
 for(const status of ["OPEN","IN_PROGRESS"]){if(status==="IN_PROGRESS")await action("manager",{type:"HANDLING",ticketId:open.ticket.id,status:"IN_PROGRESS",message:"합성 시작"});
  await expect(resolved(open.ticket.id)).rejects.toMatchObject({code:"STATE_CONFLICT"});await expect(follow(open.ticket.id)).rejects.toMatchObject({code:"STATE_CONFLICT"});}
 const t=await source(),id=t.ticket.id;
 for(const who of ["manager","staff"]){await expect(resolved(id,randomUUID(),who)).rejects.toMatchObject({code:"FORBIDDEN"});await expect(follow(id,request(),who)).rejects.toMatchObject({code:"FORBIDDEN"});}
 for(const who of ["tenantPeer","tenantOther","otherTenant","otherManager"]){
  await expect(run(who,s=>s.outcome.read(id))).rejects.toMatchObject({code:"NOT_FOUND"});
  await expect(follow(id,request(),who)).rejects.toMatchObject({code:"NOT_FOUND"});
 }
 await expect(createCoreFlowPort(db,data.orgB).run(data.accounts.tenant.digest,s=>s.outcome.read(id))).rejects.toMatchObject({code:"FORBIDDEN"});
});
it.each(["UNRESOLVED","RECURRENCE_CLAIM"] as const)("atomically creates fresh %s target, assertion, relation and one normal CREATED",async kind=>{
 const old=await create(),id=old.ticket.id,q=selectProtocol(old.building,old.ticket.issueType).questions[0];
 await action("tenant",{type:"ANSWER",ticketId:id,questionId:q.id,value:q.type==="YES_NO"?false:q.type==="SINGLE_SELECT"?q.choices![0].value:"합성 기존 답변"});
 await run("tenant",s=>s.communication.send(id,{clientRequestId:randomUUID(),expectedVersion:0,intent:"TENANT_MESSAGE",body:"합성 이전 대화"}));
 const bytes=await photoBytes();await run("tenant",s=>s.savePhoto(id,{uploadId:randomUUID(),mime:"image/png",width:24,height:16,bytes}));
 await run("manager",s=>s.manager.appendNote(id,"합성 기존 내부 메모"));
 await run("manager",s=>s.manager.update(id,{priority:"URGENT",assigneeLabel:"합성 내부 담당",dueAt:"2026-10-06T00:00:00Z",expectedVersion:1}));
 await complete(id);const before=await snapshot(id),input=request(kind),created=await follow(id,input),target=created.ticket;
 expect(created.created).toBe(true);expect(created.sourceOutcome).toMatchObject({kind,followUpTicketId:target.ticket.id});
 expect(target.ticket.id).not.toBe(id);expect(target.workStatus).toBe("OPEN");expect(target.ticket).toMatchObject({unitId:data.unitA,issueType:"HEATING",rawUserText:input.rawUserText,answers:[],evidence:[],repairPacket:null,routeDecision:null,moreInfoRequest:null});
 expect(target.ticket.protocolId).toBe(selectProtocol(target.building,"HEATING").id);expect(target.events.map(e=>e.kind)).toEqual(["CREATED"]);
 expect(await run("tenant",s=>s.photos(target.ticket.id))).toEqual([]);expect(await run("tenant",s=>s.communication.read(target.ticket.id))).toMatchObject({version:0,messages:[]});
 expect(await run("manager",s=>s.manager.notes(target.ticket.id))).toEqual([]);expect(await run("manager",s=>s.manager.read(target.ticket.id))).toMatchObject({priority:"NORMAL",assigneeLabel:null,dueAt:null});
 expect(await run("tenant",s=>s.outcome.source(target.ticket.id))).toEqual({sourceTicketId:id});
 expect(Object.keys(await run("manager",s=>s.outcome.read(id))).sort()).toEqual(["assertedAt","followUpTicketId","kind","ticketId"]);
 expect(await follow(id,input)).toEqual({...created,created:false});expect(await run("tenant",s=>s.outcome.receipt(id,input.clientRequestId))).toEqual({outcome:created.sourceOutcome,targetTicketId:target.ticket.id});
 for(const who of ["manager","staff"])await expect(run(who,s=>s.outcome.receipt(id,input.clientRequestId))).rejects.toMatchObject({code:"NOT_FOUND"});
 await expect(follow(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});await expect(resolved(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 await run("tenant",s=>s.savePhoto(target.ticket.id,{uploadId:randomUUID(),mime:"image/png",width:24,height:16,bytes}));
 await action("manager",{type:"HANDLING",ticketId:target.ticket.id,status:"IN_PROGRESS",message:"합성 새 처리"});
 expect(await snapshot(id)).toEqual(before);
 const relations=(await f.p.admin.query("SELECT org_id,target_ticket_id,created_by FROM core_flow.ticket_follow_up WHERE source_ticket_id=$1",[id])).rows;
 expect(relations).toEqual([{org_id:data.orgA,target_ticket_id:target.ticket.id,created_by:data.accounts.tenant.userId}]);
});
it("keeps historical RESOLVED then permits only recurrence and preserves the original receipt",async()=>{
 const t=await source(),id=t.ticket.id,key=randomUUID(),first=await resolved(id,key);
 await expect(follow(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});const result=await follow(id,request("RECURRENCE_CLAIM"));
 expect(await run("manager",s=>s.outcome.read(id))).toEqual(result.sourceOutcome);
 expect((await f.p.admin.query("SELECT kind FROM core_flow.ticket_outcome_assertion WHERE ticket_id=$1 ORDER BY created_at,id",[id])).rows.map(r=>r.kind)).toEqual(["RESOLVED","RECURRENCE_CLAIM"]);
 expect(await resolved(id,key)).toEqual({...first,created:false});await expect(resolved(id)).rejects.toMatchObject({code:"STATE_CONFLICT"});
});
it("rejects changed replay input or source with no second target",async()=>{
 const a=await source(),b=await source(),req=request(),created=await follow(a.ticket.id,req),n=await totalTickets();
 for(const changed of [{rawUserText:"합성 다른 새 설명"},{issueType:"LEAK" as const},{claimKind:"RECURRENCE_CLAIM" as const}])await expect(follow(a.ticket.id,{...req,...changed})).rejects.toMatchObject({code:"STATE_CONFLICT"});
 await expect(follow(b.ticket.id,req)).rejects.toMatchObject({code:"STATE_CONFLICT"});await expect(resolved(b.ticket.id,req.clientRequestId)).rejects.toMatchObject({code:"STATE_CONFLICT"});
 expect(await totalTickets()).toBe(n);expect((await follow(a.ticket.id,req)).ticket.ticket.id).toBe(created.ticket.ticket.id);
});
it("rolls back target, CREATED and assertion when final relation storage fails",async()=>{
 const t=await source(),n=await totalTickets(),events=Number((await f.p.admin.query("SELECT count(*) n FROM core_flow.ticket_event")).rows[0].n);
 await f.p.admin.query("CREATE FUNCTION core_flow.fixture_fail_relation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FIXTURE_ROLLBACK';END $$");
 await f.p.admin.query("CREATE TRIGGER fixture_fail_relation BEFORE INSERT ON core_flow.ticket_follow_up FOR EACH ROW EXECUTE FUNCTION core_flow.fixture_fail_relation()");
 try{await expect(follow(t.ticket.id)).rejects.toMatchObject({code:"STATE_CONFLICT"});expect(await totalTickets()).toBe(n);expect(Number((await f.p.admin.query("SELECT count(*) n FROM core_flow.ticket_event")).rows[0].n)).toBe(events);
  expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_outcome_assertion WHERE ticket_id=$1",[t.ticket.id])).rows[0].n).toBe(0);
  expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_follow_up WHERE source_ticket_id=$1",[t.ticket.id])).rows[0].n).toBe(0);
 }finally{await f.p.admin.query("DROP TRIGGER fixture_fail_relation ON core_flow.ticket_follow_up");await f.p.admin.query("DROP FUNCTION core_flow.fixture_fail_relation()");}
 expect((await follow(t.ticket.id)).created).toBe(true);
});
it("does not commit a target or outcome before the enclosing port transaction succeeds",async()=>{
 const t=await source(),n=await totalTickets(),input=request();
 await expect(run("tenant",async s=>{await s.outcome.createFollowUp(t.ticket.id,input);throw new Error("SYNTHETIC_OUTER_ABORT");})).rejects.toThrow("SYNTHETIC_OUTER_ABORT");
 expect(await totalTickets()).toBe(n);expect((await run("tenant",s=>s.outcome.read(t.ticket.id))).kind).toBe("UNCONFIRMED");
 await expect(run("tenant",s=>s.outcome.receipt(t.ticket.id,input.clientRequestId))).rejects.toMatchObject({code:"NOT_FOUND"});
});
async function controlled(){
 const client=new Client(f.roles.b1.webConfig);await client.connect();await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
 const pid=Number((await client.query("SELECT pg_backend_pid() pid")).rows[0].pid),hash=Buffer.from(data.accounts.tenant.digest,"hex");
 return {client,pid,confirm:(id:string,key:string)=>client.query("SELECT core_flow.confirm_ticket_resolved($1,$2,$3) value",[hash,id,key]),
  follow:(id:string,r:CoreCreateFollowUp,body:unknown)=>client.query("SELECT core_flow.create_ticket_follow_up($1,$2,$3,$4,$5,$6,$7) value",[hash,id,r.clientRequestId,r.claimKind,r.issueType,r.rawUserText,JSON.stringify(body)]),
  close:async()=>{await client.query("ROLLBACK");await client.end();}};
}
it.each(["resolved-same","resolved-different","follow-same","follow-different","resolved-unresolved","follow-resolved","resolved-recurrence"])("observes source lock and exact %s concurrency result without an orphan",async mode=>{
 const t=await source(),id=t.ticket.id,n=await totalTickets(),a=await controlled(),b=await controlled(),key=randomUUID(),r=request(mode==="resolved-recurrence"?"RECURRENCE_CLAIM":"UNRESOLVED");
 r.clientRequestId=key;const r2={...r,clientRequestId:mode==="follow-same"?key:randomUUID()};
 const build=(input:CoreCreateFollowUp)=>buildCoreFollowUpTicket(t,input,{now:()=>new Date().toISOString()},{next:()=>randomUUID()});
 let pending:Promise<unknown>|undefined;
 const firstFollow=mode.startsWith("follow"),secondFollow=mode.startsWith("follow-")&&mode!=="follow-resolved"||mode==="resolved-unresolved"||mode==="resolved-recurrence";
 try{
  if(firstFollow)await a.follow(id,r,await build(r));else await a.confirm(id,key);
  pending=secondFollow?b.follow(id,r2,await build(r2)):b.confirm(id,mode==="resolved-same"?key:randomUUID());void pending.catch(()=>{});
  await waitB4Lock(f.p.admin,b.pid,a.pid);expect((await f.p.admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[b.pid])).rows[0].wait_event_type).toBe("Lock");
  await a.client.query("COMMIT");
  if(["resolved-same","follow-same","resolved-recurrence"].includes(mode)){await pending;await b.client.query("COMMIT");}
  else await expect(pending).rejects.toMatchObject({code:"P0001"});
 }finally{await a.close();await b.close();await pending?.catch(()=>{});}
 const hasTarget=firstFollow||mode==="resolved-recurrence";expect(await totalTickets()).toBe(n+(hasTarget?1:0));
 expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_follow_up WHERE source_ticket_id=$1",[id])).rows[0].n).toBe(hasTarget?1:0);
 expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_outcome_assertion WHERE ticket_id=$1",[id])).rows[0].n).toBe(mode==="resolved-recurrence"?2:1);
});
it("serializes the same actor request across different sources without leaving a losing target",async()=>{
 const a=await source(),b=await source(),r=request(),n=await totalTickets(),results=await Promise.allSettled([follow(a.ticket.id,r),follow(b.ticket.id,r)]);
 expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect(results.find(x=>x.status==="rejected")).toMatchObject({reason:{code:"STATE_CONFLICT"}});
 expect(await totalTickets()).toBe(n+1);
});
it("rejects forged target unit, org, existing id, old protocol content and extra fields at the DB command",async()=>{
 const t=await source(),r=request(),ticket=await buildCoreFollowUpTicket(t,r,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}),n=await totalTickets(),hash=Buffer.from(data.accounts.tenant.digest,"hex");
 for(const change of [{unitId:data.unitOther},{unitId:data.unitB,buildingId:data.propertyB},{id:t.ticket.id},{answers:[{questionId:"old",value:false}]},{evidence:[{}]},{moreInfoRequest:{}},{actorId:randomUUID()}]){
  await expect(f.web.query("SELECT core_flow.create_ticket_follow_up($1,$2,$3,$4,$5,$6,$7)",[hash,t.ticket.id,r.clientRequestId,r.claimKind,r.issueType,r.rawUserText,JSON.stringify({...ticket,...change})])).rejects.toMatchObject({code:"22023"});
 }expect(await totalTickets()).toBe(n);
});
it("pins exact function privileges, no runtime table access, owner and org-ceiling RLS",async()=>{
 const names=["confirm_ticket_resolved","create_ticket_follow_up","outcome_assertion_json","outcome_fingerprint","outcome_receipt","outcome_ticket","read_follow_up_source","read_ticket_outcome","validate_ticket_follow_up"];
 const privateNames=["outcome_assertion_json","outcome_fingerprint","outcome_ticket","validate_ticket_follow_up"];
 const rows=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,EXISTS(SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee=0) public FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
 expect(rows).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:!privateNames.includes(proname),public:false})));
 const acl=(await f.p.admin.query("SELECT p.proname,array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)) executors,bool_or(a.is_grantable) grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_flow'::regnamespace AND p.proname=ANY($1) AND a.privilege_type='EXECUTE' GROUP BY p.proname ORDER BY p.proname",[names])).rows;
 expect(acl).toEqual(names.map(proname=>({proname,executors:privateNames.includes(proname)?["bm_core_flow_owner"]:["bm_b1_web","bm_core_flow_owner"],grantable:false})));
 for(const table of ["ticket_outcome_assertion","ticket_follow_up"]){
  expect((await f.p.admin.query("SELECT has_table_privilege('bm_b1_web',$1,p) allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p",["core_flow."+table])).rows).toEqual(Array(7).fill({allowed:false}));
  await expect(f.web.query("SELECT * FROM core_flow."+table)).rejects.toMatchObject({code:"42501"});
 }
 const t=await source();await resolved(t.ticket.id);
 await f.migration.query("BEGIN");try{await f.migration.query("SET LOCAL ROLE bm_core_flow_owner");await f.migration.query("SELECT set_config('app.org_id',$1,true)",[data.orgB]);expect((await f.migration.query("SELECT count(*)::int n FROM core_flow.ticket_outcome_assertion WHERE ticket_id=$1",[t.ticket.id])).rows[0].n).toBe(0);}finally{await f.migration.query("ROLLBACK");}
});
it("revokes staff reads and isolates old source/outcome/relation/photos/Q&A after actual occupancy turnover",async()=>{
 const t=await create(),id=t.ticket.id,bytes=await photoBytes();const photo=await run("tenant",s=>s.savePhoto(id,{uploadId:randomUUID(),mime:"image/png",width:24,height:16,bytes}));
 await run("tenant",s=>s.communication.send(id,{clientRequestId:randomUUID(),expectedVersion:0,intent:"TENANT_MESSAGE",body:"합성 원본 대화"}));await complete(id);
 const r=request(),target=(await follow(id,r)).ticket.ticket.id,before=await snapshot(id);
 expect((await run("staff",s=>s.outcome.read(id))).followUpTicketId).toBe(target);
 await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);
 await expect(run("staff",s=>s.outcome.read(id))).rejects.toMatchObject({code:"NOT_FOUND"});await expect(run("staff",s=>s.outcome.source(target))).rejects.toMatchObject({code:"NOT_FOUND"});
 const a=await controlled(),b=await controlled();let pending:Promise<unknown>|undefined;
 try{await a.client.query("SELECT core_flow.read_ticket($1,$2,true)",[Buffer.from(data.accounts.tenant.digest,"hex"),id]);pending=b.confirm(id,randomUUID());void pending.catch(()=>{});await waitB4Lock(f.p.admin,b.pid,a.pid);
  await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[data.accounts.tenant.userId]);await a.client.query("COMMIT");await expect(pending).rejects.toMatchObject({code:"42501"});
 }finally{await a.close();await b.close();await pending?.catch(()=>{});}
 const occ=(await f.p.admin.query("SELECT id FROM app.occupancy WHERE org_id=$1 AND unit_id=$2 AND status='ACTIVE'",[data.orgA,data.unitA])).rows[0].id;
 await f.p.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp(),'ACTIVE')",[data.orgA,occ,data.accounts.tenantOther.userId]);
 for(const op of [(s:CoreScope)=>s.outcome.read(id),(s:CoreScope)=>s.outcome.receipt(id,r.clientRequestId),(s:CoreScope)=>s.outcome.createFollowUp(id,r)])await expect(run<unknown>("tenant",op)).rejects.toMatchObject({code:"FORBIDDEN"});
 for(const who of ["tenantPeer","tenantOther"]){
  expect((await run(who,s=>s.units())).map(u=>u.id)).toContain(data.unitA);
  for(const op of [(s:CoreScope)=>s.read(id),(s:CoreScope)=>s.outcome.read(id),(s:CoreScope)=>s.outcome.source(target),(s:CoreScope)=>s.outcome.receipt(id,r.clientRequestId),(s:CoreScope)=>s.communication.read(id),(s:CoreScope)=>s.photo(id,photo.photo.photoId)])await expect(run<unknown>(who,op)).rejects.toMatchObject({code:"NOT_FOUND"});
 }
 const independent=await action("tenantOther",{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"교체 입주자 독립 합성 접수"});expect(await run("tenantOther",s=>s.outcome.source(independent.ticket.id))).toEqual({sourceTicketId:null});
 expect(await snapshot(id)).toEqual(before);
 await f.web.query("SELECT authn.revoke_session($1)",[Buffer.from(data.accounts.tenantOther.digest,"hex")]);await expect(run("tenantOther",s=>s.outcome.read(independent.ticket.id))).rejects.toMatchObject({code:"UNAUTHENTICATED"});
});

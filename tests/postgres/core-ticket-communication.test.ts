import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreScope,type CoreAction,type CoreCommunicationSend } from "@build-manager/application";
import { createB1Fixture } from "./helpers/b1-fixture";
import { Client } from "pg";
import { waitB4Lock } from "./helpers/b4-fixture";
import { createOrganizationMembershipTerminationPort } from "@build-manager/persistence-postgres/b5";
import sharp from "sharp";

let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const action=(who:string,a:CoreAction)=>run(who,s=>performCoreAction(s,a,{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
const create=()=>action("tenant",{type:"CREATE",unitId:data.unitA,issueType:"LEAK",rawUserText:"공개 문답 합성 접수"});
const input=(intent:CoreCommunicationSend["intent"],expectedVersion:number):CoreCommunicationSend=>({clientRequestId:randomUUID(),expectedVersion,intent,body:"합성 대화"});
const send=(who:string,id:string,intent:CoreCommunicationSend["intent"],v:number)=>run(who,s=>s.communication.send(id,input(intent,v)));
beforeAll(async()=>{
  f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
  data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);
});
afterAll(async()=>{await db?.close();await f?.close();});

it("adds two forced-RLS tables while leaving historical tickets without a thread",async()=>{
  const t=await create();const tables=(await f.p.admin.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='core_flow'::regnamespace AND relname IN ('ticket_communication_thread','ticket_public_message') ORDER BY relname")).rows;
  expect(tables).toEqual(["ticket_communication_thread","ticket_public_message"].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:true})));
  expect(await run("tenant",s=>s.communication.read(t.ticket.id))).toEqual({version:0,waitingFor:"NONE",readOnly:false,messages:[],nextBeforeSequence:null});
  expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_communication_thread WHERE ticket_id=$1",[t.ticket.id])).rows[0].n).toBe(0);
});
it("keeps conversation, first pending anchor, protocol and handling history independent",async()=>{
  const t=await create(),id=t.ticket.id,before=await run("tenant",s=>s.read(id));
  const q=await send("manager",id,"REQUEST_REPLY",0);expect(q.created).toBe(true);
  await expect(send("staff",id,"REQUEST_REPLY",1)).rejects.toMatchObject({code:"STATE_CONFLICT"});
  const a=await send("tenant",id,"TENANT_MESSAGE",1);expect(a.message.replyToMessageId).toBe(q.message.id);
  await send("tenant",id,"TENANT_MESSAGE",2);await send("manager",id,"MANAGER_UPDATE",3);
  expect(await run("tenant",s=>s.communication.read(id))).toMatchObject({version:4,waitingFor:"MANAGER"});
  const reply=await send("staff",id,"MANAGER_REPLY",4);expect(reply.message).toMatchObject({replyToMessageId:a.message.id,authorRole:"MANAGER",sequence:5});
  expect(await run("tenant",s=>s.communication.read(id))).toMatchObject({version:5,waitingFor:"NONE"});
  expect(await run("tenant",s=>s.read(id))).toEqual(before);
  await expect(send("manager",id,"MANAGER_REPLY",5)).rejects.toMatchObject({code:"STATE_CONFLICT"});
  await send("tenant",id,"TENANT_MESSAGE",5);await send("manager",id,"REQUEST_REPLY",6);
  expect(await run("manager",s=>s.communication.read(id))).toMatchObject({waitingFor:"TENANT",version:7});
});
it("returns exact actor-owned receipts, one row on replay, and conflicts for changed payload or ticket",async()=>{
  const t=await create(),id=t.ticket.id,request=input("TENANT_MESSAGE",0);
  const parallel=await Promise.all([run("tenant",s=>s.communication.send(id,request)),run("tenant",s=>s.communication.send(id,request))]);
  expect(parallel.map(r=>r.created).sort()).toEqual([false,true]);expect(parallel[0].message).toEqual(parallel[1].message);
  const first=parallel.find(r=>r.created)!;
  expect(await run("tenant",s=>s.communication.send(id,request))).toEqual({...first,created:false});
  expect(await run("tenant",s=>s.communication.receipt(id,request.clientRequestId))).toEqual(first.message);
  for(const changed of [{body:"다른 합성 문장"},{expectedVersion:1},{intent:"MANAGER_UPDATE" as const}])await expect(run("tenant",s=>s.communication.send(id,{...request,...changed}))).rejects.toMatchObject({code:"STATE_CONFLICT"});
  const other=await create();await expect(run("tenant",s=>s.communication.send(other.ticket.id,request))).rejects.toMatchObject({code:"STATE_CONFLICT"});
  for(const who of ["manager","staff"])await expect(run(who,s=>s.communication.receipt(id,request.clientRequestId))).rejects.toMatchObject({code:"NOT_FOUND"});
  expect((await f.p.admin.query("SELECT count(*)::int n FROM core_flow.ticket_public_message WHERE ticket_id=$1",[id])).rows[0].n).toBe(1);
});
it("denies co-occupants, other units, other organizations and foreign context without leaking receipts",async()=>{
  const t=await create(),request=input("TENANT_MESSAGE",0);await run("tenant",s=>s.communication.send(t.ticket.id,request));
  for(const who of ["tenantPeer","tenantOther","otherTenant","otherManager"]){
    for(const op of [(s:CoreScope)=>s.communication.read(t.ticket.id),(s:CoreScope)=>s.communication.receipt(t.ticket.id,request.clientRequestId),(s:CoreScope)=>s.communication.send(t.ticket.id,input(who.includes("Manager")?"MANAGER_UPDATE":"TENANT_MESSAGE",1))])await expect(run<unknown>(who,op)).rejects.toMatchObject({code:"NOT_FOUND"});
    expect(await run(who,s=>s.communication.summaries([t.ticket.id,randomUUID()]))).toEqual([]);
  }
  await expect(createCoreFlowPort(db,data.orgB).run(data.accounts.tenant.digest,s=>s.communication.read(t.ticket.id))).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("never projects private metadata, notes, actor ids or exact manager roles",async()=>{
  const t=await create();await run("manager",s=>s.manager.update(t.ticket.id,{priority:"URGENT",assigneeLabel:"합성 내부 담당",dueAt:"2026-10-06T00:00:00Z",expectedVersion:1}));
  await run("manager",s=>s.manager.appendNote(t.ticket.id,"합성 관리자 전용 내용"));const sent=await send("staff",t.ticket.id,"MANAGER_UPDATE",0);
  const page=await run("tenant",s=>s.communication.read(t.ticket.id)),summary=await run("tenant",s=>s.communication.summaries([t.ticket.id]));
  expect(Object.keys(page).sort()).toEqual(["messages","nextBeforeSequence","readOnly","version","waitingFor"]);
  expect(Object.keys(sent.message).sort()).toEqual(["authorRole","body","createdAt","id","intent","replyToMessageId","sequence"]);
  expect(Object.keys(summary[0]).sort()).toEqual(["readOnly","ticketId","version","waitingFor"]);
  for(const forbidden of ["actorId","PROPERTY_STAFF","priority","assignee","dueAt","internal",data.accounts.staff.userId])expect(JSON.stringify({page,summary})).not.toContain(forbidden);
});
it("paginates exactly fifty newest messages with stable sequence cursors and chronological presentation",async()=>{
  const t=await create();for(let v=0;v<53;v++)await send("manager",t.ticket.id,"MANAGER_UPDATE",v);
  const page=await run("tenant",s=>s.communication.read(t.ticket.id));expect(page.messages.map(m=>m.sequence)).toEqual(Array.from({length:50},(_,i)=>i+4));expect(page.nextBeforeSequence).toBe(4);
  const older=await run("tenant",s=>s.communication.read(t.ticket.id,page.nextBeforeSequence!));expect(older.messages.map(m=>m.sequence)).toEqual([1,2,3]);expect(older.nextBeforeSequence).toBeNull();expect(older.version).toBe(53);
  await expect(run("tenant",s=>s.communication.read(t.ticket.id,undefined,51))).rejects.toMatchObject({code:"INVALID_INPUT"});
});
it("enforces intents and bounded SQL inputs without relying on HTTP",async()=>{
  const t=await create();for(const who of ["manager","staff"])await expect(send(who,t.ticket.id,"TENANT_MESSAGE",0)).rejects.toMatchObject({code:"FORBIDDEN"});
  for(const intent of ["REQUEST_REPLY","MANAGER_REPLY","MANAGER_UPDATE"] as const)await expect(send("tenant",t.ticket.id,intent,0)).rejects.toMatchObject({code:"FORBIDDEN"});
  for(const body of [" ","x".repeat(2001),"a\tb","a\u0001b","a\u200bb","a\u2067b"])await expect(run("tenant",s=>s.communication.send(t.ticket.id,{...input("TENANT_MESSAGE",0),body}))).rejects.toMatchObject({code:"INVALID_INPUT"});
  const safe=await run("tenant",s=>s.communication.send(t.ticket.id,{...input("TENANT_MESSAGE",0),body:"<b>합성</b>\r\n다음 줄"}));expect(safe.message.sequence).toBe(1);
});
it("requires current conversation version for completion and allows pending work to complete without a repair claim",async()=>{
  const t=await create(),id=t.ticket.id,request=input("TENANT_MESSAGE",0),first=await run("tenant",s=>s.communication.send(id,request));
  await action("manager",{type:"HANDLING",ticketId:id,status:"IN_PROGRESS",message:"합성 시작"});
  for(const version of [undefined,0])await expect(action("manager",{type:"HANDLING",ticketId:id,status:"COMPLETED",message:"합성 처리 기록",expectedCommunicationVersion:version})).rejects.toMatchObject({code:"STATE_CONFLICT"});
  await action("manager",{type:"HANDLING",ticketId:id,status:"COMPLETED",message:"합성 처리 기록",expectedCommunicationVersion:1});
  expect(await run("tenant",s=>s.communication.read(id))).toMatchObject({readOnly:true,waitingFor:"NONE",version:1});
  expect(await run("tenant",s=>s.communication.send(id,request))).toEqual({...first,created:false});
  expect(await run("tenant",s=>s.communication.receipt(id,request.clientRequestId))).toEqual(first.message);
  for(const [who,intent] of [["tenant","TENANT_MESSAGE"],["manager","REQUEST_REPLY"],["manager","MANAGER_UPDATE"]] as const)await expect(send(who,id,intent,1)).rejects.toMatchObject({code:"STATE_CONFLICT"});
  const noThread=await create();await action("manager",{type:"HANDLING",ticketId:noThread.ticket.id,status:"IN_PROGRESS",message:"합성 시작"});
  expect(await action("manager",{type:"HANDLING",ticketId:noThread.ticket.id,status:"COMPLETED",message:"합성 완료"})).toMatchObject({workStatus:"COMPLETED"});
});
it("retains message/thread/receipt after pool restart",async()=>{
  const t=await create(),request=input("TENANT_MESSAGE",0),sent=await run("tenant",s=>s.communication.send(t.ticket.id,request));const before=await run("tenant",s=>s.communication.read(t.ticket.id));
  await db.close();db=createPostgresDatabase(f.roles.b1.webConfig);expect(await run("tenant",s=>s.communication.read(t.ticket.id))).toEqual(before);expect(await run("tenant",s=>s.communication.receipt(t.ticket.id,request.clientRequestId))).toEqual(sent.message);
});

// Controlled READ COMMITTED transactions exercise the same scoped application adapter.
// The test supplies transaction commands; production timeouts/order are untouched.
async function controlled(who:string){
  const client=new Client(f.roles.b1.webConfig);await client.connect();await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  const pid=Number((await client.query("SELECT pg_backend_pid() pid")).rows[0].pid),hash=Buffer.from(data.accounts[who].digest,"hex");
  const sendMessage=(id:string,request:CoreCommunicationSend)=>client.query("SELECT core_flow.send_communication($1,$2,$3,$4,$5,$6) value",[hash,id,request.clientRequestId,request.expectedVersion,request.intent,request.body]);
  const complete=async(id:string,version:number)=>{
    const record=(await client.query("SELECT core_flow.read_ticket($1,$2,true) value",[hash,id])).rows[0].value;
    await client.query("SELECT core_flow.guard_communication_completion($1,$2,$3)",[hash,id,version]);
    await client.query("SELECT core_flow.store_ticket($1,$2,'HANDLING','합성 완료','COMPLETED')",[hash,JSON.stringify(record.ticket)]);
  };
  return {client,pid,hash,sendMessage,complete,close:async()=>{await client.query("ROLLBACK");await client.end();}};
}
it.each(["message-first","completion-first"])("observes ticket lock and exact %s completion conflict",async order=>{
  const t=await create(),id=t.ticket.id;await send("tenant",id,"TENANT_MESSAGE",0);await action("manager",{type:"HANDLING",ticketId:id,status:"IN_PROGRESS",message:"합성 시작"});
  const a=await controlled(order==="message-first"?"tenant":"manager"),b=await controlled(order==="message-first"?"manager":"tenant");let pending:Promise<unknown>|undefined;
  try{
    if(order==="message-first")await a.sendMessage(id,input("TENANT_MESSAGE",1));else await a.complete(id,1);
    pending=order==="message-first"?b.complete(id,1):b.sendMessage(id,input("TENANT_MESSAGE",1));void pending.catch(()=>{});
    await waitB4Lock(f.p.admin,b.pid,a.pid);
    expect((await f.p.admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[b.pid])).rows[0].wait_event_type).toBe("Lock");
    await a.client.query("COMMIT");await expect(pending).rejects.toMatchObject({code:"P0001"});
    expect(await run("tenant",s=>s.communication.read(id))).toMatchObject({version:order==="message-first"?2:1,readOnly:order==="completion-first"});
  }finally{await a.close();await b.close();await pending?.catch(()=>{});}
});
it("serializes two managers at the same version with an observed waiter and exactly one append",async()=>{
  const t=await create(),a=await controlled("manager"),b=await controlled("staff");let pending:ReturnType<typeof b.sendMessage>|undefined;
  try{
    await a.sendMessage(t.ticket.id,input("MANAGER_UPDATE",0));pending=b.sendMessage(t.ticket.id,input("MANAGER_UPDATE",0));void pending.catch(()=>{});
    await waitB4Lock(f.p.admin,b.pid,a.pid);await a.client.query("COMMIT");await expect(pending).rejects.toMatchObject({code:"P0001"});
    expect((await run("tenant",s=>s.communication.read(t.ticket.id))).messages).toHaveLength(1);
  }finally{await a.close();await b.close();await pending?.catch(()=>{});}
});
it("pins exact function ACL/search_path, table ACL, org ceilings and same-ticket reply foreign keys",async()=>{
  const names=["communication_message_json","communication_receipt","communication_summaries","communication_ticket","communication_valid_body","guard_communication_completion","read_communication","send_communication"];
  const privateNames=["communication_message_json","communication_ticket","communication_valid_body"];
  const functions=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,EXISTS(SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee=0) public FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
  expect(functions).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:!privateNames.includes(proname),public:false})));
  const acl=(await f.p.admin.query("SELECT p.proname,array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)) executors,bool_or(a.is_grantable) grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_flow'::regnamespace AND p.proname=ANY($1) AND a.privilege_type='EXECUTE' GROUP BY p.proname ORDER BY p.proname",[names])).rows;
  expect(acl).toEqual(names.map(proname=>({proname,executors:privateNames.includes(proname)?["bm_core_flow_owner"]:["bm_b1_web","bm_core_flow_owner"],grantable:false})));
  for(const table of ["ticket_communication_thread","ticket_public_message"]){
    expect((await f.p.admin.query("SELECT has_table_privilege('bm_b1_web',$1,p) allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p",["core_flow."+table])).rows).toEqual(Array(7).fill({allowed:false}));
    expect((await f.p.admin.query("SELECT pg_get_userbyid(relowner) owner,EXISTS(SELECT 1 FROM aclexplode(relacl) a WHERE a.grantee=0) public FROM pg_class WHERE oid=$1::regclass",["core_flow."+table])).rows).toEqual([{owner:"bm_core_flow_owner",public:false}]);
    for(const sql of [`SELECT * FROM core_flow.${table}`,`UPDATE core_flow.${table} SET org_id=gen_random_uuid()`,`DELETE FROM core_flow.${table}`])await expect(f.web.query(sql)).rejects.toMatchObject({code:"42501"});
  }
  const policies=(await f.p.admin.query("SELECT polname,polpermissive,pg_get_expr(polqual,polrelid) qual,pg_get_expr(polwithcheck,polrelid) check FROM pg_policy WHERE polrelid IN ('core_flow.ticket_public_message'::regclass,'core_flow.ticket_communication_thread'::regclass) ORDER BY polname")).rows;
  expect(policies).toEqual(["communication_message_ceiling","communication_message_org","communication_thread_ceiling","communication_thread_org"].map(polname=>({polname,polpermissive:!polname.endsWith("ceiling"),qual:"(org_id = app.current_org_id())",check:"(org_id = app.current_org_id())"})));
  const t=await create(),other=await create(),a=await send("tenant",t.ticket.id,"TENANT_MESSAGE",0),b=await send("tenant",other.ticket.id,"TENANT_MESSAGE",0);
  await expect(f.p.admin.query("UPDATE core_flow.ticket_public_message SET reply_to_message_id=$1 WHERE id=$2",[b.message.id,a.message.id])).rejects.toMatchObject({code:"23503"});
  await expect(f.p.admin.query("UPDATE core_flow.ticket_communication_thread SET org_id=$1 WHERE ticket_id=$2",[data.orgB,t.ticket.id])).rejects.toMatchObject({code:"23503"});
  await f.migration.query("BEGIN");try{
    await f.migration.query("SET LOCAL ROLE bm_core_flow_owner");await f.migration.query("SELECT set_config('app.org_id',$1,true)",[data.orgB]);
    for(const table of ["ticket_communication_thread","ticket_public_message"])expect((await f.migration.query(`SELECT count(*)::int n FROM core_flow.${table} WHERE ticket_id=$1`,[t.ticket.id])).rows[0].n).toBe(0);
    await expect(f.migration.query("INSERT INTO core_flow.ticket_communication_thread(ticket_id,org_id,version,waiting_for,updated_at) VALUES($1,$2,1,'NONE',clock_timestamp())",[randomUUID(),data.orgA])).rejects.toMatchObject({code:"42501"});
  }finally{await f.migration.query("ROLLBACK");}
});
it("rechecks staff assignment after an observed ticket wait, then denies receipts after B5 termination",async()=>{
  const t=await create(),req=input("MANAGER_UPDATE",0);await run("staff",s=>s.communication.send(t.ticket.id,req));
  const a=await controlled("manager"),b=await controlled("staff");let pending:ReturnType<typeof b.sendMessage>|undefined;
  try{
    await a.client.query("SELECT core_flow.read_ticket($1,$2,true)",[a.hash,t.ticket.id]);pending=b.sendMessage(t.ticket.id,input("MANAGER_UPDATE",1));void pending.catch(()=>{});await waitB4Lock(f.p.admin,b.pid,a.pid);
    await f.p.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[data.accounts.staff.membershipId]);
    await a.client.query("COMMIT");await expect(pending).rejects.toMatchObject({code:"P0002"});
  }finally{await a.close();await b.close();await pending?.catch(()=>{});}
  for(const op of [(s:CoreScope)=>s.communication.read(t.ticket.id),(s:CoreScope)=>s.communication.receipt(t.ticket.id,req.clientRequestId),(s:CoreScope)=>s.communication.send(t.ticket.id,input("MANAGER_UPDATE",1))])await expect(run<unknown>("staff",op)).rejects.toMatchObject({code:"NOT_FOUND"});
  expect(await run("staff",s=>s.communication.summaries([t.ticket.id]))).toEqual([]);
  await createOrganizationMembershipTerminationPort(db).endCurrent(data.accounts.manager.digest,data.orgA,data.accounts.staff.membershipId!);
  await expect(run("staff",s=>s.communication.receipt(t.ticket.id,req.clientRequestId))).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("preserves original ownership after turnover and rejects ended or revoked actors including old receipts",async()=>{
  const t=await create(),id=t.ticket.id,req=input("TENANT_MESSAGE",0);await run("tenant",s=>s.communication.send(id,req));
  const bytes=await sharp({create:{width:20,height:10,channels:3,background:"#197c92"}}).png().toBuffer();
  const photo=await run("tenant",s=>s.savePhoto(id,{uploadId:randomUUID(),mime:"image/png",width:20,height:10,bytes}));
  const before=(await f.p.admin.query("SELECT tenant_id,body,version FROM core_flow.ticket WHERE id=$1",[id])).rows[0];
  await f.p.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[data.accounts.tenant.userId]);
  // A different existing synthetic actor joins this unit only after the old owner ends.
  const nextOccupancy=(await f.p.admin.query("SELECT id FROM app.occupancy WHERE org_id=$1 AND unit_id=$2 AND status='ACTIVE'",[data.orgA,data.unitA])).rows[0].id;
  await f.p.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp(),'ACTIVE')",[data.orgA,nextOccupancy,data.accounts.tenantOther.userId]);
  for(const op of [(s:CoreScope)=>s.communication.read(id),(s:CoreScope)=>s.communication.receipt(id,req.clientRequestId),(s:CoreScope)=>s.communication.send(id,input("TENANT_MESSAGE",1)),(s:CoreScope)=>s.communication.summaries([id])])await expect(run<unknown>("tenant",op)).rejects.toMatchObject({code:"FORBIDDEN"});
  for(const who of ["tenantPeer","tenantOther"]){
    expect((await run(who,s=>s.units())).map(u=>u.id)).toContain(data.unitA);
    for(const op of [(s:CoreScope)=>s.read(id),(s:CoreScope)=>s.photo(id,photo.photo.photoId),(s:CoreScope)=>s.communication.read(id),(s:CoreScope)=>s.communication.receipt(id,req.clientRequestId)])await expect(run<unknown>(who,op)).rejects.toMatchObject({code:"NOT_FOUND"});
    expect(await run(who,s=>s.communication.summaries([id]))).toEqual([]);
  }
  expect((await f.p.admin.query("SELECT tenant_id,body,version FROM core_flow.ticket WHERE id=$1",[id])).rows[0]).toEqual(before);
  await f.web.query("SELECT authn.revoke_session($1)",[Buffer.from(data.accounts.manager.digest,"hex")]);
  for(const op of [(s:CoreScope)=>s.communication.read(id),(s:CoreScope)=>s.communication.receipt(id,req.clientRequestId),(s:CoreScope)=>s.communication.send(id,input("MANAGER_UPDATE",1))])await expect(run<unknown>("manager",op)).rejects.toMatchObject({code:"UNAUTHENTICATED"});
});

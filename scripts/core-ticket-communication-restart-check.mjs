import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createHash,randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

// Read-only replay of private synthetic browser receipts. No reseed or account changes.
assert.equal(process.version,"v24.21.0");
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),base="http://127.0.0.1:3132";
const directory=join(homedir(),".build-manager-rc1-private"),cases=join(directory,"ticket-public-qa");
const state=JSON.parse(await readFile(join(directory,"state.json"),"utf8"));
const target=JSON.parse(await readFile(join(cases,"roundtrip.private.json"),"utf8")),receipt=JSON.parse(await readFile(join(cases,"receipt.private.json"),"utf8"));
assert.equal(state.admin.host,"127.0.0.1");assert.equal(state.admin.database,"core_flow_synthetic");
assert.equal(state.roles.b1.webConfig.host,state.admin.host);assert.equal(state.roles.b1.webConfig.database,state.admin.database);
const admin=new Client(state.admin);await admin.connect();
try{assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker,"CORE_FLOW_SYNTHETIC_LOCAL");}finally{await admin.end();}
let child;
async function start(){
  const probe=createServer();await new Promise((ok,no)=>{probe.once("error",no);probe.listen(3132,"127.0.0.1",ok);});await new Promise(ok=>probe.close(ok));
  child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3132"],{cwd:join(root,"apps/web"),stdio:"ignore",windowsHide:true,env:{...process.env,BUILD_MANAGER_MODE:"DEMO",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:base}});
  child.on("error",()=>{});
  for(let i=0;i<100;i++){assert.equal(child.exitCode,null,"OWNED_SERVER_EXITED");try{if((await fetch(base+"/core")).ok)return child.pid;}catch{/* Readiness only. */}await delay(100);}
  throw new Error("OWNED_SERVER_NOT_READY");
}
async function stop(){if(child&&child.exitCode===null){const done=once(child,"exit");child.kill();await done;}}
async function read(who,path,expected=200){const r=await fetch(base+"/api/v2/core/"+path,{headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`}});assert.equal(r.status,expected);return expected===200?r.json():null;}
async function snapshot(){
  const id=encodeURIComponent(target.ticketId),path=`tickets/${id}`;
  const thread=await read("tenant",path+"/communication"),managerThread=await read("manager",path+"/communication");
  assert.equal(thread.version,target.version);assert.equal(thread.readOnly,true);assert.equal(thread.waitingFor,"NONE");assert.deepEqual(thread,managerThread);
  const ownReceipt=await read("tenant",`tickets/${receipt.ticketId}/communication/requests/${receipt.clientRequestId}`);
  await read("manager",`tickets/${receipt.ticketId}/communication/requests/${receipt.clientRequestId}`,404);
  const ticket=await read("tenant",path),photos=await read("tenant",path+"/photos"),work=await read("manager",`manager/tickets/${id}/work`),notes=await read("manager",`manager/tickets/${id}/internal-notes`);
  assert.equal(photos.length,1);const hashes=[];
  for(const who of ["tenant","manager"]){const r=await fetch(base+photos[0].path,{headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`}});assert.equal(r.status,200);hashes.push(createHash("sha256").update(Buffer.from(await r.arrayBuffer())).digest("hex"));}
  assert.equal(hashes[0],hashes[1]);return {thread,ownReceipt,ticket,photos,work,notes,hashes};
}
async function races(){
  const observer=new Client(state.admin),gate=new Client(state.roles.b1.webConfig);await observer.connect();await gate.connect();
  const pending=[];
  const post=(who,path,data)=>fetch(base+"/api/v2/core/"+path,{method:"POST",headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`,"Content-Type":"application/json"},body:JSON.stringify(data)});
  const wait=async(blocker,queryPart)=>{for(let i=0;i<60;i++){const rows=(await observer.query("SELECT pid FROM pg_stat_activity WHERE usename='bm_b1_web' AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND position($2 in query)>0",[blocker,queryPart])).rows;if(rows.length===1)return Number(rows[0].pid);await delay(10);}throw new Error("HTTP_TICKET_WAIT_NOT_OBSERVED");};
  try{for(const order of ["message-first","completion-first"]){
    const created=await post("tenant","tickets",{unitId:state.fixture.unitA,issueType:"LEAK",rawUserText:"합성 HTTP 잠금 순서 확인"});assert.equal(created.status,201);const id=(await created.json()).ticketId,path=`tickets/${id}`;
    assert.equal((await post("tenant",path+"/communication/messages",{clientRequestId:randomUUID(),expectedVersion:0,intent:"TENANT_MESSAGE",body:"합성 첫 문의"})).status,201);
    assert.equal((await post("manager",path+"/handling",{status:"IN_PROGRESS",message:"합성 처리 시작"})).status,200);
    await gate.query("BEGIN ISOLATION LEVEL READ COMMITTED");const pid=Number((await gate.query("SELECT pg_backend_pid() pid")).rows[0].pid);
    await gate.query("SELECT core_flow.read_ticket($1,$2,true)",[Buffer.from(state.fixture.accounts.manager.digest,"hex"),id]);
    const message=()=>post("tenant",path+"/communication/messages",{clientRequestId:randomUUID(),expectedVersion:1,intent:"TENANT_MESSAGE",body:"합성 동시 문의"});
    const complete=()=>post("manager",path+"/handling",{status:"COMPLETED",message:"합성 처리 결과",expectedCommunicationVersion:1});
    const first=order==="message-first"?message():complete();pending.push(first);void first.catch(()=>{});
    const firstPid=await wait(pid,order==="message-first"?"send_communication":"read_ticket");
    const second=order==="message-first"?complete():message();pending.push(second);void second.catch(()=>{});
    await wait(firstPid,order==="message-first"?"read_ticket":"send_communication");
    await gate.query("COMMIT");assert.equal((await first).status,order==="message-first"?201:200);assert.equal((await second).status,409);
    const after=await read("tenant",path+"/communication");assert.equal(after.version,order==="message-first"?2:1);assert.equal(after.readOnly,order==="completion-first");
  }console.log("PUBLIC_QA_HTTP_RACES_PASS | observed database waiters | message-first201/409 | completion-first200/409 | production timeouts unchanged");}
  finally{await gate.query("ROLLBACK");await Promise.allSettled(pending);await gate.end();await observer.end();}
}
try{const first=await start(),before=await snapshot();await races();await stop();const second=await start();assert.notEqual(first,second);assert.deepEqual(await snapshot(),before);console.log("PUBLIC_QA_RESTART_PASS | distinct owned server PIDs | thread/message/receipt/ticket/photo/work/note bytes unchanged | foreign receipt404");}
finally{await stop();}

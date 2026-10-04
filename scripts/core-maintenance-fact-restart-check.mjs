import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join,resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

// Only the owned local synthetic server is restarted. No volume/data removal.
assert.equal(process.version,"v24.21.0");
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),base="http://127.0.0.1:3132",directory=join(homedir(),".build-manager-rc1-private");
const state=JSON.parse(await readFile(join(directory,"state.json"),"utf8"));
assert.equal(state.admin.host,"127.0.0.1");assert.equal(state.admin.database,"core_flow_synthetic");
assert.equal(state.roles.b1.webConfig.host,state.admin.host);assert.equal(state.roles.b1.webConfig.database,state.admin.database);
const cases=await Promise.all(["root-correction","response-loss","correction-loss"].map(async name=>({name,...JSON.parse(await readFile(join(directory,"maintenance-fact-browser",name+".private.json"),"utf8"))})));
const admin=new Client(state.admin);await admin.connect();
assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker,"CORE_FLOW_SYNTHETIC_LOCAL");
let child;
async function start(){
 const probe=createServer();await new Promise((ok,no)=>{probe.once("error",no);probe.listen(3132,"127.0.0.1",ok);});await new Promise(ok=>probe.close(ok));
 child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3132"],{cwd:join(root,"apps/web"),stdio:"ignore",windowsHide:true,env:{...process.env,BUILD_MANAGER_MODE:"DEMO",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:base}});
 child.on("error",()=>{});for(let i=0;i<100;i++){assert.equal(child.exitCode,null,"OWNED_SERVER_EXITED");try{if((await fetch(base+"/core")).ok)return child.pid;}catch{/* Readiness only. */}await delay(100);}throw Error("OWNED_SERVER_NOT_READY");
}
async function stop(){if(child&&child.exitCode===null){const done=once(child,"exit");child.kill();await done;}}
async function call(path,who="manager",body,expected=200){const r=await fetch(base+"/api/v2/core/"+path,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,expected);return r.json();}
async function snapshot(){
 const values=[];for(const item of cases){
  const path=`manager/tickets/${item.source}/maintenance-fact`,detail=await call(path),source=await call("tickets/"+item.source,"tenant");assert.equal(source.workStatus,"COMPLETED");assert.equal(detail.current.factId,item.factId);assert.equal(detail.revisions.filter(r=>r.current).length,1);
  const rows=(await admin.query("SELECT * FROM core_flow.unit_maintenance_fact WHERE source_ticket_id=$1 ORDER BY id",[item.source])).rows;
  assert.equal(rows.length,detail.revisions.length);for(const r of rows)assert.equal(r.source_completed_at.toISOString(),new Date(detail.current.sourceCompletedAt).toISOString());
  if(item.rootFactId){assert.equal(detail.revisions[0].factId,item.rootFactId);assert.equal(detail.current.tenantOutcome,"RECURRENCE_CLAIM");assert.equal(detail.current.followUpTicketId,item.target);}
  if(item.sourceHashes)for(const [table,key]of [["ticket","id"],["ticket_event","ticket_id"],["ticket_photo","ticket_id"],["ticket_public_message","ticket_id"],["ticket_communication_thread","ticket_id"],["ticket_work","ticket_id"],["ticket_internal_note","ticket_id"]]){
   const hashes=(await admin.query(`SELECT md5(row_to_json(t)::text) h FROM core_flow.${table} t WHERE ${key}=$1 ORDER BY 1`,[item.source])).rows.map(r=>r.h);assert.deepEqual(hashes,item.sourceHashes[table]);
  }
  await call(path,"tenant",undefined,403);await call(`manager/units/${detail.current.unitId}/maintenance-timeline`,"tenant",undefined,403);
  if(item.key){const receipt=rows.find(r=>r.client_request_id===item.key);assert.ok(receipt);const input={clientRequestId:item.key,actionKind:receipt.action_kind,componentLabel:receipt.component_label};
   const mutation=receipt.replaces_fact_id?`manager/maintenance-facts/${receipt.replaces_fact_id}/corrections`:path;
   if(receipt.replaces_fact_id)Object.assign(input,{expectedCurrentFactId:receipt.replaces_fact_id,correctionReason:receipt.correction_reason});
   assert.equal((await call(mutation,"manager",input,200)).factId,receipt.id);await call(mutation,"manager",{...input,componentLabel:"합성 변경 재요청"},409);assert.deepEqual(await call(path),detail);
  }
  const timeline=await call(`manager/units/${detail.current.unitId}/maintenance-timeline`);assert.ok(timeline.length<=100);assert.ok(timeline.some(f=>f.factId===item.factId));values.push({detail,source,rows});
 }return values;
}
try{const firstPid=await start(),before=await snapshot();await stop();const secondPid=await start();assert.notEqual(firstPid,secondPid);assert.deepEqual(await snapshot(),before);console.log(JSON.stringify({result:"PASS",cases:cases.length,firstPid,secondPid,appendOnly:true,completionTime:true,dynamicOutcome:true,relations:true,exactReplay:true,changedReplay409:true,restartPersistence:true}));}
finally{await stop();await admin.end();}

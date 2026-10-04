import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join,resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { createHash } from "node:crypto";
import { Client } from "pg";

// Reads only this slice's synthetic browser receipts and restarts only its own child.
assert.equal(process.version,"v24.21.0");
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),base="http://127.0.0.1:3132",privateRoot=join(homedir(),".build-manager-rc1-private");
const state=JSON.parse(await readFile(join(privateRoot,"state.json"),"utf8"));
assert.equal(state.admin.host,"127.0.0.1");assert.equal(state.admin.database,"core_flow_synthetic");
assert.equal(state.roles.b1.webConfig.host,state.admin.host);assert.equal(state.roles.b1.webConfig.database,state.admin.database);
const cases=await Promise.all(["resolved","unresolved","recurrence_claim","resolved-recurrence","response-loss"].map(async name=>({name,...JSON.parse(await readFile(join(privateRoot,"completion-followup-browser",name+".private.json"),"utf8"))})));
const admin=new Client(state.admin);await admin.connect();
assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker,"CORE_FLOW_SYNTHETIC_LOCAL");
let child;
async function start(){
 const probe=createServer();await new Promise((ok,no)=>{probe.once("error",no);probe.listen(3132,"127.0.0.1",ok);});await new Promise(ok=>probe.close(ok));
 child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3132"],{cwd:join(root,"apps/web"),stdio:"ignore",windowsHide:true,env:{...process.env,BUILD_MANAGER_MODE:"DEMO",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:base}});
 child.on("error",()=>{});
 for(let i=0;i<100;i++){assert.equal(child.exitCode,null,"OWNED_SERVER_EXITED");try{if((await fetch(base+"/core")).ok)return child.pid;}catch{/* Readiness only. */}await delay(100);}
 throw new Error("OWNED_SERVER_NOT_READY");
}
async function stop(){if(child&&child.exitCode===null){const done=once(child,"exit");child.kill();await done;}}
async function read(path,who="tenant",status=200){
 const r=await fetch(base+path,{headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`}});assert.equal(r.status,status);return status===200?r:null;
}
async function json(path,who="tenant"){return (await read("/api/v2/core/"+path,who)).json();}
async function snapshot(){
 const values=[];
 for(const item of cases){
  const sourcePath="tickets/"+item.source,outcome=await json(sourcePath+"/outcome");
  assert.notEqual(outcome.kind,"UNCONFIRMED");
  if(item.target)assert.equal(outcome.followUpTicketId,item.target);
  if(item.key){const receipt=await json(sourcePath+"/outcome/requests/"+item.key);assert.equal(receipt.targetTicketId,item.target??null);await read("/api/v2/core/"+sourcePath+"/outcome/requests/"+item.key,"manager",404);}
  const source=await json(sourcePath);assert.equal(source.workStatus,"COMPLETED");
  const relationCount=Number((await admin.query("SELECT count(*) n FROM core_flow.ticket_follow_up WHERE source_ticket_id=$1",[item.source])).rows[0].n);assert.equal(relationCount,item.target?1:0);
  if(item.sourceHashes)for(const [table,key] of [["ticket","id"],["ticket_event","ticket_id"],["ticket_photo","ticket_id"],["ticket_public_message","ticket_id"],["ticket_communication_thread","ticket_id"],["ticket_work","ticket_id"],["ticket_internal_note","ticket_id"]]){
   const hashes=(await admin.query("SELECT md5(row_to_json(t)::text) h FROM core_flow."+table+" t WHERE "+key+"=$1 ORDER BY 1",[item.source])).rows.map(r=>r.h);assert.deepEqual(hashes,item.sourceHashes[table]);
  }
  const records=[];
  for(const id of [item.source,item.target].filter(Boolean)){
   const path="tickets/"+id,ticket=await json(path),photos=await json(path+"/photos"),conversation=await json(path+"/communication"),relation=await json(path+"/follow-up");
   const hashes=[];for(const photo of photos){const hash=[];for(const who of ["tenant","manager"])hash.push(createHash("sha256").update(Buffer.from(await (await read(photo.path,who)).arrayBuffer())).digest("hex"));assert.equal(hash[0],hash[1]);hashes.push(hash[0]);}
   if(id===item.target){assert.deepEqual(relation,{sourceTicketId:item.source});if(item.targetPhotoHash)assert.deepEqual(hashes,[item.targetPhotoHash]);}
   records.push({ticket,photos,conversation,relation,hashes,work:await json("manager/"+path+"/work","manager"),notes:await json("manager/"+path+"/internal-notes","manager")});
  }
  values.push({outcome,records});
 }
 return values;
}
try{const firstPid=await start(),before=await snapshot();await stop();const secondPid=await start();assert.notEqual(firstPid,secondPid);assert.deepEqual(await snapshot(),before);console.log(JSON.stringify({result:"PASS",cases:cases.length,firstPid,secondPid,sourceImmutable:true,oneDirectTarget:true,photoBytes:true,receipts:true,restartPersistence:true}));}
finally{await stop();await admin.end();}

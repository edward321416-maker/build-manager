import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

// Read-only continuation of the saved synthetic browser case. No fixture reseed or account creation.
assert.equal(process.version,"v24.21.0");
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),base="http://127.0.0.1:3132";
const directory=join(homedir(),".build-manager-rc1-private");
const state=JSON.parse(await readFile(join(directory,"state.json"),"utf8"));
const target=JSON.parse(await readFile(join(directory,"manager-work-queue/restart-target.private.json"),"utf8"));
assert.equal(state.admin.host,"127.0.0.1");assert.equal(state.admin.database,"core_flow_synthetic");
assert.equal(state.roles.b1.webConfig.host,state.admin.host);assert.equal(state.roles.b1.webConfig.database,state.admin.database);
const admin=new Client(state.admin);await admin.connect();
try{assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker,"CORE_FLOW_SYNTHETIC_LOCAL");}finally{await admin.end();}
let child;
async function start(){
  const probe=createServer();await new Promise((ok,no)=>{probe.once("error",no);probe.listen(3132,"127.0.0.1",ok);});await new Promise(ok=>probe.close(ok));
  child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3132"],{cwd:join(root,"apps/web"),stdio:"ignore",windowsHide:true,env:{...process.env,BUILD_MANAGER_MODE:"DEMO",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:base}});
  child.on("error",()=>{});
  for(let i=0;i<100;i++){assert.equal(child.exitCode,null,"OWNED_SERVER_EXITED");try{if((await fetch(base+"/core")).ok)return child.pid;}catch{/* Readiness probes only. */}await delay(100);}
  throw new Error("OWNED_SERVER_NOT_READY");
}
async function stop(){if(child&&child.exitCode===null){const done=once(child,"exit");child.kill();await done;}}
async function read(who,path,expected=200){const r=await fetch(base+"/api/v2/core/"+path,{headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`}});assert.equal(r.status,expected);return expected===200?r.json():null;}
async function snapshot(){
  const id=encodeURIComponent(target.ticketId);
  const work=await read("manager",`manager/tickets/${id}/work`),notes=await read("manager",`manager/tickets/${id}/internal-notes`),ticket=await read("tenant",`tickets/${id}`),photos=await read("tenant",`tickets/${id}/photos`);
  assert.equal(work.assigneeLabel,target.assigneeLabel);assert.equal(work.version,target.version);assert.equal(work.priority,"URGENT");assert.equal(notes.some(x=>x.body===target.memo),true);assert.equal(photos.length,1);
  const serialized=JSON.stringify(ticket);for(const value of [target.memo,target.assigneeLabel,"assigneeLabel","internalNotes","noteCount"])assert.equal(serialized.includes(value),false);
  for(const path of ["manager/work-items",`manager/tickets/${id}/work`,`manager/tickets/${id}/internal-notes`])await read("tenant",path,403);
  const hashes=[];
  for(const who of ["tenant","manager"]){const r=await fetch(base+photos[0].path,{headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`}});assert.equal(r.status,200);hashes.push(createHash("sha256").update(Buffer.from(await r.arrayBuffer())).digest("hex"));}
  assert.equal(hashes[0],hashes[1]);return {work,notes,ticket,photos,hashes};
}
try{const first=await start(),before=await snapshot();await stop();const second=await start();assert.notEqual(first,second);assert.deepEqual(await snapshot(),before);console.log("MANAGER_WORK_RESTART_PASS | distinct owned server PIDs | metadata/notes/ticket/photo bytes unchanged | tenant manager endpoints403");}
finally{await stop();}

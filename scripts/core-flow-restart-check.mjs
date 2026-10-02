import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

// Owned loopback process only. No container/data removal; no secret output.
const root=resolve(fileURLToPath(new URL("..",import.meta.url))),base="http://127.0.0.1:3132";
const state=JSON.parse(await readFile(join(homedir(),".build-manager-rc1-private/state.json"),"utf8"));
assert.equal(state.admin.host,"127.0.0.1");assert.equal(state.admin.database,"core_flow_synthetic");
let child;
async function start(){
  child=spawn(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3132"],{cwd:join(root,"apps/web"),stdio:"ignore",env:{...process.env,BUILD_MANAGER_MODE:"DEMO",CORE_FLOW_MODE:"SYNTHETIC_LOCAL",CORE_FLOW_DATABASE_CONFIG:JSON.stringify(state.roles.b1.webConfig),CORE_FLOW_ORIGINS:base}});
  child.on("error",()=>{});
  for(let i=0;i<100;i++){
    assert.equal(child.exitCode,null,"SERVER_EXITED");
    try{if((await fetch(base+"/core")).ok)return child.pid;}catch{/* Readiness only; never retry a business mutation. */}
    await delay(100);
  }
  throw new Error("SERVER_NOT_READY");
}
async function stop(){if(child&&child.exitCode===null){const exited=once(child,"exit");child.kill();await exited;}}
async function api(who,path,body){const r=await fetch(base+"/api/v2/core/"+path,{method:body===undefined?"GET":"POST",headers:{Authorization:`Bearer ${state.fixture.accounts[who].handle}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,body&&path==="tickets"?201:200);return r.json();}
try{
  const first=await start();
  const t=await api("tenant","tickets",{unitId:state.fixture.unitA,issueType:"LEAK",rawUserText:"합성 서버 재시작 영속성 확인"});
  await api("manager",`tickets/${t.ticketId}/handling`,{status:"IN_PROGRESS",message:"합성 재시작 전 처리 기록"});
  const before=await api("tenant",`tickets/${t.ticketId}`);await stop();const second=await start();assert.notEqual(first,second);
  const after=await api("tenant",`tickets/${t.ticketId}`);assert.deepEqual(after,before);
  assert.equal((await api("manager","tickets")).some(x=>x.ticketId===t.ticketId),true);
  console.log("RC1_SERVER_RESTART_PASS | distinct server PIDs | exact ticket/version/events preserved | tenant and manager reread");
}finally{await stop();}

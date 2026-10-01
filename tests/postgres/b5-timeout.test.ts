import { fork } from "node:child_process";
import { Client } from "pg";
import { afterAll, expect, it } from "vitest";
import { createB5Harness, seedB5Scope, membershipRows, interceptB5, observeB5Wait, type B5Harness } from "./helpers/b5-fixture";
import { waitB4Lock } from "./helpers/b4-fixture";

type Receipt = { type: string; [key: string]: unknown };
async function runWorker(mode: "load-only" | "active" | "idle", h?: B5Harness) {
  expect(process.version).toBe("v24.21.0");
  const s = h ? await seedB5Scope(h) : undefined;
  const before = h && s ? await membershipRows(h,s.orgA) : undefined;
  const child = fork(new URL("./helpers/b5-timeout-worker.ts",import.meta.url),mode === "load-only" ? [mode] : [],{
    execPath: process.execPath,execArgv: ["--experimental-transform-types"],stdio: ["ignore","ignore",mode === "load-only" ? "pipe" : "ignore","ipc"],
  });
  const messages: Receipt[] = [], phaseChecks: Promise<void>[] = [];
  let stderr = "";
  // Only load-only captures early native warnings, privately in memory. Never emit raw text.
  child.stderr?.on("data",chunk => { stderr += String(chunk); });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exited = new Promise<number | null>((resolve,reject) => {
      timer=setTimeout(()=>{ child.kill(); reject(new Error("B5_CHILD_DEADLINE")); },20_000);
      child.once("error",()=>reject(new Error("B5_CHILD_START_FAILED")));
      child.once("exit",code=>resolve(code));
      child.on("message",(message: Receipt) => {
        messages.push(message);
        if (message.type === "module-loaded" && h && s) child.send({ config: h.roles.b1.webConfig,digest: s.adminA.digest,org: s.orgA,target: s.staffMembership,mode });
        if (message.type === "phase" && h) {
          const check = (async () => {
            const row=(await h.p.admin.query("SELECT state,query,extract(epoch FROM clock_timestamp()-xact_start) AS age FROM pg_stat_activity WHERE pid=$1",[message.pid])).rows[0];
            expect(row.state).toBe(mode === "idle" ? "idle in transaction" : "active");
            expect(row.query).toContain(mode === "idle" ? "b5_end_organization_membership" : "pg_sleep(4)");
            if (mode === "active") expect(Number(row.age)).toBeGreaterThanOrEqual(4);
          })();
          phaseChecks.push(check); void check.catch(()=>{});
        }
      });
    });
    const code=await exited;
    // Only category/code are retained; warning presence/count is not a success oracle.
    const categories=[...new Set([...stderr.matchAll(/\b(ExperimentalWarning|DeprecationWarning|Warning):/g)].map(m=>m[1]))];
    const warningCodes=[...new Set([...stderr.matchAll(/\[(DEP[0-9]{4})\]/g)].map(m=>m[1]))];
    const warningPresent=stderr.length>0; stderr="";
    expect(code).toBe(0);
    expect(messages.find(m=>m.type === "module-loaded")).toEqual({ type:"module-loaded",version:"v24.21.0",execArgv:["--experimental-transform-types"],roots:["persistence-postgres","application","domain"] });
    expect(messages.some(m=>m.type === "worker_failure")).toBe(false);
    if (mode === "load-only") console.info("B5_LOAD_RECEIPT",JSON.stringify({ version:"v24.21.0",execArgv:["--experimental-transform-types"],warningPresent,categories,warningCodes }));
    else {
      await Promise.all(phaseChecks); expect(phaseChecks).toHaveLength(1);
      const recovered=messages.find(m=>m.type === "recovered");
      expect(recovered).toMatchObject({ mode,codes:expect.arrayContaining(["25P04"]),releases:1,destroyed:1,commits:0,rollbacks:0,commands:1,result:"DEPENDENCY_UNAVAILABLE" });
      expect(recovered!.pid).not.toBe(recovered!.replacementPid);
      expect(messages.filter(m=>m.type === "diagnostic").every(m=>m.safe === true)).toBe(true);
      expect(await membershipRows(h!,s!.orgA)).toEqual(before);
      expect((await h!.p.admin.query("SELECT count(*) FROM pg_stat_activity WHERE pid=$1",[recovered!.pid])).rows[0].count).toBe("0");
      console.info("B5_TIMEOUT_RECEIPT",JSON.stringify(recovered));
    }
  } finally { clearTimeout(timer); stderr=""; if (child.exitCode === null) child.kill(); }
}

it("AC16 B5PDR2-L01 real-entry load-only smoke has pinned native runtime and sanitized early warnings",async()=>{ await runWorker("load-only"); });
let h: B5Harness;
// Load-only never starts a DB or supplies configuration; DB setup is lazy in failure cases.
afterAll(async()=>{ await h?.close(); });
it.each(["active","idle"] as const)("AC16 native %s 25P04 destroys checkout, preserves rows and survives replacement backend",async mode=>{
  h ??= await createB5Harness(); await runWorker(mode,h);
},120_000);

it.each(["statement","constraint","overflow"])("AC16 actual %s error rolls back B5 and sanitizes driver details",async mode=>{
  h ??= await createB5Harness(); const s=await seedB5Scope(h), before=await membershipRows(h,s.orgA);
  const gate=interceptB5(h,async(sql,forward,query)=>{
    const result=await forward();
    if(sql.includes("authn.b5_end_organization_membership")) {
      if(mode === "statement") await query("SELECT pg_sleep(6)");
      if(mode === "constraint") { await query("CREATE TEMP TABLE b5_constraint_probe(n int CHECK(n>0)) ON COMMIT DROP"); await query("INSERT INTO b5_constraint_probe VALUES(0)"); }
      if(mode === "overflow") await query("SELECT 2147483647::int+1");
    }
    return result;
  });
  try {
    await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,s.staffMembership)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE",message:"DEPENDENCY_UNAVAILABLE"});
    expect(gate.observations).toMatchObject({commands:1,commits:0,rollbacks:1,releases:1,destroyed:0,codes:[mode === "statement" ? "57014" : mode === "constraint" ? "23514" : "22003"]});
    expect(await membershipRows(h,s.orgA)).toEqual(before);
  } finally { gate.restore(); }
});
it("AC16 fixed 2000ms lock budget yields actual 55P03 rollback without mutation",async()=>{
  h ??= await createB5Harness(); const s=await seedB5Scope(h), before=await membershipRows(h,s.orgA);
  const blocker=new Client(h.p.adminConfig); await blocker.connect();
  const gate=interceptB5(h,async(_sql,forward)=>forward()); let pending: Promise<void> | undefined;
  try {
    await blocker.query("BEGIN"); await blocker.query("SELECT id FROM app.organization WHERE id=$1 FOR NO KEY UPDATE",[s.orgA]);
    const pid=Number((await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    pending=h.memberships.endCurrent(s.adminA.digest,s.orgA,s.staffMembership); void pending.catch(()=>{});
    await observeB5Wait(h,await gate.pid,pid);
    await expect(pending).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE",message:"DEPENDENCY_UNAVAILABLE"});
    expect(gate.observations).toMatchObject({commands:1,commits:0,rollbacks:1,releases:1,destroyed:0,codes:["55P03"]});
    expect(await membershipRows(h,s.orgA)).toEqual(before);
  } finally { await blocker.query("ROLLBACK"); await blocker.end(); await Promise.allSettled(pending ? [pending] : []); gate.restore(); }
});
it("AC16 real deadlock victim rolls back the B5 command and retains a usable connection",async()=>{
  h ??= await createB5Harness(); const s=await seedB5Scope(h), before=await membershipRows(h,s.orgA);
  const other=new Client(h.p.adminConfig); await other.connect(); let waiting: Promise<unknown> | undefined;
  await other.query("BEGIN"); await other.query("SET LOCAL deadlock_timeout='10s'"); await other.query("SELECT pg_advisory_xact_lock(50502)");
  const otherPid=Number((await other.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  const gate=interceptB5(h,async(sql,forward,query)=>{
    const result=await forward();
    if(sql.includes("authn.b5_end_organization_membership")) {
      await query("SELECT pg_advisory_xact_lock(50501)");
      waiting=other.query("SELECT pg_advisory_xact_lock(50501)"); void waiting.catch(()=>{});
      await waitB4Lock(h.p.admin,otherPid,await gate.pid);
      await query("SELECT pg_advisory_xact_lock(50502)");
    }
    return result;
  });
  try {
    await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,s.staffMembership)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE",message:"DEPENDENCY_UNAVAILABLE"});
    expect(gate.observations).toMatchObject({commands:1,commits:0,rollbacks:1,releases:1,destroyed:0,codes:["40P01"]});
    expect(await membershipRows(h,s.orgA)).toEqual(before);
  } finally { await Promise.allSettled(waiting ? [waiting] : []); await other.query("ROLLBACK"); await other.end(); gate.restore(); }
});
it.each(["before","after"])("AC16 unknown COMMIT %s delivery never reissues B5 and fresh state determines commit",async timing=>{
  h ??= await createB5Harness(); const s=await seedB5Scope(h), before=await membershipRows(h,s.orgA);
  const gate=interceptB5(h,async(sql,forward)=>{
    if(sql !== "COMMIT") return forward();
    if(timing === "after") await forward();
    throw Object.assign(new Error("B5_SYNTHETIC_TRANSPORT_LOSS"),{code:"08006"});
  });
  try {
    await expect(h.memberships.endCurrent(s.adminA.digest,s.orgA,s.staffMembership)).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE",message:"DEPENDENCY_UNAVAILABLE"});
    expect(gate.observations).toMatchObject({commands:1,commits:1,rollbacks:0,releases:1,destroyed:1,codes:["08006"]});
    const after=await membershipRows(h,s.orgA);
    if(timing === "before") expect(after).toEqual(before);
    else expect(after.find(r=>r.id === s.staffMembership)?.status).toBe("ENDED");
  } finally { gate.restore(); }
});

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { afterEach, expect, it, vi } from "vitest";
import * as database from "../../packages/persistence-postgres/src/database";
import { withB5OrgTransaction } from "../../packages/persistence-postgres/src/b5/transaction";
import { createOrganizationMembershipTerminationPort } from "@build-manager/persistence-postgres/b5";
import { createB2Harness, seedB2Scope } from "./helpers/b2-fixture";

afterEach(()=>vi.restoreAllMocks());
const digest="a".repeat(64), org=randomUUID();
function fake(failAt?: string, terminated=false, releaseEvent=false, state="ENDED", errorCode="57014") {
  const client=Object.assign(new EventEmitter(),{query:vi.fn(async(sql:string)=>{
    if(sql===failAt) {
      if(terminated) {client.emit("error",{code:"25P04"}); queueMicrotask(()=>client.emit("error",{code:"25P04"}));}
      throw Object.assign(new Error("private query failure"),{code:terminated?"25P04":errorCode});
    }
    return {rows:sql.includes("current_actor")?[{id:randomUUID()}]:sql.includes("authorize_org")?[{allowed:true}]:sql.includes("b5_end_organization_membership")?[{state}]:[]};
  }),release:vi.fn((_destroy?:boolean)=>{if(releaseEvent) client.emit("error",{code:"25P04"});})});
  vi.spyOn(database,"getInternalPool").mockReturnValue({connect:async()=>client} as unknown as Pool);
  return client;
}
it("uses exact READ COMMITTED, timeout, authority and command order and cleans up each healthy checkout",async()=>{
  const c=fake();
  for(let i=0;i<2;i++) {
    expect(await withB5OrgTransaction({close:async()=>{}},digest,org,async client=>{await client.query("COMMAND");return 7;})).toBe(7);
    expect(c.listenerCount("error")).toBe(0);
  }
  const queries=c.query.mock.calls.map(([sql])=>sql);
  expect(queries.slice(0,9)).toEqual(["BEGIN ISOLATION LEVEL READ COMMITTED","SET LOCAL lock_timeout = '2000ms'",
    "SET LOCAL statement_timeout = '5000ms'","SET LOCAL transaction_timeout = '7000ms'",
    "SELECT authn.current_actor($1) AS id","SELECT authn.authorize_org($1,$2) AS allowed",
    "SELECT set_config('app.org_id',$1,true),set_config('app.b1_session_digest',$2,true)","COMMAND","COMMIT"]);
  expect(c.release).toHaveBeenCalledTimes(2); expect(c.release).toHaveBeenCalledWith(false);
});
it("persistent idempotent listener survives repeated errors and release handoff; no late COMMIT/ROLLBACK",async()=>{
  const c=fake("COMMAND",true,true);
  await expect(withB5OrgTransaction({close:async()=>{}},digest,org,async client=>{await client.query("COMMAND");})).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  expect(c.query.mock.calls.map(([sql])=>sql)).not.toEqual(expect.arrayContaining(["COMMIT"]));
  expect(c.query.mock.calls.map(([sql])=>sql)).not.toEqual(expect.arrayContaining(["ROLLBACK"]));
  expect(c.release).toHaveBeenCalledExactlyOnceWith(true); expect(c.listenerCount("error")).toBe(0);
});
it.each(["BEGIN ISOLATION LEVEL READ COMMITTED","COMMIT"])("destroys on failed %s without retry",async fail=>{
  const c=fake(fail);
  await expect(withB5OrgTransaction({close:async()=>{}},digest,org,async client=>{await client.query("COMMAND");})).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  expect(c.release).toHaveBeenCalledExactlyOnceWith(true);
  expect(c.query.mock.calls.filter(([sql])=>sql===fail)).toHaveLength(1);
});
it("rolls back nonfatal command errors and destroys if rollback fails",async()=>{
  const c=fake("ROLLBACK");
  await expect(withB5OrgTransaction({close:async()=>{}},digest,org,async()=>{throw new Error("private operation");})).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  expect(c.release).toHaveBeenCalledExactlyOnceWith(true);
  expect(c.query.mock.calls.filter(([sql])=>sql==="ROLLBACK")).toHaveLength(1);
});
const command="SELECT authn.b5_end_organization_membership($1::bytea,$2::uuid,$3::uuid) AS state";
it.each([["ENDED",null],["NOT_FOUND","NOT_FOUND"],["FORBIDDEN","FORBIDDEN"],["LAST_ADMIN","CONFLICT"],["unexpected","DEPENDENCY_UNAVAILABLE"]])("maps SQL %s without a projection or retry",async(state,code)=>{
  const c=fake(undefined,false,false,state!);
  const operation=createOrganizationMembershipTerminationPort({close:async()=>{}}).endCurrent(digest,org,randomUUID());
  if(code) await expect(operation).rejects.toMatchObject({code}); else expect(await operation).toBeUndefined();
  expect(c.query.mock.calls.filter(([sql])=>sql===command)).toHaveLength(1);
  expect(c.release).toHaveBeenCalledExactlyOnceWith(false);
});
it.each(["55P03","57014","40P01","40001","23514","22003","25P04","UNKNOWN"])("sanitizes %s; timeout query rejection alone discards without rollback",async code=>{
  const c=fake(command,false,false,"ENDED",code);
  await expect(createOrganizationMembershipTerminationPort({close:async()=>{}}).endCurrent(digest,org,randomUUID())).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE",message:"DEPENDENCY_UNAVAILABLE"});
  expect(c.release).toHaveBeenCalledExactlyOnceWith(code==='25P04');
  expect(c.query.mock.calls.filter(([sql])=>sql==='ROLLBACK')).toHaveLength(code==='25P04'?0:1);
  expect(c.query.mock.calls.filter(([sql])=>sql===command)).toHaveLength(1);
});
it("skips COMMIT after an error event even if the operation resolves",async()=>{
  const c=fake();
  await expect(withB5OrgTransaction({close:async()=>{}},digest,org,async()=>{c.emit("error",{code:"25P04"});})).rejects.toMatchObject({code:"DEPENDENCY_UNAVAILABLE"});
  expect(c.query.mock.calls.filter(([sql])=>sql==='COMMIT'||sql==='ROLLBACK')).toEqual([]);
  expect(c.release).toHaveBeenCalledExactlyOnceWith(true);
});
it("fixture probes READ COMMITTED immediately after the three real SET LOCAL statements",async()=>{
  const h=await createB2Harness();
  let restoreQuery: (()=>void)|undefined;
  try {
    const s=await seedB2Scope(h),pool=database.getInternalPool(h.webDb),connect=pool.connect.bind(pool);
    let isolation: string|undefined;
    vi.spyOn(pool,"connect").mockImplementation((async()=>{
      const c=await connect(),original=c.query;
      restoreQuery=()=>{c.query=original;};
      c.query=(async(...args:unknown[])=>{
        const result=await Reflect.apply(original,c,args);
        if(args[0]==="SET LOCAL transaction_timeout = '7000ms'") isolation=(await Reflect.apply(original,c,["SELECT current_setting('transaction_isolation') AS isolation"])).rows[0].isolation;
        return result;
      }) as PoolClient["query"];
      return c;
    }) as typeof pool.connect);
    await withB5OrgTransaction(h.webDb,s.adminA.digest,s.orgA,async()=>{});
    expect(isolation).toBe("read committed");
  } finally {restoreQuery?.(); vi.restoreAllMocks(); await h.close();}
},120_000);

import { randomUUID } from "node:crypto";
import { expect,it,vi } from "vitest";
import type { CoreFlowPort,CoreScope,CoreSession } from "@build-manager/application";
import { CoreFlowError } from "@build-manager/application";
import { handleCoreFlow } from "./http";

const ticketId=randomUUID(),unitId=randomUUID(),buildingId=randomUUID();
const item={ticketId,unitId,buildingId,buildingName:"합성 건물",unitLabel:"합성 호실",issueType:"LEAK",workStatus:"OPEN",priority:"NORMAL",assigneeLabel:null,dueAt:null,createdAt:"2026-10-04T00:00:00Z",updatedAt:"2026-10-04T00:00:00Z",version:1};
function setup(role:CoreSession["role"]="ORG_ADMIN"){
  const manager={list:vi.fn().mockResolvedValue([item]),read:vi.fn().mockResolvedValue(item),update:vi.fn().mockResolvedValue({...item,version:2}),notes:vi.fn().mockResolvedValue([]),appendNote:vi.fn().mockResolvedValue({id:"1",body:"합성 내부 메모",createdAt:item.createdAt})};
  const port:CoreFlowPort={run:async(_hash,op)=>op({session:{role},manager} as unknown as CoreScope)};
  const call=(path:string,method="GET",input:unknown=undefined)=>handleCoreFlow(new Request("http://127.0.0.1:3130/api/v2/core/"+path,{method,headers:{Authorization:`Bearer ${"a".repeat(64)}`,"Content-Type":"application/json"},...(input===undefined?{}:{body:JSON.stringify(input)})}),path.split("/"),()=>({port,revoke:vi.fn(),origins:[]}));
  return {manager,call};
}
it("serves a dedicated private manager queue through the existing authenticated transport",async()=>{
  const s=setup(),r=await s.call("manager/work-items");expect(r.status).toBe(200);expect(await r.json()).toEqual([item]);expect(r.headers.get("cache-control")).toBe("private, no-store");expect(s.manager.list).toHaveBeenCalledOnce();
});
it("rejects tenant manager routes before any manager persistence operation",async()=>{
  const s=setup("TENANT");
  for(const [path,method,body] of [["manager/work-items","GET",undefined],[`manager/tickets/${ticketId}/work`,"GET",undefined],[`manager/tickets/${ticketId}/work`,"POST",{}],[`manager/tickets/${ticketId}/internal-notes`,"GET",undefined],[`manager/tickets/${ticketId}/internal-notes`,"POST",{body:"hidden"}]] as const){const r=await s.call(path,method,body);expect(r.status).toBe(403);expect(await r.text()).not.toContain(ticketId);}
  for(const op of Object.values(s.manager))expect(op).not.toHaveBeenCalled();
});
it("validates strict mutation input and returns conflicts without raw error data",async()=>{
  const s=setup();const path=`manager/tickets/${ticketId}/work`;
  const valid={priority:"HIGH",assigneeLabel:"합성 담당",dueAt:"2026-10-06T10:00:00+09:00",expectedVersion:1};
  expect((await s.call(path,"POST",valid)).status).toBe(200);
  for(const body of [{...valid,role:"ORG_ADMIN"},{...valid,expectedVersion:0},{...valid,dueAt:"2026-10-06T10:00"},{...valid,assigneeLabel:"a\nb"},{...valid,assigneeLabel:"x".repeat(81)},{...valid,priority:"LOW"}])expect((await s.call(path,"POST",body)).status).toBe(400);
  expect(s.manager.update).toHaveBeenCalledTimes(1);
  s.manager.update.mockRejectedValue(new CoreFlowError("STATE_CONFLICT"));const stale=await s.call(path,"POST",valid);expect(stale.status).toBe(409);expect(await stale.text()).not.toContain("stack");
});
it("appends bounded internal notes and never accepts caller identity or organization",async()=>{
  const s=setup(),path=`manager/tickets/${ticketId}/internal-notes`;
  expect((await s.call(path,"POST",{body:"합성 내부 메모"})).status).toBe(201);
  for(const body of [{body:" "},{body:"x".repeat(2001)},{body:"a\u0001b"},{body:"safe",authorId:randomUUID()}])expect((await s.call(path,"POST",body)).status).toBe(400);
  expect(s.manager.appendNote).toHaveBeenCalledTimes(1);expect((await s.call(path)).status).toBe(200);
});

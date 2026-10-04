import { randomUUID } from "node:crypto";
import { expect,it,vi } from "vitest";
import { CoreFlowError,type CoreScope,type CoreFlowPort,type CoreSession } from "@build-manager/application";
import { CoreHandlingSchema } from "@build-manager/api-contracts";
import { handleCoreFlow } from "./http";

const id=randomUUID(),key=randomUUID();
const message={id:randomUUID(),sequence:1,intent:"TENANT_MESSAGE",authorRole:"TENANT",body:"합성 공개 문의",replyToMessageId:null,createdAt:"2026-10-04T00:00:00Z"};
const input={clientRequestId:key,expectedVersion:0,intent:"TENANT_MESSAGE",body:message.body};
function setup(role:CoreSession["role"]="TENANT"){
  const communication={read:vi.fn().mockResolvedValue({version:0,waitingFor:"NONE",readOnly:false,messages:[],nextBeforeSequence:null}),send:vi.fn().mockResolvedValue({message,created:true}),receipt:vi.fn().mockResolvedValue(message),summaries:vi.fn().mockResolvedValue([{ticketId:id,version:0,waitingFor:"NONE",readOnly:false}])};
  const port:CoreFlowPort={run:async(_hash,op)=>op({session:{role},communication} as unknown as CoreScope)};
  const call=(path:string,method="GET",data?:unknown,headers:Record<string,string>={})=>handleCoreFlow(new Request("http://127.0.0.1:3130/api/v2/core/"+path,{method,headers:{Authorization:`Bearer ${"a".repeat(64)}`,"Content-Type":"application/json",...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),path.split("?")[0].split("/"),()=>({port,revoke:vi.fn(),origins:["http://127.0.0.1:3130"]}));
  return {communication,call};
}
it("returns an empty version-zero public page with private no-store headers",async()=>{
  const s=setup(),r=await s.call(`tickets/${id}/communication`);expect(r.status).toBe(200);expect(await r.json()).toEqual({version:0,waitingFor:"NONE",readOnly:false,messages:[],nextBeforeSequence:null});expect(r.headers.get("cache-control")).toBe("private, no-store");expect(r.headers.get("referrer-policy")).toBe("no-referrer");
});
it("accepts strict bounded plain text and rejects caller identity and reply targets",async()=>{
  const s=setup(),path=`tickets/${id}/communication/messages`;
  expect((await s.call(path,"POST",input)).status).toBe(201);
  for(const extra of [{actorId:randomUUID()},{orgId:randomUUID()},{role:"ORG_ADMIN"},{unitId:randomUUID()},{visibility:"PUBLIC"},{replyToMessageId:randomUUID()}])expect((await s.call(path,"POST",{...input,...extra})).status).toBe(400);
  for(const body of [" ","x".repeat(2001),"a\u0001b","a\u200bb","a\tb"])expect((await s.call(path,"POST",{...input,body})).status).toBe(400);
  expect((await s.call(path,"POST",{...input,body:" <b>합성</b>\r\n다음 줄 "})).status).toBe(201);
  expect(s.communication.send).toHaveBeenLastCalledWith(id,{...input,body:"<b>합성</b>\r\n다음 줄"});
});
it("enforces tenant and manager intents before persistence",async()=>{
  for(const role of ["TENANT","ORG_ADMIN","PROPERTY_STAFF"] as const){
    const s=setup(role);
    for(const intent of ["TENANT_MESSAGE","REQUEST_REPLY","MANAGER_REPLY","MANAGER_UPDATE"]){
      const r=await s.call(`tickets/${id}/communication/messages`,"POST",{...input,intent});
      expect(r.status).toBe((role==="TENANT")===(intent==="TENANT_MESSAGE")?201:403);
    }
    expect(s.communication.send).toHaveBeenCalledTimes(role==="TENANT"?1:3);
  }
});
it("returns replay200 and actor-owned receipts, sanitizing state conflicts and absence",async()=>{
  const s=setup();s.communication.send.mockResolvedValue({message,created:false});
  const replay=await s.call(`tickets/${id}/communication/messages`,"POST",input);expect(replay.status).toBe(200);expect(await replay.json()).toEqual(message);
  const receipt=await s.call(`tickets/${id}/communication/requests/${key}`);expect(receipt.status).toBe(200);expect(await receipt.json()).toEqual(message);
  s.communication.receipt.mockRejectedValue(new CoreFlowError("NOT_FOUND"));expect((await s.call(`tickets/${id}/communication/requests/${key}`)).status).toBe(404);
  s.communication.send.mockRejectedValue(new CoreFlowError("STATE_CONFLICT"));const r=await s.call(`tickets/${id}/communication/messages`,"POST",input);expect(r.status).toBe(409);expect(await r.text()).not.toContain(key);
});
it("allows only bounded page and summary queries without loosening existing routes",async()=>{
  const s=setup();expect((await s.call(`tickets/${id}/communication?beforeSequence=51&limit=25`)).status).toBe(200);expect(s.communication.read).toHaveBeenCalledWith(id,51,25);
  for(const q of ["limit=51","limit=0","beforeSequence=-1","beforeSequence=1.5","limit=2&limit=3","actorId=x","limit=Infinity"])expect((await s.call(`tickets/${id}/communication?${q}`)).status).toBe(400);
  expect((await s.call(`communication-summaries?ticketId=${id}`)).status).toBe(200);expect(s.communication.summaries).toHaveBeenCalledWith([id]);
  for(const p of ["communication-summaries?unitId=x","communication-summaries?ticketId=invalid",`communication-summaries?${Array(51).fill(`ticketId=${id}`).join("&")}`,"tickets?limit=50",`tickets/${id}/communication/requests/${key}?limit=1`])expect((await s.call(p)).status).toBe(400);
});
it("rejects private response fields and wrong Origin, preserving public DTO boundaries",async()=>{
  const s=setup();s.communication.read.mockResolvedValue({version:0,waitingFor:"NONE",readOnly:false,messages:[],nextBeforeSequence:null,internalNotes:[]} as never);
  const r=await s.call(`tickets/${id}/communication`);expect(r.status).toBe(503);expect(await r.text()).not.toContain("internalNotes");
  expect((await s.call(`tickets/${id}/communication/messages`,"POST",input,{Origin:"http://untrusted.invalid"})).status).toBe(403);
});
it("extends completion input with a nonnegative safe communication version only",()=>{
  const base={status:"COMPLETED",message:"합성 완료"};expect(CoreHandlingSchema.safeParse({...base,expectedCommunicationVersion:0}).success).toBe(true);
  for(const v of [-1,0.5,Number.MAX_SAFE_INTEGER+1])expect(CoreHandlingSchema.safeParse({...base,expectedCommunicationVersion:v}).success).toBe(false);
  expect(CoreHandlingSchema.safeParse({...base,actorId:randomUUID()}).success).toBe(false);
});

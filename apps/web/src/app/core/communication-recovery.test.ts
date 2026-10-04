import { expect,it } from "vitest";
import { saveCommunicationRecovery,readCommunicationRecovery,clearCommunicationRecovery } from "./communication-recovery";

function memoryStorage():Storage{const values=new Map<string,string>();return {get length(){return values.size;},clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}};}
const ticketId="12345678-1234-4234-8234-123456789abc",clientRequestId="23456789-1234-4234-8234-123456789abc";
const data={ticketId,clientRequestId,intent:"TENANT_MESSAGE" as const,expectedVersion:4};
it("stores exactly four recovery fields, excluding the send body and caller data",()=>{
  const s=memoryStorage();saveCommunicationRecovery({...data,body:"must stay in memory",actorId:"forbidden"} as typeof data,s);
  expect(JSON.parse(s.getItem(s.key(0)!)!)).toEqual(data);expect(readCommunicationRecovery(ticketId,s)).toEqual(data);
});
it("rejects foreign, malformed and body-bearing recovery metadata",()=>{
  const s=memoryStorage();for(const value of [{...data,ticketId:clientRequestId},{...data,body:"hidden"},{...data,expectedVersion:-1}]){s.setItem("core-communication-request:"+ticketId,JSON.stringify(value));expect(readCommunicationRecovery(ticketId,s)).toBeNull();expect(s.length).toBe(0);}
});
it("clears one success or every outstanding request on session, organization or logout boundaries",()=>{
  const s=memoryStorage();s.setItem("unrelated","keep");saveCommunicationRecovery(data,s);saveCommunicationRecovery({...data,ticketId:clientRequestId},s);
  clearCommunicationRecovery(ticketId,s);expect(readCommunicationRecovery(clientRequestId,s)).toBeTruthy();clearCommunicationRecovery(undefined,s);expect(s.length).toBe(1);expect(s.getItem("unrelated")).toBe("keep");
});

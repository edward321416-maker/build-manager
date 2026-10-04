import { expect,it } from "vitest";
import { saveOutcomeRecovery,readOutcomeRecoveries,clearOutcomeRecovery } from "./outcome-recovery";
function storage(){const map=new Map<string,string>();return {get length(){return map.size;},key:(i:number)=>[...map.keys()][i]??null,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);},clear:()=>map.clear()};}
const input={sourceTicketId:"11111111-1111-4111-8111-111111111111",clientRequestId:"22222222-2222-4222-8222-222222222222",claimKind:"UNRESOLVED" as const};
it("persists only three non-body fields and clears one or all requests",()=>{
 const s=storage();saveOutcomeRecovery({...input,rawUserText:"private draft",photos:["private"]} as typeof input,s);expect(readOutcomeRecoveries(s)).toEqual([input]);expect(s.getItem(s.key(0)!)).not.toMatch(/private|rawUserText|photos/);
 clearOutcomeRecovery(input.sourceTicketId,s);expect(readOutcomeRecoveries(s)).toEqual([]);saveOutcomeRecovery(input,s);clearOutcomeRecovery(undefined,s);expect(s.length).toBe(0);
});
it("rejects forged storage metadata and never reconstructs or submits a body",()=>{
 const s=storage();s.setItem("core-outcome-request:"+input.sourceTicketId,JSON.stringify({...input,rawUserText:"draft"}));expect(readOutcomeRecoveries(s)).toEqual([]);expect(s.length).toBe(0);
 expect(()=>saveOutcomeRecovery({...input,sourceTicketId:"invalid"},s)).toThrow();expect(readOutcomeRecoveries(s)).toEqual([]);
});
it("removes malformed metadata without hiding another valid recovery",()=>{
 const s=storage();saveOutcomeRecovery(input,s);s.setItem("core-outcome-request:broken","{");
 expect(readOutcomeRecoveries(s)).toEqual([input]);expect(s.length).toBe(1);
});

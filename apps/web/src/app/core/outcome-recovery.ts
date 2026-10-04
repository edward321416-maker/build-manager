import { z } from "zod";
const prefix="core-outcome-request:";
const metadata=z.object({sourceTicketId:z.string().uuid(),clientRequestId:z.string().uuid(),claimKind:z.enum(["RESOLVED","UNRESOLVED","RECURRENCE_CLAIM"])}).strict();
export type OutcomeRecovery=z.infer<typeof metadata>;
export const outcomeRecoveryEvent="core-outcome-recovery-changed";
function storage(){try{return typeof window==="undefined"?null:window.sessionStorage;}catch{return null;}}
function changed(){if(typeof window!=="undefined")window.dispatchEvent(new Event(outcomeRecoveryEvent));}
export function saveOutcomeRecovery(value:OutcomeRecovery,target=storage()){
 const safe=metadata.parse({sourceTicketId:value.sourceTicketId,clientRequestId:value.clientRequestId,claimKind:value.claimKind});
 try{target?.setItem(prefix+safe.sourceTicketId,JSON.stringify(safe));}catch{/* Memory still owns the draft; no body is persisted. */}changed();
}
export function readOutcomeRecoveries(target=storage()):OutcomeRecovery[]{
 const result:OutcomeRecovery[]=[];try{if(!target)return result;for(let i=target.length-1;i>=0;i--){const key=target.key(i);if(!key?.startsWith(prefix))continue;try{const parsed=metadata.safeParse(JSON.parse(target.getItem(key)??"null"));if(parsed.success&&key===prefix+parsed.data.sourceTicketId)result.push(parsed.data);else target.removeItem(key);}catch{target.removeItem(key);}}}catch{/* No corrupt draft is restored. */}return result.sort((a,b)=>a.sourceTicketId.localeCompare(b.sourceTicketId));
}
export function clearOutcomeRecovery(sourceTicketId?:string,target=storage()){
 try{if(sourceTicketId)target?.removeItem(prefix+sourceTicketId);else if(target)for(let i=target.length-1;i>=0;i--){const key=target.key(i);if(key?.startsWith(prefix))target.removeItem(key);}}catch{/* Unavailable browser storage. */}changed();
}

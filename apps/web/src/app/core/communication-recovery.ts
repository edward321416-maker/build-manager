import { CoreCommunicationIntentSchema } from "@build-manager/api-contracts";
import { z } from "zod";

const prefix="core-communication-request:";
const metadata=z.object({ticketId:z.string().uuid(),clientRequestId:z.string().uuid(),intent:CoreCommunicationIntentSchema,expectedVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)}).strict();
export type CommunicationRecovery=z.infer<typeof metadata>;
function storage(){try{return typeof window==="undefined"?null:window.sessionStorage;}catch{return null;}}
export function saveCommunicationRecovery(value:CommunicationRecovery,target=storage()){
  // Construct the whitelist, never serialize an input/send request object containing body.
  const safe=metadata.parse({ticketId:value.ticketId,clientRequestId:value.clientRequestId,intent:value.intent,expectedVersion:value.expectedVersion});
  try{target?.setItem(prefix+safe.ticketId,JSON.stringify(safe));}catch{/* Memory-only recovery remains available in the mounted conversation. */}
}
export function readCommunicationRecovery(ticketId:string,target=storage()):CommunicationRecovery|null{
  try{const raw=target?.getItem(prefix+ticketId);if(!raw)return null;const parsed=metadata.safeParse(JSON.parse(raw));if(parsed.success&&parsed.data.ticketId===ticketId)return parsed.data;target?.removeItem(prefix+ticketId);}catch{/* No unsafe or malformed data is restored. */}return null;
}
export function clearCommunicationRecovery(ticketId?:string,target=storage()){
  try{if(ticketId){target?.removeItem(prefix+ticketId);return;}if(!target)return;for(let i=target.length-1;i>=0;i--){const key=target.key(i);if(key?.startsWith(prefix))target.removeItem(key);}}catch{/* Storage may be disabled. */}
}

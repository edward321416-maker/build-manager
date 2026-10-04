import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreCreateFollowUp,CoreOutcomeReceipt } from "@build-manager/api-contracts";

export function createRequestFence(){
 let generation=0;
 return {read:()=>generation,invalidate:()=>{generation++;}};
}

// The caller retains this exact payload in memory while an answer is uncertain.
// A receipt read never turns a transport failure into a second request identity.
export async function sendFollowUp(client:CoreFlowClient,sourceId:string,input:CoreCreateFollowUp,retry:boolean){
 if(retry){
  let receipt:CoreOutcomeReceipt|null=null;
  try{receipt=await client.outcome.receipt(sourceId,input.clientRequestId);}
  catch(error){if(!(error instanceof ApiClientError&&error.status===404))throw error;}
  if(receipt){
   if(!receipt.targetTicketId)throw new Error("FOLLOW_UP_RECEIPT_REQUIRED");
   return await client.read(receipt.targetTicketId);
  }
 }
 return (await client.outcome.createFollowUp(sourceId,input)).ticket;
}

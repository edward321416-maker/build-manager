import { CoreTicketOutcomeSchema,CoreConfirmResolvedSchema,CoreCreateFollowUpSchema,CoreFollowUpResultSchema,CoreOutcomeReceiptSchema,CoreFollowUpSourceSchema,type CoreConfirmResolved,type CoreCreateFollowUp,type CoreTicketOutcome,type CoreFollowUpResultDto,type CoreOutcomeReceipt,type CoreFollowUpSource } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";
export function coreTicketOutcome(fetcher:FetchLike,baseUrl:string){
 const path=(id:string)=>`/api/v2/core/tickets/${encodeURIComponent(id)}`;
 return {
  read:(id:string)=>sendRequest<CoreTicketOutcome>(fetcher,baseUrl,{method:"GET",path:path(id)+"/outcome",schema:CoreTicketOutcomeSchema}),
  confirmResolved:(id:string,input:CoreConfirmResolved)=>sendRequest<CoreTicketOutcome>(fetcher,baseUrl,{method:"POST",path:path(id)+"/outcome/resolved",body:CoreConfirmResolvedSchema.parse(input),schema:CoreTicketOutcomeSchema}),
  createFollowUp:(id:string,input:CoreCreateFollowUp)=>sendRequest<CoreFollowUpResultDto>(fetcher,baseUrl,{method:"POST",path:path(id)+"/follow-up",body:CoreCreateFollowUpSchema.parse(input),schema:CoreFollowUpResultSchema}),
  receipt:(id:string,key:string)=>sendRequest<CoreOutcomeReceipt>(fetcher,baseUrl,{method:"GET",path:path(id)+"/outcome/requests/"+encodeURIComponent(key),schema:CoreOutcomeReceiptSchema}),
  source:(id:string)=>sendRequest<CoreFollowUpSource>(fetcher,baseUrl,{method:"GET",path:path(id)+"/follow-up",schema:CoreFollowUpSourceSchema}),
 };
}

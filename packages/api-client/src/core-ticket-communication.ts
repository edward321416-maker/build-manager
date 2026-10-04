import { CoreCommunicationPageSchema,CoreCommunicationSendSchema,CorePublicMessageSchema,CoreCommunicationSummariesSchema,type CoreCommunicationPage,type CoreCommunicationSend,type CorePublicMessage,type CoreCommunicationSummary } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";

export function coreTicketCommunication(fetcher:FetchLike,baseUrl:string){
  const path=(id:string)=>`/api/v2/core/tickets/${encodeURIComponent(id)}/communication`;
  return {
    read:(id:string,beforeSequence?:number,limit=50)=>sendRequest<CoreCommunicationPage>(fetcher,baseUrl,{method:"GET",path:path(id),query:{limit:String(limit),...(beforeSequence===undefined?{}:{beforeSequence:String(beforeSequence)})},schema:CoreCommunicationPageSchema}),
    send:(id:string,input:CoreCommunicationSend)=>sendRequest<CorePublicMessage>(fetcher,baseUrl,{method:"POST",path:path(id)+"/messages",body:CoreCommunicationSendSchema.parse(input),schema:CorePublicMessageSchema}),
    receipt:(id:string,key:string)=>sendRequest<CorePublicMessage>(fetcher,baseUrl,{method:"GET",path:path(id)+"/requests/"+encodeURIComponent(key),schema:CorePublicMessageSchema}),
    summaries:(ids:string[])=>sendRequest<CoreCommunicationSummary[]>(fetcher,baseUrl,{method:"GET",path:"/api/v2/core/communication-summaries"+(ids.length?"?"+ids.map(id=>"ticketId="+encodeURIComponent(id)).join("&"):""),schema:CoreCommunicationSummariesSchema}),
  };
}

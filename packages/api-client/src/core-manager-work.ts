import { CoreManagerWorkItemsSchema,CoreManagerWorkItemSchema,CoreManagerWorkUpdateSchema,CoreManagerInternalNotesSchema,CoreManagerInternalNoteSchema,CoreManagerInternalNoteCreateSchema,type CoreManagerWorkUpdate,type CoreManagerWorkItem,type CoreManagerInternalNote } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";

export function coreManagerWork(fetcher:FetchLike,baseUrl:string){
  const path=(id:string)=>`/api/v2/core/manager/tickets/${encodeURIComponent(id)}`;
  return {
    list:()=>sendRequest<CoreManagerWorkItem[]>(fetcher,baseUrl,{method:"GET",path:"/api/v2/core/manager/work-items",schema:CoreManagerWorkItemsSchema}),
    read:(id:string)=>sendRequest<CoreManagerWorkItem>(fetcher,baseUrl,{method:"GET",path:path(id)+"/work",schema:CoreManagerWorkItemSchema}),
    update:(id:string,input:CoreManagerWorkUpdate)=>sendRequest<CoreManagerWorkItem>(fetcher,baseUrl,{method:"POST",path:path(id)+"/work",body:CoreManagerWorkUpdateSchema.parse(input),schema:CoreManagerWorkItemSchema}),
    notes:(id:string)=>sendRequest<CoreManagerInternalNote[]>(fetcher,baseUrl,{method:"GET",path:path(id)+"/internal-notes",schema:CoreManagerInternalNotesSchema}),
    appendNote:(id:string,body:string)=>sendRequest<CoreManagerInternalNote>(fetcher,baseUrl,{method:"POST",path:path(id)+"/internal-notes",body:CoreManagerInternalNoteCreateSchema.parse({body}),schema:CoreManagerInternalNoteSchema}),
  };
}

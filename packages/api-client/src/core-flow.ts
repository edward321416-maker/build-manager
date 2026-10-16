import { CoreSessionSchema,CoreUnitsSchema,CoreTicketSchema,CoreTicketsSchema,CoreLoginSchema,CoreCreateSchema,CoreHandlingSchema,CorePhotoEvidenceRequestSchema,
  TenantTicketStatusDtoSchema,LandlordTicketDetailDtoSchema,type CoreCreateRequest,type CoreHandlingRequest,type CorePhotoEvidenceRequest,type CoreTicketDto,type CoreSessionDto,type CoreUnitDto } from "@build-manager/api-contracts";
import type { ApiClient } from "./client";
import { sendRequest,type FetchLike } from "./http";
import { corePhotos } from "./core-photos";
import { coreManagerWork } from "./core-manager-work";
import { coreTicketCommunication } from "./core-ticket-communication";
import { coreTicketOutcome } from "./core-ticket-outcome";
import { coreMaintenanceFact } from "./core-maintenance-fact";
import { coreVendorHandoff } from "./core-vendor-handoff";
import { coreBuildings } from "./core-building";

/** One contract for Web cookie and Expo bearer transport; no role parameter. */
export function createCoreFlowClient(options:{baseUrl:string;accessCode?:string;fetchImpl?:FetchLike;photoFetchImpl?:typeof fetch}) {
  const fetcher:FetchLike=(input,init)=> (options.fetchImpl??globalThis.fetch)(input,{
    ...init,headers:{...init?.headers,...(options.accessCode?{Authorization:`Bearer ${options.accessCode}`}:{})},
  });
  const path=(id:string)=>`/api/v2/core/tickets/${encodeURIComponent(id)}`;
  const read=(id:string)=>sendRequest<CoreTicketDto>(fetcher,options.baseUrl,{method:"GET",path:path(id),schema:CoreTicketSchema});
  const mutate=(id:string,suffix:string,body:unknown)=>sendRequest<CoreTicketDto>(fetcher,options.baseUrl,{method:"POST",path:path(id)+suffix,body,schema:CoreTicketSchema});
  const unsupported=async ():Promise<never>=>{throw new Error("RC1_UNSUPPORTED");};
  const protocol:ApiClient={
    listDemoBuildings:unsupported,resetDemo:unsupported,getBuilding:unsupported,verifyBuildingContext:unsupported,createTicket:unsupported,listTickets:unsupported,
    getTenantTicketStatus:async id=>TenantTicketStatusDtoSchema.parse((await read(id)).detail),
    getLandlordTicket:async id=>LandlordTicketDetailDtoSchema.parse((await read(id)).detail),
    submitAnswer:async (id,body)=>TenantTicketStatusDtoSchema.parse((await mutate(id,"/answers",body)).detail),
    submitEvidence:unsupported,
    finalizeTicket:async id=>TenantTicketStatusDtoSchema.parse((await mutate(id,"/finalize",{})).detail),
    approveRoute:async id=>LandlordTicketDetailDtoSchema.parse((await mutate(id,"/decision",{type:"APPROVE"})).detail),
    overrideRoute:async (id,input)=>LandlordTicketDetailDtoSchema.parse((await mutate(id,"/decision",{type:"OVERRIDE",...input})).detail),
    requestMoreInfo:async (id,input)=>LandlordTicketDetailDtoSchema.parse((await mutate(id,"/decision",{type:"REQUEST_MORE_INFO",...input})).detail),
  };
  return {
    protocol,read,...corePhotos(options),
    /** P1b: names one of the ticket's own photos as the evidence its protocol asks for. */
    submitPhotoEvidence:async (id:string,body:CorePhotoEvidenceRequest)=>TenantTicketStatusDtoSchema.parse((await mutate(id,"/evidence",CorePhotoEvidenceRequestSchema.parse(body))).detail),
    manager:coreManagerWork(fetcher,options.baseUrl),
    communication:coreTicketCommunication(fetcher,options.baseUrl),
    outcome:coreTicketOutcome(fetcher,options.baseUrl),
    maintenance:coreMaintenanceFact(fetcher,options.baseUrl),
    vendorHandoff:coreVendorHandoff(fetcher,options.baseUrl),
    buildings:coreBuildings(fetcher,options.baseUrl),
    session:()=>sendRequest<CoreSessionDto>(fetcher,options.baseUrl,{method:"GET",path:"/api/v2/core/session",schema:CoreSessionSchema}),
    login:(accessCode:string)=>sendRequest<CoreSessionDto>(fetcher,options.baseUrl,{method:"POST",path:"/api/v2/core/login",body:CoreLoginSchema.parse({accessCode}),schema:CoreSessionSchema}),
    logout:()=>sendRequest<CoreSessionDto>(fetcher,options.baseUrl,{method:"POST",path:"/api/v2/core/logout",body:{},schema:CoreSessionSchema}),
    units:()=>sendRequest<CoreUnitDto[]>(fetcher,options.baseUrl,{method:"GET",path:"/api/v2/core/units",schema:CoreUnitsSchema}),
    tickets:(unitId?:string)=>sendRequest<CoreTicketDto[]>(fetcher,options.baseUrl,{method:"GET",path:"/api/v2/core/tickets",query:unitId?{unitId}:undefined,schema:CoreTicketsSchema}),
    create:(input:CoreCreateRequest)=>sendRequest<CoreTicketDto>(fetcher,options.baseUrl,{method:"POST",path:"/api/v2/core/tickets",body:CoreCreateSchema.parse(input),schema:CoreTicketSchema}),
    handling:(id:string,input:CoreHandlingRequest)=>mutate(id,"/handling",CoreHandlingSchema.parse(input)),
  };
}
export type CoreFlowClient=ReturnType<typeof createCoreFlowClient>;

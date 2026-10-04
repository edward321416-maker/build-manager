import { CoreUnitMaintenanceFactsSchema,CoreMaintenanceFactDetailSchema,CoreUnitMaintenanceFactSchema,CoreMaintenanceFactCreateSchema,CoreMaintenanceFactCorrectionSchema,type CoreUnitMaintenanceFact,type CoreMaintenanceFactDetail,type CoreMaintenanceFactCreate,type CoreMaintenanceFactCorrection } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";
export function coreMaintenanceFact(fetcher:FetchLike,baseUrl:string){
 const root="/api/v2/core/manager",ticket=(id:string)=>root+`/tickets/${encodeURIComponent(id)}/maintenance-fact`;
 return {
  listUnit:(id:string)=>sendRequest<CoreUnitMaintenanceFact[]>(fetcher,baseUrl,{method:"GET",path:root+`/units/${encodeURIComponent(id)}/maintenance-timeline`,schema:CoreUnitMaintenanceFactsSchema}),
  readForTicket:(id:string)=>sendRequest<CoreMaintenanceFactDetail>(fetcher,baseUrl,{method:"GET",path:ticket(id),schema:CoreMaintenanceFactDetailSchema}),
  create:(id:string,input:CoreMaintenanceFactCreate)=>sendRequest<CoreUnitMaintenanceFact>(fetcher,baseUrl,{method:"POST",path:ticket(id),body:CoreMaintenanceFactCreateSchema.parse(input),schema:CoreUnitMaintenanceFactSchema}),
  correct:(id:string,input:CoreMaintenanceFactCorrection)=>sendRequest<CoreUnitMaintenanceFact>(fetcher,baseUrl,{method:"POST",path:root+`/maintenance-facts/${encodeURIComponent(id)}/corrections`,body:CoreMaintenanceFactCorrectionSchema.parse(input),schema:CoreUnitMaintenanceFactSchema}),
 };
}

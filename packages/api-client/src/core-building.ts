import { B1PropertySchema,B3PropertyCreateSchema,B3UnitCreateSchema,B3UnitSchema,CoreBuildingInfoSaveSchema,CoreBuildingInfoSchema,CoreBuildingListSchema,
  type B1Property,type B3Unit,type CoreBuildingInfoDto,type CoreBuildingInfoSave,type CoreBuildingListDto } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";

/** P6 + C1 step 2: the organisation admin's building screen. Building info goes through Core; creating a building or a
 * unit uses the existing B3 registration API unchanged (cookie session and x-b1-csrf, which the Web caller's fetch adds). */
export function coreBuildings(fetcher:FetchLike,baseUrl:string){
  const path=(id:string)=>`/api/v2/core/buildings/${encodeURIComponent(id)}`;
  const properties=(orgId:string)=>`/api/v2/organizations/${encodeURIComponent(orgId)}/properties`;
  return {
    list:()=>sendRequest<CoreBuildingListDto>(fetcher,baseUrl,{method:"GET",path:"/api/v2/core/buildings",schema:CoreBuildingListSchema}),
    read:(id:string)=>sendRequest<CoreBuildingInfoDto>(fetcher,baseUrl,{method:"GET",path:path(id),schema:CoreBuildingInfoSchema}),
    save:(id:string,input:CoreBuildingInfoSave)=>sendRequest<CoreBuildingInfoDto>(fetcher,baseUrl,{method:"POST",path:path(id),body:CoreBuildingInfoSaveSchema.parse(input),schema:CoreBuildingInfoSchema}),
    /** B3 keeps the name as the building's unverified reference; the screen then saves the same name as building info. */
    create:(orgId:string,name:string)=>sendRequest<B1Property>(fetcher,baseUrl,{method:"POST",path:properties(orgId),body:B3PropertyCreateSchema.parse({addressReference:name}),schema:B1PropertySchema}),
    addUnit:(orgId:string,buildingId:string,label:string)=>sendRequest<B3Unit>(fetcher,baseUrl,{method:"POST",path:`${properties(orgId)}/${encodeURIComponent(buildingId)}/units`,body:B3UnitCreateSchema.parse({label}),schema:B3UnitSchema}),
  };
}

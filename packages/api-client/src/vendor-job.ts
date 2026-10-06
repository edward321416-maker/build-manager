import {
  VendorDeclineCommandSchema,VendorJobDtoSchema,VendorLogoutCommandSchema,VendorLogoutResultDtoSchema,VendorRedeemCommandSchema,VendorRedeemResultDtoSchema,VendorSessionStateDtoSchema,
  type VendorDeclineCommand,type VendorJobDto,type VendorLogoutCommand,type VendorLogoutResultDto,type VendorRedeemCommand,type VendorRedeemResultDto,type VendorSessionStateDto,
} from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";

const root="/api/v2/vendor";
/** Adds request-scoped credentials without persisting them in the client. */
function withHeaders(fetcher:FetchLike,extra:Record<string,string>):FetchLike{
  return (input,init)=>fetcher(input,{...init,headers:{...(init?.headers??{}),...extra}});
}

/** Standalone no-account Vendor job client. The session cookie is HttpOnly; CSRF is held by the caller in memory. */
export function createVendorJobClient(fetcher:FetchLike,baseUrl=""){
  return {
    redeem:(token:string,input:VendorRedeemCommand)=>sendRequest<VendorRedeemResultDto>(withHeaders(fetcher,{Authorization:`VendorCapability ${token}`}),baseUrl,
      {method:"POST",path:`${root}/session/redeem`,body:VendorRedeemCommandSchema.parse(input),schema:VendorRedeemResultDtoSchema}),
    session:()=>sendRequest<VendorSessionStateDto>(fetcher,baseUrl,{method:"GET",path:`${root}/session`,schema:VendorSessionStateDtoSchema}),
    job:()=>sendRequest<VendorJobDto>(fetcher,baseUrl,{method:"GET",path:`${root}/job`,schema:VendorJobDtoSchema}),
    decline:(csrf:string,input:VendorDeclineCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/job/decline`,body:VendorDeclineCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    logout:(csrf:string,input:VendorLogoutCommand)=>sendRequest<VendorLogoutResultDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/session/logout`,body:VendorLogoutCommandSchema.parse(input),schema:VendorLogoutResultDtoSchema}),
    sourcePhotoPath:(photoId:string)=>`${baseUrl}${root}/job/source-photos/${encodeURIComponent(photoId)}`,
  };
}
export type VendorJobClient=ReturnType<typeof createVendorJobClient>;

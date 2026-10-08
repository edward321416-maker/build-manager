import {
  VendorAcceptCommandSchema,VendorBlockerCommandSchema,VendorCompletionPhotoDtoSchema,VendorCompletionPhotoUploadCommandSchema,VendorCompletionReportCommandSchema,VendorCompletionReportDtoSchema,VendorClearBlockerCommandSchema,VendorDeclineCommandSchema,VendorJobDtoSchema,VendorVisitStartCommandSchema,VendorWithdrawCommandSchema,VendorPreauthorizedAppointmentCommandSchema,VendorProposalCommandSchema,VendorRescheduleCommandSchema,VendorLogoutCommandSchema,VendorLogoutResultDtoSchema,VendorRedeemCommandSchema,VendorRedeemResultDtoSchema,VendorSessionStateDtoSchema,
  type VendorAcceptCommand,type VendorBlockerCommand,type VendorCompletionPhotoDto,type VendorCompletionPhotoUploadCommand,type VendorCompletionReportCommand,type VendorCompletionReportDto,type VendorClearBlockerCommand,type VendorDeclineCommand,type VendorVisitStartCommand,type VendorWithdrawCommand,type VendorPreauthorizedAppointmentCommand,type VendorProposalCommand,type VendorRescheduleCommand,type VendorJobDto,type VendorLogoutCommand,type VendorLogoutResultDto,type VendorRedeemCommand,type VendorRedeemResultDto,type VendorSessionStateDto,
} from "@build-manager/api-contracts";
import { ApiClientError } from "./errors";
import { sendRequest,type FetchLike } from "./http";

const root="/api/v2/vendor";
/** Adds request-scoped credentials without persisting them in the client. */
function withHeaders(fetcher:FetchLike,extra:Record<string,string>):FetchLike{
  return (input,init)=>fetcher(input,{...init,headers:{...(init?.headers??{}),...extra}});
}

/** Standalone no-account Vendor job client. The session cookie is HttpOnly; CSRF is held by the caller in memory. */
export function createVendorJobClient(fetcher:FetchLike,baseUrl="",binaryFetch:typeof fetch=(input,init)=>globalThis.fetch(input,init)){
  const base=baseUrl.replace(/\/$/,"");
  /** Binary upload stays outside the bounded JSON helper; the command travels in its own header beside the raw image. */
  const uploadCompletionPhoto=async(csrf:string,input:VendorCompletionPhotoUploadCommand,file:Blob):Promise<VendorCompletionPhotoDto>=>{
    const command=VendorCompletionPhotoUploadCommandSchema.parse(input);
    let response:Response;
    try{
      response=await binaryFetch(`${base}${root}/job/completion-photos`,{method:"POST",credentials:"same-origin",cache:"no-store",body:file,
        headers:{"Content-Type":file.type,"X-Upload-Id":command.clientRequestId,"X-Vendor-Upload-Command":JSON.stringify(command),"X-Vendor-CSRF":csrf}});
    }catch{throw new ApiClientError("NETWORK_ERROR","사진을 전송하지 못했습니다.");}
    if(!response.ok)throw new ApiClientError("PHOTO_ERROR","사진 요청을 처리하지 못했습니다.",{status:response.status});
    try{return VendorCompletionPhotoDtoSchema.parse(await response.json());}
    catch{throw new ApiClientError("INVALID_RESPONSE","사진 응답이 올바르지 않습니다.");}
  };
  return {
    redeem:(token:string,input:VendorRedeemCommand)=>sendRequest<VendorRedeemResultDto>(withHeaders(fetcher,{Authorization:`VendorCapability ${token}`}),baseUrl,
      {method:"POST",path:`${root}/session/redeem`,body:VendorRedeemCommandSchema.parse(input),schema:VendorRedeemResultDtoSchema}),
    session:()=>sendRequest<VendorSessionStateDto>(fetcher,baseUrl,{method:"GET",path:`${root}/session`,schema:VendorSessionStateDtoSchema}),
    job:()=>sendRequest<VendorJobDto>(fetcher,baseUrl,{method:"GET",path:`${root}/job`,schema:VendorJobDtoSchema}),
    decline:(csrf:string,input:VendorDeclineCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/job/decline`,body:VendorDeclineCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    accept:(csrf:string,input:VendorAcceptCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/job/accept`,body:VendorAcceptCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    withdraw:(csrf:string,input:VendorWithdrawCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/job/withdraw`,body:VendorWithdrawCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    proposeSlots:(csrf:string,input:VendorProposalCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/scheduling/proposals`,body:VendorProposalCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    selectPreauthorizedSlot:(csrf:string,input:VendorPreauthorizedAppointmentCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/scheduling/preauthorized-appointment`,body:VendorPreauthorizedAppointmentCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    reschedule:(csrf:string,input:VendorRescheduleCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/scheduling/reschedule`,body:VendorRescheduleCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    startVisit:(csrf:string,appointmentId:string,input:VendorVisitStartCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/appointments/${encodeURIComponent(appointmentId)}/visit-start`,body:VendorVisitStartCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    recordBlocker:(csrf:string,input:VendorBlockerCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/blockers`,body:VendorBlockerCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    clearBlocker:(csrf:string,blockerId:string,input:VendorClearBlockerCommand)=>sendRequest<VendorJobDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/blockers/${encodeURIComponent(blockerId)}/clear`,body:VendorClearBlockerCommandSchema.parse(input),schema:VendorJobDtoSchema}),
    logout:(csrf:string,input:VendorLogoutCommand)=>sendRequest<VendorLogoutResultDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/session/logout`,body:VendorLogoutCommandSchema.parse(input),schema:VendorLogoutResultDtoSchema}),
    sourcePhotoPath:(photoId:string)=>`${baseUrl}${root}/job/source-photos/${encodeURIComponent(photoId)}`,
    uploadCompletionPhoto,
    submitCompletionReport:(csrf:string,input:VendorCompletionReportCommand)=>sendRequest<VendorCompletionReportDto>(withHeaders(fetcher,{"X-Vendor-CSRF":csrf}),baseUrl,
      {method:"POST",path:`${root}/completion-reports`,body:VendorCompletionReportCommandSchema.parse(input),schema:VendorCompletionReportDtoSchema}),
    completionPhotoPath:(photoId:string)=>`${baseUrl}${root}/job/completion-photos/${encodeURIComponent(photoId)}`,
  };
}
export type VendorJobClient=ReturnType<typeof createVendorJobClient>;

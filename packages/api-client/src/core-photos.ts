import { CorePhotoSchema,CorePhotosSchema,type CorePhotoDto } from "@build-manager/api-contracts";
import { ApiClientError } from "./errors";

/** Binary transport is deliberately separate from the bounded JSON request helper. */
export function corePhotos(options:{baseUrl:string;accessCode?:string;photoFetchImpl?:typeof fetch}) {
  const path=(id:string)=>`/api/v2/core/tickets/${encodeURIComponent(id)}/photos`;
  const headers=():Record<string,string>=>options.accessCode?{Authorization:`Bearer ${options.accessCode}`}:{ };
  const request=async(url:string,init:RequestInit={})=>{
    let response:Response;
    const requestHeaders=new Headers(init.headers);for(const [key,value] of Object.entries(headers()))requestHeaders.set(key,value);
    try{response=await (options.photoFetchImpl??globalThis.fetch)(options.baseUrl.replace(/\/$/,"")+url,{...init,credentials:"same-origin",cache:"no-store",headers:requestHeaders});}
    catch{throw new ApiClientError("NETWORK_ERROR","사진 연결을 확인하지 못했습니다.");}
    if(!response.ok)throw new ApiClientError("PHOTO_ERROR","사진 요청을 처리하지 못했습니다.",{status:response.status});
    return response;
  };
  const decode=async<T>(response:Response,schema:{parse:(input:unknown)=>T}):Promise<T>=>{
    try{return schema.parse(await response.json());}catch{throw new ApiClientError("INVALID_RESPONSE","사진 응답이 올바르지 않습니다.");}
  };
  return {
    photos:async(id:string)=>decode(await request(path(id)),CorePhotosSchema),
    uploadPhoto:async(id:string,uploadId:string,file:Blob)=>decode(await request(path(id),{method:"POST",headers:{"Content-Type":file.type,"X-Upload-Id":uploadId},body:file}),CorePhotoSchema),
    readPhoto:async(photo:CorePhotoDto)=>{
      const safe=CorePhotoSchema.parse(photo),response=await request(safe.path);
      if(response.headers.get("content-type")!==safe.mime)throw new ApiClientError("INVALID_RESPONSE","사진 형식이 올바르지 않습니다.");
      const blob=await response.blob();
      if(blob.size!==safe.byteSize)throw new ApiClientError("INVALID_RESPONSE","사진 크기가 올바르지 않습니다.");
      return blob;
    },
    photoSource:(photo:CorePhotoDto)=>({uri:options.baseUrl.replace(/\/$/,"")+CorePhotoSchema.parse(photo).path,headers:headers(),cache:"reload" as const}),
  };
}

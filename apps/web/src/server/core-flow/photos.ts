import sharp from "sharp";
import { z } from "zod";
import { CorePhotoSchema,CorePhotosSchema,CORE_PHOTO_MAX_BYTES,CORE_PHOTO_MAX_PIXELS } from "@build-manager/api-contracts";
import { CoreFlowError,type CoreFlowPort,type CorePhoto,type CorePhotoInput } from "@build-manager/application";

export class PhotoRequestError extends Error {
  readonly status:number;
  constructor(status:400|413|415){super("PHOTO_INPUT_REJECTED");this.status=status;}
}
const uuid=z.string().uuid();
export function photoMetadata(ticketId:string,photo:CorePhoto){
  return CorePhotoSchema.parse({...photo,path:`/api/v2/core/tickets/${encodeURIComponent(ticketId)}/photos/${photo.photoId}`});
}

/** Count received bytes, regardless of an absent or dishonest Content-Length. */
export async function normalizePhoto(request:Request):Promise<Omit<CorePhotoInput,"uploadId">>{
  const mime=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="image/jpeg"&&mime!=="image/png")throw new PhotoRequestError(415);
  const reader=request.body?.getReader();if(!reader)throw new PhotoRequestError(400);
  let total=0;const chunks:Uint8Array[]=[];
  try{
    for(;;){const next=await reader.read();if(next.done)break;total+=next.value.byteLength;
      if(total>CORE_PHOTO_MAX_BYTES){await reader.cancel();throw new PhotoRequestError(413);}chunks.push(next.value);
    }
  }catch(error){if(error instanceof PhotoRequestError)throw error;throw new PhotoRequestError(400);}
  finally{reader.releaseLock();}
  if(!total)throw new PhotoRequestError(400);
  const input=Buffer.concat(chunks,total);
  const png=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=input[0]===255&&input[1]===216&&input[2]===255;
  if((mime==="image/png"&&!png)||(mime==="image/jpeg"&&!jpeg))throw new PhotoRequestError(415);
  try{
    const pipeline=sharp(input,{limitInputPixels:CORE_PHOTO_MAX_PIXELS,failOn:"warning"});
    const meta=await pipeline.metadata();
    if(meta.format!==(mime==="image/png"?"png":"jpeg")||(meta.pages??1)!==1)throw new PhotoRequestError(415);
    if(!meta.width||!meta.height)throw new PhotoRequestError(400);
    if(meta.width*meta.height>CORE_PHOTO_MAX_PIXELS)throw new PhotoRequestError(413);
    const normalized=pipeline.autoOrient().toColourspace("srgb").timeout({seconds:5});
    const {data,info}=await (mime==="image/png"?normalized.png():normalized.jpeg({quality:85})).toBuffer({resolveWithObject:true});
    if(data.byteLength>CORE_PHOTO_MAX_BYTES||info.width*info.height>CORE_PHOTO_MAX_PIXELS)throw new PhotoRequestError(413);
    return {mime,width:info.width,height:info.height,bytes:data};
  }catch(error){
    if(error instanceof PhotoRequestError)throw error;
    // Never expose codec errors, original bytes, metadata or filenames.
    if(error instanceof Error&&/pixel limit/i.test(error.message))throw new PhotoRequestError(413);
    throw new PhotoRequestError(400);
  }
}

export async function handlePhotoRequest(request:Request,segments:string[],hash:string,port:CoreFlowPort,headers:Headers):Promise<Response>{
  const ticketId=segments[1],photoId=segments[3];
  if(!uuid.safeParse(ticketId).success||(photoId&&!uuid.safeParse(photoId).success))throw new CoreFlowError("INVALID_INPUT");
  if(request.method==="GET"&&segments.length===3){
    const photos=await port.run(hash,s=>s.photos(ticketId));
    return Response.json(CorePhotosSchema.parse(photos.map(p=>photoMetadata(ticketId,p))),{headers});
  }
  if(request.method==="GET"&&segments.length===4){
    const {photo,bytes}=await port.run(hash,s=>s.photo(ticketId,photoId));
    photoMetadata(ticketId,photo);
    headers.set("Content-Type",photo.mime);headers.set("Content-Length",String(bytes.byteLength));
    headers.set("Content-Disposition",`inline; filename="photo.${photo.mime==="image/png"?"png":"jpg"}"`);
    return new Response(new Uint8Array(bytes).buffer,{headers});
  }
  if(request.method==="POST"&&segments.length===3){
    const upload=uuid.safeParse(request.headers.get("x-upload-id"));if(!upload.success)throw new PhotoRequestError(400);
    // Preflight transaction finishes BEFORE reading/decoding any image.
    await port.run(hash,s=>s.checkPhotoWrite(ticketId));
    const image=await normalizePhoto(request);
    const result=await port.run(hash,s=>s.savePhoto(ticketId,{...image,uploadId:upload.data}));
    return Response.json(photoMetadata(ticketId,result.photo),{status:result.created?201:200,headers});
  }
  throw new CoreFlowError("NOT_FOUND");
}

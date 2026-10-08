import { createHash } from "node:crypto";
import { CORE_PHOTO_MAX_BYTES,CORE_PHOTO_MAX_PIXELS,VendorCompletionPhotoUploadCommandSchema } from "@build-manager/api-contracts";
import { VendorHandoffError,type SanitizedVendorPhoto,type VendorCompletionPhotoUploadCommand } from "@build-manager/application";
import { normalizePhoto } from "../core-flow/photos";

/** The strict upload command travels beside the raw image body; it is never derived from photo metadata. */
export const VENDOR_UPLOAD_COMMAND_HEADER="x-vendor-upload-command";

/** Parsed before the body is read: strict command, and X-Upload-Id must equal its clientRequestId. */
export function readVendorUploadCommand(request:Request):VendorCompletionPhotoUploadCommand{
  const raw=request.headers.get(VENDOR_UPLOAD_COMMAND_HEADER);
  if(!raw||raw.length>2048)throw new VendorHandoffError("INVALID_INPUT");
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new VendorHandoffError("INVALID_INPUT");}
  const parsed=VendorCompletionPhotoUploadCommandSchema.safeParse(value);
  if(!parsed.success||request.headers.get("x-upload-id")!==parsed.data.clientRequestId)throw new VendorHandoffError("INVALID_INPUT");
  return parsed.data;
}

/**
 * Decodes and re-encodes with the accepted Core sanitizer (EXIF/GPS/XMP/ICC dropped, orientation applied to pixels),
 * bounds the output again and hashes the sanitized bytes; the hash is part of the replay fingerprint.
 * Rejected input throws the Core PhotoRequestError (400/413/415) before any persistence.
 */
export async function sanitizeVendorPhoto(request:Request):Promise<SanitizedVendorPhoto>{
  const out=await normalizePhoto(request);
  const bytes=new Uint8Array(out.bytes);
  if(!Number.isInteger(out.width)||!Number.isInteger(out.height)||out.width<1||out.height<1||out.width*out.height>CORE_PHOTO_MAX_PIXELS
    ||bytes.byteLength<1||bytes.byteLength>CORE_PHOTO_MAX_BYTES)throw new VendorHandoffError("INVALID_INPUT");
  return {bytes,mime:out.mime,byteSize:bytes.byteLength,width:out.width,height:out.height,sha256:createHash("sha256").update(bytes).digest("hex")};
}

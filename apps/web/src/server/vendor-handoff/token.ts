import { createHash,randomBytes } from "node:crypto";
import { VendorHandoffError } from "@build-manager/application";

export const VENDOR_SESSION_COOKIE="vendor_session";
const COOKIE_PATH="/api/v2/vendor";
const MAX_SESSION_SECONDS=7*86_400;
const RAW=/^[A-Za-z0-9_-]{43}$/;

/** Transient raw value plus the only form persistence ever receives. Raw bytes never leave this request. */
export type VendorSecret={readonly raw:string;readonly digest:string};

function digestOf(raw:string):string{return createHash("sha256").update(raw).digest("hex");}
function wellFormed(raw:string):boolean{return RAW.test(raw)&&Buffer.from(raw,"base64url").byteLength===32;}

export function createVendorSecret():VendorSecret{
  const raw=randomBytes(32).toString("base64url");
  return {raw,digest:digestOf(raw)};
}
/** Same SHA-256 scheme the Manager link issuer stores; errors never carry the presented value. */
export function vendorSecretDigest(raw:string):string{
  if(!wellFormed(raw))throw new VendorHandoffError("UNAUTHENTICATED");
  return digestOf(raw);
}
export function readVendorSessionCookie(header:string|null):string|null{
  if(!header)return null;
  const values=header.split(";").map(part=>part.trim()).filter(part=>part.startsWith(`${VENDOR_SESSION_COOKIE}=`)).map(part=>part.slice(VENDOR_SESSION_COOKIE.length+1));
  if(values.length!==1||!wellFormed(values[0]))return null;
  return values[0];
}
function attributes(maxAge:number,secure:boolean):string{
  return `HttpOnly; SameSite=Strict; Path=${COOKIE_PATH}; Max-Age=${maxAge}${secure?"; Secure":""}`;
}
export function vendorSessionCookie(raw:string,expiresAt:string,now:Date,secure:boolean):string{
  const expiry=Date.parse(expiresAt);
  if(!wellFormed(raw)||!Number.isFinite(expiry))throw new VendorHandoffError("DEPENDENCY_UNAVAILABLE");
  const maxAge=Math.min(MAX_SESSION_SECONDS,Math.max(0,Math.floor((expiry-now.getTime())/1000)));
  return `${VENDOR_SESSION_COOKIE}=${raw}; ${attributes(maxAge,secure)}`;
}
export function clearVendorSessionCookie(secure:boolean):string{
  return `${VENDOR_SESSION_COOKIE}=; ${attributes(0,secure)}`;
}
export function capabilityFromAuthorization(header:string|null):string|null{
  const match=/^VendorCapability ([A-Za-z0-9_-]+)$/.exec(header??"");
  return match&&wellFormed(match[1])?match[1]:null;
}

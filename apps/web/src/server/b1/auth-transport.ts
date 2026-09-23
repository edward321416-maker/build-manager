import type { SessionData } from "@auth0/nextjs-auth0/types";
import { randomBytes } from "node:crypto";
export type TransportMaterial=Readonly<{handle:string;csrf:string;issuedAt:number;expiresAt:number}>;
export function transportMaterial(value:unknown):TransportMaterial|null {
  if(!value || typeof value!=="object") return null;
  const v=value as Record<string,unknown>;
  if(typeof v.handle!=="string" || !/^[a-f0-9]{64}$/.test(v.handle) || typeof v.csrf!=="string" || !/^[a-f0-9]{64}$/.test(v.csrf) || typeof v.issuedAt!=="number" || !Number.isSafeInteger(v.issuedAt) || typeof v.expiresAt!=="number" || v.expiresAt!==v.issuedAt+3600) return null;
  return {handle:v.handle,csrf:v.csrf,issuedAt:v.issuedAt,expiresAt:v.expiresAt};
}
export function prepareTransportSession(session:SessionData,idToken:string|null):SessionData {
  if(!session.user.sub.startsWith("auth0|") || session.user.sub.length>255) throw new Error("AUTHENTICATION_REJECTED");
  if(idToken===null){if(!transportMaterial(session.b1)) throw new Error("AUTHENTICATION_REJECTED");return session;}
  const issuedAt=Math.floor(Date.now()/1000);
  return {...session,b1:{handle:randomBytes(32).toString("hex"),csrf:randomBytes(32).toString("hex"),issuedAt,expiresAt:issuedAt+3600}};
}
export function authRequestStatus(path:string,method:string,query:URLSearchParams):number|null {
  if(!path.startsWith('/auth/')) return null;
  if(path==='/auth/logout') return 405;
  if(!['/auth/login','/auth/callback'].includes(path)) return 404;
  if(method!=='GET') return 405;
  if(path==='/auth/login' && query.size) return 400;
  return null;
}

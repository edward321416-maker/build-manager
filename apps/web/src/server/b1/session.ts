import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B1Error,type IdentitySessionPort } from "@build-manager/application";
import { createHash } from "node:crypto";
import { transportMaterial } from "./auth-transport";
export function sessionDigest(handle:string){return createHash('sha256').update(handle).digest('hex');}
export async function requireCurrentSession(session:SessionData|null,registry:Omit<IdentitySessionPort,"begin">){
 const material=transportMaterial(session?.b1),now=Math.floor(Date.now()/1000);
 if(!session || !material || material.issuedAt>now || material.expiresAt<=now)throw new B1Error('UNAUTHENTICATED');
 const digest=sessionDigest(material.handle),actor=await registry.currentActor(digest);
 if(!actor)throw new B1Error('UNAUTHENTICATED');
 return {actor,digest,csrf:material.csrf};
}

import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B1Error,beginWebSession,type IdentitySessionPort } from "@build-manager/application";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createIdentityBootstrapPort } from "@build-manager/persistence-postgres/b1";
import { transportMaterial } from "./auth-transport";
import { sessionDigest } from "./session";
export async function completeTransportSession(session:SessionData|null,issuer:string,bootstrap:Pick<IdentitySessionPort,"begin">){
 const material=transportMaterial(session?.b1),now=Math.floor(Date.now()/1000);
 if(!session || !session.user.sub.startsWith('auth0|') || !material || material.issuedAt>now || now-material.issuedAt>60 || material.expiresAt<=now)throw new B1Error('AUTHENTICATION_REJECTED');
 await beginWebSession(bootstrap,{identity:{issuer,subject:session.user.sub},digest:sessionDigest(material.handle),expiresAt:new Date(material.expiresAt*1000)});
}
let bootstrap:Pick<IdentitySessionPort,'begin'>|undefined;
/** API completion alone owns the login capability; never imported by proxy/business container. */
export function getBootstrapPort(){
 if(!bootstrap){
  const connectionString=process.env.B1_LOGIN_DATABASE_URL;
  if(!connectionString)throw new B1Error('DEPENDENCY_UNAVAILABLE');
  bootstrap=createIdentityBootstrapPort(createPostgresDatabase({connectionString,max:3,connectionTimeoutMillis:5000}));
 }
 return bootstrap;
}

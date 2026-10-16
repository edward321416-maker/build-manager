import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { CoreFlowError,type IdentitySessionPort } from "@build-manager/application";
import { requireCurrentSession } from "../b1/session";
import { getB1Container } from "../b1/container";
import { isDemoEntrySession } from "../b1/demo-entry-config";

type Dependencies={readSession(request:NextRequest):Promise<SessionData|null>;sessions:Omit<IdentitySessionPort,"begin">;appBaseUrl:string};
/** Consume the frozen B1 boundary. Developer credentials are never considered. */
export async function requireCoreB1Session(request:Request,d:Dependencies=getB1Container()){
 // Copy only authentication headers: constructing Request from Request transfers
 // its body stream, preventing the existing bounded JSON/binary reader from using it.
 const sessionData=await d.readSession(new NextRequest(request.url,{headers:request.headers}));
 const current=await requireCurrentSession(sessionData,d.sessions);
 if(request.method!=="GET"||request.headers.has("x-core-organization")){
  const csrf=request.headers.get("x-b1-csrf");
  if((request.method!=="GET"&&request.headers.get("origin")!==d.appBaseUrl) || !csrf || !/^[a-f0-9]{64}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf),Buffer.from(current.csrf)))throw new CoreFlowError("FORBIDDEN");
 }
 // The shared login-free demo may read but not write building info (P6 D4); routes decide what that refuses.
 return {...current,demo:isDemoEntrySession(sessionData)};
}

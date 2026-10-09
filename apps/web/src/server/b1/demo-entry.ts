import type { SessionData } from "@auth0/nextjs-auth0/types";
// Deliberate, architecture-test-pinned exception (operator decision 2026-10-09): the SDK's public session
// cookie sealing helper, used only here and only while the synthetic provider is configured.
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import type { IdentitySessionPort } from "@build-manager/application";
import { NextResponse } from "next/server";
import { randomBytes,randomUUID } from "node:crypto";
import { completeTransportSession,getBootstrapPort } from "./complete-session";
import { DEMO_ROLES,readDemoEntryConfig,type DemoEntryConfig,type DemoRole } from "./demo-entry-config";
import { privateHeaders,toB1ErrorResponse } from "./errors";
export { readDemoEntryConfig } from "./demo-entry-config";

/**
 * Login-free demo entry: a visitor picks a role and receives the same transport session a provider callback
 * would create, for the configured synthetic subject; the existing callback completion then begins the
 * database session. Like the completion route, this route owns a login capability.
 */
async function readRole(request:Request):Promise<DemoRole|null>{
  if(!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))return null;
  const body=await request.text();if(body.length>32)return null;
  const form=new URLSearchParams(body),role=form.get("role");
  return form.size===1&&DEMO_ROLES.includes(role as DemoRole)?role as DemoRole:null;
}

export async function executeDemoEntry(request:Request,demo:DemoEntryConfig|null,bootstrap:Pick<IdentitySessionPort,"begin">,seal:(session:SessionData)=>Promise<string>):Promise<NextResponse>{
  if(!demo)return NextResponse.json({error:"NOT_FOUND"},{status:404,headers:privateHeaders});
  if(request.method!=="POST")return NextResponse.json({error:"METHOD_NOT_ALLOWED"},{status:405,headers:privateHeaders});
  if(request.headers.get("origin")!==demo.auth.appBaseUrl)return NextResponse.json({error:"FORBIDDEN"},{status:403,headers:privateHeaders});
  try{
    const role=await readRole(request);
    if(!role)return NextResponse.json({error:"INVALID_INPUT"},{status:400,headers:privateHeaders});
    const issuedAt=Math.floor(Date.now()/1000),expiresAt=issuedAt+3600;
    const session:SessionData={user:{sub:demo.subjects[role]},tokenSet:{accessToken:randomBytes(32).toString("hex"),expiresAt},internal:{sid:randomUUID(),createdAt:issuedAt},
      b1:{handle:randomBytes(32).toString("hex"),csrf:randomBytes(32).toString("hex"),issuedAt,expiresAt}};
    // Same database session bootstrap as provider callback completion; no cookie unless it succeeds.
    await completeTransportSession(session,demo.auth.issuer,bootstrap);
    const response=NextResponse.redirect(new URL("/core",demo.auth.appBaseUrl),{status:303,headers:privateHeaders});
    response.cookies.set("__session",await seal(session),{httpOnly:true,sameSite:"lax",path:"/",secure:demo.auth.appBaseUrl.startsWith("https:"),maxAge:3600});
    return response;
  }catch(error){return toB1ErrorResponse(error);}
}

export async function handleDemoEntry(request:Request){
  const demo=readDemoEntryConfig();
  if(!demo)return executeDemoEntry(request,null,{begin:async()=>{throw new Error("DEMO_ENTRY_DISABLED");}},async()=>"");
  try{return await executeDemoEntry(request,demo,getBootstrapPort(),session=>generateSessionCookie(session,{secret:demo.auth.secret}));}
  catch(error){return toB1ErrorResponse(error);}
}

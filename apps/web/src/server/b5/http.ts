import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B5Error, endOrganizationMembership, type B5Dependencies } from "@build-manager/application";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { privateHeaders } from "../b1/errors";
import { requireCurrentSession } from "../b1/session";
import { toB5ErrorResponse } from "./errors";
import { assertB5EmptyBody } from "./request";
export type B5HTTPDependencies = B5Dependencies & {
  readSession(request: NextRequest): Promise<SessionData | null>;
  appBaseUrl: string;
};
export async function handleB5Http(request: NextRequest, params: Record<string,string>, dependencies: () => B5HTTPDependencies): Promise<NextResponse> {
  try {
    if(request.method!=="DELETE") throw new B5Error("METHOD_NOT_ALLOWED");
    const d=dependencies();
    if(request.headers.get("origin")!==d.appBaseUrl) throw new B5Error("FORBIDDEN");
    const current=await requireCurrentSession(await d.readSession(request),d.sessions);
    const csrf=request.headers.get("x-b1-csrf");
    if(!csrf || !/^[a-f0-9]{64}$/.test(csrf) || !/^[a-f0-9]{64}$/.test(current.csrf)
      || !timingSafeEqual(Buffer.from(csrf,"hex"),Buffer.from(current.csrf,"hex"))) throw new B5Error("FORBIDDEN");
    if(request.nextUrl.searchParams.size) throw new B5Error("INVALID_INPUT");
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if(!uuid.test(params.orgId??"")||!uuid.test(params.membershipId??"")) throw new B5Error("INVALID_INPUT");
    await assertB5EmptyBody(request);
    await endOrganizationMembership(d,current.digest,params.orgId,params.membershipId);
    return new NextResponse(null,{status:204,headers:privateHeaders});
  } catch(error) {return toB5ErrorResponse(error);}
}

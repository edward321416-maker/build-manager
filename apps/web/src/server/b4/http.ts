import type { SessionData } from "@auth0/nextjs-auth0/types";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { B4Error,getPropertyStaffAssignment,ensurePropertyStaffAssignment,endPropertyStaffAssignment,type B4Dependencies } from "@build-manager/application";
import { privateHeaders } from "../b1/errors";
import { requireCurrentSession } from "../b1/session";
import { toB4ErrorResponse } from "./errors";
import { assertB4EmptyBody } from "./request";

export type B4HTTPDependencies = B4Dependencies & {
  readSession(request: NextRequest): Promise<SessionData | null>;
  appBaseUrl: string;
};
function assertInput(request: NextRequest,params: Record<string,string>): void {
  if (request.nextUrl.searchParams.size) throw new B4Error("INVALID_INPUT");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  for (const key of ["orgId","propertyId","membershipId"]) {
    if (!uuid.test(params[key] ?? "")) throw new B4Error("INVALID_INPUT");
  }
}
function csrf(submitted: string | null,expected: string): void {
  if (!submitted || !/^[a-f0-9]{64}$/.test(submitted) || !/^[a-f0-9]{64}$/.test(expected)) throw new B4Error("FORBIDDEN");
  const left = Buffer.from(submitted,"hex"),right = Buffer.from(expected,"hex");
  if (left.length !== right.length || !timingSafeEqual(left,right)) throw new B4Error("FORBIDDEN");
}
export async function handleB4Http(request: NextRequest,params: Record<string,string>,dependencies: () => B4HTTPDependencies): Promise<NextResponse> {
  try {
    if (!["GET","PUT","DELETE"].includes(request.method)) throw new B4Error("METHOD_NOT_ALLOWED");
    const d = dependencies();
    const mutation = request.method !== "GET";
    if (mutation && request.headers.get("origin") !== d.appBaseUrl) throw new B4Error("FORBIDDEN");
    if (!mutation) assertInput(request,params);
    const current = await requireCurrentSession(await d.readSession(request),d.sessions);
    if (mutation) {
      csrf(request.headers.get("x-b1-csrf"),current.csrf);
      assertInput(request,params);
      await assertB4EmptyBody(request);
    }
    const args = [d,current.digest,params.orgId,params.propertyId,params.membershipId] as const;
    if (request.method === "GET") {
      const value = await getPropertyStaffAssignment(...args);
      return NextResponse.json({ assigned: value.assigned },{ headers: privateHeaders });
    }
    if (request.method === "PUT") {
      const value = await ensurePropertyStaffAssignment(...args);
      return NextResponse.json({ assigned: value.assigned },{ status: value.created ? 201 : 200,
        headers: { ...privateHeaders,...(value.created ? {
          Location: `/api/v2/organizations/${params.orgId}/properties/${params.propertyId}/staff-assignments/${params.membershipId}`,
        } : {}) } });
    }
    await endPropertyStaffAssignment(...args);
    return new NextResponse(null,{ status: 204,headers: privateHeaders });
  } catch (error) { return toB4ErrorResponse(error); }
}

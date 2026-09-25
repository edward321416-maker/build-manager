import type { SessionData } from "@auth0/nextjs-auth0/types";
import {
  B1Error,
  B3Error,
  canCreateOrganizationProperty,
  canCreatePropertyUnit,
  createOrganizationProperty,
  createPropertyUnit,
  getOrganizationProperty,
  getPropertyUnit,
  listOrganizationProperties,
  listPropertyUnits,
  type B1ReadDependencies,
  type B3Dependencies,
} from "@build-manager/application";
import {
  B1PageQuerySchema,
  B3PropertyCreateSchema,
  B3UnitCreateSchema,
} from "@build-manager/api-contracts";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { privateHeaders } from "../b1/errors";
import { requireCurrentSession } from "../b1/session";
import { toB3ErrorResponse } from "./errors";
import { readB3Json } from "./request";

export type B3HTTPDependencies = B1ReadDependencies & B3Dependencies & {
  readSession(request: NextRequest): Promise<SessionData | null>;
  appBaseUrl: string;
};

export type B3HTTPKind = "properties" | "property" | "units" | "unit";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function assertIds(kind: B3HTTPKind, params: Record<string, string>): void {
  if (!uuid.test(params.orgId ?? "")) throw new B3Error("INVALID_INPUT");
  if ((kind === "property" || kind === "units" || kind === "unit") && !uuid.test(params.propertyId ?? "")) {
    throw new B3Error("INVALID_INPUT");
  }
  if (kind === "unit" && !uuid.test(params.unitId ?? "")) throw new B3Error("INVALID_INPUT");
}

function pageQuery(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if ([...query.keys()].some(key => query.getAll(key).length !== 1)) throw new B3Error("INVALID_INPUT");
  const parsed = B1PageQuerySchema.safeParse(Object.fromEntries(query));
  if (!parsed.success) throw new B3Error("INVALID_INPUT");
  return parsed.data;
}

function noQuery(request: NextRequest): void {
  if (request.nextUrl.searchParams.size !== 0) throw new B3Error("INVALID_INPUT");
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { ...privateHeaders, ...extra };
}

function csrf(submitted: string | null, expected: string): void {
  if (!submitted || !/^[a-f0-9]{64}$/.test(submitted) || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new B3Error("FORBIDDEN");
  }
  const left = Buffer.from(submitted, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new B3Error("FORBIDDEN");
}

function supported(kind: B3HTTPKind, method: string): boolean {
  return (kind === "properties" || kind === "units") ? method === "GET" || method === "POST" : method === "GET";
}

export async function handleB3Http(
  request: NextRequest,
  kind: B3HTTPKind,
  params: Record<string, string>,
  dependencies: () => B3HTTPDependencies,
): Promise<NextResponse> {
  try {
    if (!supported(kind, request.method)) throw new B3Error("METHOD_NOT_ALLOWED");
    const d = dependencies();

    if (request.method === "POST" && request.headers.get("origin") !== d.appBaseUrl) {
      throw new B3Error("FORBIDDEN");
    }

    if (request.method === "GET") {
      if (kind === "properties" || kind === "units") pageQuery(request);
      else noQuery(request);
      assertIds(kind, params);
    }

    const current = await requireCurrentSession(await d.readSession(request), d.sessions);

    if (request.method === "POST") {
      csrf(request.headers.get("x-b1-csrf"), current.csrf);
      noQuery(request);
      assertIds(kind, params);
      const body = await readB3Json(request);
      if (kind === "properties") {
        const parsed = B3PropertyCreateSchema.safeParse(body);
        if (!parsed.success) throw new B3Error("INVALID_INPUT");
        const value = await createOrganizationProperty(d, current.digest, params.orgId, parsed.data);
        return NextResponse.json(value, {
          status: 201,
          headers: headers({ Location: `/api/v2/organizations/${params.orgId}/properties/${value.id}` }),
        });
      }
      if (kind === "units") {
        const parsed = B3UnitCreateSchema.safeParse(body);
        if (!parsed.success) throw new B3Error("INVALID_INPUT");
        const value = await createPropertyUnit(d, current.digest, params.orgId, params.propertyId, parsed.data);
        return NextResponse.json(value, {
          status: 201,
          headers: headers({
            Location: `/api/v2/organizations/${params.orgId}/properties/${params.propertyId}/units/${value.id}`,
          }),
        });
      }
      throw new B3Error("METHOD_NOT_ALLOWED");
    }

    if (kind === "properties") {
      const value = await listOrganizationProperties(d, current.digest, params.orgId, pageQuery(request));
      const allowed = await canCreateOrganizationProperty(d, current.digest, params.orgId);
      return NextResponse.json(value, {
        headers: headers({ "X-B3-Can-Create-Property": allowed ? "true" : "false" }),
      });
    }
    if (kind === "property") {
      const value = await getOrganizationProperty(d, current.digest, params.orgId, params.propertyId);
      const allowed = await canCreatePropertyUnit(d, current.digest, params.orgId, params.propertyId);
      return NextResponse.json(value, {
        headers: headers({ "X-B3-Can-Create-Unit": allowed ? "true" : "false" }),
      });
    }
    if (kind === "units") {
      const value = await listPropertyUnits(d, current.digest, params.orgId, params.propertyId, pageQuery(request));
      const allowed = await canCreatePropertyUnit(d, current.digest, params.orgId, params.propertyId);
      return NextResponse.json(value, {
        headers: headers({ "X-B3-Can-Create-Unit": allowed ? "true" : "false" }),
      });
    }
    return NextResponse.json(
      await getPropertyUnit(d, current.digest, params.orgId, params.propertyId, params.unitId),
      { headers: privateHeaders },
    );
  } catch (error) {
    return toB3ErrorResponse(error);
  }
}

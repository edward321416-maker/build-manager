import { randomBytes } from "node:crypto";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B1Error, B3Error } from "@build-manager/application";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { handleB3Http, type B3HTTPDependencies, type B3HTTPKind } from "./http";

const base = "http://localhost:3124";
const org = "00000000-0000-4000-8000-000000000001";
const property = "00000000-0000-4000-8000-000000000002";
const unit = "00000000-0000-4000-8000-000000000003";

function fixture() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const csrf = randomBytes(32).toString("hex");
  const session: SessionData = {
    user: { sub: "auth0|synthetic" },
    tokenSet: { accessToken: "synthetic", expiresAt: issuedAt + 3600 },
    internal: { sid: "synthetic", createdAt: issuedAt },
    b1: { handle: randomBytes(32).toString("hex"), csrf, issuedAt, expiresAt: issuedAt + 3600 },
  };
  const d = {
    appBaseUrl: base,
    readSession: vi.fn().mockResolvedValue(session),
    sessions: {
      currentActor: vi.fn().mockResolvedValue({ userId: "synthetic" }),
      revoke: vi.fn(),
    },
    organizations: {
      listMine: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      listProperties: vi.fn().mockResolvedValue({
        items: [{ id: property, orgId: org, addressReference: "synthetic-reference" }],
        nextCursor: null,
      }),
      getProperty: vi.fn().mockResolvedValue({ id: property, orgId: org, addressReference: "synthetic-reference" }),
    },
    registration: {
      createProperty: vi.fn().mockResolvedValue({ id: property, orgId: org, addressReference: "synthetic-reference" }),
      createUnit: vi.fn().mockResolvedValue({ id: unit, orgId: org, propertyId: property, label: "Synthetic 101" }),
      canCreateProperty: vi.fn().mockResolvedValue(true),
      canCreateUnit: vi.fn().mockResolvedValue(true),
    },
    units: {
      listUnits: vi.fn().mockResolvedValue({
        items: [{ id: unit, orgId: org, propertyId: property, label: "Synthetic 101" }],
        nextCursor: null,
      }),
      getUnit: vi.fn().mockResolvedValue({ id: unit, orgId: org, propertyId: property, label: "Synthetic 101" }),
    },
  } satisfies B3HTTPDependencies;
  return { d, session, csrf };
}

function url(kind: B3HTTPKind, query = "") {
  const path = kind === "properties"
    ? `/api/v2/organizations/${org}/properties`
    : kind === "property"
      ? `/api/v2/organizations/${org}/properties/${property}`
      : kind === "units"
        ? `/api/v2/organizations/${org}/properties/${property}/units`
        : `/api/v2/organizations/${org}/properties/${property}/units/${unit}`;
  return base + path + query;
}

function params(kind: B3HTTPKind, override: Partial<Record<"orgId" | "propertyId" | "unitId", string>> = {}) {
  return {
    orgId: org,
    ...(kind !== "properties" ? { propertyId: property } : {}),
    ...(kind === "unit" ? { unitId: unit } : {}),
    ...override,
  } as Record<string, string>;
}

function request(
  kind: B3HTTPKind,
  init: ConstructorParameters<typeof NextRequest>[1] = {},
  query = "",
) {
  return new NextRequest(url(kind, query), init);
}

function postHeaders(csrf: string, extra: Record<string, string> = {}) {
  return { origin: base, "x-b1-csrf": csrf, "content-type": "application/json", ...extra };
}

async function call(
  f: ReturnType<typeof fixture>,
  kind: B3HTTPKind,
  req: NextRequest,
  override = params(kind),
) {
  return handleB3Http(req, kind, override, () => f.d);
}

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("vary")).toBe("Cookie");
}

describe("B3 HTTP boundary", () => {
  it.each([
    ["property", "POST"],
    ["unit", "DELETE"],
    ["properties", "PATCH"],
    ["units", "PUT"],
  ] as const)("AC14 unsupported %s %s is 405 before dependencies", async (kind, method) => {
    const f = fixture();
    const response = await call(f, kind, request(kind, { method }));
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "METHOD_NOT_ALLOWED" });
    expect(f.d.readSession).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it.each([undefined, "http://foreign.invalid", "null"])("AC14 POST Origin %s is 403 before session/body/resource", async origin => {
    const f = fixture();
    const headers: Record<string, string> = { "content-type": "application/json", "x-b1-csrf": f.csrf };
    if (origin !== undefined) headers.origin = origin;
    const response = await call(f, "properties", request("properties", {
      method: "POST", headers, body: JSON.stringify({ addressReference: "synthetic-reference" }),
    }));
    expect(response.status).toBe(403);
    expect(f.d.readSession).not.toHaveBeenCalled();
    expect(f.d.registration.createProperty).not.toHaveBeenCalled();
  });

  it("AC14 valid Origin + invalid path still authenticates before input validation", async () => {
    const f = fixture();
    f.d.readSession.mockResolvedValue(null);
    const response = await call(
      f,
      "properties",
      request("properties", {
        method: "POST",
        headers: postHeaders(f.csrf),
        body: JSON.stringify({ addressReference: "synthetic-reference" }),
      }),
      { orgId: "invalid" },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("AC14 current session + bad CSRF precedes invalid query/path/body", async () => {
    const f = fixture();
    const response = await call(
      f,
      "properties",
      request("properties", {
        method: "POST",
        headers: postHeaders("0".repeat(64)),
        body: "{",
      }, "?unexpected=true"),
      { orgId: "invalid" },
    );
    expect(response.status).toBe(403);
    expect(f.d.registration.createProperty).not.toHaveBeenCalled();
  });

  it.each([
    [{ addressReference: "" }, 400],
    [{ addressReference: " padded " }, 400],
    [{ addressReference: "ok", id: property }, 400],
    [{ addressReference: "ok", role: "ORG_ADMIN" }, 400],
  ] as const)("AC04 strict Property body rejects %j", async (body, status) => {
    const f = fixture();
    const response = await call(f, "properties", request("properties", {
      method: "POST", headers: postHeaders(f.csrf), body: JSON.stringify(body),
    }));
    expect(response.status).toBe(status);
    expect(f.d.registration.createProperty).not.toHaveBeenCalled();
  });

  it("AC14 enforces 8 KiB on actual UTF-8 bytes rather than character count", async () => {
    const f = fixture();
    const body = JSON.stringify({ addressReference: "가".repeat(3000) });
    expect(body.length).toBeLessThan(8192);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(8192);
    const response = await call(f, "properties", request("properties", {
      method: "POST", headers: postHeaders(f.csrf), body,
    }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "PAYLOAD_TOO_LARGE" });
    expect(f.d.registration.createProperty).not.toHaveBeenCalled();
  });

  it.each([
    "text/plain",
    "application/json; boundary=bad",
    "application/json; charset=iso-8859-1",
  ])("AC14 rejects unsupported content type %s", async contentType => {
    const f = fixture();
    const response = await call(f, "properties", request("properties", {
      method: "POST",
      headers: postHeaders(f.csrf, { "content-type": contentType }),
      body: JSON.stringify({ addressReference: "synthetic-reference" }),
    }));
    expect(response.status).toBe(400);
  });

  it("AC14 accepts application/json with utf-8 charset and returns 201 only after port result", async () => {
    const f = fixture();
    const response = await call(f, "properties", request("properties", {
      method: "POST",
      headers: postHeaders(f.csrf, { "content-type": "application/json; charset=utf-8" }),
      body: JSON.stringify({ addressReference: "synthetic-reference" }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: property, orgId: org, addressReference: "synthetic-reference" });
    expect(response.headers.get("location")).toBe(`/api/v2/organizations/${org}/properties/${property}`);
    expectPrivate(response);
  });

  it("AC14 invalid UTF-8 bytes become INVALID_INPUT", async () => {
    const f = fixture();
    const response = await call(f, "properties", request("properties", {
      method: "POST",
      headers: postHeaders(f.csrf),
      body: new Uint8Array([0xff, 0xfe, 0xfd]),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_INPUT" });
  });

  it.each([
    ["properties", "X-B3-Can-Create-Property"],
    ["property", "X-B3-Can-Create-Unit"],
    ["units", "X-B3-Can-Create-Unit"],
  ] as const)("AC21 GET %s exposes only server-derived advisory %s", async (kind, header) => {
    const f = fixture();
    const response = await call(f, kind, request(kind));
    expect(response.status).toBe(200);
    expect(response.headers.get(header)).toBe("true");
    expectPrivate(response);
    if (header.includes("Property")) expect(f.d.registration.canCreateProperty).toHaveBeenCalledOnce();
    else expect(f.d.registration.canCreateUnit).toHaveBeenCalledOnce();
  });

  it("AC21 false capability stays false and forged inbound action header cannot authorize POST", async () => {
    const f = fixture();
    f.d.registration.canCreateProperty.mockResolvedValue(false);
    const get = await call(f, "properties", request("properties", {
      headers: { "x-b3-can-create-property": "true" },
    }));
    expect(get.headers.get("x-b3-can-create-property")).toBe("false");

    f.d.registration.createProperty.mockRejectedValue(new B3Error("FORBIDDEN"));
    const post = await call(f, "properties", request("properties", {
      method: "POST",
      headers: postHeaders(f.csrf, { "x-b3-can-create-property": "true" }),
      body: JSON.stringify({ addressReference: "synthetic-reference" }),
    }));
    expect(post.status).toBe(403);
  });

  it("AC21 errors never carry action headers", async () => {
    const f = fixture();
    f.d.organizations.listProperties.mockRejectedValue(new B1Error("NOT_FOUND"));
    const response = await call(f, "properties", request("properties"));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-b3-can-create-property")).toBeNull();
  });

  it("known conflict maps 409 and unknown storage error is sanitized 503", async () => {
    const conflict = fixture();
    conflict.d.registration.createUnit.mockRejectedValue(new B3Error("CONFLICT"));
    const conflictResponse = await call(conflict, "units", request("units", {
      method: "POST",
      headers: postHeaders(conflict.csrf),
      body: JSON.stringify({ label: "Synthetic 101" }),
    }));
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toEqual({ error: "CONFLICT" });

    const unknown = fixture();
    unknown.d.registration.createProperty.mockRejectedValue(new Error("PRIVATE_SQL_CONSTRAINT_DETAIL"));
    const unknownResponse = await call(unknown, "properties", request("properties", {
      method: "POST",
      headers: postHeaders(unknown.csrf),
      body: JSON.stringify({ addressReference: "synthetic-reference" }),
    }));
    expect(unknownResponse.status).toBe(503);
    expect(await unknownResponse.text()).toBe('{"error":"DEPENDENCY_UNAVAILABLE"}');
  });

  it.each([
    ["properties", "?limit=1&limit=2"],
    ["properties", "?role=ORG_ADMIN"],
    ["units", "?userId=other"],
    ["property", "?limit=1"],
    ["unit", "?after=" + unit],
  ] as const)("AC19/AC14 rejects invalid query %s %s before resource read", async (kind, query) => {
    const f = fixture();
    const response = await call(f, kind, request(kind, {}, query));
    expect(response.status).toBe(400);
  });

  it.each([
    ["properties", { orgId: "invalid" }],
    ["property", { orgId: org, propertyId: "invalid" }],
    ["units", { orgId: org, propertyId: "invalid" }],
    ["unit", { orgId: org, propertyId: property, unitId: "invalid" }],
  ] as const)("rejects invalid %s UUID selectors without port access", async (kind, override) => {
    const f = fixture();
    const response = await call(f, kind, request(kind), override as Record<string, string>);
    expect(response.status).toBe(400);
    expect(f.d.organizations.listProperties).not.toHaveBeenCalled();
    expect(f.d.organizations.getProperty).not.toHaveBeenCalled();
    expect(f.d.units.listUnits).not.toHaveBeenCalled();
    expect(f.d.units.getUnit).not.toHaveBeenCalled();
  });
});

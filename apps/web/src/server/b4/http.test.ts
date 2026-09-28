import { randomBytes, randomUUID } from "node:crypto";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B4Error } from "@build-manager/application";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { handleB4Http, type B4HTTPDependencies } from "./http";
import { assertB4EmptyBody } from "./request";

const base = "http://localhost:3124";
const params = { orgId: randomUUID(),propertyId: randomUUID(),membershipId: randomUUID() };
const path = (p = params) => `/api/v2/organizations/${p.orgId}/properties/${p.propertyId}/staff-assignments/${p.membershipId}`;
function fixture() {
  const issuedAt = Math.floor(Date.now()/1000), csrf = randomBytes(32).toString("hex");
  const session: SessionData = { user: { sub: "auth0|synthetic" },
    tokenSet: { accessToken: "synthetic", expiresAt: issuedAt+3600 },
    internal: { sid: "synthetic",createdAt: issuedAt },
    b1: { handle: randomBytes(32).toString("hex"),csrf,issuedAt,expiresAt: issuedAt+3600 } };
  const d = { appBaseUrl: base,readSession: vi.fn().mockResolvedValue(session),
    sessions: { currentActor: vi.fn().mockResolvedValue({ userId: "synthetic" }),revoke: vi.fn() },
    assignments: { getCurrent: vi.fn().mockResolvedValue({ assigned: true }),
      ensureCurrent: vi.fn().mockResolvedValue({ assigned: true,created: true }),endCurrent: vi.fn().mockResolvedValue(undefined) },
  } satisfies B4HTTPDependencies;
  return { d,csrf,session };
}
function request(f: ReturnType<typeof fixture>,method = "GET",init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {},query = "",p = params) {
  return new NextRequest(base+path(p)+query,{ method,
    headers: { origin: base,"x-b1-csrf": f.csrf },...init });
}
async function check(response: Response,status: number,body?: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("vary")).toBe("Cookie");
  if (status === 204) expect(await response.text()).toBe("");
  else if (body !== undefined) expect(await response.json()).toEqual(body);
}

describe("B4 transport and precedence", () => {
  it.each(["POST","PATCH","HEAD","OPTIONS"])("%s custom 405 precedes all dependencies",async method => {
    const d = vi.fn(() => { throw new Error("must not resolve"); });
    const response = await handleB4Http(request(fixture(),method),params,d);
    await check(response,405,{ error: "METHOD_NOT_ALLOWED" });
    expect(response.headers.get("allow")).toBe("GET, PUT, DELETE"); expect(d).not.toHaveBeenCalled();
  });
  it.each(["orgId","propertyId","membershipId"])("GET rejects malformed %s before authentication",async key => {
    const f = fixture(); f.d.readSession.mockResolvedValue(null);
    await check(await handleB4Http(request(f),{ ...params,[key]: "invalid" },() => f.d),400,{ error: "INVALID_INPUT" });
    expect(f.d.readSession).not.toHaveBeenCalled();
  });
  it.each(["?q=one","?q=one&q=two"])("GET rejects query %s before authentication",async query => {
    const f = fixture(); f.d.readSession.mockResolvedValue(null);
    await check(await handleB4Http(request(f,"GET",{},query),params,() => f.d),400,{ error: "INVALID_INPUT" });
    expect(f.d.readSession).not.toHaveBeenCalled();
  });
  it.each(["GET","PUT","DELETE"])("%s anonymous request is private 401",async method => {
    const f = fixture(); f.d.readSession.mockResolvedValue(null);
    await check(await handleB4Http(request(f,method),params,() => f.d),401,{ error: "UNAUTHENTICATED" });
    for (const fn of Object.values(f.d.assignments)) expect(fn).not.toHaveBeenCalled();
  });
  for (const method of ["PUT","DELETE"]) {
    it.each([undefined,base+"/", "https://synthetic.invalid"])(`${method} requires exact Origin before session/body`,async origin => {
      const f = fixture(); f.d.readSession.mockResolvedValue(null);
      await check(await handleB4Http(request(f,method,{ headers: origin ? { origin } : {},body: "invalid" }),params,() => f.d),403,{ error: "FORBIDDEN" });
      expect(f.d.readSession).not.toHaveBeenCalled();
    });
    it.each([undefined,"wrong","A".repeat(64)])(`${method} requires session-bound lower-case CSRF before malformed input`,async csrf => {
      const f = fixture();
      await check(await handleB4Http(request(f,method,{ headers: { origin: base,...(csrf ? { "x-b1-csrf": csrf } : {}) },body: "invalid" },"?q=x"),{ ...params,orgId: "invalid" },() => f.d),403,{ error: "FORBIDDEN" });
    });
    it.each(["{}"," ","role=ORG_ADMIN"])(`${method} rejects any business byte: %s`,async body => {
      const f = fixture();
      await check(await handleB4Http(request(f,method,{ body }),params,() => f.d),400,{ error: "INVALID_INPUT" });
      for (const fn of Object.values(f.d.assignments)) expect(fn).not.toHaveBeenCalled();
    });
    it.each([["8193",413],["-1",400],["invalid",400],["1.2",400]])(`${method} bounds advertised length %s`,async (length,status) => {
      const f = fixture();
      await check(await handleB4Http(request(f,method,{ headers: { origin: base,"x-b1-csrf": f.csrf,"content-length": String(length) } }),params,() => f.d),Number(status),{ error: status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_INPUT" });
    });
  }
  it("accepts bodyless lifecycle and keeps created internal",async () => {
    const f = fixture();
    await check(await handleB4Http(request(f),params,() => f.d),200,{ assigned: true });
    const created = await handleB4Http(request(f,"PUT"),params,() => f.d);
    expect(created.headers.get("location")).toBe(path());
    await check(created,201,{ assigned: true });
    f.d.assignments.ensureCurrent.mockResolvedValue({ assigned: true,created: false });
    await check(await handleB4Http(request(f,"PUT"),params,() => f.d),200,{ assigned: true });
    await check(await handleB4Http(request(f,"DELETE"),params,() => f.d),204);
  });
  it.each(["foreign","inactive"])("%s valid organization tuples preserve 404 for every method",async () => {
    const f = fixture(),tuple = { orgId: randomUUID(),propertyId: randomUUID(),membershipId: randomUUID() };
    for (const [method,port] of [["GET","getCurrent"],["PUT","ensureCurrent"],["DELETE","endCurrent"]] as const) {
      f.d.assignments[port].mockRejectedValue(new B4Error("NOT_FOUND"));
      await check(await handleB4Http(request(f,method,{},"",tuple),tuple,() => f.d),404,{ error: "NOT_FOUND" });
      expect(f.d.assignments[port]).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/),tuple.orgId,tuple.propertyId,tuple.membershipId);
    }
  });
  it.each([["FORBIDDEN",403],["NOT_FOUND",404],["DEPENDENCY_UNAVAILABLE",503]] as const)("maps %s without leaking identity or retrying",async (code,status) => {
    const f = fixture();
    f.d.assignments.ensureCurrent.mockRejectedValue(new B4Error(code));
    await check(await handleB4Http(request(f,"PUT"),params,() => f.d),status,{ error: code });
    expect(f.d.assignments.ensureCurrent).toHaveBeenCalledTimes(1);
  });
  it("sanitizes unexpected SQL errors",async () => {
    const f = fixture(); f.d.assignments.getCurrent.mockRejectedValue(new Error("SELECT hidden_identity FROM private_table"));
    await check(await handleB4Http(request(f),params,() => f.d),503,{ error: "DEPENDENCY_UNAVAILABLE" });
  });
  it("cancels at the first actual byte without accumulating a stream",async () => {
    let pulls = 0; const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(9000)); },cancel },{ highWaterMark: 0 });
    const r = new Request(base,{ method: "PUT",body,duplex: "half" } as RequestInit);
    await expect(assertB4EmptyBody(r)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(pulls).toBe(1); expect(cancel).toHaveBeenCalledTimes(1);
  });
});

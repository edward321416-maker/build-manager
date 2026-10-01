import { randomBytes, randomUUID } from "node:crypto";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B5Error, type B5ErrorCode } from "@build-manager/application";
import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";
import { handleB5Http, type B5HTTPDependencies } from "./http";
const base="http://localhost:3124", params={orgId:randomUUID(),membershipId:randomUUID()};
function fixture() {
  const issuedAt=Math.floor(Date.now()/1000),csrf=randomBytes(32).toString("hex");
  const session:SessionData={user:{sub:"auth0|synthetic"},tokenSet:{accessToken:"synthetic",expiresAt:issuedAt+3600},
    internal:{sid:"synthetic",createdAt:issuedAt},b1:{handle:randomBytes(32).toString("hex"),csrf,issuedAt,expiresAt:issuedAt+3600}};
  const d={appBaseUrl:base,readSession:vi.fn().mockResolvedValue(session),
    sessions:{currentActor:vi.fn().mockResolvedValue({userId:"synthetic"}),revoke:vi.fn()},
    memberships:{endCurrent:vi.fn().mockResolvedValue(undefined)}} satisfies B5HTTPDependencies;
  return {d,csrf};
}
function req(f:ReturnType<typeof fixture>,init:NonNullable<ConstructorParameters<typeof NextRequest>[1]>={},query="") {
  return new NextRequest(base+`/api/v2/organizations/${params.orgId}/memberships/${params.membershipId}`+query,
    {method:"DELETE",headers:{origin:base,"x-b1-csrf":f.csrf},...init});
}
async function check(r:Response,status:number,error?:string) {
  expect(r.status).toBe(status); expect(r.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(r.headers.get("vary")).toBe("Cookie");
  if(status===204) expect(await r.text()).toBe(""); else expect(await r.json()).toEqual({error});
}
it.each(["GET","PUT","POST","PATCH","HEAD","OPTIONS"])("%s returns custom 405 without resolving dependencies",async method=>{
  const d=vi.fn(()=>{throw new Error("private");});
  const r=await handleB5Http(req(fixture(),{method}),params,d);
  await check(r,405,"METHOD_NOT_ALLOWED"); expect(r.headers.get("allow")).toBe("DELETE");expect(d).not.toHaveBeenCalled();
});
it.each([undefined,base+"/","https://synthetic.invalid"])("rejects Origin %s before session or input",async origin=>{
  const f=fixture(); f.d.readSession.mockResolvedValue(null);
  await check(await handleB5Http(req(f,{headers:origin?{origin}:{},body:"invalid"},"?q=x"),{...params,orgId:"bad"},()=>f.d),403,"FORBIDDEN");
  expect(f.d.readSession).not.toHaveBeenCalled();expect(f.d.memberships.endCurrent).not.toHaveBeenCalled();
});
it("missing session precedes malformed CSRF/path/body",async()=>{
  const f=fixture();f.d.readSession.mockResolvedValue(null);
  await check(await handleB5Http(req(f,{headers:{origin:base},body:"x"}),{...params,orgId:"bad"},()=>f.d),401,"UNAUTHENTICATED");
});
it.each([undefined,"wrong","A".repeat(64)])("rejects CSRF %s before path/query/body",async csrf=>{
  const f=fixture(); await check(await handleB5Http(req(f,{headers:{origin:base,...(csrf?{"x-b1-csrf":csrf}:{})},body:"x"},"?q=x"),{...params,orgId:"bad"},()=>f.d),403,"FORBIDDEN");
  expect(f.d.memberships.endCurrent).not.toHaveBeenCalled();
});
it.each(["orgId","membershipId"])("rejects malformed %s",async key=>{
  const f=fixture();await check(await handleB5Http(req(f),{...params,[key]:"bad"},()=>f.d),400,"INVALID_INPUT");
  expect(f.d.memberships.endCurrent).not.toHaveBeenCalled();
});
it("rejects query and nonempty body",async()=>{
  const f=fixture(); for(const request of [req(f,{},"?q=x"),req(f,{body:"x"})]) await check(await handleB5Http(request,params,()=>f.d),400,"INVALID_INPUT");
  expect(f.d.memberships.endCurrent).not.toHaveBeenCalled();
});
it.each([["8193",413,"PAYLOAD_TOO_LARGE"],["garbage",400,"INVALID_INPUT"]] as const)("rejects declared content length %s",async(length,status,error)=>{
  const f=fixture();await check(await handleB5Http(req(f,{headers:{origin:base,"x-b1-csrf":f.csrf,"content-length":length}}),params,()=>f.d),status,error);
  expect(f.d.memberships.endCurrent).not.toHaveBeenCalled();
});
it.each([["NOT_FOUND",404],["FORBIDDEN",403],["CONFLICT",409],["DEPENDENCY_UNAVAILABLE",503]] as [B5ErrorCode,number][])("sanitizes persistence %s",async(code,status)=>{
  const f=fixture();f.d.memberships.endCurrent.mockRejectedValue(new B5Error(code));
  await check(await handleB5Http(req(f),params,()=>f.d),status,code);
});
it("returns empty private 204 and never revokes the session",async()=>{
  const f=fixture();await check(await handleB5Http(req(f),params,()=>f.d),204);
  expect(f.d.memberships.endCurrent).toHaveBeenCalledTimes(1);expect(f.d.sessions.revoke).not.toHaveBeenCalled();
});
it("sanitizes arbitrary failures",async()=>{
  const f=fixture();f.d.memberships.endCurrent.mockRejectedValue(new Error("private SQL"));
  await check(await handleB5Http(req(f),params,()=>f.d),503,"DEPENDENCY_UNAVAILABLE");
});

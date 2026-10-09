import { expect,it,vi } from "vitest";
import { handleCoreFlow } from "./http";
import type { CoreHTTPDependencies } from "./container";
import { createHash,randomUUID } from "node:crypto";
import { invitationOrigin } from "./onboarding";

it("lets an authenticated applicant without an organization read their own connection requests",async()=>{
 const current=vi.fn().mockResolvedValue({digest:"a".repeat(64),csrf:"b".repeat(64)});
 const deps:CoreHTTPDependencies={port:{run:vi.fn()},revoke:vi.fn(),origins:["http://localhost:3133"],b1:{current,access:{organizations:async()=>[],inOrganization:vi.fn()},onboarding:{execute:vi.fn().mockResolvedValue({data:{items:[],nextCursor:null}})},inviteOrigin:()=>"http://localhost:3133"}};
 const response=await handleCoreFlow(new Request("http://localhost:3133/api/v2/core/onboarding/mine"),["onboarding","mine"],()=>deps);
 expect(current).toHaveBeenCalledOnce();
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({items:[],nextCursor:null});
});

const origin="http://localhost:3133",org=randomUUID();
const view={invitationId:randomUUID(),requestNumber:null,unitId:randomUUID(),buildingId:randomUUID(),buildingName:"Synthetic building",unitLabel:"Synthetic vacant unit",state:"OPEN",createdAt:"2026-10-03T00:00:00Z",expiresAt:"2026-10-04T00:00:00Z",requestedAt:null,decidedAt:null};
function setup(){
 const execute=vi.fn().mockResolvedValue({data:view}),current=vi.fn().mockResolvedValue({digest:"a".repeat(64),csrf:"b".repeat(64)});
 const deps:CoreHTTPDependencies={port:{run:vi.fn()},revoke:vi.fn(),origins:[origin],b1:{current,access:{organizations:async()=>[],inOrganization:vi.fn()},onboarding:{execute},inviteOrigin:()=>"http://localhost:3100"}};
 const call=(route:string,method="POST",input:unknown={},headers:Record<string,string>={})=>handleCoreFlow(new Request(origin+"/api/v2/core/onboarding/"+route,{method,headers:{Origin:origin,"Content-Type":"application/json","x-b1-csrf":"b".repeat(64),"x-core-organization":org,...headers},...(method==="POST"?{body:JSON.stringify(input)}:{})}),["onboarding",route.split("?")[0]],()=>deps);
 return {execute,current,deps,call};
}
it("returns a random fragment link once and sends only its SHA256 digest to persistence",async()=>{
 const s=setup(),r=await s.call("create","POST",{unitId:view.unitId},{Host:"foreign.invalid","X-Forwarded-Host":"foreign.invalid"});expect(r.status).toBe(201);
 const response=await r.json(),url=new URL(response.link),raw=url.hash.slice(1);
 expect(url.origin).toBe("http://localhost:3100");expect(url.pathname).toBe("/core/join");expect(url.search).toBe("");expect(raw).toMatch(/^[a-f0-9]{64}$/);
 expect(s.execute).toHaveBeenCalledWith("a".repeat(64),"CREATE",org,{unitId:view.unitId,tokenDigest:createHash("sha256").update(raw).digest("hex")});
 expect(JSON.stringify(s.execute.mock.calls)).not.toContain(raw);expect(r.headers.get("Cache-Control")).toBe("private, no-store");expect(r.headers.get("Referrer-Policy")).toBe("no-referrer");
});
it("keeps inspect/claim actor scoped and never forwards a supplied organization",async()=>{
 const s=setup(),token="c".repeat(64);expect((await s.call("claim","POST",{token})).status).toBe(200);
 expect(s.execute).toHaveBeenCalledWith("a".repeat(64),"CLAIM",null,{tokenDigest:createHash("sha256").update(token).digest("hex")});
});
it("rejects unknown fields, oversized bodies, token query strings and mutation via GET",async()=>{
 const s=setup();for(const input of [{unitId:view.unitId,userId:randomUUID()},{unitId:view.unitId,role:"ORG_ADMIN"},{unitId:"x".repeat(5000)}])expect((await s.call("create","POST",input)).status).toBe(400);
 expect((await s.call("inspect?token="+"e".repeat(64),"POST",{token:"e".repeat(64)})).status).toBe(400);
 for(const name of ["create","claim","approve","__proto__"])expect((await s.call(name,"GET")).status).toBe(404);
 expect(s.execute).not.toHaveBeenCalled();
});
it("has no developer bearer/cookie fallback and preserves session and exact Origin denial",async()=>{
 const s=setup();delete s.deps.b1;expect((await s.call("mine","GET",{},{Authorization:`Bearer ${"f".repeat(64)}`,Cookie:`rc1_session=${"f".repeat(64)}`})).status).toBe(401);
 expect((await setup().call("claim","POST",{token:"c".repeat(64)},{Origin:"http://foreign.invalid"})).status).toBe(403);
 expect(s.execute).not.toHaveBeenCalled();
});
it.each([["NOT_FOUND",404],["FORBIDDEN",403],["STATE_CONFLICT",409],["RATE_LIMITED",429],["UNAUTHENTICATED",401],["DEPENDENCY_UNAVAILABLE",503]] as const)("maps %s without leaking token/identity/driver details",async(code,status)=>{
 const s=setup();s.execute.mockResolvedValue({code});const r=await s.call("claim","POST",{token:"f".repeat(64)});expect(r.status).toBe(status);const text=await r.text();expect(text).not.toContain("f".repeat(64));expect(text).not.toMatch(/stack|digest|applicant_id/);
});
it("bounds cursors and accepts only explicit configured loopback origins",async()=>{
 const s=setup();expect((await s.call("mine?cursor=not-a-uuid","GET")).status).toBe(400);expect((await s.call("mine?cursor="+randomUUID()+"&cursor="+randomUUID(),"GET")).status).toBe(400);
 expect(invitationOrigin({B1_APP_BASE_URL:"https://build-manager-demo.vercel.app"})).toBe("https://build-manager-demo.vercel.app");expect(invitationOrigin({B1_APP_BASE_URL:origin})).toBe(origin);expect(invitationOrigin({B1_APP_BASE_URL:origin,CORE_INVITE_APP_ORIGIN:"http://localhost:3100"})).toBe("http://localhost:3100");
 for(const value of ["http://remote.invalid","http://localhost:3100/path","http://user@localhost:3100","http://localhost:3100/?token=x"])expect(()=>invitationOrigin({CORE_INVITE_APP_ORIGIN:value})).toThrow();
});

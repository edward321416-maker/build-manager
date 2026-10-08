import { describe,expect,it,vi } from "vitest";
import type { SessionData } from "@auth0/nextjs-auth0/types";
import { B1Error } from "@build-manager/application";
import { executeDemoEntry,readDemoEntryConfig } from "./demo-entry";

const secret="a".repeat(64),subjects={manager:"auth0|synthetic-manager-1",tenant:"auth0|synthetic-tenant-1"};
const env=(changes:Record<string,string|undefined>={})=>({BUILD_MANAGER_MODE:"B1",BUILD_MANAGER_DEMO_ENTRY:"1",B1_AUTH0_DOMAIN:"b1.synthetic.invalid",B1_AUTH0_CLIENT_ID:"synthetic",
  B1_AUTH0_CLIENT_SECRET:"synthetic-secret",B1_AUTH0_SECRET:secret,B1_APP_BASE_URL:"http://localhost:3134",BUILD_MANAGER_DEMO_SUBJECTS:JSON.stringify(subjects),...changes});
const demo=readDemoEntryConfig(env())!;
function post(body:string,origin:string|null="http://localhost:3134",method="POST"){
  const headers=new Headers({"content-type":"application/x-www-form-urlencoded"});if(origin)headers.set("origin",origin);
  return new Request("http://localhost:3134/api/v2/session/demo",{method,headers,...(method==="POST"?{body}:{})});
}

describe("demo entry configuration",()=>{
  it("is enabled only for B1 with the explicit flag, the synthetic provider and synthetic subjects",()=>{
    expect(demo).toMatchObject({subjects,auth:{issuer:"https://b1.synthetic.invalid/",appBaseUrl:"http://localhost:3134"}});
    for(const changes of [
      {BUILD_MANAGER_DEMO_ENTRY:undefined},{BUILD_MANAGER_DEMO_ENTRY:"true"},{BUILD_MANAGER_MODE:"DEMO"},{BUILD_MANAGER_MODE:undefined},
      {B1_AUTH0_DOMAIN:"tenant.example.auth0.com"},{B1_AUTH0_SECRET:"short"},{BUILD_MANAGER_DEMO_SUBJECTS:undefined},{BUILD_MANAGER_DEMO_SUBJECTS:"not json"},
      {BUILD_MANAGER_DEMO_SUBJECTS:JSON.stringify({manager:"auth0|real-person",tenant:subjects.tenant})},
      {BUILD_MANAGER_DEMO_SUBJECTS:JSON.stringify({manager:subjects.manager})},
      {BUILD_MANAGER_DEMO_SUBJECTS:JSON.stringify({...subjects,vendor:"auth0|synthetic-vendor"})},
    ])expect(readDemoEntryConfig(env(changes)),JSON.stringify(Object.keys(changes))).toBeNull();
  });
});

describe("demo entry request",()=>{
  it("begins the configured synthetic subject's session exactly like a fresh callback and redirects to the workspace",async()=>{
    const begin=vi.fn().mockResolvedValue({userId:"synthetic"}),seal=vi.fn(async(_:SessionData)=>"sealed-session");
    const response=await executeDemoEntry(post("role=manager"),demo,{begin},seal);
    expect(response.status).toBe(303);expect(new URL(response.headers.get("location")!).pathname).toBe("/core");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const session=seal.mock.calls[0][0],material=session.b1 as {handle:string;csrf:string;issuedAt:number;expiresAt:number};
    expect(session.user.sub).toBe(subjects.manager);
    expect(material.handle).toMatch(/^[a-f0-9]{64}$/);expect(material.csrf).toMatch(/^[a-f0-9]{64}$/);expect(material.expiresAt-material.issuedAt).toBe(3600);
    expect(begin).toHaveBeenCalledWith({identity:{issuer:"https://b1.synthetic.invalid/",subject:subjects.manager},digest:expect.stringMatching(/^[a-f0-9]{64}$/),expiresAt:new Date(material.expiresAt*1000)});
    const cookie=response.headers.get("set-cookie")!;
    expect(cookie).toContain("__session=sealed-session");expect(cookie).toMatch(/HttpOnly/i);expect(cookie).toMatch(/SameSite=lax/i);expect(cookie).toMatch(/Path=\//);
    expect(await response.text()).not.toContain(material.handle);
    const tenant=vi.fn(async(_:SessionData)=>"sealed");await executeDemoEntry(post("role=tenant"),demo,{begin},tenant);
    expect(tenant.mock.calls[0][0].user.sub).toBe(subjects.tenant);
  });
  it("rejects disabled, wrong method, cross-site, unknown role and malformed bodies without starting a session",async()=>{
    const begin=vi.fn(),seal=vi.fn();
    expect((await executeDemoEntry(post("role=manager"),null,{begin},seal)).status).toBe(404);
    expect((await executeDemoEntry(post("","http://localhost:3134","GET"),demo,{begin},seal)).status).toBe(405);
    for(const origin of [null,"http://evil.example","http://localhost:3133"])expect((await executeDemoEntry(post("role=manager",origin),demo,{begin},seal)).status).toBe(403);
    for(const body of ["","role=vendor","role=MANAGER","role=manager&role=tenant","role=manager&next=/evil","x".repeat(200)])
      expect((await executeDemoEntry(post(body),demo,{begin},seal)).status,body.slice(0,30)).toBe(400);
    expect(begin).not.toHaveBeenCalled();expect(seal).not.toHaveBeenCalled();
  });
  it("does not set a cookie when the database session cannot begin",async()=>{
    const begin=vi.fn().mockRejectedValue(new B1Error("AUTHENTICATION_REJECTED")),seal=vi.fn(async()=>"sealed");
    const response=await executeDemoEntry(post("role=tenant"),demo,{begin},seal);
    expect(response.status).toBe(401);expect(response.headers.get("set-cookie")).toBeNull();expect(seal).not.toHaveBeenCalled();
  });
});

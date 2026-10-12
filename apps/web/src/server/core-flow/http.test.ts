import { describe,it,expect,vi } from "vitest";
import { CoreFlowError } from "@build-manager/application";
import { handleCoreFlow } from "./http";
import type { CoreHTTPDependencies } from "./container";

describe("RC1 request boundary",()=>{
  const url="http://127.0.0.1:3130/api/v2/core/";
  function setup(){const run=vi.fn().mockRejectedValue(new CoreFlowError("UNAUTHENTICATED"));const deps={port:{run},revoke:vi.fn(),origins:["http://127.0.0.1:3130"]} satisfies CoreHTTPDependencies;return{run,call:(path:string,init?:RequestInit)=>handleCoreFlow(new Request(url+path,init),path.split("/"),()=>deps)};}
  it("rejects missing and malformed bearer before persistence",async()=>{const s=setup();for(const headers of ([{},{Authorization:"Bearer invalid"}] as Record<string,string>[]))expect((await s.call("session",{headers})).status).toBe(401);expect(s.run).not.toHaveBeenCalled();});
  it("blocks foreign origins and cookie mutations without origin",async()=>{const s=setup();for(const headers of ([{Origin:"https://evil.invalid"},{Cookie:`rc1_session=${"a".repeat(64)}`}] as Record<string,string>[]))expect((await s.call("tickets",{method:"POST",headers})).status).toBe(403);expect(s.run).not.toHaveBeenCalled();});
  it("permits only explicit CORS origin and headers",async()=>{const s=setup();const r=await s.call("session",{method:"OPTIONS",headers:{Origin:"http://127.0.0.1:3130"}});expect(r.status).toBe(204);expect(r.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:3130");expect(r.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization, X-Upload-Id");});
  it("bounds and validates login body without exposing raw input",async()=>{const s=setup();for(const body of ['{"accessCode":"bad"}'," ".repeat(16385),"{"]){const r=await s.call("login",{method:"POST",headers:{Origin:"http://127.0.0.1:3130","Content-Type":"application/json"},body});expect(r.status).toBe(400);expect(await r.text()).not.toContain("accessCode");}expect(s.run).not.toHaveBeenCalled();});
  it("hashes valid native credentials and returns sanitized no-store errors",async()=>{const s=setup();const r=await s.call("session",{headers:{Authorization:`Bearer ${"a".repeat(64)}`}});expect(r.status).toBe(401);expect(s.run.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);expect(s.run.mock.calls[0][0]).not.toBe("a".repeat(64));expect(r.headers.get("Cache-Control")).toBe("private, no-store");expect(await r.text()).not.toContain("stack");});
  it("validates a photo evidence body before it touches the ticket",async()=>{
    // P1b: only a public evidence type and a photo UUID; a storage reference, a domain type or a fixture never reach the ticket.
    // Ticket actions parse their body inside the session transaction, so the check is that no ticket method runs.
    const touched=vi.fn(async()=>{throw new CoreFlowError("NOT_FOUND");});
    const scope={session:{actorId:"tenant",orgId:"org",role:"TENANT"},read:touched,photos:touched,store:touched};
    const run=vi.fn(async(_digest:string,operation:(s:unknown)=>Promise<Response>)=>operation(scope));
    const deps={port:{run},revoke:vi.fn(),origins:["http://127.0.0.1:3130"]} as unknown as CoreHTTPDependencies;
    const photoId="0b6f7d1e-2c3a-4d5e-8f90-1a2b3c4d5e6f",path="tickets/5f0c3e9a-1b2c-4d3e-8f4a-5b6c7d8e9f01/evidence";
    const call=(body:unknown)=>handleCoreFlow(new Request(url+path,{method:"POST",headers:{Authorization:`Bearer ${"a".repeat(64)}`,"Content-Type":"application/json"},body:JSON.stringify(body)}),path.split("/"),()=>deps);
    for(const body of [{evidenceType:"LEAK_LOCATION"},{evidenceType:"LEAK_AREA_PHOTO",photoId},{evidenceType:"LEAK_LOCATION",photoId:`core-photo:${photoId}`},{evidenceType:"LEAK_LOCATION",photoId,fixtureId:"demo-fixture-leak"}])
      expect((await call(body)).status).toBe(400);
    expect(touched).not.toHaveBeenCalled();
    expect((await call({evidenceType:"LEAK_LOCATION",photoId})).status).toBe(404);
    expect(touched).toHaveBeenCalled();
  });
  it("rejects unknown query keys and methods without DB access",async()=>{const s=setup();expect((await s.call("session?role=ORG_ADMIN")).status).toBe(400);expect((await s.call("session",{method:"DELETE"})).status).toBe(405);expect(s.run).not.toHaveBeenCalled();});
});

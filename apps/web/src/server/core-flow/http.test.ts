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
  it("rejects unknown query keys and methods without DB access",async()=>{const s=setup();expect((await s.call("session?role=ORG_ADMIN")).status).toBe(400);expect((await s.call("session",{method:"DELETE"})).status).toBe(405);expect(s.run).not.toHaveBeenCalled();});
});

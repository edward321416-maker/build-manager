import { NextRequest } from "next/server";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";

const auth0=vi.hoisted(()=>({getB1Auth0:vi.fn(()=>{throw new Error("AUTH0_CONFIGURATION_UNAVAILABLE");})}));
vi.mock("./server/b1/auth0",()=>auth0);
import { config,proxy } from "./proxy";

const previous=process.env.BUILD_MANAGER_MODE;
beforeEach(()=>{auth0.getB1Auth0.mockClear();});
afterEach(()=>{if(previous===undefined)delete process.env.BUILD_MANAGER_MODE;else process.env.BUILD_MANAGER_MODE=previous;});
const matcher=new RegExp(`^${config.matcher[0]}$`);

describe("Vendor transport isolation from B1/Auth0",()=>{
  it.each(["B1","UNSET"])("passes exact Vendor page/API paths without touching Auth0 (mode %s)",async mode=>{
    if(mode==="UNSET")delete process.env.BUILD_MANAGER_MODE;else process.env.BUILD_MANAGER_MODE=mode;
    for(const path of ["/vendor/job","/api/v2/vendor/session","/api/v2/vendor/session/redeem","/api/v2/vendor/job/source-photos/x"]){
      const response=await proxy(new NextRequest(`http://127.0.0.1:3140${path}`,{method:path.endsWith("redeem")?"POST":"GET"}));
      expect(response.status,path).toBe(200);
      expect(response.headers.get("x-middleware-next"),path).toBe("1");
    }
    expect(auth0.getB1Auth0).not.toHaveBeenCalled();
  });
  it("keeps B1/Core and look-alike paths on the protected Auth0 transport",async()=>{
    process.env.BUILD_MANAGER_MODE="B1";
    for(const path of ["/api/v2/core/tickets","/vendorx","/vendor","/vendor/jobs","/api/v2/vendorx/session","/api/v2/vendor-session","/workspace"]){
      auth0.getB1Auth0.mockClear();
      const response=await proxy(new NextRequest(`http://127.0.0.1:3140${path}`));
      expect(response.status,path).toBe(503);
      expect(auth0.getB1Auth0,path).toHaveBeenCalledTimes(1);
    }
  });
  it("excludes only the exact Vendor surfaces from the global matcher",()=>{
    for(const path of ["/vendor/job","/api/v2/vendor","/api/v2/vendor/session","/api/v2/vendor/job/decline"])expect(matcher.test(path),path).toBe(false);
    for(const path of ["/api/v2/core/tickets","/vendorx","/vendor","/vendor/jobs","/vendor/job/x","/api/v2/vendorx","/api/v2/vendor-session","/workspace","/"])expect(matcher.test(path),path).toBe(true);
  });
});

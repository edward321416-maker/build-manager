import { afterEach,expect,it,vi } from "vitest";

const previous=process.env.VENDOR_HANDOFF_DATABASE_CONFIG;
afterEach(()=>{if(previous===undefined)delete process.env.VENDOR_HANDOFF_DATABASE_CONFIG;else process.env.VENDOR_HANDOFF_DATABASE_CONFIG=previous;vi.resetModules();});
async function load(config:string|undefined){
  if(config===undefined)delete process.env.VENDOR_HANDOFF_DATABASE_CONFIG;else process.env.VENDOR_HANDOFF_DATABASE_CONFIG=config;
  vi.resetModules();
  const {getVendorHandoffContainer}=await import("./container");
  try{getVendorHandoffContainer();return "created";}catch(error){return (error as {code?:string}).code;}
}

it.each([
  ["missing",undefined],
  ["malformed","{"],
  ["non-loopback host",JSON.stringify({host:"db.internal",user:"bm_vendor_web",database:"x"})],
  ["B1 runtime role",JSON.stringify({host:"127.0.0.1",user:"bm_b1_web",database:"x"})],
  ["Vendor owner role",JSON.stringify({host:"127.0.0.1",user:"bm_vendor_handoff_owner",database:"x"})],
])("fails closed for %s Vendor database configuration",async(_label,config)=>{
  expect(await load(config)).toBe("DEPENDENCY_UNAVAILABLE");
});
it("builds only from the separate synthetic-local Vendor runtime role",async()=>{
  expect(await load(JSON.stringify({host:"127.0.0.1",port:1,user:"bm_vendor_web",database:"x"}))).toBe("created");
});

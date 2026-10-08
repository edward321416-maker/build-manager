import { afterEach,expect,it,vi } from "vitest";

const previous={config:process.env.VENDOR_HANDOFF_DATABASE_CONFIG,origin:process.env.VENDOR_HANDOFF_APP_ORIGIN};
const restore=(name:string,value:string|undefined)=>{if(value===undefined)delete process.env[name];else process.env[name]=value;};
afterEach(()=>{restore("VENDOR_HANDOFF_DATABASE_CONFIG",previous.config);restore("VENDOR_HANDOFF_APP_ORIGIN",previous.origin);vi.resetModules();});
const database=JSON.stringify({host:"127.0.0.1",port:1,user:"bm_vendor_web",database:"x"});
async function load(config:string|undefined,origin:string|null="http://127.0.0.1:3140"){
  restore("VENDOR_HANDOFF_DATABASE_CONFIG",config);restore("VENDOR_HANDOFF_APP_ORIGIN",origin??undefined);
  vi.resetModules();
  const {getVendorHandoffContainer}=await import("./container");
  try{return getVendorHandoffContainer().origin;}catch(error){return (error as {code?:string}).code;}
}

it.each([
  ["missing",undefined],
  ["malformed","{"],
  ["non-loopback host",JSON.stringify({host:"db.internal",user:"bm_vendor_web",database:"x"})],
  ["non-loopback host without verified TLS",JSON.stringify({host:"db.internal",user:"bm_vendor_web",database:"x",ssl:{rejectUnauthorized:false}})],
  ["B1 runtime role",JSON.stringify({host:"127.0.0.1",user:"bm_b1_web",database:"x"})],
  ["Vendor owner role",JSON.stringify({host:"127.0.0.1",user:"bm_vendor_handoff_owner",database:"x"})],
])("fails closed for %s Vendor database configuration",async(_label,config)=>{
  expect(await load(config)).toBe("DEPENDENCY_UNAVAILABLE");
});
it.each([
  ["missing",null],
  ["path-bearing","http://127.0.0.1:3140/vendor"],
  // Synthetic userinfo assembled through the URL API so no credential-shaped URL appears in source.
  ["credential-bearing",Object.assign(new URL("http://127.0.0.1:3140"),{username:"synthetic",password:"value"}).href.slice(0,-1)],
  ["plain-http non-loopback","http://10.0.0.5:3140"],
  ["non-http scheme","ftp://127.0.0.1"],
])("fails closed for a %s Vendor app origin",async(_label,origin)=>{
  expect(await load(database,origin)).toBe("DEPENDENCY_UNAVAILABLE");
});
it("accepts a hosted database only over verified TLS",async()=>{
  expect(await load(JSON.stringify({host:"db.example.invalid",port:5432,user:"bm_vendor_web",database:"x",ssl:true}),"https://build-manager-demo.vercel.app")).toBe("https://build-manager-demo.vercel.app");
});
it.each(["http://127.0.0.1:3140","http://localhost:3140","https://127.0.0.1:3443"])("accepts the explicitly configured origin %s with the separate Vendor runtime role",async origin=>{
  expect(await load(database,origin)).toBe(origin);
});

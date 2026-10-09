import { expect,it } from "vitest";
import { randomBytes } from "node:crypto";
import { readB1AuthConfig,sessionCookieOptions } from "./config";
function valid(){return {B1_AUTH0_DOMAIN:"synthetic.invalid",B1_AUTH0_CLIENT_ID:"synthetic",B1_AUTH0_CLIENT_SECRET:randomBytes(32).toString("hex"),B1_AUTH0_SECRET:randomBytes(32).toString("hex"),B1_APP_BASE_URL:"http://localhost:3124"};}
it("requires explicit complete Auth0 configuration and local base",()=>{
 const env=valid();expect(readB1AuthConfig(env)).toMatchObject({issuer:"https://synthetic.invalid/",appBaseUrl:"http://localhost:3124"});
 for(const key of Object.keys(env)){expect(()=>readB1AuthConfig({...env,[key]:undefined})).toThrow("B1_CONFIGURATION_UNAVAILABLE");}
});
// Synthetic userinfo is assembled through the URL API so no credential-shaped URL appears in source.
it.each(["http://production.invalid","https://production.invalid/path","https://production.invalid?x=1",Object.assign(new URL("https://production.invalid"),{username:"synthetic"}).href.slice(0,-1),"ftp://localhost","http://localhost:3124/path","http://localhost:3124?x=1","http://user@localhost:3124"])("rejects out-of-scope base %s",url=>{expect(()=>readB1AuthConfig({...valid(),B1_APP_BASE_URL:url})).toThrow();});
it("accepts an https hosted base origin for the hosted demo while plain http stays loopback-only",()=>{
 expect(readB1AuthConfig({...valid(),B1_APP_BASE_URL:"https://build-manager-demo.vercel.app"}).appBaseUrl).toBe("https://build-manager-demo.vercel.app");
 expect(sessionCookieOptions("https://build-manager-demo.vercel.app")).toEqual({sameSite:"lax",secure:true,path:"/"});
 expect(sessionCookieOptions("http://localhost:3124")).toEqual({sameSite:"lax",secure:false,path:"/"});
});

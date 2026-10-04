import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes,randomUUID,createHash } from "node:crypto";
import { Client } from "pg";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
import type { Browser,BrowserContext } from "@playwright/test";
export const base="http://localhost:3133",privateRoot=join(homedir(),".build-manager-rc1-private");
export async function sdkSession(browser:Browser,who="tenant",context?:BrowserContext){
 const state=JSON.parse(await readFile(join(privateRoot,"state.json"),"utf8")),saved=JSON.parse(await readFile(join(privateRoot,"b1-sdk-state.json"),"utf8"));
 const account=saved.fixture.accounts[who],subject=account?.subject??"auth0|synthetic-"+randomUUID(),handle=randomBytes(32).toString("hex"),csrf=randomBytes(32).toString("hex"),issuedAt=Math.floor(Date.now()/1000);
 const cookie=await generateSessionCookie({user:{sub:subject},tokenSet:{accessToken:randomBytes(32).toString("hex"),expiresAt:issuedAt+3600},internal:{sid:randomUUID(),createdAt:issuedAt},b1:{handle,csrf,issuedAt,expiresAt:issuedAt+3600}},{secret:saved.secret});
 const ctx=context??await browser.newContext({baseURL:base,viewport:{width:320,height:800}});
 await ctx.addCookies([{name:"__session",value:cookie,url:base,httpOnly:true,sameSite:"Lax"}]);
 const complete=await ctx.request.get("/api/v2/session/complete",{maxRedirects:0});if(complete.status()!==303)throw new Error("SYNTHETIC_B1_COMPLETION_FAILED");
 if(new URL(complete.headers().location).pathname!=="/workspace")throw new Error("B1_FIXED_COMPLETION_REDIRECT_CHANGED");
 const headers={"x-b1-csrf":csrf,"x-core-organization":account?.orgId??saved.fixture.orgA,Origin:base};
 const admin=new Client(state.admin);await admin.connect();
 return{context:ctx,headers,account,fixture:saved.fixture,csrf,cookie,digest:createHash("sha256").update(handle).digest(),admin,async close(){await admin.end();if(!context)await ctx.close();}};
}

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes,randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { generateSessionCookie } from "@auth0/nextjs-auth0/testing";
// Explicit SDK test-session launcher; never a product route or provider login.
let browser;
try{
 if(process.version!=="v24.21.0")throw new Error();
 const who=process.argv.includes("--manager")?"manager":"tenant",capture=process.argv.includes("--capture");
 const mobile=process.argv.includes("--mobile"),viewport=mobile?{width:390,height:844}:{width:1280,height:900};
 const directory=join(homedir(),".build-manager-rc1-private"),saved=JSON.parse(await readFile(join(directory,"b1-sdk-state.json"),"utf8"));
 const subject=saved.fixture.accounts[who].subject;if(!subject.startsWith("auth0|synthetic-"))throw new Error();
 const issuedAt=Math.floor(Date.now()/1000),base="http://localhost:3133";
 const cookie=await generateSessionCookie({user:{sub:subject},tokenSet:{accessToken:randomBytes(32).toString("hex"),expiresAt:issuedAt+3600},internal:{sid:randomUUID(),createdAt:issuedAt},b1:{handle:randomBytes(32).toString("hex"),csrf:randomBytes(32).toString("hex"),issuedAt,expiresAt:issuedAt+3600}},{secret:saved.secret});
 browser=await chromium.launch({headless:capture});const context=await browser.newContext({viewport});
 await context.addCookies([{name:"__session",value:cookie,url:base,httpOnly:true,sameSite:"Lax"}]);
 const page=await context.newPage();await page.goto(base+"/api/v2/session/complete");
 await page.getByRole("link",{name:"내 호실 수리 접수·사진·처리 이력 열기"}).click();await page.getByLabel("건물·호실").waitFor();
 if(capture){await page.screenshot({path:join(directory,`login-launcher-${who}-${mobile?"mobile":"desktop"}-${viewport.width}.png`),fullPage:true});await browser.close();}
 console.log(`SYNTHETIC_SDK_BROWSER_READY | ${who} | ${viewport.width}x${viewport.height} | localhost:3133 | LIVE_AUTH0=NOT_RUN`);
}catch{await browser?.close();console.error("SYNTHETIC_SDK_BROWSER_FAILED | verify pinned Node, prepared test state and synthetic B1 server; no provider login was attempted");process.exitCode=1;}

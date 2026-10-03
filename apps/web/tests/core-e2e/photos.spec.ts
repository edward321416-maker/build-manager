import { test,expect,type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const privateRoot=join(homedir(),".build-manager-rc1-private");
const codes=async()=>JSON.parse(await readFile(join(privateRoot,"access-codes.json"),"utf8")) as Record<string,string>;
async function login(page:Page,who="tenant"){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill((await codes())[who]);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();}
// Generated, non-personal fixture. This is input data, never presented as a real-site photo.
async function sample(mime="image/png"){
  const svg=Buffer.from('<svg width="480" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="300" fill="#edf3ef"/><path d="M60 60H230V165H400" fill="none" stroke="#718e94" stroke-width="36"/><path d="M60 53H230V158H400" fill="none" stroke="#bacbce" stroke-width="10"/><path d="M230 192q-22 27 0 35q22-8 0-35" fill="#278dca"/><ellipse cx="230" cy="245" rx="60" ry="7" fill="#9ccad8"/><text x="24" y="282" font-size="17" fill="#244b43">SYNTHETIC LEAK SAMPLE</text></svg>');
  return mime==="image/png"?sharp(svg).png().toBuffer():sharp(svg).rotate(270).jpeg().withMetadata({orientation:6}).toBuffer();
}
const saved=(page:Page)=>page.getByRole("region",{name:"저장된 참고 사진",exact:true});
test("320px select-preview-save, manager protected read, enlargement and new browser retain actual PNG/JPEG",async({page,browser})=>{
  await page.setViewportSize({width:320,height:740});await login(page);
  await page.getByLabel("문제 설명").fill("합성 배관 참고 사진 — 실제 첨부 왕복");
  await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles([{name:"sample.png",mimeType:"image/png",buffer:await sample()},{name:"sample.jpg",mimeType:"image/jpeg",buffer:await sample("image/jpeg")}]);
  await expect(page.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();await expect(page.getByAltText("전송 전 사진 2 미리보기")).toBeVisible();await page.screenshot({path:join(privateRoot,"photo-preview-320.png"),fullPage:true});
  const response=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");await page.getByRole("button",{name:"접수하기",exact:true}).click();const t=await (await response).json();
  await expect(saved(page).getByRole("img")).toHaveCount(2);await expect(page.getByText("사진을 저장했습니다. 관리자도 같은 사진을 확인할 수 있습니다.",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const image of await saved(page).getByRole("img").all())expect(await image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await saved(page).getByRole("button",{name:"저장된 사진 1 확대"}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.screenshot({path:join(privateRoot,"photo-enlarged-320.png"),fullPage:true});await page.getByRole("button",{name:"사진 닫기",exact:true}).click();
  await page.screenshot({path:join(privateRoot,"photo-tenant-saved-320.png"),fullPage:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),manager=await ctx.newPage();
  try{await login(manager,"manager");await manager.getByRole("button",{name:new RegExp(t.ticketId.slice(0,8))}).click();await expect(saved(manager).getByRole("img")).toHaveCount(2);await expect(manager.getByLabel("참고 사진 선택")).toHaveCount(0);await manager.getByLabel("처리 기록").fill("합성 첨부 사진 2장을 확인했습니다");await manager.getByRole("button",{name:"처리 시작 기록",exact:true}).click();await expect(manager.getByTestId("work-status")).toHaveText("처리중");await manager.screenshot({path:join(privateRoot,"photo-manager-confirmed-390.png"),fullPage:true});}finally{await ctx.close();}
  const fresh=await browser.newContext({viewport:{width:320,height:740}}),reconnected=await fresh.newPage();
  try{await login(reconnected);const row=reconnected.getByRole("listitem").filter({has:reconnected.getByRole("button",{name:new RegExp(t.ticketId.slice(0,8))})});await expect(row.getByRole("img")).toHaveCount(2);await row.getByRole("button",{name:new RegExp(t.ticketId.slice(0,8))}).click();await expect(saved(reconnected).getByRole("img")).toHaveCount(2);await expect(reconnected.getByTestId("work-status")).toHaveText("처리중");await reconnected.screenshot({path:join(privateRoot,"photo-reconnected-320.png"),fullPage:true});}finally{await fresh.close();}
});
test("failed upload keeps selected file and existing ticket; lost success is reconciled without CREATE or POST replay",async({page})=>{
  await login(page);await page.getByLabel("문제 설명").fill("합성 사진 실패·응답 유실 검사");await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles({name:"sample.png",mimeType:"image/png",buffer:await sample()});
  let creates=0,uploads=0;page.on("request",r=>{if(r.method()==="POST"&&r.url().endsWith("/api/v2/core/tickets"))creates++;});
  await page.route("**/api/v2/core/tickets/*/photos",async route=>{if(route.request().method()!=="POST")return route.continue();uploads++;if(uploads===1)return route.abort();await route.fetch();await route.abort();});
  await page.getByRole("button",{name:"접수하기",exact:true}).click();await expect(page.getByText(/사진 전송 결과를 확인하지 못했습니다/)).toBeVisible();await expect(page.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();expect(creates).toBe(1);
  await page.getByRole("button",{name:"사진만 전송",exact:true}).click();await expect(page.getByText(/사진 전송 결과를 확인하지 못했습니다/)).toBeVisible();await page.getByRole("button",{name:"사진 저장 상태 확인",exact:true}).click();await expect(page.getByText(/저장된 사진 1장을 확인했습니다/)).toBeVisible();await expect(page.getByAltText("전송 전 사진 1 미리보기")).toHaveCount(0);await expect(saved(page).getByRole("img")).toHaveCount(1);expect(creates).toBe(1);expect(uploads).toBe(2);
  await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles({name:"pending.png",mimeType:"image/png",buffer:await sample()});await page.context().clearCookies();await page.getByRole("button",{name:"사진 저장 상태 확인",exact:true}).click();await expect(page.getByLabel("개발 접근 코드")).toBeVisible();await expect(page.getByRole("img")).toHaveCount(0);await expect(page.getByLabel("참고 사진 선택",{exact:true})).toHaveCount(0);
});
test("a partially saved batch shows the saved photo and retries only the remaining file",async({page})=>{
  await login(page);await page.getByLabel("문제 설명").fill("합성 두 번째 사진 연결 실패 검사");const buffer=await sample();
  await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles([{name:"first.png",mimeType:"image/png",buffer},{name:"second.png",mimeType:"image/png",buffer}]);
  let uploads=0;await page.route("**/api/v2/core/tickets/*/photos",route=>{if(route.request().method()!=="POST")return route.continue();uploads++;return uploads===2?route.abort():route.continue();});
  await page.getByRole("button",{name:"접수하기",exact:true}).click();await expect(page.getByText(/사진 전송 결과를 확인하지 못했습니다/)).toBeVisible();await expect(saved(page).getByRole("img")).toHaveCount(1);await expect(page.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();await expect(page.getByAltText("전송 전 사진 2 미리보기")).toHaveCount(0);
  await page.getByRole("button",{name:"사진만 전송",exact:true}).click();await expect(saved(page).getByRole("img")).toHaveCount(2);await expect(page.getByAltText("전송 전 사진 1 미리보기")).toHaveCount(0);expect(uploads).toBe(3);
});
test("real photo endpoints enforce size, type, count, idempotency, ownership and completed state",async({request})=>{
  const keys=await codes(),auth=(who="tenant")=>({Authorization:`Bearer ${keys[who]}`}),unit=(await (await request.get("/api/v2/core/units",{headers:auth()})).json())[0].id;
  const t=await (await request.post("/api/v2/core/tickets",{headers:auth(),data:{unitId:unit,issueType:"LEAK",rawUserText:"합성 사진 API 검사"}})).json(),path=`/api/v2/core/tickets/${t.ticketId}/photos`,bytes=await sample(),upload=randomUUID();
  const post=(body:Buffer,id=randomUUID(),mime="image/png",who="tenant")=>request.post(path,{headers:{...auth(who),"Content-Type":mime,"X-Upload-Id":id},data:body});
  const first=await post(bytes,upload);expect(first.status()).toBe(201);const photo=await first.json();const same=await post(bytes,upload);expect(same.status()).toBe(200);expect(await same.json()).toEqual(photo);
  expect((await post(await sample("image/jpeg"),upload,"image/jpeg")).status()).toBe(409);
  expect((await post(Buffer.alloc(5*1024*1024+1))).status()).toBe(413);expect((await post(Buffer.from("<svg/>"),randomUUID(),"image/svg+xml")).status()).toBe(415);expect((await post(bytes,randomUUID(),"image/jpeg")).status()).toBe(415);expect((await post(Buffer.from([137,80,78,71,13,10,26,10]))).status()).toBe(400);
  expect((await post(bytes)).status()).toBe(201);expect((await Promise.all([post(bytes),post(bytes)])).map(r=>r.status()).sort()).toEqual([201,409]);
  for(const who of ["tenantPeer","otherTenant","otherManager"]){expect((await request.get(path,{headers:auth(who)})).status()).toBe(404);expect((await request.get(photo.path,{headers:auth(who)})).status()).toBe(404);expect((await post(bytes,randomUUID(),"image/png",who)).status()).toBe(404);}
  expect((await request.get(photo.path)).status()).toBe(401);for(const who of ["manager","staff"])expect((await post(bytes,randomUUID(),"image/png",who)).status()).toBe(403);
  const image=await request.get(photo.path,{headers:auth("manager")});expect(image.status()).toBe(200);expect(image.headers()["cache-control"]).toBe("private, no-store");expect(image.headers()["x-content-type-options"]).toBe("nosniff");expect(image.headers()["content-type"]).toBe("image/png");expect((await image.body()).length).toBe(photo.byteSize);
  for(const status of ["IN_PROGRESS","COMPLETED"])expect((await request.post(`/api/v2/core/tickets/${t.ticketId}/handling`,{headers:auth("manager"),data:{status,message:"합성 관리자 처리"}})).status()).toBe(200);
  expect((await post(bytes)).status()).toBe(409);expect((await request.get(photo.path,{headers:auth()})).status()).toBe(200);
});

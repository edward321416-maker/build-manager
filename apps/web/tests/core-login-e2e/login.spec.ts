import { test,expect } from "@playwright/test";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import sharp from "sharp";
import { sdkSession,base,privateRoot } from "./session";
const saved=(page:import("@playwright/test").Page)=>page.getByRole("region",{name:"사진",exact:true});
const evidenceRoot=join(privateRoot,"desktop-presentation");
async function layout(page:import("@playwright/test").Page,width:number){
 await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toHaveCount(1);
 await expect(page.locator("main main")).toHaveCount(0);
 const account=await page.getByRole("region",{name:"로그인과 내 소속"}).boundingBox(),workspace=await page.getByRole("region",{name:"수리 접수 작업",exact:true}).boundingBox();
 expect(account).not.toBeNull();expect(workspace).not.toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width>=1024){
  expect(account!.x+account!.width).toBeLessThanOrEqual(workspace!.x);
  expect(workspace!.width).toBeGreaterThan(width*.6);
  expect(account!.y).toBe(workspace!.y);
 }else{
  expect(account!.y+account!.height).toBeLessThanOrEqual(workspace!.y);
  expect(workspace!.width).toBeGreaterThan(width*.9);
 }
 // Inspect real control geometry and hit targets, without fixed pixel snapshots.
 const controls=await page.evaluate(()=>Array.from(document.querySelectorAll('button,a,select,textarea,input:not([type="hidden"])')).map(el=>{
  const r=el.getBoundingClientRect(),style=getComputedStyle(el),x=r.x+r.width/2,y=r.y+r.height/2;
  const inView=r.width>0&&r.height>0&&r.y>=0&&r.bottom<=innerHeight;
  return{tag:el.tagName,textContent:el.tagName==='SELECT'?'[server-scoped options]':el.textContent?.trim(),role:el.getAttribute('role'),parent:el.parentElement?.className,box:{x:r.x,y:r.y,width:r.width,height:r.height},position:style.position,inView,inside:r.x>=0&&r.right<=document.documentElement.clientWidth,hit:!inView||el.contains(document.elementFromPoint(x,y)),inShell:!!el.closest('.core-b1-shell')};
 }));
 expect(controls.filter(c=>c.box.width>0&&c.box.height>0).every(c=>c.inside&&c.inShell)).toBe(true);
 expect(controls.filter(c=>c.inView).every(c=>c.hit)).toBe(true);
 await mkdir(evidenceRoot,{recursive:true});
 await writeFile(join(evidenceRoot,`controls-${width}.json`),JSON.stringify({width,account,workspace,controls},null,2));
}
for(const width of [320,1280,390])test(`synthetic SDK completion -> workspace -> tenant photo -> manager handling -> reconnect -> existing POST logout (${width}px)`,async({browser})=>{
 const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager");
 const viewport={width,height:width===1280?900:width===390?844:800};
 const capture=(actor:string)=>join(evidenceRoot,`login-${actor}-${width===1280?'desktop':'mobile'}-${width}.png`);
 try{
  const page=await tenant.context.newPage();await page.setViewportSize(viewport);await page.goto("/workspace");await page.getByRole("link",{name:"내 호실 수리 접수·사진·처리 이력 열기"}).click();
  await expect(page.getByTestId("unit-context")).toBeVisible();await expect(page.getByLabel("개발 접근 코드")).toHaveCount(0);
  const accountBox=(await page.getByRole("region",{name:"로그인과 내 소속"}).boundingBox())!;
  if(width<1024)expect(accountBox.height).toBeLessThan(300);else expect(accountBox.width).toBe(250);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await layout(page,width);
  await page.getByLabel("문제 설명").fill("로그인 연결 합성 누수 — 사진과 처리 이력");
  const bytes=await sharp(Buffer.from('<svg width="300" height="180" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="180" fill="#edf3ef"/><path d="M35 45H140V100H265" fill="none" stroke="#718e94" stroke-width="25"/><path d="M140 122q-15 19 0 24q15-5 0-24" fill="#278dca"/><text x="12" y="168" font-size="13" fill="#244b43">SYNTHETIC LEAK SAMPLE</text></svg>')).png().toBuffer();
  await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:bytes});
  const created=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");await page.getByRole("button",{name:"접수하기",exact:true}).click();const ticket=await (await created).json();
  await expect(saved(page).getByRole("img")).toHaveCount(1);await expect(page.getByText("사진을 저장했습니다.",{exact:false})).toBeVisible();
  await expect.poll(()=>saved(page).getByRole("img").evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));await layout(page,width);await page.screenshot({path:capture("tenant"),fullPage:true});
  const m=await manager.context.newPage();await m.setViewportSize(viewport);await m.goto("/core");
  // Existing live tenant units are preserved; the manager's first sorted unit may differ.
  await m.getByLabel("건물·호실").selectOption(tenant.fixture.unitA);
  await m.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();
  await expect(saved(m).getByRole("img")).toHaveCount(1);await m.getByLabel("처리 기록").fill("로그인한 관리자가 합성 사진 확인 후 처리 시작");await m.getByRole("button",{name:"처리 시작 기록",exact:true}).click();await expect(m.getByTestId("work-status")).toHaveText("처리중");
  await expect.poll(()=>saved(m).getByRole("img").evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
  await m.evaluate(()=>scrollTo(0,0));await layout(m,width);await m.screenshot({path:capture("manager"),fullPage:true});
  await page.reload();await page.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();await expect(page.getByTestId("work-status")).toHaveText("처리중");await expect(saved(page).getByRole("img")).toHaveCount(1);
  const photos=await (await tenant.context.request.get(`/api/v2/core/tickets/${ticket.ticketId}/photos`,{headers:tenant.headers})).json();
  await page.evaluate(()=>scrollTo(0,0));await layout(page,width);await page.screenshot({path:capture("reconnected"),fullPage:true});
  const ending=page.waitForResponse(r=>r.url().endsWith("/api/v2/session/logout"));await page.getByRole("button",{name:"로그아웃",exact:true}).click();
  // No provider exists in this synthetic run. Local registry revoke still precedes its failure.
  expect((await ending).status()).toBe(503);
  expect((await tenant.context.request.get(photos[0].path,{headers:tenant.headers})).status()).toBe(401);
  await page.goto("/core");await expect(page.getByRole("link",{name:"계정으로 로그인"})).toBeVisible();await expect(page.getByRole("img",{name:/사진/})).toHaveCount(0);
  await page.screenshot({path:capture("logged-out"),fullPage:true});
 }finally{await tenant.close();await manager.close();}
});
test("768px tablet uses the available width with account above workspace",async({browser})=>{
 const tenant=await sdkSession(browser);
 try{const page=await tenant.context.newPage();await page.setViewportSize({width:768,height:1024});await page.goto("/core");await expect(page.getByTestId("unit-context")).toBeVisible();await layout(page,768);await page.screenshot({path:join(evidenceRoot,"login-tenant-tablet-768.png"),fullPage:true});}
 finally{await tenant.close();}
});
test("ended occupancy, assignment and membership revoke B1 raw photo access",async({browser})=>{
 const tenant=await sdkSession(browser,"none"),staff=await sdkSession(browser,"none");
 try{
  const actor=async(a:typeof tenant)=>(await a.admin.query("SELECT authn.current_actor($1) id",[a.digest])).rows[0].id;
  const tenantId=await actor(tenant),staffId=await actor(staff),org=tenant.fixture.orgA;
  const occ=(await tenant.admin.query("SELECT id FROM app.occupancy WHERE org_id=$1 AND unit_id=$2 AND status='ACTIVE'",[org,tenant.fixture.unitA])).rows[0].id;
  await tenant.admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,status,joined_at) VALUES($1,$2,$3,'ACTIVE',clock_timestamp())",[org,occ,tenantId]);
  const member=(await staff.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'PROPERTY_STAFF','ACTIVE') RETURNING id",[org,staffId])).rows[0].id;
  await staff.admin.query("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')",[org,member,staff.fixture.propertyA]);
  const r=await tenant.context.request.post("/api/v2/core/tickets",{headers:tenant.headers,data:{unitId:tenant.fixture.unitA,issueType:"LEAK",rawUserText:"합성 종료 경계 사진"}});expect(r.status()).toBe(201);const t=await r.json();
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:"#345678"}}).png().toBuffer();const up=await tenant.context.request.post(`/api/v2/core/tickets/${t.ticketId}/photos`,{headers:{...tenant.headers,"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:bytes});expect(up.status()).toBe(201);const photo=await up.json();
  expect((await staff.context.request.get(photo.path,{headers:staff.headers})).status()).toBe(200);
  await staff.admin.query("UPDATE app.property_assignment SET status='ENDED',ended_at=clock_timestamp() WHERE membership_id=$1",[member]);expect((await staff.context.request.get(photo.path,{headers:staff.headers})).status()).toBe(404);
  await staff.admin.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[member]);expect((await staff.context.request.get(photo.path,{headers:staff.headers})).status()).toBe(403);
  await tenant.admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE user_id=$1",[tenantId]);expect((await tenant.context.request.get(photo.path,{headers:tenant.headers})).status()).toBe(403);
 }finally{await tenant.close();await staff.close();}
});
test("no-association and account switch clear prior actor UI, never offer developer-code fallback",async({browser})=>{
 const tenant=await sdkSession(browser),none=await sdkSession(browser,"none");
 try{const p=await none.context.newPage();await p.goto("/core");await expect(p.getByText("연결된 소속·호실이 없습니다.",{exact:false})).toBeVisible();await expect(p.getByRole("button",{name:"로그아웃"})).toBeVisible();await p.screenshot({path:join(evidenceRoot,"login-no-association-320.png"),fullPage:true});
  const page=await tenant.context.newPage();await page.goto("/core");await expect(page.getByLabel("문제 설명")).toBeVisible();await tenant.context.addCookies([{name:"__session",value:none.cookie,url:base,httpOnly:true,sameSite:"Lax"}]);
  // Visibility revalidation can already clear the old screen after cookie switch.
  // If still mounted, dispatch its refresh atomically rather than waiting for a removed button.
  await page.evaluate(()=>{const refresh=Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="새로고침");refresh?.click();});await expect(page.getByRole("link",{name:"계정으로 로그인"})).toBeVisible();await expect(page.getByLabel("문제 설명")).toHaveCount(0);await expect(page.getByLabel("개발 접근 코드")).toHaveCount(0);
 }finally{await tenant.close();await none.close();}
});
test("B1 photo authorization, spoofed credentials, exact CSRF/Origin and registry expiry",async({browser,request})=>{
 const actors=await Promise.all(["tenant","manager","staff","tenantPeer","otherTenant","otherManager"].map(w=>sdkSession(browser,w)));
 try{const [t,m,s,peer,other,otherM]=actors;
  const response=await t.context.request.post("/api/v2/core/tickets",{headers:t.headers,data:{unitId:t.fixture.unitA,issueType:"LEAK",rawUserText:"합성 로그인 권한 검사"}});expect(response.status()).toBe(201);const ticket=await response.json();
  const path=`/api/v2/core/tickets/${ticket.ticketId}/photos`,bytes=await sharp({create:{width:4,height:4,channels:3,background:"#335566"}}).png().toBuffer();
  const uploaded=await t.context.request.post(path,{headers:{...t.headers,"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:bytes});expect(uploaded.status()).toBe(201);const photo=await uploaded.json();
  for(const a of [t,m,s])expect((await a.context.request.get(photo.path,{headers:a.headers})).status()).toBe(200);
  for(const a of [peer,other,otherM])expect((await a.context.request.get(photo.path,{headers:a.headers})).status()).toBe(404);
  expect((await request.get(photo.path,{headers:{Authorization:`Bearer ${"a".repeat(64)}`,Cookie:`rc1_session=${"b".repeat(64)}`}})).status()).toBe(401);
  expect((await t.context.request.get(photo.path,{headers:{...t.headers,Authorization:`Bearer ${"a".repeat(64)}`}})).status()).toBe(200);
  for(const headers of [{...t.headers,"x-b1-csrf":"c".repeat(64)},{...t.headers,Origin:"https://foreign.invalid"}])expect((await t.context.request.post(path,{headers:{...headers,"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:bytes})).status()).toBe(403);
  expect((await t.context.request.get(path+"/"+randomUUID(),{headers:t.headers})).status()).toBe(404);
  await t.admin.query("UPDATE authn.web_session SET created_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '1 hour' WHERE digest=$1",[t.digest]);
  expect((await t.context.request.get(photo.path,{headers:t.headers})).status()).toBe(401);
 }finally{await Promise.all(actors.map(a=>a.close()));}
});
test("two tabs retain request organization; arbitrary org is denied and old-org data is cleared",async({browser})=>{
 const a=await sdkSession(browser,"none");
 try{
  const actor=(await a.admin.query("SELECT authn.current_actor($1) AS id",[a.digest])).rows[0].id;
  for(const org of [a.fixture.orgA,a.fixture.orgB])await a.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')",[org,actor]);
  const first=await a.context.newPage(),second=await a.context.newPage();await first.goto("/core");await second.goto("/core");
  await first.getByLabel("내 소속",{exact:true}).selectOption(a.fixture.orgA);await second.getByLabel("내 소속",{exact:true}).selectOption(a.fixture.orgB);
  await expect(first.getByLabel("건물·호실")).toContainText("건물 A");await expect(second.getByLabel("건물·호실")).toContainText("건물 B");
  await first.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침"}).click();await expect(first.getByLabel("건물·호실")).toContainText("건물 A");
  const results=await Promise.all([a.fixture.orgA,a.fixture.orgB].map(org=>a.context.request.get("/api/v2/core/units",{headers:{...a.headers,"x-core-organization":org}}).then(r=>r.json())));
  expect(results[0].every((u:{buildingId:string})=>u.buildingId===a.fixture.propertyA)).toBe(true);expect(results[1].every((u:{buildingId:string})=>u.buildingId===a.fixture.propertyB)).toBe(true);
  expect((await a.context.request.post("/api/v2/core/organization",{headers:{...a.headers,"x-core-organization":randomUUID()},data:{}})).status()).toBe(403);
 }finally{await a.close();}
});

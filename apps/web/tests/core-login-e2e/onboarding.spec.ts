import { openInspector } from "../core-e2e/presentation";
import { test,expect,type Page } from "@playwright/test";
import { createHash,randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { sdkSession,base,privateRoot } from "./session";

/** Separate synthetic test actors/org. Never change any existing real/SDK manager's privileges. */
async function setup(browser:import("@playwright/test").Browser){
 const manager=await sdkSession(browser,"onboarding-manager-"+randomUUID()),tenant=await sdkSession(browser,"onboarding-tenant-"+randomUUID());
 const org=randomUUID(),property=randomUUID(),unit=randomUUID(),name="합성 초대 테스트 호실";
 const managerId=(await manager.admin.query("SELECT authn.current_actor($1) id",[manager.digest])).rows[0].id;
 await manager.admin.query("INSERT INTO app.organization(id,status,display_name) VALUES($1,'ACTIVE','합성 초대 테스트 조직')",[org]);
 await manager.admin.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,org]);
 await manager.admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",[unit,org,property,name]);
 await manager.admin.query("INSERT INTO app.organization_membership(org_id,user_id,role,status) VALUES($1,$2,'ORG_ADMIN','ACTIVE')",[org,managerId]);
 await manager.admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) SELECT $1::uuid,$2::uuid,body||jsonb_build_object('id',($2::uuid)::text,'displayName','합성 초대 테스트 건물') FROM core_flow.building_context WHERE org_id=$3 AND property_id=$4",[org,property,manager.fixture.orgA,manager.fixture.propertyA]);
 const headers={...manager.headers,"x-core-organization":org},page=await manager.context.newPage();await page.setViewportSize({width:1280,height:900});await page.goto("/core");await page.getByRole("link",{name:"입주 연결",exact:true}).click();await expect(page.getByRole("combobox",{name:/^호실/})).toBeVisible();
 return {manager,tenant,page,org,unit,name,headers,async close(){await manager.close();await tenant.close();}};
}
async function create(page:Page){const reply=page.waitForResponse(r=>r.url().endsWith("/onboarding/create"));await page.getByRole("button",{name:"초대 링크 만들기",exact:true}).click();const response=await reply;expect(response.status()).toBe(201);return await response.json() as {link:string;invitation:{invitationId:string}};}
async function openInvitation(page:Page,link:string){try{await page.goto(link);}catch{throw new Error("INVITATION_NAVIGATION_FAILED");}await expect.poll(()=>page.url()===base+"/core/join").toBe(true);}
async function request(page:Page,link:string){await openInvitation(page,link);await page.getByRole("button",{name:"초대 내용 확인",exact:true}).click();await expect(page.getByText("신청 대기",{exact:true})).toBeVisible();const response=page.waitForResponse(r=>r.url().endsWith("/onboarding/claim"));await page.getByRole("button",{name:"연결 요청 보내기",exact:true}).click();expect((await response).status()).toBe(200);await expect(page.getByText("관리자 확인 대기",{exact:true})).toBeVisible();}
async function approve(page:Page){await page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();await expect(page.getByRole("button",{name:"연결 상태 새로고침",exact:true})).toBeEnabled();const card=page.getByRole("article",{name:"합성 초대 테스트 호실 초대"});await card.getByRole("checkbox").check();await card.getByRole("button",{name:"승인",exact:true}).click();await expect(card.getByText("연결 승인",{exact:true})).toBeVisible();}
const saved=(page:Page)=>page.getByRole("region",{name:"사진",exact:true});
const error=(page:Page)=>page.getByRole("region",{name:"호실 연결",exact:true}).getByRole("alert");
test("UI invitation -> zero-org SDK request -> manager approval -> unit/photo -> manager handling -> tenant reconnect at1280/390",async({browser})=>{
 const f=await setup(browser);try{
  const {link,invitation}=await create(f.page),tenant=await f.tenant.context.newPage();await tenant.setViewportSize({width:390,height:844});
  await tenant.goto("/core");await expect(tenant.getByText("연결된 소속·호실이 없습니다.",{exact:false})).toBeVisible();
  const calls:string[]=[];tenant.on("request",r=>{if(r.url().includes("/onboarding/"))calls.push(r.method()+" "+new URL(r.url()).pathname);});
  await openInvitation(tenant,link);await expect(tenant.getByRole("button",{name:"초대 내용 확인"})).toBeVisible();expect(calls.filter(x=>x.startsWith("POST"))).toEqual([]);
  expect(await tenant.evaluate(()=>({hash:location.hash,local:localStorage.length,session:sessionStorage.length}))).toEqual({hash:"",local:0,session:0});
  await request(tenant,link);
  const requestNumber=await tenant.locator(".request-number").innerText();expect(requestNumber).toMatch(/^[a-f0-9-]{36}$/);
  expect((await (await f.tenant.context.request.get("/api/v2/core/access")).json()).organizations).toEqual([]);
  await f.page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();await expect(f.page.getByText(requestNumber,{exact:true})).toBeVisible();
  await expect(f.page.getByRole("button",{name:"승인",exact:true})).toBeDisabled();
  const root=join(privateRoot,"onboarding-sdk");await mkdir(root,{recursive:true});await tenant.screenshot({path:join(root,"requested-390.png"),fullPage:true});await f.page.screenshot({path:join(root,"manager-requested-1280.png"),fullPage:true});
  await approve(f.page);await tenant.getByRole("button",{name:"요청 상태 확인"}).click();await expect(tenant.getByText("연결 승인",{exact:true})).toBeVisible();
  await tenant.getByRole("link",{name:"내 호실로 돌아가기"}).click();await expect(tenant.getByTestId("unit-context")).toContainText(f.name);
  await tenant.getByRole("radio",{name:"누수",exact:true}).check();await tenant.getByLabel("문제 설명").fill("초대 승인 후 합성 누수 글과 사진 접수");
  const bytes=await sharp({create:{width:240,height:140,channels:3,background:"#84aa96"}}).png().toBuffer();await tenant.getByLabel("참고 사진 선택",{exact:true}).setInputFiles({name:"synthetic-invitation.png",mimeType:"image/png",buffer:bytes});await expect(tenant.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();
  const created=tenant.waitForResponse(r=>r.url().endsWith("/core/tickets")&&r.request().method()==="POST");await tenant.getByRole("button",{name:"접수하기",exact:true}).click();const ticket=await (await created).json();await expect(saved(tenant).getByRole("img")).toHaveCount(1);
  await f.page.getByRole("link",{name:"업무함",exact:true}).click();await f.page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();await f.page.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();await expect(saved(f.page).getByRole("img")).toHaveCount(1);await openInspector(f.page);await f.page.getByLabel("처리 기록").fill("합성 초대 연결 사진을 확인하고 처리 시작");await f.page.getByRole("button",{name:"처리 시작 기록",exact:true}).click();await expect(f.page.getByTestId("work-status")).toHaveText("처리중");
  await tenant.reload();await tenant.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();await expect(tenant.getByTestId("work-status")).toHaveText("처리중");await expect(saved(tenant).getByRole("img")).toHaveCount(1);
  expect(await tenant.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await tenant.screenshot({path:join(root,"connected-photo-reentry-390.png"),fullPage:true});
  const row=(await f.manager.admin.query("SELECT i.state,count(m.id)::int n FROM core_onboarding.invitation i JOIN app.occupancy_member m ON m.id=i.occupant_id AND m.occupancy_id=i.occupancy_id WHERE i.id=$1 GROUP BY i.state",[invitation.invitationId])).rows[0];expect(row).toEqual({state:"APPROVED",n:1});
 }finally{await f.close();}
});
test("create and claim lost responses recover by reading status without duplicate mutation",async({browser})=>{
 const f=await setup(browser);try{
  await f.page.route("**/onboarding/create",async route=>{await route.fetch();await route.abort("failed");});await f.page.getByRole("button",{name:"초대 링크 만들기",exact:true}).click();await expect(error(f.page)).toBeVisible();await expect(f.page.getByRole("button",{name:"초대 링크 만들기",exact:true})).toBeDisabled();
  await f.page.unroute("**/onboarding/create");await f.page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();const card=f.page.getByRole("article",{name:"합성 초대 테스트 호실 초대"});await card.getByRole("button",{name:"초대 취소",exact:true}).click();await expect(card.getByText("초대 취소",{exact:true})).toBeVisible();
  const {link,invitation}=await create(f.page),t=await f.tenant.context.newPage();await openInvitation(t,link);await t.getByRole("button",{name:"초대 내용 확인"}).click();
  await t.route("**/onboarding/claim",async route=>{await route.fetch();await route.abort("failed");});await t.getByRole("button",{name:"연결 요청 보내기"}).click();await expect(t.getByRole("alert").filter({hasText:"응답을 확인하지 못했습니다."})).toBeVisible();await expect(t.getByRole("button",{name:"연결 요청 보내기"})).toBeDisabled();
  await t.getByRole("button",{name:"요청 상태 확인"}).click();await expect(t.getByText("관리자 확인 대기",{exact:true})).toBeVisible();
  expect((await f.manager.admin.query("SELECT count(*)::int n FROM core_onboarding.invitation WHERE id=$1 AND applicant_id IS NOT NULL",[invitation.invitationId])).rows[0].n).toBe(1);
 }finally{await f.close();}
});
test("clipboard denial explains recovery without exposing or recreating the token",async({browser})=>{
 const f=await setup(browser);try{
  const {link}=await create(f.page);
  await f.page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async()=>{throw new DOMException("Permission denied","NotAllowedError");}}}));
  await f.page.getByRole("button",{name:"초대 링크 복사",exact:true}).click();await expect(error(f.page)).toContainText("브라우저가 복사를 허용하지 않았습니다.");
  expect(await f.page.locator("body").innerText()).not.toContain(new URL(link).hash.slice(1));
  expect((await f.manager.admin.query("SELECT count(*)::int n FROM core_onboarding.invitation WHERE unit_id=$1",[f.unit])).rows[0].n).toBe(1);
 }finally{await f.close();}
});
test("lost approval response is read back; repeated approval creates only one occupancy",async({browser})=>{
 const f=await setup(browser);try{
  const {link,invitation}=await create(f.page),t=await f.tenant.context.newPage();await request(t,link);await f.page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();
  const card=f.page.getByRole("article",{name:"합성 초대 테스트 호실 초대"});await card.getByRole("checkbox").check();await f.page.route("**/onboarding/approve",async route=>{await route.fetch();await route.abort("failed");});await card.getByRole("button",{name:"승인",exact:true}).click();await expect(error(f.page)).toBeVisible();await expect(card.getByRole("button",{name:"승인",exact:true})).toBeDisabled();
  await f.page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();await expect(card.getByText("연결 승인",{exact:true})).toBeVisible();
  const row=(await f.manager.admin.query("SELECT request_id,count(occupancy_id)::int n FROM core_onboarding.invitation WHERE id=$1 GROUP BY request_id",[invitation.invitationId])).rows[0];expect(row.n).toBe(1);
  expect((await f.manager.context.request.post("/api/v2/core/onboarding/approve",{headers:f.headers,data:{invitationId:invitation.invitationId,requestNumber:row.request_id}})).status()).toBe(200);
  expect((await f.manager.admin.query("SELECT count(*)::int n FROM app.occupancy WHERE unit_id=$1",[f.unit])).rows[0].n).toBe(1);
 }finally{await f.close();}
});
for(const kind of ["reject","revoke","expire"] as const)test(`${kind} preserves denied connection state through page reentry`,async({browser})=>{
 const f=await setup(browser);try{
  const {link,invitation}=await create(f.page),t=await f.tenant.context.newPage();await request(t,link);
  if(kind==="expire")await f.manager.admin.query("UPDATE core_onboarding.invitation SET created_at=clock_timestamp()-interval '25 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[invitation.invitationId]);
  else{await f.page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();const card=f.page.getByRole("article",{name:"합성 초대 테스트 호실 초대"});if(kind==="reject")await card.getByRole("checkbox").check();await card.getByRole("button",{name:kind==="reject"?"거절":"초대 취소",exact:true}).click();await expect(card.getByText(kind==="reject"?"연결 거절":"초대 취소",{exact:true})).toBeVisible();}
  await t.goto("/core");await expect(t.getByText(kind==="expire"?"초대 만료":kind==="reject"?"연결 거절":"초대 취소",{exact:true})).toBeVisible();expect((await (await f.tenant.context.request.get("/api/v2/core/access")).json()).organizations).toEqual([]);
  expect((await f.manager.admin.query("SELECT count(*)::int n FROM app.occupancy WHERE unit_id=$1",[f.unit])).rows[0].n).toBe(0);
 }finally{await f.close();}
});
test("logged out link never posts or carries token to Auth0; other actor and CSRF/Origin are denied",async({browser})=>{
 const f=await setup(browser);try{
  const {link}=await create(f.page),context=await browser.newContext(),page=await context.newPage(),posts:string[]=[];
  page.on("request",r=>{if(r.method()==="POST")posts.push(new URL(r.url()).pathname);});await openInvitation(page,link);await expect(page.getByRole("link",{name:"기존 계정으로 로그인"})).toHaveAttribute("href","/auth/login");expect(posts).toEqual([]);const r=await context.request.get(base+"/core/join");expect(r.headers()["referrer-policy"]).toBe("no-referrer");expect(r.headers()["cache-control"]).toContain("no-store");await context.close();
  const token=new URL(link).hash.slice(1),headers={Origin:base,"x-b1-csrf":f.tenant.csrf};
  expect((await f.tenant.context.request.post("/api/v2/core/onboarding/claim",{headers:{Origin:base},data:{token}})).status()).toBe(403);
  expect((await f.tenant.context.request.post("/api/v2/core/onboarding/claim",{headers:{...headers,Origin:"http://foreign.invalid"},data:{token}})).status()).toBe(403);
  const t=await f.tenant.context.newPage();await request(t,link);
  expect((await f.manager.context.request.post("/api/v2/core/onboarding/claim",{headers:f.headers,data:{token}})).status()).toBe(404);
  const digest=(await f.manager.admin.query("SELECT encode(token_digest,'hex') digest FROM core_onboarding.invitation WHERE unit_id=$1",[f.unit])).rows[0].digest;expect(digest===createHash("sha256").update(token).digest("hex")).toBe(true);expect(digest===token).toBe(false);
 }finally{await f.close();}
});

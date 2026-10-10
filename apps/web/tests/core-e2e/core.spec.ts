import { openInspector } from "./presentation";
import { test,expect,type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
const privateRoot=join(homedir(),".build-manager-rc1-private");
const codes=async()=>JSON.parse(await readFile(join(privateRoot,"access-codes.json"),"utf8")) as Record<string,string>;
async function login(page:Page,who:string){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill((await codes())[who]);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();}

test("Web tenant creates, another browser manager handles, tenant reloads and reopens persistent history",async({browser,page})=>{
  await login(page,"tenant");await page.getByRole("radio",{name:"누수",exact:true}).check();await page.getByLabel("문제 설명").fill("RC1 합성 누수 접수 — 브라우저 왕복");
  const created=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");await page.getByRole("button",{name:"접수하기",exact:true}).click();const response=await created;expect(response.status()).toBe(201);const ticket=await response.json();
  await expect(page.getByTestId("work-status")).toHaveText("제출 전");
  const managerContext=await browser.newContext(),manager=await managerContext.newPage();
  try{await login(manager,"manager");await manager.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();
    await openInspector(manager);await manager.getByLabel("처리 기록").fill("합성 점검 시작");await manager.getByRole("button",{name:"처리 시작 기록",exact:true}).click();await expect(manager.getByTestId("work-status")).toHaveText("처리중");
    await openInspector(manager);await manager.getByLabel("처리 기록").fill("합성 조치 결과를 관리자가 확인했습니다");await manager.getByRole("button",{name:"처리 완료 기록",exact:true}).click();await expect(manager.getByTestId("work-status")).toHaveText("✓ 처리 완료");
    await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.getByTestId("work-status")).toHaveText("✓ 처리 완료");await expect(page.getByText("합성 조치 결과를 관리자가 확인했습니다",{exact:false})).toBeVisible();
    await page.reload();await page.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();await expect(page.getByTestId("work-status")).toHaveText("✓ 처리 완료");
    await page.screenshot({path:join(privateRoot,"web-tenant-result.png"),fullPage:true});await manager.screenshot({path:join(privateRoot,"web-manager-result.png"),fullPage:true});
  }finally{await managerContext.close();}
});

test("real native bearer contract denies peer/foreign/manager creation and anonymous access",async({request})=>{
  const keys=await codes(),headers=(who:string)=>({Authorization:`Bearer ${keys[who]}`});
  const peerBefore=await request.get("/api/v2/core/tickets",{headers:headers("tenantPeer")});expect(peerBefore.status()).toBe(200);const ownTickets=await peerBefore.json();
  const units=await request.get("/api/v2/core/units",{headers:headers("tenant")});expect(units.status()).toBe(200);const unit=(await units.json())[0].id;
  const created=await request.post("/api/v2/core/tickets",{headers:headers("tenant"),data:{unitId:unit,issueType:"HEATING",rawUserText:"가스 냄새가 나요"}});expect(created.status()).toBe(201);const t=await created.json();expect(t.detail.status).toBe("SAFETY_ESCALATED");
  for(const who of ["tenantPeer","tenantOther","otherTenant","otherManager"]){const r=await request.get(`/api/v2/core/tickets/${t.ticketId}`,{headers:headers(who)});expect(r.status()).toBe(404);expect(await r.text()).not.toContain(t.ticketId);}
  expect((await request.get(`/api/v2/core/tickets/${t.ticketId}`)).status()).toBe(401);
  expect((await request.post(`/api/v2/core/tickets/${t.ticketId}/handling`,{headers:headers("tenant"),data:{status:"IN_PROGRESS",message:"forbidden"}})).status()).toBe(403);
  expect((await request.post("/api/v2/core/tickets",{headers:headers("manager"),data:{unitId:unit,issueType:"LEAK",rawUserText:"forbidden"}})).status()).toBe(403);
  const list=await request.get("/api/v2/core/tickets",{headers:headers("tenantPeer")});expect(list.status()).toBe(200);const peerAfter=await list.json();expect(peerAfter).toEqual(ownTickets);expect(peerAfter.map((ticket:{ticketId:string})=>ticket.ticketId)).not.toContain(t.ticketId);
});

test("text intake, manager follow-up and tenant answer use the same persistent protocol",async({request})=>{
  const keys=await codes(),headers=(who:string)=>({Authorization:`Bearer ${keys[who]}`});
  const unit=(await (await request.get("/api/v2/core/units",{headers:headers("tenant")})).json())[0].id;
  const post=async(path:string,data:unknown,who="tenant")=>{const r=await request.post(`/api/v2/core/tickets${path}`,{headers:headers(who),data});expect(r.status()).toBe(path?200:201);return r.json();};
  let t=await post("",{unitId:unit,issueType:"HEATING",rawUserText:"합성 난방이 약합니다"});
  for(let i=0;i<15&&t.detail.activeQuestion;i++){const q=t.detail.activeQuestion;t=await post(`/${t.ticketId}/answers`,{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 답변"});}
  expect(t.detail.activeQuestion).toBeNull();t=await post(`/${t.ticketId}/finalize`,{});expect(t.detail.status).toBe("PARTIAL");
  const manager=await (await request.get(`/api/v2/core/tickets/${t.ticketId}`,{headers:headers("manager")})).json();const q=manager.detail.followUpOptions.questions[0];expect(q).toBeTruthy();
  t=await post(`/${t.ticketId}/decision`,{type:"REQUEST_MORE_INFO",reason:"합성 추가 확인",requestedQuestionIds:[q.questionId]},"manager");expect(t.detail.status).toBe("NEEDS_MORE_INFO");
  const reread=await (await request.get(`/api/v2/core/tickets/${t.ticketId}`,{headers:headers("tenant")})).json();expect(reread.detail.moreInfoRequest.reason).toBe("합성 추가 확인");
  t=await post(`/${t.ticketId}/answers`,{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 추가 답변"});
  t=await post(`/${t.ticketId}/finalize`,{});expect(t.events.map((e:{kind:string})=>e.kind)).toContain("MORE_INFO");expect(t.workStatus).toBe("OPEN");
});

test("a more-info round reads 추가 확인 on /core, never 제출 전, and resubmits from the to-do zone",async({request,page,browser})=>{
  const keys=await codes(),headers=(who:string)=>({Authorization:`Bearer ${keys[who]}`});
  const unit=(await (await request.get("/api/v2/core/units",{headers:headers("tenant")})).json())[0].id;
  const post=async(path:string,data:unknown,who="tenant")=>{const r=await request.post(`/api/v2/core/tickets${path}`,{headers:headers(who),data});expect(r.status()).toBe(path?200:201);return r.json();};
  let t=await post("",{unitId:unit,issueType:"HEATING",rawUserText:"합성 추가 확인 라운드"});
  for(let i=0;i<15&&t.detail.activeQuestion;i++){const q=t.detail.activeQuestion;t=await post(`/${t.ticketId}/answers`,{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 답변"});}
  t=await post(`/${t.ticketId}/finalize`,{});
  const q=(await (await request.get(`/api/v2/core/tickets/${t.ticketId}`,{headers:headers("manager")})).json()).detail.followUpOptions.questions[0];
  t=await post(`/${t.ticketId}/decision`,{type:"REQUEST_MORE_INFO",reason:"합성 추가 확인 라운드",requestedQuestionIds:[q.questionId]},"manager");expect(t.detail.status).toBe("NEEDS_MORE_INFO");
  await page.setViewportSize({width:390,height:844});await login(page,"tenant");
  const row=page.locator(`[data-ticket-id="${t.ticketId}"]`);await expect(row.locator("[data-work-state]")).toHaveText("접수");
  await row.locator("[data-open-ticket]").click();
  const zone=page.getByRole("region",{name:"지금 할 일: 추가 확인",exact:true});
  await expect(page.getByTestId("work-status")).toHaveText("접수");await expect(page.getByText("관리자가 추가 확인을 요청했어요.",{exact:false})).toBeVisible();await expect(zone).toContainText("답한 뒤 다시 제출해 주세요.");
  // Answering resets the server status to IN_PROGRESS; a request that was already sent must not read as unsubmitted.
  // The embedded questions load with their own GET of the same path; let it finish before listening for the re-read.
  await expect(zone.locator("form").first()).toBeVisible();await expect(zone.getByTestId("refresh")).toBeEnabled();
  const answered=page.waitForResponse(r=>r.url().endsWith(`/${t.ticketId}/answers`)&&r.request().method()==="POST");
  // The answer flips the server status, so the screen re-reads the request; assert only after that read landed.
  const reread=page.waitForResponse(r=>r.url().endsWith(`/api/v2/core/tickets/${t.ticketId}`)&&r.request().method()==="GET");
  if(q.responseType==="YES_NO")await zone.getByTestId("answer-no").click();else if(q.responseType==="SINGLE_SELECT")await zone.getByTestId("answer-"+q.options[0].value).click();else{await zone.getByLabel("답변",{exact:true}).fill("합성 추가 답변");await zone.getByTestId("answer-text-submit").click();}
  expect((await answered).status()).toBe(200);const after=await (await reread).json();expect(after.detail.status).toBe("IN_PROGRESS");
  await expect(page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true})).toBeEnabled();
  await expect(zone.getByTestId("refinalize")).toBeVisible();
  await expect(page.getByTestId("work-status")).toHaveText("접수");await expect(page.getByText("아직 보내지 않았어요",{exact:false})).toHaveCount(0);
  await expect(page.getByText("관리자가 추가 확인을 요청했어요.",{exact:false})).toBeVisible();
  const finalized=page.waitForResponse(r=>r.url().endsWith(`/${t.ticketId}/finalize`)&&r.request().method()==="POST");
  await zone.getByTestId("refinalize").click();expect((await finalized).status()).toBe(200);
  await expect(zone).toHaveCount(0);await expect(page.getByRole("status").filter({hasText:"수리 요청을 관리자에게 보냈어요."})).toBeVisible();await expect(page.getByTestId("ticket-heading")).toBeFocused();
  const managerContext=await browser.newContext(),manager=await managerContext.newPage();
  try{await login(manager,"manager");await manager.locator(`[data-ticket-id="${t.ticketId}"] [data-open-ticket]`).click();await expect(manager.getByTestId("work-status")).toHaveText("접수");}
  finally{await managerContext.close();}
});

test("revoked cookie session clears the protected screen on refresh",async({page})=>{
  await login(page,"tenantOther");await expect(page.getByRole("heading",{name:/^최근 접수/})).toBeVisible();
  const r=await page.request.post("/api/v2/core/logout",{headers:{Origin:"http://127.0.0.1:3131"},data:{}});expect(r.status()).toBe(200);
  await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.getByLabel("개발 접근 코드")).toBeVisible();await expect(page.getByRole("heading",{name:/^최근 접수/})).toHaveCount(0);
});

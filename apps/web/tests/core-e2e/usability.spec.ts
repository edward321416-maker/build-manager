import { openInspector } from "./presentation";
import { test,expect,type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const privateRoot=join(homedir(),".build-manager-rc1-private");
const alerts=(page:Page)=>page.getByRole("main",{name:"수리 접수 작업"}).getByRole("alert");
class CoreScreen {
  constructor(readonly page:Page){}
  async login(who:string){
    const codes=JSON.parse(await readFile(join(privateRoot,"access-codes.json"),"utf8")) as Record<string,string>;
    await this.page.goto("/core");
    await this.page.getByLabel("개발 접근 코드").fill(codes[who]!);
    await this.page.getByRole("button",{name:"들어가기",exact:true}).click();
    await expect(this.page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();
  }
  async assertFits(){
    expect(await this.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const button of await this.page.getByRole("button").all()){
      if(!await button.isVisible())continue;
      const box=await button.boundingBox();expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x+box!.width).toBeLessThanOrEqual(this.page.viewportSize()!.width);
    }
  }
}

test("320px tenant and manager can save and read a clear handling result",async({page,browser})=>{
  await page.setViewportSize({width:320,height:740});const tenant=new CoreScreen(page);await tenant.login("tenant");
  await tenant.assertFits();
  await page.getByRole("radio",{name:"누수",exact:true}).check();await page.getByLabel("문제 설명").fill("합성 작은 화면 누수 점검");
  const response=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"접수하기",exact:true}).click();const created=await response;expect(created.status()).toBe(201);const ticket=await created.json();
  await expect(page.getByRole("status").filter({hasText:"접수 내용을 저장했어요"})).toHaveText("접수 내용을 저장했어요. 이어서 아래 질문에 답해 주세요.");
  await expect(page.getByRole("region",{name:"진행 이력"})).toContainText("접수 내용 저장");
  await expect(page.getByTestId("ticket-heading")).toBeFocused();
  const managerContext=await browser.newContext({viewport:{width:320,height:740}}),manager=await managerContext.newPage();
  try{
    const managerScreen=new CoreScreen(manager);await managerScreen.login("manager");
    await manager.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();
    await manager.getByText("추가 확인·결정 기록",{exact:true}).click();await expect(manager.getByRole("heading",{name:`수리 요청 ${ticket.ticketId}`,exact:true})).toBeVisible();
    await managerScreen.assertFits();
    await manager.screenshot({path:join(privateRoot,"usability-manager-active-320.png"),fullPage:true});
    await openInspector(manager);await manager.getByLabel("처리 기록").fill("합성 현장 확인 시작");await manager.getByRole("button",{name:"처리 시작 기록",exact:true}).click();
    await expect(manager.getByRole("status").filter({hasText:"처리 시작 기록을 저장했습니다"})).toHaveText("처리 시작 기록을 저장했습니다. 세입자도 새로고침하면 확인할 수 있습니다.");
    await openInspector(manager);await manager.getByLabel("처리 기록").fill("합성 누수 조치 결과 확인");await manager.getByRole("button",{name:"처리 완료 기록",exact:true}).click();
    await expect(manager.getByRole("status").filter({hasText:"처리 완료 기록을 저장했습니다"})).toHaveText("처리 완료 기록을 저장했습니다. 세입자도 새로고침하면 확인할 수 있습니다.");await managerScreen.assertFits();
    await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();
    await expect(page.getByTestId("work-status")).toHaveText("✓ 처리 완료");
    await expect(page.getByRole("region",{name:"진행 이력"})).toContainText("합성 누수 조치 결과 확인");await tenant.assertFits();
    await page.screenshot({path:join(privateRoot,"usability-tenant-result-320.png"),fullPage:true});
    await manager.screenshot({path:join(privateRoot,"usability-manager-result-320.png"),fullPage:true});
    for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});await tenant.assertFits();}
  }finally{await managerContext.close();}
});

test("390px tenant answers the follow-up questions right after 접수하기 and the summary updates on submit",async({page,browser})=>{
  await page.setViewportSize({width:390,height:844});const tenant=new CoreScreen(page);await tenant.login("tenant");
  await page.getByRole("radio",{name:"난방",exact:true}).check();await page.getByLabel("문제 설명").fill("합성 난방 접수 마무리 확인");
  const response=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"접수하기",exact:true}).click();const created=await response;expect(created.status()).toBe(201);const ticket=await created.json();
  // Menu audit F-02: the draft says so plainly, and its questions sit open right under the summary.
  await expect(page.getByTestId("work-status")).toHaveText("제출 전");await expect(page.getByText("접수 상태:",{exact:false})).toHaveCount(0);
  await expect(page.getByText("아직 보내지 않았어요.",{exact:false})).toBeVisible();
  const zone=page.getByRole("region",{name:"지금 할 일: 추가 확인",exact:true});
  const firstQuestion=zone.locator("form").first();await expect(firstQuestion).toBeVisible();
  expect(await page.evaluate(()=>scrollY)).toBe(0);const box=await firstQuestion.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(844);
  await expect(page.locator("summary").filter({hasText:/^추가 확인$/})).toHaveCount(0);await expect(page.getByRole("main")).toHaveCount(1);
  await tenant.assertFits();
  for(let i=0;i<12&&!await zone.getByTestId("finalize").isVisible();i++){
    const no=zone.getByTestId("answer-no"),text=zone.getByLabel("답변",{exact:true});
    const answered=page.waitForResponse(r=>r.url().endsWith(`/${ticket.ticketId}/answers`)&&r.request().method()==="POST");
    if(await no.isVisible())await no.click();
    else if(await text.isVisible()){await text.fill("합성 답변");await zone.getByTestId("answer-text-submit").click();}
    else await zone.locator("[data-testid^='answer-']").first().click();
    expect((await answered).status()).toBe(200);await expect(zone.getByTestId("refresh")).toBeEnabled();
  }
  const finalized=page.waitForResponse(r=>r.url().endsWith(`/${ticket.ticketId}/finalize`)&&r.request().method()==="POST");
  await zone.getByTestId("finalize").click();expect((await finalized).status()).toBe(200);
  // The summary re-reads the submitted request without reopening it; the record moves back below.
  await expect(page.getByTestId("work-status")).toHaveText("접수");await expect(page.getByText("관리자에게 보냈어요.",{exact:false})).toBeVisible();
  await expect(zone).toHaveCount(0);await expect(page.locator("summary").filter({hasText:/^추가 확인$/})).toHaveCount(1);
});

test("an unsubmitted request reads 제출 전 in the tenant list and on the manager's detail",async({page,browser})=>{
  await page.setViewportSize({width:390,height:844});const tenant=new CoreScreen(page);await tenant.login("tenant");
  await page.getByRole("radio",{name:"누수",exact:true}).check();await page.getByLabel("문제 설명").fill("합성 제출 전 표시 확인");
  const response=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"접수하기",exact:true}).click();const ticket=await (await response).json();
  await page.getByRole("button",{name:"← 목록으로",exact:true}).click();
  await expect(page.locator(`[data-ticket-id="${ticket.ticketId}"] [data-work-state="DRAFT"]`)).toHaveText("제출 전");
  const managerContext=await browser.newContext({viewport:{width:390,height:844}}),manager=await managerContext.newPage();
  try{
    await new CoreScreen(manager).login("manager");await manager.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();
    await expect(manager.getByTestId("work-status")).toHaveText("제출 전");await expect(manager.getByText("세입자가 아직 질문에 답하는 중이에요.",{exact:true})).toBeVisible();
    await expect(manager.getByRole("region",{name:"지금 할 일: 추가 확인",exact:true})).toHaveCount(0);
  }finally{await managerContext.close();}
});

test("load failure offers a read-only retry and empty lists explain the next action",async({page})=>{
  await page.setViewportSize({width:320,height:740});
  let releaseSession!:()=>void;const pendingSession=new Promise<void>(resolve=>{releaseSession=resolve;});
  await page.route("**/api/v2/core/session",async route=>{await pendingSession;await route.abort();});await page.goto("/core");
  await expect(page.getByLabel("개발 접근 코드")).toBeDisabled();releaseSession();
  await expect(alerts(page)).toContainText("내용을 불러오지 못했습니다");
  await page.unroute("**/api/v2/core/session");await page.getByRole("button",{name:"다시 불러오기",exact:true}).click();
  await expect(alerts(page)).toHaveCount(0);
  // Controlled empty/error responses exercise UI recovery, not persistence or authorization.
  await page.route("**/api/v2/core/tickets",route=>route.request().method()==="GET"?route.fulfill({json:[]}):route.continue());
  await new CoreScreen(page).login("tenant");
  await expect(page.getByText("선택한 호실의 접수 내역이 없습니다. 위의 문제 접수에서 첫 내용을 남겨 주세요.",{exact:true})).toBeVisible();
  await page.screenshot({path:join(privateRoot,"usability-empty-320.png"),fullPage:true});
  await page.getByLabel("문제 설명").fill("연결 실패에도 유지할 합성 입력");
  let submissions=0;
  await page.route("**/api/v2/core/tickets",route=>{if(route.request().method()==="POST"){submissions++;return route.abort();}return route.fulfill({json:[]});});
  await page.getByRole("button",{name:"접수하기",exact:true}).click();
  await expect(alerts(page)).toContainText("저장 결과를 확인하지 못했습니다");
  await expect(page.getByLabel("문제 설명")).toHaveValue("연결 실패에도 유지할 합성 입력");
  await page.screenshot({path:join(privateRoot,"usability-save-error-320.png"),fullPage:true});
  await page.getByRole("button",{name:"다시 불러오기",exact:true}).click();
  await expect(alerts(page)).toHaveCount(0);expect(submissions).toBe(1);
  await page.route("**/api/v2/core/units",route=>route.fulfill({json:[]}));
  await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();
  await expect(page.getByText("접근 가능한 호실이 없습니다. 관리자에게 소속·호실 배정을 확인한 뒤 새로고침을 눌러 주세요.",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"접수하기",exact:true})).toHaveCount(0);
});

test("a missing session during a nested ticket action clears protected content and explains sign-in",async({page,context})=>{
  await page.setViewportSize({width:320,height:740});await new CoreScreen(page).login("tenant");
  await page.getByLabel("문제 설명").fill("합성 세션 안내 확인");await page.getByRole("button",{name:"접수하기",exact:true}).click();
  await expect(page.getByRole("region",{name:"지금 할 일: 추가 확인",exact:true}).getByTestId("refresh")).toBeVisible();
  await context.clearCookies(); // Real server401 after browser loses its session, without revoking a shared fixture code.
  await page.getByTestId("refresh").click();
  await expect(alerts(page)).toContainText("접속이 만료되었거나 코드가 유효하지 않습니다");
  await expect(page.getByLabel("개발 접근 코드")).toBeVisible();
  await expect(page.getByTestId("ticket-heading")).toHaveCount(0);
  await page.screenshot({path:join(privateRoot,"usability-session-ended-320.png"),fullPage:true});
});

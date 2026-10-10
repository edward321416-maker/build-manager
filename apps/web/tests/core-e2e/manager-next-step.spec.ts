import { test,expect,type APIRequestContext,type Locator,type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const privateRoot=join(homedir(),".build-manager-rc1-private");
const codes=async()=>JSON.parse(await readFile(join(privateRoot,"access-codes.json"),"utf8")) as Record<string,string>;
async function login(page:Page,who:string){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill((await codes())[who]);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();}
const zone=(page:Page)=>page.getByRole("region",{name:"다음 할 일",exact:true});
async function inView(page:Page,target:Locator){const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(-1);expect(box!.y).toBeLessThan(page.viewportSize()!.height);}
/** Creates a tenant request; with `submit`, answers every question and submits it. */
async function tenantRequest(request:APIRequestContext,issueType:"LEAK"|"HEATING",rawUserText:string,submit:boolean){
  const headers={Authorization:`Bearer ${(await codes()).tenant}`};
  const unit=(await (await request.get("/api/v2/core/units",{headers})).json())[0].id;
  const post=async(path:string,data:unknown)=>{const r=await request.post(`/api/v2/core/tickets${path}`,{headers,data});expect(r.status()).toBe(path?200:201);return r.json();};
  let t=await post("",{unitId:unit,issueType,rawUserText});if(!submit)return t;
  for(let i=0;i<15&&t.detail.activeQuestion;i++){const q=t.detail.activeQuestion;t=await post(`/${t.ticketId}/answers`,{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 답변"});}
  return post(`/${t.ticketId}/finalize`,{});
}

// Menu audit F-04/F-05/F-06: the manager sees the next step by state at the top, and its button opens the folded section.
test("manager next step leads from the route decision through handling to the maintenance fact at 390px",async({request,page})=>{
  const draft=await tenantRequest(request,"LEAK","합성 다음 할 일 제출 전",false),t=await tenantRequest(request,"HEATING","합성 다음 할 일 흐름",true);
  await page.setViewportSize({width:390,height:844});await login(page,"manager");
  // Queue rows name only the intake step that the screen's ticket list can prove.
  const row=(id:string)=>page.locator(`[data-ticket-id="${id}"]`);
  await expect(row(draft.ticketId).locator('[data-work-state="DRAFT"]')).toHaveText("제출 전");
  await expect(row(t.ticketId)).toContainText("처리 방법 결정 필요");
  await row(t.ticketId).locator("[data-open-ticket]").click();
  await expect(zone(page)).toContainText("처리 방법을 정해 주세요.");
  await zone(page).getByRole("button",{name:"처리 방법 정하기",exact:true}).click();
  const decision=page.locator("#ticket-decision");
  await expect(decision).toHaveJSProperty("open",true);await expect(decision.locator("summary")).toBeFocused();await inView(page,decision);
  await decision.getByLabel("직접 지정할 경로").selectOption({label:"관리사무소"});await decision.getByLabel("지정 사유").fill("합성 관리사무소 처리");
  await decision.getByRole("button",{name:"경로 직접 지정",exact:true}).click();
  // The decision refreshes the step and the row without reopening the request.
  await expect(zone(page)).toContainText("처리를 시작하면 기록해 주세요.");
  await zone(page).getByRole("button",{name:"처리 기록 열기",exact:true}).click();
  // The handling jump lands in the record field itself, which a screen reader names.
  const handling=page.locator("#ticket-handling"),record=handling.getByLabel("처리 기록",{exact:true});await expect(record).toBeFocused();await inView(page,handling);
  await record.fill("합성 관리사무소 점검 시작");await handling.getByRole("button",{name:"처리 시작 기록",exact:true}).click();
  await expect(zone(page)).toContainText("처리를 마치면 완료를 기록해 주세요.");
  await zone(page).getByRole("button",{name:"처리 기록 열기",exact:true}).click();await expect(record).toBeFocused();
  await record.fill("합성 관리사무소 점검 완료");
  const complete=handling.getByRole("button",{name:"처리 완료 기록",exact:true});await expect(complete).toBeEnabled();await complete.click();
  await expect(zone(page)).toContainText("호실 정비 사실을 남겨 주세요.");
  await zone(page).getByRole("button",{name:"정비 사실 기록하기",exact:true}).click();
  const fact=page.locator("#maintenance-fact");await expect(fact).toBeFocused();await inView(page,fact);
  await fact.getByLabel("정비 작업 종류").selectOption({label:"점검"});await fact.getByRole("button",{name:"정비 사실 저장",exact:true}).click();
  await expect(zone(page)).toHaveCount(0);
});

// Menu audit F-20 and the embedded decision screen. Soft checks, so one run reports every broken part.
test("업무 정보 brings the panel content into view and the decision section keeps one main landmark at 390px",async({request,page})=>{
  const t=await tenantRequest(request,"LEAK","합성 업무 정보 이동",true);
  await page.setViewportSize({width:390,height:844});await login(page,"manager");
  await page.locator(`[data-ticket-id="${t.ticketId}"] [data-open-ticket]`).click();await expect(zone(page)).toContainText("처리 방법을 정해 주세요.");
  await page.getByRole("button",{name:"업무 정보",exact:true}).click();
  const panel=page.getByRole("complementary",{name:"관리자 업무 정보"});await expect(panel).toBeVisible();
  await expect.soft(page.locator("#ticket-inspector > summary")).toBeFocused();
  // Before, only the panel heading reached the screen, at its lower part, and the content stayed below it.
  await expect.soft(async()=>expect((await panel.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height/2)).toPass({timeout:5000});
  await zone(page).getByRole("button",{name:"처리 방법 정하기",exact:true}).click();
  const decision=page.locator("#ticket-decision");await expect(decision.locator("summary")).toBeFocused();
  // Inside /core the page already has its main landmark and its own way back to the list.
  await expect.soft(page.getByRole("main")).toHaveCount(1);
  await expect.soft(decision.getByRole("link",{name:"← 접수 목록"})).toHaveCount(0);
});

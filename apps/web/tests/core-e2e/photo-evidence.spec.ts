import { test,expect,type Locator,type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// P1b (spec docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md, D1-D6): the tenant names a stored
// photo as the required evidence, so a complete intake reaches READY_FOR_REVIEW with a recommended route.
const privateRoot=join(homedir(),".build-manager-rc1-private");
const codes=async()=>JSON.parse(await readFile(join(privateRoot,"access-codes.json"),"utf8")) as Record<string,string>;
async function login(page:Page,who="tenant"){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill((await codes())[who]!);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();}
// Generated, non-personal fixture. This is input data, never presented as a real-site photo.
const sample=()=>sharp(Buffer.from('<svg width="480" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="360" fill="#edf3ef"/><path d="M60 90H240V200H420" fill="none" stroke="#718e94" stroke-width="36"/><path d="M240 230q-22 27 0 35q22-8 0-35" fill="#278dca"/><text x="24" y="340" font-size="17" fill="#244b43">SYNTHETIC EVIDENCE SAMPLE</text></svg>')).png().toBuffer();
const saved=(page:Page)=>page.getByRole("region",{name:"사진",exact:true});
const zoneOf=(page:Page)=>page.getByRole("region",{name:"지금 할 일: 추가 확인",exact:true});

async function createLeak(page:Page,text:string,withPhoto:boolean){
  await page.getByRole("radio",{name:"누수",exact:true}).check();await page.getByLabel("문제 설명").fill(text);
  if(withPhoto)await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles({name:"leak.png",mimeType:"image/png",buffer:await sample()});
  const created=page.waitForResponse(r=>r.url().endsWith("/api/v2/core/tickets")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"접수하기",exact:true}).click();const response=await created;expect(response.status()).toBe(201);
  const ticket=await response.json() as {ticketId:string};
  if(withPhoto)await expect(saved(page).getByRole("img")).toHaveCount(1);
  return ticket.ticketId;
}
/** Answers every question with a safe answer (never 예 on a safety question) until the evidence step shows. */
async function answerUntilEvidence(page:Page,zone:Locator,ticketId:string){
  const evidence=zone.getByRole("button",{name:"이 사진으로 정하기",exact:true});
  await expect(zone.locator("form").first()).toBeVisible();await expect(zone.getByTestId("refresh")).toBeEnabled();
  for(let i=0;i<12&&!await evidence.isVisible();i++){
    const no=zone.getByTestId("answer-no"),text=zone.getByLabel("답변",{exact:true});
    const answered=page.waitForResponse(r=>r.url().endsWith(`/${ticketId}/answers`)&&r.request().method()==="POST");
    if(await no.isVisible())await no.click();
    else if(await text.isVisible()){await text.fill("합성 답변");await zone.getByTestId("answer-text-submit").click();}
    else await zone.locator("[data-testid^='answer-']:not([data-testid='answer-yes']):not([data-testid='answer-no']):not([data-testid='answer-text-submit'])").first().click();
    expect((await answered).status()).toBe(200);await expect(zone.getByTestId("refresh")).toBeEnabled();
  }
  await expect(evidence).toBeVisible();
}

test("390px tenant names a stored photo as the leak evidence and the manager sees the route and the photo's name",async({page,browser})=>{
  await page.setViewportSize({width:390,height:844});await login(page);
  const ticketId=await createLeak(page,"합성 증빙 사진 지정 확인",true);const zone=zoneOf(page);
  await answerUntilEvidence(page,zone,ticketId);
  await expect(zone.getByRole("heading",{name:"누수 부위가 보이는 사진을 골라 주세요",exact:true})).toBeVisible();
  await expect(zone.getByText("안전한 거리에서 누수 부위와 주변 위치가 함께 보이도록 촬영해 주세요.",{exact:true})).toBeVisible();
  await expect(zone.getByText("위 참고 사진은 필수 증빙 판정과 별개입니다",{exact:false})).toHaveCount(0);
  const choose=zone.getByRole("button",{name:"이 사진으로 정하기",exact:true});await expect(choose).toBeDisabled();
  await zone.getByRole("radio",{name:"사진 1",exact:true}).check();await expect(choose).toBeEnabled();
  await page.screenshot({path:join(privateRoot,"photo-evidence-step-390.png"),fullPage:true});
  // Rules §7 and §12: at 390px with 200% root text the step neither scrolls sideways nor pushes a control off screen.
  await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const control of [choose,zone.getByLabel("사진 추가하기",{exact:true}),zone.getByRole("button",{name:"사진 없이 제출하기",exact:true}),zone.getByRole("radio",{name:"사진 1",exact:true})]){
    const box=await control.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  }
  // The tiles stack rather than squeeze their caption into one character a line ("사/진/1" before the rem floor).
  expect(await zone.getByRole("radio",{name:"사진 1",exact:true}).evaluate(radio=>{const caption=document.getElementById(radio.getAttribute("aria-labelledby")!)!;
    return Math.round(caption.getBoundingClientRect().height/parseFloat(getComputedStyle(caption).lineHeight));})).toBe(1);
  await page.screenshot({path:join(privateRoot,"photo-evidence-step-390-text200.png"),fullPage:true});
  await page.evaluate(()=>{document.documentElement.style.fontSize="";});
  const named=page.waitForResponse(r=>r.url().endsWith(`/${ticketId}/evidence`)&&r.request().method()==="POST");
  await choose.click();const namedResponse=await named;expect(namedResponse.status()).toBe(200);
  expect((await namedResponse.json()).detail.submittedEvidence).toEqual([expect.objectContaining({evidenceType:"LEAK_LOCATION",photoId:expect.any(String)})]);
  const finalized=page.waitForResponse(r=>r.url().endsWith(`/${ticketId}/finalize`)&&r.request().method()==="POST");
  await zone.getByTestId("finalize").click();const result=await (await finalized).json();expect(result.detail.status).toBe("READY_FOR_REVIEW");
  await expect(page.getByRole("status").filter({hasText:"수리 요청을 관리자에게 보냈어요."})).toBeVisible();
  await expect(saved(page).getByText("누수 부위 사진",{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"진행 이력"})).toContainText("증빙 사진 지정");
  const managerContext=await browser.newContext({viewport:{width:1280,height:900}}),manager=await managerContext.newPage();
  try{
    await login(manager,"manager");await manager.locator(`[data-ticket-id="${ticketId}"] [data-open-ticket]`).click();
    await expect(saved(manager).getByText("누수 부위 사진",{exact:true})).toBeVisible();
    await expect(manager.getByRole("region",{name:"진행 이력"})).toContainText("증빙 사진 지정");
    await manager.getByText("추가 확인·결정 기록",{exact:true}).click();
    await expect(manager.locator('.recommendation[data-route="LANDLORD_REVIEW"]')).toHaveText("임대인 검토");
    await manager.screenshot({path:join(privateRoot,"photo-evidence-manager-1280.png"),fullPage:true});
  }finally{await managerContext.close();}
});

test("390px tenant without a stored photo adds one in the evidence step and it is picked for them",async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page);
  const ticketId=await createLeak(page,"합성 증빙 사진 바로 추가",false);const zone=zoneOf(page);
  await answerUntilEvidence(page,zone,ticketId);
  await expect(zone.getByText("아직 올린 사진이 없어요. '사진 추가하기'로 올려 주세요.",{exact:true})).toBeVisible();
  const uploaded=page.waitForResponse(r=>r.url().endsWith(`/${ticketId}/photos`)&&r.request().method()==="POST");
  await zone.getByLabel("사진 추가하기",{exact:true}).setInputFiles({name:"added.png",mimeType:"image/png",buffer:await sample()});
  expect((await uploaded).status()).toBe(201);
  await expect(zone.getByRole("radio",{name:"사진 1",exact:true})).toBeChecked();await expect(saved(page).getByRole("img")).toHaveCount(1);
  const named=page.waitForResponse(r=>r.url().endsWith(`/${ticketId}/evidence`)&&r.request().method()==="POST");
  await zone.getByRole("button",{name:"이 사진으로 정하기",exact:true}).click();expect((await named).status()).toBe(200);
  await expect(zone.getByTestId("finalize")).toBeVisible();
});

test("390px 사진 없이 제출하기 sends a PARTIAL request, and the follow-up still lets the tenant pick a photo later",async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page);
  const ticketId=await createLeak(page,"합성 사진 없이 제출",false);const zone=zoneOf(page);
  await answerUntilEvidence(page,zone,ticketId);
  const finalized=page.waitForResponse(r=>r.url().endsWith(`/${ticketId}/finalize`)&&r.request().method()==="POST");
  await zone.getByRole("button",{name:"사진 없이 제출하기",exact:true}).click();expect((await (await finalized).json()).detail.status).toBe("PARTIAL");
  await expect(page.getByRole("status").filter({hasText:"수리 요청을 관리자에게 보냈어요."})).toBeVisible();await expect(zone).toHaveCount(0);
  await page.locator("summary").filter({hasText:/^추가 확인$/}).click();
  await expect(page.getByRole("heading",{name:"누수 부위가 보이는 사진을 골라 주세요",exact:true})).toBeVisible();
  await expect(page.getByText("이미 사진 없이 보냈어요.",{exact:false})).toBeVisible();
  await expect(page.getByRole("button",{name:"사진 없이 제출하기",exact:true})).toHaveCount(0);
});

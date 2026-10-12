import { test,expect,type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { sdkSession } from "./session";
import { openInspector,openConversation } from "../core-e2e/presentation";

const task=(page:Page)=>page.getByRole("region",{name:"지금 할 일",exact:true});
const fit=async(page:Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

test("task ownership, persistent inspector and mobile collapse preserve the public/private boundary",async({browser})=>{
  const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager");
  try{
    const made=await tenant.context.request.post("/api/v2/core/tickets",{headers:tenant.headers,data:{unitId:tenant.fixture.unitA,issueType:"LEAK",rawUserText:"합성 공간 구조 검사"}});
    expect(made.status()).toBe(201);const ticket=await made.json(),id=ticket.ticketId;
    const url=`/api/v2/core/tickets/${id}/communication`;
    const question="합성 질문: 연결부 주변에 물이 계속 맺히나요?";
    const asked=await manager.context.request.post(url+"/messages",{headers:manager.headers,data:{clientRequestId:randomUUID(),expectedVersion:0,intent:"REQUEST_REPLY",body:question}});
    expect(asked.status()).toBe(201);
    const t=await tenant.context.newPage();await t.setViewportSize({width:390,height:844});await t.goto("/core");
    await t.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();await expect(task(t)).toBeVisible();
    await expect(task(t)).toContainText(question);await expect(t.getByRole("complementary",{name:"관리자 업무 정보"})).toHaveCount(0);
    for(const label of ["긴급도","담당자","내부 메모 입력"])await expect(t.getByLabel(label,{exact:true})).toHaveCount(0);
    await t.evaluate(()=>scrollTo(0,0));
    const action=task(t).getByRole("button",{name:"답변 보내기",exact:true});
    const actionBox=(await action.boundingBox())!;expect(actionBox.y+actionBox.height).toBeLessThanOrEqual(844);
    const photo=t.getByRole("region",{name:"사진",exact:true});expect((await photo.boundingBox())!.y).toBeGreaterThan((await task(t).boundingBox())!.y);
    // An unsubmitted request also keeps its intake questions open, after the pending reply and before the photos.
    const intake=t.getByRole("region",{name:"지금 할 일: 추가 확인",exact:true});await expect(intake).toBeVisible();
    const intakeY=(await intake.boundingBox())!.y;expect(intakeY).toBeGreaterThan((await task(t).boundingBox())!.y);expect((await photo.boundingBox())!.y).toBeGreaterThan(intakeY);
    const editor=task(t).getByLabel("공개 대화 내용",{exact:true});await editor.fill("합성 세입자 답변입니다.");await editor.focus();await t.keyboard.press("Tab");await expect(action).toBeFocused();
    const sent=t.waitForResponse(r=>r.url().endsWith("/communication/messages")&&r.request().method()==="POST");await t.keyboard.press("Enter");expect((await sent).status()).toBe(201);await expect(task(t)).toHaveCount(0);
    await openConversation(t);await expect(t.getByRole("listitem").filter({hasText:"합성 세입자 답변입니다."})).toBeVisible();
    const m=await manager.context.newPage();await m.setViewportSize({width:1440,height:900});await m.goto("/core");await m.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
    await expect(task(m)).toBeVisible();await expect(task(m)).toContainText("세입자 답변이 도착했습니다.");
    const queue=m.getByRole("region",{name:"관리 업무함",exact:true}),inspector=m.getByRole("complementary",{name:"관리자 업무 정보"});
    await expect(inspector).toBeVisible();expect((await queue.boundingBox())!.width+1).toBe(380);
    const publicBox=(await m.getByRole("region",{name:"접수 요약",exact:true}).boundingBox())!,privateBox=(await inspector.boundingBox())!;
    // 1440 viewport - 248 left menu (rules §5) - 380 queue - 320 inspector - 2 x 40 side padding = 412.
    expect(publicBox.width).toBeGreaterThanOrEqual(412);expect(publicBox.x+publicBox.width).toBeLessThanOrEqual(privateBox.x);
    expect(await m.getByRole("button",{name:"새로고침",exact:true}).count()).toBe(1);
    await m.getByLabel("담당자",{exact:true}).fill("저장 전 합성 담당자");
    const field=await m.getByLabel("담당자",{exact:true}).elementHandle();
    await m.setViewportSize({width:1280,height:900});await expect(m.locator("#ticket-inspector")).not.toHaveAttribute("open","");
    await openInspector(m);await expect(m.getByLabel("담당자",{exact:true})).toHaveValue("저장 전 합성 담당자");expect(await field!.evaluate(el=>el.isConnected)).toBe(true);
    await m.locator("#ticket-inspector > summary").focus();await m.keyboard.press("Space");await expect(m.locator("#ticket-inspector")).not.toHaveAttribute("open","");
    await task(m).getByLabel("공개 대화 내용").fill("합성 답변을 확인했습니다.");await task(m).getByRole("button",{name:"답변",exact:true}).click();await expect(task(m)).toHaveCount(0);
    const state=await (await manager.context.request.get(url,{headers:manager.headers})).json();expect(state).toMatchObject({waitingFor:"NONE",version:3});
    for(const width of [320,390,768,1280,1440]){await m.setViewportSize({width,height:900});await fit(m);if(width<1120)await expect(queue).not.toBeVisible();else await expect(queue).toBeVisible();}
    await m.setViewportSize({width:1280,height:900});await m.evaluate(()=>document.documentElement.style.fontSize="200%");await fit(m);
    await t.getByText("접수 세부 정보",{exact:true}).click();await expect(t.getByText(`접수번호 ${id}`,{exact:true})).toBeVisible();
  }finally{await tenant.close();await manager.close();}
});

test("segmented issue choice sends only exact supported values and chrome navigation retains the draft",async({browser})=>{
  const tenant=await sdkSession(browser);
  try{
    const page=await tenant.context.newPage();await page.setViewportSize({width:390,height:844});await page.goto("/core");
    await expect(page.getByRole("group",{name:"문제 유형",exact:true}).getByRole("radio")).toHaveCount(2);
    await page.getByLabel("문제 설명").fill("화면 이동에도 남을 합성 입력");await page.getByRole("link",{name:"입주 연결",exact:true}).click();await expect(page.getByRole("heading",{name:"내 호실 연결 요청",exact:true})).toBeVisible();
    await page.getByRole("link",{name:"접수",exact:true}).click();await expect(page.getByLabel("문제 설명")).toHaveValue("화면 이동에도 남을 합성 입력");await expect(page.getByLabel("내 소속",{exact:true})).toBeVisible();
    for(const [value,label] of [["HEATING","난방"],["LEAK","누수"]]){
      await page.getByRole("radio",{name:label,exact:true}).check();await expect(page.getByRole("radio",{name:label,exact:true})).toBeChecked();await page.getByLabel("문제 설명").fill(`합성 ${label} 계약 검사`);
      const posted=page.waitForResponse(r=>r.url().endsWith("/core/tickets")&&r.request().method()==="POST");await page.getByRole("button",{name:"접수하기",exact:true}).click();const response=await posted;expect(response.status()).toBe(201);expect(response.request().postDataJSON().issueType).toBe(value);expect((await response.json()).detail.issueType).toBe(value);
      await expect(page.getByTestId("ticket-heading")).toBeVisible();await expect(task(page)).toHaveCount(0);await fit(page);await page.getByRole("button",{name:"← 목록으로",exact:true}).click();
    }
  }finally{await tenant.close();}
});

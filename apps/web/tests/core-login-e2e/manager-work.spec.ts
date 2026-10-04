import { test,expect } from "@playwright/test";
import { sdkSession } from "./session";

test("B1 SDK manager queue preserves organization selection, CSRF and tenant privacy",async({browser})=>{
  const tenant=await sdkSession(browser,"tenant"),manager=await sdkSession(browser,"manager");
  try{
    const created=await tenant.context.request.post("/api/v2/core/tickets",{headers:tenant.headers,data:{unitId:tenant.fixture.unitA,issueType:"HEATING",rawUserText:"B1 업무함 합성 접수"}});expect(created.status()).toBe(201);const id=(await created.json()).ticketId;
    const path=`/api/v2/core/manager/tickets/${id}/work`,input={priority:"HIGH",assigneeLabel:"합성 B1 담당",dueAt:null,expectedVersion:1};
    expect((await manager.context.request.post(path,{headers:{...manager.headers,"x-b1-csrf":"invalid"},data:input})).status()).toBe(403);
    expect((await manager.context.request.get("/api/v2/core/manager/work-items",{headers:{"x-core-organization":manager.fixture.orgB}})).status()).toBe(403);
    expect((await tenant.context.request.get(path,{headers:tenant.headers})).status()).toBe(403);
    const page=await manager.context.newPage();await page.setViewportSize({width:1280,height:900});await page.goto("/core");
    const org=page.getByLabel("내 소속",{exact:true});await expect(org).toBeVisible();await org.selectOption(manager.fixture.orgA);
    await page.getByRole("region",{name:"관리 업무함",exact:true}).locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
    const panel=page.getByRole("region",{name:"업무 관리",exact:true});await expect(panel.getByRole("combobox",{name:"긴급도",exact:true})).toBeEnabled();
    await panel.getByRole("combobox",{name:"긴급도",exact:true}).selectOption("HIGH");await panel.getByLabel("담당자",{exact:true}).fill(input.assigneeLabel);await panel.getByRole("button",{name:"저장",exact:true}).click();await expect(panel.getByText("업무 정보를 저장했습니다.",{exact:true})).toBeVisible();
    await panel.getByLabel("내부 메모 입력",{exact:true}).fill("B1 합성 내부 점검 메모");await panel.getByRole("button",{name:"내부 메모 추가",exact:true}).click();await expect(panel.getByText("B1 합성 내부 점검 메모",{exact:true})).toBeVisible();
    const result=await manager.context.request.get(path,{headers:manager.headers});expect(result.status()).toBe(200);expect(await result.json()).toMatchObject({priority:input.priority,assigneeLabel:input.assigneeLabel,dueAt:null,version:2});
    const publicResult=await tenant.context.request.get(`/api/v2/core/tickets/${id}`,{headers:tenant.headers});expect(publicResult.status()).toBe(200);const text=await publicResult.text();for(const privateValue of [input.assigneeLabel,"B1 합성 내부 점검 메모","priority","assigneeLabel"])expect(text).not.toContain(privateValue);
  }finally{await tenant.close();await manager.close();}
});

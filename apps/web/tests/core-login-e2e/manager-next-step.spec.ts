import { test,expect,type Page } from "@playwright/test";
import { sdkSession } from "./session";
import { openInspector } from "../core-e2e/presentation";

const zone=(page:Page)=>page.getByRole("region",{name:"다음 할 일",exact:true});

// Menu audit F-05: the Vendor section says why it is empty, a Vendor route decision refreshes it at once,
// and the next step's button lands on it.
test("a Vendor route points the manager at the Vendor section, which explains its prerequisite before the decision",async({browser})=>{
  const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager");
  try{
    const call=async(path:string,data:unknown)=>{const r=await tenant.context.request.post(`/api/v2/core/tickets${path}`,{headers:tenant.headers,data});expect(r.status()).toBe(path?200:201);return r.json();};
    let t=await call("",{unitId:tenant.fixture.unitA,issueType:"LEAK",rawUserText:"합성 업체 다음 할 일"});
    for(let i=0;i<15&&t.detail.activeQuestion;i++){const q=t.detail.activeQuestion;t=await call(`/${t.ticketId}/answers`,{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 답변"});}
    t=await call(`/${t.ticketId}/finalize`,{});
    const m=await manager.context.newPage();await m.setViewportSize({width:390,height:844});await m.goto("/core");
    await m.locator(`[data-ticket-id="${t.ticketId}"] [data-open-ticket]`).click();
    await expect(zone(m)).toContainText("처리 방법을 정해 주세요.");
    await openInspector(m);
    const vendor=m.locator("#vendor-handoff");
    await expect(vendor).toContainText("업체에 보내려면 먼저 처리 방법을 '일반 수리업체'나 '제조사 A/S'로 정해 주세요.");
    await expect(vendor.getByLabel("업체 표시 이름",{exact:true})).toHaveCount(0);
    await zone(m).getByRole("button",{name:"처리 방법 정하기",exact:true}).click();
    const decision=m.locator("#ticket-decision");await expect(decision.locator("summary")).toBeFocused();
    await decision.getByLabel("직접 지정할 경로").selectOption({label:"일반 수리업체"});await decision.getByLabel("지정 사유").fill("합성 업체 수리");
    await decision.getByRole("button",{name:"경로 직접 지정",exact:true}).click();
    await expect(zone(m)).toContainText("업체에 작업을 보내 주세요.");
    await zone(m).getByRole("button",{name:"업체 연결 열기",exact:true}).click();
    await expect(vendor).toBeFocused();const box=await vendor.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(-1);expect(box!.y).toBeLessThan(844);
    // The decision refreshed the Vendor section too: the prerequisite is gone and preparation is offered.
    await expect(vendor.getByLabel("업체 표시 이름",{exact:true})).toBeVisible();
    await expect(vendor).not.toContainText("업체에 보내려면 먼저 처리 방법을");
  }finally{await tenant.close();await manager.close();}
});

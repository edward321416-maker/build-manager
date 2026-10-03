import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { sdkSession, privateRoot } from "./session";

const evidence=join(privateRoot,"design-20261004");
const viewports=[{width:320,height:844},{width:390,height:844},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
async function readable(control:Locator){
  const luminance=(color:string)=>color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  // Wait for the existing bounded color transition after a disabled control becomes enabled.
  await expect.poll(async()=>{
    const colors=await control.evaluate(el=>{
      const foreground=getComputedStyle(el).color;let node:Element|null=el;
      while(node){const background=getComputedStyle(node).backgroundColor;if(background!=="rgba(0, 0, 0, 0)"&&background!=="transparent")return [foreground,background];node=node.parentElement;}
      return [foreground,"rgb(255, 255, 255)"];
    });
    const [a,b]=colors.map(luminance);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  }).toBeGreaterThanOrEqual(4.5);
}
async function captureLayout(page:Page,name:string){
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const account=page.getByRole("region",{name:"로그인과 내 소속"});
    if(viewport.width>=1024)expect((await account.boundingBox())!.width).toBe(248);
    expect(await account.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(23, 40, 59)");
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:join(evidence,`${name}-${viewport.width}.png`),fullPage:viewport.width<1024});
  }
}

test("navy account and light workspace reflow without remounting drafts; manager completion remains a record",async({browser})=>{
  await mkdir(evidence,{recursive:true});
  const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager");
  try{
    const page=await tenant.context.newPage();await page.goto("/core");
    await expect(page.getByLabel("문제 설명")).toBeVisible();
    await page.getByLabel("문제 설명").fill("합성 디자인 상태 구분 검사");
    await readable(page.getByRole("button",{name:"접수하기",exact:true}));
    const input=await page.getByLabel("문제 설명").elementHandle();
    await captureLayout(page,"b1-tenant");
    expect(await input!.evaluate(el=>el===document.querySelector('[aria-label="문제 설명"]'))).toBe(true);
    await expect(page.getByLabel("문제 설명")).toHaveValue("합성 디자인 상태 구분 검사");
    const created=page.waitForResponse(r=>r.url().endsWith("/core/tickets")&&r.request().method()==="POST");
    await page.getByRole("button",{name:"접수하기",exact:true}).click();let ticket=await (await created).json();
    // Reach PARTIAL through real protocol endpoints, without fabricating a returned status.
    for(let i=0;i<15&&ticket.detail.activeQuestion;i++){
      const q=ticket.detail.activeQuestion;
      const response=await tenant.context.request.post(`/api/v2/core/tickets/${ticket.ticketId}/answers`,{headers:tenant.headers,data:{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 답변"}});
      expect(response.status()).toBe(200);ticket=await response.json();
    }
    expect(ticket.detail.activeQuestion).toBeNull();
    const finalized=await tenant.context.request.post(`/api/v2/core/tickets/${ticket.ticketId}/finalize`,{headers:tenant.headers,data:{}});
    expect(finalized.status()).toBe(200);ticket=await finalized.json();expect(ticket.detail.status).toBe("PARTIAL");
    const m=await manager.context.newPage();await m.goto("/core");
    await m.getByLabel("건물·호실").selectOption(tenant.fixture.unitA);
    await m.getByRole("button",{name:new RegExp(ticket.ticketId.slice(0,8))}).click();
    await expect(m.getByLabel("처리 기록")).toBeVisible();await captureLayout(m,"b1-manager-detail");
    await m.getByLabel("처리 기록").fill("합성 처리 시작 기록");await m.getByRole("button",{name:"처리 시작 기록",exact:true}).click();
    await expect(m.getByTestId("work-status")).toHaveText("처리중");
    await m.getByLabel("처리 기록").fill("합성 관리자 완료 기록");await m.getByRole("button",{name:"처리 완료 기록",exact:true}).click();
    await expect(m.getByTestId("work-status")).toHaveText("처리 완료 (관리자 기록)");
    const completed=await (await tenant.context.request.get(`/api/v2/core/tickets/${ticket.ticketId}`,{headers:tenant.headers})).json();
    expect(completed.workStatus).toBe("COMPLETED");expect(completed.detail.status).toBe("PARTIAL");
    await page.getByRole("button",{name:"전체 새로고침",exact:true}).click();
    await expect(page.getByTestId("work-status")).toHaveText("처리 완료 (관리자 기록)");
    await readable(page.getByTestId("work-status").locator("span"));
    await expect(page.getByText("접수·검토 상태: 정보 부족",{exact:true})).toBeVisible();
    await expect(page.getByText("관리자가 남긴 완료 기록입니다.",{exact:false})).toBeVisible();
    await expect(page.getByLabel("참고 사진 선택",{exact:true})).toHaveCount(0);
    await captureLayout(page,"b1-tenant-completed");
    await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>document.documentElement.style.fontSize="200%");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:join(evidence,"b1-completed-text-200.png"),fullPage:true});
  }finally{await tenant.close();await manager.close();}
});

test("zero-association requests and missing-link guidance remain reachable at 320 CSS px",async({browser})=>{
  await mkdir(evidence,{recursive:true});const account=await sdkSession(browser,"design-unassociated");
  try{
    const page=await account.context.newPage();await page.setViewportSize({width:320,height:844});await page.goto("/core");
    await expect(page.getByText("연결된 소속·호실이 없습니다.",{exact:false})).toBeVisible();
    await expect(page.getByRole("heading",{name:"내 연결 요청",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"내 소속·호실 새로고침",exact:true})).toBeEnabled();
    await expect(page.getByLabel("개발 접근 코드")).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:join(evidence,"b1-no-association-320.png"),fullPage:true});
    await page.goto("/core/join");await expect(page.getByText("초대 링크 정보가 없습니다.",{exact:false})).toBeVisible();
    await readable(page.getByText("관리자가 보낸 초대입니다.",{exact:false}));
    await expect(page.getByRole("button",{name:"연결 요청 보내기",exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:join(evidence,"join-no-link-320.png"),fullPage:true});
  }finally{await account.close();}
});

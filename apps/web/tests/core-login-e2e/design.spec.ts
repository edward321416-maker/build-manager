import { openInspector } from "../core-e2e/presentation";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sdkSession, privateRoot, base } from "./session";

const evidence=join(privateRoot,"design-20261004");
const viewports=[{width:320,height:844},{width:390,height:844},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
async function readable(control:Locator){
  const luminance=(color:string)=>color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  // Wait for the existing bounded color transition after a disabled control becomes enabled.
  await expect.poll(async()=>{
    const colors=await control.evaluate(el=>{
      const canvas=document.createElement("canvas");canvas.width=canvas.height=1;const ctx=canvas.getContext("2d")!;
      const backgrounds:string[]=[];let node:Element|null=el;
      while(node){backgrounds.push(getComputedStyle(node).backgroundColor);node=node.parentElement;}
      ctx.fillStyle="white";ctx.fillRect(0,0,1,1);
      for(const background of backgrounds.reverse()){ctx.fillStyle=background;ctx.fillRect(0,0,1,1);}
      const background=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);
      ctx.fillStyle=getComputedStyle(el).color;ctx.fillRect(0,0,1,1);
      const foreground=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);
      return ["rgb("+foreground.join(",")+")","rgb("+background.join(",")+")"];
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
    expect(await account.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(242, 242, 247)");
    const workspace=page.getByRole("region",{name:"수리 접수 작업",exact:true});
    await expect(workspace).toHaveCSS("background-color","rgb(255, 255, 255)");
    await expect(workspace.getByRole("heading",{level:1})).toHaveCSS("font-size","20px");
    // Design rules v1 §2.3: every status label pairs its text with the matching soft fill.
    const statusColors=await workspace.locator("span[data-work-state]").evaluateAll(items=>items.map(el=>({state:el.getAttribute("data-work-state"),background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})));
    const statusPairs:Record<string,[string,string]>={OPEN:["rgb(99, 103, 113)","rgba(32, 38, 50, 0.04)"],DRAFT:["rgb(154, 91, 0)","rgb(255, 243, 220)"],IN_PROGRESS:["rgb(0, 86, 216)","rgb(238, 244, 255)"],COMPLETED:["rgb(23, 117, 79)","rgb(231, 245, 238)"]};
    expect(statusColors.every(s=>statusPairs[s.state!]?.[0]===s.color&&statusPairs[s.state!]?.[1]===s.background)).toBe(true);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:join(evidence,`${name}-${viewport.width}.png`),fullPage:viewport.width<1024});
  }
}

test("neutral account and white workspace reflow without remounting drafts; manager completion remains a record",async({browser})=>{
  await mkdir(evidence,{recursive:true});
  const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager");
  try{
    const page=await tenant.context.newPage();await page.goto("/core");
    await expect(page.getByLabel("문제 설명")).toBeVisible();
    const account=page.getByRole("region",{name:"로그인과 내 소속"}).getByRole("combobox");
    await account.focus();await page.keyboard.press("Tab");await page.keyboard.press("Shift+Tab");await expect(account).toBeFocused();
    expect(await account.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe("solid");
    expect(await account.evaluate(el=>getComputedStyle(el).outlineColor)).toBe("rgb(0, 100, 255)");
    // The select is the transparent control; the visible ring is drawn on the wrapped current choice (rules §8.2, §2.4).
    const currentOrg=page.getByRole("region",{name:"로그인과 내 소속"}).locator(".core-org-current");
    await expect(currentOrg).toBeVisible();
    await expect(currentOrg).toHaveCSS("outline-style","solid");await expect(currentOrg).toHaveCSS("outline-width","2px");await expect(currentOrg).toHaveCSS("outline-color","rgb(0, 100, 255)");
    await page.getByLabel("문제 설명").fill("합성 디자인 상태 구분 검사");
    await expect(page.getByRole("button",{name:"접수하기",exact:true})).toHaveCSS("background-color","rgb(0, 100, 255)");
    await expect(page.getByRole("region",{name:"로그인과 내 소속"})).not.toContainText(/B1|RC1 합성 주거 데이터/);
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
    await m.locator(`[data-ticket-id="${ticket.ticketId}"] [data-open-ticket]`).click();
    await openInspector(m);await expect(m.getByLabel("처리 기록")).toBeVisible();await captureLayout(m,"b1-manager-detail");
    await openInspector(m);await m.getByLabel("처리 기록").fill("합성 처리 시작 기록");await m.getByRole("button",{name:"처리 시작 기록",exact:true}).click();
    await expect(m.getByTestId("work-status")).toHaveText("처리중");
    await openInspector(m);await m.getByLabel("처리 기록").fill("합성 관리자 완료 기록");await m.getByRole("button",{name:"처리 완료 기록",exact:true}).click();
    await expect(m.getByTestId("work-status")).toHaveText("✓ 처리 완료");
    const completed=await (await tenant.context.request.get(`/api/v2/core/tickets/${ticket.ticketId}`,{headers:tenant.headers})).json();
    expect(completed.workStatus).toBe("COMPLETED");expect(completed.detail.status).toBe("PARTIAL");
    await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();
    await expect(page.getByTestId("work-status")).toHaveText("✓ 처리 완료");
    await readable(page.getByTestId("work-status").locator("[data-work-state]"));
    await expect(page.getByText("접수 상태: 추가 정보 필요",{exact:true})).toBeVisible();
    await expect(page.getByText("관리자가 완료로 기록했습니다.",{exact:false})).toBeVisible();
    const work=await page.getByTestId("work-status").boundingBox(),intake=await page.getByText("접수 상태: 추가 정보 필요",{exact:true}).boundingBox(),explanation=await page.getByText("관리자가 완료로 기록했습니다.",{exact:false}).boundingBox();
    expect(work!.y+work!.height).toBeLessThanOrEqual(intake!.y);expect(intake!.y+intake!.height).toBeLessThanOrEqual(explanation!.y);
    await expect(page.getByLabel("참고 사진 선택",{exact:true})).toHaveCount(0);
    await captureLayout(page,"b1-tenant-completed");
    await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>document.documentElement.style.fontSize="200%");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:join(evidence,"b1-completed-text-200.png"),fullPage:true});
  }finally{await tenant.close();await manager.close();}
});

test("pending invitations precede creation while full references and confirmation gates remain usable at 390px",async({browser})=>{
  const manager=await sdkSession(browser,"manager"),tenant=await sdkSession(browser,"design-request-"+randomUUID());
  try{
    const unit=randomUUID(),label=`합성 디자인 요청 호실 ${unit.slice(0,8)}`;
    await manager.admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",[unit,manager.fixture.orgA,manager.fixture.propertyA,label]);
    const created=await manager.context.request.post("/api/v2/core/onboarding/create",{headers:manager.headers,data:{unitId:unit}});expect(created.status()).toBe(201);
    const {link}=await created.json(),token=new URL(link).hash.slice(1);
    const claimed=await tenant.context.request.post("/api/v2/core/onboarding/claim",{headers:{Origin:base,"x-b1-csrf":tenant.csrf},data:{token}});expect(claimed.status()).toBe(200);
    const {requestNumber}=await claimed.json();expect(requestNumber).toMatch(/^[a-f0-9-]{36}$/);
    const page=await manager.context.newPage();await page.setViewportSize({width:1440,height:900});await page.goto("/core");await page.getByRole("link",{name:"입주 연결",exact:true}).click();
    const pending=page.getByRole("region",{name:"확인할 요청",exact:true}),card=pending.getByRole("article",{name:`${label} 초대`,exact:true});
    await expect(card.getByText(requestNumber,{exact:true})).toBeVisible();
    expect((await pending.boundingBox())!.x).toBeLessThan((await page.getByRole("heading",{name:"새 초대",exact:true}).boundingBox())!.x);
    const approve=card.getByRole("button",{name:"승인",exact:true});await expect(approve).toBeDisabled();
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await pending.boundingBox())!.y).toBeLessThan((await page.getByRole("heading",{name:"새 초대",exact:true}).boundingBox())!.y);
    await card.getByRole("checkbox").focus();await page.keyboard.press("Space");await expect(approve).toBeEnabled();
    await page.getByRole("button",{name:"연결 상태 새로고침",exact:true}).click();
    await expect(page.getByRole("button",{name:"연결 상태 새로고침",exact:true})).toBeEnabled();
    await expect(card.getByRole("checkbox")).not.toBeChecked();await expect(approve).toBeDisabled();
    const joinPage=await tenant.context.newPage();await joinPage.setViewportSize({width:390,height:844});await joinPage.goto(link);
    await expect.poll(()=>new URL(joinPage.url()).hash).toBe("");await joinPage.getByRole("button",{name:"초대 내용 확인",exact:true}).click();
    await expect(joinPage.getByText(requestNumber,{exact:true})).toBeVisible();
    const status=await joinPage.getByText("관리자 확인 대기",{exact:true}).boundingBox(),reference=await joinPage.getByText(requestNumber,{exact:true}).boundingBox();
    expect(status!.y+status!.height).toBeLessThan(reference!.y);expect(await joinPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(joinPage.locator("body")).not.toContainText(token);
  }finally{await manager.close();await tenant.close();}
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
    await readable(page.getByText("호실을 확인하고 연결을 요청하세요.",{exact:false}));
    await expect(page.getByRole("button",{name:"연결 요청 보내기",exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:join(evidence,"join-no-link-320.png"),fullPage:true});
  }finally{await account.close();}
});

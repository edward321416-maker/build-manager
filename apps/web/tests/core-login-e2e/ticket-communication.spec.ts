import { test,expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { sdkSession,base } from "./session";

test("B1 SDK public conversation keeps exact Origin, CSRF, organization and own-receipt boundaries",async({browser})=>{
  const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager"),peer=await sdkSession(browser,"tenantPeer"),other=await sdkSession(browser,"otherManager");
  try{
    const created=await tenant.context.request.post("/api/v2/core/tickets",{headers:tenant.headers,data:{unitId:tenant.fixture.unitA,issueType:"LEAK",rawUserText:"B1 공개 문답 합성 접수"}});expect(created.status()).toBe(201);const id=(await created.json()).ticketId,path=`/api/v2/core/tickets/${id}/communication`,key=randomUUID();
    const input={clientRequestId:key,expectedVersion:0,intent:"REQUEST_REPLY",body:"B1 합성 질문"};
    for(const headers of [{...manager.headers,"x-b1-csrf":"invalid"},{...manager.headers,Origin:"http://foreign.invalid"},{"x-b1-csrf":manager.csrf,"x-core-organization":manager.fixture.orgA}])expect((await manager.context.request.post(path+"/messages",{headers,data:input})).status()).toBe(403);
    expect((await tenant.context.request.post(path+"/messages",{headers:tenant.headers,data:input})).status()).toBe(403);
    expect((await manager.context.request.post(path+"/messages",{headers:manager.headers,data:input})).status()).toBe(201);
    const read=await tenant.context.request.get(path,{headers:tenant.headers});expect(read.status()).toBe(200);expect(read.headers()["cache-control"]).toBe("private, no-store");expect(await read.json()).toMatchObject({waitingFor:"TENANT",version:1});
    for(const context of [peer,other]){
      expect((await context.context.request.get(path,{headers:context.headers})).status()).toBe(404);
      expect((await context.context.request.post(path+"/messages",{headers:context.headers,data:{...input,clientRequestId:randomUUID(),intent:context===peer?"TENANT_MESSAGE":"MANAGER_UPDATE",expectedVersion:1}})).status()).toBe(404);
      const summaries=await context.context.request.get(`/api/v2/core/communication-summaries?ticketId=${id}`,{headers:context.headers});expect(summaries.status()).toBe(200);expect(await summaries.json()).toEqual([]);
    }
    expect((await tenant.context.request.get(path+"/requests/"+key,{headers:tenant.headers})).status()).toBe(404);
    expect((await manager.context.request.get(path+"/requests/"+key,{headers:manager.headers})).status()).toBe(200);
    const page=await tenant.context.newPage();await page.goto("/core");await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
    const chat=page.getByRole("region",{name:"세입자와 공유하는 대화",exact:true});await expect(chat.getByText("내 답변 필요",{exact:true})).toBeVisible();await chat.getByLabel("공개 대화 내용").fill("B1 합성 응답");await chat.getByRole("button",{name:"답변 보내기",exact:true}).click();await expect(chat.getByRole("listitem").filter({hasText:"B1 합성 응답"})).toBeVisible();
    const body=await (await manager.context.request.get(path,{headers:manager.headers})).json();expect(body).toMatchObject({version:2,waitingFor:"MANAGER"});expect(body.messages).toHaveLength(2);
  }finally{await tenant.close();await manager.close();await peer.close();await other.close();}
});

test("B1 organization change, session replacement and POST logout clear non-body recovery without auto-submit",async({browser})=>{
  const manager=await sdkSession(browser,"manager");
  try{
    const page=await manager.context.newPage();await page.goto("/core");await expect(page.getByLabel("내 소속",{exact:true})).toBeVisible();
    const value={ticketId:randomUUID(),clientRequestId:randomUUID(),expectedVersion:0,intent:"MANAGER_UPDATE"};
    const put=()=>page.evaluate(v=>sessionStorage.setItem("core-communication-request:"+v.ticketId,JSON.stringify(v)),value);
    const count=()=>page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("core-communication-request:")).length);
    await put();await page.getByLabel("내 소속",{exact:true}).selectOption("");expect(await count()).toBe(0);await page.getByLabel("내 소속",{exact:true}).selectOption(manager.fixture.orgA);await expect(page.getByRole("region",{name:"관리 업무함",exact:true})).toBeVisible();
    await put();let sends=0;page.on("request",r=>{if(r.method()==="POST"&&r.url().endsWith("/communication/messages"))sends++;});
    const replacement=await sdkSession(browser,"tenant",manager.context);
    try{await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));await expect(page.getByRole("link",{name:"계정으로 로그인",exact:true})).toBeVisible();expect(await count()).toBe(0);expect(sends).toBe(0);
      await page.reload();await expect(page.getByTestId("unit-context")).toBeVisible();await put();const ending=page.waitForResponse(r=>r.url()===base+"/api/v2/session/logout");await page.getByRole("button",{name:"로그아웃",exact:true}).click();expect((await ending).status()).toBe(503);expect(await count()).toBe(0);
    }finally{await replacement.close();}
  }finally{await manager.close();}
});

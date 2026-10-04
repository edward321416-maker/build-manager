import { openConversation,openInspector } from "./presentation";
import { test,expect,type Page,type APIRequestContext } from "@playwright/test";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const root=join(homedir(),".build-manager-rc1-private"),evidence=join(root,"ticket-public-qa");
const conversation=(page:Page)=>page.getByRole("region",{name:"세입자와 공유하는 대화",exact:true});
async function setup(request:APIRequestContext){
  const codes=JSON.parse(await readFile(join(root,"access-codes.json"),"utf8")) as Record<string,string>;
  const headers=(who:string)=>({Authorization:`Bearer ${codes[who]}`});
  const units=await request.get("/api/v2/core/units",{headers:headers("tenant")});expect(units.status()).toBe(200);
  const created=await request.post("/api/v2/core/tickets",{headers:headers("tenant"),data:{unitId:(await units.json())[0].id,issueType:"HEATING",rawUserText:"공개 대화 실행용 합성 접수"}});expect(created.status()).toBe(201);
  const ticket=await created.json(),id=ticket.ticketId as string;
  const read=async(who="tenant")=>{const r=await request.get(`/api/v2/core/tickets/${id}/communication`,{headers:headers(who)});expect(r.status()).toBe(200);return r.json();};
  return {codes,headers,ticket,id,read};
}
async function login(page:Page,code:string,id?:string){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill(code);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();if(id)await open(page,id);}
async function open(page:Page,id:string){await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();await openConversation(page);await expect(conversation(page).getByRole("button",{name:"대화 새로고침",exact:true})).toBeEnabled();}
async function send(page:Page,body:string,action:string){await openConversation(page);const section=conversation(page);await section.getByLabel("공개 대화 내용",{exact:true}).fill(body);await section.getByRole("button",{name:action,exact:true}).click();await expect(section.getByRole("listitem").filter({hasText:body})).toBeVisible();await expect(section.getByLabel("공개 대화 내용",{exact:true})).toHaveValue("");}
async function fit(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
const metadata=(page:Page)=>page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("core-communication-request:")).map(k=>JSON.parse(sessionStorage.getItem(k)!)));

test("public Q&A round trip, independent protocol and queue, photo/privacy, completion and new-intake-only at 390px",async({page,browser,request})=>{
  await mkdir(evidence,{recursive:true});const s=await setup(request),id=s.id;
  const photoBytes=await sharp({create:{width:240,height:160,channels:3,background:"#547da2"}}).png().toBuffer();
  const photo=await request.post(`/api/v2/core/tickets/${id}/photos`,{headers:{...s.headers("tenant"),"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:photoBytes});expect(photo.status()).toBe(201);
  const privateNote="공개 문답과 분리된 합성 내부 메모";
  expect((await request.post(`/api/v2/core/manager/tickets/${id}/internal-notes`,{headers:s.headers("manager"),data:{body:privateNote}})).status()).toBe(201);
  expect((await request.post(`/api/v2/core/manager/tickets/${id}/work`,{headers:s.headers("manager"),data:{priority:"HIGH",assigneeLabel:"합성 내부 담당",dueAt:"2026-10-06T00:00:00Z",expectedVersion:1}})).status()).toBe(200);
  let ticket=s.ticket;
  for(let i=0;i<15&&ticket.detail.activeQuestion;i++){const q=ticket.detail.activeQuestion;const r=await request.post(`/api/v2/core/tickets/${id}/answers`,{headers:s.headers("tenant"),data:{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 답변"}});expect(r.status()).toBe(200);ticket=await r.json();}
  expect(ticket.detail.activeQuestion).toBeNull();expect((await request.post(`/api/v2/core/tickets/${id}/finalize`,{headers:s.headers("tenant"),data:{}})).status()).toBe(200);
  await page.setViewportSize({width:390,height:844});await login(page,s.codes.tenant);
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),manager=await context.newPage();
  try{
    await login(manager,s.codes.manager,id);const question="합성 점검을 위해 현재 상태를 알려 주세요.";await send(manager,question,"세입자에게 질문");
    await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();await expect(page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`)).toContainText("내 답변 필요");await open(page,id);
    const beforeProtocol=await s.read();const managerTicket=await (await request.get(`/api/v2/core/tickets/${id}`,{headers:s.headers("manager")})).json(),q=managerTicket.detail.followUpOptions.questions[0];expect(q).toBeTruthy();
    expect((await request.post(`/api/v2/core/tickets/${id}/decision`,{headers:s.headers("manager"),data:{type:"REQUEST_MORE_INFO",reason:"합성 구조화 질문",requestedQuestionIds:[q.questionId]}})).status()).toBe(200);
    expect(await s.read()).toEqual(beforeProtocol);
    const answer="합성 답변입니다. "+"긴한국어연속문자".repeat(28);await send(page,answer,"답변 보내기");
    await manager.getByRole("button",{name:"← 목록으로",exact:true}).click();await expect(manager.locator(`[data-ticket-id="${id}"] [data-open-ticket]`)).toContainText("관리자 답변 대기");await open(manager,id);
    await send(manager,"합성 답변을 확인했습니다.","답변");expect((await s.read()).waitingFor).toBe("NONE");
    const markup='<img src="missing" onerror="window.__qaExecuted=1"> 합성 문자';await send(manager,markup,"진행 안내");
    await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(conversation(page).getByText(markup,{exact:true})).toBeVisible();expect(await page.evaluate(()=>"__qaExecuted" in window)).toBe(false);expect(await conversation(page).locator("li[data-author] img").count()).toBe(0);
    for(const secret of [privateNote,"합성 내부 담당","긴급도","내부 메모"])await expect(page.getByText(secret,{exact:true})).toHaveCount(0);
    const publicText=JSON.stringify(await s.read());for(const field of [privateNote,"assigneeLabel","priority","internalNotes","actorId","ORG_ADMIN"])expect(publicText).not.toContain(field);
    await expect(page.getByRole("region",{name:"사진",exact:true}).getByRole("img")).toHaveCount(1);await fit(page);
    await conversation(page).screenshot({path:join(evidence,"tenant-conversation-390.png")});await conversation(manager).screenshot({path:join(evidence,"manager-conversation-desktop.png")});
    const stale=await s.read();expect((await request.post(`/api/v2/core/tickets/${id}/communication/messages`,{headers:s.headers("staff"),data:{clientRequestId:randomUUID(),expectedVersion:stale.version,intent:"MANAGER_UPDATE",body:"합성 동시 변경"}})).status()).toBe(201);
    await conversation(manager).getByLabel("공개 대화 내용").fill("합성 검토 후 안내");await conversation(manager).getByRole("button",{name:"진행 안내",exact:true}).click();await expect(conversation(manager).getByRole("alert")).toContainText("다른 변경이 먼저 저장");await expect(conversation(manager).getByLabel("공개 대화 내용")).toHaveValue("합성 검토 후 안내");
    await manager.setViewportSize({width:390,height:844});await fit(manager);await conversation(manager).screenshot({path:join(evidence,"manager-conflict-390.png")});
    await conversation(manager).getByRole("button",{name:"대화 새로고침",exact:true}).click();await send(manager,"합성 검토 후 안내","진행 안내");
    await openInspector(manager);await manager.getByLabel("처리 기록",{exact:true}).fill("합성 점검 시작 기록");await manager.getByRole("button",{name:"처리 시작 기록",exact:true}).click();await expect(manager.getByTestId("work-status")).toHaveText("처리중");
    await send(manager,"완료 이후에도 기존 질문과 결과를 이력에서 확인하세요.","세입자에게 질문");
    const finalVersion=(await s.read()).version;await openInspector(manager);await manager.getByLabel("처리 기록",{exact:true}).fill("관리자가 확인한 합성 처리 결과");await manager.getByRole("button",{name:"처리 완료 기록",exact:true}).click();await expect(manager.getByTestId("work-status")).toHaveText("✓ 처리 완료");
    await page.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();await expect(conversation(page).getByLabel("공개 대화 내용")).toHaveCount(0);await expect(conversation(page).getByText("내 답변 필요",{exact:true})).toHaveCount(0);expect(await s.read()).toMatchObject({version:finalVersion,readOnly:true,waitingFor:"NONE"});
    const finalTicket=await (await request.get(`/api/v2/core/tickets/${id}`,{headers:s.headers("tenant")})).json();expect(finalTicket.events.filter((e:{kind:string})=>e.kind==="HANDLING")).toHaveLength(2);expect(finalTicket.detail.moreInfoRequest).toBeTruthy();
    expect((await request.post(`/api/v2/core/tickets/${id}/communication/messages`,{headers:s.headers("tenant"),data:{clientRequestId:randomUUID(),expectedVersion:finalVersion,intent:"TENANT_MESSAGE",body:"거부될 합성 메시지"}})).status()).toBe(409);
    await fit(page);await page.screenshot({path:join(evidence,"tenant-completed-390.png"),fullPage:true});await page.getByRole("button",{name:"아직 문제가 있어요",exact:true}).click();await expect(page.getByLabel("문제 설명",{exact:true})).toHaveValue("");expect(await (await request.get(`/api/v2/core/tickets/${id}`,{headers:s.headers("tenant")})).json()).toEqual(finalTicket);
    await writeFile(join(evidence,"roundtrip.private.json"),JSON.stringify({ticketId:id,version:finalVersion}),{flag:"w"});
  }finally{await context.close();}
});

test("lost response after commit recovers one receipt after refresh without saving the body",async({page,request})=>{
  const s=await setup(request);await login(page,s.codes.tenant,s.id);let key="";
  await page.route(`**/tickets/${s.id}/communication/messages`,async route=>{key=route.request().postDataJSON().clientRequestId;const r=await route.fetch();expect(r.status()).toBe(201);await route.abort("failed");},{times:1});
  await conversation(page).getByLabel("공개 대화 내용").fill("합성 응답 유실 점검");await conversation(page).getByRole("button",{name:"추가 문의 보내기",exact:true}).click();await expect(conversation(page).getByRole("button",{name:"저장 여부 확인",exact:true})).toBeEnabled();
  const pending=await metadata(page);expect(pending).toEqual([{ticketId:s.id,clientRequestId:key,intent:"TENANT_MESSAGE",expectedVersion:0}]);
  await page.reload();await open(page,s.id);await expect(conversation(page).getByLabel("공개 대화 내용")).toHaveValue("");await conversation(page).getByRole("button",{name:"저장 여부 확인",exact:true}).click();await expect(conversation(page).getByRole("status")).toContainText("이미 저장된 대화");expect(await metadata(page)).toEqual([]);expect((await s.read()).messages).toHaveLength(1);
  const receipt=await request.get(`/api/v2/core/tickets/${s.id}/communication/requests/${key}`,{headers:s.headers("tenant")});expect(receipt.status()).toBe(200);
  await mkdir(evidence,{recursive:true});await writeFile(join(evidence,"receipt.private.json"),JSON.stringify({ticketId:s.id,clientRequestId:key}),{flag:"w"});
});

test("uncommitted uncertainty remains unconfirmed after refresh and requires an explicit new draft",async({page,request})=>{
  const s=await setup(request);await login(page,s.codes.tenant,s.id);let writes=0;
  await page.route(`**/tickets/${s.id}/communication/messages`,async route=>{writes++;await route.abort("failed");},{times:1});
  await conversation(page).getByLabel("공개 대화 내용").fill("합성 미저장 요청");await conversation(page).getByRole("button",{name:"추가 문의 보내기",exact:true}).click();await expect(conversation(page).getByRole("button",{name:"저장 여부 확인",exact:true})).toBeEnabled();
  await page.reload();await open(page,s.id);await conversation(page).getByRole("button",{name:"저장 여부 확인",exact:true}).click();await expect(conversation(page).getByRole("alert")).toContainText("저장 기록을 찾지 못했습니다");expect((await s.read()).messages).toEqual([]);expect(writes).toBe(1);
  await expect(conversation(page).getByRole("button",{name:"추가 문의 보내기",exact:true})).toBeDisabled();await conversation(page).getByRole("button",{name:"확인 후 새 메시지 작성",exact:true}).click();expect(await metadata(page)).toEqual([]);await expect(conversation(page).getByLabel("공개 대화 내용")).toHaveValue("");
});

for(const status of [401,403])test(`denied receipt ${status} clears protected content and all recovery metadata`,async({page,request})=>{
  const s=await setup(request);await login(page,s.codes.tenant,s.id);
  await page.route(`**/tickets/${s.id}/communication/messages`,route=>route.abort("failed"),{times:1});
  await conversation(page).getByLabel("공개 대화 내용").fill("합성 접근 회수 점검");await conversation(page).getByRole("button",{name:"추가 문의 보내기",exact:true}).click();await expect(conversation(page).getByRole("button",{name:"저장 여부 확인",exact:true})).toBeEnabled();
  await page.route(`**/tickets/${s.id}/communication/requests/*`,route=>route.fulfill({status,contentType:"application/json",body:JSON.stringify({error:{code:status===401?"UNAUTHENTICATED":"FORBIDDEN",message:"접근할 수 없습니다."}})}));
  await conversation(page).getByRole("button",{name:"저장 여부 확인",exact:true}).click();await expect(page.getByLabel("개발 접근 코드")).toBeVisible();expect(await metadata(page)).toEqual([]);await expect(conversation(page)).toHaveCount(0);
});

import { test,expect,type Page,type APIRequestContext } from "@playwright/test";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID,randomBytes,createHash } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { openConversation,openInspector } from "./presentation";

const root=join(homedir(),".build-manager-rc1-private"),evidence=join(root,"completion-followup-browser");
let outcomeCodes:Record<string,string>;
test.beforeAll(async()=>{
 // Existing regression cases revoke their own fixture sessions. These dedicated
 // sessions keep authenticated 404 controls independent of that earlier test.
 const state=JSON.parse(await readFile(join(root,"state.json"),"utf8"));expect(state.admin.host).toBe("127.0.0.1");expect(state.admin.database).toBe("core_flow_synthetic");
 const admin=new Client(state.admin),login=new Client(state.roles.b1.loginConfig);await admin.connect();await login.connect();outcomeCodes={};
 try{
  expect((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
  for(const who of ["tenant","manager","tenantPeer","tenantOther","otherTenant","otherManager"]){
   const account=state.fixture.accounts[who],identity=(await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'",[account.userId])).rows[0];expect(identity.issuer).toBe("https://rc1.synthetic.invalid/");
   const handle=randomBytes(32).toString("hex"),digest=createHash("sha256").update(handle).digest();expect((await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes') id",[identity.issuer,identity.subject,digest])).rows[0].id).toBe(account.userId);
   await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)",[digest,account.orgId]);outcomeCodes[who]=handle;
  }
 }finally{await login.end();await admin.end();}
});
const card=(page:Page)=>page.getByRole("region",{name:"세입자 처리 결과",exact:true});
const metadata=(page:Page)=>page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("core-outcome-request:")).map(k=>JSON.parse(sessionStorage.getItem(k)!)));
async function login(page:Page,code:string,id?:string){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill(code);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();if(id)await open(page,id);}
async function open(page:Page,id:string){await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();await expect(page.getByTestId("ticket-heading")).toBeVisible();}
async function fit(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
const photoBytes=()=>sharp({create:{width:240,height:160,channels:3,background:"#759cac"}}).png().toBuffer();
async function setup(request:APIRequestContext,rich=false){
 const codes=outcomeCodes,headers=(who="tenant")=>({Authorization:`Bearer ${codes[who]}`});
 const get=async(path:string,who="tenant")=>{const r=await request.get("/api/v2/core/"+path,{headers:headers(who)});expect(r.status()).toBe(200);return r.json();};
 const post=async(path:string,data:unknown,who="tenant",status=200)=>{const r=await request.post("/api/v2/core/"+path,{headers:headers(who),data});expect(r.status()).toBe(status);return r.json();};
 const units=await get("units"),ticket=await post("tickets",{unitId:units[0].id,issueType:"LEAK",rawUserText:"원본에만 남는 합성 설명"}, "tenant",201),id=ticket.ticketId as string,path="tickets/"+id;
 if(rich){
  const q=ticket.detail.activeQuestion;
  if(q)await post(path+"/answers",{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"원본 합성 답변"});
  const p=await request.post("/api/v2/core/"+path+"/photos",{headers:{...headers(),"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:await photoBytes()});expect(p.status()).toBe(201);
  await post(path+"/communication/messages",{clientRequestId:randomUUID(),expectedVersion:0,intent:"MANAGER_UPDATE",body:"원본에만 남는 합성 공개 대화"},"manager",201);
  await post("manager/"+path+"/work",{priority:"HIGH",assigneeLabel:"원본 전용 담당",dueAt:"2026-10-06T00:00:00Z",expectedVersion:1},"manager");
  await post("manager/"+path+"/internal-notes",{body:"원본 관리자 비공개 메모"},"manager",201);
 }
 await post(path+"/handling",{status:"IN_PROGRESS",message:"합성 처리 시작"},"manager");
 await post(path+"/handling",{status:"COMPLETED",message:"합성 완료 기록",expectedCommunicationVersion:(await get(path+"/communication")).version},"manager");
 return {codes,headers,get,post,id,path};
}
async function frozen(id:string){
 const state=JSON.parse(await readFile(join(root,"state.json"),"utf8"));expect(state.admin.host).toBe("127.0.0.1");expect(state.admin.database).toBe("core_flow_synthetic");
 const db=new Client(state.admin);await db.connect();try{
  expect((await db.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
  const hashes:Record<string,string[]>={};
  for(const [table,key] of [["ticket","id"],["ticket_event","ticket_id"],["ticket_photo","ticket_id"],["ticket_public_message","ticket_id"],["ticket_communication_thread","ticket_id"],["ticket_work","ticket_id"],["ticket_internal_note","ticket_id"]])hashes[table]=(await db.query("SELECT md5(row_to_json(t)::text) h FROM core_flow."+table+" t WHERE "+key+"=$1 ORDER BY 1",[id])).rows.map(r=>r.h);
  return hashes;
 }finally{await db.end();}
}
async function follow(page:Page,kind:"UNRESOLVED"|"RECURRENCE_CLAIM",body:string,photo=false){
 await card(page).getByRole("button",{name:kind==="UNRESOLVED"?"아직 문제가 있어요":"다시 문제가 생겼어요",exact:true}).click();
 await expect(page.getByText("이전 완료 접수에서 이어서 새로 접수합니다.",{exact:true})).toBeVisible();await expect(page.getByLabel("문제 설명",{exact:true})).toHaveValue("");
 await page.getByRole("radio",{name:"난방",exact:true}).check();await page.getByLabel("문제 설명",{exact:true}).fill(body);
 if(photo){await page.getByLabel("참고 사진 선택",{exact:true}).setInputFiles({name:"fresh-synthetic.png",mimeType:"image/png",buffer:await photoBytes()});await expect(page.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();}
 const response=page.waitForResponse(r=>r.url().endsWith("/follow-up")&&r.request().method()==="POST");await page.getByRole("button",{name:"접수하기",exact:true}).click();const r=await response;expect(r.status()).toBe(201);return (await r.json()).ticket.ticketId as string;
}

test("RESOLVED survives re-entry and manager read, then allows recurrence alone",async({page,browser,request})=>{
 const s=await setup(request),before=await frozen(s.id);await mkdir(evidence,{recursive:true});await page.setViewportSize({width:390,height:844});await login(page,s.codes.tenant,s.id);
 await card(page).getByRole("button",{name:"해결됐어요",exact:true}).click();await expect(card(page).getByText("해결됐다고 알려주셨어요.",{exact:true})).toBeVisible();
 await expect(card(page).getByRole("button",{name:"아직 문제가 있어요",exact:true})).toHaveCount(0);await fit(page);await page.screenshot({path:join(evidence,"resolved-tenant-390.png"),fullPage:true});
 await page.reload();await open(page,s.id);await expect(card(page).getByText("해결됐다고 알려주셨어요.",{exact:true})).toBeVisible();
 const ctx=await browser.newContext(),manager=await ctx.newPage();
 try{await login(manager,s.codes.manager,s.id);await expect(card(manager).getByText("세입자가 해결됐다고 응답",{exact:true})).toBeVisible();await expect(card(manager).getByRole("button",{name:"해결됐어요",exact:true})).toHaveCount(0);await manager.screenshot({path:join(evidence,"resolved-manager.png"),fullPage:true});}finally{await ctx.close();}
 const disallowed=await request.post("/api/v2/core/"+s.path+"/follow-up",{headers:s.headers(),data:{clientRequestId:randomUUID(),claimKind:"UNRESOLVED",issueType:"LEAK",rawUserText:"금지된 미해결 전환"}});expect(disallowed.status()).toBe(409);
 const target=await follow(page,"RECURRENCE_CLAIM","해결 응답 후 다시 생긴 합성 증상");expect((await s.get(s.path+"/outcome")).followUpTicketId).toBe(target);expect(await frozen(s.id)).toEqual(before);
 await writeFile(join(evidence,"resolved-recurrence.private.json"),JSON.stringify({source:s.id,target}),{flag:"w"});
});

for(const kind of ["UNRESOLVED","RECURRENCE_CLAIM"] as const)test(kind+" fresh follow-up preserves rich source, photo/Q&A/protocol/work and 390px",async({page,browser,request})=>{
 const s=await setup(request,true),before=await frozen(s.id),source=await s.get(s.path);await mkdir(evidence,{recursive:true});await page.setViewportSize({width:390,height:844});await login(page,s.codes.tenant,s.id);
 const body="새 합성 증상 "+"긴한국어".repeat(24)+"Unbroken".repeat(16),target=await follow(page,kind,body,true),path="tickets/"+target;
 await expect(card(page).getByText("이전 완료 접수에서 이어진 요청",{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"사진",exact:true}).getByRole("img")).toHaveCount(1);
 const photos=await s.get(path+"/photos"),oldPhotos=await s.get(s.path+"/photos");expect(photos).toHaveLength(1);expect(photos[0].photoId).not.toBe(oldPhotos[0].photoId);
 expect((await s.get(path+"/communication")).messages).toEqual([]);expect((await s.get("manager/"+path+"/internal-notes","manager"))).toEqual([]);
 expect((await s.get("manager/"+path+"/work","manager"))).toMatchObject({priority:"NORMAL",assigneeLabel:null,dueAt:null});
 const created=await s.get(path);expect(created.detail.issueType).toBe("HEATING");expect(created.detail.activeQuestion).not.toBeNull();expect(created.events.map((e:{kind:string})=>e.kind)).toEqual(["CREATED"]);
 await page.getByText("추가 확인",{exact:true}).click();const protocol=page.locator("details").filter({has:page.locator("summary").filter({hasText:/^추가 확인$/})}),question=created.detail.activeQuestion;
 const answered=page.waitForResponse(r=>r.url().endsWith("/"+path+"/answers")&&r.request().method()==="POST");
 if(question.responseType==="YES_NO")await protocol.getByTestId("answer-no").click();else if(question.responseType==="SINGLE_SELECT")await protocol.getByTestId("answer-"+question.options[0].value).click();else{await protocol.getByLabel("답변",{exact:true}).fill("새 후속 접수의 합성 답변");await protocol.getByTestId("answer-text-submit").click();}
 expect((await answered).status()).toBe(200);expect((await s.get(path)).events.map((e:{kind:string})=>e.kind)).toContain("ANSWERED");
 await openConversation(page);const chat=page.getByRole("region",{name:"세입자와 공유하는 대화",exact:true});await chat.getByLabel("공개 대화 내용",{exact:true}).fill(body);await chat.getByRole("button",{name:"추가 문의 보내기",exact:true}).click();await expect(chat.getByRole("listitem").filter({hasText:body})).toBeVisible();await fit(page);
 for(const hidden of ["원본에만 남는 합성 공개 대화","원본 관리자 비공개 메모","원본 전용 담당"])await expect(page.getByText(hidden,{exact:true})).toHaveCount(0);
 await page.screenshot({path:join(evidence,kind.toLowerCase()+"-target-390.png"),fullPage:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844}}),manager=await ctx.newPage();try{
  await login(manager,s.codes.manager,target);await expect(card(manager).getByRole("button",{name:"이전 완료 접수 보기",exact:true})).toBeVisible();await openInspector(manager);await expect(manager.getByRole("region",{name:"업무 관리",exact:true}).getByRole("combobox",{name:"긴급도",exact:true})).toHaveValue("NORMAL");await fit(manager);
  await card(manager).getByRole("button",{name:"이전 완료 접수 보기",exact:true}).click();await expect(card(manager).getByText(kind==="UNRESOLVED"?"세입자가 아직 문제가 있다고 알려 후속 접수 생성":"세입자가 다시 문제가 생겼다고 알려 후속 접수 생성",{exact:true})).toBeVisible();await manager.screenshot({path:join(evidence,kind.toLowerCase()+"-manager-390.png"),fullPage:true});
 }finally{await ctx.close();}
 const next=await request.post("/api/v2/core/"+s.path+"/follow-up",{headers:s.headers(),data:{clientRequestId:randomUUID(),claimKind:kind,issueType:"LEAK",rawUserText:"두 번째 직접 후속 거부"}});expect(next.status()).toBe(409);
 for(const who of ["tenantPeer","tenantOther","otherTenant","otherManager"])for(const suffix of ["/outcome","/follow-up"])expect((await request.get("/api/v2/core/"+s.path+suffix,{headers:s.headers(who)})).status()).toBe(404);
 expect(await s.get(s.path)).toEqual(source);expect(await frozen(s.id)).toEqual(before);
 await writeFile(join(evidence,kind.toLowerCase()+".private.json"),JSON.stringify({source:s.id,target,sourceHashes:before,targetPhotoHash:createHash("sha256").update(Buffer.from(await (await request.get(photos[0].path,{headers:s.headers()})).body())).digest("hex")}),{flag:"w"});
});

test("committed RESOLVED response loss recovers its receipt after reload without a second write",async({page,request})=>{
 const s=await setup(request);await login(page,s.codes.tenant,s.id);let key="",writes=0;
 await page.route("**/"+s.path+"/outcome/resolved",async route=>{writes++;key=route.request().postDataJSON().clientRequestId;const r=await route.fetch();expect(r.status()).toBe(201);await route.abort("failed");},{times:1});
 await card(page).getByRole("button",{name:"해결됐어요",exact:true}).click();await expect(page.getByRole("button",{name:"저장 여부 확인 · 해결 응답",exact:true})).toBeVisible();expect(await metadata(page)).toEqual([{sourceTicketId:s.id,clientRequestId:key,claimKind:"RESOLVED"}]);
 await page.reload();await page.getByRole("button",{name:"저장 여부 확인 · 해결 응답",exact:true}).click();await expect(card(page).getByText("해결됐다고 알려주셨어요.",{exact:true})).toBeVisible();expect(await metadata(page)).toEqual([]);expect(writes).toBe(1);
 await writeFile(join(evidence,"resolved.private.json"),JSON.stringify({source:s.id,key}),{flag:"w"});
});

test("committed follow-up response loss reload recovers the exact target with one receipt and no body storage",async({page,request})=>{
 const s=await setup(request);await login(page,s.codes.tenant,s.id);let key="",target="",payload:unknown;
 await page.route("**/"+s.path+"/follow-up",async route=>{if(route.request().method()!=="POST"){await route.continue();return;}payload=route.request().postDataJSON();key=(payload as {clientRequestId:string}).clientRequestId;const r=await route.fetch();expect(r.status()).toBe(201);target=(await r.json()).ticket.ticketId;await route.abort("failed");});
 await card(page).getByRole("button",{name:"아직 문제가 있어요",exact:true}).click();await page.getByLabel("문제 설명",{exact:true}).fill("복원해서는 안 되는 합성 본문");await page.getByRole("button",{name:"접수하기",exact:true}).click();await expect(page.getByRole("button",{name:"같은 후속 접수 다시 확인·전송",exact:true})).toBeEnabled();expect(await metadata(page)).toEqual([{sourceTicketId:s.id,clientRequestId:key,claimKind:"UNRESOLVED"}]);
 await page.unroute("**/"+s.path+"/follow-up");await page.reload();await page.getByRole("button",{name:"저장 여부 확인 · 후속 접수",exact:true}).click();await expect(card(page).getByText("이전 완료 접수에서 이어진 요청",{exact:true})).toBeVisible();await expect(page.getByText("접수번호 "+target,{exact:true})).toBeAttached();expect(await metadata(page)).toEqual([]);
 const replay=await request.post("/api/v2/core/"+s.path+"/follow-up",{headers:s.headers(),data:payload});expect(replay.status()).toBe(200);expect((await replay.json()).ticket.ticketId).toBe(target);
 const receipt=await s.get(s.path+"/outcome/requests/"+key);expect(receipt.targetTicketId).toBe(target);await writeFile(join(evidence,"response-loss.private.json"),JSON.stringify({source:s.id,target,key}),{flag:"w"});
});

test("uncommitted response loss retries the identical payload only after receipt verification",async({page,request})=>{
 const s=await setup(request);await login(page,s.codes.tenant,s.id);const bodies:unknown[]=[];
 await page.route("**/"+s.path+"/follow-up",async route=>{if(route.request().method()!=="POST"){await route.continue();return;}bodies.push(route.request().postDataJSON());if(bodies.length===1)await route.abort("failed");else await route.continue();});
 await card(page).getByRole("button",{name:"다시 문제가 생겼어요",exact:true}).click();await page.getByLabel("문제 설명",{exact:true}).fill("같은 입력으로 다시 보내는 합성 증상");await page.getByRole("button",{name:"접수하기",exact:true}).click();await expect(page.getByLabel("문제 설명",{exact:true})).toHaveAttribute("readonly","");
 await page.getByRole("button",{name:"저장 여부 확인 · 후속 접수",exact:true}).click();await expect(page.getByRole("region",{name:"처리 결과 저장 확인",exact:true}).getByRole("alert")).toContainText("확정된 것은 아닙니다");await fit(page);
 await page.getByRole("button",{name:"같은 후속 접수 다시 확인·전송",exact:true}).click();await expect(card(page).getByText("이전 완료 접수에서 이어진 요청",{exact:true})).toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(await metadata(page)).toEqual([]);
});

for(const status of [401,403])test("outcome permission loss "+status+" clears protected projection and recovery",async({page,request})=>{
 const s=await setup(request);await login(page,s.codes.tenant,s.id);
 await page.route("**/"+s.path+"/outcome/resolved",route=>route.abort("failed"),{times:1});await card(page).getByRole("button",{name:"해결됐어요",exact:true}).click();await expect(page.getByRole("button",{name:"저장 여부 확인 · 해결 응답",exact:true})).toBeVisible();
 await page.route("**/"+s.path+"/outcome/requests/*",route=>route.fulfill({status,contentType:"application/json",body:JSON.stringify({error:{code:status===401?"UNAUTHENTICATED":"FORBIDDEN",message:"접근할 수 없습니다."}})}));
 await page.getByRole("button",{name:"저장 여부 확인 · 해결 응답",exact:true}).click();await expect(page.getByLabel("개발 접근 코드")).toBeVisible();await expect(card(page)).toHaveCount(0);expect(await metadata(page)).toEqual([]);
});

test("loading and failure never masquerade as no assertion, retry is usable at 390px",async({page,request})=>{
 const s=await setup(request);await page.setViewportSize({width:390,height:844});await login(page,s.codes.tenant);
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route("**/"+s.path+"/outcome",async route=>{await pending;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"UNAVAILABLE",message:"일시적으로 사용할 수 없습니다."}})});},{times:1});
 await open(page,s.id);await expect(card(page).getByRole("status")).toContainText("불러오는 중");await expect(card(page).getByRole("button",{name:"해결됐어요",exact:true})).toHaveCount(0);release();
 await expect(card(page).getByRole("alert")).toBeVisible();await fit(page);await page.screenshot({path:join(evidence,"error-retry-390.png"),fullPage:true});await card(page).getByRole("button",{name:"결과 새로고침",exact:true}).click();await expect(card(page).getByRole("button",{name:"해결됐어요",exact:true})).toBeVisible();
});

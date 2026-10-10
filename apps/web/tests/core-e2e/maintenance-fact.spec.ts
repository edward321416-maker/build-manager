import { test,expect,type Page,type APIRequestContext } from "@playwright/test";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID,randomBytes,createHash } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { openInspector } from "./presentation";
import { routeOnce } from "../routes";
const root=join(homedir(),".build-manager-rc1-private"),evidence=join(root,"maintenance-fact-browser");
let codes:Record<string,string>;
test.beforeAll(async()=>{
 const state=JSON.parse(await readFile(join(root,"state.json"),"utf8"));expect(state.admin.host).toBe("127.0.0.1");expect(state.admin.database).toBe("core_flow_synthetic");
 const admin=new Client(state.admin),login=new Client(state.roles.b1.loginConfig);await admin.connect();await login.connect();codes={};
 try{expect((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
  for(const who of ["tenant","manager"]){const account=state.fixture.accounts[who],identity=(await admin.query("SELECT issuer,subject FROM authn.external_identity WHERE user_id=$1 AND status='ACTIVE'",[account.userId])).rows[0];expect(identity.issuer).toBe("https://rc1.synthetic.invalid/");const handle=randomBytes(32).toString("hex"),digest=createHash("sha256").update(handle).digest();await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes')",[identity.issuer,identity.subject,digest]);await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)",[digest,account.orgId]);codes[who]=handle;}
 }finally{await login.end();await admin.end();}await mkdir(evidence,{recursive:true});
});
const editor=(p:Page)=>p.getByRole("region",{name:"호실 정비 사실 기록",exact:true});
const timeline=(p:Page)=>p.getByRole("region",{name:"호실 정비 이력",exact:true});
async function login(page:Page,id?:string){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill(codes.manager);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();if(id){await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();await openInspector(page);await expect(editor(page).getByRole("button",{name:"정비 사실 다시 불러오기",exact:true})).toBeEnabled();}}
async function setup(request:APIRequestContext,rich=false){
 const headers=(who="manager")=>({Authorization:`Bearer ${codes[who]}`});
 const get=async(path:string,who="manager")=>{const r=await request.get("/api/v2/core/"+path,{headers:headers(who)});expect(r.status()).toBe(200);return r.json();};
 const post=async(path:string,data:unknown,who="manager",status=200)=>{const r=await request.post("/api/v2/core/"+path,{headers:headers(who),data});expect(r.status()).toBe(status);return r.json();};
 const unit=(await get("units","tenant"))[0].id,t=await post("tickets",{unitId:unit,issueType:"LEAK",rawUserText:"정비 사실로 복사하면 안 되는 합성 원문"},"tenant",201),id=t.ticketId as string,path="tickets/"+id;
 if(rich){const q=t.detail.activeQuestion;if(q)await post(path+"/answers",{questionId:q.questionId,answer:q.responseType==="YES_NO"?false:q.responseType==="SINGLE_SELECT"?q.options[0].value:"합성 기존 답변"},"tenant");
  const photo=await request.post("/api/v2/core/"+path+"/photos",{headers:{...headers("tenant"),"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:await sharp({create:{width:64,height:48,channels:3,background:"#759cac"}}).png().toBuffer()});expect(photo.status()).toBe(201);
  await post(path+"/communication/messages",{clientRequestId:randomUUID(),expectedVersion:0,intent:"MANAGER_UPDATE",body:"정비 이력에 복사하면 안 되는 합성 공개 문답"},"manager",201);
  await post("manager/"+path+"/work",{priority:"URGENT",assigneeLabel:"합성 내부 담당",dueAt:"2030-01-01T00:00:00Z",expectedVersion:1});await post("manager/"+path+"/internal-notes",{body:"합성 비공개 정비 메모"},"manager",201);
 }
 await post(path+"/handling",{status:"IN_PROGRESS",message:"합성 작업 시작"});await post(path+"/handling",{status:"COMPLETED",message:"합성 완료 기록",expectedCommunicationVersion:(await get(path+"/communication")).version});
 return{headers,get,post,id,path,unit,factPath:"manager/"+path+"/maintenance-fact"};
}
async function frozen(id:string){const state=JSON.parse(await readFile(join(root,"state.json"),"utf8"));expect(state.admin.host).toBe("127.0.0.1");const db=new Client(state.admin);await db.connect();try{const result:Record<string,string[]>={};for(const [table,key]of [["ticket","id"],["ticket_event","ticket_id"],["ticket_photo","ticket_id"],["ticket_public_message","ticket_id"],["ticket_communication_thread","ticket_id"],["ticket_work","ticket_id"],["ticket_internal_note","ticket_id"]])result[table]=(await db.query(`SELECT md5(row_to_json(t)::text) h FROM core_flow.${table} t WHERE ${key}=$1 ORDER BY 1`,[id])).rows.map(r=>r.h);return result;}finally{await db.end();}}
const fit=async(p:Page)=>expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
test("actual390px root/correction, source preservation, dynamic claims and source/target navigation",async({page,request})=>{
 const s=await setup(request,true),before=await frozen(s.id);await page.setViewportSize({width:390,height:844});await login(page,s.id);
 const panel=editor(page);await panel.getByLabel("정비 작업 종류").selectOption("REPAIR");await panel.getByLabel("정비 부품·위치 명칭").fill("합성밸브".repeat(20));await panel.getByRole("button",{name:"정비 사실 저장",exact:true}).click();await expect(panel.getByText("정비 사실 요청의 저장을 확인했습니다.",{exact:true})).toBeVisible();const rootFact=(await s.get(s.factPath)).current;await fit(page);
 await panel.getByRole("button",{name:"정정 기록 추가",exact:true}).click();await panel.getByLabel("정비 작업 종류").selectOption("PART_REPLACEMENT");await panel.getByLabel("정비 부품·위치 명칭").fill("Unbroken".repeat(10));await panel.getByLabel("정정 이유").selectOption("COMPONENT_LABEL");await panel.getByRole("button",{name:"정정 기록 저장",exact:true}).click();await expect(panel.getByText("정정 1회 · 현재 기록",{exact:true})).toBeVisible();
 const detail=await s.get(s.factPath);expect(detail.revisions.map((r:{current:boolean})=>r.current)).toEqual([false,true]);expect(detail.current.sourceCompletedAt).toBe(rootFact.sourceCompletedAt);expect(await frozen(s.id)).toEqual(before);await fit(page);await page.screenshot({path:join(evidence,"fact-correction-390.png"),fullPage:true});
 await s.post(s.path+"/outcome/resolved",{clientRequestId:randomUUID()},"tenant",201);const follow=await s.post(s.path+"/follow-up",{clientRequestId:randomUUID(),claimKind:"RECURRENCE_CLAIM",issueType:"HEATING",rawUserText:"합성 후속 새 증상"},"tenant",201);
 await panel.getByRole("button",{name:"호실 이력에서 보기",exact:true}).click();const rows=timeline(page);await expect(rows.locator(`[data-fact-id="${detail.current.factId}"]`)).toBeVisible();await expect(rows.locator(`[data-fact-id="${detail.current.factId}"]`).getByText("세입자가 다시 문제가 생겼다고 응답",{exact:true})).toBeVisible();
 for(const hidden of ["정비 사실로 복사하면 안 되는 합성 원문","정비 이력에 복사하면 안 되는 합성 공개 문답","합성 내부 담당","합성 비공개 정비 메모"])await expect(rows.getByText(hidden,{exact:true})).toHaveCount(0);await expect(page.getByRole("region",{name:"선택한 접수",exact:true})).toHaveCount(0);await fit(page);await page.screenshot({path:join(evidence,"timeline-390.png"),fullPage:true});
 await rows.locator(`[data-fact-id="${detail.current.factId}"]`).getByRole("button",{name:"후속 접수 있음",exact:true}).click();await expect(page.getByRole("button",{name:"이전 완료 접수 보기",exact:true})).toBeVisible();await expect(editor(page)).toHaveCount(0);
 await page.getByRole("navigation",{name:"관리자 보기"}).getByRole("button",{name:"호실 정비 이력",exact:true}).click();await timeline(page).locator(`[data-fact-id="${detail.current.factId}"]`).getByRole("button",{name:"근거 접수 보기",exact:true}).click();await expect(page.getByTestId("ticket-heading")).toBeVisible();await page.reload();await page.getByRole("navigation",{name:"관리자 보기"}).getByRole("button",{name:"호실 정비 이력",exact:true}).click();await expect(timeline(page).locator(`[data-fact-id="${detail.current.factId}"]`)).toBeVisible();
 await writeFile(join(evidence,"root-correction.private.json"),JSON.stringify({source:s.id,target:follow.ticket.ticketId,rootFactId:rootFact.factId,factId:detail.current.factId,sourceHashes:before}));
});
test("committed root response loss keeps one UUID and requires explicit replay even when values match",async({page,request})=>{
 const s=await setup(request);await login(page,s.id);let writes=0,key="",forwardedReads=0;
 let confirmLoss!:()=>void;const lossComplete=new Promise<void>(resolve=>{confirmLoss=resolve;});
 // Keep interception stable through recovery; only the first POST loses its response.
 await page.route("**/"+s.factPath,async route=>{if(route.request().method()!=="POST"){if(route.request().method()==="GET")forwardedReads++;await route.continue();return;}expect(route.request().method()).toBe("POST");writes++;if(writes!==1){await route.continue();return;}key=route.request().postDataJSON().clientRequestId;const r=await route.fetch();expect(r.status()).toBe(201);await route.abort("failed");confirmLoss();});
 await editor(page).getByLabel("정비 부품·위치 명칭").fill("합성 응답 유실");await editor(page).getByRole("button",{name:"정비 사실 저장",exact:true}).click();await lossComplete;await expect(editor(page).getByRole("button",{name:"같은 요청으로 저장 확인",exact:true})).toBeEnabled();expect(writes).toBe(1);expect(forwardedReads).toBeGreaterThan(0);await expect(editor(page).getByText("정비 사실 요청의 저장을 확인했습니다.",{exact:true})).toHaveCount(0);
 const before=await s.get(s.factPath),response=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().endsWith(s.factPath));await editor(page).getByRole("button",{name:"같은 요청으로 저장 확인",exact:true}).click();const replay=await response;expect(replay.status()).toBe(200);expect(replay.request().postDataJSON().clientRequestId).toBe(key);expect(writes).toBe(2);expect(await s.get(s.factPath)).toEqual(before);
 const changed=await request.post("/api/v2/core/"+s.factPath,{headers:s.headers(),data:{clientRequestId:key,actionKind:"OTHER",componentLabel:"합성 응답 유실"}});expect(changed.status()).toBe(409);
 await writeFile(join(evidence,"response-loss.private.json"),JSON.stringify({source:s.id,key,factId:before.current.factId}));
});
test("stale correction preserves input until explicit review, and lost correction replays exactly",async({page,request})=>{
 const s=await setup(request),rootFact=await s.post(s.factPath,{clientRequestId:randomUUID(),actionKind:"INSPECTION",componentLabel:null},"manager",201);await login(page,s.id);await editor(page).getByRole("button",{name:"정정 기록 추가",exact:true}).click();await editor(page).getByLabel("정비 부품·위치 명칭").fill("내가 입력한 합성 부품");
 const other=await s.post(`manager/maintenance-facts/${rootFact.factId}/corrections`,{clientRequestId:randomUUID(),expectedCurrentFactId:rootFact.factId,actionKind:"REPAIR",componentLabel:"먼저 저장된 합성 부품",correctionReason:"OTHER"},"manager",201);
 await editor(page).getByRole("button",{name:"정정 기록 저장",exact:true}).click();await expect(editor(page).getByRole("button",{name:"최신 기록을 확인했습니다",exact:true})).toBeEnabled();await expect(editor(page).getByLabel("정비 부품·위치 명칭")).toHaveValue("내가 입력한 합성 부품");await expect(editor(page).getByRole("button",{name:"정정 기록 저장",exact:true})).toBeDisabled();await editor(page).getByRole("button",{name:"최신 기록을 확인했습니다",exact:true}).click();
 let key="",writes=0,recoveryReads=0;const path=`manager/maintenance-facts/${other.factId}/corrections`;
 let confirmLoss!:()=>void;const lossComplete=new Promise<void>(resolve=>{confirmLoss=resolve;});
 page.on("response",response=>{if(response.request().method()==="GET"&&response.url().endsWith(s.factPath)&&response.status()===200)recoveryReads++;});
 await page.route("**/"+path,async route=>{if(route.request().method()!=="POST"){await route.continue();return;}writes++;if(writes!==1){await route.continue();return;}key=route.request().postDataJSON().clientRequestId;expect((await route.fetch()).status()).toBe(201);await route.abort("failed");confirmLoss();});await editor(page).getByRole("button",{name:"정정 기록 저장",exact:true}).click();await lossComplete;await expect(editor(page).getByRole("button",{name:"같은 요청으로 저장 확인",exact:true})).toBeEnabled();expect(writes).toBe(1);expect(recoveryReads).toBeGreaterThan(0);
 const before=await s.get(s.factPath),response=page.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==="POST");await editor(page).getByRole("button",{name:"같은 요청으로 저장 확인",exact:true}).click();const replay=await response;expect(replay.status()).toBe(200);expect(replay.request().postDataJSON().clientRequestId).toBe(key);expect(replay.request().postDataJSON().expectedCurrentFactId).toBe(other.factId);expect(writes).toBe(2);expect((await s.get(s.factPath)).revisions).toHaveLength(3);expect(await s.get(s.factPath)).toEqual(before);
 await writeFile(join(evidence,"correction-loss.private.json"),JSON.stringify({source:s.id,key,factId:before.current.factId}));
});
test("refresh cannot silently rebase a correction draft onto another manager's new fact",async({page,request})=>{
 const s=await setup(request),rootFact=await s.post(s.factPath,{clientRequestId:randomUUID(),actionKind:"INSPECTION",componentLabel:null},"manager",201);await login(page,s.id);
 await editor(page).getByRole("button",{name:"정정 기록 추가",exact:true}).click();await editor(page).getByLabel("정비 부품·위치 명칭").fill("새로고침 전 내 합성 초안");
 const other=await s.post(`manager/maintenance-facts/${rootFact.factId}/corrections`,{clientRequestId:randomUUID(),expectedCurrentFactId:rootFact.factId,actionKind:"REPAIR",componentLabel:"다른 관리자의 합성 기록",correctionReason:"OTHER"},"manager",201);
 await editor(page).getByRole("button",{name:"정비 사실 다시 불러오기",exact:true}).click();await expect(editor(page).getByRole("button",{name:"최신 기록을 확인했습니다",exact:true})).toBeEnabled();await expect(editor(page).getByLabel("정비 부품·위치 명칭")).toHaveValue("새로고침 전 내 합성 초안");await expect(editor(page).getByRole("button",{name:"정정 기록 저장",exact:true})).toBeDisabled();expect((await s.get(s.factPath)).revisions).toHaveLength(2);
 await editor(page).getByRole("button",{name:"최신 기록을 확인했습니다",exact:true}).click();const posted=page.waitForResponse(r=>r.url().endsWith(`/${other.factId}/corrections`)&&r.request().method()==="POST");await editor(page).getByRole("button",{name:"정정 기록 저장",exact:true}).click();const response=await posted;expect(response.status()).toBe(201);expect(response.request().postDataJSON().expectedCurrentFactId).toBe(other.factId);expect((await s.get(s.factPath)).revisions).toHaveLength(3);
});
test("real timeline distinguishes loading, retryable error and empty unit without losing queue navigation",async({page,request})=>{
 await setup(request);await login(page);let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
 await routeOnce(page,"**/maintenance-timeline",async route=>{await gate;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"DEPENDENCY_UNAVAILABLE",message:"합성 장애"}})});});await page.getByRole("navigation",{name:"관리자 보기"}).getByRole("button",{name:"호실 정비 이력",exact:true}).click();await expect(timeline(page).getByText("호실 정비 이력 불러오는 중…",{exact:true})).toBeVisible();release();await expect(timeline(page).getByRole("alert")).toBeVisible();await timeline(page).getByRole("button",{name:"이력 다시 불러오기",exact:true}).click();await expect(timeline(page).getByRole("alert")).toHaveCount(0);
 const state=JSON.parse(await readFile(join(root,"state.json"),"utf8"));await timeline(page).getByLabel("정비 이력 건물·호실").selectOption(state.fixture.unitOther);await expect(timeline(page).getByText("아직 기록된 정비 사실이 없습니다.",{exact:true})).toBeVisible();await page.getByRole("navigation",{name:"관리자 보기"}).getByRole("button",{name:"업무함",exact:true}).click();await expect(page.getByRole("region",{name:"관리 업무함",exact:true})).toBeVisible();
});

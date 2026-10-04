import { test,expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { sdkSession } from "./session";

test("B1 SDK outcome uses exact Origin/CSRF and actual completed-detail UI",async({browser})=>{
 const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager"),peer=await sdkSession(browser,"tenantPeer");
 try{
  const created=await tenant.context.request.post("/api/v2/core/tickets",{headers:tenant.headers,data:{unitId:tenant.fixture.unitA,issueType:"LEAK",rawUserText:"B1 합성 완료 결과"}});expect(created.status()).toBe(201);const id=(await created.json()).ticketId,path="/api/v2/core/tickets/"+id;
  for(const status of ["IN_PROGRESS","COMPLETED"])expect((await manager.context.request.post(path+"/handling",{headers:manager.headers,data:{status,message:"B1 합성 처리 기록",...(status==="COMPLETED"?{expectedCommunicationVersion:0}:{})}})).status()).toBe(200);
  const input={clientRequestId:randomUUID()};
  for(const headers of [{...tenant.headers,"x-b1-csrf":"invalid"},{...tenant.headers,Origin:"http://foreign.invalid"},{"x-b1-csrf":tenant.csrf,"x-core-organization":tenant.fixture.orgA}])expect((await tenant.context.request.post(path+"/outcome/resolved",{headers,data:input})).status()).toBe(403);
  expect((await manager.context.request.post(path+"/outcome/resolved",{headers:manager.headers,data:input})).status()).toBe(403);
  expect((await peer.context.request.get(path+"/outcome",{headers:peer.headers})).status()).toBe(404);
  const page=await tenant.context.newPage();await page.goto("/core");await page.locator(`[data-ticket-id="${id}"] [data-open-ticket]`).click();
  await page.getByRole("button",{name:"해결됐어요",exact:true}).click();await expect(page.getByText("해결됐다고 알려주셨어요.",{exact:true})).toBeVisible();
  const read=await manager.context.request.get(path+"/outcome",{headers:manager.headers});expect(read.status()).toBe(200);expect(read.headers()["cache-control"]).toBe("private, no-store");expect(await read.json()).toMatchObject({kind:"RESOLVED",followUpTicketId:null});
 }finally{await tenant.close();await manager.close();await peer.close();}
});

test("actual turnover of an isolated synthetic unit denies prior source, target, outcome, receipt, Q&A and photos",async({browser})=>{
 const tenant=await sdkSession(browser),manager=await sdkSession(browser,"manager"),replacement=await sdkSession(browser,"tenantOther"),foreign=await sdkSession(browser,"otherManager");
 try{
  const admin=tenant.admin,unit=randomUUID(),occ=randomUUID(),member=randomUUID();
  // Only this test's new occupancy changes. Existing user relationships remain intact.
  expect((await admin.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe("CORE_FLOW_SYNTHETIC_LOCAL");
  await admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) SELECT $1,org_id,property_id,$2,'ACTIVE' FROM app.unit WHERE id=$3",[unit,"합성 후속 이력 격리 "+unit.slice(0,8),tenant.fixture.unitA]);
  await admin.query("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp(),'ACTIVE')",[occ,tenant.fixture.orgA,unit]);
  await admin.query("INSERT INTO app.occupancy_member(id,org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,$4,clock_timestamp(),'ACTIVE')",[member,tenant.fixture.orgA,occ,tenant.account.userId]);
  const made=await tenant.context.request.post("/api/v2/core/tickets",{headers:tenant.headers,data:{unitId:unit,issueType:"HEATING",rawUserText:"교체 전 세입자만 볼 합성 원본"}});expect(made.status()).toBe(201);const source=(await made.json()).ticketId,path="/api/v2/core/tickets/"+source;
  for(const status of ["IN_PROGRESS","COMPLETED"])expect((await manager.context.request.post(path+"/handling",{headers:manager.headers,data:{status,message:"합성 처리 기록",...(status==="COMPLETED"?{expectedCommunicationVersion:0}:{})}})).status()).toBe(200);
  const key=randomUUID(),follow=await tenant.context.request.post(path+"/follow-up",{headers:tenant.headers,data:{clientRequestId:key,claimKind:"UNRESOLVED",issueType:"LEAK",rawUserText:"교체 전 새 합성 증상"}});expect(follow.status()).toBe(201);const target=(await follow.json()).ticket.ticketId;
  const oldPage=await tenant.context.newPage();await oldPage.goto("/core");await oldPage.getByLabel("건물·호실",{exact:true}).selectOption(unit);await oldPage.locator(`[data-ticket-id="${source}"] [data-open-ticket]`).click();await expect(oldPage.getByRole("button",{name:"후속 접수 보기",exact:true})).toBeVisible();
  await admin.query("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE id=$1 AND org_id=$2 AND status='ACTIVE'",[member,tenant.fixture.orgA]);
  await admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp(),'ACTIVE')",[tenant.fixture.orgA,occ,replacement.account.userId]);
  for(const actor of [tenant,replacement,foreign])for(const id of [source,target])for(const suffix of ["","/outcome","/follow-up","/photos","/communication","/outcome/requests/"+key]){
   const r=await actor.context.request.get("/api/v2/core/tickets/"+id+suffix,{headers:actor.headers});expect(r.status()).toBe(404);const text=await r.text();expect(text).not.toContain(source);expect(text).not.toContain(target);
  }
  await oldPage.getByRole("navigation",{name:"접속 및 새로고침"}).getByRole("button",{name:"새로고침",exact:true}).click();await expect(oldPage.getByRole("region",{name:"세입자 처리 결과",exact:true})).toHaveCount(0);
  const page=await replacement.context.newPage();await page.goto("/core");await page.getByLabel("건물·호실",{exact:true}).selectOption(unit);await expect(page.locator(`[data-ticket-id="${source}"],[data-ticket-id="${target}"]`)).toHaveCount(0);await expect(page.getByText("선택한 호실의 접수 내역이 없습니다. 위의 문제 접수에서 첫 내용을 남겨 주세요.",{exact:true})).toBeVisible();
  await page.getByLabel("문제 설명",{exact:true}).fill("교체 후 독립 접수");const response=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().endsWith("/core/tickets"));await page.getByRole("button",{name:"접수하기",exact:true}).click();const newId=(await (await response).json()).ticketId;
  const relation=await replacement.context.request.get("/api/v2/core/tickets/"+newId+"/follow-up",{headers:replacement.headers});expect(await relation.json()).toEqual({sourceTicketId:null});
  expect((await manager.context.request.get(path+"/outcome",{headers:manager.headers})).status()).toBe(200);
 }finally{await tenant.close();await manager.close();await replacement.close();await foreign.close();}
});

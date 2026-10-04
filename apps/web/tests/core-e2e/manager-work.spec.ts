import { test,expect,type Page } from "@playwright/test";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const root=join(homedir(),".build-manager-rc1-private"),evidence=join(root,"manager-work-queue");
async function login(page:Page,code:string){await page.goto("/core");await page.getByLabel("개발 접근 코드").fill(code);await page.getByRole("button",{name:"들어가기",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();}
const fit=async(page:Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

test("manager work queue: real metadata, stale recovery, filters, private notes, photos and tenant boundary",async({page,browser,request})=>{
  await mkdir(evidence,{recursive:true});
  const codes=JSON.parse(await readFile(join(root,"access-codes.json"),"utf8")) as Record<string,string>;
  const headers=(who:string)=>({Authorization:`Bearer ${codes[who]}`});
  const units=await request.get("/api/v2/core/units",{headers:headers("tenant")});expect(units.status()).toBe(200);const unitId=(await units.json())[0].id;
  const tickets:string[]=[];
  for(let i=0;i<3;i++){const r=await request.post("/api/v2/core/tickets",{headers:headers("tenant"),data:{unitId,issueType:i===1?"HEATING":"LEAK",rawUserText:`업무함 실행용 합성 접수 ${i+1}`}});expect(r.status()).toBe(201);tickets.push((await r.json()).ticketId);}
  const duePast=new Date(Date.now()-86_400_000).toISOString(),dueFuture=new Date(Date.now()+86_400_000).toISOString();
  const mutation=async(id:string,suffix:string,data:unknown)=>{const r=await request.post(`/api/v2/core/${suffix.startsWith("manager/")?suffix:`tickets/${id}/${suffix}`}`,{headers:headers("manager"),data});expect(r.status()).toBe(200);return r.json();};
  await mutation(tickets[1],`manager/tickets/${tickets[1]}/work`,{priority:"HIGH",assigneeLabel:"합성 준비 담당",dueAt:dueFuture,expectedVersion:1});
  await mutation(tickets[1],"handling",{status:"IN_PROGRESS",message:"합성 점검 시작"});
  await mutation(tickets[2],"handling",{status:"IN_PROGRESS",message:"합성 확인 시작"});await mutation(tickets[2],"handling",{status:"COMPLETED",message:"기존 처리 흐름의 합성 완료 기록"});
  const bytes=await sharp({create:{width:240,height:160,channels:3,background:"#4b799c"}}).png().toBuffer();
  const photo=await request.post(`/api/v2/core/tickets/${tickets[0]}/photos`,{headers:{...headers("tenant"),"Content-Type":"image/png","X-Upload-Id":randomUUID()},data:bytes});expect(photo.status()).toBe(201);
  await page.setViewportSize({width:1440,height:1000});await login(page,codes.manager);
  const queue=page.getByRole("region",{name:"관리 업무함",exact:true});await expect(queue).toBeVisible();
  await queue.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))}).click();
  const detail=page.getByRole("region",{name:"업무 관리",exact:true});await expect(detail.getByRole("combobox",{name:"긴급도",exact:true})).toBeEnabled();
  await detail.getByRole("combobox",{name:"긴급도",exact:true}).selectOption("URGENT");await detail.getByLabel("담당 표시명",{exact:true}).fill("합성 내부 담당 A");
  // Browser input is explicitly local wall time; the server stores an offset timestamp.
  const localPast=await page.evaluate(value=>{const d=new Date(value),p=(n:number)=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;},duePast);
  await detail.getByLabel("처리 예정",{exact:true}).fill(localPast);await detail.getByRole("button",{name:"업무 정보 저장",exact:true}).click();await expect(detail.getByText("업무 정보를 저장했습니다.",{exact:true})).toBeVisible();
  const latest=await mutation(tickets[0],`manager/tickets/${tickets[0]}/work`,{priority:"HIGH",assigneeLabel:"동시 변경 합성 담당",dueAt:dueFuture,expectedVersion:2});expect(latest.version).toBe(3);
  await detail.getByLabel("담당 표시명",{exact:true}).fill("오래된 변경 시도");await detail.getByRole("button",{name:"업무 정보 저장",exact:true}).click();await expect(detail.getByRole("alert")).toContainText("최신 업무 정보를 불러왔습니다");await expect(detail.getByLabel("담당 표시명",{exact:true})).toHaveValue("동시 변경 합성 담당");
  await detail.getByRole("combobox",{name:"긴급도",exact:true}).selectOption("URGENT");await detail.getByLabel("담당 표시명",{exact:true}).fill("합성 내부 담당 A");await detail.getByLabel("처리 예정",{exact:true}).fill(localPast);await detail.getByRole("button",{name:"업무 정보 저장",exact:true}).click();await expect(detail.getByText("업무 정보를 저장했습니다.",{exact:true})).toBeVisible();
  const memo="합성 내부 전용 점검 순서\n세입자에게 공개하지 않는 업무 메모";
  await detail.getByLabel("내부 메모 입력",{exact:true}).fill(memo);await detail.getByRole("button",{name:"내부 메모 추가",exact:true}).click();await expect(detail.getByText(memo,{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"저장된 참고 사진",exact:true}).getByRole("img")).toHaveCount(1);
  await page.screenshot({path:join(evidence,"manager-detail-desktop.png"),fullPage:true});
  await page.reload();await page.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))}).click();await expect(detail.getByText(memo,{exact:true})).toBeVisible();await expect(detail.getByLabel("담당 표시명",{exact:true})).toHaveValue("합성 내부 담당 A");
  await page.getByRole("button",{name:"← 목록으로",exact:true}).click();
  await expect.poll(()=>queue.locator("li[data-ticket-id]").evaluateAll((rows,ids)=>rows.map(x=>x.getAttribute("data-ticket-id")).filter(id=>ids.includes(id!)),tickets)).toEqual(tickets);
  await expect(queue.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))})).toContainText("기한 지남");
  await queue.getByRole("combobox",{name:"긴급도 필터",exact:true}).selectOption("URGENT");await expect(queue.getByRole("button",{name:new RegExp(tickets[1].slice(0,8))})).toHaveCount(0);await expect(queue.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))})).toBeVisible();
  await queue.getByRole("combobox",{name:"처리 상태",exact:true}).selectOption("COMPLETED");await expect(queue.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))})).toHaveCount(0);
  await queue.getByRole("combobox",{name:"처리 상태",exact:true}).selectOption("ALL");await queue.getByRole("combobox",{name:"긴급도 필터",exact:true}).selectOption("ALL");
  await fit(page);await page.screenshot({path:join(evidence,"manager-queue-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});await fit(page);await page.screenshot({path:join(evidence,"manager-queue-390.png"),fullPage:true});
  await queue.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))}).click();await expect(detail.getByText(memo,{exact:true})).toBeVisible();await fit(page);await page.screenshot({path:join(evidence,"manager-detail-390.png"),fullPage:true});
  await page.getByLabel("처리 기록",{exact:true}).fill("합성 담당자가 확인한 처리 시작");await page.getByRole("button",{name:"처리 시작 기록",exact:true}).click();await expect(page.getByTestId("work-status")).toHaveText("처리중");
  const tenantContext=await browser.newContext({viewport:{width:390,height:844}}),tenant=await tenantContext.newPage();
  try{
    await login(tenant,codes.tenant);await tenant.getByRole("button",{name:new RegExp(tickets[0].slice(0,8))}).click();
    await expect(tenant.getByTestId("work-status")).toHaveText("처리중");await expect(tenant.getByRole("region",{name:"저장된 참고 사진",exact:true}).getByRole("img")).toHaveCount(1);
    for(const text of ["업무 관리","내부 메모","담당 표시명","긴급도","합성 내부 담당 A"])await expect(tenant.getByText(text,{exact:true})).toHaveCount(0);
    const publicRead=await request.get(`/api/v2/core/tickets/${tickets[0]}`,{headers:headers("tenant")});expect(publicRead.status()).toBe(200);const publicText=await publicRead.text();for(const text of [memo,"assigneeLabel","priority","internalNotes","noteCount"])expect(publicText).not.toContain(text);
    for(const path of ["manager/work-items",`manager/tickets/${tickets[0]}/work`,`manager/tickets/${tickets[0]}/internal-notes`])expect((await request.get(`/api/v2/core/${path}`,{headers:headers("tenant")})).status()).toBe(403);
    await fit(tenant);await tenant.screenshot({path:join(evidence,"tenant-private-fields-absent-390.png"),fullPage:true});
  }finally{await tenantContext.close();}
  await page.getByRole("button",{name:"← 목록으로",exact:true}).click();await queue.getByRole("button",{name:new RegExp(tickets[1].slice(0,8))}).click();await page.getByLabel("처리 기록",{exact:true}).fill("합성 점검 결과의 관리자 완료 기록");await page.getByRole("button",{name:"처리 완료 기록",exact:true}).click();await expect(page.getByTestId("work-status")).toHaveText("처리 완료 (관리자 기록)");await expect(detail.getByRole("button",{name:"업무 정보 저장",exact:true})).toBeDisabled();await expect(detail.getByRole("button",{name:"내부 메모 추가",exact:true})).toBeDisabled();
  await writeFile(join(evidence,"restart-target.private.json"),JSON.stringify({ticketId:tickets[0],tickets,memo,assigneeLabel:"합성 내부 담당 A",version:4}),{flag:"w"});
});

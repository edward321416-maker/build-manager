// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect,it,vi } from "vitest";
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import type { ComponentProps } from "react";
import type { CoreTicketDto,ManagerVendorHandoffDto,VendorCompletionReportDto } from "@build-manager/api-contracts";
import { VendorHandoffManagerView,ManagerDirectCompletionGate,vendorHandoffEligible,resolveDeliverableLink,reconcileManagerHandoff } from "./vendor-handoff-manager";
import type { CoreFlowClient,CoreVendorHandoffClient } from "@build-manager/api-client";
import { VendorHandoffManager } from "./vendor-handoff-manager";
import { ManagerMaintenanceFactEditor } from "./manager-maintenance-timeline";

const ticket={ticketId:"ticket",workStatus:"IN_PROGRESS",version:1,detail:{status:"OVERRIDDEN",decision:{type:"OVERRIDE",routeCode:"GENERAL_VENDOR"},repairPacket:{safetyEscalated:false,recommendation:{routeCode:"GENERAL_VENDOR"}}}} as unknown as CoreTicketDto;
const source={jobReference:"ticket",buildingName:"합성 건물",serviceAddress:"합성 정식 주소",unitLabel:"합성 호실",issueType:"LEAK" as const,sharedDetails:[{key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED" as const},{key:"heatingType",label:"난방 방식",value:"개별",sourceType:"BUILDING_VERIFIED" as const}],sourcePhotoIds:["photo-1","photo-2"],safetyNotice:[]};
const handoff:ManagerVendorHandoffDto={ticketId:"ticket",assignment:{id:"assignment",status:"PREPARING",endReason:null,vendorLabel:"합성 업체",version:1},currentPacket:null,currentRound:null,appointment:null,activeBlocker:null,currentReport:null,packetHistory:[],reportHistory:[],phase:"IN_PROGRESS",waitingOn:"NONE",packetSource:source};
const noop=()=>{};
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let task10Root:Root|undefined,task10Host:HTMLDivElement|undefined;
afterEach(async()=>{if(task10Root)await act(async()=>task10Root?.unmount());task10Root=undefined;task10Host?.remove();task10Host=undefined;});
const base:ComponentProps<typeof VendorHandoffManagerView>={ticket,handoff,loading:false,busy:false,error:"",notice:"",uncertain:false,linkUnavailable:false,immediateLink:null,preview:false,draft:{vendorLabel:"합성 업체",workSummary:"합성 누수 점검",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:""},photoPreviews:[],onDraft:noop,onPreview:noop,onCreate:noop,onPublish:noop,onIssue:noop,onReissue:noop,onRevoke:noop,onRefresh:noop,onReview:noop};
const view=(changes:Partial<typeof base>={})=>renderToStaticMarkup(<VendorHandoffManagerView {...base} {...changes}/>);
it("offers fresh handoff only for approved safe external routes and unfinished records",()=>{
  expect(vendorHandoffEligible(ticket)).toBe(true);
  for(const t of [{...ticket,workStatus:"COMPLETED"},{...ticket,detail:{...ticket.detail,status:"SAFETY_ESCALATED"}},{...ticket,detail:{...ticket.detail,repairPacket:{safetyEscalated:true}}},{...ticket,detail:{...ticket.detail,decision:{type:"OVERRIDE",routeCode:"MANAGEMENT_OFFICE"}}},{...ticket,detail:{...ticket.detail,decision:null}}] as CoreTicketDto[]){expect(vendorHandoffEligible(t)).toBe(false);expect(view({ticket:t,handoff:{...handoff,assignment:null}}).includes("작업 요청 준비")).toBe(false);}
  expect(view({handoff:{...handoff,assignment:null}})).toContain("작업 요청 준비");
});
it("previews real canonical fields and selected detail provenance before publishing PREPARING",()=>{
  const html=view({preview:true,draft:{...base.draft,sharedDetailKeys:["leak.active"],allowedPhotoIds:["photo-1"]},photoPreviews:[{photoId:"photo-1",url:"blob:synthetic-preview"}]});
  for(const text of ["합성 정식 주소","합성 호실","합성 건물","합성 업체","합성 누수 점검","현재 누수","세입자 설명","업체 전달 내용 게시","선택한 원본 사진"])expect(html).toContain(text);
  expect(html.includes('alt="선택한 원본 사진 1"')).toBe(true);
  expect(html.includes("접수 비공개 원문")).toBe(false);
});
it("starts with every source photo unchecked and makes selection explicit",()=>{
  const html=view();expect(html).toContain("공유할 원본 사진 선택");expect(html.includes("checked=")).toBe(false);expect(html).toContain("사진은 선택한 것만 업체에 공개됩니다");
});
it("keeps access policy separate from exact-window Tenant entry consent",()=>{
  const html=view({draft:{...base.draft,accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED"},preview:true});expect(html).toContain("출입 정책은 세입자 동의가 아닙니다");expect(html).toContain("세입자가 별도로 선택한 시간에 동의해야 합니다");expect(html.includes("동의 완료")).toBe(false);
});
it("blocks publication without canonical address or available preview candidates",()=>{
  for(const h of [{...handoff,packetSource:{...source,serviceAddress:null}},{...handoff,packetSource:undefined}]){const html=view({handoff:h,preview:true});expect(html).toContain("disabled");expect(html.includes("주소 확인 필요")||html.includes("전달 후보를 다시 불러오세요")).toBe(true);}
});
it("offers explicit Reissue after response-loss reconciliation without a retry or invented link",()=>{
  const offered={...handoff,assignment:{...handoff.assignment!,status:"OFFERED" as const},currentPacket:{id:"packet"} as NonNullable<ManagerVendorHandoffDto["currentPacket"]>};
  const html=view({handoff:offered,uncertain:true,linkUnavailable:true});expect(html).toContain("원래 링크는 다시 표시할 수 없습니다");expect(html).toContain("보안 링크 재발급");expect(html.includes("자동 재시도")).toBe(false);expect(html.includes("보안 링크 발급</button>")).toBe(false);
});
it("never offers Reissue before authoritative OFFERED/ACTIVE or for ENDED",()=>{
  for(const status of ["PREPARING","ENDED"] as const){const html=view({handoff:{...handoff,assignment:{...handoff.assignment!,status,endReason:status==="ENDED"?"REVOKED":null}},uncertain:true,linkUnavailable:true});expect(html.includes("보안 링크 재발급")).toBe(false);}
});
it("gates direct completion on non-ended assignments and allows historical ENDED",()=>{
  const render=(h:ManagerVendorHandoffDto|null,loading=false)=>renderToStaticMarkup(<ManagerDirectCompletionGate handoff={h} loading={loading}><button>처리 완료 기록</button></ManagerDirectCompletionGate>);
  for(const status of ["PREPARING","OFFERED","ACTIVE"] as const)expect(render({...handoff,assignment:{...handoff.assignment!,status}}).includes("처리 완료 기록")).toBe(false);
  expect(render({...handoff,assignment:{...handoff.assignment!,status:"ENDED",endReason:"REVOKED"}})).toContain("처리 완료 기록");expect(render({...handoff,assignment:null})).toContain("처리 완료 기록");expect(render(null,true).includes("처리 완료 기록")).toBe(false);
});
it("shows manual link sharing without any external notification delivery claim",()=>{
  const html=view({immediateLink:"http://127.0.0.1:3130/vendor/job#synthetic-value"});expect(html.includes("직접 전달하세요")).toBe(true);
  for(const claim of ["SMS 발송","카카오 발송","이메일 발송","푸시 발송","자동 전송 완료"])expect(html.includes(claim)).toBe(false);
});
it("resolves only a fresh safe relative link on the current application origin",()=>{
  const meta={assignmentId:"assignment",assignmentVersion:1,expiresAt:"2026-10-09T00:00:00Z"};
  const result=resolveDeliverableLink({...meta,created:true,link:"/vendor/job#synthetic-value"},"http://127.0.0.1:3130");expect(result==="http://127.0.0.1:3130/vendor/job#synthetic-value").toBe(true);
  expect(resolveDeliverableLink({...meta,created:false},"http://127.0.0.1:3130")).toBeNull();
  for(const unsafe of ["https://untrusted.invalid/vendor/job#value","//untrusted.invalid/vendor/job#value","/vendor/job?raw=value#value"]){expect(resolveDeliverableLink({...meta,created:true,link:unsafe},"http://127.0.0.1:3130")).toBeNull();}
});
it("discards a fresh issue response when authoritative readback now ends or replaces its assignment",()=>{
  const issued={assignmentId:"assignment",assignmentVersion:1,expiresAt:"2026-10-09T00:00:00Z",created:true as const,link:"/vendor/job#synthetic-value"};
  for(const assignment of [{...handoff.assignment!,status:"ENDED" as const,endReason:"REVOKED" as const},{...handoff.assignment!,id:"replacement",status:"OFFERED" as const}]){
    const link=resolveDeliverableLink(issued,"http://127.0.0.1:3130",{...handoff,assignment,currentPacket:{id:"packet"} as NonNullable<ManagerVendorHandoffDto["currentPacket"]>});expect(link===null).toBe(true);
  }
});
it("refreshes authoritative state after an unknown mutation without retrying or claiming success",async()=>{
  const calls:string[]=[];
  const client={readHandoff:async()=>{calls.push("read");return handoff;}} as unknown as CoreVendorHandoffClient;
  const result=await reconcileManagerHandoff(client,"ticket",async()=>{calls.push("issue");throw new Error("synthetic transport loss");});
  expect(calls).toEqual(["issue","read"]);expect(result.kind).toBe("uncertain");expect(result.handoff?.assignment?.status).toBe("PREPARING");
});
it("keeps unknown outcomes unresolved if authoritative refresh also fails",async()=>{
  const client={readHandoff:async()=>{throw new Error("offline");}} as unknown as CoreVendorHandoffClient;
  const result=await reconcileManagerHandoff(client,"ticket",async()=>{throw new Error("response loss");});expect(result.kind).toBe("uncertain");expect(result.handoff).toBeNull();
});
it("drops a late mutation result after navigation before it can restore the previous ticket link",async()=>{
  let current=true,resolve:((value:{created:true;link:string})=>void)|undefined,reads=0;
  const operation=new Promise<{created:true;link:string}>(done=>{resolve=done;});
  const client={readHandoff:async()=>{reads++;return handoff;}} as unknown as CoreVendorHandoffClient;
  const pending=reconcileManagerHandoff(client,"ticket",()=>operation,()=>current);
  current=false;resolve!({created:true,link:"/vendor/job#synthetic-value"});
  const result=await pending;expect(result.kind).toBe("obsolete");expect(result.value===undefined).toBe(true);expect(result.handoff).toBeNull();expect(reads).toBe(0);
});
it("drops late authoritative readback after a ticket switch",async()=>{
  let current=true,resolve:((value:ManagerVendorHandoffDto)=>void)|undefined;
  const readback=new Promise<ManagerVendorHandoffDto>(done=>{resolve=done;});
  const client={readHandoff:()=>readback} as unknown as CoreVendorHandoffClient;
  const pending=reconcileManagerHandoff(client,"ticket",async()=>({created:false}),()=>current);
  await Promise.resolve();current=false;resolve!(handoff);
  const result=await pending;expect(result.kind).toBe("obsolete");expect(result.value===undefined).toBe(true);expect(result.handoff).toBeNull();
});

const report:VendorCompletionReportDto={id:"report",assignmentId:"assignment",appointmentId:"appointment",packetRevisionId:"packet",revision:1,supersedesReportId:null,workSummary:"합성 배관 교체",
  componentOrPartNote:"합성 밸브",completionPhotoIds:["photo-1"],photoOmissionReason:null,submittedAt:"2026-10-07T05:00:00Z"};
const reported=(changes:Partial<VendorCompletionReportDto>={}):ManagerVendorHandoffDto=>({...handoff,assignment:{...handoff.assignment!,status:"ACTIVE",version:6},
  phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",currentReport:{...report,...changes},reportHistory:[{...report,...changes}]});
it("shows the Vendor completion report with only its selected photos while awaiting the Manager (Task8)",()=>{
  const html=view({handoff:reported(),reportPhotos:[{photoId:"photo-1",url:"blob:synthetic-report"}],now:new Date("2026-10-07T06:00:00Z")});
  for(const text of ["업체 작업 보고 · 1차","10월 7일(수) 오후 2:00 제출","관리자 확인 대기","합성 배관 교체","사용한 부품·자재: 합성 밸브"])expect(html).toContain(text);
  expect(html).toContain('alt="업체 보고 사진 1"');
  for(const phrase of ["업체 완료","수리 완료","완료 보고"])expect(html.includes(phrase),phrase).toBe(false);
  // D9 §19.19: no competing Manager mutation while the report awaits its disposition.
  expect(html.includes("업체 접근 철회")).toBe(false);
});
it("shows an approved omission reason instead of photos (Task8)",()=>{
  const html=view({handoff:reported({completionPhotoIds:[],photoOmissionReason:"SAFETY_OR_PRIVACY"}),now:new Date("2026-10-07T06:00:00Z")});
  expect(html).toContain("보고 사진 없음 · 안전·사생활 보호");
  expect(html.includes("업체 보고 사진 1")).toBe(false);
});

it("Task9 presents three distinct Manager dispositions without Vendor-summary completion prefill",()=>{
  const html=view({handoff:reported()});
  for(const label of ["처리 완료 기록","보고 수정 요청","추가 작업 요청"])expect(html).toContain(label);
  expect(html.includes('value="합성 배관 교체"')).toBe(false);
});
it("Task9 unresolved correction shows Vendor turn and removes closeout/more-work actions",()=>{
  const html=view({handoff:{...reported(),waitingOn:"VENDOR",correctionRequest:{id:"correction",completionReportId:"report",reason:"사진 설명 수정"}} as ManagerVendorHandoffDto});
  expect(html).toContain("사진 설명 수정");expect(html.includes(">추가 작업 요청</button>")).toBe(false);expect(html.includes(">처리 완료 기록</button>")).toBe(false);
});

it("Task9 MORE_WORK restores normal packet preparation after its report disposition",()=>{
  const h={...reported(),phase:"SCHEDULING",waitingOn:"TENANT",packetSource:source} as ManagerVendorHandoffDto;
  expect(view({handoff:h})).toContain("<h3>업체 전달 내용</h3>");
});

it("T10-U03 mounted closed Manager handoff leaves Fact creation explicit and never prefills Vendor report/photo/text",async()=>{
  const completed={...ticket,workStatus:"COMPLETED"} as CoreTicketDto;
  const closed:ManagerVendorHandoffDto={...reported({workSummary:"T10_VENDOR_REPORT_PRIVATE",componentOrPartNote:"T10_VENDOR_PART_PRIVATE",completionPhotoIds:["T10_PRIVATE_PHOTO"]}),
    assignment:{...handoff.assignment!,status:"ENDED",endReason:"CLOSED",version:8},phase:"ENDED",waitingOn:"NONE",ticketWorkStatus:"COMPLETED"};
  const create=vi.fn<(id:string,input:unknown)=>Promise<unknown>>(async()=>({})),correct=vi.fn(),onChanged=vi.fn();
  const client={vendorHandoff:{readHandoff:vi.fn(async()=>closed)},photos:vi.fn(async()=>[]),maintenance:{readForTicket:vi.fn(async()=>({current:null,revisions:[]})),create,correct}} as unknown as CoreFlowClient;
  task10Host=document.createElement("div");document.body.append(task10Host);task10Root=createRoot(task10Host);
  await act(async()=>{task10Root!.render(<><VendorHandoffManager client={client} ticket={completed} revision={0} onHandoff={noop} onChanged={onChanged}/><ManagerMaintenanceFactEditor client={client} ticket={completed} revision={0} onOpenTicket={noop} onChanged={onChanged}/></>);for(let i=0;i<12;i++)await Promise.resolve();});
  expect(create).not.toHaveBeenCalled();expect(correct).not.toHaveBeenCalled();
  const field=task10Host.querySelector<HTMLInputElement>('[aria-label="정비 부품·위치 명칭"]')!,select=task10Host.querySelector<HTMLSelectElement>('[aria-label="정비 작업 종류"]')!;
  expect(field.value).toBe("");expect(select.value).toBe("INSPECTION");
  const form=field.closest("form")!;expect(form.innerHTML).not.toMatch(/T10_VENDOR_REPORT_PRIVATE|T10_VENDOR_PART_PRIVATE|T10_PRIVATE_PHOTO/);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(field,"T10_EXPLICIT_MANAGER_FACT");field.dispatchEvent(new Event("input",{bubbles:true}));});
  await act(async()=>{form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
  expect(create).toHaveBeenCalledTimes(1);expect(create.mock.calls[0]).toEqual([completed.ticketId,{clientRequestId:expect.any(String),actionKind:"INSPECTION",componentLabel:"T10_EXPLICIT_MANAGER_FACT"}]);
  expect(JSON.stringify(create.mock.calls)).not.toMatch(/T10_VENDOR_REPORT_PRIVATE|T10_VENDOR_PART_PRIVATE|T10_PRIVATE_PHOTO/);
  expect(onChanged).toHaveBeenCalledTimes(1);expect(correct).not.toHaveBeenCalled();
});

it("WC-M01 describes the access instruction disclosure warning at the mounted field",async()=>{
  task10Host=document.createElement("div");document.body.append(task10Host);task10Root=createRoot(task10Host);
  await act(async()=>task10Root!.render(<VendorHandoffManagerView {...base}/>));
  const field=task10Host.querySelector('textarea[aria-label="출입 안내"]')!;
  const description=task10Host.querySelector(`[id="${field.getAttribute("aria-describedby")}"]`);
  expect(description?.textContent).toContain("개인 연락처");
  expect(description?.textContent).toContain("반복 사용 가능한 출입 비밀번호");
});

it("WC-M03 exposes prior packet and report bodies as read-only history after current actions",()=>{
  const current={...handoff,assignment:{...handoff.assignment!,status:"ACTIVE" as const},phase:"COMPLETION_REPORTED" as const,currentReport:{id:"current",assignmentId:"assignment",appointmentId:"visit",packetRevisionId:"packet",supersedesReportId:"old",componentOrPartNote:null,revision:2,workSummary:"현재 보고",submittedAt:"2026-10-06T03:00:00Z",completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE"} as VendorCompletionReportDto};
  const old={...current.currentReport,id:"old",revision:1,workSummary:"이전 보고 내용",componentOrPartNote:"이전 부품",completionPhotoIds:["historical-photo"],photoOmissionReason:null};
  const historicalPacket={jobReference:"ticket",buildingName:"합성 건물",serviceAddress:"합성 주소",unitLabel:"합성 호실",issueType:"LEAK" as const,id:"old-packet",assignmentId:"prior-assignment",revision:1,publishedAt:"2026-10-06T01:00:00Z",vendorLabel:"이전 합성 업체",workSummary:"이전 전달 내용",sharedDetails:[],allowedPhotoIds:[],safetyNotice:[],accessPolicy:"TENANT_PRESENT_REQUIRED" as const,accessInstruction:"이전 안내"};
  const html=view({handoff:{...current,packetHistory:[historicalPacket],reportHistory:[old,current.currentReport]} as ManagerVendorHandoffDto,historyReportId:"old",reportPhotos:[{photoId:"historical-photo",url:"blob:historical-evidence"}]});
  for(const text of ["이전 전달 내용","이전 보고 내용","이전 부품","이전 안내","읽기 전용"])expect(html).toContain(text);
  expect(html.indexOf("업체 보고 검토")).toBeLessThan(html.indexOf("읽기 전용"));
  expect(html).toContain("blob:historical-evidence");
});

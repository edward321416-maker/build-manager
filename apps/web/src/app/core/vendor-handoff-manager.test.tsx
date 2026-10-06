import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import type { ComponentProps } from "react";
import type { CoreTicketDto,ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { VendorHandoffManagerView,ManagerDirectCompletionGate,vendorHandoffEligible,resolveDeliverableLink,reconcileManagerHandoff } from "./vendor-handoff-manager";
import type { CoreVendorHandoffClient } from "@build-manager/api-client";

const ticket={ticketId:"ticket",workStatus:"IN_PROGRESS",version:1,detail:{status:"OVERRIDDEN",decision:{type:"OVERRIDE",routeCode:"GENERAL_VENDOR"},repairPacket:{safetyEscalated:false,recommendation:{routeCode:"GENERAL_VENDOR"}}}} as unknown as CoreTicketDto;
const source={jobReference:"ticket",buildingName:"합성 건물",serviceAddress:"합성 정식 주소",unitLabel:"합성 호실",issueType:"LEAK" as const,sharedDetails:[{key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED" as const},{key:"heatingType",label:"난방 방식",value:"개별",sourceType:"BUILDING_VERIFIED" as const}],sourcePhotoIds:["photo-1","photo-2"],safetyNotice:[]};
const handoff:ManagerVendorHandoffDto={ticketId:"ticket",assignment:{id:"assignment",status:"PREPARING",endReason:null,vendorLabel:"합성 업체",version:1},currentPacket:null,currentRound:null,appointment:null,activeBlocker:null,currentReport:null,reportHistory:[],phase:"IN_PROGRESS",waitingOn:"NONE",packetSource:source};
const noop=()=>{};
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

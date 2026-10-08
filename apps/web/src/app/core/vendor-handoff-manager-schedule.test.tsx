// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreTicketDto,ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { VendorHandoffManager } from "./vendor-handoff-manager";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const ticket={ticketId:"ticket",workStatus:"IN_PROGRESS",version:1,detail:{status:"OVERRIDDEN",decision:{type:"OVERRIDE",routeCode:"GENERAL_VENDOR"},repairPacket:{safetyEscalated:false}}} as unknown as CoreTicketDto;
const now=()=>new Date("2026-10-06T03:00:00Z");
const round={id:"round",openedPacketRevisionId:"packet",purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00Z"};
const appointment={id:"appointment",schedulingRoundId:"round",packetRevisionId:"packet",proposalId:"proposal",availabilitySubmissionId:null,selectedWindowId:null,
  startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00Z"};
function scheduled(changes:Record<string,unknown>={}):ManagerVendorHandoffDto{
  return {ticketId:"ticket",assignment:{id:"assignment",status:"ACTIVE",endReason:null,vendorLabel:"합성 업체",version:4},currentPacket:{id:"packet",revision:1,workSummary:"합성 작업",accessPolicy:"TENANT_PRESENT_REQUIRED",allowedPhotoIds:[],sharedDetails:[]},
    currentRound:round,appointment,activeBlocker:null,currentReport:null,reportHistory:[],phase:"SCHEDULED",waitingOn:"VENDOR",...changes} as unknown as ManagerVendorHandoffDto;
}
let root:Root|undefined,host:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();});
async function mount(initial:ManagerVendorHandoffDto,reschedule:()=>Promise<unknown>=async()=>initial){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const readHandoff=vi.fn(async()=>initial),rescheduleFn=vi.fn<(id:string,input:Record<string,unknown>)=>Promise<unknown>>(reschedule);
  const client={vendorHandoff:{readHandoff,reschedule:rescheduleFn},photos:async()=>[]} as unknown as CoreFlowClient;
  await act(async()=>{root!.render(<VendorHandoffManager client={client} ticket={ticket} revision={0} now={now} onHandoff={()=>{}} onChanged={()=>{}}/>);});
  await act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
  return {readHandoff,reschedule:rescheduleFn};
}
const page=()=>host.textContent??"";
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
async function click(label:string){expect(Boolean(button(label)),label).toBe(true);await act(async()=>{button(label)!.click();});await act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});}

it("shows the SCHEDULED Appointment in Seoul time and reschedules only after an explicit confirmation",async()=>{
  const s=await mount(scheduled());
  expect(page()).toContain("10월 7일(수) 오후 2:00–3:00");
  await click("방문 일정 변경");
  expect(s.reschedule).not.toHaveBeenCalled();
  expect(page()).toContain("기존 방문 일정은 취소되고");
  await click("일정 변경하기");
  const [id,input]=s.reschedule.mock.calls[0];
  expect(id).toBe("assignment");
  expect(input).toMatchObject({expectedAssignmentVersion:4,expectedRoundVersion:3,expectedAppointmentId:"appointment",expectedPacketRevisionId:"packet"});
  expect(s.readHandoff).toHaveBeenCalledTimes(2);
});
it("never offers a reschedule for an Appointment that already started",async()=>{
  await mount(scheduled({appointment:{...appointment,startAt:"2026-10-06T02:00:00Z",endAt:"2026-10-06T04:00:00Z"}}));
  expect(button("방문 일정 변경")).toBeUndefined();
});
it("keeps an unknown reschedule outcome uncertain instead of claiming success",async()=>{
  const s=await mount(scheduled(),async()=>{throw new ApiClientError("NETWORK_ERROR","synthetic loss");});
  await click("방문 일정 변경");
  await click("일정 변경하기");
  expect(s.reschedule).toHaveBeenCalledTimes(1);
  expect(page()).toContain("저장 결과를 확정하지 못했습니다");
  expect(page().includes("방문 일정 변경을 기록했습니다")).toBe(false);
});
it("labels the dismiss action without implying cancellation and resets an open confirmation on refresh (review L2, L3)",async()=>{
  const s=await mount(scheduled());
  await click("방문 일정 변경");
  expect(button("돌아가기")).toBeDefined();
  expect(button("취소")).toBeUndefined();
  s.readHandoff.mockResolvedValue(scheduled({appointment:{...appointment,id:"appointment-2",startAt:"2026-10-08T05:00:00Z",endAt:"2026-10-08T06:00:00Z"}}));
  await click("업체 연결 상태 다시 확인");
  expect(page()).toContain("10월 8일(목) 오후 2:00–3:00");
  expect(button("일정 변경하기")).toBeUndefined();
  expect(button("방문 일정 변경")).toBeDefined();
});
it("shows the Vendor's current blocker and waiting state without changing the phase (Task7)",async()=>{
  await mount(scheduled({phase:"IN_PROGRESS",waitingOn:"PARTS",appointment:{...appointment,status:"OCCURRED"},
    activeBlocker:{id:"blocker",code:"PARTS_REQUIRED",note:"합성 메모",active:true,createdAt:"2026-10-06T02:30:00Z",clearedAt:null}}));
  expect(page()).toContain("업체 작업 막힘 · 부품 필요 · 부품 대기");
  expect(page()).toContain("합성 메모");
  expect(button("방문 일정 변경")).toBeUndefined();
});
it("loads only the report's selected photos through the Manager completion-photo route (Task8)",async()=>{
  const original={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  URL.createObjectURL=vi.fn(()=>"blob:synthetic-report");URL.revokeObjectURL=vi.fn();
  try{
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const report={id:"report",assignmentId:"assignment",appointmentId:"appointment",packetRevisionId:"packet",revision:1,supersedesReportId:null,workSummary:"합성 배관 교체",
    componentOrPartNote:null,completionPhotoIds:["photo-1"],photoOmissionReason:null,submittedAt:"2026-10-07T05:00:00Z"};
  const handoff=scheduled({phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",appointment:{...appointment,status:"OCCURRED"},currentReport:report,reportHistory:[report]});
  const vendorCompletionPhoto=vi.fn(async()=>new Blob(["abc"],{type:"image/png"}));
  const client={vendorHandoff:{readHandoff:vi.fn(async()=>handoff)},photos:async()=>[],vendorCompletionPhoto} as unknown as CoreFlowClient;
  await act(async()=>{root!.render(<VendorHandoffManager client={client} ticket={ticket} revision={0} now={now} onHandoff={()=>{}} onChanged={()=>{}}/>);});
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
  expect(vendorCompletionPhoto.mock.calls).toEqual([["ticket","photo-1"]]);
  expect(host.querySelector('img[alt="업체 보고 사진 1"]')?.getAttribute("src")).toBe("blob:synthetic-report");
  }finally{URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});

it("Task9 closeout keeps authored text empty, sends current report/communication guards and shows only authoritative paired completion",async()=>{
  const reportId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const reported=scheduled({phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",appointment:{...appointment,status:"OCCURRED"},currentReport:{id:reportId,revision:1,workSummary:"업체의 합성 설명",submittedAt:"2026-10-06T02:00:00Z",completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE"}});
  const closed={...reported,ticketWorkStatus:"COMPLETED",phase:"ENDED",waitingOn:"NONE",assignment:{...reported.assignment!,status:"ENDED",endReason:"CLOSED"}} as ManagerVendorHandoffDto;
  let release:(value:ManagerVendorHandoffDto)=>void=()=>{};const waiting=new Promise<ManagerVendorHandoffDto>(resolve=>{release=resolve;});
  const readHandoff=vi.fn(async()=>reported),closeout=vi.fn<(id:string,input:unknown)=>Promise<ManagerVendorHandoffDto>>(async()=>waiting);
  const client={vendorHandoff:{readHandoff,closeout},photos:async()=>[]} as unknown as CoreFlowClient;
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<VendorHandoffManager client={client} ticket={ticket} communicationVersion={9} revision={0} onHandoff={()=>{}} onChanged={()=>{}} now={now}/>));
  await click("처리 완료 기록");const textarea=host.querySelector<HTMLTextAreaElement>('form[aria-label="업체 요청 검토"] textarea')!;
  expect(textarea.value).toBe("");expect(button("확인한 내용 저장")?.disabled).toBe(true);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(textarea,"관리자가 확인한 합성 결과");textarea.dispatchEvent(new Event("input",{bubbles:true}));});
  await click("확인한 내용 저장");
  expect(closeout.mock.calls[0][1]).toMatchObject({expectedAssignmentVersion:4,expectedCompletionReportId:reportId,expectedCommunicationVersion:9,message:"관리자가 확인한 합성 결과"});
  expect(page().includes("COMPLETED / ENDED/CLOSED")).toBe(false);
  readHandoff.mockResolvedValue(closed);await act(async()=>release(closed));
  expect(page()).toContain("COMPLETED / ENDED/CLOSED");
});

it("Task9 unknown closeout cannot claim completion if authoritative readback is still ACTIVE",async()=>{
  const reported=scheduled({phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",currentReport:{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",revision:1,workSummary:"합성 업체 설명",submittedAt:"2026-10-06T02:00:00Z",completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE"}});
  const client={vendorHandoff:{readHandoff:async()=>reported,closeout:async()=>{throw new Error("synthetic response loss");}},photos:async()=>[]} as unknown as CoreFlowClient;
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<VendorHandoffManager client={client} ticket={ticket} communicationVersion={0} revision={0} onHandoff={()=>{}} onChanged={()=>{}} now={now}/>));
  await click("처리 완료 기록");const area=host.querySelector<HTMLTextAreaElement>('form[aria-label="업체 요청 검토"] textarea')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(area,"합성 관리자 설명");area.dispatchEvent(new Event("input",{bubbles:true}));});
  await click("확인한 내용 저장");expect(page()).toContain("저장 결과를 확정하지 못했습니다");expect(page().includes("COMPLETED / ENDED/CLOSED")).toBe(false);
});

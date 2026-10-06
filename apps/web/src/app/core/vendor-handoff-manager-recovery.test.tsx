// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreTicketDto,ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { VendorHandoffManager } from "./vendor-handoff-manager";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const ticket={ticketId:"ticket",workStatus:"IN_PROGRESS",version:1,detail:{status:"OVERRIDDEN",decision:{type:"OVERRIDE",routeCode:"GENERAL_VENDOR"},repairPacket:{safetyEscalated:false}}} as unknown as CoreTicketDto;
const preparing={ticketId:"ticket",assignment:{id:"assignment",status:"PREPARING",endReason:null,vendorLabel:"합성 업체",version:1},currentPacket:{id:"packet"},currentRound:null,appointment:null,activeBlocker:null,currentReport:null,reportHistory:[],phase:"IN_PROGRESS",waitingOn:"NONE",packetSource:{jobReference:"ticket",buildingName:"합성 건물",serviceAddress:"합성 주소",unitLabel:"합성 호실",issueType:"LEAK",sharedDetails:[],sourcePhotoIds:[],safetyNotice:[]}} as unknown as ManagerVendorHandoffDto;
let root:Root|undefined,host:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();});
async function mount(issue:()=>Promise<unknown>,initial:ManagerVendorHandoffDto=preparing){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const readHandoff=vi.fn(async()=>initial),issueLink=vi.fn(issue),createAssignment=vi.fn(async()=>preparing),publishPacket=vi.fn(async()=>preparing);
  const client={vendorHandoff:{readHandoff,issueLink,createAssignment,publishPacket},photos:async()=>[]} as unknown as CoreFlowClient;
  const props={client,ticket,revision:0,onHandoff:()=>{},onChanged:()=>{}};
  await act(async()=>{root!.render(<VendorHandoffManager {...props}/>);});
  return {readHandoff,issueLink,createAssignment,publishPacket,rerender:async(next:CoreTicketDto,revision=0)=>act(async()=>root!.render(<VendorHandoffManager {...props} ticket={next} revision={revision}/>))};
}
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
async function click(label:string){expect(Boolean(button(label))).toBe(true);await act(async()=>button(label)!.click());}
function editable(){return !host.querySelector<HTMLFieldSetElement>("fieldset")!.disabled;}
async function input(label:string,value:string){
  const field=host.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
  await act(async()=>{Object.getOwnPropertyDescriptor(field.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value")!.set!.call(field,value);field.dispatchEvent(new Event("input",{bubbles:true}));});
}
it("definite 409 first-issue rejection restores editable PREPARING review",async()=>{
  const s=await mount(async()=>{throw new ApiClientError("STATE_CONFLICT","synthetic rejection",{status:409});});
  await click("보안 링크 발급");
  expect(s.issueLink).toHaveBeenCalledTimes(1);expect(s.readHandoff).toHaveBeenCalledTimes(2);
  expect(editable()).toBe(true);expect(Boolean(button("보안 링크 발급"))).toBe(true);
  expect(host.textContent!.includes("원래 링크는 다시 표시할 수 없습니다")).toBe(false);
});
it("lost precommit issue stays uncertain after PREPARING and offers explicit same-identity recovery",async()=>{
  let calls=0;const s=await mount(async()=>{if(++calls===1)throw new Error("synthetic precommit loss");return {created:false,assignmentId:"assignment",assignmentVersion:2,expiresAt:"2026-10-09T00:00:00Z"};});
  await click("보안 링크 발급");expect(s.issueLink).toHaveBeenCalledTimes(1);
  expect(Boolean(button("같은 요청으로 발급 결과 확인"))).toBe(true);
  await click("업체 연결 상태 다시 확인");expect(s.issueLink).toHaveBeenCalledTimes(1);
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"OFFERED",version:2}});
  await click("같은 요청으로 발급 결과 확인");expect(s.issueLink).toHaveBeenCalledTimes(2);
  const first=s.issueLink.mock.calls[0] as unknown[],second=s.issueLink.mock.calls[1] as unknown[];
  expect(first[0]===second[0]&&JSON.stringify(first[1])===JSON.stringify(second[1])).toBe(true);
  expect(host.querySelector('[aria-label="직접 전달할 보안 링크"]')===null).toBe(true);
  expect(Boolean(button("보안 링크 재발급"))).toBe(true);expect(editable()).toBe(true);
});
it("explicit recovery can complete the original uncommitted request and keep its link through its own ticket refresh",async()=>{
  let calls=0;const s=await mount(async()=>{if(++calls===1)throw new Error("synthetic precommit loss");return {created:true,assignmentId:"assignment",assignmentVersion:2,link:"/vendor/job#synthetic-value",expiresAt:"2026-10-09T00:00:00Z"};});
  await click("보안 링크 발급");
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"OFFERED",version:2}});
  await click("같은 요청으로 발급 결과 확인");
  const hasLink=()=>Boolean(host.querySelector<HTMLInputElement>('[aria-label="직접 전달할 보안 링크"]')?.value.endsWith("/vendor/job#synthetic-value"));
  expect(hasLink()).toBe(true);await s.rerender({...ticket,version:2});expect(hasLink()).toBe(true);
  expect(s.readHandoff).toHaveBeenCalledTimes(3);
});
it("authoritative ended assignment clears an obsolete unknown request and permits a fresh preparation",async()=>{
  const s=await mount(async()=>{throw new Error("synthetic loss");});await click("보안 링크 발급");
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"ENDED",endReason:"REVOKED"},currentPacket:null});
  await click("업체 연결 상태 다시 확인");await input("업체 표시 이름","새 업체");
  expect(button("작업 요청 준비")?.disabled).toBe(false);
  expect(Boolean(button("같은 요청으로 발급 결과 확인"))).toBe(false);expect(s.issueLink).toHaveBeenCalledTimes(1);
});
it("an unknown issue with immediately ended readback cannot leave the fresh preparation frozen",async()=>{
  const s=await mount(async()=>{throw new Error("synthetic loss");});
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"ENDED",endReason:"REVOKED"},currentPacket:null});
  await click("보안 링크 발급");await input("업체 표시 이름","새 업체");
  expect(button("작업 요청 준비")?.disabled).toBe(false);expect(s.issueLink).toHaveBeenCalledTimes(1);
});
it("a name validation error can be corrected without any server refresh",async()=>{
  const s=await mount(async()=>({}),{...preparing,assignment:null,currentPacket:null});
  await input("업체 표시 이름","   ");
  await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  expect(host.textContent!.includes("업체 표시 이름을 확인하세요")).toBe(true);
  expect(host.querySelector<HTMLInputElement>('[aria-label="업체 표시 이름"]')!.disabled).toBe(false);
  await input("업체 표시 이름","수정 업체");await click("작업 요청 준비");
  expect(s.createAssignment).toHaveBeenCalledTimes(1);expect(s.readHandoff).toHaveBeenCalledTimes(2);
});
it("metadata-only replay followed by ENDED and new preparation/publication permits that assignment's first issue",async()=>{
  const s=await mount(async()=>({created:false,assignmentId:"assignment",assignmentVersion:2,expiresAt:"2026-10-09T00:00:00Z"}));
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"OFFERED",version:2}});
  await click("보안 링크 발급");expect(host.textContent!.includes("원래 링크는 다시 표시할 수 없습니다")).toBe(true);
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"ENDED",endReason:"REVOKED"},currentPacket:null});
  await click("업체 연결 상태 다시 확인");await input("업체 표시 이름","새 업체");
  const replacement={...preparing,assignment:{...preparing.assignment!,id:"replacement",vendorLabel:"새 업체"},currentPacket:null};
  s.createAssignment.mockResolvedValue(replacement);s.readHandoff.mockResolvedValue(replacement);
  await click("작업 요청 준비");await input("업체 작업 설명","새 작업 설명");await click("업체 전달 내용 미리보기");
  const published={...replacement,currentPacket:{...preparing.currentPacket!,id:"replacement-packet"}};
  s.publishPacket.mockResolvedValue(published);s.readHandoff.mockResolvedValue(published);await click("업체 전달 내용 게시");
  expect(s.createAssignment).toHaveBeenCalledTimes(1);expect(s.publishPacket).toHaveBeenCalledTimes(1);
  expect(Boolean(button("보안 링크 발급"))).toBe(true);expect(button("보안 링크 발급")?.disabled).toBe(false);
  expect(host.textContent!.includes("원래 링크는 다시 표시할 수 없습니다")).toBe(false);expect(s.issueLink).toHaveBeenCalledTimes(1);
});
it("metadata-only replay loss state does not follow an authoritative replacement PREPARING assignment",async()=>{
  const s=await mount(async()=>({created:false,assignmentId:"assignment",assignmentVersion:2,expiresAt:"2026-10-09T00:00:00Z"}));
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"OFFERED",version:2}});await click("보안 링크 발급");
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,id:"replacement"}});await click("업체 연결 상태 다시 확인");
  expect(Boolean(button("보안 링크 발급"))).toBe(true);expect(button("보안 링크 발급")?.disabled).toBe(false);
  expect(host.textContent!.includes("원래 링크는 다시 표시할 수 없습니다")).toBe(false);expect(s.issueLink).toHaveBeenCalledTimes(1);
});
it("metadata-only replay already ended at immediate readback cannot relatch loss onto a future replacement",async()=>{
  const s=await mount(async()=>({created:false,assignmentId:"assignment",assignmentVersion:2,expiresAt:"2026-10-09T00:00:00Z"}));
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,status:"ENDED",endReason:"REVOKED"},currentPacket:null});
  await click("보안 링크 발급");
  s.readHandoff.mockResolvedValue({...preparing,assignment:{...preparing.assignment!,id:"replacement"}});await click("업체 연결 상태 다시 확인");
  expect(Boolean(button("보안 링크 발급"))).toBe(true);expect(button("보안 링크 발급")?.disabled).toBe(false);
  expect(host.textContent!.includes("원래 링크는 다시 표시할 수 없습니다")).toBe(false);expect(s.issueLink).toHaveBeenCalledTimes(1);
});

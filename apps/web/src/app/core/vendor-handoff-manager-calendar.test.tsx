// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreTicketDto,ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { downloadFile } from "../../lib/download-file";
import { VendorHandoffManager } from "./vendor-handoff-manager";

vi.mock("../../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
const ticket={ticketId:"ticket-5f0c",workStatus:"IN_PROGRESS",version:1,detail:{status:"OVERRIDDEN",decision:{type:"OVERRIDE",routeCode:"GENERAL_VENDOR"},repairPacket:{safetyEscalated:false}}} as unknown as CoreTicketDto;
const round={id:"round",openedPacketRevisionId:"packet",purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00Z"};
const appointment={id:"appointment",schedulingRoundId:"round",packetRevisionId:"packet",proposalId:"proposal",availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00Z"};
const packet={id:"packet",assignmentId:"assignment",jobReference:"JOB-7F3A",vendorLabel:"합성 업체",revision:1,publishedAt:"2026-10-06T00:00:00Z",buildingName:"해솔빌라",serviceAddress:"서울 합성구 합성로 12",unitLabel:"101동 1203호",issueType:"LEAK",workSummary:"합성 작업",sharedDetails:[],allowedPhotoIds:[],safetyNotice:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:"합성 출입 안내 문구"};
const handoff=():ManagerVendorHandoffDto=>({ticketId:"ticket-5f0c",assignment:{id:"assignment",status:"ACTIVE",endReason:null,vendorLabel:"합성 업체",version:4},currentPacket:packet,packetSource:null,
  currentRound:round,appointment,activeBlocker:null,currentReport:null,packetHistory:[],reportHistory:[],phase:"SCHEDULED",waitingOn:"VENDOR"}) as unknown as ManagerVendorHandoffDto;
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(at:string){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={vendorHandoff:{readHandoff:vi.fn(async()=>handoff()),reschedule:vi.fn()},photos:async()=>[]} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<VendorHandoffManager client={client} ticket={ticket} revision={0} now={()=>new Date(at)} onHandoff={()=>{}} onChanged={()=>{}}/>));
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
}
const calendar=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="캘린더에 추가");

it("lets the manager save the confirmed visit with the unit and the request number, never the address or access",async()=>{
  await mount("2026-10-06T03:00:00Z");await act(async()=>calendar()!.click());
  const text=save.mock.calls[0][1].replace(/\r\n /g,"");
  expect(text).toContain("SUMMARY:업체 방문 · 누수 · 해솔빌라 101동 1203호\r\n");expect(text).toContain("LOCATION:해솔빌라 101동 1203호\r\n");expect(text).toContain("요청 번호 ticket-5f0c · 세입자 확정");
  expect(text).not.toContain("합성로");expect(text).not.toContain("합성 출입 안내 문구");expect(text).not.toContain("합성 업체");
});
it("drops the button once the visit has ended",async()=>{
  await mount("2026-10-07T06:00:00Z");expect(host!.textContent).toContain("방문 일정 ·");expect(calendar()).toBeUndefined();
});

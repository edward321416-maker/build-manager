// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { downloadFile } from "../../lib/download-file";
import { VendorHandoffTenant } from "./vendor-handoff-tenant";

vi.mock("../../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
const ticketId="11111111-1111-4111-8111-111111111111",packetId="22222222-2222-4222-8222-222222222222",roundId="33333333-3333-4333-8333-333333333333",apptId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const scheduled:TenantVendorSchedulingDto={ticketId,assignmentVersion:4,packetRevisionId:packetId,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",phase:"SCHEDULED",waitingOn:"VENDOR",
  currentRound:{id:roundId,openedPacketRevisionId:packetId,purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00Z"},
  appointment:{id:apptId,schedulingRoundId:roundId,packetRevisionId:packetId,proposalId:null,availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00Z"},
  accessPolicy:"TENANT_PRESENT_REQUIRED",availability:null,proposal:null};
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(at:string,place:string|null="해솔빌라 101동 1203호"){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  // A change that never answers keeps the screen busy.
  const client={vendorHandoff:{readScheduling:vi.fn(async()=>scheduled),tenantReschedule:vi.fn(()=>new Promise(()=>{}))}} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<VendorHandoffTenant client={client} ticketId={ticketId} revision={0} now={()=>new Date(at)} issueType="LEAK" place={place}/>));
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
}
const named=(name:string)=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent===name);
const calendar=()=>named("캘린더에 추가");

it("lets the tenant save the confirmed visit with the issue and the unit",async()=>{
  await mount("2026-10-06T03:00:00Z");await act(async()=>calendar()!.click());
  const [name,text,type]=save.mock.calls[0];expect(name).toBe("방문일정_2026-10-07.ics");expect(type).toBe("text/calendar;charset=utf-8");
  expect(text).toContain("SUMMARY:수리 방문 · 누수\r\n");expect(text).toContain("LOCATION:해솔빌라 101동 1203호\r\n");expect(text).toContain(`UID:${apptId}@build-manager`);
});
it("leaves the place out when the unit is unknown, and drops the button once the visit has ended",async()=>{
  await mount("2026-10-06T03:00:00Z",null);await act(async()=>calendar()!.click());expect(save.mock.calls[0][1]).not.toContain("LOCATION");
  await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount("2026-10-07T06:00:00Z");expect(host!.textContent).toContain("확정된 방문 일정");expect(calendar()).toBeUndefined();
});
it("sits left of 방문 일정 변경 in one row, stays during the change check and cannot be pressed while the change is sent",async()=>{
  await mount("2026-10-06T03:00:00Z");const change=named("방문 일정 변경")!;
  expect(calendar()!.parentElement).toBe(change.parentElement);expect(calendar()!.compareDocumentPosition(change)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async()=>change.click());expect(calendar()!.disabled).toBe(false);
  await act(async()=>named("일정 변경하기")!.click());expect(calendar()!.disabled).toBe(true);
});

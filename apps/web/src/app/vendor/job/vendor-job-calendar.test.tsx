// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { VendorJobClient } from "@build-manager/api-client";
import type { VendorJobDto } from "@build-manager/api-contracts";
import { downloadFile } from "../../../lib/download-file";
import { VendorJobScreen } from "./vendor-job-screen";

vi.mock("../../../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
const assignmentId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",packetId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",roundId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",apptId="18181818-1818-4818-8818-181818181818";
const job=():VendorJobDto=>({assignmentId,assignmentVersion:4,status:"ACTIVE",endReason:null,phase:"SCHEDULED",waitingOn:"VENDOR",
  currentPacket:{id:packetId,assignmentId,jobReference:"JOB-B",vendorLabel:"합성 업체 B",revision:1,publishedAt:"2026-10-07T00:00:00.000Z",buildingName:"합성 건물 B",serviceAddress:"합성 주소 B, 2층",unitLabel:"101호",issueType:"LEAK",workSummary:"합성 누수 점검 B",
    sharedDetails:[{key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED"}],allowedPhotoIds:[],safetyNotice:[],accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",accessInstruction:"관리실에서 열쇠 수령"},
  currentRound:{id:roundId,openedPacketRevisionId:packetId,purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00.000Z"},
  appointment:{id:apptId,schedulingRoundId:roundId,packetRevisionId:packetId,proposalId:null,availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00.000Z"},
  activeBlocker:null,currentReport:null,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",availability:null,proposal:null});
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>{save.mockReset();window.sessionStorage.clear();window.history.replaceState(null,"","/vendor/job");});
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(at:string){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  // A change that never answers keeps the screen submitting.
  const client={session:vi.fn(async()=>({assignmentId,expiresAt:"2026-10-14T00:00:00.000Z",csrf:"S".repeat(42)+"z"})),job:vi.fn(async()=>job()),reschedule:vi.fn(()=>new Promise(()=>{})),
    sourcePhotoPath:(id:string)=>`/api/v2/vendor/job/source-photos/${id}`,completionPhotoPath:(id:string)=>`/api/v2/vendor/job/completion-photos/${id}`};
  await act(async()=>root!.render(<VendorJobScreen client={client as unknown as VendorJobClient} now={()=>new Date(at)}/>));
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
}
const named=(name:string)=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent===name);
const calendar=()=>named("캘린더에 추가");

it("lets the vendor save the confirmed visit with the service address and the job number, never the access instruction",async()=>{
  await mount("2026-10-06T03:00:00Z");await act(async()=>calendar()!.click());
  const text=save.mock.calls[0][1].replace(/\r\n /g,"");
  expect(text).toContain("SUMMARY:방문 · 누수 · 합성 건물 B 101호\r\n");expect(text).toContain("LOCATION:합성 주소 B\\, 2층\r\n");expect(text).toContain("작업 번호 JOB-B");
  for(const hidden of ["관리실에서 열쇠 수령","현재 누수","합성 업체 B","합성 누수 점검 B"])expect(text).not.toContain(hidden);
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.");
});
it("drops the button once the visit has ended",async()=>{
  await mount("2026-10-07T06:00:00Z");expect(host!.textContent).toContain("확정된 방문 일정");expect(calendar()).toBeUndefined();
});
it("sits left of 방문 일정 변경 in one row, stays during the change check and cannot be pressed while the change is sent",async()=>{
  await mount("2026-10-06T03:00:00Z");const change=named("방문 일정 변경")!;
  expect(calendar()!.parentElement).toBe(change.parentElement);expect(calendar()!.compareDocumentPosition(change)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async()=>change.click());expect(calendar()!.disabled).toBe(false);
  await act(async()=>named("일정 변경하기")!.click());expect(calendar()!.disabled).toBe(true);
});

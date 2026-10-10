// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { ApiClientError,type VendorJobClient } from "@build-manager/api-client";
import type { VendorAcceptCommand,VendorBlockerCommand,VendorClearBlockerCommand,VendorCompletionPhotoUploadCommand,VendorCompletionReportCommand,VendorDeclineCommand,VendorJobDto,VendorPreauthorizedAppointmentCommand,VendorProposalCommand,VendorRescheduleCommand,VendorVisitStartCommand,VendorWithdrawCommand } from "@build-manager/api-contracts";
import { VendorJobScreen } from "./vendor-job-screen";
import { formatVendorInterval } from "../../../lib/vendor-time";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const tokenB="B".repeat(42)+"x";
const tokenC="C".repeat(42)+"y";
const csrf="S".repeat(42)+"z";
const csrf2="T".repeat(42)+"w";
const assignmentA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const assignmentB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const packetB="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const photoB="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const expiresAt="2026-10-14T00:00:00.000Z";
function job(assignmentId:string,label:string):VendorJobDto{
  return {assignmentId,assignmentVersion:3,status:"OFFERED",endReason:null,phase:"OFFERED",waitingOn:"NONE",
    currentPacket:{id:packetB,assignmentId,jobReference:`JOB-${label}`,vendorLabel:`합성 업체 ${label}`,revision:1,publishedAt:"2026-10-07T00:00:00.000Z",
      buildingName:`합성 건물 ${label}`,serviceAddress:`합성 주소 ${label}`,unitLabel:"101호",issueType:"LEAK",workSummary:`합성 누수 점검 ${label}`,
      sharedDetails:[{key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED"},{key:"heatingType",label:"난방 방식",value:"개별",sourceType:"BUILDING_VERIFIED"}],
      allowedPhotoIds:[photoB],safetyNotice:[],accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",accessInstruction:"관리실에서 열쇠 수령"},
    currentRound:null,appointment:null,activeBlocker:null,currentReport:null,effectiveMode:null,availability:null,proposal:null};
}
const roundB="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
function active(assignmentId:string,label:string):VendorJobDto{
  return {...job(assignmentId,label),status:"ACTIVE",phase:"SCHEDULING",waitingOn:"TENANT",assignmentVersion:4,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",
    currentRound:{id:roundB,openedPacketRevisionId:packetB,purpose:"INITIAL",status:"OPEN",version:1,createdAt:"2026-10-07T00:00:00.000Z"}};
}
const network=()=>new ApiClientError("NETWORK_ERROR","API 요청을 전송하지 못했습니다.");
const http=(status:number,code:string)=>new ApiClientError(code,"요청을 처리하지 못했습니다.",{status});
type Overrides={[K in "redeem"|"session"|"job"|"decline"|"logout"|"accept"|"withdraw"|"proposeSlots"|"selectPreauthorizedSlot"|"reschedule"|"startVisit"|"recordBlocker"|"clearBlocker"|"uploadCompletionPhoto"|"submitCompletionReport"]?:(...args:Parameters<VendorJobClient[K]>)=>Promise<unknown>};
function fakeClient(overrides:Overrides={}){
  const redeemed=async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:job(assignmentB,"B")}) as unknown;
  return {
    redeem:vi.fn<(token:string,input:{clientRequestId:string})=>Promise<unknown>>(overrides.redeem??redeemed),
    session:vi.fn<()=>Promise<unknown>>(overrides.session??(async()=>({assignmentId:assignmentA,expiresAt,csrf}))),
    job:vi.fn<()=>Promise<unknown>>(overrides.job??(async()=>job(assignmentA,"A"))),
    decline:vi.fn<(csrf:string,input:VendorDeclineCommand)=>Promise<unknown>>(overrides.decline??(async()=>({...job(assignmentB,"B"),status:"ENDED",endReason:"DECLINED",phase:"ENDED",assignmentVersion:4}))),
    logout:vi.fn<(csrf:string,input:{clientRequestId:string})=>Promise<unknown>>(overrides.logout??(async()=>({revoked:true}))),
    accept:vi.fn<(csrf:string,input:VendorAcceptCommand)=>Promise<unknown>>(overrides.accept??(async()=>active(assignmentB,"B"))),
    withdraw:vi.fn<(csrf:string,input:VendorWithdrawCommand)=>Promise<unknown>>(overrides.withdraw??(async()=>({...active(assignmentB,"B"),status:"ENDED",endReason:"WITHDRAWN",phase:"ENDED",assignmentVersion:5,currentRound:null}))),
    proposeSlots:vi.fn<(csrf:string,input:VendorProposalCommand)=>Promise<unknown>>(overrides.proposeSlots??(async()=>active(assignmentB,"B"))),
    selectPreauthorizedSlot:vi.fn<(csrf:string,input:VendorPreauthorizedAppointmentCommand)=>Promise<unknown>>(overrides.selectPreauthorizedSlot??(async()=>active(assignmentB,"B"))),
    reschedule:vi.fn<(csrf:string,input:VendorRescheduleCommand)=>Promise<unknown>>(overrides.reschedule??(async()=>active(assignmentB,"B"))),
    startVisit:vi.fn<(csrf:string,appointmentId:string,input:VendorVisitStartCommand)=>Promise<unknown>>(overrides.startVisit??(async()=>active(assignmentB,"B"))),
    recordBlocker:vi.fn<(csrf:string,input:VendorBlockerCommand)=>Promise<unknown>>(overrides.recordBlocker??(async()=>active(assignmentB,"B"))),
    clearBlocker:vi.fn<(csrf:string,blockerId:string,input:VendorClearBlockerCommand)=>Promise<unknown>>(overrides.clearBlocker??(async()=>active(assignmentB,"B"))),
    uploadCompletionPhoto:vi.fn<(csrf:string,input:VendorCompletionPhotoUploadCommand,file:Blob)=>Promise<unknown>>(overrides.uploadCompletionPhoto??(async()=>({photoId:"21212121-2121-4121-8121-212121212121",mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-06T03:00:00.000Z"}))),
    submitCompletionReport:vi.fn<(csrf:string,input:VendorCompletionReportCommand)=>Promise<unknown>>(overrides.submitCompletionReport??(async()=>({}))),
    sourcePhotoPath:(id:string)=>`/api/v2/vendor/job/source-photos/${id}`,
    completionPhotoPath:(id:string)=>`/api/v2/vendor/job/completion-photos/${id}`,
  };
}
type FakeClient=ReturnType<typeof fakeClient>;
let root:Root|undefined,host:HTMLDivElement;
beforeEach(()=>{window.sessionStorage.clear();window.history.replaceState(null,"","/vendor/job");});
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.restoreAllMocks();});
async function mount(client:FakeClient,hash="",now?:()=>Date){
  window.history.replaceState(null,"",`/vendor/job${hash}`);
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<VendorJobScreen client={client as unknown as VendorJobClient} now={now}/>);});
  await act(async()=>{await Promise.resolve();});
}
async function remount(client:FakeClient){
  await act(async()=>root?.unmount());host.remove();
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<VendorJobScreen client={client as unknown as VendorJobClient}/>);});
  await act(async()=>{await Promise.resolve();});
}
const page=()=>host.textContent??"";
const markup=()=>host.innerHTML;
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
async function flush(){await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});}
async function click(label:string){expect(Boolean(button(label)),label).toBe(true);await act(async()=>{button(label)!.click();});await flush();}
const tokenFree=()=>![tokenB,tokenC,csrf,csrf2].some(raw=>markup().includes(raw));

describe("fragment redemption",()=>{
  it("redeems the fragment once, clears it only after success and shows the packet as OFFERED (not accepted)",async()=>{
    const client=fakeClient();
    await mount(client,`#${tokenB}`);
    expect(client.redeem).toHaveBeenCalledTimes(1);
    expect(client.redeem.mock.calls[0][0]===tokenB).toBe(true);
    expect(/^[0-9a-f-]{36}$/.test(client.redeem.mock.calls[0][1].clientRequestId)).toBe(true);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/vendor/job");
    expect(client.session).not.toHaveBeenCalled();
    for(const text of ["합성 업체 B","합성 주소 B","101호","합성 누수 점검 B","세입자 입력","건물 확인","링크를 연 것만으로 작업을 수락한 것은 아닙니다"])expect(page()).toContain(text);
    expect(page().indexOf("지금 할 일")).toBeLessThan(page().indexOf("업체 전달 내용"));
    expect(host.querySelector(`img[src="/api/v2/vendor/job/source-photos/${photoB}"]`)).not.toBeNull();
    expect(tokenFree()).toBe(true);
    expect(window.sessionStorage.length).toBe(0);
  });
  it("keeps the fragment and exact request identity through an unknown redeem outcome, including reload",async()=>{
    const client=fakeClient({redeem:vi.fn(async()=>{throw network();})});
    await mount(client,`#${tokenB}`);
    expect(page()).toContain("연결 결과를 확인하지 못했습니다");
    expect(window.location.hash).toBe(`#${tokenB}`);
    const first=client.redeem.mock.calls[0][1].clientRequestId;
    await click("같은 링크 요청으로 다시 확인");
    expect(client.redeem.mock.calls[1][1].clientRequestId).toBe(first);
    await remount(client);
    expect(client.redeem.mock.calls[2][0]===tokenB).toBe(true);
    expect(client.redeem.mock.calls[2][1].clientRequestId).toBe(first);
    expect(tokenFree()).toBe(true);
    expect(JSON.stringify({...window.sessionStorage}).includes(tokenB)).toBe(false);
  });
  it("never treats another assignment's existing session as proof that this redemption committed",async()=>{
    let fail=true;
    const client=fakeClient({redeem:vi.fn(async()=>{if(fail)throw http(503,"DEPENDENCY_UNAVAILABLE");return {session:{assignmentId:assignmentB,expiresAt,csrf},job:job(assignmentB,"B")};})});
    await mount(client,`#${tokenB}`);
    expect(client.session).not.toHaveBeenCalled();
    expect(client.job).not.toHaveBeenCalled();
    expect(page().includes("합성 업체 A")).toBe(false);
    expect(window.location.hash).toBe(`#${tokenB}`);
    const first=client.redeem.mock.calls[0][1].clientRequestId;
    fail=false;
    await click("같은 링크 요청으로 다시 확인");
    expect(client.redeem.mock.calls[1][1].clientRequestId).toBe(first);
    expect(page()).toContain("합성 업체 B");
    expect(page().includes("합성 업체 A")).toBe(false);
    expect(window.location.hash).toBe("");
  });
  it("starts a distinct request identity for a different fragment",async()=>{
    const client=fakeClient({redeem:vi.fn(async()=>{throw network();})});
    await mount(client,`#${tokenB}`);
    const first=client.redeem.mock.calls[0][1].clientRequestId;
    await act(async()=>root?.unmount());host.remove();
    await mount(client,`#${tokenC}`);
    expect(client.redeem.mock.calls.at(-1)![1].clientRequestId===first).toBe(false);
  });
  it("clears a definitively rejected fragment and explains a new link is needed",async()=>{
    const client=fakeClient({redeem:vi.fn(async()=>{throw http(401,"UNAUTHENTICATED");})});
    await mount(client,`#${tokenB}`);
    expect(window.location.hash).toBe("");
    expect(page()).toContain("관리자에게 새 링크를 요청해 주세요");
    expect(page().includes("알림을 보냈습니다")||page().includes("링크 복구")).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
    expect(tokenFree()).toBe(true);
  });
});

describe("existing session",()=>{
  it("loads the current session and job without a fragment",async()=>{
    const client=fakeClient();
    await mount(client);
    expect(client.redeem).not.toHaveBeenCalled();
    expect(client.session).toHaveBeenCalledTimes(1);
    expect(page()).toContain("합성 업체 A");
  });
  it("shows an access message when no session exists",async()=>{
    const client=fakeClient({session:vi.fn(async()=>{throw http(401,"UNAUTHENTICATED");})});
    await mount(client);
    expect(page()).toContain("관리자에게 새 링크를 요청해 주세요");
    expect(client.job).not.toHaveBeenCalled();
  });
});

describe("stale CSRF and transient reads",()=>{
  const fresh={assignmentId:assignmentB,expiresAt,csrf:csrf2};
  it("refreshes a stale CSRF once and retries logout with the same request identity",async()=>{
    let stale=true;
    const client=fakeClient({logout:vi.fn(async()=>{if(stale){stale=false;throw http(403,"FORBIDDEN");}return {revoked:true};}),session:vi.fn(async()=>fresh)});
    await mount(client,`#${tokenB}`);
    await click("이 기기에서 나가기");
    const calls=client.logout.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0]===csrf&&calls[1][0]===csrf2).toBe(true);
    expect(calls[1][1].clientRequestId).toBe(calls[0][1].clientRequestId);
    expect(page()).toContain("이 기기에서 작업 화면을 닫았습니다");
  });
  it("never reports a logout while the session is still live",async()=>{
    const client=fakeClient({logout:vi.fn(async()=>{throw http(403,"FORBIDDEN");}),session:vi.fn(async()=>fresh)});
    await mount(client,`#${tokenB}`);
    await click("이 기기에서 나가기");
    expect(client.logout).toHaveBeenCalledTimes(2);
    expect(page().includes("이 기기에서 작업 화면을 닫았습니다")).toBe(false);
    expect(page()).toContain("나가기를 완료하지 못했습니다");
  });
  it("confirms a 401 logout against the session before showing the logged-out state",async()=>{
    let live=true;
    const client=fakeClient({logout:vi.fn(async()=>{throw http(401,"UNAUTHENTICATED");}),session:vi.fn(async()=>{if(live)return fresh;throw http(401,"UNAUTHENTICATED");})});
    await mount(client,`#${tokenB}`);
    await click("이 기기에서 나가기");
    expect(client.session).toHaveBeenCalledTimes(1);
    expect(page().includes("이 기기에서 작업 화면을 닫았습니다")).toBe(false);
    live=false;
    await click("이 기기에서 나가기");
    expect(page()).toContain("이 기기에서 작업 화면을 닫았습니다");
  });
  it("refreshes a stale CSRF once for decline with the same request identity",async()=>{
    let stale=true;
    const client=fakeClient({decline:vi.fn(async()=>{if(stale){stale=false;throw http(403,"FORBIDDEN");}return {...job(assignmentB,"B"),status:"ENDED",endReason:"DECLINED",phase:"ENDED",assignmentVersion:4};}),session:vi.fn(async()=>fresh)});
    await mount(client,`#${tokenB}`);
    await click("작업 거절");
    const radio=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.value==="NO_CAPACITY")!;
    await act(async()=>{radio.click();});
    await click("거절 내용 확인");
    await click("거절하기");
    const calls=client.decline.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][0]===csrf2).toBe(true);
    expect(calls[1][1].clientRequestId).toBe(calls[0][1].clientRequestId);
    expect(page()).toContain("작업 요청을 거절했습니다");
  });
  it("shows a transient load failure as retryable instead of a dead link",async()=>{
    let fail=true;
    const client=fakeClient({session:vi.fn(async()=>{if(fail)throw network();return {assignmentId:assignmentA,expiresAt,csrf};})});
    await mount(client);
    expect(page()).toContain("작업 화면을 불러오지 못했습니다");
    expect(page().includes("새 링크를 요청")).toBe(false);
    fail=false;
    await click("다시 불러오기");
    expect(page()).toContain("합성 업체 A");
  });
  it("never carries a pending decline across a same-tab switch to another assignment",async()=>{
    const client=fakeClient({
      redeem:vi.fn(async(token:string)=>({session:{assignmentId:token===tokenC?assignmentA:assignmentB,expiresAt,csrf},job:job(token===tokenC?assignmentA:assignmentB,token===tokenC?"A":"B")})),
      decline:vi.fn(async()=>{throw network();}),
    });
    await mount(client,`#${tokenB}`);
    await click("작업 거절");
    const radio=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.value==="OTHER")!;
    await act(async()=>{radio.click();});
    await click("거절 내용 확인");
    await click("거절하기");
    expect(page()).toContain("거절 결과를 확인하지 못했습니다");
    await act(async()=>{window.history.pushState(null,"",`/vendor/job#${tokenC}`);window.dispatchEvent(new Event("hashchange"));});
    await flush();
    expect(page()).toContain("합성 업체 A");
    expect(page().includes("거절 결과를 확인하지 못했습니다")).toBe(false);
    expect(page().includes("이 작업 요청을 거절할까요?")).toBe(false);
    expect(button("같은 요청으로 결과 확인")).toBeUndefined();
    expect(button("작업 거절")).toBeDefined();
    expect(client.decline).toHaveBeenCalledTimes(1);
  });
  it("redeems a new fragment opened in an already loaded job tab",async()=>{
    const client=fakeClient();
    await mount(client);
    expect(page()).toContain("합성 업체 A");
    await act(async()=>{window.history.pushState(null,"",`/vendor/job#${tokenC}`);window.dispatchEvent(new Event("hashchange"));});
    await flush();
    expect(client.redeem).toHaveBeenCalledTimes(1);
    expect(client.redeem.mock.calls[0][0]===tokenC).toBe(true);
    expect(window.location.hash).toBe("");
    expect(page()).toContain("합성 업체 B");
    expect(tokenFree()).toBe(true);
  });
});

describe("Task5 accept and withdraw",()=>{
  it("accepts an OFFERED job with current guards and server CSRF, then shows visit scheduling as the current task",async()=>{
    const client=fakeClient();
    await mount(client,`#${tokenB}`);
    await click("작업 수락");
    expect(client.accept).toHaveBeenCalledTimes(1);
    expect(client.accept.mock.calls[0][0]===csrf).toBe(true);
    expect(client.accept.mock.calls[0][1]).toMatchObject({expectedAssignmentVersion:3,expectedPacketRevisionId:packetB});
    expect(page()).toContain("방문 일정 조율");
    expect(page()).toContain("세입자가 가능한 시간을 알려 주기를 기다리고 있습니다");
    expect(button("작업 수락")).toBeUndefined();
    expect(button("작업 거절")).toBeUndefined();
    expect(button("작업 철회")).toBeDefined();
    expect(page().indexOf("지금 할 일")).toBeLessThan(page().indexOf("업체 전달 내용"));
  });
  it("reconciles an unknown accept outcome with the same request identity",async()=>{
    let fail=true;
    const client=fakeClient({job:vi.fn(async()=>client.accept.mock.calls.length<2?job(assignmentB,"B"):active(assignmentB,"B")),accept:vi.fn(async()=>{if(fail)throw network();return active(assignmentB,"B");})});
    await mount(client,`#${tokenB}`);
    await click("작업 수락");
    expect(page()).toContain("수락 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 수락 결과 확인");
    const ids=client.accept.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(page()).toContain("방문 일정 조율");
  });
  it("refreshes authoritative state after a stale accept conflict",async()=>{
    const client=fakeClient({accept:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`);
    await click("작업 수락");
    expect(client.job).toHaveBeenCalledTimes(1);
    expect(page()).toContain("최신 내용을 확인해 주세요");
  });
  it("withdraws an ACTIVE job only after an explicit confirmation",async()=>{
    const client=fakeClient({redeem:vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:active(assignmentB,"B")}))});
    await mount(client,`#${tokenB}`);
    await click("작업 철회");
    await click("철회 내용 확인");
    expect(page()).toContain("이 작업을 철회할까요?");
    expect(client.withdraw).not.toHaveBeenCalled();
    await click("철회하기");
    expect(client.withdraw).toHaveBeenCalledTimes(1);
    expect(client.withdraw.mock.calls[0][1]).toMatchObject({expectedAssignmentVersion:4,expectedPacketRevisionId:packetB,operationalNote:null});
    expect(page()).toContain("작업을 철회했습니다");
    expect(button("작업 철회")).toBeUndefined();
    expect(page().includes("수리 완료")||page().includes("업체 완료")).toBe(false);
  });
  it("ignores a late result that started before a same-tab assignment switch",async()=>{
    let finish!:(value:unknown)=>void;
    const client=fakeClient({
      redeem:vi.fn(async(token:string)=>({session:{assignmentId:token===tokenC?assignmentA:assignmentB,expiresAt,csrf},job:job(token===tokenC?assignmentA:assignmentB,token===tokenC?"A":"B")})),
      decline:vi.fn(()=>new Promise(resolve=>{finish=resolve;})),
    });
    await mount(client,`#${tokenB}`);
    await click("작업 거절");
    const radio=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.value==="OTHER")!;
    await act(async()=>{radio.click();});
    await click("거절 내용 확인");
    await click("거절하기");
    await act(async()=>{window.history.pushState(null,"",`/vendor/job#${tokenC}`);window.dispatchEvent(new Event("hashchange"));});
    await flush();
    expect(page()).toContain("합성 업체 A");
    await act(async()=>{finish({...job(assignmentB,"B"),status:"ENDED",endReason:"DECLINED",phase:"ENDED",assignmentVersion:4});});
    await flush();
    expect(page()).toContain("합성 업체 A");
    expect(page().includes("작업 요청을 거절했습니다")).toBe(false);
  });
});

describe("decline and logout",()=>{
  async function chooseDecline(){
    await click("작업 거절");
    const radio=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.value==="SKILL_MISMATCH")!;
    await act(async()=>{radio.click();});
    await click("거절 내용 확인");
    expect(page()).toContain("이 작업 요청을 거절할까요?");
  }
  it("declines only after an explicit confirmation with current stale-state guards and server CSRF",async()=>{
    const client=fakeClient();
    await mount(client,`#${tokenB}`);
    await chooseDecline();
    await click("거절하기");
    expect(client.decline).toHaveBeenCalledTimes(1);
    const [presented,input]=client.decline.mock.calls[0];
    expect(presented===csrf).toBe(true);
    expect(input).toMatchObject({expectedAssignmentVersion:3,expectedPacketRevisionId:packetB,reason:"SKILL_MISMATCH",operationalNote:null});
    expect(page()).toContain("작업 요청을 거절했습니다");
    expect(button("작업 거절")).toBeUndefined();
    expect(page().includes("수리 완료")||page().includes("업체 완료")).toBe(false);
  });
  it("keeps a locally invalid note editable instead of reporting an unknown outcome",async()=>{
    const client=fakeClient();
    await mount(client,`#${tokenB}`);
    await click("작업 거절");
    const radio=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.value==="OTHER")!;
    await act(async()=>{radio.click();});
    const area=host.querySelector("textarea")!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(area,"합성메모");area.dispatchEvent(new Event("input",{bubbles:true}));});
    await click("거절 내용 확인");
    expect(page()).toContain("메모에 사용할 수 없는 문자가 있습니다");
    expect(page().includes("이 작업 요청을 거절할까요?")).toBe(false);
    expect(page().includes("결과를 확인하지 못했습니다")).toBe(false);
    const editable=host.querySelector("textarea")!;
    await act(async()=>{setter.call(editable,"합성 메모");editable.dispatchEvent(new Event("input",{bubbles:true}));});
    await click("거절 내용 확인");
    await click("거절하기");
    expect(client.decline).toHaveBeenCalledTimes(1);
    expect(client.decline.mock.calls[0][1]).toMatchObject({reason:"OTHER",operationalNote:"합성 메모"});
  });
  it("reconciles an unknown decline outcome with the same request identity",async()=>{
    let fail=true;
    const client=fakeClient({job:vi.fn(async()=>{if(client.decline.mock.calls.length>=2)throw http(401,"UNAUTHENTICATED");return job(assignmentB,"B");}),decline:vi.fn(async()=>{if(fail)throw network();return {...job(assignmentB,"B"),status:"ENDED" as const,endReason:"DECLINED" as const,phase:"ENDED" as const,assignmentVersion:4};})});
    await mount(client,`#${tokenB}`);
    await chooseDecline();
    await click("거절하기");
    expect(page()).toContain("거절 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=client.decline.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids[0]).toBe(ids[1]);
    // LOW-1: the exact replay receipt proves this request ended the assignment.
    expect(page()).toContain("작업 요청을 거절했습니다");
  });
  it("reloads authoritative state after a stale decline conflict",async()=>{
    const client=fakeClient({decline:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`);
    await chooseDecline();
    await click("거절하기");
    expect(client.job).toHaveBeenCalledTimes(1);
    expect(page()).toContain("최신 내용을 확인해 주세요");
  });
  it("logs out with the server CSRF and stops showing the job",async()=>{
    const client=fakeClient();
    await mount(client,`#${tokenB}`);
    await click("이 기기에서 나가기");
    const [presented,input]=client.logout.mock.calls[0];
    expect(presented===csrf).toBe(true);
    expect(/^[0-9a-f-]{36}$/.test(input.clientRequestId)).toBe(true);
    expect(page()).toContain("이 기기에서 작업 화면을 닫았습니다");
    expect(page().includes("합성 업체 B")).toBe(false);
  });
});

describe("Task5 review remediation (screen)",()=>{
  const proposalB={id:"ffffffff-ffff-4fff-8fff-ffffffffffff",slots:[{id:"abababab-abab-4bab-8bab-abababababab",startAt:"2026-10-08T05:00:00.000Z",endAt:"2026-10-08T06:00:00.000Z"}],createdAt:"2026-10-07T00:00:00.000Z"};
  it("never lets a stale logout refresh and retry against a session redeemed after a same-tab switch",async()=>{
    let release!:(value:unknown)=>void;
    let first=true;
    const client=fakeClient({
      redeem:vi.fn(async(token:string)=>({session:{assignmentId:token===tokenC?assignmentA:assignmentB,expiresAt,csrf:token===tokenC?csrf2:csrf},job:job(token===tokenC?assignmentA:assignmentB,token===tokenC?"A":"B")})),
      logout:vi.fn(async()=>{if(first){first=false;throw http(403,"FORBIDDEN");}return {revoked:true};}),
      session:vi.fn(()=>new Promise(resolve=>{release=resolve;})),
    });
    await mount(client,`#${tokenB}`);
    await click("이 기기에서 나가기");
    await act(async()=>{window.history.pushState(null,"",`/vendor/job#${tokenC}`);window.dispatchEvent(new Event("hashchange"));});
    await flush();
    expect(page()).toContain("합성 업체 A");
    await act(async()=>{release({assignmentId:assignmentA,expiresAt,csrf:csrf2});});
    await flush();
    expect(client.logout).toHaveBeenCalledTimes(1);
    expect(page()).toContain("합성 업체 A");
    expect(page().includes("이 기기에서 작업 화면을 닫았습니다")).toBe(false);
  });
  it("attributes a pending proposal to the Vendor in the waiting copy",async()=>{
    const waiting={...active(assignmentB,"B"),waitingOn:"TENANT" as const,proposal:proposalB};
    const client=fakeClient({redeem:vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:waiting}))});
    await mount(client,`#${tokenB}`,()=>new Date("2026-10-07T00:00:00Z"));
    expect(page()).toContain("제안한 시간 중 하나를 세입자가 고르기를 기다리고 있습니다");
    expect(page().includes("세입자가 제안한 시간")).toBe(false);
  });
  it("keeps the withdraw note after a stale conflict",async()=>{
    const client=fakeClient({redeem:vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:active(assignmentB,"B")})),
      job:vi.fn(async()=>active(assignmentB,"B")),withdraw:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`);
    await click("작업 철회");
    const area=host.querySelector("textarea")!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(area,"합성 철회 사유");area.dispatchEvent(new Event("input",{bubbles:true}));});
    await click("철회 내용 확인");
    await click("철회하기");
    expect(page()).toContain("최신 내용을 확인해 주세요");
    expect(host.querySelector("textarea")?.value).toBe("합성 철회 사유");
  });
  it("ignores a late Accept result that started before a same-tab assignment switch",async()=>{
    let finish!:(value:unknown)=>void;
    const client=fakeClient({
      redeem:vi.fn(async(token:string)=>({session:{assignmentId:token===tokenC?assignmentA:assignmentB,expiresAt,csrf},job:job(token===tokenC?assignmentA:assignmentB,token===tokenC?"A":"B")})),
      accept:vi.fn(()=>new Promise(resolve=>{finish=resolve;})),
    });
    await mount(client,`#${tokenB}`);
    await click("작업 수락");
    await act(async()=>{window.history.pushState(null,"",`/vendor/job#${tokenC}`);window.dispatchEvent(new Event("hashchange"));});
    await flush();
    await act(async()=>{finish(active(assignmentB,"B"));});
    await flush();
    expect(page()).toContain("합성 업체 A");
    expect(page().includes("방문 일정 조율")).toBe(false);
    expect(button("작업 수락")).toBeDefined();
  });
  it("reconciles an unknown Withdraw outcome with the same request identity",async()=>{
    let fail=true;
    const client=fakeClient({job:vi.fn(async()=>{if(client.withdraw.mock.calls.length>=2)throw http(401,"UNAUTHENTICATED");return active(assignmentB,"B");}),redeem:vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:active(assignmentB,"B")})),
      withdraw:vi.fn(async()=>{if(fail)throw network();return {...active(assignmentB,"B"),status:"ENDED",endReason:"WITHDRAWN",phase:"ENDED",assignmentVersion:5,currentRound:null};})});
    await mount(client,`#${tokenB}`);
    await click("작업 철회");
    await click("철회 내용 확인");
    await click("철회하기");
    expect(page()).toContain("철회 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=client.withdraw.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(page()).toContain("작업을 철회했습니다");
  });
});

describe("Task6 Vendor visit scheduling",()=>{
  const now=()=>new Date("2026-10-06T03:00:00Z");
  const subB="12121212-1212-4212-8212-121212121212",w1="13131313-1313-4313-8313-131313131313",w2="14141414-1414-4414-8414-141414141414";
  const propB="15151515-1515-4515-8515-151515151515",slotOld="16161616-1616-4616-8616-161616161616",slotNew="17171717-1717-4717-8717-171717171717",apptB="18181818-1818-4818-8818-181818181818";
  const availability={id:subB,windows:[{id:w1,startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T07:00:00.000Z"},{id:w2,startAt:"2026-10-08T01:00:00.000Z",endAt:"2026-10-08T04:00:00.000Z"}],authorizedWindowIds:[] as string[],createdAt:"2026-10-06T01:00:00.000Z"};
  const vendorTurn=(changes:Partial<VendorJobDto>={}):VendorJobDto=>({...active(assignmentB,"B"),waitingOn:"VENDOR",availability,...changes});
  const preauthorized=()=>vendorTurn({effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",availability:{...availability,authorizedWindowIds:[w1]}});
  const proposed=(slots:{id:string;startAt:string;endAt:string}[])=>vendorTurn({waitingOn:"TENANT",proposal:{id:propB,slots,createdAt:"2026-10-06T02:00:00.000Z"}});
  const scheduled=():VendorJobDto=>({...active(assignmentB,"B"),phase:"SCHEDULED",waitingOn:"VENDOR",currentRound:{id:roundB,openedPacketRevisionId:packetB,purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-07T00:00:00.000Z"},
    appointment:{id:apptB,schedulingRoundId:roundB,packetRevisionId:packetB,proposalId:propB,availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00.000Z"}});
  const opened=(value:VendorJobDto)=>vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:value}));
  async function type(selector:string,value:string,index=0){
    const element=host.querySelectorAll<HTMLInputElement>(selector)[index]!;
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(element,value);element.dispatchEvent(new Event("input",{bubbles:true}));});
  }
  async function enter(date:string,start:string,end:string){await type('input[type="date"]',date);await type('input[type="time"]',start,0);await type('input[type="time"]',end,1);}
  async function choose(label:string){
    const input=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.closest("label")?.textContent?.includes(label));
    expect(Boolean(input),label).toBe(true);await act(async()=>{input!.click();});
  }
  it("shows Tenant availability in Seoul time and proposes future slots with current guards and server CSRF",async()=>{
    const client=fakeClient({redeem:opened(vendorTurn()),proposeSlots:vi.fn(async()=>proposed([{id:slotNew,startAt:"2026-10-10T01:00:00.000Z",endAt:"2026-10-10T02:00:00.000Z"}]))});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("10월 7일(수) 오후 2:00–4:00");
    expect(page()).toContain("10월 8일(목) 오전 10:00–오후 1:00");
    await enter("2026-10-10","10:00","11:00");
    await click("방문 시간 제안하기");
    const [sent,input]=client.proposeSlots.mock.calls[0];
    expect(sent).toBe(csrf);
    expect(input).toMatchObject({expectedAssignmentVersion:4,expectedRoundVersion:1,expectedPacketRevisionId:packetB,slots:[{startAt:"2026-10-10T01:00:00.000Z",endAt:"2026-10-10T02:00:00.000Z"}]});
    expect(page()).toContain("제안한 시간 중 하나를 세입자가 고르기를 기다리고 있습니다");
    expect(page()).toContain("10월 10일(토) 오전 10:00–11:00");
    expect(tokenFree()).toBe(true);
  });
  // Menu audit F-17: a Tenant's available time can be copied into a proposal row instead of retyped.
  const fill=(text:string)=>host.querySelector<HTMLButtonElement>(`button[aria-label="${text} 제안 시간에 넣기"]`);
  const rows=()=>Array.from(host.querySelectorAll<HTMLElement>('[role="group"][aria-label^="시간대 "]')).map(row=>Array.from(row.querySelectorAll("input")).map(input=>input.value));
  it("copies a Tenant's available time into the proposal rows and proposes it",async()=>{
    const client=fakeClient({redeem:opened(vendorTurn()),proposeSlots:vi.fn(async()=>proposed([{id:slotNew,startAt:availability.windows[0].startAt,endAt:availability.windows[0].endAt}]))});
    await mount(client,`#${tokenB}`,now);
    await act(async()=>{fill("10월 7일(수) 오후 2:00–4:00")!.click();});
    expect(rows()).toEqual([["2026-10-07","14:00","16:00"]]);
    await act(async()=>{fill("10월 8일(목) 오전 10:00–오후 1:00")!.click();});
    await act(async()=>{fill("10월 7일(수) 오후 2:00–4:00")!.click();});
    expect(rows()).toEqual([["2026-10-07","14:00","16:00"],["2026-10-08","10:00","13:00"]]);
    await click("방문 시간 제안하기");
    expect(client.proposeSlots.mock.calls[0][1].slots).toEqual(availability.windows.map(({startAt,endAt})=>({startAt,endAt})));
  });
  it("keeps only the start of a Tenant window that ends the next day and stops at five proposal rows",async()=>{
    const late=Array.from({length:6},(_,i)=>({id:`1313131${i}-1313-4313-8313-131313131313`,startAt:`2026-10-${10+i}T14:30:00.000Z`,endAt:`2026-10-${10+i}T16:00:00.000Z`}));
    const client=fakeClient({redeem:opened(vendorTurn({availability:{...availability,windows:late}}))});
    await mount(client,`#${tokenB}`,now);
    for(const item of late.slice(0,5))await act(async()=>{fill(formatVendorInterval(item.startAt,item.endAt,now()))!.click();});
    expect(rows()).toEqual(late.slice(0,5).map((_,i)=>[`2026-10-${10+i}`,"23:30",""]));
    expect(fill(formatVendorInterval(late[5].startAt,late[5].endAt,now()))?.disabled).toBe(true);
    expect(page()).toContain("제안할 시간은 5개까지예요");
  });
  it("rejects a past proposal slot locally without sending",async()=>{
    const client=fakeClient({redeem:opened(vendorTurn())});
    await mount(client,`#${tokenB}`,now);
    await enter("2026-10-05","10:00","11:00");
    await click("방문 시간 제안하기");
    expect(client.proposeSlots).not.toHaveBeenCalled();
    expect(page()).toContain("지난 시간은 선택할 수 없습니다");
  });
  it("hides expired proposal slots and lets the Vendor propose again when all have passed",async()=>{
    const client=fakeClient({redeem:opened(proposed([{id:slotOld,startAt:"2026-10-06T01:00:00.000Z",endAt:"2026-10-06T02:00:00.000Z"}]))});
    await mount(client,`#${tokenB}`,now);
    expect(page().includes("10월 6일(화) 오전 10:00–11:00")).toBe(false);
    expect(page()).toContain("제안한 시간이 모두 지났습니다");
    expect(button("방문 시간 제안하기")).toBeDefined();
  });
  it("selects a visit time only inside an explicitly authorized window",async()=>{
    const client=fakeClient({redeem:opened(preauthorized()),selectPreauthorizedSlot:vi.fn(async()=>scheduled())});
    await mount(client,`#${tokenB}`,now);
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map(x=>x.closest("label")?.textContent)).toEqual(["10월 7일(수) 오후 2:00–4:00"]);
    await choose("10월 7일(수) 오후 2:00–4:00");
    await enter("2026-10-07","14:30","15:30");
    await click("동의된 시간 안에서 방문 확정");
    const [sent,input]=client.selectPreauthorizedSlot.mock.calls[0];
    expect(sent).toBe(csrf);
    expect(input).toMatchObject({availabilitySubmissionId:subB,selectedWindowId:w1,startAt:"2026-10-07T05:30:00.000Z",endAt:"2026-10-07T06:30:00.000Z",expectedRoundVersion:1,expectedAssignmentVersion:4});
    expect(page()).toContain("방문 일정이 확정되었습니다");
  });
  it("rejects a preauthorized time that leaves the authorized window by absolute instant",async()=>{
    const client=fakeClient({redeem:opened(preauthorized())});
    await mount(client,`#${tokenB}`,now);
    await choose("10월 7일(수) 오후 2:00–4:00");
    await enter("2026-10-07","15:30","16:30");
    await click("동의된 시간 안에서 방문 확정");
    expect(client.selectPreauthorizedSlot).not.toHaveBeenCalled();
    expect(page()).toContain("동의된 시간 안에서만 방문 시간을 정할 수 있습니다");
  });
  it("shows the SCHEDULED Appointment and reschedules only after an explicit confirmation",async()=>{
    const client=fakeClient({redeem:opened(scheduled())});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("10월 7일(수) 오후 2:00–3:00");
    await click("방문 일정 변경");
    expect(client.reschedule).not.toHaveBeenCalled();
    expect(page()).toContain("기존 방문 일정은 취소되고");
    await click("일정 변경하기");
    expect(client.reschedule.mock.calls[0][1]).toMatchObject({expectedAppointmentId:apptB,expectedRoundVersion:3,expectedAssignmentVersion:4,expectedPacketRevisionId:packetB});
  });
  it("reconciles an unknown proposal outcome with the same request identity",async()=>{
    let fail=true;
    const client=fakeClient({job:vi.fn(async()=>client.proposeSlots.mock.calls.length<2?vendorTurn():vendorTurn()),redeem:opened(vendorTurn()),proposeSlots:vi.fn(async()=>{if(fail)throw network();return proposed([{id:slotNew,startAt:"2026-10-10T01:00:00.000Z",endAt:"2026-10-10T02:00:00.000Z"}]);})});
    await mount(client,`#${tokenB}`,now);
    await enter("2026-10-10","10:00","11:00");
    await click("방문 시간 제안하기");
    expect(page()).toContain("제안 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=client.proposeSlots.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
  });
  it("refreshes authoritative state and keeps the draft after a stale proposal conflict",async()=>{
    const client=fakeClient({redeem:opened(vendorTurn()),job:vi.fn(async()=>vendorTurn()),proposeSlots:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`,now);
    await enter("2026-10-10","10:00","11:00");
    await click("방문 시간 제안하기");
    expect(client.job).toHaveBeenCalled();
    expect(page()).toContain("최신 내용을 확인해 주세요");
    expect(host.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe("2026-10-10");
  });
  it("never shows a late scheduling result over the logged-out screen (review L4)",async()=>{
    let finish!:(value:unknown)=>void;
    const client=fakeClient({redeem:opened(vendorTurn()),proposeSlots:vi.fn(()=>new Promise(resolve=>{finish=resolve;}))});
    await mount(client,`#${tokenB}`,now);
    await enter("2026-10-10","10:00","11:00");
    await click("방문 시간 제안하기");
    await click("이 기기에서 나가기");
    expect(page()).toContain("이 기기에서 작업 화면을 닫았습니다");
    await act(async()=>{finish(proposed([{id:slotNew,startAt:"2026-10-10T01:00:00.000Z",endAt:"2026-10-10T02:00:00.000Z"}]));});
    await flush();
    expect(page()).toContain("이 기기에서 작업 화면을 닫았습니다");
    expect(page().includes("합성 업체 B")).toBe(false);
  });
  it("maps a persistent 403 to a security notice and a 400 to an input notice, keeping the draft (review L6)",async()=>{
    const client=fakeClient({redeem:opened(vendorTurn()),session:vi.fn(async()=>({assignmentId:assignmentB,expiresAt,csrf:csrf2})),
      proposeSlots:vi.fn(async()=>{throw http(403,"FORBIDDEN");})});
    await mount(client,`#${tokenB}`,now);
    await enter("2026-10-10","10:00","11:00");
    await click("방문 시간 제안하기");
    expect(page()).toContain("보안 확인을 마치지 못했습니다");
    expect(host.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe("2026-10-10");
    client.proposeSlots.mockImplementation(async()=>{throw http(400,"INVALID_INPUT");});
    await click("방문 시간 제안하기");
    expect(page()).toContain("입력한 시간을 다시 확인해 주세요");
    expect(host.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe("2026-10-10");
  });
  it("does not claim a preauthorized selection turn once every authorized window has ended (rereview residual)",async()=>{
    const ended=vendorTurn({effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",availability:{...availability,
      windows:[{id:w1,startAt:"2026-10-05T05:00:00.000Z",endAt:"2026-10-05T07:00:00.000Z"}],authorizedWindowIds:[w1]}});
    const client=fakeClient({redeem:opened(ended)});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("세입자가 동의한 시간이 모두 지났습니다");
    expect(page().includes("동의한 시간 안에서 방문 시간을 정할 차례입니다")).toBe(false);
    expect(button("동의된 시간 안에서 방문 확정")).toBeUndefined();
  });
  it("explains that the Vendor may propose first while the Tenant has not sent availability",async()=>{
    const client=fakeClient({redeem:opened(active(assignmentB,"B"))});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("세입자가 가능한 시간을 알려 주기를 기다리고 있습니다");
    expect(page()).toContain("먼저 방문 시간을 제안할 수도 있습니다");
    expect(button("방문 시간 제안하기")).toBeDefined();
  });
  it("ignores a late proposal result that started before a same-tab assignment switch",async()=>{
    let finish!:(value:unknown)=>void;
    const client=fakeClient({
      redeem:vi.fn(async(token:string)=>token===tokenC?{session:{assignmentId:assignmentA,expiresAt,csrf},job:job(assignmentA,"A")}:{session:{assignmentId:assignmentB,expiresAt,csrf},job:vendorTurn()}),
      proposeSlots:vi.fn(()=>new Promise(resolve=>{finish=resolve;})),
    });
    await mount(client,`#${tokenB}`,now);
    await enter("2026-10-10","10:00","11:00");
    await click("방문 시간 제안하기");
    await act(async()=>{window.history.pushState(null,"",`/vendor/job#${tokenC}`);window.dispatchEvent(new Event("hashchange"));});
    await flush();
    await act(async()=>{finish(proposed([{id:slotNew,startAt:"2026-10-10T01:00:00.000Z",endAt:"2026-10-10T02:00:00.000Z"}]));});
    await flush();
    expect(page()).toContain("합성 업체 A");
    expect(page().includes("방문 일정 조율")).toBe(false);
    expect(page().includes("10월 10일(토)")).toBe(false);
  });
});

describe("Task7 Vendor visit and blocker evidence",()=>{
  const now=()=>new Date("2026-10-06T03:00:00Z");
  const apptB="18181818-1818-4818-8818-181818181818",propB="15151515-1515-4515-8515-151515151515",blockerB="19191919-1919-4919-8919-191919191919";
  const appointment={id:apptB,schedulingRoundId:roundB,packetRevisionId:packetB,proposalId:propB,availabilitySubmissionId:null,selectedWindowId:null,
    startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED" as const,status:"SCHEDULED" as const,createdAt:"2026-10-06T02:00:00.000Z"};
  const confirmedRound={id:roundB,openedPacketRevisionId:packetB,purpose:"INITIAL" as const,status:"CONFIRMED" as const,version:3,createdAt:"2026-10-06T00:00:00.000Z"};
  const scheduledJob=(changes:Partial<VendorJobDto>={}):VendorJobDto=>({...active(assignmentB,"B"),phase:"SCHEDULED",waitingOn:"VENDOR",currentRound:confirmedRound,appointment,...changes});
  const visited=(changes:Partial<VendorJobDto>={})=>scheduledJob({phase:"IN_PROGRESS",assignmentVersion:5,appointment:{...appointment,status:"OCCURRED"},...changes});
  const blocker=(code:"PARTS_REQUIRED"|"FOLLOW_UP_VISIT_REQUIRED",note:string|null=null)=>({id:blockerB,code,note,active:true,createdAt:"2026-10-06T02:30:00.000Z",clearedAt:null});
  const opened=(value:VendorJobDto)=>vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:value}));
  const radioLabels=()=>Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map(x=>x.closest("label")?.textContent??"");
  async function choose(label:string){
    const input=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.closest("label")?.textContent?.includes(label));
    expect(Boolean(input),label).toBe(true);await act(async()=>{input!.click();});
  }
  async function note(value:string){
    const area=host.querySelector("textarea")!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(area,value);area.dispatchEvent(new Event("input",{bubbles:true}));});
  }
  it("records a visit start only after an explicit confirmation with current guards",async()=>{
    const client=fakeClient({redeem:opened(scheduledJob()),startVisit:vi.fn(async()=>visited())});
    await mount(client,`#${tokenB}`,now);
    await click("방문 시작");
    expect(client.startVisit).not.toHaveBeenCalled();
    expect(page()).toContain("되돌릴 수 없습니다");
    await click("방문 시작 기록");
    const [sent,appointmentId,input]=client.startVisit.mock.calls[0];
    expect([sent,appointmentId]).toEqual([csrf,apptB]);
    expect(input).toMatchObject({expectedAssignmentVersion:4,expectedRoundVersion:3,expectedPacketRevisionId:packetB});
    expect(page()).toContain("방문 작업이 진행 중입니다");
    expect(button("방문 시작")).toBeUndefined();
  });
  it("records a blocker as an overlay that keeps the Appointment and offers no visit start while blocked",async()=>{
    const client=fakeClient({redeem:opened(scheduledJob()),recordBlocker:vi.fn(async()=>scheduledJob({waitingOn:"PARTS",assignmentVersion:5,activeBlocker:blocker("PARTS_REQUIRED","합성 부품 대기")}))});
    await mount(client,`#${tokenB}`,now);
    await click("막힘 기록");
    expect(radioLabels().some(label=>label.includes("추가 방문 필요"))).toBe(false);
    await choose("부품 필요");
    await note("합성 부품 대기");
    await click("막힘 기록하기");
    expect(client.recordBlocker.mock.calls[0]).toEqual([csrf,expect.objectContaining({blockerCode:"PARTS_REQUIRED",operationalNote:"합성 부품 대기",expectedAssignmentVersion:4,expectedPacketRevisionId:packetB})]);
    expect(page()).toContain("현재 막힘");
    expect(page()).toContain("부품 필요");
    expect(page()).toContain("합성 부품 대기");
    expect(page()).toContain("10월 7일(수) 오후 2:00–3:00");
    expect(button("방문 시작")).toBeUndefined();
    expect(button("막힘 기록")).toBeUndefined();
  });
  it("offers FOLLOW_UP_VISIT_REQUIRED only after a visit occurred",async()=>{
    const client=fakeClient({redeem:opened(visited())});
    await mount(client,`#${tokenB}`,now);
    await click("막힘 기록");
    expect(radioLabels().some(label=>label.includes("추가 방문 필요"))).toBe(true);
  });
  it("clears the exact current blocker with an optional note",async()=>{
    const client=fakeClient({redeem:opened(visited({waitingOn:"PARTS",activeBlocker:blocker("PARTS_REQUIRED")})),clearBlocker:vi.fn(async()=>visited({assignmentVersion:6}))});
    await mount(client,`#${tokenB}`,now);
    await click("막힘 해제");
    expect(client.clearBlocker).not.toHaveBeenCalled();
    await note("합성 부품 도착");
    await click("막힘 해제 기록");
    expect(client.clearBlocker.mock.calls[0]).toEqual([csrf,blockerB,expect.objectContaining({operationalNote:"합성 부품 도착",expectedAssignmentVersion:5,expectedPacketRevisionId:packetB})]);
    expect(page().includes("현재 막힘")).toBe(false);
  });
  it("starts follow-up scheduling from a FOLLOW_UP_VISIT_REQUIRED blocker only after stating the consequence",async()=>{
    const followUpRound={...confirmedRound,id:"20202020-2020-4020-8020-202020202020",purpose:"FOLLOW_UP" as const,status:"OPEN" as const,version:1};
    const client=fakeClient({redeem:opened(visited({activeBlocker:blocker("FOLLOW_UP_VISIT_REQUIRED")})),
      clearBlocker:vi.fn(async()=>visited({phase:"SCHEDULING",waitingOn:"TENANT",assignmentVersion:6,currentRound:followUpRound}))});
    await mount(client,`#${tokenB}`,now);
    expect(button("막힘 해제")).toBeUndefined();
    await click("추가 방문 일정 잡기");
    expect(page()).toContain("추가 방문 일정 조율을 시작합니다");
    expect(page()).toContain("이전 방문 기록은 그대로 남습니다");
    await click("추가 방문 일정 조율 시작");
    expect(client.clearBlocker.mock.calls[0][1]).toBe(blockerB);
    expect(page()).toContain("세입자가 가능한 시간을 알려 주기를 기다리고 있습니다");
  });
  it("reconciles an unknown blocker outcome with the same request identity",async()=>{
    let fail=true;
    const client=fakeClient({job:vi.fn(async()=>client.recordBlocker.mock.calls.length<2?scheduledJob():scheduledJob()),redeem:opened(scheduledJob()),recordBlocker:vi.fn(async()=>{if(fail)throw network();return scheduledJob({activeBlocker:blocker("PARTS_REQUIRED")});})});
    await mount(client,`#${tokenB}`,now);
    await click("막힘 기록");
    await choose("부품 필요");
    await click("막힘 기록하기");
    expect(page()).toContain("막힘 기록 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=client.recordBlocker.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
  });
  it("refreshes authoritative state after a stale visit-start conflict",async()=>{
    const client=fakeClient({redeem:opened(scheduledJob()),job:vi.fn(async()=>scheduledJob({assignmentVersion:5})),startVisit:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`,now);
    await click("방문 시작");
    await click("방문 시작 기록");
    expect(client.job).toHaveBeenCalled();
    expect(page()).toContain("최신 내용을 확인해 주세요");
    expect(button("방문 시작")).toBeDefined();
  });
});

describe("Task7 review remediation (Vendor screen)",()=>{
  const now=()=>new Date("2026-10-06T03:00:00Z");
  const apptB="18181818-1818-4818-8818-181818181818",propB="15151515-1515-4515-8515-151515151515",blockerB="19191919-1919-4919-8919-191919191919";
  const subB="12121212-1212-4212-8212-121212121212",w1="13131313-1313-4313-8313-131313131313";
  const confirmedRound={id:roundB,openedPacketRevisionId:packetB,purpose:"INITIAL" as const,status:"CONFIRMED" as const,version:3,createdAt:"2026-10-06T00:00:00.000Z"};
  const appointment={id:apptB,schedulingRoundId:roundB,packetRevisionId:packetB,proposalId:propB,availabilitySubmissionId:null,selectedWindowId:null,
    startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED" as const,status:"SCHEDULED" as const,createdAt:"2026-10-06T02:00:00.000Z"};
  const preauthorizedAppointment={...appointment,proposalId:null,availabilitySubmissionId:subB,selectedWindowId:w1,confirmationMode:"PREAUTHORIZED_ENTRY" as const};
  const scheduledJob=(changes:Partial<VendorJobDto>={}):VendorJobDto=>({...active(assignmentB,"B"),phase:"SCHEDULED",waitingOn:"VENDOR",currentRound:confirmedRound,appointment,...changes});
  const visited=(changes:Partial<VendorJobDto>={})=>scheduledJob({phase:"IN_PROGRESS",assignmentVersion:5,appointment:{...appointment,status:"OCCURRED"},...changes});
  const blocker=(code:"PARTS_REQUIRED"|"OTHER")=>({id:blockerB,code,note:null,active:true,createdAt:"2026-10-06T02:30:00.000Z",clearedAt:null});
  const opened=(value:VendorJobDto)=>vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:value}));
  async function choose(label:string){
    const input=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"],input[type="checkbox"]')).find(x=>x.closest("label")?.textContent?.includes(label));
    expect(Boolean(input),label).toBe(true);await act(async()=>{input!.click();});
  }
  async function note(value:string){
    const area=host.querySelector("textarea")!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(area,value);area.dispatchEvent(new Event("input",{bubbles:true}));});
  }
  it("keeps the scheduling turn truthful while a blocker overlays waitingOn (M1)",async()=>{
    const client=fakeClient({redeem:opened({...active(assignmentB,"B"),waitingOn:"PARTS",activeBlocker:blocker("PARTS_REQUIRED")})});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("세입자가 가능한 시간을 알려 주기를 기다리고 있습니다");
    expect(page().includes("세입자가 가능한 시간을 알려 주었습니다")).toBe(false);
  });
  it("explains a refused preauthorized visit start instead of claiming the request changed (M2)",async()=>{
    const job=scheduledJob({effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",appointment:preauthorizedAppointment});
    const client=fakeClient({redeem:opened(job),job:vi.fn(async()=>job),startVisit:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`,now);
    await click("방문 시작");
    expect(page()).toContain("동의한 시간이 지나면 방문을 시작할 수 없습니다");
    await click("방문 시작 기록");
    expect(page()).toContain("세입자가 출입에 동의한 시간이 아니거나 동의가 더 이상 유효하지 않아");
    expect(page().includes("작업 요청 내용이 바뀌었습니다")).toBe(false);
  });
  it("states the follow-up consequence and requires an explicit confirmation for FOLLOW_UP_VISIT_REQUIRED (M3)",async()=>{
    const client=fakeClient({redeem:opened(visited())});
    await mount(client,`#${tokenB}`,now);
    await click("막힘 기록");
    await choose("추가 방문 필요");
    expect(page()).toContain("추가 방문을 마치기 전에는 작업 보고를 할 수 없습니다");
    expect(button("막힘 기록하기")?.disabled).toBe(true);
    await choose("추가 방문이 필요함을 확인했습니다");
    expect(button("막힘 기록하기")?.disabled).toBe(false);
    await choose("부품 필요");
    expect(page().includes("추가 방문을 마치기 전에는")).toBe(false);
    expect(button("막힘 기록하기")?.disabled).toBe(false);
  });
  it("keeps the blocker draft after a stale record and never hides withdraw behind invisible form state (L2)",async()=>{
    let reads=0;
    const client=fakeClient({redeem:opened(scheduledJob()),job:vi.fn(async()=>++reads===1?scheduledJob({assignmentVersion:5}):scheduledJob({assignmentVersion:6,activeBlocker:blocker("OTHER")})),
      recordBlocker:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`,now);
    await click("막힘 기록");
    await choose("부품 필요");
    await note("합성 부품 대기");
    await click("막힘 기록하기");
    expect(page()).toContain("최신 내용을 확인해 주세요");
    expect(host.querySelector("textarea")?.value).toBe("합성 부품 대기");
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(x=>x.checked)?.value).toBe("PARTS_REQUIRED");
    await click("막힘 기록하기");
    expect(page()).toContain("현재 막힘");
    expect(button("작업 철회")).toBeDefined();
  });
});

describe("Task8 Vendor completion report",()=>{
  const now=()=>new Date("2026-10-06T03:00:00Z");
  const apptB="18181818-1818-4818-8818-181818181818",propB="15151515-1515-4515-8515-151515151515",reportB="22222222-3333-4444-8555-666666666666";
  const photo1="21212121-2121-4121-8121-212121212121",photo2="23232323-2323-4323-8323-232323232323";
  const confirmedRound={id:roundB,openedPacketRevisionId:packetB,purpose:"INITIAL" as const,status:"CONFIRMED" as const,version:3,createdAt:"2026-10-06T00:00:00.000Z"};
  const occurred={id:apptB,schedulingRoundId:roundB,packetRevisionId:packetB,proposalId:propB,availabilitySubmissionId:null,selectedWindowId:null,
    startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED" as const,status:"OCCURRED" as const,createdAt:"2026-10-06T02:00:00.000Z"};
  const visited=(changes:Partial<VendorJobDto>={}):VendorJobDto=>({...active(assignmentB,"B"),phase:"IN_PROGRESS",waitingOn:"VENDOR",assignmentVersion:5,currentRound:confirmedRound,appointment:occurred,...changes});
  const report={id:reportB,assignmentId:assignmentB,appointmentId:apptB,packetRevisionId:packetB,revision:1,supersedesReportId:null,workSummary:"합성 배관 교체",
    componentOrPartNote:null,completionPhotoIds:[photo1],photoOmissionReason:null,submittedAt:"2026-10-06T04:00:00.000Z"};
  const reported=()=>visited({phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",assignmentVersion:6,currentReport:report});
  const opened=(value:VendorJobDto)=>vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:value}));
  const file=(name:string)=>new File([new Uint8Array([137,80,78,71])],name,{type:"image/png"});
  async function pick(files:File[]){
    const input=host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input,"files",{value:files,configurable:true});
    await act(async()=>{input.dispatchEvent(new Event("change",{bubbles:true}));});
    await flush();
  }
  async function toggle(label:string){
    const input=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"],input[type="radio"]')).find(x=>x.closest("label")?.textContent?.includes(label));
    expect(Boolean(input),label).toBe(true);await act(async()=>{input!.click();});
  }
  async function summary(value:string){
    const area=host.querySelector<HTMLTextAreaElement>('textarea[aria-label="작업 내용 요약"]')!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(area,value);area.dispatchEvent(new Event("input",{bubbles:true}));});
  }
  it("Task9 exact correction enables only its report form and sends durable request identity",async()=>{
    const correctionId="abababab-abab-4bab-8bab-abababababab";
    const current={...reported(),waitingOn:"VENDOR",correctionRequest:{id:correctionId,completionReportId:reportB,reason:"사진 설명을 수정해 주세요"}} as VendorJobDto;
    const client=fakeClient({redeem:opened(current),job:vi.fn(async()=>current),uploadCompletionPhoto:vi.fn(async()=>({photoId:photo2,mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-06T03:00:00.000Z"}))});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("사진 설명을 수정해 주세요");expect(button("작업 철회")).toBeUndefined();
    expect(host.querySelector('textarea[aria-label="작업 내용 요약"]')).not.toBeNull();
    await pick([file("correction.png")]);
    expect(client.uploadCompletionPhoto.mock.calls[0][1].expectedCorrectionRequestId).toBe(correctionId);
    // The reused report photo starts unselected; the new upload is in the report by default (menu audit F-17).
    await toggle("작업 사진 1");await toggle("1번째 게시본");
    await summary("관리자 요청에 맞춘 설명");await click("작업 보고 제출");await click("작업 보고 제출하기");
    expect(client.submitCompletionReport.mock.calls[0][1]).toMatchObject({expectedCorrectionRequestId:correctionId,supersedesReportId:reportB,completionPhotoIds:[photo1,photo2],workSummary:"관리자 요청에 맞춘 설명"});
  });
  it("uploads each photo with its own identity and submits selected photos after acknowledging the current packet",async()=>{
    let n=0;
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>reported()),
      uploadCompletionPhoto:vi.fn(async()=>({photoId:[photo1,photo2][n++],mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-06T03:00:00.000Z"})),
      submitCompletionReport:vi.fn(async()=>report)});
    await mount(client,`#${tokenB}`,now);
    await pick([file("a.png"),file("b.png")]);
    const uploads=client.uploadCompletionPhoto.mock.calls;
    expect(uploads).toHaveLength(2);
    expect(uploads[0][0]).toBe(csrf);
    expect(uploads[0][1]).toMatchObject({expectedAssignmentVersion:5,expectedPacketRevisionId:packetB,expectedAppointmentId:apptB,expectedCorrectionRequestId:null});
    expect(uploads[0][1].clientRequestId).not.toBe(uploads[1][1].clientRequestId);
    expect(host.querySelectorAll('img[alt^="업로드한 작업 사진"]')).toHaveLength(2);
    // Both uploads start in the report (menu audit F-17); leave the second one out.
    await toggle("작업 사진 2");
    await summary("합성 배관 교체");
    expect(button("작업 보고 제출")?.disabled).toBe(true);
    await toggle("1번째 게시본");
    await click("작업 보고 제출");
    expect(client.submitCompletionReport).not.toHaveBeenCalled();
    expect(page()).toContain("관리자가 확인할 때까지 수정할 수 없습니다");
    await click("작업 보고 제출하기");
    expect(client.submitCompletionReport.mock.calls[0]).toEqual([csrf,expect.objectContaining({expectedAssignmentVersion:5,expectedPacketRevisionId:packetB,expectedAppointmentId:apptB,
      expectedCorrectionRequestId:null,supersedesReportId:null,workSummary:"합성 배관 교체",componentOrPartNote:null,completionPhotoIds:[photo1],photoOmissionReason:null})]);
    expect(page()).toContain("작업 보고를 제출했습니다");
    for(const label of ["막힘 기록","작업 철회","방문 시작"])expect(button(label),label).toBeUndefined();
  });
  it("reports with one approved omission reason instead of photos",async()=>{
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>reported()),submitCompletionReport:vi.fn(async()=>({...report,completionPhotoIds:[],photoOmissionReason:"SAFETY_OR_PRIVACY"}))});
    await mount(client,`#${tokenB}`,now);
    await toggle("안전·사생활 보호");
    await summary("합성 배관 교체");
    await toggle("1번째 게시본");
    await click("작업 보고 제출");
    await click("작업 보고 제출하기");
    expect(client.submitCompletionReport.mock.calls[0][1]).toMatchObject({completionPhotoIds:[],photoOmissionReason:"SAFETY_OR_PRIVACY"});
  });
  const includeBoxes=()=>Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter(x=>x.closest("label")?.textContent?.includes("보고에 포함"));
  it("puts newly uploaded photos in the report by default while there is room",async()=>{
    const ids=Array.from({length:6},(_,i)=>`2121212${i}-2121-4121-8121-212121212121`);let n=0;
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>visited()),
      uploadCompletionPhoto:vi.fn(async()=>({photoId:ids[n++],mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-06T03:00:00.000Z"}))});
    await mount(client,`#${tokenB}`,now);
    await pick(ids.map((_,i)=>file(`${i}.png`)));
    expect(includeBoxes().map(box=>box.checked)).toEqual([true,true,true,true,true,false]);
    expect(includeBoxes()[5].disabled).toBe(true);
  });
  it("does not put a new photo in the report after the Vendor chose to report without photos",async()=>{
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>visited())});
    await mount(client,`#${tokenB}`,now);
    await toggle("사진이 필요 없는 작업");
    await pick([file("a.png")]);
    expect(includeBoxes().map(box=>box.checked)).toEqual([false]);
  });
  it("lists what is still missing while the report cannot be submitted",async()=>{
    const client=fakeClient({redeem:opened(visited())});
    await mount(client,`#${tokenB}`,now);
    const missing=()=>Array.from(host.querySelectorAll("#vendor-completion-missing li")).map(item=>item.textContent);
    expect(missing()).toEqual(["작업 사진을 1장 이상 보고에 포함하거나, 사진 없이 보고하는 이유를 골라 주세요.","작업 내용 요약을 적어 주세요.","현재 작업 요청 내용을 확인했다고 표시해 주세요."]);
    expect(button("작업 보고 제출")?.getAttribute("aria-describedby")).toBe("vendor-completion-missing");
    await summary("합성 배관 교체");await toggle("1번째 게시본");
    expect(missing()).toEqual(["작업 사진을 1장 이상 보고에 포함하거나, 사진 없이 보고하는 이유를 골라 주세요."]);
    await toggle("사진이 필요 없는 작업");
    expect(host.querySelector("#vendor-completion-missing")).toBeNull();
    expect(button("작업 보고 제출")?.disabled).toBe(false);
    expect(button("작업 보고 제출")?.hasAttribute("aria-describedby")).toBe(false);
  });
  it("needs either a selected photo or an omission reason, a summary and the packet acknowledgment",async()=>{
    const client=fakeClient({redeem:opened(visited())});
    await mount(client,`#${tokenB}`,now);
    await summary("합성 배관 교체");
    await toggle("1번째 게시본");
    expect(button("작업 보고 제출")?.disabled).toBe(true);
    await toggle("사진이 필요 없는 작업");
    expect(button("작업 보고 제출")?.disabled).toBe(false);
  });
  it("reconciles an unknown upload outcome with the same request identity and the same file",async()=>{
    let fail=true;
    const client=fakeClient({redeem:opened(visited()),job:async()=>visited(),uploadCompletionPhoto:vi.fn(async()=>{if(fail)throw network();return {photoId:photo1,mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-06T03:00:00.000Z"};})});
    await mount(client,`#${tokenB}`,now);
    const picked=file("a.png");
    await pick([picked]);
    expect(page()).toContain("사진 업로드 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 사진 업로드 다시 확인");
    const calls=client.uploadCompletionPhoto.mock.calls;
    expect(calls).toHaveLength(2);
    expect(client.job).toHaveBeenCalledTimes(1);
    expect(client.job.mock.invocationCallOrder[0]).toBeLessThan(client.uploadCompletionPhoto.mock.invocationCallOrder[1]);
    expect(calls[1][1].clientRequestId).toBe(calls[0][1].clientRequestId);
    expect(calls[1][1]).toEqual(calls[0][1]);
    expect(calls[1][2]).toBe(picked);
    expect(host.querySelectorAll('img[alt^="업로드한 작업 사진"]')).toHaveLength(1);
  });
  it("T11-U01 keeps an uncertain upload without retry when authoritative job read fails",async()=>{
    const client=fakeClient({redeem:opened(visited()),job:async()=>{throw network();},uploadCompletionPhoto:async()=>{throw network();}});
    await mount(client,`#${tokenB}`,now);await pick([file("a.png")]);
    await click("같은 요청으로 사진 업로드 다시 확인");
    expect(client.job).toHaveBeenCalledTimes(1);expect(client.uploadCompletionPhoto).toHaveBeenCalledTimes(1);
    expect(page()).toContain("사진 업로드 결과를 확인하지 못했습니다");
  });
  it.each([{assignmentId:assignmentA},{assignmentVersion:6},{currentPacket:{...visited().currentPacket!,id:assignmentA}},{appointment:{...occurred,id:apptB.replace("1","2")}},{correctionRequest:{id:assignmentA,completionReportId:reportB,reason:"합성 정정"}}])("T11-U02 does not resend a retained upload after its authoritative context changed %s",async changes=>{
    const client=fakeClient({redeem:opened(visited()),job:async()=>visited(changes),uploadCompletionPhoto:async()=>{throw network();}});
    await mount(client,`#${tokenB}`,now);await pick([file("a.png")]);await click("같은 요청으로 사진 업로드 다시 확인");
    expect(client.uploadCompletionPhoto).toHaveBeenCalledTimes(1);expect(page()).toContain("최신 내용을 확인해 주세요");
  });
  it("shows COMPLETION_REPORTED read-only without scheduling, visit, blocker or withdraw actions",async()=>{
    const client=fakeClient({redeem:opened(reported())});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("작업 보고를 제출했습니다");
    expect(page()).toContain("합성 배관 교체");
    expect(host.querySelector('input[type="file"]')).toBeNull();
    for(const label of ["막힘 기록","작업 철회","방문 시작","방문 시간 제안하기","작업 보고 제출"])expect(button(label),label).toBeUndefined();
  });
  it("offers no completion report while a blocker or an OPEN round exists",async()=>{
    const blocked=fakeClient({redeem:opened(visited({activeBlocker:{id:"24242424-2424-4424-8424-242424242424",code:"OTHER",note:null,active:true,createdAt:"2026-10-06T02:30:00.000Z",clearedAt:null}}))});
    await mount(blocked,`#${tokenB}`,now);
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(button("작업 보고 제출")).toBeUndefined();
  });
});

describe("Task8 review remediation (Vendor screen)",()=>{
  const now=()=>new Date("2026-10-06T03:00:00Z");
  const apptB="18181818-1818-4818-8818-181818181818",apptC="26262626-2626-4626-8626-262626262626",propB="15151515-1515-4515-8515-151515151515";
  const packetC="27272727-2727-4727-8727-272727272727";
  const photo1="21212121-2121-4121-8121-212121212121";
  const confirmedRound={id:roundB,openedPacketRevisionId:packetB,purpose:"INITIAL" as const,status:"CONFIRMED" as const,version:3,createdAt:"2026-10-06T00:00:00.000Z"};
  const occurred={id:apptB,schedulingRoundId:roundB,packetRevisionId:packetB,proposalId:propB,availabilitySubmissionId:null,selectedWindowId:null,
    startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED" as const,status:"OCCURRED" as const,createdAt:"2026-10-06T02:00:00.000Z"};
  const visited=(changes:Partial<VendorJobDto>={}):VendorJobDto=>({...active(assignmentB,"B"),phase:"IN_PROGRESS",waitingOn:"VENDOR",assignmentVersion:5,currentRound:confirmedRound,appointment:occurred,...changes});
  const republished=()=>visited({assignmentVersion:6,currentPacket:{...visited().currentPacket!,id:packetC,revision:2}});
  const opened=(value:VendorJobDto)=>vi.fn(async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:value}));
  const file=(name:string)=>new File([new Uint8Array([137,80,78,71])],name,{type:"image/png"});
  const photoDto=(id:string)=>({photoId:id,mime:"image/png",byteSize:3,width:1,height:1,createdAt:"2026-10-06T03:00:00.000Z"});
  async function pick(files:File[]){
    const input=host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input,"files",{value:files,configurable:true});
    await act(async()=>{input.dispatchEvent(new Event("change",{bubbles:true}));});
    await flush();
  }
  async function toggle(label:string){
    const input=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"],input[type="radio"]')).find(x=>x.closest("label")?.textContent?.includes(label));
    expect(Boolean(input),label).toBe(true);await act(async()=>{input!.click();});
  }
  async function summary(value:string){
    const area=host.querySelector<HTMLTextAreaElement>('textarea[aria-label="작업 내용 요약"]')!;
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!;
    await act(async()=>{setter.call(area,value);area.dispatchEvent(new Event("input",{bubbles:true}));});
  }
  const ackBox=()=>Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(x=>x.closest("label")?.textContent?.includes("번째 게시본"));
  it("ties the packet acknowledgment to the exact packet revision across a refresh (M3)",async()=>{
    let n=0;
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>republished()),
      uploadCompletionPhoto:vi.fn(async()=>{if(n++===0)throw http(409,"STATE_CONFLICT");return photoDto(photo1);})});
    await mount(client,`#${tokenB}`,now);
    await toggle("사진이 필요 없는 작업");
    await summary("합성 배관 교체");
    await toggle("1번째 게시본");
    expect(ackBox()?.checked).toBe(true);
    await pick([file("a.png")]);
    expect(page()).toContain("2번째 게시본");
    expect(ackBox()?.checked).toBe(false);
    expect(button("작업 보고 제출")?.disabled).toBe(true);
    await toggle("2번째 게시본");
    expect(button("작업 보고 제출")?.disabled).toBe(false);
  });
  it("keeps staged photos with the visit they were uploaded for (L2)",async()=>{
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>visited({assignmentVersion:8,appointment:{...occurred,id:apptC}})),
      uploadCompletionPhoto:vi.fn(async()=>photoDto(photo1)),submitCompletionReport:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(client,`#${tokenB}`,now);
    await pick([file("a.png")]);
    expect(host.querySelectorAll('img[alt^="업로드한 작업 사진"]')).toHaveLength(1);
    // The upload is already in the report by default (menu audit F-17).
    await summary("합성 배관 교체");
    await toggle("1번째 게시본");
    await click("작업 보고 제출");
    await click("작업 보고 제출하기");
    expect(host.querySelectorAll('img[alt^="업로드한 작업 사진"]')).toHaveLength(0);
  });
  it("uploads only the remaining per-visit capacity and explains a full visit (L3)",async()=>{
    let n=0;
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>visited()),
      uploadCompletionPhoto:vi.fn(async()=>{n++;if(n>10)throw http(409,"STATE_CONFLICT");return photoDto(`21212121-2121-4121-8121-${String(n).padStart(12,"0")}`);})});
    await mount(client,`#${tokenB}`,now);
    await pick(Array.from({length:12},(_,i)=>file(`p${i}.png`)));
    expect(client.uploadCompletionPhoto).toHaveBeenCalledTimes(10);
    expect(page()).toContain("사진은 한 방문에 10장까지 올릴 수 있습니다");
    await act(async()=>root?.unmount());root=undefined;host.remove();
    const full=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>visited()),uploadCompletionPhoto:vi.fn(async()=>{throw http(409,"STATE_CONFLICT");})});
    await mount(full,`#${tokenB}`,now);
    await pick([file("a.png")]);
    expect(page()).toContain("이 방문에는 사진을 더 올릴 수 없습니다");
    expect(page().includes("작업 요청 내용이 바뀌었습니다")).toBe(false);
  });
  it("uses the preferred work-report terms without overstating what follows (L4)",async()=>{
    const client=fakeClient({redeem:opened(visited())});
    await mount(client,`#${tokenB}`,now);
    expect(page()).toContain("작업 보고");
    for(const phrase of ["완료 보고","처리가 마무리됩니다","업체 완료","수리 완료"])expect(page().includes(phrase),phrase).toBe(false);
  });
  it("reconciles an unknown report outcome with the same request identity (L5)",async()=>{
    let fail=true;
    const report={id:"22222222-3333-4444-8555-666666666666",assignmentId:assignmentB,appointmentId:apptB,packetRevisionId:packetB,revision:1,supersedesReportId:null,
      workSummary:"합성 배관 교체",componentOrPartNote:null,completionPhotoIds:[] as string[],photoOmissionReason:"NOT_APPLICABLE" as const,submittedAt:"2026-10-06T04:00:00.000Z"};
    const client=fakeClient({redeem:opened(visited()),job:vi.fn(async()=>client.submitCompletionReport.mock.calls.length<2?visited():visited({phase:"COMPLETION_REPORTED",waitingOn:"MANAGER",assignmentVersion:6,currentReport:report})),
      submitCompletionReport:vi.fn(async()=>{if(fail)throw network();return report;})});
    await mount(client,`#${tokenB}`,now);
    await toggle("사진이 필요 없는 작업");
    await summary("합성 배관 교체");
    await toggle("1번째 게시본");
    await click("작업 보고 제출");
    await click("작업 보고 제출하기");
    expect(page()).toContain("작업 보고 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=client.submitCompletionReport.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
    expect(page()).toContain("작업 보고를 제출했습니다");
  });
  it("offers no work report while a FOLLOW_UP round is OPEN (L5)",async()=>{
    const client=fakeClient({redeem:opened(visited({phase:"SCHEDULING",waitingOn:"TENANT",currentRound:{...confirmedRound,purpose:"FOLLOW_UP",status:"OPEN",version:1}}))});
    await mount(client,`#${tokenB}`,now);
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(button("작업 보고 제출")).toBeUndefined();
  });
});

describe("WC-M02 all non-upload Vendor command families",()=>{
  const now=()=>new Date("2026-10-06T03:00:00Z");
  const windowId="13131313-1313-4313-8313-131313131313",submissionId="12121212-1212-4212-8212-121212121212",appointmentId="18181818-1818-4818-8818-181818181818";
  const available={id:submissionId,windows:[{id:windowId,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T07:00:00Z"}],authorizedWindowIds:[] as string[],createdAt:"2026-10-06T02:00:00Z"};
  const appointment={id:appointmentId,schedulingRoundId:roundB,packetRevisionId:packetB,proposalId:null,availabilitySubmissionId:submissionId,selectedWindowId:windowId,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED" as const,status:"SCHEDULED" as const,createdAt:"2026-10-06T02:00:00Z"};
  async function choose(value:string){const el=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"],input[type="checkbox"]')).find(x=>x.value===value||x.closest("label")?.textContent?.includes(value))!;expect(Boolean(el),value).toBe(true);await act(async()=>el.click());}
  async function input(selector:string,value:string,index=0){const el=host.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>(selector)[index]!;const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,"value")!.set!.call(el,value);el.dispatchEvent(new Event("input",{bubbles:true}));});}
  const families=["accept","decline","withdraw","proposeSlots","selectPreauthorizedSlot","reschedule","startVisit","recordBlocker","clearBlocker","submitCompletionReport"] as const;
  for(const family of families)for(const outcome of ["same","failed","changed"] as const)it(`${family} reads current authority before replay: ${outcome}`,async()=>{
    let initial=family==="accept"||family==="decline"?job(assignmentB,"B"):active(assignmentB,"B");
    if(family==="proposeSlots"||family==="selectPreauthorizedSlot")initial={...initial,waitingOn:"VENDOR",availability:family==="selectPreauthorizedSlot"?{...available,authorizedWindowIds:[windowId]}:available,effectiveMode:family==="selectPreauthorizedSlot"?"PREAUTHORIZED_ENTRY_WINDOW":"RESIDENT_CONFIRMATION_REQUIRED"};
    if(["reschedule","startVisit","clearBlocker","submitCompletionReport"].includes(family))initial={...initial,phase:"SCHEDULED",currentRound:{...initial.currentRound!,status:"CONFIRMED",version:3},appointment};
    if(family==="submitCompletionReport"||family==="clearBlocker")initial={...initial,phase:"IN_PROGRESS",appointment:{...appointment,status:"OCCURRED"}};
    if(family==="clearBlocker")initial={...initial,waitingOn:"PARTS",activeBlocker:{id:photoB,code:"PARTS_REQUIRED",note:null,active:true,createdAt:"2026-10-06T02:30:00Z",clearedAt:null}};
    const order:string[]=[];let posts=0,reads=0;
    const latest={...initial,assignmentVersion:initial.assignmentVersion+2,currentPacket:{...initial.currentPacket!,id:photoB,revision:2,workSummary:"권한 확인 후 최신 설명"}};
    const client=fakeClient({redeem:async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:initial}),job:async()=>{order.push("GET");reads++;if(outcome==="failed")throw network();return outcome==="changed"?{...latest,assignmentVersion:initial.assignmentVersion+1}:reads>1?latest:initial;},[family]:async()=>{order.push("POST");if(++posts===1)throw network();return initial;}});
    await mount(client,`#${tokenB}`,now);
    if(family==="accept")await click("작업 수락");
    if(family==="decline"){await click("작업 거절");await choose("OTHER");await click("거절 내용 확인");await click("거절하기");}
    if(family==="withdraw"){await click("작업 철회");await click("철회 내용 확인");await click("철회하기");}
    if(family==="proposeSlots"||family==="selectPreauthorizedSlot"){
      if(family==="selectPreauthorizedSlot")await choose("10월 7일(수) 오후 2:00–4:00");
      await input('input[type="date"]',"2026-10-07");await input('input[type="time"]',"14:00",0);await input('input[type="time"]',"15:00",1);
      await click(family==="proposeSlots"?"방문 시간 제안하기":"동의된 시간 안에서 방문 확정");
    }
    if(family==="reschedule"){await click("방문 일정 변경");await click("일정 변경하기");}
    if(family==="startVisit"){await click("방문 시작");await click("방문 시작 기록");}
    if(family==="recordBlocker"){await click("막힘 기록");await choose("PARTS_REQUIRED");await click("막힘 기록하기");}
    if(family==="clearBlocker"){await click("막힘 해제");await click("막힘 해제 기록");}
    if(family==="submitCompletionReport"){await choose("사진이 필요 없는 작업");await input('textarea[aria-label="작업 내용 요약"]',"합성 점검");await choose("1번째 게시본");await click("작업 보고 제출");await click("작업 보고 제출하기");}
    expect(posts).toBe(1);order.length=0;
    await click(family==="accept"?"같은 요청으로 수락 결과 확인":"같은 요청으로 결과 확인");
    expect(order[0]).toBe("GET");
    if(outcome==="same"){
      expect(order).toEqual(["GET","POST","GET"]);expect(client[family].mock.calls[1]).toEqual(client[family].mock.calls[0]);expect(page()).toContain("권한 확인 후 최신 설명");
    }else{expect(order).toEqual(["GET"]);expect(posts).toBe(1);if(outcome==="changed")expect(page()).toContain("권한 확인 후 최신 설명");}
  });
  it("LOW-2 a changed-context blocker reconcile keeps the owned completion report draft",async()=>{
    const base=active(assignmentB,"B");
    const initial={...base,phase:"IN_PROGRESS" as const,currentRound:{...base.currentRound!,status:"CONFIRMED" as const,version:3},appointment:{...appointment,status:"OCCURRED" as const}};
    // The authoritative state changes only after the uncertain blocker command was sent.
    const client=fakeClient({redeem:async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:initial}),
      job:async()=>client.recordBlocker.mock.calls.length>0?{...initial,assignmentVersion:initial.assignmentVersion+1}:initial,recordBlocker:async()=>{throw network();}});
    await mount(client,`#${tokenB}`,now);
    await input('textarea[aria-label="작업 내용 요약"]',"보존할 작업 보고 초안");
    await click("막힘 기록");await choose("PARTS_REQUIRED");await click("막힘 기록하기");
    await click("같은 요청으로 결과 확인");
    expect(page()).toContain("이전 요청의 성공 여부는 확정하지 않습니다");
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="작업 내용 요약"]')?.value).toBe("보존할 작업 보고 초안");
    expect(client.recordBlocker).toHaveBeenCalledTimes(1);
  });
});

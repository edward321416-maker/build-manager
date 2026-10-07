// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { ApiClientError,type VendorJobClient } from "@build-manager/api-client";
import type { VendorAcceptCommand,VendorDeclineCommand,VendorJobDto,VendorWithdrawCommand } from "@build-manager/api-contracts";
import { VendorJobScreen } from "./vendor-job-screen";

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
type Overrides={[K in "redeem"|"session"|"job"|"decline"|"logout"|"accept"|"withdraw"]?:(...args:Parameters<VendorJobClient[K]>)=>Promise<unknown>};
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
    sourcePhotoPath:(id:string)=>`/api/v2/vendor/job/source-photos/${id}`,
  };
}
type FakeClient=ReturnType<typeof fakeClient>;
let root:Root|undefined,host:HTMLDivElement;
beforeEach(()=>{window.sessionStorage.clear();window.history.replaceState(null,"","/vendor/job");});
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.restoreAllMocks();});
async function mount(client:FakeClient,hash=""){
  window.history.replaceState(null,"",`/vendor/job${hash}`);
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<VendorJobScreen client={client as unknown as VendorJobClient}/>);});
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
    const client=fakeClient({accept:vi.fn(async()=>{if(fail)throw network();return active(assignmentB,"B");})});
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
    const client=fakeClient({decline:vi.fn(async()=>{if(fail)throw network();return {...job(assignmentB,"B"),status:"ENDED" as const,endReason:"DECLINED" as const,phase:"ENDED" as const,assignmentVersion:4};})});
    await mount(client,`#${tokenB}`);
    await chooseDecline();
    await click("거절하기");
    expect(page()).toContain("거절 결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=client.decline.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids[0]).toBe(ids[1]);
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

// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { ApiClientError,type VendorJobClient } from "@build-manager/api-client";
import type { VendorDeclineCommand,VendorJobDto } from "@build-manager/api-contracts";
import { VendorJobScreen } from "./vendor-job-screen";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const tokenB="B".repeat(42)+"x";
const tokenC="C".repeat(42)+"y";
const csrf="S".repeat(42)+"z";
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
    currentRound:null,appointment:null,activeBlocker:null,currentReport:null};
}
const network=()=>new ApiClientError("NETWORK_ERROR","API 요청을 전송하지 못했습니다.");
const http=(status:number,code:string)=>new ApiClientError(code,"요청을 처리하지 못했습니다.",{status});
type Overrides={[K in "redeem"|"session"|"job"|"decline"|"logout"]?:(...args:Parameters<VendorJobClient[K]>)=>Promise<unknown>};
function fakeClient(overrides:Overrides={}){
  const redeemed=async()=>({session:{assignmentId:assignmentB,expiresAt,csrf},job:job(assignmentB,"B")}) as unknown;
  return {
    redeem:vi.fn<(token:string,input:{clientRequestId:string})=>Promise<unknown>>(overrides.redeem??redeemed),
    session:vi.fn<()=>Promise<unknown>>(overrides.session??(async()=>({assignmentId:assignmentA,expiresAt,csrf}))),
    job:vi.fn<()=>Promise<unknown>>(overrides.job??(async()=>job(assignmentA,"A"))),
    decline:vi.fn<(csrf:string,input:VendorDeclineCommand)=>Promise<unknown>>(overrides.decline??(async()=>({...job(assignmentB,"B"),status:"ENDED",endReason:"DECLINED",phase:"ENDED",assignmentVersion:4}))),
    logout:vi.fn<(csrf:string,input:{clientRequestId:string})=>Promise<unknown>>(overrides.logout??(async()=>({revoked:true}))),
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
async function click(label:string){expect(Boolean(button(label)),label).toBe(true);await act(async()=>{button(label)!.click();});await act(async()=>{await Promise.resolve();});}
const tokenFree=()=>![tokenB,tokenC,csrf].some(raw=>markup().includes(raw));

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

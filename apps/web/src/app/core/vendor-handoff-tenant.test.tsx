// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,describe,expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreTicketDto, CoreTicketOutcome, TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { VendorHandoffTenant } from "./vendor-handoff-tenant";
import { TicketOutcome } from "./ticket-outcome";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const ticketId="11111111-1111-4111-8111-111111111111",packetId="22222222-2222-4222-8222-222222222222",roundId="33333333-3333-4333-8333-333333333333";
const subId="44444444-4444-4444-8444-444444444444",w1="55555555-5555-4555-8555-555555555555",w2="66666666-6666-4666-8666-666666666666";
const propId="77777777-7777-4777-8777-777777777777",s1="88888888-8888-4888-8888-888888888888",s2="99999999-9999-4999-8999-999999999999",apptId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now=()=>new Date("2026-10-06T03:00:00Z");
const round={id:roundId,openedPacketRevisionId:packetId,purpose:"INITIAL" as const,status:"OPEN" as const,version:2,createdAt:"2026-10-06T00:00:00Z"};
function dto(changes:Partial<TenantVendorSchedulingDto>={}):TenantVendorSchedulingDto{
  return {ticketId,assignmentVersion:4,packetRevisionId:packetId,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",phase:"SCHEDULING",waitingOn:"TENANT",
    currentRound:round,appointment:null,accessPolicy:"TENANT_PRESENT_REQUIRED",availability:null,proposal:null,...changes};
}
const availability={id:subId,windows:[{id:w1,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T07:00:00Z"},{id:w2,startAt:"2026-10-08T01:00:00Z",endAt:"2026-10-08T04:00:00Z"}],authorizedWindowIds:[],createdAt:"2026-10-06T01:00:00Z"};
const scheduled=dto({phase:"SCHEDULED",waitingOn:"VENDOR",currentRound:{...round,status:"CONFIRMED",version:3},appointment:{id:apptId,schedulingRoundId:roundId,packetRevisionId:packetId,proposalId:propId,
  availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00Z"}});
const http=(status:number,code:string)=>new ApiClientError(code,"요청을 처리하지 못했습니다.",{status});
const network=()=>new ApiClientError("NETWORK_ERROR","API 요청을 전송하지 못했습니다.");
type Override=Partial<Record<"readScheduling"|"submitAvailability"|"authorizeEntry"|"confirmSlot"|"tenantReschedule",(...args:unknown[])=>Promise<unknown>>>;
function fake(initial:TenantVendorSchedulingDto|Error,overrides:Override={}){
  const vendorHandoff={
    readScheduling:vi.fn<(id:string)=>Promise<unknown>>(overrides.readScheduling??(async()=>{if(initial instanceof Error)throw initial;return initial;})),
    submitAvailability:vi.fn<(id:string,input:Record<string,unknown>)=>Promise<unknown>>(overrides.submitAvailability??(async()=>dto({availability}))),
    authorizeEntry:vi.fn<(id:string,input:Record<string,unknown>)=>Promise<unknown>>(overrides.authorizeEntry??(async()=>dto({availability:{...availability,authorizedWindowIds:[w1]},effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",waitingOn:"VENDOR",accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED"}))),
    confirmSlot:vi.fn<(id:string,input:Record<string,unknown>)=>Promise<unknown>>(overrides.confirmSlot??(async()=>scheduled)),
    tenantReschedule:vi.fn<(id:string,input:Record<string,unknown>)=>Promise<unknown>>(overrides.tenantReschedule??(async()=>dto({currentRound:{...round,purpose:"RESCHEDULE",version:1}}))),
  };
  return {vendorHandoff,client:{vendorHandoff} as unknown as CoreFlowClient};
}
let root:Root|undefined,host:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();});
async function flush(){await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});}
async function mount(client:CoreFlowClient){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<VendorHandoffTenant client={client} ticketId={ticketId} revision={0} now={now}/>);});
  await flush();
}
const page=()=>host.textContent??"";
const zone=()=>host.querySelector("[data-task-zone]");
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
async function click(label:string){expect(Boolean(button(label)),label).toBe(true);await act(async()=>{button(label)!.click();});await flush();}
async function type(selector:string,value:string,index=0){
  const element=host.querySelectorAll<HTMLInputElement>(selector)[index]!;
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;
  await act(async()=>{setter.call(element,value);element.dispatchEvent(new Event("input",{bubbles:true}));});
}
async function check(label:string){
  const input=Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"],input[type="radio"]')).find(x=>x.closest("label")?.textContent?.includes(label));
  expect(Boolean(input),label).toBe(true);await act(async()=>{input!.click();});
}
const forbidden=["상시 출입 허용","언제든 출입 허용","자동 출입 허용","알림을 보냈습니다","수리 완료","업체 완료"];

describe("Task10 mounted Tenant outcome after Vendor closeout",()=>{
  async function closedOutcome(initial:CoreTicketOutcome["kind"]="UNCONFIRMED",followUpTicketId:string|null=null){
    const f=fake(http(404,"NOT_FOUND"));
    let outcome:CoreTicketOutcome={ticketId,kind:initial,assertedAt:initial==="UNCONFIRMED"?null:"2026-10-08T00:00:00Z",followUpTicketId};
    const confirmResolved=vi.fn<(id:string,input:{clientRequestId:string})=>Promise<CoreTicketOutcome>>(async()=>{outcome={...outcome,kind:"RESOLVED",assertedAt:"2026-10-08T01:00:00Z"};return outcome;}),onFollowUp=vi.fn(),onOpen=vi.fn();
    const client={...f.client,outcome:{source:vi.fn(async()=>({sourceTicketId:null})),read:vi.fn(async()=>outcome),confirmResolved}} as unknown as CoreFlowClient;
    const completed={ticketId,workStatus:"COMPLETED"} as CoreTicketDto;
    host=document.createElement("div");document.body.append(host);root=createRoot(host);
    await act(async()=>root!.render(<><VendorHandoffTenant client={client} ticketId={ticketId} revision={0} now={now}/><TicketOutcome client={client} ticket={completed} tenant revision={0} onFollowUp={onFollowUp} onOpen={onOpen}/></>));await flush();
    return {confirmResolved,onFollowUp,onOpen,vendorHandoff:f.vendorHandoff};
  }
  it("T10-U01 closeout exposes the unchanged RESOLVED and fresh-follow-up actions; resolving never edits Vendor state",async()=>{
    const s=await closedOutcome();
    expect(page()).toContain("처리 결과는 어땠나요?");expect(Boolean(button("해결됐어요"))).toBe(true);expect(Boolean(button("아직 문제가 있어요"))).toBe(true);expect(Boolean(button("다시 문제가 생겼어요"))).toBe(true);
    await click("아직 문제가 있어요");expect(s.onFollowUp).toHaveBeenLastCalledWith("UNRESOLVED");
    await click("다시 문제가 생겼어요");expect(s.onFollowUp).toHaveBeenLastCalledWith("RECURRENCE_CLAIM");
    await click("해결됐어요");expect(s.confirmResolved).toHaveBeenCalledTimes(1);expect(s.confirmResolved.mock.calls[0][0]).toBe(ticketId);
    expect(Boolean(button("해결됐어요"))).toBe(false);expect(Boolean(button("아직 문제가 있어요"))).toBe(false);expect(Boolean(button("다시 문제가 생겼어요"))).toBe(true);
    expect(host.querySelector("[data-task-zone]")).toBeNull();expect(host.innerHTML).not.toMatch(/vendorLabel|completionPhotoIds|assignmentHistory|T10_VENDOR_REPORT_PRIVATE/);
    for(const mutation of [s.vendorHandoff.submitAvailability,s.vendorHandoff.authorizeEntry,s.vendorHandoff.confirmSlot,s.vendorHandoff.tenantReschedule])expect(mutation).not.toHaveBeenCalled();
  });
  it.each(["UNRESOLVED","RECURRENCE_CLAIM"] as const)("T10-U02 %s opens the new linked ticket without offering source reopening",async kind=>{
    const target="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",s=await closedOutcome(kind,target);
    await click("후속 접수 보기");expect(s.onOpen).toHaveBeenCalledWith(target);expect(s.confirmResolved).not.toHaveBeenCalled();expect(s.onFollowUp).not.toHaveBeenCalled();
    expect(Boolean(button("해결됐어요"))).toBe(false);expect(Boolean(button("아직 문제가 있어요"))).toBe(false);expect(Boolean(button("다시 문제가 생겼어요"))).toBe(false);
  });
});

describe("Tenant Vendor scheduling task zone",()=>{
  it("renders nothing when the ticket has no current Vendor scheduling",async()=>{
    const f=fake(http(404,"NOT_FOUND"));
    await mount(f.client);
    expect(host.textContent).toBe("");
  });
  it("renders no Vendor scheduling surface before the Vendor accepted (no round yet)",async()=>{
    const f=fake(dto({phase:"OFFERED",waitingOn:"VENDOR",currentRound:null}));
    await mount(f.client);
    expect(host.querySelector("section")).toBeNull();
  });
  it("shows the confirmed Appointment outside the task zone in Seoul time without Vendor identity",async()=>{
    const f=fake(scheduled);
    await mount(f.client);
    const appointment=host.querySelector("[data-current-appointment]")!;
    expect(appointment.textContent).toContain("10월 7일(수) 오후 2:00–3:00");
    expect(zone()?.contains(appointment)??false).toBe(false);
    expect(page().includes("합성 업체")).toBe(false);
  });
  it("submits availability as Seoul instants with the current guards",async()=>{
    const f=fake(dto());
    await mount(f.client);
    expect(zone()?.textContent).toContain("방문 가능한 시간");
    await type('input[type="date"]',"2026-10-10");
    await type('input[type="time"]',"10:00",0);
    await type('input[type="time"]',"12:30",1);
    await click("가능한 시간 보내기");
    const [id,input]=f.vendorHandoff.submitAvailability.mock.calls[0];
    expect(id).toBe(ticketId);
    expect(input).toMatchObject({expectedAssignmentVersion:4,expectedRoundVersion:2,expectedPacketRevisionId:packetId,windows:[{startAt:"2026-10-10T01:00:00.000Z",endAt:"2026-10-10T03:30:00.000Z"}]});
    expect(page().includes("자동")).toBe(false);
  });
  it("keeps unattended-entry consent OFF by default and confirms the exact selected windows separately",async()=>{
    const f=fake(dto({accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",availability,waitingOn:"VENDOR"}));
    await mount(f.client);
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every(x=>!x.checked)).toBe(true);
    expect(f.vendorHandoff.authorizeEntry).not.toHaveBeenCalled();
    await check("10월 7일(수) 오후 2:00–4:00");
    await click("선택한 시간 동의 확인");
    expect(page()).toContain("선택한 시간에만 세입자 없이 출입할 수 있습니다");
    expect(page()).toContain("10월 7일(수) 오후 2:00–4:00");
    expect(f.vendorHandoff.authorizeEntry).not.toHaveBeenCalled();
    await click("동의하기");
    expect(f.vendorHandoff.authorizeEntry.mock.calls[0][1]).toMatchObject({availabilitySubmissionId:subId,selectedWindowIds:[w1],expectedRoundVersion:2});
    for(const phrase of forbidden)expect(page().includes(phrase),phrase).toBe(false);
  });
  it("never offers unattended-entry consent when the access policy requires the Tenant present",async()=>{
    const f=fake(dto({availability,waitingOn:"VENDOR"}));
    await mount(f.client);
    expect(page().includes("세입자 없이 출입")).toBe(false);
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
  it("confirms exactly one current, non-expired proposal slot",async()=>{
    const proposal={id:propId,slots:[{id:s1,startAt:"2026-10-06T01:00:00Z",endAt:"2026-10-06T02:00:00Z"},{id:s2,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z"}],createdAt:"2026-10-06T00:30:00Z"};
    const f=fake(dto({availability,proposal}));
    await mount(f.client);
    expect(page().includes("10월 6일(화) 오전 10:00–11:00")).toBe(false);
    await check("10월 7일(수) 오후 2:00–3:00");
    await click("이 시간으로 확정");
    expect(f.vendorHandoff.confirmSlot.mock.calls[0][1]).toMatchObject({proposalId:propId,selectedSlotId:s2,expectedRoundVersion:2});
    expect(host.querySelector("[data-current-appointment]")?.textContent).toContain("10월 7일(수) 오후 2:00–3:00");
  });
  it("asks for new availability when every proposed slot has expired",async()=>{
    const proposal={id:propId,slots:[{id:s1,startAt:"2026-10-06T01:00:00Z",endAt:"2026-10-06T02:00:00Z"}],createdAt:"2026-10-06T00:30:00Z"};
    const f=fake(dto({availability,proposal}));
    await mount(f.client);
    expect(button("이 시간으로 확정")).toBeUndefined();
    expect(zone()?.textContent).toContain("제안된 시간이 모두 지났습니다");
    expect(button("가능한 시간 보내기")).toBeDefined();
  });
  it("requests a RESCHEDULE of a future Appointment only after confirmation",async()=>{
    const f=fake(scheduled);
    await mount(f.client);
    await click("방문 일정 변경");
    expect(f.vendorHandoff.tenantReschedule).not.toHaveBeenCalled();
    expect(page()).toContain("기존 방문 일정은 취소되고");
    expect(button("돌아가기")).toBeDefined();
    expect(button("취소")).toBeUndefined();
    await click("일정 변경하기");
    expect(f.vendorHandoff.tenantReschedule.mock.calls[0][1]).toMatchObject({expectedAppointmentId:apptId,expectedRoundVersion:3,expectedAssignmentVersion:4});
  });
  it("reconciles an unknown outcome with the same request identity",async()=>{
    let fail=true;
    const f=fake(dto(),{submitAvailability:async()=>{if(fail)throw network();return dto({availability});}});
    await mount(f.client);
    await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);
    await click("가능한 시간 보내기");
    expect(page()).toContain("결과를 확인하지 못했습니다");
    fail=false;
    await click("같은 요청으로 결과 확인");
    const ids=f.vendorHandoff.submitAvailability.mock.calls.map(c=>c[1].clientRequestId);
    expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
  });
  it("refreshes authoritative state and keeps the draft after a stale conflict",async()=>{
    const f=fake(dto(),{submitAvailability:async()=>{throw http(409,"STATE_CONFLICT");}});
    await mount(f.client);
    await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);
    await click("가능한 시간 보내기");
    expect(f.vendorHandoff.readScheduling).toHaveBeenCalledTimes(2);
    expect(page()).toContain("최신 일정을 확인해 주세요");
    expect(host.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe("2026-10-10");
  });
  it("rejects an impossible or past entry locally without sending",async()=>{
    const f=fake(dto());
    await mount(f.client);
    await type('input[type="date"]',"2026-10-01");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);
    await click("가능한 시간 보내기");
    expect(f.vendorHandoff.submitAvailability).not.toHaveBeenCalled();
    expect(page()).toContain("지난 시간은 선택할 수 없습니다");
  });
});

describe("Task6 review remediation (Tenant)",()=>{
  const w3="cccccccc-cccc-4ccc-8ccc-cccccccccccc",subB="dddddddd-dddd-4ddd-8ddd-dddddddddddd",s3="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",appt2="ffffffff-ffff-4fff-8fff-ffffffffffff";
  const preauth=(changes:Partial<TenantVendorSchedulingDto>={})=>dto({accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",availability,waitingOn:"VENDOR",...changes});
  const confirmGroup=()=>host.querySelector('[aria-label="출입 동의 확인"]')?.textContent??"";
  it("confirms and sends only currently selectable consent windows, also after a stale conflict (M1, M3)",async()=>{
    let reads=0;
    const replaced=preauth({availability:{id:subB,windows:[{id:w3,startAt:"2026-10-09T01:00:00Z",endAt:"2026-10-09T03:00:00Z"}],authorizedWindowIds:[],createdAt:"2026-10-06T02:30:00Z"}});
    let conflict=true;
    const f=fake(preauth(),{readScheduling:async()=>++reads===1?preauth():replaced,
      authorizeEntry:async()=>{if(conflict){conflict=false;throw http(409,"STATE_CONFLICT");}return replaced;}});
    await mount(f.client);
    await check("10월 7일(수) 오후 2:00–4:00");
    await click("선택한 시간 동의 확인");
    expect(confirmGroup()).toContain("10월 7일(수) 오후 2:00–4:00");
    expect(confirmGroup().includes("10월 8일(목)")).toBe(false);
    expect(confirmGroup()).toContain("따로 다시 확인을 요청하지 않습니다");
    await click("동의하기");
    expect(page()).toContain("최신 일정을 확인해 주세요");
    expect(Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every(x=>!x.checked)).toBe(true);
    expect(button("선택한 시간 동의 확인")?.disabled).toBe(true);
    await check("10월 9일(금) 오전 10:00–오후 12:00");
    await click("선택한 시간 동의 확인");
    expect(confirmGroup()).toContain("10월 9일(금) 오전 10:00–오후 12:00");
    expect(confirmGroup().includes("10월 7일(수)")).toBe(false);
    await click("동의하기");
    expect(f.vendorHandoff.authorizeEntry.mock.calls[1][1]).toMatchObject({availabilitySubmissionId:subB,selectedWindowIds:[w3]});
  });
  it("drops a selected slot that is no longer in the current proposal after a stale conflict",async()=>{
    const proposal={id:propId,slots:[{id:s2,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z"}],createdAt:"2026-10-06T00:30:00Z"};
    const newer={id:"abababab-abab-4bab-8bab-abababababab",slots:[{id:s3,startAt:"2026-10-08T05:00:00Z",endAt:"2026-10-08T06:00:00Z"}],createdAt:"2026-10-06T02:30:00Z"};
    let reads=0;
    const f=fake(dto({availability,proposal}),{readScheduling:async()=>++reads===1?dto({availability,proposal}):dto({availability,proposal:newer}),
      confirmSlot:async()=>{throw http(409,"STATE_CONFLICT");}});
    await mount(f.client);
    await check("10월 7일(수) 오후 2:00–3:00");
    await click("이 시간으로 확정");
    expect(page()).toContain("10월 8일(목) 오후 2:00–3:00");
    expect(button("이 시간으로 확정")?.disabled).toBe(true);
  });
  it("asks for new availability when every submitted window has passed and promises no containment (M2)",async()=>{
    const past={...availability,windows:[{id:w1,startAt:"2026-10-05T05:00:00Z",endAt:"2026-10-05T07:00:00Z"}]};
    const f=fake(dto({availability:past,waitingOn:"VENDOR"}));
    await mount(f.client);
    expect(zone()?.textContent).toContain("보낸 가능한 시간이 모두 지났습니다");
    expect(button("가능한 시간 보내기")).toBeDefined();
    expect(page().includes("정하고 있습니다")).toBe(false);
  });
  it("uses neutral copy after availability and warns that a live proposal is discarded on resubmission (M2)",async()=>{
    const proposal={id:propId,slots:[{id:s2,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z"}],createdAt:"2026-10-06T00:30:00Z"};
    const f=fake(dto(),{submitAvailability:async()=>dto({availability,waitingOn:"VENDOR"})});
    await mount(f.client);
    await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);
    await click("가능한 시간 보내기");
    expect(page()).toContain("가능한 시간을 저장했습니다");
    expect(page().includes("이 시간 안에서")).toBe(false);
    await act(async()=>root!.unmount());root=undefined;host.remove();
    const g=fake(dto({availability,proposal}));
    await mount(g.client);
    await click("가능한 시간 바꾸기");
    expect(page()).toContain("업체가 제안한 시간");
  });
  it("hides the scheduling panel when a command finds the Vendor scheduling gone (L1)",async()=>{
    let reads=0;
    const f=fake(dto(),{readScheduling:async()=>{if(++reads===1)return dto();throw http(404,"NOT_FOUND");},submitAvailability:async()=>{throw http(404,"NOT_FOUND");}});
    await mount(f.client);
    await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);
    await click("가능한 시간 보내기");
    expect(host.querySelector("section")).toBeNull();
  });
  it("never carries an open reschedule confirmation over to a different Appointment (L3)",async()=>{
    let reads=0;
    const other={...scheduled,appointment:{...scheduled.appointment!,id:appt2,startAt:"2026-10-08T05:00:00Z",endAt:"2026-10-08T06:00:00Z"}};
    const f=fake(scheduled,{readScheduling:async()=>++reads===1?scheduled:other,tenantReschedule:async()=>{throw network();}});
    await mount(f.client);
    await click("방문 일정 변경");
    await click("일정 변경하기");
    await click("최신 일정 다시 불러오기");
    expect(page()).toContain("10월 8일(목) 오후 2:00–3:00");
    expect(page().includes("기존 방문 일정은 취소되고")).toBe(false);
    expect(button("방문 일정 변경")).toBeDefined();
  });
  it("offers no consent once a proposal or an authorization exists",async()=>{
    const proposal={id:propId,slots:[{id:s2,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z"}],createdAt:"2026-10-06T00:30:00Z"};
    const f=fake(preauth({proposal,waitingOn:"TENANT"}));
    await mount(f.client);
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    await act(async()=>root!.unmount());root=undefined;host.remove();
    const g=fake(preauth({availability:{...availability,authorizedWindowIds:[w1]},effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW"}));
    await mount(g.client);
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
  // Remount hygiene only: a revision change replaces the instance, so this does not by itself prove the generation guard.
  it("shows no late command result from a replaced instance (revision remount hygiene)",async()=>{
    let finish!:(value:unknown)=>void;
    const f=fake(dto(),{submitAvailability:()=>new Promise(resolve=>{finish=resolve;})});
    await mount(f.client);
    await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);
    await click("가능한 시간 보내기");
    await act(async()=>{root!.render(<VendorHandoffTenant client={f.client} ticketId={ticketId} revision={1} now={now}/>);});
    await flush();
    await act(async()=>{finish(dto({availability}));});
    await flush();
    expect(page().includes("가능한 시간을 저장했습니다")).toBe(false);
  });
});

describe("Task6 rereview remediation (Tenant)",()=>{
  it("words the waiting state with the Tenant's own consent, not the Vendor's (N1)",async()=>{
    const f=fake(dto({accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",effectiveMode:"PREAUTHORIZED_ENTRY_WINDOW",waitingOn:"VENDOR",availability:{...availability,authorizedWindowIds:[w1]}}));
    await mount(f.client);
    expect(page()).toContain("출입에 동의하신 시간 안에서 업체가 방문 시간을 정하거나");
    expect(page().includes("업체가 동의한 시간")).toBe(false);
  });
});

describe("WC-M02 Tenant uncertainty",()=>{
  const cases=["availability","consent","confirm","reschedule"] as const;
  for(const family of cases)for(const outcome of ["same","failed","changed"] as const)it(`${family} reads authority before uncertain replay: ${outcome}`,async()=>{
    const initial=family==="reschedule"?scheduled:family==="consent"?dto({availability,accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED"}):family==="confirm"?dto({proposal:{id:propId,slots:[{id:s1,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z"}],createdAt:"2026-10-06T02:00:00Z"}}):dto();
    const method=family==="availability"?"submitAvailability":family==="consent"?"authorizeEntry":family==="confirm"?"confirmSlot":"tenantReschedule";
    const order:string[]=[];let attempts=0,reads=0;
    const f=fake(initial,{readScheduling:async()=>{order.push("GET");reads++;if(reads>1&&outcome==="failed")throw network();return reads>1&&outcome==="changed"?{...initial,packetRevisionId:w2}:initial;},[method]:async()=>{order.push("POST");if(++attempts===1)throw network();return dto({availability});}});
    await mount(f.client);
    if(family==="availability"){await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);await click("가능한 시간 보내기");}
    if(family==="consent"){await check("10월 7일(수) 오후 2:00–4:00");await click("선택한 시간 동의 확인");await click("동의하기");}
    if(family==="confirm"){await check("10월 7일(수) 오후 2:00–3:00");await click("이 시간으로 확정");}
    if(family==="reschedule"){await click("방문 일정 변경");await click("일정 변경하기");}
    expect(page()).toContain("결과를 확인하지 못했습니다");order.length=0;
    await click("같은 요청으로 결과 확인");
    expect(order[0]).toBe("GET");
    if(outcome==="same"){
      expect(order).toEqual(["GET","POST","GET"]);
      expect(f.vendorHandoff[method].mock.calls[1][1]).toEqual(f.vendorHandoff[method].mock.calls[0][1]);
      // The historical receipt has availability, but authoritative current state does not.
      if(family==="availability")expect(page()).toContain("방문 가능한 시간");
    }else{expect(order).toEqual(["GET"]);expect(attempts).toBe(1);expect(page()).not.toContain("가능한 시간을 저장했습니다");}
  });
});

it("WC-M02 manual refresh failure retains the uncertain Tenant request and blocks a new command",async()=>{
  let reads=0;const f=fake(dto(),{readScheduling:async()=>{if(++reads>1)throw network();return dto();},submitAvailability:async()=>{throw network();}});
  await mount(f.client);await type('input[type="date"]',"2026-10-10");await type('input[type="time"]',"10:00",0);await type('input[type="time"]',"12:00",1);await click("가능한 시간 보내기");
  await click("최신 일정 다시 불러오기");expect(button("같은 요청으로 결과 확인")).toBeDefined();expect(button("가능한 시간 보내기")?.disabled).toBe(true);
  await click("같은 요청으로 결과 확인");expect(f.vendorHandoff.submitAvailability).toHaveBeenCalledTimes(1);
});

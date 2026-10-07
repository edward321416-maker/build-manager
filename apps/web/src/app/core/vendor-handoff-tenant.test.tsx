// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,describe,expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { VendorHandoffTenant } from "./vendor-handoff-tenant";

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
    await click("방문 일정 변경 요청");
    expect(f.vendorHandoff.tenantReschedule).not.toHaveBeenCalled();
    expect(page()).toContain("기존 방문 일정은 취소되고");
    await click("일정 변경 요청하기");
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

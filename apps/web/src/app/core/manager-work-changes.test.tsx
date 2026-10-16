// @vitest-environment jsdom
import { act,type ReactNode } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem,CoreTicketDto } from "@build-manager/api-contracts";
import { TODO_REASON_NAMES } from "../../components/status-names";
import { ManagerWorkDetail,ManagerWorkQueue } from "./manager-work";

// P5 PR 2 review: after a manager changed the due date, 기한 지남 stayed on the work list and on 알림 until the next read,
// and the work list wrote 기한 지남 itself in its own colours (rules 8.7).
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const ticketId="5f0c2a1e-7d4b-4c1a-9e2f-3a6b8c0d9b31";
const work:CoreManagerWorkItem={ticketId,unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",issueType:"LEAK",workStatus:"OPEN",priority:"NORMAL",assigneeLabel:null,dueAt:null,createdAt:"2026-10-13T00:12:00Z",updatedAt:"2026-10-13T00:12:00Z",version:1};
const ticket={ticketId,workStatus:"OPEN",version:1} as CoreTicketDto;
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();});
const flush=()=>act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
async function render(node:ReactNode){host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root!.render(node));await flush();}
const save=async()=>{await act(async()=>host!.querySelector<HTMLFormElement>("form")!.requestSubmit());await flush();};

it("tells the screen after the work information is saved, so the work list and 알림 read again",async()=>{
  const update=vi.fn(async()=>({...work,priority:"HIGH" as const,version:2}));
  const client={manager:{read:vi.fn(async()=>work),notes:vi.fn(async()=>[]),update}} as unknown as CoreFlowClient;
  const onChanged=vi.fn();
  await render(<ManagerWorkDetail client={client} ticket={ticket} revision={0} onChanged={onChanged}/>);
  expect(onChanged).not.toHaveBeenCalled();
  await save();
  expect(update).toHaveBeenCalledTimes(1);
  expect(host!.textContent).toContain("업무 정보를 저장했어요.");
  expect(onChanged).toHaveBeenCalledTimes(1);
});

it("does not when the save is refused or its result is unknown",async()=>{
  for(const failure of [new ApiClientError("CONFLICT","충돌",{status:409}),new ApiClientError("NETWORK_ERROR","요청을 보내지 못했어요.")]){
    const client={manager:{read:vi.fn(async()=>work),notes:vi.fn(async()=>[]),update:vi.fn(async()=>{throw failure;})}} as unknown as CoreFlowClient;
    const onChanged=vi.fn();
    await render(<ManagerWorkDetail client={client} ticket={ticket} revision={0} onChanged={onChanged}/>);
    await save();
    expect(onChanged).not.toHaveBeenCalled();
    await act(async()=>root?.unmount());root=undefined;host?.remove();
  }
});

it("shows 기한 지남 on the work list with the 알림 name and colours",async()=>{
  const late={...work,dueAt:"2026-10-01T00:00:00Z"};
  const client={manager:{list:vi.fn(async()=>[late])},communication:{summaries:vi.fn(async()=>[])}} as unknown as CoreFlowClient;
  await render(<ManagerWorkQueue client={client} units={[]} revision={0} onOpen={()=>{}} disabled={false}/>);
  const badge=host!.querySelector('[data-reason="OVERDUE"]');
  expect(badge?.textContent).toBe(TODO_REASON_NAMES.OVERDUE);
  expect(badge?.tagName).toBe("SPAN");
});

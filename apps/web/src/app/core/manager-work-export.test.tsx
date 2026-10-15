// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem,CoreUnitDto } from "@build-manager/api-contracts";
import { downloadCsv } from "../../lib/csv-file";
import { ManagerWorkQueue } from "./manager-work";

vi.mock("../../lib/csv-file",async original=>({...await original<typeof import("../../lib/csv-file")>(),downloadCsv:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadCsv as unknown as Mock<(fileName:string,text:string)=>void>;
const units:CoreUnitDto[]=[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"101동 1203호"}];
const open:CoreManagerWorkItem={ticketId:"5f0c2a1e-7d4b-4c1a-9e2f-3a6b8c0d9b31",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",issueType:"LEAK",workStatus:"OPEN",priority:"URGENT",assigneeLabel:null,dueAt:null,createdAt:"2026-10-13T00:12:00Z",updatedAt:"2026-10-13T00:12:00Z",version:1};
const done:CoreManagerWorkItem={...open,ticketId:"a83d77b0-41c5-4f0e-8d7a-6b2e9f3c1c02",workStatus:"COMPLETED",priority:"NORMAL",issueType:"HEATING"};
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
const flush=()=>act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
async function mount(list:()=>Promise<CoreManagerWorkItem[]>,disabled=false){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={manager:{list:vi.fn(list)},communication:{summaries:vi.fn(async()=>[])}} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<ManagerWorkQueue client={client} units={units} revision={0} onOpen={()=>{}} disabled={disabled}/>));await flush();
}
const exportButton=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="엑셀로 받기");
const header='"접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"';
async function choose(label:string,value:string){const select=host!.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;await act(async()=>{select.value=value;select.dispatchEvent(new Event("change",{bubbles:true}));});}

it("saves the rows the filters show, in screen order, under the ledger header",async()=>{
  await mount(async()=>[done,open]);
  await act(async()=>exportButton()!.click());
  expect(save).toHaveBeenCalledTimes(1);const [name,text]=save.mock.calls[0];
  expect(name).toMatch(/^업무함_\d{4}-\d{2}-\d{2}\.csv$/);
  const lines=text.slice(1).split("\r\n");expect(text.charAt(0)).toBe("﻿");expect(lines[0]).toBe(header);
  expect(lines.slice(1,3).map(line=>line.includes(open.ticketId)?"open":line.includes(done.ticketId)?"done":"?")).toEqual(["open","done"]);
  await choose("처리 상태","COMPLETED");await act(async()=>exportButton()!.click());
  const filtered=save.mock.calls[1][1].slice(1).split("\r\n");expect(filtered).toHaveLength(3);expect(filtered[1]).toContain(done.ticketId);
});
it("tells how many rows went into the file",async()=>{
  await mount(async()=>[done,open]);await act(async()=>exportButton()!.click());
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("업무함 2건을 엑셀 파일(CSV)로 받았어요.");
});
it("cannot be pressed while loading, after a load error, with no rows or while the screen is busy",async()=>{
  await mount(()=>new Promise<CoreManagerWorkItem[]>(()=>{}));expect(exportButton()!.disabled).toBe(true);await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount(async()=>{throw new Error("synthetic");});expect(exportButton()!.disabled).toBe(true);await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount(async()=>[]);expect(exportButton()!.disabled).toBe(true);await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount(async()=>[open],true);expect(exportButton()!.disabled).toBe(true);
});
it("keeps a failed save in place as an alert and shows no toast",async()=>{
  save.mockImplementationOnce(()=>{throw new Error("blocked");});
  await mount(async()=>[open]);await act(async()=>exportButton()!.click());
  expect(host!.querySelector('[role="alert"]')?.textContent).toBe("파일을 만들지 못했어요. 다시 받아 주세요.");expect(document.body.querySelector("[data-toast]")).toBeNull();
});

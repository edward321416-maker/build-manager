// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreUnitDto,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { downloadCsv } from "../../lib/csv-file";
import { ManagerMaintenanceTimeline } from "./manager-maintenance-timeline";

vi.mock("../../lib/csv-file",async original=>({...await original<typeof import("../../lib/csv-file")>(),downloadCsv:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadCsv as unknown as Mock<(fileName:string,text:string)=>void>;
const units:CoreUnitDto[]=[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"101동 1203호"}];
const first:CoreUnitMaintenanceFact={factId:"first",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",sourceTicketId:"7d21c0aa-1b2c-4d5e-8f90-1a2b3c4d4e90",issueType:"LEAK",actionKind:"PART_REPLACEMENT",componentLabel:"=합성 수식 부품",sourceCompletedAt:"2026-10-09T06:20:00Z",recordedAt:"2026-10-09T06:45:00Z",corrected:false,correctionCount:0,tenantOutcome:"RESOLVED",previousTicketId:null,followUpTicketId:null};
const second:CoreUnitMaintenanceFact={...first,factId:"second",sourceTicketId:"c4f8e912-3a4b-4c5d-9e6f-7a8b9c0d0a7b",issueType:"HEATING",actionKind:"INSPECTION",componentLabel:null,sourceCompletedAt:"2026-09-22T02:00:00Z",recordedAt:"2026-09-22T02:30:00Z",correctionCount:1,tenantOutcome:"UNCONFIRMED"};
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={maintenance:{listUnit:vi.fn(async()=>[first,second])}} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<ManagerMaintenanceTimeline client={client} units={units} revision={0} disabled={false} onOpenTicket={()=>{}}/>));
  await act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
}
const exportButton=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="엑셀로 받기")!;

it("saves the selected unit's facts in timeline order with the unit in the file name",async()=>{
  await mount();await act(async()=>exportButton().click());
  const [name,text]=save.mock.calls[0];expect(name).toMatch(/^정비이력_합성건물_101동1203호_\d{4}-\d{2}-\d{2}\.csv$/);
  const lines=text.slice(1).split("\r\n");
  expect(lines[0]).toBe('"관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"');
  expect(lines[1]).toBe(`"2026-10-09 15:20","합성 건물","101동 1203호","누수","부품 교체","'=합성 수식 부품","세입자가 해결됐다고 응답","0회","2026-10-09 15:45","${first.sourceTicketId}",""`);
  expect(lines[2]).toContain('"2026-09-22 11:00"');expect(lines[2]).toContain('"부품·위치 명칭 미기록","세입자 응답 미확인","1회"');
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("정비 이력 2건을 엑셀 파일(CSV)로 받았어요.");
});
it("keeps a failed save in place as an alert and shows no toast",async()=>{
  save.mockImplementationOnce(()=>{throw new Error("blocked");});
  await mount();await act(async()=>exportButton().click());
  expect(host!.querySelector('[role="alert"]')?.textContent).toBe("파일을 만들지 못했어요. 다시 받아 주세요.");expect(document.body.querySelector("[data-toast]")).toBeNull();
});

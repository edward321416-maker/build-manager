import { expect,it } from "vitest";
import type { CoreManagerWorkItem,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { MAINTENANCE_EXPORT_HEADER,WORK_EXPORT_HEADER,exportDate,maintenanceExportRows,workExportRows } from "./export-rows";

const item:CoreManagerWorkItem={ticketId:"5f0c2a1e-7d4b-4c1a-9e2f-3a6b8c0d9b31",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",issueType:"LEAK",workStatus:"IN_PROGRESS",priority:"URGENT",assigneeLabel:"합성 담당",dueAt:"2026-10-14T09:00:00Z",createdAt:"2026-10-13T00:12:00Z",updatedAt:"2026-10-14T02:40:00Z",version:3};
const fact:CoreUnitMaintenanceFact={factId:"fact",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",sourceTicketId:"7d21c0aa-1b2c-4d5e-8f90-1a2b3c4d4e90",issueType:"HEATING",actionKind:"PART_REPLACEMENT",componentLabel:"합성 배관",sourceCompletedAt:"2026-10-09T06:20:00Z",recordedAt:"2026-10-09T06:45:00Z",corrected:false,correctionCount:0,tenantOutcome:"RESOLVED",previousTicketId:null,followUpTicketId:null};
const withZone=<T,>(zone:string,run:()=>T):T=>{const before=process.env.TZ;process.env.TZ=zone;try{return run();}finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}};

it("orders both files like landlords' ledgers: the date first, the request number toward the end, an empty 비고 last",()=>{
  expect(WORK_EXPORT_HEADER).toEqual(["접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"]);
  expect(MAINTENANCE_EXPORT_HEADER).toEqual(["관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"]);
});
it("writes a work row with the screen's names and Seoul time",()=>{
  expect(workExportRows([item])).toEqual([["2026-10-13 09:12","합성 건물","101동 1203호","누수","처리 중","긴급","합성 담당","2026-10-14 18:00","2026-10-14 11:40",item.ticketId,""]]);
});
it("leaves a missing assignee and due date as empty cells",()=>{
  expect(workExportRows([{...item,assigneeLabel:null,dueAt:null,workStatus:"OPEN",priority:"NORMAL",issueType:"HEATING"}])[0]).toEqual(["2026-10-13 09:12","합성 건물","101동 1203호","난방","접수됨","보통","","","2026-10-14 11:40",item.ticketId,""]);
});
it("writes a maintenance row with the timeline's names, the correction count and the source request",()=>{
  expect(maintenanceExportRows([fact])).toEqual([["2026-10-09 15:20","합성 건물","101동 1203호","난방","부품 교체","합성 배관","세입자가 해결됐다고 응답","0회","2026-10-09 15:45",fact.sourceTicketId,""]]);
  expect(maintenanceExportRows([{...fact,componentLabel:null,correctionCount:2,tenantOutcome:"UNCONFIRMED"}])[0].slice(5,8)).toEqual(["부품·위치 명칭 미기록","세입자 응답 미확인","2회"]);
});
it("keeps Seoul time and the Seoul download date whatever zone the browser is in",()=>{
  const rows=withZone("America/Los_Angeles",()=>({work:workExportRows([item]),facts:maintenanceExportRows([fact]),date:exportDate(new Date("2026-10-14T15:30:00Z"))}));
  expect(rows.work[0][0]).toBe("2026-10-13 09:12");expect(rows.facts[0][0]).toBe("2026-10-09 15:20");expect(rows.date).toBe("2026-10-15");
});
it("keeps the given order and never adds tenant text",()=>{
  const second={...item,ticketId:"a83d77b0-41c5-4f0e-8d7a-6b2e9f3c1c02"};
  expect(workExportRows([second,item]).map(row=>row[9])).toEqual([second.ticketId,item.ticketId]);
  // Extra fields a future response might carry never reach a row: rows are built from named fields only.
  const extra={...item,rawUserText:"세입자가 쓴 합성 설명",tenantName:"합성 세입자",tenantPhone:"합성 연락처",internalNote:"합성 내부 메모"} as unknown as CoreManagerWorkItem;
  expect(JSON.stringify(workExportRows([extra]))).not.toMatch(/세입자가 쓴|합성 세입자|합성 연락처|내부 메모/);
});

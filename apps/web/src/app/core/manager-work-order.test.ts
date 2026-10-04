import { expect,it } from "vitest";
import type { CoreManagerWorkItem } from "@build-manager/api-contracts";
import { compareManagerWork,isOverdue } from "./manager-work-order";
const now=Date.parse("2026-10-04T12:00:00Z");
const item=(ticketId:string,extra:Partial<CoreManagerWorkItem>={}):CoreManagerWorkItem=>({ticketId,unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"합성 호실",issueType:"HEATING",workStatus:"OPEN",priority:"NORMAL",assigneeLabel:null,dueAt:null,createdAt:"2026-10-04T00:00:00Z",updatedAt:"2026-10-04T00:00:00Z",version:1,...extra});
it("orders unfinished, overdue, priority, target time and newest creation with null dates last",()=>{
 const rows=[item("completed",{workStatus:"COMPLETED",priority:"URGENT",dueAt:"2026-10-01T00:00:00Z"}),item("normal"),item("urgent-null",{priority:"URGENT"}),item("urgent-later",{priority:"URGENT",dueAt:"2026-10-06T00:00:00Z"}),item("urgent-earlier",{priority:"URGENT",dueAt:"2026-10-05T00:00:00Z"}),item("high",{priority:"HIGH"}),item("overdue",{dueAt:"2026-10-04T00:00:00Z"}),item("newer",{createdAt:"2026-10-04T01:00:00Z"})];
 expect(rows.sort((a,b)=>compareManagerWork(a,b,now)).map(x=>x.ticketId)).toEqual(["overdue","urgent-earlier","urgent-later","urgent-null","high","newer","normal","completed"]);
});
it("overdue is strictly earlier than now and excludes completed or unset targets",()=>{
 expect(isOverdue(item("late",{dueAt:new Date(now-1).toISOString()}),now)).toBe(true);
 for(const row of [item("none"),item("equal",{dueAt:new Date(now).toISOString()}),item("done",{workStatus:"COMPLETED",dueAt:new Date(now-1).toISOString()})])expect(isOverdue(row,now)).toBe(false);
});

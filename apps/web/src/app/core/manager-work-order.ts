import type { CoreManagerWorkItem } from "@build-manager/api-contracts";

export const priorityLabels={NORMAL:"보통",HIGH:"높음",URGENT:"긴급"};
export const isOverdue=(item:CoreManagerWorkItem,now:number)=>item.workStatus!=="COMPLETED"&&item.dueAt!==null&&Date.parse(item.dueAt)<now;
export function compareManagerWork(a:CoreManagerWorkItem,b:CoreManagerWorkItem,now:number):number{
  const rank={URGENT:0,HIGH:1,NORMAL:2};
  return Number(a.workStatus==="COMPLETED")-Number(b.workStatus==="COMPLETED")
    ||Number(isOverdue(b,now))-Number(isOverdue(a,now))||rank[a.priority]-rank[b.priority]
    ||(a.dueAt===null?b.dueAt===null?0:1:b.dueAt===null?-1:Date.parse(a.dueAt)-Date.parse(b.dueAt))
    ||Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.ticketId.localeCompare(b.ticketId);
}

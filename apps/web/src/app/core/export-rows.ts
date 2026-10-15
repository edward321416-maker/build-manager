import type { CoreManagerWorkItem,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { WORK_STATUS_NAMES } from "../../components/status-names";
import { instantToSeoulLocal } from "../../lib/date-text";
import { actionLabels,outcomeLabels } from "./maintenance-labels";
import { priorityLabels } from "./manager-work-order";

// Columns follow landlords' repair ledgers: the date first, the request number toward the end and an empty 비고 for the
// reader's own notes (operator decision 2026-10-15, CLM-213). Names come from the screens' own tables.
const issueNames={HEATING:"난방",LEAK:"누수"} as const;
const seoul=(at:string|null)=>{if(!at)return "";const {date,time}=instantToSeoulLocal(at);return `${date} ${time}`;};
/** The Seoul calendar date for the file name, whatever zone the browser is in. */
export const exportDate=(now:Date)=>instantToSeoulLocal(now.toISOString()).date;
export const WORK_EXPORT_HEADER=["접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"] as const;
export const workExportRows=(items:readonly CoreManagerWorkItem[]):string[][]=>items.map(x=>[seoul(x.createdAt),x.buildingName,x.unitLabel,issueNames[x.issueType],WORK_STATUS_NAMES[x.workStatus],priorityLabels[x.priority],x.assigneeLabel??"",seoul(x.dueAt),seoul(x.updatedAt),x.ticketId,""]);
export const MAINTENANCE_EXPORT_HEADER=["관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"] as const;
export const maintenanceExportRows=(facts:readonly CoreUnitMaintenanceFact[]):string[][]=>facts.map(f=>[seoul(f.sourceCompletedAt),f.buildingName,f.unitLabel,issueNames[f.issueType],actionLabels[f.actionKind],f.componentLabel??"부품·위치 명칭 미기록",outcomeLabels[f.tenantOutcome],`${f.correctionCount}회`,seoul(f.recordedAt),f.sourceTicketId,""]);

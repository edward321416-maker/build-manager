import type { CoreMaintenanceActionKind,CoreMaintenanceCorrectionReason,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
// One set of names for the maintenance screens and their CSV file: a file never names a state anew (design rules 8.7).
export const actionLabels:Record<CoreMaintenanceActionKind,string>={INSPECTION:"점검",REPAIR:"수리",PART_REPLACEMENT:"부품 교체",ADJUSTMENT:"조정",OTHER:"기타"};
export const reasonLabels:Record<CoreMaintenanceCorrectionReason,string>={ACTION_CLASSIFICATION:"작업 분류 정정",COMPONENT_LABEL:"부품·위치 명칭 정정",OTHER:"기타 정정"};
export const outcomeLabels:Record<CoreUnitMaintenanceFact["tenantOutcome"],string>={UNCONFIRMED:"세입자 응답 미확인",RESOLVED:"세입자가 해결됐다고 응답",UNRESOLVED:"세입자가 아직 문제가 있다고 응답",RECURRENCE_CLAIM:"세입자가 다시 문제가 생겼다고 응답"};

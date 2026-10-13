import type {
  CoreTicketDto, EvidenceStatus, HeatingType, ManagementMode, RouteCode, TicketStatus, VendorAccessPolicy, VendorSharedDetailSourceType,
} from "@build-manager/api-contracts";

/**
 * The one set of display names for server values on every web screen (design rules 8.7 and 13).
 * Each table is a total record over the contract's values, so a new server value without a name fails the type check.
 */
export const WORK_STATUS_NAMES: Record<CoreTicketDto["workStatus"], string> = { OPEN: "접수됨", IN_PROGRESS: "처리 중", COMPLETED: "처리 완료" };

export const INTAKE_STATUS_NAMES: Record<TicketStatus, string> = {
  IN_PROGRESS: "제출 전", READY_FOR_REVIEW: "결정 대기", PARTIAL: "정보 부족", NEEDS_MORE_INFO: "추가 확인 필요",
  SAFETY_ESCALATED: "긴급 확인 필요", APPROVED: "처리 방법 결정됨", OVERRIDDEN: "처리 방법 결정됨",
};

/** Names of what someone has to do next (P5 spec §5): the request rows and the 알림 to-do list share them (rules 8.7). */
export const TODO_REASON_NAMES = {
  SAFETY: INTAKE_STATUS_NAMES.SAFETY_ESCALATED, DRAFT: INTAKE_STATUS_NAMES.IN_PROGRESS, MORE_INFO: INTAKE_STATUS_NAMES.NEEDS_MORE_INFO,
  DECIDE: "처리 방법 결정 필요", REPLY_TENANT: "내 답변 필요", REPLY_MANAGER: "관리자 답변 대기", WAITING_TENANT: "세입자 답변 대기",
} as const;

/**
 * Every tenant answer resets the server status to IN_PROGRESS, also inside a more-info round after the request was
 * sent. A request that was sent once must never read 제출 전 again, so it reads as the more-info round instead.
 */
export function sentIntakeStatus(status: TicketStatus, sent: boolean): TicketStatus {
  return status === "IN_PROGRESS" && sent ? "NEEDS_MORE_INFO" : status;
}

export const EVIDENCE_STATUS_NAMES: Record<EvidenceStatus, string> = {
  COMPLETE: "필수 정보 확인됨", MISSING_REQUIRED: "필수 정보 부족", CONFLICTING: "정보 불일치", SAFETY_ESCALATED: "안전 위험 신호",
};

/** Where a shared detail came from, named the way the Vendor screen shows it, so the manager's preview matches it. */
export const SHARED_DETAIL_SOURCE_NAMES: Record<VendorSharedDetailSourceType, string> = {
  TENANT_REPORTED: "세입자 입력", BUILDING_VERIFIED: "건물 확인", MANAGER_REVIEWED: "관리자 확인",
};

export const ACCESS_POLICY_NAMES: Record<VendorAccessPolicy, string> = {
  TENANT_PRESENT_REQUIRED: "세입자가 있을 때만 방문",
  TENANT_PREAUTHORIZATION_ALLOWED: "세입자가 따로 동의한 시간에만 부재 중 출입 가능",
};

/** The decision screen's route names. The server's recommendation label differs, so the recommendation uses these too. */
export const ROUTE_NAMES: Record<RouteCode, string> = {
  LANDLORD_REVIEW: "관리자 검토", MANAGEMENT_OFFICE: "관리사무소", THIRD_PARTY_MANAGER: "위탁관리",
  MANUFACTURER_AS: "제조사 A/S", GENERAL_VENDOR: "일반 수리업체",
};

const BUILDING_FIELD_NAMES: Record<string, string> = {
  heatingType: "난방 방식", managementMode: "관리 방식", ownerSuppliedBoiler: "건물주 제공 보일러", primaryUse: "주용도", approvalYear: "사용승인 연도",
};
// OWNER_DIRECT means the building's owner manages it, not the manager using this app, so it says 건물주.
export const MANAGEMENT_MODE_NAMES: Record<ManagementMode, string> = { OWNER_DIRECT: "건물주 직접 관리", MANAGEMENT_OFFICE: "관리사무소" };
export const HEATING_TYPE_NAMES: Record<HeatingType, string> = { INDIVIDUAL: "개별난방", CENTRAL_SHARED: "중앙·공용난방" };
const CODED_VALUES: Record<string, Record<string, string>> = { managementMode: MANAGEMENT_MODE_NAMES, heatingType: HEATING_TYPE_NAMES };

// Keys come from server data, so only own properties count; `constructor` and the like fall back to the raw text.
const own = (table: Record<string, string> | undefined, key: string): string | undefined =>
  table && Object.hasOwn(table, key) ? table[key] : undefined;

export function buildingFieldName(key: string): string {
  return own(BUILDING_FIELD_NAMES, key) ?? key;
}

/** Coded building values get their name; free text such as a primary use is shown as written. */
export function buildingValueName(key: string, value: string): string {
  return own(Object.hasOwn(CODED_VALUES, key) ? CODED_VALUES[key] : undefined, value) ?? value;
}

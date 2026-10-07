import type { ManagerVendorHandoffDto,VendorBlockerCode,VendorPhotoOmissionReason } from "@build-manager/api-contracts";

/** Korean labels for the frozen blocker codes, shared by the Vendor and Manager surfaces. */
export const BLOCKER_LABELS:Record<VendorBlockerCode,string>={
  PARTS_REQUIRED:"부품 필요",ACCESS_BLOCKED:"출입 불가",SCOPE_REVIEW_REQUIRED:"작업 범위 확인 필요",FOLLOW_UP_VISIT_REQUIRED:"추가 방문 필요",OTHER:"기타",
};

/** Korean labels for the frozen completion-photo omission reasons, shared by the Vendor and Manager surfaces. */
export const OMISSION_LABELS:Record<VendorPhotoOmissionReason,string>={
  NOT_APPLICABLE:"사진이 필요 없는 작업",SAFETY_OR_PRIVACY:"안전·사생활 보호",TECHNICAL_FAILURE:"사진을 올릴 수 없음(기술 문제)",
};

/** Who the current step waits on, as shown to the Manager. */
export const WAITING_LABELS:Record<ManagerVendorHandoffDto["waitingOn"],string>={
  NONE:"대기 없음",TENANT:"세입자 응답 대기",VENDOR:"업체 응답 대기",MANAGER:"관리자 확인 필요",PARTS:"부품 대기",
};

import type { CoreTicketDto } from "@build-manager/api-contracts";
import styles from "../core-design.module.css";

const labels = {
  OPEN: "접수",
  IN_PROGRESS: "처리중",
  COMPLETED: "처리 완료 (관리자 기록)",
};

export function WorkStatusBadge({ status }: { status: CoreTicketDto["workStatus"] }) {
  return <span className={styles.badge} data-work-state={status}>{labels[status]}</span>;
}

// Existing intake labels remain independent of the manager's handling record.
const intakeLabels = {
  IN_PROGRESS: "작성 중", PARTIAL: "정보 부족", READY_FOR_REVIEW: "검토 대기",
  NEEDS_MORE_INFO: "추가 정보 요청됨", SAFETY_ESCALATED: "안전 확인 필요",
  APPROVED: "임대인 확인 완료", OVERRIDDEN: "임대인 확인 완료",
};
export function IntakeStatus({ status }: { status: CoreTicketDto["detail"]["status"] }) {
  return <p className={styles.intakeStatus} data-intake-state={status}>접수·검토 상태: {intakeLabels[status]}</p>;
}

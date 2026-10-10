import type { CoreTicketDto } from "@build-manager/api-contracts";
import styles from "../core-design.module.css";

const labels = {
  OPEN: "접수",
  IN_PROGRESS: "처리중",
  COMPLETED: "처리 완료",
};

export function WorkStatusBadge({ status }: { status: CoreTicketDto["workStatus"] }) {
  return <span className={styles.badge} data-work-state={status}>{status==="COMPLETED"?<span aria-hidden="true">✓ </span>:null}{labels[status]}</span>;
}

/** A request the tenant has saved but not yet submitted: nothing has reached the manager's decision yet. */
export function isIntakeDraft(ticket: { workStatus: CoreTicketDto["workStatus"]; detail: { status: CoreTicketDto["detail"]["status"] } }): boolean {
  return ticket.workStatus === "OPEN" && ticket.detail.status === "IN_PROGRESS";
}

/** One label for both roles, so the same state keeps the same name everywhere (design rules 8.7). */
export function DraftBadge() {
  return <span className={styles.badge} data-work-state="DRAFT">제출 전</span>;
}

// Existing intake labels remain independent of the manager's handling record.
const intakeLabels = {
  IN_PROGRESS: "제출 전", PARTIAL: "추가 정보 필요", READY_FOR_REVIEW: "확인 대기",
  NEEDS_MORE_INFO: "추가 확인 필요", SAFETY_ESCALATED: "긴급 확인 필요",
  APPROVED: "확인 완료", OVERRIDDEN: "확인 완료",
};
export function IntakeStatus({ status }: { status: CoreTicketDto["detail"]["status"] }) {
  return <p className={styles.intakeStatus} data-intake-state={status}>접수 상태: {intakeLabels[status]}</p>;
}

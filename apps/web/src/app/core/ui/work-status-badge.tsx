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

type IntakeTicket = {
  workStatus: CoreTicketDto["workStatus"];
  detail: { status: CoreTicketDto["detail"]["status"] };
  events?: readonly { kind: string }[];
};

/**
 * Every tenant answer resets the server status to IN_PROGRESS, also while the tenant answers a manager's
 * more-info request after an earlier submission. A FINALIZED event tells the two apart, so a request that
 * was already sent is never shown as unsubmitted again.
 */
export function intakeDisplayStatus(ticket: IntakeTicket): CoreTicketDto["detail"]["status"] {
  const resubmitting = ticket.detail.status === "IN_PROGRESS" && Boolean(ticket.events?.some(event => event.kind === "FINALIZED"));
  return resubmitting ? "NEEDS_MORE_INFO" : ticket.detail.status;
}

/** A request the tenant has saved but never submitted: nothing has reached the manager's decision yet. */
export function isIntakeDraft(ticket: IntakeTicket): boolean {
  return ticket.workStatus === "OPEN" && intakeDisplayStatus(ticket) === "IN_PROGRESS";
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

/** The same intake label as a compact row badge, so a queue row and the request use one name per state. */
export function IntakeBadge({ status }: { status: CoreTicketDto["detail"]["status"] }) {
  return <span className={styles.badge} data-intake-state={status}>{intakeLabels[status]}</span>;
}

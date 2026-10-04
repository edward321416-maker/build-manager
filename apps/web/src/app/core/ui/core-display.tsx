import type { CoreTicketDto, InvitationDto } from "@build-manager/api-contracts";
import type { ReactNode } from "react";
import styles from "../core-design.module.css";
import { IntakeStatus, WorkStatusBadge } from "./work-status-badge";

/** Pure presentation; integration remains with the controller's sole writer. */
export function EnvironmentNote({ children }: { children: ReactNode }) {
  return <aside className={styles.environmentNote} aria-label="개발 환경 안내">
    <span className={styles.environmentBadge}>개발 환경 · 합성 데이터</span>
    <details className={styles.environmentDetails}>
      <summary>검증 환경 안내</summary>
      <div>{children}</div>
    </details>
  </aside>;
}

export function InvitationMetadata({ invite }: {
  invite: Pick<InvitationDto, "requestNumber" | "requestedAt" | "expiresAt"> & Partial<Pick<InvitationDto, "decidedAt">>;
}) {
  return <dl className={styles.requestMetadata}>
    {invite.requestNumber ? <>
      <dt>확인용 요청번호</dt>
      <dd className={`request-number ${styles.requestNumber}`}>{invite.requestNumber}</dd>
    </> : null}
    {invite.requestedAt ? <>
      <dt>신청 시각</dt>
      <dd><time dateTime={invite.requestedAt}>{new Date(invite.requestedAt).toLocaleString()}</time></dd>
    </> : null}
    <dt>만료 시각</dt>
    <dd><time dateTime={invite.expiresAt}>{new Date(invite.expiresAt).toLocaleString()}</time></dd>
    {invite.decidedAt ? <><dt>확인 시각</dt><dd><time dateTime={invite.decidedAt}>{new Date(invite.decidedAt).toLocaleString()}</time></dd></> : null}
  </dl>;
}

export function TicketProgress({ workStatus, intakeStatus, children }: {
  workStatus: CoreTicketDto["workStatus"];
  intakeStatus: CoreTicketDto["detail"]["status"];
  children: ReactNode;
}) {
  return <div className={styles.progressSummary}>
    <p data-testid="work-status"><WorkStatusBadge status={workStatus} /></p>
    <IntakeStatus status={intakeStatus} />
    <div className={styles.progressMessage}>{children}</div>
  </div>;
}

/** The caller retains the native input, its accessible name and all handlers. */
export function PhotoSelectionSurface({ children, selectionCount, disabled }: {
  children: ReactNode;
  selectionCount: number;
  disabled: boolean;
}) {
  return <div className={styles.photoSelectionSurface}>
    <label className={styles.photoSelectionControl} data-disabled={disabled}>
      <span aria-hidden="true">＋</span> 참고 사진 추가
      {children}
    </label>
    <p className={styles.photoSelectionHint}>JPEG·PNG · 최대 3장</p>
    {selectionCount > 0 ? <p className={styles.photoSelectionCount}>사진 {selectionCount}장 선택됨</p> : null}
  </div>;
}

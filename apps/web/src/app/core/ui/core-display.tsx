"use client";
import type { CoreTicketDto, InvitationDto } from "@build-manager/api-contracts";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "../core-design.module.css";
import { DraftBadge, IntakeStatus, WorkStatusBadge } from "./work-status-badge";

/** One persistent DOM subtree preserves unsaved property and note inputs across collapse. */
export function ManagerInspector({ children, expanded, onExpandedChange }: {
  children: ReactNode; expanded: boolean; onExpandedChange(value: boolean): void;
}) {
  const summary = useRef<HTMLElement>(null);
  const contextual = () => window.matchMedia("(min-width: 1120px) and (max-width: 1439px)").matches;
  const close = () => { onExpandedChange(false); document.getElementById("ticket-inspector-trigger")?.focus(); };
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1440px)");
    const update = () => onExpandedChange(wide.matches);
    update(); wide.addEventListener("change", update);
    return () => wide.removeEventListener("change", update);
  }, [onExpandedChange]);
  useEffect(() => { if (expanded && contextual()) summary.current?.focus(); }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const followFocus = (event: FocusEvent) => {
      const next = event.target, panel = summary.current?.parentElement;
      if (contextual() && next instanceof Node && !panel?.contains(next) && next !== document.getElementById("ticket-inspector-trigger")) onExpandedChange(false);
    };
    document.addEventListener("focusin", followFocus);
    return () => document.removeEventListener("focusin", followFocus);
  }, [expanded, onExpandedChange]);
  return <details id="ticket-inspector" className={styles.inspector} open={expanded}
    onToggle={event => onExpandedChange(event.currentTarget.open)}
    onKeyDown={event => { if (event.key === "Escape" && contextual()) { event.preventDefault(); close(); } }}>
    <summary ref={summary}>업무 정보</summary>
    <aside aria-label="관리자 업무 정보"><button type="button" className={styles.inspectorClose} onClick={close}>업무 정보 닫기</button>{children}</aside>
  </details>;
}

/** `label` keeps two to-do zones apart for screen readers; `message` replaces the conversation default. */
export function TaskZone({ tenant, children, label = "지금 할 일", message }: { tenant: boolean; children: ReactNode; label?: string; message?: string }) {
  return <section className={styles.taskZone} aria-label={label}>
    <h2>지금 할 일</h2>
    <p>{message ?? (tenant ? "관리자 질문에 답변해주세요." : "세입자 답변이 도착했습니다. 확인 후 다음 조치를 선택하세요.")}</p>
    {children}
  </section>;
}

/** Pure presentation; integration remains with the controller's sole writer. */
export function EnvironmentNote({ children }: { children: ReactNode }) {
  return <aside className={styles.environmentNote} aria-label="개발 환경 안내">
    <span className={styles.environmentBadge}>개발 환경 · 샘플 데이터</span>
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
      <dt>확인 번호</dt>
      <dd className={`request-number ${styles.requestNumber}`}>{invite.requestNumber}</dd>
    </> : null}
    {invite.requestedAt ? <>
      <dt>신청 시각</dt>
      <dd><time dateTime={invite.requestedAt}>{new Date(invite.requestedAt).toLocaleString("ko-KR")}</time></dd>
    </> : null}
    <dt>만료 시각</dt>
    <dd><time dateTime={invite.expiresAt}>{new Date(invite.expiresAt).toLocaleString("ko-KR")}</time></dd>
    {invite.decidedAt ? <><dt>확인 시각</dt><dd><time dateTime={invite.decidedAt}>{new Date(invite.decidedAt).toLocaleString("ko-KR")}</time></dd></> : null}
  </dl>;
}

export function TicketProgress({ workStatus, intakeStatus, children }: {
  workStatus: CoreTicketDto["workStatus"];
  intakeStatus: CoreTicketDto["detail"]["status"];
  children: ReactNode;
}) {
  // A saved but unsubmitted request shows one state, not "received" next to a separate intake line.
  const draft = workStatus === "OPEN" && intakeStatus === "IN_PROGRESS";
  return <div className={styles.progressSummary}>
    <p data-testid="work-status">{draft ? <DraftBadge /> : <WorkStatusBadge status={workStatus} />}</p>
    {draft ? null : <IntakeStatus status={intakeStatus} />}
    <div className={styles.progressMessage}>{children}</div>
  </div>;
}

/** The caller retains the native input, its accessible name and all handlers. */
export function PhotoSelectionSurface({ children, selectionCount, disabled, compact = false }: {
  children: ReactNode;
  selectionCount: number;
  disabled: boolean;
  compact?: boolean;
}) {
  return <div className={styles.photoSelectionSurface}>
    <label className={styles.photoSelectionControl} data-disabled={disabled}>
      <span aria-hidden="true">＋</span> 사진 추가
      {children}
    </label>
    {!compact ? <p className={styles.photoSelectionHint}>JPEG·PNG · 최대 3장</p> : null}
    {selectionCount > 0 ? <p className={styles.photoSelectionCount}>사진 {selectionCount}장 선택됨</p> : null}
  </div>;
}

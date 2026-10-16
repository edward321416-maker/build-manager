"use client";
import type { ReactNode } from "react";
import type { CoreUnitDto } from "@build-manager/api-contracts";
import { DateTime } from "../../../components/date-time";
import { isTenant, VIEW_LABELS, type CoreRole, type MenuRow, type NavLocation } from "./nav-config";
import { navHref } from "./nav-location";
import { plainClick } from "./core-nav";
import { todoReasonName, type TodoItem, type TodoList } from "./todo-list";
import styles from "./core-nav.module.css";

/** 더 보기 and MY as list rows (rules 8.5, 8.16): a row opens its screen; 로그아웃 is the last row. */
export function MenuList({ label, rows, organization, onOpen, onLogout }: {
  label: string; rows: MenuRow[]; organization?: ReactNode; onOpen(to: NavLocation): void; onLogout(): void;
}) {
  return <section className={styles.menuList} aria-label={label}><ul>{rows.map(row => <li key={row.label}>{
    row.kind === "view" ? <a className={styles.row} data-menu-row href={navHref(row.to)} onClick={event => { if (plainClick(event)) { event.preventDefault(); onOpen(row.to); } }}>{row.label}</a>
    : row.kind === "href" ? <a className={styles.row} data-menu-row href={row.href}>{row.label}</a>
    : row.kind === "organization" ? <div className={styles.rowBlock}>{organization}</div>
    : <button type="button" className={styles.row} data-menu-row onClick={onLogout}>{row.label}</button>
  }</li>)}</ul></section>;
}

/** 내 호실: the buildings and units this account may use. */
export function UnitsScreen({ units }: { units: readonly CoreUnitDto[] }) {
  return <section className={styles.menuList} aria-label="내 호실">{units.length
    ? <ul>{units.map(unit => <li key={unit.id} className={styles.rowBlock}><strong>{unit.label}</strong><span>{unit.buildingName}</span></li>)}</ul>
    : <p className={styles.empty}>연결된 호실이 없어요. 관리자에게 호실 연결을 확인해 주세요.</p>}</section>;
}

const INVITATIONS: NavLocation = { tab: "more", view: "invitations" };

/** 알림 (spec §5): one row per request with every reason, and one per link request; a partial read says so instead of
 * inventing a count. `disabled` locks the request rows like the 요청 rows, so photos picked on 홈 never become a
 * request's unsent photos; a link request only opens 입주 연결, so it stays a plain link. `notice` says why the rows are
 * locked. While the PR 2 reads run (a re-read too), the rows already confirmed show and a line below them says the rest
 * is coming, so the line going away never moves a row. That line lives in a polite live region that is always there
 * and sits after the list, whose aria-busy would hold back an announcement inside it (rules 12). */
export function TodoScreen({ role, list, ready, units, onOpen, onOpenPlace, onRetry, disabled = false, notice }: {
  role: CoreRole; list: TodoList; ready: boolean; units: readonly CoreUnitDto[]; onOpen(ticketId: string): void; onOpenPlace(to: NavLocation): void; onRetry(): void; disabled?: boolean; notice?: string;
}) {
  if (!ready) return <p role="status">불러오는 중이에요</p>;
  const unitLabel = (id: string) => units.find(unit => unit.id === id)?.label;
  const badges = (item: TodoItem) => <span className={styles.reasons}>{item.reasons.map(reason => <span key={reason} className={styles.reasonBadge} data-reason={reason}>{todoReasonName(role, reason)}</span>)}</span>;
  const time = (item: TodoItem) => item.lastActivity ? <span className={styles.todoTime}><DateTime at={item.lastActivity} /></span> : null;
  return <><section className={styles.todo} aria-label="처리할 일" aria-busy={list.checking ? "true" : undefined}>
    {notice ? <p className={styles.empty}>{notice}</p> : null}
    {list.partial ? <div className={styles.partial} role="alert"><p>일부를 확인하지 못했어요.</p><button type="button" onClick={onRetry}>다시 불러오기</button></div> : null}
    {list.items.length ? <ul>{list.items.map(item => item.kind === "ticket"
      ? <li key={item.ticketId}><button type="button" className={styles.todoRow} data-todo-ticket={item.ticketId} disabled={disabled} onClick={() => onOpen(item.ticketId)}>
        <span className={styles.todoTitle}>{item.issueType === "HEATING" ? "난방" : "누수"}{unitLabel(item.unitId) ? ` · ${unitLabel(item.unitId)}` : ""}</span>{badges(item)}{time(item)}
      </button></li>
      : <li key={item.invitationId}><a className={styles.todoRow} data-todo-link={item.invitationId} href={navHref(INVITATIONS)} onClick={event => { if (plainClick(event)) { event.preventDefault(); onOpenPlace(INVITATIONS); } }}>
        <span className={styles.todoTitle}>{VIEW_LABELS.invitations} · {item.unitLabel}</span>{badges(item)}{time(item)}
      </a></li>)}</ul>
    : list.partial || list.checking ? null : <p className={styles.empty}>{isTenant(role) ? "지금 처리할 일이 없어요. 새 문제가 생기면 홈에서 접수해 주세요." : "지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요."}</p>}
    {list.resultLimited ? <p className={styles.empty}>최근 끝난 요청 20건만 확인해요.</p> : null}
    {list.linksLimited ? <p className={styles.empty}>연결 요청은 100건까지만 확인했어요. 입주 연결에서 모두 볼 수 있어요.</p> : null}
  </section><div aria-live="polite">{list.checking ? <p className={styles.empty}>처리할 일을 더 확인하고 있어요.</p> : null}</div></>;
}

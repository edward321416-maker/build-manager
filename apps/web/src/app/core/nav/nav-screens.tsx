"use client";
import type { ReactNode } from "react";
import type { CoreUnitDto } from "@build-manager/api-contracts";
import { DateTime } from "../../../components/date-time";
import { isTenant, type CoreRole, type MenuRow, type NavLocation } from "./nav-config";
import { navHref } from "./nav-location";
import { plainClick } from "./core-nav";
import { todoReasonName, type TodoList } from "./todo-list";
import styles from "./core-nav.module.css";

/** 더 보기 and 내 정보 as list rows (rules 8.5, 8.16): a row opens its screen; 로그아웃 is the last row. */
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

/** 알림 (spec §5): one row per request with every reason; a partial read says so instead of inventing a count.
 * `disabled` locks the rows like the 내 요청 rows, so photos picked on 우리 집 never become a request's unsent photos. */
export function TodoScreen({ role, list, ready, units, onOpen, onRetry, disabled = false }: {
  role: CoreRole; list: TodoList; ready: boolean; units: readonly CoreUnitDto[]; onOpen(ticketId: string): void; onRetry(): void; disabled?: boolean;
}) {
  if (!ready) return <p role="status">불러오는 중이에요</p>;
  const unitLabel = (id: string) => units.find(unit => unit.id === id)?.label;
  return <section className={styles.todo} aria-label="처리할 일">
    {list.partial ? <div className={styles.partial} role="alert"><p>일부를 확인하지 못했어요.</p><button type="button" onClick={onRetry}>다시 불러오기</button></div> : null}
    {list.items.length ? <ul>{list.items.map(item => <li key={item.ticketId}>
      <button type="button" className={styles.todoRow} data-todo-ticket={item.ticketId} disabled={disabled} onClick={() => onOpen(item.ticketId)}>
        <span className={styles.todoTitle}>{item.issueType === "HEATING" ? "난방" : "누수"}{unitLabel(item.unitId) ? ` · ${unitLabel(item.unitId)}` : ""}</span>
        <span className={styles.reasons}>{item.reasons.map(reason => <span key={reason} className={styles.reasonBadge} data-reason={reason}>{todoReasonName(role, reason)}</span>)}</span>
        {item.lastActivity ? <span className={styles.todoTime}><DateTime at={item.lastActivity} /></span> : null}
      </button>
    </li>)}</ul>
    : list.partial ? null : <p className={styles.empty}>{isTenant(role) ? "지금 처리할 일이 없어요. 새 문제가 생기면 우리 집에서 접수해 주세요." : "지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요."}</p>}
  </section>;
}

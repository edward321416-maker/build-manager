"use client";
import type { CoreBuildingInfoDto, CoreBuildingListDto, CoreUnitDto } from "@build-manager/api-contracts";
import type { ReactNode } from "react";
import { HEATING_TYPE_NAMES, MANAGEMENT_MODE_NAMES } from "../../../components/status-names";
import core from "../core-design.module.css";
import styles from "./buildings.module.css";

// P6 PR 2 (spec docs/superpowers/specs/2026-10-15-building-setup-p6-design.md, approved mockup A): the building list and
// one building's screen. Names follow the shared name table (rules 8.7); a missing value says 입력 전 in the waiting
// colour, with the words carrying the meaning (rules 2.3).
export const READ_ONLY_NOTE = "체험에서는 바꿀 수 없어요.";

/** The bottom bar (rules 1, 5, 7): fixed under the content on phones, in place from 768px. `readOnly` marks the demo's
 * note, which shows once when the list and the building sit side by side (review nit). */
export function ActionBar({ children, readOnly = false }: { children: ReactNode; readOnly?: boolean }) {
  return <div className={styles.bar} data-building-bar data-read-only={readOnly ? "true" : undefined}>{children}</div>;
}

export function BuildingList({ list, selectedId, disabled, onOpen, onAdd }: {
  list: CoreBuildingListDto; selectedId: string | null; disabled: boolean; onOpen(id: string): void; onAdd(): void;
}) {
  const count = list.items.length;
  return <section className={styles.list} aria-label="건물 목록">
    <div className={styles.listHead}>
      <h2>건물 {count}곳</h2>
      <ActionBar readOnly={!list.editable}>{list.editable
        ? <button type="button" className={core.primary} disabled={disabled} onClick={onAdd}>건물 추가하기</button>
        : <p className={styles.readOnly}>{READ_ONLY_NOTE}</p>}</ActionBar>
    </div>
    {count ? <ul className={styles.rows}>{list.items.map(building => <li key={building.buildingId}>
      <button type="button" className={styles.row} data-building-row={building.buildingId} aria-current={selectedId === building.buildingId ? "true" : undefined}
        disabled={disabled} onClick={() => onOpen(building.buildingId)}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{building.displayName ?? "건물"}</span>
          <span className={styles.rowCaption}>{building.displayName ? "" : "이름 없음 · "}호실 {building.unitCount}개</span>
        </span>
        {building.needsInfo ? <span className={styles.waitLabel}>정보 입력 필요</span> : null}
      </button>
    </li>)}</ul>
    : <p className={styles.empty}>{list.editable ? "아직 건물이 없어요. 건물을 추가해 주세요." : "아직 건물이 없어요."}</p>}
  </section>;
}

/** One building: its info and its units. `units` is the session's Core unit list (building, then unit name order). */
export function BuildingDetail({ info, units, notice, disabled, onEdit, onAddUnit }: {
  info: CoreBuildingInfoDto; units: readonly CoreUnitDto[]; notice: string | null; disabled: boolean; onEdit(): void; onAddUnit(): void;
}) {
  const own = units.filter(unit => unit.buildingId === info.buildingId);
  // 모름 is a saved answer; before the first save nothing was entered yet.
  const unknown = info.version > 0 ? "모름" : null;
  const facts: [string, string | null, string | null][] = [
    ["건물 이름", info.displayName, null],
    ["업체에 알려 줄 주소", info.serviceAddress, null],
    ["난방 방식", info.heatingType ? HEATING_TYPE_NAMES[info.heatingType] : null, unknown],
    ["관리 방식", info.managementMode ? MANAGEMENT_MODE_NAMES[info.managementMode] : null, unknown],
  ];
  return <div className={styles.detail}>
    {notice ? <p role="alert">{notice}</p> : null}
    <section className={styles.section} aria-label="건물 정보">
      <div className={styles.sectionHead}>
        <h2>건물 정보</h2>
        {info.editable ? <button type="button" className={styles.editButton} disabled={disabled} onClick={onEdit}>고치기</button> : null}
      </div>
      <dl className={styles.facts}>{facts.map(([name, value, answered]) => <div key={name}>
        <dt>{name}</dt>
        <dd data-missing={value === null && answered === null ? "true" : undefined}>{value ?? answered ?? "입력 전"}</dd>
      </div>)}</dl>
    </section>
    <section className={styles.section} aria-label="호실">
      {/* The action sits beside the heading from 768px (mockup A) and in the bottom bar on phones. */}
      <div className={styles.sectionHead}>
        <h2>호실 {own.length}개</h2>
        {info.editable ? <ActionBar><button type="button" className={`${core.primary} ${styles.addUnit}`} disabled={disabled} onClick={onAddUnit}>호실 추가하기</button></ActionBar> : null}
      </div>
      {own.length ? <ul className={styles.units}>{own.map(unit => <li key={unit.id}>{unit.label}</li>)}</ul>
        : <p className={styles.empty}>{info.editable ? "아직 호실이 없어요. 호실을 추가해 주세요." : "아직 호실이 없어요."}</p>}
    </section>
    {info.editable ? null : <ActionBar readOnly><p className={styles.readOnly}>{READ_ONLY_NOTE}</p></ActionBar>}
  </div>;
}

"use client";
import { ApiClientError, type CoreFlowClient } from "@build-manager/api-client";
import type { CoreBuildingInfoDto, CoreBuildingInfoSave, CoreBuildingListDto, CoreUnitDto } from "@build-manager/api-contracts";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Toast, useToastMessage } from "../../../components/toast";
import { AddBuildingForm, AddUnitForm, BuildingInfoForm, type AddProblem, type InfoProblem, type UnitProblem } from "./building-forms";
import { LIST_PLACE, placeKey, type BuildingPlace } from "./building-place";
import { ActionBar, BuildingDetail, BuildingList, READ_ONLY_NOTE } from "./building-views";
import styles from "./buildings.module.css";

// P6 PR 2: 건물·호실 관리. Reads the organisation's buildings and the open building's info (Core), saves info (Core),
// and creates buildings and units through B3. The session's Core unit list gives each building's units in name order.
// A 401 or 403 never reaches these messages as such: the screen's guarded fetch clears the whole screen first.
const PARTIAL = "건물은 추가했어요. 이름을 저장하지 못했어요. 건물 정보에서 다시 저장해 주세요.";
const UNITS_STALE = "호실 목록을 새로 불러오지 못했어요. 위의 새로고침을 눌러 주세요.";
const status = (error: unknown) => error instanceof ApiClientError ? error.status : undefined;
const sameSave = (info: CoreBuildingInfoDto, input: CoreBuildingInfoSave) => info.displayName === input.displayName && info.serviceAddress === input.serviceAddress
  && info.heatingType === input.heatingType && info.managementMode === input.managementMode;

/** A message that belongs to one visit of one step: leaving the step and opening it again starts without it (review LOW 3). */
function useStepMessage<T>(visit: string) {
  const [message, setMessage] = useState<{ visit: string; value: T } | null>(null);
  return [message?.visit === visit ? message.value : null, (value: T | null) => setMessage(value === null ? null : { visit, value })] as const;
}

export function BuildingsScreen({ client, orgId, units, place, revision, disabled, onOpen, onReplace, onBack, onName, onUnitsChanged }: {
  client: Pick<CoreFlowClient, "buildings">; orgId: string; units: readonly CoreUnitDto[]; place: BuildingPlace; revision: number; disabled: boolean;
  onOpen(next: BuildingPlace): void;
  /** Moves made when something finishes name the step they started on; the parent skips them if the user has moved on. */
  onReplace(from: BuildingPlace, next: BuildingPlace): void; onBack(from: BuildingPlace): void;
  onName(title: { id: string | null; name: string | null }): void; onUnitsChanged(): Promise<void>;
}) {
  const id = "id" in place ? place.id : null;
  const [list, setList] = useState<CoreBuildingListDto | null>(null), [listFailed, setListFailed] = useState(false), [listRead, setListRead] = useState(0);
  const [info, setInfo] = useState<CoreBuildingInfoDto | null>(null), [infoRead, setInfoRead] = useState(0);
  const [infoFailure, setInfoFailure] = useState<{ id: string; kind: "missing" | "failed" } | null>(null);
  const [busy, setBusy] = useState(false), working = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Each time the place changes is a new visit of that step (the "adjust state while rendering" pattern, no effect).
  const key = placeKey(place);
  const [visit, setVisit] = useState({ key, count: 0 });
  if (visit.key !== key) setVisit({ key, count: visit.count + 1 });
  const step = `${key}#${visit.key === key ? visit.count : visit.count + 1}`;
  const [infoProblem, setInfoProblem] = useStepMessage<Exclude<InfoProblem, null>>(step);
  const [addProblem, setAddProblem] = useStepMessage<Exclude<AddProblem, null>>(step);
  const [unitProblem, setUnitProblem] = useStepMessage<Exclude<UnitProblem, null>>(step);
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  // The last info save sent, so a reload after an unknown result can tell whether exactly that save landed.
  const attempt = useRef<{ id: string; input: CoreBuildingInfoSave } | null>(null);
  const [toast, showToast] = useToastMessage();

  useEffect(() => {
    let live = true;
    client.buildings.list().then(value => { if (live) { setList(value); setListFailed(false); } }, () => { if (live) setListFailed(true); });
    return () => { live = false; };
  }, [client, revision, listRead]);
  useEffect(() => {
    if (!id) return;
    let live = true;
    client.buildings.read(id).then(value => { if (live) { setInfo(value); setInfoFailure(null); } },
      error => { if (live) setInfoFailure({ id, kind: status(error) === 404 ? "missing" : "failed" }); });
    return () => { live = false; };
  }, [client, id, revision, infoRead]);

  const current = id && info?.buildingId === id ? info : null;
  const infoFailed = !current && infoFailure?.id === id ? infoFailure.kind : null;
  const name = id ? (current ? current.displayName : list?.items.find(item => item.buildingId === id)?.displayName ?? null) : null;
  useEffect(() => { onName({ id, name }); }, [id, name, onName]);

  /** One write at a time; the buttons are locked while it runs. */
  const run = (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true);
    void work().finally(() => { working.current = false; if (alive.current) setBusy(false); });
  };
  /** After a write: the list again, and the session's units (names and new units). A failed unit read is said on the
   * building, since the toast alone would claim a list that did not change (review LOW 5). */
  const refreshAfterWrite = useCallback(async (buildingId: string) => {
    setListRead(n => n + 1);
    try { await onUnitsChanged(); } catch { setNotice({ id: buildingId, text: UNITS_STALE }); }
  }, [onUnitsChanged]);
  // Moves after a write happen only while the screen is still there (a 401 clears it, review open question).
  const back = (from: BuildingPlace) => { if (alive.current) onBack(from); };
  const replace = (from: BuildingPlace, next: BuildingPlace) => { if (alive.current) onReplace(from, next); };

  const saved = async (from: BuildingPlace, value: CoreBuildingInfoDto) => {
    setInfo(value); attempt.current = null;
    setNotice(shown => shown?.id === value.buildingId ? null : shown);
    await refreshAfterWrite(value.buildingId); back(from); showToast("저장했어요");
  };
  const saveInfo = (input: CoreBuildingInfoSave) => { if (id) { const from = place; run(async () => {
    setInfoProblem(null); attempt.current = { id, input };
    try { await saved(from, await client.buildings.save(id, input)); }
    catch (error) { const code = status(error); setInfoProblem(code === 409 ? "conflict" : code === 404 ? "missing" : code === 400 ? "invalid" : "uncertain"); }
  }); } };
  const reloadInfo = () => { if (id) { const from = place, afterUnknown = infoProblem === "uncertain"; run(async () => {
    try {
      const fresh = await client.buildings.read(id), sent = attempt.current?.id === id ? attempt.current : null;
      if (sent && fresh.version > sent.input.expectedVersion && sameSave(fresh, sent.input)) { setInfoProblem(null); await saved(from, fresh); return; }
      setInfo(fresh);
      // After an unknown result the reload decides: someone else's newer version, or nothing saved (review LOW 6).
      if (afterUnknown && sent) setInfoProblem(fresh.version > sent.input.expectedVersion ? "conflict" : "unsaved");
      else { setInfoProblem(null); attempt.current = null; }
    } catch (error) { setInfoProblem(status(error) === 404 ? "missing" : "uncertain"); }
  }); } };
  const addBuilding = (buildingName: string) => { const from = place; run(async () => {
    setAddProblem(null);
    let createdId: string;
    try { createdId = (await client.buildings.create(orgId, buildingName)).id; }
    catch (error) { setAddProblem(status(error) === 400 ? "invalid" : "uncertain"); return; }
    try { await client.buildings.save(createdId, { expectedVersion: 0, displayName: buildingName, serviceAddress: null, heatingType: null, managementMode: null }); }
    catch { setListRead(n => n + 1); setNotice({ id: createdId, text: PARTIAL }); replace(from, { kind: "building", id: createdId }); return; }
    setListRead(n => n + 1); replace(from, { kind: "building", id: createdId }); showToast("건물을 추가했어요");
  }); };
  const addUnit = (label: string) => { if (id) { const from = place; run(async () => {
    setUnitProblem(null);
    try { await client.buildings.addUnit(orgId, id, label); }
    catch (error) { const code = status(error); setUnitProblem(code === 409 ? "duplicate" : code === 400 ? "invalid" : "uncertain"); return; }
    setInfoRead(n => n + 1); await refreshAfterWrite(id); back(from); showToast("호실을 추가했어요");
  }); } };

  const locked = busy || disabled;
  const loading = <p role="status">불러오는 중이에요</p>;
  const problem = (text: string, action: string, onAction: () => void) =>
    <div role="alert" className={styles.problem}><p>{text}</p><button type="button" disabled={locked} onClick={onAction}>{action}</button></div>;
  const listView = list
    ? <BuildingList list={list} selectedId={place.kind === "building" ? id : null} disabled={locked} onOpen={building => onOpen({ kind: "building", id: building })} onAdd={() => onOpen({ kind: "add" })} />
    : listFailed ? problem("건물 목록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.", "다시 시도하기", () => setListRead(n => n + 1)) : loading;
  const infoView = (content: (value: CoreBuildingInfoDto) => ReactNode) => current ? content(current)
    // The list is hidden below 1120px, so a building that cannot be opened offers the way back to it (rules 8.11).
    : infoFailed === "missing" ? problem("이 건물을 열 수 없어요. 목록을 새로고침하고 다시 골라 주세요.", "목록으로 가기", () => { setListRead(n => n + 1); onReplace(place, LIST_PLACE); })
    : infoFailed === "failed" ? problem("건물 정보를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.", "다시 시도하기", () => setInfoRead(n => n + 1)) : loading;
  const readOnly = <ActionBar readOnly><p className={styles.readOnly}>{READ_ONLY_NOTE}</p></ActionBar>;

  let body: ReactNode;
  if (place.kind === "list" || place.kind === "building") {
    body = <div className={styles.workspace} data-detail={place.kind === "building" ? "true" : undefined}>
      <div className={`${styles.pane} ${styles.listPane}`}>{listView}</div>
      {place.kind === "building" ? <div className={`${styles.pane} ${styles.detailPane}`}>{infoView(value =>
        <BuildingDetail info={value} units={units} notice={notice?.id === value.buildingId ? notice.text : null} disabled={locked}
          onEdit={() => onOpen({ kind: "edit", id: value.buildingId })} onAddUnit={() => onOpen({ kind: "addUnit", id: value.buildingId })} />)}</div> : null}
    </div>;
  } else if (place.kind === "add") {
    body = <div className={styles.pane}>{!list ? listView : list.editable
      ? <AddBuildingForm busy={locked} problem={addProblem} onSubmit={addBuilding} onReload={() => { setListRead(n => n + 1); onBack(place); }} /> : readOnly}</div>;
  } else if (place.kind === "edit") {
    body = <div className={styles.pane}>{infoView(value => value.editable
      ? <BuildingInfoForm key={`${value.buildingId}:${value.version}`} info={value} busy={locked} problem={infoProblem} onSave={saveInfo} onReload={reloadInfo} /> : readOnly)}</div>;
  } else {
    const from = place;
    body = <div className={styles.pane}>{infoView(value => value.editable
      ? <AddUnitForm busy={locked} problem={unitProblem} onSubmit={addUnit} onReload={() => run(async () => { setInfoRead(n => n + 1); await refreshAfterWrite(value.buildingId); back(from); })} /> : readOnly)}</div>;
  }
  return <section className={styles.screen} aria-label="건물·호실 관리">{body}<Toast message={toast} /></section>;
}

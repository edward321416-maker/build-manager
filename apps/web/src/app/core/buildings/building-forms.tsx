"use client";
import { B3UnitCreateSchema, CoreBuildingInfoSaveSchema, type CoreBuildingInfoDto, type CoreBuildingInfoSave, type HeatingType, type ManagementMode } from "@build-manager/api-contracts";
import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { HEATING_TYPE_NAMES, MANAGEMENT_MODE_NAMES } from "../../../components/status-names";
import core from "../core-design.module.css";
import { ActionBar } from "./building-views";
import styles from "./buildings.module.css";

// P6 PR 2: the three input screens (building info, a new building, a new unit). Names and addresses use the PR 1 save
// contract, which is the vendor packet's own rule, so whatever is saved can be sent to a vendor. B3 checks unit names
// for length and ASCII controls only; the screen also refuses the vendor packet's \p{Cc}\p{Cf} so it never adds one.
const NAME_RULE = CoreBuildingInfoSaveSchema.shape.displayName;
const ADDRESS_RULE = CoreBuildingInfoSaveSchema.shape.serviceAddress;
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;
export const unitLabelValid = (label: string) => B3UnitCreateSchema.safeParse({ label }).success && !INVISIBLE.test(label);

const NAME_ERROR = "건물 이름을 1~50자로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.";
const ADDRESS_ERROR = "주소는 200자 안으로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.";
const UNIT_ERROR = "호실 이름을 1~80자로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.";
const DUPLICATE_ERROR = "이 건물에 같은 이름의 호실이 있어요. 다른 이름을 적어 주세요.";

/** A refused or unknown save (rules 8.11): what happened and, when it helps, the one thing to do next. */
function Problem({ text, action, disabled, onAction }: { text: string; action?: string; disabled: boolean; onAction(): void }) {
  return <div role="alert" className={styles.problem}><p>{text}</p>{action ? <button type="button" disabled={disabled} onClick={onAction}>{action}</button> : null}</div>;
}

/** Label above, help or error below in the same place (rules 8.2); the error also marks the field. */
function TextField({ label, value, onChange, help, error, placeholder, inputRef }: {
  label: string; value: string; onChange(value: string): void; help: string; error: string | null; placeholder?: string; inputRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId(), note = id + "-note";
  return <div className={styles.field}>
    <label htmlFor={id} className={styles.fieldLabel}>{label}</label>
    <input ref={inputRef} id={id} className={styles.control} value={value} placeholder={placeholder} autoComplete="off" spellCheck={false}
      aria-invalid={error ? "true" : undefined} aria-describedby={note} onChange={event => onChange(event.target.value)} />
    <p id={note} className={error ? styles.fieldError : styles.help}>{error ?? help}</p>
  </div>;
}

type Tile<T extends string> = { value: T | ""; name: string; caption: string };
const HEATING_TILES: readonly Tile<HeatingType>[] = [
  { value: "INDIVIDUAL", name: HEATING_TYPE_NAMES.INDIVIDUAL, caption: "집마다 보일러" },
  { value: "CENTRAL_SHARED", name: HEATING_TYPE_NAMES.CENTRAL_SHARED, caption: "건물 공용 설비" },
  { value: "", name: "모름", caption: "세입자에게 물어요" },
];
const MANAGEMENT_TILES: readonly Tile<ManagementMode>[] = [
  { value: "OWNER_DIRECT", name: MANAGEMENT_MODE_NAMES.OWNER_DIRECT, caption: "건물주가 처리" },
  { value: "MANAGEMENT_OFFICE", name: MANAGEMENT_MODE_NAMES.MANAGEMENT_OFFICE, caption: "사무소가 처리" },
  { value: "", name: "모름", caption: "관리자가 검토" },
];
/** Choice tiles (rules 8.3): a visible radio in each, `data-tile` for the design audit. 모름 is "" and saves null. */
function TileGroup<T extends string>({ legend, tiles, value, onChange }: { legend: string; tiles: readonly Tile<T>[]; value: T | ""; onChange(value: T | ""): void }) {
  const name = useId();
  return <fieldset className={styles.tiles}><legend>{legend}</legend><div className={styles.tileGrid}>{tiles.map(tile =>
    <label key={tile.value || "unknown"} className={styles.tile} data-tile>
      <span className={styles.tileName}><input type="radio" name={name} value={tile.value} checked={value === tile.value} onChange={() => onChange(tile.value)} />{tile.name}</span>
      <span className={styles.tileCaption}>{tile.caption}</span>
    </label>)}</div></fieldset>;
}

export type InfoProblem = "conflict" | "uncertain" | "missing" | "invalid" | null;
const INFO_PROBLEMS: Record<Exclude<InfoProblem, null>, { text: string; reload: boolean }> = {
  conflict: { text: "다른 관리자가 먼저 고쳤어요. 새로 불러온 내용을 확인하고 다시 저장해 주세요.", reload: true },
  uncertain: { text: "저장 결과를 확인하지 못했어요. 새로 불러와 저장됐는지 확인해 주세요.", reload: true },
  missing: { text: "이 건물을 열 수 없어요. 목록을 새로고침하고 다시 골라 주세요.", reload: false },
  invalid: { text: "입력한 내용을 저장하지 못했어요. 건물 이름과 주소를 확인해 주세요.", reload: false },
};

/** Building info. The fields start from `info`; the screen remounts the form when a reload brings a new version. */
export function BuildingInfoForm({ info, busy, problem, onSave, onReload }: {
  info: CoreBuildingInfoDto; busy: boolean; problem: InfoProblem; onSave(input: CoreBuildingInfoSave): void; onReload(): void;
}) {
  const [name, setName] = useState(info.displayName ?? ""), [address, setAddress] = useState(info.serviceAddress ?? "");
  const [heating, setHeating] = useState<HeatingType | "">(info.heatingType ?? ""), [management, setManagement] = useState<ManagementMode | "">(info.managementMode ?? "");
  const [errors, setErrors] = useState({ name: false, address: false });
  const nameRef = useRef<HTMLInputElement>(null), addressRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsedName = NAME_RULE.safeParse(name);
    // An empty address (or only spaces) means none: the save contract takes null, never an empty string.
    const parsedAddress = address.trim() ? ADDRESS_RULE.safeParse(address) : { success: true as const, data: null };
    setErrors({ name: !parsedName.success, address: !parsedAddress.success });
    if (!parsedName.success) { nameRef.current?.focus(); return; }
    if (!parsedAddress.success) { addressRef.current?.focus(); return; }
    onSave({ expectedVersion: info.version, displayName: parsedName.data, serviceAddress: parsedAddress.data, heatingType: heating || null, managementMode: management || null });
  };
  const shown = problem ? INFO_PROBLEMS[problem] : null;
  return <form noValidate className={styles.form} onSubmit={submit}>
    {shown ? <Problem text={shown.text} action={shown.reload ? "새로 불러오기" : undefined} disabled={busy} onAction={onReload} /> : null}
    <fieldset className={styles.fields} disabled={busy}>
      <TextField label="건물 이름" value={name} onChange={setName} inputRef={nameRef} help="세입자와 업체에게 보이는 이름이에요." error={errors.name ? NAME_ERROR : null} />
      <TextField label="업체에 알려 줄 주소" value={address} onChange={setAddress} inputRef={addressRef} placeholder="예: 서울시 예시구 예시로 12"
        help="업체에 수리를 맡길 때만 보내요. 호수는 적지 않아요." error={errors.address ? ADDRESS_ERROR : null} />
      <TileGroup legend="난방 방식" tiles={HEATING_TILES} value={heating} onChange={setHeating} />
      <TileGroup legend="관리 방식" tiles={MANAGEMENT_TILES} value={management} onChange={setManagement} />
      <p className={styles.note}>고른 값은 세입자 질문과 처리 경로 추천에 쓰여요. 추천은 늘 관리자가 확인해요.</p>
      <ActionBar><button type="submit" className={core.primary}>저장하기</button></ActionBar>
    </fieldset>
  </form>;
}

export type AddProblem = "invalid" | "uncertain" | null;
export function AddBuildingForm({ busy, problem, onSubmit, onReload }: { busy: boolean; problem: AddProblem; onSubmit(name: string): void; onReload(): void }) {
  const [name, setName] = useState(""), [error, setError] = useState(false), ref = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = NAME_RULE.safeParse(name);
    setError(!parsed.success);
    if (!parsed.success) { ref.current?.focus(); return; }
    onSubmit(parsed.data);
  };
  return <form noValidate className={styles.form} onSubmit={submit}>
    {problem === "uncertain" ? <Problem text="건물을 추가했는지 확인하지 못했어요. 목록을 새로 불러와 확인한 뒤 필요하면 다시 추가해 주세요." action="목록 새로 불러오기" disabled={busy} onAction={onReload} /> : null}
    <h2>어떤 건물인가요?</h2>
    <fieldset className={styles.fields} disabled={busy}>
      <TextField label="건물 이름" value={name} onChange={setName} inputRef={ref} placeholder="예: 햇살빌라" help="추가한 뒤 건물 화면에서 주소와 난방·관리 방식을 넣어요."
        error={error || problem === "invalid" ? NAME_ERROR : null} />
      <ActionBar><button type="submit" className={core.primary}>건물 추가하기</button></ActionBar>
    </fieldset>
  </form>;
}

export type UnitProblem = "invalid" | "duplicate" | "uncertain" | null;
export function AddUnitForm({ busy, problem, onSubmit, onReload }: { busy: boolean; problem: UnitProblem; onSubmit(label: string): void; onReload(): void }) {
  const [label, setLabel] = useState(""), [error, setError] = useState(false), ref = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = label.trim(), valid = unitLabelValid(value);
    setError(!valid);
    if (!valid) { ref.current?.focus(); return; }
    onSubmit(value);
  };
  const fieldError = error || problem === "invalid" ? UNIT_ERROR : problem === "duplicate" ? DUPLICATE_ERROR : null;
  return <form noValidate className={styles.form} onSubmit={submit}>
    {problem === "uncertain" ? <Problem text="호실을 추가했는지 확인하지 못했어요. 호실 목록을 새로 불러와 확인한 뒤 필요하면 다시 추가해 주세요." action="새로 불러오기" disabled={busy} onAction={onReload} /> : null}
    <h2>어떤 호실인가요?</h2>
    <fieldset className={styles.fields} disabled={busy}>
      <TextField label="호실 이름" value={label} onChange={setLabel} inputRef={ref} placeholder="예: 101호" help="세입자와 업체에게 보이는 이름이에요." error={fieldError} />
      <ActionBar><button type="submit" className={core.primary}>호실 추가하기</button></ActionBar>
    </fieldset>
  </form>;
}

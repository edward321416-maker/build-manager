# E1 Excel (CSV) Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Managers download the 업무함 rows they see, and one unit's 호실 정비 이력, as a CSV file that opens cleanly in Korean Excel.

**Architecture:** The browser builds the file from the list the screen already holds; no API, server, DB or permission change. A pure CSV module (quoting, formula blocking, BOM, file name, download), a pure row module (column order, Seoul time, screen name tables), a small toast, and a button on each screen.

**Tech Stack:** Next.js 16 web app (`apps/web`), React 19.2.3, TypeScript strict, Vitest 5 (`// @vitest-environment jsdom` for DOM tests), Playwright 1.63 (`test:e2e:core`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-15-excel-export-e1-design.md` (same branch). Risk tier **high** (DEV-04): failing test first, `test:postgres` and `test:e2e:core`, independent review, `ops/` acceptance record.
- No new dependency, no API/contract/server/migration/permission change, no mobile change.
- File: UTF-8 with BOM `EF BB BF`, comma separator, CRLF line ends, header row first, every cell in double quotes with inner quotes doubled (RFC 4180).
- Formula blocking: a cell whose first character is one of `=` `+` `-` `@` tab CR LF `＝` `＋` `－` `＠` gets a leading `'` (OWASP CSV Injection).
- Times: Seoul time `YYYY-MM-DD HH:MM` (seconds dropped) through `instantToSeoulLocal` in `apps/web/src/lib/date-text.ts`; never the browser zone.
- 업무함 columns, in order: `접수 시각, 건물, 호실, 문제, 처리 상태, 긴급도, 담당자, 처리 예정, 마지막 변경, 요청 번호, 비고`.
- 호실 정비 이력 columns, in order: `관리자 처리 완료, 건물, 호실, 문제, 조치, 부품·위치, 세입자 응답, 정정, 사실 기록, 근거 요청 번호, 비고`. `비고` is always empty.
- File names: `업무함_YYYY-MM-DD.csv`, `정비이력_{건물}_{호실}_YYYY-MM-DD.csv` (Seoul date of the download; `\ / : * ? " < > |` and control characters become `_`, spaces are removed).
- Never in a file: tenant name or contact, tenant text, photos, internal notes, conversation, vendor data.
- Copy (해요체, design rules §10): button `엑셀로 받기`; toast `업무함 {N}건을 엑셀 파일(CSV)로 받았어요.` / `정비 이력 {N}건을 엑셀 파일(CSV)로 받았어요.`; failure (alert, never a toast) `파일을 만들지 못했어요. 다시 받아 주세요.`
- Button is a secondary button (design rules 8.1) and is disabled while loading, after a load error, with 0 visible rows, or while the screen is busy (`disabled`).
- Toast (design rules 8.9): bottom centre, 10px above the tab bar at 767px and below, `text` background, `text-inverse` `label` text, radius 10px, max width 32rem, `--shadow-float`, layer 40, 3 seconds, `motion-base` slide without opacity (rules 6.5), off under `prefers-reduced-motion`.
- Code style: match the surrounding compact style (short arrow functions, few line breaks), TypeScript strict, existing name tables (`WORK_STATUS_NAMES`, `priorityLabels`, maintenance labels).
- Commits: Conventional Commits, scope `web`, stage named paths only. End every message with the session's `Co-Authored-By` trailer: set `CO_AUTHOR` to that line before committing (it is not written in this file because the repository check rejects e-mail addresses in files).

## Working directory and commands

- Worktree: `D:\Users\admin\Desktop\모두의 창업 2기\worktree\build-manager-excel-export-e1`, branch `feat/excel-export-e1`. Merge `origin/main` once #161 (landlord research) is merged, before the PR.
- Shell: Git Bash. Unit tests: `npm --workspace @build-manager/web run test -- <path>` from the worktree root.
- Before the full checks run `docker ps` and stop leftover testcontainers (DEV-15). If another session announced browser tests on port 3123, wait.

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `apps/web/src/lib/csv-file.ts` | new | `csvCell`, `csvText`, `csvFileName`, `downloadCsv` |
| `apps/web/src/lib/csv-file.test.ts` | new | unit tests (jsdom for the download) |
| `apps/web/src/app/core/maintenance-labels.ts` | new | `actionLabels`, `reasonLabels`, `outcomeLabels` moved out of the timeline component so the export can import them without a cycle |
| `apps/web/src/app/core/export-rows.ts` | new | headers, row builders, `exportDate` |
| `apps/web/src/app/core/export-rows.test.ts` | new | unit tests incl. a non-Seoul `TZ` |
| `apps/web/src/components/toast.tsx`, `toast.module.css` | new | `useToastMessage`, `Toast` |
| `apps/web/src/components/toast.test.tsx` | new | toast timing and live region |
| `apps/web/src/app/core/manager-work.tsx`, `manager-work.module.css` | modify | 업무함 button, alert, toast |
| `apps/web/src/app/core/manager-work-export.test.tsx` | new | queue export tests |
| `apps/web/src/app/core/manager-maintenance-timeline.tsx`, `.module.css` | modify | label import, history button, alert, toast, heading wrap |
| `apps/web/src/app/core/manager-maintenance-timeline.test.tsx` | modify | new props, button states |
| `apps/web/src/app/core/manager-maintenance-export.test.tsx` | new | history export tests |
| `apps/web/tests/core-e2e/manager-work.spec.ts`, `maintenance-fact.spec.ts` | modify | real download tests |
| `ops/excel_export_e1_20261015_acceptance.md`, `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md`, `STATUS.md` | new/modify | records |

---

### Task 1: CSV file module

**Files:**
- Create: `apps/web/src/lib/csv-file.ts`
- Test: `apps/web/src/lib/csv-file.test.ts`

**Interfaces:**
- Produces: `csvCell(value:string):string`, `csvText(header:readonly string[],rows:readonly (readonly string[])[]):string`, `csvFileName(parts:readonly string[],date:string):string`, `downloadCsv(fileName:string,text:string):void`.

- [ ] **Step 1: Create stubs that compile but behave wrongly** (so the RED step fails on behaviour, not on a missing import, R06)

```ts
// apps/web/src/lib/csv-file.ts (stub for the RED step)
export function csvCell(value:string):string{return value;}
export function csvText(header:readonly string[],rows:readonly (readonly string[])[]):string{return [header,...rows].join("\n");}
export function csvFileName(parts:readonly string[],date:string):string{return parts.join("")+date;}
export function downloadCsv(fileName:string,text:string):void{void fileName;void text;}
```

- [ ] **Step 2: Write the failing tests**

```ts
// apps/web/src/lib/csv-file.test.ts
// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { csvCell,csvFileName,csvText,downloadCsv } from "./csv-file";

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it("quotes every cell and doubles inner quotes (RFC 4180)",()=>{
  expect(csvCell("김 담당")).toBe('"김 담당"');expect(csvCell('A동 "1층"')).toBe('"A동 ""1층"""');
  expect(csvCell("A동, 1층")).toBe('"A동, 1층"');expect(csvCell("줄\n바꿈")).toBe('"줄\n바꿈"');expect(csvCell("")).toBe('""');
});
it("keeps each formula start as text with a leading apostrophe (OWASP CSV Injection)",()=>{
  for(const start of ["=","+","-","@","\t","\r","\n","＝","＋","－","＠"])expect(csvCell(`${start}1+1`)).toBe(`"'${start}1+1"`);
  expect(csvCell('=HYPERLINK("https://example.invalid","보기")')).toBe('"\'=HYPERLINK(""https://example.invalid"",""보기"")"');
});
it("leaves a formula character in the middle alone, so dates and unit names stay as they are",()=>{
  expect(csvCell("101-1203")).toBe('"101-1203"');expect(csvCell("a=b")).toBe('"a=b"');expect(csvCell("2026-10-14 18:00")).toBe('"2026-10-14 18:00"');
});
it("starts with a BOM, ends every line with CRLF and keeps a quote-and-comma trick inside one cell",()=>{
  expect(csvText(["가","나"],[["1",'x",=1+2'],["2",""]])).toBe('\uFEFF"가","나"\r\n"1","x"",=1+2"\r\n"2",""\r\n');
});
it("builds a file name without path, reserved or control characters and without spaces",()=>{
  expect(csvFileName(["정비이력","해솔빌라","101동 1203호"],"2026-10-15")).toBe("정비이력_해솔빌라_101동1203호_2026-10-15.csv");
  expect(csvFileName(["정비이력","../a:b*c?","x\u0007y"],"2026-10-15")).toBe("정비이력_.._a_b_c__x_y_2026-10-15.csv");
  expect(csvFileName(["업무함"],"2026-10-15")).toBe("업무함_2026-10-15.csv");
});
it("saves through a temporary download link and releases the object URL a minute later",()=>{
  vi.useFakeTimers();const created:Blob[]=[],original={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  URL.createObjectURL=vi.fn((blob:Blob)=>{created.push(blob);return "blob:synthetic-csv";});URL.revokeObjectURL=vi.fn();
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){
    expect(this.download).toBe("업무함_2026-10-15.csv");expect(this.getAttribute("href")).toBe("blob:synthetic-csv");expect(this.isConnected).toBe(true);
  });
  try{
    const text=csvText(["가"],[["값"]]);downloadCsv("업무함_2026-10-15.csv",text);
    expect(click).toHaveBeenCalledTimes(1);expect(document.querySelector("a")).toBeNull();
    expect(created[0].type).toBe("text/csv;charset=utf-8");expect(created[0].size).toBe(new TextEncoder().encode(text).length);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();vi.advanceTimersByTime(60_000);expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-csv");
  }finally{URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});
```

- [ ] **Step 3: Run and confirm the failures are assertion failures**

Run: `npm --workspace @build-manager/web run test -- src/lib/csv-file.test.ts`
Expected: 6 failed, each an `expected … to be …` / `toHaveBeenCalledTimes` mismatch (no import or syntax error).

- [ ] **Step 4: Implement**

```ts
// apps/web/src/lib/csv-file.ts
/**
 * CSV files the manager screens hand to Excel (E1 spec docs/superpowers/specs/2026-10-15-excel-export-e1-design.md).
 * UTF-8 with a BOM so Korean Windows Excel does not read it in the legacy code page; comma separated, CRLF line ends and
 * every cell quoted with inner quotes doubled (RFC 4180). A cell that starts with a character a spreadsheet may run as a
 * formula gets a leading apostrophe (OWASP CSV Injection); quoting every cell keeps a quote-and-comma trick from moving a
 * formula to the start of a new cell.
 */
const FORMULA_START=new Set(["=","+","-","@","\t","\r","\n","＝","＋","－","＠"]);
const FILE_NAME_UNSAFE=/[\\/:*?"<>|]|\p{Cc}/gu;
export function csvCell(value:string):string{const text=FORMULA_START.has(value.charAt(0))?`'${value}`:value;return `"${text.replaceAll('"','""')}"`;}
export function csvText(header:readonly string[],rows:readonly (readonly string[])[]):string{return "\uFEFF"+[header,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";}
/** `정비이력_해솔빌라_101동1203호_2026-10-15.csv`: unsafe characters become `_` and spaces go. */
export function csvFileName(parts:readonly string[],date:string):string{return [...parts.map(part=>part.replace(FILE_NAME_UNSAFE,"_").replace(/\s+/gu,"")),date].join("_")+".csv";}
/** Saves the text through a temporary link. The object URL is released a minute later so a slow save can still read it. */
export function downloadCsv(fileName:string,text:string):void{
  const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
  link.href=url;link.download=fileName;link.hidden=true;document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
}
```

- [ ] **Step 5: Run and confirm all pass**

Run: `npm --workspace @build-manager/web run test -- src/lib/csv-file.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/csv-file.ts apps/web/src/lib/csv-file.test.ts
git commit -m "feat(web): build quoted, formula-safe CSV files with a BOM for Excel" -m "$CO_AUTHOR"
```

### Task 2: Shared maintenance labels and the export rows

**Files:**
- Create: `apps/web/src/app/core/maintenance-labels.ts`, `apps/web/src/app/core/export-rows.ts`
- Modify: `apps/web/src/app/core/manager-maintenance-timeline.tsx:7-9` (the three label constants)
- Test: `apps/web/src/app/core/export-rows.test.ts`

**Interfaces:**
- Consumes: `instantToSeoulLocal(at:string):{date:string;time:string}`, `WORK_STATUS_NAMES`, `priorityLabels`.
- Produces: `actionLabels`, `reasonLabels`, `outcomeLabels` (same types as today); `WORK_EXPORT_HEADER`, `MAINTENANCE_EXPORT_HEADER` (readonly string tuples); `workExportRows(items:readonly CoreManagerWorkItem[]):string[][]`; `maintenanceExportRows(facts:readonly CoreUnitMaintenanceFact[]):string[][]`; `exportDate(now:Date):string`.

- [ ] **Step 1: Move the label tables (no behaviour change)**

```ts
// apps/web/src/app/core/maintenance-labels.ts
import type { CoreMaintenanceActionKind,CoreMaintenanceCorrectionReason,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
// One set of names for the maintenance screens and their CSV file: a file never names a state anew (design rules 8.7).
export const actionLabels:Record<CoreMaintenanceActionKind,string>={INSPECTION:"점검",REPAIR:"수리",PART_REPLACEMENT:"부품 교체",ADJUSTMENT:"조정",OTHER:"기타"};
export const reasonLabels:Record<CoreMaintenanceCorrectionReason,string>={ACTION_CLASSIFICATION:"작업 분류 정정",COMPONENT_LABEL:"부품·위치 명칭 정정",OTHER:"기타 정정"};
export const outcomeLabels:Record<CoreUnitMaintenanceFact["tenantOutcome"],string>={UNCONFIRMED:"세입자 응답 미확인",RESOLVED:"세입자가 해결됐다고 응답",UNRESOLVED:"세입자가 아직 문제가 있다고 응답",RECURRENCE_CLAIM:"세입자가 다시 문제가 생겼다고 응답"};
```

In `manager-maintenance-timeline.tsx` delete lines 7–9 (`const actionLabels…`, `const reasonLabels…`, `const outcomeLabels…`) and add after line 6:

```ts
import { actionLabels,outcomeLabels,reasonLabels } from "./maintenance-labels";
```

Then drop the now-unused type imports from line 4 only if `npm run lint` reports them (`CoreMaintenanceActionKind` and `CoreMaintenanceCorrectionReason` are still used by the component's props, so keep them).

Run: `npm --workspace @build-manager/web run test -- src/app/core/manager-maintenance-timeline.test.tsx`
Expected: all existing tests pass (pure move).

- [ ] **Step 2: Create the row module as a wrong stub**

```ts
// apps/web/src/app/core/export-rows.ts (stub for the RED step)
import type { CoreManagerWorkItem,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
export const WORK_EXPORT_HEADER=[] as readonly string[];
export const MAINTENANCE_EXPORT_HEADER=[] as readonly string[];
export const workExportRows=(items:readonly CoreManagerWorkItem[]):string[][]=>items.map(()=>[]);
export const maintenanceExportRows=(facts:readonly CoreUnitMaintenanceFact[]):string[][]=>facts.map(()=>[]);
export const exportDate=(now:Date)=>now.toISOString().slice(0,10);
```

- [ ] **Step 3: Write the failing tests**

```ts
// apps/web/src/app/core/export-rows.test.ts
import { expect,it } from "vitest";
import type { CoreManagerWorkItem,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { MAINTENANCE_EXPORT_HEADER,WORK_EXPORT_HEADER,exportDate,maintenanceExportRows,workExportRows } from "./export-rows";

const item:CoreManagerWorkItem={ticketId:"5f0c2a1e-7d4b-4c1a-9e2f-3a6b8c0d9b31",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",issueType:"LEAK",workStatus:"IN_PROGRESS",priority:"URGENT",assigneeLabel:"합성 담당",dueAt:"2026-10-14T09:00:00Z",createdAt:"2026-10-13T00:12:00Z",updatedAt:"2026-10-14T02:40:00Z",version:3};
const fact:CoreUnitMaintenanceFact={factId:"fact",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",sourceTicketId:"7d21c0aa-1b2c-4d5e-8f90-1a2b3c4d4e90",issueType:"HEATING",actionKind:"PART_REPLACEMENT",componentLabel:"합성 배관",sourceCompletedAt:"2026-10-09T06:20:00Z",recordedAt:"2026-10-09T06:45:00Z",corrected:false,correctionCount:0,tenantOutcome:"RESOLVED",previousTicketId:null,followUpTicketId:null};
const withZone=<T,>(zone:string,run:()=>T):T=>{const before=process.env.TZ;process.env.TZ=zone;try{return run();}finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}};

it("orders both files like landlords' ledgers: the date first, the request number toward the end, an empty 비고 last",()=>{
  expect(WORK_EXPORT_HEADER).toEqual(["접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"]);
  expect(MAINTENANCE_EXPORT_HEADER).toEqual(["관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"]);
});
it("writes a work row with the screen's names and Seoul time",()=>{
  expect(workExportRows([item])).toEqual([["2026-10-13 09:12","합성 건물","101동 1203호","누수","처리 중","긴급","합성 담당","2026-10-14 18:00","2026-10-14 11:40",item.ticketId,""]]);
});
it("leaves a missing assignee and due date as empty cells",()=>{
  expect(workExportRows([{...item,assigneeLabel:null,dueAt:null,workStatus:"OPEN",priority:"NORMAL",issueType:"HEATING"}])[0]).toEqual(["2026-10-13 09:12","합성 건물","101동 1203호","난방","접수됨","보통","","","2026-10-14 11:40",item.ticketId,""]);
});
it("writes a maintenance row with the timeline's names, the correction count and the source request",()=>{
  expect(maintenanceExportRows([fact])).toEqual([["2026-10-09 15:20","합성 건물","101동 1203호","난방","부품 교체","합성 배관","세입자가 해결됐다고 응답","0회","2026-10-09 15:45",fact.sourceTicketId,""]]);
  expect(maintenanceExportRows([{...fact,componentLabel:null,correctionCount:2,tenantOutcome:"UNCONFIRMED"}])[0].slice(5,8)).toEqual(["부품·위치 명칭 미기록","세입자 응답 미확인","2회"]);
});
it("keeps Seoul time and the Seoul download date whatever zone the browser is in",()=>{
  const rows=withZone("America/Los_Angeles",()=>({work:workExportRows([item]),facts:maintenanceExportRows([fact]),date:exportDate(new Date("2026-10-14T15:30:00Z"))}));
  expect(rows.work[0][0]).toBe("2026-10-13 09:12");expect(rows.facts[0][0]).toBe("2026-10-09 15:20");expect(rows.date).toBe("2026-10-15");
});
it("keeps the given order and never adds tenant text",()=>{
  const second={...item,ticketId:"a83d77b0-41c5-4f0e-8d7a-6b2e9f3c1c02"};
  expect(workExportRows([second,item]).map(row=>row[9])).toEqual([second.ticketId,item.ticketId]);
  expect(JSON.stringify(workExportRows([item]))).not.toMatch(/rawUserText|메모|연락처/);
});
```

- [ ] **Step 4: Run and confirm assertion failures**

Run: `npm --workspace @build-manager/web run test -- src/app/core/export-rows.test.ts`
Expected: 6 failed on `toEqual`/`toBe` mismatches.

- [ ] **Step 5: Implement**

```ts
// apps/web/src/app/core/export-rows.ts
import type { CoreManagerWorkItem,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { WORK_STATUS_NAMES } from "../../components/status-names";
import { instantToSeoulLocal } from "../../lib/date-text";
import { actionLabels,outcomeLabels } from "./maintenance-labels";
import { priorityLabels } from "./manager-work-order";

// Columns follow landlords' repair ledgers: the date first, the request number toward the end and an empty 비고 for the
// reader's own notes (operator decision 2026-10-15, CLM-213). Names come from the screens' own tables.
const issueNames={HEATING:"난방",LEAK:"누수"} as const;
const seoul=(at:string|null)=>{if(!at)return "";const {date,time}=instantToSeoulLocal(at);return `${date} ${time}`;};
/** The Seoul calendar date for the file name, whatever zone the browser is in. */
export const exportDate=(now:Date)=>instantToSeoulLocal(now.toISOString()).date;
export const WORK_EXPORT_HEADER=["접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"] as const;
export const workExportRows=(items:readonly CoreManagerWorkItem[]):string[][]=>items.map(x=>[seoul(x.createdAt),x.buildingName,x.unitLabel,issueNames[x.issueType],WORK_STATUS_NAMES[x.workStatus],priorityLabels[x.priority],x.assigneeLabel??"",seoul(x.dueAt),seoul(x.updatedAt),x.ticketId,""]);
export const MAINTENANCE_EXPORT_HEADER=["관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"] as const;
export const maintenanceExportRows=(facts:readonly CoreUnitMaintenanceFact[]):string[][]=>facts.map(f=>[seoul(f.sourceCompletedAt),f.buildingName,f.unitLabel,issueNames[f.issueType],actionLabels[f.actionKind],f.componentLabel??"부품·위치 명칭 미기록",outcomeLabels[f.tenantOutcome],`${f.correctionCount}회`,seoul(f.recordedAt),f.sourceTicketId,""]);
```

- [ ] **Step 6: Run and confirm all pass**

Run: `npm --workspace @build-manager/web run test -- src/app/core/export-rows.test.ts src/app/core/manager-maintenance-timeline.test.tsx`
Expected: all passed.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/core/maintenance-labels.ts apps/web/src/app/core/manager-maintenance-timeline.tsx apps/web/src/app/core/export-rows.ts apps/web/src/app/core/export-rows.test.ts
git commit -m "feat(web): lay out the to-do and unit-history CSV rows like landlords' ledgers in Seoul time" -m "$CO_AUTHOR"
```

### Task 3: Toast

**Files:**
- Create: `apps/web/src/components/toast.tsx`, `apps/web/src/components/toast.module.css`
- Test: `apps/web/src/components/toast.test.tsx`

**Interfaces:**
- Produces: `useToastMessage():readonly [message:string,show:(message:string)=>void]`; `Toast({message}:{message:string})` renders an always-present polite live region in place plus, while `message` is not empty, a visible note portalled to `document.body` with `data-toast` and `aria-hidden="true"`.

Why the portal: the queue card sets `container-type: inline-size` and `overflow: clip` (`manager-work.module.css:2`), which makes it the containing block of any `position: fixed` child, so an in-place toast would sit inside the card.

- [ ] **Step 1: Create a wrong stub**

```tsx
// apps/web/src/components/toast.tsx (stub for the RED step)
"use client";
export function useToastMessage():readonly [string,(message:string)=>void]{return ["",()=>{}] as const;}
export function Toast({message}:{message:string}){void message;return null;}
```

- [ ] **Step 2: Write the failing tests**

```tsx
// apps/web/src/components/toast.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach,expect,it,vi } from "vitest";
import { Toast,useToastMessage } from "./toast";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.useRealTimers();});
const note="업무함 2건을 엑셀 파일(CSV)로 받았어요.";
function Harness(){const [message,show]=useToastMessage();return <><button onClick={()=>show(note)}>보이기</button><Toast message={message}/></>;}
async function mount(){vi.useFakeTimers();host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<Harness/>));}
const show=()=>act(async()=>host!.querySelector("button")!.click());
const visible=()=>document.body.querySelector("[data-toast]")?.textContent??null;
const live=()=>host!.querySelector('[role="status"]')?.textContent??null;

it("keeps an empty polite live region in place and shows nothing before a result",async()=>{
  await mount();expect(live()).toBe("");expect(visible()).toBeNull();
});
it("shows the note on <body>, outside the card, for 3 seconds and tells screen readers once",async()=>{
  await mount();await show();
  expect(visible()).toBe(note);expect(live()).toBe(note);
  const toast=document.body.querySelector("[data-toast]")!;expect(host!.contains(toast)).toBe(false);expect(toast.getAttribute("aria-hidden")).toBe("true");
  await act(async()=>{vi.advanceTimersByTime(2_999);});expect(visible()).toBe(note);
  await act(async()=>{vi.advanceTimersByTime(1);});expect(visible()).toBeNull();expect(live()).toBe("");
});
it("restarts the 3 seconds when the same note is shown again",async()=>{
  await mount();await show();await act(async()=>{vi.advanceTimersByTime(2_000);});await show();
  await act(async()=>{vi.advanceTimersByTime(2_000);});expect(visible()).toBe(note);
  await act(async()=>{vi.advanceTimersByTime(1_000);});expect(visible()).toBeNull();
});
it("renders only the live region on the server",()=>{
  const html=renderToStaticMarkup(<Toast message=""/>);expect(html).toContain('role="status"');expect(html).not.toContain("data-toast");
});
```

- [ ] **Step 3: Run and confirm assertion failures**

Run: `npm --workspace @build-manager/web run test -- src/components/toast.test.tsx`
Expected: 4 failed on `toBe`/`toContain` mismatches.

- [ ] **Step 4: Implement**

```tsx
// apps/web/src/components/toast.tsx
"use client";
import { useEffect,useState } from "react";
import { createPortal } from "react-dom";
import styles from "./toast.module.css";

/** Design rules 8.9: a light success note shown for 3 seconds; showing it again restarts the 3 seconds. */
export function useToastMessage():readonly [string,(message:string)=>void]{
  const [toast,setToast]=useState({message:"",id:0});
  useEffect(()=>{if(!toast.message)return;const timer=setTimeout(()=>setToast(current=>current.id===toast.id?{message:"",id:current.id}:current),3_000);return()=>clearTimeout(timer);},[toast]);
  return [toast.message,(message:string)=>setToast(current=>({message,id:current.id+1}))] as const;
}
/**
 * Screen readers hear the note through a polite live region that stays in place (design rules 12). The visible note
 * goes to <body>: list cards set container-type, which would make a fixed box sit inside the card.
 */
export function Toast({message}:{message:string}){
  return <><span role="status" className={styles.live}>{message}</span>{message&&typeof document!=="undefined"?createPortal(<div className={styles.toast} aria-hidden="true" data-toast>{message}</div>,document.body):null}</>;
}
```

```css
/* apps/web/src/components/toast.module.css — design rules 8.9 (toast), 6.4 (layer 40), 6.5 (no opacity), 9 (motion). */
.live { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.toast { position: fixed; left: 50%; bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px)); z-index: 40; box-sizing: border-box; width: max-content; max-width: min(32rem, calc(100vw - 2.5rem)); padding: .9375rem 1.25rem; border-radius: .625rem; background: var(--color-text); color: var(--color-text-inverse); font-size: .9375rem; line-height: 1.25rem; font-weight: 600; letter-spacing: -0.01em; text-align: center; overflow-wrap: anywhere; box-shadow: var(--shadow-float); transform: translateX(-50%); animation: toast-in var(--motion-base) var(--ease); }
/* 10px above the 56px tab bar where the tab bar shows (rules 8.14). */
@media (max-width: 767px) { .toast { bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px) + .625rem); } }
@keyframes toast-in { from { transform: translate(-50%, .625rem); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
```

- [ ] **Step 5: Run and confirm all pass**

Run: `npm --workspace @build-manager/web run test -- src/components/toast.test.tsx`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/toast.tsx apps/web/src/components/toast.module.css apps/web/src/components/toast.test.tsx
git commit -m "feat(web): add the design-rules toast with a polite live region" -m "$CO_AUTHOR"
```

### Task 4: 업무함 button

**Files:**
- Modify: `apps/web/src/app/core/manager-work.tsx:1-47` (`ManagerWorkQueue` only), `apps/web/src/app/core/manager-work.module.css` (one rule)
- Test: `apps/web/src/app/core/manager-work-export.test.tsx`

**Interfaces:**
- Consumes: Task 1 `csvFileName`, `csvText`, `downloadCsv`; Task 2 `WORK_EXPORT_HEADER`, `workExportRows`, `exportDate`; Task 3 `Toast`, `useToastMessage`.

- [ ] **Step 1: Write the failing tests** (the button does not exist yet, so the tests fail on `exportButton()` being undefined or on the mock not being called)

```tsx
// apps/web/src/app/core/manager-work-export.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreManagerWorkItem,CoreUnitDto } from "@build-manager/api-contracts";
import { downloadCsv } from "../../lib/csv-file";
import { ManagerWorkQueue } from "./manager-work";

vi.mock("../../lib/csv-file",async original=>({...await original<typeof import("../../lib/csv-file")>(),downloadCsv:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadCsv as unknown as Mock<(fileName:string,text:string)=>void>;
const units:CoreUnitDto[]=[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"101동 1203호"}];
const open:CoreManagerWorkItem={ticketId:"5f0c2a1e-7d4b-4c1a-9e2f-3a6b8c0d9b31",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",issueType:"LEAK",workStatus:"OPEN",priority:"URGENT",assigneeLabel:null,dueAt:null,createdAt:"2026-10-13T00:12:00Z",updatedAt:"2026-10-13T00:12:00Z",version:1};
const done:CoreManagerWorkItem={...open,ticketId:"a83d77b0-41c5-4f0e-8d7a-6b2e9f3c1c02",workStatus:"COMPLETED",priority:"NORMAL",issueType:"HEATING"};
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
const flush=()=>act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
async function mount(list:()=>Promise<CoreManagerWorkItem[]>,disabled=false){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={manager:{list:vi.fn(list)},communication:{summaries:vi.fn(async()=>[])}} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<ManagerWorkQueue client={client} units={units} revision={0} onOpen={()=>{}} disabled={disabled}/>));await flush();
}
const exportButton=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="엑셀로 받기");
const header='"접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"';
async function choose(label:string,value:string){const select=host!.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;await act(async()=>{select.value=value;select.dispatchEvent(new Event("change",{bubbles:true}));});}

it("saves the rows the filters show, in screen order, under the ledger header",async()=>{
  await mount(async()=>[done,open]);
  await act(async()=>exportButton()!.click());
  expect(save).toHaveBeenCalledTimes(1);const [name,text]=save.mock.calls[0];
  expect(name).toMatch(/^업무함_\d{4}-\d{2}-\d{2}\.csv$/);
  const lines=text.slice(1).split("\r\n");expect(text.charAt(0)).toBe("\uFEFF");expect(lines[0]).toBe(header);
  expect(lines.slice(1,3).map(line=>line.includes(open.ticketId)?"open":line.includes(done.ticketId)?"done":"?")).toEqual(["open","done"]);
  await choose("처리 상태","COMPLETED");await act(async()=>exportButton()!.click());
  const filtered=save.mock.calls[1][1].slice(1).split("\r\n");expect(filtered).toHaveLength(3);expect(filtered[1]).toContain(done.ticketId);
});
it("tells how many rows went into the file",async()=>{
  await mount(async()=>[done,open]);await act(async()=>exportButton()!.click());
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("업무함 2건을 엑셀 파일(CSV)로 받았어요.");
});
it("cannot be pressed while loading, after a load error, with no rows or while the screen is busy",async()=>{
  await mount(()=>new Promise<CoreManagerWorkItem[]>(()=>{}));expect(exportButton()!.disabled).toBe(true);await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount(async()=>{throw new Error("synthetic");});expect(exportButton()!.disabled).toBe(true);await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount(async()=>[]);expect(exportButton()!.disabled).toBe(true);await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount(async()=>[open],true);expect(exportButton()!.disabled).toBe(true);
});
it("keeps a failed save in place as an alert and shows no toast",async()=>{
  save.mockImplementationOnce(()=>{throw new Error("blocked");});
  await mount(async()=>[open]);await act(async()=>exportButton()!.click());
  expect(host!.querySelector('[role="alert"]')?.textContent).toBe("파일을 만들지 못했어요. 다시 받아 주세요.");expect(document.body.querySelector("[data-toast]")).toBeNull();
});
```

- [ ] **Step 2: Run and confirm failures**

Run: `npm --workspace @build-manager/web run test -- src/app/core/manager-work-export.test.tsx`
Expected: 4 failed (`Cannot read properties of undefined (reading 'click')` / `disabled` of undefined because the button is missing). This is the behavioural RED: the module and component exist; only the button is absent.

- [ ] **Step 3: Implement in `manager-work.tsx`**

Add imports after line 12:

```ts
import { Toast,useToastMessage } from "../../components/toast";
import { csvFileName,csvText,downloadCsv } from "../../lib/csv-file";
import { WORK_EXPORT_HEADER,exportDate,workExportRows } from "./export-rows";
```

After line 26 (`const visible=…`) add:

```ts
  const [fileError,setFileError]=useState(false),[toast,showToast]=useToastMessage();
  // The file holds exactly the rows the filters show, in screen order (E1 spec).
  const exportVisible=()=>{try{downloadCsv(csvFileName(["업무함"],exportDate(new Date())),csvText(WORK_EXPORT_HEADER,workExportRows(visible)));setFileError(false);showToast(`업무함 ${visible.length}건을 엑셀 파일(CSV)로 받았어요.`);}catch{setFileError(true);}};
```

Replace line 28 (the title row) with:

```tsx
    <div className={styles.title}><div><h2>접수 목록</h2><p>미완료 · 기한 지남 · 긴급도 순</p></div><span className={styles.titleActions}>{error||conversation.error?<button disabled={loading||disabled} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>업무함 다시 불러오기</button>:null}<button disabled={loading||error||disabled||visible.length===0} onClick={exportVisible}>엑셀로 받기</button><Toast message={toast}/></span></div>
```

After line 35 (the conversation alert) add:

```tsx
    {fileError?<p role="alert">파일을 만들지 못했어요. 다시 받아 주세요.</p>:null}
```

In `manager-work.module.css` after line 4 add:

```css
/* The title row's buttons wrap under the title when the queue is narrow (E1 spec). */
.titleActions { display: flex; flex-wrap: wrap; gap: .625rem; }
```

- [ ] **Step 4: Run and confirm all pass**

Run: `npm --workspace @build-manager/web run test -- src/app/core/manager-work-export.test.tsx src/components src/lib src/app/core/export-rows.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/core/manager-work.tsx apps/web/src/app/core/manager-work.module.css apps/web/src/app/core/manager-work-export.test.tsx
git commit -m "feat(web): let managers save the visible 업무함 rows as an Excel CSV" -m "$CO_AUTHOR"
```

### Task 5: 호실 정비 이력 button

**Files:**
- Modify: `apps/web/src/app/core/manager-maintenance-timeline.tsx` (`MaintenanceTimelineView`, `ManagerMaintenanceTimeline`), `apps/web/src/app/core/manager-maintenance-timeline.module.css`, `apps/web/src/app/core/manager-maintenance-timeline.test.tsx`
- Test: `apps/web/src/app/core/manager-maintenance-export.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3. `CoreUnitDto` has `id`, `buildingId`, `buildingName`, `label`.
- Produces: `MaintenanceTimelineView` gains required props `onExport():void` and `exportError:boolean`.

- [ ] **Step 1: Update the existing view tests for the new props and add the state tests**

In `manager-maintenance-timeline.test.tsx`:
- in the `props` object of `"distinguishes timeline loading, empty, error and no authorized unit"` add `onExport:noop,exportError:false`;
- in `"keeps the supplied timeline order …"` add `onExport={noop} exportError={false}` to the JSX.

Append:

```tsx
it("offers 엑셀로 받기 beside 이력 다시 불러오기 only when the selected unit has facts",()=>{
  const props={units:[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"합성 호실"}],unitId:"unit",items:[fact],loading:false,error:"",disabled:false,onUnit:noop,onRefresh:noop,onOpenTicket:noop,onExport:noop,exportError:false};
  const html=(changes:Partial<typeof props>={})=>renderToStaticMarkup(<MaintenanceTimelineView {...props} {...changes}/>);
  expect(html()).toContain("<button>이력 다시 불러오기</button><button>엑셀로 받기</button>");
  for(const changes of [{items:[]},{loading:true},{error:"연결 확인"},{disabled:true},{units:[],unitId:""}])expect(html(changes)).toContain('<button disabled="">엑셀로 받기</button>');
});
it("keeps a failed save in place as an alert",()=>{
  const html=renderToStaticMarkup(<MaintenanceTimelineView units={[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"합성 호실"}]} unitId="unit" items={[fact]} loading={false} error="" disabled={false} onUnit={noop} onRefresh={noop} onOpenTicket={noop} onExport={noop} exportError/>);
  expect(html).toContain('role="alert"');expect(html).toContain("파일을 만들지 못했어요. 다시 받아 주세요.");
});
```

Create the container test:

```tsx
// apps/web/src/app/core/manager-maintenance-export.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreUnitDto,CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { downloadCsv } from "../../lib/csv-file";
import { ManagerMaintenanceTimeline } from "./manager-maintenance-timeline";

vi.mock("../../lib/csv-file",async original=>({...await original<typeof import("../../lib/csv-file")>(),downloadCsv:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadCsv as unknown as Mock<(fileName:string,text:string)=>void>;
const units:CoreUnitDto[]=[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"101동 1203호"}];
const first:CoreUnitMaintenanceFact={factId:"first",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"101동 1203호",sourceTicketId:"7d21c0aa-1b2c-4d5e-8f90-1a2b3c4d4e90",issueType:"LEAK",actionKind:"PART_REPLACEMENT",componentLabel:"=합성 수식 부품",sourceCompletedAt:"2026-10-09T06:20:00Z",recordedAt:"2026-10-09T06:45:00Z",corrected:false,correctionCount:0,tenantOutcome:"RESOLVED",previousTicketId:null,followUpTicketId:null};
const second:CoreUnitMaintenanceFact={...first,factId:"second",sourceTicketId:"c4f8e912-3a4b-4c5d-9e6f-7a8b9c0d0a7b",issueType:"HEATING",actionKind:"INSPECTION",componentLabel:null,sourceCompletedAt:"2026-09-22T02:00:00Z",recordedAt:"2026-09-22T02:30:00Z",correctionCount:1,tenantOutcome:"UNCONFIRMED"};
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={maintenance:{listUnit:vi.fn(async()=>[first,second])}} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<ManagerMaintenanceTimeline client={client} units={units} revision={0} disabled={false} onOpenTicket={()=>{}}/>));
  await act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
}
const exportButton=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="엑셀로 받기")!;

it("saves the selected unit's facts in timeline order with the unit in the file name",async()=>{
  await mount();await act(async()=>exportButton().click());
  const [name,text]=save.mock.calls[0];expect(name).toMatch(/^정비이력_합성건물_101동1203호_\d{4}-\d{2}-\d{2}\.csv$/);
  const lines=text.slice(1).split("\r\n");
  expect(lines[0]).toBe('"관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"');
  expect(lines[1]).toBe(`"2026-10-09 15:20","합성 건물","101동 1203호","누수","부품 교체","'=합성 수식 부품","세입자가 해결됐다고 응답","0회","2026-10-09 15:45","${first.sourceTicketId}",""`);
  expect(lines[2]).toContain('"2026-09-22 11:00"');expect(lines[2]).toContain('"부품·위치 명칭 미기록","세입자 응답 미확인","1회"');
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("정비 이력 2건을 엑셀 파일(CSV)로 받았어요.");
});
it("keeps a failed save in place as an alert and shows no toast",async()=>{
  save.mockImplementationOnce(()=>{throw new Error("blocked");});
  await mount();await act(async()=>exportButton().click());
  expect(host!.querySelector('[role="alert"]')?.textContent).toBe("파일을 만들지 못했어요. 다시 받아 주세요.");expect(document.body.querySelector("[data-toast]")).toBeNull();
});
```

- [ ] **Step 2: Run and confirm failures**

Run: `npm --workspace @build-manager/web run test -- src/app/core/manager-maintenance-timeline.test.tsx src/app/core/manager-maintenance-export.test.tsx`
Expected: typecheck-free Vitest run fails on the new assertions (no `엑셀로 받기` button, no alert); the older timeline tests still pass.

- [ ] **Step 3: Implement**

In `manager-maintenance-timeline.tsx` add imports after the `maintenance-labels` import:

```ts
import { Toast,useToastMessage } from "../../components/toast";
import { csvFileName,csvText,downloadCsv } from "../../lib/csv-file";
import { MAINTENANCE_EXPORT_HEADER,exportDate,maintenanceExportRows } from "./export-rows";
```

Replace `MaintenanceTimelineView` (signature line and the heading) with:

```tsx
export function MaintenanceTimelineView({units,unitId,items,loading,error,disabled,onUnit,onRefresh,onOpenTicket,onExport,exportError}:{units:CoreUnitDto[];unitId:string;items:CoreUnitMaintenanceFact[];loading:boolean;error:string;disabled:boolean;onUnit(id:string):void;onRefresh():void;onOpenTicket(id:string):void;onExport():void;exportError:boolean}){
 return <section className={styles.timeline} aria-label="호실 정비 이력"><div className={styles.heading}><div><h2>호실 정비 이력</h2><p>완료 접수에서 관리자가 따로 기록한 사실이에요. 원본 완료 시각 순으로 최근 100건까지 표시해요.</p></div><div className={styles.headingActions}><button disabled={disabled||loading||!unitId} onClick={onRefresh}>이력 다시 불러오기</button><button disabled={disabled||loading||!unitId||Boolean(error)||items.length===0} onClick={onExport}>엑셀로 받기</button></div></div>
  {exportError?<p role="alert">파일을 만들지 못했어요. 다시 받아 주세요.</p>:null}
```

(the rest of the function body — the label, the select and the list — stays as it is.)

Replace the body of `ManagerMaintenanceTimeline` from the `useEffect` line onward with:

```tsx
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setLoading(true);setItems([]);setError("");try{const rows=unitId?await client.maintenance.listUnit(unitId):[];if(live)setItems(rows);}catch{if(live){setItems([]);setError("이력을 불러오지 못했어요. 현재 배정과 연결을 확인하고 다시 불러와 주세요.");}}finally{if(live)setLoading(false);}});return()=>{live=false;};},[client,unitId,revision,refresh]);
 const [exportError,setExportError]=useState(false),[toast,showToast]=useToastMessage();
 // The file holds the facts on screen for the selected unit, in timeline order (E1 spec).
 const exportFacts=()=>{const unit=units.find(u=>u.id===unitId);if(!unit)return;try{downloadCsv(csvFileName(["정비이력",unit.buildingName,unit.label],exportDate(new Date())),csvText(MAINTENANCE_EXPORT_HEADER,maintenanceExportRows(items)));setExportError(false);showToast(`정비 이력 ${items.length}건을 엑셀 파일(CSV)로 받았어요.`);}catch{setExportError(true);}};
 return <><MaintenanceTimelineView units={units} unitId={unitId} items={items} loading={loading} error={error} disabled={disabled} onUnit={id=>{setLoading(true);setItems([]);setExportError(false);setSelected(id);}} onRefresh={()=>{setLoading(true);setItems([]);setExportError(false);setRefresh(v=>v+1);}} onOpenTicket={onOpenTicket} onExport={exportFacts} exportError={exportError}/><Toast message={toast}/></>;
```

In `manager-maintenance-timeline.module.css` replace the `.heading{…}` rule on line 5 with:

```css
.heading{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:start;gap:.625rem}.heading>div:first-child{flex:1 1 12rem;min-width:0}.headingActions{display:flex;flex-wrap:wrap;gap:.625rem}.heading h2,.editor h2{margin:0}
```

and in the `@media(max-width:767px)` rule on line 17 add `.headingActions{margin-top:.625rem}` inside the braces.

- [ ] **Step 4: Run and confirm all pass**

Run: `npm --workspace @build-manager/web run test`
Expected: the whole web suite passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/core/manager-maintenance-timeline.tsx apps/web/src/app/core/manager-maintenance-timeline.module.css apps/web/src/app/core/manager-maintenance-timeline.test.tsx apps/web/src/app/core/manager-maintenance-export.test.tsx
git commit -m "feat(web): let managers save a unit's maintenance history as an Excel CSV" -m "$CO_AUTHOR"
```

### Task 6: Real downloads in the browser

**Files:**
- Modify: `apps/web/tests/core-e2e/manager-work.spec.ts` (append one test), `apps/web/tests/core-e2e/maintenance-fact.spec.ts` (append one test)

**Interfaces:**
- Consumes: the files' module-level helpers (`root`, `login`, `setup`, `timeline`, `openMoreRow`, `readFile`, `randomUUID`, `codes`) already imported there.

- [ ] **Step 1: Append to `manager-work.spec.ts`**

```ts
test("excel export: the visible queue downloads as a UTF-8 CSV with the ledger header and a blocked formula",async({page,request})=>{
  const codes=JSON.parse(await readFile(join(root,"access-codes.json"),"utf8")) as Record<string,string>;
  const headers=(who:string)=>({Authorization:`Bearer ${codes[who]}`});
  const unitId=(await (await request.get("/api/v2/core/units",{headers:headers("tenant")})).json())[0].id;
  const created=await request.post("/api/v2/core/tickets",{headers:headers("tenant"),data:{unitId,issueType:"LEAK",rawUserText:"엑셀 받기 실행용 합성 접수"}});expect(created.status()).toBe(201);const ticketId=(await created.json()).ticketId as string;
  const work=await request.post(`/api/v2/core/manager/tickets/${ticketId}/work`,{headers:headers("manager"),data:{priority:"HIGH",assigneeLabel:"=합성 수식 담당",dueAt:null,expectedVersion:1}});expect(work.status()).toBe(200);
  await page.setViewportSize({width:1440,height:1000});await login(page,codes.manager);
  const queue=page.getByRole("region",{name:"관리 업무함",exact:true});await expect(queue.locator(`[data-ticket-id="${ticketId}"]`)).toBeVisible();
  const waiting=page.waitForEvent("download");await queue.getByRole("button",{name:"엑셀로 받기",exact:true}).click();const file=await waiting;
  expect(file.suggestedFilename()).toMatch(/^업무함_\d{4}-\d{2}-\d{2}\.csv$/);
  const bytes=await readFile((await file.path())!);expect([...bytes.subarray(0,3)]).toEqual([0xef,0xbb,0xbf]);
  const text=bytes.subarray(3).toString("utf8"),lines=text.split("\r\n");
  expect(lines[0]).toBe('"접수 시각","건물","호실","문제","처리 상태","긴급도","담당자","처리 예정","마지막 변경","요청 번호","비고"');
  const row=lines.find(line=>line.includes(ticketId))!;expect(row).toMatch(/^"\d{4}-\d{2}-\d{2} \d{2}:\d{2}",/);expect(row).toContain('"누수","접수됨","높음","\'=합성 수식 담당",""');expect(row.endsWith(`"${ticketId}",""`)).toBe(true);
  expect(text).not.toContain("엑셀 받기 실행용 합성 접수");
  await expect(page.locator("[data-toast]")).toHaveText(/^업무함 \d+건을 엑셀 파일\(CSV\)로 받았어요\.$/);
});
```

- [ ] **Step 2: Append to `maintenance-fact.spec.ts`**

```ts
test("excel export: the unit history downloads as a UTF-8 CSV that starts with the completion date",async({page,request})=>{
 const s=await setup(request),fact=await s.post(s.factPath,{clientRequestId:randomUUID(),actionKind:"REPAIR",componentLabel:"=합성 수식 부품"},"manager",201);
 await page.setViewportSize({width:1440,height:1000});await login(page);await openMoreRow(page,"호실 정비 이력");
 const rows=timeline(page);await rows.getByLabel("정비 이력 건물·호실").selectOption(s.unit);await expect(rows.locator(`[data-fact-id="${fact.factId}"]`)).toBeVisible();
 const waiting=page.waitForEvent("download");await rows.getByRole("button",{name:"엑셀로 받기",exact:true}).click();const file=await waiting;
 expect(file.suggestedFilename()).toMatch(/^정비이력_.+_\d{4}-\d{2}-\d{2}\.csv$/);
 const bytes=await readFile((await file.path())!);expect([...bytes.subarray(0,3)]).toEqual([0xef,0xbb,0xbf]);
 const lines=bytes.subarray(3).toString("utf8").split("\r\n");
 expect(lines[0]).toBe('"관리자 처리 완료","건물","호실","문제","조치","부품·위치","세입자 응답","정정","사실 기록","근거 요청 번호","비고"');
 const row=lines.find(line=>line.includes(s.id))!;expect(row).toMatch(/^"\d{4}-\d{2}-\d{2} \d{2}:\d{2}",/);expect(row).toContain('"수리","\'=합성 수식 부품"');expect(row.endsWith(`"${s.id}",""`)).toBe(true);
 await expect(page.locator("[data-toast]")).toHaveText(/^정비 이력 \d+건을 엑셀 파일\(CSV\)로 받았어요\.$/);
});
```

- [ ] **Step 3: Run**

Run (worktree root, after `docker ps` shows no leftover test containers): `npm run test:e2e:core`
Expected: the core e2e suite passes, including both new tests. If the shared fixture fails for reasons named in DEV-15 (stale SQL, host load), record the failure and rerun once; do not weaken the test.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/core-e2e/manager-work.spec.ts apps/web/tests/core-e2e/maintenance-fact.spec.ts
git commit -m "test(web): download both Excel CSV files in the browser and read their bytes" -m "$CO_AUTHOR"
```

### Task 7: Checks, records, review and PR

**Files:**
- Create: `ops/excel_export_e1_20261015_acceptance.md`
- Modify: `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md`, `STATUS.md`

- [ ] **Step 1: Bring in main** — after #161 is merged: `git fetch origin && git merge origin/main` (append-only ops conflicts: main's lines first, ours after).

- [ ] **Step 2: DEV-06 checks** (record each command and its exit code)

```bash
npm run test:shared
npm run test:web
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run test:postgres
npm run test:e2e:core
python scripts/verify_repository.py --history
```

Expected: every command exits 0. Note the local Node version if it differs from CI's 24.21.0.

- [ ] **Step 3: Design audit** — `node --experimental-transform-types scripts/design-audit.mjs ~/.build-manager-rc1-private/excel-export-e1-audit --engines chromium,webkit`; expected 0 findings (manager queue and `manager-maintenance` screens, including empty lists). Take 390px and 1280px captures of both screens with the button and a toast (synthetic data) for the PR.

- [ ] **Step 4: Excel check** — open both downloaded files in Excel if available: Korean text not broken, date cells filter by year/month (CLM-210), `'=…` cells stay text. Without Excel, write `NOT_RUN` in the acceptance record.

- [ ] **Step 5: Records** — acceptance record in the format of `ops/smoke_write_check_closes_20261015_acceptance.md` (risk tier, operator decisions with quotes and alternatives, spec and plan links, policy and base refs, change list, checks with exit codes, review result, rollback, remaining risks); one row each in `ops/AI_Execution_Log.csv` (event `EXCEL-EXPORT-E1-20261015`) and `ops/pending_external_sync.md`; one `STATUS.md` line for the new manager feature (not on the demo until a redeploy).

- [ ] **Step 6: Independent review** — a fresh-context review agent, read-only, on `origin/main..HEAD`, against the spec's threat table; fix blocking findings, re-run the affected tests, and record the result in the acceptance record.

- [ ] **Step 7: PR** — push `feat/excel-export-e1`, open the PR with `Risk tier: 고위험` as the first line, purpose, the checks and results, the captures, remaining risks, and the visual spec page note; merge only after CI passes on the exact head: `gh pr merge <n> --merge --match-head-commit <sha>`. Deploying to the demo is a separate operator decision (DEV-04).

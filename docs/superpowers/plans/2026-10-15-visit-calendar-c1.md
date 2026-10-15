# Visit Calendar File (C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The tenant, the vendor and the manager can save a confirmed vendor visit as a standard calendar file (.ics) from the visit box they already see.

**Architecture:** The browser builds an RFC 5545 file from the visit the screen already holds; no API, server, database or permission change. A pure iCalendar module, a pure per-role content module, a shared download helper (E1's CSV download moves onto it), and one button component used by the three screens.

**Tech Stack:** Next.js 16 web app (`apps/web`), React 19.2.3, TypeScript strict, Vitest 5 (`// @vitest-environment jsdom`), Playwright 1.63 (`test:e2e:vendor`, `test:e2e:core`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md` (same branch). Risk tier **high** (DEV-04): failing test first, `test:postgres`, `test:e2e:vendor` and `test:e2e:core`, independent review, `ops/` acceptance record.
- No new dependency, no API/contract/server/migration/permission change, no mobile change.
- File: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//build-manager//visit calendar//KO`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, one `VEVENT` with `UID:{appointment.id}@build-manager`, `DTSTAMP`, `DTSTART`, `DTEND` in UTC `YYYYMMDDTHHMMSSZ`, `SUMMARY`, `LOCATION` (only when there is a place), `DESCRIPTION`; CRLF line ends; lines folded at 75 octets with a leading space, never splitting a character; TEXT values escape `\`, `;`, `,` and line breaks (`\n`), other control characters become spaces; no VALARM; UTF-8, no BOM; type `text/calendar;charset=utf-8`.
- File name: `방문일정_{Seoul date of the visit start}.ics`.
- Contents: tenant `수리 방문 · {난방|누수}`, place `{건물} {호실}` or none, memo `업체가 방문해요. 일정이 바뀌면 build-manager에서 다시 받아 주세요.`; vendor `방문 · {문제} · {건물} {호실}`, place = `serviceAddress`, memo `작업 번호 {jobReference}. 출입 방법은 작업 화면에서 확인해 주세요. 일정이 바뀌면 다시 받아 주세요.`; manager `업체 방문 · {문제} · {건물} {호실}`, place `{건물} {호실}`, memo `요청 번호 {ticketId} · {세입자 확정 | 세입자가 동의한 시간 안에서 업체가 선택}. 일정이 바뀌면 다시 받아 주세요.` With no unit label the place is the building only.
- Never in a file: `accessInstruction`, access policy text, tenant names or contacts, tenant text, `sharedDetails`, safety notices, photos, notes, the vendor's name.
- Button: secondary button `캘린더에 추가`, only inside the existing confirmed-visit box and only while `endAt` is in the future; disabled while the screen is busy (`locked` / `blocked` / `submitting`). Toast `캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.`; failure in place (`role="alert"`) `캘린더 파일을 만들지 못했어요. 다시 받아 주세요.`, never a toast.
- Code style: match the surrounding compact style; TypeScript strict; stage named paths only; edit files with the edit tool, never shell redirection (DEV-05).
- Commits: Conventional Commits, scope `web`; end every message with the session's `Co-Authored-By` trailer (set `CO_AUTHOR` to that line; it is not written here because the repository check rejects e-mail addresses in files). Check `python scripts/verify_repository.py` by exit code, never through a pipe.

## Working directory and commands

- Worktree `D:\Users\admin\Desktop\모두의 창업 2기\worktree\build-manager-visit-calendar-c1`, branch `feat/visit-calendar-c1`, dependencies installed (`npm ci`).
- Unit tests: `npm --workspace @build-manager/web run test -- <paths>`.
- Browser suites and the design audit need Node 24.21.0: `export PATH="/c/Users/admin/AppData/Local/build-manager-b5-runtime/node-24.21.0/node-v24.21.0-win-x64:$PATH"`. `test:e2e:vendor` and the design audit use port 3134 and new testcontainers; `test:e2e:core` uses port 3131 and the shared core fixture. Announce heavy runs to the other build-manager sessions first.

## File map

| File | Status | Responsibility |
| --- | --- | --- |
| `apps/web/src/lib/calendar-file.ts` (+ test) | new | `icsUtc`, `icsText`, `icsFold`, `calendarFile` |
| `apps/web/src/lib/download-file.ts` (+ test) | new | `downloadFile(fileName,text,type)` |
| `apps/web/src/lib/csv-file.ts` | modify | `downloadCsv` delegates to `downloadFile` |
| `apps/web/src/lib/visit-calendar.ts` (+ test) | new | per-role entries, file name, `visitStillAhead` |
| `apps/web/src/components/visit-calendar-button.tsx`, `.module.css` (+ test) | new | button, toast, failure alert |
| `apps/web/src/app/core/vendor-handoff-tenant.tsx`, `core-screen.tsx` (+ `vendor-handoff-tenant-calendar.test.tsx`) | modify | tenant button; pass issue type and place |
| `apps/web/src/app/core/vendor-handoff-manager.tsx` (+ `vendor-handoff-manager-calendar.test.tsx`) | modify | manager button |
| `apps/web/src/app/vendor/job/vendor-job-screen.tsx` (+ `vendor-job-calendar.test.tsx`) | modify | vendor button |
| `apps/web/tests/vendor-e2e/vendor-job.spec.ts` | modify | one browser test reading all three files |
| `ops/visit_calendar_c1_20261015_acceptance.md`, `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md`, `STATUS.md` | new/modify | records |

---

### Task 1: iCalendar text and the shared download

**Files:** create `apps/web/src/lib/calendar-file.ts`, `calendar-file.test.ts`, `download-file.ts`, `download-file.test.ts`; modify `apps/web/src/lib/csv-file.ts`.

**Interfaces — Produces:** `type CalendarEvent={uid:string;start:string;end:string;stamp:string;summary:string;location:string|null;description:string}`; `icsUtc(at:string):string`; `icsText(value:string):string`; `icsFold(line:string):string`; `calendarFile(event:CalendarEvent):string`; `downloadFile(fileName:string,text:string,type:string):void`.

- [ ] **Step 1: Wrong stubs** (behavioural RED, R06)

```ts
// apps/web/src/lib/calendar-file.ts (stub)
export type CalendarEvent={uid:string;start:string;end:string;stamp:string;summary:string;location:string|null;description:string};
export function icsUtc(at:string):string{return at;}
export function icsText(value:string):string{return value;}
export function icsFold(line:string):string{return line;}
export function calendarFile(event:CalendarEvent):string{return event.summary;}
```

```ts
// apps/web/src/lib/download-file.ts (stub)
export function downloadFile(fileName:string,text:string,type:string):void{void fileName;void text;void type;}
```

- [ ] **Step 2: Failing tests**

```ts
// apps/web/src/lib/calendar-file.test.ts
import { expect,it } from "vitest";
import { calendarFile,icsFold,icsText,icsUtc } from "./calendar-file";

const event={uid:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@build-manager",start:"2026-10-17T05:00:00.000Z",end:"2026-10-17T07:00:00Z",stamp:"2026-10-15T10:42:09.123Z",summary:"방문 · 누수 · 해솔빌라 101동 1203호",location:"서울 합성구 합성로 12, 3층",description:"작업 번호 JOB-7F3A."};
const bytes=(line:string)=>new TextEncoder().encode(line).length;
const unfold=(text:string)=>text.replace(/\r\n /g,"");

it("writes UTC times in the basic form, seconds kept and milliseconds dropped",()=>{
  expect(icsUtc("2026-10-17T05:00:00.000Z")).toBe("20261017T050000Z");expect(icsUtc("2026-10-17T14:30:15+09:00")).toBe("20261017T053015Z");
  expect(()=>icsUtc("not a time")).toThrow(RangeError);
});
it("escapes TEXT so a value can never start a new property (RFC 5545 3.3.11)",()=>{
  expect(icsText("a\\b;c,d:e")).toBe("a\\\\b\\;c\\,d:e");
  expect(icsText("x\r\nURL:https://example.invalid\ny\rz")).toBe("x\\nURL:https://example.invalid\\ny\\nz");
  expect(icsText(`tab${String.fromCharCode(9)}bell${String.fromCharCode(7)}`)).toBe("tab bell ");
});
it("folds at 75 octets with a leading space and never splits a character",()=>{
  const line="SUMMARY:"+"해솔빌라 101동 1203호 누수 방문 ".repeat(6);const folded=icsFold(line);
  for(const part of folded.split("\r\n")){expect(bytes(part)).toBeLessThanOrEqual(75);expect(new TextDecoder("utf-8",{fatal:true}).decode(new TextEncoder().encode(part))).toBe(part);}
  expect(folded.split("\r\n").slice(1).every(part=>part.startsWith(" "))).toBe(true);expect(unfold(folded)).toBe(line);
  expect(icsFold("VERSION:2.0")).toBe("VERSION:2.0");
});
it("writes one event with the required properties in order, CRLF line ends and no alarm",()=>{
  const text=calendarFile(event),lines=unfold(text).split("\r\n");
  expect(text.endsWith("\r\n")).toBe(true);expect(text.includes("\n")&&!text.replace(/\r\n/g,"").includes("\n")).toBe(true);
  expect(lines).toEqual(["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//build-manager//visit calendar//KO","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    "UID:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@build-manager","DTSTAMP:20261015T104209Z","DTSTART:20261017T050000Z","DTEND:20261017T070000Z",
    "SUMMARY:방문 · 누수 · 해솔빌라 101동 1203호","LOCATION:서울 합성구 합성로 12\\, 3층","DESCRIPTION:작업 번호 JOB-7F3A.","END:VEVENT","END:VCALENDAR",""]);
  expect(text).not.toContain("VALARM");expect(text.charCodeAt(0)).not.toBe(0xfeff);
});
it("leaves LOCATION out when there is no place",()=>{
  expect(calendarFile({...event,location:null})).not.toContain("LOCATION");
});
```

```ts
// apps/web/src/lib/download-file.test.ts
// @vitest-environment jsdom
import { afterEach,expect,it,vi } from "vitest";
import { downloadFile } from "./download-file";

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it("saves through a temporary link of the given type and releases the object URL a minute later",()=>{
  vi.useFakeTimers();const created:Blob[]=[],original={create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  URL.createObjectURL=vi.fn((blob:Blob)=>{created.push(blob);return "blob:synthetic-ics";});URL.revokeObjectURL=vi.fn();
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe("방문일정_2026-10-17.ics");expect(this.isConnected).toBe(true);});
  try{
    downloadFile("방문일정_2026-10-17.ics","BEGIN:VCALENDAR\r\n","text/calendar;charset=utf-8");
    expect(click).toHaveBeenCalledTimes(1);expect(document.querySelector("a")).toBeNull();expect(created[0].type).toBe("text/calendar;charset=utf-8");
    vi.advanceTimersByTime(59_999);expect(URL.revokeObjectURL).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-ics");
  }finally{URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});
```

- [ ] **Step 3: Run, expect assertion failures only** — `npm --workspace @build-manager/web run test -- src/lib/calendar-file.test.ts src/lib/download-file.test.ts` → 6 failed on `toBe`/`toEqual`/`toThrow`/`toHaveBeenCalledTimes`.

- [ ] **Step 4: Implement**

```ts
// apps/web/src/lib/calendar-file.ts
/**
 * iCalendar text for one visit (RFC 5545; C1 spec docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md): CRLF
 * line ends, lines folded at 75 octets without splitting a character, TEXT values escaped so no value can start a new
 * property, UTC times, no alarm.
 */
export type CalendarEvent={uid:string;start:string;end:string;stamp:string;summary:string;location:string|null;description:string};
const encoder=new TextEncoder();
/** `2026-10-17T05:00:00.000Z` → `20261017T050000Z`; throws on a value that is not an instant. */
export function icsUtc(at:string):string{const time=Date.parse(at);if(!Number.isFinite(time))throw new RangeError("INVALID_INSTANT");return new Date(time).toISOString().replace(/\.\d{3}Z$/,"Z").replace(/[-:]/g,"");}
/** TEXT escaping (RFC 5545 3.3.11): backslash, semicolon, comma and line breaks; other control characters become spaces. */
export function icsText(value:string):string{return value.replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r\n|\r|\n/g,"\\n").replace(/\p{Cc}/gu," ");}
/** Folds one content line into lines of at most 75 octets; each continuation line starts with one space (RFC 5545 3.1). */
export function icsFold(line:string):string{
  const lines:string[]=[];let current="",size=0;
  for(const ch of line){const n=encoder.encode(ch).length;if(size+n>75){lines.push(current);current=" "+ch;size=1+n;}else{current+=ch;size+=n;}}
  lines.push(current);return lines.join("\r\n");
}
export function calendarFile(event:CalendarEvent):string{
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//build-manager//visit calendar//KO","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    `UID:${icsText(event.uid)}`,`DTSTAMP:${icsUtc(event.stamp)}`,`DTSTART:${icsUtc(event.start)}`,`DTEND:${icsUtc(event.end)}`,`SUMMARY:${icsText(event.summary)}`,
    ...(event.location?[`LOCATION:${icsText(event.location)}`]:[]),`DESCRIPTION:${icsText(event.description)}`,"END:VEVENT","END:VCALENDAR"];
  return lines.map(icsFold).join("\r\n")+"\r\n";
}
```

```ts
// apps/web/src/lib/download-file.ts
/** Saves text through a temporary link. The object URL is released a minute later so a slow save can still read it. */
export function downloadFile(fileName:string,text:string,type:string):void{
  const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement("a");
  link.href=url;link.download=fileName;link.hidden=true;document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
}
```

In `apps/web/src/lib/csv-file.ts` replace the body of `downloadCsv` (keep its doc comment's meaning) with a call to the helper, and add the import at the top of the file:

```ts
import { downloadFile } from "./download-file";
```

```ts
/** Saves the CSV text as a file (see download-file.ts). */
export function downloadCsv(fileName:string,text:string):void{downloadFile(fileName,text,"text/csv;charset=utf-8");}
```

- [ ] **Step 5: Run** — `npm --workspace @build-manager/web run test -- src/lib` → all pass (the existing `csv-file.test.ts` download test still passes unchanged).

- [ ] **Step 6: Commit** — `git add apps/web/src/lib/calendar-file.ts apps/web/src/lib/calendar-file.test.ts apps/web/src/lib/download-file.ts apps/web/src/lib/download-file.test.ts apps/web/src/lib/csv-file.ts` then `git commit -m "feat(web): write RFC 5545 calendar text and share the file download with the CSV export" -m "$CO_AUTHOR"`.

### Task 2: Per-role calendar entries

**Files:** create `apps/web/src/lib/visit-calendar.ts`, `visit-calendar.test.ts`.

**Interfaces — Consumes:** `calendarFile`, `instantToSeoulLocal`. **Produces:** `type CalendarVisit={id:string;startAt:string;endAt:string;confirmationMode:"TENANT_CONFIRMED"|"PREAUTHORIZED_ENTRY"}`; `type CalendarPacket={jobReference:string;buildingName:string;unitLabel:string|null;serviceAddress:string|null;issueType:"HEATING"|"LEAK"}`; `tenantVisitCalendar(visit,issueType,where:string|null,now:Date):string`; `vendorVisitCalendar(visit,packet,now:Date):string`; `managerVisitCalendar(visit,packet,ticketId:string,now:Date):string`; `visitCalendarFileName(visit:{startAt:string}):string`; `visitStillAhead(visit:{endAt:string},now:Date):boolean`.

- [ ] **Step 1: Wrong stub**

```ts
// apps/web/src/lib/visit-calendar.ts (stub)
export type CalendarVisit={id:string;startAt:string;endAt:string;confirmationMode:"TENANT_CONFIRMED"|"PREAUTHORIZED_ENTRY"};
export type CalendarPacket={jobReference:string;buildingName:string;unitLabel:string|null;serviceAddress:string|null;issueType:"HEATING"|"LEAK"};
export const tenantVisitCalendar=(visit:CalendarVisit,issueType:"HEATING"|"LEAK",where:string|null,now:Date)=>[visit.id,issueType,where,now.toISOString()].join("");
export const vendorVisitCalendar=(visit:CalendarVisit,packet:CalendarPacket,now:Date)=>[visit.id,JSON.stringify(packet),now.toISOString()].join("");
export const managerVisitCalendar=(visit:CalendarVisit,packet:CalendarPacket,ticketId:string,now:Date)=>[visit.id,JSON.stringify(packet),ticketId,now.toISOString()].join("");
export const visitCalendarFileName=(visit:{startAt:string})=>visit.startAt;
export const visitStillAhead=(visit:{endAt:string},now:Date)=>Boolean(visit.endAt)||Boolean(now);
```

(The stub leaks the access instruction through `JSON.stringify` on purpose, so the privacy test fails first.)

- [ ] **Step 2: Failing tests**

```ts
// apps/web/src/lib/visit-calendar.test.ts
import { expect,it } from "vitest";
import { managerVisitCalendar,tenantVisitCalendar,vendorVisitCalendar,visitCalendarFileName,visitStillAhead,type CalendarPacket } from "./visit-calendar";

const visit={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",startAt:"2026-10-17T05:00:00Z",endAt:"2026-10-17T07:00:00Z",confirmationMode:"TENANT_CONFIRMED" as const};
// A full packet as the screens hold it: the extra fields must never reach a file.
const packet={jobReference:"JOB-7F3A",buildingName:"해솔빌라",unitLabel:"101동 1203호",serviceAddress:"서울 합성구 합성로 12, 3층",issueType:"LEAK" as const,
  accessInstruction:"합성 출입 안내 문구",vendorLabel:"합성 업체",workSummary:"합성 작업 요약",sharedDetails:[{key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED"}],safetyNotice:["합성 안전 안내"]};
const now=new Date("2026-10-15T10:42:00Z");
const lines=(text:string)=>text.replace(/\r\n /g,"").split("\r\n");
const field=(text:string,name:string)=>lines(text).find(line=>line.startsWith(`${name}:`))??null;
const withZone=<T,>(zone:string,run:()=>T):T=>{const before=process.env.TZ;process.env.TZ=zone;try{return run();}finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}};

it("gives the tenant the issue, the unit and how to refresh, without any address",()=>{
  const text=tenantVisitCalendar(visit,"LEAK","해솔빌라 101동 1203호",now);
  expect(field(text,"SUMMARY")).toBe("SUMMARY:수리 방문 · 누수");expect(field(text,"LOCATION")).toBe("LOCATION:해솔빌라 101동 1203호");
  expect(field(text,"DESCRIPTION")).toBe("DESCRIPTION:업체가 방문해요. 일정이 바뀌면 build-manager에서 다시 받아 주세요.");
  expect(field(text,"UID")).toBe(`UID:${visit.id}@build-manager`);expect(field(text,"DTSTAMP")).toBe("DTSTAMP:20261015T104200Z");
  expect(field(tenantVisitCalendar(visit,"HEATING",null,now),"LOCATION")).toBeNull();
});
it("gives the vendor the service address and the job number, and nothing about access, people or details",()=>{
  const text=vendorVisitCalendar(visit,packet as CalendarPacket,now);
  expect(field(text,"SUMMARY")).toBe("SUMMARY:방문 · 누수 · 해솔빌라 101동 1203호");expect(field(text,"LOCATION")).toBe("LOCATION:서울 합성구 합성로 12\\, 3층");
  expect(field(text,"DESCRIPTION")).toBe("DESCRIPTION:작업 번호 JOB-7F3A. 출입 방법은 작업 화면에서 확인해 주세요. 일정이 바뀌면 다시 받아 주세요.");
  for(const hidden of ["합성 출입 안내 문구","합성 업체","합성 작업 요약","현재 누수","합성 안전 안내"])expect(text).not.toContain(hidden);
});
it("gives the manager the unit, the request number and how the time was set, without the address",()=>{
  const text=managerVisitCalendar(visit,packet as CalendarPacket,"ticket-5f0c",now);
  expect(field(text,"SUMMARY")).toBe("SUMMARY:업체 방문 · 누수 · 해솔빌라 101동 1203호");expect(field(text,"LOCATION")).toBe("LOCATION:해솔빌라 101동 1203호");
  expect(field(text,"DESCRIPTION")).toBe("DESCRIPTION:요청 번호 ticket-5f0c · 세입자 확정. 일정이 바뀌면 다시 받아 주세요.");
  expect(field(managerVisitCalendar({...visit,confirmationMode:"PREAUTHORIZED_ENTRY"},packet as CalendarPacket,"ticket-5f0c",now),"DESCRIPTION")).toContain("세입자가 동의한 시간 안에서 업체가 선택");
  expect(text).not.toContain("합성로");expect(text).not.toContain("합성 출입 안내 문구");
});
it("uses the building alone when there is no unit label",()=>{
  expect(field(managerVisitCalendar(visit,{...packet,unitLabel:null} as CalendarPacket,"t",now),"LOCATION")).toBe("LOCATION:해솔빌라");
  expect(field(vendorVisitCalendar(visit,{...packet,unitLabel:null} as CalendarPacket,now),"SUMMARY")).toBe("SUMMARY:방문 · 누수 · 해솔빌라");
});
it("names the file by the visit's Seoul date whatever zone the browser is in",()=>{
  expect(withZone("America/Los_Angeles",()=>visitCalendarFileName({startAt:"2026-10-16T16:30:00Z"}))).toBe("방문일정_2026-10-17.ics");
});
it("offers the file only until the visit's end time has passed",()=>{
  expect(visitStillAhead(visit,new Date("2026-10-17T06:59:59Z"))).toBe(true);expect(visitStillAhead(visit,new Date("2026-10-17T07:00:00Z"))).toBe(false);
});
```

- [ ] **Step 3: Run, expect assertion failures** — `npm --workspace @build-manager/web run test -- src/lib/visit-calendar.test.ts` → 6 failed.

- [ ] **Step 4: Implement**

```ts
// apps/web/src/lib/visit-calendar.ts
import { calendarFile } from "./calendar-file";
import { instantToSeoulLocal } from "./date-text";

// C1 (spec docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md): what each role's calendar entry says. Only the
// vendor's entry carries the service address (operator decision 2026-10-15); access instructions, names, contacts, shared
// details, safety notices, photos and notes never go in, so each entry is built from named fields only.
export type CalendarVisit={id:string;startAt:string;endAt:string;confirmationMode:"TENANT_CONFIRMED"|"PREAUTHORIZED_ENTRY"};
export type CalendarPacket={jobReference:string;buildingName:string;unitLabel:string|null;serviceAddress:string|null;issueType:"HEATING"|"LEAK"};
const issueNames={HEATING:"난방",LEAK:"누수"} as const;
const AGAIN="일정이 바뀌면 다시 받아 주세요.";
const place=(building:string,unit:string|null)=>unit?`${building} ${unit}`:building;
const visitFile=(visit:CalendarVisit,now:Date,summary:string,location:string|null,description:string)=>calendarFile({uid:`${visit.id}@build-manager`,start:visit.startAt,end:visit.endAt,stamp:now.toISOString(),summary,location,description});
export const tenantVisitCalendar=(visit:CalendarVisit,issueType:"HEATING"|"LEAK",where:string|null,now:Date)=>visitFile(visit,now,`수리 방문 · ${issueNames[issueType]}`,where,"업체가 방문해요. 일정이 바뀌면 build-manager에서 다시 받아 주세요.");
export const vendorVisitCalendar=(visit:CalendarVisit,packet:CalendarPacket,now:Date)=>visitFile(visit,now,`방문 · ${issueNames[packet.issueType]} · ${place(packet.buildingName,packet.unitLabel)}`,packet.serviceAddress,`작업 번호 ${packet.jobReference}. 출입 방법은 작업 화면에서 확인해 주세요. ${AGAIN}`);
export const managerVisitCalendar=(visit:CalendarVisit,packet:CalendarPacket,ticketId:string,now:Date)=>visitFile(visit,now,`업체 방문 · ${issueNames[packet.issueType]} · ${place(packet.buildingName,packet.unitLabel)}`,place(packet.buildingName,packet.unitLabel),`요청 번호 ${ticketId} · ${visit.confirmationMode==="PREAUTHORIZED_ENTRY"?"세입자가 동의한 시간 안에서 업체가 선택":"세입자 확정"}. ${AGAIN}`);
export const visitCalendarFileName=(visit:{startAt:string})=>`방문일정_${instantToSeoulLocal(visit.startAt).date}.ics`;
/** The button stays until the visit's end time has passed. */
export const visitStillAhead=(visit:{endAt:string},now:Date)=>Date.parse(visit.endAt)>now.getTime();
```

- [ ] **Step 5: Run** — same command → 6 passed.
- [ ] **Step 6: Commit** — `git add apps/web/src/lib/visit-calendar.ts apps/web/src/lib/visit-calendar.test.ts` then `git commit -m "feat(web): say only what each role needs in a visit calendar entry" -m "$CO_AUTHOR"`.

### Task 3: The button

**Files:** create `apps/web/src/components/visit-calendar-button.tsx`, `visit-calendar-button.module.css`, `visit-calendar-button.test.tsx`.

**Interfaces — Consumes:** `downloadFile`, `Toast`, `useToastMessage`. **Produces:** `VisitCalendarButton({fileName,build,disabled}:{fileName:string;build:()=>string;disabled?:boolean})`.

- [ ] **Step 1: Wrong stub**

```tsx
// apps/web/src/components/visit-calendar-button.tsx (stub)
"use client";
export function VisitCalendarButton({fileName,build,disabled=false}:{fileName:string;build:()=>string;disabled?:boolean}){void fileName;void build;return <button type="button" disabled={disabled}>캘린더에 추가</button>;}
```

- [ ] **Step 2: Failing tests**

```tsx
// apps/web/src/components/visit-calendar-button.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import { downloadFile } from "../lib/download-file";
import { VisitCalendarButton } from "./visit-calendar-button";

vi.mock("../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(build:()=>string,disabled=false){host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<VisitCalendarButton fileName="방문일정_2026-10-17.ics" build={build} disabled={disabled}/>));}
const button=()=>host!.querySelector("button")!;

it("saves the calendar text as a text/calendar file and says what to do next",async()=>{
  await mount(()=>"BEGIN:VCALENDAR\r\n");await act(async()=>button().click());
  expect(save).toHaveBeenCalledWith("방문일정_2026-10-17.ics","BEGIN:VCALENDAR\r\n","text/calendar;charset=utf-8");
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.");
});
it("keeps a failure in place and shows no toast, whether building or saving fails",async()=>{
  await mount(()=>{throw new RangeError("INVALID_INSTANT");});await act(async()=>button().click());
  expect(host!.querySelector('[role="alert"]')?.textContent).toBe("캘린더 파일을 만들지 못했어요. 다시 받아 주세요.");expect(document.body.querySelector("[data-toast]")).toBeNull();expect(save).not.toHaveBeenCalled();
  await act(async()=>root!.unmount());root=undefined;host!.remove();
  save.mockImplementationOnce(()=>{throw new Error("blocked");});await mount(()=>"BEGIN:VCALENDAR\r\n");await act(async()=>button().click());
  expect(host!.querySelector('[role="alert"]')).not.toBeNull();expect(document.body.querySelector("[data-toast]")).toBeNull();
});
it("cannot be pressed while the screen is busy",async()=>{
  await mount(()=>"x",true);expect(button().disabled).toBe(true);expect(button().textContent).toBe("캘린더에 추가");
});
```

- [ ] **Step 3: Run, expect failures** — `npm --workspace @build-manager/web run test -- src/components/visit-calendar-button.test.tsx` → the first two fail on assertions (no save, no toast, no alert); the third may pass already (it pins the stub's markup), which is fine.

- [ ] **Step 4: Implement**

```tsx
// apps/web/src/components/visit-calendar-button.tsx
"use client";
import { useState } from "react";
import { downloadFile } from "../lib/download-file";
import { Toast,useToastMessage } from "./toast";
import styles from "./visit-calendar-button.module.css";

/** C1: saves one confirmed visit as a calendar file and says so; a failure stays in place (design rules 8.9, 8.11). */
export function VisitCalendarButton({fileName,build,disabled=false}:{fileName:string;build:()=>string;disabled?:boolean}){
  const [failed,setFailed]=useState(false),[toast,showToast]=useToastMessage();
  const save=()=>{try{downloadFile(fileName,build(),"text/calendar;charset=utf-8");setFailed(false);showToast("캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.");}catch{showToast("");setFailed(true);}};
  return <div className={styles.calendar}><button type="button" disabled={disabled} onClick={save}>캘린더에 추가</button><Toast message={toast}/>{failed?<p role="alert">캘린더 파일을 만들지 못했어요. 다시 받아 주세요.</p>:null}</div>;
}
```

```css
/* apps/web/src/components/visit-calendar-button.module.css — 10px from the lines around it in any visit box (rules §4, 8.1). */
.calendar { display: grid; gap: .625rem; justify-items: start; margin-block: .625rem; min-width: 0; }
.calendar p { margin: 0; }
```

- [ ] **Step 5: Run** — same command → 3 passed.
- [ ] **Step 6: Commit** — `git add apps/web/src/components/visit-calendar-button.tsx apps/web/src/components/visit-calendar-button.module.css apps/web/src/components/visit-calendar-button.test.tsx` then `git commit -m "feat(web): add the 캘린더에 추가 button with its toast and in-place failure" -m "$CO_AUTHOR"`.

### Task 4: Tenant

**Files:** modify `apps/web/src/app/core/vendor-handoff-tenant.tsx` (Props, the confirmed-visit section), `apps/web/src/app/core/core-screen.tsx` (the `VendorHandoffTenant` line); create `apps/web/src/app/core/vendor-handoff-tenant-calendar.test.tsx`.

- [ ] **Step 1: Failing test**

```tsx
// apps/web/src/app/core/vendor-handoff-tenant-calendar.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { downloadFile } from "../../lib/download-file";
import { VendorHandoffTenant } from "./vendor-handoff-tenant";

vi.mock("../../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
const ticketId="11111111-1111-4111-8111-111111111111",packetId="22222222-2222-4222-8222-222222222222",roundId="33333333-3333-4333-8333-333333333333",apptId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const scheduled:TenantVendorSchedulingDto={ticketId,assignmentVersion:4,packetRevisionId:packetId,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",phase:"SCHEDULED",waitingOn:"VENDOR",
  currentRound:{id:roundId,openedPacketRevisionId:packetId,purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00Z"},
  appointment:{id:apptId,schedulingRoundId:roundId,packetRevisionId:packetId,proposalId:null,availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00Z"},
  accessPolicy:"TENANT_PRESENT_REQUIRED",availability:null,proposal:null};
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(at:string,place:string|null="해솔빌라 101동 1203호"){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={vendorHandoff:{readScheduling:vi.fn(async()=>scheduled)}} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<VendorHandoffTenant client={client} ticketId={ticketId} revision={0} now={()=>new Date(at)} issueType="LEAK" place={place}/>));
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
}
const calendar=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="캘린더에 추가");

it("lets the tenant save the confirmed visit with the issue and the unit",async()=>{
  await mount("2026-10-06T03:00:00Z");await act(async()=>calendar()!.click());
  const [name,text,type]=save.mock.calls[0];expect(name).toBe("방문일정_2026-10-07.ics");expect(type).toBe("text/calendar;charset=utf-8");
  expect(text).toContain("SUMMARY:수리 방문 · 누수\r\n");expect(text).toContain("LOCATION:해솔빌라 101동 1203호\r\n");expect(text).toContain(`UID:${apptId}@build-manager`);
});
it("leaves the place out when the unit is unknown, and drops the button once the visit has ended",async()=>{
  await mount("2026-10-06T03:00:00Z",null);await act(async()=>calendar()!.click());expect(save.mock.calls[0][1]).not.toContain("LOCATION");
  await act(async()=>root!.unmount());root=undefined;host!.remove();
  await mount("2026-10-07T06:00:00Z");expect(host!.textContent).toContain("확정된 방문 일정");expect(calendar()).toBeUndefined();
});
```

- [ ] **Step 2: Run, expect failure** — `npm --workspace @build-manager/web run test -- src/app/core/vendor-handoff-tenant-calendar.test.tsx` → fails (`Cannot read properties of undefined (reading 'click')`: no button yet).

- [ ] **Step 3: Implement** — in `vendor-handoff-tenant.tsx`:

Imports (after the `vendor-interval-fields` import):

```ts
import { VisitCalendarButton } from "../../components/visit-calendar-button";
import { tenantVisitCalendar,visitCalendarFileName,visitStillAhead } from "../../lib/visit-calendar";
```

Props (line 9):

```ts
type Props={client:CoreFlowClient;ticketId:string;revision:number;now?:()=>Date;
  /** C1: what the tenant's calendar entry names; the unit is `{건물} {호실}` from the screen's unit list, or null. */
  issueType?:"HEATING"|"LEAK";place?:string|null};
```

`LoadedVendorHandoffTenant` destructuring: change `{client,ticketId,now=systemNow}` to `{client,ticketId,now=systemNow,issueType,place=null}`.

In the confirmed-visit section, insert after the line with `직접 확정한 방문 시간이에요.`:

```tsx
      {issueType&&visitStillAhead(appointment,at)?<VisitCalendarButton fileName={visitCalendarFileName(appointment)} build={()=>tenantVisitCalendar(appointment,issueType,place,now())} disabled={locked}/>:null}
```

(`at` is the component's existing `now()` value used by `label`; check its name where `label` is defined and use that variable.)

In `core-screen.tsx`, on the `VendorHandoffTenant` line (around line 330) add the two props:

```tsx
issueType={selected.detail.issueType} place={(u=>u?`${u.buildingName} ${u.label}`:null)(units.find(u=>u.id===selected.unitId))}
```

- [ ] **Step 4: Run** — the new test file and the existing `vendor-handoff-tenant.test.tsx` → all pass.
- [ ] **Step 5: Commit** — `git add apps/web/src/app/core/vendor-handoff-tenant.tsx apps/web/src/app/core/core-screen.tsx apps/web/src/app/core/vendor-handoff-tenant-calendar.test.tsx` then `git commit -m "feat(web): let the tenant add a confirmed vendor visit to a calendar" -m "$CO_AUTHOR"`.

### Task 5: Manager

**Files:** modify `apps/web/src/app/core/vendor-handoff-manager.tsx` (the `방문 일정` group); create `apps/web/src/app/core/vendor-handoff-manager-calendar.test.tsx`.

- [ ] **Step 1: Failing test**

```tsx
// apps/web/src/app/core/vendor-handoff-manager-calendar.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreTicketDto,ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { downloadFile } from "../../lib/download-file";
import { VendorHandoffManager } from "./vendor-handoff-manager";

vi.mock("../../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
const ticket={ticketId:"ticket-5f0c",workStatus:"IN_PROGRESS",version:1,detail:{status:"OVERRIDDEN",decision:{type:"OVERRIDE",routeCode:"GENERAL_VENDOR"},repairPacket:{safetyEscalated:false}}} as unknown as CoreTicketDto;
const round={id:"round",openedPacketRevisionId:"packet",purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00Z"};
const appointment={id:"appointment",schedulingRoundId:"round",packetRevisionId:"packet",proposalId:"proposal",availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T06:00:00Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00Z"};
const packet={id:"packet",assignmentId:"assignment",jobReference:"JOB-7F3A",vendorLabel:"합성 업체",revision:1,publishedAt:"2026-10-06T00:00:00Z",buildingName:"해솔빌라",serviceAddress:"서울 합성구 합성로 12",unitLabel:"101동 1203호",issueType:"LEAK",workSummary:"합성 작업",sharedDetails:[],allowedPhotoIds:[],safetyNotice:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:"합성 출입 안내 문구"};
const handoff=():ManagerVendorHandoffDto=>({ticketId:"ticket-5f0c",assignment:{id:"assignment",status:"ACTIVE",endReason:null,vendorLabel:"합성 업체",version:4},currentPacket:packet,packetSource:null,
  currentRound:round,appointment,activeBlocker:null,currentReport:null,packetHistory:[],reportHistory:[],phase:"SCHEDULED",waitingOn:"VENDOR"}) as unknown as ManagerVendorHandoffDto;
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(at:string){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={vendorHandoff:{readHandoff:vi.fn(async()=>handoff()),reschedule:vi.fn()},photos:async()=>[]} as unknown as CoreFlowClient;
  await act(async()=>root!.render(<VendorHandoffManager client={client} ticket={ticket} revision={0} now={()=>new Date(at)} onHandoff={()=>{}} onChanged={()=>{}}/>));
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
}
const calendar=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="캘린더에 추가");

it("lets the manager save the confirmed visit with the unit and the request number, never the address or access",async()=>{
  await mount("2026-10-06T03:00:00Z");await act(async()=>calendar()!.click());
  const text=save.mock.calls[0][1].replace(/\r\n /g,"");
  expect(text).toContain("SUMMARY:업체 방문 · 누수 · 해솔빌라 101동 1203호\r\n");expect(text).toContain("LOCATION:해솔빌라 101동 1203호\r\n");expect(text).toContain("요청 번호 ticket-5f0c · 세입자 확정");
  expect(text).not.toContain("합성로");expect(text).not.toContain("합성 출입 안내 문구");expect(text).not.toContain("합성 업체");
});
it("drops the button once the visit has ended",async()=>{
  await mount("2026-10-07T06:00:00Z");expect(calendar()).toBeUndefined();
});
```

If `VendorHandoffManager`'s props or the handoff DTO fields differ from the fixture above, align the fixture with `vendor-handoff-manager-schedule.test.tsx` (its `scheduled()` builder and `mount`) rather than changing the component.

- [ ] **Step 2: Run, expect failure** — `npm --workspace @build-manager/web run test -- src/app/core/vendor-handoff-manager-calendar.test.tsx` → fails (no button).

- [ ] **Step 3: Implement** — in `vendor-handoff-manager.tsx` add imports:

```ts
import { VisitCalendarButton } from "../../components/visit-calendar-button";
import { managerVisitCalendar,visitCalendarFileName,visitStillAhead } from "../../lib/visit-calendar";
```

Inside `{appointment?<div role="group" aria-label="방문 일정">`, right after the `<p>방문 일정 · …</p>` line, insert:

```tsx
      {packet&&visitStillAhead(appointment,at)?<VisitCalendarButton fileName={visitCalendarFileName(appointment)} build={()=>managerVisitCalendar(appointment,packet,p.ticket.ticketId,p.now??new Date())} disabled={blocked}/>:null}
```

(`packet`, `at` and `blocked` are the existing locals defined above the `return`.)

- [ ] **Step 4: Run** — the new test file plus `vendor-handoff-manager*.test.tsx` → all pass.
- [ ] **Step 5: Commit** — `git add apps/web/src/app/core/vendor-handoff-manager.tsx apps/web/src/app/core/vendor-handoff-manager-calendar.test.tsx` then `git commit -m "feat(web): let the manager add a confirmed vendor visit to a calendar" -m "$CO_AUTHOR"`.

### Task 6: Vendor

**Files:** modify `apps/web/src/app/vendor/job/vendor-job-screen.tsx` (`VisitScheduling`); create `apps/web/src/app/vendor/job/vendor-job-calendar.test.tsx`.

- [ ] **Step 1: Failing test**

```tsx
// apps/web/src/app/vendor/job/vendor-job-calendar.test.tsx
// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import type { VendorJobClient } from "@build-manager/api-client";
import type { VendorJobDto } from "@build-manager/api-contracts";
import { downloadFile } from "../../../lib/download-file";
import { VendorJobScreen } from "./vendor-job-screen";

vi.mock("../../../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
const assignmentId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",packetId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",roundId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",apptId="18181818-1818-4818-8818-181818181818";
const job=():VendorJobDto=>({assignmentId,assignmentVersion:4,status:"ACTIVE",endReason:null,phase:"SCHEDULED",waitingOn:"VENDOR",
  currentPacket:{id:packetId,assignmentId,jobReference:"JOB-B",vendorLabel:"합성 업체 B",revision:1,publishedAt:"2026-10-07T00:00:00.000Z",buildingName:"합성 건물 B",serviceAddress:"합성 주소 B, 2층",unitLabel:"101호",issueType:"LEAK",workSummary:"합성 누수 점검 B",
    sharedDetails:[{key:"leak.active",label:"현재 누수",value:"예",sourceType:"TENANT_REPORTED"}],allowedPhotoIds:[],safetyNotice:[],accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",accessInstruction:"관리실에서 열쇠 수령"},
  currentRound:{id:roundId,openedPacketRevisionId:packetId,purpose:"INITIAL",status:"CONFIRMED",version:3,createdAt:"2026-10-06T00:00:00.000Z"},
  appointment:{id:apptId,schedulingRoundId:roundId,packetRevisionId:packetId,proposalId:null,availabilitySubmissionId:null,selectedWindowId:null,startAt:"2026-10-07T05:00:00.000Z",endAt:"2026-10-07T06:00:00.000Z",confirmationMode:"TENANT_CONFIRMED",status:"SCHEDULED",createdAt:"2026-10-06T02:00:00.000Z"},
  activeBlocker:null,currentReport:null,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",availability:null,proposal:null});
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>{save.mockReset();window.sessionStorage.clear();window.history.replaceState(null,"","/vendor/job");});
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(at:string){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const client={session:vi.fn(async()=>({assignmentId,expiresAt:"2026-10-14T00:00:00.000Z",csrf:"S".repeat(42)+"z"})),job:vi.fn(async()=>job()),
    sourcePhotoPath:(id:string)=>`/api/v2/vendor/job/source-photos/${id}`,completionPhotoPath:(id:string)=>`/api/v2/vendor/job/completion-photos/${id}`};
  await act(async()=>root!.render(<VendorJobScreen client={client as unknown as VendorJobClient} now={()=>new Date(at)}/>));
  await act(async()=>{for(let i=0;i<12;i++)await Promise.resolve();});
}
const calendar=()=>Array.from(host!.querySelectorAll("button")).find(button=>button.textContent==="캘린더에 추가");

it("lets the vendor save the confirmed visit with the service address and the job number, never the access instruction",async()=>{
  await mount("2026-10-06T03:00:00Z");await act(async()=>calendar()!.click());
  const text=save.mock.calls[0][1].replace(/\r\n /g,"");
  expect(text).toContain("SUMMARY:방문 · 누수 · 합성 건물 B 101호\r\n");expect(text).toContain("LOCATION:합성 주소 B\\, 2층\r\n");expect(text).toContain("작업 번호 JOB-B");
  for(const hidden of ["관리실에서 열쇠 수령","현재 누수","합성 업체 B","합성 누수 점검 B"])expect(text).not.toContain(hidden);
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.");
});
it("drops the button once the visit has ended",async()=>{
  await mount("2026-10-07T06:00:00Z");expect(calendar()).toBeUndefined();
});
```

If the screen needs more client methods while mounting, copy the missing ones from `fakeClient` in `vendor-job-screen.test.tsx`.

- [ ] **Step 2: Run, expect failure** — `npm --workspace @build-manager/web run test -- src/app/vendor/job/vendor-job-calendar.test.tsx` → fails (no button).

- [ ] **Step 3: Implement** — in `vendor-job-screen.tsx` add imports:

```ts
import { VisitCalendarButton } from "../../../components/visit-calendar-button";
import { vendorVisitCalendar,visitCalendarFileName,visitStillAhead } from "../../../lib/visit-calendar";
```

In `VisitScheduling`, inside the confirmed-visit group, right after the `<p>{appointment.confirmationMode==="PREAUTHORIZED_ENTRY"?…}</p>` line, insert:

```tsx
      {job.currentPacket&&visitStillAhead(appointment,at)?<VisitCalendarButton fileName={visitCalendarFileName(appointment)} build={()=>vendorVisitCalendar(appointment,job.currentPacket!,now())} disabled={submitting}/>:null}
```

(`at`, `now`, `submitting` and `job` are already in scope there.)

- [ ] **Step 4: Run** — the new test file plus `vendor-job-screen.test.tsx` → all pass.
- [ ] **Step 5: Commit** — `git add apps/web/src/app/vendor/job/vendor-job-screen.tsx apps/web/src/app/vendor/job/vendor-job-calendar.test.tsx` then `git commit -m "feat(web): let the vendor add a confirmed visit to a calendar with the service address" -m "$CO_AUTHOR"`.

### Task 7: The three files in a real browser

**Files:** modify `apps/web/tests/vendor-e2e/vendor-job.spec.ts` (append one test; add `import type { Page } from '@playwright/test';` at the top).

- [ ] **Step 1: Append**

```ts
test('C1 each role saves the confirmed visit as a calendar file with only its own details', async ({ browser, fixture }) => {
  const c = await provision(fixture), v = await vendorContext(browser, fixture, c.link), tenant = await actor(browser, fixture, 'tenant'), manager = await actor(browser, fixture, 'manager', 1280);
  const ics = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
  const utc = (at: string) => new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
  const save = async (page: Page) => {
    const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: '캘린더에 추가', exact: true }).click();
    await expect(page.locator('[data-toast]')).toHaveText('캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.');
    const file = await waiting; expect(file.suggestedFilename()).toMatch(/^방문일정_\d{4}-\d{2}-\d{2}\.ics$/);
    return (await readFile((await file.path())!)).toString('utf8').replace(/\r\n /g, '');
  };
  try {
    await keyboardClick(v.page, '작업 수락');
    const j = await scheduled(fixture, v.context, c.ticketId), address = ics(j.currentPacket.serviceAddress);
    await v.page.reload(); const vendorFile = await save(v.page);
    await openTicket(tenant.page, c.ticketId); const tenantFile = await save(tenant.page);
    await openTicket(manager.page, c.ticketId, true); const managerFile = await save(manager.page);
    for (const text of [vendorFile, tenantFile, managerFile]) {
      expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true); expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
      expect(text).toContain(`UID:${j.appointment.id}@build-manager\r\n`); expect(text).toContain(`DTSTART:${utc(j.appointment.startAt)}\r\n`); expect(text).toContain(`DTEND:${utc(j.appointment.endAt)}\r\n`);
      expect(text).not.toContain('Task12 synthetic private resident text');
    }
    expect(vendorFile).toContain(`LOCATION:${address}\r\n`); expect(vendorFile).toContain(`작업 번호 ${ics(j.currentPacket.jobReference)}`);
    expect(tenantFile).not.toContain(address); expect(managerFile).not.toContain(address); expect(managerFile).toContain(`요청 번호 ${c.ticketId}`);
  } finally { await v.close(); await tenant.close(); await manager.close(); }
});
```

- [ ] **Step 2: Run** (pinned Node, announce first): `npm run test:e2e:vendor -- -g "C1 each role"` → passes. If `openTicket(manager.page, …, true)` does not show the vendor panel's visit box, open it the way `T12-B02` reaches the manager vendor panel before calling `save`.
- [ ] **Step 3: Commit** — `git add apps/web/tests/vendor-e2e/vendor-job.spec.ts` then `git commit -m "test(web): save the visit calendar file as the vendor, the tenant and the manager in the browser" -m "$CO_AUTHOR"`.

### Task 8: Checks, records, review, PR

- [ ] **Step 1: DEV-06** (pinned Node, sequential, exit codes recorded, announce heavy runs): `npm run test:shared`, `npm run test:web`, `npm run lint`, `npm run typecheck`, `npm run build:web`, `npm run check:deps`, `npm run test:postgres`, `npm run test:e2e:vendor`, `npm run test:e2e:core`, `python scripts/verify_repository.py --history`. Package files unchanged after `npm ci`.
- [ ] **Step 2: Design audit** — `node --experimental-transform-types scripts/design-audit.mjs ~/.build-manager-rc1-private/visit-calendar-c1-audit --engines chromium,webkit` → 0 findings; look at the 390px and 1280px captures of a screen with a confirmed visit if the audit captures one, otherwise note which screens it does not reach.
- [ ] **Step 3: Records** — `ops/visit_calendar_c1_20261015_acceptance.md` in the format of `ops/excel_export_e1_20261015_acceptance.md` (risk tier, operator decisions with quotes and alternatives incl. the automatic-adding choice, spec and plan, refs, change list, threats with evidence, checks with exit codes, review result, rollback, remaining risks, the phone check as `NOT_RUN` until the operator tries it); one row each in `ops/AI_Execution_Log.csv` (`VISIT-CALENDAR-C1-20261015`) and `ops/pending_external_sync.md`; a `STATUS.md` row "Visit calendar file (integrations C1)" that says it is not on the demo and that automatic adding belongs to app v2.
- [ ] **Step 4: Independent review** — fresh-context read-only agent on `origin/main...HEAD` against the spec's threat table; fix blocking findings with delta tests; record the result.
- [ ] **Step 5: PR** — push, `Risk tier: 고위험` first line; merge only after CI passes on the exact head with `gh pr merge <n> --merge --match-head-commit <sha>`. Demo deploy and the operator's phone check are separate steps.

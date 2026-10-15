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
  expect(folded.split("\r\n").length).toBeGreaterThan(1);expect(folded.split("\r\n").slice(1).every(part=>part.startsWith(" "))).toBe(true);expect(unfold(folded)).toBe(line);
  expect(icsFold("VERSION:2.0")).toBe("VERSION:2.0");
});
it("writes one event with the required properties in order, CRLF line ends and no alarm",()=>{
  const text=calendarFile(event),lines=unfold(text).split("\r\n");
  expect(text.endsWith("\r\n")).toBe(true);expect(text.replace(/\r\n/g,"").includes("\n")).toBe(false);
  expect(lines).toEqual(["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//build-manager//visit calendar//KO","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
    "UID:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@build-manager","DTSTAMP:20261015T104209Z","DTSTART:20261017T050000Z","DTEND:20261017T070000Z",
    "SUMMARY:방문 · 누수 · 해솔빌라 101동 1203호","LOCATION:서울 합성구 합성로 12\\, 3층","DESCRIPTION:작업 번호 JOB-7F3A.","END:VEVENT","END:VCALENDAR",""]);
  expect(text).not.toContain("VALARM");expect(text.charCodeAt(0)).not.toBe(0xfeff);
});
it("leaves LOCATION out when there is no place",()=>{
  const text=calendarFile({...event,location:null});expect(text).toContain("BEGIN:VEVENT");expect(text).not.toContain("LOCATION");
});

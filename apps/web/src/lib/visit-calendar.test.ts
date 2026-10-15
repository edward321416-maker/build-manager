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
  const unknown=tenantVisitCalendar(visit,"HEATING",null,now);expect(field(unknown,"SUMMARY")).toBe("SUMMARY:수리 방문 · 난방");expect(field(unknown,"LOCATION")).toBeNull();
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

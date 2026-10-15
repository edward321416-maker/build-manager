import { calendarFile } from "./calendar-file";
import { instantToSeoulLocal } from "./date-text";

// C1 (spec docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md): what each role's calendar entry says. Only the
// vendor's entry carries the service address (operator decision 2026-10-15); access instructions, names, contacts, shared
// details, safety notices, photos and notes never go in, so each entry is built from named fields only.
export type CalendarVisit={id:string;startAt:string;endAt:string;confirmationMode:"TENANT_CONFIRMED"|"PREAUTHORIZED_ENTRY"};
export type CalendarPacket={jobReference:string;buildingName:string;unitLabel:string|null;serviceAddress:string|null;issueType:"HEATING"|"LEAK"};
const issueNames={HEATING:"난방",LEAK:"누수"} as const;
const AGAIN="일정이 바뀌면 다시 받아 주세요.";
/** `{건물} {호실}` with an empty part left out (a missing building name arrives as ""), or null when both are empty. */
export const visitPlace=(building:string,unit:string|null)=>[building,unit].filter(Boolean).join(" ")||null;
const title=(...parts:(string|null)[])=>parts.filter(Boolean).join(" · ");
const visitFile=(visit:CalendarVisit,now:Date,summary:string,location:string|null,description:string)=>calendarFile({uid:`${visit.id}@build-manager`,start:visit.startAt,end:visit.endAt,stamp:now.toISOString(),summary,location,description});
export const tenantVisitCalendar=(visit:CalendarVisit,issueType:"HEATING"|"LEAK",where:string|null,now:Date)=>visitFile(visit,now,`수리 방문 · ${issueNames[issueType]}`,where,"업체가 방문해요. 일정이 바뀌면 build-manager에서 다시 받아 주세요.");
export const vendorVisitCalendar=(visit:CalendarVisit,packet:CalendarPacket,now:Date)=>visitFile(visit,now,title("방문",issueNames[packet.issueType],visitPlace(packet.buildingName,packet.unitLabel)),packet.serviceAddress,`작업 번호 ${packet.jobReference}. 출입 방법은 작업 화면에서 확인해 주세요. ${AGAIN}`);
export const managerVisitCalendar=(visit:CalendarVisit,packet:CalendarPacket,ticketId:string,now:Date)=>visitFile(visit,now,title("업체 방문",issueNames[packet.issueType],visitPlace(packet.buildingName,packet.unitLabel)),visitPlace(packet.buildingName,packet.unitLabel),`요청 번호 ${ticketId} · ${visit.confirmationMode==="PREAUTHORIZED_ENTRY"?"세입자가 동의한 시간 안에서 업체가 선택":"세입자 확정"}. ${AGAIN}`);
export const visitCalendarFileName=(visit:{startAt:string})=>`방문일정_${instantToSeoulLocal(visit.startAt).date}.ics`;
/** The button stays until the visit's end time has passed. */
export const visitStillAhead=(visit:{endAt:string},now:Date)=>Date.parse(visit.endAt)>now.getTime();

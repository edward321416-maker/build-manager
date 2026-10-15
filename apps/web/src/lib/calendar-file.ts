/**
 * iCalendar text for one visit (RFC 5545; C1 spec docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md): CRLF
 * line ends, lines folded at 75 octets without splitting a character, TEXT values escaped so no value can start a new
 * property, UTC times, no alarm.
 */
export type CalendarEvent={uid:string;start:string;end:string;stamp:string;summary:string;location:string|null;description:string};
const encoder=new TextEncoder();
/** `2026-10-17T05:00:00.000Z` → `20261017T050000Z`; throws on a value that is not an instant. */
export function icsUtc(at:string):string{const time=Date.parse(at);if(!Number.isFinite(time))throw new RangeError("INVALID_INSTANT");return new Date(time).toISOString().replace(/\.\d{3}Z$/,"Z").replace(/[-:]/g,"");}
/**
 * TEXT escaping (RFC 5545 3.3.11): backslash, semicolon, comma and line breaks; other control characters and the Unicode
 * line and paragraph separators (which some readers split lines on) become spaces.
 */
export function icsText(value:string):string{return value.replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r\n|\r|\n/g,"\\n").replace(/[\p{Cc}\u2028\u2029]/gu," ");}
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

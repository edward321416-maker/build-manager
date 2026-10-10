/**
 * Deterministic Asia/Seoul Korean time presentation for every Vendor-handoff surface (Manager, Tenant, Vendor).
 * Korea observes no daylight saving time, so a fixed +09:00 offset is exact and host/browser time zones never apply.
 * Validation always compares absolute instants, never formatted strings.
 */
const OFFSET_MS=9*3_600_000;
const WEEKDAYS="일월화수목금토";

export type VendorInterval={startAt:string;endAt:string};
type SeoulParts={year:number;month:number;day:number;weekday:string;hour:number;minute:number};

function instant(value:string|Date):number{
  const time=typeof value==="string"?Date.parse(value):value.getTime();
  if(!Number.isFinite(time))throw new RangeError("INVALID_INSTANT");
  return time;
}
function seoul(value:string|Date):SeoulParts{
  const shifted=new Date(instant(value)+OFFSET_MS);
  return {year:shifted.getUTCFullYear(),month:shifted.getUTCMonth()+1,day:shifted.getUTCDate(),
    weekday:WEEKDAYS[shifted.getUTCDay()],hour:shifted.getUTCHours(),minute:shifted.getUTCMinutes()};
}
const meridiem=(p:SeoulParts)=>p.hour<12?"오전":"오후";
const clock=(p:SeoulParts)=>`${p.hour%12===0?12:p.hour%12}:${String(p.minute).padStart(2,"0")}`;
const datePart=(p:SeoulParts,currentYear:number)=>`${p.year===currentYear?"":`${p.year}년 `}${p.month}월 ${p.day}일(${p.weekday})`;

/** `10월 7일(수) 오후 2:00`; the year is shown only when it differs from the current Seoul year. */
export function formatVendorInstant(at:string,now:Date=new Date()):string{
  const p=seoul(at);
  return `${datePart(p,seoul(now).year)} ${meridiem(p)} ${clock(p)}`;
}

/**
 * Same day: `10월 7일(수) 오후 2:00–3:00`, or both meridiems when the range crosses noon.
 * Different days: both full date/time endpoints, e.g. `10월 7일(수) 오후 11:30 – 10월 8일(목) 오전 1:00`.
 */
export function formatVendorInterval(startAt:string,endAt:string,now:Date=new Date()):string{
  const start=seoul(startAt),end=seoul(endAt),year=seoul(now).year;
  if(start.year!==end.year||start.month!==end.month||start.day!==end.day)
    return `${formatVendorInstant(startAt,now)} – ${formatVendorInstant(endAt,now)}`;
  const endText=meridiem(start)===meridiem(end)?clock(end):`${meridiem(end)} ${clock(end)}`;
  return `${datePart(start,year)} ${meridiem(start)} ${clock(start)}–${endText}`;
}

/** True only when `inner` is a non-empty interval fully contained in `outer`, by absolute instant. */
export function intervalWithin(inner:VendorInterval,outer:VendorInterval):boolean{
  try{
    const s=instant(inner.startAt),e=instant(inner.endAt),os=instant(outer.startAt),oe=instant(outer.endAt);
    return s<e&&s>=os&&e<=oe;
  }catch{return false;}
}

/** ISO instant → Seoul calendar date `YYYY-MM-DD` and wall time `HH:MM` (seconds dropped); the inverse of seoulLocalToInstant. */
export function instantToSeoulLocal(at:string):{date:string;time:string}{
  const p=seoul(at),pad=(value:number)=>String(value).padStart(2,"0");
  return {date:`${p.year}-${pad(p.month)}-${pad(p.day)}`,time:`${pad(p.hour)}:${pad(p.minute)}`};
}

/** Seoul calendar date `YYYY-MM-DD` + wall time `HH:MM` → ISO instant; null for impossible or malformed entries. */
export function seoulLocalToInstant(date:string,time:string):string|null{
  const d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date),t=/^(\d{2}):(\d{2})$/.exec(time);
  if(!d||!t)return null;
  const [year,month,day,hour,minute]=[Number(d[1]),Number(d[2]),Number(d[3]),Number(t[1]),Number(t[2])];
  if(hour>23||minute>59||month<1||month>12)return null;
  const wall=Date.UTC(year,month-1,day,hour,minute);
  const check=new Date(wall);
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;
  return new Date(wall-OFFSET_MS).toISOString();
}

/**
 * Vendor-handoff time ranges (Manager, Tenant, Vendor) in Seoul time, built on the one Seoul clock in date-text.ts.
 * Validation always compares absolute instants, never formatted strings.
 */
import { absoluteDateTime,clockParts,clockText,dateText,meridiem } from "./date-text";

export type VendorInterval={startAt:string;endAt:string};

function instant(value:string):number{
  const time=Date.parse(value);
  if(!Number.isFinite(time))throw new RangeError("INVALID_INSTANT");
  return time;
}

/**
 * Same day: `10월 7일 (수) 오후 2:00–3:00`, or both meridiems when the range crosses noon.
 * Different days: both full date/time endpoints, e.g. `10월 7일 (수) 오후 11:30 – 10월 8일 (목) 오전 1:00`.
 */
export function formatVendorInterval(startAt:string,endAt:string,now:Date=new Date()):string{
  const start=clockParts(startAt),end=clockParts(endAt),year=clockParts(now).year;
  if(start.year!==end.year||start.month!==end.month||start.day!==end.day)
    return `${absoluteDateTime(startAt,{now})} – ${absoluteDateTime(endAt,{now})}`;
  const endText=meridiem(start)===meridiem(end)?clockText(end):`${meridiem(end)} ${clockText(end)}`;
  return `${dateText(start,year)} ${meridiem(start)} ${clockText(start)}–${endText}`;
}

/** True only when `inner` is a non-empty interval fully contained in `outer`, by absolute instant. */
export function intervalWithin(inner:VendorInterval,outer:VendorInterval):boolean{
  try{
    const s=instant(inner.startAt),e=instant(inner.endAt),os=instant(outer.startAt),oe=instant(outer.endAt);
    return s<e&&s>=os&&e<=oe;
  }catch{return false;}
}

import { describe,expect,it } from "vitest";
import { formatVendorInstant,formatVendorInterval,instantToSeoulLocal,intervalWithin,seoulLocalToInstant } from "./vendor-time";

const now=new Date("2026-10-06T03:00:00Z");

describe("formatVendorInterval (Asia/Seoul, Korean)",()=>{
  it("renders the frozen current-year same-meridiem example",()=>{
    expect(formatVendorInterval("2026-10-07T05:00:00Z","2026-10-07T06:00:00Z",now)).toBe("10월 7일(수) 오후 2:00–3:00");
  });
  it("keeps a compact same-AM range",()=>{
    expect(formatVendorInterval("2026-10-07T00:00:00Z","2026-10-07T01:30:00Z",now)).toBe("10월 7일(수) 오전 9:00–10:30");
  });
  it("labels both meridiems for a same-day AM to PM range",()=>{
    expect(formatVendorInterval("2026-10-07T01:00:00Z","2026-10-07T04:00:00Z",now)).toBe("10월 7일(수) 오전 10:00–오후 1:00");
  });
  it("shows both dates across midnight",()=>{
    expect(formatVendorInterval("2026-10-07T14:30:00Z","2026-10-07T16:00:00Z",now)).toBe("10월 7일(수) 오후 11:30 – 10월 8일(목) 오전 1:00");
  });
  it("includes the year for a different-year date",()=>{
    expect(formatVendorInterval("2027-01-03T13:00:00Z","2027-01-03T13:30:00Z",now)).toBe("2027년 1월 3일(일) 오후 10:00–10:30");
    expect(formatVendorInstant("2027-01-03T14:00:00Z",now)).toBe("2027년 1월 3일(일) 오후 11:00");
  });
  it("decides the current year at the Seoul New Year boundary, not UTC",()=>{
    const seoulNewYear=new Date("2026-12-31T15:30:00Z");
    expect(formatVendorInterval("2027-01-02T01:00:00Z","2027-01-02T02:00:00Z",seoulNewYear)).toBe("1월 2일(토) 오전 10:00–11:00");
    expect(formatVendorInterval("2026-12-31T05:00:00Z","2026-12-31T06:00:00Z",seoulNewYear)).toBe("2026년 12월 31일(목) 오후 2:00–3:00");
  });
  it("renders noon and midnight hours as 12",()=>{
    expect(formatVendorInterval("2026-10-07T03:00:00Z","2026-10-07T03:30:00Z",now)).toBe("10월 7일(수) 오후 12:00–12:30");
    expect(formatVendorInterval("2026-10-07T15:00:00Z","2026-10-07T15:45:00Z",now)).toBe("10월 8일(목) 오전 12:00–12:45");
  });
  it("crosses years with both dates and years where needed",()=>{
    expect(formatVendorInterval("2026-12-31T14:30:00Z","2026-12-31T15:30:00Z",now)).toBe("12월 31일(목) 오후 11:30 – 2027년 1월 1일(금) 오전 12:30");
  });
});

describe("absolute containment",()=>{
  const window={startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T07:00:00Z"};
  it("accepts a slot fully inside the window by instant",()=>{
    expect(intervalWithin({startAt:"2026-10-07T14:00:00+09:00",endAt:"2026-10-07T16:00:00+09:00"},window)).toBe(true);
  });
  it("rejects a visually similar slot that leaves the window by seconds",()=>{
    expect(intervalWithin({startAt:"2026-10-07T05:00:00Z",endAt:"2026-10-07T07:00:30Z"},window)).toBe(false);
    expect(intervalWithin({startAt:"2026-10-07T04:59:59Z",endAt:"2026-10-07T06:00:00Z"},window)).toBe(false);
    expect(intervalWithin({startAt:"2026-10-07T06:00:00Z",endAt:"2026-10-07T06:00:00Z"},window)).toBe(false);
  });
});

describe("Seoul wall-clock entry",()=>{
  it("converts Seoul calendar date and time to an absolute instant independent of the host zone",()=>{
    expect(seoulLocalToInstant("2026-10-07","14:00")).toBe("2026-10-07T05:00:00.000Z");
    expect(seoulLocalToInstant("2027-01-01","00:30")).toBe("2026-12-31T15:30:00.000Z");
  });
  it.each([["2026-02-30","10:00"],["2026-13-01","10:00"],["2026-10-07","24:00"],["2026-10-07","9:5"],["","10:00"],["2026-10-07T10:00","10:00"]])("rejects an impossible or malformed entry %s %s",(date,time)=>{
    expect(seoulLocalToInstant(date,time)).toBeNull();
  });
  it("turns an instant back into the Seoul date and time it was entered as, across midnight and the new year",()=>{
    expect(instantToSeoulLocal("2026-10-07T05:00:00.000Z")).toEqual({date:"2026-10-07",time:"14:00"});
    expect(instantToSeoulLocal("2026-10-07T15:00:00Z")).toEqual({date:"2026-10-08",time:"00:00"});
    expect(instantToSeoulLocal("2026-12-31T15:30:00Z")).toEqual({date:"2027-01-01",time:"00:30"});
    const {date,time}=instantToSeoulLocal("2026-10-07T05:00:00.000Z");
    expect(seoulLocalToInstant(date,time)).toBe("2026-10-07T05:00:00.000Z");
  });
});

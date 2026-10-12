import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  absoluteDateTime, clockParts, formatDateTime, instantToSeoulInput, instantToSeoulLocal, seoulInputToInstant, seoulLocalToInstant,
} from "./date-text";

const source = fileURLToPath(new URL("..", import.meta.url));
const screenFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? screenFiles(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);

// 2026-10-12 14:00 in Seoul.
const now = new Date("2026-10-12T05:00:00Z");

describe("date text (design rules section 14, Seoul time)", () => {
  it("writes this year's dates with the weekday and other years with the year and no weekday", () => {
    expect(formatDateTime("2026-10-10T04:18:00Z", { now })).toBe("10월 10일 (토) 오후 1:18");
    expect(formatDateTime("2025-03-02T05:00:00Z", { now })).toBe("2025년 3월 2일 오후 2:00");
    expect(absoluteDateTime("2027-01-03T14:00:00Z", { now })).toBe("2027년 1월 3일 오후 11:00");
  });

  it("writes noon as 오후 12 and midnight as 오전 12", () => {
    expect(formatDateTime("2026-10-07T03:00:00Z", { now })).toBe("10월 7일 (수) 오후 12:00");
    expect(formatDateTime("2026-10-07T15:05:00Z", { now })).toBe("10월 8일 (목) 오전 12:05");
  });

  it("is Seoul time on every machine, with no time zone database to fail (operator decision 2026-10-12)", () => {
    expect(clockParts("2026-10-07T15:05:00Z")).toEqual({ year: 2026, month: 10, day: 8, weekday: "목", hour: 0, minute: 5 });
    // The Seoul new year starts at 15:00 UTC on 31 December.
    expect(clockParts("2026-12-31T15:30:00Z")).toMatchObject({ year: 2027, month: 1, day: 1, hour: 0, minute: 30 });
  });

  it("uses relative time only for the last hour, with the exact time beside it, and never for future times", () => {
    expect(formatDateTime("2026-10-12T04:59:30Z", { now })).toBe("방금 (오후 1:59)");
    expect(formatDateTime("2026-10-12T04:01:00Z", { now })).toBe("59분 전 (오후 1:01)");
    expect(formatDateTime("2026-10-12T03:59:00Z", { now })).toBe("10월 12일 (월) 오후 12:59");
    expect(formatDateTime("2026-10-12T05:10:00Z", { now })).toBe("10월 12일 (월) 오후 2:10");
    expect(formatDateTime("2026-10-12T04:59:30Z", { now, relative: false })).toBe("10월 12일 (월) 오후 1:59");
  });

  it("counts minutes on the clock, so the minutes and the time beside them always agree", () => {
    // 14:00:10 now and 13:49:50 then: the clock shows 2:00 and 1:49, which is 11 minutes.
    const ten = new Date("2026-10-12T05:00:10Z");
    expect(formatDateTime("2026-10-12T04:49:50Z", { now: ten })).toBe("11분 전 (오후 1:49)");
    // Sixty clock minutes is no longer the last hour.
    expect(formatDateTime("2026-10-12T04:00:50Z", { now: ten })).toBe("10월 12일 (월) 오후 1:00");
  });

  it("keeps relative time to the same Seoul day, so a time from before midnight always shows its date", () => {
    // 00:20 on 13 October in Seoul; 23:40 the day before is 40 minutes ago but on another day.
    const afterMidnight = new Date("2026-10-12T15:20:00Z");
    expect(formatDateTime("2026-10-12T14:40:00Z", { now: afterMidnight })).toBe("10월 12일 (월) 오후 11:40");
    expect(formatDateTime("2026-10-12T15:05:00Z", { now: afterMidnight })).toBe("15분 전 (오전 12:05)");
  });

  it("reads a server time slightly ahead of this clock as 방금 at this clock's time, not as a full date", () => {
    expect(formatDateTime("2026-10-12T05:00:05Z", { now })).toBe("방금 (오후 2:00)");
    // The phone shows 1:59, so the bracket must not show the server's 2:00.
    expect(formatDateTime("2026-10-12T05:00:50Z", { now: new Date("2026-10-12T04:59:55Z") })).toBe("방금 (오후 1:59)");
    expect(formatDateTime("2026-10-12T05:01:30Z", { now })).toBe("10월 12일 (월) 오후 2:01");
  });

  it("refuses an instant it cannot read, but formatting shows the raw text instead of throwing during render", () => {
    expect(() => clockParts("not a date")).toThrow(RangeError);
    expect(formatDateTime("not a date", { now })).toBe("not a date");
  });

  it("works out the weekday from the date itself", () => {
    // 2027-01-01 is a Friday, 2026-02-28 a Saturday.
    expect(clockParts("2027-01-01T03:00:00Z").weekday).toBe("금");
    expect(clockParts("2026-02-28T03:00:00Z").weekday).toBe("토");
  });

  it("is the only way the web shows a date: no screen falls back to the browser's default format", () => {
    const offenders = screenFiles(source).filter(file => /toLocale(Date|Time)?String\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("Seoul wall-clock entry", () => {
  it("converts Seoul calendar date and time to an absolute instant independent of the host zone", () => {
    expect(seoulLocalToInstant("2026-10-07", "14:00")).toBe("2026-10-07T05:00:00.000Z");
    expect(seoulLocalToInstant("2027-01-01", "00:30")).toBe("2026-12-31T15:30:00.000Z");
  });
  it.each([["2026-02-30", "10:00"], ["2026-13-01", "10:00"], ["2026-10-07", "24:00"], ["2026-10-07", "9:5"], ["", "10:00"], ["2026-10-07T10:00", "10:00"]])("rejects an impossible or malformed entry %s %s", (date, time) => {
    expect(seoulLocalToInstant(date, time)).toBeNull();
  });
  it("turns an instant back into the Seoul date and time it was entered as, across midnight and the new year", () => {
    expect(instantToSeoulLocal("2026-10-07T05:00:00.000Z")).toEqual({ date: "2026-10-07", time: "14:00" });
    expect(instantToSeoulLocal("2026-10-07T15:00:00Z")).toEqual({ date: "2026-10-08", time: "00:00" });
    expect(instantToSeoulLocal("2026-12-31T15:30:00Z")).toEqual({ date: "2027-01-01", time: "00:30" });
  });
  it("fills and reads a datetime-local input in Seoul time, as the manager's due date does", () => {
    expect(instantToSeoulInput("2026-10-07T15:00:00Z")).toBe("2026-10-08T00:00");
    expect(seoulInputToInstant("2026-10-08T00:00")).toBe("2026-10-07T15:00:00.000Z");
    expect(seoulInputToInstant("2026-10-08T00:00:00")).toBe("2026-10-07T15:00:00.000Z");
    expect(seoulInputToInstant("2026-02-30T10:00")).toBeNull();
    expect(seoulInputToInstant("")).toBeNull();
  });
  it("refuses a malformed input value as a whole instead of reading its pieces", () => {
    for (const value of ["2026-10-08X00:00", "2026-10-08T00:00junk", "2026-10-08 00:00", "x2026-10-08T00:00"]) expect(seoulInputToInstant(value)).toBeNull();
  });
  it("leaves the input empty for an instant it cannot read, instead of throwing in the middle of a save", () => {
    expect(instantToSeoulInput("garbage")).toBe("");
  });
});

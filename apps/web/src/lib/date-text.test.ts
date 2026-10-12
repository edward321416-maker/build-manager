import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clockParts, formatDateTime } from "./date-text";

const source = fileURLToPath(new URL("..", import.meta.url));
const screenFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? screenFiles(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);

const seoul = { timeZone: "Asia/Seoul" };
// 2026-10-12 14:00 in Seoul.
const now = new Date("2026-10-12T05:00:00Z");

describe("date text (design rules section 14)", () => {
  it("writes this year's dates with the weekday and other years with the year and no weekday", () => {
    expect(formatDateTime("2026-10-10T04:18:00Z", { ...seoul, now })).toBe("10월 10일 (토) 오후 1:18");
    expect(formatDateTime("2025-03-02T05:00:00Z", { ...seoul, now })).toBe("2025년 3월 2일 오후 2:00");
  });

  it("writes noon as 오후 12 and midnight as 오전 12", () => {
    expect(formatDateTime("2026-10-07T03:00:00Z", { ...seoul, now })).toBe("10월 7일 (수) 오후 12:00");
    expect(formatDateTime("2026-10-07T15:05:00Z", { ...seoul, now })).toBe("10월 8일 (목) 오전 12:05");
  });

  it("uses relative time only for the last hour, and never for future times", () => {
    expect(formatDateTime("2026-10-12T04:59:30Z", { ...seoul, now })).toBe("방금");
    expect(formatDateTime("2026-10-12T04:01:00Z", { ...seoul, now })).toBe("59분 전");
    expect(formatDateTime("2026-10-12T03:59:00Z", { ...seoul, now })).toBe("10월 12일 (월) 오후 12:59");
    expect(formatDateTime("2026-10-12T05:10:00Z", { ...seoul, now })).toBe("10월 12일 (월) 오후 2:10");
    expect(formatDateTime("2026-10-12T04:59:30Z", { ...seoul, now, relative: false })).toBe("10월 12일 (월) 오후 1:59");
  });

  it("reads the instant in the time zone it is given", () => {
    expect(formatDateTime("2026-10-07T15:05:00Z", { timeZone: "UTC", now })).toBe("10월 7일 (수) 오후 3:05");
    expect(clockParts("2026-10-07T15:05:00Z", "Asia/Seoul")).toEqual({ year: 2026, month: 10, day: 8, weekday: "목", hour: 0, minute: 5 });
  });

  it("refuses an instant it cannot read", () => {
    expect(() => clockParts("not a date")).toThrow(RangeError);
  });

  it("is the only way the web shows a date: no screen falls back to the browser's default format", () => {
    const offenders = screenFiles(source).filter(file => /toLocale(Date|Time)?String\(/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

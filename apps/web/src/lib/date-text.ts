/**
 * Korean date and time text in the design rules section 14 format, one place for every web screen.
 * Without a `timeZone` the browser's zone applies, as on /core so far; Vendor surfaces keep their fixed Seoul time
 * in vendor-time.ts and only borrow the text shapes from here.
 */
export type ClockParts = { year: number; month: number; day: number; weekday: string; hour: number; minute: number };

const WEEKDAYS = "일월화수목금토";
const ENGLISH_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_MS = 3_600_000, MINUTE_MS = 60_000;

export function clockParts(at: string | Date, timeZone?: string): ClockParts {
  const date = typeof at === "string" ? new Date(at) : at;
  if (!Number.isFinite(date.getTime())) throw new RangeError("INVALID_INSTANT");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return {
    year: Number(part("year")), month: Number(part("month")), day: Number(part("day")),
    weekday: WEEKDAYS[ENGLISH_WEEKDAYS.indexOf(part("weekday"))], hour: Number(part("hour")) % 24, minute: Number(part("minute")),
  };
}

/** `10월 12일 (월)` this year, `2025년 3월 2일` in another year. */
export const dateText = (p: ClockParts, currentYear: number) =>
  p.year === currentYear ? `${p.month}월 ${p.day}일 (${p.weekday})` : `${p.year}년 ${p.month}월 ${p.day}일`;
export const meridiem = (p: Pick<ClockParts, "hour">) => (p.hour < 12 ? "오전" : "오후");
/** `2:05`; noon and midnight are 12. */
export const clockText = (p: Pick<ClockParts, "hour" | "minute">) => `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${String(p.minute).padStart(2, "0")}`;
export const timeText = (p: Pick<ClockParts, "hour" | "minute">) => `${meridiem(p)} ${clockText(p)}`;

/**
 * `10월 12일 (월) 오후 2:00`. A past instant within the last hour reads `방금` or `10분 전` unless `relative` is false;
 * future instants such as due dates always get the date and time.
 */
export function formatDateTime(at: string, options: { now?: Date; timeZone?: string; relative?: boolean } = {}): string {
  const now = options.now ?? new Date();
  const ago = now.getTime() - Date.parse(at);
  if (options.relative !== false && ago >= 0 && ago < HOUR_MS) return ago < MINUTE_MS ? "방금" : `${Math.floor(ago / MINUTE_MS)}분 전`;
  const parts = clockParts(at, options.timeZone);
  return `${dateText(parts, clockParts(now, options.timeZone).year)} ${timeText(parts)}`;
}

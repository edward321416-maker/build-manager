/**
 * Korean date and time text in the design rules section 14 format, one place for every web screen.
 * Without a `timeZone` the browser's zone applies, as on /core so far; Vendor surfaces keep their fixed Seoul time
 * in vendor-time.ts and only borrow the text shapes from here.
 */
export type ClockParts = { year: number; month: number; day: number; weekday: string; hour: number; minute: number };

export const WEEKDAYS = "일월화수목금토";
const HOUR_MS = 3_600_000, MINUTE_MS = 60_000;

// One formatter per time zone: building Intl.DateTimeFormat is the expensive part, and messages re-render on every key press.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone?: string): Intl.DateTimeFormat {
  const key = timeZone ?? "";
  let found = formatters.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
    formatters.set(key, found);
  }
  return found;
}

export function clockParts(at: string | Date, timeZone?: string): ClockParts {
  const date = typeof at === "string" ? new Date(at) : at;
  if (!Number.isFinite(date.getTime())) throw new RangeError("INVALID_INSTANT");
  const parts = formatter(timeZone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
  const year = part("year"), month = part("month"), day = part("day");
  // The weekday follows from the calendar date itself, so no engine's weekday spelling matters.
  return { year, month, day, weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()], hour: part("hour") % 24, minute: part("minute") };
}

/** `10월 12일 (월)` this year, `2025년 3월 2일` in another year. */
export const dateText = (p: ClockParts, currentYear: number) =>
  p.year === currentYear ? `${p.month}월 ${p.day}일 (${p.weekday})` : `${p.year}년 ${p.month}월 ${p.day}일`;
export const meridiem = (p: Pick<ClockParts, "hour">) => (p.hour < 12 ? "오전" : "오후");
/** `2:05`; noon and midnight are 12. */
export const clockText = (p: Pick<ClockParts, "hour" | "minute">) => `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${String(p.minute).padStart(2, "0")}`;
export const timeText = (p: Pick<ClockParts, "hour" | "minute">) => `${meridiem(p)} ${clockText(p)}`;

/**
 * `방금` or `10분 전` for the last hour, else null. A server time up to a minute ahead of this clock is ordinary clock
 * skew and also reads `방금`; anything later is a future time and gets the date.
 */
export function relativeText(at: string, now: Date): string | null {
  const ago = now.getTime() - Date.parse(at);
  if (!Number.isFinite(ago) || ago <= -MINUTE_MS || ago >= HOUR_MS) return null;
  return ago < MINUTE_MS ? "방금" : `${Math.floor(ago / MINUTE_MS)}분 전`;
}

/** `10월 12일 (월) 오후 2:00`; an instant this clock cannot read is shown as written rather than breaking the screen. */
export function absoluteDateTime(at: string, options: { now?: Date; timeZone?: string } = {}): string {
  if (!Number.isFinite(Date.parse(at))) return at;
  const parts = clockParts(at, options.timeZone);
  return `${dateText(parts, clockParts(options.now ?? new Date(), options.timeZone).year)} ${timeText(parts)}`;
}

/** Relative text for the last hour unless `relative` is false; otherwise the date and time. */
export function formatDateTime(at: string, options: { now?: Date; timeZone?: string; relative?: boolean } = {}): string {
  const now = options.now ?? new Date();
  return (options.relative !== false ? relativeText(at, now) : null) ?? absoluteDateTime(at, { now, timeZone: options.timeZone });
}

/**
 * Korean date and time text in the design rules section 14 format, one place for every web screen, and the one Seoul
 * clock: every time is shown and entered in Seoul time, whatever zone the browser is in (operator decision 2026-10-12).
 * Korea observes no daylight saving time, so a fixed +09:00 offset is exact and needs no time zone database.
 * Vendor time ranges go through vendor-time.ts, which builds on this file.
 */
export type ClockParts = { year: number; month: number; day: number; weekday: string; hour: number; minute: number };

const WEEKDAYS = "일월화수목금토";
const MINUTE_MS = 60_000, HOUR_MS = 3_600_000, SEOUL_OFFSET_MS = 9 * HOUR_MS;

function instant(at: string | Date | number): number {
  const time = typeof at === "number" ? at : typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(time)) throw new RangeError("INVALID_INSTANT");
  return time;
}

/** The Seoul calendar date and wall time of an instant. */
export function clockParts(at: string | Date | number): ClockParts {
  const shifted = new Date(instant(at) + SEOUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    weekday: WEEKDAYS[shifted.getUTCDay()], hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
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
 * `방금` under a minute ago, then `10분 전` for the rest of the last hour, else null. Past the first minute, minutes are
 * counted on the clock (2:00 minus 1:49 is 11), so they agree with the time shown beside them. A server time up to a
 * minute ahead of this clock is ordinary skew and reads `방금`; anything later is a future time and gets the date.
 */
export function relativeText(at: string, now: Date): string | null {
  const then = Date.parse(at), current = now.getTime();
  if (!Number.isFinite(then) || current - then <= -MINUTE_MS) return null;
  if (current - then < MINUTE_MS) return "방금";
  const minutes = Math.floor(current / MINUTE_MS) - Math.floor(then / MINUTE_MS);
  return minutes < 60 ? `${minutes}분 전` : null;
}

/** `10월 12일 (월) 오후 2:00`; an instant this clock cannot read is shown as written rather than breaking the screen. */
export function absoluteDateTime(at: string, options: { now?: Date } = {}): string {
  if (!Number.isFinite(Date.parse(at))) return at;
  const parts = clockParts(at);
  return `${dateText(parts, clockParts(options.now ?? new Date()).year)} ${timeText(parts)}`;
}

/**
 * For the last hour, `10분 전 (오후 1:50)`: relative time with the exact time beside it, so the exact time is visible
 * on touch screens too (operator decision 2026-10-12). A skewed server time never shows a minute this clock has not
 * reached. Otherwise, or when `relative` is false, the date and time.
 */
export function formatDateTime(at: string, options: { now?: Date; relative?: boolean } = {}): string {
  const now = options.now ?? new Date();
  const relative = options.relative !== false ? relativeText(at, now) : null;
  return relative ? `${relative} (${timeText(clockParts(Math.min(Date.parse(at), now.getTime())))})` : absoluteDateTime(at, { now });
}

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO instant → Seoul calendar date `YYYY-MM-DD` and wall time `HH:MM` (seconds dropped); the inverse of seoulLocalToInstant. */
export function instantToSeoulLocal(at: string): { date: string; time: string } {
  const p = clockParts(at);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** Seoul calendar date `YYYY-MM-DD` + wall time `HH:MM` → ISO instant; null for impossible or malformed entries. */
export function seoulLocalToInstant(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [year, month, day, hour, minute] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
  if (hour > 23 || minute > 59 || month < 1 || month > 12) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(wall - SEOUL_OFFSET_MS).toISOString();
}

/** ISO instant → a `datetime-local` value `YYYY-MM-DDTHH:MM` in Seoul time; empty for an instant it cannot read. */
export function instantToSeoulInput(at: string): string {
  if (!Number.isFinite(Date.parse(at))) return "";
  const { date, time } = instantToSeoulLocal(at);
  return `${date}T${time}`;
}

/** A whole `datetime-local` value read as Seoul time → ISO instant, seconds dropped; null for anything malformed. */
export function seoulInputToInstant(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  return match ? seoulLocalToInstant(match[1], match[2]) : null;
}

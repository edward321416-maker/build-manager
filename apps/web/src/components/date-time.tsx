import { formatDateTime } from "../lib/date-text";

/**
 * One `<time>` for every screen in the design rules section 14 format. When it shows relative time, the title keeps
 * the date and time so the exact moment stays one hover away.
 */
export function DateTime({ at, now, timeZone, relative = true }: { at: string; now?: Date; timeZone?: string; relative?: boolean }) {
  const shown = formatDateTime(at, { now, timeZone, relative });
  const full = formatDateTime(at, { now, timeZone, relative: false });
  return <time dateTime={at} title={shown === full ? undefined : full}>{shown}</time>;
}

/**
 * Dates and times in the operator's zone, rendered identically on the server
 * and in the browser.
 *
 * Every function takes `now` explicitly and none of them uses Intl for
 * dates. The server renders the first paint and the browser hydrates it, so
 * the two must produce the same strings:
 *
 *   - Reading the clock separately on each side drifts "Just now" into "1m".
 *   - Formatting in each side's own zone turns 10:32 am into 4:02 pm.
 *   - Intl itself differs between runtimes: Node and Chromium ship different
 *     ICU data, so the same call renders "Monday, 21 Sept" on one and
 *     "Monday 21 Sept" on the other, and React discards the markup.
 *
 * The zone is the operator's — GoDND trades in India, so IST — until
 * agencies carry a zone of their own. IST has no daylight saving, so a fixed
 * +05:30 offset is exact.
 */

export const OPERATOR_TIME_ZONE = "Asia/Kolkata";
const OFFSET_MINUTES = 330;

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);

export type Parts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

/** Wall-clock parts in the operator's zone. */
export function parts(value: string | Date): Parts {
  const shifted = new Date(toDate(value).getTime() + OFFSET_MINUTES * MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * "2026-09-25" in the operator's zone — the key two timestamps share a day
 * by. A bare date ("2026-10-18", a travel date) is already a day key and
 * passes through unchanged.
 */
export function dayKey(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const { year, month, day } = parts(value);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Whole days from `from` to `to` (both day keys or timestamps); negative if `to` is earlier. */
export function daysFrom(from: string | Date, to: string | Date): number {
  const a = Date.parse(`${dayKey(from)}T00:00:00Z`);
  const b = Date.parse(`${dayKey(to)}T00:00:00Z`);
  return Math.round((b - a) / DAY);
}

/** Days elapsed from `value` to `now`, in calendar days in the operator's zone. */
export function daysBetween(value: string | Date, now: Date): number {
  return daysFrom(value, now);
}

/** The day key `days` after `key`. */
export function addDays(key: string, days: number): string {
  const date = new Date(Date.parse(`${dayKey(key)}T00:00:00Z`) + days * DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export const shortDate = (p: Parts) => `${p.day} ${MONTHS[p.month]}`;
export const fullDate = (p: Parts) => `${p.day} ${MONTHS[p.month]} ${p.year}`;

/** A day key's parts without any zone shift — it is already a calendar day. */
function dayParts(value: string | Date): Parts {
  const key = dayKey(value);
  return parts(`${key}T00:00:00+05:30`);
}

/** "10:32 am" */
export function formatClock(value: string | Date): string {
  const { hour, minute } = parts(value);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${pad(minute)} ${hour < 12 ? "am" : "pm"}`;
}

/** "25 Sep 2026, 10:32 am" — for titles and screen readers. */
export function formatFullDateTime(value: string | Date): string {
  return `${fullDate(parts(value))}, ${formatClock(value)}`;
}

/** "12 Oct" this year, "12 Oct 2027" otherwise. */
export function formatDay(value: string | Date, now: Date): string {
  const p = dayParts(value);
  return p.year === parts(now).year ? shortDate(p) : fullDate(p);
}

/** "12 Oct 2026" — always with the year, for records. */
export function formatDayFull(value: string | Date): string {
  return fullDate(dayParts(value));
}

/** "12 – 15 Oct", "30 Sep – 2 Oct", with years only when they differ from now. */
export function formatDayRange(start: string, end: string | null, now: Date): string {
  if (!end || dayKey(end) === dayKey(start)) return formatDay(start, now);
  const a = dayParts(start);
  const b = dayParts(end);
  const thisYear = parts(now).year;
  if (a.year === b.year && a.month === b.month) {
    return `${a.day} – ${b.day} ${MONTHS[b.month]}${b.year === thisYear ? "" : ` ${b.year}`}`;
  }
  if (a.year === b.year) {
    return `${shortDate(a)} – ${shortDate(b)}${b.year === thisYear ? "" : ` ${b.year}`}`;
  }
  return `${fullDate(a)} – ${fullDate(b)}`;
}

/** "today", "tomorrow", "in 6 days", "yesterday", "3 days ago". */
export function formatRelativeDay(value: string | Date, now: Date): string {
  const days = daysFrom(now, value);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Minutes elapsed, never negative (clock skew between server and browser). */
export function minutesSince(value: string | Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - toDate(value).getTime()) / MINUTE));
}

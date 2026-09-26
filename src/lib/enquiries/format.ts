/**
 * Time and group formatting for the enquiry inbox and thread.
 *
 * Every function takes `now` explicitly and formats in one fixed time zone,
 * and none of them uses Intl for dates. All three choices serve the same
 * end: the server renders the first paint and the browser hydrates it, so
 * the two must produce identical strings.
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

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);

type Parts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

/** Wall-clock parts in the operator's zone. */
function parts(value: string | Date): Parts {
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

/** "2026-09-25" in the operator's zone — the key two timestamps share a day by. */
export function dayKey(value: string | Date): string {
  const { year, month, day } = parts(value);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysBetween(value: string | Date, now: Date): number {
  const a = Date.parse(`${dayKey(value)}T00:00:00Z`);
  const b = Date.parse(`${dayKey(now)}T00:00:00Z`);
  return Math.round((b - a) / DAY);
}

const shortDate = (p: Parts) => `${p.day} ${MONTHS[p.month]}`;
const fullDate = (p: Parts) => `${p.day} ${MONTHS[p.month]} ${p.year}`;

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

/**
 * The inbox's right-hand timestamp: the time today, "Yesterday", a weekday
 * inside a week, then a date. Chat apps settled this ladder long ago; an
 * operator reads it without thinking.
 */
export function formatListTime(value: string | Date, now: Date): string {
  const days = daysBetween(value, now);
  if (days <= 0) return formatClock(value);
  if (days === 1) return "Yesterday";
  const p = parts(value);
  if (days < 7) return WEEKDAYS[p.weekday].slice(0, 3);
  return p.year === parts(now).year ? shortDate(p) : fullDate(p);
}

/** The divider between days in a thread: "Today", "Yesterday", "Monday, 21 Sep". */
export function formatDayDivider(value: string | Date, now: Date): string {
  const days = daysBetween(value, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  const p = parts(value);
  return p.year === parts(now).year ? `${WEEKDAYS[p.weekday]}, ${shortDate(p)}` : fullDate(p);
}

/** Minutes elapsed, never negative (clock skew between server and browser). */
export function minutesSince(value: string | Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - toDate(value).getTime()) / MINUTE));
}

/**
 * How long someone has waited, at the coarsest unit that still means
 * something: "Just now", "12m", "5h", "3d". Hours run to 48 before they turn
 * into days, because "26h" reads as more urgent than "1d" — and it is.
 */
export function formatWaiting(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Long form for assistive tech and titles: "26 hours". */
export function formatWaitingLong(minutes: number): string {
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "2 adults · 1 child" */
export function formatGroup(adults: number, children: number, infants: number): string {
  const parts = [`${adults} adult${adults === 1 ? "" : "s"}`];
  if (children) parts.push(`${children} child${children === 1 ? "" : "ren"}`);
  if (infants) parts.push(`${infants} infant${infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** "4 guests" — the compact count the list row has room for. */
export function formatGuestCount(adults: number, children: number, infants: number): string {
  const total = adults + children + infants;
  return `${total} guest${total === 1 ? "" : "s"}`;
}

/** "12 Oct" this year, "12 Oct 2027" otherwise — for travel dates. */
export function formatTravelDate(value: string, now: Date): string {
  const p = parts(value);
  return p.year === parts(now).year ? shortDate(p) : fullDate(p);
}

/** "AK" from "Ananya Kapoor"; one letter for a single name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/** "file.pdf · 240 KB" */
export function formatFileSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

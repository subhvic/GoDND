/**
 * Time and group formatting for the enquiry inbox and thread. The zone and
 * hydration rules live in lib/time.ts, shared with Bookings.
 */

import { WEEKDAYS, daysBetween, formatClock, formatDay, fullDate, parts, shortDate } from "@/lib/time";

export {
  OPERATOR_TIME_ZONE,
  dayKey,
  formatClock,
  formatFullDateTime,
  minutesSince,
} from "@/lib/time";

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
  return formatDay(value, now);
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

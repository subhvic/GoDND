import type { BookingStatus, EnquirySource, EnquiryStatus } from "@/lib/types";

/**
 * Insights — how the business is doing over a period, and what to act on.
 *
 * One pure function turns raw facts (bookings, reviews, enquiries,
 * experiences) into a report, so the live path and the sample workspace
 * share every definition. The page computes all periods on the server and
 * the browser switches between them instantly, as Home's funnel does.
 *
 * Periods are whole India days (and whole months for the year view), so a
 * bar labelled "14 Sep" holds exactly the bookings made on 14 September and
 * the bars add up to the headline figure above them.
 */

export type BookingFact = {
  experienceId: string | null;
  status: BookingStatus;
  isMarketplace: boolean;
  guests: number;
  totalMinor: number;
  createdAt: string;
};

export type ReviewFact = {
  experienceId: string | null;
  rating: number;
  createdAt: string;
  replied: boolean;
};

export type EnquiryFact = {
  createdAt: string;
  status: EnquiryStatus;
  source: EnquirySource;
};

export type ExperienceFact = {
  id: string;
  title: string;
  status: string;
  /** When it went live — approved_at, else created_at. */
  liveSince: string;
};

export type InsightFacts = {
  bookings: BookingFact[];
  reviews: ReviewFact[];
  enquiries: EnquiryFact[];
  experiences: ExperienceFact[];
};

export const INSIGHT_PERIODS = [
  { key: "7d", label: "Last 7 days", unit: "day", count: 7 },
  { key: "30d", label: "Last 30 days", unit: "day", count: 30 },
  { key: "90d", label: "Last 90 days", unit: "week", count: 90 },
  { key: "12m", label: "Last 12 months", unit: "month", count: 12 },
] as const;

export type InsightPeriod = (typeof INSIGHT_PERIODS)[number]["key"];

export const isInsightPeriod = (value: unknown): value is InsightPeriod =>
  INSIGHT_PERIODS.some((period) => period.key === value);

/* --------------------------------------------------------------------------
 * India calendar
 * ----------------------------------------------------------------------- */

const DAY = 86_400_000;
const IST = 330 * 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function istParts(ms: number) {
  const date = new Date(ms + IST);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** The instant an India calendar day begins; day/month overflow is fine. */
const istMidnight = (year: number, month: number, day: number) => Date.UTC(year, month, day) - IST;

const dayLabel = (ms: number) => {
  const { day, month } = istParts(ms);
  return `${day} ${MONTHS[month]}`;
};

const fullDay = (ms: number) => {
  const { day, month, year } = istParts(ms);
  return `${day} ${MONTHS[month]} ${year}`;
};

export type Bucket = {
  key: string;
  start: number;
  end: number;
  /** Axis label: "14 Sep", "8 Sep" (a week's first day) or "Sep ’26". */
  label: string;
  /** Tooltip and table: "14 Sep 2026", "8 – 14 Sep 2026", "September 2026". */
  range: string;
};

export type Window = { start: number; end: number; buckets: Bucket[]; previousStart: number };

/**
 * The period's window and its buckets. Day and week periods count back
 * whole days from today; the oldest week absorbs any remainder, so 90 days
 * is twelve weeks and a six-day week rather than a 91-day window. The year
 * view is the current month and the eleven before it.
 */
export function periodWindow(period: InsightPeriod, now: number): Window {
  const config = INSIGHT_PERIODS.find((entry) => entry.key === period)!;
  const today = istParts(now);
  const tomorrow = istMidnight(today.year, today.month, today.day + 1);

  if (config.unit === "month") {
    const buckets: Bucket[] = Array.from({ length: config.count }, (_, index) => {
      const offset = config.count - 1 - index;
      const start = istMidnight(today.year, today.month - offset, 1);
      const end = Math.min(istMidnight(today.year, today.month - offset + 1, 1), tomorrow);
      const { year, month } = istParts(start);
      return {
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        start,
        end,
        label: `${MONTHS[month]} ’${String(year).slice(2)}`,
        range: `${MONTHS_LONG[month]} ${year}${offset === 0 ? " (so far)" : ""}`,
      };
    });
    const start = buckets[0].start;
    const { year, month } = istParts(start);
    return { start, end: tomorrow, buckets, previousStart: istMidnight(year, month - config.count, 1) };
  }

  const start = tomorrow - config.count * DAY;
  const size = config.unit === "week" ? 7 : 1;
  const buckets: Bucket[] = [];
  for (let end = tomorrow; end > start; end -= size * DAY) {
    const bucketStart = Math.max(start, end - size * DAY);
    const last = end - DAY;
    const single = bucketStart === last;
    const first = istParts(bucketStart);
    const lastParts = istParts(last);
    buckets.unshift({
      key: new Date(bucketStart + IST).toISOString().slice(0, 10),
      start: bucketStart,
      end,
      label: dayLabel(bucketStart),
      range: single
        ? fullDay(bucketStart)
        : `${first.day}${first.month === lastParts.month ? "" : ` ${MONTHS[first.month]}`} – ${fullDay(last)}`,
    });
  }
  return { start, end: tomorrow, buckets, previousStart: start - config.count * DAY };
}

/* --------------------------------------------------------------------------
 * Report
 * ----------------------------------------------------------------------- */

export type Comparable = { value: number; previous: number };

export type SeriesPoint = {
  key: string;
  label: string;
  range: string;
  bookings: number;
  valueMinor: number;
  guests: number;
};

export type ExperienceLine = {
  id: string;
  title: string;
  status: string;
  bookings: number;
  guests: number;
  valueMinor: number;
  /** Of the period's booking value, 0–1. */
  share: number;
  cancelled: number;
  made: number;
  rating: number | null;
  reviews: number;
};

export type InsightAction = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  evidence: string;
  action?: { label: string; href: string };
};

export type PeriodReport = {
  key: InsightPeriod;
  label: string;
  /** "28 Aug – 26 Sep 2026". */
  rangeLabel: string;
  /** "previous 30 days", "previous 12 months" — the comparison's name. */
  previousLabel: string;
  bookings: Comparable;
  valueMinor: Comparable;
  guests: Comparable;
  cancellations: { cancelled: number; made: number; rate: number; previousRate: number };
  series: SeriesPoint[];
  experiences: ExperienceLine[];
  sources: {
    marketplace: { bookings: number; valueMinor: number };
    direct: { bookings: number; valueMinor: number };
  };
  enquiries: { total: number; won: number; previousTotal: number };
  reviews: {
    count: number;
    average: number | null;
    previousAverage: number | null;
    /** Index 0 is five stars, 4 is one star. */
    distribution: [number, number, number, number, number];
  };
  actions: InsightAction[];
};

export type InsightsReport = {
  periods: Record<InsightPeriod, PeriodReport>;
  /** Reviews without a reply, whenever they arrived — a reply is always owed. */
  unanswered: { count: number; oldest: string | null };
  isDemoData: boolean;
};

const at = (iso: string) => Date.parse(iso);
const within = (ms: number, start: number, end: number) => ms >= start && ms < end;
const CANCELLED: BookingStatus[] = ["cancelled", "refunded"];
const kept = (booking: BookingFact) => !CANCELLED.includes(booking.status) && booking.status !== "draft";

function rangeLabel(window: Window) {
  const first = istParts(window.start);
  const last = istParts(window.end - DAY);
  return `${first.day} ${MONTHS[first.month]}${first.year === last.year ? "" : ` ${first.year}`} – ${fullDay(window.end - DAY)}`;
}

export function buildReport(facts: InsightFacts, now: number, isDemoData: boolean): InsightsReport {
  const unansweredReviews = facts.reviews.filter((review) => !review.replied);
  const oldest = unansweredReviews.reduce<string | null>(
    (min, review) => (min === null || review.createdAt < min ? review.createdAt : min),
    null,
  );
  const unanswered = { count: unansweredReviews.length, oldest };

  const periods = Object.fromEntries(
    INSIGHT_PERIODS.map((period) => [period.key, periodReport(facts, period.key, now, unanswered)]),
  ) as Record<InsightPeriod, PeriodReport>;

  return { periods, unanswered, isDemoData };
}

function periodReport(
  facts: InsightFacts,
  key: InsightPeriod,
  now: number,
  unanswered: InsightsReport["unanswered"],
): PeriodReport {
  const config = INSIGHT_PERIODS.find((entry) => entry.key === key)!;
  const window = periodWindow(key, now);
  const inWindow = <T extends { createdAt: string }>(rows: T[], start: number, end: number) =>
    rows.filter((row) => within(at(row.createdAt), start, end));

  const made = inWindow(facts.bookings, window.start, window.end).filter((row) => row.status !== "draft");
  const madeBefore = inWindow(facts.bookings, window.previousStart, window.start).filter((row) => row.status !== "draft");
  const stuck = made.filter(kept);
  const stuckBefore = madeBefore.filter(kept);
  const sum = (rows: BookingFact[], pick: (row: BookingFact) => number) => rows.reduce((total, row) => total + pick(row), 0);

  const valueMinor = sum(stuck, (row) => row.totalMinor);
  const cancelled = made.length - stuck.length;
  const cancelledBefore = madeBefore.length - stuckBefore.length;

  const series: SeriesPoint[] = window.buckets.map((bucket) => {
    const rows = inWindow(facts.bookings, bucket.start, bucket.end).filter((row) => row.status !== "draft");
    const bucketKept = rows.filter(kept);
    return {
      key: bucket.key,
      label: bucket.label,
      range: bucket.range,
      bookings: rows.length,
      valueMinor: sum(bucketKept, (row) => row.totalMinor),
      guests: sum(bucketKept, (row) => row.guests),
    };
  });

  const reviews = inWindow(facts.reviews, window.start, window.end);
  const reviewsBefore = inWindow(facts.reviews, window.previousStart, window.start);
  const average = (rows: ReviewFact[]) =>
    rows.length ? Math.round((rows.reduce((total, row) => total + row.rating, 0) / rows.length) * 10) / 10 : null;
  const distribution = [5, 4, 3, 2, 1].map((stars) => reviews.filter((row) => row.rating === stars).length) as PeriodReport["reviews"]["distribution"];

  // Every experience that could have sold in the window: live now, or one
  // that took a booking in it before being switched off.
  const soldIds = new Set(made.map((row) => row.experienceId).filter(Boolean));
  const experiences: ExperienceLine[] = facts.experiences
    .filter((experience) => experience.status === "active" || soldIds.has(experience.id))
    .map((experience) => {
      const rows = made.filter((row) => row.experienceId === experience.id);
      const rowsKept = rows.filter(kept);
      const experienceReviews = reviews.filter((row) => row.experienceId === experience.id);
      const value = sum(rowsKept, (row) => row.totalMinor);
      return {
        id: experience.id,
        title: experience.title,
        status: experience.status,
        bookings: rowsKept.length,
        guests: sum(rowsKept, (row) => row.guests),
        valueMinor: value,
        share: valueMinor > 0 ? value / valueMinor : 0,
        cancelled: rows.length - rowsKept.length,
        made: rows.length,
        rating: average(experienceReviews),
        reviews: experienceReviews.length,
      };
    })
    .sort((a, b) => b.valueMinor - a.valueMinor || b.bookings - a.bookings || a.title.localeCompare(b.title));

  const enquiries = inWindow(facts.enquiries, window.start, window.end);
  const marketplace = stuck.filter((row) => row.isMarketplace);
  const direct = stuck.filter((row) => !row.isMarketplace);

  const report: PeriodReport = {
    key,
    label: config.label,
    rangeLabel: rangeLabel(window),
    previousLabel: `previous ${config.unit === "month" ? `${config.count} months` : `${config.count} days`}`,
    bookings: { value: made.length, previous: madeBefore.length },
    valueMinor: { value: valueMinor, previous: sum(stuckBefore, (row) => row.totalMinor) },
    guests: { value: sum(stuck, (row) => row.guests), previous: sum(stuckBefore, (row) => row.guests) },
    cancellations: {
      cancelled,
      made: made.length,
      rate: made.length ? cancelled / made.length : 0,
      previousRate: madeBefore.length ? cancelledBefore / madeBefore.length : 0,
    },
    series,
    experiences,
    sources: {
      marketplace: { bookings: marketplace.length, valueMinor: sum(marketplace, (row) => row.totalMinor) },
      direct: { bookings: direct.length, valueMinor: sum(direct, (row) => row.totalMinor) },
    },
    enquiries: {
      total: enquiries.length,
      won: enquiries.filter((row) => row.status === "won").length,
      previousTotal: inWindow(facts.enquiries, window.previousStart, window.start).length,
    },
    reviews: {
      count: reviews.length,
      average: average(reviews),
      previousAverage: average(reviewsBefore),
      distribution,
    },
    actions: [],
  };
  report.actions = deriveActions(report, facts, unanswered, config.unit === "day" && config.count < 30);
  return report;
}

/**
 * What to act on, worst first. Each finding names the numbers it came from
 * — the rule the Performance page set — and points at where to fix it.
 */
function deriveActions(
  report: PeriodReport,
  facts: InsightFacts,
  unanswered: InsightsReport["unanswered"],
  short: boolean,
): InsightAction[] {
  const actions: InsightAction[] = [];
  const periodName = report.label.toLowerCase();
  const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

  // Eight bookings before a rate means anything; 15% and double the rest of
  // the business before it's more than weather.
  for (const line of report.experiences) {
    if (line.made < 8) continue;
    const rate = line.cancelled / line.made;
    const others = report.experiences.filter((entry) => entry.id !== line.id);
    const otherMade = others.reduce((total, entry) => total + entry.made, 0);
    const otherRate = otherMade ? others.reduce((total, entry) => total + entry.cancelled, 0) / otherMade : 0;
    if (rate >= 0.15 && rate >= otherRate * 2) {
      actions.push({
        id: `cancel-${line.id}`,
        severity: "critical",
        title: `${line.cancelled} of ${line.made} bookings for “${line.title}” were cancelled`,
        evidence: `That’s ${pct(rate)}, against ${pct(otherRate)} across your other experiences in the ${periodName}. Each booking records why it was cancelled.`,
        action: { label: "See cancellations", href: "/dashboard/bookings?tab=cancelled" },
      });
    }
  }

  // A week is too short to call an experience idle.
  if (!short) {
    const live = report.experiences.filter((line) => line.status === "active");
    const selling = live.filter((line) => line.bookings > 0);
    for (const line of live) {
      if (line.bookings > 0 || selling.length === 0) continue;
      const fact = facts.experiences.find((experience) => experience.id === line.id);
      const average = Math.round(selling.reduce((total, entry) => total + entry.bookings, 0) / selling.length);
      actions.push({
        id: `idle-${line.id}`,
        severity: "warning",
        title: `“${line.title}” took no bookings in the ${periodName}`,
        evidence: `It’s been live since ${fact ? fullDay(at(fact.liveSince)) : "earlier"}; your other live experiences averaged ${average} booking${average === 1 ? "" : "s"} each.`,
        action: { label: "Promote it", href: "/dashboard/social/studio" },
      });
    }
  }

  if (unanswered.count > 0) {
    actions.push({
      id: "unanswered",
      severity: "warning",
      title: `${unanswered.count} review${unanswered.count === 1 ? " is" : "s are"} waiting for a reply`,
      evidence: `The oldest arrived on ${unanswered.oldest ? fullDay(at(unanswered.oldest)) : "—"}. Replies show on your listing, and travellers read them before they book.`,
      action: { label: "Reply to them", href: "/dashboard/insights/reviews" },
    });
  }

  for (const line of report.experiences) {
    if (line.reviews >= 5 && line.rating !== null && line.rating < 4) {
      actions.push({
        id: `rating-${line.id}`,
        severity: "warning",
        title: `“${line.title}” is rated ${line.rating.toFixed(1)}`,
        evidence: `Across ${line.reviews} reviews in the ${periodName}, against ${report.reviews.average?.toFixed(1) ?? "—"} for the business as a whole.`,
        action: { label: "Read them", href: `/dashboard/insights/reviews?view=all&experience=${line.id}` },
      });
    }
  }

  const { value, previous } = report.valueMinor;
  if (previous > 0 && value < previous * 0.8) {
    actions.push({
      id: "value-down",
      severity: "info",
      title: `Booking value is down ${pct(1 - value / previous)} on the ${report.previousLabel}`,
      evidence: `Travel in the North East is seasonal, so compare with the same months last year before reading much into it.`,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return actions.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 5);
}

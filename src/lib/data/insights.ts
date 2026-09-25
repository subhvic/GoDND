import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  FUNNEL_PERIODS,
  type ConversionGranularity,
  type ConversionPoint,
  type FunnelFigures,
  type FunnelPeriod,
  type HomeInsights,
} from "@/lib/types";

/**
 * The numbers behind Home: the funnel strip and the conversion graph.
 *
 * Every window and every bucket is computed here, on the server, for all
 * three funnel periods and both graph intervals at once. The payload is a
 * few dozen integers, and it means switching "Last 30 days" to "Last 7 days"
 * or Monthly to Weekly is instant — no round trip, no loading state.
 *
 * Live, it is three queries run in parallel and reduced in memory, the same
 * trade the Experiences tab counts make: one grouped read beats eight
 * separate `count` requests on the page an operator opens first.
 */

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export async function getHomeInsights(): Promise<HomeInsights> {
  const now = Date.now();
  return isSupabaseConfigured() ? liveInsights(now) : demoInsights(now);
}

/* ---------------------------------------------------------------------------
 * Time — India time, because a "month" is the operator's month. The portal
 * runs on UTC servers; IST has no daylight saving, so a fixed offset is
 * exact.
 * ------------------------------------------------------------------------ */

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A calendar date in IST, as UTC-field accessors on a shifted Date. */
function ist(ms: number) {
  const date = new Date(ms + IST_OFFSET);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

/** The instant an IST calendar day begins. Month/day overflow is fine. */
function istMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day) - IST_OFFSET;
}

function isoDay(ms: number): string {
  const { year, month, day } = ist(ms);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Bucket = Omit<ConversionPoint, "activeExperiences" | "bookedExperiences"> & {
  start: number;
  end: number;
};

const BUCKETS = 7;

/** The current month and the six before it, oldest first. */
function monthBuckets(now: number): Bucket[] {
  const today = ist(now);
  return Array.from({ length: BUCKETS }, (_, index) => {
    const offset = BUCKETS - 1 - index;
    const start = istMidnight(today.year, today.month - offset, 1);
    const end = istMidnight(today.year, today.month - offset + 1, 1);
    const { year, month } = ist(start);
    return {
      key: isoDay(start),
      start,
      end,
      label: `${MONTHS[month]} ’${String(year).slice(2)}`,
      range: `${MONTHS_LONG[month]} ${year}${offset === 0 ? " (so far)" : ""}`,
    };
  });
}

/** The current Monday-to-Sunday week and the six before it, oldest first. */
function weekBuckets(now: number): Bucket[] {
  const today = ist(now);
  const thisMonday = istMidnight(today.year, today.month, today.day) - ((today.weekday + 6) % 7) * DAY;
  return Array.from({ length: BUCKETS }, (_, index) => {
    const offset = BUCKETS - 1 - index;
    const start = thisMonday - offset * 7 * DAY;
    const end = start + 7 * DAY;
    const first = ist(start);
    const last = ist(end - DAY);
    const sameMonth = first.month === last.month;
    return {
      key: isoDay(start),
      start,
      end,
      label: `${first.day} ${MONTHS[first.month]}`,
      sublabel: `– ${last.day} ${MONTHS[last.month]}`,
      range: `${first.day}${sameMonth ? "" : ` ${MONTHS[first.month]}`} – ${last.day} ${MONTHS[last.month]} ${last.year}${offset === 0 ? " (so far)" : ""}`,
    };
  });
}

/* ---------------------------------------------------------------------------
 * Live
 * ------------------------------------------------------------------------ */

type ExperienceFact = { id: string; status: string; approved_at: string | null; created_at: string };
type BookingFact = {
  status: string;
  experience_id: string | null;
  created_at: string;
  cancelled_at: string | null;
  travel_end: string | null;
};
type ReviewFact = { rating: number; created_at: string };

async function liveInsights(now: number): Promise<HomeInsights> {
  const supabase = await createServerSupabase();
  const months = monthBuckets(now);
  const weeks = weekBuckets(now);

  // Far enough back for the longest funnel window and its predecessor, and
  // for the first bucket of either graph interval.
  const longest = Math.max(...FUNNEL_PERIODS.map((period) => period.days));
  const since = Math.min(months[0].start, weeks[0].start, now - 2 * longest * DAY);
  const sinceIso = new Date(since).toISOString();

  const [experiences, bookings, reviews] = await Promise.all([
    supabase.from("experiences").select("id, status, approved_at, created_at"),
    supabase
      .from("bookings")
      .select("status, experience_id, created_at, cancelled_at, travel_end")
      .neq("status", "draft")
      .or(
        `created_at.gte."${sinceIso}",cancelled_at.gte."${sinceIso}",travel_end.gte.${isoDay(since)}`,
      ),
    supabase.from("reviews").select("rating, created_at").gte("created_at", sinceIso),
  ]);

  // An error surfaces as an error: a funnel of silent zeros would look like
  // a business that stopped trading.
  for (const result of [experiences, bookings, reviews]) {
    if (result.error) throw new Error(`Failed to load Home insights: ${result.error.message}`);
  }

  const facts = {
    experiences: (experiences.data ?? []) as ExperienceFact[],
    bookings: (bookings.data ?? []) as BookingFact[],
    reviews: (reviews.data ?? []) as ReviewFact[],
  };

  const funnel = Object.fromEntries(
    FUNNEL_PERIODS.map((period) => [period.key, funnelFor(period.days, now, facts)]),
  ) as Record<FunnelPeriod, FunnelFigures>;

  return {
    funnel,
    conversion: {
      monthly: months.map((bucket) => pointFor(bucket, facts)),
      weekly: weeks.map((bucket) => pointFor(bucket, facts)),
    },
    isDemoData: false,
  };
}

const at = (value: string | null | undefined) => (value ? new Date(value).getTime() : NaN);
/** A `date` column (travel_end) as the instant that IST day begins. */
const dayAt = (value: string | null) => {
  if (!value) return NaN;
  const [year, month, day] = value.split("-").map(Number);
  return istMidnight(year, month - 1, day);
};
const within = (ms: number, start: number, end: number) => ms >= start && ms < end;

function funnelFor(
  days: number,
  now: number,
  facts: { experiences: ExperienceFact[]; bookings: BookingFact[]; reviews: ReviewFact[] },
): FunnelFigures {
  const start = now - days * DAY;
  const previousStart = start - days * DAY;

  const active = facts.experiences.filter((row) => row.status === "active");
  const made = (a: number, b: number) =>
    facts.bookings.filter((row) => within(at(row.created_at), a, b)).length;
  const completed = (a: number, b: number) =>
    facts.bookings.filter((row) => row.status === "completed" && within(dayAt(row.travel_end), a, b)).length;
  // Cancelled before any money moved ends `cancelled`; a paid booking
  // cancelled afterwards ends `refunded`. That is the line between the
  // funnel's two cancellation tiles.
  const endedAs = (status: string) =>
    facts.bookings.filter(
      (row) => row.status === status && within(at(row.cancelled_at ?? row.created_at), start, now),
    ).length;
  const reviews = facts.reviews.filter((row) => within(at(row.created_at), start, now));

  return {
    activeExperiences: active.length,
    newlyActive: active.filter((row) => within(at(row.approved_at ?? row.created_at), start, now)).length,
    reservationsMade: made(start, now),
    reservationsMadePrevious: made(previousStart, start),
    reservationsCancelled: endedAs("cancelled"),
    bookingsCompleted: completed(start, now),
    bookingsCompletedPrevious: completed(previousStart, start),
    reviewsReceived: reviews.length,
    averageRating: reviews.length
      ? Math.round((reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length) * 10) / 10
      : null,
    bookingsCancelled: endedAs("refunded"),
  };
}

/**
 * Active during a bucket = went live before it ended and is live now.
 * Until status history is recorded, an experience disabled since doesn't
 * count for the months it was trading — the line errs low, never high.
 */
function pointFor(
  bucket: Bucket,
  facts: { experiences: ExperienceFact[]; bookings: BookingFact[] },
): ConversionPoint {
  const activeExperiences = facts.experiences.filter(
    (row) => row.status === "active" && at(row.approved_at ?? row.created_at) < bucket.end,
  ).length;
  const booked = new Set(
    facts.bookings
      .filter((row) => row.experience_id && within(at(row.created_at), bucket.start, bucket.end))
      .map((row) => row.experience_id),
  );
  return toPoint(bucket, activeExperiences, booked.size);
}

function toPoint(bucket: Bucket, activeExperiences: number, bookedExperiences: number): ConversionPoint {
  return {
    key: bucket.key,
    label: bucket.label,
    sublabel: bucket.sublabel,
    range: bucket.range,
    activeExperiences,
    bookedExperiences,
  };
}

/* ---------------------------------------------------------------------------
 * Demo — the handoff file's own numbers for the default window, and graph
 * values laid onto buckets computed from today, so the preview never shows
 * a stale year. Figures, not fixtures: they are not derived from the small
 * booking fixture, which exists to exercise the Bookings table.
 * ------------------------------------------------------------------------ */

const DEMO_FUNNEL: Record<FunnelPeriod, FunnelFigures> = {
  "7d": {
    activeExperiences: 12, newlyActive: 1,
    reservationsMade: 21, reservationsMadePrevious: 18, reservationsCancelled: 1,
    bookingsCompleted: 29, bookingsCompletedPrevious: 34,
    reviewsReceived: 16, averageRating: 4.7, bookingsCancelled: 1,
  },
  "30d": {
    activeExperiences: 12, newlyActive: 2,
    reservationsMade: 87, reservationsMadePrevious: 48, reservationsCancelled: 2,
    bookingsCompleted: 132, bookingsCompletedPrevious: 73,
    reviewsReceived: 69, averageRating: 4.6, bookingsCancelled: 4,
  },
  "90d": {
    activeExperiences: 12, newlyActive: 5,
    reservationsMade: 214, reservationsMadePrevious: 160, reservationsCancelled: 6,
    bookingsCompleted: 341, bookingsCompletedPrevious: 262,
    reviewsReceived: 171, averageRating: 4.5, bookingsCancelled: 9,
  },
};

/** [active, booked] per bucket, oldest first. The last bucket is partial. */
const DEMO_SERIES: Record<ConversionGranularity, [number, number][]> = {
  monthly: [[7, 4], [8, 5], [8, 7], [9, 6], [10, 8], [11, 9], [12, 7]],
  weekly: [[10, 5], [11, 7], [11, 6], [11, 8], [12, 7], [12, 9], [12, 6]],
};

function demoInsights(now: number): HomeInsights {
  const lay = (buckets: Bucket[], values: [number, number][]) =>
    buckets.map((bucket, index) => toPoint(bucket, values[index][0], values[index][1]));

  return {
    funnel: DEMO_FUNNEL,
    conversion: {
      monthly: lay(monthBuckets(now), DEMO_SERIES.monthly),
      weekly: lay(weekBuckets(now), DEMO_SERIES.weekly),
    },
    isDemoData: true,
  };
}

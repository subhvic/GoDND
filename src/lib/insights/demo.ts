import type {
  BookingFact,
  EnquiryFact,
  ExperienceFact,
  InsightFacts,
  ReviewFact,
} from "@/lib/insights/report";
import type { BookingStatus, EnquirySource, EnquiryStatus } from "@/lib/types";

/**
 * Two years of history for the sample workspace, generated rather than
 * listed: Insights needs hundreds of bookings to draw a year, and a listed
 * fixture that size would be unreadable.
 *
 * It is seeded, so every render draws the same business, and it is pinned
 * to Home's own sample figures where the two pages overlap — 87 bookings in
 * the last 30 days against 48 before, 21 against 18 over a week, 214
 * against 160 over 90 days, and 69 reviews averaging 4.6 — so a reviewer
 * clicking from Home's funnel into Insights sees the same numbers.
 *
 * The shape follows the region: the season runs October to March and
 * builds again from late September, and rafting stops while the monsoon
 * rivers run high. The experiences are the Experiences page's sample rows.
 */

const EXPERIENCES = [
  { id: "demo-1", title: "7 Day Immersive Experience in Meghalaya", status: "active", perHead: 6_700_000, liveDays: 620, weight: 25 },
  { id: "demo-2", title: "Cycling & Camping Expedition in Arunachal", status: "active", perHead: 2_450_000, liveDays: 540, weight: 20 },
  { id: "demo-3", title: "Rafting, Camping & Cycling in Upper Assam", status: "active", perHead: 9_800_000, liveDays: 480, weight: 12 },
  // The two oldest cover the full two years, so every span has something to sell.
  { id: "demo-4", title: "Raw Experience in Meghalaya", status: "active", perHead: 1_850_000, liveDays: 800, weight: 35 },
  { id: "demo-7", title: "Kaziranga Wildlife Weekend", status: "disabled", perHead: 2_200_000, liveDays: 780, weight: 10 },
] as const;

/** [from, to) days ago → bookings made in that span. */
const BOOKING_SEGMENTS: [number, number, number][] = [
  [0, 7, 21],
  [7, 14, 18],
  [14, 30, 48],
  [30, 60, 48],
  [60, 90, 79],
  [90, 180, 160],
  [180, 365, 560],
  [365, 730, 800],
];

/** [from, to) days ago → reviews, and the star total that sets their average. */
const REVIEW_SEGMENTS: [number, number, number, number][] = [
  [0, 7, 16, 75],
  [7, 30, 53, 242],
  [30, 90, 102, 452],
  [90, 180, 150, 660],
  [180, 365, 380, 1680],
  [365, 730, 420, 1850],
];

const DAY = 86_400_000;

/** mulberry32 — small, fast, and the same sequence on every machine. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** 1 for the high season, down to 0.35 in the monsoon. */
function season(ms: number) {
  const month = new Date(ms + 330 * 60_000).getUTCMonth();
  return [1, 0.95, 0.9, 0.75, 0.6, 0.45, 0.35, 0.35, 0.55, 0.95, 1, 1][month];
}

export function demoInsightFacts(nowMs: number): InsightFacts {
  const rand = random(20260926);

  /**
   * An instant `from`–`to` days ago, weighted towards the season. The last
   * day of a span is left out so a booking never lands on the boundary
   * between two periods, whichever way a day is counted.
   */
  const momentIn = (from: number, to: number) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const daysAgo = from + rand() * Math.max(0, to - 1 - from);
      const ms = nowMs - daysAgo * DAY;
      if (rand() < season(ms)) return ms;
    }
    return nowMs - (from + rand() * Math.max(0, to - 1 - from)) * DAY;
  };

  const sellable = (daysAgo: number) =>
    EXPERIENCES.filter((experience) => {
      if (daysAgo > experience.liveDays) return false;
      // Kaziranga was switched off five months ago; rafting pauses for the
      // monsoon, which covers the last three months.
      if (experience.id === "demo-7") return daysAgo > 150;
      if (experience.id === "demo-3") return daysAgo > 95;
      return true;
    });

  const bookings: BookingFact[] = [];
  for (const [from, to, count] of BOOKING_SEGMENTS) {
    for (let index = 0; index < count; index += 1) {
      const ms = momentIn(from, to);
      const daysAgo = (nowMs - ms) / DAY;
      const experience = pick(rand, sellable(daysAgo), (entry) => entry.weight);
      const guests = pick(rand, [1, 2, 3, 4, 5, 6], (n) => [15, 45, 15, 15, 5, 5][n - 1]);
      bookings.push({
        experienceId: experience.id,
        status: statusFor(rand, experience.id, ms, nowMs),
        isMarketplace: rand() < 0.58,
        guests,
        totalMinor: experience.perHead * guests,
        createdAt: new Date(ms).toISOString(),
      });
    }
  }
  pinCancellations(bookings, nowMs);

  const reviews: ReviewFact[] = [];
  for (const [from, to, count, stars] of REVIEW_SEGMENTS) {
    const batch: ReviewFact[] = [];
    for (let index = 0; index < count; index += 1) {
      const ms = momentIn(from, to);
      const experience = pick(rand, sellable((nowMs - ms) / DAY), (entry) => entry.weight);
      const age = (nowMs - ms) / DAY;
      batch.push({
        experienceId: experience.id,
        rating: 5,
        createdAt: new Date(ms).toISOString(),
        replied: age < 10 ? rand() < 0.7 : rand() < 0.997,
      });
    }
    // Take stars away until the segment averages what Home shows, mostly
    // from Arunachal, where weather and permits cost the most trips.
    let deficit = 5 * count - stars;
    while (deficit > 0) {
      const review = pick(rand, batch, (entry) =>
        entry.rating <= 1 ? 0 : (entry.experienceId === "demo-2" ? 4 : 1) * (entry.rating >= 4 ? 3 : 1),
      );
      review.rating -= 1;
      deficit -= 1;
    }
    reviews.push(...batch);
  }

  const enquiries: EnquiryFact[] = [];
  for (const [from, to, count] of BOOKING_SEGMENTS) {
    for (let index = 0; index < Math.round(count * 2.3); index += 1) {
      const ms = momentIn(from, to);
      const age = (nowMs - ms) / DAY;
      enquiries.push({
        createdAt: new Date(ms).toISOString(),
        source: pick<EnquirySource>(rand, ["marketplace", "website", "whatsapp", "phone", "referral"], (source) =>
          ({ marketplace: 45, website: 25, whatsapp: 15, phone: 8, referral: 7, manual: 0 })[source],
        ),
        status: enquiryStatus(rand, age),
      });
    }
  }

  const experiences: ExperienceFact[] = EXPERIENCES.map((experience) => ({
    id: experience.id,
    title: experience.title,
    status: experience.status,
    liveSince: new Date(nowMs - experience.liveDays * DAY).toISOString(),
  }));

  return { bookings, reviews, enquiries, experiences };
}

function statusFor(rand: () => number, experienceId: string, createdMs: number, nowMs: number): BookingStatus {
  const roll = rand();
  const refundRate = experienceId === "demo-2" ? 0.2 : 0.03;
  if (roll < 0.02) return "cancelled";
  if (roll < 0.02 + refundRate) return "refunded";
  const travel = createdMs + (7 + rand() * 50) * DAY;
  if (travel + 7 * DAY < nowMs) return "completed";
  if (travel <= nowMs) return "paid";
  return pick(rand, ["paid", "partially_paid", "confirmed", "pending_payment"] as BookingStatus[], (status) =>
    ({ paid: 60, partially_paid: 25, confirmed: 10, pending_payment: 5 })[status as "paid"],
  );
}

/**
 * Home's sample funnel counts the reservations and paid bookings cancelled
 * in each window — 1 and 1 in the last week, 2 and 4 in the last 30 days,
 * 6 and 9 in the last 90. Fix exactly that many among each span's bookings,
 * spread across it, with most refunds on the Arunachal trip.
 */
const CANCELLATION_SPANS: [number, number, number, number][] = [
  [0, 7, 1, 1],
  [7, 30, 1, 3],
  [30, 90, 4, 5],
];

function spaced<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  return Array.from({ length: Math.min(count, items.length) }, (_, index) =>
    items[Math.floor(((index + 0.5) * items.length) / Math.min(count, items.length))],
  );
}

function pinCancellations(bookings: BookingFact[], nowMs: number) {
  for (const [from, to, cancelled, refunded] of CANCELLATION_SPANS) {
    const rows = bookings
      .filter((booking) => {
        const age = (nowMs - Date.parse(booking.createdAt)) / DAY;
        return age >= from && age < to;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const booking of rows) {
      if (booking.status === "cancelled" || booking.status === "refunded") {
        booking.status = (nowMs - Date.parse(booking.createdAt)) / DAY > 40 ? "completed" : "paid";
      }
    }
    const arunachal = rows.filter((booking) => booking.experienceId === "demo-2");
    const others = rows.filter((booking) => booking.experienceId !== "demo-2");
    const onArunachal = Math.ceil(refunded * 0.7);
    spaced(arunachal, onArunachal).forEach((booking) => (booking.status = "refunded"));
    spaced(others, refunded - onArunachal + cancelled).forEach((booking, index) => {
      booking.status = index < cancelled ? "cancelled" : "refunded";
    });
  }
}

function enquiryStatus(rand: () => number, ageDays: number): EnquiryStatus {
  const roll = rand();
  if (roll < 0.21) return "won";
  if (roll < 0.25) return "spam";
  if (ageDays > 21) return "lost";
  return pick<EnquiryStatus>(rand, ["new", "open", "quoted", "negotiating", "lost"], (status) =>
    ({ new: 20, open: 25, quoted: 25, negotiating: 15, lost: 15, won: 0, spam: 0 })[status],
  );
}

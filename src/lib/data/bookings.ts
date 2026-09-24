import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  BookingDetail,
  BookingEvent,
  BookingGuest,
  BookingPayment,
  BookingRow,
  BookingStatus,
  BookingTabKey,
} from "@/lib/types";
import { BOOKING_TAB_STATUSES } from "@/lib/types";

/*
 * Data access for the Bookings module. Same shape as lib/data/experiences.ts:
 * queries run through the caller's Supabase session so RLS scopes the rows,
 * and the fixture set below only kicks in when Supabase isn't configured yet.
 */

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export type BookingQuery = {
  tab: BookingTabKey;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type BookingListResult = {
  rows: BookingRow[];
  counts: Record<BookingTabKey, number>;
  total: number;
  page: number;
  pageCount: number;
  isDemoData: boolean;
};

const PAGE_SIZE = 8;

export async function listBookings({
  tab,
  search = "",
  page = 1,
  pageSize = PAGE_SIZE,
}: BookingQuery): Promise<BookingListResult> {
  if (!isSupabaseConfigured()) return demoList({ tab, search, page, pageSize });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, reference, status, is_marketplace, experience_id, lead_name, lead_email, lead_phone, travel_start, travel_end, adults, children, infants, currency, total_minor, paid_minor, refunded_minor, commission_minor, created_at, experience_snapshot")
    .order("travel_start", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`listBookings failed: ${error.message}`);
  }

  const rows: BookingRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    reference: row.reference as string,
    status: row.status as BookingStatus,
    isMarketplace: Boolean(row.is_marketplace),
    experienceTitle:
      (row.experience_snapshot as { title?: string } | null)?.title ??
      "Untitled experience",
    experienceId: (row.experience_id as string | null) ?? null,
    leadName: row.lead_name as string,
    leadEmail: (row.lead_email as string | null) ?? null,
    leadPhone: (row.lead_phone as string | null) ?? null,
    travelStart: (row.travel_start as string | null) ?? null,
    travelEnd: (row.travel_end as string | null) ?? null,
    adults: Number(row.adults) || 0,
    children: Number(row.children) || 0,
    infants: Number(row.infants) || 0,
    currency: (row.currency as string) || "INR",
    totalMinor: Number(row.total_minor) || 0,
    paidMinor: Number(row.paid_minor) || 0,
    refundedMinor: Number(row.refunded_minor) || 0,
    commissionMinor: Number(row.commission_minor) || 0,
    createdAt: row.created_at as string,
  }));

  return applyFilters(rows, { tab, search, page, pageSize, isDemoData: false });
}

export async function getBooking(id: string): Promise<BookingDetail | null> {
  if (!isSupabaseConfigured()) {
    return demoDetail(id);
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_booking_detail", { p_id: id });
  if (error || !data) return null;
  // The RPC lands with the schema; typing it strictly here is not useful
  // until the RPC exists in the SQL migrations.
  return data as BookingDetail;
}

/* ------------------------------------------------------------------------ */
/* Filtering + fixture                                                      */
/* ------------------------------------------------------------------------ */

function applyFilters(
  rows: BookingRow[],
  {
    tab,
    search,
    page,
    pageSize,
    isDemoData,
  }: Required<BookingQuery> & { isDemoData: boolean },
): BookingListResult {
  const counts = countsByTab(rows);
  const inTab = BOOKING_TAB_STATUSES[tab];
  const needle = search.trim().toLowerCase();

  const matching = rows.filter((row) => {
    if (!inTab.includes(row.status)) return false;
    if (!needle) return true;
    return (
      row.leadName.toLowerCase().includes(needle) ||
      row.reference.toLowerCase().includes(needle) ||
      row.experienceTitle.toLowerCase().includes(needle) ||
      (row.leadEmail?.toLowerCase().includes(needle) ?? false)
    );
  });

  const start = (page - 1) * pageSize;
  return {
    rows: matching.slice(start, start + pageSize),
    counts,
    total: matching.length,
    page,
    pageCount: Math.max(Math.ceil(matching.length / pageSize), 1),
    isDemoData,
  };
}

function countsByTab(rows: BookingRow[]): Record<BookingTabKey, number> {
  const empty: Record<BookingTabKey, number> = {
    upcoming: 0,
    awaiting: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    for (const key of Object.keys(BOOKING_TAB_STATUSES) as BookingTabKey[]) {
      if (BOOKING_TAB_STATUSES[key].includes(row.status)) empty[key] += 1;
    }
  }
  return empty;
}

function demoList(query: Required<BookingQuery>): BookingListResult {
  return applyFilters(DEMO_ROWS, { ...query, isDemoData: true });
}

function demoDetail(id: string): BookingDetail | null {
  const row = DEMO_ROWS.find((entry) => entry.id === id);
  if (!row) return null;
  return {
    ...row,
    guests: DEMO_GUESTS[id] ?? [],
    payments: DEMO_PAYMENTS[id] ?? [],
    timeline: DEMO_TIMELINE[id] ?? [],
    experienceSnapshot: {
      durationDays: 7,
      location: ["Meghalaya"],
      thumbnailNote: null,
    },
    cancellationReason:
      row.status === "cancelled"
        ? "Guest requested — medical emergency"
        : row.status === "refunded"
          ? "Operator initiated — flight disruption"
          : null,
    notes: null,
  };
}

/* --- Fixture rows ------------------------------------------------------- */

const DEMO_ROWS: BookingRow[] = [
  {
    id: "bkg-01",
    reference: "BKG-000142",
    status: "paid",
    isMarketplace: true,
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    experienceId: "demo-1",
    leadName: "Priya Sengupta",
    leadEmail: "priya.sengupta@example.com",
    leadPhone: "+91 98301 55621",
    travelStart: "2026-05-15",
    travelEnd: "2026-05-21",
    adults: 2, children: 0, infants: 0,
    currency: "INR",
    totalMinor: 13400000, paidMinor: 13400000, refundedMinor: 0,
    commissionMinor: 1608000,
    createdAt: "2026-03-20T09:20:00+05:30",
  },
  {
    id: "bkg-02",
    reference: "BKG-000143",
    status: "partially_paid",
    isMarketplace: false,
    experienceTitle: "Cycling & Camping Expedition in Arunachal",
    experienceId: "demo-2",
    leadName: "Aarav Nair",
    leadEmail: "aarav@nair.family",
    leadPhone: "+91 97407 88113",
    travelStart: "2026-04-02",
    travelEnd: "2026-04-05",
    adults: 4, children: 0, infants: 0,
    currency: "INR",
    totalMinor: 9800000, paidMinor: 4900000, refundedMinor: 0,
    commissionMinor: 0,
    createdAt: "2026-03-14T13:45:00+05:30",
  },
  {
    id: "bkg-03",
    reference: "BKG-000144",
    status: "pending_payment",
    isMarketplace: true,
    experienceTitle: "Raw Experience in Meghalaya",
    experienceId: "demo-4",
    leadName: "Karan Bose",
    leadEmail: "karanbose@example.com",
    leadPhone: "+91 99871 22004",
    travelStart: "2026-03-28",
    travelEnd: "2026-03-30",
    adults: 2, children: 1, infants: 0,
    currency: "INR",
    totalMinor: 5550000, paidMinor: 0, refundedMinor: 0,
    commissionMinor: 666000,
    createdAt: "2026-03-19T18:10:00+05:30",
  },
  {
    id: "bkg-04",
    reference: "BKG-000145",
    status: "confirmed",
    isMarketplace: true,
    experienceTitle: "Rafting, Camping & Cycling in Upper Assam",
    experienceId: "demo-3",
    leadName: "Meera Iyer",
    leadEmail: "meera.iyer@example.com",
    leadPhone: "+91 98765 43210",
    travelStart: "2026-06-11",
    travelEnd: "2026-06-20",
    adults: 6, children: 2, infants: 0,
    currency: "INR",
    totalMinor: 78400000, paidMinor: 39200000, refundedMinor: 0,
    commissionMinor: 9408000,
    createdAt: "2026-03-10T11:00:00+05:30",
  },
  {
    id: "bkg-05",
    reference: "BKG-000136",
    status: "completed",
    isMarketplace: true,
    experienceTitle: "7 Day Immersive Experience in Meghalaya",
    experienceId: "demo-1",
    leadName: "Anjali Raghavan",
    leadEmail: "anjali.r@example.com",
    leadPhone: "+91 90230 55112",
    travelStart: "2026-02-08",
    travelEnd: "2026-02-14",
    adults: 2, children: 0, infants: 0,
    currency: "INR",
    totalMinor: 13400000, paidMinor: 13400000, refundedMinor: 0,
    commissionMinor: 1608000,
    createdAt: "2026-01-05T10:12:00+05:30",
  },
  {
    id: "bkg-06",
    reference: "BKG-000131",
    status: "cancelled",
    isMarketplace: false,
    experienceTitle: "Cycling & Camping Expedition in Arunachal",
    experienceId: "demo-2",
    leadName: "Rahul Menon",
    leadEmail: "rahulmenon@example.com",
    leadPhone: "+91 98450 23178",
    travelStart: "2026-02-20",
    travelEnd: "2026-02-23",
    adults: 3, children: 0, infants: 0,
    currency: "INR",
    totalMinor: 7350000, paidMinor: 0, refundedMinor: 0,
    commissionMinor: 0,
    createdAt: "2026-02-01T15:33:00+05:30",
  },
  {
    id: "bkg-07",
    reference: "BKG-000128",
    status: "refunded",
    isMarketplace: true,
    experienceTitle: "Raw Experience in Meghalaya",
    experienceId: "demo-4",
    leadName: "Divya Rao",
    leadEmail: "divya.rao@example.com",
    leadPhone: "+91 90008 16632",
    travelStart: "2026-01-14",
    travelEnd: "2026-01-16",
    adults: 2, children: 0, infants: 0,
    currency: "INR",
    totalMinor: 3700000, paidMinor: 3700000, refundedMinor: 3700000,
    commissionMinor: 0,
    createdAt: "2025-12-28T09:15:00+05:30",
  },
];

const DEMO_GUESTS: Record<string, BookingGuest[]> = {
  "bkg-01": [
    { id: "g1", fullName: "Priya Sengupta", ageBucket: "adult", role: "lead" },
    { id: "g2", fullName: "Rohit Sengupta", ageBucket: "adult", role: "guest" },
  ],
  "bkg-04": [
    { id: "g1", fullName: "Meera Iyer", ageBucket: "adult", role: "lead" },
    { id: "g2", fullName: "Sanjay Iyer", ageBucket: "adult", role: "guest" },
    { id: "g3", fullName: "Kavya Iyer", ageBucket: "adult", role: "guest" },
    { id: "g4", fullName: "Nishant Iyer", ageBucket: "adult", role: "guest" },
    { id: "g5", fullName: "Anaya Iyer", ageBucket: "adult", role: "guest" },
    { id: "g6", fullName: "Arjun Iyer", ageBucket: "adult", role: "guest" },
    { id: "g7", fullName: "Aarav Iyer", ageBucket: "child", role: "guest" },
    { id: "g8", fullName: "Vihaan Iyer", ageBucket: "child", role: "guest" },
  ],
};

const DEMO_PAYMENTS: Record<string, BookingPayment[]> = {
  "bkg-01": [
    { id: "p1", method: "razorpay", status: "captured", amountMinor: 13400000, createdAt: "2026-03-20T09:22:00+05:30", reference: "pay_LxK92aa" },
  ],
  "bkg-02": [
    { id: "p1", method: "bank_transfer", status: "captured", amountMinor: 4900000, createdAt: "2026-03-14T14:00:00+05:30", reference: "NEFT-INDB4419" },
  ],
  "bkg-04": [
    { id: "p1", method: "razorpay", status: "captured", amountMinor: 39200000, createdAt: "2026-03-10T11:02:00+05:30", reference: "pay_MqA47xf" },
  ],
  "bkg-05": [
    { id: "p1", method: "razorpay", status: "captured", amountMinor: 13400000, createdAt: "2026-01-05T10:14:00+05:30", reference: "pay_KcN13sd" },
  ],
  "bkg-07": [
    { id: "p1", method: "razorpay", status: "captured", amountMinor: 3700000, createdAt: "2025-12-28T09:16:00+05:30", reference: "pay_JbP08fk" },
    { id: "p2", method: "razorpay", status: "refunded", amountMinor: -3700000, createdAt: "2026-01-12T17:40:00+05:30", reference: "rfnd_JbP08fk" },
  ],
};

const DEMO_TIMELINE: Record<string, BookingEvent[]> = {
  "bkg-01": [
    { id: "e1", kind: "created", label: "Booking created", detail: "From marketplace", createdAt: "2026-03-20T09:20:00+05:30" },
    { id: "e2", kind: "payment_captured", label: "Full payment received", amountMinor: 13400000, createdAt: "2026-03-20T09:22:00+05:30" },
    { id: "e3", kind: "confirmed", label: "Confirmation sent to guest", createdAt: "2026-03-20T09:22:30+05:30" },
    { id: "e4", kind: "reminder_sent", label: "Departure reminder queued", detail: "Fires 3 days before travel", createdAt: "2026-03-20T09:23:00+05:30" },
  ],
  "bkg-02": [
    { id: "e1", kind: "created", label: "Booking created", detail: "Operator-direct", createdAt: "2026-03-14T13:45:00+05:30" },
    { id: "e2", kind: "payment_captured", label: "Deposit received", amountMinor: 4900000, createdAt: "2026-03-14T14:00:00+05:30" },
    { id: "e3", kind: "note", label: "Balance due", detail: "₹49,000 balance due by 25 Mar 2026", createdAt: "2026-03-14T14:00:30+05:30" },
  ],
  "bkg-04": [
    { id: "e1", kind: "created", label: "Booking created", detail: "From marketplace", createdAt: "2026-03-10T11:00:00+05:30" },
    { id: "e2", kind: "payment_captured", label: "50% deposit received", amountMinor: 39200000, createdAt: "2026-03-10T11:02:00+05:30" },
    { id: "e3", kind: "confirmed", label: "Confirmed with the guest", createdAt: "2026-03-10T11:02:30+05:30" },
    { id: "e4", kind: "note", label: "Balance due", detail: "₹3,92,000 balance due by 1 Jun 2026", createdAt: "2026-03-10T11:03:00+05:30" },
  ],
  "bkg-05": [
    { id: "e1", kind: "created", label: "Booking created", detail: "From marketplace", createdAt: "2026-01-05T10:12:00+05:30" },
    { id: "e2", kind: "payment_captured", label: "Full payment received", amountMinor: 13400000, createdAt: "2026-01-05T10:14:00+05:30" },
    { id: "e3", kind: "confirmed", label: "Confirmed with the guest", createdAt: "2026-01-05T10:14:30+05:30" },
    { id: "e4", kind: "checked_in", label: "Guests checked in", createdAt: "2026-02-08T09:00:00+05:30" },
    { id: "e5", kind: "completed", label: "Trip completed", detail: "Review request sent", createdAt: "2026-02-14T18:30:00+05:30" },
  ],
  "bkg-06": [
    { id: "e1", kind: "created", label: "Booking created", detail: "Operator-direct", createdAt: "2026-02-01T15:33:00+05:30" },
    { id: "e2", kind: "cancelled", label: "Booking cancelled", detail: "Guest requested — medical emergency", createdAt: "2026-02-04T10:05:00+05:30" },
  ],
  "bkg-07": [
    { id: "e1", kind: "created", label: "Booking created", detail: "From marketplace", createdAt: "2025-12-28T09:15:00+05:30" },
    { id: "e2", kind: "payment_captured", label: "Full payment received", amountMinor: 3700000, createdAt: "2025-12-28T09:16:00+05:30" },
    { id: "e3", kind: "refunded", label: "Full refund issued", detail: "Operator initiated — flight disruption", amountMinor: -3700000, createdAt: "2026-01-12T17:40:00+05:30" },
  ],
};

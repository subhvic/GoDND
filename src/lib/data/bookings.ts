import "server-only";

import { connection } from "next/server";

import { needsPermit } from "@/lib/bookings/phase";
import { createServerSupabase } from "@/lib/supabase/server";
import { addDays, dayKey } from "@/lib/time";
import type {
  BookingDetail,
  BookingEvent,
  BookingPayment,
  BookingRow,
  BookingStatus,
  BookingTraveller,
  CancelCategory,
  LatestBookingRow,
  PaymentMethod,
  PermitStatus,
  Route,
} from "@/lib/types";

/*
 * Data access for the Bookings module. Same contract as the other data
 * files: queries run through the caller's Supabase session so RLS scopes the
 * rows, and the fixture below only applies when Supabase isn't configured.
 *
 * The list loads every booking at once and the browser sorts it into phases.
 * Phases depend on today's date (Ongoing is derived, not stored), and an
 * action in the drawer can move a booking between them; holding the list
 * client-side makes that move instant instead of a round trip per tab.
 */

export const isBookingDemo = () =>
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type BookingList = {
  rows: BookingRow[];
  isDemoData: boolean;
  /** Server clock at render; the list starts from it so both sides agree on "today". */
  now: string;
};

export async function listAllBookings(): Promise<BookingList> {
  // Phases move with the calendar; this must never be prerendered.
  await connection();
  const now = new Date();
  if (isBookingDemo()) {
    return { rows: buildDemo(now).map(toRowOnly), isDemoData: true, now: now.toISOString() };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .neq("status", "draft")
    .order("travel_start", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`listAllBookings failed: ${error.message}`);
  return {
    rows: (data ?? []).map((row) => toBookingRow(row as BookingRecord)),
    isDemoData: false,
    now: now.toISOString(),
  };
}

/**
 * Home's "Latest bookings": the most recently made, whatever their state
 * (a draft checkout is not a booking yet, so those stay out).
 *
 * Where the trip goes is read from the booking's own snapshot first — the
 * experience as it was sold — and only falls back to the live experience
 * for bookings made before snapshots carried it.
 */
export async function listLatestBookings(limit = 4): Promise<LatestBookingRow[]> {
  if (isBookingDemo()) {
    await connection();
    return buildDemo(new Date())
      .map(toRowOnly)
      .filter((row) => row.status !== "draft")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((row) => ({ ...row, ...(DEMO_PLACES[row.experienceId ?? ""] ?? NO_PLACE) }));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `${BOOKING_COLUMNS},
       experience:experiences ( pickup_location, dropoff_location, experience_regions ( regions ( name ) ) )`,
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listLatestBookings failed: ${error.message}`);

  return (data ?? []).map((raw) => {
    const record = raw as unknown as BookingRecord & {
      experience: {
        pickup_location: string | null;
        dropoff_location: string | null;
        experience_regions: { regions: { name: string } | null }[] | null;
      } | null;
    };
    const snapshot = (record.experience_snapshot ?? {}) as {
      location?: string[];
      pickup_location?: string;
      dropoff_location?: string;
    };
    const live = record.experience;
    const from = snapshot.pickup_location ?? live?.pickup_location ?? null;
    const to = snapshot.dropoff_location ?? live?.dropoff_location ?? null;

    return {
      ...toBookingRow(record),
      location:
        snapshot.location ??
        (live?.experience_regions ?? [])
          .map((link) => link.regions?.name)
          .filter((name): name is string => Boolean(name)),
      route: from && to ? { from, to } : null,
    };
  });
}

const BOOKING_COLUMNS =
  "id, reference, status, is_marketplace, experience_id, enquiry_id, lead_name, lead_email, lead_phone, travel_start, travel_end, adults, children, infants, currency, total_minor, paid_minor, refunded_minor, refund_owed_minor, commission_minor, balance_due_at, created_at, experience_snapshot";

type BookingRecord = Record<string, unknown> & { experience_snapshot?: unknown };

function toBookingRow(row: BookingRecord): BookingRow {
  return {
    id: row.id as string,
    reference: row.reference as string,
    status: row.status as BookingStatus,
    isMarketplace: Boolean(row.is_marketplace),
    experienceTitle:
      (row.experience_snapshot as { title?: string } | null)?.title ?? "Untitled experience",
    experienceId: (row.experience_id as string | null) ?? null,
    enquiryId: (row.enquiry_id as string | null) ?? null,
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
    refundOwedMinor: Number(row.refund_owed_minor) || 0,
    commissionMinor: Number(row.commission_minor) || 0,
    balanceDueAt: (row.balance_due_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/* ------------------------------------------------------------------------ */
/* Detail                                                                   */
/* ------------------------------------------------------------------------ */

export async function getBooking(id: string): Promise<BookingDetail | null> {
  await connection();
  if (isBookingDemo()) {
    return buildDemo(new Date()).find((entry) => entry.id === id) ?? null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createServerSupabase();
  const [booking, travellers, payments, events, review, payout] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `${BOOKING_COLUMNS}, notes, cancellation_reason, cancelled_at, cancel_category,
         completed_at, review_requested_at, briefing_sent_at, permit_status,
         canceller:profiles!bookings_cancelled_by_fkey ( full_name ),
         experience:experiences ( duration_days,
           experience_regions ( regions ( name ) ),
           experience_crew ( role, member:profiles ( full_name, phone ) ) )`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("booking_travellers").select("*").eq("booking_id", id).order("position"),
    supabase
      .from("payments")
      .select("id, direction, status, amount_minor, method, gateway, reference, collected_by_platform, paid_at, created_at")
      .eq("booking_id", id)
      .order("created_at"),
    supabase
      .from("booking_events")
      .select("id, kind, label, detail, amount_minor, created_at, actor:profiles ( full_name )")
      .eq("booking_id", id)
      .order("created_at"),
    supabase
      .from("reviews")
      .select("rating, title, body, created_at, agency_reply, replied_at")
      .eq("booking_id", id)
      .maybeSingle(),
    supabase
      .from("payout_items")
      .select("net_minor, payout:payouts ( reference, status, paid_at )")
      .eq("booking_id", id)
      .maybeSingle(),
  ]);

  if (booking.error) throw new Error(`getBooking failed: ${booking.error.message}`);
  if (!booking.data) return null;

  const record = booking.data as unknown as BookingRecord & {
    notes: string | null;
    cancellation_reason: string | null;
    cancelled_at: string | null;
    cancel_category: CancelCategory | null;
    completed_at: string | null;
    review_requested_at: string | null;
    briefing_sent_at: string | null;
    permit_status: PermitStatus | null;
    canceller: { full_name: string | null } | null;
    experience: {
      duration_days: number | null;
      experience_regions: { regions: { name: string } | null }[] | null;
      experience_crew: { role: string; member: { full_name: string | null; phone: string | null } | null }[] | null;
    } | null;
  };
  const row = toBookingRow(record);
  const snapshot = (record.experience_snapshot ?? {}) as { location?: string[]; duration_days?: number };
  const location =
    snapshot.location ??
    (record.experience?.experience_regions ?? [])
      .map((link) => link.regions?.name)
      .filter((name): name is string => Boolean(name));
  const captain = record.experience?.experience_crew?.find((member) => member.role === "captain")?.member;

  const paymentRows: BookingPayment[] = (payments.data ?? []).map((payment) => ({
    id: payment.id as string,
    direction: payment.direction as BookingPayment["direction"],
    method: ((payment.gateway as string) === "razorpay" ? "razorpay" : (payment.method as PaymentMethod | null) ?? "other"),
    status: payment.status as BookingPayment["status"],
    amountMinor: Number(payment.amount_minor) || 0,
    createdAt: (payment.paid_at as string | null) ?? (payment.created_at as string),
    reference: (payment.reference as string | null) ?? null,
    collectedByPlatform: Boolean(payment.collected_by_platform),
  }));

  const stored: BookingEvent[] = (events.data ?? []).map((event) => ({
    id: event.id as string,
    kind: event.kind as BookingEvent["kind"],
    label: event.label as string,
    detail: (event.detail as string | null) ?? null,
    amountMinor: (event.amount_minor as number | null) ?? null,
    actor: (event.actor as unknown as { full_name: string | null } | null)?.full_name ?? null,
    createdAt: event.created_at as string,
  }));

  // Bookings made before the event log existed, and payments captured by
  // the gateway webhook, have no stored events — derive them so the
  // timeline is never empty.
  const derived: BookingEvent[] = [];
  if (!stored.some((event) => event.kind === "created")) {
    derived.push({
      id: `${row.id}-created`,
      kind: "created",
      label: "Booking created",
      detail: row.isMarketplace ? "From the GoDND marketplace" : "From your website",
      createdAt: row.createdAt,
    });
  }
  for (const payment of paymentRows.filter((entry) => entry.method === "razorpay")) {
    derived.push({
      id: `${payment.id}-event`,
      kind: payment.direction === "refund" ? "refunded" : "payment_captured",
      label: payment.direction === "refund" ? "Refund processed" : "Payment received online",
      amountMinor: payment.direction === "refund" ? -payment.amountMinor : payment.amountMinor,
      createdAt: payment.createdAt,
    });
  }

  const reviewRow = review.data as {
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
    agency_reply: string | null;
    replied_at: string | null;
  } | null;
  const payoutRow = payout.data as unknown as {
    net_minor: number;
    payout: { reference: string; status: string; paid_at: string | null } | null;
  } | null;

  return {
    ...row,
    travellers: (travellers.data ?? []).map((traveller, index) => ({
      id: traveller.id as string,
      fullName: traveller.full_name as string,
      ageBucket: ((traveller.kind as string) ?? "adult") as BookingTraveller["ageBucket"],
      role: index === 0 ? "lead" : "guest",
      idType: (traveller.id_type as BookingTraveller["idType"]) ?? null,
      idNumber: (traveller.id_number as string | null) ?? null,
      mealPref: (traveller.meal_pref as string | null) ?? null,
      medicalNotes: (traveller.medical_notes as string | null) ?? null,
      checkedInAt: (traveller.checked_in_at as string | null) ?? null,
    })),
    payments: paymentRows,
    timeline: [...derived, ...stored].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    experienceSnapshot: {
      durationDays: snapshot.duration_days ?? record.experience?.duration_days ?? null,
      location,
      thumbnailNote: null,
    },
    captain: captain?.full_name ? { name: captain.full_name, phone: captain.phone } : null,
    permitStatus: record.permit_status ?? (needsPermit(location) ? "pending" : "not_needed"),
    briefingSentAt: record.briefing_sent_at,
    reviewRequestedAt: record.review_requested_at,
    completedAt: record.completed_at,
    cancellation: record.cancelled_at
      ? {
          category: record.cancel_category ?? "other",
          reason: record.cancellation_reason ?? "No reason recorded",
          cancelledAt: record.cancelled_at,
          by: record.canceller?.full_name ?? null,
        }
      : null,
    review: reviewRow
      ? {
          rating: reviewRow.rating,
          title: reviewRow.title,
          body: reviewRow.body,
          createdAt: reviewRow.created_at,
          reply: reviewRow.agency_reply,
          repliedAt: reviewRow.replied_at,
        }
      : null,
    payout: payoutRow?.payout
      ? {
          status: payoutRow.payout.status as NonNullable<BookingDetail["payout"]>["status"],
          reference: payoutRow.payout.reference,
          netMinor: payoutRow.net_minor,
          paidAt: payoutRow.payout.paid_at,
        }
      : null,
    notes: record.notes,
  };
}

function toRowOnly(detail: BookingDetail): BookingRow {
  return {
    id: detail.id,
    reference: detail.reference,
    status: detail.status,
    isMarketplace: detail.isMarketplace,
    experienceTitle: detail.experienceTitle,
    experienceId: detail.experienceId,
    enquiryId: detail.enquiryId,
    leadName: detail.leadName,
    leadEmail: detail.leadEmail,
    leadPhone: detail.leadPhone,
    travelStart: detail.travelStart,
    travelEnd: detail.travelEnd,
    adults: detail.adults,
    children: detail.children,
    infants: detail.infants,
    currency: detail.currency,
    totalMinor: detail.totalMinor,
    paidMinor: detail.paidMinor,
    refundedMinor: detail.refundedMinor,
    refundOwedMinor: detail.refundOwedMinor,
    commissionMinor: detail.commissionMinor,
    balanceDueAt: detail.balanceDueAt,
    createdAt: detail.createdAt,
  };
}

/* ------------------------------------------------------------------------ */
/* Demo fixture                                                             */
/* ------------------------------------------------------------------------ */

/*
 * Dates are relative to today, so every phase always has a live example —
 * two trips on the road right now, one that ended and was never closed, a
 * cancellation with a refund still owed. Fixed calendar dates aged into
 * "every upcoming trip is in the past" within a season.
 */

/** Where each demo experience runs — what a booking's snapshot would carry. */
const DEMO_PLACES: Record<string, { location: string[]; route: Route | null }> = {
  "demo-1": { location: ["Meghalaya", "Assam"], route: { from: "Guwahati", to: "Shillong" } },
  "demo-2": { location: ["Arunachal Pradesh"], route: { from: "Guwahati", to: "Itanagar" } },
  "demo-3": { location: ["Assam"], route: { from: "Dibrugarh", to: "Jorhat" } },
  "demo-4": { location: ["Meghalaya"], route: { from: "Shillong", to: "Shillong" } },
};

const NO_PLACE: { location: string[]; route: Route | null } = { location: [], route: null };

const DEMO_EXPERIENCES: Record<string, { title: string; days: number; captain: { name: string; phone: string } }> = {
  "demo-1": { title: "7 Day Immersive Experience in Meghalaya", days: 7, captain: { name: "Madhurjyoti Saikia", phone: "+91 98640 11223" } },
  "demo-2": { title: "Cycling & Camping Expedition in Arunachal", days: 4, captain: { name: "Tashi Wangchu", phone: "+91 94361 55890" } },
  "demo-3": { title: "Rafting, Camping & Cycling in Upper Assam", days: 10, captain: { name: "Bhaskar Gogoi", phone: "+91 99541 20876" } },
  "demo-4": { title: "Raw Experience in Meghalaya", days: 3, captain: { name: "Wanphrang Lyngdoh", phone: "+91 98630 44120" } },
};

const COMMISSION_BPS = 1200;

function buildDemo(nowDate: Date): BookingDetail[] {
  const today = dayKey(nowDate);
  const day = (offset: number) => addDays(today, offset);
  const at = (offset: number, time = "10:30") => `${day(offset)}T${time}:00+05:30`;

  let n = 0;
  const ev = (kind: BookingEvent["kind"], label: string, when: string, extra: Partial<BookingEvent> = {}): BookingEvent => {
    n += 1;
    return { id: `ev-${n}`, kind, label, createdAt: when, actor: null, ...extra };
  };
  const pay = (
    id: string,
    amountMinor: number,
    when: string,
    extra: Partial<BookingPayment> = {},
  ): BookingPayment => ({
    id,
    direction: "inbound",
    method: "razorpay",
    status: "captured",
    amountMinor,
    createdAt: when,
    reference: null,
    collectedByPlatform: true,
    ...extra,
  });
  const person = (
    id: string,
    fullName: string,
    extra: Partial<BookingTraveller> = {},
  ): BookingTraveller => ({
    id,
    fullName,
    ageBucket: "adult",
    role: "guest",
    idType: null,
    idNumber: null,
    mealPref: null,
    medicalNotes: null,
    checkedInAt: null,
    ...extra,
  });

  type Seed = Omit<
    BookingDetail,
    "experienceTitle" | "experienceSnapshot" | "captain" | "commissionMinor" | "currency" | "payout" | "review"
  > & {
    experienceId: string;
    payout?: BookingDetail["payout"];
    review?: BookingDetail["review"];
  };

  const seeds: Seed[] = [
    {
      id: "bkg-01",
      reference: "BKG-000142",
      status: "paid",
      isMarketplace: true,
      experienceId: "demo-1",
      enquiryId: "enq-142",
      leadName: "Priya Sengupta",
      leadEmail: "priya.sengupta@example.com",
      leadPhone: "+91 98301 55621",
      travelStart: day(9),
      travelEnd: day(15),
      adults: 2,
      children: 0,
      infants: 0,
      totalMinor: 13400000,
      paidMinor: 13400000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: null,
      createdAt: at(-38, "09:20"),
      travellers: [
        person("t-01a", "Priya Sengupta", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 4821", mealPref: "Vegetarian" }),
        person("t-01b", "Rohit Sengupta", { idType: "passport", idNumber: "Z4418207" }),
      ],
      payments: [pay("p-01", 13400000, at(-38, "09:22"), { reference: "pay_LxK92aa" })],
      timeline: [
        ev("created", "Booking created", at(-38, "09:20"), { detail: "From the GoDND marketplace, after enquiry ENQ-000142" }),
        ev("payment_captured", "Paid in full", at(-38, "09:22"), { amountMinor: 13400000, detail: "Razorpay" }),
        ev("confirmed", "Booking confirmed", at(-38, "09:22")),
      ],
      permitStatus: "not_needed",
      briefingSentAt: null,
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: null,
    },
    {
      id: "bkg-02",
      reference: "BKG-000143",
      status: "partially_paid",
      isMarketplace: false,
      experienceId: "demo-2",
      enquiryId: null,
      leadName: "Aarav Nair",
      leadEmail: "aarav@nair.family",
      leadPhone: "+91 97407 88113",
      travelStart: day(6),
      travelEnd: day(9),
      adults: 4,
      children: 0,
      infants: 0,
      totalMinor: 9800000,
      paidMinor: 4900000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: day(1),
      createdAt: at(-20, "13:45"),
      travellers: [
        person("t-02a", "Aarav Nair", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 1109" }),
        person("t-02b", "Nisha Nair", { idType: "voter", idNumber: "KRL2201934", mealPref: "Jain" }),
      ],
      payments: [
        pay("p-02", 4900000, at(-20, "14:00"), { method: "bank_transfer", reference: "NEFT-INDB4419", collectedByPlatform: false }),
      ],
      timeline: [
        ev("created", "Booking created", at(-20, "13:45"), { detail: "From your website" }),
        ev("payment_captured", "Deposit received", at(-20, "14:00"), { amountMinor: 4900000, detail: "Bank transfer · NEFT-INDB4419" }),
        ev("confirmed", "Booking confirmed", at(-20, "14:00")),
        ev("reminder_sent", "Payment reminder sent via WhatsApp", at(-4, "11:10"), { actor: "Dipendu", detail: "₹49,000 balance" }),
      ],
      permitStatus: "pending",
      briefingSentAt: null,
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: null,
    },
    {
      id: "bkg-03",
      reference: "BKG-000144",
      status: "pending_payment",
      isMarketplace: true,
      experienceId: "demo-4",
      enquiryId: null,
      leadName: "Karan Bose",
      leadEmail: "karanbose@example.com",
      leadPhone: "+91 99871 22004",
      travelStart: day(18),
      travelEnd: day(20),
      adults: 2,
      children: 1,
      infants: 0,
      totalMinor: 5550000,
      paidMinor: 0,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: day(2),
      createdAt: at(-1, "18:10"),
      travellers: [person("t-03a", "Karan Bose", { role: "lead" })],
      payments: [],
      timeline: [
        ev("created", "Booking created", at(-1, "18:10"), { detail: "Checkout started on the GoDND marketplace — payment not completed" }),
      ],
      permitStatus: "not_needed",
      briefingSentAt: null,
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: null,
    },
    {
      id: "bkg-04",
      reference: "BKG-000145",
      status: "partially_paid",
      isMarketplace: true,
      experienceId: "demo-3",
      enquiryId: null,
      leadName: "Meera Iyer",
      leadEmail: "meera.iyer@example.com",
      leadPhone: "+91 98765 43210",
      travelStart: day(26),
      travelEnd: day(35),
      adults: 6,
      children: 2,
      infants: 0,
      totalMinor: 78400000,
      paidMinor: 39200000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: day(19),
      createdAt: at(-15, "11:00"),
      travellers: [
        person("t-04a", "Meera Iyer", { role: "lead", idType: "passport", idNumber: "P7730124" }),
        person("t-04b", "Sanjay Iyer", { idType: "passport", idNumber: "P7730125" }),
        person("t-04c", "Kavya Iyer", { idType: "aadhaar", idNumber: "XXXX XXXX 3310" }),
        person("t-04d", "Nishant Iyer", { idType: "aadhaar", idNumber: "XXXX XXXX 3311", medicalNotes: "Asthma — carries an inhaler" }),
        person("t-04e", "Anaya Iyer", { idType: "dl", idNumber: "KA0120190034" }),
        person("t-04f", "Arjun Iyer", { idType: "dl", idNumber: "KA0120190035" }),
        person("t-04g", "Aarav Iyer", { ageBucket: "child" }),
        person("t-04h", "Vihaan Iyer", { ageBucket: "child", mealPref: "No nuts — allergy" }),
      ],
      payments: [pay("p-04", 39200000, at(-15, "11:02"), { reference: "pay_MqA47xf" })],
      timeline: [
        ev("created", "Booking created", at(-15, "11:00"), { detail: "From the GoDND marketplace" }),
        ev("payment_captured", "50% deposit received", at(-15, "11:02"), { amountMinor: 39200000, detail: "Razorpay" }),
        ev("confirmed", "Booking confirmed", at(-15, "11:02")),
        ev("briefing_sent", "Trip briefing sent via email", at(-6, "16:40"), { actor: "Riya Das" }),
      ],
      permitStatus: "not_needed",
      briefingSentAt: at(-6, "16:40"),
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: null,
    },
    {
      id: "bkg-08",
      reference: "BKG-000146",
      status: "paid",
      isMarketplace: false,
      experienceId: "demo-2",
      enquiryId: null,
      leadName: "Ishaan Das",
      leadEmail: "ishaan.das@example.com",
      leadPhone: "+91 96740 21857",
      travelStart: day(-1),
      travelEnd: day(2),
      adults: 4,
      children: 0,
      infants: 0,
      totalMinor: 9800000,
      paidMinor: 9800000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: null,
      createdAt: at(-33, "20:05"),
      travellers: [
        person("t-08a", "Ishaan Das", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 7702", checkedInAt: at(-1, "06:40") }),
        person("t-08b", "Rhea Das", { idType: "aadhaar", idNumber: "XXXX XXXX 7703", checkedInAt: at(-1, "06:40") }),
        person("t-08c", "Kabir Sethi", { idType: "passport", idNumber: "T5501928", checkedInAt: at(-1, "06:42"), medicalNotes: "Knee injury last year — avoid long descents" }),
        person("t-08d", "Mira Joshi", { idType: "voter", idNumber: "MH2208831", mealPref: "Vegan" }),
      ],
      payments: [
        pay("p-08a", 4900000, at(-33, "20:10"), { method: "upi", reference: "UPI 4102 8836 1120", collectedByPlatform: false }),
        pay("p-08b", 4900000, at(-9, "12:00"), { method: "upi", reference: "UPI 4102 9917 4402", collectedByPlatform: false }),
      ],
      timeline: [
        ev("created", "Booking created", at(-33, "20:05"), { detail: "From your website" }),
        ev("payment_captured", "Deposit received", at(-33, "20:10"), { amountMinor: 4900000, detail: "UPI" }),
        ev("confirmed", "Booking confirmed", at(-33, "20:10")),
        ev("permit_updated", "Inner Line Permits issued", at(-12, "15:30"), { actor: "Arjun Gogoi", detail: "4 permits, valid for the trip dates" }),
        ev("payment_captured", "Paid in full", at(-9, "12:00"), { amountMinor: 4900000, detail: "UPI" }),
        ev("briefing_sent", "Trip briefing sent via WhatsApp", at(-5, "10:15"), { actor: "Arjun Gogoi" }),
        ev("checked_in", "3 guests checked in", at(-1, "06:42"), { actor: "Tashi Wangchu", detail: "Ishaan Das, Rhea Das, Kabir Sethi — Mira joins at Bhalukpong" }),
        ev("trip_update", "Reached Bomdila — everyone well", at(-1, "18:20"), { actor: "Tashi Wangchu", detail: "Day 1 done on time. Roads clear towards Dirang." }),
      ],
      permitStatus: "issued",
      briefingSentAt: at(-5, "10:15"),
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: null,
    },
    {
      id: "bkg-09",
      reference: "BKG-000147",
      status: "partially_paid",
      isMarketplace: true,
      experienceId: "demo-4",
      enquiryId: null,
      leadName: "Neha Kulkarni",
      leadEmail: "neha.kulkarni@example.com",
      leadPhone: "+91 98200 67331",
      travelStart: day(0),
      travelEnd: day(2),
      adults: 2,
      children: 0,
      infants: 0,
      totalMinor: 3700000,
      paidMinor: 1850000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: day(0),
      createdAt: at(-12, "08:50"),
      travellers: [
        person("t-09a", "Neha Kulkarni", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 5580" }),
        person("t-09b", "Omkar Kulkarni", { idType: "aadhaar", idNumber: "XXXX XXXX 5581", mealPref: "Vegetarian" }),
      ],
      payments: [pay("p-09", 1850000, at(-12, "08:52"), { reference: "pay_Nn83Kq1" })],
      timeline: [
        ev("created", "Booking created", at(-12, "08:50"), { detail: "From the GoDND marketplace" }),
        ev("payment_captured", "50% deposit received", at(-12, "08:52"), { amountMinor: 1850000, detail: "Razorpay" }),
        ev("confirmed", "Booking confirmed", at(-12, "08:52")),
        ev("briefing_sent", "Trip briefing sent via WhatsApp", at(-2, "17:05"), { actor: "Dipendu" }),
      ],
      permitStatus: "not_needed",
      briefingSentAt: at(-2, "17:05"),
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: "Guest will pay the balance in cash at pickup.",
    },
    {
      id: "bkg-10",
      reference: "BKG-000139",
      status: "paid",
      isMarketplace: true,
      experienceId: "demo-3",
      enquiryId: null,
      leadName: "Siddharth Rao",
      leadEmail: "sid.rao@example.com",
      leadPhone: "+91 90081 44276",
      travelStart: day(-11),
      travelEnd: day(-2),
      adults: 2,
      children: 0,
      infants: 0,
      totalMinor: 19600000,
      paidMinor: 19600000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: null,
      createdAt: at(-52, "19:30"),
      travellers: [
        person("t-10a", "Siddharth Rao", { role: "lead", idType: "passport", idNumber: "M1180342", checkedInAt: at(-11, "07:05") }),
        person("t-10b", "Tanya Rao", { idType: "passport", idNumber: "M1180343", checkedInAt: at(-11, "07:05") }),
      ],
      payments: [pay("p-10", 19600000, at(-52, "19:32"), { reference: "pay_Ka91Lz0" })],
      timeline: [
        ev("created", "Booking created", at(-52, "19:30"), { detail: "From the GoDND marketplace" }),
        ev("payment_captured", "Paid in full", at(-52, "19:32"), { amountMinor: 19600000, detail: "Razorpay" }),
        ev("confirmed", "Booking confirmed", at(-52, "19:32")),
        ev("checked_in", "2 guests checked in", at(-11, "07:05"), { actor: "Bhaskar Gogoi" }),
        ev("trip_update", "Rafting day moved by a day — river too high", at(-7, "09:00"), { actor: "Bhaskar Gogoi" }),
      ],
      permitStatus: "not_needed",
      briefingSentAt: at(-14, "12:00"),
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: null,
      notes: null,
    },
    {
      id: "bkg-05",
      reference: "BKG-000136",
      status: "completed",
      isMarketplace: true,
      experienceId: "demo-1",
      enquiryId: null,
      leadName: "Anjali Raghavan",
      leadEmail: "anjali.r@example.com",
      leadPhone: "+91 90230 55112",
      travelStart: day(-26),
      travelEnd: day(-20),
      adults: 2,
      children: 0,
      infants: 0,
      totalMinor: 13400000,
      paidMinor: 13400000,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: null,
      createdAt: at(-80, "10:12"),
      travellers: [
        person("t-05a", "Anjali Raghavan", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 9021", checkedInAt: at(-26, "07:00") }),
        person("t-05b", "Vikas Raghavan", { idType: "aadhaar", idNumber: "XXXX XXXX 9022", checkedInAt: at(-26, "07:00") }),
      ],
      payments: [pay("p-05", 13400000, at(-80, "10:14"), { reference: "pay_KcN13sd" })],
      timeline: [
        ev("created", "Booking created", at(-80, "10:12"), { detail: "From the GoDND marketplace" }),
        ev("payment_captured", "Paid in full", at(-80, "10:14"), { amountMinor: 13400000, detail: "Razorpay" }),
        ev("confirmed", "Booking confirmed", at(-80, "10:14")),
        ev("checked_in", "2 guests checked in", at(-26, "07:00"), { actor: "Madhurjyoti Saikia" }),
        ev("completed", "Trip completed", at(-20, "18:30"), { actor: "Dipendu" }),
        ev("review_requested", "Review request sent to the guest", at(-20, "18:30")),
        ev("review_received", "5★ review received", at(-17, "21:04")),
      ],
      permitStatus: "not_needed",
      briefingSentAt: at(-29, "12:00"),
      reviewRequestedAt: at(-20, "18:30"),
      completedAt: at(-20, "18:30"),
      cancellation: null,
      review: {
        rating: 5,
        title: "The best week of our year",
        body: "Madhurjyoti planned every day around the weather and still got us to Dawki at sunrise. The homestay in Mawlynnong was the highlight.",
        createdAt: at(-17, "21:04"),
        reply: null,
        repliedAt: null,
      },
      payout: { status: "paid", reference: "PO-000012", netMinor: 11792000, paidAt: at(-14, "11:00") },
      notes: null,
    },
    {
      id: "bkg-11",
      reference: "BKG-000140",
      status: "cancelled",
      isMarketplace: false,
      experienceId: "demo-1",
      enquiryId: null,
      leadName: "Kavya Menon",
      leadEmail: "kavya.menon@example.com",
      leadPhone: "+91 95391 20874",
      travelStart: day(20),
      travelEnd: day(26),
      adults: 2,
      children: 0,
      infants: 0,
      totalMinor: 13400000,
      paidMinor: 6700000,
      refundedMinor: 0,
      refundOwedMinor: 5025000,
      balanceDueAt: null,
      createdAt: at(-30, "12:40"),
      travellers: [person("t-11a", "Kavya Menon", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 6617" })],
      payments: [
        pay("p-11", 6700000, at(-30, "12:45"), { method: "upi", reference: "UPI 3310 2291 7780", collectedByPlatform: false }),
      ],
      timeline: [
        ev("created", "Booking created", at(-30, "12:40"), { detail: "From your website" }),
        ev("payment_captured", "Deposit received", at(-30, "12:45"), { amountMinor: 6700000, detail: "UPI" }),
        ev("confirmed", "Booking confirmed", at(-30, "12:45")),
        ev("cancelled", "Booking cancelled", at(-3, "15:20"), { actor: "Dipendu", detail: "Couldn't get leave approved" }),
        ev("refund_pending", "Refund due to the guest", at(-3, "15:20"), { amountMinor: -5025000, detail: "23 days before departure — 75% refund" }),
      ],
      permitStatus: "not_needed",
      briefingSentAt: null,
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: { category: "guest_request", reason: "Couldn't get leave approved", cancelledAt: at(-3, "15:20"), by: "Dipendu" },
      notes: null,
    },
    {
      id: "bkg-06",
      reference: "BKG-000131",
      status: "cancelled",
      isMarketplace: false,
      experienceId: "demo-2",
      enquiryId: null,
      leadName: "Rahul Menon",
      leadEmail: "rahulmenon@example.com",
      leadPhone: "+91 98450 23178",
      travelStart: day(12),
      travelEnd: day(15),
      adults: 3,
      children: 0,
      infants: 0,
      totalMinor: 7350000,
      paidMinor: 0,
      refundedMinor: 0,
      refundOwedMinor: 0,
      balanceDueAt: null,
      createdAt: at(-30, "15:33"),
      travellers: [person("t-06a", "Rahul Menon", { role: "lead" })],
      payments: [],
      timeline: [
        ev("created", "Booking created", at(-30, "15:33"), { detail: "From your website" }),
        ev("cancelled", "Booking cancelled", at(-25, "10:05"), { actor: "Riya Das", detail: "Medical emergency in the family" }),
      ],
      permitStatus: "pending",
      briefingSentAt: null,
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: { category: "guest_request", reason: "Medical emergency in the family", cancelledAt: at(-25, "10:05"), by: "Riya Das" },
      notes: null,
    },
    {
      id: "bkg-07",
      reference: "BKG-000128",
      status: "refunded",
      isMarketplace: true,
      experienceId: "demo-4",
      enquiryId: null,
      leadName: "Divya Rao",
      leadEmail: "divya.rao@example.com",
      leadPhone: "+91 90008 16632",
      travelStart: day(-40),
      travelEnd: day(-38),
      adults: 2,
      children: 0,
      infants: 0,
      totalMinor: 3700000,
      paidMinor: 3700000,
      refundedMinor: 3700000,
      refundOwedMinor: 0,
      balanceDueAt: null,
      createdAt: at(-60, "09:15"),
      travellers: [person("t-07a", "Divya Rao", { role: "lead", idType: "aadhaar", idNumber: "XXXX XXXX 2230" })],
      payments: [
        pay("p-07a", 3700000, at(-60, "09:16"), { reference: "pay_JbP08fk" }),
        pay("p-07b", 3700000, at(-45, "17:40"), { direction: "refund", reference: "rfnd_JbP08fk" }),
      ],
      timeline: [
        ev("created", "Booking created", at(-60, "09:15"), { detail: "From the GoDND marketplace" }),
        ev("payment_captured", "Paid in full", at(-60, "09:16"), { amountMinor: 3700000, detail: "Razorpay" }),
        ev("cancelled", "Booking cancelled", at(-46, "08:30"), { actor: "Dipendu", detail: "Landslide warning on the Shillong–Sohra road" }),
        ev("refunded", "Full refund processed by GoDND", at(-45, "17:40"), { amountMinor: -3700000, detail: "rfnd_JbP08fk" }),
      ],
      permitStatus: "not_needed",
      briefingSentAt: null,
      reviewRequestedAt: null,
      completedAt: null,
      cancellation: { category: "weather", reason: "Landslide warning on the Shillong–Sohra road", cancelledAt: at(-46, "08:30"), by: "Dipendu" },
      notes: null,
    },
  ];

  return seeds.map((seed) => {
    const experience = DEMO_EXPERIENCES[seed.experienceId];
    const place = DEMO_PLACES[seed.experienceId] ?? NO_PLACE;
    const commissionMinor = seed.isMarketplace
      ? Math.round(((seed.paidMinor - seed.refundedMinor) * COMMISSION_BPS) / 10000)
      : 0;
    return {
      ...seed,
      experienceTitle: experience.title,
      currency: "INR",
      commissionMinor,
      experienceSnapshot: { durationDays: experience.days, location: place.location, thumbnailNote: null },
      captain: experience.captain,
      review: seed.review ?? null,
      payout:
        seed.payout ??
        (seed.isMarketplace && seed.status === "completed"
          ? { status: "pending", reference: null, netMinor: seed.paidMinor - commissionMinor, paidAt: null }
          : null),
    };
  });
}

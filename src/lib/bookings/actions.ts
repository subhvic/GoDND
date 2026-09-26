import { z } from "zod";

import {
  balanceMinor,
  isActive,
  needsWrapUp,
  phaseForBooking,
} from "@/lib/bookings/phase";
import { dayKey, formatDayRange } from "@/lib/time";
import type {
  BookingDetail,
  BookingEvent,
  BookingEventKind,
  BookingPayment,
  BookingStatus,
  BookingTraveller,
} from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/*
 * Every change an operator can make to a booking, as data.
 *
 * `bookingActionSchema` is the wire format (validated on the server, typed
 * on the client). `applyBookingAction` is the one implementation of what
 * each action does: the drawer runs it for an instant update, and the server
 * runs it again on the stored booking before persisting — so a rule such as
 * "no payment above the balance" is written once and holds on both sides.
 *
 * The browser generates the ids for anything an action creates (payments,
 * events), so the optimistic copy and the stored row are the same row.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const minor = z.number().int().positive().max(10_000_000_000);

const common = {
  bookingId: z.string().min(1).max(64),
  /** Ids for the events this action writes; unused ones are ignored. */
  eventIds: z.array(z.uuid()).min(1).max(3),
};

export const PAYMENT_METHODS = ["upi", "bank_transfer", "cash", "card", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<BookingPayment["method"], string> = {
  razorpay: "Razorpay",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export const travellerSchema = z.object({
  id: z.string().min(1).max(64),
  fullName: z.string().trim().min(1, "Enter the traveller's name").max(120),
  ageBucket: z.enum(["adult", "child", "infant"]),
  role: z.enum(["lead", "guest"]),
  idType: z.enum(["aadhaar", "passport", "voter", "dl"]).nullable(),
  idNumber: z.string().trim().max(32).nullable(),
  mealPref: z.string().trim().max(60).nullable(),
  medicalNotes: z.string().trim().max(300).nullable(),
  checkedInAt: z.string().nullable(),
});

export const bookingActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("record_payment"),
    ...common,
    paymentId: z.uuid(),
    amountMinor: minor,
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(80).nullable(),
    receivedOn: isoDate,
  }),
  z.object({
    type: z.literal("record_refund"),
    ...common,
    paymentId: z.uuid(),
    amountMinor: minor,
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(80).nullable(),
    reason: z.string().trim().max(200).nullable(),
  }),
  z.object({
    type: z.literal("cancel"),
    ...common,
    category: z.enum(["guest_request", "operator", "weather", "minimum_not_met", "no_payment", "other"]),
    reason: z.string().trim().min(1, "Say briefly why").max(300),
    refundMinor: z.number().int().min(0).max(10_000_000_000),
  }),
  z.object({
    type: z.literal("check_in"),
    ...common,
    travellerIds: z.array(z.string().min(1).max(64)).min(1).max(99),
  }),
  z.object({ type: z.literal("close_out"), ...common }),
  z.object({
    type: z.literal("change_dates"),
    ...common,
    start: isoDate,
    end: isoDate,
    note: z.string().trim().max(300).nullable(),
  }),
  z.object({ type: z.literal("update_traveller"), ...common, traveller: travellerSchema }),
  z.object({
    type: z.literal("set_permit"),
    ...common,
    status: z.enum(["pending", "applied", "issued"]),
    note: z.string().trim().max(200).nullable(),
  }),
  z.object({
    type: z.literal("log"),
    ...common,
    kind: z.enum(["reminder_sent", "briefing_sent", "message_sent", "review_requested", "trip_update", "incident", "note"]),
    label: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(1000).nullable(),
  }),
  z.object({ type: z.literal("reply_review"), ...common, reply: z.string().trim().min(1, "Write a reply").max(1000) }),
]);

export type BookingAction = z.infer<typeof bookingActionSchema>;

/** A booking action as the drawer builds it — the ids are added when it is sent. */
export type BookingActionDraft = BookingAction extends infer A
  ? A extends BookingAction
    ? Omit<A, "bookingId" | "eventIds">
    : never
  : never;

export type ApplyResult = { ok: true; detail: BookingDetail } | { ok: false; error: string };

type Context = { now: Date; actor: string | null };

const money = (value: number, detail: BookingDetail) => formatMoney(value, detail.currency);

/**
 * Apply one action to a booking. Returns the next booking, or a sentence
 * saying why the action isn't possible in the booking's current state.
 */
export function applyBookingAction(
  detail: BookingDetail,
  action: BookingAction,
  { now, actor }: Context,
): ApplyResult {
  const today = dayKey(now);
  const phase = phaseForBooking(detail, today);
  const at = now.toISOString();
  const ids = [...action.eventIds];
  const event = (kind: BookingEventKind, label: string, extra: Partial<BookingEvent> = {}): BookingEvent => ({
    id: ids.shift() ?? `${action.eventIds[0]}-${kind}`,
    kind,
    label,
    actor,
    createdAt: at,
    ...extra,
  });
  const next = (patch: Partial<BookingDetail>, events: BookingEvent[]): ApplyResult => ({
    ok: true,
    detail: { ...detail, ...patch, timeline: [...detail.timeline, ...events] },
  });
  const fail = (error: string): ApplyResult => ({ ok: false, error });

  switch (action.type) {
    case "record_payment": {
      if (phase === "cancelled") return fail("This booking is cancelled — record a refund instead.");
      const due = balanceMinor(detail);
      if (due === 0) return fail("Nothing is due on this booking.");
      if (action.amountMinor > due) return fail(`That's more than the ${money(due, detail)} due.`);
      const paid = detail.paidMinor + action.amountMinor;
      const wasUnpaid = detail.status === "pending_payment" || detail.status === "draft";
      const status: BookingStatus =
        detail.status === "completed" ? "completed" : paid >= detail.totalMinor ? "paid" : "partially_paid";
      const payment: BookingPayment = {
        id: action.paymentId,
        direction: "inbound",
        method: action.method,
        status: "captured",
        amountMinor: action.amountMinor,
        createdAt: `${action.receivedOn}T12:00:00+05:30`,
        reference: action.reference || null,
        collectedByPlatform: false,
      };
      const events = [
        event("payment_captured", paid >= detail.totalMinor ? "Paid in full" : "Payment received", {
          amountMinor: action.amountMinor,
          detail: `${PAYMENT_METHOD_LABELS[action.method]}${action.reference ? ` · ${action.reference}` : ""} — recorded by hand`,
        }),
      ];
      if (wasUnpaid) events.push(event("confirmed", "Booking confirmed", { detail: "Seats held for the guest" }));
      return next(
        { status, paidMinor: paid, payments: [...detail.payments, payment], balanceDueAt: paid >= detail.totalMinor ? null : detail.balanceDueAt },
        events,
      );
    }

    case "record_refund": {
      const refundable = detail.paidMinor - detail.refundedMinor;
      if (refundable <= 0) return fail("Nothing has been paid that could be refunded.");
      if (action.amountMinor > refundable) return fail(`At most ${money(refundable, detail)} can be refunded.`);
      const refunded = detail.refundedMinor + action.amountMinor;
      const owed = Math.max(detail.refundOwedMinor - action.amountMinor, 0);
      const status: BookingStatus =
        detail.status === "cancelled" && owed === 0 ? "refunded" : detail.status;
      const payment: BookingPayment = {
        id: action.paymentId,
        direction: "refund",
        method: action.method,
        status: "captured",
        amountMinor: action.amountMinor,
        createdAt: at,
        reference: action.reference || null,
        collectedByPlatform: false,
      };
      return next(
        { status, refundedMinor: refunded, refundOwedMinor: owed, payments: [...detail.payments, payment] },
        [
          event("refunded", owed === 0 && detail.status === "cancelled" ? "Refund completed" : "Refund issued", {
            amountMinor: -action.amountMinor,
            detail: [action.reason, action.reference].filter(Boolean).join(" · ") || null,
          }),
        ],
      );
    }

    case "cancel": {
      if (phase === "cancelled") return fail("This booking is already cancelled.");
      if (detail.status === "completed") return fail("A completed trip can't be cancelled — issue a goodwill refund instead.");
      const refundable = detail.paidMinor - detail.refundedMinor;
      if (action.refundMinor > refundable) return fail(`The refund can't be more than the ${money(refundable, detail)} paid.`);
      const events = [
        event("cancelled", "Booking cancelled", { detail: action.reason }),
      ];
      if (action.refundMinor > 0) {
        events.push(
          event("refund_pending", "Refund due to the guest", {
            amountMinor: -action.refundMinor,
            detail: detail.isMarketplace
              ? "GoDND returns it to the guest's original payment method in 5–7 working days"
              : "Record it here once you've sent it",
          }),
        );
      }
      return next(
        {
          status: "cancelled",
          refundOwedMinor: action.refundMinor,
          balanceDueAt: null,
          cancellation: { category: action.category, reason: action.reason, cancelledAt: at, by: actor },
        },
        events,
      );
    }

    case "check_in": {
      if (phase !== "ongoing") return fail("Guests can be checked in once the trip has started.");
      const pending = new Set(
        detail.travellers.filter((traveller) => !traveller.checkedInAt).map((traveller) => traveller.id),
      );
      const arrivals = action.travellerIds.filter((id) => pending.has(id));
      if (arrivals.length === 0) return fail("Those guests are already checked in.");
      const travellers = detail.travellers.map((traveller) =>
        arrivals.includes(traveller.id) ? { ...traveller, checkedInAt: at } : traveller,
      );
      const names = detail.travellers.filter((traveller) => arrivals.includes(traveller.id)).map((traveller) => traveller.fullName);
      return next({ travellers }, [
        event(
          "checked_in",
          arrivals.length === 1 ? `${names[0]} checked in` : `${arrivals.length} guests checked in`,
          { detail: arrivals.length > 1 ? names.join(", ") : null },
        ),
      ]);
    }

    case "close_out": {
      if (phase !== "ongoing" && !needsWrapUp(detail, today)) {
        return fail(
          phase === "completed" ? "This trip is already closed." : "A trip can be closed once it has started.",
        );
      }
      const due = balanceMinor(detail);
      if (due > 0) return fail(`Collect the ${money(due, detail)} balance before closing the trip.`);
      const early = phase === "ongoing";
      return next(
        {
          status: "completed",
          completedAt: at,
          reviewRequestedAt: detail.reviewRequestedAt ?? at,
          travelEnd: early ? today : detail.travelEnd,
        },
        [
          event("completed", early ? "Trip ended early" : "Trip completed", {
            detail: early ? `Ended on day ${Math.max(1, daysSinceStart(detail, today))}` : null,
          }),
          ...(detail.reviewRequestedAt ? [] : [event("review_requested", "Review request sent to the guest")]),
        ],
      );
    }

    case "change_dates": {
      if (phase !== "upcoming" && phase !== "awaiting") return fail("Dates can only change before the trip starts.");
      if (action.start < today) return fail("The new start date has already passed.");
      if (action.end < action.start) return fail("The trip can't end before it starts.");
      if (action.start === detail.travelStart && action.end === (detail.travelEnd ?? action.start)) {
        return fail("Those are the current dates — pick new ones.");
      }
      const from = detail.travelStart ? formatDayRange(detail.travelStart, detail.travelEnd, now) : "no dates";
      return next({ travelStart: action.start, travelEnd: action.end }, [
        event("dates_changed", "Dates changed", {
          detail: `${from} → ${formatDayRange(action.start, action.end, now)}${action.note ? ` · ${action.note}` : ""}`,
        }),
      ]);
    }

    case "update_traveller": {
      if (phase === "cancelled") return fail("This booking is cancelled.");
      const exists = detail.travellers.some((traveller) => traveller.id === action.traveller.id);
      const seats = detail.adults + detail.children + detail.infants;
      if (!exists && detail.travellers.length >= seats) return fail("Every seat on this booking already has a traveller.");
      const traveller: BookingTraveller = {
        ...action.traveller,
        idNumber: action.traveller.idNumber || null,
        mealPref: action.traveller.mealPref || null,
        medicalNotes: action.traveller.medicalNotes || null,
      };
      const travellers = exists
        ? detail.travellers.map((entry) => (entry.id === traveller.id ? traveller : entry))
        : [...detail.travellers, traveller];
      return next({ travellers }, [
        event("travellers_updated", exists ? `Updated ${traveller.fullName}'s details` : `Added ${traveller.fullName}`),
      ]);
    }

    case "set_permit": {
      if (detail.permitStatus === "not_needed") return fail("This trip doesn't need an Inner Line Permit.");
      const label =
        action.status === "issued" ? "Inner Line Permits issued" : action.status === "applied" ? "Inner Line Permits applied for" : "Permit status reset";
      return next({ permitStatus: action.status }, [event("permit_updated", label, { detail: action.note })]);
    }

    case "log": {
      const patch: Partial<BookingDetail> = {};
      if (action.kind === "briefing_sent") patch.briefingSentAt = at;
      if (action.kind === "review_requested") patch.reviewRequestedAt = at;
      if ((action.kind === "trip_update" || action.kind === "incident") && phase !== "ongoing") {
        return fail("Trip updates are for trips in progress.");
      }
      return next(patch, [event(action.kind, action.label, { detail: action.detail })]);
    }

    case "reply_review": {
      if (!detail.review) return fail("There's no review to reply to yet.");
      return next({ review: { ...detail.review, reply: action.reply, repliedAt: at } }, [
        event("review_replied", "Replied to the review"),
      ]);
    }
  }
}

function daysSinceStart(detail: BookingDetail, today: string): number {
  if (!detail.travelStart) return 1;
  const start = Date.parse(`${detail.travelStart}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((now - start) / 86_400_000) + 1;
}

/** Actions allowed in the booking's phase — drives which buttons the drawer shows. */
export function canPerform(detail: BookingDetail, type: BookingAction["type"], today: string): boolean {
  const phase = phaseForBooking(detail, today);
  const due = balanceMinor(detail);
  switch (type) {
    case "record_payment":
      return phase !== "cancelled" && due > 0;
    case "record_refund":
      return detail.paidMinor - detail.refundedMinor > 0;
    case "cancel":
      return phase === "awaiting" || phase === "upcoming" || (phase === "ongoing" && isActive(detail.status));
    case "check_in":
      return phase === "ongoing" && detail.travellers.some((traveller) => !traveller.checkedInAt);
    case "close_out":
      return phase === "ongoing" || needsWrapUp(detail, today);
    case "change_dates":
      return phase === "upcoming" || phase === "awaiting";
    case "update_traveller":
      return phase !== "cancelled";
    case "set_permit":
      return detail.permitStatus !== "not_needed" && (phase === "upcoming" || phase === "awaiting");
    case "log":
      return true;
    case "reply_review":
      return Boolean(detail.review);
  }
}

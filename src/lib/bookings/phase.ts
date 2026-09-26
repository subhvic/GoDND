import type { Status } from "@/lib/status";
import { addDays, daysFrom, dayKey, formatDay } from "@/lib/time";
import type {
  BookingDetail,
  BookingPhase,
  BookingRow,
  BookingStatus,
  CancelCategory,
} from "@/lib/types";

/*
 * Where a booking stands, read the way an operator reads it. Shared by the
 * list (tab and row marker), the drawer (banner, actions, checklist) and the
 * server (which phase a live query lands in), so all three always agree.
 *
 * "today" is always a day key in the operator's zone (lib/time.ts), passed in
 * rather than read here: the server and the browser must use the same one.
 */

const ACTIVE: BookingStatus[] = ["confirmed", "partially_paid", "paid"];

export function isActive(status: BookingStatus): boolean {
  return ACTIVE.includes(status);
}

/** Last day of the trip — the start when no end is recorded. */
export function lastDay(row: Pick<BookingRow, "travelStart" | "travelEnd">): string | null {
  return row.travelEnd ?? row.travelStart;
}

/**
 * Ongoing is derived from the dates, never stored: a trip is ongoing because
 * today falls between its first and last day, so nothing has to remember to
 * flip it at midnight. A trip that has ended but was never closed reads as
 * Completed (it isn't being experienced any more) with wrap-up pending.
 */
export function phaseForBooking(
  row: Pick<BookingRow, "status" | "travelStart" | "travelEnd">,
  today: string,
): BookingPhase {
  switch (row.status) {
    case "draft":
    case "pending_payment":
      return "awaiting";
    case "cancelled":
    case "refunded":
      return "cancelled";
    case "completed":
      return "completed";
    default: {
      const start = row.travelStart ? dayKey(row.travelStart) : null;
      const end = lastDay(row);
      if (!start || !end) return "upcoming";
      if (today < start) return "upcoming";
      if (today > dayKey(end)) return "completed";
      return "ongoing";
    }
  }
}

/** Ended, still carrying an active status — the operator hasn't closed it out. */
export function needsWrapUp(row: Pick<BookingRow, "status" | "travelStart" | "travelEnd">, today: string): boolean {
  const end = lastDay(row);
  return isActive(row.status) && Boolean(end) && today > dayKey(end!);
}

export function balanceMinor(row: Pick<BookingRow, "totalMinor" | "paidMinor" | "status">): number {
  if (row.status === "cancelled" || row.status === "refunded") return 0;
  return Math.max(row.totalMinor - row.paidMinor, 0);
}

export function guestCount(row: Pick<BookingRow, "adults" | "children" | "infants">): number {
  return row.adults + row.children + row.infants;
}

/** "Day 2 of 4" for a trip in progress; null outside the trip. */
export function tripDay(
  row: Pick<BookingRow, "travelStart" | "travelEnd">,
  today: string,
): { day: number; of: number } | null {
  if (!row.travelStart) return null;
  const end = lastDay(row)!;
  const of = daysFrom(row.travelStart, end) + 1;
  const day = daysFrom(row.travelStart, today) + 1;
  if (day < 1 || day > of) return null;
  return { day, of };
}

/* --------------------------------------------------------------------- */
/* Labels and colour                                                      */
/* --------------------------------------------------------------------- */

export type BookingMarker = { label: string; status: Status };

/**
 * The one badge a row carries. It answers "does this need me?" first
 * (rule 01/02): amber for anything waiting on the operator, blue for a trip
 * in progress, green when the money is in. Closed records — completed,
 * cancelled, refunded — go grey so the one amber row in a tab stands out.
 */
export function markerForBooking(row: BookingRow, today: string): BookingMarker {
  const phase = phaseForBooking(row, today);
  const due = balanceMinor(row);
  switch (phase) {
    case "awaiting":
      return { label: "Awaiting payment", status: "warning" };
    case "upcoming":
      return due > 0
        ? { label: row.paidMinor > 0 ? "Balance due" : "Unpaid", status: "warning" }
        : { label: "Paid", status: "healthy" };
    case "ongoing":
      return due > 0 ? { label: "On trip · balance due", status: "warning" } : { label: "On trip", status: "info" };
    case "completed":
      return needsWrapUp(row, today)
        ? { label: "Wrap-up pending", status: "warning" }
        : { label: "Completed", status: "neutral" };
    case "cancelled":
      if (row.refundOwedMinor > 0) return { label: "Refund due", status: "warning" };
      return { label: row.status === "refunded" ? "Refunded" : "Cancelled", status: "neutral" };
  }
}

/* --------------------------------------------------------------------- */
/* Pre-departure                                                          */
/* --------------------------------------------------------------------- */

/** States that need an Inner Line Permit to enter. */
const ILP_STATES = ["Arunachal Pradesh", "Nagaland", "Mizoram", "Manipur"];

export function needsPermit(location: string[]): boolean {
  return location.some((place) => ILP_STATES.some((state) => place.toLowerCase().includes(state.split(" ")[0].toLowerCase())));
}

export type ChecklistItem = {
  id: "payment" | "travellers" | "permit" | "briefing" | "reminder";
  label: string;
  done: boolean;
  detail: string;
};

/** Travellers whose details are complete enough to raise a permit or a manifest. */
export function completeTravellers(detail: BookingDetail): number {
  return detail.travellers.filter(
    (traveller) =>
      traveller.fullName.trim() &&
      (traveller.ageBucket !== "adult" || (traveller.idType && traveller.idNumber)),
  ).length;
}

/**
 * What must be true before the trip leaves. Ordered by what blocks the trip
 * outright (money, permits) before what merely helps it go well.
 */
export function preDepartureChecklist(detail: BookingDetail, today: string): ChecklistItem[] {
  const seats = guestCount(detail);
  const complete = completeTravellers(detail);
  const due = balanceMinor(detail);
  const start = detail.travelStart;
  const now = new Date(`${today}T12:00:00+05:30`);
  const items: ChecklistItem[] = [
    {
      id: "payment",
      label: "Payment",
      done: due === 0,
      detail:
        due === 0
          ? "Paid in full"
          : `Balance due${detail.balanceDueAt ? ` by ${formatDay(detail.balanceDueAt, now)}` : ""}`,
    },
    {
      id: "travellers",
      label: "Traveller details",
      done: complete >= seats,
      detail: `${Math.min(complete, seats)} of ${seats} complete`,
    },
  ];
  if (detail.permitStatus !== "not_needed") {
    items.push({
      id: "permit",
      label: "Inner Line Permit",
      done: detail.permitStatus === "issued",
      detail:
        detail.permitStatus === "issued"
          ? "Issued"
          : detail.permitStatus === "applied"
            ? "Applied — awaiting permits"
            : complete < seats
              ? `Not applied yet — needs ID details for ${seats - complete} more traveller${seats - complete === 1 ? "" : "s"}`
              : "Not applied yet — every traveller's ID is in",
    });
  }
  items.push({
    id: "briefing",
    label: "Trip briefing",
    done: Boolean(detail.briefingSentAt),
    detail: detail.briefingSentAt ? "Sent" : "Pickup point, timings and what to bring",
  });
  if (start) {
    const reminderDay = addDays(start, -3);
    items.push({
      id: "reminder",
      label: "Departure reminder",
      done: today >= reminderDay,
      detail:
        today >= reminderDay
          ? "Sent automatically"
          : `Goes out automatically on ${formatDay(reminderDay, now)}`,
    });
  }
  return items;
}

/* --------------------------------------------------------------------- */
/* Cancellation                                                           */
/* --------------------------------------------------------------------- */

export const CANCEL_CATEGORY_LABELS: Record<CancelCategory, string> = {
  guest_request: "Guest asked to cancel",
  operator: "We can't run it",
  weather: "Weather",
  minimum_not_met: "Minimum group size not met",
  no_payment: "Guest didn't pay",
  other: "Something else",
};

/**
 * Refund owed under the GoDND general cancellation policy, by days before
 * departure. PLACEHOLDER TIERS — the policy operators accept in the wizard
 * isn't written down anywhere in the product yet (docs/BOOKING-JOURNEYS.md
 * §7). Weather and minimum-not-met always refund in full: that is the
 * guarantee operators accept in the experience's policies step. So does
 * anything the operator cancels.
 */
export const REFUND_TIERS = [
  { minDays: 30, percent: 100 },
  { minDays: 15, percent: 75 },
  { minDays: 7, percent: 50 },
  { minDays: 0, percent: 0 },
] as const;

export function policyRefund(
  detail: Pick<BookingRow, "paidMinor" | "refundedMinor" | "travelStart">,
  category: CancelCategory,
  today: string,
): { percent: number; amountMinor: number; daysBefore: number | null; rule: string } {
  const refundable = Math.max(detail.paidMinor - detail.refundedMinor, 0);
  const daysBefore = detail.travelStart ? daysFrom(today, detail.travelStart) : null;
  if (category === "weather" || category === "minimum_not_met" || category === "operator") {
    return {
      percent: 100,
      amountMinor: refundable,
      daysBefore,
      rule: category === "operator" ? "Cancelled by you — full refund" : "Guaranteed full refund",
    };
  }
  const days = daysBefore ?? 0;
  const tier = REFUND_TIERS.find((entry) => days >= entry.minDays) ?? REFUND_TIERS[REFUND_TIERS.length - 1];
  return {
    percent: tier.percent,
    amountMinor: Math.round((refundable * tier.percent) / 100),
    daysBefore,
    rule:
      days < 0
        ? "After departure — no refund under the policy"
        : `${days} day${days === 1 ? "" : "s"} before departure — ${tier.percent}% refund`,
  };
}

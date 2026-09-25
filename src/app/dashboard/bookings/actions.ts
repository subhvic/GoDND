"use server";

import { applyBookingAction, bookingActionSchema, type BookingAction } from "@/lib/bookings/actions";
import { getBooking, isBookingDemo } from "@/lib/data/bookings";
import { createServerSupabase } from "@/lib/supabase/server";
import type { BookingDetail } from "@/lib/types";

/**
 * Row-to-detail hand-off, same pattern as fetchExperienceDetail: the row
 * carries what the table needs; every extra field (travellers, payments,
 * timeline) loads on demand when a row is opened. Most rows are never
 * opened, and shipping the full detail with the list would multiply the
 * payload for no benefit.
 */
export async function fetchBookingDetail(id: string): Promise<BookingDetail | null> {
  return getBooking(id);
}

export type BookingActionResult =
  | { ok: true; detail: BookingDetail | null }
  | { ok: false; error: string };

/**
 * One drawer action. The rules live in applyBookingAction, which the drawer
 * already ran for its instant update; here it runs again against the stored
 * booking — the server is the authority — and only the difference is
 * written, in one transaction (apply_booking_change, 0007).
 *
 * In a sample workspace nothing is stored: the action is validated and the
 * drawer keeps its own result. `detail: null` tells it so.
 */
export async function performBookingAction(input: BookingAction): Promise<BookingActionResult> {
  const parsed = bookingActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That change isn't valid." };
  }
  const action = parsed.data;

  if (isBookingDemo()) return { ok: true, detail: null };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };

  const before = await getBooking(action.bookingId);
  if (!before) return { ok: false, error: "This booking could not be found." };

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const result = applyBookingAction(before, action, {
    now: new Date(),
    actor: (profile?.full_name as string | null) ?? user.email ?? null,
  });
  if (!result.ok) return result;

  const change = diff(before, result.detail, action.type === "cancel" ? user.id : null);
  const { error } = await supabase.rpc("apply_booking_change", {
    p_booking: before.id,
    p_patch: change.patch,
    p_payments: change.payments,
    p_travellers: change.travellers,
    p_events: change.events,
    p_review_reply: change.reviewReply,
  });
  if (error) return { ok: false, error: `Not saved: ${error.message}` };

  return { ok: true, detail: await getBooking(before.id) };
}

/** The difference between two versions of a booking, in the shape apply_booking_change takes. */
function diff(before: BookingDetail, after: BookingDetail, cancelledBy: string | null) {
  const patch: Record<string, unknown> = {};
  const set = (column: string, a: unknown, b: unknown) => {
    if (a !== b) patch[column] = b;
  };
  set("status", before.status, after.status);
  set("travel_start", before.travelStart, after.travelStart);
  set("travel_end", before.travelEnd, after.travelEnd);
  set("paid_minor", before.paidMinor, after.paidMinor);
  set("refunded_minor", before.refundedMinor, after.refundedMinor);
  set("refund_owed_minor", before.refundOwedMinor, after.refundOwedMinor);
  set("balance_due_at", before.balanceDueAt, after.balanceDueAt);
  set("completed_at", before.completedAt, after.completedAt);
  set("review_requested_at", before.reviewRequestedAt, after.reviewRequestedAt);
  set("briefing_sent_at", before.briefingSentAt, after.briefingSentAt);
  set("permit_status", before.permitStatus, after.permitStatus);
  if (after.cancellation && !before.cancellation) {
    patch.cancelled_at = after.cancellation.cancelledAt;
    patch.cancellation_reason = after.cancellation.reason;
    patch.cancel_category = after.cancellation.category;
    if (cancelledBy) patch.cancelled_by = cancelledBy;
  }

  const paymentIds = new Set(before.payments.map((payment) => payment.id));
  const payments = after.payments
    .filter((payment) => !paymentIds.has(payment.id))
    .map((payment) => ({
      id: payment.id,
      direction: payment.direction,
      amount_minor: payment.amountMinor,
      currency: after.currency,
      method: payment.method,
      reference: payment.reference,
      paid_at: payment.createdAt,
    }));

  const previous = new Map(before.travellers.map((traveller) => [traveller.id, JSON.stringify(traveller)]));
  const travellers = after.travellers
    .map((traveller, position) => ({ traveller, position }))
    .filter(({ traveller }) => previous.get(traveller.id) !== JSON.stringify(traveller))
    .map(({ traveller, position }) => ({
      id: traveller.id,
      full_name: traveller.fullName,
      kind: traveller.ageBucket,
      id_type: traveller.idType,
      id_number: traveller.idNumber,
      meal_pref: traveller.mealPref,
      medical_notes: traveller.medicalNotes,
      checked_in_at: traveller.checkedInAt,
      position,
    }));

  const eventIds = new Set(before.timeline.map((event) => event.id));
  const events = after.timeline
    .filter((event) => !eventIds.has(event.id))
    .map((event) => ({
      id: event.id,
      kind: event.kind,
      label: event.label,
      detail: event.detail ?? null,
      amount_minor: event.amountMinor ?? null,
      created_at: event.createdAt,
    }));

  const reviewReply =
    after.review?.reply && after.review.reply !== before.review?.reply ? after.review.reply : null;

  return { patch, payments, travellers, events, reviewReply };
}

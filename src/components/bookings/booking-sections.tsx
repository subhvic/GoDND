"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  CircleAlert,
  Info,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Star,
  UserCheck,
} from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { RecordField, RecordSection } from "@/components/ui/record-drawer";
import { PAYMENT_METHOD_LABELS } from "@/lib/bookings/actions";
import {
  CANCEL_CATEGORY_LABELS,
  balanceMinor,
  completeTravellers,
  guestCount,
  lastDay,
  needsWrapUp,
  phaseForBooking,
  preDepartureChecklist,
  tripDay,
  type ChecklistItem,
} from "@/lib/bookings/phase";
import { formatClock, formatDay, formatDayRange, formatFullDateTime, formatRelativeDay } from "@/lib/time";
import type { BookingDetail, BookingEvent, BookingTraveller } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/*
 * The drawer's building blocks. Each takes the booking and "today" and
 * decides for itself what it shows in the booking's phase, so the drawer
 * composes them without branching on phase in a dozen places.
 */

const noon = (today: string) => new Date(`${today}T12:00:00+05:30`);
const money = (value: number, detail: BookingDetail) => formatMoney(value, detail.currency);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* ------------------------------------------------------------------------ */
/* Banner                                                                   */
/* ------------------------------------------------------------------------ */

type Tone = "info" | "warning" | "healthy" | "critical" | "neutral";

/**
 * One sentence on where the booking stands and what happens next — the
 * first thing read when the drawer opens, so the operator never has to
 * assemble the state from five sections.
 */
export function StateBanner({ detail, today }: { detail: BookingDetail; today: string }) {
  const phase = phaseForBooking(detail, today);
  const now = noon(today);
  const due = balanceMinor(detail);
  let tone: Tone = "info";
  let title: string;
  let body: string | null = null;

  switch (phase) {
    case "awaiting": {
      tone = "warning";
      title = `Awaiting payment — ${money(due, detail)} due`;
      if (detail.travelStart && detail.travelStart < today) {
        tone = "critical";
        body = "The departure date has passed without payment. Cancel this booking to release it.";
      } else {
        body = detail.balanceDueAt
          ? `Seats are held until ${formatDay(detail.balanceDueAt, now)}. Send a reminder, or record a payment made another way.`
          : "Seats are held until the guest pays. Send a reminder, or record a payment made another way.";
      }
      break;
    }
    case "upcoming": {
      const open = preDepartureChecklist(detail, today).filter((item) => !item.done && item.id !== "reminder");
      title = `Departs ${detail.travelStart ? formatRelativeDay(detail.travelStart, now) : "soon"}${detail.travelStart ? ` · ${formatDayRange(detail.travelStart, detail.travelEnd, now)}` : ""}`;
      tone = open.length ? "warning" : "healthy";
      const phrase: Record<string, string> = {
        payment: "the balance",
        travellers: "traveller details",
        permit: "the Inner Line Permit",
        briefing: "the trip briefing",
      };
      const names = open.map((item) => phrase[item.id] ?? item.label);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
      body = open.length
        ? `Still to sort before departure: ${list}.`
        : "Everything is ready for departure.";
      break;
    }
    case "ongoing": {
      const day = tripDay(detail, today);
      const checkedIn = detail.travellers.filter((traveller) => traveller.checkedInAt).length;
      title = `On trip — day ${day?.day ?? 1} of ${day?.of ?? 1}`;
      body = `Ends ${formatRelativeDay(lastDay(detail)!, now)} · ${checkedIn} of ${guestCount(detail)} checked in`;
      if (due > 0) {
        tone = "warning";
        body += ` · ${money(due, detail)} still due`;
      }
      break;
    }
    case "completed": {
      if (needsWrapUp(detail, today)) {
        tone = "warning";
        title = `Trip ended ${formatRelativeDay(lastDay(detail)!, now)} — close it out`;
        body =
          due > 0
            ? `Collect the ${money(due, detail)} balance, then close the trip to send ${firstName(detail.leadName)} a review request.`
            : `Closing marks it completed and sends ${firstName(detail.leadName)} a review request.`;
      } else {
        tone = "neutral";
        title = `Completed${detail.completedAt ? ` on ${formatDay(detail.completedAt, now)}` : ""}`;
        body = detail.review
          ? `${firstName(detail.leadName)} left a ${detail.review.rating}★ review${detail.review.reply ? " and you replied" : " — reply to it below"}.`
          : detail.reviewRequestedAt
            ? `Review requested ${formatRelativeDay(detail.reviewRequestedAt, now)}; nothing back yet.`
            : "No review requested yet.";
      }
      break;
    }
    case "cancelled": {
      const category = detail.cancellation ? CANCEL_CATEGORY_LABELS[detail.cancellation.category] : null;
      title = `Cancelled${detail.cancellation ? ` ${formatRelativeDay(detail.cancellation.cancelledAt, now)}` : ""}${category ? ` — ${category.toLowerCase()}` : ""}`;
      if (detail.refundOwedMinor > 0) {
        tone = "warning";
        body = detail.isMarketplace
          ? `${money(detail.refundOwedMinor, detail)} refund is being processed by GoDND — it reaches the guest in 5–7 working days.`
          : `${money(detail.refundOwedMinor, detail)} still to refund. Send it, then record it here.`;
      } else if (detail.refundedMinor > 0) {
        tone = "neutral";
        body = `${money(detail.refundedMinor, detail)} refunded${detail.paidMinor > detail.refundedMinor ? `; ${money(detail.paidMinor - detail.refundedMinor, detail)} kept under the policy` : ""}.`;
      } else {
        tone = "neutral";
        body = detail.paidMinor > 0 ? `${money(detail.paidMinor, detail)} kept under the cancellation policy.` : "No payment was taken.";
      }
      break;
    }
  }

  const Icon = tone === "warning" || tone === "critical" ? AlertTriangle : tone === "healthy" ? CheckCircle2 : Info;
  return (
    <div className={cn("booking-banner", tone)} role="status">
      <Icon aria-hidden />
      <div className="min-w-0">
        <p className="booking-banner-title">{title}</p>
        {body ? <p className="booking-banner-body">{body}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Tiles                                                                    */
/* ------------------------------------------------------------------------ */

type TileTone = "primary" | "healthy" | "warning" | "critical" | "neutral" | "info";

export function MoneyTiles({ detail, today }: { detail: BookingDetail; today: string }) {
  const phase = phaseForBooking(detail, today);
  const due = balanceMinor(detail);
  const net = detail.paidMinor - detail.refundedMinor - (detail.isMarketplace ? detail.commissionMinor : 0);
  let tiles: { label: string; value: string; tone: TileTone; note?: string }[];

  switch (phase) {
    case "ongoing": {
      const day = tripDay(detail, today);
      const checkedIn = detail.travellers.filter((traveller) => traveller.checkedInAt).length;
      const seats = guestCount(detail);
      tiles = [
        { label: "Trip", value: `Day ${day?.day ?? 1} of ${day?.of ?? 1}`, tone: "info" },
        { label: "Checked in", value: `${checkedIn} / ${seats}`, tone: checkedIn >= seats ? "healthy" : "warning" },
        due > 0
          ? { label: "Balance due", value: money(due, detail), tone: "warning", note: "Collect before the trip ends" }
          : { label: "Paid", value: money(detail.paidMinor, detail), tone: "healthy", note: "In full" },
      ];
      break;
    }
    case "completed":
      tiles = [
        { label: "Total", value: money(detail.totalMinor, detail), tone: "primary" },
        { label: "Paid", value: money(detail.paidMinor, detail), tone: due > 0 ? "warning" : "healthy", note: due > 0 ? `${money(due, detail)} still due` : undefined },
        detail.isMarketplace
          ? { label: "Your payout", value: money(net, detail), tone: "primary", note: `After ${money(detail.commissionMinor, detail)} commission` }
          : { label: "Collected", value: money(detail.paidMinor - detail.refundedMinor, detail), tone: "primary", note: "Paid to you directly" },
      ];
      break;
    case "cancelled":
      tiles = [
        { label: "Paid", value: money(detail.paidMinor, detail), tone: "primary" },
        { label: "Refunded", value: money(detail.refundedMinor, detail), tone: detail.refundedMinor > 0 ? "critical" : "neutral" },
        detail.refundOwedMinor > 0
          ? { label: "Refund owed", value: money(detail.refundOwedMinor, detail), tone: "warning", note: detail.isMarketplace ? "GoDND is processing it" : "Record it once sent" }
          : { label: "Kept", value: money(Math.max(detail.paidMinor - detail.refundedMinor, 0), detail), tone: "neutral" },
      ];
      break;
    default:
      tiles = [
        { label: "Total", value: money(detail.totalMinor, detail), tone: "primary" },
        { label: "Paid", value: money(detail.paidMinor, detail), tone: due === 0 ? "healthy" : detail.paidMinor > 0 ? "warning" : "neutral" },
        due > 0
          ? {
              label: phase === "awaiting" ? "Due now" : "Balance due",
              value: money(due, detail),
              tone: "warning",
              note: detail.balanceDueAt ? `By ${formatDay(detail.balanceDueAt, noon(today))}` : undefined,
            }
          : { label: "Balance", value: money(0, detail), tone: "neutral", note: "Paid in full" },
      ];
  }

  return (
    <section className="booking-tiles" aria-label="Summary">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0">
          <p className="booking-tile-label">{tile.label}</p>
          <p className={cn("booking-tile-value", tile.tone)}>{tile.value}</p>
          {tile.note ? <p className="booking-tile-note">{tile.note}</p> : null}
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Pre-departure checklist                                                  */
/* ------------------------------------------------------------------------ */

export function ChecklistSection({
  detail,
  today,
  onAction,
}: {
  detail: BookingDetail;
  today: string;
  onAction: (item: ChecklistItem["id"], extra?: "applied" | "issued") => void;
}) {
  const items = preDepartureChecklist(detail, today);
  const done = items.filter((item) => item.done).length;
  return (
    <RecordSection title={`Before departure · ${done} of ${items.length} done`}>
      <ul className="booking-checklist">
        {items.map((item) => (
          <li key={item.id} className={cn(item.done && "done")}>
            {item.done ? <CheckCircle2 aria-hidden className="check-done" /> : <Circle aria-hidden className="check-open" />}
            <div className="min-w-0 flex-1">
              <p className="booking-check-label">
                {item.label}
                <span className="sr-only">{item.done ? " — done" : " — to do"}</span>
              </p>
              <p className="booking-check-detail">{item.detail}</p>
            </div>
            {!item.done ? <ChecklistAction item={item} detail={detail} onAction={onAction} /> : null}
          </li>
        ))}
      </ul>
    </RecordSection>
  );
}

function ChecklistAction({
  item,
  detail,
  onAction,
}: {
  item: ChecklistItem;
  detail: BookingDetail;
  onAction: (item: ChecklistItem["id"], extra?: "applied" | "issued") => void;
}) {
  const small = buttonClass({ size: "small" });
  switch (item.id) {
    case "payment":
      return (
        <button type="button" className={small} onClick={() => onAction("payment")}>
          Collect
        </button>
      );
    case "travellers":
      return (
        <button type="button" className={small} onClick={() => onAction("travellers")}>
          Request details
        </button>
      );
    case "permit":
      return detail.permitStatus === "applied" ? (
        <button type="button" className={small} onClick={() => onAction("permit", "issued")}>
          Mark issued
        </button>
      ) : (
        <button type="button" className={small} onClick={() => onAction("permit", "applied")}>
          Mark applied
        </button>
      );
    case "briefing":
      return (
        <button type="button" className={small} onClick={() => onAction("briefing")}>
          Send
        </button>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Travellers                                                               */
/* ------------------------------------------------------------------------ */

const ID_LABELS: Record<NonNullable<BookingTraveller["idType"]>, string> = {
  aadhaar: "Aadhaar",
  passport: "Passport",
  voter: "Voter ID",
  dl: "Driving licence",
};

/**
 * The manifest: one line per seat booked, named or not. Empty seats are
 * shown as seats, so "4 guests, 2 named" is visible without counting.
 */
export function TravellersSection({
  detail,
  today,
  canEdit,
  onEdit,
  onAdd,
  onRequest,
  onCheckIn,
}: {
  detail: BookingDetail;
  today: string;
  canEdit: boolean;
  onEdit: (traveller: BookingTraveller) => void;
  onAdd: () => void;
  onRequest: () => void;
  onCheckIn?: (traveller: BookingTraveller) => void;
}) {
  const seats = guestCount(detail);
  const complete = completeTravellers(detail);
  const empty = Math.max(seats - detail.travellers.length, 0);
  const phase = phaseForBooking(detail, today);

  return (
    <RecordSection title={`Travellers · ${Math.min(complete, seats)} of ${seats} complete`}>
      <ul className="manifest">
        {detail.travellers.map((traveller, index) => {
          const missingId = traveller.ageBucket === "adult" && !(traveller.idType && traveller.idNumber);
          return (
            <li key={traveller.id} className="manifest-row">
              <span className="manifest-seat" aria-hidden>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="manifest-name">
                  {traveller.fullName}
                  {traveller.role === "lead" ? <span className="manifest-tag">Lead</span> : null}
                  {traveller.ageBucket !== "adult" ? (
                    <span className="manifest-tag">{traveller.ageBucket === "child" ? "Child" : "Infant"}</span>
                  ) : null}
                </p>
                <p className="manifest-meta">
                  {traveller.idType && traveller.idNumber ? (
                    <span>
                      {ID_LABELS[traveller.idType]} · {mask(traveller.idNumber)}
                    </span>
                  ) : missingId ? (
                    <span className="text-warning-fg">ID needed{detail.permitStatus !== "not_needed" ? " for the permit" : ""}</span>
                  ) : null}
                  {traveller.mealPref ? <span>{traveller.mealPref}</span> : null}
                  {traveller.medicalNotes ? (
                    <span className="text-critical-fg">
                      <CircleAlert aria-hidden />
                      {traveller.medicalNotes}
                    </span>
                  ) : null}
                </p>
              </div>
              {phase === "ongoing" ? (
                traveller.checkedInAt ? (
                  <span className="manifest-in" title={`Checked in ${formatFullDateTime(traveller.checkedInAt)}`}>
                    <UserCheck aria-hidden />
                    In · {formatClock(traveller.checkedInAt)}
                  </span>
                ) : onCheckIn ? (
                  <button
                    type="button"
                    className={buttonClass({ size: "small" })}
                    aria-label={`Check in ${traveller.fullName}`}
                    onClick={() => onCheckIn(traveller)}
                  >
                    Check in
                  </button>
                ) : null
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="manifest-edit"
                  aria-label={`Edit ${traveller.fullName}'s details`}
                  onClick={() => onEdit(traveller)}
                >
                  <Pencil aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
        {Array.from({ length: empty }, (_, index) => (
          <li key={`empty-${index}`} className="manifest-row empty">
            <span className="manifest-seat" aria-hidden>
              {detail.travellers.length + index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="manifest-name">Seat {detail.travellers.length + index + 1}</p>
              <p className="manifest-meta">
                <span>No details yet</span>
              </p>
            </div>
            {canEdit && index === 0 ? (
              <button
                type="button"
                className={buttonClass({ size: "small" })}
                aria-label={`Add a traveller to seat ${detail.travellers.length + index + 1}`}
                onClick={onAdd}
              >
                <Plus aria-hidden />
                Add
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit && (empty > 0 || complete < seats) ? (
        <div className="px-[16px] pb-[12px]">
          <button type="button" className={buttonClass({ size: "small" })} onClick={onRequest}>
            <MessageCircle aria-hidden />
            Ask {firstName(detail.leadName)} for the missing details
          </button>
        </div>
      ) : null}
    </RecordSection>
  );
}

/** "XXXX 4821" — enough to match a document, not enough to misuse it. */
function mask(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (compact.length <= 4) return value;
  return value.includes("X") ? value : `••••${compact.slice(-4)}`;
}

/* ------------------------------------------------------------------------ */
/* On the ground (ongoing)                                                  */
/* ------------------------------------------------------------------------ */

/**
 * What someone needs in an emergency, at the top: who is running the trip,
 * how to reach the group, and every medical or dietary note in one place.
 */
export function OnTheGroundSection({ detail }: { detail: BookingDetail }) {
  const notes = detail.travellers.filter((traveller) => traveller.medicalNotes || traveller.mealPref);
  const tel = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
  return (
    <RecordSection title="On the ground">
      <div className="ground">
        {detail.captain ? (
          <div className="ground-contact">
            <div className="min-w-0">
              <p className="ground-role">Trip captain</p>
              <p className="ground-name">{detail.captain.name}</p>
            </div>
            {detail.captain.phone ? (
              <a className={buttonClass({ size: "small" })} href={tel(detail.captain.phone)}>
                <Phone aria-hidden />
                {detail.captain.phone}
              </a>
            ) : null}
          </div>
        ) : null}
        {detail.leadPhone ? (
          <div className="ground-contact">
            <div className="min-w-0">
              <p className="ground-role">Lead guest</p>
              <p className="ground-name">{detail.leadName}</p>
            </div>
            <a className={buttonClass({ size: "small" })} href={tel(detail.leadPhone)}>
              <Phone aria-hidden />
              {detail.leadPhone}
            </a>
          </div>
        ) : null}
        {notes.length > 0 ? (
          <div className="ground-notes">
            <p className="ground-role">Medical & dietary</p>
            <ul>
              {notes.map((traveller) => (
                <li key={traveller.id}>
                  <span className="font-medium text-text-primary">{traveller.fullName}</span>
                  {traveller.medicalNotes ? <span className="text-critical-fg"> — {traveller.medicalNotes}</span> : null}
                  {traveller.mealPref ? <span className="text-text-secondary"> — {traveller.mealPref}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ground-empty">No medical or dietary notes for this group.</p>
        )}
      </div>
    </RecordSection>
  );
}

export function TripLogSection({ detail, onAdd }: { detail: BookingDetail; onAdd: () => void }) {
  const entries = detail.timeline
    .filter((event) => event.kind === "trip_update" || event.kind === "incident" || event.kind === "checked_in")
    .slice()
    .reverse();
  return (
    <RecordSection title="Trip log">
      <div className="px-[16px] pb-[12px]">
        {entries.length === 0 ? (
          <p className="ground-empty mb-[10px]">Nothing logged yet today.</p>
        ) : (
          <ol className="trip-log">
            {entries.map((event) => (
              <li key={event.id} className={cn(event.kind === "incident" && "incident")}>
                <p className="trip-log-head">
                  <span className="font-medium text-text-primary">{event.label}</span>
                  <time dateTime={event.createdAt}>{formatFullDateTime(event.createdAt)}</time>
                </p>
                {event.detail ? <p className="trip-log-body">{event.detail}</p> : null}
                {event.actor ? <p className="trip-log-by">— {event.actor}</p> : null}
              </li>
            ))}
          </ol>
        )}
        <button type="button" className={buttonClass({ size: "small" })} onClick={onAdd}>
          <Plus aria-hidden />
          Add trip update
        </button>
      </div>
    </RecordSection>
  );
}

/* ------------------------------------------------------------------------ */
/* Money, review, payout, cancellation                                      */
/* ------------------------------------------------------------------------ */

export function PaymentSection({ detail, today }: { detail: BookingDetail; today: string }) {
  const due = balanceMinor(detail);
  return (
    <RecordSection title="Payments">
      {detail.payments.length === 0 ? (
        <RecordField label="Transactions">
          <span className="text-text-muted">No payment yet</span>
        </RecordField>
      ) : (
        <RecordField label="Transactions">
          <ul className="payment-list">
            {detail.payments.map((payment) => (
              <li key={payment.id}>
                {payment.direction === "refund" ? (
                  <ArrowUpRight aria-hidden className="text-critical-fg" />
                ) : (
                  <ArrowDownLeft aria-hidden className="text-healthy-fg" />
                )}
                <span className={cn("font-medium", payment.direction === "refund" && "text-critical-fg")}>
                  {payment.direction === "refund" ? "−" : ""}
                  {money(payment.amountMinor, detail)}
                </span>
                <span className="text-text-muted">
                  {PAYMENT_METHOD_LABELS[payment.method]} · {formatDay(payment.createdAt, noon(today))}
                  {payment.reference ? <span className="payment-ref"> {payment.reference}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </RecordField>
      )}
      {due > 0 ? (
        <RecordField label="Balance due">
          <span className="text-warning-fg">{money(due, detail)}</span>
          {detail.balanceDueAt ? <span className="text-text-muted"> by {formatDay(detail.balanceDueAt, noon(today))}</span> : null}
        </RecordField>
      ) : null}
      {detail.isMarketplace && detail.commissionMinor > 0 ? (
        <RecordField label="Marketplace commission">
          {money(detail.commissionMinor, detail)}
          <span className="ml-[6px] text-text-muted">retained by GoDND — the rest is paid out to you</span>
        </RecordField>
      ) : null}
      <RecordField label="Collected by">
        {detail.isMarketplace ? "GoDND (marketplace booking)" : "You (booked on your website)"}
      </RecordField>
    </RecordSection>
  );
}

export function ReviewSection({
  detail,
  today,
  onReply,
  onRequest,
}: {
  detail: BookingDetail;
  today: string;
  onReply: () => void;
  onRequest: () => void;
}) {
  const review = detail.review;
  return (
    <RecordSection title="Review">
      <div className="px-[16px] pb-[14px]">
        {review ? (
          <div className="review">
            <p className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} aria-hidden className={cn(index < review.rating && "filled")} />
              ))}
              <span className="text-text-muted">{formatDay(review.createdAt, noon(today))}</span>
            </p>
            {review.title ? <p className="review-title">{review.title}</p> : null}
            {review.body ? <p className="review-body">{review.body}</p> : null}
            {review.reply ? (
              <div className="review-reply">
                <p className="review-reply-label">Your reply</p>
                <p className="review-body">{review.reply}</p>
              </div>
            ) : (
              <button type="button" className={buttonClass({ size: "small" })} onClick={onReply}>
                Reply publicly
              </button>
            )}
          </div>
        ) : detail.reviewRequestedAt ? (
          <p className="ground-empty">
            Review requested {formatRelativeDay(detail.reviewRequestedAt, noon(today))} — nothing back yet.{" "}
            <button type="button" className="inline-link" onClick={onRequest}>
              Send a reminder
            </button>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-[10px]">
            <p className="ground-empty">No review requested yet.</p>
            <button type="button" className={buttonClass({ size: "small" })} onClick={onRequest}>
              Request a review
            </button>
          </div>
        )}
      </div>
    </RecordSection>
  );
}

export function PayoutSection({ detail, today }: { detail: BookingDetail; today: string }) {
  if (!detail.isMarketplace) return null;
  const net = detail.paidMinor - detail.refundedMinor - detail.commissionMinor;
  const payout = detail.payout;
  return (
    <RecordSection title="Payout">
      <RecordField label="Paid by the guest">{money(detail.paidMinor - detail.refundedMinor, detail)}</RecordField>
      <RecordField label="GoDND commission">−{money(detail.commissionMinor, detail)}</RecordField>
      <RecordField label="Your payout">
        <span className="font-medium">{money(payout?.netMinor ?? net, detail)}</span>
      </RecordField>
      <RecordField label="Status">
        {payout?.status === "paid" ? (
          <span className="text-healthy-fg">
            Paid{payout.paidAt ? ` on ${formatDay(payout.paidAt, noon(today))}` : ""}
            {payout.reference ? ` · ${payout.reference}` : ""}
          </span>
        ) : payout?.status === "on_hold" ? (
          <span className="text-warning-fg">On hold — contact GoDND support</span>
        ) : (
          <span>In the next weekly payout (Mondays)</span>
        )}
      </RecordField>
    </RecordSection>
  );
}

export function CancellationSection({
  detail,
  onRefund,
}: {
  detail: BookingDetail;
  onRefund: () => void;
}) {
  const cancellation = detail.cancellation;
  if (!cancellation) return null;
  return (
    <RecordSection title="Cancellation">
      <RecordField label="Reason">
        {CANCEL_CATEGORY_LABELS[cancellation.category]}
        <span className="text-text-muted"> — {cancellation.reason}</span>
      </RecordField>
      <RecordField label="Cancelled">
        {formatFullDateTime(cancellation.cancelledAt)}
        {cancellation.by ? <span className="text-text-muted"> by {cancellation.by}</span> : null}
      </RecordField>
      <RecordField label="Refund">
        {detail.refundOwedMinor > 0 ? (
          <span className="flex flex-wrap items-center gap-[8px]">
            <span className="text-warning-fg">{money(detail.refundOwedMinor, detail)} owed</span>
            {detail.isMarketplace ? (
              <span className="text-text-muted">GoDND processes marketplace refunds (5–7 working days)</span>
            ) : (
              <button type="button" className={buttonClass({ size: "small" })} onClick={onRefund}>
                Record refund
              </button>
            )}
          </span>
        ) : detail.refundedMinor > 0 ? (
          <span>{money(detail.refundedMinor, detail)} refunded</span>
        ) : (
          <span className="text-text-muted">{detail.paidMinor > 0 ? "None under the policy" : "Nothing was paid"}</span>
        )}
      </RecordField>
    </RecordSection>
  );
}

export function TripSection({ detail, today }: { detail: BookingDetail; today: string }) {
  const now = noon(today);
  return (
    <RecordSection title="Trip">
      <RecordField label="Experience">
        {detail.experienceId ? (
          <Link href={`/dashboard/experiences/${detail.experienceId}/edit`} className="text-brand hover:underline">
            {detail.experienceTitle}
          </Link>
        ) : (
          detail.experienceTitle
        )}
      </RecordField>
      <RecordField label="Dates">
        {detail.travelStart ? formatDayRange(detail.travelStart, detail.travelEnd, now) : "—"}
        {detail.experienceSnapshot.durationDays ? (
          <span className="text-text-muted"> · {detail.experienceSnapshot.durationDays} days</span>
        ) : null}
      </RecordField>
      {detail.experienceSnapshot.location.length ? (
        <RecordField label="Where">{detail.experienceSnapshot.location.join(", ")}</RecordField>
      ) : null}
      <RecordField label="Group">
        {detail.adults} adult{detail.adults === 1 ? "" : "s"}
        {detail.children ? ` · ${detail.children} child${detail.children === 1 ? "" : "ren"}` : ""}
        {detail.infants ? ` · ${detail.infants} infant${detail.infants === 1 ? "" : "s"}` : ""}
      </RecordField>
      {detail.captain ? <RecordField label="Trip captain">{detail.captain.name}</RecordField> : null}
      <RecordField label="Booked">
        {formatDay(detail.createdAt, now)}{" "}
        <span className="text-text-muted">via {detail.isMarketplace ? "the GoDND marketplace" : "your website"}</span>
      </RecordField>
      <RecordField label="Contact">
        <span className="block">{detail.leadEmail ?? "No email"}</span>
        <span className="block">{detail.leadPhone ?? "No phone"}</span>
      </RecordField>
      {detail.enquiryId ? (
        <RecordField label="Enquiry">
          <Link href={`/dashboard/enquiries/${detail.enquiryId}`} className="text-brand hover:underline">
            Open the conversation that led to this booking
          </Link>
        </RecordField>
      ) : null}
      {detail.notes ? <RecordField label="Notes">{detail.notes}</RecordField> : null}
    </RecordSection>
  );
}

const EVENT_TONE: Record<BookingEvent["kind"], "brand" | "healthy" | "warning" | "critical" | "neutral" | "info"> = {
  created: "brand",
  payment_captured: "healthy",
  confirmed: "healthy",
  reminder_sent: "neutral",
  briefing_sent: "neutral",
  message_sent: "neutral",
  travellers_updated: "neutral",
  permit_updated: "info",
  dates_changed: "warning",
  checked_in: "healthy",
  trip_update: "info",
  incident: "warning",
  completed: "healthy",
  review_requested: "neutral",
  review_received: "healthy",
  review_replied: "neutral",
  cancelled: "critical",
  refund_pending: "warning",
  refunded: "critical",
  note: "neutral",
};

export function TimelineSection({ detail }: { detail: BookingDetail }) {
  const events = detail.timeline;
  return (
    <RecordSection title="Timeline" defaultOpen={false}>
      <ol className="booking-timeline">
        {events.map((event) => {
          const tone = EVENT_TONE[event.kind];
          return (
            <li key={event.id}>
              <span aria-hidden className={cn("booking-timeline-dot", tone)} />
              <div className="min-w-0 flex-1">
                <p className="booking-timeline-head">
                  <span className="font-medium text-text-primary">{event.label}</span>
                  {event.amountMinor != null ? (
                    <span className={event.amountMinor < 0 ? "text-critical-fg" : "text-healthy-fg"}>
                      {event.amountMinor < 0 ? "−" : ""}
                      {money(Math.abs(event.amountMinor), detail)}
                    </span>
                  ) : null}
                  <time dateTime={event.createdAt} className="text-text-muted">
                    {formatFullDateTime(event.createdAt)}
                  </time>
                </p>
                {event.detail || event.actor ? (
                  <p className="booking-timeline-detail">
                    {event.detail}
                    {event.actor ? <span className="text-text-muted">{event.detail ? " · " : ""}by {event.actor}</span> : null}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </RecordSection>
  );
}


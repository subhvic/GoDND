"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import {
  BadgeIndianRupee,
  MessageSquare,
  Receipt,
  RotateCcw,
} from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import {
  RecordDrawer,
  RecordField,
  RecordSection,
} from "@/components/ui/record-drawer";
import { StatusBadge } from "@/components/ui/status";
import { statusForBooking } from "@/lib/status";
import {
  BOOKING_STATUS_LABELS,
  type BookingDetail,
  type BookingEvent,
} from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

/*
 * Booking detail drawer, matching the ExperienceDrawer shape: a Suspense
 * boundary drives the initial load state so the fetch overlaps the drawer
 * opening; sections group the information by what an operator is trying to
 * answer when they open a row.
 */

export function BookingDrawer({
  detailPromise,
  onClose,
}: {
  detailPromise: Promise<BookingDetail | null>;
  onClose: () => void;
}) {
  return (
    <Suspense fallback={<LoadingDrawer onClose={onClose} />}>
      <DrawerContent promise={detailPromise} onClose={onClose} />
    </Suspense>
  );
}

function DrawerContent({
  promise,
  onClose,
}: {
  promise: Promise<BookingDetail | null>;
  onClose: () => void;
}) {
  const booking = use(promise);
  const close = (open: boolean) => {
    if (!open) onClose();
  };

  if (!booking) {
    return (
      <RecordDrawer open onOpenChange={close} title="Booking unavailable">
        <div className="p-[16px]">
          <Notice status="warning" title="This booking could not be loaded">
            It may have been removed, or you may no longer have access.
          </Notice>
        </div>
      </RecordDrawer>
    );
  }

  const status = statusForBooking(booking.status);
  const balanceMinor = Math.max(
    booking.totalMinor - booking.paidMinor - booking.refundedMinor,
    0,
  );
  const isRefundable =
    booking.paidMinor > booking.refundedMinor &&
    (booking.status === "paid" ||
      booking.status === "partially_paid" ||
      booking.status === "confirmed");
  const isCancellable =
    booking.status !== "cancelled" &&
    booking.status !== "refunded" &&
    booking.status !== "completed";

  return (
    <RecordDrawer
      open
      onOpenChange={close}
      title={booking.leadName}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
          <StatusBadge status={status} label={BOOKING_STATUS_LABELS[booking.status]} />
          <span>{booking.reference}</span>
          <span aria-hidden className="text-border-strong">·</span>
          <span>
            {booking.travelStart ? formatDate(booking.travelStart) : "No date"}
            {booking.travelEnd && booking.travelStart !== booking.travelEnd
              ? ` – ${formatDate(booking.travelEnd)}`
              : ""}
          </span>
          <span aria-hidden className="text-border-strong">·</span>
          <span>{booking.isMarketplace ? "Marketplace" : "Operator-direct"}</span>
        </span>
      }
      actions={
        <>
          {booking.leadEmail ? (
            <a
              href={`mailto:${booking.leadEmail}?subject=Your%20booking%20${booking.reference}`}
              className={buttonClass()}
            >
              <MessageSquare aria-hidden />
              Message guest
            </a>
          ) : (
            <button
              type="button"
              disabled
              className={buttonClass()}
              title="No guest email recorded"
            >
              <MessageSquare aria-hidden />
              Message guest
            </button>
          )}
          <button
            type="button"
            disabled={booking.paidMinor === 0}
            title={booking.paidMinor === 0 ? "Invoice is generated after the first payment" : undefined}
            className={buttonClass()}
          >
            <Receipt aria-hidden />
            View invoice
          </button>
          <button
            type="button"
            disabled={!isRefundable}
            title={isRefundable ? undefined : "Nothing to refund"}
            className={buttonClass({ variant: "danger" })}
          >
            <RotateCcw aria-hidden />
            Refund
          </button>
        </>
      }
    >
      {/* Money at a glance — the three numbers an operator scans for first. */}
      <section className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-[10px] border-b border-border-subtle bg-canvas px-[16px] py-[14px]">
        <MetricTile
          label="Total"
          value={formatMoney(booking.totalMinor, booking.currency)}
          tone="primary"
        />
        <MetricTile
          label="Paid"
          value={formatMoney(booking.paidMinor, booking.currency)}
          tone={booking.paidMinor >= booking.totalMinor ? "healthy" : "warning"}
        />
        <MetricTile
          label={booking.refundedMinor > 0 ? "Refunded" : "Balance due"}
          value={
            booking.refundedMinor > 0
              ? formatMoney(booking.refundedMinor, booking.currency)
              : formatMoney(balanceMinor, booking.currency)
          }
          tone={booking.refundedMinor > 0 ? "critical" : balanceMinor === 0 ? "neutral" : "warning"}
          note={
            balanceMinor > 0 && booking.refundedMinor === 0
              ? "Reminder fires 7 days before travel"
              : undefined
          }
        />
      </section>

      <RecordSection title="Trip">
        <RecordField label="Experience">
          {booking.experienceId ? (
            <Link
              href={`/dashboard/experiences/${booking.experienceId}/edit`}
              className="text-brand hover:underline"
            >
              {booking.experienceTitle}
            </Link>
          ) : (
            booking.experienceTitle
          )}
        </RecordField>
        <RecordField label="Departure">
          {booking.travelStart ? formatDate(booking.travelStart) : "—"}
          {booking.travelEnd ? ` – ${formatDate(booking.travelEnd)}` : ""}
        </RecordField>
        <RecordField label="Group">
          {booking.adults} adult{booking.adults === 1 ? "" : "s"}
          {booking.children ? ` · ${booking.children} child${booking.children === 1 ? "" : "ren"}` : ""}
          {booking.infants ? ` · ${booking.infants} infant${booking.infants === 1 ? "" : "s"}` : ""}
        </RecordField>
        <RecordField label="Booked">
          {formatDate(booking.createdAt)}{" "}
          <span className="text-text-muted">via {booking.isMarketplace ? "marketplace" : "own site"}</span>
        </RecordField>
      </RecordSection>

      <RecordSection title="Guest">
        <RecordField label="Lead">{booking.leadName}</RecordField>
        <RecordField label="Email">{booking.leadEmail ?? "—"}</RecordField>
        <RecordField label="Phone">{booking.leadPhone ?? "—"}</RecordField>
        {booking.guests.length > 1 ? (
          <RecordField label="Other travellers">
            <ul className="m-0 list-none space-y-[2px] p-0">
              {booking.guests
                .filter((guest) => guest.role !== "lead")
                .map((guest) => (
                  <li key={guest.id}>
                    {guest.fullName}{" "}
                    <span className="text-text-muted">
                      · {guest.ageBucket}
                    </span>
                  </li>
                ))}
            </ul>
          </RecordField>
        ) : null}
      </RecordSection>

      <RecordSection title="Payment">
        <RecordField label="Currency">{booking.currency}</RecordField>
        <RecordField label="Total">{formatMoney(booking.totalMinor, booking.currency)}</RecordField>
        <RecordField label="Paid">{formatMoney(booking.paidMinor, booking.currency)}</RecordField>
        {booking.refundedMinor > 0 ? (
          <RecordField label="Refunded">
            {formatMoney(booking.refundedMinor, booking.currency)}
          </RecordField>
        ) : null}
        {booking.isMarketplace && booking.commissionMinor > 0 ? (
          <RecordField label="Marketplace commission">
            {formatMoney(booking.commissionMinor, booking.currency)}
            <span className="ml-[6px] text-text-muted">
              (retained by GoDND — the rest is paid out to you)
            </span>
          </RecordField>
        ) : null}
        {booking.payments.length > 0 ? (
          <RecordField label="Transactions">
            <ul className="m-0 list-none space-y-[4px] p-0">
              {booking.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-baseline gap-x-[8px]">
                  <span>{formatMoney(payment.amountMinor, booking.currency)}</span>
                  <span className="text-text-muted">
                    · {payment.method.replace("_", " ")}
                    {payment.status !== "captured" ? ` · ${payment.status}` : ""}
                    · {formatDate(payment.createdAt)}
                    {payment.reference ? (
                      <span className="ml-[6px] font-mono text-[10.5px]">
                        {payment.reference}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </RecordField>
        ) : null}
      </RecordSection>

      <RecordSection title="Timeline">
        <ol className="m-0 list-none space-y-[8px] p-[16px] pt-[0]">
          {booking.timeline.map((event) => (
            <TimelineEntry key={event.id} event={event} currency={booking.currency} />
          ))}
        </ol>
      </RecordSection>

      {booking.cancellationReason ? (
        <RecordSection title="Cancellation">
          <RecordField label="Reason">{booking.cancellationReason}</RecordField>
        </RecordSection>
      ) : null}

      {isCancellable ? (
        <div className="px-[16px] py-[14px]">
          <Notice status="warning" title="Cancel this booking">
            Cancelling refunds the guest according to your cancellation policy
            and frees up the seats for other bookings. Not undoable.
          </Notice>
        </div>
      ) : null}
    </RecordDrawer>
  );
}

/* -------------------------------------------------------------------------- */

function MetricTile({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: "primary" | "healthy" | "warning" | "critical" | "neutral";
  note?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[.4px] text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "m-0 mt-[4px] truncate text-[16px] font-semibold",
          tone === "primary" && "text-text-primary",
          tone === "healthy" && "text-healthy-fg",
          tone === "warning" && "text-warning-fg",
          tone === "critical" && "text-critical-fg",
          tone === "neutral" && "text-text-primary",
        )}
      >
        {value}
      </p>
      {note ? <p className="m-0 mt-[2px] text-[10.5px] text-text-muted">{note}</p> : null}
    </div>
  );
}

const TIMELINE_TONE: Record<BookingEvent["kind"], "brand" | "healthy" | "warning" | "critical" | "neutral"> = {
  created: "brand",
  payment_captured: "healthy",
  confirmed: "healthy",
  reminder_sent: "neutral",
  checked_in: "healthy",
  completed: "healthy",
  cancelled: "critical",
  refunded: "critical",
  note: "neutral",
};

function TimelineEntry({
  event,
  currency,
}: {
  event: BookingEvent;
  currency: string;
}) {
  const tone = TIMELINE_TONE[event.kind];
  const amount =
    event.amountMinor != null ? formatMoney(event.amountMinor, currency) : null;
  return (
    <li className="flex items-start gap-[10px] text-[12px]">
      <span
        aria-hidden
        className={cn(
          "mt-[6px] size-[8px] shrink-0 rounded-full",
          tone === "brand" && "bg-brand",
          tone === "healthy" && "bg-healthy",
          tone === "warning" && "bg-warning",
          tone === "critical" && "bg-critical",
          tone === "neutral" && "bg-border-strong",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-baseline gap-x-[8px]">
          <span className="font-medium text-text-primary">{event.label}</span>
          {amount ? (
            <span
              className={cn(
                "text-[11.5px]",
                event.amountMinor && event.amountMinor < 0
                  ? "text-critical-fg"
                  : "text-healthy-fg",
              )}
            >
              {amount}
            </span>
          ) : null}
          <span className="text-[11px] text-text-muted">
            {formatDate(event.createdAt)}
          </span>
        </p>
        {event.detail ? (
          <p className="m-0 mt-[2px] text-[11.5px] leading-[1.5] text-text-secondary">
            {event.detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

function LoadingDrawer({ onClose }: { onClose: () => void }) {
  const close = (open: boolean) => {
    if (!open) onClose();
  };
  return (
    <RecordDrawer
      open
      onOpenChange={close}
      title={
        <span aria-hidden className="inline-block h-[16px] w-[180px] skeleton" />
      }
      subtitle={
        <span aria-hidden className="inline-block h-[12px] w-[240px] skeleton" />
      }
    >
      <div className="space-y-[10px] p-[16px]">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} aria-hidden className="skeleton h-[14px]" />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        <BadgeIndianRupee aria-hidden />
        Loading booking…
      </p>
    </RecordDrawer>
  );
}

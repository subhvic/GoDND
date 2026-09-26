"use client";

import { Suspense, use, useEffect, useState } from "react";
import {
  Ban,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardCopy,
  Flag,
  IndianRupee,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Phone,
  Receipt,
  RotateCcw,
  Send,
  Star,
  UserCheck,
  Wallet,
} from "lucide-react";
import { DropdownMenu as Menu } from "radix-ui";

import { performBookingAction } from "@/app/dashboard/bookings/actions";
import {
  CancelDialog,
  CheckInDialog,
  CloseOutDialog,
  DatesDialog,
  InvoiceDialog,
  PaymentDialog,
  RefundDialog,
  ReplyDialog,
  TravellerDialog,
  TripUpdateDialog,
} from "@/components/bookings/booking-dialogs";
import {
  CancellationSection,
  ChecklistSection,
  MoneyTiles,
  OnTheGroundSection,
  PaymentSection,
  PayoutSection,
  ReviewSection,
  StateBanner,
  TimelineSection,
  TravellersSection,
  TripLogSection,
  TripSection,
} from "@/components/bookings/booking-sections";
import { ShareDialog, type ShareMode } from "@/components/bookings/share-dialog";
import { buttonClass } from "@/components/ui/button";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSection } from "@/components/ui/dropdown-menu";
import { Notice } from "@/components/ui/notice";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { StatusBadge } from "@/components/ui/status";
import {
  applyBookingAction,
  canPerform,
  type BookingAction,
  type BookingActionDraft,
} from "@/lib/bookings/actions";
import { balanceMinor, markerForBooking, needsWrapUp, phaseForBooking } from "@/lib/bookings/phase";
import { newMessageId as newId } from "@/lib/enquiries/ids";
import { dayKey, formatDayRange } from "@/lib/time";
import type { BookingDetail, BookingTraveller } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Booking detail drawer. It answers, in order: where does this booking
 * stand (banner), what are the numbers (tiles), what should I do next (one
 * primary action), and everything else below. What it shows and offers
 * follows the booking's phase — see docs/BOOKING-JOURNEYS.md §3.
 *
 * The drawer keeps its own copy of the booking. An action applies to it at
 * once (the same rules the server runs), then the server confirms: live, its
 * fresh copy replaces ours; in a sample workspace ours is the record.
 * `onChange` hands every new copy to whoever owns the list.
 */

type DialogKey =
  | { kind: "share"; mode: ShareMode }
  | { kind: "payment" }
  | { kind: "refund" }
  | { kind: "cancel" }
  | { kind: "traveller"; traveller: BookingTraveller | null }
  | { kind: "dates" }
  | { kind: "checkin"; only: string | null }
  | { kind: "update" }
  | { kind: "closeout" }
  | { kind: "reply" }
  | { kind: "invoice" };

type ActionItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  href?: string;
};

export function BookingDrawer({
  detailPromise,
  onClose,
  onChange,
}: {
  detailPromise: Promise<BookingDetail | null>;
  onClose: () => void;
  onChange?: (detail: BookingDetail) => void;
}) {
  return (
    <Suspense fallback={<LoadingDrawer onClose={onClose} />}>
      <Loaded promise={detailPromise} onClose={onClose} onChange={onChange} />
    </Suspense>
  );
}

function Loaded({
  promise,
  onClose,
  onChange,
}: {
  promise: Promise<BookingDetail | null>;
  onClose: () => void;
  onChange?: (detail: BookingDetail) => void;
}) {
  const initial = use(promise);
  const close = (open: boolean) => {
    if (!open) onClose();
  };
  if (!initial) {
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
  return <BookingRecord initial={initial} onClose={onClose} onChange={onChange} />;
}

function BookingRecord({
  initial,
  onClose,
  onChange,
}: {
  initial: BookingDetail;
  onClose: () => void;
  onChange?: (detail: BookingDetail) => void;
}) {
  const [detail, setDetail] = useState(initial);
  const [dialog, setDialog] = useState<DialogKey | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [today] = useState(() => dayKey(new Date()));

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(timer);
  }, [flash]);

  const phase = phaseForBooking(detail, today);
  const marker = markerForBooking(detail, today);
  const due = balanceMinor(detail);
  const now = new Date(`${today}T12:00:00+05:30`);
  const first = detail.leadName.trim().split(/\s+/)[0];

  /** Apply at once, then confirm with the server; a refusal comes back as a sentence. */
  const run = async (draft: BookingActionDraft): Promise<string | null> => {
    const action = { ...draft, bookingId: detail.id, eventIds: [newId(), newId(), newId()] } as BookingAction;
    const local = applyBookingAction(detail, action, { now: new Date(), actor: "You" });
    if (!local.ok) return local.error;
    const previous = detail;
    setDetail(local.detail);
    onChange?.(local.detail);
    const result = await performBookingAction(action).catch(() => ({
      ok: false as const,
      error: "You're offline or the server didn't answer — nothing was saved.",
    }));
    if (!result.ok) {
      setDetail(previous);
      onChange?.(previous);
      return result.error;
    }
    if (result.detail) {
      setDetail(result.detail);
      onChange?.(result.detail);
    }
    return null;
  };

  const open = (next: DialogKey) => setDialog(next);
  const closeDialog = (value: boolean) => {
    if (!value) setDialog(null);
  };

  /* --- Actions by phase (docs/BOOKING-JOURNEYS.md §3) ------------------- */

  const item = {
    remind: { key: "remind", label: phase === "awaiting" ? "Send payment reminder" : "Collect balance", icon: <Send aria-hidden />, onSelect: () => open({ kind: "share", mode: "reminder" }) },
    record: { key: "record", label: "Record payment", icon: <Wallet aria-hidden />, onSelect: () => open({ kind: "payment" }) },
    briefing: { key: "briefing", label: "Send trip briefing", icon: <Send aria-hidden />, onSelect: () => open({ kind: "share", mode: "briefing" }) },
    message: { key: "message", label: "Message guest", icon: <MessageSquare aria-hidden />, onSelect: () => open({ kind: "share", mode: "message" }) },
    invoice: { key: "invoice", label: "View invoice", icon: <Receipt aria-hidden />, onSelect: () => open({ kind: "invoice" }) },
    checkin: { key: "checkin", label: "Check in guests", icon: <UserCheck aria-hidden />, onSelect: () => open({ kind: "checkin", only: null }) },
    update: { key: "update", label: "Add trip update", icon: <NotebookPen aria-hidden />, onSelect: () => open({ kind: "update" }) },
    call: detail.leadPhone
      ? { key: "call", label: `Call ${first}`, icon: <Phone aria-hidden />, onSelect: () => undefined, href: `tel:${detail.leadPhone.replace(/\s/g, "")}` }
      : null,
    closeOut: { key: "closeout", label: "Close out trip", icon: <CheckCircle2 aria-hidden />, onSelect: () => open({ kind: "closeout" }) },
    endEarly: { key: "endearly", label: "End trip early", icon: <Flag aria-hidden />, onSelect: () => open({ kind: "closeout" }) },
    requestReview: { key: "review", label: "Request review", icon: <Star aria-hidden />, onSelect: () => open({ kind: "share", mode: "review" }) },
    reply: { key: "reply", label: "Reply to review", icon: <Star aria-hidden />, onSelect: () => open({ kind: "reply" }) },
    dates: { key: "dates", label: "Change dates", icon: <CalendarRange aria-hidden />, onSelect: () => open({ kind: "dates" }) },
    cancel: { key: "cancel", label: "Cancel booking", icon: <Ban aria-hidden />, onSelect: () => open({ kind: "cancel" }), danger: true },
    refund: {
      key: "refund",
      label: detail.refundOwedMinor > 0 ? "Record refund" : "Issue refund",
      icon: <RotateCcw aria-hidden />,
      onSelect: () => open({ kind: "refund" }),
    },
    copy: {
      key: "copy",
      label: "Copy reference",
      icon: <ClipboardCopy aria-hidden />,
      onSelect: () => {
        void navigator.clipboard?.writeText(detail.reference).then(() => setFlash(`${detail.reference} copied`));
      },
    },
  } satisfies Record<string, ActionItem | null>;

  let primary: ActionItem | null = null;
  let secondary: (ActionItem | null)[] = [];
  let overflow: (ActionItem | null | false)[] = [];

  switch (phase) {
    case "awaiting":
      primary = item.remind;
      secondary = [item.message, item.record];
      overflow = [canPerform(detail, "change_dates", today) && item.dates, item.cancel, item.copy];
      break;
    case "upcoming":
      primary = due > 0 ? item.remind : !detail.briefingSentAt ? item.briefing : item.message;
      secondary = [primary === item.message ? null : item.message, item.invoice];
      overflow = [
        due > 0 && item.record,
        detail.briefingSentAt || due > 0 ? item.briefing : false,
        item.dates,
        item.cancel,
        detail.paidMinor > detail.refundedMinor && item.refund,
        item.copy,
      ];
      break;
    case "ongoing":
      primary = canPerform(detail, "check_in", today) ? item.checkin : item.update;
      secondary = [item.message, item.call];
      overflow = [
        primary === item.checkin && item.update,
        due > 0 && item.record,
        item.invoice,
        item.endEarly,
        item.cancel,
        item.copy,
      ];
      break;
    case "completed":
      if (needsWrapUp(detail, today)) primary = due > 0 ? item.record : item.closeOut;
      else if (detail.review && !detail.review.reply) primary = item.reply;
      else if (!detail.review && !detail.reviewRequestedAt) primary = item.requestReview;
      secondary = [item.message, item.invoice];
      overflow = [
        needsWrapUp(detail, today) && due > 0 && item.closeOut,
        !needsWrapUp(detail, today) && !detail.review && detail.reviewRequestedAt ? item.requestReview : false,
        detail.paidMinor > detail.refundedMinor && item.refund,
        item.copy,
      ];
      break;
    case "cancelled":
      primary = detail.refundOwedMinor > 0 && !detail.isMarketplace ? item.refund : null;
      secondary = [item.message, detail.paidMinor > 0 ? item.invoice : null];
      overflow = [item.copy];
      break;
  }

  const secondaryItems = secondary.filter((entry): entry is ActionItem => Boolean(entry) && entry !== primary);
  const overflowItems = overflow.filter((entry): entry is ActionItem => Boolean(entry));

  const common = { detail, today, run, onDone: setFlash };

  return (
    <RecordDrawer
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={detail.leadName}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
          <StatusBadge status={marker.status} label={marker.label} />
          <span>{detail.reference}</span>
          <span aria-hidden className="text-border-strong">·</span>
          <span className="inline-flex items-center gap-[4px]">
            <CalendarDays aria-hidden className="size-[12px]" />
            {detail.travelStart ? formatDayRange(detail.travelStart, detail.travelEnd, now) : "No date"}
          </span>
          <span aria-hidden className="text-border-strong">·</span>
          <span>{detail.isMarketplace ? "Marketplace" : "Own site"}</span>
        </span>
      }
      actions={
        <>
          {primary ? <ActionButton item={primary} variant="primary" /> : null}
          {secondaryItems.map((entry) => (
            <ActionButton key={entry.key} item={entry} className="booking-action-secondary" />
          ))}
          {overflowItems.length || secondaryItems.length ? (
            <Menu.Root>
              <Menu.Trigger
                className={buttonClass({
                  size: "icon",
                  className: cn("ml-auto", !overflowItems.length && "booking-menu-narrow-only"),
                })}
                aria-label="More actions"
              >
                <MoreHorizontal aria-hidden />
              </Menu.Trigger>
              <DropdownMenuContent align="end" className="w-[220px] min-w-0">
                {/* On a phone the secondary buttons don't fit beside the
                    primary one, so they move in here (bookings.css). */}
                {secondaryItems.length ? (
                  <div className="pop-sec booking-menu-narrow">
                    {secondaryItems.map((entry) => (
                      <MenuEntry key={entry.key} item={entry} />
                    ))}
                  </div>
                ) : null}
                {overflowItems.length ? (
                  <DropdownMenuSection>
                    {overflowItems.map((entry) => (
                      <MenuEntry key={entry.key} item={entry} />
                    ))}
                  </DropdownMenuSection>
                ) : null}
              </DropdownMenuContent>
            </Menu.Root>
          ) : null}
        </>
      }
    >
      <div className="booking-drawer-top">
        <StateBanner detail={detail} today={today} />
      </div>
      <MoneyTiles detail={detail} today={today} />

      {flash ? (
        <p className="booking-flash" role="status">
          <CheckCircle2 aria-hidden />
          {flash}
        </p>
      ) : (
        <p className="sr-only" role="status" />
      )}

      {phase === "upcoming" ? (
        <ChecklistSection
          detail={detail}
          today={today}
          onAction={(id, extra) => {
            if (id === "payment") open({ kind: "share", mode: "reminder" });
            if (id === "travellers") open({ kind: "share", mode: "details" });
            if (id === "briefing") open({ kind: "share", mode: "briefing" });
            if (id === "permit" && extra) {
              void run({ type: "set_permit", status: extra, note: null }).then((failed) =>
                setFlash(failed ?? (extra === "issued" ? "Permits marked issued" : "Permits marked applied")),
              );
            }
          }}
        />
      ) : null}

      {phase === "ongoing" ? (
        <>
          <OnTheGroundSection detail={detail} />
          <TripLogSection detail={detail} onAdd={() => open({ kind: "update" })} />
        </>
      ) : null}

      {phase === "completed" ? (
        <ReviewSection
          detail={detail}
          today={today}
          onReply={() => open({ kind: "reply" })}
          onRequest={() => open({ kind: "share", mode: "review" })}
        />
      ) : null}

      {phase === "cancelled" ? (
        <CancellationSection detail={detail} onRefund={() => open({ kind: "refund" })} />
      ) : null}

      {phase !== "cancelled" ? (
        <TravellersSection
          detail={detail}
          today={today}
          canEdit={canPerform(detail, "update_traveller", today) && phase !== "completed"}
          onEdit={(traveller) => open({ kind: "traveller", traveller })}
          onAdd={() => open({ kind: "traveller", traveller: null })}
          onRequest={() => open({ kind: "share", mode: "details" })}
          onCheckIn={(traveller) => open({ kind: "checkin", only: traveller.id })}
        />
      ) : null}

      <PaymentSection detail={detail} today={today} />
      {phase === "completed" ? <PayoutSection detail={detail} today={today} /> : null}
      <TripSection detail={detail} today={today} />
      <TimelineSection detail={detail} />

      {dialog?.kind === "share" ? (
        <ShareDialog mode={dialog.mode} open onOpenChange={closeDialog} {...common} />
      ) : null}
      {dialog?.kind === "payment" ? <PaymentDialog open onOpenChange={closeDialog} {...common} /> : null}
      {dialog?.kind === "refund" ? <RefundDialog open onOpenChange={closeDialog} {...common} /> : null}
      {dialog?.kind === "cancel" ? <CancelDialog open onOpenChange={closeDialog} {...common} /> : null}
      {dialog?.kind === "traveller" ? (
        <TravellerDialog open onOpenChange={closeDialog} traveller={dialog.traveller} detail={detail} run={run} onDone={setFlash} />
      ) : null}
      {dialog?.kind === "dates" ? <DatesDialog open onOpenChange={closeDialog} {...common} /> : null}
      {dialog?.kind === "checkin" ? (
        <CheckInDialog open onOpenChange={closeDialog} only={dialog.only} detail={detail} run={run} onDone={setFlash} />
      ) : null}
      {dialog?.kind === "update" ? <TripUpdateDialog open onOpenChange={closeDialog} {...common} /> : null}
      {dialog?.kind === "closeout" ? (
        <CloseOutDialog open onOpenChange={closeDialog} {...common} onCollect={() => setDialog({ kind: "payment" })} />
      ) : null}
      {dialog?.kind === "reply" ? <ReplyDialog open onOpenChange={closeDialog} detail={detail} run={run} onDone={setFlash} /> : null}
      {dialog?.kind === "invoice" ? <InvoiceDialog open onOpenChange={closeDialog} detail={detail} today={today} /> : null}
    </RecordDrawer>
  );
}

function MenuEntry({ item }: { item: ActionItem }) {
  const content = (
    <>
      {item.label}
      <span className="size-[14px] [&>svg]:size-[14px]">{item.icon}</span>
    </>
  );
  return item.href ? (
    <DropdownMenuItem asChild>
      <a href={item.href}>{content}</a>
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem danger={item.danger} onSelect={item.onSelect}>
      {content}
    </DropdownMenuItem>
  );
}

function ActionButton({ item, variant, className: extra }: { item: ActionItem; variant?: "primary"; className?: string }) {
  const className = buttonClass({ variant, className: extra });
  if (item.href) {
    return (
      <a href={item.href} className={className}>
        {item.icon}
        {item.label}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={item.onSelect}>
      {item.icon}
      {item.label}
    </button>
  );
}

function LoadingDrawer({ onClose }: { onClose: () => void }) {
  return (
    <RecordDrawer
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={<span aria-hidden className="inline-block h-[16px] w-[180px] skeleton" />}
      subtitle={<span aria-hidden className="inline-block h-[12px] w-[240px] skeleton" />}
    >
      <div className="space-y-[10px] p-[16px]">
        <div aria-hidden className="skeleton h-[56px]" />
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} aria-hidden className="skeleton h-[14px]" />
        ))}
      </div>
      <p className="sr-only" role="status">
        <IndianRupee aria-hidden />
        Loading booking…
      </p>
    </RecordDrawer>
  );
}

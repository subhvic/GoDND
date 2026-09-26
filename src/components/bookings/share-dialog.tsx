"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Field, TextArea } from "@/components/ui/field";
import type { BookingActionDraft } from "@/lib/bookings/actions";
import { balanceMinor, completeTravellers, guestCount } from "@/lib/bookings/phase";
import { formatDay, formatDayRange } from "@/lib/time";
import type { BookingDetail } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/**
 * Every message the drawer sends — a payment reminder, the trip briefing, a
 * request for traveller details, a review request, or just a message — goes
 * through here. The portal has no WhatsApp Business or outbound email yet,
 * so it prepares the message and opens the operator's own WhatsApp or mail
 * app with it filled in; the booking's timeline records that it went.
 */
export type ShareMode = "reminder" | "briefing" | "details" | "review" | "message";

const TITLES: Record<ShareMode, string> = {
  reminder: "Send a payment reminder",
  briefing: "Send the trip briefing",
  details: "Ask for traveller details",
  review: "Ask for a review",
  message: "Message the guest",
};

const EVENT: Record<ShareMode, { kind: "reminder_sent" | "briefing_sent" | "message_sent" | "review_requested"; label: string }> = {
  reminder: { kind: "reminder_sent", label: "Payment reminder sent" },
  briefing: { kind: "briefing_sent", label: "Trip briefing sent" },
  details: { kind: "message_sent", label: "Asked for traveller details" },
  review: { kind: "review_requested", label: "Review request sent" },
  message: { kind: "message_sent", label: "Messaged the guest" },
};

export function ShareDialog({
  mode,
  open,
  onOpenChange,
  detail,
  today,
  run,
  onDone,
}: {
  mode: ShareMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: BookingDetail;
  today: string;
  run: (draft: BookingActionDraft) => Promise<string | null>;
  onDone: (message: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={TITLES[mode]}
      description={`To ${detail.leadName}${detail.leadPhone ? ` · ${detail.leadPhone}` : ""}. It opens in your WhatsApp or email with the message ready — send it from there.`}
    >
      <ShareForm
        mode={mode}
        detail={detail}
        today={today}
        run={run}
        onSent={(message) => {
          onOpenChange(false);
          onDone(message);
        }}
      />
    </Dialog>
  );
}

function ShareForm({
  mode,
  detail,
  today,
  run,
  onSent,
}: {
  mode: ShareMode;
  detail: BookingDetail;
  today: string;
  run: (draft: BookingActionDraft) => Promise<string | null>;
  onSent: (message: string) => void;
}) {
  const due = balanceMinor(detail);
  const [amount, setAmount] = useState(String(Math.round(due / 100)));
  const amountMinor = (Number.parseInt(amount.replace(/\D/g, ""), 10) || 0) * 100;
  const [text, setText] = useState(() => template(mode, detail, today, amountMinor));
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textId = useId();

  const body = edited ? text : template(mode, detail, today, amountMinor);
  const digits = detail.leadPhone?.replace(/\D/g, "") ?? "";
  const subject = `${detail.experienceTitle} — ${detail.reference}`;

  const send = async (channel: "WhatsApp" | "email") => {
    if (!body.trim()) {
      setError("Write a message first.");
      return;
    }
    const failed = await run({
      type: "log",
      kind: EVENT[mode].kind,
      label: `${EVENT[mode].label} via ${channel}`,
      detail: mode === "reminder" ? `${formatMoney(amountMinor, detail.currency)} due` : null,
    });
    if (failed) {
      setError(failed);
      return;
    }
    onSent(`${EVENT[mode].label} — logged on the timeline`);
  };

  return (
    <div className="flex flex-col gap-[14px]">
      {mode === "reminder" ? (
        <Field label="Amount to ask for" hint={`${formatMoney(due, detail.currency)} is due in total`}>
          {({ id, describedBy }) => (
            <AffixInput
              id={id}
              prefix="₹"
              inputMode="numeric"
              describedBy={describedBy}
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
            />
          )}
        </Field>
      ) : null}

      <div className="field">
        <label htmlFor={textId} className="field-label">
          Message
        </label>
        <TextArea
          id={textId}
          rows={7}
          value={body}
          onChange={(event) => {
            setEdited(true);
            setText(event.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}
      </div>

      {mode === "message" && detail.enquiryId ? (
        <p className="text-[12px] text-text-secondary">
          This booking came from an enquiry —{" "}
          <Link href={`/dashboard/enquiries/${detail.enquiryId}`} className="text-brand hover:underline">
            continue that conversation in Enquiries
          </Link>
          .
        </p>
      ) : null}

      <div className="share-actions">
        {digits ? (
          <a
            className={buttonClass({ variant: "primary" })}
            href={`https://wa.me/${digits}?text=${encodeURIComponent(body)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void send("WhatsApp")}
          >
            <MessageCircle aria-hidden />
            Open in WhatsApp
          </a>
        ) : null}
        {detail.leadEmail ? (
          <a
            className={buttonClass({ variant: digits ? "default" : "primary" })}
            href={`mailto:${detail.leadEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            onClick={() => void send("email")}
          >
            <Mail aria-hidden />
            Open in email
          </a>
        ) : null}
        <button
          type="button"
          className={buttonClass()}
          onClick={() => {
            void navigator.clipboard?.writeText(body).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          <Copy aria-hidden />
          {copied ? "Copied" : "Copy text"}
        </button>
        {!digits && !detail.leadEmail ? (
          <p className="text-[12px] text-warning-fg">No phone or email on this booking — copy the text and send it another way.</p>
        ) : null}
      </div>
    </div>
  );
}

function template(mode: ShareMode, detail: BookingDetail, today: string, amountMinor: number): string {
  const first = detail.leadName.trim().split(/\s+/)[0];
  const now = new Date(`${today}T12:00:00+05:30`);
  const dates = detail.travelStart ? formatDayRange(detail.travelStart, detail.travelEnd, now) : "your dates";
  const trip = detail.experienceTitle;

  switch (mode) {
    case "reminder":
      return [
        `Hi ${first}, a quick reminder about your booking for ${trip} (${dates}, ref ${detail.reference}).`,
        `${formatMoney(amountMinor, detail.currency)} is due${detail.balanceDueAt ? ` by ${formatDay(detail.balanceDueAt, now)}` : ""}.`,
        "You can pay by UPI or bank transfer — reply here and I'll send the details. Let me know if anything has changed.",
      ].join("\n\n");
    case "briefing":
      return [
        `Hi ${first}! Your ${trip} starts ${detail.travelStart ? formatDay(detail.travelStart, now) : "soon"}.`,
        "Pickup: we'll confirm the exact point and time the evening before.",
        detail.captain ? `Your trip captain is ${detail.captain.name}${detail.captain.phone ? ` (${detail.captain.phone})` : ""}.` : null,
        `Bring: a photo ID for every traveller${detail.permitStatus !== "not_needed" ? " (needed at the permit checkpoint)" : ""}, comfortable walking shoes, a rain jacket and any personal medicines.`,
        "Any questions, just reply here.",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "details": {
      const seats = guestCount(detail);
      const missingNames = Math.max(seats - detail.travellers.length, 0);
      const missingIds = detail.travellers
        .filter((traveller) => traveller.ageBucket === "adult" && !(traveller.idType && traveller.idNumber))
        .map((traveller) => traveller.fullName);
      const lines = [
        missingNames > 0 ? `• full names and ages for the other ${missingNames} traveller${missingNames === 1 ? "" : "s"}` : null,
        missingIds.length ? `• a photo ID number (Aadhaar, passport, voter ID or licence) for ${missingIds.join(", ")}` : null,
        detail.permitStatus !== "not_needed" && completeTravellers(detail) < seats
          ? "• we need these to apply for the Inner Line Permits"
          : null,
        "• any food preferences or medical conditions we should know about",
      ].filter(Boolean);
      return [`Hi ${first}, to get everything ready for ${trip} (${dates}) we still need:`, lines.join("\n"), "Could you send these over when you get a moment?"].join("\n\n");
    }
    case "review":
      return [
        `Hi ${first}, thank you for travelling with us on ${trip}!`,
        "Would you rate the trip out of 5 and tell us in a few lines how it went? We read every one, and it helps other travellers choose.",
      ].join("\n\n");
    case "message":
      return `Hi ${first}, `;
  }
}

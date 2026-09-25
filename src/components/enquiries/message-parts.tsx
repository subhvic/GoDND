"use client";

import { Fragment } from "react";
import { CalendarDays, FileText, Lock, Users } from "lucide-react";

import {
  dayKey,
  formatFileSize,
  formatGroup,
  formatTravelDate,
} from "@/lib/enquiries/format";
import type { EnquiryAttachment, EnquiryQuote, EnquiryRow, EnquirySource } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/*
 * The pieces a thread is drawn from: message text, attachments, the quote
 * card and the enquiry card that opens every conversation.
 */

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

/**
 * Message text with line breaks kept and URLs made clickable. Plain string
 * splitting, never innerHTML — a traveller's message is untrusted input.
 */
export function MessageText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <p className="msg-text">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer nofollow">
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

export function Attachment({ attachment, now }: { attachment: EnquiryAttachment; now: Date }) {
  if (attachment.kind === "quote") return <QuoteCard quote={attachment} now={now} />;

  if (attachment.kind === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="msg-image"
        aria-label={`Open image ${attachment.name} in a new tab`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user uploads from arbitrary storage URLs; next/image would need every host allow-listed */}
        <img src={attachment.url} alt={attachment.name} loading="lazy" width={320} height={240} />
      </a>
    );
  }

  const size = formatFileSize(attachment.sizeBytes);
  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="msg-file">
      <FileText aria-hidden />
      <span className="min-w-0">
        <span className="msg-file-name">{attachment.name}</span>
        {size ? <span className="msg-file-size">{size}</span> : null}
      </span>
    </a>
  );
}

/**
 * A priced offer. Drawn as a document, not a chat bubble: it is the one
 * message both sides will come back to and quote numbers from, so it gets
 * the hierarchy of a receipt — what, when, who, then the total.
 */
export function QuoteCard({ quote, now }: { quote: EnquiryQuote; now: Date }) {
  const guests = quote.adults + quote.children + quote.infants;
  const perGuest = guests > 0 ? Math.round(quote.totalMinor / guests) : null;
  const expired = quote.validUntil ? quote.validUntil < dayKey(now) : false;

  return (
    <div className={cn("quote-card", expired && "expired")}>
      <div className="quote-head">
        <span className="quote-kicker">Quote</span>
        {quote.validUntil ? (
          <span className={cn("quote-valid", expired && "expired")}>
            {expired ? "Expired" : "Valid until"} {formatTravelDate(quote.validUntil, now)}
          </span>
        ) : null}
      </div>
      <p className="quote-title">{quote.experienceTitle}</p>
      <p className="quote-meta">
        {quote.startDate ? (
          <span>
            <CalendarDays aria-hidden />
            {formatTravelDate(quote.startDate, now)}
          </span>
        ) : null}
        <span>
          <Users aria-hidden />
          {formatGroup(quote.adults, quote.children, quote.infants)}
        </span>
      </p>
      <div className="quote-total">
        <span className="quote-total-label">Total</span>
        <span className="quote-total-value">{formatMoney(quote.totalMinor, quote.currency)}</span>
      </div>
      {perGuest ? (
        <p className="quote-per">{formatMoney(perGuest, quote.currency)} per guest</p>
      ) : null}
      {quote.note ? <p className="quote-note">{quote.note}</p> : null}
    </div>
  );
}

/**
 * The enquiry itself, pinned as the first message of the thread: what the
 * traveller asked for in structured form, then their words. Every later
 * reply is read against it, so it never scrolls off into a side panel only.
 */
const LOGGED_FROM: Partial<Record<EnquirySource, string>> = {
  phone: "Logged by your team after a phone call",
  whatsapp: "Logged by your team from WhatsApp",
  manual: "Logged by your team",
  referral: "Logged by your team from a referral",
};

export function RequestCard({ row, now, hasNotes }: { row: EnquiryRow; now: Date; hasNotes: boolean }) {
  const logged = LOGGED_FROM[row.source];
  return (
    <div className="request-card">
      <div className="request-head">
        <span className="quote-kicker">Enquiry</span>
        <span className="request-ref">{row.reference}</span>
      </div>
      <dl className="request-facts">
        <div>
          <dt>Trip</dt>
          <dd>{row.experienceTitle ?? "Not decided yet"}</dd>
        </div>
        <div>
          <dt>Dates</dt>
          <dd>
            {row.preferredStart ? formatTravelDate(row.preferredStart, now) : "No dates yet"}
            {row.flexibleDates ? <span className="text-text-muted"> · flexible</span> : null}
          </dd>
        </div>
        <div>
          <dt>Group</dt>
          <dd>{formatGroup(row.adults, row.children, row.infants)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{row.budgetMinor ? formatMoney(row.budgetMinor, row.currency) : "Not shared"}</dd>
        </div>
      </dl>
      {row.message ? (
        <MessageText text={row.message} />
      ) : (
        <p className="request-empty">
          {logged
            ? `${logged}${hasNotes ? " — the notes below have the details." : "."}`
            : "No message was left with this enquiry."}
        </p>
      )}
    </div>
  );
}

export function NoteLabel({ name }: { name: string | null }) {
  return (
    <span className="note-label">
      <Lock aria-hidden />
      Internal note{name ? ` · ${name}` : ""}
    </span>
  );
}

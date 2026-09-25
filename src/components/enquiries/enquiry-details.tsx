"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";

import type { ThreadData } from "@/components/enquiries/inbox-provider";
import {
  formatFullDateTime,
  formatGroup,
  formatTravelDate,
  formatWaitingLong,
  minutesSince,
} from "@/lib/enquiries/format";
import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  type EnquiryPriority,
  type EnquiryQuote,
  type EnquiryRow,
  type EnquiryStatus,
  type TeamMember,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Everything about the enquiry that isn't the conversation: who is handling
 * it and at what stage, what was asked for, how to reach the traveller, and
 * how fast the team answered. Docked beside the thread on a wide screen,
 * a sheet everywhere else — the same component either way.
 *
 * Controls are native selects: on a phone they open the platform picker,
 * which is faster and more accessible than any custom listbox.
 */
export function EnquiryDetails({
  row,
  thread,
  team,
  you,
  now,
  onStage,
  onAssign,
  onPriority,
}: {
  row: EnquiryRow;
  thread: ThreadData;
  team: TeamMember[];
  you: TeamMember | null;
  now: Date;
  onStage: (status: EnquiryStatus) => void;
  onAssign: (assigneeId: string | null) => void;
  onPriority: (priority: EnquiryPriority) => void;
}) {
  const firstReply = thread.messages.find(
    (message) => message.senderKind === "agent" && !message.isInternal,
  );
  const quotes = thread.messages
    .flatMap((message) => message.attachments)
    .filter((attachment): attachment is EnquiryQuote => attachment.kind === "quote");
  const latestQuote = quotes.at(-1);
  const phoneDigits = row.contactPhone?.replace(/\D/g, "") ?? "";
  // Rendered twice at some widths (docked panel and phone sheet), so ids
  // must be per instance or a label would point at the hidden copy.
  const uid = useId();

  return (
    <div className="details">
      <DetailsSection title="Handling">
        <div className="details-control">
          <label htmlFor={`${uid}-stage`} className="details-label">
            Stage
          </label>
          <select
            id={`${uid}-stage`}
            className="select has-value"
            value={row.status}
            onChange={(event) => onStage(event.target.value as EnquiryStatus)}
          >
            {ENQUIRY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ENQUIRY_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="details-control">
          <label htmlFor={`${uid}-assignee`} className="details-label">
            Assigned to
          </label>
          <select
            id={`${uid}-assignee`}
            className="select has-value"
            value={row.assignee?.id ?? ""}
            onChange={(event) => onAssign(event.target.value || null)}
          >
            <option value="">Unassigned</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.id === you?.id ? " (you)" : ""} · {member.role}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="details-control">
          <legend className="details-label">Priority</legend>
          <div className="seg-toggle details-seg">
            {(["low", "normal", "high"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn("seg", row.priority === value && "active")}
                aria-pressed={row.priority === value}
                onClick={() => onPriority(value)}
              >
                {value === "low" ? "Low" : value === "normal" ? "Normal" : "High"}
              </button>
            ))}
          </div>
        </fieldset>

        {row.status === "lost" && thread.lostReason ? (
          <Fact label="Lost because">{thread.lostReason}</Fact>
        ) : null}
        {thread.booking ? (
          <Fact label="Booking">
            <Link href={`/dashboard/bookings?q=${encodeURIComponent(thread.booking.reference)}`} className="details-link">
              {thread.booking.reference}
            </Link>
          </Fact>
        ) : null}
      </DetailsSection>

      <DetailsSection title="Trip request">
        <Fact label="Experience">
          {row.experienceTitle ?? <span className="text-text-muted">Not decided yet</span>}
        </Fact>
        <Fact label="Dates">
          {row.preferredStart ? formatTravelDate(row.preferredStart, now) : <span className="text-text-muted">No dates yet</span>}
          {row.flexibleDates ? <span className="text-text-muted"> · flexible</span> : null}
        </Fact>
        <Fact label="Group">{formatGroup(row.adults, row.children, row.infants)}</Fact>
        <Fact label="Budget">
          {row.budgetMinor ? formatMoney(row.budgetMinor, row.currency) : <span className="text-text-muted">Not shared</span>}
        </Fact>
        {latestQuote ? (
          <Fact label={quotes.length > 1 ? `Latest of ${quotes.length} quotes` : "Quoted"}>
            {formatMoney(latestQuote.totalMinor, latestQuote.currency)}
            {latestQuote.validUntil ? (
              <span className="text-text-muted"> · valid until {formatTravelDate(latestQuote.validUntil, now)}</span>
            ) : null}
          </Fact>
        ) : null}
      </DetailsSection>

      <DetailsSection title="Contact">
        <Fact label="Name">{row.contactName}</Fact>
        <Fact label="Email">
          {row.contactEmail ? (
            <span className="details-contact">
              <a href={`mailto:${row.contactEmail}`} className="details-link truncate">
                {row.contactEmail}
              </a>
              <CopyButton value={row.contactEmail} label="email" />
            </span>
          ) : (
            <span className="text-text-muted">Not given</span>
          )}
        </Fact>
        <Fact label="Phone">
          {row.contactPhone ? (
            <span className="details-contact">
              <span className="truncate">{row.contactPhone}</span>
              <CopyButton value={row.contactPhone} label="phone number" />
            </span>
          ) : (
            <span className="text-text-muted">Not given</span>
          )}
        </Fact>
        {row.contactPhone || row.contactEmail ? (
          <div className="details-quick">
            {row.contactPhone ? (
              <a className="details-quick-btn" href={`tel:${row.contactPhone.replace(/\s/g, "")}`}>
                <Phone aria-hidden />
                Call
              </a>
            ) : null}
            {row.contactPhone ? (
              <a className="details-quick-btn" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden />
                WhatsApp
              </a>
            ) : null}
            {row.contactEmail ? (
              <a className="details-quick-btn" href={`mailto:${row.contactEmail}?subject=${encodeURIComponent(`Your enquiry ${row.reference}`)}`}>
                <Mail aria-hidden />
                Email
              </a>
            ) : null}
          </div>
        ) : null}
        <Fact label="Gets replies">
          {row.hasAccount
            ? "In the GoDND app and by email"
            : row.contactEmail
              ? "By email"
              : <span className="text-critical-fg">Not in chat — phone only</span>}
        </Fact>
      </DetailsSection>

      <DetailsSection title="Activity">
        <Fact label="Received">
          <time dateTime={row.createdAt}>{formatFullDateTime(row.createdAt)}</time>
        </Fact>
        <Fact label="Source">{ENQUIRY_SOURCE_LABELS[row.source]}</Fact>
        <Fact label="First reply">
          {firstReply ? (
            `${formatWaitingLong(Math.max(1, minutesSince(row.createdAt, new Date(firstReply.createdAt))))} after it arrived`
          ) : (
            <span className="text-warning-fg">
              Not yet — {formatWaitingLong(minutesSince(row.createdAt, now))} so far
            </span>
          )}
        </Fact>
        <Fact label="Reference">
          <span className="details-contact">
            <span>{row.reference}</span>
            <CopyButton value={row.reference} label="reference" />
          </span>
        </Fact>
        {row.experienceId ? (
          <Fact label="Listing">
            <Link href={`/dashboard/experiences/${row.experienceId}/edit`} className="details-link inline-flex items-center gap-[4px]">
              Open experience
              <ExternalLink aria-hidden className="size-[12px]" />
            </Link>
          </Fact>
        ) : null}
      </DetailsSection>
    </div>
  );
}

function DetailsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="details-section" aria-label={title}>
      <h3 className="details-title">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="details-fact">
      <span className="details-label">{label}</span>
      <span className="details-value">{children}</span>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className="details-copy"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => undefined);
      }}
    >
      {copied ? <Check aria-hidden className="text-healthy-fg" /> : <Copy aria-hidden />}
    </button>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, MessagesSquare } from "lucide-react";

import { useInbox } from "@/components/enquiries/inbox-provider";
import { useInboxQuery } from "@/components/enquiries/use-inbox-query";
import { buttonClass } from "@/components/ui/button";
import { formatWaitingLong, minutesSince } from "@/lib/enquiries/format";
import { sortForView, viewForEnquiry } from "@/lib/enquiries/views";
import { REPLY_OVERDUE_MINUTES, REPLY_TARGET_MINUTES } from "@/lib/status";

/**
 * The thread pane before a conversation is picked. Instead of "select a
 * conversation" over an empty panel, it answers the question the operator
 * came with — how much is waiting, and how long the oldest has waited — and
 * offers the one obvious next step.
 */
export function InboxOverview() {
  const { rows, now } = useInbox();
  const { queryString } = useInboxQuery();

  const waiting = sortForView(
    rows.filter((row) => viewForEnquiry(row) === "needs_reply"),
    "needs_reply",
  );
  const oldest = waiting[0];
  const overdue = waiting.filter(
    (row) => row.awaitingReplySince && minutesSince(row.awaitingReplySince, now) >= REPLY_OVERDUE_MINUTES,
  ).length;

  if (!oldest) {
    return (
      <div className="inbox-overview">
        <span className="inbox-empty-icon healthy">
          <CheckCircle2 aria-hidden />
        </span>
        <h2 className="inbox-overview-title">Inbox zero</h2>
        <p className="inbox-overview-desc">
          Nobody is waiting on a reply. Pick a conversation on the left to
          follow up, or log an enquiry that came in by phone.
        </p>
      </div>
    );
  }

  const oldestWait = formatWaitingLong(minutesSince(oldest.awaitingReplySince ?? oldest.createdAt, now));

  return (
    <div className="inbox-overview">
      <span className="inbox-empty-icon">
        <MessagesSquare aria-hidden />
      </span>
      <h2 className="inbox-overview-title">
        {waiting.length} {waiting.length === 1 ? "traveller is" : "travellers are"} waiting on a reply
      </h2>
      <p className="inbox-overview-desc">
        {oldest.contactName} has waited longest — {oldestWait}.
        {overdue > 0
          ? ` ${overdue} ${overdue === 1 ? "is" : "are"} past a day; leads that old usually book elsewhere.`
          : ` Replies inside ${REPLY_TARGET_MINUTES / 60} hours convert best.`}
      </p>
      <Link
        href={`/dashboard/enquiries/${encodeURIComponent(oldest.id)}${queryString}`}
        className={buttonClass({ variant: "primary", className: "mt-[16px]" })}
      >
        Reply to {oldest.contactName.split(" ")[0]}
        <ArrowRight aria-hidden />
      </Link>
    </div>
  );
}

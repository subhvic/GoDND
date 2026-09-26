"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock, Inbox, RotateCcw, Trash2 } from "lucide-react";

import type { Delivery } from "@/components/enquiries/inbox-provider";
import { Attachment, MessageText, NoteLabel, RequestCard } from "@/components/enquiries/message-parts";
import {
  dayKey,
  formatClock,
  formatDayDivider,
  formatFullDateTime,
} from "@/lib/enquiries/format";
import { ENQUIRY_SOURCE_LABELS, type EnquiryMessage, type EnquiryRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * The thread: a timeline of day dividers, grouped messages, history events
 * and an unread marker, plus the scrolling rules a chat has to get right.
 *
 *   - Opens at the first unread message, or at the bottom.
 *   - Your own send always scrolls to it.
 *   - Someone else's message scrolls into view only if you were already at
 *     the bottom; otherwise a "new message" pill appears instead of yanking
 *     the page away from what you were reading.
 *   - Content that changes height (an image loading, the composer growing,
 *     the phone keyboard opening) keeps you pinned to the bottom if you were
 *     there.
 */

type Side = "in" | "out" | "note";

type TimelineItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "unread"; key: string; count: number }
  | { kind: "received"; key: string }
  | { kind: "request"; key: string }
  | { kind: "event"; key: string; message: EnquiryMessage }
  | { kind: "group"; key: string; side: Side; senderId: string | null; senderName: string | null; messages: EnquiryMessage[] };

/** Consecutive messages from one sender within this window share a group. */
const GROUP_WINDOW_MS = 5 * 60_000;

function buildTimeline(
  row: EnquiryRow,
  messages: EnquiryMessage[],
  unreadAtOpen: number,
  now: Date,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let lastDay: string | null = null;
  let group: Extract<TimelineItem, { kind: "group" }> | null = null;

  const closeGroup = () => {
    if (group) items.push(group);
    group = null;
  };
  const dayBreak = (timestamp: string) => {
    const key = dayKey(timestamp);
    if (key === lastDay) return;
    closeGroup();
    lastDay = key;
    items.push({ kind: "divider", key: `day-${key}`, label: formatDayDivider(timestamp, now) });
  };

  // Where the "new messages" line goes: before the oldest of the messages
  // that were unread when the thread was opened. If more were unread than
  // there are traveller messages, the enquiry itself was unread.
  const fromTraveller = messages.filter((message) => message.senderKind === "traveller" && !message.isInternal);
  let unreadFrom: string | null = null;
  if (unreadAtOpen > 0) {
    unreadFrom =
      unreadAtOpen > fromTraveller.length
        ? "request"
        : fromTraveller[fromTraveller.length - unreadAtOpen].id;
  }

  dayBreak(row.createdAt);
  items.push({ kind: "received", key: "received" });
  if (unreadFrom === "request") items.push({ kind: "unread", key: "unread", count: unreadAtOpen });
  items.push({ kind: "request", key: "request" });

  for (const message of messages) {
    dayBreak(message.createdAt);
    if (message.id === unreadFrom) {
      closeGroup();
      items.push({ kind: "unread", key: "unread", count: unreadAtOpen });
    }
    if (message.senderKind === "system") {
      closeGroup();
      items.push({ kind: "event", key: message.id, message });
      continue;
    }

    const side: Side = message.isInternal ? "note" : message.senderKind === "agent" ? "out" : "in";
    const current = group as Extract<TimelineItem, { kind: "group" }> | null;
    const previous = current?.messages[current.messages.length - 1];
    const continues =
      current &&
      previous &&
      current.side === side &&
      current.senderId === message.senderId &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_WINDOW_MS;

    if (continues && current) {
      current.messages.push(message);
    } else {
      closeGroup();
      group = {
        kind: "group",
        key: `group-${message.id}`,
        side,
        senderId: message.senderId,
        senderName: message.senderName,
        messages: [message],
      };
    }
  }
  closeGroup();
  return items;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MessageList({
  row,
  messages,
  delivery,
  unreadAtOpen,
  now,
  youId,
  onRetry,
  onDiscard,
}: {
  row: EnquiryRow;
  messages: EnquiryMessage[];
  delivery: Record<string, Delivery>;
  unreadAtOpen: number;
  now: Date;
  youId: string | null;
  onRetry: (messageId: string) => void;
  onDiscard: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const seen = useRef(messages.length);
  const [newBelow, setNewBelow] = useState(0);
  const [farFromBottom, setFarFromBottom] = useState(false);

  const items = useMemo(
    () => buildTimeline(row, messages, unreadAtOpen, now),
    [row, messages, unreadAtOpen, now],
  );

  // The last reply the traveller can see — where "Seen" or "Sent" goes.
  const lastPublicReplyId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.senderKind === "agent" && !message.isInternal) return message.id;
    }
    return null;
  }, [messages]);

  const hasNotes = messages.some((message) => message.isInternal && message.senderKind !== "system");

  const scrollToBottom = (smooth: boolean) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  };

  // Initial position, before paint: the unread line if there is one.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const marker = element.querySelector<HTMLElement>("[data-unread-marker]");
    if (marker) {
      element.scrollTop = Math.max(marker.offsetTop - 24, 0);
      atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    } else {
      element.scrollTop = element.scrollHeight;
      atBottom.current = true;
    }
  }, []);

  // New messages after the first render.
  useEffect(() => {
    if (messages.length <= seen.current) {
      seen.current = messages.length;
      return;
    }
    const added = messages.slice(seen.current);
    seen.current = messages.length;
    const mine = added.some((message) => message.senderKind === "agent" && message.senderId === youId);
    const fromOthers = added.filter((message) => message.senderKind === "traveller").length;

    if (mine || atBottom.current) {
      requestAnimationFrame(() => scrollToBottom(true));
    } else if (fromOthers > 0) {
      setNewBelow((count) => count + fromOthers);
    }
  }, [messages, youId]);

  // Height changes (images, composer growth, the keyboard) keep the bottom pinned.
  useEffect(() => {
    const element = scrollRef.current;
    const inner = innerRef.current;
    if (!element || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    atBottom.current = distance < 80;
    setFarFromBottom(distance > 480);
    if (atBottom.current && newBelow > 0) setNewBelow(0);
  };

  return (
    <div className="thread-scroll-wrap">
      <div ref={scrollRef} className="thread-scroll" onScroll={onScroll}>
        <div
          ref={innerRef}
          className="thread-inner"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={`Conversation with ${row.contactName}`}
        >
          {items.map((item) => {
            switch (item.kind) {
              case "divider":
                return (
                  <div key={item.key} className="day-divider" role="separator">
                    <span>{item.label}</span>
                  </div>
                );
              case "unread":
                return (
                  <div key={item.key} className="unread-marker" data-unread-marker role="separator">
                    <span>
                      {item.count} new {item.count === 1 ? "message" : "messages"}
                    </span>
                  </div>
                );
              case "received":
                return (
                  <p key={item.key} className="thread-event">
                    <Inbox aria-hidden />
                    <span>
                      {row.source === "manual" || row.source === "phone"
                        ? "Enquiry logged"
                        : "Enquiry received"}{" "}
                      via {ENQUIRY_SOURCE_LABELS[row.source]}
                    </span>
                    <time dateTime={row.createdAt} title={formatFullDateTime(row.createdAt)}>
                      {formatClock(row.createdAt)}
                    </time>
                  </p>
                );
              case "request":
                return (
                  <div key={item.key} className="msg-group in">
                    <RequestCard row={row} now={now} hasNotes={hasNotes} />
                    <div className="msg-foot">
                      <span>{row.contactName}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={row.createdAt} title={formatFullDateTime(row.createdAt)}>
                        {formatClock(row.createdAt)}
                      </time>
                    </div>
                  </div>
                );
              case "event":
                return (
                  <p key={item.key} className="thread-event">
                    <span className="thread-event-dot" aria-hidden />
                    <span>
                      {item.message.body}
                      {item.message.senderName ? (
                        <span className="text-text-muted"> · {item.message.senderId === youId ? "you" : item.message.senderName}</span>
                      ) : null}
                    </span>
                    <time dateTime={item.message.createdAt} title={formatFullDateTime(item.message.createdAt)}>
                      {formatClock(item.message.createdAt)}
                    </time>
                  </p>
                );
              case "group":
                return (
                  <MessageGroup
                    key={item.key}
                    group={item}
                    delivery={delivery}
                    youId={youId}
                    now={now}
                    lastPublicReplyId={lastPublicReplyId}
                    onRetry={onRetry}
                    onDiscard={onDiscard}
                  />
                );
            }
          })}
        </div>
      </div>

      {newBelow > 0 || farFromBottom ? (
        <button
          type="button"
          className={cn("jump-latest", newBelow > 0 && "has-new")}
          onClick={() => {
            setNewBelow(0);
            scrollToBottom(true);
          }}
        >
          <ArrowDown aria-hidden />
          {newBelow > 0 ? `${newBelow} new ${newBelow === 1 ? "message" : "messages"}` : "Latest"}
        </button>
      ) : null}
    </div>
  );
}

function MessageGroup({
  group,
  delivery,
  youId,
  now,
  lastPublicReplyId,
  onRetry,
  onDiscard,
}: {
  group: Extract<TimelineItem, { kind: "group" }>;
  delivery: Record<string, Delivery>;
  youId: string | null;
  now: Date;
  lastPublicReplyId: string | null;
  onRetry: (messageId: string) => void;
  onDiscard: (messageId: string) => void;
}) {
  const last = group.messages[group.messages.length - 1];
  const yours = group.senderId !== null && group.senderId === youId;
  const who =
    group.side === "in" ? group.senderName : yours ? "You" : (group.senderName ?? "Your team");
  const lastState = delivery[last.id];

  let receipt: React.ReactNode = null;
  if (group.side === "out" && last.id === lastPublicReplyId && !lastState) {
    receipt = last.readAt ? (
      <span className="msg-receipt seen" title={`Seen ${formatFullDateTime(last.readAt)}`}>
        <CheckCheck aria-hidden />
        Seen
      </span>
    ) : (
      <span className="msg-receipt">
        <Check aria-hidden />
        Sent
      </span>
    );
  }

  return (
    <div className={cn("msg-group", group.side)}>
      {group.side === "note" ? <NoteLabel name={yours ? "you" : group.senderName} /> : null}
      {group.messages.map((message, index) => {
        const state = delivery[message.id];
        const position =
          group.messages.length === 1
            ? "single"
            : index === 0
              ? "first"
              : index === group.messages.length - 1
                ? "last"
                : "middle";
        const quote = message.attachments.find((attachment) => attachment.kind === "quote");
        const others = message.attachments.filter((attachment) => attachment.kind !== "quote");

        return (
          <div
            key={message.id}
            className={cn("msg", position, state)}
            title={formatFullDateTime(message.createdAt)}
          >
            <span className="sr-only">
              {who} at {formatClock(message.createdAt)}
              {group.side === "note" ? ", internal note" : ""}:
            </span>
            {message.body || others.length > 0 ? (
              <div className="msg-bubble">
                {message.body ? <MessageText text={message.body} /> : null}
                {others.length > 0 ? (
                  <div className="msg-attachments">
                    {others.map((attachment, attachmentIndex) => (
                      <Attachment key={attachmentIndex} attachment={attachment} now={now} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {quote ? <Attachment attachment={quote} now={now} /> : null}

            {state === "sending" ? (
              <span className="msg-state">
                <Clock aria-hidden />
                Sending…
              </span>
            ) : null}
            {state === "failed" ? (
              <span className="msg-state failed" role="alert">
                <AlertCircle aria-hidden />
                Not sent
                <button type="button" onClick={() => onRetry(message.id)}>
                  <RotateCcw aria-hidden />
                  Retry
                </button>
                <button type="button" onClick={() => onDiscard(message.id)} aria-label="Delete unsent message">
                  <Trash2 aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
        );
      })}
      {lastState ? null : (
        <div className="msg-foot">
          {group.side !== "note" && who ? <span>{who}</span> : null}
          {group.side !== "note" && who ? <span aria-hidden>·</span> : null}
          <time dateTime={last.createdAt} title={formatFullDateTime(last.createdAt)}>
            {formatClock(last.createdAt)}
          </time>
          {receipt ? <span aria-hidden>·</span> : null}
          {receipt}
        </div>
      )}
    </div>
  );
}

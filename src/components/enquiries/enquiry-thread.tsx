"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, WifiOff, X } from "lucide-react";

import { Composer } from "@/components/enquiries/composer";
import { EnquiryDetails } from "@/components/enquiries/enquiry-details";
import {
  useMediaQuery,
  useOnline,
  usePersistentBoolean,
  useVisualViewportVars,
} from "@/components/enquiries/hooks";
import { useInbox, type ThreadData } from "@/components/enquiries/inbox-provider";
import { LostDialog } from "@/components/enquiries/lost-dialog";
import { MessageList } from "@/components/enquiries/message-list";
import { QuoteDialog } from "@/components/enquiries/quote-dialog";
import { ThreadHeader } from "@/components/enquiries/thread-header";
import { ThreadMissing } from "@/components/enquiries/thread-missing";
import { useInboxQuery } from "@/components/enquiries/use-inbox-query";
import type { EnquiryDetail, EnquiryQuote, EnquiryRow, EnquiryStatus } from "@/lib/types";

/**
 * One conversation: header, the thread, the reply box, and the enquiry's
 * details beside it. Keyed by id in the page, so every conversation mounts
 * fresh — its unread marker, scroll position and dialogs never leak into
 * the next one.
 */
export function EnquiryThread({ id, initial }: { id: string; initial: EnquiryDetail | null }) {
  const inbox = useInbox();
  const { hydrateThread, markRead } = inbox;

  // Hydrate first, then mark read — in one effect, because child effects
  // run before parent ones: a read receipt fired from ThreadView would land
  // before the server's copy of the row and be overwritten by its count.
  useEffect(() => {
    if (initial) hydrateThread(initial);
    markRead(id);
  }, [id, initial, hydrateThread, markRead]);

  const row: EnquiryRow | null = inbox.rowsById[id] ?? initial ?? null;
  const thread: ThreadData | null =
    inbox.threads[id] ??
    (initial ? { messages: initial.messages, lostReason: initial.lostReason, booking: initial.booking } : null);

  if (!row || !thread) return <ThreadMissing />;
  return <ThreadView row={row} thread={thread} markRead={markRead} />;
}

function ThreadView({
  row,
  thread,
  markRead,
}: {
  row: EnquiryRow;
  thread: ThreadData;
  markRead: (id: string) => void;
}) {
  const inbox = useInbox();
  const router = useRouter();
  const { queryString } = useInboxQuery();
  const backHref = `/dashboard/enquiries${queryString}`;

  // Frozen at open: where the "new messages" line goes, even after the row
  // is marked read a moment later.
  const [unreadAtOpen] = useState(row.unreadCount);

  useEffect(() => {
    // Coming back to a background tab with the thread open reads what arrived.
    const onVisible = () => {
      if (document.visibilityState === "visible") markRead(row.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [row.id, markRead]);

  const wide = useMediaQuery("(min-width: 1280px)");
  const phone = useMediaQuery("(max-width: 767px)");
  useVisualViewportVars(phone);
  const online = useOnline();

  const [docked, setDocked] = usePersistentBoolean("godnd:enquiry-details-docked", true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  // A keyboard or mouse user who opens a conversation came to reply: put
  // the cursor in the box. Not on touch, where focus would throw up the
  // keyboard over the message they are about to read.
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const active = document.activeElement;
    const fromList = active instanceof HTMLElement && active.closest(".inbox-list");
    if (active === document.body || fromList) {
      threadRef.current?.querySelector<HTMLTextAreaElement>(".composer-input")?.focus({ preventScroll: true });
    }
  }, []);

  const onStage = (status: EnquiryStatus) => {
    if (status === row.status) return;
    if (status === "lost") {
      setLostOpen(true);
      return;
    }
    void inbox.changeStage(row.id, status);
  };

  const sendQuote = async (quote: EnquiryQuote, message: string | null) => {
    const sent = await inbox.send(row.id, { body: message, isInternal: false, attachments: [quote] });
    if (sent && (row.status === "new" || row.status === "open")) {
      void inbox.changeStage(row.id, "quoted");
    }
  };

  const toggleDetails = () => {
    if (wide) setDocked(!docked);
    else setSheetOpen((open) => !open);
  };

  const details = (
    <EnquiryDetails
      row={row}
      thread={thread}
      team={inbox.team}
      you={inbox.you}
      now={inbox.now}
      onStage={onStage}
      onAssign={(assigneeId) => void inbox.assign(row.id, assigneeId)}
      onPriority={(priority) => void inbox.setPriority(row.id, priority)}
    />
  );

  return (
    <div className="thread-wrap">
      <div className="thread" ref={threadRef}>
        <ThreadHeader
          row={row}
          you={inbox.you}
          backHref={backHref}
          detailsExpanded={wide ? docked : sheetOpen}
          onToggleDetails={toggleDetails}
          onStage={onStage}
          onAssignToMe={() => inbox.you && void inbox.assign(row.id, inbox.you.id)}
          onMarkUnread={() => {
            inbox.markUnread(row.id);
            router.push(backHref, { scroll: false });
          }}
          onCopyLink={() => {
            const url = `${window.location.origin}/dashboard/enquiries/${encodeURIComponent(row.id)}`;
            void navigator.clipboard?.writeText(url).then(
              () => inbox.notify("Link copied", "info"),
              () => inbox.notify("Couldn't copy the link — your browser blocked it."),
            );
          }}
        />

        {!online ? (
          <p className="thread-offline" role="status">
            <WifiOff aria-hidden />
            You&rsquo;re offline. Messages you send will show as not sent — retry once you&rsquo;re back.
          </p>
        ) : null}

        <MessageList
          row={row}
          messages={thread.messages}
          delivery={inbox.delivery}
          unreadAtOpen={unreadAtOpen}
          now={inbox.now}
          youId={inbox.you?.id ?? null}
          onRetry={(messageId) => inbox.retry(row.id, messageId)}
          onDiscard={(messageId) => inbox.discard(row.id, messageId)}
        />

        <Composer
          row={row}
          isDemo={inbox.isDemo}
          onSend={(draft) => void inbox.send(row.id, draft)}
          onSendQuote={() => setQuoteOpen(true)}
          onUnspam={() => void inbox.changeStage(row.id, "open")}
        />
      </div>

      {/* Docked details: in the markup at every width so a wide screen paints
          it on first load; CSS shows it only from 1280px up. */}
      <aside className="thread-details" aria-label="Enquiry details" hidden={!docked}>
        {details}
      </aside>

      <DialogPrimitive.Root open={sheetOpen && !wide} onOpenChange={setSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="dialog-scrim details-scrim" />
          <DialogPrimitive.Content className="details-sheet" aria-describedby={undefined}>
            <div className="details-sheet-head">
              <DialogPrimitive.Close className="thread-back details-sheet-back" aria-label="Back to conversation">
                <ChevronLeft aria-hidden />
              </DialogPrimitive.Close>
              <DialogPrimitive.Title className="dialog-title">Enquiry details</DialogPrimitive.Title>
              <DialogPrimitive.Close className="dialog-close details-sheet-close" aria-label="Close details">
                <X aria-hidden />
              </DialogPrimitive.Close>
            </div>
            <div className="details-sheet-body">{details}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <QuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        row={row}
        experiences={inbox.experiences}
        now={inbox.now}
        onSend={(quote, message) => void sendQuote(quote, message)}
      />
      <LostDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        contactName={row.contactName}
        onConfirm={(reason) => void inbox.changeStage(row.id, "lost", reason)}
      />
    </div>
  );
}

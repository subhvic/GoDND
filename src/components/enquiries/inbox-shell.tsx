"use client";

import { useSyncExternalStore } from "react";

import { EnquiryList } from "@/components/enquiries/enquiry-list";
import { useInbox } from "@/components/enquiries/inbox-provider";

/**
 * Two panes — conversations and the open thread — laid out by CSS, not by
 * JavaScript, so the first paint is already right at every width:
 *
 *   phone      one pane at a time; an open thread covers the screen
 *   tablet     list + thread
 *   desktop    list + thread + details (the thread docks it at 1280px)
 *
 * data-pane tells the phone layout which of the two to show.
 */
export function InboxShell({ children }: { children: React.ReactNode }) {
  const { selectedId } = useInbox();
  // False while hydrating, true after — lets the e2e suite wait until the
  // inbox is interactive rather than guessing with timeouts.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    <div
      className="inbox"
      data-pane={selectedId ? "thread" : "list"}
      data-hydrated={hydrated ? "" : undefined}
    >
      <EnquiryList />
      <section className="inbox-main" aria-label="Conversation">
        {children}
      </section>
    </div>
  );
}

const subscribeNothing = () => () => {};

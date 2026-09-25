import type { Viewport } from "next";

import { InboxProvider } from "@/components/enquiries/inbox-provider";
import { InboxShell } from "@/components/enquiries/inbox-shell";
import { LogEnquiryButton } from "@/components/enquiries/log-enquiry-dialog";
import { PageBar } from "@/components/ui/page-bar";
import { loadInbox } from "@/lib/data/enquiries";

/**
 * On Android, let the keyboard shrink the layout viewport so the reply box
 * stays above it. (iOS ignores this; the thread handles iOS itself.)
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

/**
 * Enquiries — the operator's inbox. A layout rather than a page, so the
 * conversation list stays mounted while the operator moves between threads:
 * switching conversations swaps only the right-hand pane, and the list keeps
 * its scroll position, search and filter.
 */
export default async function EnquiriesLayout({
  children,
}: LayoutProps<"/dashboard/enquiries">) {
  const inbox = await loadInbox();

  return (
    <InboxProvider
      initialRows={inbox.rows}
      team={inbox.team}
      you={inbox.you}
      experiences={inbox.experiences}
      isDemo={inbox.isDemoData}
      serverNow={inbox.now}
    >
      <PageBar
        crumbs={[{ label: "GoDND", href: "/dashboard" }, { label: "Enquiries" }]}
        actions={<LogEnquiryButton />}
      />
      <div className="surface-card">
        <InboxShell>{children}</InboxShell>
      </div>
    </InboxProvider>
  );
}

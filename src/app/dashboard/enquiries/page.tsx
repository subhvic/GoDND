import { InboxOverview } from "@/components/enquiries/inbox-overview";

export const metadata = { title: "Enquiries" };

/**
 * No conversation open. On a phone the list fills the screen and this pane is
 * hidden; on a wider screen it says what is waiting instead of showing a
 * blank panel.
 */
export default function EnquiriesIndexPage() {
  return <InboxOverview />;
}

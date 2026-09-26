import { BookingsWorkspace } from "@/components/bookings/bookings-workspace";
import { listAllBookings } from "@/lib/data/bookings";

export const metadata = { title: "Bookings" };

/**
 * Bookings, grouped into the five phases a booking lives through —
 * Awaiting payment, Upcoming, Ongoing, Completed, Cancelled. The grouping,
 * search and paging happen in the browser (see BookingsWorkspace); the
 * server's job is the one query and the clock the phases are read against.
 */
export default async function BookingsPage() {
  const { rows, now, isDemoData } = await listAllBookings();
  return <BookingsWorkspace rows={rows} now={now} isDemo={isDemoData} />;
}

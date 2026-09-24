"use server";

import { getBooking } from "@/lib/data/bookings";
import type { BookingDetail } from "@/lib/types";

/**
 * Row-to-detail hand-off, same pattern as fetchExperienceDetail: the row
 * carries what the table needs; every extra field (guest list, payments,
 * timeline) loads on demand when a row is opened. Most rows are never
 * opened, and shipping the full detail with the list would multiply the
 * payload for no benefit.
 */
export async function fetchBookingDetail(
  id: string,
): Promise<BookingDetail | null> {
  return getBooking(id);
}

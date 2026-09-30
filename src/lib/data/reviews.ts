import "server-only";

import { connection } from "next/server";

import { demoReviews } from "@/lib/insights/demo";
import { selectReviews, type ReviewList, type ReviewQuery } from "@/lib/reviews/select";
import type { ReviewRecord } from "@/lib/reviews/types";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Data access for guest reviews. Same contract as the other data files:
 * live reads run through the caller's session so RLS scopes them, and the
 * fixture applies only when Supabase isn't configured.
 *
 * The whole list is read and then filtered in memory, as the bookings list
 * does. An operator's reviews number in the hundreds, the screen needs a
 * rating breakdown and three tab counts over the same set, and doing that
 * as five round trips would cost more than reading it once.
 */

export const isReviewDemo = () =>
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function listReviews(query: ReviewQuery = {}): Promise<ReviewList> {
  await connection();
  const demo = isReviewDemo();
  const all = demo ? demoReviews(Date.now()) : await liveReviews();
  return selectReviews(all, query, demo);
}

type ReviewRow = {
  id: string;
  booking_id: string | null;
  experience_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  agency_reply: string | null;
  replied_at: string | null;
  experience: { title: string } | null;
  booking: { reference: string; lead_name: string | null; is_marketplace: boolean } | null;
};

/**
 * The guest's name comes from the booking, not from their profile: a
 * traveller isn't a member of the operator's workspace, so the operator
 * can't read their profile row — and shouldn't need to.
 */
async function liveReviews(): Promise<ReviewRecord[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, booking_id, experience_id, rating, title, body, created_at, agency_reply, replied_at, " +
        "experience:experiences ( title ), " +
        "booking:bookings ( reference, lead_name, is_marketplace )",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listReviews failed: ${error.message}`);

  return ((data ?? []) as unknown as ReviewRow[]).map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    bookingRef: row.booking?.reference ?? null,
    experienceId: row.experience_id,
    experienceTitle: row.experience?.title ?? "Experience no longer listed",
    guestName: row.booking?.lead_name ?? "Guest",
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    reply: row.agency_reply,
    repliedAt: row.replied_at,
    source: row.booking?.is_marketplace ? "marketplace" : "direct",
  }));
}

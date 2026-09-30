/**
 * Guest reviews as their own record.
 *
 * Insights only ever needed four fields of a review (which experience, the
 * rating, when, and whether it had been answered). The reviews screen shows
 * the review itself, so it needs what the guest actually wrote, who wrote
 * it, and the operator's reply.
 */

export type ReviewSource = "marketplace" | "direct";

/**
 * How long a public reply may be. It lives here rather than beside the
 * server action, because a `"use server"` module may only export functions
 * and both the form and the action need this number.
 */
export const REPLY_MAX = 1000;

export type ReviewRecord = {
  id: string;
  /** The booking it came from — reviews are only left after a trip. */
  bookingId: string | null;
  bookingRef: string | null;
  experienceId: string | null;
  experienceTitle: string;
  guestName: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  /** The operator's public reply, shown under the review on the listing. */
  reply: string | null;
  repliedAt: string | null;
  source: ReviewSource;
};

/**
 * Split by whose move it is, the way the Enquiries inbox is: the question
 * an operator opens this screen to answer is "which of these still needs me?"
 * The two views are disjoint, so the counts add up to the whole list.
 */
export const REVIEW_VIEWS = [
  { key: "needs_reply", label: "Needs a reply" },
  { key: "replied", label: "Replied" },
  { key: "all", label: "All" },
] as const;

export type ReviewViewKey = (typeof REVIEW_VIEWS)[number]["key"];

export const isReviewView = (value: unknown): value is ReviewViewKey =>
  REVIEW_VIEWS.some((view) => view.key === value);

/** Five stars down to one — the order a rating breakdown is always read in. */
export type RatingDistribution = [number, number, number, number, number];

export type ReviewSummary = {
  count: number;
  average: number | null;
  distribution: RatingDistribution;
  /** Named when the list is filtered to one experience. */
  scope: string | null;
};

export function summarise(reviews: ReviewRecord[], scope: string | null = null): ReviewSummary {
  const distribution: RatingDistribution = [0, 0, 0, 0, 0];
  let total = 0;
  for (const review of reviews) {
    const index = 5 - review.rating;
    if (index >= 0 && index < 5) distribution[index] += 1;
    total += review.rating;
  }
  return {
    count: reviews.length,
    average: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : null,
    distribution,
    scope,
  };
}

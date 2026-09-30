import { summarise, type ReviewRecord, type ReviewSummary, type ReviewViewKey } from "@/lib/reviews/types";

/**
 * Turning the whole list of reviews into one screenful.
 *
 * Pure, so the live path and the sample workspace can't disagree about what
 * "needs a reply" means, and so the ordering rule can be tested without a
 * database.
 */

export const REVIEWS_PAGE_SIZE = 10;

export type ReviewQuery = {
  view?: ReviewViewKey;
  /** An experience id, or "all". */
  experienceId?: string;
  /** 1–5, or null for every rating. */
  rating?: number | null;
  page?: number;
};

export type ReviewExperienceOption = { id: string; title: string; count: number };

export type ReviewList = {
  rows: ReviewRecord[];
  view: ReviewViewKey;
  experienceId: string;
  rating: number | null;
  page: number;
  pageCount: number;
  total: number;
  /** Counts for the three view tabs, under the current experience/rating filter. */
  counts: Record<ReviewViewKey, number>;
  /** The rating picture, under the experience filter only — a rating filter would make it circular. */
  summary: ReviewSummary;
  experiences: ReviewExperienceOption[];
  /** Unanswered across everything, however old — what the page's job is. */
  unansweredTotal: number;
  isDemoData: boolean;
};

const needsReply = (review: ReviewRecord) => review.reply === null;

export function selectReviews(
  all: ReviewRecord[],
  query: ReviewQuery,
  isDemoData: boolean,
): ReviewList {
  const view = query.view ?? "needs_reply";
  const experienceId = query.experienceId && query.experienceId !== "all" ? query.experienceId : "all";
  const rating = query.rating ?? null;

  const experiences = experienceOptions(all);
  const byExperience =
    experienceId === "all" ? all : all.filter((review) => review.experienceId === experienceId);
  const byRating = rating === null ? byExperience : byExperience.filter((review) => review.rating === rating);

  const counts: Record<ReviewViewKey, number> = {
    needs_reply: byRating.filter(needsReply).length,
    replied: byRating.filter((review) => !needsReply(review)).length,
    all: byRating.length,
  };

  const matching = byRating.filter((review) =>
    view === "all" ? true : view === "needs_reply" ? needsReply(review) : !needsReply(review),
  );

  // Longest waiting first while a reply is owed — the same rule the
  // enquiries inbox follows. Everywhere else, newest first.
  const ordered = [...matching].sort((a, b) =>
    view === "needs_reply" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
  );

  const pageCount = Math.max(1, Math.ceil(ordered.length / REVIEWS_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  const start = (page - 1) * REVIEWS_PAGE_SIZE;

  const scope = experienceId === "all" ? null : (byExperience[0]?.experienceTitle ?? null);

  return {
    rows: ordered.slice(start, start + REVIEWS_PAGE_SIZE),
    view,
    experienceId,
    rating,
    page,
    pageCount,
    total: ordered.length,
    counts,
    summary: summarise(byExperience, scope),
    experiences,
    unansweredTotal: all.filter(needsReply).length,
    isDemoData,
  };
}

/** Every experience that has a review, most reviewed first. */
function experienceOptions(all: ReviewRecord[]): ReviewExperienceOption[] {
  const byId = new Map<string, ReviewExperienceOption>();
  for (const review of all) {
    if (!review.experienceId) continue;
    const existing = byId.get(review.experienceId);
    if (existing) existing.count += 1;
    else byId.set(review.experienceId, { id: review.experienceId, title: review.experienceTitle, count: 1 });
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

import { ReviewsView } from "@/components/insights/reviews-view";
import { listReviews } from "@/lib/data/reviews";
import { isReviewView } from "@/lib/reviews/types";

export const metadata = { title: "Reviews · Insights" };

/**
 * Every review, filtered from the URL so a view can be linked to — a
 * reminder to answer the three-star reviews on one experience is a link,
 * not an instruction.
 */
export default async function ReviewsPage(props: PageProps<"/dashboard/insights/reviews">) {
  const params = await props.searchParams;

  const list = await listReviews({
    view: isReviewView(params.view) ? params.view : "needs_reply",
    experienceId: typeof params.experience === "string" ? params.experience : undefined,
    rating: parseRating(params.rating),
    page: parsePage(params.page),
  });

  return <ReviewsView list={list} />;
}

function parseRating(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return parsed >= 1 && parsed <= 5 ? parsed : null;
}

function parsePage(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

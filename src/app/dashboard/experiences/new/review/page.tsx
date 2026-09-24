import type { Metadata } from "next";

import { ReviewScreen } from "@/components/experiences/wizard/review-screen";

export const metadata: Metadata = {
  title: "Review & send",
  description:
    "A final look at the whole experience before it goes to the review team.",
};

/**
 * The pre-flight review, between step 7 (Media) and submission.
 *
 * Rendered as a route rather than a modal so it survives a refresh, has a
 * real URL an operator can share with a colleague for a second opinion, and
 * follows the same "one thing per URL" pattern the seven steps already do.
 */
export default function ReviewPage() {
  return <ReviewScreen />;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isReviewDemo } from "@/lib/data/reviews";
import { REPLY_MAX } from "@/lib/reviews/types";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Publishing a reply to a guest review.
 *
 * The reply is public — it sits under the review on the listing — so it is
 * written straight to the review's own row. RLS decides whose review may be
 * answered (`reviews_agency_reply`, 0003), which is why this action grants
 * no authority of its own.
 */

const replySchema = z.object({
  reviewId: z.string().min(1).max(64),
  reply: z
    .string()
    .trim()
    .min(1, "Write a reply before publishing it")
    .max(REPLY_MAX, `Keep the reply under ${REPLY_MAX} characters`),
});

export type ReplyResult =
  | { ok: true; repliedAt: string; reply: string }
  | { ok: false; error: string };

export async function replyToReview(input: { reviewId: string; reply: string }): Promise<ReplyResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That reply isn’t valid." };
  }
  const { reviewId, reply } = parsed.data;
  const repliedAt = new Date().toISOString();

  // In a sample workspace nothing is stored: the reply is validated and the
  // page keeps the result it computed itself.
  if (isReviewDemo()) return { ok: true, repliedAt, reply };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };

  const { data, error } = await supabase
    .from("reviews")
    .update({ agency_reply: reply, replied_at: repliedAt })
    .eq("id", reviewId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: `Not published: ${error.message}` };
  if (!data) return { ok: false, error: "That review could not be found." };

  revalidatePath("/dashboard/insights/reviews");
  revalidatePath("/dashboard/insights");

  return { ok: true, repliedAt, reply };
}

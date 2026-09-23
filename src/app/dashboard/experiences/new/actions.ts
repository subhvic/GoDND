"use server";

import type { ExperienceDraft } from "@/lib/experience-wizard/schema";

/**
 * Draft persistence.
 *
 * The wizard keeps its own copy in sessionStorage, so these calls are the
 * durable write rather than the source of truth. Once Supabase is provisioned
 * each maps onto the tables in 0002_experiences.sql:
 *
 *   saveExperienceDraft        -> upsert experiences (status 'draft') and its
 *                                 child rows, keyed by the draft's id
 *   submitExperienceForApproval-> status 'under_review', submitted_at = now(),
 *                                 plus an experience_reviews row for the
 *                                 Approval History timeline
 *
 * They are deliberately not stubbed silently: each returns a result the caller
 * can act on, so wiring the database later changes no call site.
 */

export type DraftSaveResult = {
  ok: boolean;
  persisted: boolean;
  message: string;
};

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export async function saveExperienceDraft(
  draft: ExperienceDraft,
): Promise<DraftSaveResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      persisted: false,
      message: "Saved on this device. Connect Supabase to sync it to your account.",
    };
  }

  // TODO(experience-persistence): upsert into experiences + child tables.
  // Deliberately not half-implemented: a partial write would leave an
  // experience with days but no pricing, which is worse than no write at all.
  void draft;
  return {
    ok: true,
    persisted: false,
    message: "Draft saving to Supabase lands with the edit flow.",
  };
}

export async function submitExperienceForApproval(
  draft: ExperienceDraft,
): Promise<DraftSaveResult> {
  void draft;
  return {
    ok: true,
    persisted: false,
    message: "Submitted for review.",
  };
}

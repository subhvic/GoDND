"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabase } from "@/lib/supabase/server";
import type { ExperienceDraft } from "@/lib/experience-wizard/schema";

/**
 * Draft persistence.
 *
 * The whole draft goes to Postgres as one jsonb document and
 * `save_experience_draft` fans it out across ten tables (see
 * 0005_experience_drafts.sql). Doing that fan-out from here would mean ten
 * round trips with no transaction around them, and an interrupted save would
 * leave an experience with days but no pricing.
 *
 * The functions are SECURITY INVOKER, so they run under the caller's session
 * and RLS decides what may be written — these actions grant no authority of
 * their own.
 */

export type DraftSaveResult = {
  ok: boolean;
  /** Null when Supabase is not configured, so nothing left this device. */
  experienceId: string | null;
  persisted: boolean;
  message: string;
};

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

const NOT_CONFIGURED: DraftSaveResult = {
  ok: true,
  experienceId: null,
  persisted: false,
  message: "Saved on this device. Connect Supabase to sync it to your account.",
};

export async function saveExperienceDraft(
  draft: ExperienceDraft,
  experienceId: string | null = null,
): Promise<DraftSaveResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      experienceId,
      persisted: false,
      message: "Sign in to save this experience to your account.",
    };
  }

  const { data, error } = await supabase.rpc("save_experience_draft", {
    p_experience_id: experienceId,
    p_draft: draft,
  });

  if (error) {
    // Surfaced rather than swallowed: an operator who believes a save
    // succeeded will close the tab.
    return {
      ok: false,
      experienceId,
      persisted: false,
      message: `Could not save: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/experiences");

  return {
    ok: true,
    experienceId: data as string,
    persisted: true,
    message: "Draft saved.",
  };
}

export async function submitExperienceForApproval(
  draft: ExperienceDraft,
  experienceId: string | null = null,
): Promise<DraftSaveResult> {
  if (!isSupabaseConfigured()) {
    return {
      ...NOT_CONFIGURED,
      message:
        "Submitted on this device only. Connect Supabase to send it for review.",
    };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      experienceId,
      persisted: false,
      message: "Sign in to submit this experience for review.",
    };
  }

  // Saves and submits in one transaction, so an experience can never end up
  // under review carrying a stale draft.
  const { data, error } = await supabase.rpc("submit_experience_for_approval", {
    p_experience_id: experienceId,
    p_draft: draft,
  });

  if (error) {
    return {
      ok: false,
      experienceId,
      persisted: false,
      message: `Could not submit: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/experiences");

  return {
    ok: true,
    experienceId: data as string,
    persisted: true,
    message: "Sent for approval.",
  };
}

/** Reopens a saved draft in the wizard. */
export async function loadExperienceDraft(
  experienceId: string,
): Promise<ExperienceDraft | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("load_experience_draft", {
    p_experience_id: experienceId,
  });

  if (error || !data) return null;
  return data as ExperienceDraft;
}

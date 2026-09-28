"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { isValidEmail, normaliseEmail, OTP_LENGTH, PREVIEW_OTP } from "@/lib/auth/config";
import { SECTION_COLUMN, getSettings, isSettingsDemo } from "@/lib/data/settings";
import type { SettingsState } from "@/lib/settings/model";
import { INVITE_VALID_DAYS } from "@/lib/settings/options";
import { applySettingsAction, type SettingsAction } from "@/lib/settings/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Settings writes.
 *
 * Every action is re-run through applySettingsAction against the stored
 * state — the browser already ran it for its instant update, but the server
 * is the authority — and only then written. In a sample workspace nothing is
 * stored: the payload is still validated, and `state: null` tells the page
 * to keep the result it computed itself.
 */

export type SettingsActionResult =
  | { ok: true; state: SettingsState | null; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const roleSchema = z.enum(["owner", "admin", "sales", "ops", "finance"]);

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("save_section"),
    section: z.enum(["basicInfo", "compliance", "financial", "certifications", "operations"]),
    values: z.unknown(),
    submit: z.boolean(),
  }),
  z.object({ type: z.literal("save_profile"), values: z.unknown() }),
  z.object({ type: z.literal("invite_member"), email: z.string().max(254), name: z.string().max(80), role: roleSchema }),
  z.object({ type: z.literal("resend_invite"), memberId: z.string().max(64) }),
  z.object({ type: z.literal("revoke_invite"), memberId: z.string().max(64) }),
  z.object({ type: z.literal("change_role"), memberId: z.string().max(64), role: roleSchema }),
  z.object({ type: z.literal("remove_member"), memberId: z.string().max(64) }),
]);

export async function performSettingsAction(input: SettingsAction): Promise<SettingsActionResult> {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That change isn’t valid." };
  const action = parsed.data as SettingsAction;

  const load = await getSettings();
  if (!load) return { ok: false, error: "Your session has ended. Sign in again." };

  const supabase = isSettingsDemo() ? null : await createServerSupabase();
  const actorName = load.state.team.find((member) => member.id === load.state.viewer.memberId)?.name ?? load.state.viewer.email;
  const result = applySettingsAction(load.state, action, { now: new Date(), actorName, newId: randomUUID });
  if (!result.ok) return result;

  if (isSettingsDemo() || !supabase) {
    // Rules that depend on earlier unsaved actions (resending an invite made
    // a moment ago) can't be judged against the fixture, so a sample
    // workspace only rejects what is invalid on its face.
    return { ok: true, state: null, message: result.message };
  }

  const state = load.state;
  const error = await persist(supabase, state, result.state, action);
  if (error) return { ok: false, error };

  const fresh = await getSettings();
  let message = result.message;
  if (action.type === "invite_member" || action.type === "resend_invite") {
    const email = action.type === "invite_member" ? normaliseEmail(action.email) : state.team.find((m) => m.id === action.memberId)?.email;
    if (email) message = (await sendInviteEmail(email)) ?? message;
  }
  return { ok: true, state: fresh?.state ?? null, message };
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Writes one action. Returns an error message, or null when it stuck. */
async function persist(
  supabase: Supabase,
  state: SettingsState,
  next: SettingsState,
  action: SettingsAction,
): Promise<string | null> {
  switch (action.type) {
    case "save_section": {
      const { error } = await supabase.rpc("save_profile_section", {
        p_section: SECTION_COLUMN[action.section],
        p_data: stripPreviews(next[action.section].values),
        p_submit: action.submit,
      });
      return error ? `Not saved: ${error.message}` : null;
    }
    case "save_profile": {
      const values = next.profile.values;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.fullName.trim(),
          phone: values.phone.trim(),
          designation: values.designation.trim() || null,
          avatar_url: values.avatar?.path ?? null,
        })
        .eq("id", state.viewer.userId);
      return error ? `Not saved: ${error.message}` : null;
    }
    case "invite_member": {
      const { error } = await supabase.from("agency_members").insert({
        agency_id: state.viewer.agencyId,
        invited_email: normaliseEmail(action.email),
        role: action.role,
        status: "invited",
        invited_by: state.viewer.userId,
        invite_token: randomBytes(24).toString("base64url"),
        invite_expires_at: new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString(),
      });
      return error ? `Invite not sent: ${error.message}` : null;
    }
    case "resend_invite": {
      const { error } = await supabase
        .from("agency_members")
        .update({
          invite_token: randomBytes(24).toString("base64url"),
          invite_expires_at: new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000).toISOString(),
          invited_by: state.viewer.userId,
        })
        .eq("id", action.memberId)
        .eq("status", "invited");
      return error ? `Invite not resent: ${error.message}` : null;
    }
    case "revoke_invite": {
      const { error } = await supabase.from("agency_members").delete().eq("id", action.memberId).eq("status", "invited");
      return error ? `Invite not withdrawn: ${error.message}` : null;
    }
    case "change_role": {
      const { error } = await supabase.from("agency_members").update({ role: action.role }).eq("id", action.memberId);
      return error ? `Role not changed: ${error.message}` : null;
    }
    case "remove_member": {
      const { error } = await supabase.from("agency_members").delete().eq("id", action.memberId);
      return error ? `Not removed: ${error.message}` : null;
    }
    case "change_email":
      return "Email changes are confirmed with a code";
  }
}

/** Blob URLs point into one browser tab; they are never stored. */
function stripPreviews(values: unknown): unknown {
  if (Array.isArray(values)) return values.map(stripPreviews);
  if (values && typeof values === "object") {
    return Object.fromEntries(
      Object.entries(values)
        .filter(([key]) => key !== "previewUrl")
        .map(([key, value]) => [key, stripPreviews(value)]),
    );
  }
  return values;
}

/**
 * Sends the invitation email through Supabase Auth, which creates the
 * account the invitee signs in to. Someone who already has a GoDND login
 * needs no email: accept_agency_invites() adds them the next time they sign
 * in. Returns a message only when the email couldn't go.
 */
async function sendInviteEmail(email: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return `Invite saved for ${email}, but email sending isn’t set up here — ask them to sign in with this address.`;
  }
  const host = (await headers()).get("host");
  const redirectTo = host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/login` : undefined;
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!error || error.code === "email_exists" || /already been registered/i.test(error.message)) return null;
  return `Invite saved, but the email to ${email} didn’t send (${error.message}). Try resending it.`;
}

/* --------------------------------------------------------------------------
 * Changing the sign-in email. The portal signs in with a code sent to this
 * address, so a new address is proved with a code sent to it before it
 * replaces the old one — otherwise one typo locks the operator out.
 * ----------------------------------------------------------------------- */

export type EmailChangeResult =
  | { ok: true; message: string; state: SettingsState | null }
  | { ok: false; error: string };

export async function requestEmailChange(rawEmail: string): Promise<EmailChangeResult> {
  const email = normaliseEmail(String(rawEmail ?? ""));
  if (!isValidEmail(email)) return { ok: false, error: "Enter an address like name@company.com" };

  const load = await getSettings();
  if (!load) return { ok: false, error: "Your session has ended. Sign in again." };
  const check = applySettingsAction(load.state, { type: "change_email", email }, {
    now: new Date(),
    actorName: "",
    newId: randomUUID,
  });
  if (!check.ok) return { ok: false, error: check.error };

  if (isSettingsDemo()) {
    return { ok: true, state: null, message: `In this preview no email is sent — use ${PREVIEW_OTP}.` };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    if (error.code === "email_exists") return { ok: false, error: "That address already has a GoDND login" };
    if (error.status === 429) return { ok: false, error: "Too many codes requested. Wait a minute, then try again." };
    return { ok: false, error: "We couldn’t send a code just now. Try again in a moment." };
  }
  return { ok: true, state: null, message: `We sent a ${OTP_LENGTH}-digit code to ${email}.` };
}

export async function confirmEmailChange(rawEmail: string, rawToken: string): Promise<EmailChangeResult> {
  const email = normaliseEmail(String(rawEmail ?? ""));
  const token = String(rawToken ?? "").replace(/\D/g, "");
  if (token.length !== OTP_LENGTH) return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code` };

  if (isSettingsDemo()) {
    return token === PREVIEW_OTP
      ? { ok: true, state: null, message: `You now sign in with ${email}.` }
      : { ok: false, error: "Incorrect code" };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email_change" });
  if (error || !data.user) return { ok: false, error: "Incorrect code" };

  // profiles.email is copied from auth.users at sign-up only; keep it in step.
  await supabase.from("profiles").update({ email }).eq("id", data.user.id);
  const fresh = await getSettings();
  return { ok: true, state: fresh?.state ?? null, message: `You now sign in with ${email}.` };
}

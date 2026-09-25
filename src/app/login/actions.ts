"use server";

import { redirect } from "next/navigation";

import {
  emailError,
  isAuthConfigured,
  normaliseEmail,
  OTP_LENGTH,
  PREVIEW_OTP,
  safeNextPath,
} from "@/lib/auth/config";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Passwordless sign-in: an email address, then a six-digit code sent to it.
 *
 * These actions are public by nature — nobody is signed in yet — so every
 * input is re-validated here whatever the form already checked, and the
 * only thing they can do is ask Supabase to send or verify a code. Supabase
 * rate-limits both per address and per project.
 */

export type RequestOtpResult =
  | { ok: true; email: string }
  | { ok: false; field: "email" | "form"; message: string };

export type VerifyOtpResult = { ok: false; message: string };

/**
 * GoTrue's answers for "no portal account has this address". They are
 * treated as success: saying "no account found" would let anyone probe
 * which emails belong to an operator. The code step shows the address the
 * code went to, with a way back, so a genuine typo is still easy to spot.
 */
const NO_SUCH_ACCOUNT = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);

const RATE_LIMITED = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

export async function requestOtp(rawEmail: string): Promise<RequestOtpResult> {
  const email = normaliseEmail(String(rawEmail ?? ""));
  const invalid = emailError(email);
  if (invalid) return { ok: false, field: "email", message: invalid };

  // Preview: nothing is sent. The code step says which code to use.
  if (!isAuthConfigured()) return { ok: true, email };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Operators are invited into a workspace; the login page must never
    // quietly create an account for whoever types an address.
    options: { shouldCreateUser: false },
  });

  if (!error || NO_SUCH_ACCOUNT.has(error.code ?? "")) return { ok: true, email };

  if (RATE_LIMITED.has(error.code ?? "") || error.status === 429) {
    return {
      ok: false,
      field: "form",
      message: "Too many codes requested for this address. Wait a minute, then try again.",
    };
  }

  return {
    ok: false,
    field: "form",
    message: "We couldn’t send a code just now. Try again in a moment.",
  };
}

export async function verifyOtp(input: {
  email: string;
  token: string;
  next?: string;
}): Promise<VerifyOtpResult> {
  const email = normaliseEmail(String(input.email ?? ""));
  const token = String(input.token ?? "").replace(/\D/g, "");
  const destination = safeNextPath(input.next);

  if (token.length !== OTP_LENGTH) {
    return { ok: false, message: `Enter the ${OTP_LENGTH}-digit code` };
  }
  if (emailError(email)) {
    return { ok: false, message: "Start again with your email address" };
  }

  if (!isAuthConfigured()) {
    if (token !== PREVIEW_OTP) return { ok: false, message: "Incorrect OTP" };
    redirect(destination);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    if (RATE_LIMITED.has(error.code ?? "") || error.status === 429) {
      return { ok: false, message: "Too many attempts. Wait a minute, then try again." };
    }
    // GoTrue answers a wrong code and an expired one identically
    // ("otp_expired"), so the message can't tell them apart either. Resend
    // sits right under it for the expired case.
    return { ok: false, message: "Incorrect OTP" };
  }

  // The session cookies were written by the Supabase client above.
  redirect(destination);
}

export async function signOut(): Promise<void> {
  if (isAuthConfigured()) {
    const supabase = await createServerSupabase();
    // Local scope: signing out here must not end the operator's sessions
    // on their other devices.
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}

/**
 * Sign-in rules shared by the proxy, the login page and its actions.
 *
 * Auth is "configured" when the Supabase keys are present — the same switch
 * the data layer uses to choose between Postgres and fixtures. Unconfigured,
 * the portal runs as a walkable preview: the login flow works end to end
 * with a fixed code, and the dashboard stays open so a reviewer can deep-link
 * straight into any screen.
 */

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export const OTP_LENGTH = 6;

/**
 * The one code the preview accepts. The OTP step prints it, so it is not a
 * secret — and it only exists when there is no auth to protect anything.
 */
export const PREVIEW_OTP = "123456";

/**
 * How long "Resend OTP" stays locked. Matches Supabase's minimum interval
 * between two emails to the same address, so a resend the button allows is
 * one the server will accept.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Where to land after signing in. Only paths inside the portal pass, so a
 * crafted `?next=https://evil.example` — or its protocol-relative cousins
 * `//evil.example` and `/\evil.example` — can't turn the login page into an
 * open redirect.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AFTER_LOGIN;
  if (!/^\/dashboard(?:[/?#]|$)/.test(value)) return DEFAULT_AFTER_LOGIN;
  if (value.includes("\\") || value.includes("//")) return DEFAULT_AFTER_LOGIN;
  return value;
}

/**
 * The address format browsers enforce for <input type="email"> (WHATWG),
 * plus a dot in the domain: "name@company" is valid syntax but never a
 * deliverable address, and catching it here saves a wait for an email that
 * cannot arrive. One definition, so the field and the server always agree.
 */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/** "Enter your email address" vs "Invalid email address" — or null. */
export function emailError(value: string): string | null {
  if (!value) return "Enter your email address";
  if (!isValidEmail(value)) return "Invalid email address";
  return null;
}

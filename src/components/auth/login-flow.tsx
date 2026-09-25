"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { requestOtp, verifyOtp } from "@/app/login/actions";
import { buttonClass } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { OtpInput } from "@/components/ui/otp-input";
import {
  emailError,
  normaliseEmail,
  OTP_LENGTH,
  PREVIEW_OTP,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth/config";

export type PreviewAudience = "dev" | "preview";

/**
 * The handoff file's Login Flow, as one component with two steps:
 *
 *   email  →  "Login", Email address, [Send OTP]          (+ "Invalid email address")
 *   code   →  "Login", code sent to …, six boxes,
 *             "Didn’t receive the OTP? Resend OTP", [Verify & log in]  (+ "Incorrect OTP")
 *
 * Two additions to the drawn flow, both to close dead ends: the code step
 * names the address the code went to with a way back to change it, and
 * "Resend OTP" counts down instead of failing on Supabase's rate limit.
 * A complete code verifies itself — the button stays for anyone who
 * prefers to press it.
 */
export function LoginFlow({
  next,
  previewAudience,
}: {
  next: string;
  /** Set when Supabase isn't configured: the flow runs on a fixed code. */
  previewAudience: PreviewAudience | null;
}) {
  const [sent, setSent] = useState<{ email: string; at: number } | null>(null);
  const [lastEmail, setLastEmail] = useState("");

  return (
    <>
      <h1 className="auth-title">Login</h1>
      {sent ? (
        <CodeStep
          email={sent.email}
          sentAt={sent.at}
          next={next}
          previewAudience={previewAudience}
          onChangeEmail={() => setSent(null)}
        />
      ) : (
        <EmailStep
          defaultEmail={lastEmail}
          onSent={(email) => {
            setLastEmail(email);
            setSent({ email, at: Date.now() });
          }}
        />
      )}
    </>
  );
}

type FormError = { field: "email" | "form"; message: string };

function EmailStep({
  defaultEmail,
  onSent,
}: {
  defaultEmail: string;
  onSent: (email: string) => void;
}) {
  const [value, setValue] = useState(defaultEmail);
  const [error, setError] = useState<FormError | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const email = normaliseEmail(value);
    const invalid = emailError(email);
    if (invalid) {
      setError({ field: "email", message: invalid });
      inputRef.current?.focus();
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await requestOtp(email);
      if (result.ok) {
        onSent(result.email);
        return;
      }
      setError(result);
      if (result.field === "email") inputRef.current?.focus();
    });
  };

  return (
    // method="post": a submit that lands before hydration re-renders this
    // page instead of GET-ing it with the address in the URL, where it would
    // sit in history and server logs.
    <form method="post" className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
      <div>
        <div className="field">
          <Label htmlFor={id}>Email address</Label>
          <input
            ref={inputRef}
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            // The page's one job; land the cursor where the typing starts.
            autoFocus
            placeholder="name@company.com"
            className="input auth-input"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error?.field === "email" || undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        {error ? (
          <p id={errorId} role="alert" className="auth-message">
            <AlertCircle aria-hidden />
            {error.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClass({ variant: "primary", className: "auth-submit" })}
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="animate-spin" />
            Sending OTP…
          </>
        ) : (
          "Send OTP"
        )}
      </button>
    </form>
  );
}

function CodeStep({
  email,
  sentAt: firstSentAt,
  next,
  previewAudience,
  onChangeEmail,
}: {
  email: string;
  sentAt: number;
  next: string;
  previewAudience: PreviewAudience | null;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(firstSentAt);
  const [verifying, startVerify] = useTransition();
  const [resending, startResend] = useTransition();
  const secondsLeft = useSecondsLeft(sentAt, RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  const id = useId();
  const subtitleId = `${id}-subtitle`;
  const errorId = `${id}-error`;

  const verify = (token: string) => {
    if (verifying) return;
    if (token.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code`);
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setStatus(null);
    startVerify(async () => {
      // A correct code redirects on the server; only a wrong one returns.
      const result = await verifyOtp({ email, token, next });
      if (result && !result.ok) {
        setError(result.message);
        // Select the code so the next attempt types straight over it.
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      }
    });
  };

  const resend = () => {
    setError(null);
    setStatus(null);
    startResend(async () => {
      const result = await requestOtp(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCode("");
      setSentAt(Date.now());
      setStatus(`We’ve sent a new code to ${email}.`);
      inputRef.current?.focus();
    });
  };

  return (
    <>
      <p id={subtitleId} className="auth-subtitle">
        Please enter the code we sent to <strong>{email}</strong>.{" "}
        <button type="button" className="link-btn" onClick={onChangeEmail}>
          Change email
        </button>
      </p>

      <form
        method="post"
        className="auth-form"
        noValidate
        aria-busy={verifying}
        onSubmit={(event) => {
          event.preventDefault();
          verify(code);
        }}
      >
        <div>
          <OtpInput
            ref={inputRef}
            id={`${id}-code`}
            label={`${OTP_LENGTH}-digit code`}
            length={OTP_LENGTH}
            value={code}
            autoFocus
            busy={verifying}
            invalid={Boolean(error)}
            describedBy={[subtitleId, error ? errorId : null].filter(Boolean).join(" ")}
            onChange={(value) => {
              // A new complete code — typed, autofilled, or pasted over the
              // last attempt — verifies itself.
              const completed = value.length === OTP_LENGTH && value !== code;
              setCode(value);
              if (error) setError(null);
              if (completed) verify(value);
            }}
          />

          {error ? (
            <p id={errorId} role="alert" className="auth-message">
              <AlertCircle aria-hidden />
              {error}
            </p>
          ) : null}

          <p className="auth-resend">
            <span>Didn’t receive the OTP?</span>
            <button
              type="button"
              className="link-btn"
              onClick={resend}
              disabled={secondsLeft > 0 || resending || verifying}
            >
              {resending
                ? "Sending…"
                : secondsLeft > 0
                  ? `Resend OTP in ${formatCountdown(secondsLeft)}`
                  : "Resend OTP"}
            </button>
          </p>

          {status ? (
            <p role="status" className="auth-status">
              {status}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={verifying}
          className={buttonClass({ variant: "primary", className: "auth-submit" })}
        >
          {verifying ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Verifying…
            </>
          ) : (
            "Verify & log in"
          )}
        </button>
      </form>

      {previewAudience ? (
        <Notice
          status="info"
          className="auth-note"
          title={previewAudience === "dev" ? "No email is sent locally" : "Preview sign-in"}
        >
          {previewAudience === "dev" ? (
            <>
              Supabase isn&rsquo;t configured, so no code goes out. Use{" "}
              <strong>{PREVIEW_OTP}</strong> to sign in.
            </>
          ) : (
            <>
              This preview doesn&rsquo;t send email. Use code <strong>{PREVIEW_OTP}</strong> to
              continue.
            </>
          )}
        </Notice>
      ) : null}
    </>
  );
}

/**
 * Whole seconds until `startedAt + seconds`. Ticks once a second and stops
 * at zero. `startedAt` also floors the clock, so a resend never flashes a
 * countdown longer than the cooldown before the first tick lands.
 */
function useSecondsLeft(startedAt: number, seconds: number): number {
  const [now, setNow] = useState(startedAt);
  const deadline = startedAt + seconds * 1000;

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  return Math.max(0, Math.ceil((deadline - Math.max(now, startedAt)) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

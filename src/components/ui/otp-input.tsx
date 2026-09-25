"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * One-time-code input, drawn as a row of boxes (handoff: six 40px boxes).
 *
 * Underneath it is ONE <input>, not six. `autocomplete="one-time-code"` lets
 * iOS and Android offer the code straight from Mail or Messages, a pasted
 * code lands whole, and a screen reader meets a single labelled field rather
 * than six unlabelled fragments. The boxes only render its value: the input
 * lies over them, transparent, so a tap anywhere on the row focuses it, and
 * the box the next digit will fill shows the focus ring and a caret.
 *
 * The caret is pinned to the end — with the real one invisible, typing into
 * the middle of the code would edit a digit nobody can see. Select-all still
 * works, so after an error the whole code can be typed over.
 */
export function OtpInput({
  id,
  value,
  onChange,
  length = 6,
  invalid,
  busy,
  describedBy,
  label,
  autoFocus,
  ref,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  /** Verifying: the code is read-only until the answer comes back. */
  busy?: boolean;
  describedBy?: string;
  /** Accessible name when no visible <label> points at `id`. */
  label?: string;
  autoFocus?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  const pinCaretToEnd = (input: HTMLInputElement) => {
    const { selectionStart, selectionEnd } = input;
    const end = input.value.length;
    const collapsed = selectionStart === selectionEnd;
    if (collapsed && selectionStart !== end) input.setSelectionRange(end, end);
  };

  return (
    <div className={cn("otp", focused && "focused", invalid && "invalid", busy && "busy")}>
      <input
        ref={ref}
        id={id}
        className="otp-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        readOnly={busy}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={(event) => {
          setFocused(true);
          pinCaretToEnd(event.currentTarget);
        }}
        onBlur={() => setFocused(false)}
        onSelect={(event) => pinCaretToEnd(event.currentTarget)}
      />
      {Array.from({ length }, (_, index) => {
        const digit = value[index];
        const isActive = focused && index === active;
        return (
          <span key={index} aria-hidden className={cn("otp-slot", isActive && "active")}>
            {digit ?? (isActive && !busy ? <span className="otp-caret" /> : null)}
          </span>
        );
      })}
    </div>
  );
}

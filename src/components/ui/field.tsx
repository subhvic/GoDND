"use client";

import { useId } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form atoms (source: the settings drawer's controls).
 *
 * One control language: controls sit quiet on --panel until touched, and all
 * of them share a single focus treatment — a --brand border and the
 * --focus-ring glow. Every control is native: a native <select> opens the
 * platform picker on a phone, which is faster and more accessible than any
 * custom listbox, and operators fill these forms on phones.
 */

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
      {required ? (
        <>
          <span aria-hidden className="req">*</span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="field-error">
      {message}
    </p>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("field", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

type ControlProps = { invalid?: boolean; describedBy?: string };

export function TextInput({
  invalid,
  describedBy,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & ControlProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("input", className)}
    />
  );
}

export function TextArea({
  invalid,
  describedBy,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("textarea", className)}
    />
  );
}

export function Select({
  invalid,
  describedBy,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & ControlProps) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("select has-value", className)}
    >
      {children}
    </select>
  );
}

/** An input with a unit before or after it — ₹, "mins", "guests". */
export function AffixInput({
  prefix,
  suffix,
  invalid,
  describedBy,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> &
  ControlProps & { prefix?: string; suffix?: string }) {
  return (
    <div className={cn("input-wrap", invalid && "border-critical", className)}>
      {prefix ? <span className="input-affix prefix" aria-hidden>{prefix}</span> : null}
      <input {...props} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
      {suffix ? <span className="input-affix suffix" aria-hidden>{suffix}</span> : null}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  describedBy,
  className,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  describedBy?: string;
  className?: string;
}) {
  return (
    <label className={cn("check-row", className)}>
      <input
        type="checkbox"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function RadioGroup<T extends string>({
  legend,
  required,
  value,
  options,
  onChange,
  error,
  inline = true,
}: {
  legend: string;
  required?: boolean;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  error?: string;
  inline?: boolean;
}) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset className="field border-0 p-0 m-0 min-w-0">
      <legend className="field-label mb-[6px] p-0">
        {legend}
        {required ? <span aria-hidden className="req">*</span> : null}
      </legend>
      <div className={cn("choice-group", !inline && "flex-col gap-[8px]")}>
        {options.map((option) => (
          <label key={option.value} className="check-row items-center">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              aria-describedby={error ? errorId : undefined}
              onChange={() => onChange(option.value)}
              className="mt-0"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

/**
 * "Select and add" — picking from the dropdown appends a removable token; the
 * chosen option leaves the list so it cannot be added twice.
 */
export function ChipSelect({
  label,
  required,
  placeholder = "Select and add",
  options,
  value,
  onChange,
  error,
  className,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const available = options.filter((option) => !value.includes(option.value));
  const labelFor = (item: string) =>
    options.find((option) => option.value === item)?.label ?? item;

  return (
    <div className={cn("field", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        value=""
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          if (event.target.value) onChange([...value, event.target.value]);
        }}
        disabled={available.length === 0}
        className="select"
      >
        <option value="">{available.length ? placeholder : "All options added"}</option>
        {available.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {value.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-[6px] p-0">
          {value.map((item) => (
            <li key={item}>
              <span className="token-chip">
                {labelFor(item)}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== item))}
                  aria-label={`Remove ${labelFor(item)}`}
                >
                  <X aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <FieldError id={errorId} message={error} />
    </div>
  );
}

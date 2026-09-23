"use client";

import { useId } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form primitives for the wizard.
 *
 * The handoff file draws label, input and a red asterisk, and nothing else —
 * no error state, no hint, no disabled treatment. Those are added here because
 * a seven-step form that cannot tell you what is wrong is not shippable.
 *
 * Every control is a native element. A native <select> on Android opens the
 * platform picker, which is faster and more accessible than any custom listbox
 * we would write, and operators are filling these on phones.
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
    <label
      htmlFor={htmlFor}
      className="mb-[6px] block text-small font-medium text-neutral-1"
    >
      {children}
      {required ? (
        <>
          <span aria-hidden className="ml-[2px] text-[#d92d20]">
            *
          </span>
          <span className="sr-only-focusable">(required)</span>
        </>
      ) : null}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-[6px] text-small text-[#d92d20]">
      {message}
    </p>
  );
}

export function Hint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-[6px] text-small text-neutral-2">
      {children}
    </p>
  );
}

const controlClass =
  "w-full border border-neutral-4 bg-white px-[12px] py-[10px] text-small text-neutral-1 outline-none transition-colors placeholder:text-neutral-3 focus:border-brand disabled:bg-surface-sunken disabled:text-neutral-2 aria-[invalid=true]:border-[#d92d20]";

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
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function TextInput({
  invalid,
  describedBy,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(controlClass, className)}
    />
  );
}

export function TextArea({
  invalid,
  describedBy,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(controlClass, "min-h-[96px] resize-y", className)}
    />
  );
}

export function Select({
  invalid,
  describedBy,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(controlClass, "appearance-none pr-[36px]", className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-[12px] top-1/2 size-[16px] -translate-y-1/2 text-neutral-2"
      />
    </div>
  );
}

/** Square checkbox with the brand fill, matching the file's checked state. */
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
  const id = useId();
  return (
    <div className={cn("flex items-start gap-[10px]", className)}>
      <span className="relative flex size-[18px] shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
          className="peer size-[18px] cursor-pointer appearance-none border border-neutral-4 bg-white transition-colors checked:border-brand checked:bg-brand"
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute size-[12px] text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      <label
        htmlFor={id}
        className="cursor-pointer text-small leading-[1.35] text-neutral-1"
      >
        {label}
      </label>
    </div>
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
    <fieldset>
      <legend className="mb-[6px] text-small font-medium text-neutral-1">
        {legend}
        {required ? (
          <span aria-hidden className="ml-[2px] text-[#d92d20]">
            *
          </span>
        ) : null}
      </legend>
      <div
        className={cn(
          "flex gap-[24px]",
          inline ? "flex-wrap items-center" : "flex-col",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-[8px] text-small text-neutral-1"
          >
            <span className="relative flex size-[16px] items-center justify-center">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                aria-describedby={error ? errorId : undefined}
                onChange={() => onChange(option.value)}
                className="peer size-[16px] cursor-pointer appearance-none rounded-full border border-neutral-4 bg-white checked:border-brand"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute size-[8px] rounded-full bg-brand opacity-0 peer-checked:opacity-100"
              />
            </span>
            {option.label}
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

/**
 * "Select and Add" — the file's pattern for Region/State, Categories,
 * Languages, Activity Tags and the inclusion lists. Picking from the dropdown
 * appends a removable chip; the chosen option leaves the list so it cannot be
 * added twice.
 */
export function ChipSelect({
  label,
  required,
  placeholder = "Select and Add",
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
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Select
        id={id}
        value=""
        invalid={Boolean(error)}
        describedBy={error ? errorId : undefined}
        onChange={(event) => {
          if (event.target.value) onChange([...value, event.target.value]);
        }}
        disabled={available.length === 0}
      >
        <option value="">
          {available.length ? placeholder : "All options added"}
        </option>
        {available.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      {value.length > 0 ? (
        <ul className="mt-[8px] flex flex-wrap gap-[8px]">
          {value.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center gap-[6px] bg-ink px-[8px] py-[4px] text-small text-white">
                {labelFor(item)}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== item))}
                  aria-label={`Remove ${labelFor(item)}`}
                  className="rounded-full hover:bg-white/20"
                >
                  <X aria-hidden className="size-[12px]" />
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

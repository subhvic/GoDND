"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * A compact select that reads as a chip naming the current choice — the
 * handoff file's "Generic Switch" (Monthly ▾ / Weekly ▾). It is a native
 * <select>, like every other select in the product: a phone opens its own
 * picker, and keyboard and screen-reader support come with the element.
 * The label is visually hidden because the chip sits beside the heading it
 * qualifies, but it is always announced.
 */
export function InlineSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn("inline-select", className)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

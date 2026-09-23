import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored as integer paise. Rendering goes through here so a stray
 * float never reaches a screen an operator quotes from.
 */
export function formatMoney(minor: number | null | undefined, currency = "INR") {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** "7D & 6N", the duration format used throughout the handoff file. */
export function formatDuration(days: number | null, nights: number | null) {
  if (!days) return "—";
  return `${days}D & ${nights ?? Math.max(days - 1, 0)}N`;
}

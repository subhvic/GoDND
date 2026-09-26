import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored as integer paise. Rendering goes through here so a stray
 * float never reaches a screen an operator quotes from.
 */
export function formatMoney(minor: number | null | undefined, currency = "INR", digits = 0) {
  if (minor == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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

/** "4 · Fixed", "8 · Flexible" — the file's group-size cell. */
export function formatGroupSize(size: number | null, sizing: "fixed" | "flexible") {
  if (!size) return "—";
  return `${size} · ${sizing === "fixed" ? "Fixed" : "Flexible"}`;
}

/**
 * A timestamp as "20 Mar 2026" over "9:20 AM", in India time whatever zone
 * the code runs in. Client tables render on the server first, and a time
 * formatted in the server's zone there and the viewer's here would not
 * match — the operators are in India, so the portal reads in IST.
 */
export function formatDateTimeParts(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date),
    time: new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
      .format(date)
      .toUpperCase(),
  };
}

/**
 * Status resolution — the single place a status color is decided.
 *
 * Rule 01 of the system: no component writes a raw color for a status. Every
 * dot, badge and banner asks one of these resolvers for a status key and
 * renders it through a token (var(--critical), .status-dot.critical, …), so
 * the color follows the tokens and the same state never looks two ways.
 *
 * The source's equivalent returns hardcoded hexes from statusColor(), so
 * anything colored through it ignores a token change. statusColor() here
 * returns the CSS variable instead.
 */

export const STATUSES = ["healthy", "warning", "critical", "info", "neutral"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  info: "Info",
  neutral: "No data",
};

export function statusColor(status: Status): string {
  return `var(--${status})`;
}

/**
 * An experience's lifecycle, read as "does this need the operator's
 * attention?" — the one question the green/amber/red scale answers.
 *
 *   active        live and bookable                      → healthy
 *   under_review  submitted, not yet earning             → warning
 *   rejected      blocked until the operator acts        → critical
 *   draft / disabled / archived  not trading, nothing wrong → neutral
 */
export function statusForExperience(state: string): Status {
  switch (state) {
    case "active":
      return "healthy";
    case "under_review":
      return "warning";
    case "rejected":
      return "critical";
    default:
      return "neutral";
  }
}

/**
 * Same shape as statusForExperience: one resolver, one place a booking's
 * status ever picks up a color. Green means "money is coming or here"; amber
 * means the operator has something to do; red means the money moved out; grey
 * is done or set aside.
 */
export function statusForBooking(state: string): Status {
  switch (state) {
    case "paid":
    case "confirmed":
    case "partially_paid":
      return "healthy";
    case "pending_payment":
    case "draft":
      return "warning";
    case "cancelled":
    case "refunded":
      return "critical";
    default:
      return "neutral";
  }
}

export const EXPERIENCE_STATE_LABELS: Record<string, string> = {
  active: "Active",
  under_review: "Under review",
  rejected: "Changes requested",
  draft: "Draft",
  disabled: "Disabled",
  archived: "Archived",
};

/** Worst first — the order lists sort in, so what needs attention leads. */
const SEVERITY_ORDER: Status[] = ["critical", "warning", "healthy", "info", "neutral"];

export function severityRank(status: Status): number {
  return SEVERITY_ORDER.indexOf(status);
}

export function worstStatus(...statuses: Status[]): Status {
  return SEVERITY_ORDER.find((s) => statuses.includes(s)) ?? "neutral";
}

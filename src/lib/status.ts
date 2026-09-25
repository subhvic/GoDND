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

/**
 * An enquiry's pipeline stage. Amber is "nobody has answered this yet", green
 * is a won deal, blue is a conversation in flight, grey is set aside.
 */
export function statusForEnquiry(state: string): Status {
  switch (state) {
    case "new":
      return "warning";
    case "open":
    case "quoted":
    case "negotiating":
      return "info";
    case "won":
      return "healthy";
    default:
      return "neutral";
  }
}

/**
 * How long a traveller has waited for a reply. Replies inside two hours
 * convert best for travel leads; past a day the lead has usually gone cold.
 * The thresholds live here so the list, the thread and any future KPI read
 * the same clock.
 */
export const REPLY_TARGET_MINUTES = 120;
export const REPLY_OVERDUE_MINUTES = 24 * 60;

export function statusForWaiting(minutes: number): Status {
  if (minutes >= REPLY_OVERDUE_MINUTES) return "critical";
  if (minutes >= REPLY_TARGET_MINUTES) return "warning";
  return "neutral";
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

/**
 * A social connection, read as "can this channel publish right now?" — amber
 * once a token is close enough to expiry that a scheduled post could outlive
 * it, red once posting is already broken, grey for a channel never connected
 * (nothing is wrong with an account the operator chose not to link).
 */
export function statusForChannel(state: string): Status {
  switch (state) {
    case "connected":
      return "healthy";
    case "expiring":
      return "warning";
    case "needs_reauth":
      return "critical";
    default:
      return "neutral";
  }
}

/**
 * A post's lifecycle. Green is "it went out", amber is "it is going out and
 * still could be stopped", red is a publish that failed and is losing the
 * slot it was written for.
 */
export function statusForPost(state: string): Status {
  switch (state) {
    case "published":
      return "healthy";
    case "scheduled":
    case "publishing":
      return "warning";
    case "failed":
      return "critical";
    default:
      return "neutral";
  }
}

/** A campaign, read as "is money moving?" — spend is the thing to notice. */
export function statusForCampaign(state: string): Status {
  switch (state) {
    case "active":
      return "healthy";
    case "in_review":
      return "warning";
    default:
      return "neutral";
  }
}

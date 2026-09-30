import type { Status } from "@/lib/status";
import type { ExperienceKind, ExperienceLaneKey, ExperienceRow } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * What a board card says beyond its own fields.
 *
 * The lane already names the state, so a card repeating it ("Draft" on a card
 * in the Drafts lane) is noise. A signal earns its line only when it tells the
 * operator something the lane cannot: that a live experience has nothing left
 * to sell, that a submission has been sitting with GoDND for nine days, that a
 * draft never got a price.
 *
 * Icons are named rather than imported here so this module stays pure — it is
 * the piece the board's behaviour is asserted against.
 */
export type SignalIcon = "alert" | "clock" | "calendar" | "calendar-off" | "unlisted";

export type CardSignal = {
  status: Status;
  icon: SignalIcon;
  text: string;
};

export type BoardCard = {
  row: ExperienceRow;
  signals: CardSignal[];
};

/** Footer lozenge — the full labels are too long for a 248px column. */
export const KIND_SHORT: Record<ExperienceKind, string> = {
  general: "General",
  quick: "Quick",
  super: "Super",
  general_joinee: "Joinee",
};

/**
 * A submission GoDND has not looked at in a week is worth chasing. Below that
 * it is a normal queue and colouring it would cry wolf.
 */
const SLOW_REVIEW_DAYS = 7;

/** Inside this window the date matters less than the countdown. */
const IMMINENT_DAYS = 7;

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, negative if `to` is behind. */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function agoPhrase(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function plural(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function signalsFor(
  row: ExperienceRow,
  lane: ExperienceLaneKey,
  now: Date,
): CardSignal[] {
  const signals: CardSignal[] = [];
  const touched = row.updatedAt ? wholeDaysBetween(new Date(row.updatedAt), now) : null;

  switch (lane) {
    case "active": {
      if (!row.nextAvailableOn) {
        // Live, listed, and unbookable. The seven-column table had no cell
        // for this: it showed an em dash under "Next availability" and left
        // the operator to notice.
        signals.push({
          status: "warning",
          icon: "calendar-off",
          text: "No open departures",
        });
      } else {
        const days = wholeDaysBetween(now, new Date(row.nextAvailableOn));
        signals.push(
          days <= IMMINENT_DAYS
            ? {
                status: "info",
                icon: "calendar",
                text:
                  days <= 0
                    ? "Departs today"
                    : days === 1
                      ? "Departs tomorrow"
                      : `Departs in ${plural(days)}`,
              }
            : {
                status: "neutral",
                icon: "calendar",
                text: `Next ${formatDate(row.nextAvailableOn)}`,
              },
        );
      }

      if (!row.listOnMarketplace) {
        signals.push({
          status: "neutral",
          icon: "unlisted",
          text: "Direct bookings only",
        });
      }
      break;
    }

    case "under_review": {
      if (touched === null) break;
      signals.push({
        status: touched > SLOW_REVIEW_DAYS ? "warning" : "neutral",
        icon: "clock",
        text: touched <= 0 ? "Sent today" : `Waiting ${plural(touched)}`,
      });
      break;
    }

    case "rejected": {
      if (touched === null) break;
      signals.push({
        status: "critical",
        icon: "alert",
        text: `Returned ${agoPhrase(touched)}`,
      });
      break;
    }

    case "draft": {
      // A draft with no price cannot be submitted, so it is the one thing
      // worth naming before the operator opens it.
      if (row.basePriceMinor == null) {
        signals.push({ status: "warning", icon: "alert", text: "No price set" });
      }
      if (touched !== null) {
        signals.push({ status: "neutral", icon: "clock", text: `Edited ${agoPhrase(touched)}` });
      }
      break;
    }

    // Disabled and archived are resting states. Nothing is pending on them,
    // so their cards stay quiet.
    default:
      break;
  }

  return signals;
}

export function toBoardCards(
  lanes: Record<ExperienceLaneKey, ExperienceRow[]>,
  now: Date = new Date(),
): Record<ExperienceLaneKey, BoardCard[]> {
  return Object.fromEntries(
    (Object.keys(lanes) as ExperienceLaneKey[]).map((lane) => [
      lane,
      lanes[lane].map((row) => ({ row, signals: signalsFor(row, lane, now) })),
    ]),
  ) as Record<ExperienceLaneKey, BoardCard[]>;
}

"use client";

import {
  AlertTriangle,
  CalendarDays,
  CalendarX,
  Clock,
  EyeOff,
  MapPin,
  type LucideIcon,
} from "lucide-react";

import { KIND_SHORT, type BoardCard, type SignalIcon } from "@/lib/experiences/board";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

const SIGNAL_ICONS: Record<SignalIcon, LucideIcon> = {
  alert: AlertTriangle,
  clock: Clock,
  calendar: CalendarDays,
  "calendar-off": CalendarX,
  unlisted: EyeOff,
};

/**
 * One experience, as a board card.
 *
 * Four things, in the order an operator scans them: what it is, where and how
 * long, anything pending on it, and what it sells for. Group size, parallel
 * groups and the rest of the seven columns moved into the drawer — they are
 * details you read once you have picked a card, not ones you pick a card by.
 *
 * The card opens through the button in its title rather than a click handler
 * on the article alone: a div that only responds to a mouse is not an
 * affordance, it is a trap. The article's handler is a convenience on top.
 */
export function ExperienceCard({
  card,
  selected,
  onOpen,
}: {
  card: BoardCard;
  selected: boolean;
  onOpen: () => void;
}) {
  const { row, signals } = card;
  const where = row.location.join(", ");

  return (
    <article className={cn("xp-card", selected && "is-selected")} onClick={onOpen}>
      <h3 className="xp-card-title">
        <button
          type="button"
          className="xp-card-open"
          aria-expanded={selected}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {row.title}
        </button>
      </h3>

      <p className="xp-card-meta">
        <span>{formatDuration(row.durationDays, row.durationNights)}</span>
        {where ? (
          <span className="xp-card-where">
            <MapPin aria-hidden />
            <span className="truncate">{where}</span>
          </span>
        ) : null}
      </p>

      {signals.length > 0 ? (
        <ul className="xp-card-signals">
          {signals.map((signal) => {
            const Icon = SIGNAL_ICONS[signal.icon];
            return (
              <li key={signal.text} className={cn("xp-signal", signal.status)}>
                <Icon aria-hidden />
                {signal.text}
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="xp-card-foot">
        <span className="xp-card-kind">{KIND_SHORT[row.kind]}</span>
        <span className="xp-card-ref">
          <span className="sr-only">Reference </span>EXP-{row.publicRef}
        </span>
        <span className="xp-card-price">
          <span className="sr-only">Base price </span>
          {formatMoney(row.basePriceMinor, row.currency)}
        </span>
      </p>
    </article>
  );
}

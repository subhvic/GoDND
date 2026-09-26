"use client";

import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status";
import {
  balanceMinor,
  guestCount,
  lastDay,
  markerForBooking,
  phaseForBooking,
  tripDay,
} from "@/lib/bookings/phase";
import { formatDayRange, formatRelativeDay } from "@/lib/time";
import { BOOKING_TABS, type BookingRow, type BookingTabKey } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const TAB_LABELS = Object.fromEntries(BOOKING_TABS.map((entry) => [entry.key, entry.label])) as Record<
  BookingTabKey,
  string
>;

/**
 * The Bookings list (mirrors ExperiencesTable). Seven columns, all
 * associated to headers so a screen reader reads the row correctly, and the
 * row-name button opens the drawer through a real focusable control rather
 * than a fake <tr onClick>. Numerics right-align so amounts compare down the
 * column. The departure column says where the trip is in time — "in 6
 * days", "Day 2 of 4", "ended 2 days ago" — because that is what an
 * operator scans it for.
 */
export function BookingsTable({
  rows,
  tab,
  search,
  today,
  selectedId,
  movedId,
  onOpen,
}: {
  rows: BookingRow[];
  tab: BookingTabKey;
  search: string;
  today: string;
  selectedId: string | null;
  movedId: string | null;
  onOpen: (id: string) => void;
}) {
  const now = new Date(`${today}T12:00:00+05:30`);

  return (
    <Panel title="Bookings" hint={search ? `matching "${search}"` : TAB_HINT[tab]}>
      <div className="booking-list">
        <div className="booking-table-wrap overflow-x-auto">
          <table className="data-table min-w-[920px]">
            <caption className="sr-only">
              {TAB_LABELS[tab]} bookings{search ? `, matching "${search}"` : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col">Guest &amp; reference</th>
                <th scope="col" className="left">Experience</th>
                <th scope="col">Dates</th>
                <th scope="col">Guests</th>
                <th scope="col">Total</th>
                <th scope="col">Paid</th>
                <th scope="col" className="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={7}>
                    <Empty tab={tab} search={search} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const marker = markerForBooking(row, today);
                  const phase = phaseForBooking(row, today);
                  const moved = row.id === movedId && phase !== tab;
                  const due = balanceMinor(row);
                  const guests = guestCount(row);
                  return (
                    <tr
                      key={row.id}
                      className={cn("clickable", row.id === selectedId && "selected")}
                      onClick={() => onOpen(row.id)}
                    >
                      <th scope="row" className="max-w-[300px]">
                        <span className="row-name">
                          <StatusDot status={marker.status} label={marker.label} />
                          <span className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="row-name-btn truncate text-[12.5px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpen(row.id);
                              }}
                            >
                              {row.leadName}
                            </button>
                            <span className="block text-[10.5px] text-text-muted">
                              {row.reference}
                              {row.isMarketplace ? " · Marketplace" : " · Own site"}
                            </span>
                          </span>
                        </span>
                      </th>
                      <td className="left max-w-[240px] truncate">{row.experienceTitle}</td>
                      <td>
                        <span className="cell-stack">
                          <span className="text-text-primary">
                            {row.travelStart ? formatDayRange(row.travelStart, row.travelEnd, now) : "—"}
                          </span>
                          <span className={cn("cell-sub", phase === "ongoing" && "text-brand-on-muted font-medium")}>
                            {whenLabel(row, today, now)}
                          </span>
                        </span>
                      </td>
                      <td>
                        {guests}
                        {row.children + row.infants > 0 ? (
                          <span className="ml-[4px] text-text-muted">
                            ({row.adults}A{row.children ? ` · ${row.children}C` : ""}
                            {row.infants ? ` · ${row.infants}I` : ""})
                          </span>
                        ) : null}
                      </td>
                      <td className="primary font-medium">{formatMoney(row.totalMinor, row.currency)}</td>
                      <td>
                        <span className="cell-stack">
                          <span>{formatMoney(row.paidMinor, row.currency)}</span>
                          {due > 0 && row.paidMinor > 0 ? (
                            <span className="cell-sub text-warning-fg">{formatMoney(due, row.currency)} due</span>
                          ) : null}
                          {row.refundOwedMinor > 0 ? (
                            <span className="cell-sub text-warning-fg">
                              {formatMoney(row.refundOwedMinor, row.currency)} to refund
                            </span>
                          ) : row.refundedMinor > 0 ? (
                            <span className="cell-sub text-critical-fg">
                              {formatMoney(row.refundedMinor, row.currency)} refunded
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="left">
                        {moved ? (
                          <span className="booking-moved">Moved to {TAB_LABELS[phase]}</span>
                        ) : (
                          <span className={cn("badge", marker.status)}>{marker.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rows.length ? (
          <BookingCards rows={rows} tab={tab} today={today} selectedId={selectedId} movedId={movedId} onOpen={onOpen} />
        ) : (
          <div className="booking-cards">
            <Empty tab={tab} search={search} />
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * The same list as cards, for when the panel is too narrow for seven
 * columns (phones, and tablets with the rail open). A container query in
 * bookings.css swaps them, so the switch follows the space the list
 * actually has rather than the window. Each card leads with what the
 * status column says on desktop — on a phone that column would be the one
 * scrolled out of sight.
 */
function BookingCards({
  rows,
  tab,
  today,
  selectedId,
  movedId,
  onOpen,
}: {
  rows: BookingRow[];
  tab: BookingTabKey;
  today: string;
  selectedId: string | null;
  movedId: string | null;
  onOpen: (id: string) => void;
}) {
  const now = new Date(`${today}T12:00:00+05:30`);
  return (
    <ul className="booking-cards" aria-label={`${TAB_LABELS[tab]} bookings`}>
      {rows.map((row) => {
        const marker = markerForBooking(row, today);
        const phase = phaseForBooking(row, today);
        const moved = row.id === movedId && phase !== tab;
        const due = balanceMinor(row);
        const when = whenLabel(row, today, now);
        const nameId = `booking-card-${row.id}`;
        const metaId = `${nameId}-meta`;
        return (
          <li key={row.id}>
            <button
              type="button"
              className={cn("booking-card", row.id === selectedId && "selected")}
              aria-labelledby={nameId}
              aria-describedby={metaId}
              onClick={() => onOpen(row.id)}
            >
              <span className="booking-card-head">
                <StatusDot status={marker.status} label={marker.label} />
                <span id={nameId} className="booking-card-name">
                  {row.leadName}
                </span>
                {moved ? (
                  <span className="booking-moved">Moved to {TAB_LABELS[phase]}</span>
                ) : (
                  <span className={cn("badge", marker.status)}>{marker.label}</span>
                )}
              </span>
              <span id={metaId} className="booking-card-body">
                <span className="booking-card-title">{row.experienceTitle}</span>
                <span className="booking-card-row">
                  <span className="min-w-0">
                    <span className="text-text-primary">
                      {row.travelStart ? formatDayRange(row.travelStart, row.travelEnd, now) : "No dates"}
                    </span>
                    {when ? (
                      <span className={cn(phase === "ongoing" ? "text-brand-on-muted font-medium" : "text-text-muted")}>
                        {" · "}
                        {when}
                      </span>
                    ) : null}
                  </span>
                  <span className="booking-card-money">{formatMoney(row.totalMinor, row.currency)}</span>
                </span>
                <span className="booking-card-row text-text-muted">
                  <span className="min-w-0 truncate">
                    {row.reference} · {row.isMarketplace ? "Marketplace" : "Own site"} · {guestCount(row)}{" "}
                    {guestCount(row) === 1 ? "guest" : "guests"}
                  </span>
                  {row.refundOwedMinor > 0 ? (
                    <span className="shrink-0 text-warning-fg">{formatMoney(row.refundOwedMinor, row.currency)} to refund</span>
                  ) : due > 0 && row.paidMinor > 0 ? (
                    <span className="shrink-0 text-warning-fg">{formatMoney(due, row.currency)} due</span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ tab, search }: { tab: BookingTabKey; search: string }) {
  return (
    <EmptyState
      icon={CalendarCheck}
      title={search ? `No ${TAB_LABELS[tab].toLowerCase()} bookings match "${search}"` : EMPTY_COPY[tab].title}
      description={
        search ? "Try a name, a phone number, or a booking reference — or another tab." : EMPTY_COPY[tab].description
      }
    />
  );
}

/** Where the trip is in time — what an operator scans the dates for. */
function whenLabel(row: BookingRow, today: string, now: Date): string {
  const phase = phaseForBooking(row, today);
  if (phase === "ongoing") {
    const day = tripDay(row, today);
    return day ? `Day ${day.day} of ${day.of}` : "";
  }
  if ((phase === "upcoming" || phase === "awaiting") && row.travelStart) {
    return `Starts ${formatRelativeDay(row.travelStart, now)}`;
  }
  const end = lastDay(row);
  if (phase === "completed" && end) return `Ended ${formatRelativeDay(end, now)}`;
  return "";
}

const TAB_HINT: Record<BookingTabKey, string> = {
  awaiting: "checkout started, not paid — nearest departure first",
  upcoming: "confirmed, before departure — nearest first",
  ongoing: "on the road today — ending soonest first",
  completed: "trips that have run — wrap-ups first",
  cancelled: "cancelled or refunded — refunds owed first",
};

const EMPTY_COPY: Record<BookingTabKey, { title: string; description: string }> = {
  awaiting: {
    title: "No payments pending",
    description: "Bookings where the guest started checkout but hasn't paid yet appear here.",
  },
  upcoming: {
    title: "No upcoming bookings",
    description:
      "New bookings appear here as soon as a guest pays. Marketplace and own-site bookings both land in this list.",
  },
  ongoing: {
    title: "Nobody is on a trip today",
    description:
      "A booking moves here on its first day and stays until its last — check guests in and log updates from its drawer.",
  },
  completed: {
    title: "Nothing completed yet",
    description: "Trips land here once their last day has passed. Close each one out to send the review request.",
  },
  cancelled: {
    title: "No cancellations",
    description: "Cancelled and refunded bookings are kept here so you can look up why a trip did not run.",
  },
};

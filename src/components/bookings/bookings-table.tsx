"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import { fetchBookingDetail } from "@/app/dashboard/bookings/actions";
import { BookingDrawer } from "@/components/bookings/booking-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status";
import { statusForBooking } from "@/lib/status";
import {
  BOOKING_STATUS_LABELS,
  type BookingDetail,
  type BookingRow,
  type BookingTabKey,
} from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

/**
 * The Bookings list (mirrors ExperiencesTable). Seven columns, all associated
 * to headers so a screen reader reads the row correctly, and the row-name
 * button opens the drawer through a real focusable control rather than a
 * fake <tr onClick>. Numerics right-align so amounts and counts compare down
 * the column.
 */
export function BookingsTable({
  rows,
  tab,
  search,
}: {
  rows: BookingRow[];
  tab: BookingTabKey;
  search: string;
}) {
  const [open, setOpen] = useState<{
    id: string;
    promise: Promise<BookingDetail | null>;
  } | null>(null);

  return (
    <>
      <Panel
        title="Bookings"
        hint={search ? `matching "${search}"` : TAB_HINT[tab]}
      >
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <caption className="sr-only">
              {tab} bookings{search ? `, matching "${search}"` : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col">Guest &amp; reference</th>
                <th scope="col" className="left">Experience</th>
                <th scope="col">Departure</th>
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
                    <EmptyState
                      icon={CalendarCheck}
                      title={search ? `No bookings match "${search}"` : EMPTY_COPY[tab].title}
                      description={
                        search
                          ? "Try a name, a phone number, or a booking reference."
                          : EMPTY_COPY[tab].description
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const status = statusForBooking(row.status);
                  const selected = open?.id === row.id;
                  const totalGuests = row.adults + row.children + row.infants;
                  return (
                    <tr
                      key={row.id}
                      className={cn("clickable", selected && "selected")}
                      onClick={() =>
                        setOpen({ id: row.id, promise: fetchBookingDetail(row.id) })
                      }
                    >
                      <th scope="row" className="max-w-[320px]">
                        <span className="row-name">
                          <StatusDot status={status} label={BOOKING_STATUS_LABELS[row.status]} />
                          <span className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="row-name-btn truncate text-[12.5px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpen({ id: row.id, promise: fetchBookingDetail(row.id) });
                              }}
                            >
                              {row.leadName}
                            </button>
                            <span className="block text-[10.5px] text-text-muted">
                              {row.reference}
                              {row.isMarketplace ? " · Marketplace" : " · Operator-direct"}
                            </span>
                          </span>
                        </span>
                      </th>
                      <td className="left truncate max-w-[240px]">{row.experienceTitle}</td>
                      <td>{row.travelStart ? formatDate(row.travelStart) : "—"}</td>
                      <td>
                        {totalGuests}
                        {row.children + row.infants > 0 ? (
                          <span className="ml-[4px] text-text-muted">
                            ({row.adults}A
                            {row.children ? ` · ${row.children}C` : ""}
                            {row.infants ? ` · ${row.infants}I` : ""})
                          </span>
                        ) : null}
                      </td>
                      <td className="primary font-medium">
                        {formatMoney(row.totalMinor, row.currency)}
                      </td>
                      <td>
                        {formatMoney(row.paidMinor, row.currency)}
                        {row.paidMinor > 0 && row.paidMinor < row.totalMinor ? (
                          <span className="ml-[4px] text-[10.5px] text-warning-fg">
                            · balance due
                          </span>
                        ) : null}
                        {row.refundedMinor > 0 ? (
                          <span className="ml-[4px] text-[10.5px] text-critical-fg">
                            · refunded
                          </span>
                        ) : null}
                      </td>
                      <td className="left">
                        <span className={cn("badge", status)}>
                          {BOOKING_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {open ? (
        <BookingDrawer
          detailPromise={open.promise}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

const TAB_HINT: Record<BookingTabKey, string> = {
  upcoming: "confirmed and part-paid — future departures",
  awaiting: "waiting on payment before a departure is held",
  completed: "trip has run",
  cancelled: "cancelled or refunded",
};

const EMPTY_COPY: Record<BookingTabKey, { title: string; description: string }> = {
  upcoming: {
    title: "No upcoming bookings",
    description:
      "New bookings appear here as soon as a guest pays. Marketplace and own-site bookings both land in this list.",
  },
  awaiting: {
    title: "No payments pending",
    description:
      "Bookings where the guest started checkout but has not paid yet appear here.",
  },
  completed: {
    title: "Nothing completed yet",
    description:
      "Bookings move here on the day after the trip ends, once a review request is sent.",
  },
  cancelled: {
    title: "No cancellations",
    description:
      "Cancelled and refunded bookings are kept here so you can look up why a trip did not run.",
  },
};

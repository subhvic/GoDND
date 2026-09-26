"use client";

import { CalendarCheck } from "lucide-react";

import { useHomeRecords } from "@/components/home/home-records";
import { RouteLine } from "@/components/home/route-line";
import { SectionHead } from "@/components/home/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { phaseForBooking, tripDay } from "@/lib/bookings/phase";
import type { LatestBookingRow } from "@/lib/types";
import { cn, formatDate, formatDateTimeParts } from "@/lib/utils";

/**
 * "Latest bookings" — the four most recent, as the handoff file draws them:
 * who booked, where the trip goes (state over pick-up → drop), when they
 * booked (date over time), and when the trip starts. A name opens the same
 * booking drawer the Bookings list uses.
 */
export function LatestBookings({ rows, today }: { rows: LatestBookingRow[]; today: string }) {
  const { openId, openBooking } = useHomeRecords();

  return (
    <section className="home-section" aria-labelledby="home-bookings-title">
      <SectionHead
        id="home-bookings-title"
        title="Latest bookings"
        link={{ label: "See all bookings", href: "/dashboard/bookings" }}
      />

      <div className="panel">
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No bookings yet"
            description="Bookings from the marketplace and your own site land here the moment a guest books."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[500px]">
              <caption className="sr-only">The {rows.length} most recent bookings</caption>
              <thead>
                <tr>
                  <th scope="col">Booked by</th>
                  <th scope="col" className="left">
                    Location
                  </th>
                  <th scope="col">Booked on</th>
                  <th scope="col">Trip starts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const bookedOn = formatDateTimeParts(row.createdAt);
                  const selected = openId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={cn("clickable", selected && "selected")}
                      onClick={() => openBooking(row.id)}
                    >
                      <th scope="row" className="max-w-[180px]">
                        <button
                          type="button"
                          className="row-name-btn block max-w-full truncate text-[12.5px] font-medium"
                          aria-expanded={selected}
                          onClick={(event) => {
                            event.stopPropagation();
                            openBooking(row.id);
                          }}
                        >
                          {row.leadName}
                        </button>
                        <span className="block text-[10.5px] font-normal text-text-muted">
                          {row.reference}
                        </span>
                      </th>
                      <td className="left">
                        <span className="cell-stack">
                          <span className="text-text-primary">{row.location.join(", ") || "—"}</span>
                          {row.route ? <RouteLine route={row.route} /> : null}
                        </span>
                      </td>
                      <td>
                        {bookedOn ? (
                          <span className="cell-stack">
                            <span className="text-text-primary">{bookedOn.date}</span>
                            <span className="cell-sub">{bookedOn.time}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-text-primary">
                        <TripStart row={row} today={today} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * "Trip starts" — except for a trip already under way, which says so: a
 * booking on the road today is the one row on Home an operator most needs
 * to tell apart.
 */
function TripStart({ row, today }: { row: LatestBookingRow; today: string }) {
  const day = phaseForBooking(row, today) === "ongoing" ? tripDay(row, today) : null;
  if (!day) return <>{formatDate(row.travelStart)}</>;
  return (
    <span className="cell-stack">
      <span className="badge info">On trip</span>
      <span className="cell-sub">
        Day {day.day} of {day.of}
      </span>
    </span>
  );
}

"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Star } from "lucide-react";

import { SectionHead } from "@/components/home/section-head";
import { InlineSelect } from "@/components/ui/inline-select";
import { FUNNEL_PERIODS, type FunnelFigures, type FunnelPeriod } from "@/lib/types";

/**
 * "My experience funnel" — the handoff file's six tiles, in its order:
 * supply, demand, the reservations that fell through, the trips that ran,
 * what guests said, and the paid bookings that were lost.
 *
 * Every figure is for the window in the chip, and every caption says what
 * the figure is measured against — a number never stands alone. All three
 * windows arrive with the page, so switching is instant.
 */
export function ExperienceFunnel({
  figures,
}: {
  figures: Record<FunnelPeriod, FunnelFigures>;
}) {
  const [period, setPeriod] = useState<FunnelPeriod>("30d");
  const current = figures[period];
  const days = FUNNEL_PERIODS.find((entry) => entry.key === period)?.days ?? 30;

  const tiles: { label: string; value: number; note: React.ReactNode }[] = [
    {
      label: "Active experiences",
      value: current.activeExperiences,
      note: current.newlyActive
        ? `${current.newlyActive} newly added`
        : "None added in this window",
    },
    {
      label: "Reservations made",
      value: current.reservationsMade,
      note: <Growth now={current.reservationsMade} before={current.reservationsMadePrevious} days={days} />,
    },
    {
      label: "Reservations cancelled",
      value: current.reservationsCancelled,
      note: ratio(current.reservationsCancelled, current.reservationsMade, "reservations"),
    },
    {
      label: "Bookings completed",
      value: current.bookingsCompleted,
      note: <Growth now={current.bookingsCompleted} before={current.bookingsCompletedPrevious} days={days} />,
    },
    {
      label: "Reviews received",
      value: current.reviewsReceived,
      note:
        current.averageRating != null ? (
          <>
            Avg. rating {current.averageRating.toFixed(1)}
            <Star aria-hidden className="star" fill="currentColor" />
          </>
        ) : (
          "No ratings yet"
        ),
    },
    {
      label: "Bookings cancelled",
      value: current.bookingsCancelled,
      note: ratio(current.bookingsCancelled, current.bookingsCompleted, "bookings"),
    },
  ];

  return (
    <section className="home-section" aria-labelledby="home-funnel-title">
      <SectionHead
        id="home-funnel-title"
        title="My experience funnel"
        control={
          <InlineSelect
            label="Funnel period"
            value={period}
            onChange={setPeriod}
            options={FUNNEL_PERIODS.map((entry) => ({ value: entry.key, label: entry.label }))}
          />
        }
        link={{ label: "See all insights", unavailable: "Insights isn’t built yet" }}
      />

      <ul className="stat-group" aria-live="polite">
        {tiles.map((tile) => (
          <li key={tile.label} className="stat-tile">
            <span className="stat-tile-label">{tile.label}</span>
            <span className="stat-tile-value">{tile.value.toLocaleString("en-IN")}</span>
            <span className="stat-tile-note">{tile.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "+81% vs prior 30 days". Up is good for both tiles that carry it
 * (reservations, completed trips), so direction alone picks the colour —
 * and the arrow and sign say it again for anyone who can't see colour.
 */
function Growth({ now, before, days }: { now: number; before: number; days: number }) {
  const against = `vs prior ${days} days`;
  if (before === 0) {
    return <>{now === 0 ? "No change" : "Up from none"} {against}</>;
  }
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <>No change {against}</>;

  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span className={up ? "up" : "down"}>
        <Icon aria-hidden className="inline align-[-2px]" />
        {up ? "+" : "−"}
        {Math.abs(change)}%
      </span>
      {against}
    </>
  );
}

/** "1 in 44 reservations" — how rare a cancellation is, in whole terms. */
function ratio(cancelled: number, base: number, noun: string) {
  if (cancelled === 0) return "None cancelled";
  if (base === 0) return `No new ${noun} to compare`;
  return `1 in ${Math.max(1, Math.round(base / cancelled))} ${noun}`;
}

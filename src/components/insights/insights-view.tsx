"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Star } from "lucide-react";

import { ValueChart } from "@/components/insights/value-chart";
import { buttonClass } from "@/components/ui/button";
import { InlineSelect } from "@/components/ui/inline-select";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageBar } from "@/components/ui/page-bar";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/status";
import {
  INSIGHT_PERIODS,
  type Comparable,
  type InsightPeriod,
  type InsightsReport,
  type PeriodReport,
} from "@/lib/insights/report";
import type { Status } from "@/lib/status";
import { EXPERIENCE_STATE_LABELS } from "@/lib/status";
import { cn, formatMoney } from "@/lib/utils";

/**
 * Insights (handoff: the Insights frame, which Home's "See all insights"
 * and "See details" lead to). The findings sit above the numbers, as on
 * Performance: an operator opens this to learn whether anything needs
 * them, and the numbers underneath let every finding be checked.
 */
export function InsightsView({ report, initialPeriod }: { report: InsightsReport; initialPeriod: InsightPeriod }) {
  const [period, setPeriod] = useState<InsightPeriod>(initialPeriod);
  const current = report.periods[period];

  const choose = (next: InsightPeriod) => {
    setPeriod(next);
    // The period is view state, but a shared link should open on it too.
    const url = new URL(window.location.href);
    url.searchParams.set("period", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      <PageBar
        crumbs={[{ label: "Website" }, { label: "Insights" }]}
        actions={
          <InlineSelect
            label="Period"
            value={period}
            onChange={choose}
            options={INSIGHT_PERIODS.map((entry) => ({ value: entry.key, label: entry.label }))}
          />
        }
      />

      <div className="body-scroll">
        <div className="insights">
          <p className="sr-only" aria-live="polite">
            Showing {current.label.toLowerCase()}, {current.rangeLabel}.
          </p>
          <Headline report={current} />
          <Actions report={current} />
          <ValueChart report={current} />
          <div className="insights-split">
            <Sources report={current} />
            <Reviews report={current} unanswered={report.unanswered.count} />
          </div>
          <ExperienceTable report={current} />
          {report.isDemoData ? (
            <p className="m-0 field-hint">
              Sample figures for a preview workspace. Real ones appear once bookings are taken through GoDND.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------------------
 * Headline
 * ----------------------------------------------------------------------- */

function change({ value, previous }: Comparable) {
  if (previous === 0) return value === 0 ? "no change" : "new this period";
  const delta = (value - previous) / previous;
  const rounded = Math.round(delta * 100);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}%`;
}

/** Amber when a number fell by more than a tenth; otherwise calm. */
const direction = ({ value, previous }: Comparable): Status =>
  previous > 0 && value < previous * 0.9 ? "warning" : "healthy";

function Headline({ report }: { report: PeriodReport }) {
  const kept = report.bookings.value - report.cancellations.cancelled;
  const perBooking = kept > 0 ? (report.guests.value / kept).toFixed(1) : "0";
  const rate = report.cancellations.rate;
  const rateStatus: Status = rate >= 0.15 ? "critical" : rate >= 0.08 ? "warning" : "healthy";

  return (
    <section aria-label="Headline figures" className="insights-kpis">
      <KpiCard
        label="Booking value"
        value={formatMoney(report.valueMinor.value)}
        status={direction(report.valueMinor)}
        comparison={`${change(report.valueMinor)} vs ${report.previousLabel}`}
        trend={report.series.map((point) => point.valueMinor)}
      />
      <KpiCard
        label="Bookings made"
        value={report.bookings.value.toLocaleString("en-IN")}
        status={direction(report.bookings)}
        comparison={`${change(report.bookings)} vs ${report.previousLabel}`}
        trend={report.series.map((point) => point.bookings)}
      />
      <KpiCard
        label="Guests"
        value={report.guests.value.toLocaleString("en-IN")}
        status={direction(report.guests)}
        comparison={`${perBooking} a booking · ${change(report.guests)} vs ${report.previousLabel}`}
        trend={report.series.map((point) => point.guests)}
      />
      <KpiCard
        label="Cancellation rate"
        value={(rate * 100).toFixed(1)}
        unit="%"
        status={rateStatus}
        comparison={`${report.cancellations.cancelled} of ${report.cancellations.made} bookings · ${(
          report.cancellations.previousRate * 100
        ).toFixed(1)}% before`}
      />
    </section>
  );
}

/* --------------------------------------------------------------------------
 * What to act on
 * ----------------------------------------------------------------------- */

function Actions({ report }: { report: PeriodReport }) {
  return (
    <Panel title="What to act on" hint="each one names the numbers behind it">
      <div className="panel-body pt-0">
        {report.actions.length === 0 ? (
          <p className="m-0 text-[12.5px] text-text-muted">
            Nothing needs you. Every live experience is selling and every review has a reply.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {report.actions.map((action) => (
              // On a narrow card the button drops under the finding rather
              // than squeezing it into a column of three words a line.
              <li key={action.id} className="action-row @max-[520px]:flex-wrap">
                <span aria-hidden className={cn("action-dot", action.severity)} />
                <div className="min-w-0 flex-1 @max-[520px]:basis-[calc(100%-20px)]">
                  <p className="action-title m-0">{action.title}</p>
                  <p className="action-evidence m-0">{action.evidence}</p>
                </div>
                {action.action ? (
                  <Link
                    href={action.action.href}
                    className={cn(buttonClass({ size: "small" }), "shrink-0 @max-[520px]:ml-[18px]")}
                  >
                    {action.action.label}
                    <ArrowRight aria-hidden />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * Sources and reviews
 * ----------------------------------------------------------------------- */

function Sources({ report }: { report: PeriodReport }) {
  const { marketplace, direct } = report.sources;
  const total = marketplace.valueMinor + direct.valueMinor;
  const share = (value: number) => (total > 0 ? value / total : 0);
  const rows = [
    { key: "marketplace", label: "GoDND marketplace", color: "var(--chart-1)", ...marketplace },
    { key: "direct", label: "Your own channels", color: "var(--chart-2)", ...direct },
  ];
  const enquiryRate = report.enquiries.total ? report.enquiries.won / report.enquiries.total : 0;

  return (
    <Panel title="Where bookings come from" hint="by booking value">
      <div className="panel-body pt-[4px]">
        {total > 0 ? (
          <div className="split-bar" role="img" aria-label={`Marketplace ${Math.round(share(marketplace.valueMinor) * 100)}%, your own channels ${Math.round(share(direct.valueMinor) * 100)}%`}>
            {rows.map((row) =>
              row.valueMinor > 0 ? (
                <span key={row.key} style={{ flexGrow: row.valueMinor, background: row.color }} />
              ) : null,
            )}
          </div>
        ) : null}
        <ul className="source-list">
          {rows.map((row) => (
            <li key={row.key}>
              <span aria-hidden className="chart-key" style={{ background: row.color }} />
              <span className="source-name">{row.label}</span>
              <span className="source-num">{Math.round(share(row.valueMinor) * 100)}%</span>
              <span className="source-sub">
                {formatMoney(row.valueMinor)} · {row.bookings} booking{row.bookings === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
        <p className="insights-foot">
          <strong>{report.enquiries.total.toLocaleString("en-IN")}</strong> enquiries,{" "}
          {Math.round(enquiryRate * 100)}% won ·{" "}
          {change({ value: report.enquiries.total, previous: report.enquiries.previousTotal })} vs {report.previousLabel}
          <Link href="/dashboard/enquiries" className="see-all ml-auto">
            Enquiries
            <ArrowRight aria-hidden />
          </Link>
        </p>
      </div>
    </Panel>
  );
}

function Reviews({ report, unanswered }: { report: PeriodReport; unanswered: number }) {
  const { count, average, previousAverage, distribution } = report.reviews;
  const most = Math.max(1, ...distribution);

  return (
    <Panel title="Guest reviews" hint={`${count} in the period`}>
      <div className="panel-body pt-[4px]">
        {count === 0 ? (
          <p className="m-0 text-[12.5px] text-text-muted">No reviews in this period.</p>
        ) : (
          <div className="review-summary">
            <div className="review-score">
              <span className="review-avg">{average?.toFixed(1)}</span>
              <Star aria-hidden className="review-star" />
              <span className="review-was">
                {previousAverage !== null ? `was ${previousAverage.toFixed(1)}` : "first reviews"}
              </span>
            </div>
            <ul className="review-bars" aria-label="Reviews by rating">
              {distribution.map((value, index) => (
                <li key={index}>
                  <span className="review-bar-label">{5 - index} ★</span>
                  <span className="review-meter" aria-hidden>
                    <span style={{ width: `${(value / most) * 100}%` }} />
                  </span>
                  <span className="review-bar-count">
                    {value}
                    <span className="sr-only"> {5 - index}-star reviews</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="insights-foot">
          {unanswered > 0 ? (
            <>
              <Badge status="warning">{unanswered}</Badge> waiting for a reply
            </>
          ) : (
            "Every review has a reply."
          )}
          <Link
            href={unanswered > 0 ? "/dashboard/insights/reviews" : "/dashboard/insights/reviews?view=all"}
            className="see-all ml-auto"
          >
            All reviews
            <ArrowRight aria-hidden />
          </Link>
        </p>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
 * By experience
 * ----------------------------------------------------------------------- */

function ExperienceTable({ report }: { report: PeriodReport }) {
  return (
    <Panel title="By experience" hint="best value first">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <caption className="sr-only">Performance by experience, {report.rangeLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Experience</th>
              <th scope="col">Bookings</th>
              <th scope="col">Guests</th>
              <th scope="col">Booking value</th>
              <th scope="col" className="left">Share</th>
              <th scope="col">Cancelled</th>
              <th scope="col">Rating</th>
            </tr>
          </thead>
          <tbody>
            {report.experiences.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>No live experiences yet — they appear here once GoDND approves one.</td>
              </tr>
            ) : (
              report.experiences.map((line) => {
                const cancelRate = line.made ? line.cancelled / line.made : 0;
                return (
                  <tr key={line.id}>
                    <th scope="row" className="max-w-[320px]">
                      <span className="row-name">
                        <Link
                          href={`/dashboard/experiences?tab=${line.status === "active" ? "active" : line.status}&q=${encodeURIComponent(line.title)}`}
                          className="insights-link truncate"
                        >
                          {line.title}
                        </Link>
                        {line.status !== "active" ? (
                          <Badge status="neutral">{EXPERIENCE_STATE_LABELS[line.status] ?? line.status}</Badge>
                        ) : null}
                      </span>
                    </th>
                    <td className={cn(line.bookings === 0 && "val-warning")}>
                      {line.bookings === 0 ? "None" : line.bookings}
                    </td>
                    <td>{line.guests}</td>
                    <td className="primary font-medium">{formatMoney(line.valueMinor)}</td>
                    <td className="left">
                      <span className="share-cell">
                        <span className="meter share-meter" aria-hidden>
                          <span style={{ width: `${Math.round(line.share * 100)}%` }} />
                        </span>
                        {Math.round(line.share * 100)}%
                      </span>
                    </td>
                    <td className={cn(line.made >= 5 && cancelRate >= 0.2 && "val-critical")}>
                      {line.cancelled}
                      {line.made ? <span className="cell-sub-inline"> of {line.made}</span> : null}
                    </td>
                    <td>
                      {line.rating !== null ? (
                        <>
                          {line.rating.toFixed(1)}
                          <span className="cell-sub-inline"> ({line.reviews})</span>
                        </>
                      ) : (
                        <span className="cell-empty">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

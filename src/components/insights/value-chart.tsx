"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { EmptyState } from "@/components/ui/empty-state";
import type { PeriodReport, SeriesPoint } from "@/lib/insights/report";
import { formatMoney } from "@/lib/utils";

/**
 * Booking value per day, week or month.
 *
 * One series, one axis, in rupees: the bookings count rides in the tooltip
 * rather than on a second scale, because two scales on one chart invent a
 * relationship between them. Bars are capped at 24px with a 4px rounded top
 * and a square foot on the baseline; a single series needs no legend, since
 * the title names it. The same numbers are a table for screen readers.
 */

const PLOT_HEIGHT = 240;

/** "₹0", "₹80K", "₹4.5L", "₹1.2Cr" — Indian units, for axis ticks only. */
export function compactRupees(minor: number) {
  const rupees = minor / 100;
  const trim = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ""));
  if (rupees >= 1e7) return `₹${trim(rupees / 1e7)}Cr`;
  if (rupees >= 1e5) return `₹${trim(rupees / 1e5)}L`;
  if (rupees >= 1e3) return `₹${trim(rupees / 1e3)}K`;
  return `₹${Math.round(rupees)}`;
}

/** A clean top for a money axis — a round multiple of a power of ten, with ~12% headroom. */
function niceCeiling(max: number) {
  if (max <= 0) return 100_00;
  const target = max * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * magnitude >= target) return step * magnitude;
  }
  return 10 * magnitude;
}

export function ValueChart({ report }: { report: PeriodReport }) {
  const [width, setWidth] = useState(0);
  const data = report.series;
  const isEmpty = data.every((point) => point.valueMinor === 0 && point.bookings === 0);
  const ceiling = niceCeiling(Math.max(...data.map((point) => point.valueMinor)));
  const unit = report.key === "12m" ? "month" : report.key === "90d" ? "week" : "day";
  // Enough ticks to read the axis, few enough that labels never collide.
  const room = width > 0 ? Math.max(3, Math.floor(width / 64)) : 8;
  const interval = Math.max(0, Math.ceil(data.length / room) - 1);

  return (
    <div className="panel chart-card insights-chart">
      <div className="insights-chart-head">
        <div>
          <h2 id="insights-value-title" className="section-title">
            Booking value
          </h2>
          <p className="m-0 mt-[2px] text-[11.5px] text-text-muted">
            By {unit}, {report.rangeLabel}. Cancelled bookings aren’t counted.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <div className="chart-empty">
          <EmptyState
            icon={BarChart3}
            title="No bookings in this period"
            description="Bookings appear here the day they’re made."
          />
        </div>
      ) : (
        <div className="chart-plot" style={{ height: PLOT_HEIGHT }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 720, height: PLOT_HEIGHT }}
            onResize={(nextWidth) => setWidth(nextWidth)}
          >
            <BarChart
              data={data}
              margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
              barCategoryGap={2}
              title={`Booking value by ${unit}, ${report.label.toLowerCase()}`}
              desc={`Use the left and right arrow keys to step through each ${unit}.`}
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                interval={interval}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                height={24}
              />
              <YAxis
                width={48}
                domain={[0, ceiling]}
                ticks={[0, ceiling / 2, ceiling]}
                tickFormatter={compactRupees}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "var(--overlay-hover)" }}
                content={(props) => <ValueTooltip {...props} />}
                isAnimationActive={false}
                wrapperStyle={{ outline: "none" }}
              />
              <Bar
                dataKey="valueMinor"
                name="Booking value"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <table className="sr-only">
        <caption>
          Booking value by {unit}, {report.rangeLabel}
        </caption>
        <thead>
          <tr>
            <th scope="col">{unit === "month" ? "Month" : unit === "week" ? "Week" : "Day"}</th>
            <th scope="col">Booking value</th>
            <th scope="col">Bookings</th>
            <th scope="col">Guests</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.range}</th>
              <td>{formatMoney(point.valueMinor)}</td>
              <td>{point.bookings}</td>
              <td>{point.guests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValueTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SeriesPoint;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{point.range}</div>
      <div className="chart-tooltip-row">
        <span aria-hidden className="chart-key" style={{ background: "var(--chart-1)" }} />
        <span className="chart-tooltip-value">{formatMoney(point.valueMinor)}</span>
      </div>
      <div className="chart-tooltip-foot">
        {point.bookings} booking{point.bookings === 1 ? "" : "s"} · {point.guests} guest{point.guests === 1 ? "" : "s"}
      </div>
    </div>
  );
}

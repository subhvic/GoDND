"use client";

import { useState, useSyncExternalStore } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { SectionHead } from "@/components/home/section-head";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineSelect } from "@/components/ui/inline-select";
import type { ConversionGranularity, ConversionPoint } from "@/lib/types";

/**
 * "Conversion graph" — active experiences against experiences booked, by
 * month or by week (handoff: Home - Ground Instance, both intervals).
 *
 * Built to the dataviz method rather than eyeballed:
 *   - one axis, one unit (experiences), so the gap between the lines is
 *     literally the inventory that didn't sell;
 *   - two categorical slots in fixed order (--chart-1, --chart-2), run
 *     through the palette validator against the card surface;
 *   - 2px lines, a legend plus direct end labels, a hairline grid;
 *   - a crosshair that snaps to the period and one tooltip carrying both
 *     series, value first;
 *   - keyboard: the chart takes focus and the arrow keys walk the periods;
 *     a screen reader gets the same numbers as a table.
 */

const SERIES = [
  { key: "activeExperiences", label: "Active experiences", short: "active", color: "var(--chart-1)" },
  { key: "bookedExperiences", label: "Experiences booked", short: "booked", color: "var(--chart-2)" },
] as const;

const INTERVALS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
] as const;

const PLOT_HEIGHT = 236;
const MARGIN = { top: 16, right: 34, bottom: 0, left: 0 };

export function ConversionChart({
  series,
}: {
  series: Record<ConversionGranularity, ConversionPoint[]>;
}) {
  const [granularity, setGranularity] = useState<ConversionGranularity>("monthly");
  const [width, setWidth] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const data = series[granularity];
  const unit = granularity === "monthly" ? "month" : "week";
  const isEmpty = data.every((point) => point.activeExperiences === 0 && point.bookedExperiences === 0);

  const ceiling = niceCeiling(Math.max(...data.flatMap((point) => [point.activeExperiences, point.bookedExperiences])));
  const axisHeight = granularity === "weekly" ? 36 : 24;

  // Direct end labels only when they won't collide; otherwise the legend
  // and tooltip carry identity, rather than labels nudged off their lines.
  const last = data.length - 1;
  const gapPx =
    (Math.abs(data[last].activeExperiences - data[last].bookedExperiences) / ceiling) *
    (PLOT_HEIGHT - MARGIN.top - axisHeight);
  const showEndLabels = gapPx >= 14;

  return (
    <section className="home-section" aria-labelledby="home-conversion-title">
      <SectionHead
        id="home-conversion-title"
        title="Conversion graph"
        control={
          <InlineSelect
            label="Graph interval"
            value={granularity}
            onChange={setGranularity}
            options={INTERVALS}
          />
        }
        link={{ label: "See details", unavailable: "Insights isn’t built yet" }}
      />

      <div className="panel chart-card">
        <ul className="chart-legend" aria-label="Legend">
          {SERIES.map((entry) => (
            <li key={entry.key}>
              <span aria-hidden className="chart-key" style={{ background: entry.color }} />
              {entry.label}
            </li>
          ))}
        </ul>

        {isEmpty ? (
          <div className="chart-empty">
            <EmptyState
              icon={LineChartIcon}
              title="Nothing to plot yet"
              description="The graph fills in as your experiences go live and take bookings."
            />
          </div>
        ) : (
          <div className="chart-plot">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 520, height: PLOT_HEIGHT }}
              onResize={(nextWidth) => setWidth(nextWidth)}
            >
              <LineChart
                data={data}
                margin={MARGIN}
                title={`Conversion graph, ${granularity}`}
                desc={`Active experiences and experiences booked per ${unit}. Use the left and right arrow keys to step through each ${unit}.`}
              >
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="key"
                  height={axisHeight}
                  interval={width > 0 && width < 420 ? 1 : 0}
                  tickLine={false}
                  axisLine={{ stroke: "var(--chart-grid)" }}
                  // Look the point up by its key: when ticks are thinned on a
                  // narrow card, the tick's index no longer matches the data's.
                  tick={(props) => (
                    <AxisTick
                      x={Number(props.x)}
                      y={Number(props.y)}
                      point={data.find((point) => point.key === props.payload?.value)}
                    />
                  )}
                />
                <YAxis
                  width={32}
                  domain={[0, ceiling]}
                  ticks={[0, ceiling / 2, ceiling]}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1 }}
                  content={(props) => <ChartTooltip {...props} />}
                  isAnimationActive={false}
                  wrapperStyle={{ outline: "none" }}
                />
                {SERIES.map((entry) => (
                  <Line
                    key={entry.key}
                    dataKey={entry.key}
                    name={entry.label}
                    type="monotone"
                    stroke={entry.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    isAnimationActive={!reducedMotion}
                    animationDuration={450}
                    activeDot={{ r: 5, fill: entry.color, stroke: "var(--card)", strokeWidth: 2 }}
                    dot={(props) =>
                      props.index === last ? (
                        <EndMarker
                          key={`${entry.key}-end`}
                          cx={Number(props.cx)}
                          cy={Number(props.cy)}
                          color={entry.color}
                          value={showEndLabels ? Number(props.value) : null}
                        />
                      ) : null
                    }
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <table className="sr-only">
          <caption>
            Conversion graph by {unit}: active experiences and experiences booked
          </caption>
          <thead>
            <tr>
              <th scope="col">{unit === "month" ? "Month" : "Week"}</th>
              <th scope="col">Active experiences</th>
              <th scope="col">Experiences booked</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.key}>
                <th scope="row">{point.range}</th>
                <td>{point.activeExperiences}</td>
                <td>{point.bookedExperiences}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Month labels on one line; a week's range over two ("21 Sep" / "– 27 Sep"). */
function AxisTick({ x, y, point }: { x: number; y: number; point?: ConversionPoint }) {
  if (!point) return null;
  return (
    <text x={x} y={y} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
      <tspan x={x} dy={13}>
        {point.label}
      </tspan>
      {point.sublabel ? (
        <tspan x={x} dy={13}>
          {point.sublabel}
        </tspan>
      ) : null}
    </text>
  );
}

/** The latest point: an 8px dot on a 2px surface ring, and its value beside it. */
function EndMarker({
  cx,
  cy,
  color,
  value,
}: {
  cx: number;
  cy: number;
  color: string;
  value: number | null;
}) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
      {value != null ? (
        <text x={cx + 9} y={cy} dy="0.35em" fill="var(--text-secondary)" fontSize={11.5} fontWeight={600}>
          {value}
        </text>
      ) : null}
    </g>
  );
}

/** One readout, every series: value first, the series named after it. */
function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ConversionPoint;
  const rate =
    point.activeExperiences > 0
      ? Math.round((point.bookedExperiences / point.activeExperiences) * 100)
      : null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{point.range}</div>
      {SERIES.map((entry) => (
        <div key={entry.key} className="chart-tooltip-row">
          <span aria-hidden className="chart-key" style={{ background: entry.color }} />
          <span className="chart-tooltip-value">{point[entry.key]}</span>
          <span className="chart-tooltip-label">{entry.short}</span>
        </div>
      ))}
      {rate != null ? <div className="chart-tooltip-foot">{rate}% of active experiences booked</div> : null}
    </div>
  );
}

/**
 * A clean top for a count axis: at least 15% headroom so the highest line
 * never touches the frame, and even, so the midpoint tick is a whole number.
 */
function niceCeiling(max: number): number {
  const target = Math.max(2, Math.ceil(max * 1.15));
  for (const step of [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100]) {
    if (step >= target) return step;
  }
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return Math.ceil(target / (2 * magnitude)) * 2 * magnitude;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Recharts animates in JS, which the global reduced-motion CSS can't reach. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

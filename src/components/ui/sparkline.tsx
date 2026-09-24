"use client";

import { useId } from "react";

/**
 * Minimal inline SVG sparkline (source: charts/Sparkline) — a line over a
 * fading area, no chart library. Decorative: the number beside it is the
 * information, so the SVG is hidden from assistive tech.
 */
export function Sparkline({
  data,
  color = "var(--brand)",
  height = 32,
}: {
  data: number[];
  /** A token reference, e.g. var(--critical). Never a raw hex. */
  color?: string;
  height?: number;
}) {
  const gradientId = useId();
  if (data.length < 2) return null;

  const width = 120;
  const min = Math.min(...data);
  const range = Math.max(...data) - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="block h-full w-full"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

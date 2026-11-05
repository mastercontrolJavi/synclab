"use client";

import { useId } from "react";

interface SparklineProps {
  values: readonly number[];
  /** CSS color, ideally a concept var such as `var(--c-server)`. */
  color: string;
  /** Fixed floor for the y-axis so small noise does not look dramatic. */
  minRange?: number;
  className?: string;
  capacity: number;
}

const WIDTH = 120;
const HEIGHT = 28;

/** A tiny SVG sparkline: area + line + last-value dot. No chart library. */
export function Sparkline({ values, color, minRange = 1, className, capacity }: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} aria-hidden="true">
        <line x1="0" x2={WIDTH} y1={HEIGHT - 1} y2={HEIGHT - 1} stroke="var(--line-strong)" strokeDasharray="2 3" />
      </svg>
    );
  }

  let max = -Infinity;
  let min = Infinity;
  for (const value of values) {
    max = Math.max(max, value);
    min = Math.min(min, value);
  }
  min = Math.min(min, 0);
  const range = Math.max(max - min, minRange);
  const step = WIDTH / Math.max(capacity - 1, 1);
  const offset = WIDTH - (values.length - 1) * step;
  const points = values.map((value, index) => {
    const x = offset + index * step;
    const y = HEIGHT - 2 - ((value - min) / range) * (HEIGHT - 4);
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${first[0]},${HEIGHT} ${line} ${last[0]},${HEIGHT}` : "";

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last ? <circle cx={last[0]} cy={last[1]} r="1.8" fill={color} /> : null}
    </svg>
  );
}

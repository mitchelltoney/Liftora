"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-rolled SVG charts in the HUD language, per the dataviz method:
 * 2px lines, ≥8px markers with 2px surface rings, ≤24px bars with 4px
 * rounded data-ends and 2px surface gaps, hairline solid gridlines one
 * step off-surface, values in text tokens (never the series color), one
 * series per chart (title = identity, no legend), and a real <table>
 * fallback behind a disclosure for screen readers and skeptics.
 */

const SURFACE = "#1c1c1e";
const GRID = "#2a2a2e";
const AXIS_TEXT = "#a1a1a8";

export interface SeriesPoint {
  x: number;
  y: number;
  label: string; // human x (e.g. "Jun 12")
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const span = max - min;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const err = span / count / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const niceStep = step * mult;
  const start = Math.ceil(min / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += niceStep) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

export function ChartPanel({
  title,
  subtitle,
  children,
  table,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Accessible fallback: [headers, ...rows]. */
  table: string[][];
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("glass-panel p-4", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="hud-label text-muted-foreground">{title}</h3>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
      {children}
      <details className="mt-2">
        <summary className="hud-label cursor-pointer text-muted-foreground hover:text-foreground">
          Data table
        </summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {table[0]?.map((h) => (
                  <th key={h} className="hud-label pb-1 pr-3 font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.slice(1).map((row, i) => (
                <tr key={i} className="border-t border-forge-cyan/10">
                  {row.map((cell, j) => (
                    <td key={j} className="tabular py-1 pr-3 text-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function HudLineChart({
  points,
  color,
  formatY,
  emptyLabel = "No data in range",
  height = 160,
}: {
  points: SeriesPoint[];
  color: string;
  formatY: (v: number) => string;
  emptyLabel?: string;
  height?: number;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 44, r: 20, t: 16, b: 28 };

  if (points.length === 0) {
    return (
      <div className="scanlines flex h-32 items-center justify-center rounded-lg">
        <span className="text-xs text-muted-foreground">{emptyLabel}</span>
      </div>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yTicks = niceTicks(Math.min(...ys) * 0.97, Math.max(...ys) * 1.03);
  const yMin = yTicks[0] ?? Math.min(...ys);
  const yMax = yTicks[yTicks.length - 1] ?? Math.max(...ys);

  const px = (x: number) =>
    xMax === xMin
      ? (pad.l + (W - pad.r)) / 2
      : pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
  const py = (y: number) =>
    yMax === yMin
      ? H / 2
      : H - pad.b - ((y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${px(points[points.length - 1].x).toFixed(1)},${H - pad.b} L${px(points[0].x).toFixed(1)},${H - pad.b} Z`;
  const last = points[points.length - 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Line chart, ${points.length} points, latest ${formatY(last.y)} on ${last.label}`}
        className="w-full"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={py(tick)}
              y2={py(tick)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={pad.l - 6}
              y={py(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill={AXIS_TEXT}
              className="tabular"
            >
              {formatY(tick)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} fontSize={10} fill={AXIS_TEXT}>
          {points[0].label}
        </text>
        <text x={W - pad.r} y={H - 8} fontSize={10} fill={AXIS_TEXT} textAnchor="end">
          {last.label}
        </text>

        <path d={area} fill={color} opacity={0.1} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Direct label on the endpoint (dataviz: label the endpoint, not
            every point); value wears a text token, never the series color. */}
        <text
          x={Math.min(px(last.x), W - pad.r)}
          y={Math.max(12, py(last.y) - 11)}
          textAnchor="end"
          fontSize={11}
          fontWeight={600}
          fill="#ffffff"
          className="tabular"
        >
          {formatY(last.y)}
        </text>
        {points.map((p, i) => (
          <g key={`${id}-${i}`}>
            {/* Surface ring keeps the marker legible over the line. */}
            <circle cx={px(p.x)} cy={py(p.y)} r={6} fill={SURFACE} />
            <circle
              cx={px(p.x)}
              cy={py(p.y)}
              r={4}
              fill={color}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${p.label}: ${formatY(p.y)}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              style={{ outline: "none" }}
            />
          </g>
        ))}
      </svg>
      {active !== null ? (
        <div
          className="tabular pointer-events-none absolute rounded-md border border-forge-cyan/30 bg-forge-panel-hi px-2 py-1 text-xs text-foreground"
          style={{
            left: `${(px(points[active].x) / W) * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
          }}
          role="status"
        >
          {points[active].label} · {formatY(points[active].y)}
        </div>
      ) : null}
    </div>
  );
}

export function HudBarChart({
  points,
  color,
  formatY,
  emptyLabel = "No data in range",
  height = 160,
}: {
  points: SeriesPoint[];
  color: string;
  formatY: (v: number) => string;
  emptyLabel?: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 48, r: 12, t: 14, b: 24 };

  if (points.length === 0) {
    return (
      <div className="scanlines flex h-32 items-center justify-center rounded-lg">
        <span className="text-xs text-muted-foreground">{emptyLabel}</span>
      </div>
    );
  }

  const yTicks = niceTicks(0, Math.max(...points.map((p) => p.y)) * 1.05);
  const yMax = yTicks[yTicks.length - 1] || 1;
  const innerW = W - pad.l - pad.r;
  const slot = innerW / points.length;
  const barW = Math.min(24, Math.max(6, slot - 2)); // 2px surface gap minimum
  const py = (y: number) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Bar chart, ${points.length} bars`}
        className="w-full"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={py(tick)}
              y2={py(tick)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={pad.l - 6}
              y={py(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill={AXIS_TEXT}
              className="tabular"
            >
              {formatY(tick)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2;
          const y = py(p.y);
          const h = Math.max(0, H - pad.b - y);
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i}>
              {/* Rounded data-end, square baseline. */}
              <path
                d={`M${x},${H - pad.b} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${H - pad.b} Z`}
                fill={color}
                opacity={active === null || active === i ? 1 : 0.45}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${p.label}: ${formatY(p.y)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ outline: "none" }}
              />
              {points.length <= 14 ? (
                <text
                  x={x + barW / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fill={AXIS_TEXT}
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {active !== null ? (
        <div
          className="tabular pointer-events-none absolute rounded-md border border-forge-cyan/30 bg-forge-panel-hi px-2 py-1 text-xs text-foreground"
          style={{
            left: `${((pad.l + active * slot + slot / 2) / W) * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
          }}
          role="status"
        >
          {points[active].label} · {formatY(points[active].y)}
        </div>
      ) : null}
    </div>
  );
}

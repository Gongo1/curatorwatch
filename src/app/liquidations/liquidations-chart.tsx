"use client";

import { useState } from "react";
import type { LiquidationDay } from "@/lib/lens-overviews";

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function fmtMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

// Daily collateral-seized bars across the trailing window, with Y-axis, month
// ticks, and a hover tooltip. Dependency-free SVG (no chart library).
export function LiquidationsChart({ series }: { series: LiquidationDay[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const n = series.length;
  const W = 900;
  const H = 260;
  const PAD_L = 54;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 26;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const max = Math.max(1, ...series.map((d) => d.seizedUsd));
  const bw = plotW / n;
  const x = (i: number) => PAD_L + i * bw;
  const barH = (v: number) => (v / max) * plotH;

  const yTicks = [0, 1, 2, 3].map((k) => (max * k) / 3);

  // Month boundaries for x ticks.
  const monthTicks: number[] = [];
  let lastMonth = "";
  series.forEach((d, i) => {
    const m = d.date.slice(0, 7);
    if (m !== lastMonth) {
      monthTicks.push(i);
      lastMonth = m;
    }
  });

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const i = Math.floor(((frac * W - PAD_L) / plotW) * n);
    setHover(i >= 0 && i < n ? i : null);
  };

  const hp = hover != null ? series[hover] : null;

  return (
    <div className="relative border border-border rounded-2xl bg-background-subtle p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block overflow-visible"
        role="img"
        aria-label={`Daily collateral seized over the last ${n - 1} days`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Y gridlines + labels */}
        {yTicks.map((v, k) => {
          const yy = PAD_T + plotH - barH(v);
          return (
            <g key={k}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yy}
                y2={yy}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
              />
              <text
                x={PAD_L - 8}
                y={yy}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--text-tertiary)"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
              >
                {compactUsd(v)}
              </text>
            </g>
          );
        })}

        {/* Daily bars */}
        {series.map((d, i) => {
          if (d.seizedUsd <= 0) return null;
          const h = barH(d.seizedUsd);
          return (
            <rect
              key={i}
              x={x(i)}
              y={PAD_T + plotH - h}
              width={Math.max(0.6, bw - 0.4)}
              height={h}
              fill="var(--accent-blue)"
              opacity={hover == null || hover === i ? 0.9 : 0.45}
            />
          );
        })}

        {/* Bad-debt markers (rare, worth surfacing) */}
        {series.map((d, i) =>
          d.badDebtUsd > 0 ? (
            <circle
              key={`bd-${i}`}
              cx={x(i) + bw / 2}
              cy={PAD_T + plotH - barH(d.seizedUsd) - 4}
              r="2"
              fill="var(--accent-red)"
            />
          ) : null
        )}

        {/* Month ticks */}
        {monthTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="start"
            fill="var(--text-tertiary)"
            fontSize="11"
            fontFamily="var(--font-mono, monospace)"
          >
            {fmtMonth(series[i].date)}
          </text>
        ))}

        {/* Hover highlight line */}
        {hp && (
          <line
            x1={x(hover as number) + bw / 2}
            x2={x(hover as number) + bw / 2}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke="var(--accent-blue)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            opacity={0.4}
            pointerEvents="none"
          />
        )}
      </svg>

      {hp && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-full bg-background-elevated border border-border rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap z-10"
          style={{
            left: `${((x(hover as number) + bw / 2) / W) * 100}%`,
            top: `calc(${((PAD_T + plotH - barH(hp.seizedUsd)) / H) * 100}% - 8px)`,
          }}
        >
          <div className="font-mono text-[0.62rem] text-text-tertiary">{fmtDay(hp.date)}</div>
          <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">
            {compactUsd(hp.seizedUsd)} seized
          </div>
          <div className="font-mono text-[0.6rem] text-text-tertiary tabular-nums">
            {hp.events} event{hp.events === 1 ? "" : "s"}
            {hp.badDebtUsd > 0 ? ` · ${compactUsd(hp.badDebtUsd)} bad debt` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

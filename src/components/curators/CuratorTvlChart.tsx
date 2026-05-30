"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface CuratorMeta {
  id: string;
  name: string;
}
type Point = Record<string, number | string>;

// Categorical palette — distinct hues, harmonized lightness for the dark canvas.
const COLORS = [
  "oklch(70% 0.14 235)",
  "oklch(74% 0.13 162)",
  "oklch(80% 0.13 78)",
  "oklch(68% 0.17 18)",
  "oklch(70% 0.13 305)",
  "oklch(77% 0.11 205)",
];

function fmtAxisUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n / 1e3)}K`;
}
function fmtTipUsd(n: number): string {
  return n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(1)}M`;
}
function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { name: string; value: number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="bg-background-elevated border border-border rounded-[9px] px-3 py-2 font-mono text-xs shadow-lg min-w-[160px]">
      <div className="text-text-tertiary mb-1.5">{label ? fmtDate(label) : ""}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex justify-between gap-4 py-0.5 text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="text-text-primary font-semibold tabular-nums">{fmtTipUsd(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function CuratorTvlChart() {
  const [data, setData] = useState<Point[]>([]);
  const [meta, setMeta] = useState<CuratorMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stats/aum-growth");
        const json = await res.json();
        if (cancelled || !json.success) return;
        const named: CuratorMeta[] = (json.curatorMeta || [])
          .filter((m: CuratorMeta) => m.id !== "__unassigned__" && m.id !== "other")
          .slice(0, 6);
        setMeta(named);
        setData(json.data || []);
      } catch {
        // silent — the chart simply won't render
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loaded && (data.length === 0 || meta.length === 0)) return null;

  return (
    <div>
      <div className="h-[270px] w-full">
        {loaded && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={fmtAxisUsd}
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              />
              {meta.map((m, i) => (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.id}
                  name={m.name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* legend */}
      <div className="flex gap-4 flex-wrap mt-4">
        {meta.map((m, i) => (
          <span key={m.id} className="font-mono text-xs text-text-secondary inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-[3px] rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {m.name}
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
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

// Terminal chart palette (amber, cyan, white, magenta, green, violet).
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
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
  const total = payload.reduce((s, r) => s + (r.value || 0), 0);
  return (
    <div className="bg-background-elevated border border-border-strong px-2.5 py-2 text-xs min-w-[180px]">
      <div className="flex justify-between gap-4 mb-1.5 pb-1.5 border-b border-border-subtle">
        <span className="num text-text-tertiary">{label ? fmtDate(label) : ""}</span>
        <span className="num text-text-primary font-semibold">{fmtTipUsd(total)} total</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="flex justify-between gap-4 py-0.5 text-text-secondary">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="inline-block w-2 h-2 flex-none" style={{ background: r.color }} />
            <span className="truncate">{r.name}</span>
          </span>
          <span className="num text-text-primary font-semibold">{fmtTipUsd(r.value)}</span>
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
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-subtle)" }}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={fmtAxisUsd}
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              />
              {/* Stacked: largest curators form the base, the rest stack on top —
                  the band area reads as total curated TVL and its composition,
                  instead of two mega-curators flattening everyone into the floor. */}
              {meta.map((m, i) => (
                <Area
                  key={m.id}
                  type="monotone"
                  stackId="tvl"
                  dataKey={m.id}
                  name={m.name}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.25}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.55}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* legend */}
      <div className="flex gap-x-4 gap-y-1 flex-wrap mt-2.5">
        {meta.map((m, i) => (
          <span key={m.id} className="text-xs text-text-secondary inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {m.name}
          </span>
        ))}
      </div>
    </div>
  );
}

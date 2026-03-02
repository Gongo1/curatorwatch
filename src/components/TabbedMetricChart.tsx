"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

interface BreakdownMeta {
  id: string;
  name: string;
  color: string;
}

interface ChartDataPoint {
  date: string;
  aum: number;
  apy: number;
  vaults: number;
  curators: number;
  [key: string]: unknown;
}

type BreakdownMode = "curator" | "protocol" | "network";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
  meta: BreakdownMeta[];
}

function CustomTooltip({ active, payload, label, meta }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  if (meta.length > 0) {
    const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
    return (
      <div className="bg-background-elevated border border-border rounded-lg px-3 py-2 shadow-lg max-w-xs">
        <p className="text-xs text-text-tertiary mb-2">
          {label ? formatDate(label) : ""}
        </p>
        <p className="text-sm font-semibold text-text-primary mb-2">
          Total: {formatCurrency(total)}
        </p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {payload
            .filter(p => p.value > 0)
            .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
            .map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-text-secondary truncate">
                    {p.name || p.dataKey}
                  </span>
                </div>
                <span className="text-text-primary font-medium tabular-nums flex-shrink-0">
                  {formatCurrency(p.value)}
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-elevated border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-text-tertiary mb-1">
        {label ? formatDate(label) : ""}
      </p>
      <p className="text-sm font-semibold text-blue-500">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

const BREAKDOWN_TABS: { key: BreakdownMode; label: string }[] = [
  { key: "curator", label: "By Curator" },
  { key: "protocol", label: "By Protocol" },
  { key: "network", label: "By Network" },
];

export function TabbedMetricChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [curatorMeta, setCuratorMeta] = useState<BreakdownMeta[]>([]);
  const [protocolMeta, setProtocolMeta] = useState<BreakdownMeta[]>([]);
  const [networkMeta, setNetworkMeta] = useState<BreakdownMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>("curator");

  useEffect(() => {
    async function fetchData() {
      try {
        const aumResponse = await fetch("/api/stats/aum-growth");
        const aumResult = await aumResponse.json();

        if (aumResult.success) {
          setData(aumResult.data);
          if (aumResult.curatorMeta) setCuratorMeta(aumResult.curatorMeta);
          if (aumResult.protocolMeta) setProtocolMeta(aumResult.protocolMeta);
          if (aumResult.networkMeta) setNetworkMeta(aumResult.networkMeta);
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Get the active meta array based on breakdown mode
  const activeMeta = useMemo(() => {
    switch (breakdownMode) {
      case "curator": return curatorMeta;
      case "protocol": return protocolMeta;
      case "network": return networkMeta;
    }
  }, [breakdownMode, curatorMeta, protocolMeta, networkMeta]);

  // Calculate current value and change
  const { currentValue, changePercent } = useMemo(() => {
    if (data.length < 2) {
      return { currentValue: 0, changePercent: 0 };
    }

    const latest = data[data.length - 1].aum;
    const first = data[0].aum;
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;

    return {
      currentValue: latest,
      changePercent: change,
    };
  }, [data]);

  // For AUM, calculate total from active meta if stacked
  const displayValue = useMemo(() => {
    if (activeMeta.length > 0 && data.length > 0) {
      const latest = data[data.length - 1];
      let total = 0;
      for (const m of activeMeta) {
        total += (latest[m.id] as number) || 0;
      }
      return total > 0 ? total : currentValue;
    }
    return currentValue;
  }, [activeMeta, data, currentValue]);

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-4">
        <div className="h-6 w-32 bg-background-elevated rounded animate-pulse mb-1" />
        <div className="h-8 w-24 bg-background-elevated rounded animate-pulse mb-3" />
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-7 w-20 bg-background-elevated rounded-full animate-pulse"
            />
          ))}
        </div>
        <div className="h-[200px] bg-background-elevated rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-4">
      {/* Current Value Display */}
      <div className="mb-3">
        <p className="text-xs text-text-tertiary mb-0.5">Total AUM</p>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums text-blue-500">
            {formatCurrency(displayValue)}
          </span>
          <span
            className={`text-sm font-medium ${
              changePercent >= 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {changePercent >= 0 ? "\u2191" : "\u2193"} {Math.abs(changePercent).toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-text-tertiary">30-day change</p>
      </div>

      {/* Breakdown Sub-tabs */}
      <div className="flex gap-1.5 mb-4">
        {BREAKDOWN_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setBreakdownMode(key)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
              breakdownMode === key
                ? "bg-blue-500 text-white"
                : "bg-background-elevated text-text-secondary hover:text-text-primary hover:bg-background-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <defs>
              {/* Gradients for stacked areas */}
              {activeMeta.map((m) => (
                <linearGradient key={`grad-${m.id}`} id={`grad-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={m.color} stopOpacity={0.4} />
                </linearGradient>
              ))}
              {/* Fallback gradient for non-stacked */}
              <linearGradient id="aumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              tickFormatter={(value) => {
                if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
                return `$${(value / 1e6).toFixed(0)}M`;
              }}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              content={
                <CustomTooltip meta={activeMeta} />
              }
            />

            {/* Stacked areas by active breakdown */}
            {activeMeta.length > 0 ? (
              activeMeta.map((m) => (
                <Area
                  key={m.id}
                  type="monotone"
                  dataKey={m.id}
                  name={m.name}
                  stackId="1"
                  stroke={m.color}
                  strokeWidth={1}
                  fill={`url(#grad-${m.id})`}
                />
              ))
            ) : (
              <Area
                type="monotone"
                dataKey="aum"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#aumGradient)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      {activeMeta.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {activeMeta.slice(0, 6).map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="truncate max-w-[100px]">{m.name}</span>
            </div>
          ))}
          {activeMeta.length > 6 && (
            <span className="text-xs text-text-tertiary">
              +{activeMeta.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

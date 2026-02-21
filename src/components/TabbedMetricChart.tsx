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

interface CuratorMeta {
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

type MetricKey = "aum" | "apy" | "vaults" | "curators";

interface MetricConfig {
  label: string;
  format: (value: number) => string;
  color: string;
  gradientId: string;
  suffix?: string;
}

const METRICS: Record<MetricKey, MetricConfig & { tooltip: string }> = {
  aum: {
    label: "Total AUM",
    format: (v) => formatCurrency(v),
    color: "#3B82F6",
    gradientId: "aumGradient",
    tooltip: "Total Assets Under Management, broken down by curator",
  },
  apy: {
    label: "Weighted APY",
    format: (v) => `${v.toFixed(2)}%`,
    color: "#F59E0B",
    gradientId: "apyGradient",
    suffix: "%",
    tooltip: "AUM-weighted average Net APY across all vaults",
  },
  vaults: {
    label: "Vault Count",
    format: (v) => v.toString(),
    color: "#8B5CF6",
    gradientId: "vaultsGradient",
    tooltip: "Number of active vaults with at least $1,000 in deposits",
  },
  curators: {
    label: "Curators",
    format: (v) => v.toString(),
    color: "#EC4899",
    gradientId: "curatorsGradient",
    tooltip: "Number of unique curators managing Morpho V2 vaults",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color?: string; name?: string }>;
  label?: string;
  metric: MetricKey;
  curatorMeta?: CuratorMeta[];
}

function CustomTooltip({ active, payload, label, metric, curatorMeta }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const config = METRICS[metric];

  // For stacked AUM chart, show curator breakdown
  if (metric === "aum" && curatorMeta && curatorMeta.length > 0) {
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

  // Standard tooltip for other metrics
  return (
    <div className="bg-background-elevated border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-text-tertiary mb-1">
        {label ? formatDate(label) : ""}
      </p>
      <p className="text-sm font-semibold" style={{ color: config.color }}>
        {config.format(payload[0].value)}
      </p>
    </div>
  );
}

export function TabbedMetricChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [curatorMeta, setCuratorMeta] = useState<CuratorMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("aum");

  useEffect(() => {
    async function fetchData() {
      try {
        const aumResponse = await fetch("/api/stats/aum-growth");
        const aumResult = await aumResponse.json();

        if (aumResult.success) {
          setData(aumResult.data);
          if (aumResult.curatorMeta) {
            setCuratorMeta(aumResult.curatorMeta);
          }
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate current value and change
  const { currentValue, changePercent } = useMemo(() => {
    if (data.length < 2) {
      return { currentValue: 0, changePercent: 0 };
    }

    const latest = data[data.length - 1][selectedMetric] as number;
    const first = data[0][selectedMetric] as number;
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;

    return {
      currentValue: latest,
      changePercent: change,
    };
  }, [data, selectedMetric]);

  const config = METRICS[selectedMetric];

  // For AUM, calculate total from all curators if stacked
  const displayValue = useMemo(() => {
    if (selectedMetric === "aum" && curatorMeta.length > 0 && data.length > 0) {
      const latest = data[data.length - 1];
      let total = 0;
      for (const curator of curatorMeta) {
        total += (latest[curator.id] as number) || 0;
      }
      return total > 0 ? total : latest.aum;
    }
    return currentValue;
  }, [selectedMetric, curatorMeta, data, currentValue]);

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-4">
        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.keys(METRICS).map((key) => (
            <div
              key={key}
              className="h-8 w-24 bg-background-elevated rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="h-6 w-32 bg-background-elevated rounded animate-pulse mb-1" />
        <div className="h-8 w-24 bg-background-elevated rounded animate-pulse mb-4" />
        <div className="h-[200px] bg-background-elevated rounded animate-pulse" />
      </div>
    );
  }

  const chartData = data;

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-4">
      {/* Metric Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.entries(METRICS) as [MetricKey, MetricConfig & { tooltip: string }][]).map(
          ([key, m]) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              title={m.tooltip}
              className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                selectedMetric === key
                  ? "text-white"
                  : "bg-background-elevated text-text-secondary hover:text-text-primary hover:bg-background-hover"
              }`}
              style={
                selectedMetric === key
                  ? { backgroundColor: m.color }
                  : undefined
              }
            >
              {m.label}
            </button>
          )
        )}
      </div>

      {/* Current Value Display */}
      <div className="mb-4">
        <div className="flex items-baseline gap-3">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: config.color }}
          >
            {config.format(displayValue)}
          </span>
          <span
            className={`text-sm font-medium ${
              changePercent >= 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {changePercent >= 0 ? "↑" : "↓"} {Math.abs(changePercent).toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-text-tertiary">30-day change</p>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            stackOffset={selectedMetric === "aum" && curatorMeta.length > 0 ? "none" : undefined}
          >
            <defs>
              {/* Standard gradients */}
              {Object.entries(METRICS).map(([key, m]) => (
                <linearGradient key={m.gradientId} id={m.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                </linearGradient>
              ))}
              {/* Curator gradients for stacked chart */}
              {curatorMeta.map((curator) => (
                <linearGradient key={`grad-${curator.id}`} id={`grad-${curator.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={curator.color} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={curator.color} stopOpacity={0.4} />
                </linearGradient>
              ))}
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
                if (selectedMetric === "aum") {
                  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
                  return `$${(value / 1e6).toFixed(0)}M`;
                }
                if (selectedMetric === "apy") {
                  return `${value.toFixed(1)}%`;
                }
                return value.toString();
              }}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              content={
                <CustomTooltip
                  metric={selectedMetric}
                  curatorMeta={selectedMetric === "aum" ? curatorMeta : undefined}
                />
              }
            />

            {/* Stacked areas for AUM by curator */}
            {selectedMetric === "aum" && curatorMeta.length > 0 ? (
              curatorMeta.map((curator) => (
                <Area
                  key={curator.id}
                  type="monotone"
                  dataKey={curator.id}
                  name={curator.name}
                  stackId="1"
                  stroke={curator.color}
                  strokeWidth={1}
                  fill={`url(#grad-${curator.id})`}
                />
              ))
            ) : (
              /* Single area for other metrics */
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#${config.gradientId})`}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend for stacked AUM chart */}
      {selectedMetric === "aum" && curatorMeta.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {curatorMeta.slice(0, 6).map((curator) => (
            <div key={curator.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: curator.color }}
              />
              <span className="truncate max-w-[100px]">{curator.name}</span>
            </div>
          ))}
          {curatorMeta.length > 6 && (
            <span className="text-xs text-text-tertiary">
              +{curatorMeta.length - 6} more
            </span>
          )}
        </div>
      )}

    </div>
  );
}

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

interface ChartDataPoint {
  date: string;
  aum: number;
  apy: number;
  vaults: number;
  curators: number;
}

type MetricKey = "aum" | "apy" | "vaults" | "curators";

interface MetricConfig {
  label: string;
  format: (value: number) => string;
  color: string;
  gradientId: string;
  suffix?: string;
}

const METRICS: Record<MetricKey, MetricConfig> = {
  aum: {
    label: "Total AUM",
    format: (v) => formatCurrency(v),
    color: "#3B82F6",
    gradientId: "aumGradient",
  },
  apy: {
    label: "Weighted APY",
    format: (v) => `${v.toFixed(2)}%`,
    color: "#10B981",
    gradientId: "apyGradient",
    suffix: "%",
  },
  vaults: {
    label: "Vault Count",
    format: (v) => v.toString(),
    color: "#8B5CF6",
    gradientId: "vaultsGradient",
  },
  curators: {
    label: "Curators",
    format: (v) => v.toString(),
    color: "#F59E0B",
    gradientId: "curatorsGradient",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
  metric: MetricKey;
}

function CustomTooltip({ active, payload, label, metric }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const config = METRICS[metric];
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
  return null;
}

export function TabbedMetricChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("aum");

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/stats/aum-growth");
        const result = await response.json();

        if (result.success) {
          setData(result.data);
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

    const latest = data[data.length - 1][selectedMetric];
    const first = data[0][selectedMetric];
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;

    return {
      currentValue: latest,
      changePercent: change,
    };
  }, [data, selectedMetric]);

  const config = METRICS[selectedMetric];

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-4">
        <div className="flex gap-2 mb-4">
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

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-4">
      {/* Metric Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.entries(METRICS) as [MetricKey, MetricConfig][]).map(
          ([key, m]) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
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
            {config.format(currentValue)}
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
            data={data}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0} />
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
                if (selectedMetric === "aum") {
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
            <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
            <Area
              type="monotone"
              dataKey={selectedMetric}
              stroke={config.color}
              strokeWidth={2}
              fill={`url(#${config.gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

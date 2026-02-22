"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartDataPoint {
  date: string;
  aum: number;
  apy: number;
}

function formatCurrency(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background-elevated border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm text-text-secondary mb-2">
          {label ? formatDate(label) : ""}
        </p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.dataKey === "aum" ? "Total AUM: " : "APY: "}
            <span className="font-semibold">
              {entry.dataKey === "aum"
                ? formatCurrency(entry.value)
                : `${entry.value.toFixed(2)}%`}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function AUMGrowthChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/stats/aum-growth");
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch data");
        }

        setData(result.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-6 h-[320px]">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-40 bg-background-elevated rounded animate-pulse" />
        </div>
        <div className="h-[240px] bg-background-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-6 h-[320px] flex items-center justify-center">
        <p className="text-text-secondary text-sm">Failed to load chart data</p>
      </div>
    );
  }

  // Calculate stats for display
  const latestAUM = data.length > 0 ? data[data.length - 1].aum : 0;
  const firstAUM = data.length > 0 ? data[0].aum : 0;
  const aumChange = firstAUM > 0 ? ((latestAUM - firstAUM) / firstAUM) * 100 : 0;

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            Total AUM Growth
          </h3>
          <p className="text-sm text-text-tertiary">Last 30 days</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {formatCurrency(latestAUM)}
          </p>
          <p
            className={`text-sm font-medium ${
              aumChange >= 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {aumChange >= 0 ? "+" : ""}
            {aumChange.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1a1a1a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              yAxisId="aum"
              orientation="left"
              tickFormatter={(value) => formatCurrency(value)}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <YAxis
              yAxisId="apy"
              orientation="right"
              tickFormatter={(value) => `${value}%`}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={50}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => (
                <span className="text-xs text-text-secondary">
                  {value === "aum" ? "Total AUM" : "APY"}
                </span>
              )}
            />
            <Line
              yAxisId="aum"
              type="monotone"
              dataKey="aum"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#3B82F6" }}
            />
            <Line
              yAxisId="apy"
              type="monotone"
              dataKey="apy"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10B981" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

interface TransactionData {
  date: string;
  deposits: number;
  withdrawals: number;
  netFlow: number;
}

interface TransactionVolumeChartProps {
  vaultAddress: string;
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
    const deposits = payload.find((p) => p.dataKey === "deposits")?.value || 0;
    const withdrawals = payload.find((p) => p.dataKey === "withdrawals")?.value || 0;
    const netFlow = deposits - withdrawals;

    return (
      <div className="bg-background-elevated border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-text-tertiary mb-2">
          {label ? formatDate(label) : ""}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-accent-green flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-green" />
              Deposits
            </span>
            <span className="text-xs font-medium text-text-primary">
              {formatCurrency(deposits)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-accent-red flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent-red" />
              Withdrawals
            </span>
            <span className="text-xs font-medium text-text-primary">
              {formatCurrency(withdrawals)}
            </span>
          </div>
          <div className="pt-1 border-t border-border mt-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-text-secondary">Net Flow</span>
              <span
                className={`text-xs font-semibold ${
                  netFlow >= 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {netFlow >= 0 ? "+" : ""}
                {formatCurrency(netFlow)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function TransactionVolumeChart({ vaultAddress }: TransactionVolumeChartProps) {
  const [timeRange, setTimeRange] = useState("30d");
  const [data, setData] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/vaults/${vaultAddress}/transaction-volume?range=${timeRange}`
        );
        const json = await res.json();

        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to fetch data");
        }
      } catch (err) {
        setError("Failed to fetch transaction data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [vaultAddress, timeRange]);

  // Calculate totals
  const totals = data.reduce(
    (acc, d) => ({
      deposits: acc.deposits + d.deposits,
      withdrawals: acc.withdrawals + d.withdrawals,
      netFlow: acc.netFlow + d.netFlow,
    }),
    { deposits: 0, withdrawals: 0, netFlow: 0 }
  );

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 w-40 bg-background-elevated rounded animate-pulse" />
          <div className="flex gap-2">
            {["7d", "30d", "90d"].map((r) => (
              <div
                key={r}
                className="h-8 w-12 bg-background-elevated rounded animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="h-[300px] bg-background-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-subtle border border-border rounded-lg p-6">
        <p className="text-sm text-text-secondary text-center">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-background-subtle border border-border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-text-primary">
            Transaction Volume
          </h3>
          <div className="flex gap-1">
            {["7d", "30d", "90d"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  timeRange === range
                    ? "bg-accent-blue text-white"
                    : "bg-background-elevated text-text-secondary hover:text-text-primary"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-text-tertiary">
            No transaction data available for this period
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-subtle border border-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-text-primary">
          Transaction Volume
        </h3>
        <div className="flex gap-1">
          {["7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-accent-blue text-white"
                  : "bg-background-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              stroke="#525252"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => {
                if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
                if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
                return `$${value}`;
              }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => (
                <span className="text-xs text-text-secondary">{value}</span>
              )}
            />
            <Bar
              dataKey="deposits"
              fill="#10B981"
              name="Deposits"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="withdrawals"
              fill="#EF4444"
              name="Withdrawals"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-text-tertiary mb-1">Total Deposits</p>
          <p className="text-lg font-semibold text-accent-green tabular-nums">
            {formatCurrency(totals.deposits)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">Total Withdrawals</p>
          <p className="text-lg font-semibold text-accent-red tabular-nums">
            {formatCurrency(totals.withdrawals)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">Net Flow</p>
          <p
            className={`text-lg font-semibold tabular-nums ${
              totals.netFlow >= 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {totals.netFlow >= 0 ? "+" : ""}
            {formatCurrency(totals.netFlow)}
          </p>
        </div>
      </div>
    </div>
  );
}

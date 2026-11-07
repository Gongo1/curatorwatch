"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { Panel } from "@/components/layout/Panel";

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
      <div className="bg-background-elevated border border-border-strong px-2.5 py-1.5 num text-xs">
        <p className="text-text-tertiary mb-1">{label ? formatDate(label) : ""}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2 h-2 bg-accent-green" />
            Deposits
          </span>
          <span className="text-text-primary">{formatCurrency(deposits)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2 h-2 bg-accent-red" />
            Withdrawals
          </span>
          <span className="text-text-primary">{formatCurrency(withdrawals)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-border">
          <span className="text-text-secondary">Net flow</span>
          <span className={netFlow >= 0 ? "up" : "down"}>
            {netFlow >= 0 ? "+" : ""}
            {formatCurrency(netFlow)}
          </span>
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

  const rangeGroup = (
    <div role="group" aria-label="Time range" className="flex border border-border-strong">
      {["7d", "30d", "90d"].map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={timeRange === range}
          onClick={() => setTimeRange(range)}
          disabled={loading}
          className={`h-[1.375rem] px-2 num text-[0.7rem] font-semibold uppercase border-r border-border-strong last:border-r-0 transition-colors ${
            timeRange === range
              ? "bg-accent-blue text-signal-ink"
              : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
          }`}
        >
          {range.toUpperCase()}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <Panel title="Transaction volume" action={rangeGroup} bodyClassName="p-3">
        <div className="h-[260px] bg-background-elevated animate-pulse" />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Transaction volume" action={rangeGroup} bodyClassName="p-3">
        <p className="text-sm text-text-secondary">
          Transaction volume could not be loaded: {error}. Reload the page to try again.
        </p>
      </Panel>
    );
  }

  if (data.length === 0) {
    return (
      <Panel title="Transaction volume" action={rangeGroup} bodyClassName="p-3">
        <p className="text-sm text-text-tertiary">
          No deposits or withdrawals in this period. Try a longer range.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Transaction volume" action={rangeGroup}>
      {/* Summary Stats */}
      <dl className="grid grid-cols-3 border-b border-border">
        <div className="px-3 py-2 border-r border-border-subtle min-w-0">
          <dt className="label truncate">Deposits</dt>
          <dd className="num text-base font-semibold up mt-1 truncate">{formatCurrency(totals.deposits)}</dd>
        </div>
        <div className="px-3 py-2 border-r border-border-subtle min-w-0">
          <dt className="label truncate">Withdrawals</dt>
          <dd className="num text-base font-semibold down mt-1 truncate">{formatCurrency(totals.withdrawals)}</dd>
        </div>
        <div className="px-3 py-2 min-w-0">
          <dt className="label truncate">Net flow</dt>
          <dd className={`num text-base font-semibold mt-1 truncate ${totals.netFlow >= 0 ? "up" : "down"}`}>
            {totals.netFlow >= 0 ? "+" : ""}
            {formatCurrency(totals.netFlow)}
          </dd>
        </div>
      </dl>

      <div className="p-3">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
                  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
                  return `$${value}`;
                }}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--background-hover)" }} />
              <Bar dataKey="deposits" fill="var(--accent-green)" name="Deposits" isAnimationActive={false} />
              <Bar dataKey="withdrawals" fill="var(--accent-red)" name="Withdrawals" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* legend */}
        <div className="flex gap-4 mt-2">
          <span className="label inline-flex items-center gap-1.5">
            <span className="w-2 h-2 bg-accent-green" aria-hidden="true" />
            Deposits
          </span>
          <span className="label inline-flex items-center gap-1.5">
            <span className="w-2 h-2 bg-accent-red" aria-hidden="true" />
            Withdrawals
          </span>
        </div>
      </div>
    </Panel>
  );
}

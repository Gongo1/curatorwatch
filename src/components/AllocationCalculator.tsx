"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { calculateVaultEarnings, calculateAnnualEarnings } from "@/lib/utils/calculator";
import { formatCurrency } from "@/lib/utils/format";
import { VaultWarningBadge } from "./VaultWarningBadge";
import { MorphoVerifiedBadge } from "./MorphoVerifiedBadge";
import type { VaultDetail, VaultData, VaultWarning } from "@/lib/types/api";

const DEPOSIT_PRESETS = [100_000, 500_000, 1_000_000, 5_000_000];
const TIMEFRAME_OPTIONS = [
  { label: "6 mo", months: 6 },
  { label: "12 mo", months: 12 },
  { label: "24 mo", months: 24 },
];

function formatInputNumber(val: number): string {
  return val.toLocaleString("en-US");
}

function parseInputNumber(str: string): number {
  return Number(str.replace(/[^0-9.]/g, "")) || 0;
}

function getVaultRate(vault: VaultDetail): { netAPR: number | null; avgNetApy: number | null; hasRate: boolean } {
  const isTurtle = vault.dataSource === "turtle";
  const netAPR = vault.netAPR ?? null;
  const avgNetApy = vault.latestSnapshot?.avgNetApy ?? null;
  const hasRate = isTurtle ? (netAPR != null && netAPR > 0) : (avgNetApy != null && avgNetApy > 0);
  return { netAPR, avgNetApy, hasRate };
}

interface ComparisonVault {
  name: string;
  address: string;
  dataSource: string;
  warnings?: VaultWarning[];
  listed?: boolean;
  assetSymbol: string;
  annualEarnings: number;
  rate: number;
}

export function AllocationCalculator({ vault }: { vault: VaultDetail }) {
  const [deposit, setDeposit] = useState(1_000_000);
  const [displayValue, setDisplayValue] = useState(formatInputNumber(1_000_000));
  const [isFocused, setIsFocused] = useState(false);
  const [months, setMonths] = useState(12);
  const [comparisonVaults, setComparisonVaults] = useState<ComparisonVault[]>([]);

  const { netAPR, avgNetApy, hasRate } = getVaultRate(vault);
  const isTurtle = vault.dataSource === "turtle";

  const result = useMemo(() => {
    if (!hasRate) return null;
    return calculateVaultEarnings(deposit, months, vault.dataSource, netAPR, avgNetApy);
  }, [deposit, months, vault.dataSource, netAPR, avgNetApy, hasRate]);

  // Fetch comparison vaults
  useEffect(() => {
    let cancelled = false;
    async function fetchComparison() {
      try {
        const res = await fetch("/api/vaults");
        const data = await res.json();
        if (!data.success || cancelled) return;

        const allVaults: VaultData[] = data.data;
        const currentAsset = vault.asset.symbol;

        // Best same-asset vault (excluding current)
        let bestSameAsset: ComparisonVault | null = null;
        let bestOverall: ComparisonVault | null = null;

        for (const v of allVaults) {
          if (v.address === vault.address) continue;

          const vIsTurtle = v.dataSource === "turtle";
          const vNetAPR = v.netAPR ?? null;
          const vAvgNetApy = v.latestSnapshot?.avgNetApy ?? null;
          const vHasRate = vIsTurtle ? (vNetAPR != null && vNetAPR > 0) : (vAvgNetApy != null && vAvgNetApy > 0);
          if (!vHasRate) continue;

          const earnings = calculateAnnualEarnings(deposit, v.dataSource, vNetAPR, vAvgNetApy);
          const rate = vIsTurtle ? (vNetAPR ?? 0) : ((vAvgNetApy ?? 0) * 100);

          const entry: ComparisonVault = {
            name: v.name,
            address: v.address,
            dataSource: v.dataSource,
            warnings: v.warnings ?? [],
            listed: v.listed,
            assetSymbol: v.asset.symbol,
            annualEarnings: earnings,
            rate,
          };

          if (v.asset.symbol === currentAsset) {
            if (!bestSameAsset || earnings > bestSameAsset.annualEarnings) {
              bestSameAsset = entry;
            }
          }
          if (!bestOverall || earnings > bestOverall.annualEarnings) {
            bestOverall = entry;
          }
        }

        if (!cancelled) {
          const comps: ComparisonVault[] = [];
          if (bestSameAsset) comps.push(bestSameAsset);
          if (bestOverall && bestOverall.address !== bestSameAsset?.address) {
            comps.push(bestOverall);
          }
          setComparisonVaults(comps);
        }
      } catch {
        // Silently fail — comparison is supplementary
      }
    }

    if (hasRate) fetchComparison();
    return () => { cancelled = true; };
  }, [vault.address, vault.asset.symbol, vault.dataSource, deposit, hasRate]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setDisplayValue(deposit.toString());
  }, [deposit]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseInputNumber(displayValue);
    const clamped = Math.max(0, Math.min(parsed, 1_000_000_000));
    setDeposit(clamped);
    setDisplayValue(formatInputNumber(clamped));
  }, [displayValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  }, []);

  const handlePreset = useCallback((val: number) => {
    setDeposit(val);
    setDisplayValue(formatInputNumber(val));
  }, []);

  // No rate available state
  if (!hasRate) {
    return (
      <section className="mb-6 bg-background-subtle rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold text-text-primary">LP Allocation Calculator</h3>
        </div>
        <p className="text-sm text-text-secondary">Rate data unavailable for this vault. Calculator will be enabled once yield data is collected.</p>
      </section>
    );
  }

  const currentAnnualEarnings = calculateAnnualEarnings(deposit, vault.dataSource, netAPR, avgNetApy);
  const rateLabel = isTurtle ? "Net APR" : "Net APY";
  const rateValue = isTurtle ? (netAPR ?? 0) : ((avgNetApy ?? 0) * 100);

  return (
    <section className="mb-6 bg-background-subtle rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div>
            <h3 className="text-base font-semibold text-text-primary">LP Allocation Calculator</h3>
            <p className="text-xs text-text-tertiary">Estimate earnings based on current rates</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Input Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Deposit Amount */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Deposit Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={isFocused ? displayValue : formatInputNumber(deposit)}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="w-full pl-7 pr-4 py-2 text-sm bg-background-elevated border border-border rounded-lg text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue"
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {DEPOSIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePreset(preset)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    deposit === preset
                      ? "bg-accent-blue text-white"
                      : "bg-background-elevated text-text-muted hover:text-text-primary border border-border"
                  }`}
                >
                  ${preset >= 1_000_000 ? `${preset / 1_000_000}M` : `${preset / 1_000}K`}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Timeframe</label>
            <div className="flex gap-1.5">
              {TIMEFRAME_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  onClick={() => setMonths(opt.months)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    months === opt.months
                      ? "bg-accent-blue text-white"
                      : "bg-background-elevated text-text-muted hover:text-text-primary border border-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        {result && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-background-elevated p-3">
              <p className="text-xs text-text-secondary mb-0.5">First Payment</p>
              <p className="text-sm text-text-tertiary">{isTurtle ? "Month 1" : "Continuous"}</p>
            </div>
            <div className="rounded-lg border border-border bg-background-elevated p-3">
              <p className="text-xs text-text-secondary mb-0.5">Month 1 Earnings</p>
              <p className="text-lg font-semibold text-accent-green tabular-nums">
                ${result.firstMonthEarnings.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border border-accent-green/30 bg-accent-green/5 p-3">
              <p className="text-xs text-text-secondary mb-0.5">
                {months <= 12 ? `${months} Month Total` : "Year 1 Total"}
              </p>
              <p className="text-lg font-bold text-accent-green tabular-nums">
                ${(months <= 12 ? result.totalEarnings : result.yearOneTotal).toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background-elevated p-3">
              <p className="text-xs text-text-secondary mb-0.5">{rateLabel}</p>
              <p className="text-lg font-semibold text-text-primary tabular-nums">
                {rateValue.toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* Cumulative Earnings Chart */}
        {result && result.chartData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">Cumulative Earnings</h4>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="gradEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `M${v}`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                      return `$${v}`;
                    }}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="principal"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="url(#gradPrincipal)"
                    strokeWidth={1.5}
                    name="Principal"
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stackId="1"
                    stroke="#10B981"
                    fill="url(#gradEarnings)"
                    strokeWidth={1.5}
                    name="Earnings"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Payment Schedule Table */}
        {result && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">Payment Schedule</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-background-elevated border-b border-border sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Month</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Payment</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Cumulative</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle bg-background-subtle">
                    {result.schedule.map((row) => (
                      <tr key={row.month} className="hover:bg-background-hover transition-colors">
                        <td className="px-4 py-2 text-sm text-text-primary tabular-nums">{row.month}</td>
                        <td className="px-4 py-2 text-sm text-right text-accent-green tabular-nums">
                          ${row.payment.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-text-secondary tabular-nums">
                          ${row.cumulative.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-text-primary font-medium tabular-nums">
                          ${row.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Distribution Details */}
        <div className="rounded-lg border border-border bg-background-elevated p-4">
          <h4 className="text-sm font-medium text-text-primary mb-2">Distribution Details</h4>
          {isTurtle ? (
            <div className="space-y-1.5">
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Type:</span> Monthly distributions (simple interest)
              </p>
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Frequency:</span> Equal monthly payments based on Net APR
              </p>
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Compounding:</span> No auto-compounding — earnings are distributed, not reinvested
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Type:</span> Auto-compounding (compound interest)
              </p>
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Frequency:</span> Continuous — yield accrues every block
              </p>
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Compounding:</span> Earnings are automatically reinvested into the vault
              </p>
            </div>
          )}
        </div>

        {/* Vault Comparison */}
        {comparisonVaults.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-3">Vault Comparison</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-background-elevated border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Vault</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Rate</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Annual Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-background-subtle">
                  {/* Current vault */}
                  <tr className="bg-accent-blue/5">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-text-primary">{vault.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-medium">Current</span>
                      </div>
                      <span className="text-xs text-text-tertiary">{vault.asset.symbol}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-text-primary tabular-nums">
                      {rateValue.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-accent-green tabular-nums">
                      ${currentAnnualEarnings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                  {/* Comparisons */}
                  {comparisonVaults.map((cv) => (
                    <tr key={cv.address} className="hover:bg-background-hover transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/vault/${cv.address}`}
                            className="text-sm font-medium text-text-primary hover:text-accent-blue transition-colors"
                          >
                            {cv.name}
                          </a>
                          <VaultWarningBadge warnings={cv.warnings} />
                          <MorphoVerifiedBadge listed={cv.listed} />
                        </div>
                        <span className="text-xs text-text-tertiary">{cv.assetSymbol}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-text-primary tabular-nums">
                        {cv.rate.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                        <span className={cv.annualEarnings > currentAnnualEarnings ? "text-accent-green" : "text-text-secondary"}>
                          ${cv.annualEarnings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[11px] text-text-muted text-center">
          Projections based on current rates. Actual returns may vary.
        </p>
      </div>
    </section>
  );
}

// Custom tooltip for the earnings chart
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="bg-background-elevated border border-border rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-text-secondary mb-1">Month {label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-text-secondary">{item.name}</span>
          </span>
          <span className="font-medium text-text-primary tabular-nums">
            ${item.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
      <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between text-xs">
        <span className="text-text-secondary">Total</span>
        <span className="font-semibold text-text-primary tabular-nums">
          ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

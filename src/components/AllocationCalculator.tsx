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
import { Panel } from "@/components/layout/Panel";
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
      <Panel title="LP allocation calculator" bodyClassName="p-3">
        <p className="text-sm text-text-secondary">
          Rate data is not available for this vault yet. The calculator turns on once yield data is collected.
        </p>
      </Panel>
    );
  }

  const currentAnnualEarnings = calculateAnnualEarnings(deposit, vault.dataSource, netAPR, avgNetApy);
  const rateLabel = isTurtle ? "Net APR" : "Net APY";
  const rateValue = isTurtle ? (netAPR ?? 0) : ((avgNetApy ?? 0) * 100);

  const segBtn = (active: boolean) =>
    `h-7 px-2.5 border-r border-border-strong last:border-r-0 transition-colors ${
      active
        ? "bg-accent-blue text-signal-ink"
        : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
    }`;
  const th = "label px-3 h-7";
  const usd = (n: number, digits = 2) => `$${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`;

  return (
    <Panel title="LP allocation calculator" meta="estimate at current rates">
      {/* Input Controls */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-border">
        {/* Deposit Amount */}
        <div className="flex-1 min-w-0">
          <label htmlFor="calc-deposit" className="label block mb-1">Deposit amount</label>
          <div className="flex flex-wrap gap-1.5">
            <div className="relative flex-1 min-w-[10rem]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm num">$</span>
              <input
                id="calc-deposit"
                type="text"
                inputMode="numeric"
                value={isFocused ? displayValue : formatInputNumber(deposit)}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="field h-7 pl-6 num text-sm"
              />
            </div>
            <div role="group" aria-label="Deposit presets" className="flex border border-border-strong">
              {DEPOSIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={deposit === preset}
                  onClick={() => handlePreset(preset)}
                  className={`num text-xs font-semibold ${segBtn(deposit === preset)}`}
                >
                  ${preset >= 1_000_000 ? `${preset / 1_000_000}M` : `${preset / 1_000}K`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <span id="calc-timeframe" className="label block mb-1">Timeframe</span>
          <div role="group" aria-labelledby="calc-timeframe" className="flex w-fit border border-border-strong">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.months}
                type="button"
                aria-pressed={months === opt.months}
                onClick={() => setMonths(opt.months)}
                className={`cond text-[0.75rem] font-semibold uppercase tracking-[0.04em] ${segBtn(months === opt.months)}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {result && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 border-b border-border">
          <div className="px-3 py-2 border-r border-b lg:border-b-0 border-border-subtle min-w-0">
            <dt className="label">First payment</dt>
            <dd className="text-sm text-text-secondary mt-1">{isTurtle ? "Month 1" : "Continuous"}</dd>
          </div>
          <div className="px-3 py-2 border-b lg:border-b-0 lg:border-r border-border-subtle min-w-0">
            <dt className="label">Month 1 earnings</dt>
            <dd className="num text-base font-semibold text-text-primary mt-1 truncate">{usd(result.firstMonthEarnings)}</dd>
          </div>
          <div className="px-3 py-2 border-r border-border-subtle min-w-0">
            <dt className="label">{months <= 12 ? `${months} month total` : "Year 1 total"}</dt>
            <dd className="num text-base font-bold text-accent-blue mt-1 truncate">
              {usd(months <= 12 ? result.totalEarnings : result.yearOneTotal)}
            </dd>
          </div>
          <div className="px-3 py-2 min-w-0">
            <dt className="label">{rateLabel}</dt>
            <dd className="num text-base font-semibold text-text-primary mt-1">{rateValue.toFixed(2)}%</dd>
          </div>
        </dl>
      )}

      {/* Cumulative Earnings Chart */}
      {result && result.chartData.length > 0 && (
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-4 mb-2">
            <h3 className="label text-text-secondary">Cumulative earnings</h3>
            <span className="label inline-flex items-center gap-1.5">
              <span className="w-2 h-2" style={{ background: "var(--chart-2)" }} aria-hidden="true" />
              Principal
            </span>
            <span className="label inline-flex items-center gap-1.5">
              <span className="w-2 h-2" style={{ background: "var(--chart-1)" }} aria-hidden="true" />
              Earnings
            </span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={result.chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickFormatter={(v) => `M${v}`}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                    return `$${v}`;
                  }}
                  width={56}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="principal"
                  stackId="1"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.18}
                  strokeWidth={1.25}
                  name="Principal"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stackId="1"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.35}
                  strokeWidth={1.25}
                  name="Earnings"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payment Schedule Table */}
      {result && (
        <div className="border-b border-border">
          <h3 className="label text-text-secondary px-3 pt-2.5 pb-1">Payment schedule</h3>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-y border-border">
                  <th scope="col" className={`${th} text-left`}>Month</th>
                  <th scope="col" className={`${th} text-right`}>Payment</th>
                  <th scope="col" className={`${th} text-right`}>Cumulative</th>
                  <th scope="col" className={`${th} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map((row) => (
                  <tr key={row.month} className="h-8 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors">
                    <td className="px-3 num text-text-secondary">{row.month}</td>
                    <td className="px-3 num text-right text-text-primary">{usd(row.payment)}</td>
                    <td className="px-3 num text-right text-text-secondary">{usd(row.cumulative)}</td>
                    <td className="px-3 num text-right text-text-primary font-medium">{usd(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distribution Details */}
      <div className="p-3 border-b border-border">
        <h3 className="label text-text-secondary mb-1.5">Distribution details</h3>
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-xs">
          {isTurtle ? (
            <>
              <dt className="label">Type</dt>
              <dd className="text-text-secondary">Monthly distributions (simple interest)</dd>
              <dt className="label">Frequency</dt>
              <dd className="text-text-secondary">Equal monthly payments based on Net APR</dd>
              <dt className="label">Compounding</dt>
              <dd className="text-text-secondary">None. Earnings are distributed, not reinvested.</dd>
            </>
          ) : (
            <>
              <dt className="label">Type</dt>
              <dd className="text-text-secondary">Auto-compounding (compound interest)</dd>
              <dt className="label">Frequency</dt>
              <dd className="text-text-secondary">Continuous. Yield accrues every block.</dd>
              <dt className="label">Compounding</dt>
              <dd className="text-text-secondary">Earnings are automatically reinvested into the vault</dd>
            </>
          )}
        </dl>
      </div>

      {/* Vault Comparison */}
      {comparisonVaults.length > 0 && (
        <div className="border-b border-border">
          <h3 className="label text-text-secondary px-3 pt-2.5 pb-1">Vault comparison</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-background">
                  <th scope="col" className={`${th} text-left`}>Vault</th>
                  <th scope="col" className={`${th} text-right`}>Rate</th>
                  <th scope="col" className={`${th} text-right`}>Annual earnings</th>
                </tr>
              </thead>
              <tbody>
                {/* Current vault */}
                <tr className="h-9 border-b border-border-subtle bg-background-elevated">
                  <td className="px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-text-primary">{vault.name}</span>
                      <span className="label inline-flex items-center h-[1.15rem] px-1 border border-accent-blue text-accent-blue">Current</span>
                      <span className="label hidden sm:inline">{vault.asset.symbol}</span>
                    </div>
                  </td>
                  <td className="px-3 text-right num text-text-primary">{rateValue.toFixed(2)}%</td>
                  <td className="px-3 text-right num font-semibold text-text-primary">{usd(currentAnnualEarnings, 0)}</td>
                </tr>
                {/* Comparisons */}
                {comparisonVaults.map((cv) => (
                  <tr key={cv.address} className="h-9 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors">
                    <td className="px-3">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/vault/${cv.address}`}
                          className="font-medium text-text-primary hover:text-accent-blue transition-colors"
                        >
                          {cv.name}
                        </a>
                        <VaultWarningBadge warnings={cv.warnings} />
                        <MorphoVerifiedBadge listed={cv.listed} />
                        <span className="label hidden sm:inline">{cv.assetSymbol}</span>
                      </div>
                    </td>
                    <td className="px-3 text-right num text-text-primary">{cv.rate.toFixed(2)}%</td>
                    <td className="px-3 text-right num font-semibold">
                      <span className={cv.annualEarnings > currentAnnualEarnings ? "up" : "text-text-secondary"}>
                        {usd(cv.annualEarnings, 0)}
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
      <p className="px-3 py-2 text-xs text-text-muted">
        Projections use current rates. Actual returns may vary.
      </p>
    </Panel>
  );
}

// Custom tooltip for the earnings chart
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="bg-background-elevated border border-border-strong px-2.5 py-1.5 num text-xs">
      <p className="text-text-tertiary mb-1">Month {label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2" style={{ backgroundColor: item.color }} />
            <span className="text-text-secondary">{item.name}</span>
          </span>
          <span className="text-text-primary">
            ${item.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
      <div className="border-t border-border mt-1 pt-1 flex justify-between">
        <span className="text-text-secondary">Total</span>
        <span className="font-semibold text-text-primary">
          ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

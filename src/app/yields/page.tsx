"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";

interface VaultYieldData {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  curatorName: string | null;
  tvl: number;
  netApy: number;
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  annualizedYield: number;
}

interface CuratorYieldData {
  curatorId: string;
  curatorName: string;
  curatorAddress: string;
  vaultCount: number;
  totalAUM: number;
  avgNetApy: number;
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  annualizedYield: number;
}

interface YieldSummary {
  totalVaults: number;
  totalCurators: number;
  totalAUM: number;
  avgNetApy: number;
  yield: {
    daily: number;
    weekly: number;
    monthly: number;
    annualized: number;
  };
}

type ViewMode = "curators" | "vaults";
type TimeFrame = "daily" | "weekly" | "monthly" | "annualized";

export default function YieldsPage() {
  const [summary, setSummary] = useState<YieldSummary | null>(null);
  const [curatorYields, setCuratorYields] = useState<CuratorYieldData[]>([]);
  const [vaultYields, setVaultYields] = useState<VaultYieldData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("curators");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("annualized");

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/stats/yield-breakdown");
        const data = await response.json();
        if (data.success) {
          setSummary(data.data.summary);
          setCuratorYields(data.data.byCurator);
          setVaultYields(data.data.byVault);
        }
      } catch (err) {
        console.error("Failed to fetch yields:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getYieldForTimeFrame = (item: CuratorYieldData | VaultYieldData) => {
    switch (timeFrame) {
      case "daily": return item.dailyYield;
      case "weekly": return item.weeklyYield;
      case "monthly": return item.monthlyYield;
      case "annualized": return item.annualizedYield;
    }
  };

  const getSummaryYieldForTimeFrame = () => {
    if (!summary) return 0;
    switch (timeFrame) {
      case "daily": return summary.yield.daily;
      case "weekly": return summary.yield.weekly;
      case "monthly": return summary.yield.monthly;
      case "annualized": return summary.yield.annualized;
    }
  };

  const timeFrameLabels: Record<TimeFrame, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    annualized: "Annualized",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-background-elevated rounded" />
            <div className="grid grid-cols-4 gap-4">
              <div className="h-24 bg-background-elevated rounded-xl" />
              <div className="h-24 bg-background-elevated rounded-xl" />
              <div className="h-24 bg-background-elevated rounded-xl" />
              <div className="h-24 bg-background-elevated rounded-xl" />
            </div>
            <div className="h-64 bg-background-elevated rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Yield Payouts</h1>
          <p className="text-sm text-text-secondary">
            Estimated yield generated for depositors across Morpho V2 vaults
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              label="Total Yield (Annualized)"
              value={formatCurrency(summary.yield.annualized)}
              subtext="Generated for depositors"
              highlight
            />
            <SummaryCard
              label="Monthly Yield"
              value={formatCurrency(summary.yield.monthly)}
              subtext="Current run rate"
            />
            <SummaryCard
              label="Daily Yield"
              value={formatCurrency(summary.yield.daily)}
              subtext="Earned per day"
            />
            <SummaryCard
              label="Avg Net APY"
              value={`${summary.avgNetApy.toFixed(2)}%`}
              subtext={`Across ${summary.totalVaults} vaults`}
              valueColor="text-accent-green"
            />
          </div>
        )}

        {/* Explainer */}
        <div className="mb-6 p-4 bg-accent-blue/10 border border-accent-blue/20 rounded-xl">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-accent-blue">How it works:</span> Yield is calculated based on each vault's current TVL and Net APY.
            Net APY is the return depositors receive after all fees (curator + protocol). These are projected yields based on current rates.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">View by:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("curators")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "curators"
                    ? "bg-accent-blue text-white"
                    : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                }`}
              >
                Curators
              </button>
              <button
                onClick={() => setViewMode("vaults")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "vaults"
                    ? "bg-accent-blue text-white"
                    : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                }`}
              >
                Vaults
              </button>
            </div>
          </div>

          {/* Time Frame Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Period:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["daily", "weekly", "monthly", "annualized"] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    timeFrame === tf
                      ? "bg-accent-green text-white"
                      : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                  }`}
                >
                  {timeFrameLabels[tf]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Total for selected timeframe */}
        <div className="mb-4 p-3 bg-background-subtle rounded-lg border border-border inline-block">
          <span className="text-sm text-text-secondary">
            Total {timeFrameLabels[timeFrame]} Yield:{" "}
          </span>
          <span className="text-lg font-bold text-accent-green">
            {formatCurrency(getSummaryYieldForTimeFrame())}
          </span>
        </div>

        {/* Curator Yields Table */}
        {viewMode === "curators" && (
          <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Curator
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Total Deposits
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Vaults
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Avg Net APY
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      {timeFrameLabels[timeFrame]} Yield
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {curatorYields.map((curator, index) => (
                    <tr key={curator.curatorId} className="hover:bg-background-elevated/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? "bg-yellow-500 text-black" :
                            index === 1 ? "bg-neutral-300 text-black" :
                            index === 2 ? "bg-amber-700 text-white" :
                            "bg-neutral-700 text-white"
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">{curator.curatorName}</p>
                            <p className="text-xs text-text-tertiary font-mono">
                              {curator.curatorAddress.slice(0, 6)}...{curator.curatorAddress.slice(-4)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-medium text-text-primary tabular-nums">
                          {formatCurrency(curator.totalAUM)}
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="text-text-secondary">{curator.vaultCount}</span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="text-accent-green font-medium tabular-nums">
                          {curator.avgNetApy.toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-bold text-accent-green tabular-nums text-lg">
                          {formatCurrency(getYieldForTimeFrame(curator))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vault Yields Table */}
        {viewMode === "vaults" && (
          <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Vault
                    </th>
                    <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Curator
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Total Deposits
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      Net APY
                    </th>
                    <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                      {timeFrameLabels[timeFrame]} Yield
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vaultYields.slice(0, 50).map((vault, index) => (
                    <tr key={vault.vaultId} className="hover:bg-background-elevated/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? "bg-yellow-500 text-black" :
                            index === 1 ? "bg-neutral-300 text-black" :
                            index === 2 ? "bg-amber-700 text-white" :
                            "bg-neutral-700 text-white"
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <Link
                              href={`/vault/${vault.vaultAddress}`}
                              className="font-medium text-text-primary hover:text-accent-blue transition-colors"
                            >
                              {vault.vaultName}
                            </Link>
                            <p className="text-xs text-text-tertiary">{vault.assetSymbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">{vault.curatorName || "-"}</span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-medium text-text-primary tabular-nums">
                          {formatCurrency(vault.tvl)}
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="text-accent-green font-medium tabular-nums">
                          {vault.netApy.toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-bold text-accent-green tabular-nums text-lg">
                          {formatCurrency(getYieldForTimeFrame(vault))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-background-subtle mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <p>
              Data from{" "}
              <a href="https://api.morpho.org/graphql" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:text-accent-blue-hover">Morpho API</a>
              {" "}• Updated hourly
            </p>
            <div className="flex items-center gap-3">
              <a href="https://x.com/curator_watch" target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-text-primary transition-colors" title="Follow us on X">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                Live
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="CuratorWatch" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight leading-tight">
                CuratorWatch
              </h1>
              <p className="text-[10px] text-text-tertiary leading-tight">
                Morpho V2 Vault Analytics
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/vaults"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Vaults
            </Link>
            <Link href="/yields" className="text-sm font-medium text-accent-blue">
              Yields
            </Link>
            <Link
              href="/alerts"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Alerts
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  highlight,
  valueColor,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-accent-green/30 bg-accent-green/5"
          : "border-border bg-background-subtle"
      }`}
    >
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          valueColor || (highlight ? "text-accent-green" : "text-text-primary")
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-text-tertiary mt-1">{subtext}</p>
    </div>
  );
}

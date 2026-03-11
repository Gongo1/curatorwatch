"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";
import { VaultYieldsGrid } from "@/components/grid/YieldsGrid";

interface VaultYieldData {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  dataSource?: string;
  grade?: string | null;
  gradeFailures?: string[];
  assetSymbol: string;
  curatorId: string | null;
  curatorName: string | null;
  curatorAddress: string | null;
  tvl: number;
  netApy: number;
  grossApy: number;
  performanceFee: number;
  managementFee: number;
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

interface CuratorWithVaults extends CuratorYieldData {
  vaults: VaultYieldData[];
  minNetApy: number;
  maxNetApy: number;
  avgFee: number;
  vaultsByAsset: Record<string, VaultYieldData[]>;
}

type ViewMode = "curators" | "vaults";
type TimeFrame = "daily" | "weekly" | "monthly" | "annualized";
type SortDir = "asc" | "desc";
type CuratorSortKey = "name" | "vaults" | "tvl" | "yieldRange" | "avgFee" | "yield";
type VaultSortKey = "name" | "curator" | "tvl" | "grossApy" | "netApy" | "fee" | "yield";

export default function YieldsPage() {
  const [summary, setSummary] = useState<YieldSummary | null>(null);
  const [curatorYields, setCuratorYields] = useState<CuratorYieldData[]>([]);
  const [vaultYields, setVaultYields] = useState<VaultYieldData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("curators");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("annualized");
  const [expandedCurator, setExpandedCurator] = useState<string | null>(null);
  const [curatorSort, setCuratorSort] = useState<{ key: CuratorSortKey; dir: SortDir }>({ key: "yield", dir: "desc" });
  const [vaultSort, setVaultSort] = useState<{ key: VaultSortKey; dir: SortDir }>({ key: "yield", dir: "desc" });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats/yield-breakdown?dataSource=morpho");
        const data = await res.json();
        if (data.success) {
          setSummary(data.data.summary);
          setCuratorYields(data.data.byCurator);
          setVaultYields(data.data.byVault);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Build curator rows with vault breakdowns
  const curatorRows = useMemo(() => {
    const curatorMap = new Map<string, CuratorWithVaults>();

    for (const curator of curatorYields) {
      curatorMap.set(curator.curatorId, {
        ...curator,
        vaults: [],
        minNetApy: Infinity,
        maxNetApy: -Infinity,
        avgFee: 0,
        vaultsByAsset: {},
      });
    }

    for (const vault of vaultYields) {
      const key = vault.curatorId || "unknown";
      const curator = curatorMap.get(key);
      if (!curator) continue;

      curator.vaults.push(vault);
      if (vault.netApy < curator.minNetApy) curator.minNetApy = vault.netApy;
      if (vault.netApy > curator.maxNetApy) curator.maxNetApy = vault.netApy;

      if (!curator.vaultsByAsset[vault.assetSymbol]) {
        curator.vaultsByAsset[vault.assetSymbol] = [];
      }
      curator.vaultsByAsset[vault.assetSymbol].push(vault);
    }

    for (const curator of curatorMap.values()) {
      if (curator.vaults.length > 0) {
        const totalFee = curator.vaults.reduce((sum, v) => sum + v.performanceFee, 0);
        curator.avgFee = totalFee / curator.vaults.length;
      }
      if (curator.minNetApy === Infinity) curator.minNetApy = 0;
      if (curator.maxNetApy === -Infinity) curator.maxNetApy = 0;

      for (const asset of Object.keys(curator.vaultsByAsset)) {
        curator.vaultsByAsset[asset].sort((a, b) => b.tvl - a.tvl);
      }
    }

    const rows = Array.from(curatorMap.values());
    const dir = curatorSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (curatorSort.key) {
        case "name": return dir * a.curatorName.localeCompare(b.curatorName);
        case "vaults": return dir * (a.vaultCount - b.vaultCount);
        case "tvl": return dir * (a.totalAUM - b.totalAUM);
        case "yieldRange": return dir * (a.maxNetApy - b.maxNetApy);
        case "avgFee": return dir * (a.avgFee - b.avgFee);
        case "yield": return dir * (a.annualizedYield - b.annualizedYield);
        default: return 0;
      }
    });

    return rows;
  }, [curatorYields, vaultYields, curatorSort]);

  const sortedVaults = useMemo(() => {
    const sorted = [...vaultYields];
    const dir = vaultSort.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      switch (vaultSort.key) {
        case "name": return dir * a.vaultName.localeCompare(b.vaultName);
        case "curator": return dir * (a.curatorName || "").localeCompare(b.curatorName || "");
        case "tvl": return dir * (a.tvl - b.tvl);
        case "grossApy": return dir * (a.grossApy - b.grossApy);
        case "netApy": return dir * (a.netApy - b.netApy);
        case "fee": return dir * (a.performanceFee - b.performanceFee);
        case "yield": return dir * (a.annualizedYield - b.annualizedYield);
        default: return 0;
      }
    });
    return sorted;
  }, [vaultYields, vaultSort]);

  function toggleCuratorSort(key: CuratorSortKey) {
    setCuratorSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  function toggleVaultSort(key: VaultSortKey) {
    setVaultSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  const getVaultYieldForTimeFrame = (vault: VaultYieldData) => {
    switch (timeFrame) {
      case "daily": return vault.dailyYield;
      case "weekly": return vault.weeklyYield;
      case "monthly": return vault.monthlyYield;
      case "annualized": return vault.annualizedYield;
    }
  };

  const getCuratorYieldForTimeFrame = (curator: CuratorYieldData) => {
    switch (timeFrame) {
      case "daily": return curator.dailyYield;
      case "weekly": return curator.weeklyYield;
      case "monthly": return curator.monthlyYield;
      case "annualized": return curator.annualizedYield;
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
      <>
        <PageHeader title="Yields" description="Yield generation across vaults and curators" breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Yields" }]} />
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-background-elevated rounded-xl" />
            <div className="h-24 bg-background-elevated rounded-xl" />
            <div className="h-24 bg-background-elevated rounded-xl" />
            <div className="h-24 bg-background-elevated rounded-xl" />
          </div>
          <div className="h-64 bg-background-elevated rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Yields" description="Yield generation across vaults and curators" breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Yields" }]} />

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
              label="Total Vaults"
              value={`${summary.totalVaults}`}
              subtext={`${summary.totalCurators} curators`}
            />
          </div>
        )}

        {/* Explainer */}
        <div className="mb-6 p-4 bg-accent-blue/10 border border-accent-blue/20 rounded-xl">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-accent-blue">How it works:</span> Yield is calculated based on each vault&apos;s current TVL and net rate.
            Morpho vaults use Net APY (compound interest). Turtle vaults use Net APR (simple interest) from the Turtle API.
            These are projected yields based on current rates.
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

        {/* Curator Yields Table — Expandable */}
        {viewMode === "curators" && (
          <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <SortableHeader label="Curator" sortKey="name" currentSort={curatorSort} onSort={toggleCuratorSort} align="left" />
                    <SortableHeader label="TVL" sortKey="tvl" currentSort={curatorSort} onSort={toggleCuratorSort} />
                    <SortableHeader label="Vaults" sortKey="vaults" currentSort={curatorSort} onSort={toggleCuratorSort} />
                    <SortableHeader label="Yield Range" sortKey="yieldRange" currentSort={curatorSort} onSort={toggleCuratorSort} />
                    <SortableHeader label="Avg Fee" sortKey="avgFee" currentSort={curatorSort} onSort={toggleCuratorSort} />
                    <SortableHeader label={`${timeFrameLabels[timeFrame]} Yield`} sortKey="yield" currentSort={curatorSort} onSort={toggleCuratorSort} />
                    <th className="w-10 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {curatorRows.map((curator) => {
                    const isExpanded = expandedCurator === curator.curatorId;
                    const assetKeys = Object.keys(curator.vaultsByAsset).sort();
                    return (
                      <CuratorRow
                        key={curator.curatorId}
                        curator={curator}
                        isExpanded={isExpanded}
                        assetKeys={assetKeys}
                        timeFrame={timeFrame}
                        timeFrameLabels={timeFrameLabels}
                        getCuratorYieldForTimeFrame={getCuratorYieldForTimeFrame}
                        getVaultYieldForTimeFrame={getVaultYieldForTimeFrame}
                        onToggle={() =>
                          setExpandedCurator(isExpanded ? null : curator.curatorId)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vault Yields Grid */}
        {viewMode === "vaults" && (
          <VaultYieldsGrid vaults={sortedVaults} timeFrame={timeFrame} />
        )}
    </>
  );
}

function SortableHeader<T extends string>({
  label,
  sortKey,
  currentSort,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: T;
  currentSort: { key: T; dir: SortDir };
  onSort: (key: T) => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <th
      className={`${align === "left" ? "text-left" : "text-right"} text-xs font-medium uppercase tracking-wider px-4 py-3 cursor-pointer select-none hover:text-text-primary transition-colors ${
        isActive ? "text-accent-blue" : "text-text-secondary"
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {isActive && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {currentSort.dir === "desc" ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            )}
          </svg>
        )}
      </span>
    </th>
  );
}

function CuratorRow({
  curator,
  isExpanded,
  assetKeys,
  timeFrame,
  timeFrameLabels,
  getCuratorYieldForTimeFrame,
  getVaultYieldForTimeFrame,
  onToggle,
}: {
  curator: CuratorWithVaults;
  isExpanded: boolean;
  assetKeys: string[];
  timeFrame: TimeFrame;
  timeFrameLabels: Record<TimeFrame, string>;
  getCuratorYieldForTimeFrame: (c: CuratorYieldData) => number;
  getVaultYieldForTimeFrame: (v: VaultYieldData) => number;
  onToggle: () => void;
}) {
  const yieldRangeText =
    curator.vaultCount === 1
      ? `${curator.minNetApy.toFixed(2)}%`
      : `${curator.minNetApy.toFixed(2)}% – ${curator.maxNetApy.toFixed(2)}%`;

  return (
    <>
      <tr
        className="hover:bg-background-elevated/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <Link href={`/curator/${curatorSlug(curator.curatorName, curator.curatorAddress)}`} className="flex items-center gap-3 group" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-text-primary group-hover:text-accent-blue transition-colors">{curator.curatorName}</p>
          </Link>
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
          <span className="text-accent-green font-medium tabular-nums text-sm">
            {yieldRangeText}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="text-text-secondary tabular-nums text-sm">
            {curator.avgFee > 0 ? `${curator.avgFee.toFixed(1)}%` : "None"}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-bold text-accent-green tabular-nums text-lg">
            {formatCurrency(getCuratorYieldForTimeFrame(curator))}
          </span>
        </td>
        <td className="px-2">
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-background-elevated/40 border-t border-border px-6 py-4">
              <div className="space-y-4">
                {assetKeys.map((asset) => {
                  const vaults = curator.vaultsByAsset[asset];
                  return (
                    <div key={asset}>
                      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                        {asset}
                      </p>
                      <div className="space-y-1">
                        {vaults.map((vault) => (
                          <div
                            key={vault.vaultId}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-hover/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/vault/${vault.vaultAddress}`}
                                className="text-sm font-medium text-text-primary hover:text-accent-blue transition-colors"
                              >
                                {vault.vaultName}
                              </Link>
                              <p className="text-xs text-text-muted tabular-nums">
                                TVL {formatCurrency(vault.tvl)}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-sm tabular-nums">
                                  <span className="text-text-secondary">
                                    {vault.grossApy.toFixed(2)}%
                                  </span>
                                  <span className="text-text-muted mx-1">&rarr;</span>
                                  <span className="text-accent-green font-medium">
                                    {vault.netApy.toFixed(2)}%
                                  </span>
                                  <span className="text-text-muted ml-1 text-xs">
                                    {vault.dataSource === "turtle" ? "APR" : "APY"}
                                  </span>
                                  {vault.performanceFee > 0 && (
                                    <span className="text-text-muted ml-1.5 text-xs">
                                      ({vault.performanceFee.toFixed(1)}% fee)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right w-24">
                                <span className="text-sm font-semibold text-accent-green tabular-nums">
                                  {formatCurrency(getVaultYieldForTimeFrame(vault))}
                                </span>
                                <p className="text-[10px] text-text-muted">
                                  {timeFrameLabels[timeFrame].toLowerCase()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  highlight,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
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
          highlight ? "text-accent-green" : "text-text-primary"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-text-tertiary mt-1">{subtext}</p>
    </div>
  );
}

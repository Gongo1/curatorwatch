"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils/format";

interface VaultYieldData {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
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

interface LiquidationEvent {
  txHash: string;
  timestamp: string;
  marketUniqueKey: string;
  borrower: string;
  seizedAssetsUsd: number;
  repaidAssetsUsd: number;
  badDebtAssetsUsd: number;
}

interface CuratorLiquidationData {
  curatorId: string;
  curatorName: string;
  curatorAddress: string;
  totalEvents: number;
  totalSeizedUsd: number;
  totalRepaidUsd: number;
  totalBadDebtUsd: number;
  recent30d: number;
  events: LiquidationEvent[];
}

interface LiquidationSummary {
  totalEvents: number;
  totalSeizedUsd: number;
  totalRepaidUsd: number;
  totalBadDebtUsd: number;
  recent30d: number;
  marketsAffected: number;
}

type ViewMode = "curators" | "vaults" | "fees" | "liquidations";
type TimeFrame = "daily" | "weekly" | "monthly" | "annualized";
type SortDir = "asc" | "desc";
type CuratorSortKey = "name" | "vaults" | "tvl" | "yieldRange" | "avgFee" | "yield";
type VaultSortKey = "name" | "curator" | "tvl" | "grossApy" | "netApy" | "fee" | "yield";
type FeeSortKey = "name" | "aum" | "avgFee" | "annualRevenue" | "vaults";
type LiqSortKey = "name" | "events" | "seized" | "repaid" | "badDebt" | "recent30d";

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
  const [feeSort, setFeeSort] = useState<{ key: FeeSortKey; dir: SortDir }>({ key: "annualRevenue", dir: "desc" });
  const [expandedFeeCurator, setExpandedFeeCurator] = useState<string | null>(null);
  const [liqSummary, setLiqSummary] = useState<LiquidationSummary | null>(null);
  const [liqByCurator, setLiqByCurator] = useState<CuratorLiquidationData[]>([]);
  const [liqSort, setLiqSort] = useState<{ key: LiqSortKey; dir: SortDir }>({ key: "seized", dir: "desc" });
  const [expandedLiqCurator, setExpandedLiqCurator] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [yieldRes, liqRes] = await Promise.all([
          fetch("/api/stats/yield-breakdown"),
          fetch("/api/stats/liquidation-breakdown"),
        ]);
        const yieldData = await yieldRes.json();
        if (yieldData.success) {
          setSummary(yieldData.data.summary);
          setCuratorYields(yieldData.data.byCurator);
          setVaultYields(yieldData.data.byVault);
        }
        const liqData = await liqRes.json();
        if (liqData.success) {
          setLiqSummary(liqData.data.summary);
          setLiqByCurator(liqData.data.byCurator);
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

    // Start with curator-level data
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

    // Attach vaults to their curators
    for (const vault of vaultYields) {
      const key = vault.curatorId || "unknown";
      const curator = curatorMap.get(key);
      if (!curator) continue;

      curator.vaults.push(vault);

      if (vault.netApy < curator.minNetApy) curator.minNetApy = vault.netApy;
      if (vault.netApy > curator.maxNetApy) curator.maxNetApy = vault.netApy;

      // Group by asset
      if (!curator.vaultsByAsset[vault.assetSymbol]) {
        curator.vaultsByAsset[vault.assetSymbol] = [];
      }
      curator.vaultsByAsset[vault.assetSymbol].push(vault);
    }

    // Calculate avg fee and sort vaults within each asset group
    for (const curator of curatorMap.values()) {
      if (curator.vaults.length > 0) {
        const totalFee = curator.vaults.reduce(
          (sum, v) => sum + v.performanceFee,
          0
        );
        curator.avgFee = totalFee / curator.vaults.length;
      }
      if (curator.minNetApy === Infinity) curator.minNetApy = 0;
      if (curator.maxNetApy === -Infinity) curator.maxNetApy = 0;

      // Sort vaults within each asset group by TVL descending
      for (const asset of Object.keys(curator.vaultsByAsset)) {
        curator.vaultsByAsset[asset].sort((a, b) => b.tvl - a.tvl);
      }
    }

    const rows = Array.from(curatorMap.values());

    // Sort based on current sort state
    const dir = curatorSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (curatorSort.key) {
        case "name":
          return dir * a.curatorName.localeCompare(b.curatorName);
        case "vaults":
          return dir * (a.vaultCount - b.vaultCount);
        case "tvl":
          return dir * (a.totalAUM - b.totalAUM);
        case "yieldRange":
          return dir * (a.maxNetApy - b.maxNetApy);
        case "avgFee":
          return dir * (a.avgFee - b.avgFee);
        case "yield":
          return dir * (a.annualizedYield - b.annualizedYield);
        default:
          return 0;
      }
    });

    return rows;
  }, [curatorYields, vaultYields, curatorSort]);

  const sortedVaults = useMemo(() => {
    const sorted = [...vaultYields];
    const dir = vaultSort.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      switch (vaultSort.key) {
        case "name":
          return dir * a.vaultName.localeCompare(b.vaultName);
        case "curator":
          return dir * (a.curatorName || "").localeCompare(b.curatorName || "");
        case "tvl":
          return dir * (a.tvl - b.tvl);
        case "grossApy":
          return dir * (a.grossApy - b.grossApy);
        case "netApy":
          return dir * (a.netApy - b.netApy);
        case "fee":
          return dir * (a.performanceFee - b.performanceFee);
        case "yield":
          return dir * (a.annualizedYield - b.annualizedYield);
        default:
          return 0;
      }
    });
    return sorted;
  }, [vaultYields, vaultSort]);

  // Fee tab data: curator rows sorted by fee-related fields
  const feeCuratorRows = useMemo(() => {
    const rows = curatorRows.map((curator) => {
      const annualRevenue = curator.vaults.reduce(
        (sum, v) => sum + (v.tvl * v.performanceFee) / 100,
        0
      );
      return { ...curator, annualRevenue };
    });

    const dir = feeSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (feeSort.key) {
        case "name":
          return dir * a.curatorName.localeCompare(b.curatorName);
        case "aum":
          return dir * (a.totalAUM - b.totalAUM);
        case "avgFee":
          return dir * (a.avgFee - b.avgFee);
        case "annualRevenue":
          return dir * (a.annualRevenue - b.annualRevenue);
        case "vaults":
          return dir * (a.vaultCount - b.vaultCount);
        default:
          return 0;
      }
    });

    return rows;
  }, [curatorRows, feeSort]);

  // Fee tab summary stats
  const feeSummary = useMemo(() => {
    const totalAnnualFees = vaultYields.reduce(
      (sum, v) => sum + (v.tvl * v.performanceFee) / 100,
      0
    );
    const avgFeeRate =
      vaultYields.length > 0
        ? vaultYields.reduce((sum, v) => sum + v.performanceFee, 0) /
          vaultYields.length
        : 0;
    const totalAUM = vaultYields.reduce((sum, v) => sum + v.tvl, 0);
    return { totalAnnualFees, avgFeeRate, totalAUM, vaultCount: vaultYields.length };
  }, [vaultYields]);

  const sortedLiqCurators = useMemo(() => {
    const rows = [...liqByCurator];
    const dir = liqSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (liqSort.key) {
        case "name":
          return dir * a.curatorName.localeCompare(b.curatorName);
        case "events":
          return dir * (a.totalEvents - b.totalEvents);
        case "seized":
          return dir * (a.totalSeizedUsd - b.totalSeizedUsd);
        case "repaid":
          return dir * (a.totalRepaidUsd - b.totalRepaidUsd);
        case "badDebt":
          return dir * (a.totalBadDebtUsd - b.totalBadDebtUsd);
        case "recent30d":
          return dir * (a.recent30d - b.recent30d);
        default:
          return 0;
      }
    });
    return rows;
  }, [liqByCurator, liqSort]);

  function toggleLiqSort(key: LiqSortKey) {
    setLiqSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  function toggleFeeSort(key: FeeSortKey) {
    setFeeSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

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
          <h1 className="text-2xl font-bold text-text-primary mb-1">Economics</h1>
          <p className="text-sm text-text-secondary">
            Yield, fees, liquidations, and revenue across Morpho V2 vaults
          </p>
        </div>

        {/* Summary Cards — yield overview (hide on liquidations tab) */}
        {summary && viewMode !== "liquidations" && (
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

        {/* Explainer — hide on liquidations tab */}
        {viewMode !== "liquidations" && (
          <div className="mb-6 p-4 bg-accent-blue/10 border border-accent-blue/20 rounded-xl">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-accent-blue">How it works:</span> Yield is calculated based on each vault&apos;s current TVL and Net APY.
              Net APY is the return depositors receive after all fees (curator + protocol). These are projected yields based on current rates.
            </p>
          </div>
        )}

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
              <button
                onClick={() => setViewMode("fees")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "fees"
                    ? "bg-accent-blue text-white"
                    : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                }`}
              >
                Fees
              </button>
              <button
                onClick={() => setViewMode("liquidations")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === "liquidations"
                    ? "bg-accent-blue text-white"
                    : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                }`}
              >
                Liquidations
              </button>
            </div>
          </div>

          {/* Time Frame Toggle — only for Curators & Vaults tabs */}
          {(viewMode === "curators" || viewMode === "vaults") && (
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
          )}
        </div>

        {/* Total for selected timeframe — hide on Fees tab */}
        {(viewMode === "curators" || viewMode === "vaults") && (
          <div className="mb-4 p-3 bg-background-subtle rounded-lg border border-border inline-block">
            <span className="text-sm text-text-secondary">
              Total {timeFrameLabels[timeFrame]} Yield:{" "}
            </span>
            <span className="text-lg font-bold text-accent-green">
              {formatCurrency(getSummaryYieldForTimeFrame())}
            </span>
          </div>
        )}

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

        {/* Fee Analysis Tab */}
        {viewMode === "fees" && (
          <>
            {/* Fee Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <SummaryCard
                label="Total Annual Fees"
                value={formatCurrency(feeSummary.totalAnnualFees)}
                subtext={`Across ${feeSummary.vaultCount} vaults`}
                highlight
              />
              <SummaryCard
                label="Average Fee Rate"
                value={`${feeSummary.avgFeeRate.toFixed(1)}%`}
                subtext="Performance fee"
              />
              <SummaryCard
                label="Total AUM"
                value={formatCurrency(feeSummary.totalAUM)}
                subtext="Fee-generating TVL"
              />
            </div>

            {/* Fee Table */}
            <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-background-elevated/50">
                      <SortableHeader label="Curator" sortKey="name" currentSort={feeSort} onSort={toggleFeeSort} align="left" />
                      <SortableHeader label="AUM" sortKey="aum" currentSort={feeSort} onSort={toggleFeeSort} />
                      <SortableHeader label="Avg Fee" sortKey="avgFee" currentSort={feeSort} onSort={toggleFeeSort} />
                      <SortableHeader label="Annual Revenue" sortKey="annualRevenue" currentSort={feeSort} onSort={toggleFeeSort} />
                      <SortableHeader label="Vaults" sortKey="vaults" currentSort={feeSort} onSort={toggleFeeSort} />
                      <th className="w-10 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {feeCuratorRows.map((curator) => {
                      const isExpanded = expandedFeeCurator === curator.curatorId;
                      const assetKeys = Object.keys(curator.vaultsByAsset).sort();
                      return (
                        <FeeCuratorRow
                          key={curator.curatorId}
                          curator={curator}
                          annualRevenue={curator.annualRevenue}
                          isExpanded={isExpanded}
                          assetKeys={assetKeys}
                          onToggle={() =>
                            setExpandedFeeCurator(isExpanded ? null : curator.curatorId)
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Liquidations Tab */}
        {viewMode === "liquidations" && (
          <>
            {/* Liquidation Summary Cards */}
            {liqSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <SummaryCard
                  label="Total Liquidation Events"
                  value={liqSummary.totalEvents.toLocaleString()}
                  subtext={`${liqSummary.recent30d} in last 30 days`}
                  highlight
                  valueColor="text-accent-red"
                />
                <SummaryCard
                  label="Total Collateral Seized"
                  value={formatCurrency(liqSummary.totalSeizedUsd)}
                  subtext={`Across ${liqSummary.marketsAffected} markets`}
                />
                <SummaryCard
                  label="Total Bad Debt"
                  value={formatCurrency(liqSummary.totalBadDebtUsd)}
                  subtext="Unrecovered losses"
                  valueColor="text-accent-red"
                />
              </div>
            )}

            {/* Liquidation by Curator Table */}
            <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-background-elevated/50">
                      <SortableHeader label="Curator" sortKey="name" currentSort={liqSort} onSort={toggleLiqSort} align="left" />
                      <SortableHeader label="Events" sortKey="events" currentSort={liqSort} onSort={toggleLiqSort} />
                      <SortableHeader label="Collateral Seized" sortKey="seized" currentSort={liqSort} onSort={toggleLiqSort} />
                      <SortableHeader label="Debt Repaid" sortKey="repaid" currentSort={liqSort} onSort={toggleLiqSort} />
                      <SortableHeader label="Bad Debt" sortKey="badDebt" currentSort={liqSort} onSort={toggleLiqSort} />
                      <SortableHeader label="Last 30d" sortKey="recent30d" currentSort={liqSort} onSort={toggleLiqSort} />
                      <th className="w-10 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedLiqCurators.map((curator) => {
                      const isExpanded = expandedLiqCurator === curator.curatorId;
                      return (
                        <LiquidationCuratorRow
                          key={curator.curatorId}
                          curator={curator}
                          isExpanded={isExpanded}
                          onToggle={() =>
                            setExpandedLiqCurator(isExpanded ? null : curator.curatorId)
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Vault Yields Table */}
        {viewMode === "vaults" && (
          <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <SortableHeader label="Vault" sortKey="name" currentSort={vaultSort} onSort={toggleVaultSort} align="left" />
                    <SortableHeader label="Curator" sortKey="curator" currentSort={vaultSort} onSort={toggleVaultSort} align="left" />
                    <SortableHeader label="TVL" sortKey="tvl" currentSort={vaultSort} onSort={toggleVaultSort} />
                    <SortableHeader label="Gross APY" sortKey="grossApy" currentSort={vaultSort} onSort={toggleVaultSort} />
                    <SortableHeader label="Net APY" sortKey="netApy" currentSort={vaultSort} onSort={toggleVaultSort} />
                    <SortableHeader label="Fee" sortKey="fee" currentSort={vaultSort} onSort={toggleVaultSort} />
                    <SortableHeader label={`${timeFrameLabels[timeFrame]} Yield`} sortKey="yield" currentSort={vaultSort} onSort={toggleVaultSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedVaults.slice(0, 50).map((vault) => (
                    <tr key={vault.vaultId} className="hover:bg-background-elevated/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <Link
                            href={`/vault/${vault.vaultAddress}`}
                            className="font-medium text-text-primary hover:text-accent-blue transition-colors"
                          >
                            {vault.vaultName}
                          </Link>
                          <p className="text-xs text-text-tertiary">{vault.assetSymbol}</p>
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
                        <span className="text-text-secondary tabular-nums">
                          {vault.grossApy.toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="text-accent-green font-medium tabular-nums">
                          {vault.netApy.toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="text-text-muted tabular-nums text-sm">
                          {vault.performanceFee.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right px-4 py-3">
                        <span className="font-bold text-accent-green tabular-nums text-lg">
                          {formatCurrency(getVaultYieldForTimeFrame(vault))}
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
              {" "}&bull; Updated hourly
            </p>
            <div className="flex items-center gap-3">
              <Link href="/changelog" className="text-text-tertiary hover:text-text-primary transition-colors">
                Changelog
              </Link>
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
      {/* Curator summary row */}
      <tr
        className="hover:bg-background-elevated/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
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

      {/* Expanded vault breakdown */}
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
                                  <span className="text-text-secondary">{vault.grossApy.toFixed(2)}%</span>
                                  <span className="text-text-muted mx-1">&rarr;</span>
                                  <span className="text-accent-green font-medium">{vault.netApy.toFixed(2)}%</span>
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

function FeeCuratorRow({
  curator,
  annualRevenue,
  isExpanded,
  assetKeys,
  onToggle,
}: {
  curator: CuratorWithVaults;
  annualRevenue: number;
  isExpanded: boolean;
  assetKeys: string[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-background-elevated/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-text-primary">{curator.curatorName}</p>
            <p className="text-xs text-text-tertiary font-mono">
              {curator.curatorAddress.slice(0, 6)}...{curator.curatorAddress.slice(-4)}
            </p>
          </div>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-medium text-text-primary tabular-nums">
            {formatCurrency(curator.totalAUM)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="text-text-secondary tabular-nums">
            {curator.avgFee > 0 ? `${curator.avgFee.toFixed(1)}%` : "None"}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-bold text-accent-blue tabular-nums text-lg">
            {formatCurrency(annualRevenue)}
          </span>
          <p className="text-[10px] text-text-muted">/year</p>
        </td>
        <td className="text-right px-4 py-3">
          <span className="text-text-secondary">{curator.vaultCount}</span>
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
          <td colSpan={6} className="p-0">
            <div className="bg-background-elevated/40 border-t border-border px-6 py-4">
              <div className="space-y-4">
                {assetKeys.map((asset) => {
                  const vaults = curator.vaultsByAsset[asset];
                  const assetRevenue = vaults.reduce(
                    (sum, v) => sum + (v.tvl * v.performanceFee) / 100,
                    0
                  );
                  return (
                    <div key={asset}>
                      <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                        {asset} Vaults:{" "}
                        <span className="text-accent-blue">
                          {formatCurrency(assetRevenue)}/year
                        </span>
                      </p>
                      <div className="space-y-1">
                        {vaults.map((vault) => {
                          const vaultRevenue = (vault.tvl * vault.performanceFee) / 100;
                          return (
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
                              </div>
                              <div className="flex items-center gap-6 flex-shrink-0">
                                <span className="text-sm text-accent-blue font-semibold tabular-nums">
                                  {formatCurrency(vaultRevenue)}
                                </span>
                                <span className="text-xs text-text-muted tabular-nums w-28 text-right">
                                  {vault.performanceFee.toFixed(1)}% on {formatCurrency(vault.tvl)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
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

function LiquidationCuratorRow({
  curator,
  isExpanded,
  onToggle,
}: {
  curator: CuratorLiquidationData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-background-elevated/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-text-primary">{curator.curatorName}</p>
            <p className="text-xs text-text-tertiary font-mono">
              {curator.curatorAddress.slice(0, 6)}...{curator.curatorAddress.slice(-4)}
            </p>
          </div>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-medium text-text-primary tabular-nums">
            {curator.totalEvents.toLocaleString()}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-bold text-accent-red tabular-nums text-lg">
            {formatCurrency(curator.totalSeizedUsd)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="text-text-secondary tabular-nums">
            {formatCurrency(curator.totalRepaidUsd)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className={`font-medium tabular-nums ${curator.totalBadDebtUsd > 0 ? "text-accent-red" : "text-text-secondary"}`}>
            {formatCurrency(curator.totalBadDebtUsd)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className={`font-medium tabular-nums ${curator.recent30d > 0 ? "text-accent-red" : "text-text-secondary"}`}>
            {curator.recent30d}
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

      {isExpanded && curator.events.length > 0 && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-background-elevated/40 border-t border-border px-6 py-4">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Recent Liquidation Events
              </p>
              <div className="space-y-1">
                {curator.events.map((evt) => (
                  <div
                    key={`${evt.txHash}-${evt.borrower}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-hover/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">
                        {new Date(evt.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span className="text-text-muted ml-2 text-xs">
                          {new Date(evt.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </p>
                      <p className="text-xs text-text-tertiary font-mono">
                        Market: {evt.marketUniqueKey.slice(0, 8)}...{evt.marketUniqueKey.slice(-6)}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-accent-red tabular-nums">
                          {formatCurrency(evt.seizedAssetsUsd)}
                        </p>
                        <p className="text-[10px] text-text-muted">seized</p>
                      </div>
                      <div className="text-right w-24">
                        <p className="text-sm text-text-secondary tabular-nums">
                          {formatCurrency(evt.repaidAssetsUsd)}
                        </p>
                        <p className="text-[10px] text-text-muted">repaid</p>
                      </div>
                      {evt.badDebtAssetsUsd > 0 && (
                        <div className="text-right w-24">
                          <p className="text-sm font-medium text-accent-red tabular-nums">
                            {formatCurrency(evt.badDebtAssetsUsd)}
                          </p>
                          <p className="text-[10px] text-text-muted">bad debt</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
              Economics
            </Link>
            <Link
              href="/alerts"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Alerts
            </Link>
            <Link
              href="/changelog"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Changelog
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

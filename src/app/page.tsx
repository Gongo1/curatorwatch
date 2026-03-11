"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CuratorGrid } from "@/components/grid/CuratorGrid";
import { TabbedMetricChart } from "@/components/TabbedMetricChart";
import { StablecoinBreakdown } from "@/components/StablecoinBreakdown";
import { TopCurators } from "@/components/TopCurators";
import { TopVaults } from "@/components/TopVaults";
import { PageHeader } from "@/components/layout/PageHeader";
import { VaultFinder } from "@/components/VaultFinder";
import { formatTimeAgo, formatCurrency, formatPercentage } from "@/lib/utils/format";
import { InfoTooltip } from "@/components/Tooltip";
import type { CuratorDashboardResponse, CuratorDashboardItem, CuratorDashboardStats, PaginationInfo } from "@/lib/types/api";
import { curatorSlug } from "@/lib/curator-aliases";

interface ChangeSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface FeesStats {
  annualized: {
    curatorFees: number;
    morphoFees: number;
    totalFees: number;
  };
}

interface YieldStats {
  yield30d: number;
  dailyAvg: number;
}

interface ProtocolCoverageItem {
  dataSource: string;
  vaultCount: number;
  totalAUM: number;
  curatorCount: number;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 20;

export default function Home() {
  const router = useRouter();
  const [curators, setCurators] = useState<CuratorDashboardItem[]>([]);
  const [stats, setStats] = useState<CuratorDashboardStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("");
  const [changeSummary, setChangeSummary] = useState<ChangeSummary | null>(null);
  const [feesStats, setFeesStats] = useState<FeesStats | null>(null);
  const [yieldStats, setYieldStats] = useState<YieldStats | null>(null);
  const [aumChange30d, setAumChange30d] = useState<number | null>(null);
  const [protocolCoverage, setProtocolCoverage] = useState<ProtocolCoverageItem[]>([]);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Autocomplete dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (page = 1, search = "") => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        sortBy: "aum",
        sortOrder: "desc",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const [curatorsResponse, changesResponse, feesResponse, yieldResponse, aumGrowthResponse, coverageResponse] = await Promise.all([
        fetch(`/api/curators?${params.toString()}`),
        fetch("/api/changes?hours=24&limit=0"),
        fetch("/api/stats/fees-breakdown?dataSource=morpho"),
        fetch("/api/stats/yield-growth"),
        fetch("/api/stats/aum-growth"),
        fetch("/api/stats/protocol-coverage"),
      ]);

      const curatorsData: CuratorDashboardResponse = await curatorsResponse.json();
      const changesData = await changesResponse.json();
      const feesData = await feesResponse.json();
      const yieldData = await yieldResponse.json();
      const aumGrowthData = await aumGrowthResponse.json();
      const coverageData = await coverageResponse.json();

      if (!curatorsData.success) {
        throw new Error(curatorsData.error || "Failed to fetch curators");
      }

      setCurators(curatorsData.data.curators);
      setStats(curatorsData.data.stats);
      setPagination(curatorsData.data.pagination || null);
      setLastUpdated(new Date());
      setError(null);
      setIsInitialLoad(false);

      if (changesData.success) {
        setChangeSummary(changesData.data.summary);
      }

      if (feesData.success) {
        setFeesStats(feesData.data.summary);
      }

      if (yieldData.success && yieldData.data.length > 0) {
        const latestYield = yieldData.data[yieldData.data.length - 1].yield || 0;
        const totalDays = yieldData.data.length;
        const dailyAvg = totalDays > 0 ? latestYield / totalDays : 0;
        setYieldStats({
          yield30d: latestYield,
          dailyAvg,
        });
      }

      // Compute 30-day AUM change from growth data
      if (aumGrowthData.success && aumGrowthData.data.length >= 2) {
        const points = aumGrowthData.data;
        const latest = points[points.length - 1].aum;
        const oldest = points[0].aum;
        if (oldest > 0) {
          setAumChange30d(((latest - oldest) / oldest) * 100);
        }
      }

      // Protocol coverage
      if (coverageData.success && coverageData.data) {
        setProtocolCoverage(coverageData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [isInitialLoad]);

  // Initial fetch
  useEffect(() => {
    fetchData(1, searchQuery);
  }, []);

  // Auto-refresh every 5 minutes (only for first page without search)
  useEffect(() => {
    if (currentPage === 1 && !searchQuery) {
      const interval = setInterval(() => fetchData(1, ""), REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [currentPage, searchQuery, fetchData]);

  // Update "time ago" display every second
  useEffect(() => {
    const updateTimeAgo = () => {
      if (lastUpdated) {
        setTimeAgo(formatTimeAgo(lastUpdated));
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(1, searchQuery).then(() => {
        setShowDropdown(searchQuery.trim().length > 0);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchData]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(newPage, searchQuery);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  return (
    <>
      <PageHeader
        title="CuratorWatch"
        description="Real-time vault curator intelligence"
        actions={
          changeSummary && changeSummary.total > 0 ? (
            <Link
              href="/alerts"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-90 ${
                changeSummary.critical > 0
                  ? "bg-accent-red/15 text-accent-red"
                  : changeSummary.warning > 0
                    ? "bg-accent-yellow/15 text-accent-yellow"
                    : "bg-accent-blue/10 text-accent-blue"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  changeSummary.critical > 0 ? "bg-accent-red" : changeSummary.warning > 0 ? "bg-accent-yellow" : "bg-accent-blue"
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  changeSummary.critical > 0 ? "bg-accent-red" : changeSummary.warning > 0 ? "bg-accent-yellow" : "bg-accent-blue"
                }`} />
              </span>
              {changeSummary.total} alert{changeSummary.total !== 1 ? "s" : ""}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : undefined
        }
      />

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-5">
            <StatCard
              label="Curators"
              value={stats.totalCurators.toString()}
              tooltip="Total number of vault curators actively managing vaults across all protocols"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="Total AUM"
              value={formatCurrency(stats.totalAUM)}
              tooltip="Total Assets Under Management across all tracked vaults"
              highlight
              change={aumChange30d}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Vaults"
              value={stats.totalVaults.toString()}
              tooltip="Total number of tracked vaults across all protocols"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              }
            />
            <StatCard
              label="Yield Paid (30d)"
              value={yieldStats ? formatCurrency(yieldStats.yield30d) : "-"}
              tooltip="Total yield generated for depositors over the past 30 days"
              highlight
              valueClass="text-emerald-500"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Curator Fees (Ann.)"
              value={feesStats ? formatCurrency(feesStats.annualized.curatorFees) : "-"}
              tooltip="Estimated annualized fees earned by curators (management + performance fees)"
              valueClass="text-accent-blue"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <StatCard
              label="Protocol Fees (Ann.)"
              value={feesStats ? formatCurrency(feesStats.annualized.morphoFees) : "-"}
              tooltip="Estimated annualized protocol fees (e.g. Morpho's 15% of interest). Only calculated for protocols with known fee structures."
              valueClass="text-accent-purple"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              }
            />
          </div>
        )}

        {/* Loading Stats Skeleton */}
        {!stats && loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="bg-background-subtle border border-border rounded-xl p-4">
                <div className="h-4 w-16 bg-background-elevated rounded animate-pulse mb-2" />
                <div className="h-7 w-24 bg-background-elevated rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Protocol Ecosystem */}
        {protocolCoverage.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Protocol Ecosystem</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {protocolCoverage
                .sort((a, b) => b.totalAUM - a.totalAUM)
                .map((item) => {
                  const isTurtle = item.dataSource === "turtle";
                  return (
                    <div
                      key={item.dataSource}
                      className={`rounded-xl border-l-4 border border-border bg-background-subtle p-5 ${
                        isTurtle ? "border-l-green-500" : "border-l-blue-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                              isTurtle
                                ? "bg-green-500/10 text-green-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            {isTurtle ? "Turtle" : "Morpho"}
                          </span>
                          <p className="text-xs text-text-muted mt-1.5">
                            {isTurtle
                              ? "DeFi liquidity coordination platform"
                              : "The universal lending network"}
                          </p>
                        </div>
                        <Link
                          href={isTurtle ? "/vaults/turtle" : "/vaults/morpho"}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isTurtle
                              ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                              : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                          }`}
                        >
                          Explore
                        </Link>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-text-secondary">Vaults</p>
                          <p className="text-lg font-bold text-text-primary tabular-nums">{item.vaultCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">AUM</p>
                          <p className="text-lg font-bold text-text-primary tabular-nums">{formatCurrency(item.totalAUM)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">Curators</p>
                          <p className="text-lg font-bold text-text-primary tabular-nums">{item.curatorCount}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Tabbed Chart - Below Stats */}
        <div className="mb-5">
          <TabbedMetricChart />
        </div>

        {/* Cards Row - Stablecoin + Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div className="lg:col-span-1">
            <StablecoinBreakdown />
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TopCurators />
            <TopVaults />
          </div>
        </div>

        {/* Vault Finder */}
        <VaultFinder />


        {/* All Curators Section */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">All Curators</h2>
            <p className="text-xs text-text-tertiary">Browse and search vault curators</p>
          </div>
          {!loading && (
            <button
              onClick={() => fetchData(currentPage, searchQuery)}
              className="text-xs text-accent-blue hover:text-accent-blue-hover font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-3">
          {/* Search Input with Autocomplete */}
          <div className="relative w-full sm:w-72" ref={dropdownRef}>
            <input
              type="text"
              placeholder="Search curators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery.trim() && curators.length > 0) setShowDropdown(true); }}
              onKeyDown={(e) => { if (e.key === "Escape") setShowDropdown(false); }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background-subtle border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setShowDropdown(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Autocomplete Dropdown */}
            {showDropdown && searchQuery.trim() && (
              <div className="absolute z-50 top-full mt-1 w-full sm:w-96 bg-background-elevated border border-border rounded-lg shadow-xl overflow-hidden">
                {curators.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-text-secondary">
                    No curators found
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {curators.slice(0, 8).map((curator) => (
                      <li key={curator.curatorId}>
                        <button
                          className="w-full text-left px-4 py-2.5 hover:bg-background-subtle transition-colors flex items-center justify-between gap-3"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setShowDropdown(false);
                            setSearchQuery("");
                            router.push(`/curator/${curatorSlug(curator.name, curator.curatorAddress)}`);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary truncate">
                              {curator.name || "Unknown Curator"}
                            </div>
                            <div className="text-xs text-text-muted truncate">
                              {curator.vaultCount} vault{curator.vaultCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-xs font-medium text-text-secondary">
                              {formatCurrency(curator.totalAUM)}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {curator.vaultCount} vault{curator.vaultCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Results Info */}
        {searchQuery && !loading && (
          <div className="mb-3 text-xs text-text-secondary">
            {pagination?.total === 0 ? (
              <span>No curators found for "{searchQuery}"</span>
            ) : (
              <span>
                Found {pagination?.total} curator{pagination?.total !== 1 ? "s" : ""} matching "{searchQuery}"
              </span>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-3 bg-accent-red-muted/30 border border-accent-red/30 rounded-lg">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 text-accent-red flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-text-secondary">{error}</p>
              </div>
              <button onClick={() => fetchData(currentPage, searchQuery)} className="text-xs text-accent-red hover:text-accent-red font-medium">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && isInitialLoad && (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-background-elevated rounded" />
            ))}
          </div>
        )}

        {/* Curator Grid */}
        {!(loading && isInitialLoad) && !error && curators.length > 0 && (
          <CuratorGrid curators={curators} />
        )}

        {/* Empty State */}
        {!loading && !error && curators.length === 0 && !searchQuery && (
          <div className="text-center py-12 bg-background-subtle rounded-lg border border-border">
            <svg className="mx-auto h-10 w-10 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-text-primary">No curators found</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Run <code className="bg-background-elevated px-1.5 py-0.5 rounded font-mono text-accent-blue">npm run collect</code> to populate data.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <div className="text-xs text-text-secondary">
              {(pagination.page - 1) * pagination.pageSize + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-0.5">
                {getPageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) => (
                  pageNum === -1 ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-text-muted text-xs">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`min-w-[28px] h-7 px-1.5 text-xs rounded ${
                        pageNum === pagination.page
                          ? "bg-accent-blue text-white font-medium"
                          : "text-text-secondary hover:bg-background-elevated"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                ))}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
    </>
  );
}

// Helper function to generate page numbers with ellipsis
function getPageNumbers(current: number, total: number): number[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: number[] = [];
  pages.push(1);

  if (current > 3) {
    pages.push(-1);
  }

  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(-1);
  }

  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

function StatCard({
  label,
  value,
  highlight,
  valueClass,
  icon,
  tooltip,
  change,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
  icon?: React.ReactNode;
  tooltip?: string;
  change?: number | null;
}) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-3.5 ${
        highlight
          ? "border-accent-blue/30 bg-accent-blue/5"
          : "border-border bg-background-subtle"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <p className="text-xs text-text-secondary">{label}</p>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        {icon && (
          <span className={`hidden sm:block ${highlight ? "text-accent-blue" : "text-text-muted"}`}>
            {icon}
          </span>
        )}
      </div>
      <p
        className={`text-lg sm:text-xl font-bold tabular-nums ${
          valueClass || (highlight ? "text-accent-blue" : "text-text-primary")
        }`}
      >
        {value}
      </p>
      {change != null && (
        <p
          className={`text-[11px] font-medium tabular-nums mt-0.5 ${
            change >= 0 ? "text-emerald-500" : "text-accent-red"
          }`}
        >
          {change >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(change).toFixed(1)}% 30d
        </p>
      )}
    </div>
  );
}

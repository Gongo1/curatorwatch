"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CuratorTable, CuratorTableSkeleton } from "@/components/CuratorTable";
import { TabbedMetricChart } from "@/components/TabbedMetricChart";
import { StablecoinBreakdown } from "@/components/StablecoinBreakdown";
import { TopCurators } from "@/components/TopCurators";
import { TopVaults } from "@/components/TopVaults";
import { AlertSidebar } from "@/components/AlertSidebar";
import { formatTimeAgo, formatCurrency, formatPercentage } from "@/lib/utils/format";
import { InfoTooltip } from "@/components/Tooltip";
import type { CuratorDashboardResponse, CuratorDashboardItem, CuratorDashboardStats, PaginationInfo } from "@/lib/types/api";

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

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"aum" | "vaults" | "name">("aum");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Autocomplete dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (page = 1, search = "", sort = sortBy, order = sortOrder) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        sortBy: sort,
        sortOrder: order,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const [curatorsResponse, changesResponse, feesResponse, yieldResponse] = await Promise.all([
        fetch(`/api/curators?${params.toString()}`),
        fetch("/api/changes?hours=24&limit=0"),
        fetch("/api/stats/fees"),
        fetch("/api/stats/yield-growth"),
      ]);

      const curatorsData: CuratorDashboardResponse = await curatorsResponse.json();
      const changesData = await changesResponse.json();
      const feesData = await feesResponse.json();
      const yieldData = await yieldResponse.json();

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
        setFeesStats(feesData.data);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, isInitialLoad]);

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

  // Handle sort change
  const handleSortChange = (newSortBy: "aum" | "vaults" | "name") => {
    const newOrder = newSortBy === sortBy && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    setCurrentPage(1);
    fetchData(1, searchQuery, newSortBy, newOrder);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Alert Sidebar */}
      <AlertSidebar />

      {/* Header */}
      <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="CuratorWatch"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <div className="hidden xs:block">
                <h1 className="text-lg font-bold text-text-primary tracking-tight leading-tight">
                  CuratorWatch
                </h1>
                <p className="text-[10px] text-text-tertiary leading-tight">
                  Morpho V2 Vault Analytics
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Desktop Navigation */}
              <nav className="hidden sm:flex items-center gap-5">
                <Link href="/" className="text-sm font-medium text-accent-blue">
                  Dashboard
                </Link>
                <Link
                  href="/vaults"
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Vaults
                </Link>
                <Link
                  href="/yields"
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
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
              {/* Mobile Navigation */}
              <nav className="flex sm:hidden items-center gap-2">
                <Link href="/" className="px-2 py-1.5 text-xs font-medium text-accent-blue bg-accent-blue/10 rounded">
                  Home
                </Link>
                <Link
                  href="/vaults"
                  className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Vaults
                </Link>
                <Link
                  href="/yields"
                  className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Economics
                </Link>
                <Link
                  href="/alerts"
                  className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Alerts
                </Link>
                <Link
                  href="/changelog"
                  className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Log
                </Link>
              </nav>
              {lastUpdated && (
                <span className="hidden md:flex items-center gap-1.5 text-xs text-text-tertiary">
                  <span className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                  {timeAgo}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-5 xl:pr-52">
        {/* Hero/Disclaimer Banner */}
        <div className="mb-5 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-accent-blue/10 via-accent-purple/5 to-transparent border border-accent-blue/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-accent-blue/20 text-accent-blue rounded">
                  Beta
                </span>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-background-elevated text-text-secondary rounded">
                  Ethereum Mainnet
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-1">
                Morpho V2 Vault Analytics
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
                Real-time curator intelligence, vault performance tracking, and risk monitoring for the Morpho V2 ecosystem.
              </p>
              <p className="text-[11px] text-text-tertiary mt-1.5 flex items-center gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-accent-purple"></span>
                <span>Coming soon: Smart contract & redemption risk layers, protocol composability maps, and RWA yield impact analysis.</span>
              </p>
            </div>
            <a
              href="https://app.morpho.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent-blue hover:text-white bg-accent-blue/10 hover:bg-accent-blue border border-accent-blue/30 hover:border-accent-blue rounded-lg transition-all"
            >
              Open Morpho App
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Alerts Bar - Top */}
        {changeSummary && changeSummary.total > 0 && (
          <Link
            href="/alerts"
            className={`mb-5 flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.005] ${
              changeSummary.critical > 0
                ? "bg-accent-red-muted/30 border-accent-red/30"
                : changeSummary.warning > 0
                  ? "bg-accent-yellow-muted/30 border-accent-yellow/30"
                  : "bg-accent-blue/10 border-accent-blue/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {changeSummary.critical > 0 ? (
                <div className="w-7 h-7 rounded-full bg-accent-red/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent-blue/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="text-sm">
                <span className="font-medium text-text-primary">
                  {changeSummary.total} change{changeSummary.total !== 1 ? "s" : ""}
                </span>
                <span className="text-text-secondary ml-1.5">in 24h</span>
                {changeSummary.critical > 0 && (
                  <span className="text-accent-red font-medium ml-2">
                    {changeSummary.critical} critical
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1">
              View
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        )}

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-5">
            <StatCard
              label="Curators"
              value={stats.totalCurators.toString()}
              tooltip="Total number of vault curators actively managing Morpho V2 vaults"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="Total AUM"
              value={formatCurrency(stats.totalAUM)}
              tooltip="Total Assets Under Management across all tracked Morpho V2 vaults"
              highlight
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Vaults"
              value={stats.totalVaults.toString()}
              tooltip="Total number of Morpho V2 vaults with at least $1,000 in deposits"
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
              label="Morpho Fees (Ann.)"
              value={feesStats ? formatCurrency(feesStats.annualized.morphoFees) : "-"}
              tooltip="Estimated annualized protocol fees earned by Morpho (15% of interest)"
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

        {/* Search and Filter Bar */}
        <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                            router.push(`/curator/${curator.curatorAddress}`);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary truncate">
                              {curator.name || "Unknown Curator"}
                            </div>
                            <div className="text-xs text-text-muted font-mono truncate">
                              {curator.curatorAddress.slice(0, 6)}...{curator.curatorAddress.slice(-4)}
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

          {/* Sort Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            <span className="text-xs text-text-tertiary flex-shrink-0">Sort:</span>
            <div className="flex rounded-lg border border-border overflow-hidden flex-shrink-0">
              {[
                { key: "aum", label: "AUM" },
                { key: "vaults", label: "Vaults" },
                { key: "name", label: "Name" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => handleSortChange(option.key as "aum" | "vaults" | "name")}
                  className={`px-2 sm:px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    sortBy === option.key
                      ? "bg-accent-blue text-white"
                      : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                  }`}
                >
                  {option.label}
                  {sortBy === option.key && (
                    <span className="ml-0.5">{sortOrder === "desc" ? "↓" : "↑"}</span>
                  )}
                </button>
              ))}
            </div>
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
        {loading && isInitialLoad && <CuratorTableSkeleton />}

        {/* Curator Table */}
        {!(loading && isInitialLoad) && !error && curators.length > 0 && (
          <CuratorTable curators={curators} />
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background-subtle mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <p>
              Data from{" "}
              <a
                href="https://api.morpho.org/graphql"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:text-accent-blue-hover"
              >
                Morpho API
              </a>
              {" "}• Updated hourly
            </p>
            <div className="flex items-center gap-3">
              <Link href="/changelog" className="text-text-tertiary hover:text-text-primary transition-colors">
                Changelog
              </Link>
              <a
                href="https://x.com/curator_watch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-tertiary hover:text-text-primary transition-colors"
                title="Follow us on X"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
  icon?: React.ReactNode;
  tooltip?: string;
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
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CuratorTable, CuratorTableSkeleton } from "@/components/CuratorTable";
import { formatTimeAgo, formatCurrency, formatPercentage } from "@/lib/utils/format";
import type { CuratorDashboardResponse, CuratorDashboardItem, CuratorDashboardStats, PaginationInfo } from "@/lib/types/api";

interface ChangeSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 20;

export default function Home() {
  const [curators, setCurators] = useState<CuratorDashboardItem[]>([]);
  const [stats, setStats] = useState<CuratorDashboardStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("");
  const [changeSummary, setChangeSummary] = useState<ChangeSummary | null>(null);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"aum" | "vaults" | "apy" | "name">("aum");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async (page = 1, search = "", sort = sortBy, order = sortOrder) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        sortBy: sort,
        sortOrder: order,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const [curatorsResponse, changesResponse] = await Promise.all([
        fetch(`/api/curators?${params.toString()}`),
        fetch("/api/changes?hours=24&limit=0"),
      ]);

      const curatorsData: CuratorDashboardResponse = await curatorsResponse.json();
      const changesData = await changesResponse.json();

      if (!curatorsData.success) {
        throw new Error(curatorsData.error || "Failed to fetch curators");
      }

      setCurators(curatorsData.data.curators);
      setStats(curatorsData.data.stats);
      setPagination(curatorsData.data.pagination || null);
      setLastUpdated(new Date());
      setError(null);

      if (changesData.success) {
        setChangeSummary(changesData.data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

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
      fetchData(1, searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(newPage, searchQuery);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle sort change
  const handleSortChange = (newSortBy: "aum" | "vaults" | "apy" | "name") => {
    const newOrder = newSortBy === sortBy && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    setCurrentPage(1);
    fetchData(1, searchQuery, newSortBy, newOrder);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-blue flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary tracking-tight">
                  CuratorWatch
                </h1>
                <p className="text-xs text-text-tertiary">
                  Track DeFi vault curators
                </p>
              </div>
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-accent-blue"
              >
                Curators
              </Link>
              <Link
                href="/vaults"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                All Vaults
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

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Morpho V2 Disclaimer */}
        <div className="mb-6 p-4 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-text-secondary">
              Currently tracking <span className="font-semibold text-accent-blue">Morpho V2 vaults only</span> on Ethereum mainnet. V1 and other protocols coming soon.
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        {stats && !loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Curators Tracked"
              value={stats.totalCurators.toString()}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="Total AUM"
              value={formatCurrency(stats.totalAUM)}
              highlight
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Total Vaults"
              value={stats.totalVaults.toString()}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              }
            />
            <StatCard
              label="Avg APY"
              value={formatPercentage(stats.avgApy)}
              valueClass="text-accent-green"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
          </div>
        )}

        {/* Alerts Bar */}
        {changeSummary && changeSummary.total > 0 && (
          <Link
            href="/alerts"
            className={`mb-6 flex items-center justify-between p-4 rounded-lg border transition-all hover:scale-[1.01] ${
              changeSummary.critical > 0
                ? "bg-accent-red-muted/30 border-accent-red/30"
                : changeSummary.warning > 0
                  ? "bg-accent-yellow-muted/30 border-accent-yellow/30"
                  : "bg-accent-blue/10 border-accent-blue/30"
            }`}
          >
            <div className="flex items-center gap-3">
              {changeSummary.critical > 0 ? (
                <div className="w-8 h-8 rounded-full bg-accent-red/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="text-sm">
                <span className="font-medium text-text-primary">
                  {changeSummary.total} change{changeSummary.total !== 1 ? "s" : ""} detected
                </span>
                <span className="text-text-secondary ml-2">in the last 24h</span>
                {(changeSummary.critical > 0 || changeSummary.warning > 0) && (
                  <span className="text-text-tertiary ml-3">
                    {changeSummary.critical > 0 && (
                      <span className="text-accent-red font-medium">
                        {changeSummary.critical} critical
                      </span>
                    )}
                    {changeSummary.critical > 0 && changeSummary.warning > 0 && " · "}
                    {changeSummary.warning > 0 && (
                      <span className="text-accent-yellow font-medium">
                        {changeSummary.warning} warning{changeSummary.warning !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <span className="text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-1">
              View all
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        )}

        {/* Search and Filter Bar */}
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search curators by name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-background-subtle border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue"
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
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort and Status */}
          <div className="flex items-center gap-4">
            {/* Sort Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">Sort:</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {[
                  { key: "aum", label: "AUM" },
                  { key: "vaults", label: "Vaults" },
                  { key: "apy", label: "APY" },
                  { key: "name", label: "Name" },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleSortChange(option.key as "aum" | "vaults" | "apy" | "name")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortBy === option.key
                        ? "bg-accent-blue text-white"
                        : "bg-background-subtle text-text-secondary hover:bg-background-elevated"
                    }`}
                  >
                    {option.label}
                    {sortBy === option.key && (
                      <span className="ml-1">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Status and Refresh */}
            <div className="text-sm text-text-tertiary hidden sm:flex items-center gap-4">
              {lastUpdated && (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-accent-green rounded-full" />
                  Updated {timeAgo}
                </span>
              )}
              {!loading && (
                <button
                  onClick={() => fetchData(currentPage, searchQuery)}
                  className="text-sm text-accent-blue hover:text-accent-blue-hover font-medium transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Results Info */}
        {searchQuery && !loading && (
          <div className="mb-4 text-sm text-text-secondary">
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
          <div className="mb-6 p-4 bg-accent-red-muted/30 border border-accent-red/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-accent-red" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-accent-red">Error loading data</h3>
                <p className="text-sm text-text-secondary mt-1">{error}</p>
              </div>
              <button onClick={() => fetchData(currentPage, searchQuery)} className="text-sm text-accent-red hover:text-accent-red font-medium">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && <CuratorTableSkeleton />}

        {/* Curator Table */}
        {!loading && !error && curators.length > 0 && (
          <CuratorTable curators={curators} />
        )}

        {/* Empty State */}
        {!loading && !error && curators.length === 0 && !searchQuery && (
          <div className="text-center py-16 bg-background-subtle rounded-lg border border-border">
            <svg className="mx-auto h-12 w-12 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-text-primary">No curators found</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Run the data collection script to populate vault data.
            </p>
            <div className="mt-4">
              <code className="text-sm bg-background-elevated px-3 py-1.5 rounded border border-border font-mono text-accent-blue">
                npm run collect
              </code>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <div className="text-sm text-text-secondary">
              Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
              {pagination.total} curators
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
                className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {getPageNumbers(pagination.page, pagination.totalPages).map((pageNum, idx) => (
                  pageNum === -1 ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-text-muted">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`min-w-[32px] h-8 px-2 text-sm rounded ${
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
                className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background-subtle mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-tertiary">
                Data from{" "}
                <a
                  href="https://api.morpho.org/graphql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:text-accent-blue-hover transition-colors"
                >
                  Morpho API
                </a>
                {" "}• Updated hourly
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-green" />
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
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: number[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push(-1); // ellipsis
  }

  // Show pages around current
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push(-1); // ellipsis
  }

  // Always show last page
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-accent-blue/30 bg-accent-blue/5"
          : "border-border bg-background-subtle"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{label}</p>
        {icon && (
          <span className={highlight ? "text-accent-blue" : "text-text-muted"}>
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          valueClass || (highlight ? "text-accent-blue" : "text-text-primary")
        }`}
      >
        {value}
      </p>
    </div>
  );
}

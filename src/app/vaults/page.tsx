"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { VaultTable } from "@/components/VaultTable";
import { VaultTableSkeleton } from "@/components/VaultTableSkeleton";
import { formatTimeAgo, formatCurrency } from "@/lib/utils/format";
import type { VaultData, VaultsApiResponse } from "@/lib/types/api";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function VaultsPage() {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("");

  const fetchVaults = useCallback(async () => {
    try {
      const response = await fetch("/api/vaults");
      const data: VaultsApiResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch vaults");
      }

      setVaults(data.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchVaults, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchVaults]);

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

  // Calculate total TVL
  const totalTvl = vaults.reduce(
    (sum, vault) => sum + (vault.latestSnapshot?.totalAssetsUsd ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="CuratorWatch" width={32} height={32} className="rounded-lg" />
              <div>
                <h1 className="text-xl font-semibold text-text-primary tracking-tight">
                  CuratorWatch
                </h1>
                <p className="text-sm text-text-tertiary">
                  All Vaults
                </p>
              </div>
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Curators
              </Link>
              <Link
                href="/vaults"
                className="text-sm font-medium text-accent-blue"
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
        {/* Stats Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {!loading && !error && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-2 h-2 bg-accent-green rounded-full animate-pulse" />
                  <span className="text-text-secondary">
                    <span className="text-text-primary font-medium">{vaults.length}</span> vaults
                  </span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="text-sm">
                  <span className="text-text-secondary">Total Deposits: </span>
                  <span className="font-semibold text-text-primary tabular-nums">
                    {formatCurrency(totalTvl)}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-text-tertiary">
              {lastUpdated && (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-accent-green rounded-full" />
                  Updated {timeAgo}
                </span>
              )}
            </div>
            {!loading && (
              <button
                onClick={fetchVaults}
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
              <button onClick={fetchVaults} className="text-sm text-accent-red hover:text-accent-red font-medium">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && <VaultTableSkeleton />}

        {/* Vault Table */}
        {!loading && !error && vaults.length > 0 && (
          <VaultTable vaults={vaults} />
        )}

        {/* Empty State */}
        {!loading && !error && vaults.length === 0 && (
          <div className="text-center py-16 bg-background-subtle rounded-lg border border-border">
            <svg className="mx-auto h-12 w-12 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-text-primary">No vaults found</h3>
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background-subtle mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-text-tertiary">
              Data sourced from{" "}
              <a
                href="https://api.morpho.org/graphql"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:text-accent-blue-hover transition-colors"
              >
                Morpho API
              </a>
            </p>
            <div className="flex items-center gap-4 text-sm text-text-tertiary">
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
                <span className="w-2 h-2 rounded-full bg-accent-green" />
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

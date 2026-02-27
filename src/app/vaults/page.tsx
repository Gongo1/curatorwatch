"use client";

import { useState, useEffect, useCallback } from "react";
import { VaultGrid } from "@/components/grid/VaultGrid";
import { PageHeader } from "@/components/layout/PageHeader";
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
    <>
      <PageHeader
        title="All Vaults"
        description="Browse all tracked vaults"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Vaults" }]}
      />

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
      {loading && (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-background-elevated rounded" />
          ))}
        </div>
      )}

      {/* Vault Grid */}
      {!loading && !error && vaults.length > 0 && (
        <VaultGrid vaults={vaults} />
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
    </>
  );
}

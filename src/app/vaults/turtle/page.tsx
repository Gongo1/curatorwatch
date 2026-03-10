"use client";

import { useState, useEffect, useCallback } from "react";
import { TurtleVaultGrid } from "@/components/grid/TurtleVaultGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatTimeAgo, formatCurrency } from "@/lib/utils/format";
import type { VaultData, VaultsApiResponse } from "@/lib/types/api";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function TurtleVaultsPage() {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("");

  const fetchVaults = useCallback(async () => {
    try {
      const response = await fetch("/api/vaults?dataSource=turtle");
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

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  useEffect(() => {
    const interval = setInterval(fetchVaults, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchVaults]);

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

  const totalTvl = vaults.reduce(
    (sum, vault) => sum + (vault.latestSnapshot?.totalAssetsUsd ?? 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Turtle Vaults"
        description="Cross-protocol managed vaults tracked via the Turtle API"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Vaults", href: "/vaults" },
          { label: "Turtle" },
        ]}
      />

      {/* Disclaimer */}
      <div className="mb-6 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
        <p className="text-sm text-text-secondary">
          <span className="font-medium text-cyan-500">APR from Turtle API.</span>{" "}
          Turtle vaults display Est. Total APR (simple interest) directly from the Turtle API.
          No transaction or allocation data available for these vaults.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {!loading && !error && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
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
                <span className="inline-block w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                Updated {timeAgo}
              </span>
            )}
          </div>
          {!loading && (
            <button
              onClick={fetchVaults}
              className="text-sm text-cyan-500 hover:text-cyan-400 font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-accent-red-muted/30 border border-accent-red/30 rounded-lg">
          <div className="flex items-center gap-3">
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

      {loading && (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-background-elevated rounded" />
          ))}
        </div>
      )}

      {!loading && !error && vaults.length > 0 && <TurtleVaultGrid vaults={vaults} />}

      {!loading && !error && vaults.length === 0 && (
        <div className="text-center py-16 bg-background-subtle rounded-lg border border-border">
          <h3 className="mt-4 text-sm font-medium text-text-primary">No Turtle vaults found</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Turtle data is collected every 4 hours automatically.
          </p>
        </div>
      )}
    </>
  );
}

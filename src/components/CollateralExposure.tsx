"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatAddress } from "@/lib/utils/format";

interface AllocationItem {
  type: string;
  address: string;
  assetsUsd: number;
  allocationPct: number;
  collateralNote: string;
}

interface AllocationResponse {
  success: boolean;
  data: {
    allocations: AllocationItem[];
    totalAllocatedUsd: number;
    idleUsd: number;
    idlePct: number;
    note: string;
  };
  error?: string;
}

interface CollateralExposureProps {
  vaultAddress: string;
}

// Generate a deterministic color from type
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    "MetaMorpho": "bg-blue-500",
    "Morpho Market": "bg-purple-500",
    "Aave": "bg-pink-500",
    "Compound": "bg-emerald-500",
    "Idle": "bg-gray-500",
  };
  return colors[type] || "bg-cyan-500";
}

export function CollateralExposure({ vaultAddress }: CollateralExposureProps) {
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [idleUsd, setIdleUsd] = useState(0);
  const [idlePct, setIdlePct] = useState(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllocations();
  }, [vaultAddress]);

  async function fetchAllocations() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/vaults/${vaultAddress}/collateral-exposure`
      );
      const data: AllocationResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch allocations");
      }

      setAllocations(data.data.allocations);
      setIdleUsd(data.data.idleUsd);
      setIdlePct(data.data.idlePct);
      setNote(data.data.note);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load allocation data"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-background-subtle rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Asset Allocations
            </h2>
            <p className="text-sm text-text-tertiary">
              How vault assets are deployed across adapters
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-6 h-6 rounded-full bg-background-elevated" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-background-elevated rounded" />
                </div>
                <div className="w-32 h-2 bg-background-elevated rounded" />
                <div className="w-20 h-4 bg-background-elevated rounded" />
                <div className="w-14 h-4 bg-background-elevated rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 text-center">
          <p className="text-sm text-accent-red">{error}</p>
          <button
            onClick={fetchAllocations}
            className="mt-2 text-sm text-accent-blue hover:text-accent-blue-hover"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && allocations.length === 0 && idleUsd === 0 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-background-elevated flex items-center justify-center mx-auto">
            <svg
              className="h-6 w-6 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="mt-3 text-sm text-text-secondary">
            No allocation data available
          </p>
        </div>
      )}

      {/* Allocation list */}
      {!loading && !error && (allocations.length > 0 || idleUsd > 0) && (
        <div className="p-6">
          <div className="space-y-3">
            {allocations.map((allocation, index) => (
              <div
                key={allocation.address}
                className="flex items-center gap-4"
              >
                {/* Type icon */}
                <div
                  className={`w-7 h-7 rounded-full ${getTypeColor(
                    allocation.type
                  )} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                >
                  {allocation.type.slice(0, 2).toUpperCase()}
                </div>

                {/* Type and address */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {allocation.type}
                    </span>
                    <span className="text-xs text-text-muted font-mono hidden sm:inline">
                      {formatAddress(allocation.address)}
                    </span>
                  </div>
                </div>

                {/* Allocation bar */}
                <div className="w-32 flex-shrink-0">
                  <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-blue rounded-full transition-all"
                      style={{
                        width: `${Math.min(allocation.allocationPct, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Value */}
                <div className="w-24 text-right flex-shrink-0">
                  <span className="text-sm font-medium text-text-primary tabular-nums">
                    {formatCurrency(allocation.assetsUsd)}
                  </span>
                </div>

                {/* Percentage */}
                <div className="w-14 text-right flex-shrink-0">
                  <span className="text-sm text-text-secondary tabular-nums">
                    {allocation.allocationPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}

            {/* Idle assets */}
            {idleUsd > 0 && (
              <div className="flex items-center gap-4 opacity-60">
                <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  --
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-muted italic">
                    Idle (Unallocated)
                  </span>
                </div>
                <div className="w-32 flex-shrink-0">
                  <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-500 rounded-full"
                      style={{ width: `${Math.min(idlePct, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-24 text-right flex-shrink-0">
                  <span className="text-sm text-text-muted tabular-nums">
                    {formatCurrency(idleUsd)}
                  </span>
                </div>
                <div className="w-14 text-right flex-shrink-0">
                  <span className="text-sm text-text-muted tabular-nums">
                    {idlePct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Note about collateral data */}
          {note && (
            <div className="mt-4 p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-accent-blue">
                  Detailed collateral exposure coming in next update. Currently showing adapter-level allocations.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

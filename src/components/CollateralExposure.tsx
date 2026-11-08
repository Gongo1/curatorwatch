"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatAddress } from "@/lib/utils/format";
import { Panel } from "@/components/layout/Panel";

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
    <Panel title="Asset allocations" meta="by adapter">
      {/* Loading state */}
      {loading && (
        <div className="animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 h-8 border-b border-border-subtle last:border-b-0">
              <div className="h-3 w-28 bg-background-elevated" />
              <div className="flex-1" />
              <div className="h-1.5 w-24 bg-background-elevated" />
              <div className="h-3 w-16 bg-background-elevated" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-3 text-sm">
          <p className="text-accent-red">Allocations could not be loaded: {error}</p>
          <button type="button" onClick={fetchAllocations} className="btn btn-ghost h-7 mt-2">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && allocations.length === 0 && idleUsd === 0 && (
        <p className="p-3 text-sm text-text-tertiary">
          No allocation data for this vault yet. It appears after the next data sync.
        </p>
      )}

      {/* Allocation list */}
      {!loading && !error && (allocations.length > 0 || idleUsd > 0) && (
        <>
          <ul>
            {allocations.map((allocation) => (
              <li
                key={allocation.address}
                className="flex items-center gap-3 px-3 h-8 border-b border-border-subtle text-sm"
              >
                {/* Type and address */}
                <span className="flex-1 min-w-0 flex items-baseline gap-2">
                  <span className="font-medium text-text-primary truncate">{allocation.type}</span>
                  <span className="num text-xs text-text-muted hidden sm:inline">
                    {formatAddress(allocation.address)}
                  </span>
                </span>

                {/* Allocation bar */}
                <span className="w-24 h-1.5 bg-background-elevated flex-none hidden sm:block" aria-hidden="true">
                  <span
                    className="block h-full bg-accent-blue"
                    style={{ width: `${Math.min(allocation.allocationPct, 100)}%` }}
                  />
                </span>

                {/* Value */}
                <span className="w-24 text-right flex-none num text-text-primary">
                  {formatCurrency(allocation.assetsUsd)}
                </span>

                {/* Percentage */}
                <span className="w-14 text-right flex-none num text-text-secondary">
                  {allocation.allocationPct.toFixed(1)}%
                </span>
              </li>
            ))}

            {/* Idle assets */}
            {idleUsd > 0 && (
              <li className="flex items-center gap-3 px-3 h-8 border-b border-border-subtle text-sm">
                <span className="flex-1 min-w-0 text-text-muted">Idle (unallocated)</span>
                <span className="w-24 h-1.5 bg-background-elevated flex-none hidden sm:block" aria-hidden="true">
                  <span
                    className="block h-full bg-text-muted"
                    style={{ width: `${Math.min(idlePct, 100)}%` }}
                  />
                </span>
                <span className="w-24 text-right flex-none num text-text-muted">{formatCurrency(idleUsd)}</span>
                <span className="w-14 text-right flex-none num text-text-muted">{idlePct.toFixed(1)}%</span>
              </li>
            )}
          </ul>

          {/* Note about collateral data */}
          {note && (
            <p className="px-3 py-2 text-xs text-text-tertiary">
              Adapter-level view. Market-level collateral exposure is not broken out here yet.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

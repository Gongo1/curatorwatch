"use client";

import { ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { useState, useEffect } from "react";
import {
  formatTimeAgo,
  formatTokenAmount,
  formatCurrency,
  formatAddress,
} from "@/lib/utils/format";
import { UserDistribution } from "./UserDistribution";
import { CollateralExposure } from "./CollateralExposure";
import { TransactionVolumeChart } from "./TransactionVolumeChart";
import { Panel } from "@/components/layout/Panel";

interface ActivityItem {
  id: string;
  type: string;
  txHash: string;
  timestamp: string;
  assets: string | null;
  shares: string | null;
  assetsUsd: number | null;
  etherscanUrl: string | null;
  sender?: string;
}

interface ActivityResponse {
  success: boolean;
  data: {
    activity: ActivityItem[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

interface ActivityTabProps {
  vaultAddress: string;
  assetSymbol: string;
  assetDecimals: number;
}

const ACTIVITY_TYPES = [
  { value: "", label: "All" },
  { value: "Deposit", label: "Deposits" },
  { value: "Withdraw", label: "Withdrawals" },
  { value: "Reallocate", label: "Reallocations" },
];

export function ActivityTab({
  vaultAddress,
  assetSymbol,
  assetDecimals,
}: ActivityTabProps) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    fetchActivity(true);
  }, [vaultAddress, filter]);

  async function fetchActivity(reset = false) {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        limit: "50",
        offset: newOffset.toString(),
        ...(filter && { type: filter }),
      });

      const response = await fetch(
        `/api/vaults/${vaultAddress}/activity?${params}`
      );
      const data: ActivityResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch activity");
      }

      if (reset) {
        setActivity(data.data.activity);
        setOffset(50);
      } else {
        setActivity((prev) => [...prev, ...data.data.activity]);
        setOffset((prev) => prev + 50);
      }
      setHasMore(data.data.pagination.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  const getTypeGlyph = (type: string) => {
    switch (type.toLowerCase()) {
      case "deposit":
        return <ArrowDown className="w-3 h-3" />;
      case "withdraw":
        return <ArrowUp className="w-3 h-3" />;
      case "reallocate":
        return <ArrowLeftRight className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "deposit":
        return "text-accent-green";
      case "withdraw":
        return "text-accent-red";
      default:
        return "text-text-secondary";
    }
  };

  const filterGroup = (
    <div role="group" aria-label="Filter transactions" className="flex border border-border-strong">
      {ACTIVITY_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          aria-pressed={filter === type.value}
          onClick={() => setFilter(type.value)}
          className={`h-[1.375rem] px-2 cond text-[0.72rem] font-semibold uppercase tracking-[0.04em] border-r border-border-strong last:border-r-0 transition-colors ${
            filter === type.value
              ? "bg-accent-blue text-signal-ink"
              : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-1.5">
      {/* User Distribution Section */}
      <UserDistribution
        vaultAddress={vaultAddress}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
      />

      {/* Collateral Exposure Section */}
      <CollateralExposure vaultAddress={vaultAddress} />

      {/* Transaction Volume Chart */}
      <TransactionVolumeChart vaultAddress={vaultAddress} />

      {/* Transaction Feed Section */}
      <Panel title="Transaction history">
        {/* Filter buttons */}
        <div className="flex items-center gap-2 px-3 h-9 border-b border-border overflow-x-auto">
          <span className="label hidden sm:inline">Deposits, withdrawals, reallocations</span>
          <span className="sm:ml-auto flex-none">{filterGroup}</span>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-3 text-sm">
            <p className="text-accent-red">Transactions could not be loaded: {error}</p>
            <button
              type="button"
              onClick={() => fetchActivity(true)}
              className="btn btn-ghost h-7 mt-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && activity.length === 0 && !error && (
          <p className="p-3 label animate-pulse">Loading transactions…</p>
        )}

        {/* Empty state */}
        {!loading && !error && activity.length === 0 && (
          <div className="p-3">
            <p className="text-sm text-text-primary">No transactions found</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {filter ? "Nothing of this type yet. Choose All to see every transaction." : "Transactions appear here as they occur."}
            </p>
          </div>
        )}

        {/* Transaction list */}
        {!error && activity.length > 0 && (
          <ul>
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 h-9 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors text-sm"
              >
                <span className={`flex items-center gap-1.5 w-28 flex-none ${getTypeColor(item.type)}`}>
                  <span className="w-3 flex justify-center" aria-hidden="true">{getTypeGlyph(item.type)}</span>
                  <span className="font-medium truncate">{item.type}</span>
                </span>

                {item.sender && (
                  <span className="num text-xs text-text-tertiary hidden md:inline flex-none">
                    {formatAddress(item.sender)}
                  </span>
                )}

                <span className="flex-1 min-w-0 flex items-baseline justify-end gap-2">
                  {item.assets && (
                    <span className="num text-text-primary truncate">
                      {formatTokenAmount(item.assets, assetDecimals, assetSymbol)}
                    </span>
                  )}
                  {item.assetsUsd && (
                    <span className="num text-xs text-text-tertiary hidden sm:inline">
                      {formatCurrency(item.assetsUsd)}
                    </span>
                  )}
                </span>

                <span className="num text-xs text-text-muted w-16 text-right flex-none">
                  {formatTimeAgo(item.timestamp)}
                </span>

                <span className="w-4 flex-none">
                  {item.etherscanUrl && (
                    <a
                      href={item.etherscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-text-tertiary hover:text-accent-blue transition-colors"
                      title="View on Etherscan"
                      aria-label="View on Etherscan"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            onClick={() => fetchActivity(false)}
            disabled={loading}
            className="block w-full h-8 border-t border-border label text-accent-blue hover:bg-background-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more transactions"}
          </button>
        )}
      </Panel>
    </div>
  );
}

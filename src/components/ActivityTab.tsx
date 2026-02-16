"use client";

import { useState, useEffect } from "react";
import {
  formatTimeAgo,
  formatTokenAmount,
  formatCurrency,
  formatAddress,
} from "@/lib/utils/format";
import { UserDistribution } from "./UserDistribution";
import { CollateralExposure } from "./CollateralExposure";

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

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "deposit":
        return (
          <div className="w-8 h-8 rounded-full bg-accent-green/15 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-accent-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m0 0l-4-4m4 4l4-4"
              />
            </svg>
          </div>
        );
      case "withdraw":
        return (
          <div className="w-8 h-8 rounded-full bg-accent-red/15 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-accent-red"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 20V4m0 0l-4 4m4-4l4 4"
              />
            </svg>
          </div>
        );
      case "reallocate":
        return (
          <div className="w-8 h-8 rounded-full bg-accent-blue/15 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-accent-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-background-elevated flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-text-muted"
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
          </div>
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "deposit":
        return "text-accent-green";
      case "withdraw":
        return "text-accent-red";
      case "reallocate":
        return "text-accent-blue";
      default:
        return "text-text-secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* User Distribution Section */}
      <UserDistribution
        vaultAddress={vaultAddress}
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
      />

      {/* Collateral Exposure Section */}
      <CollateralExposure vaultAddress={vaultAddress} />

      {/* Transaction Feed Section */}
      <section className="bg-background-subtle rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Transaction History
            </h2>
            <p className="text-sm text-text-tertiary">
              Recent deposits, withdrawals, and reallocations
            </p>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary uppercase tracking-wider">
              Filter
            </span>
            <div className="flex gap-1">
              {ACTIVITY_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFilter(type.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filter === type.value
                      ? "bg-accent-blue text-white font-medium"
                      : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-6 text-center">
            <p className="text-accent-red text-sm">{error}</p>
            <button
              onClick={() => fetchActivity(true)}
              className="mt-2 text-sm text-accent-blue hover:text-accent-blue-hover"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && activity.length === 0 && !error && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-blue border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-text-tertiary">
              Loading transactions...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && activity.length === 0 && (
          <div className="p-12 text-center">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-text-primary">
              No transactions found
            </p>
            <p className="text-xs text-text-muted mt-1">
              Transactions will appear here as they occur
            </p>
          </div>
        )}

        {/* Transaction list */}
        {!error && activity.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {activity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-background-hover transition-colors"
              >
                {getActivityIcon(item.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${getTypeColor(
                        item.type
                      )}`}
                    >
                      {item.type}
                    </span>
                    {item.sender && (
                      <span className="text-xs text-text-muted font-mono bg-background-elevated px-1.5 py-0.5 rounded">
                        {formatAddress(item.sender)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    {item.assets && (
                      <span className="text-sm text-text-primary font-medium tabular-nums">
                        {formatTokenAmount(
                          item.assets,
                          assetDecimals,
                          assetSymbol
                        )}
                      </span>
                    )}
                    {item.assetsUsd && (
                      <span className="text-xs text-text-tertiary tabular-nums">
                        ({formatCurrency(item.assetsUsd)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-text-muted">
                    {formatTimeAgo(item.timestamp)}
                  </span>

                  {item.etherscanUrl && (
                    <a
                      href={item.etherscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent-blue transition-colors p-1.5 rounded hover:bg-background-elevated"
                      title="View on Etherscan"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-border text-center">
            <button
              onClick={() => fetchActivity(false)}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-text-primary bg-background-elevated hover:bg-background-hover border border-border rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent-blue border-t-transparent" />
                  Loading...
                </span>
              ) : (
                "Load more transactions"
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

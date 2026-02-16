"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatAddress } from "@/lib/utils/format";
import { UserExposureModal } from "./UserExposureModal";

interface VaultDeposit {
  address: string;
  name: string;
  assetsUsd: number;
  depositPct: number;
}

interface CuratorDepositor {
  address: string;
  totalAssetsUsd: number;
  vaults: VaultDeposit[];
  vaultCount: number;
}

interface CuratorDepositorsResponse {
  success: boolean;
  data: {
    depositors: CuratorDepositor[];
    totalDepositors: number;
    totalAUM: number;
  };
}

interface CuratorDepositorsProps {
  curatorAddress: string;
}

// Generate a deterministic avatar color from an address
function getAvatarColor(address: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-orange-500",
  ];
  const hash = parseInt(address.slice(2, 6), 16);
  return colors[hash % colors.length];
}

export function CuratorDepositors({ curatorAddress }: CuratorDepositorsProps) {
  const [depositors, setDepositors] = useState<CuratorDepositor[]>([]);
  const [totalDepositors, setTotalDepositors] = useState(0);
  const [totalAUM, setTotalAUM] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchDepositors();
  }, [curatorAddress]);

  async function fetchDepositors() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/curators/${curatorAddress}/depositors?limit=20`
      );
      const data: CuratorDepositorsResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch depositors");
      }

      setDepositors(data.data.depositors);
      setTotalDepositors(data.data.totalDepositors);
      setTotalAUM(data.data.totalAUM);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load depositors"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="bg-background-subtle rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Top Depositors Across All Vaults
            </h2>
            <p className="text-xs text-text-tertiary mt-1">
              Users with positions across multiple vaults
            </p>
          </div>
          {!loading && !error && (
            <span className="text-xs text-text-muted">
              {totalDepositors} unique depositor{totalDepositors !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-background-elevated" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-background-elevated rounded mb-1" />
                    <div className="h-3 w-32 bg-background-elevated rounded" />
                  </div>
                  <div className="w-20 h-4 bg-background-elevated rounded" />
                  <div className="w-16 h-4 bg-background-elevated rounded" />
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
              onClick={fetchDepositors}
              className="mt-2 text-sm text-accent-blue hover:text-accent-blue-hover"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && depositors.length === 0 && (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              No depositors found
            </p>
          </div>
        )}

        {/* Depositors list */}
        {!loading && !error && depositors.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {depositors.map((depositor) => (
              <div key={depositor.address}>
                <div
                  className="flex items-center gap-4 px-6 py-4 hover:bg-background-hover transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedUser(
                      expandedUser === depositor.address
                        ? null
                        : depositor.address
                    )
                  }
                >
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full ${getAvatarColor(
                      depositor.address
                    )} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                  >
                    {depositor.address.slice(2, 4).toUpperCase()}
                  </div>

                  {/* Address and vault count */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(depositor.address);
                      }}
                      className="text-sm font-mono text-text-primary hover:text-accent-blue transition-colors"
                    >
                      {formatAddress(depositor.address)}
                    </button>
                    <p className="text-xs text-text-muted">
                      {depositor.vaultCount} vault{depositor.vaultCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Total exposure */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-text-primary tabular-nums">
                      {formatCurrency(depositor.totalAssetsUsd)}
                    </p>
                    <p className="text-xs text-text-muted">Total exposure</p>
                  </div>

                  {/* Expand icon */}
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${
                      expandedUser === depositor.address ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                {/* Expanded vault breakdown */}
                {expandedUser === depositor.address && (
                  <div className="px-6 pb-4 bg-background-elevated/50">
                    <div className="ml-13 pl-4 border-l-2 border-border-subtle space-y-2">
                      {depositor.vaults.map((vault) => (
                        <div
                          key={vault.address}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <span className="text-text-secondary truncate max-w-[200px]">
                            {vault.name}
                          </span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-text-primary tabular-nums">
                              {formatCurrency(vault.assetsUsd)}
                            </span>
                            <span className="text-xs text-text-muted tabular-nums w-16 text-right">
                              {vault.depositPct.toFixed(1)}% of vault
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* User Exposure Modal */}
      {selectedUser && (
        <UserExposureModal
          userAddress={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  formatTokenAmount,
  formatCurrency,
  formatAddress,
} from "@/lib/utils/format";
import { UserExposureModal } from "./UserExposureModal";

interface Depositor {
  address: string;
  assets: string;
  assetsUsd: number;
  shares: string;
  depositPct: number;
}

interface DepositorsResponse {
  success: boolean;
  data: {
    depositors: Depositor[];
    totalDepositors: number;
    totalAssetsUsd: number;
  };
}

interface UserDistributionProps {
  vaultAddress: string;
  assetSymbol: string;
  assetDecimals: number;
}

const ITEMS_PER_PAGE = 5;

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
  const hash = address.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return colors[Math.abs(hash) % colors.length];
}

export function UserDistribution({
  vaultAddress,
  assetSymbol,
  assetDecimals,
}: UserDistributionProps) {
  const [depositors, setDepositors] = useState<Depositor[]>([]);
  const [totalDepositors, setTotalDepositors] = useState(0);
  const [totalAssetsUsd, setTotalAssetsUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchDepositors();
  }, [vaultAddress]);

  async function fetchDepositors() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/vaults/${vaultAddress}/depositors?limit=50`
      );
      const data: DepositorsResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch depositors");
      }

      setDepositors(data.data.depositors);
      setTotalDepositors(data.data.totalDepositors);
      setTotalAssetsUsd(data.data.totalAssetsUsd);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load depositors"
      );
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(depositors.length / ITEMS_PER_PAGE);
  const currentDepositors = depositors.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  const handleUserClick = (address: string) => {
    setSelectedUser(address);
  };

  return (
    <>
      <section className="bg-[#141414] rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              User Distribution
            </h2>
            <p className="text-sm text-text-tertiary">
              Top depositors by vault share
            </p>
          </div>
          {!loading && !error && totalDepositors > 0 && (
            <span className="text-xs text-text-muted">
              {totalDepositors} depositor{totalDepositors !== 1 ? "s" : ""}
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
                  <div className="w-24 h-2 bg-background-elevated rounded" />
                  <div className="w-12 h-4 bg-background-elevated rounded" />
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

        {/* Depositor table */}
        {!loading && !error && depositors.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-background-elevated/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Deposit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-48">
                      % of Deposits
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {currentDepositors.map((depositor) => (
                    <tr
                      key={depositor.address}
                      className="hover:bg-background-hover/50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(depositor.address)}
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full ${getAvatarColor(
                              depositor.address
                            )} flex items-center justify-center text-white text-xs font-bold`}
                          >
                            {depositor.address.slice(2, 4).toUpperCase()}
                          </div>
                          <span className="font-mono text-sm text-text-primary hover:text-accent-blue transition-colors">
                            {formatAddress(depositor.address)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-medium text-text-primary tabular-nums flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${getAvatarColor(
                                assetSymbol
                              )}`}
                            />
                            {formatTokenAmount(
                              depositor.assets,
                              assetDecimals,
                              assetSymbol
                            )}
                          </span>
                          <span className="text-xs text-text-tertiary tabular-nums">
                            {formatCurrency(depositor.assetsUsd)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 h-2 bg-background-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent-blue to-accent-blue-hover rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  depositor.depositPct,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-text-primary tabular-nums w-14 text-right">
                            {depositor.depositPct.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-sm text-text-muted">
                  {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </>
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

"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import {
  formatTokenAmount,
  formatCurrency,
  formatAddress,
} from "@/lib/utils/format";
import { UserExposureModal } from "./UserExposureModal";
import { Panel } from "@/components/layout/Panel";

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
      <Panel
        title="User distribution"
        meta={
          !loading && !error && totalDepositors > 0
            ? `${totalDepositors} depositor${totalDepositors !== 1 ? "s" : ""} · top by share`
            : "top depositors by share"
        }
      >
        {/* Loading state */}
        {loading && (
          <div className="animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 h-9 border-b border-border-subtle last:border-b-0">
                <div className="h-3 w-28 bg-background-elevated" />
                <div className="flex-1" />
                <div className="h-3 w-20 bg-background-elevated" />
                <div className="h-3 w-16 bg-background-elevated" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="p-3 text-sm">
            <p className="text-accent-red">Depositors could not be loaded: {error}</p>
            <button type="button" onClick={fetchDepositors} className="btn btn-ghost h-7 mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && depositors.length === 0 && (
          <p className="p-3 text-sm text-text-tertiary">No depositors found for this vault yet.</p>
        )}

        {/* Depositor table */}
        {!loading && !error && depositors.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="h-7 border-b border-border bg-background">
                    <th scope="col" className="label text-left px-3">User</th>
                    <th scope="col" className="label text-right px-3">Deposit</th>
                    <th scope="col" className="label text-right px-3 hidden sm:table-cell">USD</th>
                    <th scope="col" className="label text-right px-3 w-40">% of deposits</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDepositors.map((depositor) => (
                    <tr
                      key={depositor.address}
                      className="h-9 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors cursor-pointer group"
                      onClick={() => handleUserClick(depositor.address)}
                    >
                      <td className="px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserClick(depositor.address);
                          }}
                          className="num text-text-primary group-hover:text-accent-blue transition-colors"
                          title="Show this depositor's exposure"
                        >
                          {formatAddress(depositor.address)}
                        </button>
                      </td>
                      <td className="px-3 whitespace-nowrap text-right num text-text-primary">
                        {formatTokenAmount(depositor.assets, assetDecimals, assetSymbol)}
                      </td>
                      <td className="px-3 whitespace-nowrap text-right num text-text-tertiary hidden sm:table-cell">
                        {formatCurrency(depositor.assetsUsd)}
                      </td>
                      <td className="px-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-background-elevated overflow-hidden hidden sm:block" aria-hidden="true">
                            <div
                              className="h-full bg-accent-blue"
                              style={{ width: `${Math.min(depositor.depositPct, 100)}%` }}
                            />
                          </div>
                          <span className="num text-text-primary w-14 text-right">
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
              <div className="px-3 h-8 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                  className="label text-text-secondary hover:text-accent-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="inline w-3.5 h-3.5 align-[-2px]" aria-hidden="true" /> Prev
                </button>
                <span className="num text-xs text-text-tertiary">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                  className="label text-text-secondary hover:text-accent-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ArrowRight className="inline w-3.5 h-3.5 align-[-2px]" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

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

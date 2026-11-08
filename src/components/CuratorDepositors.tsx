"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatAddress } from "@/lib/utils/format";
import { UserExposureModal } from "./UserExposureModal";
import { Panel } from "@/components/layout/Panel";

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
      <Panel
        title="Top depositors"
        meta={
          !loading && !error
            ? `${totalDepositors} unique depositor${totalDepositors !== 1 ? "s" : ""} · all vaults`
            : "across this curator’s vaults"
        }
      >
        {/* Loading state */}
        {loading && (
          <div className="p-3 space-y-2" aria-busy="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 h-6">
                <div className="w-6 h-6 bg-background-elevated" />
                <div className="h-3 w-28 bg-background-elevated" />
                <div className="ml-auto h-3 w-20 bg-background-elevated" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="p-3">
            <p className="text-sm text-accent-red">
              Depositor data did not load. Try again; if it keeps failing, check back after the next data refresh.
            </p>
            <button type="button" onClick={fetchDepositors} className="btn btn-ghost mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && depositors.length === 0 && (
          <p className="p-3 text-sm text-text-tertiary">
            No depositor positions on record for this curator&rsquo;s vaults yet.
          </p>
        )}

        {/* Depositors list */}
        {!loading && !error && depositors.length > 0 && (
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_1rem] gap-3 items-center px-3 h-7 border-b border-border bg-background">
              <span className="label">Depositor</span>
              <span className="label text-right">Vaults</span>
              <span className="label text-right">Exposure</span>
              <span aria-hidden="true" />
            </div>
            <ul>
              {depositors.map((depositor) => {
                const open = expandedUser === depositor.address;
                return (
                  <li key={depositor.address} className="border-b border-border-subtle last:border-b-0">
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_1rem] gap-3 items-center px-3 h-9 hover:bg-background-hover transition-colors cursor-pointer"
                      onClick={() => setExpandedUser(open ? null : depositor.address)}
                    >
                      {/* Address (opens the cross-vault exposure view) */}
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 flex-none grid place-items-center bg-background-elevated border border-border num text-[0.65rem] text-text-secondary"
                          aria-hidden="true"
                        >
                          {depositor.address.slice(2, 4).toUpperCase()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(depositor.address);
                          }}
                          className="num text-sm text-text-primary hover:text-accent-blue transition-colors truncate"
                        >
                          {formatAddress(depositor.address)}
                        </button>
                      </span>

                      <span className="num text-sm text-text-secondary text-right">{depositor.vaultCount}</span>

                      <span className="num text-sm font-semibold text-text-primary text-right">
                        {formatCurrency(depositor.totalAssetsUsd)}
                      </span>

                      {/* Expand icon */}
                      <svg
                        className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Expanded vault breakdown */}
                    {open && (
                      <div className="px-3 pb-2 pt-1 bg-background border-t border-border-subtle">
                        <div className="pl-8">
                          {depositor.vaults.map((vault) => (
                            <div key={vault.address} className="flex items-center justify-between gap-3 text-sm h-7">
                              <span className="text-text-secondary truncate min-w-0">{vault.name}</span>
                              <span className="flex items-center gap-3 flex-shrink-0">
                                <span className="num text-text-primary">{formatCurrency(vault.assetsUsd)}</span>
                                <span className="num text-xs text-text-tertiary w-[6.5rem] text-right">
                                  {vault.depositPct.toFixed(1)}% of vault
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
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

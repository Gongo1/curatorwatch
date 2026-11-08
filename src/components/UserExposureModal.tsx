"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, formatAddress } from "@/lib/utils/format";

interface VaultExposure {
  vaultAddress: string;
  vaultName: string;
  vaultSymbol: string;
  assetSymbol: string;
  curatorAddress: string | null;
  curatorName: string | null;
  assetsUsd: number;
  depositPct: number;
  vaultTvl: number;
}

interface CuratorConcentration {
  curatorAddress: string;
  curatorName: string | null;
  totalExposure: number;
  vaultCount: number;
  exposurePct: number;
}

interface AssetConcentration {
  assetSymbol: string;
  totalExposure: number;
  vaultCount: number;
  exposurePct: number;
}

interface UserExposureResponse {
  success: boolean;
  data: {
    userAddress: string;
    vaults: VaultExposure[];
    totalExposure: number;
    vaultCount: number;
    curatorConcentration: CuratorConcentration[];
    assetConcentration: AssetConcentration[];
    concentrationRisk: "low" | "medium" | "high";
  };
}

interface UserExposureModalProps {
  userAddress: string;
  onClose: () => void;
}

const RISK_TONE: Record<"low" | "medium" | "high", { dot: string; text: string; label: string }> = {
  low: { dot: "bg-accent-green", text: "text-accent-green", label: "Low" },
  medium: { dot: "bg-accent-yellow", text: "text-accent-yellow", label: "Medium" },
  high: { dot: "bg-accent-red", text: "text-accent-red", label: "High" },
};

function getRiskBadge(risk: "low" | "medium" | "high") {
  const t = RISK_TONE[risk];
  return (
    <span className={`inline-flex items-center gap-1.5 cond font-bold text-[1.3rem] leading-none ${t.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {t.label}
    </span>
  );
}

export function UserExposureModal({
  userAddress,
  onClose,
}: UserExposureModalProps) {
  const [data, setData] = useState<UserExposureResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserExposure();
  }, [userAddress]);

  async function fetchUserExposure() {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${userAddress}/exposure`);
      const result: UserExposureResponse = await response.json();

      if (!result.success) {
        throw new Error("Failed to fetch user exposure");
      }

      setData(result.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load user exposure"
      );
    } finally {
      setLoading(false);
    }
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85" onClick={onClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-exposure-title"
        className="panel relative w-full max-w-2xl max-h-[90vh] flex flex-col border-border-strong"
      >
        {/* Header */}
        <div className="panel-head">
          <h2 id="user-exposure-title" className="panel-title">User exposure</h2>
          <span className="num text-xs text-text-secondary truncate">{formatAddress(userAddress)}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto -mr-1.5 p-1.5 text-text-muted hover:text-accent-blue transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto min-h-0">
          {/* Loading */}
          {loading && (
            <div className="p-8 text-center">
              <div className="animate-spin h-6 w-6 border-2 border-accent-blue border-t-transparent mx-auto" />
              <p className="mt-3 label">Loading exposure data</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="p-3">
              <p className="text-sm text-accent-red">
                Exposure data for this address did not load. Try again; if it keeps failing, check back after the next data refresh.
              </p>
              <button type="button" onClick={fetchUserExposure} className="btn btn-ghost mt-2">
                Try again
              </button>
            </div>
          )}

          {/* Data */}
          {data && !loading && !error && (
            <div>
              {/* Summary quotes */}
              <dl className="grid grid-cols-3 border-b border-border">
                <div className="px-3 py-2.5 border-r border-border min-w-0">
                  <dt className="label">Total exposure</dt>
                  <dd className="num font-semibold text-[1.3rem] leading-none mt-1.5 text-accent-blue truncate">
                    {formatCurrency(data.totalExposure)}
                  </dd>
                </div>
                <div className="px-3 py-2.5 border-r border-border min-w-0">
                  <dt className="label">Vaults</dt>
                  <dd className="num font-semibold text-[1.3rem] leading-none mt-1.5 text-text-primary">
                    {data.vaultCount}
                  </dd>
                </div>
                <div className="px-3 py-2.5 min-w-0">
                  <dt className="label">Concentration</dt>
                  <dd className="mt-1.5">{getRiskBadge(data.concentrationRisk)}</dd>
                </div>
              </dl>

              {/* Vault exposure list */}
              {data.vaults.length > 0 && (
                <div className="border-b border-border">
                  <h3 className="label text-accent-blue px-3 h-7 flex items-center bg-background-elevated border-b border-border">
                    Vault exposure
                  </h3>
                  <ul>
                    {data.vaults.map((vault) => (
                      <li key={vault.vaultAddress} className="border-b border-border-subtle last:border-b-0">
                        <Link
                          href={`/vault/${vault.vaultAddress}`}
                          onClick={onClose}
                          className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-background-hover transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
                              {vault.vaultName}
                            </p>
                            <p className="text-xs text-text-tertiary truncate">
                              {vault.curatorName
                                ? `Managed by ${vault.curatorName}`
                                : vault.assetSymbol}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="num text-sm text-text-primary">
                              {formatCurrency(vault.assetsUsd)}
                            </p>
                            <p className="num text-xs text-text-tertiary">
                              {vault.depositPct.toFixed(1)}% of vault
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concentration breakdown */}
              {(data.curatorConcentration.length > 0 ||
                data.assetConcentration.length > 0) && (
                <div className="grid sm:grid-cols-2">
                  {/* Curator concentration */}
                  {data.curatorConcentration.length > 0 && (
                    <div className="p-3 border-b sm:border-b-0 sm:border-r border-border-subtle">
                      <h3 className="label mb-2">By curator</h3>
                      <div className="space-y-2">
                        {data.curatorConcentration.slice(0, 4).map((curator) => (
                          <div key={curator.curatorAddress}>
                            <div className="flex items-center justify-between gap-2 text-sm mb-1">
                              <span className="text-text-secondary truncate">
                                {curator.curatorName || formatAddress(curator.curatorAddress)}
                              </span>
                              <span className="num text-xs text-text-primary">
                                {curator.exposurePct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-background">
                              <div
                                className="h-full"
                                style={{ width: `${curator.exposurePct}%`, background: "var(--chart-1)" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Asset concentration */}
                  {data.assetConcentration.length > 0 && (
                    <div className="p-3">
                      <h3 className="label mb-2">By asset</h3>
                      <div className="space-y-2">
                        {data.assetConcentration.slice(0, 4).map((asset) => (
                          <div key={asset.assetSymbol}>
                            <div className="flex items-center justify-between gap-2 text-sm mb-1">
                              <span className="text-text-secondary">{asset.assetSymbol}</span>
                              <span className="num text-xs text-text-primary">
                                {asset.exposurePct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-background">
                              <div
                                className="h-full"
                                style={{ width: `${asset.exposurePct}%`, background: "var(--chart-2)" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {data.vaults.length === 0 && (
                <p className="p-3 text-sm text-text-tertiary">
                  No vault positions found for this address in tracked vaults.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

function getRiskBadge(risk: "low" | "medium" | "high") {
  switch (risk) {
    case "low":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
          Low
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
          Medium
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-red/15 text-accent-red border border-accent-red/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
          High
        </span>
      );
  }
}

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
  ];
  const hash = parseInt(address.slice(2, 6), 16);
  return colors[hash % colors.length];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-background border border-border rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background-subtle">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${getAvatarColor(
                userAddress
              )} flex items-center justify-center text-white font-bold`}
            >
              {userAddress.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                User Exposure
              </h2>
              <p className="text-sm text-text-tertiary font-mono">
                {formatAddress(userAddress)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-hover rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Loading */}
          {loading && (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-blue border-t-transparent mx-auto" />
              <p className="mt-4 text-sm text-text-tertiary">
                Loading exposure data...
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="p-12 text-center">
              <p className="text-sm text-accent-red">{error}</p>
              <button
                onClick={fetchUserExposure}
                className="mt-4 text-sm text-accent-blue hover:text-accent-blue-hover"
              >
                Try again
              </button>
            </div>
          )}

          {/* Data */}
          {data && !loading && !error && (
            <div className="p-6 space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-background-subtle rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-semibold text-accent-blue tabular-nums">
                    {formatCurrency(data.totalExposure)}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Total Exposure
                  </p>
                </div>
                <div className="bg-background-subtle rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-semibold text-text-primary tabular-nums">
                    {data.vaultCount}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">Vaults</p>
                </div>
                <div className="bg-background-subtle rounded-lg border border-border p-4 text-center">
                  <div className="flex justify-center">
                    {getRiskBadge(data.concentrationRisk)}
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    Concentration Risk
                  </p>
                </div>
              </div>

              {/* Vault exposure list */}
              {data.vaults.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">
                    Vault Exposure
                  </h3>
                  <div className="bg-background-subtle rounded-lg border border-border divide-y divide-border-subtle">
                    {data.vaults.map((vault) => (
                      <Link
                        key={vault.vaultAddress}
                        href={`/vault/${vault.vaultAddress}`}
                        onClick={onClose}
                        className="flex items-center justify-between px-4 py-3 hover:bg-background-hover transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
                            {vault.vaultName}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {vault.curatorName
                              ? `Managed by ${vault.curatorName}`
                              : vault.assetSymbol}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-medium text-text-primary tabular-nums">
                              {formatCurrency(vault.assetsUsd)}
                            </p>
                            <p className="text-xs text-text-muted tabular-nums">
                              {vault.depositPct.toFixed(1)}% of vault
                            </p>
                          </div>
                          <svg
                            className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors"
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
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Concentration breakdown */}
              {(data.curatorConcentration.length > 0 ||
                data.assetConcentration.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Curator concentration */}
                  {data.curatorConcentration.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary mb-3">
                        By Curator
                      </h3>
                      <div className="space-y-2">
                        {data.curatorConcentration
                          .slice(0, 4)
                          .map((curator) => (
                            <div
                              key={curator.curatorAddress}
                              className="flex items-center gap-3"
                            >
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="text-text-secondary truncate">
                                    {curator.curatorName ||
                                      formatAddress(curator.curatorAddress)}
                                  </span>
                                  <span className="text-text-muted tabular-nums">
                                    {curator.exposurePct.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-accent-blue rounded-full"
                                    style={{
                                      width: `${curator.exposurePct}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Asset concentration */}
                  {data.assetConcentration.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary mb-3">
                        By Asset
                      </h3>
                      <div className="space-y-2">
                        {data.assetConcentration.slice(0, 4).map((asset) => (
                          <div
                            key={asset.assetSymbol}
                            className="flex items-center gap-3"
                          >
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-text-secondary">
                                  {asset.assetSymbol}
                                </span>
                                <span className="text-text-muted tabular-nums">
                                  {asset.exposurePct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 rounded-full"
                                  style={{ width: `${asset.exposurePct}%` }}
                                />
                              </div>
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
                <div className="text-center py-8">
                  <p className="text-sm text-text-tertiary">
                    No vault positions found for this user
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { RiskAssessmentCard } from "./RiskAssessment";
import type { InstitutionalRiskAssessment } from "@/lib/types/api";
import {
  formatCurrency,
  formatAddress,
  formatTokenAmount,
} from "@/lib/utils/format";

interface AllocationItem {
  address: string;
  type: string;
  assets: string;
  assetsUsd: number;
  allocationPct: number;
  isHighRisk: boolean;
}

interface RiskData {
  currentRisk: {
    concentration: {
      score: string;
      topAdapterPercent: number;
      top3AdaptersPercent: number;
      numActiveAdapters: number;
      herfindahlIndex: number;
    };
    liquidity: {
      score: string;
      idleAssetsPercent: number;
      idleAssetsUsd: number;
      hasLiquidityAdapter: boolean;
    };
    diversification: {
      score: string;
      avgAllocationPercent: number;
      largestAllocation: number;
    };
    timestamp: string;
  } | null;
  allocations: AllocationItem[];
  idleAssets: {
    amount: string;
    amountUsd: number;
    percent: number;
  };
  riskHistory: Array<{
    timestamp: string;
    concentrationScore: string;
    liquidityScore: string;
    diversificationScore: string;
    topAdapterPercent: number;
  }>;
  asset: {
    symbol: string;
    decimals: number;
  };
  totalAssetsUsd: number;
}

interface RiskResponse {
  success: boolean;
  data: RiskData;
}

interface RiskTabProps {
  vaultAddress: string;
  riskAssessment?: InstitutionalRiskAssessment;
}

export function RiskTab({ vaultAddress, riskAssessment }: RiskTabProps) {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRiskData();
  }, [vaultAddress]);

  async function fetchRiskData() {
    try {
      setLoading(true);
      const response = await fetch(`/api/vaults/${vaultAddress}/risk`);
      const data: RiskResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch risk data");
      }

      setRiskData(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load risk data");
    } finally {
      setLoading(false);
    }
  }

  const getScoreBadge = (
    score: string
  ): { color: string; bgColor: string; borderColor: string; label: string } => {
    switch (score.toLowerCase()) {
      case "low":
      case "good":
        return {
          color: "text-accent-green",
          bgColor: "bg-accent-green/15",
          borderColor: "border-accent-green/30",
          label: score === "low" ? "Low Risk" : "Good",
        };
      case "medium":
      case "moderate":
        return {
          color: "text-accent-yellow",
          bgColor: "bg-accent-yellow/15",
          borderColor: "border-accent-yellow/30",
          label: "Moderate",
        };
      case "high":
      case "poor":
        return {
          color: "text-accent-red",
          bgColor: "bg-accent-red/15",
          borderColor: "border-accent-red/30",
          label: score === "high" ? "High Risk" : "Poor",
        };
      default:
        return {
          color: "text-text-secondary",
          bgColor: "bg-background-elevated",
          borderColor: "border-border",
          label: "Unknown",
        };
    }
  };

  // Convert API response to RiskAssessment format expected by component
  const convertedAssessment = riskAssessment ? {
    ...riskAssessment,
    lastUpdated: new Date(riskAssessment.lastUpdated),
  } : null;

  if (loading && !riskAssessment) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-background-subtle rounded-lg border border-border p-6">
          <div className="h-6 w-48 bg-background-elevated rounded mb-4" />
          <div className="h-2 w-full bg-background-elevated rounded" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-background-subtle rounded-lg border border-border p-4">
              <div className="h-4 w-32 bg-background-elevated rounded mb-2" />
              <div className="h-2 w-full bg-background-elevated/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Institutional Risk Assessment (new) */}
      {convertedAssessment && (
        <RiskAssessmentCard assessment={convertedAssessment} />
      )}

      {/* Allocation Metrics (if risk data is loaded) */}
      {riskData?.currentRisk && (
        <>
          {/* Financial Risk Details */}
          <div className="bg-background-subtle rounded-lg border border-border">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary">Allocation Metrics</h3>
              <p className="text-sm text-text-tertiary">Detailed breakdown of concentration and liquidity</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Concentration */}
              <MetricCard
                title="Concentration"
                badge={getScoreBadge(riskData.currentRisk.concentration.score)}
                metrics={[
                  { label: "Top adapter", value: `${riskData.currentRisk.concentration.topAdapterPercent.toFixed(1)}%` },
                  { label: "Top 3 adapters", value: `${riskData.currentRisk.concentration.top3AdaptersPercent.toFixed(1)}%` },
                  { label: "Active adapters", value: `${riskData.currentRisk.concentration.numActiveAdapters}` },
                ]}
              />

              {/* Liquidity */}
              <MetricCard
                title="Liquidity"
                badge={getScoreBadge(riskData.currentRisk.liquidity.score)}
                metrics={[
                  { label: "Idle assets", value: `${riskData.currentRisk.liquidity.idleAssetsPercent.toFixed(1)}%` },
                  { label: "Idle value", value: formatCurrency(riskData.currentRisk.liquidity.idleAssetsUsd) },
                  { label: "Liquidity adapter", value: riskData.currentRisk.liquidity.hasLiquidityAdapter ? "Yes" : "No", highlight: riskData.currentRisk.liquidity.hasLiquidityAdapter },
                ]}
              />

              {/* Diversification */}
              <MetricCard
                title="Diversification"
                badge={getScoreBadge(riskData.currentRisk.diversification.score)}
                metrics={[
                  { label: "Avg allocation", value: `${riskData.currentRisk.diversification.avgAllocationPercent.toFixed(1)}%` },
                  { label: "Largest position", value: `${riskData.currentRisk.diversification.largestAllocation.toFixed(1)}%` },
                ]}
              />
            </div>
          </div>

          {/* Allocation Breakdown */}
          {riskData.allocations.length > 0 && (
            <div className="bg-background-subtle rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-semibold text-text-primary">
                  Allocation Breakdown
                </h3>
                <p className="text-sm text-text-tertiary">
                  Total: {formatCurrency(riskData.totalAssetsUsd)}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-background-elevated border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Adapter
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                        USD Value
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                        % of Vault
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {riskData.allocations.map((allocation, index) => (
                      <tr
                        key={index}
                        className={`hover:bg-background-hover transition-colors ${
                          allocation.isHighRisk ? "bg-accent-red/5" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">
                                {allocation.type}
                              </span>
                              {allocation.isHighRisk && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-accent-red/15 text-accent-red border border-accent-red/30">
                                  High
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-text-muted font-mono mt-0.5">
                              {formatAddress(allocation.address)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-text-secondary tabular-nums">
                            {formatTokenAmount(
                              allocation.assets,
                              riskData.asset.decimals,
                              riskData.asset.symbol
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-text-primary tabular-nums">
                            {formatCurrency(allocation.assetsUsd)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-background-elevated rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  allocation.isHighRisk
                                    ? "bg-accent-red"
                                    : "bg-accent-blue"
                                }`}
                                style={{
                                  width: `${Math.min(allocation.allocationPct, 100)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-sm font-medium tabular-nums w-12 text-right ${
                                allocation.isHighRisk
                                  ? "text-accent-red"
                                  : "text-text-primary"
                              }`}
                            >
                              {allocation.allocationPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Idle assets row */}
                    {riskData.idleAssets.percent > 0 && (
                      <tr className="bg-background-elevated/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-text-muted italic">
                            Idle (Unallocated)
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-text-tertiary tabular-nums">
                            {formatTokenAmount(
                              riskData.idleAssets.amount,
                              riskData.asset.decimals,
                              riskData.asset.symbol
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-text-tertiary tabular-nums">
                            {formatCurrency(riskData.idleAssets.amountUsd)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-text-tertiary tabular-nums">
                            {riskData.idleAssets.percent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Show error for detailed metrics (non-blocking) */}
      {error && !riskData && !riskAssessment && (
        <div className="bg-accent-red-muted/30 border border-accent-red/30 rounded-lg p-6 text-center">
          <p className="text-accent-red">{error}</p>
          <button
            onClick={fetchRiskData}
            className="mt-4 text-sm text-accent-red hover:text-accent-red/80 font-medium"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// Helper component for metric cards
function MetricCard({
  title,
  badge,
  metrics,
}: {
  title: string;
  badge: { color: string; bgColor: string; borderColor: string; label: string };
  metrics: Array<{ label: string; value: string; highlight?: boolean }>;
}) {
  return (
    <div className="bg-background-elevated rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          {title}
        </h4>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium border ${badge.bgColor} ${badge.borderColor} ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>
      <ul className="space-y-2 text-sm">
        {metrics.map((metric, idx) => (
          <li key={idx} className="flex justify-between">
            <span className="text-text-tertiary">{metric.label}</span>
            <span className={`font-medium tabular-nums ${metric.highlight ? "text-accent-green" : "text-text-primary"}`}>
              {metric.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

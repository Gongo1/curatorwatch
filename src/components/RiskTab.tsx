"use client";

import { useState, useEffect } from "react";
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
}

// Define the 5 institutional risk categories
type RiskCategory = "strategic" | "operational" | "financial" | "compliance" | "reputational";

interface RiskCategoryData {
  id: RiskCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  score: "low" | "medium" | "high";
  factors: Array<{
    label: string;
    value: string;
    status: "good" | "neutral" | "warning" | "critical";
  }>;
}

export function RiskTab({ vaultAddress }: RiskTabProps) {
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

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-background-subtle rounded-lg border border-border p-6">
              <div className="h-4 w-24 bg-background-elevated rounded mb-4" />
              <div className="h-8 w-20 bg-background-elevated rounded mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-background-elevated/50 rounded" />
                <div className="h-3 w-3/4 bg-background-elevated/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !riskData) {
    return (
      <div className="bg-accent-red-muted/30 border border-accent-red/30 rounded-lg p-6 text-center">
        <p className="text-accent-red">{error || "Failed to load risk data"}</p>
        <button
          onClick={fetchRiskData}
          className="mt-4 text-sm text-accent-red hover:text-accent-red/80 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const { currentRisk, allocations, idleAssets, asset, totalAssetsUsd } =
    riskData;

  if (!currentRisk) {
    return (
      <div className="bg-background-subtle border border-border rounded-lg p-12 text-center">
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
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-text-primary">
          No risk data available yet
        </p>
        <p className="text-xs text-text-muted mt-1">
          Risk metrics will appear after the first data collection
        </p>
      </div>
    );
  }

  const concentrationBadge = getScoreBadge(currentRisk.concentration.score);
  const liquidityBadge = getScoreBadge(currentRisk.liquidity.score);
  const diversificationBadge = getScoreBadge(
    currentRisk.diversification.score
  );

  // Calculate overall financial risk based on concentration, liquidity, diversification
  const getFinancialRiskScore = (): "low" | "medium" | "high" => {
    const scores = [
      currentRisk.concentration.score,
      currentRisk.liquidity.score,
      currentRisk.diversification.score,
    ];
    const highCount = scores.filter(s => s.toLowerCase() === "high" || s.toLowerCase() === "poor").length;
    const medCount = scores.filter(s => s.toLowerCase() === "medium" || s.toLowerCase() === "moderate").length;
    if (highCount >= 2) return "high";
    if (highCount >= 1 || medCount >= 2) return "medium";
    return "low";
  };

  // Build the 5 risk categories
  const riskCategories: RiskCategoryData[] = [
    {
      id: "strategic",
      title: "Strategic Risk",
      description: "Risks related to vault strategy and market positioning",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      score: currentRisk.concentration.topAdapterPercent > 60 ? "high" :
             currentRisk.concentration.topAdapterPercent > 40 ? "medium" : "low",
      factors: [
        {
          label: "Adapter Diversification",
          value: `${currentRisk.concentration.numActiveAdapters} active adapter${currentRisk.concentration.numActiveAdapters !== 1 ? "s" : ""}`,
          status: currentRisk.concentration.numActiveAdapters >= 3 ? "good" :
                  currentRisk.concentration.numActiveAdapters >= 2 ? "neutral" : "warning",
        },
        {
          label: "Concentration Level",
          value: `${currentRisk.concentration.topAdapterPercent.toFixed(0)}% in top adapter`,
          status: currentRisk.concentration.topAdapterPercent <= 40 ? "good" :
                  currentRisk.concentration.topAdapterPercent <= 60 ? "neutral" : "critical",
        },
        {
          label: "Asset Utilization",
          value: `${(100 - currentRisk.liquidity.idleAssetsPercent).toFixed(0)}% deployed`,
          status: currentRisk.liquidity.idleAssetsPercent < 10 ? "good" :
                  currentRisk.liquidity.idleAssetsPercent < 30 ? "neutral" : "warning",
        },
      ],
    },
    {
      id: "operational",
      title: "Operational Risk",
      description: "Risks from operational processes and infrastructure",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      score: "low", // Morpho protocol is battle-tested
      factors: [
        {
          label: "Protocol Maturity",
          value: "Morpho V2 (Audited)",
          status: "good",
        },
        {
          label: "Smart Contract Risk",
          value: "Multiple audits completed",
          status: "good",
        },
        {
          label: "Adapter Complexity",
          value: allocations.length > 5 ? "High complexity" :
                 allocations.length > 2 ? "Moderate complexity" : "Simple",
          status: allocations.length > 5 ? "warning" : "good",
        },
      ],
    },
    {
      id: "financial",
      title: "Financial Risk",
      description: "Market, liquidity, and credit-related risks",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      score: getFinancialRiskScore(),
      factors: [
        {
          label: "Concentration Risk",
          value: concentrationBadge.label,
          status: concentrationBadge.label === "Low Risk" || concentrationBadge.label === "Good" ? "good" :
                  concentrationBadge.label === "Moderate" ? "warning" : "critical",
        },
        {
          label: "Liquidity Risk",
          value: liquidityBadge.label,
          status: liquidityBadge.label === "Low Risk" || liquidityBadge.label === "Good" ? "good" :
                  liquidityBadge.label === "Moderate" ? "warning" : "critical",
        },
        {
          label: "Diversification",
          value: diversificationBadge.label,
          status: diversificationBadge.label === "Low Risk" || diversificationBadge.label === "Good" ? "good" :
                  diversificationBadge.label === "Moderate" ? "warning" : "critical",
        },
        {
          label: "Vault Size",
          value: formatCurrency(totalAssetsUsd),
          status: totalAssetsUsd > 10000000 ? "good" :
                  totalAssetsUsd > 1000000 ? "neutral" : "warning",
        },
      ],
    },
    {
      id: "compliance",
      title: "Compliance Risk",
      description: "Regulatory and jurisdictional considerations",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      score: "medium", // DeFi regulatory environment is uncertain
      factors: [
        {
          label: "Protocol Type",
          value: "Decentralized Lending",
          status: "neutral",
        },
        {
          label: "Asset Type",
          value: asset.symbol,
          status: ["USDC", "USDT", "DAI", "WETH", "WBTC"].includes(asset.symbol) ? "good" : "neutral",
        },
        {
          label: "Regulatory Status",
          value: "Non-custodial DeFi",
          status: "neutral",
        },
      ],
    },
    {
      id: "reputational",
      title: "Reputational Risk",
      description: "Brand, trust, and market perception factors",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      score: totalAssetsUsd > 50000000 ? "low" : totalAssetsUsd > 10000000 ? "low" : "medium",
      factors: [
        {
          label: "Vault Adoption",
          value: totalAssetsUsd > 50000000 ? "High TVL" :
                 totalAssetsUsd > 10000000 ? "Growing TVL" : "Emerging",
          status: totalAssetsUsd > 50000000 ? "good" :
                  totalAssetsUsd > 10000000 ? "neutral" : "warning",
        },
        {
          label: "Protocol",
          value: "Morpho (Established)",
          status: "good",
        },
        {
          label: "Track Record",
          value: "On-chain verifiable",
          status: "good",
        },
      ],
    },
  ];

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "good":
        return "bg-accent-green/15 text-accent-green";
      case "neutral":
        return "bg-text-muted/15 text-text-secondary";
      case "warning":
        return "bg-accent-yellow/15 text-accent-yellow";
      case "critical":
        return "bg-accent-red/15 text-accent-red";
      default:
        return "bg-text-muted/15 text-text-secondary";
    }
  };

  const getRiskScoreStyles = (score: "low" | "medium" | "high") => {
    switch (score) {
      case "low":
        return {
          bg: "bg-accent-green/15",
          border: "border-accent-green/30",
          text: "text-accent-green",
          label: "Low Risk",
        };
      case "medium":
        return {
          bg: "bg-accent-yellow/15",
          border: "border-accent-yellow/30",
          text: "text-accent-yellow",
          label: "Medium Risk",
        };
      case "high":
        return {
          bg: "bg-accent-red/15",
          border: "border-accent-red/30",
          text: "text-accent-red",
          label: "High Risk",
        };
    }
  };

  // Calculate overall risk score
  const overallRiskScore = (() => {
    const scores = riskCategories.map(c => c.score);
    const highCount = scores.filter(s => s === "high").length;
    const medCount = scores.filter(s => s === "medium").length;
    if (highCount >= 2) return "high";
    if (highCount >= 1 || medCount >= 3) return "medium";
    return "low";
  })();
  const overallStyles = getRiskScoreStyles(overallRiskScore);

  return (
    <div className="space-y-6">
      {/* Overall Risk Summary */}
      <div className={`rounded-lg border ${overallStyles.border} ${overallStyles.bg} p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${overallStyles.bg}`}>
              <svg className={`w-6 h-6 ${overallStyles.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Overall Risk Assessment</h2>
              <p className="text-sm text-text-tertiary">Based on 5 institutional risk categories</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-lg font-semibold ${overallStyles.bg} ${overallStyles.text} border ${overallStyles.border}`}>
            {overallStyles.label}
          </div>
        </div>
      </div>

      {/* 5 Risk Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riskCategories.map((category) => {
          const scoreStyles = getRiskScoreStyles(category.score);
          return (
            <div key={category.id} className="bg-background-subtle rounded-lg border border-border">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary">{category.icon}</span>
                    <h3 className="text-sm font-semibold text-text-primary">{category.title}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${scoreStyles.bg} ${scoreStyles.text} border ${scoreStyles.border}`}>
                    {scoreStyles.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{category.description}</p>
              </div>
              <div className="p-4 space-y-3">
                {category.factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-text-tertiary">{factor.label}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyles(factor.status)}`}>
                      {factor.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Financial Risk Metrics - Legacy cards preserved */}
      <div className="bg-background-subtle rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">Financial Risk Details</h3>
          <p className="text-sm text-text-tertiary">Detailed breakdown of allocation and liquidity metrics</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Concentration Risk */}
          <div className="bg-background-elevated rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Concentration
              </h4>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium border ${concentrationBadge.bgColor} ${concentrationBadge.borderColor} ${concentrationBadge.color}`}
              >
                {concentrationBadge.label}
              </span>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-text-tertiary">Top adapter</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {currentRisk.concentration.topAdapterPercent.toFixed(1)}%
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-tertiary">Top 3 adapters</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {currentRisk.concentration.top3AdaptersPercent.toFixed(1)}%
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-tertiary">Active adapters</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {currentRisk.concentration.numActiveAdapters}
                </span>
              </li>
            </ul>
          </div>

          {/* Liquidity Risk */}
          <div className="bg-background-elevated rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Liquidity
              </h4>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium border ${liquidityBadge.bgColor} ${liquidityBadge.borderColor} ${liquidityBadge.color}`}
              >
                {liquidityBadge.label}
              </span>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-text-tertiary">Idle assets</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {currentRisk.liquidity.idleAssetsPercent.toFixed(1)}%
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-tertiary">Idle value</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {formatCurrency(currentRisk.liquidity.idleAssetsUsd)}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-tertiary">Liquidity adapter</span>
                <span className={`font-medium ${currentRisk.liquidity.hasLiquidityAdapter ? "text-accent-green" : "text-text-muted"}`}>
                  {currentRisk.liquidity.hasLiquidityAdapter ? "Yes" : "No"}
                </span>
              </li>
            </ul>
          </div>

          {/* Diversification */}
          <div className="bg-background-elevated rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Diversification
              </h4>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium border ${diversificationBadge.bgColor} ${diversificationBadge.borderColor} ${diversificationBadge.color}`}
              >
                {diversificationBadge.label}
              </span>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-text-tertiary">Avg allocation</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {currentRisk.diversification.avgAllocationPercent.toFixed(1)}%
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-tertiary">Largest position</span>
                <span className="font-medium text-text-primary tabular-nums">
                  {currentRisk.diversification.largestAllocation.toFixed(1)}%
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Allocation Breakdown */}
      <div className="bg-background-subtle rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">
            Allocation Breakdown
          </h3>
          <p className="text-sm text-text-tertiary">
            Total: {formatCurrency(totalAssetsUsd)}
          </p>
        </div>

        {allocations.length === 0 ? (
          <div className="p-12 text-center text-sm text-text-tertiary">
            No allocation data available
          </div>
        ) : (
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
                {allocations.map((allocation, index) => (
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
                          asset.decimals,
                          asset.symbol
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
                {idleAssets.percent > 0 && (
                  <tr className="bg-background-elevated/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-muted italic">
                        Idle (Unallocated)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-text-tertiary tabular-nums">
                        {formatTokenAmount(
                          idleAssets.amount,
                          asset.decimals,
                          asset.symbol
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-text-tertiary tabular-nums">
                        {formatCurrency(idleAssets.amountUsd)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm text-text-tertiary tabular-nums">
                        {idleAssets.percent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

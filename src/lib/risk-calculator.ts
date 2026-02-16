/**
 * Risk calculation functions for Morpho vault analysis
 */

export interface AdapterAllocation {
  address: string;
  type: string;
  assets: string;
  assetsUsd: number;
  allocationPct: number;
}

export interface RiskMetrics {
  // Concentration metrics
  topAdapterPercent: number;
  top3AdaptersPercent: number;
  herfindahlIndex: number;
  numActiveAdapters: number;

  // Liquidity metrics
  idleAssetsPercent: number;
  hasLiquidityAdapter: boolean;

  // Diversification metrics
  avgAllocationPercent: number;
  largestAllocation: number;

  // Risk scores
  concentrationScore: "low" | "medium" | "high";
  liquidityScore: "low" | "medium" | "high";
  diversificationScore: "good" | "moderate" | "poor";
}

/**
 * Calculate concentration risk metrics
 * - Low: Top adapter < 50%
 * - Medium: Top adapter 50-70%
 * - High: Top adapter > 70%
 */
export function calculateConcentrationRisk(
  adapters: AdapterAllocation[]
): {
  topAdapterPercent: number;
  top3AdaptersPercent: number;
  herfindahlIndex: number;
  numActiveAdapters: number;
  score: "low" | "medium" | "high";
} {
  if (adapters.length === 0) {
    return {
      topAdapterPercent: 0,
      top3AdaptersPercent: 0,
      herfindahlIndex: 0,
      numActiveAdapters: 0,
      score: "low",
    };
  }

  // Sort by allocation percentage (descending)
  const sorted = [...adapters].sort(
    (a, b) => b.allocationPct - a.allocationPct
  );

  // Filter out adapters with very small allocations (<0.1%)
  const activeAdapters = sorted.filter((a) => a.allocationPct >= 0.1);
  const numActiveAdapters = activeAdapters.length;

  // Top adapter percentage
  const topAdapterPercent = sorted[0]?.allocationPct ?? 0;

  // Top 3 adapters percentage
  const top3AdaptersPercent = sorted
    .slice(0, 3)
    .reduce((sum, a) => sum + a.allocationPct, 0);

  // Herfindahl-Hirschman Index (HHI)
  // Sum of squared market shares (0-10000 scale)
  // Lower = more diversified, Higher = more concentrated
  const herfindahlIndex = adapters.reduce(
    (sum, a) => sum + Math.pow(a.allocationPct, 2),
    0
  );

  // Determine concentration score
  let score: "low" | "medium" | "high";
  if (topAdapterPercent >= 70) {
    score = "high";
  } else if (topAdapterPercent >= 50) {
    score = "medium";
  } else {
    score = "low";
  }

  return {
    topAdapterPercent,
    top3AdaptersPercent,
    herfindahlIndex,
    numActiveAdapters,
    score,
  };
}

/**
 * Calculate liquidity risk metrics
 * - Low: Idle > 10%
 * - Medium: Idle 5-10%
 * - High: Idle < 5%
 */
export function calculateLiquidityRisk(
  idleAssetsPercent: number,
  hasLiquidityAdapter: boolean
): {
  idleAssetsPercent: number;
  hasLiquidityAdapter: boolean;
  score: "low" | "medium" | "high";
} {
  let score: "low" | "medium" | "high";

  if (idleAssetsPercent >= 10) {
    score = "low";
  } else if (idleAssetsPercent >= 5) {
    score = "medium";
  } else {
    score = "high";
  }

  // Having a liquidity adapter reduces risk
  if (hasLiquidityAdapter && score === "high") {
    score = "medium";
  }

  return {
    idleAssetsPercent,
    hasLiquidityAdapter,
    score,
  };
}

/**
 * Calculate diversification metrics
 * - Good: 5+ adapters, no single allocation > 40%
 * - Moderate: 3-4 adapters, no single allocation > 60%
 * - Poor: < 3 adapters or single allocation > 60%
 */
export function calculateDiversification(
  adapters: AdapterAllocation[]
): {
  avgAllocationPercent: number;
  largestAllocation: number;
  score: "good" | "moderate" | "poor";
} {
  if (adapters.length === 0) {
    return {
      avgAllocationPercent: 0,
      largestAllocation: 0,
      score: "poor",
    };
  }

  // Filter active adapters
  const activeAdapters = adapters.filter((a) => a.allocationPct >= 0.1);
  const numAdapters = activeAdapters.length;

  // Average allocation
  const totalPct = activeAdapters.reduce(
    (sum, a) => sum + a.allocationPct,
    0
  );
  const avgAllocationPercent =
    numAdapters > 0 ? totalPct / numAdapters : 0;

  // Largest allocation
  const largestAllocation = Math.max(
    ...activeAdapters.map((a) => a.allocationPct),
    0
  );

  // Determine diversification score
  let score: "good" | "moderate" | "poor";

  if (largestAllocation > 60 || numAdapters < 3) {
    score = "poor";
  } else if (largestAllocation > 40 || numAdapters < 5) {
    score = "moderate";
  } else {
    score = "good";
  }

  return {
    avgAllocationPercent,
    largestAllocation,
    score,
  };
}

/**
 * Calculate all risk metrics for a vault
 */
export function calculateAllRiskMetrics(
  adapters: AdapterAllocation[],
  idleAssetsPercent: number,
  totalAssetsUsd: number
): RiskMetrics {
  // Check if vault has a liquidity adapter (type contains "Liquidity")
  const hasLiquidityAdapter = adapters.some(
    (a) =>
      a.type.toLowerCase().includes("liquidity") ||
      a.type.toLowerCase().includes("idle")
  );

  const concentration = calculateConcentrationRisk(adapters);
  const liquidity = calculateLiquidityRisk(
    idleAssetsPercent,
    hasLiquidityAdapter
  );
  const diversification = calculateDiversification(adapters);

  return {
    // Concentration
    topAdapterPercent: concentration.topAdapterPercent,
    top3AdaptersPercent: concentration.top3AdaptersPercent,
    herfindahlIndex: concentration.herfindahlIndex,
    numActiveAdapters: concentration.numActiveAdapters,

    // Liquidity
    idleAssetsPercent: liquidity.idleAssetsPercent,
    hasLiquidityAdapter: liquidity.hasLiquidityAdapter,

    // Diversification
    avgAllocationPercent: diversification.avgAllocationPercent,
    largestAllocation: diversification.largestAllocation,

    // Scores
    concentrationScore: concentration.score,
    liquidityScore: liquidity.score,
    diversificationScore: diversification.score,
  };
}

/**
 * Get risk level color
 */
export function getRiskColor(
  score: "low" | "medium" | "high" | "good" | "moderate" | "poor"
): string {
  switch (score) {
    case "low":
    case "good":
      return "#10b981"; // green
    case "medium":
    case "moderate":
      return "#f59e0b"; // yellow
    case "high":
    case "poor":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}

/**
 * Get risk level label
 */
export function getRiskLabel(
  score: "low" | "medium" | "high" | "good" | "moderate" | "poor"
): string {
  switch (score) {
    case "low":
      return "Low Risk";
    case "good":
      return "Good";
    case "medium":
    case "moderate":
      return "Moderate";
    case "high":
      return "High Risk";
    case "poor":
      return "Poor";
    default:
      return "Unknown";
  }
}

/**
 * Institutional Risk Assessment Framework
 *
 * Based on actual DeFi vault failure modes:
 * - Rari Fuse (2022): Smart contract + Oracle manipulation
 * - Cream Finance (2021): Oracle manipulation on low-liquidity collateral
 * - Inverse Finance (2022): Oracle manipulation + High LLTV
 * - Celsius/BlockFi (2022): Counterparty risk + Opaque operations
 * - Terra/Anchor (2022): Unsustainable yield + Asset backing
 *
 * 5 Risk Categories:
 * 1. Smart Contract Risk - Security & Code Quality
 * 2. Oracle Risk - Price Feed Reliability
 * 3. Collateral Risk - Asset Quality & Concentration
 * 4. LLTV Risk - Loan-to-Value Exposure
 * 5. Operational Risk - Curator Quality & Transparency
 */

export type RiskLevel = "Low Risk" | "Moderate Risk" | "High Risk";

export interface RiskCategory {
  level: RiskLevel;
  score: number; // 0-100
  factors: string[]; // What contributed to this score
  recommendations?: string[]; // What would improve the score
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  overallScore: number; // 0-100
  categories: {
    smartContract: RiskCategory;
    oracle: RiskCategory;
    collateral: RiskCategory;
    lltv: RiskCategory;
    operational: RiskCategory;
  };
  lastUpdated: Date;
}

// Blue-chip assets (highest quality)
const BLUE_CHIP_ASSETS = [
  "WETH", "ETH", "wstETH", "stETH", "rETH", "cbETH",
  "WBTC", "cbBTC", "tBTC",
  "USDC", "USDT", "DAI", "PYUSD", "FRAX", "LUSD", "GHO", "EURC", "USDS"
];

// Established assets (good quality)
const ESTABLISHED_ASSETS = [
  "LINK", "UNI", "AAVE", "MKR", "CRV", "LDO", "RPL",
  "SNX", "COMP", "BAL", "1INCH", "ENS"
];

// Institutional curators with proven track records
const INSTITUTIONAL_CURATORS = [
  "Gauntlet", "Steakhouse", "Steakhouse Financial",
  "Block Analitica", "Re7 Labs", "Re7", "Morpho", "Morpho Labs",
  "Yearn", "Yearn Finance", "Idle Finance", "Idle",
  "Spark", "Spark Protocol", "Sky", "Sky (Maker)",
  "MEV Capital", "Keyrock", "B.Protocol"
];

// Stablecoins for LLTV assessment
const STABLECOINS = ["USDC", "USDT", "DAI", "PYUSD", "FRAX", "LUSD", "GHO", "EURC", "sUSDe", "USDe", "USDS"];

// Risk category weights for overall score
const RISK_WEIGHTS = {
  smartContract: 0.25, // 25% - Critical foundation
  oracle: 0.20,        // 20% - Historical failure mode
  collateral: 0.20,    // 20% - Asset quality matters
  lltv: 0.15,          // 15% - Leverage risk
  operational: 0.20,   // 20% - Curator quality
};

/**
 * Input data structure for risk assessment
 */
export interface VaultRiskData {
  // Basic vault info
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  totalAssetsUsd: number;
  createdAt: Date;

  // Adapter/Market data
  adapters: Array<{
    type: string;
    allocationPct: number;
  }>;

  // Market allocations with collateral info
  marketAllocations: Array<{
    collateralAssetSymbol: string;
    lltv: number; // 0-100 or 0-1 (we'll normalize)
    allocationPct: number;
    oracleType?: string;
  }>;

  // Risk snapshot data
  topAdapterPercent: number;
  idleAssetsPercent: number;
  numActiveAdapters: number;

  // Curator data
  curator: {
    name: string | null;
    address: string;
    legalName?: string | null;
    entityType?: string | null;
    jurisdiction?: string | null;
    isRegulated?: boolean;
    totalAssetsManaged: number;
    vaultCount: number;
    oldestVaultDate?: Date;
  } | null;
}

/**
 * Main function to assess vault risk
 */
export function assessVaultRisk(data: VaultRiskData): RiskAssessment {
  const smartContract = assessSmartContractRisk(data);
  const oracle = assessOracleRisk(data);
  const collateral = assessCollateralRisk(data);
  const lltv = assessLLTVRisk(data);
  const operational = assessOperationalRisk(data);

  // Calculate weighted overall score
  const overallScore = Math.round(
    smartContract.score * RISK_WEIGHTS.smartContract +
    oracle.score * RISK_WEIGHTS.oracle +
    collateral.score * RISK_WEIGHTS.collateral +
    lltv.score * RISK_WEIGHTS.lltv +
    operational.score * RISK_WEIGHTS.operational
  );

  // Map score to risk level
  const overallRisk: RiskLevel =
    overallScore >= 70 ? "Low Risk" :
    overallScore >= 40 ? "Moderate Risk" :
    "High Risk";

  return {
    overallRisk,
    overallScore,
    categories: {
      smartContract,
      oracle,
      collateral,
      lltv,
      operational,
    },
    lastUpdated: new Date(),
  };
}

/**
 * Smart Contract Risk Assessment
 *
 * Factors:
 * - Built on Morpho V2 (audited protocol)
 * - Deployment age (battle-tested)
 * - Number of adapters (complexity)
 */
function assessSmartContractRisk(data: VaultRiskData): RiskCategory {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 50; // Start at moderate

  // Morpho V2 base - all vaults benefit from audited protocol
  score += 20;
  factors.push("Built on Morpho V2 (audited by Spearbit, Cantina)");

  // Check deployment age
  const deploymentAge = Date.now() - data.createdAt.getTime();
  const monthsLive = deploymentAge / (30 * 24 * 60 * 60 * 1000);

  if (monthsLive >= 12) {
    score += 15;
    factors.push(`Battle-tested: ${Math.floor(monthsLive)} months in production`);
  } else if (monthsLive >= 6) {
    score += 10;
    factors.push(`Established: ${Math.floor(monthsLive)} months live`);
  } else if (monthsLive >= 3) {
    score += 5;
    factors.push("Moderate history (3-6 months)");
  } else {
    score -= 10;
    factors.push("Recent deployment (<3 months)");
    recommendations.push("Monitor closely - newer vaults have less track record");
  }

  // Adapter complexity (more adapters = more attack surface, but also more diversification)
  const numAdapters = data.numActiveAdapters;
  if (numAdapters === 1) {
    // Single adapter is actually fine for Morpho vaults - simpler = fewer risks
    score += 5;
    factors.push("Simple architecture (1 adapter)");
  } else if (numAdapters <= 3) {
    score += 5;
    factors.push(`Manageable complexity (${numAdapters} adapters)`);
  } else {
    // Many adapters increases surface area
    factors.push(`${numAdapters} active adapters`);
  }

  // TVL as proxy for battle-testing
  if (data.totalAssetsUsd > 100_000_000) {
    score += 10;
    factors.push("High TVL ($100M+) indicates market confidence");
  } else if (data.totalAssetsUsd > 10_000_000) {
    score += 5;
    factors.push("Substantial TVL ($10M+)");
  }

  const level = scoreToLevel(score);
  return { level, score: clampScore(score), factors, recommendations };
}

/**
 * Oracle Risk Assessment
 *
 * Based on failures like Cream Finance and Inverse Finance
 *
 * Factors:
 * - Asset liquidity (manipulation risk)
 * - Collateral types (exotic = higher oracle risk)
 * - Oracle diversity
 */
function assessOracleRisk(data: VaultRiskData): RiskCategory {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 50;

  // Check primary asset
  const asset = data.assetSymbol.toUpperCase();

  if (BLUE_CHIP_ASSETS.includes(asset)) {
    score += 20;
    factors.push(`${asset}: Blue-chip asset with reliable price feeds`);
  } else if (ESTABLISHED_ASSETS.includes(asset)) {
    score += 10;
    factors.push(`${asset}: Established asset with good liquidity`);
  } else {
    score -= 10;
    factors.push(`${asset}: Non-standard asset - verify oracle reliability`);
    recommendations.push("Verify oracle source and update frequency");
  }

  // Check collateral asset diversity and quality
  const collateralAssets = [...new Set(data.marketAllocations.map(m => m.collateralAssetSymbol.toUpperCase()))];

  let hasExoticCollateral = false;
  let hasBlueChipCollateral = false;

  for (const collateral of collateralAssets) {
    if (BLUE_CHIP_ASSETS.includes(collateral)) {
      hasBlueChipCollateral = true;
    } else if (!ESTABLISHED_ASSETS.includes(collateral)) {
      hasExoticCollateral = true;
    }
  }

  if (hasBlueChipCollateral && !hasExoticCollateral) {
    score += 15;
    factors.push("All collateral is blue-chip with reliable oracles");
  } else if (hasBlueChipCollateral) {
    score += 5;
    factors.push("Mix of collateral quality");
    if (hasExoticCollateral) {
      factors.push("Some exotic collateral increases oracle risk");
      recommendations.push("Monitor positions with exotic collateral closely");
    }
  } else if (hasExoticCollateral) {
    score -= 15;
    factors.push("Exotic collateral - higher oracle manipulation risk");
    recommendations.push("Verify oracle sources are manipulation-resistant");
  }

  // TVL as proxy for oracle importance
  if (data.totalAssetsUsd > 50_000_000) {
    // High-TVL vaults are targets but also well-monitored
    factors.push("High TVL vault - well-monitored but higher target value");
  }

  // Multiple oracle types is good
  const oracleTypes = [...new Set(data.marketAllocations.map(m => m.oracleType).filter(Boolean))];
  if (oracleTypes.length > 1) {
    score += 5;
    factors.push("Multiple oracle sources provide redundancy");
  }

  const level = scoreToLevel(score);
  return { level, score: clampScore(score), factors, recommendations };
}

/**
 * Collateral Risk Assessment
 *
 * Factors:
 * - Asset quality (blue-chip vs exotic)
 * - Concentration (single collateral vs diversified)
 * - Market cap/liquidity proxy
 */
function assessCollateralRisk(data: VaultRiskData): RiskCategory {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 50;

  // Primary asset quality
  const asset = data.assetSymbol.toUpperCase();
  if (BLUE_CHIP_ASSETS.includes(asset)) {
    score += 15;
    factors.push(`Lending ${asset} (blue-chip asset)`);
  } else if (ESTABLISHED_ASSETS.includes(asset)) {
    score += 8;
    factors.push(`Lending ${asset} (established asset)`);
  } else {
    score -= 10;
    factors.push(`Lending ${asset} (non-standard asset)`);
    recommendations.push("Non-standard assets may have liquidity risks");
  }

  // Collateral analysis
  if (data.marketAllocations.length === 0) {
    factors.push("No active market allocations");
    return { level: "Moderate Risk", score: 50, factors };
  }

  const collateralTypes = [...new Set(data.marketAllocations.map(m => m.collateralAssetSymbol.toUpperCase()))];

  // Count quality levels
  let blueChipCount = 0;
  let exoticCount = 0;

  for (const c of collateralTypes) {
    if (BLUE_CHIP_ASSETS.includes(c)) blueChipCount++;
    else if (!ESTABLISHED_ASSETS.includes(c)) exoticCount++;
  }

  // Diversification score
  if (collateralTypes.length >= 4) {
    score += 15;
    factors.push(`Well-diversified: ${collateralTypes.length} collateral types`);
  } else if (collateralTypes.length >= 2) {
    score += 8;
    factors.push(`${collateralTypes.length} collateral types`);
  } else {
    factors.push("Single collateral type");
    recommendations.push("Single collateral concentration - monitor closely");
  }

  // Quality assessment
  if (blueChipCount === collateralTypes.length) {
    score += 15;
    factors.push("100% blue-chip collateral");
  } else if (exoticCount === 0) {
    score += 8;
    factors.push("All established collateral assets");
  } else {
    score -= 5 * exoticCount;
    factors.push(`${exoticCount} exotic collateral type(s)`);
  }

  // Top collateral concentration
  const sortedAllocations = [...data.marketAllocations].sort((a, b) => b.allocationPct - a.allocationPct);
  if (sortedAllocations.length > 0) {
    const topAllocation = sortedAllocations[0];
    if (topAllocation.allocationPct > 80) {
      score -= 10;
      factors.push(`High concentration: ${topAllocation.allocationPct.toFixed(0)}% in ${topAllocation.collateralAssetSymbol}`);
    } else if (topAllocation.allocationPct > 60) {
      factors.push(`Top collateral: ${topAllocation.allocationPct.toFixed(0)}% in ${topAllocation.collateralAssetSymbol}`);
    }
  }

  const level = scoreToLevel(score);
  return { level, score: clampScore(score), factors, recommendations };
}

/**
 * LLTV Risk Assessment
 *
 * Based on Inverse Finance failure (high LLTV + oracle manipulation)
 *
 * Factors:
 * - Weighted average LLTV
 * - Stablecoin vs volatile asset thresholds
 * - Positions near liquidation
 */
function assessLLTVRisk(data: VaultRiskData): RiskCategory {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 50;

  if (data.marketAllocations.length === 0) {
    factors.push("No active lending positions");
    return { level: "Moderate Risk", score: 50, factors };
  }

  // Calculate weighted average LLTV
  let totalWeight = 0;
  let weightedLLTV = 0;
  let maxLLTV = 0;

  for (const market of data.marketAllocations) {
    // Normalize LLTV (handle both 0-1 and 0-100 formats)
    let lltv = market.lltv;
    if (lltv <= 1) lltv = lltv * 100; // Convert from decimal to percentage

    const weight = market.allocationPct / 100;
    weightedLLTV += lltv * weight;
    totalWeight += weight;
    maxLLTV = Math.max(maxLLTV, lltv);
  }

  const avgLLTV = totalWeight > 0 ? weightedLLTV / totalWeight : 0;
  const isStablecoin = STABLECOINS.includes(data.assetSymbol.toUpperCase());

  // Assess based on asset type
  if (isStablecoin) {
    // Stablecoins can handle higher LLTV
    if (avgLLTV < 75) {
      score += 20;
      factors.push(`Conservative LLTV for stablecoin: ${avgLLTV.toFixed(0)}% avg`);
    } else if (avgLLTV < 86) {
      score += 10;
      factors.push(`Standard LLTV for stablecoin: ${avgLLTV.toFixed(0)}% avg`);
    } else if (avgLLTV < 92) {
      score -= 5;
      factors.push(`Elevated LLTV: ${avgLLTV.toFixed(0)}% avg`);
      recommendations.push("Higher LLTVs increase liquidation risk during volatility");
    } else {
      score -= 15;
      factors.push(`Aggressive LLTV: ${avgLLTV.toFixed(0)}% avg`);
      recommendations.push("Very high LLTV - significant liquidation cascade risk");
    }
  } else {
    // Volatile assets need lower LLTV
    if (avgLLTV < 70) {
      score += 20;
      factors.push(`Conservative LLTV: ${avgLLTV.toFixed(0)}% avg`);
    } else if (avgLLTV < 80) {
      score += 10;
      factors.push(`Standard LLTV: ${avgLLTV.toFixed(0)}% avg`);
    } else if (avgLLTV < 86) {
      score -= 5;
      factors.push(`Elevated LLTV for volatile asset: ${avgLLTV.toFixed(0)}% avg`);
      recommendations.push("Higher LLTVs on volatile assets increase liquidation risk");
    } else {
      score -= 15;
      factors.push(`Aggressive LLTV for volatile asset: ${avgLLTV.toFixed(0)}% avg`);
      recommendations.push("Very high LLTV on volatile asset - extreme risk");
    }
  }

  // Check max LLTV across markets
  if (maxLLTV > 94) {
    score -= 10;
    factors.push(`Highest market LLTV: ${maxLLTV.toFixed(0)}%`);
  }

  // Idle assets provide buffer
  if (data.idleAssetsPercent > 10) {
    score += 5;
    factors.push(`${data.idleAssetsPercent.toFixed(0)}% idle provides liquidity buffer`);
  }

  const level = scoreToLevel(score);
  return { level, score: clampScore(score), factors, recommendations };
}

/**
 * Operational Risk Assessment
 *
 * Based on Celsius/BlockFi failures (opaque operations, unknown risks)
 *
 * Factors:
 * - Curator reputation
 * - Legal entity status
 * - Track record (AUM, time operating)
 * - Transparency
 */
function assessOperationalRisk(data: VaultRiskData): RiskCategory {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 50;

  const curator = data.curator;

  if (!curator) {
    factors.push("No curator information available");
    recommendations.push("Unknown curator - conduct independent due diligence");
    return { level: "High Risk", score: 30, factors, recommendations };
  }

  // Check if institutional curator
  const curatorName = curator.name || "";
  const isInstitutional = INSTITUTIONAL_CURATORS.some(ic =>
    curatorName.toLowerCase().includes(ic.toLowerCase())
  );

  if (isInstitutional) {
    score += 25;
    factors.push(`Institutional curator: ${curatorName}`);
  } else if (curator.legalName) {
    score += 15;
    factors.push(`Registered entity: ${curator.legalName}`);
  } else if (curatorName) {
    score += 5;
    factors.push(`Curator: ${curatorName}`);
    recommendations.push("Verify curator identity and track record");
  } else {
    score -= 15;
    factors.push("Anonymous or unknown curator");
    recommendations.push("Anonymous curators carry higher counterparty risk");
  }

  // Check regulation status
  if (curator.isRegulated) {
    score += 10;
    factors.push("Regulated entity");
  }

  // Check jurisdiction
  if (curator.jurisdiction) {
    const goodJurisdictions = ["United States", "Switzerland", "Singapore", "United Kingdom", "Germany", "France"];
    if (goodJurisdictions.some(j => curator.jurisdiction!.includes(j))) {
      score += 5;
      factors.push(`Jurisdiction: ${curator.jurisdiction}`);
    }
  }

  // AUM as track record proxy
  const totalAUM = curator.totalAssetsManaged || 0;
  if (totalAUM > 100_000_000) {
    score += 15;
    factors.push(`$${(totalAUM / 1_000_000).toFixed(0)}M AUM - proven track record`);
  } else if (totalAUM > 50_000_000) {
    score += 10;
    factors.push(`$${(totalAUM / 1_000_000).toFixed(0)}M AUM`);
  } else if (totalAUM > 10_000_000) {
    score += 5;
    factors.push(`$${(totalAUM / 1_000_000).toFixed(0)}M AUM`);
  } else if (totalAUM > 0) {
    factors.push(`$${(totalAUM / 1_000_000).toFixed(1)}M AUM - emerging curator`);
  }

  // Vault count indicates experience
  if (curator.vaultCount >= 5) {
    score += 5;
    factors.push(`Managing ${curator.vaultCount} vaults`);
  }

  // Time operating
  if (curator.oldestVaultDate) {
    const monthsOperating = (Date.now() - curator.oldestVaultDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (monthsOperating >= 12) {
      score += 10;
      factors.push(`${Math.floor(monthsOperating)} months operating history`);
    } else if (monthsOperating >= 6) {
      score += 5;
      factors.push("6-12 months operating");
    } else {
      factors.push("New curator (<6 months)");
      recommendations.push("Limited track record - monitor performance");
    }
  }

  const level = scoreToLevel(score);
  return { level, score: clampScore(score), factors, recommendations };
}

// Helper functions
function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return "Low Risk";
  if (score >= 40) return "Moderate Risk";
  return "High Risk";
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

/**
 * Get risk level color classes for UI
 */
export function getRiskLevelColors(level: RiskLevel): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  switch (level) {
    case "Low Risk":
      return {
        bg: "bg-accent-green/10",
        border: "border-accent-green/30",
        text: "text-accent-green",
        badge: "bg-accent-green/15 text-accent-green border-accent-green/30",
      };
    case "Moderate Risk":
      return {
        bg: "bg-accent-yellow/10",
        border: "border-accent-yellow/30",
        text: "text-accent-yellow",
        badge: "bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30",
      };
    case "High Risk":
      return {
        bg: "bg-accent-red/10",
        border: "border-accent-red/30",
        text: "text-accent-red",
        badge: "bg-accent-red/15 text-accent-red border-accent-red/30",
      };
  }
}

/**
 * Get category icon name for UI
 */
export function getCategoryIcon(category: keyof RiskAssessment["categories"]): string {
  const icons: Record<string, string> = {
    smartContract: "Shield",
    oracle: "Activity",
    collateral: "Coins",
    lltv: "TrendingUp",
    operational: "Users",
  };
  return icons[category] || "AlertCircle";
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: keyof RiskAssessment["categories"]): string {
  const names: Record<string, string> = {
    smartContract: "Smart Contract Risk",
    oracle: "Oracle Risk",
    collateral: "Collateral Risk",
    lltv: "LLTV Risk",
    operational: "Operational Risk",
  };
  return names[category] || category;
}

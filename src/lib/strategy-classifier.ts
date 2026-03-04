/**
 * Strategy Classifier - Maps curator behavior to institutional fund manager archetypes
 *
 * Philosophy: Analyze HOW curators operate, not just risk metrics
 * Think like an institutional allocator evaluating fund managers
 */

import { prisma } from "@/lib/db";

// ============================================================================
// TYPES
// ============================================================================

export type StrategyArchetype =
  | "Quantitative Yield Optimizer"
  | "Fixed Income Specialist"
  | "Market Maker / Liquidity Provider"
  | "Multi-Strategy / Opportunistic"
  | "Passive Index / Set-and-Forget"
  | "Venture / High-Risk"
  | "Balanced / Undefined";

export type ManagementStyle = "passive" | "active" | "hyper-active";

export interface StrategyMetrics {
  reallocationFrequency: number;  // per month
  idleCashPercent: number;
  adapterDiversification: number; // # of adapters
  topAdapterConcentration: number; // % in largest
  avgLLTV: number;
  collateralTypes: string[];
  vaultCount: number;
  avgVaultSize: number;
  managementStyle: ManagementStyle;
  vaultAgeMonths: number;
}

export interface StrategyClassification {
  archetype: StrategyArchetype;
  tradFiAnalog: string;
  description: string;
  edge: string[];
  managementStyle: string;
  strengths: string[];
  risks: string[];
  confidence: "high" | "medium" | "low";
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BLUE_CHIP_COLLATERAL = [
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "crvUSD", "GHO", "PYUSD", "USDS", "sUSDe", "USDe",
  "WETH", "ETH", "wstETH", "stETH", "rETH", "cbETH", "weETH", "ezETH", "rsETH",
  "WBTC", "cbBTC", "tBTC", "sBTC"
];

const STABLECOINS = [
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "crvUSD", "GHO", "PYUSD", "USDS", "sUSDe", "USDe"
];

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

export async function classifyVaultStrategy(
  vaultAddress: string
): Promise<StrategyClassification> {
  const metrics = await calculateVaultMetrics(vaultAddress);
  return classifyFromMetrics(metrics);
}

export async function classifyCuratorStrategy(
  curatorAddress: string
): Promise<StrategyClassification> {
  const metrics = await calculateCuratorMetrics(curatorAddress);
  return classifyFromMetrics(metrics);
}

export function classifyFromMetrics(metrics: StrategyMetrics): StrategyClassification {
  // Decision tree based on observable behavior

  // QUANT OPTIMIZER: High activity, low idle, diversified
  if (
    metrics.reallocationFrequency > 10 &&
    metrics.idleCashPercent < 5 &&
    metrics.adapterDiversification >= 5 &&
    metrics.topAdapterConcentration < 50
  ) {
    return createQuantOptimizer(metrics);
  }

  // FIXED INCOME SPECIALIST: Low activity, high buffer, conservative
  if (
    metrics.reallocationFrequency < 5 &&
    metrics.idleCashPercent > 10 &&
    metrics.avgLLTV < 75 &&
    isBlueChipOnly(metrics.collateralTypes)
  ) {
    return createFixedIncomeSpecialist(metrics);
  }

  // MARKET MAKER: Very high activity, concentrated, minimal idle
  if (
    metrics.reallocationFrequency > 20 &&
    metrics.topAdapterConcentration > 60 &&
    metrics.idleCashPercent < 3
  ) {
    return createMarketMaker(metrics);
  }

  // MULTI-STRATEGY: Multiple vaults, moderate activity, diverse approaches
  if (
    metrics.vaultCount >= 3 &&
    metrics.reallocationFrequency > 5 &&
    metrics.reallocationFrequency < 15 &&
    metrics.adapterDiversification >= 3
  ) {
    return createMultiStrategy(metrics);
  }

  // PASSIVE INDEX: Minimal activity, stable allocation
  if (
    metrics.reallocationFrequency < 3 &&
    metrics.managementStyle === "passive" &&
    metrics.adapterDiversification >= 2
  ) {
    return createPassiveIndex(metrics);
  }

  // VENTURE / HIGH-RISK: Concentrated, high LLTV, exotic collateral
  if (
    metrics.topAdapterConcentration > 70 &&
    metrics.avgLLTV > 85 &&
    hasExoticCollateral(metrics.collateralTypes)
  ) {
    return createVentureHighRisk(metrics);
  }

  // DEFAULT: BALANCED
  return createBalanced(metrics);
}

// ============================================================================
// ARCHETYPE CREATORS
// ============================================================================

function createQuantOptimizer(metrics: StrategyMetrics): StrategyClassification {
  return {
    archetype: "Quantitative Yield Optimizer",
    tradFiAnalog: "Quant hedge fund (e.g., Two Sigma, Renaissance)",
    description: "Algorithm-driven strategy with frequent rebalancing to optimize risk-adjusted returns. Uses data and models to make allocation decisions.",

    edge: [
      "Proprietary risk models and simulations",
      "Real-time market monitoring",
      "Automated execution infrastructure",
      "Data-driven decision making"
    ],

    managementStyle: "Hyper-active",

    strengths: [
      "Data-driven, systematic approach",
      "Quick adaptation to market changes",
      "Diversified risk exposure",
      "Optimized capital efficiency"
    ],

    risks: [
      "Model risk - assumptions may break in edge cases",
      "Execution risk from frequent transactions",
      "Higher operational complexity",
      "Gas costs from frequent rebalancing"
    ],

    confidence: metrics.reallocationFrequency > 15 ? "high" : "medium"
  };
}

function createFixedIncomeSpecialist(metrics: StrategyMetrics): StrategyClassification {
  return {
    archetype: "Fixed Income Specialist",
    tradFiAnalog: "Bond fund manager (e.g., PIMCO, BlackRock Fixed Income)",
    description: "Conservative strategy focused on capital preservation and stable yields. Prioritizes safety over maximizing returns.",

    edge: [
      "Deep credit and collateral analysis",
      "Regulatory and compliance expertise",
      "Institutional relationships",
      "Conservative risk management"
    ],

    managementStyle: "Passive",

    strengths: [
      "Capital preservation priority",
      "Predictable, stable returns",
      "Lower operational risk",
      "High liquidity buffer for withdrawals"
    ],

    risks: [
      "Lower yield potential vs aggressive strategies",
      "Opportunity cost in bull markets",
      "Concentration in 'safe' assets",
      "May underperform in yield farming meta"
    ],

    confidence: metrics.idleCashPercent > 15 ? "high" : "medium"
  };
}

function createMarketMaker(metrics: StrategyMetrics): StrategyClassification {
  return {
    archetype: "Market Maker / Liquidity Provider",
    tradFiAnalog: "Trading firm (e.g., Jane Street, Citadel Securities)",
    description: "High-frequency strategy capturing spread and arbitrage opportunities. Maximizes capital efficiency through active position management.",

    edge: [
      "Superior execution infrastructure",
      "Off-chain hedging capabilities",
      "Proprietary flow and market intelligence",
      "Advanced MEV protection"
    ],

    managementStyle: "Hyper-active",

    strengths: [
      "Maximizes capital efficiency",
      "Quick to capture opportunities",
      "Professional execution infrastructure",
      "Deep market expertise"
    ],

    risks: [
      "High operational complexity",
      "Smart contract interaction risk",
      "Concentration risk in positions",
      "Requires continuous monitoring"
    ],

    confidence: metrics.reallocationFrequency > 25 ? "high" : "medium"
  };
}

function createMultiStrategy(metrics: StrategyMetrics): StrategyClassification {
  return {
    archetype: "Multi-Strategy / Opportunistic",
    tradFiAnalog: "Multi-strategy hedge fund (e.g., Millennium, Bridgewater)",
    description: "Flexible approach adapting to market conditions with multiple sub-strategies. Balances risk across different approaches.",

    edge: [
      "Strategy diversification",
      "Tactical flexibility across market regimes",
      "Risk management across approaches",
      "Ability to shift capital to best opportunities"
    ],

    managementStyle: "Active",

    strengths: [
      "Diversified risk sources",
      "Adapts to different market regimes",
      "Balanced risk/return profile",
      "Multiple alpha sources"
    ],

    risks: [
      "Strategy drift risk",
      "Complexity in risk attribution",
      "Manager skill dependency",
      "Potential for conflicting strategies"
    ],

    confidence: metrics.vaultCount >= 5 ? "high" : "medium"
  };
}

function createPassiveIndex(metrics: StrategyMetrics): StrategyClassification {
  return {
    archetype: "Passive Index / Set-and-Forget",
    tradFiAnalog: "Index fund (e.g., Vanguard, State Street)",
    description: "Low-touch strategy focused on long-term compounding with minimal intervention. Simple, transparent, and cost-effective.",

    edge: [
      "Low fees and gas costs",
      "Simplicity and transparency",
      "Predictable behavior",
      "Long-term compounding"
    ],

    managementStyle: "Passive",

    strengths: [
      "Low operational risk",
      "Predictable, auditable behavior",
      "Lower gas costs",
      "Simple governance"
    ],

    risks: [
      "Slow to adapt to emerging risks",
      "Potential underperformance vs active",
      "Protocol dependency",
      "May miss yield opportunities"
    ],

    confidence: metrics.reallocationFrequency < 2 ? "high" : "medium"
  };
}

function createVentureHighRisk(metrics: StrategyMetrics): StrategyClassification {
  return {
    archetype: "Venture / High-Risk",
    tradFiAnalog: "Venture capital (e.g., a16z crypto, Paradigm)",
    description: "Aggressive strategy targeting early-stage protocols with high risk/reward. Accepts higher volatility for potential outsized returns.",

    edge: [
      "Early access to new protocols",
      "Technical due diligence expertise",
      "Hands-on protocol support",
      "Risk tolerance for emerging opportunities"
    ],

    managementStyle: "Active",

    strengths: [
      "High upside potential",
      "First-mover advantage",
      "Protocol alignment incentives",
      "Access to emerging yield sources"
    ],

    risks: [
      "Smart contract risk (less audited code)",
      "High concentration risk",
      "Potential for significant drawdowns",
      "Liquidity risk in exotic assets"
    ],

    confidence: metrics.avgLLTV > 90 ? "high" : "medium"
  };
}

function createBalanced(metrics: StrategyMetrics): StrategyClassification {
  const style = metrics.reallocationFrequency > 5 ? "Active" : "Moderate";

  return {
    archetype: "Balanced / Undefined",
    tradFiAnalog: "Traditional asset manager",
    description: "Balanced approach without strong specialization. May be evolving strategy or intentionally diversified across approaches.",

    edge: [
      "Balanced risk/return approach",
      "Flexibility in strategy",
      "Moderate activity level",
      "Adaptable to conditions"
    ],

    managementStyle: style,

    strengths: [
      "Balanced approach",
      "Not over-optimized for one scenario",
      "Moderate complexity",
      "Reasonable diversification"
    ],

    risks: [
      "May underperform specialists",
      "Less defined edge",
      "Strategy may be unclear",
      "Jack of all trades risk"
    ],

    confidence: "low"
  };
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

async function calculateVaultMetrics(vaultAddress: string): Promise<StrategyMetrics> {
  const vault = await prisma.vault.findFirst({
    where: { address: { equals: vaultAddress, mode: "insensitive" } },
    include: {
      adapterAllocations: {
        orderBy: { snapshotTime: "desc" },
        take: 100,
      },
      marketAllocations: {
        orderBy: { snapshotTime: "desc" },
        take: 50,
      },
      riskSnapshots: {
        orderBy: { timestamp: "desc" },
        take: 30,
      },
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
      curator: {
        include: {
          vaults: true,
        },
      },
    },
  });

  if (!vault) {
    return getDefaultMetrics();
  }

  // Get latest allocations
  const latestAllocations = vault.adapterAllocations.length > 0
    ? vault.adapterAllocations.filter(
        (a) => a.snapshotTime.getTime() === vault.adapterAllocations[0].snapshotTime.getTime()
      )
    : [];

  // Get latest market allocations for collateral types
  const latestMarketAllocations = vault.marketAllocations.length > 0
    ? vault.marketAllocations.filter(
        (m) => m.snapshotTime.getTime() === vault.marketAllocations[0].snapshotTime.getTime()
      )
    : [];

  // Calculate reallocation frequency (changes per month)
  const reallocationFrequency = calculateReallocationFrequency(vault.adapterAllocations);

  // Calculate idle cash percent
  const latestRisk = vault.riskSnapshots[0];
  const idleCashPercent = latestRisk?.idleAssetsPercent ?? 0;

  // Adapter diversification
  const adapterDiversification = latestAllocations.length;

  // Top adapter concentration
  const topAdapterConcentration = latestAllocations.length > 0
    ? Math.max(...latestAllocations.map((a) => a.allocationPct))
    : 100;

  // Average LLTV from market allocations
  const avgLLTV = latestMarketAllocations.length > 0
    ? latestMarketAllocations.reduce((sum, m) => sum + m.lltv * m.allocationPct, 0) /
      latestMarketAllocations.reduce((sum, m) => sum + m.allocationPct, 0)
    : 80;

  // Collateral types
  const collateralTypes = [...new Set(latestMarketAllocations.map((m) => m.collateralAssetSymbol))];

  // Vault count for curator
  const vaultCount = vault.curator?.vaults.length ?? 1;

  // Average vault size
  const avgVaultSize = vault.snapshots[0]?.totalAssetsUsd ?? 0;

  // Vault age in months
  const vaultAgeMonths = Math.max(
    1,
    (Date.now() - vault.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  // Determine management style
  let managementStyle: ManagementStyle = "active";
  if (reallocationFrequency < 3) {
    managementStyle = "passive";
  } else if (reallocationFrequency > 15) {
    managementStyle = "hyper-active";
  }

  return {
    reallocationFrequency,
    idleCashPercent,
    adapterDiversification,
    topAdapterConcentration,
    avgLLTV,
    collateralTypes,
    vaultCount,
    avgVaultSize,
    managementStyle,
    vaultAgeMonths,
  };
}

async function calculateCuratorMetrics(curatorAddress: string): Promise<StrategyMetrics> {
  const curator = await prisma.curator.findFirst({
    where: { address: { equals: curatorAddress, mode: "insensitive" } },
    include: {
      vaults: {
        include: {
          adapterAllocations: {
            orderBy: { snapshotTime: "desc" },
            take: 50,
          },
          marketAllocations: {
            orderBy: { snapshotTime: "desc" },
            take: 30,
          },
          riskSnapshots: {
            orderBy: { timestamp: "desc" },
            take: 10,
          },
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!curator || curator.vaults.length === 0) {
    return getDefaultMetrics();
  }

  // Aggregate metrics across all curator vaults
  let totalReallocationFreq = 0;
  let totalIdleCash = 0;
  let totalAdapters = 0;
  let maxConcentration = 0;
  let totalLLTV = 0;
  let lltvCount = 0;
  const allCollateral: string[] = [];
  let totalVaultSize = 0;

  for (const vault of curator.vaults) {
    const latestAllocations = vault.adapterAllocations.length > 0
      ? vault.adapterAllocations.filter(
          (a) => a.snapshotTime.getTime() === vault.adapterAllocations[0].snapshotTime.getTime()
        )
      : [];

    const latestMarketAllocations = vault.marketAllocations.length > 0
      ? vault.marketAllocations.filter(
          (m) => m.snapshotTime.getTime() === vault.marketAllocations[0].snapshotTime.getTime()
        )
      : [];

    totalReallocationFreq += calculateReallocationFrequency(vault.adapterAllocations);
    totalIdleCash += vault.riskSnapshots[0]?.idleAssetsPercent ?? 0;
    totalAdapters += latestAllocations.length;

    if (latestAllocations.length > 0) {
      const topConc = Math.max(...latestAllocations.map((a) => a.allocationPct));
      maxConcentration = Math.max(maxConcentration, topConc);
    }

    for (const m of latestMarketAllocations) {
      totalLLTV += m.lltv * m.allocationPct;
      lltvCount += m.allocationPct;
      allCollateral.push(m.collateralAssetSymbol);
    }

    totalVaultSize += vault.snapshots[0]?.totalAssetsUsd ?? 0;
  }

  const vaultCount = curator.vaults.length;
  const avgReallocationFreq = totalReallocationFreq / vaultCount;
  const avgIdleCash = totalIdleCash / vaultCount;
  const avgAdapters = totalAdapters / vaultCount;
  const avgLLTV = lltvCount > 0 ? totalLLTV / lltvCount : 80;
  const avgVaultSize = totalVaultSize / vaultCount;

  let managementStyle: ManagementStyle = "active";
  if (avgReallocationFreq < 3) {
    managementStyle = "passive";
  } else if (avgReallocationFreq > 15) {
    managementStyle = "hyper-active";
  }

  return {
    reallocationFrequency: avgReallocationFreq,
    idleCashPercent: avgIdleCash,
    adapterDiversification: Math.round(avgAdapters),
    topAdapterConcentration: maxConcentration,
    avgLLTV,
    collateralTypes: [...new Set(allCollateral)],
    vaultCount,
    avgVaultSize,
    managementStyle,
    vaultAgeMonths: 12, // Simplified
  };
}

function calculateReallocationFrequency(
  allocations: Array<{ snapshotTime: Date; adapterAddress: string; allocationPct: number }>
): number {
  if (allocations.length < 2) return 0;

  // Group by snapshot time
  const snapshots = new Map<number, typeof allocations>();
  for (const a of allocations) {
    const time = a.snapshotTime.getTime();
    if (!snapshots.has(time)) {
      snapshots.set(time, []);
    }
    snapshots.get(time)!.push(a);
  }

  const snapshotTimes = [...snapshots.keys()].sort((a, b) => b - a);
  if (snapshotTimes.length < 2) return 0;

  // Count significant changes (>5% allocation shift)
  let changes = 0;
  for (let i = 0; i < snapshotTimes.length - 1; i++) {
    const current = snapshots.get(snapshotTimes[i])!;
    const previous = snapshots.get(snapshotTimes[i + 1])!;

    const currentMap = new Map(current.map((a) => [a.adapterAddress, a.allocationPct]));
    const previousMap = new Map(previous.map((a) => [a.adapterAddress, a.allocationPct]));

    let hasSignificantChange = false;
    for (const [addr, pct] of currentMap) {
      const prevPct = previousMap.get(addr) ?? 0;
      if (Math.abs(pct - prevPct) > 5) {
        hasSignificantChange = true;
        break;
      }
    }

    if (hasSignificantChange) changes++;
  }

  // Calculate time span in months
  const timeSpanMs = snapshotTimes[0] - snapshotTimes[snapshotTimes.length - 1];
  const timeSpanMonths = Math.max(1, timeSpanMs / (1000 * 60 * 60 * 24 * 30));

  return changes / timeSpanMonths;
}

function getDefaultMetrics(): StrategyMetrics {
  return {
    reallocationFrequency: 5,
    idleCashPercent: 10,
    adapterDiversification: 3,
    topAdapterConcentration: 50,
    avgLLTV: 80,
    collateralTypes: ["WETH", "USDC"],
    vaultCount: 1,
    avgVaultSize: 1000000,
    managementStyle: "active",
    vaultAgeMonths: 6,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isBlueChipOnly(collateral: string[]): boolean {
  if (collateral.length === 0) return true;
  return collateral.every((c) => BLUE_CHIP_COLLATERAL.includes(c.toUpperCase()));
}

function hasExoticCollateral(collateral: string[]): boolean {
  if (collateral.length === 0) return false;
  return collateral.some((c) => !BLUE_CHIP_COLLATERAL.includes(c.toUpperCase()));
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BLUE_CHIP_COLLATERAL,
  STABLECOINS,
  isBlueChipOnly,
  hasExoticCollateral,
};

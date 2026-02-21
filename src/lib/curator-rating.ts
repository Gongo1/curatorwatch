/**
 * Relative Curator Risk Rating System
 *
 * Based on actual DeFi failure patterns, NOT TradFi standards.
 * Peer comparison where Gauntlet/Steakhouse = AAA benchmark.
 *
 * LEARNED FROM STREAM FINANCE COLLAPSE (Nov 2025):
 * - $285M bad debt from recursive leverage + synthetic xUSD
 * - MEV Capital, Re7 Labs, TelosC, Elixir, Varlamore = failures
 * - Steakhouse Financial = zero exposure, survived
 */

import { prisma } from "@/lib/db";

// ============================================================================
// TYPES
// ============================================================================

export type CuratorTier = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC";

export type RedFlagSeverity = "critical" | "high" | "medium" | "low";

export interface RedFlag {
  type: string;
  severity: RedFlagSeverity;
  description: string;
  impact: number; // Score deduction
}

export interface GreenFlag {
  type: string;
  description: string;
  impact: number; // Score addition
}

export interface PeerComparison {
  betterThan: string[];
  worseThan: string[];
  similar: string[];
  totalPeers: number;
}

export interface CuratorRiskRating {
  tier: CuratorTier;
  score: number; // 0-100
  percentileRank: number; // Where they rank vs all curators
  redFlags: RedFlag[];
  greenFlags: GreenFlag[];
  peerComparison: PeerComparison;
  allocationGuidance: {
    maxAllocation: string;
    suitableFor: string[];
    notSuitableFor: string[];
  };
  methodology: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BLUE_CHIP_COLLATERAL = [
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "crvUSD", "GHO", "PYUSD", "USDS",
  "WETH", "ETH", "wstETH", "stETH", "rETH", "cbETH", "weETH", "ezETH",
  "WBTC", "cbBTC", "tBTC"
];

// Known curators with track records (lowercase addresses)
const KNOWN_AAA_CURATORS = [
  "gauntlet",
  "steakhouse",
  "block analitica"
];

// Curators with known bad debt events from Stream Finance collapse
const KNOWN_BAD_DEBT_CURATORS: Record<string, { exposure: number; event: string }> = {
  "mev capital": { exposure: 25_400_000, event: "Stream Finance xUSD collapse" },
  "re7 labs": { exposure: 14_650_000, event: "Stream Finance xUSD collapse" },
  "re7": { exposure: 14_650_000, event: "Stream Finance xUSD collapse" },
  "telosc": { exposure: 123_600_000, event: "Stream Finance xUSD collapse" },
  "elixir": { exposure: 68_000_000, event: "Stream Finance deUSD collapse" },
  "varlamore": { exposure: 30_000_000, event: "Stream Finance xUSD collapse" },
};

// Tier thresholds and guidance
const TIER_CONFIG: Record<CuratorTier, {
  minScore: number;
  maxAllocation: string;
  suitableFor: string[];
  notSuitableFor: string[];
}> = {
  AAA: {
    minScore: 85,
    maxAllocation: "$10M+ institutional allocations",
    suitableFor: ["Institutional mandates", "DAO treasuries", "Long-term capital", "Risk-averse allocators"],
    notSuitableFor: ["Yield maximizers seeking highest APY"]
  },
  AA: {
    minScore: 75,
    maxAllocation: "$1M-10M allocations",
    suitableFor: ["Large allocators", "Conservative institutions", "Multi-year horizons"],
    notSuitableFor: ["Extreme risk tolerance requirements"]
  },
  A: {
    minScore: 65,
    maxAllocation: "$250k-1M allocations",
    suitableFor: ["Growing portfolios", "Moderate risk tolerance", "12+ month horizons"],
    notSuitableFor: ["Ultra-conservative mandates"]
  },
  BBB: {
    minScore: 50,
    maxAllocation: "$100k-250k with monthly review",
    suitableFor: ["Active monitors", "Risk-aware allocators", "Diversified portfolios"],
    notSuitableFor: ["Passive investors", "Set-and-forget strategies"]
  },
  BB: {
    minScore: 35,
    maxAllocation: "<$100k for risk-tolerant only",
    suitableFor: ["Sophisticated DeFi users", "Short-term opportunistic", "Risk capital only"],
    notSuitableFor: ["Institutional mandates", "Treasury funds", "Risk-averse"]
  },
  B: {
    minScore: 20,
    maxAllocation: "Test allocation only (<$25k)",
    suitableFor: ["Degen strategies", "Research purposes", "Minimal exposure"],
    notSuitableFor: ["Any serious allocation", "Fiduciary capital"]
  },
  CCC: {
    minScore: 0,
    maxAllocation: "ZERO - Do not allocate",
    suitableFor: [],
    notSuitableFor: ["Everyone - active distress or toxic"]
  }
};

// ============================================================================
// MAIN RATING FUNCTION
// ============================================================================

export async function calculateCuratorRating(curatorAddress: string): Promise<CuratorRiskRating> {
  // Get curator data
  const curator = await prisma.curator.findFirst({
    where: { address: { equals: curatorAddress, mode: "insensitive" } },
    include: {
      vaults: {
        include: {
          snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
          adapterAllocations: { orderBy: { snapshotTime: "desc" }, take: 20 },
          marketAllocations: { orderBy: { snapshotTime: "desc" }, take: 20 },
          riskSnapshots: { orderBy: { timestamp: "desc" }, take: 1 },
        },
      },
    },
  });

  // Get all curators for peer comparison
  const allCurators = await prisma.curator.findMany({
    include: {
      vaults: {
        include: {
          snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!curator) {
    return getUnknownCuratorRating(curatorAddress);
  }

  let score = 50; // Start at median
  const redFlags: RedFlag[] = [];
  const greenFlags: GreenFlag[] = [];

  // Calculate curator metrics
  const monthsOperating = getMonthsOperating(curator.createdAt);
  const totalAUM = curator.totalAssetsManaged ?? 0;
  const vaultCount = curator.vaults.length;
  const curatorName = curator.name?.toLowerCase() ?? "";

  // =========================================================================
  // FACTOR 1: Bad Debt History (CRITICAL - from Stream Finance lessons)
  // =========================================================================
  const badDebtInfo = checkBadDebtHistory(curatorName);

  if (badDebtInfo) {
    const lossPercentage = totalAUM > 0 ? (badDebtInfo.exposure / totalAUM) * 100 : 100;

    if (lossPercentage > 50 || badDebtInfo.exposure > 50_000_000) {
      score -= 45;
      redFlags.push({
        type: "CATASTROPHIC_BAD_DEBT",
        severity: "critical",
        description: `$${(badDebtInfo.exposure / 1e6).toFixed(1)}M exposure in ${badDebtInfo.event}`,
        impact: -45
      });
    } else if (lossPercentage > 10 || badDebtInfo.exposure > 10_000_000) {
      score -= 30;
      redFlags.push({
        type: "MAJOR_BAD_DEBT",
        severity: "high",
        description: `$${(badDebtInfo.exposure / 1e6).toFixed(1)}M exposure in ${badDebtInfo.event}`,
        impact: -30
      });
    } else {
      score -= 15;
      redFlags.push({
        type: "BAD_DEBT_EVENT",
        severity: "medium",
        description: `$${(badDebtInfo.exposure / 1e6).toFixed(1)}M exposure in ${badDebtInfo.event}`,
        impact: -15
      });
    }
  } else if (monthsOperating >= 12) {
    // Zero bad debt with meaningful track record = HUGE bonus
    score += 20;
    greenFlags.push({
      type: "ZERO_BAD_DEBT",
      description: "No bad debt events despite operating through DeFi stress periods (Stream collapse, etc.)",
      impact: 20
    });
  }

  // =========================================================================
  // FACTOR 2: Time in Operation (DeFi scale - 2 years = ancient)
  // =========================================================================
  if (monthsOperating >= 24) {
    score += 15;
    greenFlags.push({
      type: "VETERAN_CURATOR",
      description: `${monthsOperating} months operating - survived multiple DeFi cycles`,
      impact: 15
    });
  } else if (monthsOperating >= 18) {
    score += 10;
    greenFlags.push({
      type: "ESTABLISHED_CURATOR",
      description: `${monthsOperating} months track record`,
      impact: 10
    });
  } else if (monthsOperating >= 12) {
    score += 5;
  } else if (monthsOperating >= 6) {
    // Neutral - new but acceptable
  } else if (monthsOperating >= 3) {
    score -= 10;
    redFlags.push({
      type: "NEW_CURATOR",
      severity: "medium",
      description: `Only ${monthsOperating} months operating - limited track record`,
      impact: -10
    });
  } else {
    score -= 20;
    redFlags.push({
      type: "VERY_NEW_CURATOR",
      severity: "high",
      description: `<3 months operating - insufficient track record for meaningful allocation`,
      impact: -20
    });
  }

  // =========================================================================
  // FACTOR 3: Collateral Quality (Stream lesson: exotic = dangerous)
  // =========================================================================
  const collateralAnalysis = analyzeCollateralQuality(curator.vaults);

  if (collateralAnalysis.blueChipOnly) {
    score += 15;
    greenFlags.push({
      type: "BLUE_CHIP_ONLY",
      description: "Conservative collateral standards - only established assets accepted",
      impact: 15
    });
  } else if (collateralAnalysis.exoticPercentage > 50) {
    score -= 25;
    redFlags.push({
      type: "HIGH_EXOTIC_EXPOSURE",
      severity: "high",
      description: `${collateralAnalysis.exoticPercentage.toFixed(0)}% in exotic/synthetic collateral - Stream-level contagion risk`,
      impact: -25
    });
  } else if (collateralAnalysis.exoticPercentage > 25) {
    score -= 15;
    redFlags.push({
      type: "MODERATE_EXOTIC_EXPOSURE",
      severity: "medium",
      description: `${collateralAnalysis.exoticPercentage.toFixed(0)}% non-blue-chip collateral`,
      impact: -15
    });
  } else if (collateralAnalysis.exoticPercentage > 10) {
    score -= 5;
    redFlags.push({
      type: "SOME_EXOTIC_EXPOSURE",
      severity: "low",
      description: `${collateralAnalysis.exoticPercentage.toFixed(0)}% exotic collateral - monitor closely`,
      impact: -5
    });
  }

  // Check for synthetic asset creation (MAJOR RED FLAG - xUSD pattern)
  if (collateralAnalysis.hasSyntheticCreation) {
    score -= 30;
    redFlags.push({
      type: "SYNTHETIC_ASSET_CREATION",
      severity: "critical",
      description: "Creates or accepts self-issued synthetic tokens - classic ponzi pattern (xUSD)",
      impact: -30
    });
  }

  // =========================================================================
  // FACTOR 4: APY vs Peer Average (Ponzi Detector)
  // =========================================================================
  const apyAnalysis = analyzeAPYvsPeers(curator, allCurators);

  if (apyAnalysis.premiumPercentage > 100) {
    // 2x+ peer average = MAJOR RED FLAG
    score -= 30;
    redFlags.push({
      type: "UNSUSTAINABLE_YIELD",
      severity: "critical",
      description: `Offering ${apyAnalysis.curatorAPY.toFixed(2)}% vs peer avg ${apyAnalysis.peerAPY.toFixed(2)}% - likely unsustainable/ponzi`,
      impact: -30
    });
  } else if (apyAnalysis.premiumPercentage > 50) {
    score -= 15;
    redFlags.push({
      type: "ELEVATED_YIELD",
      severity: "high",
      description: `${apyAnalysis.premiumPercentage.toFixed(0)}% above peer average - scrutinize risk-taking`,
      impact: -15
    });
  } else if (apyAnalysis.premiumPercentage > 25) {
    score -= 5;
    redFlags.push({
      type: "ABOVE_PEER_YIELD",
      severity: "low",
      description: `${apyAnalysis.premiumPercentage.toFixed(0)}% above peers - investigate source`,
      impact: -5
    });
  }

  // =========================================================================
  // FACTOR 5: Concentration Risk (Elixir lesson: 65% in one = disaster)
  // =========================================================================
  const concentrationAnalysis = analyzeConcentration(curator.vaults);

  if (concentrationAnalysis.maxConcentration > 80) {
    score -= 20;
    redFlags.push({
      type: "EXTREME_CONCENTRATION",
      severity: "high",
      description: `${concentrationAnalysis.maxConcentration.toFixed(0)}% in single position - Elixir-level risk`,
      impact: -20
    });
  } else if (concentrationAnalysis.maxConcentration > 60) {
    score -= 10;
    redFlags.push({
      type: "HIGH_CONCENTRATION",
      severity: "medium",
      description: `${concentrationAnalysis.maxConcentration.toFixed(0)}% in top adapter`,
      impact: -10
    });
  } else if (concentrationAnalysis.maxConcentration < 40) {
    score += 10;
    greenFlags.push({
      type: "WELL_DIVERSIFIED",
      description: `Well-diversified: ${concentrationAnalysis.maxConcentration.toFixed(0)}% max concentration`,
      impact: 10
    });
  }

  // =========================================================================
  // FACTOR 6: Governance & Safety Mechanisms (Steakhouse standard)
  // =========================================================================
  if (curator.isRegulated) {
    score += 15;
    greenFlags.push({
      type: "REGULATED_ENTITY",
      description: `Registered ${curator.entityType ?? "entity"} with regulatory oversight`,
      impact: 15
    });
  }

  if (curator.legalName && curator.jurisdiction) {
    score += 5;
    greenFlags.push({
      type: "LEGAL_ENTITY",
      description: `Registered legal entity in ${curator.jurisdiction}`,
      impact: 5
    });
  } else {
    score -= 5;
    redFlags.push({
      type: "NO_LEGAL_ENTITY",
      severity: "low",
      description: "No registered legal entity - limited accountability",
      impact: -5
    });
  }

  // =========================================================================
  // FACTOR 7: Scale (Relative to DeFi)
  // =========================================================================
  if (totalAUM >= 500_000_000) {
    score += 15;
    greenFlags.push({
      type: "MEGA_SCALE",
      description: `$${(totalAUM / 1e9).toFixed(2)}B AUM - top-tier institutional scale`,
      impact: 15
    });
  } else if (totalAUM >= 100_000_000) {
    score += 10;
    greenFlags.push({
      type: "INSTITUTIONAL_SCALE",
      description: `$${(totalAUM / 1e6).toFixed(0)}M AUM - institutional scale`,
      impact: 10
    });
  } else if (totalAUM >= 50_000_000) {
    score += 5;
  } else if (totalAUM >= 10_000_000) {
    // Neutral - reasonable size
  } else if (totalAUM < 1_000_000) {
    score -= 10;
    redFlags.push({
      type: "SMALL_SCALE",
      severity: "medium",
      description: `<$1M AUM - unproven at scale, limited resources`,
      impact: -10
    });
  }

  // =========================================================================
  // FACTOR 8: Vault Count (Diversification of operations)
  // =========================================================================
  if (vaultCount >= 5) {
    score += 5;
    greenFlags.push({
      type: "MULTI_VAULT_OPERATOR",
      description: `Manages ${vaultCount} vaults - experienced operator`,
      impact: 5
    });
  } else if (vaultCount === 1 && totalAUM < 10_000_000) {
    score -= 5;
    redFlags.push({
      type: "SINGLE_VAULT_OPERATOR",
      severity: "low",
      description: "Single vault operator - limited operational experience",
      impact: -5
    });
  }

  // =========================================================================
  // FACTOR 9: Known AAA Benchmark (Gauntlet/Steakhouse standard)
  // =========================================================================
  const isKnownAAA = KNOWN_AAA_CURATORS.some(name => curatorName.includes(name));
  if (isKnownAAA) {
    score += 10;
    greenFlags.push({
      type: "BENCHMARK_CURATOR",
      description: "Recognized industry leader with exemplary track record",
      impact: 10
    });
  }

  // =========================================================================
  // NORMALIZE AND ASSIGN TIER
  // =========================================================================
  score = Math.max(0, Math.min(100, score));

  let tier: CuratorTier;
  if (score >= TIER_CONFIG.AAA.minScore) tier = "AAA";
  else if (score >= TIER_CONFIG.AA.minScore) tier = "AA";
  else if (score >= TIER_CONFIG.A.minScore) tier = "A";
  else if (score >= TIER_CONFIG.BBB.minScore) tier = "BBB";
  else if (score >= TIER_CONFIG.BB.minScore) tier = "BB";
  else if (score >= TIER_CONFIG.B.minScore) tier = "B";
  else tier = "CCC";

  // Calculate peer comparison
  const peerScores = await calculateAllPeerScores(allCurators);
  const percentileRank = calculatePercentile(score, peerScores);
  const peerComparison = buildPeerComparison(curator.name ?? "Unknown", score, allCurators, peerScores);

  const tierConfig = TIER_CONFIG[tier];

  return {
    tier,
    score,
    percentileRank,
    redFlags: redFlags.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    greenFlags: greenFlags.sort((a, b) => b.impact - a.impact),
    peerComparison,
    allocationGuidance: {
      maxAllocation: tierConfig.maxAllocation,
      suitableFor: tierConfig.suitableFor,
      notSuitableFor: tierConfig.notSuitableFor
    },
    methodology: `Relative rating based on peer comparison across ${peerComparison.totalPeers} Morpho V2 curators. Factors: bad debt history, track record, collateral quality, APY sustainability, concentration risk, governance, and scale.`
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMonthsOperating(createdAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
}

function checkBadDebtHistory(curatorName: string): { exposure: number; event: string } | null {
  for (const [name, info] of Object.entries(KNOWN_BAD_DEBT_CURATORS)) {
    if (curatorName.includes(name)) {
      return info;
    }
  }
  return null;
}

interface CollateralAnalysis {
  blueChipOnly: boolean;
  exoticPercentage: number;
  hasSyntheticCreation: boolean;
  collateralTypes: string[];
}

function analyzeCollateralQuality(vaults: Array<{
  marketAllocations: Array<{ collateralAssetSymbol: string; allocationPct: number; snapshotTime: Date }>;
}>): CollateralAnalysis {
  const allCollateral: string[] = [];
  let totalAllocation = 0;
  let exoticAllocation = 0;

  for (const vault of vaults) {
    // Get latest market allocations
    const latest = vault.marketAllocations.length > 0
      ? vault.marketAllocations.filter(m =>
          m.snapshotTime.getTime() === vault.marketAllocations[0].snapshotTime.getTime()
        )
      : [];

    for (const m of latest) {
      allCollateral.push(m.collateralAssetSymbol);
      totalAllocation += m.allocationPct;

      if (!BLUE_CHIP_COLLATERAL.includes(m.collateralAssetSymbol.toUpperCase())) {
        exoticAllocation += m.allocationPct;
      }
    }
  }

  const uniqueCollateral = [...new Set(allCollateral)];
  const blueChipOnly = uniqueCollateral.every(c =>
    BLUE_CHIP_COLLATERAL.includes(c.toUpperCase())
  );

  // Check for synthetic patterns (x-prefixed tokens, wrapped versions, etc.)
  const syntheticPatterns = ["xUSD", "xETH", "xBTC", "synth", "wrapped", "yield"];
  const hasSyntheticCreation = uniqueCollateral.some(c =>
    syntheticPatterns.some(p => c.toLowerCase().includes(p.toLowerCase()))
  );

  return {
    blueChipOnly: blueChipOnly || uniqueCollateral.length === 0,
    exoticPercentage: totalAllocation > 0 ? (exoticAllocation / totalAllocation) * 100 : 0,
    hasSyntheticCreation,
    collateralTypes: uniqueCollateral
  };
}

interface APYAnalysis {
  curatorAPY: number;
  peerAPY: number;
  premiumPercentage: number;
}

function analyzeAPYvsPeers(
  curator: { vaults: Array<{ snapshots: Array<{ avgNetApy: number | null }> }> },
  allCurators: Array<{ vaults: Array<{ snapshots: Array<{ avgNetApy: number | null }> }> }>
): APYAnalysis {
  // Calculate curator's weighted average APY
  let curatorTotalAPY = 0;
  let curatorCount = 0;

  for (const vault of curator.vaults) {
    const apy = vault.snapshots[0]?.avgNetApy;
    if (apy !== null && apy !== undefined) {
      curatorTotalAPY += apy;
      curatorCount++;
    }
  }

  const curatorAPY = curatorCount > 0 ? curatorTotalAPY / curatorCount : 0;

  // Calculate peer average
  let peerTotalAPY = 0;
  let peerCount = 0;

  for (const peer of allCurators) {
    for (const vault of peer.vaults) {
      const apy = vault.snapshots[0]?.avgNetApy;
      if (apy !== null && apy !== undefined) {
        peerTotalAPY += apy;
        peerCount++;
      }
    }
  }

  const peerAPY = peerCount > 0 ? peerTotalAPY / peerCount : 5; // Default 5% if no data

  const premiumPercentage = peerAPY > 0
    ? ((curatorAPY - peerAPY) / peerAPY) * 100
    : 0;

  return { curatorAPY, peerAPY, premiumPercentage };
}

interface ConcentrationAnalysis {
  maxConcentration: number;
  avgConcentration: number;
}

function analyzeConcentration(vaults: Array<{
  adapterAllocations: Array<{ allocationPct: number; snapshotTime: Date }>;
}>): ConcentrationAnalysis {
  let maxConcentration = 0;
  let totalConcentration = 0;
  let vaultCount = 0;

  for (const vault of vaults) {
    const latest = vault.adapterAllocations.length > 0
      ? vault.adapterAllocations.filter(a =>
          a.snapshotTime.getTime() === vault.adapterAllocations[0].snapshotTime.getTime()
        )
      : [];

    if (latest.length > 0) {
      const topConc = Math.max(...latest.map(a => a.allocationPct));
      maxConcentration = Math.max(maxConcentration, topConc);
      totalConcentration += topConc;
      vaultCount++;
    }
  }

  return {
    maxConcentration: maxConcentration || 50,
    avgConcentration: vaultCount > 0 ? totalConcentration / vaultCount : 50
  };
}

async function calculateAllPeerScores(curators: Array<{
  name: string | null;
  createdAt: Date;
  totalAssetsManaged: number | null;
  isRegulated: boolean;
  vaults: Array<{ snapshots: Array<{ avgNetApy: number | null }> }>;
}>): Promise<number[]> {
  // Simplified scoring for peer comparison
  return curators.map(c => {
    let score = 50;
    const months = getMonthsOperating(c.createdAt);

    if (months >= 24) score += 15;
    else if (months >= 12) score += 10;
    else if (months < 6) score -= 10;

    const aum = c.totalAssetsManaged ?? 0;
    if (aum >= 100_000_000) score += 10;
    else if (aum >= 50_000_000) score += 5;
    else if (aum < 1_000_000) score -= 10;

    if (c.isRegulated) score += 10;

    const badDebt = checkBadDebtHistory(c.name?.toLowerCase() ?? "");
    if (badDebt) score -= 30;
    else if (months >= 12) score += 15;

    return Math.max(0, Math.min(100, score));
  });
}

function calculatePercentile(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 50;

  const sorted = [...allScores].sort((a, b) => a - b);
  const belowCount = sorted.filter(s => s < score).length;
  return Math.round((belowCount / sorted.length) * 100);
}

function buildPeerComparison(
  curatorName: string,
  score: number,
  allCurators: Array<{ name: string | null }>,
  peerScores: number[]
): PeerComparison {
  const betterThan: string[] = [];
  const worseThan: string[] = [];
  const similar: string[] = [];

  allCurators.forEach((c, i) => {
    const name = c.name ?? "Unknown";
    if (name === curatorName) return;

    const peerScore = peerScores[i];
    if (peerScore < score - 5) {
      betterThan.push(name);
    } else if (peerScore > score + 5) {
      worseThan.push(name);
    } else {
      similar.push(name);
    }
  });

  return {
    betterThan: betterThan.slice(0, 5),
    worseThan: worseThan.slice(0, 5),
    similar: similar.slice(0, 3),
    totalPeers: allCurators.length
  };
}

function getUnknownCuratorRating(address: string): CuratorRiskRating {
  return {
    tier: "BB",
    score: 40,
    percentileRank: 30,
    redFlags: [{
      type: "UNKNOWN_CURATOR",
      severity: "high",
      description: "Curator not found in database - exercise extreme caution",
      impact: -20
    }],
    greenFlags: [],
    peerComparison: {
      betterThan: [],
      worseThan: [],
      similar: [],
      totalPeers: 0
    },
    allocationGuidance: {
      maxAllocation: "<$100k for risk-tolerant only",
      suitableFor: ["Research purposes", "Minimal exposure testing"],
      notSuitableFor: ["Institutional mandates", "Meaningful allocations"]
    },
    methodology: "Unknown curator - rating based on lack of track record data."
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getTierColor(tier: CuratorTier): string {
  const colors: Record<CuratorTier, string> = {
    AAA: "#22c55e", // green
    AA: "#84cc16",  // lime
    A: "#eab308",   // yellow
    BBB: "#f97316", // orange
    BB: "#ef4444",  // red
    B: "#dc2626",   // dark red
    CCC: "#7f1d1d"  // very dark red
  };
  return colors[tier];
}

export function getTierDescription(tier: CuratorTier): string {
  const descriptions: Record<CuratorTier, string> = {
    AAA: "Institutional Fortress - Top 5%",
    AA: "Proven & Disciplined - Top 15%",
    A: "Competent & Growing - Top 30%",
    BBB: "Acceptable with Monitoring - Top 50%",
    BB: "Speculative - High Risk",
    B: "Highly Speculative - Very High Risk",
    CCC: "Distressed / Toxic"
  };
  return descriptions[tier];
}

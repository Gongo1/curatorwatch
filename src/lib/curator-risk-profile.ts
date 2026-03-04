/**
 * Curator Risk Profile — peer-relative factor cards (no composite score).
 *
 * Shows 7 individual risk factors with percentile ranks among all tracked
 * curators. Colors indicate relative standing, not absolute quality.
 */

import { prisma } from "@/lib/db";

// ============================================================================
// TYPES
// ============================================================================

export interface PeerContext {
  percentile: number; // 0-100, higher = better
  tier: "top" | "above-avg" | "average" | "below-avg" | "bottom";
  peerCount: number;
}

export type RiskFactor =
  | BadDebtFactor
  | TimeInOperationFactor
  | CollateralQualityFactor
  | GovernanceLegalFactor
  | ScaleFactor
  | VaultCountFactor
  | TeamTransparencyFactor;

interface BadDebtFactor {
  id: "bad-debt";
  label: "Bad Debt History";
  peer: PeerContext;
  hasEvents: boolean;
  totalExposure: number;
  eventDescription: string | null;
}

interface TimeInOperationFactor {
  id: "time-in-operation";
  label: "Time in Operation";
  peer: PeerContext;
  monthsActive: number;
  foundedYear: number | null;
}

interface CollateralQualityFactor {
  id: "collateral-quality";
  label: "Collateral Quality";
  peer: PeerContext;
  blueChipPct: number;
  hasData: boolean;
  collateralList: string[];
}

interface GovernanceLegalFactor {
  id: "governance-legal";
  label: "Governance & Legal";
  peer: PeerContext;
  completenessScore: number; // 0-5
  legalName: string | null;
  jurisdiction: string | null;
  entityType: string | null;
  isRegulated: boolean;
  regulatoryBody: string | null;
}

interface ScaleFactor {
  id: "scale";
  label: "Scale (AUM)";
  peer: PeerContext;
  aumUsd: number;
}

interface VaultCountFactor {
  id: "vault-count";
  label: "Vault Count";
  peer: PeerContext;
  count: number;
  protocols: string[];
}

interface TeamTransparencyFactor {
  id: "team-transparency";
  label: "Team Transparency";
  peer: PeerContext;
  presenceScore: number; // 0-5
  teamSize: string | null;
  hasWebsite: boolean;
  hasTwitter: boolean;
  hasDiscord: boolean;
  hasDescription: boolean;
}

export interface CuratorRiskProfile {
  curatorName: string;
  factors: RiskFactor[];
  peerCount: number;
  generatedAt: string; // ISO date
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BLUE_CHIP_COLLATERAL = [
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "crvUSD", "GHO", "PYUSD", "USDS",
  "EURC", "EURCV", "AUSD", "sDAI", "sUSDe", "USDe", "FDUSD", "TUSD", "USDD",
  "WETH", "ETH", "wstETH", "stETH", "rETH", "cbETH", "weETH", "ezETH",
  "swETH", "mETH", "osETH", "ankrETH", "sfrxETH", "frxETH",
  "WBTC", "cbBTC", "tBTC", "sBTC", "LBTC",
  "vbUSDC", "vbWETH", "vbWBTC", "vbUSDT",
  "MKR", "AAVE", "CRV", "LDO", "UNI", "LINK", "COMP", "SNX",
  "stkAAVE", "wstMKR",
];

const KNOWN_BAD_DEBT_CURATORS: Record<string, { exposure: number; event: string }> = {
  "mev capital": { exposure: 25_400_000, event: "Stream Finance xUSD collapse" },
  "re7 labs": { exposure: 14_650_000, event: "Stream Finance xUSD collapse" },
  "re7": { exposure: 14_650_000, event: "Stream Finance xUSD collapse" },
  "telosc": { exposure: 123_600_000, event: "Stream Finance xUSD collapse" },
  "elixir": { exposure: 68_000_000, event: "Stream Finance deUSD collapse" },
  "varlamore": { exposure: 30_000_000, event: "Stream Finance xUSD collapse" },
};

// ============================================================================
// HELPERS
// ============================================================================

function tierFromPercentile(p: number): PeerContext["tier"] {
  if (p >= 80) return "top";
  if (p >= 60) return "above-avg";
  if (p >= 40) return "average";
  if (p >= 20) return "below-avg";
  return "bottom";
}

function percentileOf(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  // Use mid-rank percentile: (below + 0.5 * equal) / total
  // Handles ties correctly for discrete/binary distributions
  const belowCount = allValues.filter((v) => v < value).length;
  const equalCount = allValues.filter((v) => v === value).length;
  return Math.round(((belowCount + 0.5 * equalCount) / allValues.length) * 100);
}

function getMonthsActive(foundedYear: number | null, createdAt: Date): number {
  const now = new Date();
  if (foundedYear) {
    const founded = new Date(foundedYear, 0, 1);
    return Math.floor((now.getTime() - founded.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

function checkBadDebt(name: string): { exposure: number; event: string } | null {
  const lower = name.toLowerCase();
  for (const [key, info] of Object.entries(KNOWN_BAD_DEBT_CURATORS)) {
    if (lower.includes(key)) return info;
  }
  return null;
}

function governanceScore(c: {
  legalName: string | null;
  jurisdiction: string | null;
  entityType: string | null;
  isRegulated: boolean;
  regulatoryBody: string | null;
}): number {
  let score = 0;
  if (c.legalName) score++;
  if (c.jurisdiction) score++;
  if (c.entityType) score++;
  if (c.isRegulated) score++;
  if (c.regulatoryBody) score++;
  return score;
}

function teamPresenceScore(c: {
  teamSize: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  description: string | null;
}): number {
  let score = 0;
  if (c.teamSize) score++;
  if (c.website) score++;
  if (c.twitter) score++;
  if (c.discord) score++;
  if (c.description) score++;
  return score;
}

// ============================================================================
// MAIN
// ============================================================================

export async function calculateCuratorRiskProfile(
  curatorAddress: string,
): Promise<CuratorRiskProfile> {
  const vaultInclude = {
    include: {
      snapshots: { orderBy: { timestamp: "desc" as const }, take: 1 },
    },
  };

  const curator = await prisma.curator.findFirst({
    where: { address: { equals: curatorAddress, mode: "insensitive" } },
    include: { vaults: vaultInclude },
  });

  const allCurators = await prisma.curator.findMany({
    include: { vaults: vaultInclude },
  });

  if (!curator) {
    return {
      curatorName: "Unknown",
      factors: [],
      peerCount: allCurators.length,
      generatedAt: new Date().toISOString(),
    };
  }

  const peerCount = allCurators.length;
  const curatorName = curator.name ?? "Unknown";

  // Pre-compute per-factor values for ALL curators so we can derive percentiles
  const allBadDebt = allCurators.map((c) => (checkBadDebt(c.name ?? "") ? 0 : 1));
  const allMonths = allCurators.map((c) => getMonthsActive(c.foundedYear, c.createdAt));
  const allGov = allCurators.map((c) => governanceScore(c));
  const allAum = allCurators.map((c) => c.totalAssetsManaged ?? 0);
  const allVaults = allCurators.map((c) => c.vaults.length);
  const allTeam = allCurators.map((c) => teamPresenceScore(c));

  // Collateral quality per curator — based on vault asset + TVL
  const allCollateralAnalysis = allCurators.map((c) => analyzeCollateral(c.vaults));
  const allBlueChipPct = allCollateralAnalysis.map((a) => (a.hasData ? a.blueChipPct : -1));
  const blueChipWithData = allBlueChipPct.filter((v) => v >= 0);

  // --- Target curator values ---
  const badDebtInfo = checkBadDebt(curatorName);
  const targetBadDebt = badDebtInfo ? 0 : 1;
  const targetMonths = getMonthsActive(curator.foundedYear, curator.createdAt);
  const targetCollateral = analyzeCollateral(curator.vaults);
  const targetGov = governanceScore(curator);
  const targetAum = curator.totalAssetsManaged ?? 0;
  const targetVaults = curator.vaults.length;
  const targetTeam = teamPresenceScore(curator);

  // Collect unique protocols from vault names/data
  const protocolSet = new Set<string>();
  curator.vaults.forEach((v) => {
    // Extract protocol from chainName or use "Morpho" as default
    const chain = (v as { chainName?: string }).chainName;
    if (chain) protocolSet.add(chain);
  });
  const protocols = Array.from(protocolSet);

  // --- Build factors ---
  const factors: RiskFactor[] = [];

  // 1. Bad Debt — binary factor: clean = top, has events = bottom
  const badDebtCount = allBadDebt.filter((v) => v === 0).length;
  const badDebtPercentile = badDebtInfo
    ? Math.min(10, Math.round((badDebtCount > 1 ? 0.5 : 0) / peerCount * 100))
    : Math.max(80, Math.round(((badDebtCount + (peerCount - badDebtCount) * 0.5) / peerCount) * 100));
  factors.push({
    id: "bad-debt",
    label: "Bad Debt History",
    peer: {
      percentile: badDebtPercentile,
      tier: badDebtInfo ? "bottom" : "top",
      peerCount,
    },
    hasEvents: !!badDebtInfo,
    totalExposure: badDebtInfo?.exposure ?? 0,
    eventDescription: badDebtInfo?.event ?? null,
  });

  // 2. Time in Operation
  const timePercentile = percentileOf(targetMonths, allMonths);
  factors.push({
    id: "time-in-operation",
    label: "Time in Operation",
    peer: { percentile: timePercentile, tier: tierFromPercentile(timePercentile), peerCount },
    monthsActive: targetMonths,
    foundedYear: curator.foundedYear,
  });

  // 3. Collateral Quality
  const collateralPercentile = targetCollateral.hasData
    ? percentileOf(targetCollateral.blueChipPct, blueChipWithData)
    : 50; // neutral if no data
  factors.push({
    id: "collateral-quality",
    label: "Collateral Quality",
    peer: {
      percentile: collateralPercentile,
      tier: targetCollateral.hasData ? tierFromPercentile(collateralPercentile) : "average",
      peerCount: targetCollateral.hasData ? blueChipWithData.length : peerCount,
    },
    blueChipPct: targetCollateral.blueChipPct,
    hasData: targetCollateral.hasData,
    collateralList: targetCollateral.collateralList,
  });

  // 4. Governance & Legal
  const govPercentile = percentileOf(targetGov, allGov);
  factors.push({
    id: "governance-legal",
    label: "Governance & Legal",
    peer: { percentile: govPercentile, tier: tierFromPercentile(govPercentile), peerCount },
    completenessScore: targetGov,
    legalName: curator.legalName,
    jurisdiction: curator.jurisdiction,
    entityType: curator.entityType,
    isRegulated: curator.isRegulated,
    regulatoryBody: curator.regulatoryBody,
  });

  // 5. Scale
  const scalePercentile = percentileOf(targetAum, allAum);
  factors.push({
    id: "scale",
    label: "Scale (AUM)",
    peer: { percentile: scalePercentile, tier: tierFromPercentile(scalePercentile), peerCount },
    aumUsd: targetAum,
  });

  // 6. Vault Count
  const vaultPercentile = percentileOf(targetVaults, allVaults);
  factors.push({
    id: "vault-count",
    label: "Vault Count",
    peer: { percentile: vaultPercentile, tier: tierFromPercentile(vaultPercentile), peerCount },
    count: targetVaults,
    protocols,
  });

  // 7. Team Transparency
  const teamPercentile = percentileOf(targetTeam, allTeam);
  factors.push({
    id: "team-transparency",
    label: "Team Transparency",
    peer: { percentile: teamPercentile, tier: tierFromPercentile(teamPercentile), peerCount },
    presenceScore: targetTeam,
    teamSize: curator.teamSize,
    hasWebsite: !!curator.website,
    hasTwitter: !!curator.twitter,
    hasDiscord: !!curator.discord,
    hasDescription: !!curator.description,
  });

  return {
    curatorName,
    factors,
    peerCount,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// COLLATERAL ANALYSIS — vault-level asset + TVL weighting
// ============================================================================

function analyzeCollateral(vaults: Array<{
  assetSymbol: string;
  snapshots: Array<{ totalAssetsUsd: number }>;
}>): { hasData: boolean; blueChipPct: number; collateralList: string[] } {
  if (vaults.length === 0) return { hasData: false, blueChipPct: 0, collateralList: [] };

  let totalTvl = 0;
  let blueChipTvl = 0;
  const assetSet = new Set<string>();

  for (const vault of vaults) {
    const tvl = vault.snapshots[0]?.totalAssetsUsd ?? 0;
    const symbol = vault.assetSymbol;
    assetSet.add(symbol);
    totalTvl += tvl;

    if (BLUE_CHIP_COLLATERAL.some((bc) => bc.toUpperCase() === symbol.toUpperCase())) {
      blueChipTvl += tvl;
    }
  }

  const blueChipPct = totalTvl > 0 ? (blueChipTvl / totalTvl) * 100 : 0;

  return {
    hasData: assetSet.size > 0,
    blueChipPct,
    collateralList: [...assetSet],
  };
}

/**
 * Curator aggregate metrics calculation utilities
 * These functions compute curator-level metrics from their vault data
 */

import { prisma } from "@/lib/db";

export interface AssetDistribution {
  symbol: string;
  amountUsd: number;
  percentage: number;
}

export interface CuratorAggregates {
  curatorId: string;
  curatorAddress: string;
  name: string | null;
  logoUrl: string | null;
  website: string | null;
  twitter: string | null;
  jurisdiction: string | null;
  entityType: string | null;
  isRegulated: boolean;
  totalAUM: number;
  vaultCount: number;
  avgApy: number;
  avgNetApy: number;
  assetDistribution: AssetDistribution[];
  lastActive: Date | null;
  riskScore: "low" | "medium" | "high";
  strategyType: "Conservative" | "Moderate" | "Aggressive";
  tvlChange30d: number;
  tvlChangePct30d: number;
}

export interface CuratorSummaryStats {
  totalCurators: number;
  totalAUM: number;
  totalVaults: number;
  avgApy: number;
}

export interface PaginatedCuratorsResult {
  curators: CuratorAggregates[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CuratorQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "aum" | "vaults" | "apy" | "name";
  sortOrder?: "asc" | "desc";
}

/**
 * Calculate aggregate metrics for a single curator
 */
export async function getCuratorAggregates(
  curatorId: string
): Promise<CuratorAggregates | null> {
  const curator = await prisma.curator.findUnique({
    where: { id: curatorId },
    include: {
      vaults: {
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 30, // Last 30 snapshots for trend calculation
          },
          riskSnapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          transactions: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          reallocations: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      },
    },
  });

  if (!curator) return null;

  const vaults = curator.vaults;

  // Calculate total AUM
  const totalAUM = vaults.reduce((sum, v) => {
    const latestSnapshot = v.snapshots[0];
    return sum + (latestSnapshot?.totalAssetsUsd ?? 0);
  }, 0);

  // Weighted average APY
  let weightedApySum = 0;
  let weightedNetApySum = 0;
  vaults.forEach((v) => {
    const latestSnapshot = v.snapshots[0];
    if (latestSnapshot) {
      const tvl = latestSnapshot.totalAssetsUsd;
      weightedApySum += (latestSnapshot.avgApy ?? 0) * tvl;
      weightedNetApySum += (latestSnapshot.avgNetApy ?? 0) * tvl;
    }
  });
  const avgApy = totalAUM > 0 ? weightedApySum / totalAUM : 0;
  const avgNetApy = totalAUM > 0 ? weightedNetApySum / totalAUM : 0;

  // Asset distribution
  const assetMap: Record<string, number> = {};
  vaults.forEach((v) => {
    const latestSnapshot = v.snapshots[0];
    if (latestSnapshot) {
      assetMap[v.assetSymbol] =
        (assetMap[v.assetSymbol] || 0) + latestSnapshot.totalAssetsUsd;
    }
  });
  const assetDistribution: AssetDistribution[] = Object.entries(assetMap)
    .map(([symbol, amountUsd]) => ({
      symbol,
      amountUsd,
      percentage: totalAUM > 0 ? (amountUsd / totalAUM) * 100 : 0,
    }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  // Last activity (most recent transaction across all vaults)
  const lastActivityTimes = vaults
    .map((v) => v.transactions[0]?.timestamp)
    .filter(Boolean) as Date[];
  const lastActive =
    lastActivityTimes.length > 0
      ? new Date(Math.max(...lastActivityTimes.map((d) => d.getTime())))
      : null;

  // Aggregate risk score
  const riskScores = vaults
    .map((v) => v.riskSnapshots[0]?.concentrationScore)
    .filter(Boolean);
  const highRiskCount = riskScores.filter((s) => s === "high").length;
  const medRiskCount = riskScores.filter((s) => s === "medium").length;
  const riskScore: "low" | "medium" | "high" =
    highRiskCount > vaults.length / 2
      ? "high"
      : highRiskCount > 0 || medRiskCount > vaults.length / 2
        ? "medium"
        : "low";

  // Strategy classification
  const strategyType = classifyCuratorStrategy(vaults, riskScores);

  // 30-day TVL change
  const { tvlChange30d, tvlChangePct30d } = calculate30dTvlChange(vaults);

  return {
    curatorId: curator.id,
    curatorAddress: curator.address,
    name: curator.name,
    logoUrl: curator.logoUrl,
    website: curator.website,
    twitter: curator.twitter,
    jurisdiction: curator.jurisdiction,
    entityType: curator.entityType,
    isRegulated: curator.isRegulated,
    totalAUM,
    vaultCount: vaults.length,
    avgApy,
    avgNetApy,
    assetDistribution,
    lastActive,
    riskScore,
    strategyType,
    tvlChange30d,
    tvlChangePct30d,
  };
}

/**
 * Get paginated curator aggregates with search and sorting
 */
export async function getPaginatedCuratorAggregates(
  options: CuratorQueryOptions = {}
): Promise<PaginatedCuratorsResult> {
  const {
    page = 1,
    pageSize = 20,
    search,
    sortBy = "aum",
    sortOrder = "desc",
  } = options;

  // Build where clause for search
  const whereClause: Record<string, unknown> = {
    vaults: {
      some: {}, // Only curators with at least one vault
    },
  };

  if (search && search.trim()) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search.toLowerCase() } },
    ];
  }

  // Get total count for pagination
  const totalCurators = await prisma.curator.count({
    where: whereClause,
  });

  // Fetch curators with all related data
  const curators = await prisma.curator.findMany({
    where: whereClause,
    include: {
      vaults: {
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 30,
          },
          riskSnapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          transactions: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          reallocations: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      },
    },
  });

  // Calculate aggregates for each curator
  const aggregates: CuratorAggregates[] = [];

  for (const curator of curators) {
    const vaults = curator.vaults;
    if (vaults.length === 0) continue;

    const totalAUM = vaults.reduce((sum, v) => {
      const latestSnapshot = v.snapshots[0];
      return sum + (latestSnapshot?.totalAssetsUsd ?? 0);
    }, 0);

    if (totalAUM === 0) continue;

    let weightedApySum = 0;
    let weightedNetApySum = 0;
    vaults.forEach((v) => {
      const latestSnapshot = v.snapshots[0];
      if (latestSnapshot) {
        const tvl = latestSnapshot.totalAssetsUsd;
        weightedApySum += (latestSnapshot.avgApy ?? 0) * tvl;
        weightedNetApySum += (latestSnapshot.avgNetApy ?? 0) * tvl;
      }
    });
    const avgApy = totalAUM > 0 ? weightedApySum / totalAUM : 0;
    const avgNetApy = totalAUM > 0 ? weightedNetApySum / totalAUM : 0;

    const assetMap: Record<string, number> = {};
    vaults.forEach((v) => {
      const latestSnapshot = v.snapshots[0];
      if (latestSnapshot) {
        assetMap[v.assetSymbol] =
          (assetMap[v.assetSymbol] || 0) + latestSnapshot.totalAssetsUsd;
      }
    });
    const assetDistribution: AssetDistribution[] = Object.entries(assetMap)
      .map(([symbol, amountUsd]) => ({
        symbol,
        amountUsd,
        percentage: totalAUM > 0 ? (amountUsd / totalAUM) * 100 : 0,
      }))
      .sort((a, b) => b.amountUsd - a.amountUsd);

    const lastActivityTimes = vaults
      .map((v) => v.transactions[0]?.timestamp)
      .filter(Boolean) as Date[];
    const lastActive =
      lastActivityTimes.length > 0
        ? new Date(Math.max(...lastActivityTimes.map((d) => d.getTime())))
        : null;

    const riskScores = vaults
      .map((v) => v.riskSnapshots[0]?.concentrationScore)
      .filter(Boolean);
    const highRiskCount = riskScores.filter((s) => s === "high").length;
    const medRiskCount = riskScores.filter((s) => s === "medium").length;
    const riskScore: "low" | "medium" | "high" =
      highRiskCount > vaults.length / 2
        ? "high"
        : highRiskCount > 0 || medRiskCount > vaults.length / 2
          ? "medium"
          : "low";

    const strategyType = classifyCuratorStrategy(vaults, riskScores);
    const { tvlChange30d, tvlChangePct30d } = calculate30dTvlChange(vaults);

    aggregates.push({
      curatorId: curator.id,
      curatorAddress: curator.address,
      name: curator.name,
      logoUrl: curator.logoUrl,
      website: curator.website,
      twitter: curator.twitter,
      jurisdiction: curator.jurisdiction,
      entityType: curator.entityType,
      isRegulated: curator.isRegulated,
      totalAUM,
      vaultCount: vaults.length,
      avgApy,
      avgNetApy,
      assetDistribution,
      lastActive,
      riskScore,
      strategyType,
      tvlChange30d,
      tvlChangePct30d,
    });
  }

  // Sort results
  aggregates.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "aum":
        comparison = a.totalAUM - b.totalAUM;
        break;
      case "vaults":
        comparison = a.vaultCount - b.vaultCount;
        break;
      case "apy":
        comparison = a.avgApy - b.avgApy;
        break;
      case "name":
        comparison = (a.name || a.curatorAddress).localeCompare(b.name || b.curatorAddress);
        break;
    }
    return sortOrder === "desc" ? -comparison : comparison;
  });

  // Apply pagination
  const start = (page - 1) * pageSize;
  const paginatedCurators = aggregates.slice(start, start + pageSize);
  const total = aggregates.length;

  return {
    curators: paginatedCurators,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get aggregate metrics for all curators (non-paginated, for backward compatibility)
 */
export async function getAllCuratorAggregates(): Promise<CuratorAggregates[]> {
  const curators = await prisma.curator.findMany({
    where: {
      vaults: {
        some: {}, // Only curators with at least one vault
      },
    },
    include: {
      vaults: {
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 30,
          },
          riskSnapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          transactions: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          reallocations: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      },
    },
  });

  const aggregates: CuratorAggregates[] = [];

  for (const curator of curators) {
    const vaults = curator.vaults;
    if (vaults.length === 0) continue;

    // Calculate total AUM
    const totalAUM = vaults.reduce((sum, v) => {
      const latestSnapshot = v.snapshots[0];
      return sum + (latestSnapshot?.totalAssetsUsd ?? 0);
    }, 0);

    // Skip curators with 0 AUM
    if (totalAUM === 0) continue;

    // Weighted average APY
    let weightedApySum = 0;
    let weightedNetApySum = 0;
    vaults.forEach((v) => {
      const latestSnapshot = v.snapshots[0];
      if (latestSnapshot) {
        const tvl = latestSnapshot.totalAssetsUsd;
        weightedApySum += (latestSnapshot.avgApy ?? 0) * tvl;
        weightedNetApySum += (latestSnapshot.avgNetApy ?? 0) * tvl;
      }
    });
    const avgApy = totalAUM > 0 ? weightedApySum / totalAUM : 0;
    const avgNetApy = totalAUM > 0 ? weightedNetApySum / totalAUM : 0;

    // Asset distribution
    const assetMap: Record<string, number> = {};
    vaults.forEach((v) => {
      const latestSnapshot = v.snapshots[0];
      if (latestSnapshot) {
        assetMap[v.assetSymbol] =
          (assetMap[v.assetSymbol] || 0) + latestSnapshot.totalAssetsUsd;
      }
    });
    const assetDistribution: AssetDistribution[] = Object.entries(assetMap)
      .map(([symbol, amountUsd]) => ({
        symbol,
        amountUsd,
        percentage: totalAUM > 0 ? (amountUsd / totalAUM) * 100 : 0,
      }))
      .sort((a, b) => b.amountUsd - a.amountUsd);

    // Last activity
    const lastActivityTimes = vaults
      .map((v) => v.transactions[0]?.timestamp)
      .filter(Boolean) as Date[];
    const lastActive =
      lastActivityTimes.length > 0
        ? new Date(Math.max(...lastActivityTimes.map((d) => d.getTime())))
        : null;

    // Aggregate risk score
    const riskScores = vaults
      .map((v) => v.riskSnapshots[0]?.concentrationScore)
      .filter(Boolean);
    const highRiskCount = riskScores.filter((s) => s === "high").length;
    const medRiskCount = riskScores.filter((s) => s === "medium").length;
    const riskScore: "low" | "medium" | "high" =
      highRiskCount > vaults.length / 2
        ? "high"
        : highRiskCount > 0 || medRiskCount > vaults.length / 2
          ? "medium"
          : "low";

    // Strategy classification
    const strategyType = classifyCuratorStrategy(vaults, riskScores);

    // 30-day TVL change
    const { tvlChange30d, tvlChangePct30d } = calculate30dTvlChange(vaults);

    aggregates.push({
      curatorId: curator.id,
      curatorAddress: curator.address,
      name: curator.name,
      logoUrl: curator.logoUrl,
      website: curator.website,
      twitter: curator.twitter,
      jurisdiction: curator.jurisdiction,
      entityType: curator.entityType,
      isRegulated: curator.isRegulated,
      totalAUM,
      vaultCount: vaults.length,
      avgApy,
      avgNetApy,
      assetDistribution,
      lastActive,
      riskScore,
      strategyType,
      tvlChange30d,
      tvlChangePct30d,
    });
  }

  // Sort by total AUM descending
  return aggregates.sort((a, b) => b.totalAUM - a.totalAUM);
}

/**
 * Get summary stats across all curators
 */
export async function getCuratorSummaryStats(): Promise<CuratorSummaryStats> {
  const aggregates = await getAllCuratorAggregates();

  const totalCurators = aggregates.length;
  const totalAUM = aggregates.reduce((sum, c) => sum + c.totalAUM, 0);
  const totalVaults = aggregates.reduce((sum, c) => sum + c.vaultCount, 0);

  // Weighted average APY across all curators
  const weightedApySum = aggregates.reduce(
    (sum, c) => sum + c.avgApy * c.totalAUM,
    0
  );
  const avgApy = totalAUM > 0 ? weightedApySum / totalAUM : 0;

  return {
    totalCurators,
    totalAUM,
    totalVaults,
    avgApy,
  };
}

/**
 * Classify curator strategy based on vault risk profiles and behavior
 *
 * Conservative: Low concentration, diversified, steady management, liquidity buffer
 * Moderate: Balanced risk-return profile
 * Aggressive: High concentration, active management, yield-focused
 */
function classifyCuratorStrategy(
  vaults: Array<{
    riskSnapshots: Array<{
      concentrationScore: string;
      liquidityScore: string;
      topAdapterPercent?: number;
      idleAssetsPercent?: number;
    }>;
    reallocations: Array<{ timestamp: Date }>;
  }>,
  riskScores: string[]
): "Conservative" | "Moderate" | "Aggressive" {
  if (vaults.length === 0) return "Moderate";

  // Scoring system: track conservative and aggressive signals
  let conservativeScore = 0;
  let aggressiveScore = 0;

  // Factor 1: Risk score distribution
  const highRiskCount = riskScores.filter((s) => s === "high").length;
  const lowRiskCount = riskScores.filter((s) => s === "low").length;

  if (lowRiskCount >= vaults.length * 0.6) {
    conservativeScore += 2;
  } else if (highRiskCount >= vaults.length * 0.4) {
    aggressiveScore += 2;
  }

  // Factor 2: Average concentration across vaults
  const concentrations = vaults
    .map((v) => v.riskSnapshots[0]?.topAdapterPercent)
    .filter((c): c is number => c !== undefined && c !== null);

  if (concentrations.length > 0) {
    const avgConcentration =
      concentrations.reduce((a, b) => a + b, 0) / concentrations.length;

    if (avgConcentration < 40) {
      conservativeScore += 2; // Well diversified
    } else if (avgConcentration > 70) {
      aggressiveScore += 2; // Highly concentrated
    }
  }

  // Factor 3: Reallocation frequency (per month)
  const totalReallocations = vaults.reduce(
    (sum, v) => sum + v.reallocations.length,
    0
  );
  const reallocationFreqPerMonth = totalReallocations; // Already filtered to 30 days

  if (reallocationFreqPerMonth < 4) {
    conservativeScore += 1; // Less than 1/week - steady approach
  } else if (reallocationFreqPerMonth > 15) {
    aggressiveScore += 2; // More than 3/week - active management
  }

  // Factor 4: Idle assets (liquidity buffer)
  const idlePercents = vaults
    .map((v) => v.riskSnapshots[0]?.idleAssetsPercent)
    .filter((i): i is number => i !== undefined && i !== null);

  if (idlePercents.length > 0) {
    const avgIdleAssets =
      idlePercents.reduce((a, b) => a + b, 0) / idlePercents.length;

    if (avgIdleAssets > 15) {
      conservativeScore += 1; // High liquidity buffer
    } else if (avgIdleAssets < 5) {
      aggressiveScore += 1; // Fully deployed - yield maximizing
    }
  }

  // Factor 5: Vault count (diversification across strategies)
  if (vaults.length >= 5) {
    conservativeScore += 1; // Well diversified curator
  } else if (vaults.length <= 2) {
    aggressiveScore += 1; // Concentrated in few vaults
  }

  // Classification based on scores
  if (conservativeScore >= 4 && aggressiveScore < 2) {
    return "Conservative";
  } else if (aggressiveScore >= 4 && conservativeScore < 2) {
    return "Aggressive";
  } else {
    return "Moderate";
  }
}

/**
 * Calculate 30-day TVL change across all curator vaults
 */
function calculate30dTvlChange(
  vaults: Array<{
    snapshots: Array<{
      totalAssetsUsd: number;
      timestamp: Date;
    }>;
  }>
): { tvlChange30d: number; tvlChangePct30d: number } {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let currentTvl = 0;
  let pastTvl = 0;

  vaults.forEach((v) => {
    // Current TVL (latest snapshot)
    const latest = v.snapshots[0];
    if (latest) {
      currentTvl += latest.totalAssetsUsd;
    }

    // Find snapshot closest to 30 days ago
    const oldSnapshot = v.snapshots.find(
      (s) => s.timestamp.getTime() <= thirtyDaysAgo
    );
    if (oldSnapshot) {
      pastTvl += oldSnapshot.totalAssetsUsd;
    } else if (v.snapshots.length > 0) {
      // If no snapshot from 30 days ago, use oldest available
      pastTvl += v.snapshots[v.snapshots.length - 1].totalAssetsUsd;
    }
  });

  const tvlChange30d = currentTvl - pastTvl;
  const tvlChangePct30d = pastTvl > 0 ? ((currentTvl - pastTvl) / pastTvl) * 100 : 0;

  return { tvlChange30d, tvlChangePct30d };
}

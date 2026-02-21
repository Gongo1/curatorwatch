/**
 * Curator aggregate metrics - SIMPLIFIED for performance
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
 * Get paginated curator aggregates - SIMPLIFIED
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

  // Build where clause
  const whereClause: Record<string, unknown> = {
    vaults: { some: {} },
  };

  if (search && search.trim()) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search.toLowerCase() } },
    ];
  }

  // Single query - minimal includes
  const [totalCurators, curators] = await Promise.all([
    prisma.curator.count({ where: whereClause }),
    prisma.curator.findMany({
      where: whereClause,
      include: {
        vaults: {
          include: {
            snapshots: {
              orderBy: { timestamp: "desc" },
              take: 1, // Only latest snapshot
            },
          },
        },
      },
    }),
  ]);

  // Calculate aggregates
  const aggregates: CuratorAggregates[] = [];

  for (const curator of curators) {
    const vaults = curator.vaults;
    if (vaults.length === 0) continue;

    let totalAUM = 0;
    let weightedApySum = 0;
    let weightedNetApySum = 0;
    const assetMap: Record<string, number> = {};

    for (const vault of vaults) {
      const snap = vault.snapshots[0];
      if (!snap) continue;

      const tvl = snap.totalAssetsUsd;
      totalAUM += tvl;
      weightedApySum += (snap.avgApy ?? 0) * tvl;
      weightedNetApySum += (snap.avgNetApy ?? 0) * tvl;
      assetMap[vault.assetSymbol] = (assetMap[vault.assetSymbol] || 0) + tvl;
    }

    if (totalAUM === 0) continue;

    const avgApy = weightedApySum / totalAUM;
    const avgNetApy = weightedNetApySum / totalAUM;

    const assetDistribution = Object.entries(assetMap)
      .map(([symbol, amountUsd]) => ({
        symbol,
        amountUsd,
        percentage: (amountUsd / totalAUM) * 100,
      }))
      .sort((a, b) => b.amountUsd - a.amountUsd);

    // Simplified risk/strategy based on APY
    const riskScore: "low" | "medium" | "high" =
      avgNetApy > 0.10 ? "high" : avgNetApy > 0.05 ? "medium" : "low";
    const strategyType: "Conservative" | "Moderate" | "Aggressive" =
      avgNetApy > 0.10 ? "Aggressive" : avgNetApy > 0.05 ? "Moderate" : "Conservative";

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
      lastActive: null,
      riskScore,
      strategyType,
      tvlChange30d: 0,
      tvlChangePct30d: 0,
    });
  }

  // Sort
  aggregates.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "aum": cmp = a.totalAUM - b.totalAUM; break;
      case "vaults": cmp = a.vaultCount - b.vaultCount; break;
      case "apy": cmp = a.avgNetApy - b.avgNetApy; break;
      case "name": cmp = (a.name ?? "").localeCompare(b.name ?? ""); break;
    }
    return sortOrder === "desc" ? -cmp : cmp;
  });

  // Paginate
  const start = (page - 1) * pageSize;
  const paged = aggregates.slice(start, start + pageSize);

  return {
    curators: paged,
    total: aggregates.length,
    page,
    pageSize,
    totalPages: Math.ceil(aggregates.length / pageSize),
  };
}

/**
 * Get summary stats - SIMPLIFIED
 */
export async function getCuratorSummaryStats(): Promise<CuratorSummaryStats> {
  const curators = await prisma.curator.findMany({
    where: { vaults: { some: {} } },
    include: {
      vaults: {
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  let totalAUM = 0;
  let totalVaults = 0;
  let weightedApySum = 0;

  for (const curator of curators) {
    for (const vault of curator.vaults) {
      const snap = vault.snapshots[0];
      if (!snap) continue;

      const tvl = snap.totalAssetsUsd;
      totalAUM += tvl;
      weightedApySum += (snap.avgNetApy ?? 0) * tvl;
      totalVaults++;
    }
  }

  return {
    totalCurators: curators.length,
    totalAUM,
    totalVaults,
    avgApy: totalAUM > 0 ? weightedApySum / totalAUM : 0,
  };
}

/**
 * Get single curator aggregates
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
            take: 1,
          },
        },
      },
    },
  });

  if (!curator) return null;

  const vaults = curator.vaults;
  let totalAUM = 0;
  let weightedApySum = 0;
  let weightedNetApySum = 0;
  const assetMap: Record<string, number> = {};

  for (const vault of vaults) {
    const snap = vault.snapshots[0];
    if (!snap) continue;

    const tvl = snap.totalAssetsUsd;
    totalAUM += tvl;
    weightedApySum += (snap.avgApy ?? 0) * tvl;
    weightedNetApySum += (snap.avgNetApy ?? 0) * tvl;
    assetMap[vault.assetSymbol] = (assetMap[vault.assetSymbol] || 0) + tvl;
  }

  const avgApy = totalAUM > 0 ? weightedApySum / totalAUM : 0;
  const avgNetApy = totalAUM > 0 ? weightedNetApySum / totalAUM : 0;

  const assetDistribution = Object.entries(assetMap)
    .map(([symbol, amountUsd]) => ({
      symbol,
      amountUsd,
      percentage: totalAUM > 0 ? (amountUsd / totalAUM) * 100 : 0,
    }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const riskScore: "low" | "medium" | "high" =
    avgNetApy > 0.10 ? "high" : avgNetApy > 0.05 ? "medium" : "low";
  const strategyType: "Conservative" | "Moderate" | "Aggressive" =
    avgNetApy > 0.10 ? "Aggressive" : avgNetApy > 0.05 ? "Moderate" : "Conservative";

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
    lastActive: null,
    riskScore,
    strategyType,
    tvlChange30d: 0,
    tvlChangePct30d: 0,
  };
}

/**
 * Curator aggregate metrics - SIMPLIFIED for performance
 */

import { prisma } from "@/lib/db";
import { EXCLUDED_CURATORS } from "@/lib/curator-aliases";
import { sanitizeApy, sanitizeApyPct, sanitizeApyForStorage } from "@/lib/utils/sanitize-apy";
import { getAllCuratorRatings } from "@/lib/curator-engine-rating";
import { stablecoinSharePct } from "@/lib/utils/asset-class";

export interface AssetDistribution {
  symbol: string;
  amountUsd: number;
  percentage: number;
}

/** Slim per-vault row for the compare feed: real per-vault net APY (percent),
 *  unit-reconciled across Morpho (snapshot decimal) and Turtle (netAPR percent). */
export interface CompareVault {
  address: string;
  name: string;
  assetSymbol: string;
  grade: string | null;
  tvl: number;
  netApyPct: number | null;
}

/** Per-vault net APY in PERCENT, reconciling the two unit conventions: Turtle
 *  stores netAPR as a percentage on the Vault row; Morpho stores a decimal on the
 *  snapshot. Returns null when implausible/missing so the UI shows "—", never 0. */
function vaultNetApyPct(netAPR: number | null, snapAvgNetApy: number | null): number | null {
  if (netAPR != null) return sanitizeApyPct(netAPR);
  const dec = sanitizeApyForStorage(snapAvgNetApy);
  return dec == null ? null : dec * 100;
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
  /** Stablecoin share of this curator's AUM (0–100), per the canonical classifier. */
  stablePct: number;
  /** Per-vault rows for the compare dispersion view. */
  vaults: CompareVault[];
  protocols: string[];
  networks: string[];
  gradeDistribution: { high: number; medium: number; low: number };
  /** Loss-anchored engine grade; null unless the rating feature is enabled and the curator is rated. */
  engineRating: { grade: string; elMedian: number } | null;
  dataSources: string[];
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
  dataSource?: string;
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
    dataSource,
  } = options;

  // Build where clause
  const vaultFilter: Record<string, unknown> = {};
  if (dataSource) {
    vaultFilter.dataSource = dataSource;
  }

  const vaultSome = Object.keys(vaultFilter).length > 0 ? vaultFilter : {};

  // Always-applied filters:
  // - Exclude synthetic distributor-derived curators (legacy `turtle-<slug>` rows).
  //   Turtle is a data source, not a curator; these must never appear in the directory
  //   or contribute to curator TVL. (Belt-and-suspenders behind the cleanup migration.)
  // - Exclude explicitly excluded curators by name.
  // - Require at least one vault matching the dataSource filter.
  const baseFilters: Record<string, unknown>[] = [
    { address: { not: { startsWith: "turtle-" } } },
    { vaults: { some: vaultSome } },
  ];
  if (EXCLUDED_CURATORS.length > 0) {
    baseFilters.push({ name: { notIn: EXCLUDED_CURATORS } });
  }

  const whereClause: Record<string, unknown> = { AND: [...baseFilters] };

  if (search && search.trim()) {
    const trimmed = search.trim();
    (whereClause.AND as Record<string, unknown>[]).push({
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { address: { contains: trimmed, mode: "insensitive" } },
      ],
    });
  }

  // Sequential queries to minimize connection pressure
  const curators = await prisma.curator.findMany({
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
  });
  const totalCurators = curators.length;

  // Loss-anchored engine grades, keyed by lowercased curator address. Empty when
  // the rating feature is off (getAllCuratorRatings returns [] behind the flag),
  // so this is a no-op until the flag is enabled.
  const ratingByAddress = new Map<string, { grade: string; elMedian: number }>();
  for (const r of await getAllCuratorRatings()) {
    ratingByAddress.set(r.curatorAddress.toLowerCase(), { grade: r.grade, elMedian: r.elMedian });
  }

  // Calculate aggregates
  const aggregates: CuratorAggregates[] = [];

  for (const curator of curators) {
    const vaults = dataSource
      ? curator.vaults.filter((v) => (v as Record<string, unknown>).dataSource === dataSource)
      : curator.vaults;
    if (vaults.length === 0) continue;

    let totalAUM = 0;
    let weightedApySum = 0;
    let weightedNetApySum = 0;
    const assetMap: Record<string, number> = {};
    const protocolSet = new Set<string>();
    const networkSet = new Set<string>();
    const gradeDistribution = { high: 0, medium: 0, low: 0 };
    const sourceSet = new Set<string>();
    const vaultRows: CompareVault[] = [];

    for (const vault of vaults) {
      // Vault grade + ingestion source are independent of snapshots.
      const grade = (vault as Record<string, unknown>).grade as string | null;
      if (grade === "high-grade") gradeDistribution.high++;
      else if (grade === "medium-grade") gradeDistribution.medium++;
      else if (grade === "low-grade") gradeDistribution.low++;
      sourceSet.add(
        ((vault as Record<string, unknown>).dataSource as string) ?? "morpho"
      );

      const snap = vault.snapshots[0];
      if (!snap) continue;

      const tvl = snap.totalAssetsUsd;
      totalAUM += tvl;
      weightedApySum += sanitizeApy(snap.avgApy) * tvl;
      weightedNetApySum += sanitizeApy(snap.avgNetApy) * tvl;
      assetMap[vault.assetSymbol] = (assetMap[vault.assetSymbol] || 0) + tvl;
      protocolSet.add(vault.protocol ?? "morpho");
      networkSet.add((vault as Record<string, unknown>).chainName as string ?? "Ethereum");
      vaultRows.push({
        address: vault.address,
        name: vault.name,
        assetSymbol: vault.assetSymbol,
        grade,
        tvl,
        netApyPct: vaultNetApyPct(vault.netAPR, snap.avgNetApy),
      });
    }
    vaultRows.sort((a, b) => b.tvl - a.tvl);

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
      stablePct: stablecoinSharePct(assetDistribution),
      vaults: vaultRows,
      protocols: Array.from(protocolSet),
      networks: Array.from(networkSet),
      gradeDistribution,
      engineRating: ratingByAddress.get(curator.address.toLowerCase()) ?? null,
      dataSources: Array.from(sourceSet),
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
      case "apy": cmp = a.totalAUM - b.totalAUM; break; // Fallback to AUM sort if APY requested
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
 * Get summary stats - computed from aggregates to avoid duplicate DB query
 */
export async function getCuratorSummaryStats(): Promise<CuratorSummaryStats> {
  // Reuse the paginated query with a large page size to get all curators
  const result = await getPaginatedCuratorAggregates({ page: 1, pageSize: 500 });

  let totalAUM = 0;
  let totalVaults = 0;
  let weightedApySum = 0;

  for (const curator of result.curators) {
    totalAUM += curator.totalAUM;
    totalVaults += curator.vaultCount;
    weightedApySum += curator.avgNetApy * curator.totalAUM;
  }

  return {
    totalCurators: result.total,
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
  const protocolSet = new Set<string>();
  const networkSet = new Set<string>();
  const gradeDistribution = { high: 0, medium: 0, low: 0 };
  const sourceSet = new Set<string>();
  const vaultRows: CompareVault[] = [];

  for (const vault of vaults) {
    const grade = (vault as Record<string, unknown>).grade as string | null;
    if (grade === "high-grade") gradeDistribution.high++;
    else if (grade === "medium-grade") gradeDistribution.medium++;
    else if (grade === "low-grade") gradeDistribution.low++;
    sourceSet.add(
      ((vault as Record<string, unknown>).dataSource as string) ?? "morpho"
    );

    const snap = vault.snapshots[0];
    if (!snap) continue;

    const tvl = snap.totalAssetsUsd;
    totalAUM += tvl;
    weightedApySum += sanitizeApy(snap.avgApy) * tvl;
    weightedNetApySum += sanitizeApy(snap.avgNetApy) * tvl;
    assetMap[vault.assetSymbol] = (assetMap[vault.assetSymbol] || 0) + tvl;
    protocolSet.add((vault as Record<string, unknown>).protocol as string ?? "morpho");
    networkSet.add((vault as Record<string, unknown>).chainName as string ?? "Ethereum");
    vaultRows.push({
      address: vault.address,
      name: vault.name,
      assetSymbol: vault.assetSymbol,
      grade,
      tvl,
      netApyPct: vaultNetApyPct(vault.netAPR, snap.avgNetApy),
    });
  }
  vaultRows.sort((a, b) => b.tvl - a.tvl);

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

  const rating = (await getAllCuratorRatings()).find(
    (r) => r.curatorAddress.toLowerCase() === curator.address.toLowerCase()
  );
  const engineRating = rating ? { grade: rating.grade, elMedian: rating.elMedian } : null;

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
    stablePct: stablecoinSharePct(assetDistribution),
    vaults: vaultRows,
    protocols: Array.from(protocolSet),
    networks: Array.from(networkSet),
    gradeDistribution,
    engineRating,
    dataSources: Array.from(sourceSet),
    lastActive: null,
    riskScore,
    strategyType,
    tvlChange30d: 0,
    tvlChangePct30d: 0,
  };
}

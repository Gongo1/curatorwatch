import { cache } from "react";
import { prisma } from "@/lib/db";
import { resolveCuratorSlug } from "@/lib/curator-aliases";
import { sanitizeApyPct, sanitizeApyForStorage } from "@/lib/utils/sanitize-apy";
import { prettyChainName } from "@/lib/turtle/chain-mapper";
import type {
  CuratorProfile,
  CuratorNewsItem,
  CuratorVaultSummary,
  CuratorAumPoint,
  CuratorTimelineEntry,
  LiquidationSummary,
  LiquidationEvent,
} from "@/lib/types/api";

/**
 * Classify curator strategy based on vault risk profiles
 */
function classifyStrategy(
  vaults: Array<{
    riskSnapshots: Array<{
      concentrationScore: string;
      topAdapterPercent: number;
      idleAssetsPercent: number;
    }>;
    reallocations: Array<{ id: string }>;
  }>
): { strategyType: "Conservative" | "Moderate" | "Aggressive" } {
  if (vaults.length === 0) return { strategyType: "Moderate" };

  const riskScores = vaults
    .map((v) => v.riskSnapshots[0]?.concentrationScore)
    .filter(Boolean);

  const highRiskCount = riskScores.filter((s) => s === "high").length;
  const lowRiskCount = riskScores.filter((s) => s === "low").length;

  // Strategy scoring
  let conservativeScore = 0;
  let aggressiveScore = 0;

  // Factor 1: Risk score distribution
  if (lowRiskCount >= vaults.length * 0.6) {
    conservativeScore += 2;
  } else if (highRiskCount >= vaults.length * 0.4) {
    aggressiveScore += 2;
  }

  // Factor 2: Average concentration
  const concentrations = vaults
    .map((v) => v.riskSnapshots[0]?.topAdapterPercent)
    .filter((c): c is number => c !== undefined && c !== null);

  if (concentrations.length > 0) {
    const avgConcentration = concentrations.reduce((a, b) => a + b, 0) / concentrations.length;
    if (avgConcentration < 40) {
      conservativeScore += 2;
    } else if (avgConcentration > 70) {
      aggressiveScore += 2;
    }
  }

  // Factor 3: Reallocation frequency
  const totalReallocations = vaults.reduce((sum, v) => sum + v.reallocations.length, 0);
  if (totalReallocations < 4) {
    conservativeScore += 1;
  } else if (totalReallocations > 15) {
    aggressiveScore += 2;
  }

  // Factor 4: Idle assets
  const idlePercents = vaults
    .map((v) => v.riskSnapshots[0]?.idleAssetsPercent)
    .filter((i): i is number => i !== undefined && i !== null);

  if (idlePercents.length > 0) {
    const avgIdleAssets = idlePercents.reduce((a, b) => a + b, 0) / idlePercents.length;
    if (avgIdleAssets > 15) {
      conservativeScore += 1;
    } else if (avgIdleAssets < 5) {
      aggressiveScore += 1;
    }
  }

  // Factor 5: Vault count
  if (vaults.length >= 5) {
    conservativeScore += 1;
  } else if (vaults.length <= 2) {
    aggressiveScore += 1;
  }

  // Classification
  const strategyType: "Conservative" | "Moderate" | "Aggressive" =
    conservativeScore >= 4 && aggressiveScore < 2
      ? "Conservative"
      : aggressiveScore >= 4 && conservativeScore < 2
        ? "Aggressive"
        : "Moderate";

  return { strategyType };
}

export interface CuratorDetail {
  curator: CuratorProfile;
  vaults: CuratorVaultSummary[];
  news: CuratorNewsItem[];
  liquidationSummary: LiquidationSummary;
  aumHistory: CuratorAumPoint[];
  timeline: CuratorTimelineEntry[];
  dataAsOf: string | null;
}

/**
 * Full curator detail (profile, vaults, news, liquidations) for the curator
 * page and the /api/curators/[address] route. Returns null when the curator
 * doesn't exist. React-cached so generateMetadata and the page body share
 * one query per render pass.
 */
export const fetchCuratorDetail = cache(async function fetchCuratorDetail(
  addressOrSlug: string
): Promise<CuratorDetail | null> {
  const resolvedAddress = await resolveCuratorSlug(addressOrSlug);

  // Fetch curator by address with risk data for strategy calculation
  const curator = await prisma.curator.findUnique({
    where: { address: resolvedAddress },
    include: {
      news: {
        orderBy: { publishedAt: "desc" },
        take: 10,
      },
      vaults: {
        include: {
          snapshots: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          riskSnapshots: {
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

  // Calculate strategy classification
  const { strategyType } = classifyStrategy(curator.vaults);

  // Transform curator data
  const curatorData: CuratorProfile = {
    id: curator.id,
    address: curator.address,
    name: curator.name,
    website: curator.website,
    twitter: curator.twitter,
    discord: curator.discord,
    email: curator.email,
    legalName: curator.legalName,
    entityType: curator.entityType,
    jurisdiction: curator.jurisdiction,
    registeredState: curator.registeredState,
    headquarters: curator.headquarters,
    description: curator.description,
    foundedYear: curator.foundedYear,
    teamSize: curator.teamSize,
    isRegulated: curator.isRegulated,
    regulatoryBody: curator.regulatoryBody,
    licenses: curator.licenses as string[] | null,
    logoUrl: curator.logoUrl,
    totalAssetsManaged: curator.totalAssetsManaged ?? 0,
    vaultCount: curator.vaultCount ?? 0,
    createdAt: curator.createdAt.toISOString(),
    updatedAt: curator.updatedAt.toISOString(),
    strategyType,
  };

  // Transform vaults data
  const vaults: CuratorVaultSummary[] = curator.vaults.map((vault) => {
    const snapshot = vault.snapshots[0];
    return {
      id: vault.id,
      address: vault.address,
      chainId: vault.chainId,
      name: vault.name,
      symbol: vault.symbol,
      asset: {
        address: vault.assetAddress,
        symbol: vault.assetSymbol,
        decimals: vault.assetDecimals,
      },
      performanceFee: vault.performanceFee ?? 0,
      protocol: vault.protocol ?? "morpho",
      dataSource: vault.dataSource ?? "morpho",
      warnings: (vault.warnings as Array<{ type: string; level: string }>) ?? [],
      listed: vault.listed ?? true,
      creationTimestamp: vault.creationTimestamp ?? null,
      chainName: prettyChainName(vault.chainName, vault.chainId),
      // Implausible APYs (e.g. a Turtle-reported 5,769%) become null → "—",
      // and are excluded from yield math, rather than shown or trusted.
      netAPR: sanitizeApyPct(vault.netAPR),
      estTotalAPR: sanitizeApyPct(vault.estTotalAPR),
      dealOpportunityId: vault.dealOpportunityId ?? null,
      dealDepositable: vault.dealDepositable ?? false,
      dealEstApr: sanitizeApyPct(vault.dealEstApr),
      latestSnapshot: snapshot
        ? {
            totalAssets: snapshot.totalAssets,
            totalAssetsUsd: snapshot.totalAssetsUsd,
            totalSupply: snapshot.totalSupply,
            sharePrice: snapshot.sharePrice,
            liquidity: snapshot.liquidity,
            liquidityUsd: snapshot.liquidityUsd,
            apy: sanitizeApyForStorage(snapshot.apy),
            netApy: sanitizeApyForStorage(snapshot.netApy),
            avgApy: sanitizeApyForStorage(snapshot.avgApy),
            avgNetApy: sanitizeApyForStorage(snapshot.avgNetApy),
            timestamp: snapshot.timestamp.toISOString(),
          }
        : null,
    };
  });

  // Sort vaults by TVL
  vaults.sort(
    (a, b) =>
      (b.latestSnapshot?.totalAssetsUsd ?? 0) -
      (a.latestSnapshot?.totalAssetsUsd ?? 0)
  );

  // Collect market keys from all vault allocations and query liquidations
  const allMarketKeys = await prisma.marketAllocation.findMany({
    where: {
      vault: { curatorId: curator.id },
    },
    select: { marketUniqueKey: true },
    distinct: ["marketUniqueKey"],
  });
  const marketKeys = allMarketKeys.map((m) => m.marketUniqueKey);

  let liquidationSummary: LiquidationSummary = {
    total: 0,
    totalBadDebtUsd: 0,
    totalSeizedUsd: 0,
    totalRepaidUsd: 0,
    recent30d: 0,
    events: [],
  };

  if (marketKeys.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allLiquidations, recent30dCount] = await Promise.all([
      prisma.liquidation.findMany({
        where: { marketUniqueKey: { in: marketKeys } },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
      prisma.liquidation.count({
        where: {
          marketUniqueKey: { in: marketKeys },
          timestamp: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const aggregates = await prisma.liquidation.aggregate({
      where: { marketUniqueKey: { in: marketKeys } },
      _count: true,
      _sum: {
        badDebtAssetsUsd: true,
        seizedAssetsUsd: true,
        repaidAssetsUsd: true,
      },
    });

    const events: LiquidationEvent[] = allLiquidations.map((l) => ({
      txHash: l.txHash,
      timestamp: l.timestamp.toISOString(),
      marketUniqueKey: l.marketUniqueKey,
      borrower: l.borrower,
      liquidator: l.liquidator,
      repaidAssetsUsd: l.repaidAssetsUsd,
      seizedAssetsUsd: l.seizedAssetsUsd,
      badDebtAssetsUsd: l.badDebtAssetsUsd,
    }));

    liquidationSummary = {
      total: aggregates._count,
      totalBadDebtUsd: aggregates._sum.badDebtAssetsUsd ?? 0,
      totalSeizedUsd: aggregates._sum.seizedAssetsUsd ?? 0,
      totalRepaidUsd: aggregates._sum.repaidAssetsUsd ?? 0,
      recent30d: recent30dCount,
      events,
    };
  }

  // ── Track record: AUM history (hourly snapshots downsampled to daily) ──
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rawSnapshots = await prisma.curatorSnapshot.findMany({
    where: { curatorId: curator.id, timestamp: { gte: ninetyDaysAgo } },
    orderBy: { timestamp: "asc" },
    select: { totalAssetsUsd: true, vaultCount: true, timestamp: true },
  });
  // Last snapshot per UTC day = the day's closing value.
  const byDay = new Map<string, CuratorAumPoint>();
  for (const s of rawSnapshots) {
    const date = s.timestamp.toISOString().slice(0, 10);
    byDay.set(date, { date, aumUsd: s.totalAssetsUsd, vaultCount: s.vaultCount });
  }
  const aumHistory = Array.from(byDay.values());

  // ── Per-curator timeline: vault changes + curator-scoped platform alerts ──
  const vaultIds = curator.vaults.map((v) => v.id);
  const vaultById = new Map(curator.vaults.map((v) => [v.id, v]));
  const [vaultChanges, platformAlerts] = await Promise.all([
    vaultIds.length > 0
      ? prisma.vaultChange.findMany({
          where: { vaultId: { in: vaultIds } },
          orderBy: { detectedAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.platformAlert.findMany({
      where: { scope: "curator", curatorId: curator.id },
      orderBy: { detectedAt: "desc" },
      take: 25,
    }),
  ]);
  const timeline: CuratorTimelineEntry[] = [
    ...vaultChanges.map((c) => ({
      id: c.id,
      source: "vault" as const,
      vaultAddress: vaultById.get(c.vaultId)?.address ?? null,
      vaultName: vaultById.get(c.vaultId)?.name ?? null,
      changeType: c.changeType,
      severity: c.severity,
      title: c.title,
      description: c.description,
      detectedAt: c.detectedAt.toISOString(),
    })),
    ...platformAlerts.map((a) => ({
      id: a.id,
      source: "curator" as const,
      vaultAddress: null,
      vaultName: null,
      changeType: a.changeType,
      severity: a.severity,
      title: a.title,
      description: a.description,
      detectedAt: a.detectedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
    .slice(0, 25);

  // Transform news data
  const news: CuratorNewsItem[] = curator.news.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt.toISOString(),
    sentiment: item.sentiment,
    category: item.category,
    createdAt: item.createdAt.toISOString(),
  }));

  // Freshness: the most recent snapshot any of this curator's vaults carries —
  // i.e. when the data on this page was last collected by the cron.
  const dataAsOf =
    vaults
      .map((v) => v.latestSnapshot?.timestamp)
      .filter((t): t is string => !!t)
      .sort()
      .at(-1) ?? null;

  return {
    curator: curatorData,
    vaults,
    news,
    liquidationSummary,
    aumHistory,
    timeline,
    dataAsOf,
  };
});

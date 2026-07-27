import { cache } from "react";
import { prisma } from "@/lib/db";
import { sanitizeApyPct, sanitizeApyForStorage } from "@/lib/utils/sanitize-apy";
import { prettyChainName } from "@/lib/turtle/chain-mapper";
import type { VaultDetail } from "@/lib/types/api";

/**
 * Full vault detail (snapshots, adapters, curator, liquidations)
 * for the vault page and the /api/vaults/[address] route.
 * Returns null when the vault doesn't exist. React-cached so
 * generateMetadata and the page body share one query per render pass.
 */
export const fetchVaultDetail = cache(async function fetchVaultDetail(
  address: string
): Promise<VaultDetail | null> {
  // Fetch vault with snapshots, allocations, and curator
  const vault = await prisma.vault.findFirst({
    where: {
      address: {
        equals: address,
        mode: "insensitive",
      },
    },
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 100,
      },
      adapterAllocations: {
        orderBy: { snapshotTime: "desc" },
      },
      marketAllocations: {
        orderBy: { snapshotTime: "desc" },
      },
      curator: {
        include: {
          news: {
            orderBy: { publishedAt: "desc" },
            take: 5,
          },
          vaults: {
            include: {
              snapshots: {
                orderBy: { timestamp: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!vault) return null;

  // Get only the latest adapter allocations (same snapshotTime)
  const latestAllocations = getLatestAllocations(vault.adapterAllocations);

  // Calculate idle assets (totalAssets - sum of allocated assets)
  const latestSnapshot = vault.snapshots[0];
  const totalAssets = latestSnapshot ? BigInt(latestSnapshot.totalAssets) : 0n;
  const allocatedAssets = latestAllocations.reduce(
    (sum, a) => sum + BigInt(a.assets),
    0n
  );
  const idleAssets = totalAssets - allocatedAssets;
  const idleAssetsUsd = latestSnapshot
    ? (Number(idleAssets) / Number(totalAssets)) * latestSnapshot.totalAssetsUsd
    : 0;

  // Build curator data if available
  const curatorData = vault.curator
    ? {
        id: vault.curator.id,
        address: vault.curator.address,
        name: vault.curator.name,
        website: vault.curator.website,
        twitter: vault.curator.twitter,
        discord: vault.curator.discord,
        legalName: vault.curator.legalName,
        entityType: vault.curator.entityType,
        jurisdiction: vault.curator.jurisdiction,
        registeredState: vault.curator.registeredState,
        headquarters: vault.curator.headquarters,
        description: vault.curator.description,
        foundedYear: vault.curator.foundedYear,
        teamSize: vault.curator.teamSize,
        isRegulated: vault.curator.isRegulated,
        regulatoryBody: vault.curator.regulatoryBody,
        logoUrl: vault.curator.logoUrl,
        totalAssetsManaged: vault.curator.totalAssetsManaged ?? 0,
        vaultCount: vault.curator.vaultCount ?? 0,
        news: vault.curator.news.map((n) => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
          url: n.url,
          source: n.source,
          publishedAt: n.publishedAt.toISOString(),
          sentiment: n.sentiment,
          category: n.category,
        })),
        otherVaults: vault.curator.vaults
          .filter((v) => v.id !== vault.id)
          .map((v) => ({
            id: v.id,
            address: v.address,
            name: v.name,
            symbol: v.symbol,
            dataSource: v.dataSource,
            warnings: (v.warnings as Array<{ type: string; level: string }>) ?? [],
            listed: v.listed ?? true,
            totalAssetsUsd: v.snapshots[0]?.totalAssetsUsd ?? 0,
            avgNetApy: v.snapshots[0]?.avgNetApy ?? null,
          }))
          .sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd),
      }
    : null;

  // Get latest market allocations
  const latestMarketAllocations = getLatestMarketAllocations(vault.marketAllocations);

  // Get liquidation data for this vault's markets
  const vaultMarketKeys = latestMarketAllocations.map((m) => m.marketUniqueKey);
  let liquidations: Array<{
    txHash: string;
    timestamp: string;
    marketUniqueKey: string;
    borrower: string;
    liquidator: string;
    repaidAssetsUsd: number;
    seizedAssetsUsd: number;
    badDebtAssetsUsd: number;
  }> = [];
  let liquidationSummary = {
    total: 0,
    totalBadDebtUsd: 0,
    totalSeizedUsd: 0,
    totalRepaidUsd: 0,
    recent30d: 0,
  };

  if (vaultMarketKeys.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [liqEvents, recent30dCount, aggregates] = await Promise.all([
      prisma.liquidation.findMany({
        where: { marketUniqueKey: { in: vaultMarketKeys } },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
      prisma.liquidation.count({
        where: {
          marketUniqueKey: { in: vaultMarketKeys },
          timestamp: { gte: thirtyDaysAgo },
        },
      }),
      prisma.liquidation.aggregate({
        where: { marketUniqueKey: { in: vaultMarketKeys } },
        _count: true,
        _sum: {
          badDebtAssetsUsd: true,
          seizedAssetsUsd: true,
          repaidAssetsUsd: true,
        },
      }),
    ]);

    liquidations = liqEvents.map((l) => ({
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
    };
  }

  // Calculate yield metrics
  const tvl = latestSnapshot?.totalAssetsUsd || 0;
  const isTurtle = vault.dataSource === "turtle";
  const vaultOriginMs = vault.creationTimestamp
    ? vault.creationTimestamp * 1000
    : new Date(vault.createdAt).getTime();
  const vaultAgeMs = Date.now() - vaultOriginMs;
  const vaultAgeDays = vaultAgeMs / (24 * 60 * 60 * 1000);

  // Implausible APYs (e.g. a Turtle-reported 5,769%) are suppressed so they
  // never feed yield math or display. null → treated as unknown (0 yield).
  const safeNetAPR = sanitizeApyPct(vault.netAPR);
  const safeEstTotalAPR = sanitizeApyPct(vault.estTotalAPR);
  const safeAvgNetApy = sanitizeApyForStorage(latestSnapshot?.avgNetApy);
  // When the headline APR is implausible, the incentive breakdown that produced
  // it is equally untrustworthy — suppress it rather than show bogus components.
  const aprImplausible =
    vault.estTotalAPR != null && safeEstTotalAPR == null;

  // For Turtle vaults: use simple interest from Est. Total APR
  // For Morpho vaults: use compound interest from Net APY
  let annualizedYield: number;
  if (isTurtle && safeNetAPR != null) {
    annualizedYield = tvl * (safeNetAPR / 100); // netAPR is percentage
  } else {
    annualizedYield = tvl * (safeAvgNetApy ?? 0); // avgNetApy is decimal
  }
  const dailyYield = annualizedYield / 365;
  const weeklyYield = annualizedYield / 52;
  const monthlyYield = annualizedYield / 12;
  // Estimated total yield since vault creation (simplified)
  const estimatedTotalYield = dailyYield * Math.min(vaultAgeDays, 365);

  const response = {
    id: vault.id,
    address: vault.address,
    name: vault.name,
    symbol: vault.symbol,
    chainId: vault.chainId,
    asset: {
      address: vault.assetAddress,
      symbol: vault.assetSymbol,
      decimals: vault.assetDecimals,
    },
    curatorAddress: vault.curatorAddress,
    curator: curatorData,
    fees: {
      performance: vault.performanceFee,
      management: vault.managementFee,
    },
    turtleId: vault.turtleId || null,
    protocol: vault.protocol,
    dataSource: vault.dataSource,
    chainName: prettyChainName(vault.chainName, vault.chainId),
    estTotalAPR: safeEstTotalAPR,
    netAPR: safeNetAPR,
    dealOpportunityId: vault.dealOpportunityId ?? null,
    dealDepositable: vault.dealDepositable ?? false,
    dealEstApr: sanitizeApyPct(vault.dealEstApr),
    aprBreakdown: aprImplausible ? null : vault.aprBreakdown,
    warnings: (vault.warnings as Array<{ type: string; level: string }>) ?? [],
    listed: vault.listed ?? true,
    creationTimestamp: vault.creationTimestamp ?? null,
    yield: {
      dailyYield,
      weeklyYield,
      monthlyYield,
      annualizedYield,
      estimatedTotalYield,
      vaultAgeDays: Math.floor(vaultAgeDays),
    },
    latestSnapshot: latestSnapshot
      ? {
          totalAssets: latestSnapshot.totalAssets,
          totalAssetsUsd: latestSnapshot.totalAssetsUsd,
          totalSupply: latestSnapshot.totalSupply,
          sharePrice: latestSnapshot.sharePrice,
          liquidity: latestSnapshot.liquidity,
          liquidityUsd: latestSnapshot.liquidityUsd,
          apy: latestSnapshot.apy,
          netApy: latestSnapshot.netApy,
          avgApy: latestSnapshot.avgApy,
          avgNetApy: latestSnapshot.avgNetApy,
          timestamp: latestSnapshot.timestamp.toISOString(),
        }
      : null,
    snapshotHistory: vault.snapshots.map((s) => ({
      totalAssetsUsd: s.totalAssetsUsd,
      sharePrice: s.sharePrice,
      avgNetApy: s.avgNetApy,
      timestamp: s.timestamp.toISOString(),
    })),
    adapters: latestAllocations.map((a) => ({
      address: a.adapterAddress,
      type: a.adapterType,
      assets: a.assets,
      assetsUsd: a.assetsUsd,
      allocationPct: a.allocationPct,
      snapshotTime: a.snapshotTime.toISOString(),
    })),
    idleAssets: idleAssets.toString(),
    idleAssetsUsd: idleAssetsUsd > 0 ? idleAssetsUsd : 0,
    pendingConfigs: (vault.pendingConfigs as Array<{ validAt: number; functionName: string; txHash: string }>) ?? [],
    liquidations,
    liquidationSummary,
    createdAt: vault.createdAt.toISOString(),
    updatedAt: vault.updatedAt.toISOString(),
  };

  return response as unknown as VaultDetail;
});

// Get only allocations from the most recent snapshot
function getLatestAllocations(
  allocations: Array<{
    adapterAddress: string;
    adapterType: string;
    assets: string;
    assetsUsd: number;
    allocationPct: number;
    snapshotTime: Date;
  }>
) {
  if (allocations.length === 0) return [];

  const latestTime = allocations[0].snapshotTime.getTime();
  return allocations.filter(
    (a) => a.snapshotTime.getTime() === latestTime
  );
}

// Get only market allocations from the most recent snapshot
function getLatestMarketAllocations(
  allocations: Array<{
    marketUniqueKey: string;
    collateralAssetSymbol: string;
    lltv: number;
    allocationPct: number;
    oracleType: string | null;
    snapshotTime: Date;
  }>
) {
  if (allocations.length === 0) return [];

  const latestTime = allocations[0].snapshotTime.getTime();
  return allocations.filter(
    (a) => a.snapshotTime.getTime() === latestTime
  );
}

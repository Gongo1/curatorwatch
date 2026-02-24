import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assessVaultRisk,
  type VaultRiskData,
  type RiskAssessment,
} from "@/lib/institutional-risk-assessment";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;

    // Fetch vault with snapshots, allocations, risk data, and curator
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
        riskSnapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
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

    if (!vault) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

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
              totalAssetsUsd: v.snapshots[0]?.totalAssetsUsd ?? 0,
              avgNetApy: v.snapshots[0]?.avgNetApy ?? null,
            }))
            .sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd),
        }
      : null;

    // Get latest market allocations for risk assessment
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

    // Get latest risk snapshot
    const latestRiskSnapshot = vault.riskSnapshots[0];

    // Calculate risk assessment
    const riskData: VaultRiskData = {
      vaultAddress: vault.address,
      vaultName: vault.name,
      assetSymbol: vault.assetSymbol,
      totalAssetsUsd: latestSnapshot?.totalAssetsUsd ?? 0,
      createdAt: vault.createdAt,
      adapters: latestAllocations.map((a) => ({
        type: a.adapterType,
        allocationPct: a.allocationPct,
      })),
      marketAllocations: latestMarketAllocations.map((m) => ({
        collateralAssetSymbol: m.collateralAssetSymbol,
        lltv: m.lltv,
        allocationPct: m.allocationPct,
        oracleType: m.oracleType ?? undefined,
      })),
      topAdapterPercent: latestRiskSnapshot?.topAdapterPercent ?? (latestAllocations[0]?.allocationPct ?? 100),
      idleAssetsPercent: latestRiskSnapshot?.idleAssetsPercent ?? 0,
      numActiveAdapters: latestRiskSnapshot?.numActiveAdapters ?? latestAllocations.length,
      curator: vault.curator
        ? {
            name: vault.curator.name,
            address: vault.curator.address,
            legalName: vault.curator.legalName,
            entityType: vault.curator.entityType,
            jurisdiction: vault.curator.jurisdiction,
            isRegulated: vault.curator.isRegulated,
            totalAssetsManaged: vault.curator.totalAssetsManaged ?? 0,
            vaultCount: vault.curator.vaultCount ?? 0,
            oldestVaultDate: vault.curator.vaults.length > 0
              ? vault.curator.vaults.reduce((oldest, v) =>
                  v.createdAt < oldest ? v.createdAt : oldest,
                  vault.curator.vaults[0].createdAt
                )
              : undefined,
          }
        : null,
    };

    const riskAssessment = assessVaultRisk(riskData);

    // Calculate yield metrics
    const tvl = latestSnapshot?.totalAssetsUsd || 0;
    const netApy = latestSnapshot?.avgNetApy || 0;
    const vaultAgeMs = vault.createdAt
      ? Date.now() - new Date(vault.createdAt).getTime()
      : 0;
    const vaultAgeDays = vaultAgeMs / (24 * 60 * 60 * 1000);

    // Yield calculations based on Net APY (what depositors actually earn)
    const annualizedYield = tvl * netApy;
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
      riskAssessment: {
        overallRisk: riskAssessment.overallRisk,
        overallScore: riskAssessment.overallScore,
        categories: {
          smartContract: {
            level: riskAssessment.categories.smartContract.level,
            score: riskAssessment.categories.smartContract.score,
            factors: riskAssessment.categories.smartContract.factors,
            recommendations: riskAssessment.categories.smartContract.recommendations,
          },
          oracle: {
            level: riskAssessment.categories.oracle.level,
            score: riskAssessment.categories.oracle.score,
            factors: riskAssessment.categories.oracle.factors,
            recommendations: riskAssessment.categories.oracle.recommendations,
          },
          collateral: {
            level: riskAssessment.categories.collateral.level,
            score: riskAssessment.categories.collateral.score,
            factors: riskAssessment.categories.collateral.factors,
            recommendations: riskAssessment.categories.collateral.recommendations,
          },
          lltv: {
            level: riskAssessment.categories.lltv.level,
            score: riskAssessment.categories.lltv.score,
            factors: riskAssessment.categories.lltv.factors,
            recommendations: riskAssessment.categories.lltv.recommendations,
          },
          operational: {
            level: riskAssessment.categories.operational.level,
            score: riskAssessment.categories.operational.score,
            factors: riskAssessment.categories.operational.factors,
            recommendations: riskAssessment.categories.operational.recommendations,
          },
        },
        lastUpdated: riskAssessment.lastUpdated.toISOString(),
      },
      liquidations,
      liquidationSummary,
      createdAt: vault.createdAt.toISOString(),
      updatedAt: vault.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching vault:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vault" },
      { status: 500 }
    );
  }
}

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

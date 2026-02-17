import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  CuratorDetailResponse,
  CuratorProfile,
  CuratorNewsItem,
  CuratorVaultSummary,
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
): { strategyType: "Conservative" | "Moderate" | "Aggressive"; riskScore: "low" | "medium" | "high" } {
  if (vaults.length === 0) return { strategyType: "Moderate", riskScore: "medium" };

  const riskScores = vaults
    .map((v) => v.riskSnapshots[0]?.concentrationScore)
    .filter(Boolean);

  // Calculate risk score
  const highRiskCount = riskScores.filter((s) => s === "high").length;
  const medRiskCount = riskScores.filter((s) => s === "medium").length;
  const lowRiskCount = riskScores.filter((s) => s === "low").length;

  const riskScore: "low" | "medium" | "high" =
    highRiskCount > vaults.length / 2
      ? "high"
      : highRiskCount > 0 || medRiskCount > vaults.length / 2
        ? "medium"
        : "low";

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

  return { strategyType, riskScore };
}

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CuratorDetailResponse>> {
  try {
    const { address } = await params;

    // Fetch curator by address with risk data for strategy calculation
    const curator = await prisma.curator.findUnique({
      where: { address: address.toLowerCase() },
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

    if (!curator) {
      return NextResponse.json(
        {
          success: false,
          data: {
            curator: {} as CuratorProfile,
            vaults: [],
            news: [],
          },
          error: "Curator not found",
        },
        { status: 404 }
      );
    }

    // Calculate strategy and risk score
    const { strategyType, riskScore } = classifyStrategy(curator.vaults);

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
      riskScore,
    };

    // Transform vaults data
    const vaults: CuratorVaultSummary[] = curator.vaults.map((vault) => {
      const snapshot = vault.snapshots[0];
      return {
        id: vault.id,
        address: vault.address,
        name: vault.name,
        symbol: vault.symbol,
        asset: {
          address: vault.assetAddress,
          symbol: vault.assetSymbol,
          decimals: vault.assetDecimals,
        },
        latestSnapshot: snapshot
          ? {
              totalAssets: snapshot.totalAssets,
              totalAssetsUsd: snapshot.totalAssetsUsd,
              totalSupply: snapshot.totalSupply,
              sharePrice: snapshot.sharePrice,
              apy: snapshot.apy,
              netApy: snapshot.netApy,
              avgApy: snapshot.avgApy,
              avgNetApy: snapshot.avgNetApy,
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

    return NextResponse.json({
      success: true,
      data: {
        curator: curatorData,
        vaults,
        news,
      },
    });
  } catch (error) {
    console.error("Error fetching curator:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          curator: {} as CuratorProfile,
          vaults: [],
          news: [],
        },
        error: "Failed to fetch curator details",
      },
      { status: 500 }
    );
  }
}

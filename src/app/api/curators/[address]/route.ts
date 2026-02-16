import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  CuratorDetailResponse,
  CuratorProfile,
  CuratorNewsItem,
  CuratorVaultSummary,
} from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CuratorDetailResponse>> {
  try {
    const { address } = await params;

    // Fetch curator by address
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

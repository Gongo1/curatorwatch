import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Optional protocol filter
    const protocolFilter = request.nextUrl.searchParams.get("protocol");
    const dataSourceFilter = request.nextUrl.searchParams.get("dataSource");

    const whereClause: Record<string, unknown> = {};
    if (protocolFilter) {
      whereClause.protocol = protocolFilter;
    }
    if (dataSourceFilter) {
      whereClause.dataSource = dataSourceFilter;
    }

    // MINIMAL query - just vaults with latest snapshot
    const vaults = await prisma.vault.findMany({
      where: whereClause,
      include: {
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
        curator: {
          select: { name: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Simple response - no heavy calculations
    const response = vaults.map((vault) => {
      const latestSnapshot = vault.snapshots[0];

      return {
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
        curatorName: vault.curator?.name || null,
        fees: {
          performance: vault.performanceFee,
          management: vault.managementFee,
        },
        latestSnapshot: latestSnapshot
          ? {
              totalAssets: latestSnapshot.totalAssets,
              totalAssetsUsd: latestSnapshot.totalAssetsUsd,
              totalSupply: latestSnapshot.totalSupply,
              sharePrice: latestSnapshot.sharePrice,
              apy: latestSnapshot.apy,
              netApy: latestSnapshot.netApy,
              avgApy: latestSnapshot.avgApy,
              avgNetApy: latestSnapshot.avgNetApy,
              timestamp: latestSnapshot.timestamp.toISOString(),
            }
          : null,
        adapters: [],
        riskAssessment: {
          overallRisk: "Moderate Risk" as const,
          overallScore: 50,
        },
        turtleId: vault.turtleId || null,
        protocol: vault.protocol,
        dataSource: vault.dataSource,
        chainName: vault.chainName,
        updatedAt: vault.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: response,
      count: response.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching vaults:", errorMessage);
    return NextResponse.json(
      { success: false, error: `Failed to fetch vaults: ${errorMessage}` },
      { status: 500 }
    );
  }
}

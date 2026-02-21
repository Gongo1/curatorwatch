import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // MINIMAL query - just vaults with latest snapshot
    const vaults = await prisma.vault.findMany({
      include: {
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
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

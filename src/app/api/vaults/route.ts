import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Fetch all vaults with their latest snapshot and adapter allocations
    const vaults = await prisma.vault.findMany({
      include: {
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
        adapterAllocations: {
          orderBy: { snapshotTime: "desc" },
          take: 10, // Get recent allocations
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Transform to API response format
    const response = vaults.map((vault) => ({
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
      latestSnapshot: vault.snapshots[0]
        ? {
            totalAssets: vault.snapshots[0].totalAssets,
            totalAssetsUsd: vault.snapshots[0].totalAssetsUsd,
            totalSupply: vault.snapshots[0].totalSupply,
            sharePrice: vault.snapshots[0].sharePrice,
            apy: vault.snapshots[0].apy,
            netApy: vault.snapshots[0].netApy,
            avgApy: vault.snapshots[0].avgApy,
            avgNetApy: vault.snapshots[0].avgNetApy,
            timestamp: vault.snapshots[0].timestamp.toISOString(),
          }
        : null,
      adapters: vault.adapterAllocations.map((a) => ({
        address: a.adapterAddress,
        type: a.adapterType,
        assets: a.assets,
        assetsUsd: a.assetsUsd,
        allocationPct: a.allocationPct,
      })),
      updatedAt: vault.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: response,
      count: response.length,
    });
  } catch (error) {
    console.error("Error fetching vaults:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vaults" },
      { status: 500 }
    );
  }
}

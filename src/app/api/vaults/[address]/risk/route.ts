import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;

    // Find vault with latest data
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
          take: 1,
        },
        adapterAllocations: {
          orderBy: { snapshotTime: "desc" },
        },
        riskSnapshots: {
          orderBy: { timestamp: "desc" },
          take: 24, // Last 24 snapshots for trend (24 hours if hourly)
        },
      },
    });

    if (!vault) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

    // Get latest risk snapshot
    const latestRisk = vault.riskSnapshots[0];
    const latestSnapshot = vault.snapshots[0];

    // Get latest adapter allocations
    const latestAllocations = getLatestAllocations(vault.adapterAllocations);

    // Calculate idle assets
    const totalAssets = latestSnapshot
      ? BigInt(latestSnapshot.totalAssets)
      : 0n;
    const allocatedAssets = latestAllocations.reduce(
      (sum, a) => sum + BigInt(a.assets),
      0n
    );
    const idleAssets = totalAssets - allocatedAssets;
    const idleAssetsUsd = latestSnapshot
      ? (Number(idleAssets) / Number(totalAssets)) *
        latestSnapshot.totalAssetsUsd
      : 0;

    // Format response
    const response = {
      currentRisk: latestRisk
        ? {
            concentration: {
              score: latestRisk.concentrationScore,
              topAdapterPercent: latestRisk.topAdapterPercent,
              top3AdaptersPercent: latestRisk.top3AdaptersPercent,
              numActiveAdapters: latestRisk.numActiveAdapters,
              herfindahlIndex: latestRisk.herfindahlIndex,
            },
            liquidity: {
              score: latestRisk.liquidityScore,
              idleAssetsPercent: latestRisk.idleAssetsPercent,
              idleAssetsUsd,
              hasLiquidityAdapter: latestRisk.hasLiquidityAdapter,
            },
            diversification: {
              score: latestRisk.diversificationScore,
              avgAllocationPercent: latestRisk.avgAllocationPercent,
              largestAllocation: latestRisk.largestAllocation,
            },
            timestamp: latestRisk.timestamp.toISOString(),
          }
        : null,
      allocations: latestAllocations.map((a) => ({
        address: a.adapterAddress,
        type: a.adapterType,
        assets: a.assets,
        assetsUsd: a.assetsUsd,
        allocationPct: a.allocationPct,
        isHighRisk: a.allocationPct > 40,
      })),
      idleAssets: {
        amount: idleAssets.toString(),
        amountUsd: idleAssetsUsd,
        percent: latestRisk?.idleAssetsPercent ?? 0,
      },
      riskHistory: vault.riskSnapshots.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        concentrationScore: r.concentrationScore,
        liquidityScore: r.liquidityScore,
        diversificationScore: r.diversificationScore,
        topAdapterPercent: r.topAdapterPercent,
      })),
      asset: {
        symbol: vault.assetSymbol,
        decimals: vault.assetDecimals,
      },
      totalAssetsUsd: latestSnapshot?.totalAssetsUsd ?? 0,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching vault risk:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch risk data" },
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
  return allocations
    .filter((a) => a.snapshotTime.getTime() === latestTime)
    .sort((a, b) => b.allocationPct - a.allocationPct);
}

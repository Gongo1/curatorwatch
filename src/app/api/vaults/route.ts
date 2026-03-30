import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";

export async function GET(request: NextRequest) {
  try {
    // Optional protocol filter
    const protocolFilter = request.nextUrl.searchParams.get("protocol");
    const dataSourceFilter = request.nextUrl.searchParams.get("dataSource");

    const whereClause: Record<string, unknown> = {
      ...EXCLUDED_CURATOR_VAULT_FILTER,
    };
    if (protocolFilter) {
      whereClause.protocol = protocolFilter;
    }
    if (dataSourceFilter) {
      whereClause.dataSource = dataSourceFilter;
    }

    // MINIMAL query - only select fields needed for the response
    const vaults = await prisma.vault.findMany({
      where: whereClause,
      select: {
        id: true,
        address: true,
        name: true,
        symbol: true,
        chainId: true,
        assetAddress: true,
        assetSymbol: true,
        assetDecimals: true,
        curatorAddress: true,
        performanceFee: true,
        managementFee: true,
        turtleId: true,
        protocol: true,
        dataSource: true,
        chainName: true,
        estTotalAPR: true,
        netAPR: true,
        aprBreakdown: true,
        riskScore: true,
        grade: true,
        gradeFailures: true,
        warnings: true,
        listed: true,
        creationTimestamp: true,
        updatedAt: true,
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            totalAssets: true,
            totalAssetsUsd: true,
            totalSupply: true,
            sharePrice: true,
            apy: true,
            netApy: true,
            avgApy: true,
            avgNetApy: true,
            timestamp: true,
          },
        },
        curator: {
          select: { name: true, address: true },
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
        curatorAddress: vault.curatorAddress || vault.curator?.address || null,
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
        estTotalAPR: vault.estTotalAPR,
        netAPR: vault.netAPR,
        aprBreakdown: vault.aprBreakdown,
        riskScore: vault.riskScore ?? null,
        grade: vault.grade ?? null,
        gradeFailures: vault.gradeFailures ?? [],
        warnings: (vault.warnings as Array<{ type: string; level: string }>) ?? [],
        listed: vault.listed ?? true,
        creationTimestamp: vault.creationTimestamp ?? null,
        updatedAt: vault.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: response,
        count: response.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching vaults:", errorMessage);
    return NextResponse.json(
      { success: false, error: `Failed to fetch vaults: ${errorMessage}` },
      { status: 500 }
    );
  }
}

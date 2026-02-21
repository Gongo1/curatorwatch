import { NextResponse } from "next/server";
import { classifyVaultStrategy } from "@/lib/strategy-classifier";
import { assessVaultRisk, type VaultRiskData } from "@/lib/institutional-risk-assessment";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;

    // Get strategy classification
    const strategy = await classifyVaultStrategy(address);

    // Get risk metrics for the technical breakdown
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
        marketAllocations: {
          orderBy: { snapshotTime: "desc" },
        },
        riskSnapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
        curator: {
          include: {
            vaults: {
              select: { createdAt: true },
            },
          },
        },
      },
    });

    let riskMetrics = null;

    if (vault) {
      // Get latest allocations
      const latestAllocations = vault.adapterAllocations.length > 0
        ? vault.adapterAllocations.filter(
            (a) => a.snapshotTime.getTime() === vault.adapterAllocations[0].snapshotTime.getTime()
          )
        : [];

      const latestMarketAllocations = vault.marketAllocations.length > 0
        ? vault.marketAllocations.filter(
            (m) => m.snapshotTime.getTime() === vault.marketAllocations[0].snapshotTime.getTime()
          )
        : [];

      const latestRiskSnapshot = vault.riskSnapshots[0];
      const latestSnapshot = vault.snapshots[0];

      // Build risk data
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

      riskMetrics = {
        smartContract: riskAssessment.categories.smartContract.score,
        oracle: riskAssessment.categories.oracle.score,
        collateral: riskAssessment.categories.collateral.score,
        lltv: riskAssessment.categories.lltv.score,
        operational: riskAssessment.categories.operational.score,
      };
    }

    // Get curator info for rating
    const curatorInfo = vault?.curator
      ? {
          address: vault.curator.address,
          name: vault.curator.name,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        strategy,
        riskMetrics,
        curator: curatorInfo,
      },
    });
  } catch (error) {
    console.error("Error fetching strategy:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch strategy" },
      { status: 500 }
    );
  }
}

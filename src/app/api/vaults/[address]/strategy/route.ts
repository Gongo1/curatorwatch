import { NextResponse } from "next/server";
import { classifyVaultStrategy, BLUE_CHIP_COLLATERAL } from "@/lib/strategy-classifier";
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
    let curatorProfile = null;
    let collateral: Array<{ symbol: string; allocationPct: number; isBlueChip: boolean }> = [];

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

      // Build full curator profile
      if (vault.curator) {
        curatorProfile = {
          address: vault.curator.address,
          name: vault.curator.name,
          legalName: vault.curator.legalName,
          entityType: vault.curator.entityType,
          jurisdiction: vault.curator.jurisdiction,
          foundedYear: vault.curator.foundedYear,
          isRegulated: vault.curator.isRegulated,
          totalAssetsManaged: vault.curator.totalAssetsManaged ?? 0,
          vaultCount: vault.curator.vaultCount ?? 0,
        };
      }

      // Build collateral list with blue-chip classification
      // Use latest market allocations, or fall back to all market allocations if latest snapshot is empty
      const marketSource = latestMarketAllocations.length > 0
        ? latestMarketAllocations
        : vault.marketAllocations;

      const seenSymbols = new Set<string>();
      for (const m of marketSource) {
        if (!seenSymbols.has(m.collateralAssetSymbol)) {
          seenSymbols.add(m.collateralAssetSymbol);
          collateral.push({
            symbol: m.collateralAssetSymbol,
            allocationPct: m.allocationPct,
            isBlueChip: BLUE_CHIP_COLLATERAL.includes(m.collateralAssetSymbol.toUpperCase()),
          });
        } else {
          // Aggregate allocation for duplicate symbols
          const existing = collateral.find((c) => c.symbol === m.collateralAssetSymbol);
          if (existing) {
            existing.allocationPct += m.allocationPct;
          }
        }
      }
      collateral.sort((a, b) => b.allocationPct - a.allocationPct);
    }

    // Get recent alert summary
    const alertSummary = { critical: 0, warning: 0, info: 0, total: 0 };
    if (vault) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
      const counts = await prisma.vaultChange.groupBy({
        by: ["severity"],
        where: {
          vaultId: vault.id,
          detectedAt: { gte: since },
        },
        _count: true,
      });

      for (const c of counts) {
        if (c.severity === "critical") alertSummary.critical = c._count;
        else if (c.severity === "warning") alertSummary.warning = c._count;
        else if (c.severity === "info") alertSummary.info = c._count;
      }
      alertSummary.total = alertSummary.critical + alertSummary.warning + alertSummary.info;
    }

    // Get recent alerts (last 5)
    let recentAlerts: Array<{
      id: string;
      severity: string;
      title: string;
      detectedAt: string;
    }> = [];
    if (vault) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const alerts = await prisma.vaultChange.findMany({
        where: {
          vaultId: vault.id,
          detectedAt: { gte: since },
        },
        orderBy: { detectedAt: "desc" },
        take: 5,
      });
      recentAlerts = alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        detectedAt: a.detectedAt.toISOString(),
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        strategy,
        riskMetrics,
        curator: curatorProfile,
        collateral,
        alertSummary,
        recentAlerts,
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

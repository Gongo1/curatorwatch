import { NextResponse } from "next/server";
import { classifyVaultStrategy, BLUE_CHIP_COLLATERAL } from "@/lib/strategy-classifier";
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
        adapterAllocations: {
          orderBy: { snapshotTime: "desc" },
        },
        marketAllocations: {
          orderBy: { snapshotTime: "desc" },
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
      const marketSource = latestMarketAllocations.length > 0
        ? latestMarketAllocations
        : vault.marketAllocations;

      if (marketSource.length > 0) {
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
            const existing = collateral.find((c) => c.symbol === m.collateralAssetSymbol);
            if (existing) {
              existing.allocationPct += m.allocationPct;
            }
          }
        }
        collateral.sort((a, b) => b.allocationPct - a.allocationPct);
      } else {
        // No market allocation data — use the vault's denomination asset as the only known collateral signal
        const symbol = vault.assetSymbol;
        collateral.push({
          symbol,
          allocationPct: 100,
          isBlueChip: BLUE_CHIP_COLLATERAL.includes(symbol.toUpperCase()),
        });
      }
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";
import { countedVaultWhere } from "@/lib/data-quality/counting";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";
import { cacheGet, cacheSet } from "@/lib/cache";

// Morpho protocol fee (15% of interest earned goes to Morpho protocol)
// Only applies to Morpho vaults — other protocols have their own fee structures
const MORPHO_PROTOCOL_FEE_RATE = 0.15;

export async function GET() {
  try {
    const CACHE_KEY = "stats:fees";
    const cached = await cacheGet<object>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    // Get all vaults with their latest snapshots
    const vaults = await prisma.vault.findMany({
      where: {
        ...countedVaultWhere(),
        ...EXCLUDED_CURATOR_VAULT_FILTER,
      },
      select: {
        dataSource: true,
        performanceFee: true,
        managementFee: true,
        createdAt: true,
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            totalAssetsUsd: true,
            avgNetApy: true,
          },
        },
      },
    });

    let totalCuratorFees = 0;
    let totalMorphoFees = 0;
    let totalFeesAnnualized = 0;
    let totalCuratorFeesAnnualized = 0;
    let totalMorphoFeesAnnualized = 0;

    for (const vault of vaults) {
      const latestSnapshot = vault.snapshots[0];
      if (!latestSnapshot) continue;

      const tvl = latestSnapshot.totalAssetsUsd || 0;
      const apy = sanitizeApy(latestSnapshot.avgNetApy);
      const performanceFee = vault.performanceFee || 0;
      const managementFee = vault.managementFee || 0;

      // Calculate time in operation (in years)
      const vaultAge = vault.createdAt
        ? (Date.now() - new Date(vault.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        : 1;
      const operatingYears = Math.min(vaultAge, 1);

      // Estimated gross APY (before fees)
      // apy is already a decimal (e.g. 0.05 = 5%), no need to divide by 100
      const grossApy = performanceFee > 0 ? apy / (1 - performanceFee) : apy;
      const grossYield = grossApy;

      // Calculate estimated fees for period
      const estimatedManagementFees = tvl * managementFee * operatingYears;
      const estimatedPerformanceFees = tvl * grossYield * performanceFee * operatingYears;
      const curatorFees = estimatedManagementFees + estimatedPerformanceFees;

      // Protocol fees: only apply Morpho's 15% to Morpho vaults
      const isMorphoVault = !vault.dataSource || vault.dataSource === "morpho";
      const protocolFeeRate = isMorphoVault ? MORPHO_PROTOCOL_FEE_RATE : 0;
      const totalInterestEarned = tvl * grossYield * operatingYears;
      const morphoFees = totalInterestEarned * protocolFeeRate;

      totalCuratorFees += curatorFees;
      totalMorphoFees += morphoFees;

      // Annualized projections
      if (operatingYears > 0) {
        totalCuratorFeesAnnualized += curatorFees / operatingYears;
        totalMorphoFeesAnnualized += morphoFees / operatingYears;
      }
    }

    totalFeesAnnualized = totalCuratorFeesAnnualized + totalMorphoFeesAnnualized;

    const body = {
      success: true,
      data: {
        estimated: {
          curatorFees: totalCuratorFees,
          morphoFees: totalMorphoFees,
          totalFees: totalCuratorFees + totalMorphoFees,
        },
        annualized: {
          curatorFees: totalCuratorFeesAnnualized,
          morphoFees: totalMorphoFeesAnnualized,
          totalFees: totalFeesAnnualized,
        },
        vaultCount: vaults.length,
      },
    };
    await cacheSet(CACHE_KEY, body, 300);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Error calculating total fees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate total fees" },
      { status: 500 }
    );
  }
}

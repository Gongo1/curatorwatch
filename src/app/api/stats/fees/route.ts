import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Morpho protocol fee (typically 15% of interest earned goes to protocol)
const MORPHO_PROTOCOL_FEE_RATE = 0.15;

export async function GET() {
  try {
    // Get all vaults with their latest snapshots
    const vaults = await prisma.vault.findMany({
      select: {
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
      const apy = latestSnapshot.avgNetApy || 0;
      const performanceFee = vault.performanceFee || 0;
      const managementFee = vault.managementFee || 0;

      // Calculate time in operation (in years)
      const vaultAge = vault.createdAt
        ? (Date.now() - new Date(vault.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        : 1;
      const operatingYears = Math.min(vaultAge, 1);

      // Estimated gross APY (before fees)
      const grossApy = performanceFee > 0 ? apy / (1 - performanceFee) : apy;
      const grossYield = grossApy / 100;

      // Calculate estimated fees for period
      const estimatedManagementFees = tvl * managementFee * operatingYears;
      const estimatedPerformanceFees = tvl * grossYield * performanceFee * operatingYears;
      const curatorFees = estimatedManagementFees + estimatedPerformanceFees;

      // Morpho fees
      const totalInterestEarned = tvl * grossYield * operatingYears;
      const morphoFees = totalInterestEarned * MORPHO_PROTOCOL_FEE_RATE;

      totalCuratorFees += curatorFees;
      totalMorphoFees += morphoFees;

      // Annualized projections
      if (operatingYears > 0) {
        totalCuratorFeesAnnualized += curatorFees / operatingYears;
        totalMorphoFeesAnnualized += morphoFees / operatingYears;
      }
    }

    totalFeesAnnualized = totalCuratorFeesAnnualized + totalMorphoFeesAnnualized;

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error calculating total fees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate total fees" },
      { status: 500 }
    );
  }
}

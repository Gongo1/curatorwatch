import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Morpho protocol fee (15% of interest earned goes to Morpho protocol)
// Only applies to Morpho vaults — other protocols have their own fee structures
const MORPHO_PROTOCOL_FEE_RATE = 0.15;

interface VaultFeeData {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  curatorId: string | null;
  curatorName: string | null;
  curatorAddress: string | null;
  tvl: number;
  apy: number;
  grossApy: number;
  performanceFee: number;
  managementFee: number;
  estimatedManagementFees: number;
  estimatedPerformanceFees: number;
  totalCuratorFees: number;
  estimatedMorphoFees: number;
  totalFees: number;
  annualizedCuratorFees: number;
  annualizedMorphoFees: number;
  annualizedTotalFees: number;
  vaultAgeYears: number;
}

interface CuratorFeeData {
  curatorId: string;
  curatorName: string;
  curatorAddress: string;
  vaultCount: number;
  totalAUM: number;
  avgPerformanceFee: number;
  avgManagementFee: number;
  estimatedManagementFees: number;
  estimatedPerformanceFees: number;
  totalCuratorFees: number;
  estimatedMorphoFees: number;
  totalFees: number;
  annualizedCuratorFees: number;
  annualizedMorphoFees: number;
  annualizedTotalFees: number;
}

export async function GET() {
  try {
    // Get all vaults with their latest snapshots and curator info
    const vaults = await prisma.vault.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        address: true,
        name: true,
        assetSymbol: true,
        dataSource: true,
        performanceFee: true,
        managementFee: true,
        createdAt: true,
        curatorId: true,
        curatorAddress: true,
        curator: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
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

    const vaultFees: VaultFeeData[] = [];
    const curatorAggregates: Record<string, {
      curatorId: string;
      curatorName: string;
      curatorAddress: string;
      vaultCount: number;
      totalAUM: number;
      totalManagementFees: number;
      totalPerformanceFees: number;
      totalCuratorFees: number;
      totalMorphoFees: number;
      annualizedCuratorFees: number;
      annualizedMorphoFees: number;
      performanceFeeSum: number;
      managementFeeSum: number;
    }> = {};

    // Totals
    let totalCuratorFees = 0;
    let totalMorphoFees = 0;
    let totalAnnualizedCuratorFees = 0;
    let totalAnnualizedMorphoFees = 0;

    for (const vault of vaults) {
      const latestSnapshot = vault.snapshots[0];
      if (!latestSnapshot) continue;

      const tvl = latestSnapshot.totalAssetsUsd || 0;
      if (tvl < 1000) continue; // Skip tiny vaults

      const netApy = latestSnapshot.avgNetApy || 0;
      const performanceFee = vault.performanceFee || 0;
      const managementFee = vault.managementFee || 0;

      // Calculate vault age in years
      const vaultAgeMs = vault.createdAt
        ? Date.now() - new Date(vault.createdAt).getTime()
        : 365.25 * 24 * 60 * 60 * 1000;
      const vaultAgeYears = Math.min(vaultAgeMs / (365.25 * 24 * 60 * 60 * 1000), 1);

      // Calculate gross APY (before performance fee is taken)
      // Net APY = Gross APY * (1 - performanceFee) - managementFee
      // So: Gross APY ≈ (Net APY + managementFee) / (1 - performanceFee)
      const grossApy = performanceFee < 1
        ? (netApy + managementFee) / (1 - performanceFee)
        : netApy;

      // grossApy is already a decimal (e.g. 0.05 = 5%), no need to divide by 100
      const grossYield = grossApy;

      // Calculate estimated fees for the period the vault has been active
      const estimatedManagementFees = tvl * managementFee * vaultAgeYears;
      const estimatedPerformanceFees = tvl * grossYield * performanceFee * vaultAgeYears;
      const curatorFees = estimatedManagementFees + estimatedPerformanceFees;

      // Protocol fees: only apply Morpho's 15% to Morpho vaults
      const isMorphoVault = !vault.dataSource || vault.dataSource === "morpho";
      const protocolFeeRate = isMorphoVault ? MORPHO_PROTOCOL_FEE_RATE : 0;
      const totalInterestEarned = tvl * grossYield * vaultAgeYears;
      const morphoFees = totalInterestEarned * protocolFeeRate;

      // Annualized projections
      const annualizedManagementFees = tvl * managementFee;
      const annualizedPerformanceFees = tvl * grossYield * performanceFee;
      const annualizedCuratorFees = annualizedManagementFees + annualizedPerformanceFees;
      const annualizedMorphoFees = tvl * grossYield * protocolFeeRate;

      const curatorKey = vault.curatorId || vault.curatorAddress || "unknown";
      const curatorName = vault.curator?.name ||
        (vault.curatorAddress ? `${vault.curatorAddress.slice(0, 6)}...${vault.curatorAddress.slice(-4)}` : "Unknown");

      vaultFees.push({
        vaultId: vault.id,
        vaultAddress: vault.address,
        vaultName: vault.name,
        assetSymbol: vault.assetSymbol,
        curatorId: vault.curatorId,
        curatorName,
        curatorAddress: vault.curatorAddress,
        tvl,
        apy: netApy * 100, // Convert to percentage
        grossApy: grossApy * 100,
        performanceFee: performanceFee * 100,
        managementFee: managementFee * 100,
        estimatedManagementFees,
        estimatedPerformanceFees,
        totalCuratorFees: curatorFees,
        estimatedMorphoFees: morphoFees,
        totalFees: curatorFees + morphoFees,
        annualizedCuratorFees,
        annualizedMorphoFees,
        annualizedTotalFees: annualizedCuratorFees + annualizedMorphoFees,
        vaultAgeYears,
      });

      // Aggregate by curator
      if (!curatorAggregates[curatorKey]) {
        curatorAggregates[curatorKey] = {
          curatorId: vault.curatorId || curatorKey,
          curatorName,
          curatorAddress: vault.curatorAddress || "",
          vaultCount: 0,
          totalAUM: 0,
          totalManagementFees: 0,
          totalPerformanceFees: 0,
          totalCuratorFees: 0,
          totalMorphoFees: 0,
          annualizedCuratorFees: 0,
          annualizedMorphoFees: 0,
          performanceFeeSum: 0,
          managementFeeSum: 0,
        };
      }

      curatorAggregates[curatorKey].vaultCount += 1;
      curatorAggregates[curatorKey].totalAUM += tvl;
      curatorAggregates[curatorKey].totalManagementFees += estimatedManagementFees;
      curatorAggregates[curatorKey].totalPerformanceFees += estimatedPerformanceFees;
      curatorAggregates[curatorKey].totalCuratorFees += curatorFees;
      curatorAggregates[curatorKey].totalMorphoFees += morphoFees;
      curatorAggregates[curatorKey].annualizedCuratorFees += annualizedCuratorFees;
      curatorAggregates[curatorKey].annualizedMorphoFees += annualizedMorphoFees;
      curatorAggregates[curatorKey].performanceFeeSum += performanceFee;
      curatorAggregates[curatorKey].managementFeeSum += managementFee;

      // Update totals
      totalCuratorFees += curatorFees;
      totalMorphoFees += morphoFees;
      totalAnnualizedCuratorFees += annualizedCuratorFees;
      totalAnnualizedMorphoFees += annualizedMorphoFees;
    }

    // Convert curator aggregates to array and calculate averages
    const curatorFees: CuratorFeeData[] = Object.values(curatorAggregates)
      .map(c => ({
        curatorId: c.curatorId,
        curatorName: c.curatorName,
        curatorAddress: c.curatorAddress,
        vaultCount: c.vaultCount,
        totalAUM: c.totalAUM,
        avgPerformanceFee: (c.performanceFeeSum / c.vaultCount) * 100,
        avgManagementFee: (c.managementFeeSum / c.vaultCount) * 100,
        estimatedManagementFees: c.totalManagementFees,
        estimatedPerformanceFees: c.totalPerformanceFees,
        totalCuratorFees: c.totalCuratorFees,
        estimatedMorphoFees: c.totalMorphoFees,
        totalFees: c.totalCuratorFees + c.totalMorphoFees,
        annualizedCuratorFees: c.annualizedCuratorFees,
        annualizedMorphoFees: c.annualizedMorphoFees,
        annualizedTotalFees: c.annualizedCuratorFees + c.annualizedMorphoFees,
      }))
      .sort((a, b) => b.annualizedCuratorFees - a.annualizedCuratorFees);

    // Sort vaults by fees
    vaultFees.sort((a, b) => b.annualizedCuratorFees - a.annualizedCuratorFees);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalVaults: vaultFees.length,
          totalCurators: curatorFees.length,
          estimated: {
            curatorFees: totalCuratorFees,
            morphoFees: totalMorphoFees,
            totalFees: totalCuratorFees + totalMorphoFees,
          },
          annualized: {
            curatorFees: totalAnnualizedCuratorFees,
            morphoFees: totalAnnualizedMorphoFees,
            totalFees: totalAnnualizedCuratorFees + totalAnnualizedMorphoFees,
          },
        },
        byVault: vaultFees,
        byCurator: curatorFees,
      },
    });
  } catch (error) {
    console.error("Error calculating fee breakdown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate fee breakdown" },
      { status: 500 }
    );
  }
}

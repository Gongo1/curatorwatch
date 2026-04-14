import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";

interface VaultYieldData {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  dataSource: string;
  grade: string | null;
  gradeFailures: string[];
  warnings: Array<{ type: string; level: string }>;
  listed: boolean;
  assetSymbol: string;
  curatorId: string | null;
  curatorName: string | null;
  curatorAddress: string | null;
  tvl: number;
  netApy: number;
  grossApy: number;
  // Yield calculations
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  annualizedYield: number;
  // Since inception (estimated)
  vaultAgeYears: number;
  estimatedTotalYield: number;
  performanceFee: number;
  managementFee: number;
}

interface CuratorYieldData {
  curatorId: string;
  curatorName: string;
  curatorAddress: string;
  vaultCount: number;
  totalAUM: number;
  avgNetApy: number;
  // Yield calculations
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  annualizedYield: number;
  estimatedTotalYield: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataSource = searchParams.get("dataSource");

    const cacheKey = `stats:yield-breakdown:${dataSource || "all"}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // Get all vaults with their latest snapshots and curator info
    const vaults = await prisma.vault.findMany({
      where: {
        active: true,
        ...(dataSource ? { dataSource } : {}),
        ...EXCLUDED_CURATOR_VAULT_FILTER,
      },
      select: {
        id: true,
        address: true,
        name: true,
        dataSource: true,
        grade: true,
        gradeFailures: true,
        warnings: true,
        listed: true,
        creationTimestamp: true,
        assetSymbol: true,
        performanceFee: true,
        managementFee: true,
        estTotalAPR: true,
        netAPR: true,
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

    const vaultYields: VaultYieldData[] = [];
    const curatorAggregates: Record<string, {
      curatorId: string;
      curatorName: string;
      curatorAddress: string;
      vaultCount: number;
      totalAUM: number;
      totalDailyYield: number;
      totalWeeklyYield: number;
      totalMonthlyYield: number;
      totalAnnualizedYield: number;
      totalEstimatedYield: number;
      weightedApySum: number; // For weighted average APY
    }> = {};

    // Totals
    let totalDailyYield = 0;
    let totalWeeklyYield = 0;
    let totalMonthlyYield = 0;
    let totalAnnualizedYield = 0;
    let totalEstimatedYield = 0;
    let totalAUM = 0;

    for (const vault of vaults) {
      const latestSnapshot = vault.snapshots[0];
      if (!latestSnapshot) continue;

      const tvl = latestSnapshot.totalAssetsUsd || 0;
      if (tvl < 1000) continue; // Skip tiny vaults

      const isTurtle = vault.dataSource === "turtle";
      const performanceFee = vault.performanceFee || 0;
      const managementFee = vault.managementFee || 0;

      // For Turtle: use APR directly (percentage); for Morpho: use APY (decimal)
      let netApy: number; // decimal form for yield calc
      let grossApy: number; // decimal form
      if (isTurtle && vault.netAPR != null) {
        netApy = vault.netAPR / 100; // Convert percentage to decimal
        grossApy = vault.estTotalAPR != null ? vault.estTotalAPR / 100 : netApy;
      } else {
        netApy = sanitizeApy(latestSnapshot.avgNetApy);
        grossApy = performanceFee < 1
          ? (netApy + managementFee) / (1 - performanceFee)
          : netApy;
      }

      // Calculate vault age in years
      const vaultOriginMs = vault.creationTimestamp
        ? vault.creationTimestamp * 1000
        : vault.createdAt
          ? new Date(vault.createdAt).getTime()
          : Date.now() - 365.25 * 24 * 60 * 60 * 1000;
      const vaultAgeMs = Date.now() - vaultOriginMs;
      const vaultAgeYears = Math.min(vaultAgeMs / (365.25 * 24 * 60 * 60 * 1000), 1);

      // Yield calculations (simple interest for Turtle, compound for Morpho)
      const annualizedYield = tvl * netApy;
      const dailyYield = annualizedYield / 365;
      const weeklyYield = annualizedYield / 52;
      const monthlyYield = annualizedYield / 12;
      const estimatedTotalYield = tvl * netApy * vaultAgeYears;

      const curatorKey = vault.curatorId || vault.curatorAddress || "unknown";
      const curatorName = vault.curator?.name ||
        (vault.curatorAddress ? `${vault.curatorAddress.slice(0, 6)}...${vault.curatorAddress.slice(-4)}` : "Unknown");

      vaultYields.push({
        vaultId: vault.id,
        vaultAddress: vault.address,
        vaultName: vault.name,
        dataSource: vault.dataSource,
        grade: vault.grade,
        gradeFailures: vault.gradeFailures ?? [],
        warnings: (vault.warnings as Array<{ type: string; level: string }>) ?? [],
        listed: vault.listed ?? true,
        assetSymbol: vault.assetSymbol,
        curatorId: vault.curatorId,
        curatorName,
        curatorAddress: vault.curatorAddress,
        tvl,
        netApy: netApy * 100, // Convert to percentage for display
        grossApy: grossApy * 100,
        dailyYield,
        weeklyYield,
        monthlyYield,
        annualizedYield,
        vaultAgeYears,
        estimatedTotalYield,
        performanceFee: performanceFee * 100,
        managementFee: managementFee * 100,
      });

      // Aggregate by curator
      if (!curatorAggregates[curatorKey]) {
        curatorAggregates[curatorKey] = {
          curatorId: vault.curatorId || curatorKey,
          curatorName,
          curatorAddress: vault.curatorAddress || "",
          vaultCount: 0,
          totalAUM: 0,
          totalDailyYield: 0,
          totalWeeklyYield: 0,
          totalMonthlyYield: 0,
          totalAnnualizedYield: 0,
          totalEstimatedYield: 0,
          weightedApySum: 0,
        };
      }

      curatorAggregates[curatorKey].vaultCount += 1;
      curatorAggregates[curatorKey].totalAUM += tvl;
      curatorAggregates[curatorKey].totalDailyYield += dailyYield;
      curatorAggregates[curatorKey].totalWeeklyYield += weeklyYield;
      curatorAggregates[curatorKey].totalMonthlyYield += monthlyYield;
      curatorAggregates[curatorKey].totalAnnualizedYield += annualizedYield;
      curatorAggregates[curatorKey].totalEstimatedYield += estimatedTotalYield;
      curatorAggregates[curatorKey].weightedApySum += netApy * tvl;

      // Update totals
      totalDailyYield += dailyYield;
      totalWeeklyYield += weeklyYield;
      totalMonthlyYield += monthlyYield;
      totalAnnualizedYield += annualizedYield;
      totalEstimatedYield += estimatedTotalYield;
      totalAUM += tvl;
    }

    // Convert curator aggregates to array
    const curatorYields: CuratorYieldData[] = Object.values(curatorAggregates)
      .map(c => ({
        curatorId: c.curatorId,
        curatorName: c.curatorName,
        curatorAddress: c.curatorAddress,
        vaultCount: c.vaultCount,
        totalAUM: c.totalAUM,
        avgNetApy: c.totalAUM > 0 ? (c.weightedApySum / c.totalAUM) * 100 : 0,
        dailyYield: c.totalDailyYield,
        weeklyYield: c.totalWeeklyYield,
        monthlyYield: c.totalMonthlyYield,
        annualizedYield: c.totalAnnualizedYield,
        estimatedTotalYield: c.totalEstimatedYield,
      }))
      .sort((a, b) => b.annualizedYield - a.annualizedYield);

    // Sort vaults by yield
    vaultYields.sort((a, b) => b.annualizedYield - a.annualizedYield);

    // Calculate weighted average APY
    const avgNetApy = totalAUM > 0
      ? vaultYields.reduce((sum, v) => sum + (v.netApy / 100) * v.tvl, 0) / totalAUM * 100
      : 0;

    const responseBody = {
      success: true,
      data: {
        summary: {
          totalVaults: vaultYields.length,
          totalCurators: curatorYields.length,
          totalAUM,
          avgNetApy,
          yield: {
            daily: totalDailyYield,
            weekly: totalWeeklyYield,
            monthly: totalMonthlyYield,
            annualized: totalAnnualizedYield,
            estimatedTotal: totalEstimatedYield,
          },
        },
        byVault: vaultYields,
        byCurator: curatorYields,
      },
    };

    await cacheSet(cacheKey, responseBody, 300);

    return NextResponse.json(responseBody, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error calculating yield breakdown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate yield breakdown" },
      { status: 500 }
    );
  }
}

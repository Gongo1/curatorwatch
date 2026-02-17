import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Get total assets by asset symbol from latest snapshots
    const vaults = await prisma.vault.findMany({
      select: {
        assetSymbol: true,
        snapshots: {
          select: {
            totalAssetsUsd: true,
          },
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    // Aggregate by asset symbol
    const assetTotals: Record<string, number> = {};
    let total = 0;

    for (const vault of vaults) {
      const symbol = vault.assetSymbol || "Other";
      const amount = vault.snapshots[0]?.totalAssetsUsd || 0;

      if (!assetTotals[symbol]) {
        assetTotals[symbol] = 0;
      }
      assetTotals[symbol] += amount;
      total += amount;
    }

    // Convert to sorted array with percentages
    const breakdown = Object.entries(assetTotals)
      .map(([symbol, amount]) => ({
        symbol,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Group small assets into "Other"
    const topAssets = breakdown.slice(0, 5);
    const otherAssets = breakdown.slice(5);

    if (otherAssets.length > 0) {
      const otherTotal = otherAssets.reduce((sum, a) => sum + a.amount, 0);
      const existingOther = topAssets.find(a => a.symbol === "Other");

      if (existingOther) {
        existingOther.amount += otherTotal;
        existingOther.percentage = total > 0 ? (existingOther.amount / total) * 100 : 0;
      } else if (otherTotal > 0) {
        topAssets.push({
          symbol: "Other",
          amount: otherTotal,
          percentage: total > 0 ? (otherTotal / total) * 100 : 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        breakdown: topAssets,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching stablecoin breakdown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stablecoin breakdown" },
      { status: 500 }
    );
  }
}

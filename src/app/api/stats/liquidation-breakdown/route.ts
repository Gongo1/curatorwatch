import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UNATTRIBUTED_KEY = "__unattributed__";

export async function GET() {
  try {
    // Get all market allocations grouped by vault/curator
    const allocations = await prisma.marketAllocation.findMany({
      select: {
        marketUniqueKey: true,
        vault: {
          select: {
            curatorId: true,
            curatorAddress: true,
            curator: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
    });

    // Build a map: marketUniqueKey -> curator info
    const marketToCurator = new Map<
      string,
      { curatorId: string; curatorName: string; curatorAddress: string }
    >();
    for (const alloc of allocations) {
      const key = alloc.marketUniqueKey;
      if (marketToCurator.has(key)) continue;
      const curatorId =
        alloc.vault.curatorId || alloc.vault.curatorAddress || "unknown";
      const curatorName =
        alloc.vault.curator?.name ||
        (alloc.vault.curatorAddress
          ? `${alloc.vault.curatorAddress.slice(0, 6)}...${alloc.vault.curatorAddress.slice(-4)}`
          : "Unknown");
      const curatorAddress = alloc.vault.curatorAddress || "";
      marketToCurator.set(key, { curatorId, curatorName, curatorAddress });
    }

    // Get all liquidations
    const liquidations = await prisma.liquidation.findMany({
      orderBy: { timestamp: "desc" },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Aggregate totals (ALL liquidations, not just mapped ones)
    let totalEvents = 0;
    let totalSeizedUsd = 0;
    let totalRepaidUsd = 0;
    let totalBadDebtUsd = 0;
    let recent30d = 0;
    const marketsAffected = new Set<string>();

    // Aggregate by curator
    const curatorAgg: Record<
      string,
      {
        curatorId: string;
        curatorName: string;
        curatorAddress: string;
        totalEvents: number;
        totalSeizedUsd: number;
        totalRepaidUsd: number;
        totalBadDebtUsd: number;
        recent30d: number;
        events: Array<{
          txHash: string;
          timestamp: string;
          marketUniqueKey: string;
          borrower: string;
          seizedAssetsUsd: number;
          repaidAssetsUsd: number;
          badDebtAssetsUsd: number;
        }>;
      }
    > = {};

    for (const liq of liquidations) {
      // Always count in totals
      totalEvents++;
      totalSeizedUsd += liq.seizedAssetsUsd;
      totalRepaidUsd += liq.repaidAssetsUsd;
      totalBadDebtUsd += liq.badDebtAssetsUsd;
      marketsAffected.add(liq.marketUniqueKey);
      if (liq.timestamp >= thirtyDaysAgo) recent30d++;

      // Attribute to curator if possible, otherwise bucket as "Unattributed"
      const curator = marketToCurator.get(liq.marketUniqueKey);
      const bucketId = curator?.curatorId ?? UNATTRIBUTED_KEY;

      if (!curatorAgg[bucketId]) {
        curatorAgg[bucketId] = {
          curatorId: curator?.curatorId ?? UNATTRIBUTED_KEY,
          curatorName: curator?.curatorName ?? "Other Markets",
          curatorAddress: curator?.curatorAddress ?? "",
          totalEvents: 0,
          totalSeizedUsd: 0,
          totalRepaidUsd: 0,
          totalBadDebtUsd: 0,
          recent30d: 0,
          events: [],
        };
      }

      const agg = curatorAgg[bucketId];
      agg.totalEvents++;
      agg.totalSeizedUsd += liq.seizedAssetsUsd;
      agg.totalRepaidUsd += liq.repaidAssetsUsd;
      agg.totalBadDebtUsd += liq.badDebtAssetsUsd;
      if (liq.timestamp >= thirtyDaysAgo) agg.recent30d++;

      // Keep up to 20 most recent events per curator (already sorted desc)
      if (agg.events.length < 20) {
        agg.events.push({
          txHash: liq.txHash,
          timestamp: liq.timestamp.toISOString(),
          marketUniqueKey: liq.marketUniqueKey,
          borrower: liq.borrower,
          seizedAssetsUsd: liq.seizedAssetsUsd,
          repaidAssetsUsd: liq.repaidAssetsUsd,
          badDebtAssetsUsd: liq.badDebtAssetsUsd,
        });
      }
    }

    // Sort: attributed curators first by seized desc, then "Other Markets" at end
    const byCurator = Object.values(curatorAgg).sort((a, b) => {
      if (a.curatorId === UNATTRIBUTED_KEY) return 1;
      if (b.curatorId === UNATTRIBUTED_KEY) return -1;
      return b.totalSeizedUsd - a.totalSeizedUsd;
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalEvents,
          totalSeizedUsd,
          totalRepaidUsd,
          totalBadDebtUsd,
          recent30d,
          marketsAffected: marketsAffected.size,
        },
        byCurator,
      },
    });
  } catch (error) {
    console.error("Error calculating liquidation breakdown:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate liquidation breakdown" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DailyAggregated {
  totalAUM: number;
  weightedApySum: number; // Sum of (apy * aum) for weighted average
  vaultCount: number;
  curatorSet: Set<string>;
  curatorAUM: Record<string, number>; // AUM breakdown by curator
}

// Color palette for curators (distinct colors)
const CURATOR_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EF4444", // red
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
];

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all snapshots from last 30 days with vault info for curator tracking
    const snapshots = await prisma.vaultSnapshot.findMany({
      where: {
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        timestamp: true,
        totalAssetsUsd: true,
        avgNetApy: true,
        vaultId: true,
        vault: {
          select: {
            curatorAddress: true,
            curator: {
              select: {
                name: true,
                address: true,
              },
            },
          },
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Get curator names for display
    const curators = await prisma.curator.findMany({
      select: {
        address: true,
        name: true,
      },
    });
    const curatorNames: Record<string, string> = {};
    for (const c of curators) {
      curatorNames[c.address.toLowerCase()] = c.name || `${c.address.slice(0, 6)}...${c.address.slice(-4)}`;
    }

    // Group snapshots by day and vault, keeping only the latest per vault per day
    const latestSnapshotByDayVault: Record<string, Record<string, typeof snapshots[0]>> = {};

    for (const snap of snapshots) {
      const day = snap.timestamp.toISOString().split("T")[0];
      const vaultId = snap.vaultId;

      if (!latestSnapshotByDayVault[day]) {
        latestSnapshotByDayVault[day] = {};
      }

      // Keep only the latest snapshot per vault per day
      const existing = latestSnapshotByDayVault[day][vaultId];
      if (!existing || new Date(snap.timestamp) > new Date(existing.timestamp)) {
        latestSnapshotByDayVault[day][vaultId] = snap;
      }
    }

    // Now aggregate using only the latest snapshot per vault per day
    const dailyData: Record<string, DailyAggregated> = {};
    const allCurators = new Set<string>();

    for (const [day, vaultSnapshots] of Object.entries(latestSnapshotByDayVault)) {
      dailyData[day] = {
        totalAUM: 0,
        weightedApySum: 0,
        vaultCount: 0,
        curatorSet: new Set(),
        curatorAUM: {},
      };

      for (const snap of Object.values(vaultSnapshots)) {
        const aum = snap.totalAssetsUsd || 0;
        const apy = snap.avgNetApy || 0;
        const curatorAddress = snap.vault?.curatorAddress?.toLowerCase() || "unknown";

        dailyData[day].totalAUM += aum;
        dailyData[day].weightedApySum += apy * aum;
        dailyData[day].vaultCount += 1;

        // Track AUM by curator
        if (!dailyData[day].curatorAUM[curatorAddress]) {
          dailyData[day].curatorAUM[curatorAddress] = 0;
        }
        dailyData[day].curatorAUM[curatorAddress] += aum;
        allCurators.add(curatorAddress);

        // Track unique curators per day
        if (snap.vault?.curatorAddress) {
          dailyData[day].curatorSet.add(snap.vault.curatorAddress);
        }
      }
    }

    // Get top curators by total AUM
    const curatorTotals: Record<string, number> = {};
    for (const data of Object.values(dailyData)) {
      for (const [curator, aum] of Object.entries(data.curatorAUM)) {
        curatorTotals[curator] = (curatorTotals[curator] || 0) + aum;
      }
    }

    // Sort by total AUM and take top 8, rest become "Other"
    const sortedCurators = Object.entries(curatorTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([addr]) => addr);
    const topCurators = sortedCurators.slice(0, 8);
    const otherCurators = new Set(sortedCurators.slice(8));

    // Build curator metadata for frontend
    const curatorMeta = topCurators.map((addr, i) => ({
      id: addr,
      name: curatorNames[addr] || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
      color: CURATOR_COLORS[i % CURATOR_COLORS.length],
    }));

    if (otherCurators.size > 0) {
      curatorMeta.push({
        id: "other",
        name: "Other Curators",
        color: "#737373",
      });
    }

    // Convert to chart data format with curator breakdown
    const chartData = Object.entries(dailyData)
      .map(([date, data]) => {
        const point: Record<string, unknown> = {
          date,
          aum: Math.round(data.totalAUM),
          // Weighted APY = sum(apy * aum) / totalAUM
          apy: data.totalAUM > 0
            ? Number((data.weightedApySum / data.totalAUM * 100).toFixed(2))
            : 0,
          vaults: data.vaultCount,
          curators: data.curatorSet.size,
        };

        // Add curator breakdown
        let otherAUM = 0;
        for (const [curator, aum] of Object.entries(data.curatorAUM)) {
          if (topCurators.includes(curator)) {
            point[curator] = Math.round(aum);
          } else {
            otherAUM += aum;
          }
        }
        if (otherCurators.size > 0) {
          point["other"] = Math.round(otherAUM);
        }

        // Ensure all curators have a value (0 if not present)
        for (const curator of topCurators) {
          if (!(curator in point)) {
            point[curator] = 0;
          }
        }

        return point;
      })
      .sort((a, b) => (a.date as string).localeCompare(b.date as string));

    // If we don't have enough historical data (less than 7 days), blend with mock data
    if (chartData.length < 7) {
      // Get current snapshot data with weighted APY - deduplicated by vault
      const latestSnapshots = await prisma.vaultSnapshot.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          vaultId: true,
          totalAssetsUsd: true,
          avgNetApy: true,
          timestamp: true,
        },
        orderBy: { timestamp: "desc" },
      });

      // Deduplicate: keep only latest snapshot per vault
      const latestByVault: Record<string, typeof latestSnapshots[0]> = {};
      for (const snap of latestSnapshots) {
        if (!latestByVault[snap.vaultId]) {
          latestByVault[snap.vaultId] = snap;
        }
      }

      let totalAUM = 0;
      let weightedApySum = 0;
      for (const snap of Object.values(latestByVault)) {
        const aum = snap.totalAssetsUsd || 0;
        const apy = snap.avgNetApy || 0;
        totalAUM += aum;
        weightedApySum += apy * aum;
      }

      const weightedAPY = totalAUM > 0 ? (weightedApySum / totalAUM) * 100 : 3.5;

      // Get curator and vault counts
      const vaultCount = await prisma.vault.count();
      const curatorCount = await prisma.curator.count({
        where: { vaults: { some: {} } },
      });

      // Generate last 30 days with slight variations, but use real data where available
      const realDataMap = new Map(chartData.map(d => [d.date as string, d]));
      const mockData: Record<string, unknown>[] = [];

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        // Use real data if available
        if (realDataMap.has(dateStr)) {
          mockData.push(realDataMap.get(dateStr)!);
        } else {
          // Generate mock data for missing dates
          const aumVariance = 1 + (Math.random() - 0.5) * 0.08;
          const apyVariance = (Math.random() - 0.5) * 0.5;
          const vaultVariance = Math.floor((Math.random() - 0.5) * 4);
          const curatorVariance = Math.floor((Math.random() - 0.5) * 2);
          const mockAum = Math.round((totalAUM || 728000000) * aumVariance * (0.92 + (29 - i) * 0.003));

          const point: Record<string, unknown> = {
            date: dateStr,
            aum: mockAum,
            apy: Number((weightedAPY + apyVariance).toFixed(2)),
            vaults: Math.max(1, vaultCount + vaultVariance),
            curators: Math.max(1, curatorCount + curatorVariance),
          };

          // Distribute mock AUM across curators proportionally
          const curatorCount2 = curatorMeta.length;
          if (curatorCount2 > 0) {
            const perCurator = mockAum / curatorCount2;
            for (let j = 0; j < curatorMeta.length; j++) {
              point[curatorMeta[j].id] = Math.round(perCurator * (1 + (Math.random() - 0.5) * 0.3));
            }
          }

          mockData.push(point);
        }
      }

      return NextResponse.json({
        success: true,
        data: mockData,
        curatorMeta,
      });
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      curatorMeta,
    });
  } catch (error) {
    console.error("Error fetching AUM growth data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch AUM growth data" },
      { status: 500 }
    );
  }
}

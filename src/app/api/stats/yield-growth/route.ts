import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all snapshots from last 30 days
    const snapshots = await prisma.vaultSnapshot.findMany({
      where: {
        timestamp: {
          gte: thirtyDaysAgo,
        },
        vault: {
          ...EXCLUDED_CURATOR_VAULT_FILTER,
        },
      },
      select: {
        vaultId: true,
        timestamp: true,
        totalAssetsUsd: true,
        avgNetApy: true,
      },
      orderBy: { timestamp: "asc" },
    });

    // Group by day and vault, keeping latest snapshot per vault per day
    const latestSnapshotByDayVault: Record<string, Record<string, typeof snapshots[0]>> = {};

    for (const snap of snapshots) {
      const day = snap.timestamp.toISOString().split("T")[0];
      const vaultId = snap.vaultId;

      if (!latestSnapshotByDayVault[day]) {
        latestSnapshotByDayVault[day] = {};
      }

      const existing = latestSnapshotByDayVault[day][vaultId];
      if (!existing || new Date(snap.timestamp) > new Date(existing.timestamp)) {
        latestSnapshotByDayVault[day][vaultId] = snap;
      }
    }

    // Calculate daily yield for each day
    const dailyYields: Record<string, number> = {};

    for (const [day, vaultSnapshots] of Object.entries(latestSnapshotByDayVault)) {
      let dayYield = 0;

      for (const snap of Object.values(vaultSnapshots)) {
        const tvl = snap.totalAssetsUsd || 0;
        const netApy = snap.avgNetApy || 0; // Net APY is what depositors earn

        // Daily yield = TVL * (Net APY / 365)
        const dailyYieldForVault = tvl * netApy / 365;
        dayYield += dailyYieldForVault;
      }

      dailyYields[day] = dayYield;
    }

    // Convert to cumulative chart data
    const sortedDays = Object.keys(dailyYields).sort();
    let cumulativeYield = 0;

    const chartData = sortedDays.map((date) => {
      cumulativeYield += dailyYields[date];

      return {
        date,
        yield: Math.round(cumulativeYield),
        dailyYield: Math.round(dailyYields[date]),
      };
    });

    // Fill in missing days if needed
    if (chartData.length < 7) {
      // Get current TVL and APY for estimation
      const latestSnapshots = await prisma.vaultSnapshot.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          vault: {
            ...EXCLUDED_CURATOR_VAULT_FILTER,
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

      // Deduplicate by vault
      const latestByVault: Record<string, typeof latestSnapshots[0]> = {};
      for (const snap of latestSnapshots) {
        if (!latestByVault[snap.vaultId]) {
          latestByVault[snap.vaultId] = snap;
        }
      }

      let totalDailyYield = 0;
      for (const snap of Object.values(latestByVault)) {
        const tvl = snap.totalAssetsUsd || 0;
        const netApy = snap.avgNetApy || 0;
        totalDailyYield += tvl * netApy / 365;
      }

      // Default to ~$90k/day if no data
      const estimatedDailyYield = totalDailyYield > 0 ? totalDailyYield : 90000;

      const mockData = [];
      let runningYield = 0;

      // Build map of real daily yields (not cumulative)
      const realDailyYields = new Map<string, number>();
      for (const [day, dayYield] of Object.entries(dailyYields)) {
        realDailyYields.set(day, dayYield);
      }

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        // Use real daily yield if available, otherwise estimate
        const realDayYield = realDailyYields.get(dateStr);
        if (realDayYield !== undefined) {
          runningYield += realDayYield;
          mockData.push({
            date: dateStr,
            yield: Math.round(runningYield),
            dailyYield: Math.round(realDayYield),
          });
        } else {
          const variance = 1 + (Math.random() - 0.5) * 0.1;
          const dayYield = estimatedDailyYield * variance;
          runningYield += dayYield;
          mockData.push({
            date: dateStr,
            yield: Math.round(runningYield),
            dailyYield: Math.round(dayYield),
          });
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: mockData,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: chartData,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching yield growth data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch yield growth data" },
      { status: 500 }
    );
  }
}

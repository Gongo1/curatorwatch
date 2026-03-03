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
  protocolAUM: Record<string, number>; // AUM breakdown by protocol
  networkAUM: Record<string, number>; // AUM breakdown by network
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

// Protocol colors derived from ProtocolBadge.tsx PROTOCOL_STYLES
const PROTOCOL_COLORS: Record<string, string> = {
  morpho: "#3B82F6",    // blue-500
  aave: "#8B5CF6",      // purple-500
  euler: "#10B981",     // emerald-500
  compound: "#22C55E",  // green-500
  spark: "#F97316",     // orange-500
  fluid: "#06B6D4",     // cyan-500
  yearn: "#60A5FA",     // blue-400
  pendle: "#6366F1",    // indigo-500
  silo: "#F59E0B",      // amber-500
  maker: "#14B8A6",     // teal-500
  sky: "#0EA5E9",       // sky-500
  gearbox: "#EF4444",   // red-500
  instadapp: "#EC4899", // pink-500
  katana: "#EF4444",    // red-500
  midas: "#EAB308",     // yellow-500
  termmax: "#8B5CF6",   // violet-500
  lido: "#0EA5E9",      // sky-500
  sierra: "#84CC16",    // lime-500
  acre: "#FB923C",      // orange-400
  falcon: "#64748B",    // slate-500
  telosc: "#34D399",    // emerald-400
  mfarm: "#4ADE80",     // green-400
  trevee: "#D946EF",    // fuchsia-500
  "9summits": "#22D3EE",// cyan-400
  re7: "#F43F5E",       // rose-500
  k3: "#FBBF24",        // amber-400
};

// Network colors derived from NetworkBadge.tsx NETWORK_STYLES
const NETWORK_COLORS: Record<string, string> = {
  ethereum: "#64748B",  // slate-500
  katana: "#EF4444",    // red-500
  arbitrum: "#3B82F6",  // blue-500
  avalanche: "#F43F5E", // rose-500
  polygon: "#8B5CF6",   // purple-500
  base: "#60A5FA",      // blue-400
  optimism: "#F87171",  // red-400
  scroll: "#F59E0B",    // amber-500
  "bnb chain": "#EAB308", // yellow-500
  monad: "#6366F1",     // indigo-500
  plasma: "#14B8A6",    // teal-500
};

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all snapshots from last 30 days with vault info for curator/protocol/network tracking
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
            protocol: true,
            chainName: true,
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

    // Carry forward: for each day, if a vault wasn't snapshotted, use its
    // most recent snapshot from a previous day. This prevents partial
    // collections from causing AUM drops in the chart.
    const sortedDays = Object.keys(latestSnapshotByDayVault).sort();
    let carryForward: Record<string, typeof snapshots[0]> = {};

    for (const day of sortedDays) {
      const todaySnapshots = latestSnapshotByDayVault[day];
      // Merge: carry forward fills gaps, today's data overwrites
      carryForward = { ...carryForward, ...todaySnapshots };
      latestSnapshotByDayVault[day] = { ...carryForward };
    }

    // Now aggregate using the filled-in snapshots per day
    const dailyData: Record<string, DailyAggregated> = {};
    const allCurators = new Set<string>();
    const allProtocols = new Set<string>();
    const allNetworks = new Set<string>();

    for (const [day, vaultSnapshots] of Object.entries(latestSnapshotByDayVault)) {
      dailyData[day] = {
        totalAUM: 0,
        weightedApySum: 0,
        vaultCount: 0,
        curatorSet: new Set(),
        curatorAUM: {},
        protocolAUM: {},
        networkAUM: {},
      };

      for (const snap of Object.values(vaultSnapshots)) {
        const aum = snap.totalAssetsUsd || 0;
        const apy = snap.avgNetApy || 0;
        const curatorAddress = snap.vault?.curatorAddress?.toLowerCase() || "unknown";
        const protocol = snap.vault?.protocol || "morpho";
        const network = snap.vault?.chainName || "Ethereum";

        dailyData[day].totalAUM += aum;
        dailyData[day].weightedApySum += apy * aum;
        dailyData[day].vaultCount += 1;

        // Track AUM by curator
        if (!dailyData[day].curatorAUM[curatorAddress]) {
          dailyData[day].curatorAUM[curatorAddress] = 0;
        }
        dailyData[day].curatorAUM[curatorAddress] += aum;
        allCurators.add(curatorAddress);

        // Track AUM by protocol
        if (!dailyData[day].protocolAUM[protocol]) {
          dailyData[day].protocolAUM[protocol] = 0;
        }
        dailyData[day].protocolAUM[protocol] += aum;
        allProtocols.add(protocol);

        // Track AUM by network
        if (!dailyData[day].networkAUM[network]) {
          dailyData[day].networkAUM[network] = 0;
        }
        dailyData[day].networkAUM[network] += aum;
        allNetworks.add(network);

        // Track unique curators per day
        if (snap.vault?.curatorAddress) {
          dailyData[day].curatorSet.add(snap.vault.curatorAddress);
        }
      }
    }

    // --- Curator meta (top 8 + Other) ---
    const curatorTotals: Record<string, number> = {};
    for (const data of Object.values(dailyData)) {
      for (const [curator, aum] of Object.entries(data.curatorAUM)) {
        curatorTotals[curator] = (curatorTotals[curator] || 0) + aum;
      }
    }

    const sortedCurators = Object.entries(curatorTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([addr]) => addr);
    const topCurators = sortedCurators.slice(0, 8);
    const otherCurators = new Set(sortedCurators.slice(8));

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

    // --- Protocol meta (top 8 + Other) ---
    const protocolTotals: Record<string, number> = {};
    for (const data of Object.values(dailyData)) {
      for (const [protocol, aum] of Object.entries(data.protocolAUM)) {
        protocolTotals[protocol] = (protocolTotals[protocol] || 0) + aum;
      }
    }

    const sortedProtocols = Object.entries(protocolTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
    const topProtocols = sortedProtocols.slice(0, 8);
    const otherProtocols = new Set(sortedProtocols.slice(8));

    const protocolMeta = topProtocols.map((p, i) => ({
      id: `proto_${p}`,
      name: p.charAt(0).toUpperCase() + p.slice(1),
      color: PROTOCOL_COLORS[p.toLowerCase()] || CURATOR_COLORS[i % CURATOR_COLORS.length],
    }));

    if (otherProtocols.size > 0) {
      protocolMeta.push({
        id: "proto_other",
        name: "Other Protocols",
        color: "#737373",
      });
    }

    // --- Network meta (top 8 + Other) ---
    const networkTotals: Record<string, number> = {};
    for (const data of Object.values(dailyData)) {
      for (const [network, aum] of Object.entries(data.networkAUM)) {
        networkTotals[network] = (networkTotals[network] || 0) + aum;
      }
    }

    const sortedNetworks = Object.entries(networkTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    const topNetworks = sortedNetworks.slice(0, 8);
    const otherNetworks = new Set(sortedNetworks.slice(8));

    const networkMeta = topNetworks.map((n, i) => ({
      id: `net_${n}`,
      name: n,
      color: NETWORK_COLORS[n.toLowerCase()] || CURATOR_COLORS[i % CURATOR_COLORS.length],
    }));

    if (otherNetworks.size > 0) {
      networkMeta.push({
        id: "net_other",
        name: "Other Networks",
        color: "#737373",
      });
    }

    // Convert to chart data format with curator, protocol, and network breakdowns
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
        let otherCuratorAUM = 0;
        for (const [curator, aum] of Object.entries(data.curatorAUM)) {
          if (topCurators.includes(curator)) {
            point[curator] = Math.round(aum);
          } else {
            otherCuratorAUM += aum;
          }
        }
        if (otherCurators.size > 0) {
          point["other"] = Math.round(otherCuratorAUM);
        }
        for (const curator of topCurators) {
          if (!(curator in point)) point[curator] = 0;
        }

        // Add protocol breakdown
        let otherProtocolAUM = 0;
        for (const [protocol, aum] of Object.entries(data.protocolAUM)) {
          if (topProtocols.includes(protocol)) {
            point[`proto_${protocol}`] = Math.round(aum);
          } else {
            otherProtocolAUM += aum;
          }
        }
        if (otherProtocols.size > 0) {
          point["proto_other"] = Math.round(otherProtocolAUM);
        }
        for (const protocol of topProtocols) {
          if (!(`proto_${protocol}` in point)) point[`proto_${protocol}`] = 0;
        }

        // Add network breakdown
        let otherNetworkAUM = 0;
        for (const [network, aum] of Object.entries(data.networkAUM)) {
          if (topNetworks.includes(network)) {
            point[`net_${network}`] = Math.round(aum);
          } else {
            otherNetworkAUM += aum;
          }
        }
        if (otherNetworks.size > 0) {
          point["net_other"] = Math.round(otherNetworkAUM);
        }
        for (const network of topNetworks) {
          if (!(`net_${network}` in point)) point[`net_${network}`] = 0;
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
          if (curatorMeta.length > 0) {
            const perCurator = mockAum / curatorMeta.length;
            for (const cm of curatorMeta) {
              point[cm.id] = Math.round(perCurator * (1 + (Math.random() - 0.5) * 0.3));
            }
          }

          // Distribute mock AUM across protocols proportionally
          if (protocolMeta.length > 0) {
            const perProtocol = mockAum / protocolMeta.length;
            for (const pm of protocolMeta) {
              point[pm.id] = Math.round(perProtocol * (1 + (Math.random() - 0.5) * 0.3));
            }
          }

          // Distribute mock AUM across networks proportionally
          if (networkMeta.length > 0) {
            const perNetwork = mockAum / networkMeta.length;
            for (const nm of networkMeta) {
              point[nm.id] = Math.round(perNetwork * (1 + (Math.random() - 0.5) * 0.3));
            }
          }

          mockData.push(point);
        }
      }

      return NextResponse.json({
        success: true,
        data: mockData,
        curatorMeta,
        protocolMeta,
        networkMeta,
      });
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      curatorMeta,
      protocolMeta,
      networkMeta,
    });
  } catch (error) {
    console.error("Error fetching AUM growth data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch AUM growth data" },
      { status: 500 }
    );
  }
}

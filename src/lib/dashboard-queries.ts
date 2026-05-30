/**
 * Direct database queries for the combined dashboard endpoint.
 *
 * Runs ALL queries in a single serverless function to avoid
 * spawning 6 separate Vercel functions that each need their own
 * DB connection (which exhausts the connection pool).
 */

import { prisma } from "@/lib/db";
import { getPaginatedCuratorAggregates } from "@/lib/curator-aggregates";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";

const MORPHO_PROTOCOL_FEE_RATE = 0.15;

export async function fetchAllDashboardData(params: {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: string;
  sortOrder: string;
}) {
  // ── 1. Curators (paginated list + summary stats) ──
  const allResult = await getPaginatedCuratorAggregates({
    page: 1,
    pageSize: 500,
    search: params.search,
    sortBy: params.sortBy as "aum" | "vaults" | "name",
    sortOrder: params.sortOrder as "asc" | "desc",
  });

  let curatorsTotalAUM = 0;
  let curatorsTotalVaults = 0;
  let curatorsWeightedApySum = 0;
  for (const c of allResult.curators) {
    curatorsTotalAUM += c.totalAUM;
    curatorsTotalVaults += c.vaultCount;
    curatorsWeightedApySum += c.avgNetApy * c.totalAUM;
  }

  const start = (params.page - 1) * params.pageSize;
  const curators = {
    success: true,
    data: {
      curators: allResult.curators
        .slice(start, start + params.pageSize)
        .map((c) => ({
          curatorId: c.curatorId,
          curatorAddress: c.curatorAddress,
          name: c.name,
          logoUrl: c.logoUrl,
          website: c.website,
          twitter: c.twitter,
          jurisdiction: c.jurisdiction,
          entityType: c.entityType,
          isRegulated: c.isRegulated,
          totalAUM: c.totalAUM,
          vaultCount: c.vaultCount,
          avgApy: c.avgApy,
          avgNetApy: c.avgNetApy,
          assetDistribution: c.assetDistribution,
          protocols: c.protocols,
          networks: c.networks,
          gradeDistribution: c.gradeDistribution,
          dataSources: c.dataSources,
          lastActive: c.lastActive?.toISOString() ?? null,
          riskScore: c.riskScore,
          strategyType: c.strategyType,
          tvlChange30d: c.tvlChange30d,
          tvlChangePct30d: c.tvlChangePct30d,
        })),
      stats: {
        totalCurators: allResult.total,
        totalAUM: curatorsTotalAUM,
        totalVaults: curatorsTotalVaults,
        avgApy:
          curatorsTotalAUM > 0 ? curatorsWeightedApySum / curatorsTotalAUM : 0,
      },
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total: allResult.total,
        totalPages: Math.ceil(allResult.total / params.pageSize),
      },
    },
  };

  // ── 2. Changes summary (lightweight: severity counts only) ──
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const vaultChangeSeverities = await prisma.vaultChange.findMany({
    where: { detectedAt: { gte: since24h } },
    select: { severity: true },
  });

  const platformAlertSeverities = await prisma.platformAlert.findMany({
    where: { detectedAt: { gte: since24h } },
    select: { severity: true },
  });

  const changeSummary = { critical: 0, warning: 0, info: 0, total: 0 };
  for (const c of [...vaultChangeSeverities, ...platformAlertSeverities]) {
    changeSummary.total++;
    if (c.severity === "critical") changeSummary.critical++;
    else if (c.severity === "warning") changeSummary.warning++;
    else if (c.severity === "info") changeSummary.info++;
  }

  const changes = {
    success: true,
    data: {
      changes: [],
      summary: changeSummary,
      curatorAlertCounts: [],
      pagination: {
        total: changeSummary.total,
        limit: 0,
        offset: 0,
        hasMore: false,
      },
    },
  };

  // ── 3. Vaults with latest snapshots (shared query for fees + coverage) ──
  const vaultsData = await prisma.vault.findMany({
    where: { active: true, ...EXCLUDED_CURATOR_VAULT_FILTER },
    select: {
      dataSource: true,
      curatorId: true,
      curatorAddress: true,
      performanceFee: true,
      managementFee: true,
      netAPR: true,
      estTotalAPR: true,
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { totalAssetsUsd: true, avgNetApy: true },
      },
    },
  });

  // Compute global stats from vault data (unaffected by curator search filter)
  let globalTotalAUM = 0;
  let globalWeightedApySum = 0;
  for (const vault of vaultsData) {
    const snap = vault.snapshots[0];
    if (!snap) continue;
    const tvl = snap.totalAssetsUsd || 0;
    globalTotalAUM += tvl;
    globalWeightedApySum += sanitizeApy(snap.avgNetApy) * tvl;
  }
  const globalAvgApy =
    globalTotalAUM > 0 ? globalWeightedApySum / globalTotalAUM : 0;

  // ── 3a. Fees summary (morpho vaults only, matching ?dataSource=morpho) ──
  let annualizedCuratorFees = 0;
  let annualizedMorphoFees = 0;

  for (const vault of vaultsData) {
    if (vault.dataSource !== "morpho") continue;
    const snap = vault.snapshots[0];
    if (!snap) continue;
    const tvl = snap.totalAssetsUsd || 0;
    if (tvl < 1000) continue;

    const performanceFee = vault.performanceFee || 0;
    const managementFee = vault.managementFee || 0;
    const netApy = sanitizeApy(snap.avgNetApy);
    const grossApy =
      performanceFee < 1
        ? (netApy + managementFee) / (1 - performanceFee)
        : netApy;

    annualizedCuratorFees +=
      tvl * managementFee + tvl * grossApy * performanceFee;
    annualizedMorphoFees += tvl * grossApy * MORPHO_PROTOCOL_FEE_RATE;
  }

  const fees = {
    success: true,
    data: {
      summary: {
        annualized: {
          curatorFees: annualizedCuratorFees,
          morphoFees: annualizedMorphoFees,
          totalFees: annualizedCuratorFees + annualizedMorphoFees,
        },
      },
    },
  };

  // ── 3b. Protocol coverage ──
  const coverageMap: Record<
    string,
    { vaults: number; aum: number; curators: Set<string> }
  > = {};
  for (const vault of vaultsData) {
    const ds = vault.dataSource || "morpho";
    if (!coverageMap[ds])
      coverageMap[ds] = { vaults: 0, aum: 0, curators: new Set() };
    coverageMap[ds].vaults += 1;
    coverageMap[ds].aum += vault.snapshots[0]?.totalAssetsUsd || 0;
    const ck = vault.curatorId || vault.curatorAddress;
    if (ck) coverageMap[ds].curators.add(ck.toLowerCase());
  }

  const coverage = {
    success: true,
    data: Object.entries(coverageMap).map(([dataSource, d]) => ({
      dataSource,
      vaultCount: d.vaults,
      totalAUM: d.aum,
      curatorCount: d.curators.size,
    })),
  };

  // ── 4. Yield estimate (computed from current vault data, no extra query) ──
  const yieldEstimate30d = globalTotalAUM * globalAvgApy * (30 / 365);
  const dailyYieldEstimate = yieldEstimate30d / 30;

  // Build 30-element array so page.tsx computes correct daily average
  const yieldDataArray = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    yieldDataArray.push({
      date: date.toISOString().split("T")[0],
      yield: Math.round(dailyYieldEstimate * (i + 1)),
      dailyYield: Math.round(dailyYieldEstimate),
    });
  }

  const yields = { success: true, data: yieldDataArray };

  // ── 5. AUM 30d change (one lightweight snapshot query) ──
  const windowStart = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);

  const oldSnapshots = await prisma.vaultSnapshot.findMany({
    where: {
      timestamp: { gte: windowStart, lte: windowEnd },
      vault: { ...EXCLUDED_CURATOR_VAULT_FILTER },
    },
    select: { vaultId: true, totalAssetsUsd: true },
    orderBy: { timestamp: "desc" },
  });

  // Deduplicate: keep latest per vault in window
  const oldByVault: Record<string, number> = {};
  for (const s of oldSnapshots) {
    if (!oldByVault[s.vaultId]) oldByVault[s.vaultId] = s.totalAssetsUsd;
  }
  const oldAum = Object.values(oldByVault).reduce((a, b) => a + b, 0);

  const aumGrowth = {
    success: true,
    data:
      oldAum > 0
        ? [
            {
              date: windowEnd.toISOString().split("T")[0],
              aum: Math.round(oldAum),
            },
            {
              date: new Date().toISOString().split("T")[0],
              aum: Math.round(globalTotalAUM),
            },
          ]
        : [],
  };

  return { curators, changes, fees, yields, aumGrowth, coverage };
}

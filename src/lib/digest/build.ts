/**
 * Curator Daily — nightly digest builder.
 *
 * Computes the structured DigestData from existing tables (no new ingestion): curator
 * aggregates for ecosystem totals + concentration + the stress index, CuratorSnapshot
 * day-over-day for flows, Vault.createdAt for new vaults, VaultSnapshot for yield
 * moves, Liquidation for incidents, and the precomputed alert stream for severity
 * counts. All queries are serial (transaction pooler, connection_limit=1).
 */

import { prisma } from "@/lib/db";
import { getPaginatedCuratorAggregates } from "@/lib/curator-aggregates";
import { singleManagerFlags } from "@/lib/concentration";
import { computeStressIndex, type StressFlow } from "@/lib/stress-index";
import { isStablecoin } from "@/lib/utils/asset-class";
import { curatorSlug } from "@/lib/curator-aliases";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";
import type { DigestData, DigestFlowItem, DigestYieldMover } from "./types";

const HOUR = 60 * 60 * 1000;

export async function buildDigest(now: Date): Promise<DigestData> {
  const since = new Date(now.getTime() - 24 * HOUR);
  const flowWindowStart = new Date(now.getTime() - 26 * HOUR); // ~24h with cadence tolerance

  // 1. Curator aggregates → ecosystem totals, concentration, stress base.
  const agg = await getPaginatedCuratorAggregates({
    page: 1,
    pageSize: 500,
    sortBy: "aum",
    sortOrder: "desc",
  });
  const curators = agg.curators;
  const totalTvl = curators.reduce((s, c) => s + c.totalAUM, 0);
  const vaultCount = curators.reduce((s, c) => s + c.vaultCount, 0);
  let stableTvl = 0;
  for (const c of curators)
    for (const a of c.assetDistribution) if (isStablecoin(a.symbol)) stableTvl += a.amountUsd;

  const concentration = singleManagerFlags(curators, {
    thresholdPct: 84,
    minAssetUsd: 50_000_000,
  });

  // 2. Curator flows from CuratorSnapshot (~24h): baseline (first) vs current (last).
  const snaps = await prisma.curatorSnapshot.findMany({
    where: { timestamp: { gte: flowWindowStart } },
    orderBy: { timestamp: "asc" },
    select: { curatorId: true, totalAssetsUsd: true },
  });
  const byCur = new Map<string, { first: number; last: number }>();
  for (const s of snaps) {
    const e = byCur.get(s.curatorId);
    if (!e) byCur.set(s.curatorId, { first: s.totalAssetsUsd, last: s.totalAssetsUsd });
    else e.last = s.totalAssetsUsd;
  }
  const curById = new Map(curators.map((c) => [c.curatorId, c]));
  const flows: DigestFlowItem[] = [];
  let baselineTvl = 0;
  for (const [curatorId, { first, last }] of byCur) {
    baselineTvl += first;
    const c = curById.get(curatorId);
    if (!c) continue; // excluded / synthetic — not in the public directory
    const deltaUsd = last - first;
    if (Math.abs(deltaUsd) < 1) continue;
    flows.push({
      curatorId,
      name: c.name,
      slug: curatorSlug(c.name, c.curatorAddress),
      deltaUsd,
      pct: first > 0 ? (deltaUsd / first) * 100 : 0,
      currentUsd: last,
    });
  }
  const sortedFlows = [...flows].sort((a, b) => b.deltaUsd - a.deltaUsd);
  const topInflows = sortedFlows.filter((f) => f.deltaUsd > 0).slice(0, 5);
  const topOutflows = sortedFlows
    .filter((f) => f.deltaUsd < 0)
    .slice(-5)
    .reverse();
  const netFlowUsd = flows.reduce((s, f) => s + f.deltaUsd, 0);
  const grossOutflowUsd = flows
    .filter((f) => f.deltaUsd < 0)
    .reduce((s, f) => s + Math.abs(f.deltaUsd), 0);

  const flow: StressFlow = {
    netFlowPct: baselineTvl > 0 ? netFlowUsd / baselineTvl : 0,
    grossOutflowPct: baselineTvl > 0 ? grossOutflowUsd / baselineTvl : 0,
    windowDays: 1,
  };
  const stress = computeStressIndex(curators, flow);

  // 3. New vaults — first ingested in the last 24h, above the dust floor.
  const newRows = await prisma.vault.findMany({
    where: { createdAt: { gte: since }, active: true },
    select: {
      name: true,
      assetSymbol: true,
      chainName: true,
      curator: { select: { name: true, address: true } },
      snapshots: { orderBy: { timestamp: "desc" }, take: 1, select: { totalAssetsUsd: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const newVaults = newRows
    .map((v) => ({
      name: v.name,
      curator: v.curator?.name ?? null,
      curatorSlug: v.curator ? curatorSlug(v.curator.name, v.curator.address) : null,
      assetSymbol: v.assetSymbol,
      chainName: v.chainName ?? "Ethereum",
      tvl: v.snapshots[0]?.totalAssetsUsd ?? 0,
    }))
    .filter((v) => v.tvl >= 100_000)
    .slice(0, 8);

  // 4. Yield movers — latest vs ~24h-prior net APY per vault (decimal, sanitized).
  const ySnaps = await prisma.vaultSnapshot.findMany({
    where: { timestamp: { gte: flowWindowStart } },
    orderBy: { timestamp: "asc" },
    select: { vaultId: true, avgNetApy: true, netApy: true, apy: true, totalAssetsUsd: true },
  });
  const yByVault = new Map<
    string,
    { first: number; last: number; tvl: number }
  >();
  for (const s of ySnaps) {
    const v = sanitizeApy(s.avgNetApy ?? s.netApy ?? s.apy ?? 0);
    const e = yByVault.get(s.vaultId);
    if (!e) yByVault.set(s.vaultId, { first: v, last: v, tvl: s.totalAssetsUsd ?? 0 });
    else {
      e.last = v;
      e.tvl = s.totalAssetsUsd ?? e.tvl;
    }
  }
  const moverCandidates = [...yByVault.entries()]
    .map(([vaultId, e]) => ({ vaultId, deltaPct: (e.last - e.first) * 100, tvl: e.tvl, oldApyPct: e.first * 100, newApyPct: e.last * 100 }))
    .filter((m) => Math.abs(m.deltaPct) >= 0.75 && m.tvl >= 1_000_000)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 6);
  let yieldMovers: DigestYieldMover[] = [];
  if (moverCandidates.length) {
    const moverVaults = await prisma.vault.findMany({
      where: { id: { in: moverCandidates.map((m) => m.vaultId) } },
      select: { id: true, name: true, assetSymbol: true, curator: { select: { name: true } } },
    });
    const vById = new Map(moverVaults.map((v) => [v.id, v]));
    yieldMovers = moverCandidates
      .map((m) => {
        const v = vById.get(m.vaultId);
        if (!v) return null;
        return {
          vaultName: v.name,
          curator: v.curator?.name ?? null,
          assetSymbol: v.assetSymbol,
          oldApyPct: m.oldApyPct,
          newApyPct: m.newApyPct,
          deltaPct: m.deltaPct,
        };
      })
      .filter((m): m is DigestYieldMover => m !== null);
  }

  // 5. Incidents — liquidations in the last 24h, attributed to curators via market.
  const liqs = await prisma.liquidation.findMany({
    where: { timestamp: { gte: since } },
    select: { marketUniqueKey: true, seizedAssetsUsd: true, badDebtAssetsUsd: true },
  });
  const seizedUsd = liqs.reduce((s, l) => s + (l.seizedAssetsUsd ?? 0), 0);
  const badDebtUsd = liqs.reduce((s, l) => s + (l.badDebtAssetsUsd ?? 0), 0);
  const topCurators: { curator: string; seizedUsd: number }[] = [];
  if (liqs.length) {
    const marketKeys = [...new Set(liqs.map((l) => l.marketUniqueKey))];
    const allocs = await prisma.marketAllocation.findMany({
      where: { marketUniqueKey: { in: marketKeys } },
      select: { marketUniqueKey: true, vault: { select: { curator: { select: { name: true } } } } },
    });
    const marketToCurator = new Map<string, string>();
    for (const a of allocs) {
      const n = a.vault?.curator?.name;
      if (n && !marketToCurator.has(a.marketUniqueKey)) marketToCurator.set(a.marketUniqueKey, n);
    }
    const byCurator = new Map<string, number>();
    for (const l of liqs) {
      const n = marketToCurator.get(l.marketUniqueKey);
      if (!n) continue;
      byCurator.set(n, (byCurator.get(n) ?? 0) + (l.seizedAssetsUsd ?? 0));
    }
    topCurators.push(
      ...[...byCurator.entries()]
        .map(([curator, usd]) => ({ curator, seizedUsd: usd }))
        .sort((a, b) => b.seizedUsd - a.seizedUsd)
        .slice(0, 3)
    );
  }

  // 6. Alert severity counts (precomputed alert stream, last 24h).
  const [vaultChangeSev, platformAlertSev] = [
    await prisma.vaultChange.findMany({ where: { detectedAt: { gte: since } }, select: { severity: true } }),
    await prisma.platformAlert.findMany({ where: { detectedAt: { gte: since } }, select: { severity: true } }),
  ];
  const alertCounts = { critical: 0, warning: 0, info: 0 };
  for (const a of [...vaultChangeSev, ...platformAlertSev]) {
    if (a.severity === "critical") alertCounts.critical++;
    else if (a.severity === "warning") alertCounts.warning++;
    else alertCounts.info++;
  }

  const slug = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  return {
    slug,
    date: now.toISOString(),
    windowHours: 24,
    ecosystem: {
      totalTvl,
      curatorCount: curators.length,
      vaultCount,
      stableTvl,
      stablePct: totalTvl > 0 ? (stableTvl / totalTvl) * 100 : 0,
      netFlowUsd,
      netFlowPct: flow.netFlowPct * 100,
    },
    stress,
    concentration,
    topInflows,
    topOutflows,
    newVaults,
    yieldMovers,
    incidents: { count: liqs.length, badDebtUsd, seizedUsd, topCurators },
    alertCounts,
  };
}

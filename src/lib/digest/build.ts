/**
 * Curator Daily — nightly digest builder.
 *
 * Computes the structured DigestData from existing tables (no new ingestion): curator
 * aggregates for ecosystem totals + concentration + the stress index, CuratorSnapshot
 * day-over-day for flows, Vault.createdAt for new vaults, VaultSnapshot for yield
 * moves, Liquidation for incidents, and the precomputed alert stream for severity
 * counts. All queries are serial (transaction pooler, connection_limit=1).
 *
 * Freshness guard: every edition carries per-source "as of" times; vault
 * sources past their SLA are left out of the tables (and named), a stale
 * liquidation feed omits INCIDENTS instead of printing "no liquidations". The
 * digest cron refuses to publish at all on digestBlockers() (Morpho or Turtle
 * past SLA, or any failed quality assertion).
 */

import { prisma } from "@/lib/db";
import { getPaginatedCuratorAggregates } from "@/lib/curator-aggregates";
import { singleManagerFlags } from "@/lib/concentration";
import { computeStressIndex, type StressFlow } from "@/lib/stress-index";
import { isStablecoin } from "@/lib/utils/asset-class";
import { curatorSlug } from "@/lib/curator-aliases";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";
import { CURATOR_DOSSIERS, getCuratorDossier } from "@/lib/curator-dossier";
import { composeBlurbSentences } from "@/lib/curator-blurb-text";
import {
  getSourceFreshness,
  vaultSourceKey,
  type HealthBreach,
  type SourceFreshness,
} from "@/lib/health/freshness";
import type {
  DigestData,
  DigestFlowItem,
  DigestNewsItem,
  DigestSpotlight,
  DigestYieldMover,
} from "./types";

const HOUR = 60 * 60 * 1000;

/** Sources the edition cannot go out without (they carry most of the tracked TVL). */
const DIGEST_REQUIRED_SOURCES = ["morpho-v1", "morpho-v2", "turtle"];

/**
 * Breaches that block publication: a required source past its SLA or under
 * its coverage floor, or any failed data-quality assertion.
 */
export function digestBlockers(breaches: HealthBreach[]): HealthBreach[] {
  return breaches.filter(
    (b) =>
      b.kind === "quality" ||
      ((b.kind === "freshness" || b.kind === "coverage") &&
        DIGEST_REQUIRED_SOURCES.some((k) => b.key === `${b.kind}:${k}`))
  );
}

export async function buildDigest(
  now: Date,
  freshness?: SourceFreshness[]
): Promise<DigestData> {
  const since = new Date(now.getTime() - 24 * HOUR);
  const flowWindowStart = new Date(now.getTime() - 26 * HOUR); // ~24h with cadence tolerance

  // 0. Source freshness → as-of labels + stale vault sources to leave out.
  const sources = freshness ?? (await getSourceFreshness(now));
  const staleVaultSources = new Set(
    sources.filter((s) => s.kind === "vaults" && s.stale && (s.activeVaults ?? 0) > 0).map((s) => s.key)
  );
  const isExcluded = (v: { dataSource: string; riskSnapshots: unknown[] }) =>
    staleVaultSources.has(vaultSourceKey(v.dataSource, v.riskSnapshots.length > 0));
  const liquidationsStale = sources.find((s) => s.key === "liquidations")?.stale ?? false;

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
    const c = curById.get(curatorId);
    if (!c) continue; // excluded / synthetic — not in the public directory
    // Denominator (baselineTvl) and numerator (flows) must range over the SAME set:
    // directory curators only. Synthetic/excluded rows still get CuratorSnapshots, so
    // counting their baseline here would bias netFlowPct + the stress flow score low.
    baselineTvl += first;
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
      dataSource: true,
      riskSnapshots: { take: 1, select: { id: true } }, // Morpho V2 marker
      curator: { select: { name: true, address: true } },
      snapshots: { orderBy: { timestamp: "desc" }, take: 1, select: { totalAssetsUsd: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const newVaults = newRows
    .filter((v) => !isExcluded(v))
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
    .slice(0, 20); // headroom: stale-source vaults are dropped below, 6 kept
  let yieldMovers: DigestYieldMover[] = [];
  if (moverCandidates.length) {
    const moverVaults = await prisma.vault.findMany({
      where: { id: { in: moverCandidates.map((m) => m.vaultId) } },
      select: {
        id: true,
        name: true,
        assetSymbol: true,
        dataSource: true,
        riskSnapshots: { take: 1, select: { id: true } },
        curator: { select: { name: true } },
      },
    });
    const vById = new Map(moverVaults.map((v) => [v.id, v]));
    yieldMovers = moverCandidates
      .map((m) => {
        const v = vById.get(m.vaultId);
        if (!v || isExcluded(v)) return null;
        return {
          vaultName: v.name,
          curator: v.curator?.name ?? null,
          assetSymbol: v.assetSymbol,
          oldApyPct: m.oldApyPct,
          newApyPct: m.newApyPct,
          deltaPct: m.deltaPct,
        };
      })
      .filter((m): m is DigestYieldMover => m !== null)
      .slice(0, 6);
  }

  // 5. Incidents — liquidations in the last 24h, attributed to curators via market.
  // A stale liquidation feed is omitted (flagged), never reported as "no liquidations".
  const liqs = liquidationsStale
    ? []
    : await prisma.liquidation.findMany({
        where: { timestamp: { gte: since } },
        select: { marketUniqueKey: true, seizedAssetsUsd: true, badDebtAssetsUsd: true },
      });
  const seizedUsd = liqs.reduce((s, l) => s + (l.seizedAssetsUsd ?? 0), 0);
  const badDebtUsd = liqs.reduce((s, l) => s + (l.badDebtAssetsUsd ?? 0), 0);
  const topCurators: { curator: string; seizedUsd: number }[] = [];
  if (liqs.length) {
    const marketKeys = [...new Set(liqs.map((l) => l.marketUniqueKey))];
    // MarketAllocation is an append-only time-series and a market can be held by many
    // vaults/curators. Attribute each market deterministically to the LARGEST supplier in
    // its MOST RECENT allocation snapshot (orderBy snapshotTime desc, then supplyAssetsUsd
    // desc + first-wins) — not an arbitrary row, which previously mis-named the "most
    // exposed" curator in the published digest.
    const allocs = await prisma.marketAllocation.findMany({
      where: { marketUniqueKey: { in: marketKeys } },
      select: {
        marketUniqueKey: true,
        vault: { select: { curator: { select: { name: true } } } },
      },
      orderBy: [{ snapshotTime: "desc" }, { supplyAssetsUsd: "desc" }],
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

  // 7. Newswire — fresh curator-tagged coverage (48h window: press is slower
  // than on-chain data), newest first, one story per URL.
  const newsRows = await prisma.curatorNews.findMany({
    where: { publishedAt: { gte: new Date(now.getTime() - 48 * HOUR) } },
    orderBy: { publishedAt: "desc" },
    select: {
      title: true,
      url: true,
      source: true,
      publishedAt: true,
      curator: { select: { name: true } },
    },
    take: 30,
  });
  const seenUrls = new Set<string>();
  const news: DigestNewsItem[] = [];
  for (const n of newsRows) {
    if (seenUrls.has(n.url)) continue;
    seenUrls.add(n.url);
    news.push({
      title: n.title,
      url: n.url,
      source: n.source,
      curator: n.curator?.name ?? null,
      publishedAt: n.publishedAt.toISOString(),
    });
    if (news.length >= 5) break;
  }

  // 8. Curator spotlight — deterministic daily rotation through the dossier
  // registry (top curators with hand-verified facts), skipping any address not
  // currently in the directory. Blurb sentences come from the same shared
  // composer as the profile About card.
  let spotlight: DigestSpotlight | null = null;
  const dossierKeys = Object.keys(CURATOR_DOSSIERS).sort();
  const dayIndex = Math.floor(now.getTime() / (24 * HOUR));
  const aggByAddress = new Map(curators.map((c) => [c.curatorAddress.toLowerCase(), c]));
  for (let i = 0; i < dossierKeys.length && !spotlight; i++) {
    const addr = dossierKeys[(dayIndex + i) % dossierKeys.length];
    const c = aggByAddress.get(addr);
    if (!c) continue;
    const spotVaults = await prisma.vault.findMany({
      where: { curator: { address: addr }, active: true },
      select: {
        chainId: true,
        protocol: true,
        assetSymbol: true,
        creationTimestamp: true,
        snapshots: { orderBy: { timestamp: "desc" }, take: 1, select: { totalAssetsUsd: true } },
      },
    });
    if (spotVaults.length === 0) continue;
    const byAsset = new Map<string, number>();
    for (const v of spotVaults) {
      byAsset.set(
        v.assetSymbol,
        (byAsset.get(v.assetSymbol) ?? 0) + (v.snapshots[0]?.totalAssetsUsd ?? 0)
      );
    }
    const inceptions = spotVaults
      .map((v) => v.creationTimestamp)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const dossier = getCuratorDossier(addr);
    const sentences = composeBlurbSentences(
      {
        name: c.name ?? "This curator",
        vaultCount: spotVaults.length,
        tvlUsd: spotVaults.reduce((s, v) => s + (v.snapshots[0]?.totalAssetsUsd ?? 0), 0),
        chainCount: new Set(spotVaults.map((v) => v.chainId)).size,
        protocolCount: new Set(spotVaults.map((v) => v.protocol ?? "morpho")).size,
        assetCount: byAsset.size,
        stables: [...byAsset.entries()]
          .filter(([sym]) => isStablecoin(sym))
          .sort((a, b) => b[1] - a[1])
          .map(([sym]) => sym),
        sinceYear: inceptions.length
          ? new Date(Math.min(...inceptions) * 1000).getUTCFullYear()
          : null,
      },
      dossier
    );
    const q = dossier?.quotes?.[0];
    spotlight = {
      name: c.name ?? "This curator",
      slug: curatorSlug(c.name, c.curatorAddress),
      sentences,
      highlight: dossier?.highlights?.[0] ?? null,
      quote: q ? { text: q.text, source: q.source, url: q.url } : null,
    };
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
    incidents: {
      count: liqs.length,
      badDebtUsd,
      seizedUsd,
      topCurators,
      ...(liquidationsStale ? { stale: true } : {}),
    },
    alertCounts,
    news,
    spotlight,
    asOf: sources.map((s) => ({ key: s.key, label: s.label, lastAt: s.lastAt, stale: s.stale })),
    excludedSources: sources.filter((s) => staleVaultSources.has(s.key)).map((s) => s.label),
  };
}

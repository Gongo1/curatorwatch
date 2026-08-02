/**
 * Single-manager concentration — "who really controls each asset."
 *
 * Pure (isomorphic) helpers over the per-curator assetDistribution that the
 * directory already loads, so they run on the server (digest, stress index) or the
 * client (home strip) without an extra query. Answers the question pharos
 * structurally cannot: an allocator in "USDC" is really choosing a *manager*, and
 * several dollars (USDS, DAI, RLUSD, …) are ≥84% run by a single curator.
 */

import { isStablecoin } from "@/lib/utils/asset-class";

export interface CuratorLike {
  name: string | null;
  curatorAddress: string;
  totalAUM: number;
  assetDistribution: { symbol: string; amountUsd: number }[];
}

export interface AssetConcentration {
  symbol: string;
  isStable: boolean;
  totalUsd: number;
  curatorCount: number;
  topCurator: string | null;
  topCuratorAddress: string | null;
  topCuratorUsd: number;
  /** Share of this asset's vault TVL run by its #1 curator, 0–100. */
  topCuratorPct: number;
}

/** Per-asset concentration across all curators, sorted by total TVL desc. */
export function computeAssetConcentration(curators: CuratorLike[]): AssetConcentration[] {
  const assets = new Map<
    string,
    { total: number; byCurator: Map<string, { name: string | null; usd: number }> }
  >();

  for (const c of curators) {
    for (const a of c.assetDistribution) {
      if (!a.amountUsd) continue;
      let e = assets.get(a.symbol);
      if (!e) {
        e = { total: 0, byCurator: new Map() };
        assets.set(a.symbol, e);
      }
      e.total += a.amountUsd;
      const prev = e.byCurator.get(c.curatorAddress);
      e.byCurator.set(c.curatorAddress, {
        name: c.name,
        usd: (prev?.usd ?? 0) + a.amountUsd,
      });
    }
  }

  const out: AssetConcentration[] = [];
  for (const [symbol, e] of assets) {
    let topUsd = 0;
    let topName: string | null = null;
    let topAddr: string | null = null;
    for (const [addr, v] of e.byCurator) {
      if (v.usd > topUsd) {
        topUsd = v.usd;
        topName = v.name;
        topAddr = addr;
      }
    }
    out.push({
      symbol,
      isStable: isStablecoin(symbol),
      totalUsd: e.total,
      curatorCount: e.byCurator.size,
      topCurator: topName,
      topCuratorAddress: topAddr,
      topCuratorUsd: topUsd,
      topCuratorPct: e.total > 0 ? (topUsd / e.total) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.totalUsd - a.totalUsd);
}

export interface ConcentrationFlagOptions {
  /** Ignore assets smaller than this (avoids flagging dust). */
  minAssetUsd?: number;
  /** Single-manager dominance cutoff, 0–100. */
  thresholdPct?: number;
  /** Restrict to stablecoins (the lens default). */
  stableOnly?: boolean;
}

/**
 * Assets where one curator controls >= thresholdPct of the asset's TVL — the
 * single-points-of-failure an allocator dashboard should flag.
 */
export function singleManagerFlags(
  curators: CuratorLike[],
  opts: ConcentrationFlagOptions = {}
): AssetConcentration[] {
  const { minAssetUsd = 50_000_000, thresholdPct = 84, stableOnly = true } = opts;
  return computeAssetConcentration(curators).filter(
    (a) =>
      a.totalUsd >= minAssetUsd &&
      a.topCuratorPct >= thresholdPct &&
      (!stableOnly || a.isStable)
  );
}

/**
 * Single-point-of-failure share of stablecoin TVL: the fraction (0–100) of total
 * stablecoin vault TVL that sits behind each asset's single dominant manager.
 * High = structurally fragile. Feeds the curator stress index.
 */
export function stablecoinSpofPct(curators: CuratorLike[]): number {
  const conc = computeAssetConcentration(curators).filter((a) => a.isStable);
  let total = 0;
  let topSum = 0;
  for (const a of conc) {
    total += a.totalUsd;
    topSum += a.topCuratorUsd;
  }
  return total > 0 ? (topSum / total) * 100 : 0;
}

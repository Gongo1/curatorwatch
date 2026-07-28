import type { CuratorDashboardItem } from "@/lib/types/api";
import { isStablecoin } from "@/lib/utils/asset-class";
import { singleManagerFlags, type AssetConcentration } from "@/lib/concentration";

// First-viewport aggregates for the curators home, computed from the FULL
// curator set. Extracted from home-client so the server page can compute them
// before the account gate slices the row list — the public hero (asset mix,
// concentration flags, largest curator) must always reconcile with total TVL,
// regardless of how many ranking rows the viewer is allowed to see.

export interface HomeOverview {
  mix: {
    segments: { symbol: string; pct: number }[];
    stablePct: number;
  };
  concFlags: AssetConcentration[];
  largest: CuratorDashboardItem | null;
}

export function computeHomeOverview(
  curators: CuratorDashboardItem[]
): HomeOverview {
  // Asset mix, summed from the curator list so it reconciles exactly with the
  // tracked-TVL hero (no separate, differently-scoped query).
  const map: Record<string, number> = {};
  let total = 0;
  for (const c of curators)
    for (const a of c.assetDistribution) {
      map[a.symbol] = (map[a.symbol] || 0) + a.amountUsd;
      total += a.amountUsd;
    }
  const sorted = Object.entries(map).sort((x, y) => y[1] - x[1]);
  const top = sorted.slice(0, 6);
  const otherAmt = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
  const stableAmt = sorted
    .filter(([s]) => isStablecoin(s))
    .reduce((s, [, v]) => s + v, 0);
  const segments = [
    ...top.map(([symbol, amount]) => ({
      symbol,
      pct: total ? (amount / total) * 100 : 0,
    })),
    ...(otherAmt > 0
      ? [{ symbol: "Other", pct: total ? (otherAmt / total) * 100 : 0 }]
      : []),
  ];

  return {
    mix: { segments, stablePct: total ? (stableAmt / total) * 100 : 0 },
    concFlags: singleManagerFlags(curators, {
      thresholdPct: 84,
      minAssetUsd: 50_000_000,
    }).slice(0, 6),
    largest: curators.length
      ? curators.reduce((a, b) => (b.totalAUM > a.totalAUM ? b : a))
      : null,
  };
}

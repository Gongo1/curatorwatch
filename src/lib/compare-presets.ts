/**
 * One-click compare "packs" — pharos's "The Big Four" idea, curator-side. Pure
 * selectors over the already-loaded curators array (no backend), returning up to 4
 * curator addresses to populate the compare `c` URL param.
 */

import type { CuratorDashboardItem } from "@/lib/types/api";
import { isStablecoin } from "@/lib/utils/asset-class";

// Established "blue-chip" dollars (vs newer issuer-subsidized stables).
const BLUE_CHIP_STABLES = new Set(["USDC", "USDT", "USDS", "DAI", "USDE", "SUSDE", "PYUSD"]);

function assetShare(c: CuratorDashboardItem, pred: (sym: string) => boolean): number {
  let total = 0;
  let hit = 0;
  for (const a of c.assetDistribution) {
    total += a.amountUsd;
    if (pred(a.symbol)) hit += a.amountUsd;
  }
  return total > 0 ? (hit / total) * 100 : 0;
}

const addrs = (cs: CuratorDashboardItem[]) => cs.slice(0, 4).map((c) => c.curatorAddress.toLowerCase());

export interface ComparePreset {
  id: string;
  label: string;
  hint: string;
  select: (curators: CuratorDashboardItem[]) => string[];
}

export const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: "blue-chip-4",
    label: "Blue-chip 4",
    hint: "Largest curators running mostly blue-chip dollars",
    select: (curators) =>
      addrs(
        curators
          .filter((c) => assetShare(c, (s) => BLUE_CHIP_STABLES.has(s.toUpperCase())) >= 60)
          .sort((a, b) => b.totalAUM - a.totalAUM)
      ),
  },
  {
    id: "new-stable-yield",
    label: "New-stable yield",
    hint: "Top net APY among curators in newer issuer dollars (PYUSD/RLUSD/AUSD/…)",
    select: (curators) =>
      addrs(
        curators
          .filter(
            (c) =>
              c.totalAUM >= 10_000_000 &&
              assetShare(c, (s) => isStablecoin(s) && !BLUE_CHIP_STABLES.has(s.toUpperCase())) >= 40
          )
          .sort((a, b) => b.avgNetApy - a.avgNetApy)
      ),
  },
];

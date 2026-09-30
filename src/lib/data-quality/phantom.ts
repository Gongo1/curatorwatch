/**
 * Phantom-accrual guard for snapshot writes.
 *
 * Some vaults report TVL that no depositor put in: a market stuck at 100%
 * utilization accrues interest at the IRM ceiling (apy 2979.96 = e^8 - 1)
 * that no borrower will ever repay, so the share price and "TVL" climb while
 * the share supply does not move (e.g. Adpend USDC: share price 83.8 -> 438.5
 * with supply +0.5%). Such a vault is flagged 'phantom' and left out of totals.
 *
 * Pure: collectors call assessPhantom() with the raw source values, then
 * recordSnapshotWritten() (maintenance.ts) persists the flag.
 */

import { MAX_SANE_APY } from "../utils/sanitize-apy";
import { isStablecoin } from "../utils/asset-class";

/** A stablecoin vault's share price above this is not real accrual. */
export const MAX_STABLE_SHARE_PRICE = 5;
/** Asset-unit TVL growth over ~30 days that needs deposits to explain it. */
export const PHANTOM_TVL_GROWTH_30D = 0.2;
/** ...while the share supply moved less than this. */
export const PHANTOM_SUPPLY_CHANGE_30D = 0.02;

/** A snapshot from ~30 days ago (raw BigInt strings, as stored). */
export interface PhantomBaseline {
  totalAssets: string;
  totalSupply: string;
}

export interface PhantomInput {
  /** Decimal APYs as the source reports them, BEFORE sanitizing. */
  apy?: number | null;
  netApy?: number | null;
  sharePrice?: number | null;
  assetSymbol: string;
  /** Raw BigInt strings; "0" when the source has no on-chain units. */
  totalAssets?: string | null;
  totalSupply?: string | null;
  baseline?: PhantomBaseline | null;
}

function toBig(v: string | null | undefined): bigint | null {
  if (!v || !/^\d+$/.test(v)) return null;
  const b = BigInt(v);
  return b > 0n ? b : null;
}

/**
 * Returns why the snapshot looks like phantom accrual, or null when it looks
 * real. TVL growth is measured in ASSET units, not USD: a USD test would flag
 * every ETH vault in an ETH rally.
 */
export function assessPhantom(i: PhantomInput): string | null {
  for (const [label, v] of [["apy", i.apy], ["netApy", i.netApy]] as const) {
    if (v != null && Number.isFinite(v) && v > MAX_SANE_APY) {
      return `${label} ${v.toFixed(2)} > ${MAX_SANE_APY}`;
    }
  }

  if (
    isStablecoin(i.assetSymbol) &&
    i.sharePrice != null &&
    i.sharePrice > MAX_STABLE_SHARE_PRICE
  ) {
    return `stablecoin share price ${i.sharePrice.toFixed(2)} > ${MAX_STABLE_SHARE_PRICE}`;
  }

  const assets = toBig(i.totalAssets);
  const supply = toBig(i.totalSupply);
  const baseAssets = toBig(i.baseline?.totalAssets);
  const baseSupply = toBig(i.baseline?.totalSupply);
  if (assets && supply && baseAssets && baseSupply) {
    const assetGrowth = Number(assets - baseAssets) / Number(baseAssets);
    const supplyChange = Math.abs(Number(supply - baseSupply)) / Number(baseSupply);
    if (assetGrowth > PHANTOM_TVL_GROWTH_30D && supplyChange < PHANTOM_SUPPLY_CHANGE_30D) {
      return `assets +${(assetGrowth * 100).toFixed(1)}% in 30d with supply ${(supplyChange * 100).toFixed(2)}%`;
    }
  }

  return null;
}

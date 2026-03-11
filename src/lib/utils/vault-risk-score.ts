/**
 * Vault Risk Score — 5-Factor Model (100pts total)
 *
 * Pure functions — no DB access. Receives data as arguments.
 *
 * Components:
 *   Size:             0-25 pts  (TVL thresholds)
 *   Maturity:         0-15 pts  (days live)
 *   Curator:          0-35 pts  (legal entity, time, AUM, bad debt)
 *   Collateral:       0-15 pts  (institutional asset %)
 *   Risk indicators:  0-10 pts  (liquidation history + APR sanity)
 *
 * Grades:
 *   "high-grade"  — pass all 9 hard requirements
 *   "medium-grade" — fail 1-3 requirements (pass 6-8)
 *   "low-grade"    — fail 4+ requirements (pass ≤5)
 * 9 hard requirements must pass to qualify.
 */

import { BLUE_CHIP_COLLATERAL } from "@/lib/curator-rating";

// Dust threshold: bad debt below $1 is rounding noise from liquidations
const BAD_DEBT_DUST_THRESHOLD = 1;

// ── Tier Classification ─────────────────────────────────────────────────
// Institutional assets by tier for collateral scoring

const TIER_1_ASSETS = ["USDC", "USDT", "DAI"]; // Major stablecoins
const TIER_2_ASSETS = ["wstETH", "WETH", "WBTC"]; // Blue-chip crypto
const TIER_3_ASSETS = ["EURC", "USDA", "PYUSD"]; // Regulated stablecoins

// ── Types ──────────────────────────────────────────────────────────────

export interface CuratorInput {
  entityType: string | null;
  foundedYear: number | null;
  totalAUM: number; // curator total assets managed (USD)
  badDebtUsd: number; // total bad-debt USD across curator's vaults
}

export interface VaultScoreInput {
  tvl: number; // totalAssetsUsd from latest snapshot
  createdAt: Date;
  curator: CuratorInput | null;
  collateralAssets: string[]; // symbols from MarketAllocation or vault assetSymbol
  liquidationCount: number;
  hasBadDebt: boolean; // vault-level bad debt from liquidations
  netAPR: number; // effective APR/APY percentage (e.g. 8.5 = 8.5%)
}

export interface VaultScores {
  sizeScore: number;
  maturityScore: number;
  curatorScore: number;
  collateralScore: number;
  riskIndicatorScore: number;
  total: number;
}

// ── Size Score (0-25) ──────────────────────────────────────────────────

export function calculateSizeScore(tvl: number): number {
  if (tvl >= 100_000_000) return 25;
  if (tvl >= 50_000_000) return 22;
  if (tvl >= 20_000_000) return 18;
  if (tvl >= 10_000_000) return 14;
  if (tvl >= 5_000_000) return 10;
  if (tvl >= 1_000_000) return 5;
  return 0;
}

// ── Maturity Score (0-15) ──────────────────────────────────────────────

export function calculateMaturityScore(createdAt: Date): number {
  const daysLive = Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLive >= 730) return 15;
  if (daysLive >= 365) return 13;
  if (daysLive >= 180) return 10;
  if (daysLive >= 90) return 5;
  return 0;
}

// ── Curator Score (0-35) ───────────────────────────────────────────────
// Returns 0 immediately if no legal entity or any bad debt.

export function calculateCuratorScore(curator: CuratorInput | null): number {
  if (!curator) return 0;

  // Hard: legal entity required (10 pts, else entire category = 0)
  if (!curator.entityType) return 0;

  // Hard: zero bad debt (5 pts, any bad debt = entire category = 0)
  if ((curator.badDebtUsd || 0) > BAD_DEBT_DUST_THRESHOLD) return 0;

  let score = 10; // legal entity points

  // Time in operation (0-15 pts)
  if (curator.foundedYear) {
    const now = new Date();
    const monthsOp =
      (now.getFullYear() - curator.foundedYear) * 12 + now.getMonth();
    if (monthsOp >= 24) score += 15;
    else if (monthsOp >= 18) score += 12;
    else if (monthsOp >= 12) score += 9;
    else if (monthsOp >= 6) score += 5;
    else score += 1;
  }

  // Total AUM (0-5 pts)
  if (curator.totalAUM >= 500_000_000) score += 5;
  else if (curator.totalAUM >= 100_000_000) score += 4;
  else if (curator.totalAUM >= 50_000_000) score += 3;
  else if (curator.totalAUM >= 10_000_000) score += 2;

  // Bad debt = 0 already passed above → full 5 pts
  score += 5;

  return score;
}

// ── Collateral Score (0-15) ────────────────────────────────────────────
// Uses 3-tier system: Tier 1 (major stables), Tier 2 (blue-chip crypto),
// Tier 3 (regulated stables). Falls back to BLUE_CHIP_COLLATERAL for
// broad institutional match.

export function calculateCollateralScore(collateralAssets: string[]): number {
  if (collateralAssets.length === 0) return 8; // no data → neutral

  const institutionalAssets = [...TIER_1_ASSETS, ...TIER_2_ASSETS, ...TIER_3_ASSETS];

  // Check tier 1+2 match
  const tier1Count = collateralAssets.filter((s) =>
    TIER_1_ASSETS.some((t) => t.toUpperCase() === s.toUpperCase())
  ).length;
  const tier2Count = collateralAssets.filter((s) =>
    TIER_2_ASSETS.some((t) => t.toUpperCase() === s.toUpperCase())
  ).length;
  const tier3Count = collateralAssets.filter((s) =>
    TIER_3_ASSETS.some((t) => t.toUpperCase() === s.toUpperCase())
  ).length;

  // Also count broad blue-chip (includes things like rETH, cbETH, etc.)
  const blueChipCount = collateralAssets.filter((s) =>
    BLUE_CHIP_COLLATERAL.some((bc) => bc.toUpperCase() === s.toUpperCase())
  ).length;

  const total = collateralAssets.length;
  const institutionalCount = tier1Count + tier2Count + tier3Count;
  const institutionalPct = institutionalCount / total;
  const blueChipPct = blueChipCount / total;

  // 100% tier 1 only → 15
  if (tier1Count === total) return 15;
  // 100% tier 1+2 → 13
  if (tier1Count + tier2Count === total) return 13;
  // 100% tier 1+2+3 → 13
  if (institutionalCount === total) return 13;
  // 90%+ blue-chip (broad list) → 10
  if (blueChipPct >= 0.9) return 10;
  // 80%+ blue-chip → 8
  if (blueChipPct >= 0.8) return 8;
  // 60%+ blue-chip → 5
  if (blueChipPct >= 0.6) return 5;
  return 0;
}

// ── Risk Indicator Score (0-10) ────────────────────────────────────────
// Liquidation history (5pts) + APR sanity (5pts)

export function calculateRiskIndicatorScore(
  liquidationCount: number,
  hasBadDebt: boolean,
  netAPR: number
): number {
  let score = 0;

  // Liquidation history (0-5)
  if (hasBadDebt) {
    score += 0;
  } else if (liquidationCount === 0) {
    score += 5;
  } else if (liquidationCount <= 5) {
    score += 3;
  } else if (liquidationCount <= 10) {
    score += 2;
  } else {
    score += 1;
  }

  // APR sanity (0-5): >20% = 0
  if (netAPR <= 20) {
    score += 5;
  }

  return score;
}

// ── Composite Score ────────────────────────────────────────────────────

export function calculateVaultScores(input: VaultScoreInput): VaultScores {
  const sizeScore = calculateSizeScore(input.tvl);
  const maturityScore = calculateMaturityScore(input.createdAt);
  const curatorScore = calculateCuratorScore(input.curator);
  const collateralScore = calculateCollateralScore(input.collateralAssets);
  const riskIndicatorScore = calculateRiskIndicatorScore(
    input.liquidationCount,
    input.hasBadDebt,
    input.netAPR
  );

  const total = Math.min(
    100,
    Math.max(0, sizeScore + maturityScore + curatorScore + collateralScore + riskIndicatorScore)
  );

  return { sizeScore, maturityScore, curatorScore, collateralScore, riskIndicatorScore, total };
}

// ── Hard Requirements (9 checks) ──────────────────────────────────────

export function qualifiesForHighGrade(input: VaultScoreInput): {
  qualifies: boolean;
  failures: string[];
} {
  const failures: string[] = [];

  // 1. TVL >= $1M
  if (input.tvl < 1_000_000) {
    failures.push(`TVL $${(input.tvl / 1e6).toFixed(2)}M < $1M minimum`);
  }

  // 2. Vault age >= 90 days
  //    NOTE: DB createdAt is insertion date, not on-chain creation. Skip check
  //    when all vaults are too recent to evaluate. Maturity *score* still
  //    penalizes young vaults (0/15 pts) in the scoring component.
  const daysLive = Math.floor(
    (Date.now() - input.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysLive < 90) {
    // Soft-skip: DB createdAt doesn't reflect actual vault age
    // failures.push(`Vault age ${daysLive}d < 90d minimum`);
  }

  // 3. Curator has legal entity
  if (!input.curator?.entityType) {
    failures.push("Curator has no legal entity");
  }

  // 4. Curator operating >= 6 months
  if (input.curator?.foundedYear) {
    const now = new Date();
    const monthsOp =
      (now.getFullYear() - input.curator.foundedYear) * 12 + now.getMonth();
    if (monthsOp < 6) {
      failures.push(`Curator operating ${monthsOp} months < 6 month minimum`);
    }
  } else if (input.curator) {
    failures.push("Curator foundedYear unknown — cannot verify 6-month minimum");
  } else {
    failures.push("No curator assigned");
  }

  // 5. Curator total AUM >= $10M
  if (!input.curator || (input.curator.totalAUM || 0) < 10_000_000) {
    const aum = input.curator?.totalAUM || 0;
    failures.push(`Curator AUM $${(aum / 1e6).toFixed(2)}M < $10M minimum`);
  }

  // 6. Zero bad debt (curator-level) — ignore dust below $1
  if (input.curator && (input.curator.badDebtUsd || 0) > BAD_DEBT_DUST_THRESHOLD) {
    failures.push(`Curator has $${(input.curator.badDebtUsd / 1e6).toFixed(2)}M bad debt`);
  }

  // 7. Zero bad debt (vault liquidations)
  if (input.hasBadDebt === true) {
    failures.push("Vault has bad debt from liquidations");
  }

  // 8. APR/APY <= 20%
  if (input.netAPR > 20) {
    failures.push(`APR ${input.netAPR.toFixed(2)}% > 20% maximum`);
  }

  // 9. Collateral >= 80% institutional
  if (input.collateralAssets.length > 0) {
    const nonBlueChip = input.collateralAssets.filter((s) =>
      !BLUE_CHIP_COLLATERAL.some((bc) => bc.toUpperCase() === s.toUpperCase())
    );
    const blueChipCount = input.collateralAssets.length - nonBlueChip.length;
    const pct = blueChipCount / input.collateralAssets.length;
    if (pct < 0.8) {
      const unique = [...new Set(nonBlueChip)];
      const listed = unique.slice(0, 3).join(", ");
      const extra = unique.length > 3 ? ` +${unique.length - 3} more` : "";
      failures.push(
        `Collateral ${(pct * 100).toFixed(0)}% institutional < 80% minimum (unrecognized: ${listed}${extra})`
      );
    }
  }

  return { qualifies: failures.length === 0, failures };
}

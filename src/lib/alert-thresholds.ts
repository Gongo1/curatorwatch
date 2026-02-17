/**
 * Statistical alert threshold calculations
 *
 * Philosophy: Only alert on events that happen <5% of the time
 * This ensures high signal, low noise alerts for institutional allocators
 */

import { prisma } from "./db";

export interface AlertThresholds {
  apyChangeThreshold: number;      // % change from 7-day average
  largeFlowThreshold: number;      // % of TVL
  concentrationThreshold: number;  // percentage point increase
}

// Default thresholds (used when insufficient historical data)
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  apyChangeThreshold: 20,      // 20% deviation from 7-day average
  largeFlowThreshold: 10,      // 10% of vault TVL
  concentrationThreshold: 15,  // 15 percentage point increase
};

// Minimum thresholds (never go below these even with high volatility)
const MIN_APY_THRESHOLD = 20;
const MIN_FLOW_THRESHOLD = 10;

/**
 * Calculate the nth percentile of an array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate 95th percentile thresholds for a specific vault
 * Based on last 90 days of data
 */
export async function calculateVaultThresholds(
  vaultId: string
): Promise<AlertThresholds> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Get historical snapshots
  const snapshots = await prisma.vaultSnapshot.findMany({
    where: {
      vaultId,
      timestamp: { gte: ninetyDaysAgo },
    },
    orderBy: { timestamp: "asc" },
    select: {
      avgApy: true,
      totalAssetsUsd: true,
      timestamp: true,
    },
  });

  if (snapshots.length < 7) {
    // Not enough data, use defaults
    return DEFAULT_THRESHOLDS;
  }

  // Calculate day-over-day APY changes (relative %)
  const apyChanges: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1].avgApy || 0;
    const curr = snapshots[i].avgApy || 0;
    if (prev > 0.1) {
      // Only calculate if previous APY > 0.1% to avoid division issues
      const pctChange = Math.abs(((curr - prev) / prev) * 100);
      apyChanges.push(pctChange);
    }
  }

  // Get 95th percentile of APY changes
  const apyThreshold = apyChanges.length > 0
    ? Math.max(percentile(apyChanges, 95), MIN_APY_THRESHOLD)
    : MIN_APY_THRESHOLD;

  // Get recent transactions for flow threshold
  const transactions = await prisma.vaultTransaction.findMany({
    where: {
      vaultId,
      timestamp: { gte: ninetyDaysAgo },
      assetsUsd: { not: null },
    },
    select: {
      assetsUsd: true,
    },
  });

  const currentTVL = snapshots[snapshots.length - 1]?.totalAssetsUsd || 0;

  // Calculate transaction sizes as % of current TVL
  const txSizes: number[] = [];
  if (currentTVL > 0) {
    for (const tx of transactions) {
      const txUsd = tx.assetsUsd || 0;
      if (txUsd > 0) {
        txSizes.push((txUsd / currentTVL) * 100);
      }
    }
  }

  // Get 95th percentile of transaction sizes
  const flowThreshold = txSizes.length > 0
    ? Math.max(percentile(txSizes, 95), MIN_FLOW_THRESHOLD)
    : MIN_FLOW_THRESHOLD;

  return {
    apyChangeThreshold: apyThreshold,
    largeFlowThreshold: flowThreshold,
    concentrationThreshold: 15, // Fixed threshold - concentration spikes are always meaningful
  };
}

/**
 * Calculate global thresholds across all vaults
 * Used for cross-vault comparisons
 */
export async function calculateGlobalThresholds(): Promise<AlertThresholds> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Get all APY changes across all vaults
  const snapshots = await prisma.vaultSnapshot.findMany({
    where: {
      timestamp: { gte: ninetyDaysAgo },
    },
    orderBy: [{ vaultId: "asc" }, { timestamp: "asc" }],
    select: {
      vaultId: true,
      avgApy: true,
      totalAssetsUsd: true,
      timestamp: true,
    },
  });

  // Group by vault and calculate changes
  const vaultSnapshots = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    if (!vaultSnapshots.has(s.vaultId)) {
      vaultSnapshots.set(s.vaultId, []);
    }
    vaultSnapshots.get(s.vaultId)!.push(s);
  }

  const allApyChanges: number[] = [];
  for (const vaultData of vaultSnapshots.values()) {
    for (let i = 1; i < vaultData.length; i++) {
      const prev = vaultData[i - 1].avgApy || 0;
      const curr = vaultData[i].avgApy || 0;
      if (prev > 0.1) {
        const pctChange = Math.abs(((curr - prev) / prev) * 100);
        allApyChanges.push(pctChange);
      }
    }
  }

  const apyThreshold = allApyChanges.length > 0
    ? Math.max(percentile(allApyChanges, 95), MIN_APY_THRESHOLD)
    : MIN_APY_THRESHOLD;

  return {
    apyChangeThreshold: apyThreshold,
    largeFlowThreshold: MIN_FLOW_THRESHOLD,
    concentrationThreshold: 15,
  };
}

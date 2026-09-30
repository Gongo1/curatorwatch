/**
 * Alert detection system for Morpho vaults
 *
 * Philosophy: Only detect statistically significant events (<5% frequency)
 * 4 alert types: APY Changes, Large Flows, Vault Lifecycle, Concentration Spikes
 */

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { ALERT_TYPES, THRESHOLDS, type AlertType, type Severity } from "./change-thresholds";

/** Lifecycle alerts compare consecutive runs only (collection is every 6h). */
const LIFECYCLE_MAX_GAP_MS = 48 * 60 * 60 * 1000;

export interface AlertEvent {
  vaultId: string;
  changeType: AlertType;
  severity: Severity;
  title: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  detectedAt: Date;
  metadata?: Prisma.InputJsonValue;
}

interface VaultData {
  id: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  assetDecimals: number;
  curatorAddress: string | null;
}

interface SnapshotData {
  totalAssets: string;
  totalAssetsUsd: number;
  sharePrice: number;
  avgApy: number | null;
  timestamp: Date;
}

// Helper functions
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPercentage(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Main alert detection function
 * Called during data collection for each vault
 */
export async function detectAlerts(
  vault: VaultData,
  currentSnapshot: SnapshotData
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  const now = currentSnapshot.timestamp;

  try {
    // 1. APY Change Detection
    const apyAlerts = await detectApyChanges(vault, currentSnapshot);
    alerts.push(...apyAlerts);

    // 2. Large Flow Detection
    const flowAlerts = await detectLargeFlows(vault, currentSnapshot);
    alerts.push(...flowAlerts);

    // 3. Vault Lifecycle Detection
    const lifecycleAlerts = await detectVaultLifecycle(vault, currentSnapshot);
    alerts.push(...lifecycleAlerts);

    // 4. Concentration Spike Detection — disabled
    // const concentrationAlerts = await detectConcentrationSpikes(vault, now);
    // alerts.push(...concentrationAlerts);

    // 5. Vault TVL Snapshot Comparison (catches distributed outflows)
    const tvlAlerts = await detectVaultTvlChanges(vault, currentSnapshot);
    alerts.push(...tvlAlerts);
  } catch (error) {
    console.error(`Error detecting alerts for vault ${vault.name}:`, error);
  }

  return alerts;
}

/**
 * Detect APY changes from 7-day moving average
 */
async function detectApyChanges(
  vault: VaultData,
  currentSnapshot: SnapshotData
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  const currentApy = currentSnapshot.avgApy;

  if (currentApy === null || currentApy === undefined) {
    return alerts;
  }

  // Get 7-day moving average
  const sevenDaysAgo = new Date(
    currentSnapshot.timestamp.getTime() - 7 * 24 * 60 * 60 * 1000
  );

  const recentSnapshots = await prisma.vaultSnapshot.findMany({
    where: {
      vaultId: vault.id,
      timestamp: {
        gte: sevenDaysAgo,
        lte: currentSnapshot.timestamp,
      },
    },
    select: { avgApy: true },
  });

  if (recentSnapshots.length < 2) {
    return alerts; // Not enough data
  }

  const apyValues = recentSnapshots
    .map((s) => s.avgApy)
    .filter((apy): apy is number => apy !== null);

  if (apyValues.length === 0) {
    return alerts;
  }

  const avgApy = apyValues.reduce((a, b) => a + b, 0) / apyValues.length;

  if (avgApy <= 0.1) {
    return alerts; // Skip if average APY is too low
  }

  // Calculate percentage change from average
  const apyChange = Math.abs(((currentApy - avgApy) / avgApy) * 100);
  const direction = currentApy > avgApy ? "increased" : "decreased";
  const directionWord = currentApy > avgApy ? "Spike" : "Drop";

  // Check if duplicate exists
  const existingAlert = await checkDuplicateAlert(
    vault.id,
    ALERT_TYPES.APY_CHANGE,
    currentSnapshot.timestamp
  );
  if (existingAlert) {
    return alerts;
  }

  if (apyChange > THRESHOLDS.APY.CRITICAL) {
    alerts.push({
      vaultId: vault.id,
      changeType: ALERT_TYPES.APY_CHANGE,
      severity: "critical",
      title: `Critical APY ${directionWord}: ${vault.name}`,
      description: `APY ${direction} ${apyChange.toFixed(1)}% from 7-day average (${formatPercentage(avgApy)} → ${formatPercentage(currentApy)}). This is a >30% deviation, happening <5% of the time.`,
      oldValue: formatPercentage(avgApy),
      newValue: formatPercentage(currentApy),
      detectedAt: currentSnapshot.timestamp,
      metadata: { change: apyChange, direction, avgApy, currentApy },
    });
  } else if (apyChange > THRESHOLDS.APY.WARNING) {
    alerts.push({
      vaultId: vault.id,
      changeType: ALERT_TYPES.APY_CHANGE,
      severity: "warning",
      title: `Significant APY ${directionWord}: ${vault.name}`,
      description: `APY moved ${apyChange.toFixed(1)}% from 7-day average (${formatPercentage(avgApy)} → ${formatPercentage(currentApy)}). Monitor for continued volatility.`,
      oldValue: formatPercentage(avgApy),
      newValue: formatPercentage(currentApy),
      detectedAt: currentSnapshot.timestamp,
      metadata: { change: apyChange, direction, avgApy, currentApy },
    });
  }

  return alerts;
}

/**
 * Detect large deposits/withdrawals (>10% of TVL)
 */
async function detectLargeFlows(
  vault: VaultData,
  currentSnapshot: SnapshotData
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  const currentTVL = currentSnapshot.totalAssetsUsd;

  if (currentTVL <= 0) {
    return alerts;
  }

  // Get recent transactions (last 24h)
  const twentyFourHoursAgo = new Date(
    currentSnapshot.timestamp.getTime() - 24 * 60 * 60 * 1000
  );

  const recentTxs = await prisma.vaultTransaction.findMany({
    where: {
      vaultId: vault.id,
      timestamp: { gte: twentyFourHoursAgo },
      assetsUsd: { not: null },
    },
    orderBy: { timestamp: "desc" },
  });

  for (const tx of recentTxs) {
    const txSize = tx.assetsUsd || 0;
    if (txSize <= 0) continue;

    const pctOfTVL = (txSize / currentTVL) * 100;
    const txType = tx.type || "Transaction";
    const isDeposit = txType.toLowerCase().includes("deposit");

    // Determine alert type based on deposit vs withdrawal
    const alertType = isDeposit
      ? ALERT_TYPES.LARGE_DEPOSIT
      : ALERT_TYPES.LARGE_WITHDRAWAL;

    // Check if we already alerted on this transaction (check both old and new types)
    const existingAlert = await prisma.vaultChange.findFirst({
      where: {
        vaultId: vault.id,
        changeType: { in: [ALERT_TYPES.LARGE_FLOW, alertType] },
        metadata: {
          path: ["txHash"],
          equals: tx.txHash,
        },
      },
    });

    if (existingAlert) continue;

    if (isDeposit) {
      // Deposits use "info" severity with positive language
      if (pctOfTVL > THRESHOLDS.LARGE_FLOW.CRITICAL) {
        alerts.push({
          vaultId: vault.id,
          changeType: ALERT_TYPES.LARGE_DEPOSIT,
          severity: "info",
          title: `Significant deposit: ${formatCurrency(txSize)}`,
          description: `Capital inflow of ${formatCurrency(txSize)} (${pctOfTVL.toFixed(1)}% of vault TVL) into ${vault.name}. Strong growth signal.`,
          oldValue: undefined,
          newValue: formatCurrency(txSize),
          detectedAt: tx.timestamp,
          metadata: {
            txHash: tx.txHash,
            pctOfTVL,
            type: txType,
            amount: txSize,
          },
        });
      } else if (pctOfTVL > THRESHOLDS.LARGE_FLOW.WARNING) {
        alerts.push({
          vaultId: vault.id,
          changeType: ALERT_TYPES.LARGE_DEPOSIT,
          severity: "info",
          title: `Capital inflow: ${formatCurrency(txSize)}`,
          description: `Deposit of ${formatCurrency(txSize)} (${pctOfTVL.toFixed(1)}% of vault TVL) into ${vault.name}.`,
          oldValue: undefined,
          newValue: formatCurrency(txSize),
          detectedAt: tx.timestamp,
          metadata: {
            txHash: tx.txHash,
            pctOfTVL,
            type: txType,
            amount: txSize,
          },
        });
      }
    } else {
      // Withdrawals keep warning/critical severity
      if (pctOfTVL > THRESHOLDS.LARGE_FLOW.CRITICAL) {
        alerts.push({
          vaultId: vault.id,
          changeType: ALERT_TYPES.LARGE_WITHDRAWAL,
          severity: "critical",
          title: `Major withdrawal: ${formatCurrency(txSize)}`,
          description: `Withdrawal of ${formatCurrency(txSize)} (${pctOfTVL.toFixed(1)}% of vault TVL). Transactions this large happen <2% of the time.`,
          oldValue: undefined,
          newValue: formatCurrency(txSize),
          detectedAt: tx.timestamp,
          metadata: {
            txHash: tx.txHash,
            pctOfTVL,
            type: txType,
            amount: txSize,
          },
        });
      } else if (pctOfTVL > THRESHOLDS.LARGE_FLOW.WARNING) {
        alerts.push({
          vaultId: vault.id,
          changeType: ALERT_TYPES.LARGE_WITHDRAWAL,
          severity: "warning",
          title: `Large withdrawal: ${formatCurrency(txSize)}`,
          description: `Withdrawal of ${formatCurrency(txSize)} (${pctOfTVL.toFixed(1)}% of vault TVL) from ${vault.name}.`,
          oldValue: undefined,
          newValue: formatCurrency(txSize),
          detectedAt: tx.timestamp,
          metadata: {
            txHash: tx.txHash,
            pctOfTVL,
            type: txType,
            amount: txSize,
          },
        });
      }
    }
  }

  return alerts;
}

/**
 * Detect vault lifecycle events (launch/shutdown)
 */
async function detectVaultLifecycle(
  vault: VaultData,
  currentSnapshot: SnapshotData
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  const currentTVL = currentSnapshot.totalAssetsUsd;

  // Get previous snapshot
  const previousSnapshot = await prisma.vaultSnapshot.findFirst({
    where: {
      vaultId: vault.id,
      timestamp: { lt: currentSnapshot.timestamp },
    },
    orderBy: { timestamp: "desc" },
    select: { totalAssetsUsd: true, timestamp: true },
  });

  if (!previousSnapshot) {
    return alerts;
  }

  // A crossing measured across a collection gap (e.g. the first run after a
  // source outage: V2 was frozen Aug 26 -> Sep 30 2026) happened at some
  // unknown point in that gap. Reporting it now as a fresh launch/shutdown
  // would be false news.
  if (
    currentSnapshot.timestamp.getTime() - previousSnapshot.timestamp.getTime() >
    LIFECYCLE_MAX_GAP_MS
  ) {
    return alerts;
  }

  const prevTVL = previousSnapshot.totalAssetsUsd;

  // Vault Launch: TVL was <$1M, now >$1M
  if (
    prevTVL < THRESHOLDS.VAULT_LIFECYCLE.LAUNCH_MIN_TVL &&
    currentTVL >= THRESHOLDS.VAULT_LIFECYCLE.LAUNCH_MIN_TVL
  ) {
    const existingAlert = await checkDuplicateAlert(
      vault.id,
      ALERT_TYPES.VAULT_LAUNCH,
      currentSnapshot.timestamp
    );

    if (!existingAlert) {
      alerts.push({
        vaultId: vault.id,
        changeType: ALERT_TYPES.VAULT_LAUNCH,
        severity: "info",
        title: `New Vault Launched: ${vault.name}`,
        description: `Vault went live with ${formatCurrency(currentTVL)} in initial deposits.`,
        oldValue: formatCurrency(prevTVL),
        newValue: formatCurrency(currentTVL),
        detectedAt: currentSnapshot.timestamp,
        metadata: { prevTVL, currentTVL },
      });
    }
  }

  // Vault Shutdown: TVL was >$100k, now <$10k
  if (
    prevTVL > THRESHOLDS.VAULT_LIFECYCLE.SHUTDOWN_PREV_MIN &&
    currentTVL < THRESHOLDS.VAULT_LIFECYCLE.SHUTDOWN_CURR_MAX
  ) {
    const existingAlert = await checkDuplicateAlert(
      vault.id,
      ALERT_TYPES.VAULT_SHUTDOWN,
      currentSnapshot.timestamp
    );

    if (!existingAlert) {
      alerts.push({
        vaultId: vault.id,
        changeType: ALERT_TYPES.VAULT_SHUTDOWN,
        severity: "critical",
        title: `Vault Shutdown: ${vault.name}`,
        description: `Vault TVL dropped from ${formatCurrency(prevTVL)} to ${formatCurrency(currentTVL)}. Vault may be closing.`,
        oldValue: formatCurrency(prevTVL),
        newValue: formatCurrency(currentTVL),
        detectedAt: currentSnapshot.timestamp,
        metadata: { prevTVL, currentTVL },
      });
    }
  }

  return alerts;
}

/**
 * Detect concentration spikes (>15pp increase in top adapter allocation)
 */
async function detectConcentrationSpikes(
  vault: VaultData,
  timestamp: Date
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];

  // Get current risk snapshot
  const currentRisk = await prisma.vaultRiskSnapshot.findFirst({
    where: { vaultId: vault.id },
    orderBy: { timestamp: "desc" },
    select: { topAdapterPercent: true, timestamp: true },
  });

  if (!currentRisk) {
    return alerts;
  }

  // Get previous risk snapshot
  const previousRisk = await prisma.vaultRiskSnapshot.findFirst({
    where: {
      vaultId: vault.id,
      timestamp: { lt: currentRisk.timestamp },
    },
    orderBy: { timestamp: "desc" },
    select: { topAdapterPercent: true, timestamp: true },
  });

  if (!previousRisk) {
    return alerts;
  }

  const concentrationIncrease =
    currentRisk.topAdapterPercent - previousRisk.topAdapterPercent;

  // Only alert on increases (concentration going up = more risk)
  if (concentrationIncrease <= 0) {
    return alerts;
  }

  const existingAlert = await checkDuplicateAlert(
    vault.id,
    ALERT_TYPES.CONCENTRATION_SPIKE,
    timestamp
  );

  if (existingAlert) {
    return alerts;
  }

  if (concentrationIncrease > THRESHOLDS.CONCENTRATION.CRITICAL) {
    alerts.push({
      vaultId: vault.id,
      changeType: ALERT_TYPES.CONCENTRATION_SPIKE,
      severity: "critical",
      title: `Extreme Concentration: ${vault.name}`,
      description: `Top adapter allocation jumped ${concentrationIncrease.toFixed(0)} percentage points (${previousRisk.topAdapterPercent.toFixed(0)}% → ${currentRisk.topAdapterPercent.toFixed(0)}%). Significant risk regime change.`,
      oldValue: `${previousRisk.topAdapterPercent.toFixed(0)}%`,
      newValue: `${currentRisk.topAdapterPercent.toFixed(0)}%`,
      detectedAt: timestamp,
      metadata: {
        increase: concentrationIncrease,
        previousPercent: previousRisk.topAdapterPercent,
        currentPercent: currentRisk.topAdapterPercent,
      },
    });
  } else if (concentrationIncrease > THRESHOLDS.CONCENTRATION.WARNING) {
    alerts.push({
      vaultId: vault.id,
      changeType: ALERT_TYPES.CONCENTRATION_SPIKE,
      severity: "warning",
      title: `Concentration Increased: ${vault.name}`,
      description: `Capital shifted toward single adapter (+${concentrationIncrease.toFixed(0)}pp). Top adapter now at ${currentRisk.topAdapterPercent.toFixed(0)}%.`,
      oldValue: `${previousRisk.topAdapterPercent.toFixed(0)}%`,
      newValue: `${currentRisk.topAdapterPercent.toFixed(0)}%`,
      detectedAt: timestamp,
      metadata: {
        increase: concentrationIncrease,
        previousPercent: previousRisk.topAdapterPercent,
        currentPercent: currentRisk.topAdapterPercent,
      },
    });
  }

  return alerts;
}

/**
 * Detect vault TVL changes via snapshot-to-snapshot comparison (24h lookback).
 * This catches distributed outflows that individual transaction alerts miss.
 */
async function detectVaultTvlChanges(
  vault: VaultData,
  currentSnapshot: SnapshotData
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  const currentTVL = currentSnapshot.totalAssetsUsd;

  if (currentTVL <= 0) {
    return alerts;
  }

  // Get snapshot from ~24h ago (within 2h tolerance window)
  const twentyTwoHoursAgo = new Date(currentSnapshot.timestamp.getTime() - 22 * 60 * 60 * 1000);
  const twentySixHoursAgo = new Date(currentSnapshot.timestamp.getTime() - 26 * 60 * 60 * 1000);

  const oldSnapshot = await prisma.vaultSnapshot.findFirst({
    where: {
      vaultId: vault.id,
      timestamp: {
        gte: twentySixHoursAgo,
        lte: twentyTwoHoursAgo,
      },
    },
    orderBy: { timestamp: "desc" },
    select: { totalAssetsUsd: true, timestamp: true },
  });

  if (!oldSnapshot || oldSnapshot.totalAssetsUsd <= 0) {
    return alerts;
  }

  const oldTVL = oldSnapshot.totalAssetsUsd;
  const pctChange = ((currentTVL - oldTVL) / oldTVL) * 100;
  const absPctChange = Math.abs(pctChange);

  // TVL Drop detection
  if (pctChange < 0) {
    const isDuplicate = await checkDuplicateAlert(
      vault.id,
      ALERT_TYPES.VAULT_TVL_DROP,
      currentSnapshot.timestamp
    );
    if (isDuplicate) return alerts;

    if (absPctChange > THRESHOLDS.VAULT_TVL.CRITICAL) {
      alerts.push({
        vaultId: vault.id,
        changeType: ALERT_TYPES.VAULT_TVL_DROP,
        severity: "critical",
        title: `Critical TVL Drop: ${vault.name}`,
        description: `TVL fell ${absPctChange.toFixed(1)}% in 24h (${formatCurrency(oldTVL)} → ${formatCurrency(currentTVL)}). Significant capital outflow detected.`,
        oldValue: formatCurrency(oldTVL),
        newValue: formatCurrency(currentTVL),
        detectedAt: currentSnapshot.timestamp,
        metadata: { pctChange, oldTVL, currentTVL },
      });
    } else if (absPctChange > THRESHOLDS.VAULT_TVL.WARNING) {
      alerts.push({
        vaultId: vault.id,
        changeType: ALERT_TYPES.VAULT_TVL_DROP,
        severity: "warning",
        title: `TVL Decline: ${vault.name}`,
        description: `TVL fell ${absPctChange.toFixed(1)}% in 24h (${formatCurrency(oldTVL)} → ${formatCurrency(currentTVL)}). Monitor for continued outflows.`,
        oldValue: formatCurrency(oldTVL),
        newValue: formatCurrency(currentTVL),
        detectedAt: currentSnapshot.timestamp,
        metadata: { pctChange, oldTVL, currentTVL },
      });
    }
  }

  // TVL Surge detection (positive signal)
  if (pctChange > 0 && absPctChange > THRESHOLDS.VAULT_TVL.SURGE_INFO) {
    const isDuplicate = await checkDuplicateAlert(
      vault.id,
      ALERT_TYPES.VAULT_TVL_SURGE,
      currentSnapshot.timestamp
    );
    if (!isDuplicate) {
      alerts.push({
        vaultId: vault.id,
        changeType: ALERT_TYPES.VAULT_TVL_SURGE,
        severity: "info",
        title: `TVL Surge: ${vault.name}`,
        description: `TVL grew ${absPctChange.toFixed(1)}% in 24h (${formatCurrency(oldTVL)} → ${formatCurrency(currentTVL)}). Strong capital inflow.`,
        oldValue: formatCurrency(oldTVL),
        newValue: formatCurrency(currentTVL),
        detectedAt: currentSnapshot.timestamp,
        metadata: { pctChange, oldTVL, currentTVL },
      });
    }
  }

  return alerts;
}

/**
 * Check if a similar alert was already created recently (within 24h)
 */
async function checkDuplicateAlert(
  vaultId: string,
  changeType: AlertType,
  timestamp: Date
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000);

  const existing = await prisma.vaultChange.findFirst({
    where: {
      vaultId,
      changeType,
      detectedAt: { gte: twentyFourHoursAgo },
    },
  });

  return existing !== null;
}

/**
 * Store detected alerts in the database
 */
export async function storeAlerts(alerts: AlertEvent[]): Promise<number> {
  if (alerts.length === 0) return 0;

  let stored = 0;

  for (const alert of alerts) {
    try {
      await prisma.vaultChange.create({
        data: {
          vaultId: alert.vaultId,
          changeType: alert.changeType,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          oldValue: alert.oldValue,
          newValue: alert.newValue,
          metadata: alert.metadata,
          detectedAt: alert.detectedAt,
          viewed: false,
        },
      });
      stored++;
    } catch (error) {
      // Likely a duplicate, skip
      console.log(`Skipping duplicate alert: ${alert.title}`);
    }
  }

  return stored;
}

/**
 * Get alerts with pagination and filtering
 */
export async function getAlerts(options: {
  vaultId?: string;
  severity?: Severity;
  changeType?: AlertType;
  limit?: number;
  offset?: number;
  unviewedOnly?: boolean;
}) {
  const {
    vaultId,
    severity,
    changeType,
    limit = 50,
    offset = 0,
    unviewedOnly = false,
  } = options;

  const where: Prisma.VaultChangeWhereInput = {};

  if (vaultId) where.vaultId = vaultId;
  if (severity) where.severity = severity;
  if (changeType) where.changeType = changeType;
  if (unviewedOnly) where.viewed = false;

  const [alerts, total, counts] = await Promise.all([
    prisma.vaultChange.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        vault: {
          select: { name: true, symbol: true, address: true },
        },
      },
    }),
    prisma.vaultChange.count({ where }),
    prisma.vaultChange.groupBy({
      by: ["severity"],
      where: vaultId ? { vaultId } : undefined,
      _count: { severity: true },
    }),
  ]);

  const summary = {
    critical: 0,
    warning: 0,
    info: 0,
    total,
  };

  for (const count of counts) {
    if (count.severity in summary) {
      summary[count.severity as keyof typeof summary] = count._count.severity;
    }
  }

  return {
    alerts,
    summary,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + alerts.length < total,
    },
  };
}

// Legacy exports for backwards compatibility
export const detectChanges = detectAlerts;
export const storeChanges = storeAlerts;

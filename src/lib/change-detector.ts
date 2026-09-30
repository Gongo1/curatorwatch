/**
 * Alert detection system for Morpho vaults
 *
 * Philosophy: Only detect statistically significant events (<5% frequency)
 * 4 alert types: APY Changes, Large Flows, Vault Lifecycle, Concentration Spikes
 */

import { prisma } from "./db";
import { Prisma } from "@prisma/client";
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
  creationTimestamp?: number | null; // unix seconds, from the source
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

/** A snapshot point read back for comparisons. */
interface SnapshotPoint {
  totalAssetsUsd: number;
  timestamp: Date;
}

/** A recent transaction with a USD value (Large Flow input). */
interface RecentTx {
  txHash: string;
  timestamp: Date;
  type: string;
  assetsUsd: number | null;
}

/**
 * Everything the vault-level detectors read, prefetched for a whole batch of
 * vaults in a fixed number of queries (was 4-8 round trips per vault).
 */
interface AlertBatchData {
  /** avgApy of every snapshot in [t-7d, t], per vault. */
  apyWindow: Map<string, (number | null)[]>;
  /** Transactions since t-24h with a USD value, newest first, per vault. */
  recentTxs: Map<string, RecentTx[]>;
  /** `${vaultId}|${changeType}|${txHash}` of flow alerts already stored. */
  flowAlerted: Set<string>;
  /** The two snapshots before t, newest first, per vault. */
  priorSnapshots: Map<string, SnapshotPoint[]>;
  /** Latest snapshot in [t-26h, t-22h], per vault. */
  snapshot24h: Map<string, SnapshotPoint>;
  /** `${vaultId}|${changeType}` of alerts detected since t-24h. */
  recentAlerts: Set<string>;
}

const HOUR_MS = 60 * 60 * 1000;
const FLOW_ALERT_TYPES = [ALERT_TYPES.LARGE_FLOW, ALERT_TYPES.LARGE_DEPOSIT, ALERT_TYPES.LARGE_WITHDRAWAL];

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Read what the detectors need for `vaultIds` at run time `t`: five queries,
 * six when any vault has recent transactions.
 */
async function fetchAlertBatchData(vaultIds: string[], t: Date): Promise<AlertBatchData> {
  const apyRows = await prisma.vaultSnapshot.findMany({
    where: {
      vaultId: { in: vaultIds },
      timestamp: { gte: new Date(t.getTime() - 7 * 24 * HOUR_MS), lte: t },
    },
    select: { vaultId: true, avgApy: true },
  });
  const apyWindow = new Map<string, (number | null)[]>();
  for (const r of apyRows) pushTo(apyWindow, r.vaultId, r.avgApy);

  const txRows = await prisma.vaultTransaction.findMany({
    where: {
      vaultId: { in: vaultIds },
      timestamp: { gte: new Date(t.getTime() - 24 * HOUR_MS) },
      assetsUsd: { not: null },
    },
    orderBy: { timestamp: "desc" },
    select: { vaultId: true, txHash: true, timestamp: true, type: true, assetsUsd: true },
  });
  const recentTxs = new Map<string, RecentTx[]>();
  for (const r of txRows) pushTo(recentTxs, r.vaultId, r);

  // Flow alerts already stored for these transactions (any age). Same test
  // as a per-tx lookup of metadata.txHash, in one statement.
  const flowAlerted = new Set<string>();
  if (txRows.length > 0) {
    const flowRows = await prisma.$queryRaw<{ vaultId: string; changeType: string; txHash: string }[]>`
      SELECT "vaultId", "changeType", metadata->>'txHash' AS "txHash"
      FROM "VaultChange"
      WHERE "vaultId" IN (${Prisma.join([...recentTxs.keys()])})
        AND "changeType" IN (${Prisma.join(FLOW_ALERT_TYPES)})
        AND metadata->>'txHash' IN (${Prisma.join([...new Set(txRows.map((r) => r.txHash))])})
    `;
    for (const r of flowRows) flowAlerted.add(`${r.vaultId}|${r.changeType}|${r.txHash}`);
  }

  const priorRows = await prisma.$queryRaw<(SnapshotPoint & { vaultId: string })[]>`
    SELECT v.id AS "vaultId", p."totalAssetsUsd", p."timestamp"
    FROM "Vault" v
    CROSS JOIN LATERAL (
      SELECT s."totalAssetsUsd", s."timestamp"
      FROM "VaultSnapshot" s
      WHERE s."vaultId" = v.id AND s."timestamp" < ${t}
      ORDER BY s."timestamp" DESC
      LIMIT 2
    ) p
    WHERE v.id IN (${Prisma.join(vaultIds)})
    ORDER BY v.id, p."timestamp" DESC
  `;
  const priorSnapshots = new Map<string, SnapshotPoint[]>();
  for (const r of priorRows) {
    pushTo(priorSnapshots, r.vaultId, { totalAssetsUsd: r.totalAssetsUsd, timestamp: r.timestamp });
  }

  const dayRows = await prisma.$queryRaw<(SnapshotPoint & { vaultId: string })[]>`
    SELECT DISTINCT ON (s."vaultId") s."vaultId", s."totalAssetsUsd", s."timestamp"
    FROM "VaultSnapshot" s
    WHERE s."vaultId" IN (${Prisma.join(vaultIds)})
      AND s."timestamp" >= ${new Date(t.getTime() - 26 * HOUR_MS)}
      AND s."timestamp" <= ${new Date(t.getTime() - 22 * HOUR_MS)}
    ORDER BY s."vaultId", s."timestamp" DESC
  `;
  const snapshot24h = new Map<string, SnapshotPoint>(
    dayRows.map((r) => [r.vaultId, { totalAssetsUsd: r.totalAssetsUsd, timestamp: r.timestamp }])
  );

  const alertRows = await prisma.vaultChange.findMany({
    where: { vaultId: { in: vaultIds }, detectedAt: { gte: new Date(t.getTime() - 24 * HOUR_MS) } },
    select: { vaultId: true, changeType: true },
  });
  const recentAlerts = new Set(alertRows.map((r) => `${r.vaultId}|${r.changeType}`));

  return { apyWindow, recentTxs, flowAlerted, priorSnapshots, snapshot24h, recentAlerts };
}

/**
 * Main alert detection function, for a batch of vaults collected in one run.
 * Every snapshot's `timestamp` is the run time; the batch is prefetched once
 * (fetchAlertBatchData) and each vault is then evaluated in memory, with the
 * same rules and duplicate checks as a per-vault lookup.
 */
export async function detectAlertsBatch(
  inputs: { vault: VaultData; snapshot: SnapshotData }[]
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  if (inputs.length === 0) return alerts;

  const data = await fetchAlertBatchData(
    inputs.map((i) => i.vault.id),
    inputs[0].snapshot.timestamp
  );

  for (const { vault, snapshot } of inputs) {
    try {
      // 1. APY Change Detection
      alerts.push(...detectApyChanges(vault, snapshot, data));

      // 2. Large Flow Detection
      alerts.push(...detectLargeFlows(vault, snapshot, data));

      // 3. Vault Lifecycle Detection
      alerts.push(...(await detectVaultLifecycle(vault, snapshot, data)));

      // 4. Concentration Spike Detection — disabled
      // const concentrationAlerts = await detectConcentrationSpikes(vault, now);
      // alerts.push(...concentrationAlerts);

      // 5. Vault TVL Snapshot Comparison (catches distributed outflows)
      alerts.push(...detectVaultTvlChanges(vault, snapshot, data));
    } catch (error) {
      console.error(`Error detecting alerts for vault ${vault.name}:`, error);
    }
  }

  return alerts;
}

/**
 * Detect APY changes from 7-day moving average
 */
function detectApyChanges(
  vault: VaultData,
  currentSnapshot: SnapshotData,
  data: AlertBatchData
): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const currentApy = currentSnapshot.avgApy;

  if (currentApy === null || currentApy === undefined) {
    return alerts;
  }

  // 7-day moving average (snapshots in [t-7d, t])
  const recentSnapshots = data.apyWindow.get(vault.id) ?? [];

  if (recentSnapshots.length < 2) {
    return alerts; // Not enough data
  }

  const apyValues = recentSnapshots.filter((apy): apy is number => apy !== null);

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
  if (data.recentAlerts.has(`${vault.id}|${ALERT_TYPES.APY_CHANGE}`)) {
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
function detectLargeFlows(
  vault: VaultData,
  currentSnapshot: SnapshotData,
  data: AlertBatchData
): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const currentTVL = currentSnapshot.totalAssetsUsd;

  if (currentTVL <= 0) {
    return alerts;
  }

  // Recent transactions (last 24h), newest first
  const recentTxs = data.recentTxs.get(vault.id) ?? [];

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
    const existingAlert = [ALERT_TYPES.LARGE_FLOW, alertType].some((type) =>
      data.flowAlerted.has(`${vault.id}|${type}|${tx.txHash}`)
    );

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
 *
 * Launch fires at most once per vault, only for a vault created (or, without a
 * creation time, first seen) in the last LAUNCH_MAX_AGE_DAYS, and only when
 * TVL is >= LAUNCH_MIN_TVL on 2 consecutive snapshots (the one before that
 * below it, or none). The old rule fired on any <$1M -> >=$1M crossing, so
 * 83 of 87 "launches" were old vaults wobbling around $1M.
 */
async function detectVaultLifecycle(
  vault: VaultData,
  currentSnapshot: SnapshotData,
  data: AlertBatchData
): Promise<AlertEvent[]> {
  const alerts: AlertEvent[] = [];
  const currentTVL = currentSnapshot.totalAssetsUsd;

  // The two snapshots before this run: [previous, the one before it]
  const priorSnapshots = data.priorSnapshots.get(vault.id) ?? [];
  const previousSnapshot = priorSnapshots[0];

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
  const launchMin = THRESHOLDS.VAULT_LIFECYCLE.LAUNCH_MIN_TVL;
  const beforePrev = priorSnapshots[1];

  // Vault Launch: >= $1M on 2 consecutive snapshots, below it (or unseen) before
  if (
    currentTVL >= launchMin &&
    prevTVL >= launchMin &&
    (!beforePrev || beforePrev.totalAssetsUsd < launchMin) &&
    (await isLaunchCandidate(vault, currentSnapshot.timestamp))
  ) {
    alerts.push({
      vaultId: vault.id,
      changeType: ALERT_TYPES.VAULT_LAUNCH,
      severity: "info",
      title: `New Vault Launched: ${vault.name}`,
      description: `Vault went live with ${formatCurrency(currentTVL)} in initial deposits.`,
      oldValue: formatCurrency(beforePrev?.totalAssetsUsd ?? 0),
      newValue: formatCurrency(currentTVL),
      detectedAt: currentSnapshot.timestamp,
      metadata: { prevTVL, currentTVL, creationTimestamp: vault.creationTimestamp ?? null },
    });
  }

  // Vault Shutdown: TVL was >$100k, now <$10k
  if (
    prevTVL > THRESHOLDS.VAULT_LIFECYCLE.SHUTDOWN_PREV_MIN &&
    currentTVL < THRESHOLDS.VAULT_LIFECYCLE.SHUTDOWN_CURR_MAX
  ) {
    const existingAlert = data.recentAlerts.has(`${vault.id}|${ALERT_TYPES.VAULT_SHUTDOWN}`);

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
function detectVaultTvlChanges(
  vault: VaultData,
  currentSnapshot: SnapshotData,
  data: AlertBatchData
): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const currentTVL = currentSnapshot.totalAssetsUsd;

  if (currentTVL <= 0) {
    return alerts;
  }

  // Snapshot from ~24h ago (latest in the 22-26h window)
  const oldSnapshot = data.snapshot24h.get(vault.id);

  if (!oldSnapshot || oldSnapshot.totalAssetsUsd <= 0) {
    return alerts;
  }

  const oldTVL = oldSnapshot.totalAssetsUsd;
  const pctChange = ((currentTVL - oldTVL) / oldTVL) * 100;
  const absPctChange = Math.abs(pctChange);

  // TVL Drop detection
  if (pctChange < 0) {
    const isDuplicate = data.recentAlerts.has(`${vault.id}|${ALERT_TYPES.VAULT_TVL_DROP}`);
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
    const isDuplicate = data.recentAlerts.has(`${vault.id}|${ALERT_TYPES.VAULT_TVL_SURGE}`);
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
 * A vault may "launch" only once ever, and only while it is new: created (or,
 * without a creation time, first snapshotted) within LAUNCH_MAX_AGE_DAYS.
 */
async function isLaunchCandidate(vault: VaultData, now: Date): Promise<boolean> {
  const alreadyLaunched = await prisma.vaultChange.findFirst({
    where: { vaultId: vault.id, changeType: ALERT_TYPES.VAULT_LAUNCH },
    select: { id: true },
  });
  if (alreadyLaunched) return false;

  let bornAt: Date | null = vault.creationTimestamp
    ? new Date(vault.creationTimestamp * 1000)
    : null;
  if (!bornAt) {
    const first = await prisma.vaultSnapshot.findFirst({
      where: { vaultId: vault.id },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    });
    bornAt = first?.timestamp ?? null;
  }
  if (!bornAt) return false;

  const maxAgeMs = THRESHOLDS.VAULT_LIFECYCLE.LAUNCH_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - bornAt.getTime() <= maxAgeMs;
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
 * Store detected alerts in the database, in one statement. An alert that
 * repeats (vaultId, changeType, detectedAt) is skipped, as before.
 */
export async function storeAlerts(alerts: AlertEvent[]): Promise<number> {
  if (alerts.length === 0) return 0;

  const result = await prisma.vaultChange.createMany({
    data: alerts.map((alert) => ({
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
    })),
    skipDuplicates: true,
  });

  return result.count;
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

// Legacy export for backwards compatibility
export const storeChanges = storeAlerts;

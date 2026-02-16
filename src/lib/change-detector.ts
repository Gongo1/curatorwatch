import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import {
  THRESHOLDS,
  CHANGE_TYPES,
  type ChangeType,
  type Severity,
} from "./change-thresholds";

export interface ChangeEvent {
  vaultId: string;
  changeType: ChangeType;
  severity: Severity;
  title: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  detectedAt: Date;
  metadata?: Prisma.InputJsonValue;
}

interface VaultWithData {
  id: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  assetDecimals: number;
  curatorAddress: string | null;
}

interface Snapshot {
  totalAssets: string;
  totalAssetsUsd: number;
  sharePrice: number;
  avgApy: number | null;
  timestamp: Date;
}

interface RiskSnapshot {
  concentrationScore: string;
  liquidityScore: string;
  diversificationScore: string;
  topAdapterPercent: number;
}

interface AllocationData {
  adapterAddress: string;
  adapterType: string;
  allocationPct: number;
  snapshotTime: Date;
}

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function calculatePercentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}

// Get the previous snapshot (second most recent)
async function getPreviousSnapshot(vaultId: string): Promise<Snapshot | null> {
  const snapshots = await prisma.vaultSnapshot.findMany({
    where: { vaultId },
    orderBy: { timestamp: "desc" },
    take: 2,
  });

  // Return the second snapshot if exists
  return snapshots[1] || null;
}

// Get the latest risk snapshot
async function getLatestRiskSnapshot(
  vaultId: string
): Promise<RiskSnapshot | null> {
  const snapshot = await prisma.vaultRiskSnapshot.findFirst({
    where: { vaultId },
    orderBy: { timestamp: "desc" },
  });

  return snapshot;
}

// Get the previous risk snapshot
async function getPreviousRiskSnapshot(
  vaultId: string
): Promise<RiskSnapshot | null> {
  const snapshots = await prisma.vaultRiskSnapshot.findMany({
    where: { vaultId },
    orderBy: { timestamp: "desc" },
    take: 2,
  });

  return snapshots[1] || null;
}

// Get recent transactions within the last N hours
async function getRecentTransactions(vaultId: string, hours: number) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return prisma.vaultTransaction.findMany({
    where: {
      vaultId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "desc" },
  });
}

// Get recent reallocations within the last N hours
async function getRecentReallocations(vaultId: string, hours: number) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return prisma.vaultReallocation.findMany({
    where: {
      vaultId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "desc" },
  });
}

// Get allocations from a specific snapshot time
async function getAllocationsAtTime(
  vaultId: string,
  snapshotTime: Date
): Promise<AllocationData[]> {
  return prisma.adapterAllocation.findMany({
    where: {
      vaultId,
      snapshotTime,
    },
  });
}

// Get the previous allocation snapshot
async function getPreviousAllocations(
  vaultId: string
): Promise<AllocationData[]> {
  // Get the two most recent distinct snapshot times
  const allocations = await prisma.adapterAllocation.findMany({
    where: { vaultId },
    orderBy: { snapshotTime: "desc" },
    distinct: ["snapshotTime"],
    take: 2,
  });

  if (allocations.length < 2) return [];

  const previousTime = allocations[1].snapshotTime;

  return prisma.adapterAllocation.findMany({
    where: {
      vaultId,
      snapshotTime: previousTime,
    },
  });
}

// Check if a similar change already exists (to avoid duplicates)
async function changeExists(
  vaultId: string,
  changeType: string,
  detectedAt: Date
): Promise<boolean> {
  // Check within a 1-minute window to avoid exact timestamp issues
  const startTime = new Date(detectedAt.getTime() - 60000);
  const endTime = new Date(detectedAt.getTime() + 60000);

  const existing = await prisma.vaultChange.findFirst({
    where: {
      vaultId,
      changeType,
      detectedAt: {
        gte: startTime,
        lte: endTime,
      },
    },
  });

  return !!existing;
}

/**
 * Main change detection function
 * Compares current state with previous state and detects significant changes
 */
export async function detectChanges(
  vault: VaultWithData,
  currentSnapshot: Snapshot
): Promise<ChangeEvent[]> {
  const changes: ChangeEvent[] = [];
  const now = new Date();

  // Get previous snapshot for comparison
  const previousSnapshot = await getPreviousSnapshot(vault.id);

  if (!previousSnapshot) {
    // First snapshot, no comparison possible
    return changes;
  }

  // 1. TVL CHANGES
  const tvlChange = calculatePercentChange(
    previousSnapshot.totalAssetsUsd,
    currentSnapshot.totalAssetsUsd
  );

  if (Math.abs(tvlChange) >= THRESHOLDS.TVL.WARNING) {
    const severity: Severity =
      Math.abs(tvlChange) >= THRESHOLDS.TVL.CRITICAL ? "critical" : "warning";
    const direction = tvlChange > 0 ? "increased" : "decreased";

    if (!(await changeExists(vault.id, CHANGE_TYPES.TVL_CHANGE, now))) {
      changes.push({
        vaultId: vault.id,
        changeType: CHANGE_TYPES.TVL_CHANGE,
        severity,
        title: `TVL ${direction} ${Math.abs(tvlChange).toFixed(1)}%`,
        description: `Total value changed from ${formatCurrency(previousSnapshot.totalAssetsUsd)} to ${formatCurrency(currentSnapshot.totalAssetsUsd)}`,
        oldValue: previousSnapshot.totalAssetsUsd.toString(),
        newValue: currentSnapshot.totalAssetsUsd.toString(),
        detectedAt: now,
        metadata: { percentChange: tvlChange },
      });
    }
  }

  // 2. APY CHANGES
  if (previousSnapshot.avgApy && currentSnapshot.avgApy) {
    const apyChange = calculatePercentChange(
      previousSnapshot.avgApy,
      currentSnapshot.avgApy
    );

    if (Math.abs(apyChange) >= THRESHOLDS.APY.WARNING) {
      const severity: Severity =
        Math.abs(apyChange) >= THRESHOLDS.APY.CRITICAL ? "critical" : "warning";
      const direction = apyChange > 0 ? "increased" : "decreased";

      if (!(await changeExists(vault.id, CHANGE_TYPES.APY_CHANGE, now))) {
        changes.push({
          vaultId: vault.id,
          changeType: CHANGE_TYPES.APY_CHANGE,
          severity,
          title: `APY ${direction} ${Math.abs(apyChange).toFixed(1)}%`,
          description: `Yield changed from ${formatPercentage(previousSnapshot.avgApy)} to ${formatPercentage(currentSnapshot.avgApy)}`,
          oldValue: previousSnapshot.avgApy.toString(),
          newValue: currentSnapshot.avgApy.toString(),
          detectedAt: now,
          metadata: { percentChange: apyChange },
        });
      }
    }
  }

  // 3. SHARE PRICE CHANGES
  const sharePriceChange = calculatePercentChange(
    previousSnapshot.sharePrice,
    currentSnapshot.sharePrice
  );

  if (Math.abs(sharePriceChange) >= THRESHOLDS.SHARE_PRICE.WARNING) {
    const severity: Severity =
      Math.abs(sharePriceChange) >= THRESHOLDS.SHARE_PRICE.CRITICAL
        ? "critical"
        : "warning";
    const direction = sharePriceChange > 0 ? "increased" : "decreased";

    if (
      !(await changeExists(vault.id, CHANGE_TYPES.SHARE_PRICE_CHANGE, now))
    ) {
      changes.push({
        vaultId: vault.id,
        changeType: CHANGE_TYPES.SHARE_PRICE_CHANGE,
        severity,
        title: `Share price ${direction} ${Math.abs(sharePriceChange).toFixed(2)}%`,
        description: `Share price moved from ${previousSnapshot.sharePrice.toFixed(6)} to ${currentSnapshot.sharePrice.toFixed(6)}`,
        oldValue: previousSnapshot.sharePrice.toString(),
        newValue: currentSnapshot.sharePrice.toString(),
        detectedAt: now,
        metadata: { percentChange: sharePriceChange },
      });
    }
  }

  // 4. RISK SCORE CHANGES
  const currentRisk = await getLatestRiskSnapshot(vault.id);
  const previousRisk = await getPreviousRiskSnapshot(vault.id);

  if (currentRisk && previousRisk) {
    // Concentration risk change
    if (currentRisk.concentrationScore !== previousRisk.concentrationScore) {
      const severity: Severity =
        currentRisk.concentrationScore === "high" ? "critical" : "warning";

      if (
        !(await changeExists(
          vault.id,
          CHANGE_TYPES.CONCENTRATION_RISK_CHANGE,
          now
        ))
      ) {
        changes.push({
          vaultId: vault.id,
          changeType: CHANGE_TYPES.CONCENTRATION_RISK_CHANGE,
          severity,
          title: `Concentration risk changed to ${currentRisk.concentrationScore}`,
          description: `Risk level moved from ${previousRisk.concentrationScore} to ${currentRisk.concentrationScore}`,
          oldValue: previousRisk.concentrationScore,
          newValue: currentRisk.concentrationScore,
          detectedAt: now,
        });
      }
    }

    // Liquidity risk change
    if (currentRisk.liquidityScore !== previousRisk.liquidityScore) {
      const severity: Severity =
        currentRisk.liquidityScore === "high" ? "critical" : "warning";

      if (
        !(await changeExists(vault.id, CHANGE_TYPES.LIQUIDITY_RISK_CHANGE, now))
      ) {
        changes.push({
          vaultId: vault.id,
          changeType: CHANGE_TYPES.LIQUIDITY_RISK_CHANGE,
          severity,
          title: `Liquidity risk changed to ${currentRisk.liquidityScore}`,
          description: `Risk level moved from ${previousRisk.liquidityScore} to ${currentRisk.liquidityScore}`,
          oldValue: previousRisk.liquidityScore,
          newValue: currentRisk.liquidityScore,
          detectedAt: now,
        });
      }
    }

    // Diversification score change
    if (
      currentRisk.diversificationScore !== previousRisk.diversificationScore
    ) {
      const severity: Severity =
        currentRisk.diversificationScore === "poor" ? "warning" : "info";

      if (
        !(await changeExists(
          vault.id,
          CHANGE_TYPES.DIVERSIFICATION_CHANGE,
          now
        ))
      ) {
        changes.push({
          vaultId: vault.id,
          changeType: CHANGE_TYPES.DIVERSIFICATION_CHANGE,
          severity,
          title: `Diversification changed to ${currentRisk.diversificationScore}`,
          description: `Diversification moved from ${previousRisk.diversificationScore} to ${currentRisk.diversificationScore}`,
          oldValue: previousRisk.diversificationScore,
          newValue: currentRisk.diversificationScore,
          detectedAt: now,
        });
      }
    }
  }

  // 5. LARGE TRANSACTIONS
  const recentTransactions = await getRecentTransactions(
    vault.id,
    THRESHOLDS.TIME_WINDOWS.RECENT_TRANSACTIONS
  );

  for (const tx of recentTransactions) {
    // Use USD value if available for better accuracy
    if (tx.assetsUsd && currentSnapshot.totalAssetsUsd > 0) {
      const txPercentOfVault = (tx.assetsUsd / currentSnapshot.totalAssetsUsd) * 100;

      if (txPercentOfVault >= THRESHOLDS.LARGE_TRANSACTION.PERCENT_OF_TVL) {
        const changeType =
          tx.type === "Deposit"
            ? CHANGE_TYPES.LARGE_DEPOSIT
            : CHANGE_TYPES.LARGE_WITHDRAWAL;
        const severity: Severity =
          txPercentOfVault >= THRESHOLDS.LARGE_TRANSACTION.CRITICAL_PERCENT
            ? "critical"
            : "warning";

        if (!(await changeExists(vault.id, changeType, tx.timestamp))) {
          changes.push({
            vaultId: vault.id,
            changeType,
            severity,
            title: `Large ${tx.type.toLowerCase()} detected`,
            description: `${txPercentOfVault.toFixed(1)}% of vault ${tx.type === "Deposit" ? "added" : "withdrawn"} (${formatCurrency(tx.assetsUsd)})`,
            newValue: tx.assetsUsd.toString(),
            detectedAt: tx.timestamp,
            metadata: {
              txHash: tx.txHash,
              percentOfVault: txPercentOfVault,
              amountUsd: tx.assetsUsd,
            },
          });
        }
      }
    }
  }

  // 6. REALLOCATIONS
  const recentReallocations = await getRecentReallocations(
    vault.id,
    THRESHOLDS.TIME_WINDOWS.RECENT_REALLOCATIONS
  );

  for (const realloc of recentReallocations) {
    if (!(await changeExists(vault.id, CHANGE_TYPES.REALLOCATION, realloc.timestamp))) {
      const amountUsd = realloc.amountUsd ? formatCurrency(realloc.amountUsd) : "unknown amount";

      changes.push({
        vaultId: vault.id,
        changeType: CHANGE_TYPES.REALLOCATION,
        severity: "info",
        title: "Curator rebalanced vault",
        description: `Moved ${amountUsd} between adapters`,
        newValue: realloc.amount,
        detectedAt: realloc.timestamp,
        metadata: {
          txHash: realloc.txHash,
          marketId: realloc.marketId,
          type: realloc.type,
        },
      });
    }
  }

  // 7. ALLOCATION SHIFTS
  const currentAllocations = await prisma.adapterAllocation.findMany({
    where: { vaultId: vault.id },
    orderBy: { snapshotTime: "desc" },
  });

  // Get unique snapshot times
  const snapshotTimes = [
    ...new Set(currentAllocations.map((a) => a.snapshotTime.getTime())),
  ];

  if (snapshotTimes.length >= 2) {
    const currentTime = new Date(snapshotTimes[0]);
    const previousTime = new Date(snapshotTimes[1]);

    const currentAllocs = currentAllocations.filter(
      (a) => a.snapshotTime.getTime() === currentTime.getTime()
    );
    const previousAllocs = await getAllocationsAtTime(vault.id, previousTime);

    // Build a map of adapter allocations
    const currentMap = new Map(
      currentAllocs.map((a) => [a.adapterAddress, a.allocationPct])
    );
    const previousMap = new Map(
      previousAllocs.map((a) => [a.adapterAddress, a.allocationPct])
    );

    // Check for significant shifts
    for (const [address, currentPct] of currentMap) {
      const previousPct = previousMap.get(address) || 0;
      const shift = Math.abs(currentPct - previousPct);

      if (shift >= THRESHOLDS.ALLOCATION_SHIFT.WARNING) {
        const severity: Severity =
          shift >= THRESHOLDS.ALLOCATION_SHIFT.CRITICAL ? "critical" : "warning";
        const direction = currentPct > previousPct ? "increased" : "decreased";

        if (
          !(await changeExists(vault.id, CHANGE_TYPES.ALLOCATION_SHIFT, now))
        ) {
          changes.push({
            vaultId: vault.id,
            changeType: CHANGE_TYPES.ALLOCATION_SHIFT,
            severity,
            title: `Adapter allocation ${direction} ${shift.toFixed(1)}pp`,
            description: `Allocation to ${address.slice(0, 10)}... moved from ${previousPct.toFixed(1)}% to ${currentPct.toFixed(1)}%`,
            oldValue: previousPct.toString(),
            newValue: currentPct.toString(),
            detectedAt: now,
            metadata: {
              adapterAddress: address,
              percentagePointsChange: shift,
            },
          });
        }
      }
    }
  }

  return changes;
}

/**
 * Store detected changes in the database
 */
export async function storeChanges(changes: ChangeEvent[]): Promise<number> {
  let stored = 0;

  for (const change of changes) {
    try {
      await prisma.vaultChange.create({
        data: {
          vaultId: change.vaultId,
          changeType: change.changeType,
          severity: change.severity,
          title: change.title,
          description: change.description,
          oldValue: change.oldValue,
          newValue: change.newValue,
          metadata: change.metadata,
          detectedAt: change.detectedAt,
        },
      });
      stored++;
    } catch (error) {
      // Skip duplicates (unique constraint violation)
      // This is expected if running detection multiple times
    }
  }

  return stored;
}

/**
 * Get recent changes for display
 */
export async function getRecentChanges(options: {
  hours?: number;
  severity?: Severity;
  vaultId?: string;
  limit?: number;
  offset?: number;
}) {
  const {
    hours = 24,
    severity,
    vaultId,
    limit = 50,
    offset = 0,
  } = options;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const where = {
    detectedAt: { gte: since },
    ...(severity && { severity }),
    ...(vaultId && { vaultId }),
  };

  const [changes, total] = await Promise.all([
    prisma.vaultChange.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        vault: {
          select: {
            name: true,
            symbol: true,
            address: true,
          },
        },
      },
    }),
    prisma.vaultChange.count({ where }),
  ]);

  return {
    changes,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}

/**
 * Get change summary counts by severity
 */
export async function getChangeSummary(hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const counts = await prisma.vaultChange.groupBy({
    by: ["severity"],
    where: {
      detectedAt: { gte: since },
    },
    _count: true,
  });

  return {
    critical: counts.find((c) => c.severity === "critical")?._count || 0,
    warning: counts.find((c) => c.severity === "warning")?._count || 0,
    info: counts.find((c) => c.severity === "info")?._count || 0,
    total: counts.reduce((sum, c) => sum + c._count, 0),
  };
}

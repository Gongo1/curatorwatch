/**
 * Curator-level and ecosystem-level alert detection.
 *
 * Works with hourly CuratorSnapshots — no transaction data needed.
 * Three detection layers:
 *   1. Curator AUM drops/surges (24h and 72h windows)
 *   2. Ecosystem-wide AUM drops (24h)
 *   3. Snapshot creation + cleanup
 */

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";
import { ALERT_TYPES, THRESHOLDS, type Severity } from "./change-thresholds";
import { EXCLUDED_CURATORS } from "./curator-aliases";

export interface PlatformAlertEvent {
  scope: "curator" | "ecosystem";
  curatorId?: string;
  changeType: string;
  severity: Severity;
  title: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  detectedAt: Date;
  metadata?: Prisma.InputJsonValue;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Create CuratorSnapshots for all active curators.
 * Called once per collection run (hourly) to build AUM history.
 */
export async function createCuratorSnapshots(): Promise<number> {
  const curators = await prisma.curator.findMany({
    where: {
      vaultCount: { gt: 0 },
      ...(EXCLUDED_CURATORS.length > 0
        ? { NOT: { name: { in: EXCLUDED_CURATORS } } }
        : {}),
    },
    select: {
      id: true,
      totalAssetsManaged: true,
      vaultCount: true,
    },
  });

  if (curators.length === 0) return 0;

  const now = new Date();
  const data = curators.map((c) => ({
    curatorId: c.id,
    totalAssetsUsd: c.totalAssetsManaged ?? 0,
    vaultCount: c.vaultCount ?? 0,
    timestamp: now,
  }));

  const result = await prisma.curatorSnapshot.createMany({ data });
  return result.count;
}

/**
 * Detect curator-level AUM alerts.
 * Compares current curator AUM to snapshots from ~24h ago and ~72h ago.
 */
export async function detectCuratorAlerts(): Promise<PlatformAlertEvent[]> {
  const alerts: PlatformAlertEvent[] = [];
  const now = new Date();

  const curators = await prisma.curator.findMany({
    where: {
      vaultCount: { gt: 0 },
      totalAssetsManaged: { gte: THRESHOLDS.MIN_CURATOR_AUM },
      ...(EXCLUDED_CURATORS.length > 0
        ? { NOT: { name: { in: EXCLUDED_CURATORS } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      totalAssetsManaged: true,
    },
  });

  for (const curator of curators) {
    const currentAUM = curator.totalAssetsManaged ?? 0;
    if (currentAUM <= 0) continue;

    // 24h comparison
    const snapshot24h = await getClosestCuratorSnapshot(curator.id, now, 24);
    if (snapshot24h) {
      const pctChange24h = ((currentAUM - snapshot24h.totalAssetsUsd) / snapshot24h.totalAssetsUsd) * 100;

      // Drops
      if (pctChange24h < 0) {
        const absDrop = Math.abs(pctChange24h);
        const isDuplicate = await checkPlatformDuplicate("curator", curator.id, ALERT_TYPES.CURATOR_AUM_DROP, now, 24);
        if (!isDuplicate) {
          if (absDrop >= THRESHOLDS.CURATOR_AUM.CRITICAL_24H) {
            alerts.push({
              scope: "curator",
              curatorId: curator.id,
              changeType: ALERT_TYPES.CURATOR_AUM_DROP,
              severity: "critical",
              title: `Critical AUM Drop: ${curator.name || "Unknown Curator"}`,
              description: `Total AUM fell ${absDrop.toFixed(1)}% in 24h (${formatCurrency(snapshot24h.totalAssetsUsd)} → ${formatCurrency(currentAUM)}). Major capital outflow.`,
              oldValue: formatCurrency(snapshot24h.totalAssetsUsd),
              newValue: formatCurrency(currentAUM),
              detectedAt: now,
              metadata: { pctChange: pctChange24h, oldAUM: snapshot24h.totalAssetsUsd, currentAUM, window: "24h" },
            });
          } else if (absDrop >= THRESHOLDS.CURATOR_AUM.WARNING_24H) {
            alerts.push({
              scope: "curator",
              curatorId: curator.id,
              changeType: ALERT_TYPES.CURATOR_AUM_DROP,
              severity: "warning",
              title: `AUM Decline: ${curator.name || "Unknown Curator"}`,
              description: `Total AUM fell ${absDrop.toFixed(1)}% in 24h (${formatCurrency(snapshot24h.totalAssetsUsd)} → ${formatCurrency(currentAUM)}). Monitor for continued outflows.`,
              oldValue: formatCurrency(snapshot24h.totalAssetsUsd),
              newValue: formatCurrency(currentAUM),
              detectedAt: now,
              metadata: { pctChange: pctChange24h, oldAUM: snapshot24h.totalAssetsUsd, currentAUM, window: "24h" },
            });
          }
        }
      }

      // Surges
      if (pctChange24h > 0 && pctChange24h >= THRESHOLDS.CURATOR_AUM.SURGE_INFO) {
        const isDuplicate = await checkPlatformDuplicate("curator", curator.id, ALERT_TYPES.CURATOR_AUM_SURGE, now, 24);
        if (!isDuplicate) {
          alerts.push({
            scope: "curator",
            curatorId: curator.id,
            changeType: ALERT_TYPES.CURATOR_AUM_SURGE,
            severity: "info",
            title: `AUM Surge: ${curator.name || "Unknown Curator"}`,
            description: `Total AUM grew ${pctChange24h.toFixed(1)}% in 24h (${formatCurrency(snapshot24h.totalAssetsUsd)} → ${formatCurrency(currentAUM)}). Strong growth signal.`,
            oldValue: formatCurrency(snapshot24h.totalAssetsUsd),
            newValue: formatCurrency(currentAUM),
            detectedAt: now,
            metadata: { pctChange: pctChange24h, oldAUM: snapshot24h.totalAssetsUsd, currentAUM, window: "24h" },
          });
        }
      }
    }

    // 72h comparison (sustained outflow detection)
    const snapshot72h = await getClosestCuratorSnapshot(curator.id, now, 72);
    if (snapshot72h) {
      const pctChange72h = ((currentAUM - snapshot72h.totalAssetsUsd) / snapshot72h.totalAssetsUsd) * 100;

      if (pctChange72h < 0 && Math.abs(pctChange72h) >= THRESHOLDS.CURATOR_AUM.CRITICAL_72H) {
        // Only fire 72h alert if we didn't already fire a 24h critical
        const has24hCritical = alerts.some(
          (a) => a.curatorId === curator.id && a.changeType === ALERT_TYPES.CURATOR_AUM_DROP && a.severity === "critical"
        );
        if (!has24hCritical) {
          const isDuplicate = await checkPlatformDuplicate("curator", curator.id, ALERT_TYPES.CURATOR_AUM_DROP, now, 72);
          if (!isDuplicate) {
            alerts.push({
              scope: "curator",
              curatorId: curator.id,
              changeType: ALERT_TYPES.CURATOR_AUM_DROP,
              severity: "critical",
              title: `Sustained AUM Decline: ${curator.name || "Unknown Curator"}`,
              description: `Total AUM fell ${Math.abs(pctChange72h).toFixed(1)}% over 3 days (${formatCurrency(snapshot72h.totalAssetsUsd)} → ${formatCurrency(currentAUM)}). Sustained capital outflow.`,
              oldValue: formatCurrency(snapshot72h.totalAssetsUsd),
              newValue: formatCurrency(currentAUM),
              detectedAt: now,
              metadata: { pctChange: pctChange72h, oldAUM: snapshot72h.totalAssetsUsd, currentAUM, window: "72h" },
            });
          }
        }
      }
    }
  }

  return alerts;
}

/**
 * Detect ecosystem-wide AUM alerts.
 * Compares sum of all curator AUM now vs ~24h ago.
 */
export async function detectEcosystemAlerts(): Promise<PlatformAlertEvent[]> {
  const alerts: PlatformAlertEvent[] = [];
  const now = new Date();

  // Current total AUM across all curators (excluding filtered)
  const currentResult = await prisma.curator.aggregate({
    where: {
      vaultCount: { gt: 0 },
      ...(EXCLUDED_CURATORS.length > 0
        ? { NOT: { name: { in: EXCLUDED_CURATORS } } }
        : {}),
    },
    _sum: { totalAssetsManaged: true },
  });

  const currentTotalAUM = currentResult._sum.totalAssetsManaged ?? 0;
  if (currentTotalAUM < THRESHOLDS.MIN_ECOSYSTEM_AUM) return alerts;

  // Sum of curator snapshots from ~24h ago
  // Get the latest snapshot per curator from the 22-26h window
  const twentyTwoHoursAgo = new Date(now.getTime() - 22 * 60 * 60 * 1000);
  const twentySixHoursAgo = new Date(now.getTime() - 26 * 60 * 60 * 1000);

  const oldSnapshots = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COALESCE(SUM(s."totalAssetsUsd"), 0) as total
    FROM (
      SELECT DISTINCT ON ("curatorId") "totalAssetsUsd"
      FROM "CuratorSnapshot"
      WHERE "timestamp" >= ${twentySixHoursAgo}
        AND "timestamp" <= ${twentyTwoHoursAgo}
      ORDER BY "curatorId", "timestamp" DESC
    ) s
  `;

  const oldTotalAUM = Number(oldSnapshots[0]?.total ?? 0);
  if (oldTotalAUM <= 0) return alerts;

  const pctChange = ((currentTotalAUM - oldTotalAUM) / oldTotalAUM) * 100;

  if (pctChange >= 0) return alerts; // Only alert on drops

  const absDrop = Math.abs(pctChange);
  const isDuplicate = await checkPlatformDuplicate("ecosystem", null, ALERT_TYPES.ECOSYSTEM_AUM_DROP, now, 24);
  if (isDuplicate) return alerts;

  if (absDrop >= THRESHOLDS.ECOSYSTEM_AUM.CRITICAL_24H) {
    alerts.push({
      scope: "ecosystem",
      changeType: ALERT_TYPES.ECOSYSTEM_AUM_DROP,
      severity: "critical",
      title: "Critical Ecosystem AUM Drop",
      description: `Total platform AUM fell ${absDrop.toFixed(1)}% in 24h (${formatCurrency(oldTotalAUM)} → ${formatCurrency(currentTotalAUM)}). Broad-based capital outflows.`,
      oldValue: formatCurrency(oldTotalAUM),
      newValue: formatCurrency(currentTotalAUM),
      detectedAt: now,
      metadata: { pctChange, oldTotalAUM, currentTotalAUM },
    });
  } else if (absDrop >= THRESHOLDS.ECOSYSTEM_AUM.WARNING_24H) {
    alerts.push({
      scope: "ecosystem",
      changeType: ALERT_TYPES.ECOSYSTEM_AUM_DROP,
      severity: "warning",
      title: "Ecosystem AUM Decline",
      description: `Total platform AUM fell ${absDrop.toFixed(1)}% in 24h (${formatCurrency(oldTotalAUM)} → ${formatCurrency(currentTotalAUM)}). Monitor for continued outflows.`,
      oldValue: formatCurrency(oldTotalAUM),
      newValue: formatCurrency(currentTotalAUM),
      detectedAt: now,
      metadata: { pctChange, oldTotalAUM, currentTotalAUM },
    });
  }

  return alerts;
}

/**
 * Store platform alerts in the PlatformAlert table.
 */
export async function storePlatformAlerts(alerts: PlatformAlertEvent[]): Promise<number> {
  if (alerts.length === 0) return 0;

  let stored = 0;
  for (const alert of alerts) {
    try {
      await prisma.platformAlert.create({
        data: {
          scope: alert.scope,
          curatorId: alert.curatorId ?? null,
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
    } catch {
      // Likely a duplicate (unique constraint), skip
      console.log(`Skipping duplicate platform alert: ${alert.title}`);
    }
  }

  return stored;
}

/**
 * Delete CuratorSnapshots older than 90 days to prevent unbounded growth.
 */
export async function cleanupOldCuratorSnapshots(): Promise<number> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const result = await prisma.curatorSnapshot.deleteMany({
    where: { timestamp: { lt: ninetyDaysAgo } },
  });

  return result.count;
}

// --- Helpers ---

/**
 * Get the closest CuratorSnapshot to `hoursAgo` for a given curator.
 * Uses a 2h tolerance window.
 */
async function getClosestCuratorSnapshot(
  curatorId: string,
  now: Date,
  hoursAgo: number
): Promise<{ totalAssetsUsd: number; timestamp: Date } | null> {
  const targetTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  const windowStart = new Date(targetTime.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 2 * 60 * 60 * 1000);

  return prisma.curatorSnapshot.findFirst({
    where: {
      curatorId,
      timestamp: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { timestamp: "desc" },
    select: { totalAssetsUsd: true, timestamp: true },
  });
}

/**
 * Check for duplicate PlatformAlert within the given hour window.
 */
async function checkPlatformDuplicate(
  scope: string,
  curatorId: string | null,
  changeType: string,
  now: Date,
  windowHours: number
): Promise<boolean> {
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  const existing = await prisma.platformAlert.findFirst({
    where: {
      scope,
      curatorId: curatorId ?? undefined,
      changeType,
      detectedAt: { gte: windowStart },
    },
  });

  return existing !== null;
}

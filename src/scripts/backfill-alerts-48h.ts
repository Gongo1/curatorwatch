/**
 * Backfill script: generates historical alerts for the past 48 hours.
 *
 * Creates:
 *   1. CuratorSnapshots at ~6h intervals from VaultSnapshot data
 *   2. VAULT_TVL_DROP / VAULT_TVL_SURGE alerts
 *   3. CURATOR_AUM_DROP / CURATOR_AUM_SURGE alerts
 *   4. ECOSYSTEM_AUM_DROP alerts
 *
 * Safe to run multiple times — unique constraints prevent duplicates.
 *
 * Usage: npx tsx src/scripts/backfill-alerts-48h.ts
 */

import { prisma } from "../lib/db";
import { ALERT_TYPES, THRESHOLDS } from "../lib/change-thresholds";
import { EXCLUDED_CURATORS } from "../lib/curator-aliases";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

const BACKFILL_HOURS = 48;
const SNAPSHOT_INTERVAL_HOURS = 6; // Create curator snapshots every 6h

async function main() {
  log("=".repeat(60));
  log("Backfill: generating alerts for past 48 hours");
  log("=".repeat(60));

  const now = new Date();
  const backfillStart = new Date(now.getTime() - BACKFILL_HOURS * 60 * 60 * 1000);

  // ─── Step 1: Backfill CuratorSnapshots ───
  log("\n--- Step 1: Backfill CuratorSnapshots ---");
  const curatorSnapshotsCreated = await backfillCuratorSnapshots(backfillStart, now);
  log(`Created ${curatorSnapshotsCreated} curator snapshots`);

  // ─── Step 2: Detect Vault TVL alerts ───
  log("\n--- Step 2: Detect Vault TVL Drop/Surge alerts ---");
  const vaultAlerts = await detectHistoricalVaultTvlAlerts(backfillStart, now);
  log(`Generated ${vaultAlerts} vault TVL alerts`);

  // ─── Step 3: Detect Curator AUM alerts ───
  log("\n--- Step 3: Detect Curator AUM alerts ---");
  const curatorAlerts = await detectHistoricalCuratorAlerts(backfillStart, now);
  log(`Generated ${curatorAlerts} curator AUM alerts`);

  // ─── Step 4: Detect Ecosystem AUM alerts ───
  log("\n--- Step 4: Detect Ecosystem AUM alerts ---");
  const ecosystemAlerts = await detectHistoricalEcosystemAlerts(backfillStart, now);
  log(`Generated ${ecosystemAlerts} ecosystem alerts`);

  log("\n" + "=".repeat(60));
  log("Backfill complete!");
  log(`  Curator snapshots: ${curatorSnapshotsCreated}`);
  log(`  Vault TVL alerts: ${vaultAlerts}`);
  log(`  Curator AUM alerts: ${curatorAlerts}`);
  log(`  Ecosystem alerts: ${ecosystemAlerts}`);
  log("=".repeat(60));
}

/**
 * Create CuratorSnapshots at regular intervals from VaultSnapshot data.
 * For each interval, compute each curator's AUM by summing their vaults' latest snapshot.
 */
async function backfillCuratorSnapshots(start: Date, end: Date): Promise<number> {
  const curators = await prisma.curator.findMany({
    where: {
      vaultCount: { gt: 0 },
      ...(EXCLUDED_CURATORS.length > 0
        ? { NOT: { name: { in: EXCLUDED_CURATORS } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      vaults: { select: { id: true } },
    },
  });

  let total = 0;

  // Generate snapshot timestamps at SNAPSHOT_INTERVAL_HOURS intervals
  const timestamps: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += SNAPSHOT_INTERVAL_HOURS * 60 * 60 * 1000) {
    timestamps.push(new Date(t));
  }

  for (const ts of timestamps) {
    const data: { curatorId: string; totalAssetsUsd: number; vaultCount: number; timestamp: Date }[] = [];

    for (const curator of curators) {
      let totalAssetsUsd = 0;
      let activeVaults = 0;

      for (const vault of curator.vaults) {
        // Get the latest snapshot at or before this timestamp
        const snap = await prisma.vaultSnapshot.findFirst({
          where: {
            vaultId: vault.id,
            timestamp: { lte: ts },
          },
          orderBy: { timestamp: "desc" },
          select: { totalAssetsUsd: true },
        });

        if (snap && snap.totalAssetsUsd > 0) {
          totalAssetsUsd += snap.totalAssetsUsd;
          activeVaults++;
        }
      }

      if (activeVaults > 0) {
        data.push({
          curatorId: curator.id,
          totalAssetsUsd,
          vaultCount: activeVaults,
          timestamp: ts,
        });
      }
    }

    if (data.length > 0) {
      try {
        const result = await prisma.curatorSnapshot.createMany({
          data,
          skipDuplicates: true,
        });
        total += result.count;
      } catch {
        // Ignore duplicates
      }
    }

    log(`  ${ts.toISOString()}: ${data.length} curator snapshots`);
  }

  return total;
}

/**
 * Detect VAULT_TVL_DROP and VAULT_TVL_SURGE alerts by comparing snapshots ~24h apart.
 */
async function detectHistoricalVaultTvlAlerts(start: Date, end: Date): Promise<number> {
  let stored = 0;

  // Get all active vaults
  const vaults = await prisma.vault.findMany({
    where: { active: true },
    select: { id: true, name: true, address: true },
  });

  // For each 6h interval from (start+24h) to end, compare with snapshot 24h prior
  const checkStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const checkpoints: Date[] = [];
  for (let t = checkStart.getTime(); t <= end.getTime(); t += 6 * 60 * 60 * 1000) {
    checkpoints.push(new Date(t));
  }

  for (const checkpoint of checkpoints) {
    const twentyTwoHoursAgo = new Date(checkpoint.getTime() - 22 * 60 * 60 * 1000);
    const twentySixHoursAgo = new Date(checkpoint.getTime() - 26 * 60 * 60 * 1000);
    const twoHoursBefore = new Date(checkpoint.getTime() - 2 * 60 * 60 * 1000);

    for (const vault of vaults) {
      // Current snapshot (closest to checkpoint)
      const currentSnap = await prisma.vaultSnapshot.findFirst({
        where: {
          vaultId: vault.id,
          timestamp: { gte: twoHoursBefore, lte: checkpoint },
        },
        orderBy: { timestamp: "desc" },
        select: { totalAssetsUsd: true, timestamp: true },
      });

      if (!currentSnap || currentSnap.totalAssetsUsd <= 0) continue;

      // Old snapshot (~24h prior)
      const oldSnap = await prisma.vaultSnapshot.findFirst({
        where: {
          vaultId: vault.id,
          timestamp: { gte: twentySixHoursAgo, lte: twentyTwoHoursAgo },
        },
        orderBy: { timestamp: "desc" },
        select: { totalAssetsUsd: true },
      });

      if (!oldSnap || oldSnap.totalAssetsUsd <= 0) continue;

      const pctChange = ((currentSnap.totalAssetsUsd - oldSnap.totalAssetsUsd) / oldSnap.totalAssetsUsd) * 100;
      const absPct = Math.abs(pctChange);

      // TVL Drop
      if (pctChange < 0 && absPct >= THRESHOLDS.VAULT_TVL.WARNING) {
        const severity = absPct >= THRESHOLDS.VAULT_TVL.CRITICAL ? "critical" : "warning";
        const title = severity === "critical"
          ? `Critical TVL Drop: ${vault.name}`
          : `TVL Decline: ${vault.name}`;

        try {
          await prisma.vaultChange.create({
            data: {
              vaultId: vault.id,
              changeType: ALERT_TYPES.VAULT_TVL_DROP,
              severity,
              title,
              description: `TVL fell ${absPct.toFixed(1)}% in 24h (${formatCurrency(oldSnap.totalAssetsUsd)} → ${formatCurrency(currentSnap.totalAssetsUsd)}).`,
              oldValue: formatCurrency(oldSnap.totalAssetsUsd),
              newValue: formatCurrency(currentSnap.totalAssetsUsd),
              detectedAt: currentSnap.timestamp,
              metadata: { pctChange, backfilled: true },
              viewed: false,
            },
          });
          stored++;
        } catch {
          // Duplicate, skip
        }
      }

      // TVL Surge
      if (pctChange > 0 && absPct >= THRESHOLDS.VAULT_TVL.SURGE_INFO) {
        try {
          await prisma.vaultChange.create({
            data: {
              vaultId: vault.id,
              changeType: ALERT_TYPES.VAULT_TVL_SURGE,
              severity: "info",
              title: `TVL Surge: ${vault.name}`,
              description: `TVL grew ${absPct.toFixed(1)}% in 24h (${formatCurrency(oldSnap.totalAssetsUsd)} → ${formatCurrency(currentSnap.totalAssetsUsd)}).`,
              oldValue: formatCurrency(oldSnap.totalAssetsUsd),
              newValue: formatCurrency(currentSnap.totalAssetsUsd),
              detectedAt: currentSnap.timestamp,
              metadata: { pctChange, backfilled: true },
              viewed: false,
            },
          });
          stored++;
        } catch {
          // Duplicate
        }
      }
    }

    log(`  Checkpoint ${checkpoint.toISOString()}: checked ${vaults.length} vaults`);
  }

  return stored;
}

/**
 * Detect CURATOR_AUM_DROP and CURATOR_AUM_SURGE alerts from backfilled CuratorSnapshots.
 */
async function detectHistoricalCuratorAlerts(start: Date, end: Date): Promise<number> {
  let stored = 0;

  const curators = await prisma.curator.findMany({
    where: {
      vaultCount: { gt: 0 },
      totalAssetsManaged: { gte: THRESHOLDS.MIN_CURATOR_AUM },
      ...(EXCLUDED_CURATORS.length > 0
        ? { NOT: { name: { in: EXCLUDED_CURATORS } } }
        : {}),
    },
    select: { id: true, name: true },
  });

  // Check at 6h intervals from (start+24h) to end
  const checkStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const checkpoints: Date[] = [];
  for (let t = checkStart.getTime(); t <= end.getTime(); t += 6 * 60 * 60 * 1000) {
    checkpoints.push(new Date(t));
  }

  for (const checkpoint of checkpoints) {
    for (const curator of curators) {
      // Current snapshot
      const currentSnap = await prisma.curatorSnapshot.findFirst({
        where: {
          curatorId: curator.id,
          timestamp: { lte: checkpoint },
        },
        orderBy: { timestamp: "desc" },
        select: { totalAssetsUsd: true, timestamp: true },
      });

      if (!currentSnap || currentSnap.totalAssetsUsd <= 0) continue;

      // 24h prior snapshot
      const target24h = new Date(checkpoint.getTime() - 24 * 60 * 60 * 1000);
      const snap24h = await prisma.curatorSnapshot.findFirst({
        where: {
          curatorId: curator.id,
          timestamp: {
            gte: new Date(target24h.getTime() - 4 * 60 * 60 * 1000),
            lte: new Date(target24h.getTime() + 4 * 60 * 60 * 1000),
          },
        },
        orderBy: { timestamp: "desc" },
        select: { totalAssetsUsd: true },
      });

      if (!snap24h || snap24h.totalAssetsUsd <= 0) continue;

      const pctChange = ((currentSnap.totalAssetsUsd - snap24h.totalAssetsUsd) / snap24h.totalAssetsUsd) * 100;
      const absPct = Math.abs(pctChange);

      // Drop
      if (pctChange < 0 && absPct >= THRESHOLDS.CURATOR_AUM.WARNING_24H) {
        const severity = absPct >= THRESHOLDS.CURATOR_AUM.CRITICAL_24H ? "critical" : "warning";
        try {
          await prisma.platformAlert.create({
            data: {
              scope: "curator",
              curatorId: curator.id,
              changeType: ALERT_TYPES.CURATOR_AUM_DROP,
              severity,
              title: severity === "critical"
                ? `Critical AUM Drop: ${curator.name || "Unknown"}`
                : `AUM Decline: ${curator.name || "Unknown"}`,
              description: `Total AUM fell ${absPct.toFixed(1)}% in 24h (${formatCurrency(snap24h.totalAssetsUsd)} → ${formatCurrency(currentSnap.totalAssetsUsd)}).`,
              oldValue: formatCurrency(snap24h.totalAssetsUsd),
              newValue: formatCurrency(currentSnap.totalAssetsUsd),
              detectedAt: currentSnap.timestamp,
              metadata: { pctChange, backfilled: true },
              viewed: false,
            },
          });
          stored++;
        } catch {
          // Duplicate
        }
      }

      // Surge
      if (pctChange > 0 && absPct >= THRESHOLDS.CURATOR_AUM.SURGE_INFO) {
        try {
          await prisma.platformAlert.create({
            data: {
              scope: "curator",
              curatorId: curator.id,
              changeType: ALERT_TYPES.CURATOR_AUM_SURGE,
              severity: "info",
              title: `AUM Surge: ${curator.name || "Unknown"}`,
              description: `Total AUM grew ${absPct.toFixed(1)}% in 24h (${formatCurrency(snap24h.totalAssetsUsd)} → ${formatCurrency(currentSnap.totalAssetsUsd)}).`,
              oldValue: formatCurrency(snap24h.totalAssetsUsd),
              newValue: formatCurrency(currentSnap.totalAssetsUsd),
              detectedAt: currentSnap.timestamp,
              metadata: { pctChange, backfilled: true },
              viewed: false,
            },
          });
          stored++;
        } catch {
          // Duplicate
        }
      }
    }

    log(`  Checkpoint ${checkpoint.toISOString()}: checked ${curators.length} curators`);
  }

  return stored;
}

/**
 * Detect ECOSYSTEM_AUM_DROP alerts from backfilled CuratorSnapshot data.
 */
async function detectHistoricalEcosystemAlerts(start: Date, end: Date): Promise<number> {
  let stored = 0;

  const checkStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const checkpoints: Date[] = [];
  for (let t = checkStart.getTime(); t <= end.getTime(); t += 6 * 60 * 60 * 1000) {
    checkpoints.push(new Date(t));
  }

  for (const checkpoint of checkpoints) {
    // Sum current curator snapshots closest to checkpoint
    const currentSnaps = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(s."totalAssetsUsd"), 0) as total
      FROM (
        SELECT DISTINCT ON ("curatorId") "totalAssetsUsd"
        FROM "CuratorSnapshot"
        WHERE "timestamp" <= ${checkpoint}
          AND "timestamp" >= ${new Date(checkpoint.getTime() - 4 * 60 * 60 * 1000)}
        ORDER BY "curatorId", "timestamp" DESC
      ) s
    `;

    const currentTotal = Number(currentSnaps[0]?.total ?? 0);
    if (currentTotal < THRESHOLDS.MIN_ECOSYSTEM_AUM) continue;

    // 24h prior
    const target24h = new Date(checkpoint.getTime() - 24 * 60 * 60 * 1000);
    const oldSnaps = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(s."totalAssetsUsd"), 0) as total
      FROM (
        SELECT DISTINCT ON ("curatorId") "totalAssetsUsd"
        FROM "CuratorSnapshot"
        WHERE "timestamp" <= ${new Date(target24h.getTime() + 4 * 60 * 60 * 1000)}
          AND "timestamp" >= ${new Date(target24h.getTime() - 4 * 60 * 60 * 1000)}
        ORDER BY "curatorId", "timestamp" DESC
      ) s
    `;

    const oldTotal = Number(oldSnaps[0]?.total ?? 0);
    if (oldTotal <= 0) continue;

    const pctChange = ((currentTotal - oldTotal) / oldTotal) * 100;
    const absPct = Math.abs(pctChange);

    if (pctChange < 0 && absPct >= THRESHOLDS.ECOSYSTEM_AUM.WARNING_24H) {
      const severity = absPct >= THRESHOLDS.ECOSYSTEM_AUM.CRITICAL_24H ? "critical" : "warning";
      try {
        await prisma.platformAlert.create({
          data: {
            scope: "ecosystem",
            curatorId: null,
            changeType: ALERT_TYPES.ECOSYSTEM_AUM_DROP,
            severity,
            title: severity === "critical" ? "Critical Ecosystem AUM Drop" : "Ecosystem AUM Decline",
            description: `Total platform AUM fell ${absPct.toFixed(1)}% in 24h (${formatCurrency(oldTotal)} → ${formatCurrency(currentTotal)}).`,
            oldValue: formatCurrency(oldTotal),
            newValue: formatCurrency(currentTotal),
            detectedAt: checkpoint,
            metadata: { pctChange, oldTotal, currentTotal, backfilled: true },
            viewed: false,
          },
        });
        stored++;
        log(`  ${checkpoint.toISOString()}: ECOSYSTEM_AUM_DROP ${severity} (${absPct.toFixed(1)}%)`);
      } catch {
        // Duplicate
      }
    }
  }

  return stored;
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

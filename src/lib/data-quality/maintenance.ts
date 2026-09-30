/**
 * Server-side totals hygiene shared by every collector:
 *   - recordSnapshotWritten(): stamp Vault.lastSnapshotAt and set/clear the
 *     'phantom' flag after a snapshot write (recordSnapshotsWritten(): the
 *     same for a batch of vaults in one statement);
 *   - fetchPhantomBaselines(): ~30-day-old snapshots for the phantom test,
 *     one query per run;
 *   - applyExclusionRules(): write the wrapper / bridged / nested /
 *     cross-source / unlisted flags (exclusion-rules.ts);
 *   - updateCuratorStats(): Curator.vaultCount / totalAssetsManaged over
 *     COUNTED vaults only, in one set-based statement;
 *   - ensureTotalsEpoch() / getTotalsEpoch(): the restatement marker that
 *     keeps AUM alerts and digest flows from comparing across a change in the
 *     counting rules.
 * Relative imports: tsx-run collector scripts import this module.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ALERT_TYPES } from "../change-thresholds";
import { staleCutoff } from "./counting";
import { classifyExclusions, type RuleReason } from "./exclusion-rules";
import type { PhantomBaseline } from "./phantom";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Call right after a VaultSnapshot is written. `phantomReason` comes from
 * assessPhantom(): non-null flags the vault 'phantom' (not counted); null
 * clears a previous 'phantom' flag (the next applyExclusionRules() restores
 * any structural reason). Other reasons are left alone.
 */
export async function recordSnapshotWritten(
  vaultId: string,
  phantomReason: string | null,
  at: Date = new Date()
): Promise<void> {
  const phantom = phantomReason !== null;
  await prisma.$executeRaw`
    UPDATE "Vault"
    SET "lastSnapshotAt" = ${at},
        "countInTotals" = CASE WHEN ${phantom} THEN false
                               WHEN "excludeReason" = 'phantom' THEN true
                               ELSE "countInTotals" END,
        "excludeReason" = CASE WHEN ${phantom} THEN 'phantom'
                               WHEN "excludeReason" = 'phantom' THEN NULL
                               ELSE "excludeReason" END
    WHERE id = ${vaultId}
  `;
}

/**
 * Bulk form of recordSnapshotWritten() for collectors that write snapshots in
 * batches: the same stamp and phantom set/clear rules, one UPDATE ... FROM
 * (VALUES ...) statement per 500 vaults instead of one round trip per vault.
 */
export async function recordSnapshotsWritten(
  rows: { vaultId: string; phantomReason: string | null }[],
  at: Date = new Date()
): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const values = Prisma.join(
      rows
        .slice(i, i + 500)
        .map((r) => Prisma.sql`(${r.vaultId}::text, ${r.phantomReason !== null}::boolean)`)
    );
    await prisma.$executeRaw`
      UPDATE "Vault" AS v
      SET "lastSnapshotAt" = ${at},
          "countInTotals" = CASE WHEN d.phantom THEN false
                                 WHEN v."excludeReason" = 'phantom' THEN true
                                 ELSE v."countInTotals" END,
          "excludeReason" = CASE WHEN d.phantom THEN 'phantom'
                                 WHEN v."excludeReason" = 'phantom' THEN NULL
                                 ELSE v."excludeReason" END
      FROM (VALUES ${values}) AS d(id, phantom)
      WHERE v.id = d.id
    `;
  }
}

/**
 * Per vault of one data source: the latest snapshot taken 30–37 days ago.
 * One query per run (a DISTINCT ON over a week of snapshots).
 */
export async function fetchPhantomBaselines(
  dataSource: string,
  now: Date = new Date()
): Promise<Map<string, PhantomBaseline>> {
  const to = new Date(now.getTime() - 30 * DAY_MS);
  const from = new Date(now.getTime() - 37 * DAY_MS);
  const rows = await prisma.$queryRaw<
    { vaultId: string; totalAssets: string; totalSupply: string }[]
  >`
    SELECT DISTINCT ON (s."vaultId") s."vaultId", s."totalAssets", s."totalSupply"
    FROM "VaultSnapshot" s
    JOIN "Vault" v ON v.id = s."vaultId"
    WHERE v."dataSource" = ${dataSource}
      AND s."timestamp" >= ${from} AND s."timestamp" <= ${to}
    ORDER BY s."vaultId", s."timestamp" DESC
  `;
  return new Map(
    rows.map((r) => [r.vaultId, { totalAssets: r.totalAssets, totalSupply: r.totalSupply }])
  );
}

export interface ExclusionRunResult {
  changed: number;
  excludedByReason: Partial<Record<RuleReason, number>>;
}

/**
 * Recompute rule-managed exclusions for every vault and write only the rows
 * whose flag changed. Rows flagged 'phantom' are owned by the collectors and
 * are never touched here.
 */
export async function applyExclusionRules(now: Date = new Date()): Promise<ExclusionRunResult> {
  const rows = await prisma.vault.findMany({
    select: {
      id: true,
      dataSource: true,
      chainId: true,
      curatorId: true,
      active: true,
      listed: true,
      address: true,
      onchainAddress: true,
      onchainSymbol: true,
      symbol: true,
      lastSnapshotAt: true,
      countInTotals: true,
      excludeReason: true,
    },
  });

  const desired = classifyExclusions(rows, staleCutoff(now));
  const toWrite = new Map<string, string[]>(); // reason ("" = counted) -> ids
  const excludedByReason: ExclusionRunResult["excludedByReason"] = {};

  for (const r of rows) {
    if (r.excludeReason === "phantom") continue;
    const reason = desired.get(r.id) ?? null;
    if (reason) excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
    const counted = reason === null;
    if (r.excludeReason === reason && r.countInTotals === counted) continue;
    const key = reason ?? "";
    toWrite.set(key, [...(toWrite.get(key) ?? []), r.id]);
  }

  let changed = 0;
  for (const [key, ids] of toWrite) {
    const reason = key === "" ? null : key;
    const res = await prisma.vault.updateMany({
      // Re-check 'phantom' at write time: a collector may have flagged the row
      // since the read above.
      where: { id: { in: ids }, NOT: { excludeReason: "phantom" } },
      data: { excludeReason: reason, countInTotals: reason === null },
    });
    changed += res.count;
  }
  return { changed, excludedByReason };
}

/**
 * Recompute Curator.vaultCount / totalAssetsManaged in ONE set-based statement
 * over COUNTED vaults only (active, listed, countInTotals, fresh snapshot —
 * the same predicate as countedVaultWhere()). TVL is each counted vault's
 * latest snapshot. Every curator with at least one vault row is written, so a
 * curator whose vaults all stopped counting drops to 0 instead of keeping a
 * stale total. Latest-snapshot lookup is a LATERAL LIMIT 1 on the
 * (vaultId, timestamp) index.
 */
export async function updateCuratorStats(now: Date = new Date()): Promise<number> {
  const cutoff = staleCutoff(now);
  return prisma.$executeRaw`
    UPDATE "Curator" c
    SET "vaultCount" = agg.vault_count,
        "totalAssetsManaged" = agg.total_assets,
        "updatedAt" = NOW()
    FROM (
      SELECT v."curatorId",
             COUNT(latest.tvl)::int AS vault_count,
             COALESCE(SUM(latest.tvl), 0) AS total_assets
      FROM "Vault" v
      LEFT JOIN LATERAL (
        SELECT s."totalAssetsUsd" AS tvl
        FROM "VaultSnapshot" s
        WHERE s."vaultId" = v.id
        ORDER BY s."timestamp" DESC
        LIMIT 1
      ) latest ON v.active AND v.listed AND v."countInTotals"
                  AND v."lastSnapshotAt" >= ${cutoff}
      WHERE v."curatorId" IS NOT NULL
      GROUP BY v."curatorId"
    ) agg
    WHERE c.id = agg."curatorId"
  `;
}

/**
 * End-of-run hygiene for every collector: exclusion flags, then curator stats
 * (stats read the flags). Returns a summary for the run log / cron response.
 */
export async function finalizeCollection(): Promise<ExclusionRunResult & { curatorsUpdated: number }> {
  const now = new Date();
  const exclusions = await applyExclusionRules(now);
  const curatorsUpdated = await updateCuratorStats(now);
  return { ...exclusions, curatorsUpdated };
}

// ── Totals restatement marker ───────────────────────────────────────────────

/**
 * Bump when the counting rules change in a way that moves curator AUM. The
 * first collect run on new rules writes one TOTALS_RESTATED marker; AUM alerts
 * and digest flows ignore baselines older than the latest marker, so a rule
 * change never reads as an outflow.
 */
export const TOTALS_RULES_VERSION = "2026-09-30";

/** Latest restatement time, or null if totals were never restated. */
export async function getTotalsEpoch(): Promise<Date | null> {
  const marker = await prisma.platformAlert.findFirst({
    where: { scope: "ecosystem", changeType: ALERT_TYPES.TOTALS_RESTATED },
    orderBy: { detectedAt: "desc" },
    select: { detectedAt: true },
  });
  return marker?.detectedAt ?? null;
}

/**
 * Write the marker for TOTALS_RULES_VERSION if it is missing; return the
 * epoch. Call before the first CuratorSnapshot computed on the new rules.
 */
export async function ensureTotalsEpoch(): Promise<Date> {
  const existing = await prisma.platformAlert.findFirst({
    where: {
      scope: "ecosystem",
      changeType: ALERT_TYPES.TOTALS_RESTATED,
      metadata: { path: ["version"], equals: TOTALS_RULES_VERSION },
    },
    orderBy: { detectedAt: "desc" },
    select: { detectedAt: true },
  });
  if (existing) return existing.detectedAt;

  const now = new Date();
  await prisma.platformAlert.create({
    data: {
      scope: "ecosystem",
      changeType: ALERT_TYPES.TOTALS_RESTATED,
      severity: "info",
      title: "Totals restated: double counts and stale rows removed",
      description:
        "Vault totals now leave out wrapper tokens, bridged copies, nested deposits, vaults tracked twice, phantom accrual, unlisted vaults and rows with no data for 7+ days. These rows stay visible on their pages. AUM changes are measured from this point.",
      metadata: { version: TOTALS_RULES_VERSION },
      detectedAt: now,
    },
  });
  return now;
}

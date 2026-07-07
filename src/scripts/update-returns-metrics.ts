/**
 * Returns analytics from share-price history (P7 of the coverage roadmap).
 *
 * Computes, per vault, from VaultSnapshot's share-price series:
 *   - 30d / 90d / lifetime share-price return (percent, NOT annualized)
 *   - annualized 90d volatility of daily log returns (percent)
 *   - 90d Sharpe ratio (rf = 0)
 *   - max drawdown over available history (percent, negative)
 *
 * Everything runs as ONE set-based SQL statement — the 2026-07-07 cron
 * timeout taught us per-vault sweeps at connection_limit=1 don't scale.
 *
 * Honesty guards:
 *   - A vault only gets metrics when its share price genuinely moves
 *     (≥5 distinct daily prices). Sources that report a constant price
 *     (Turtle opportunities, funds, HLP) stay NULL — a fake "0% return"
 *     would be worse than no number.
 *   - 90d vol/Sharpe require ≥14 daily observations.
 */

import { prisma } from "../lib/db";

export async function updateReturnsMetrics(): Promise<{ updated: number }> {
  const updated = await prisma.$executeRaw`
    WITH daily AS (
      SELECT "vaultId",
             date_trunc('day', "timestamp") AS d,
             (array_agg("sharePrice" ORDER BY "timestamp" DESC))[1] AS px
      FROM "VaultSnapshot"
      WHERE "timestamp" > now() - interval '400 days'
        AND "sharePrice" > 0
      GROUP BY 1, 2
    ),
    rets AS (
      SELECT "vaultId", d, px,
             ln(px / NULLIF(lag(px) OVER w, 0)) AS lr,
             max(px) OVER (PARTITION BY "vaultId" ORDER BY d
                           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS runmax
      FROM daily
      WINDOW w AS (PARTITION BY "vaultId" ORDER BY d)
    ),
    mov AS (
      SELECT "vaultId", count(DISTINCT px) AS npx FROM daily GROUP BY 1
    ),
    bounds AS (
      SELECT DISTINCT ON ("vaultId") "vaultId", px AS last_px
      FROM daily ORDER BY "vaultId", d DESC
    ),
    p30 AS (
      SELECT DISTINCT ON ("vaultId") "vaultId", px AS px30
      FROM daily WHERE d <= now() - interval '30 days'
      ORDER BY "vaultId", d DESC
    ),
    p90 AS (
      SELECT DISTINCT ON ("vaultId") "vaultId", px AS px90
      FROM daily WHERE d <= now() - interval '90 days'
      ORDER BY "vaultId", d DESC
    ),
    pfirst AS (
      SELECT DISTINCT ON ("vaultId") "vaultId", px AS px0
      FROM daily ORDER BY "vaultId", d ASC
    ),
    vol AS (
      SELECT "vaultId",
             stddev_samp(lr) AS sd90,
             avg(lr) AS mean90,
             count(lr) AS n90
      FROM rets
      WHERE d > now() - interval '90 days' AND lr IS NOT NULL
      GROUP BY 1
    ),
    dd AS (
      SELECT "vaultId", min(px / NULLIF(runmax, 0) - 1) AS max_dd
      FROM rets GROUP BY 1
    ),
    m AS (
      SELECT b."vaultId",
        CASE WHEN mov.npx >= 5 AND p30.px30 > 0 THEN (b.last_px / p30.px30 - 1) * 100 END AS ret30,
        CASE WHEN mov.npx >= 5 AND p90.px90 > 0 THEN (b.last_px / p90.px90 - 1) * 100 END AS ret90,
        CASE WHEN mov.npx >= 5 AND pf.px0 > 0 THEN (b.last_px / pf.px0 - 1) * 100 END AS retlife,
        CASE WHEN mov.npx >= 5 AND v.n90 >= 14 THEN v.sd90 * sqrt(365) * 100 END AS vol90,
        CASE WHEN mov.npx >= 5 AND v.n90 >= 14 AND v.sd90 > 0
             THEN (v.mean90 * 365) / (v.sd90 * sqrt(365)) END AS sharpe90,
        CASE WHEN mov.npx >= 5 THEN dd.max_dd * 100 END AS maxdd
      FROM bounds b
      JOIN mov ON mov."vaultId" = b."vaultId"
      LEFT JOIN p30 ON p30."vaultId" = b."vaultId"
      LEFT JOIN p90 ON p90."vaultId" = b."vaultId"
      LEFT JOIN pfirst pf ON pf."vaultId" = b."vaultId"
      LEFT JOIN vol v ON v."vaultId" = b."vaultId"
      LEFT JOIN dd ON dd."vaultId" = b."vaultId"
    )
    UPDATE "Vault" vt SET
      "ret30dPct" = m.ret30,
      "ret90dPct" = m.ret90,
      "retLifetimePct" = m.retlife,
      "vol90dPct" = m.vol90,
      "sharpe90d" = m.sharpe90,
      "maxDrawdownPct" = m.maxdd
    FROM m
    WHERE m."vaultId" = vt.id
  `;

  return { updated };
}

// CLI entry point
async function main() {
  try {
    const result = await updateReturnsMetrics();
    console.log(`[returns] Updated metrics for ${result.updated} vaults`);
  } catch (error) {
    console.error("[returns] Fatal error:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = require.main === module;
if (isDirectRun) {
  main();
}

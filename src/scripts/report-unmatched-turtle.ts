/**
 * Report Turtle-sourced vaults that are currently unattributed (hidden).
 *
 * These are vaults ingested from the Turtle API that the name-based matcher
 * could not confidently tie to a real curator, so they are left with
 * curatorId = NULL and hidden from the curator directory (rather than minting a
 * synthetic curator). Use this list to add manual mappings in
 * `src/lib/turtle/curator-matcher.ts` (CURATOR_NAME_ALIASES) so they get
 * attributed on the next collection run.
 *
 * Read-only. Usage: npm run report:unmatched-turtle
 */

import { PrismaClient } from "@prisma/client";

// Maintenance scripts use a dedicated DIRECT (non-pooled) connection so they don't
// contend for the pgbouncer session pool the serverless app shares.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  log: ["error"],
});

async function main() {
  const vaults = await prisma.vault.findMany({
    where: { dataSource: "turtle", curatorId: null },
    select: {
      name: true,
      turtleId: true,
      protocol: true,
      assetSymbol: true,
      chainName: true,
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { totalAssetsUsd: true },
      },
    },
  });

  if (vaults.length === 0) {
    console.log("\n[report] No unattributed Turtle vaults. Every Turtle vault is matched to a curator.\n");
    return;
  }

  const rows = vaults
    .map((v) => ({
      name: v.name,
      tvl: v.snapshots[0]?.totalAssetsUsd ?? 0,
      protocol: v.protocol ?? "?",
      asset: v.assetSymbol ?? "?",
      chain: v.chainName ?? "?",
    }))
    .sort((a, b) => b.tvl - a.tvl);

  const totalTvl = rows.reduce((s, r) => s + r.tvl, 0);

  console.log(`\n[report] ${rows.length} unattributed (hidden) Turtle vault(s) — $${(totalTvl / 1e6).toFixed(2)}M total TVL not shown in the directory:\n`);
  for (const r of rows) {
    console.log(`  $${(r.tvl / 1e6).toFixed(2).padStart(7)}M  ${r.name}  [${r.protocol} · ${r.asset} · ${r.chain}]`);
  }
  console.log("\n[report] To attribute any of these, add a mapping in src/lib/turtle/curator-matcher.ts and re-run the Turtle collection.\n");
}

main()
  .catch((e) => {
    console.error("[report] FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * One-off cleanup + promotion of synthetic "turtle-<slug>" curator rows.
 *
 * Background: the old Turtle collector minted a fake Curator row (address
 * "turtle-<slug>") for every Turtle opportunity it couldn't match — protocols,
 * stablecoin issuers, chains, Curve pools, and the Turtle distributor itself —
 * inflating the curator directory and curator TVL by ~$556M.
 *
 * This script reconciles them against the reviewed allowlist
 * (src/lib/turtle/known-curators.ts):
 *   - PROMOTE: synthetic rows whose name resolves to an allowlisted real curator are
 *     folded into a clean `tc:<slug>` curator row (de-duplicated/merged), keeping
 *     their vaults attributed.
 *   - DROP: every other synthetic row is removed; its vaults are set to unattributed
 *     (curatorId = NULL) so they stay in the DB but hidden from the directory
 *     (see `npm run report:unmatched-turtle`).
 *
 * Behaviour:
 *   - DRY RUN by default: prints the full promote/drop plan, writes nothing.
 *   - With `--apply`: archives all affected rows to ./archive/<timestamp>.json
 *     (reversible record), then performs the promotion + cleanup in a transaction.
 *
 * Uses a dedicated DIRECT (non-pooled) connection to avoid the pgbouncer session pool.
 *
 * Usage:
 *   npm run cleanup:synthetic-curators            # dry run
 *   npm run cleanup:synthetic-curators -- --apply
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { resolveKnownCurator, KNOWN_TURTLE_CURATORS } from "../lib/turtle/known-curators";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  log: ["error"],
});

const APPLY = process.argv.includes("--apply");
const M = (n: number) => `$${(n / 1e6).toFixed(2)}M`;

/** Tolerate Supabase pooler saturation (pool_size 15) — retry the connection with backoff. */
async function connectWithRetry(attempts = 6): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (e) {
      const msg = String(e);
      const transient = /max clients|EMAXCONNSESSION|Can't reach|Timed out|ECONNREFUSED/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      const wait = Math.min(2000 * 2 ** i, 30000);
      console.log(`[cleanup] DB busy (pool full), retrying in ${wait / 1000}s… (${i + 1}/${attempts})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  await connectWithRetry();

  console.log(
    `\n[cleanup] Synthetic Turtle curators — ${APPLY ? "APPLY (destructive)" : "DRY RUN (no changes)"}\n`
  );

  const synthetic = await prisma.curator.findMany({
    where: { address: { startsWith: "turtle-" } },
    select: {
      id: true,
      address: true,
      name: true,
      totalAssetsManaged: true,
      vaults: { select: { id: true, name: true, turtleId: true } },
    },
  });

  if (synthetic.length === 0) {
    console.log("[cleanup] No synthetic 'turtle-*' curators found. Nothing to do.\n");
    return;
  }

  // Partition into promote-groups (by allowlist slug) and drops.
  const promoteGroups = new Map<string, { rows: typeof synthetic; vaultIds: string[]; tvl: number }>();
  const drops: typeof synthetic = [];

  for (const row of synthetic) {
    const known = resolveKnownCurator(row.name);
    if (known) {
      const g = promoteGroups.get(known.slug) ?? { rows: [], vaultIds: [], tvl: 0 };
      g.rows.push(row);
      g.vaultIds.push(...row.vaults.map((v) => v.id));
      g.tvl += row.totalAssetsManaged ?? 0;
      promoteGroups.set(known.slug, g);
    } else {
      drops.push(row);
    }
  }

  console.log(`[cleanup] PROMOTE — ${promoteGroups.size} real curators:`);
  for (const [slug, g] of promoteGroups) {
    const known = KNOWN_TURTLE_CURATORS.find((k) => k.slug === slug)!;
    console.log(
      `  + ${known.name} [tc:${slug}] — ${g.vaultIds.length} vault(s), ${M(g.tvl)}  ` +
        `(from: ${g.rows.map((r) => r.name).join(", ")})`
    );
  }

  const dropVaults = drops.reduce((s, r) => s + r.vaults.length, 0);
  const dropTvl = drops.reduce((s, r) => s + (r.totalAssetsManaged ?? 0), 0);
  console.log(`\n[cleanup] DROP — ${drops.length} non-curators, ${dropVaults} vault(s) hidden, ${M(dropTvl)}:`);
  for (const r of drops.sort((a, b) => (b.totalAssetsManaged ?? 0) - (a.totalAssetsManaged ?? 0))) {
    console.log(`  - ${r.name} [${r.address}] — ${r.vaults.length} vault(s), ${M(r.totalAssetsManaged ?? 0)}`);
  }
  console.log("");

  if (!APPLY) {
    console.log("[cleanup] DRY RUN — re-run with `-- --apply` to archive + apply.\n");
    return;
  }

  // Archive (reversible record) before mutating.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = join(process.cwd(), "archive");
  mkdirSync(archiveDir, { recursive: true });
  const archivePath = join(archiveDir, `synthetic-turtle-curators-${stamp}.json`);
  writeFileSync(
    archivePath,
    JSON.stringify(
      {
        generatedAt: stamp,
        promote: Object.fromEntries(promoteGroups),
        drop: drops,
      },
      null,
      2
    )
  );
  console.log(`[cleanup] Archived ${synthetic.length} synthetic curators to ${archivePath}\n`);

  const promotedCuratorIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Promote: upsert clean tc:<slug> curator, reassign matched vaults to it.
    for (const [slug, g] of promoteGroups) {
      const known = KNOWN_TURTLE_CURATORS.find((k) => k.slug === slug)!;
      const curator = await tx.curator.upsert({
        where: { address: `tc:${slug}` },
        update: { name: known.name, website: known.website || undefined },
        create: { address: `tc:${slug}`, name: known.name, website: known.website || undefined },
      });
      promotedCuratorIds.push(curator.id);
      await tx.vault.updateMany({
        where: { id: { in: g.vaultIds } },
        data: { curatorId: curator.id },
      });
    }

    // Drop: unattribute vaults of non-curator synthetic rows.
    const dropVaultIds = drops.flatMap((r) => r.vaults.map((v) => v.id));
    if (dropVaultIds.length > 0) {
      await tx.vault.updateMany({ where: { id: { in: dropVaultIds } }, data: { curatorId: null } });
    }

    // Delete every original synthetic turtle-* row (child rows cascade).
    await tx.curator.deleteMany({ where: { address: { startsWith: "turtle-" } } });
  }, { timeout: 300000, maxWait: 10000 });

  // Recompute promoted curators' aggregate stats from their vaults' latest snapshots.
  for (const id of promotedCuratorIds) {
    const vaults = await prisma.vault.findMany({
      where: { curatorId: id },
      select: { snapshots: { orderBy: { timestamp: "desc" }, take: 1, select: { totalAssetsUsd: true } } },
    });
    const totalAssetsManaged = vaults.reduce((s, v) => s + (v.snapshots[0]?.totalAssetsUsd ?? 0), 0);
    await prisma.curator.update({
      where: { id },
      data: { totalAssetsManaged, vaultCount: vaults.length },
    });
  }

  console.log(
    `[cleanup] Done. Promoted ${promoteGroups.size} curators, dropped ${drops.length}, ` +
      `archived to ${archivePath}.\n`
  );
}

main()
  .catch((e) => {
    console.error("[cleanup] FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

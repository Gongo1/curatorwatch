/**
 * One-off cleanup: remove synthetic "turtle-<slug>" curator rows.
 *
 * Background: the old Turtle collector minted fake Curator rows (address
 * "turtle-<slug>") whenever it couldn't match an opportunity to a real curator.
 * Those synthetic rows polluted the curator directory and inflated curator TVL.
 * The collector no longer creates them (see curator-matcher.ts); this script
 * cleans up the ones already in the database.
 *
 * Behaviour:
 *   - DRY RUN by default: reports exactly what would change, writes nothing.
 *   - With `--apply`: archives the affected rows to ./archive/<timestamp>.json
 *     (reversible record), sets the affected vaults' curatorId to NULL (they
 *     remain in the DB as unattributed/hidden Turtle vaults — see
 *     `npm run report:unmatched-turtle`), then deletes the synthetic curators.
 *     CuratorNews / CuratorSnapshot / PlatformAlert rows cascade-delete.
 *
 * Usage:
 *   npm run cleanup:synthetic-curators           # dry run
 *   npm run cleanup:synthetic-curators -- --apply
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

// Maintenance scripts use a dedicated DIRECT (non-pooled) connection so they don't
// contend for the pgbouncer session pool the serverless app shares.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  log: ["error"],
});

const APPLY = process.argv.includes("--apply");

async function main() {
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
      vaults: { select: { id: true, name: true, address: true, turtleId: true } },
    },
  });

  if (synthetic.length === 0) {
    console.log("[cleanup] No synthetic 'turtle-*' curators found. Nothing to do.\n");
    return;
  }

  const totalVaults = synthetic.reduce((s, c) => s + c.vaults.length, 0);
  const totalFakeAum = synthetic.reduce((s, c) => s + (c.totalAssetsManaged ?? 0), 0);

  console.log(`[cleanup] Found ${synthetic.length} synthetic curators across ${totalVaults} vaults.`);
  console.log(`[cleanup] Inflated curator AUM attributed to them: $${(totalFakeAum / 1e6).toFixed(2)}M`);
  console.log("");
  for (const c of synthetic) {
    console.log(`  - ${c.name ?? "(no name)"} [${c.address}] — ${c.vaults.length} vault(s), $${((c.totalAssetsManaged ?? 0) / 1e6).toFixed(2)}M`);
  }
  console.log("");

  if (!APPLY) {
    console.log("[cleanup] DRY RUN — re-run with `-- --apply` to archive + remove.\n");
    return;
  }

  // Archive (reversible record) before mutating.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = join(process.cwd(), "archive");
  mkdirSync(archiveDir, { recursive: true });
  const archivePath = join(archiveDir, `synthetic-turtle-curators-${stamp}.json`);
  writeFileSync(archivePath, JSON.stringify({ generatedAt: stamp, curators: synthetic }, null, 2));
  console.log(`[cleanup] Archived ${synthetic.length} curators to ${archivePath}`);

  const ids = synthetic.map((c) => c.id);

  // Detach vaults (keep them as unattributed/hidden Turtle vaults), then delete curators.
  const detached = await prisma.vault.updateMany({
    where: { curatorId: { in: ids } },
    data: { curatorId: null },
  });
  console.log(`[cleanup] Set ${detached.count} vaults to unattributed (curatorId = NULL).`);

  const deleted = await prisma.curator.deleteMany({ where: { id: { in: ids } } });
  console.log(`[cleanup] Deleted ${deleted.count} synthetic curators (child rows cascade).\n`);
}

main()
  .catch((e) => {
    console.error("[cleanup] FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

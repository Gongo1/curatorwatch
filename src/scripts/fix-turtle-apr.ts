/**
 * One-time script to fix existing Turtle vault snapshots with inflated APY values.
 *
 * The APR format fix in collect-turtle-data.ts only affects new snapshots.
 * Existing Turtle vault snapshots still have avgNetApy stored as percentages
 * (e.g. 53.69 instead of 0.5369), causing inflated fee calculations.
 *
 * This script divides apy, netApy, avgApy, and avgNetApy by 100 for all
 * snapshots belonging to turtle-sourced vaults where avgNetApy > 1.0.
 *
 * Run with: npx tsx src/scripts/fix-turtle-apr.ts
 */

import { prisma } from "@/lib/db";

async function main() {
  console.log("Finding Turtle-sourced vaults...");

  const turtleVaults = await prisma.vault.findMany({
    where: { dataSource: "turtle" },
    select: { id: true, name: true },
  });

  console.log(`Found ${turtleVaults.length} Turtle-sourced vaults.`);

  if (turtleVaults.length === 0) {
    console.log("No Turtle vaults found. Nothing to fix.");
    await prisma.$disconnect();
    return;
  }

  const vaultIds = turtleVaults.map((v) => v.id);

  // Find all snapshots with inflated APY values (> 1.0 means > 100%, clearly wrong)
  const inflatedSnapshots = await prisma.vaultSnapshot.findMany({
    where: {
      vaultId: { in: vaultIds },
      avgNetApy: { gt: 1.0 },
    },
    select: {
      id: true,
      apy: true,
      netApy: true,
      avgApy: true,
      avgNetApy: true,
    },
  });

  console.log(`Found ${inflatedSnapshots.length} snapshots with inflated APY values.`);

  if (inflatedSnapshots.length === 0) {
    console.log("No inflated snapshots found. Data may already be fixed.");
    await prisma.$disconnect();
    return;
  }

  // Fix in batches
  const BATCH_SIZE = 500;
  let fixedCount = 0;

  for (let i = 0; i < inflatedSnapshots.length; i += BATCH_SIZE) {
    const batch = inflatedSnapshots.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((snap) =>
        prisma.vaultSnapshot.update({
          where: { id: snap.id },
          data: {
            apy: snap.apy != null ? snap.apy / 100 : null,
            netApy: snap.netApy != null ? snap.netApy / 100 : null,
            avgApy: snap.avgApy != null ? snap.avgApy / 100 : null,
            avgNetApy: snap.avgNetApy != null ? snap.avgNetApy / 100 : null,
          },
        })
      )
    );

    fixedCount += batch.length;
    console.log(`  Fixed ${fixedCount} / ${inflatedSnapshots.length} snapshots...`);
  }

  console.log(`\nDone! Fixed ${fixedCount} Turtle vault snapshots.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error fixing Turtle APR data:", err);
  prisma.$disconnect();
  process.exit(1);
});

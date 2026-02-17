import { prisma } from "../lib/db";

/**
 * Backfill USD values for transactions that have shares but no assetsUsd.
 * Uses the vault's current/latest snapshot price data to calculate values.
 *
 * Key insight: ERC4626 vaults use 18 decimals for shares, but the underlying
 * asset may have different decimals (e.g., 6 for USDC).
 */

const SHARE_DECIMALS = 18; // ERC4626 standard

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function main() {
  log("Starting transaction USD backfill...");

  // Find all vaults with transactions
  const vaults = await prisma.vault.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      assetDecimals: true,
    },
  });

  log(`Found ${vaults.length} vaults to process`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const vault of vaults) {
    // Get latest snapshot for price data
    const snapshot = await prisma.vaultSnapshot.findFirst({
      where: { vaultId: vault.id },
      orderBy: { timestamp: "desc" },
      select: {
        sharePrice: true,
        totalAssets: true,
        totalAssetsUsd: true,
      },
    });

    if (!snapshot || !snapshot.totalAssetsUsd || !snapshot.totalAssets) {
      log(`  Skipping ${vault.name}: no snapshot data`);
      continue;
    }

    // Find ALL transactions to recalculate (not just null ones)
    const transactions = await prisma.vaultTransaction.findMany({
      where: {
        vaultId: vault.id,
        shares: { not: null },
      },
      select: {
        id: true,
        shares: true,
        type: true,
      },
    });

    if (transactions.length === 0) {
      continue;
    }

    log(`  ${vault.name}: ${transactions.length} transactions to update`);

    // Calculate asset price per token in USD
    const totalAssetsNum = parseFloat(snapshot.totalAssets);
    const assetDivisor = Math.pow(10, vault.assetDecimals);
    const totalAssetsHuman = totalAssetsNum / assetDivisor;
    const assetPriceUsd = snapshot.totalAssetsUsd / totalAssetsHuman;

    let vaultUpdated = 0;

    for (const tx of transactions) {
      if (!tx.shares) {
        totalSkipped++;
        continue;
      }

      try {
        const sharesNum = parseFloat(tx.shares);
        if (sharesNum === 0) {
          totalSkipped++;
          continue;
        }

        // Convert shares from raw to human-readable (18 decimals)
        const shareDivisor = Math.pow(10, SHARE_DECIMALS);
        const sharesHuman = sharesNum / shareDivisor;

        // Convert shares to assets using sharePrice
        const assetsHuman = sharesHuman * snapshot.sharePrice;

        // Calculate USD value
        const assetsUsd = Math.abs(assetsHuman * assetPriceUsd);

        // Store assets in raw units (with asset decimals)
        const assetsRaw = assetsHuman * assetDivisor;

        // Update transaction
        await prisma.vaultTransaction.update({
          where: { id: tx.id },
          data: {
            assets: assetsRaw.toString(),
            assetsUsd,
          },
        });

        vaultUpdated++;
      } catch (error) {
        log(`    Error updating tx ${tx.id}: ${error}`);
        totalSkipped++;
      }
    }

    totalUpdated += vaultUpdated;
    log(`    Updated ${vaultUpdated} transactions`);
  }

  log("-".repeat(50));
  log(`Backfill complete!`);
  log(`  Total updated: ${totalUpdated}`);
  log(`  Total skipped: ${totalSkipped}`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

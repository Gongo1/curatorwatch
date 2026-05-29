/**
 * One-time migration script: Merge multi-address curators
 *
 * Consolidates KPK (5 addresses), Gauntlet (2), and Morpho (2) into
 * one Curator record each by reassigning vaults/news to the primary address
 * and deleting the now-empty alias curator records.
 *
 * Usage: npx tsx src/scripts/merge-curators.ts
 */

import { PrismaClient } from "@prisma/client";
import { CURATOR_ALIAS_GROUPS } from "../lib/curator-aliases";

const prisma = new PrismaClient();

function log(msg: string) {
  console.log(`[merge-curators] ${msg}`);
}

async function main() {
  log("Starting curator merge...");

  for (const group of CURATOR_ALIAS_GROUPS) {
    log(`\n=== Processing ${group.curatorName} ===`);
    log(`  Primary: ${group.primaryAddress}`);
    log(`  Aliases: ${group.aliasAddresses.join(", ")}`);

    await prisma.$transaction(async (tx) => {
      // Find primary curator
      const primary = await tx.curator.findUnique({
        where: { address: group.primaryAddress },
      });

      if (!primary) {
        log(`  WARNING: Primary curator not found (${group.primaryAddress}), skipping group`);
        return;
      }

      log(`  Primary curator found: id=${primary.id}, name=${primary.name}`);

      for (const aliasAddr of group.aliasAddresses) {
        const alias = await tx.curator.findUnique({
          where: { address: aliasAddr },
          include: { vaults: true, news: true },
        });

        if (!alias) {
          log(`  Alias ${aliasAddr} not found in DB, skipping`);
          continue;
        }

        log(`  Processing alias: id=${alias.id}, name=${alias.name}, vaults=${alias.vaults.length}, news=${alias.news.length}`);

        // Reassign vaults from alias to primary
        if (alias.vaults.length > 0) {
          const result = await tx.vault.updateMany({
            where: { curatorId: alias.id },
            data: { curatorId: primary.id },
          });
          log(`    Reassigned ${result.count} vault(s) to primary`);
        }

        // Reassign news from alias to primary
        if (alias.news.length > 0) {
          const result = await tx.curatorNews.updateMany({
            where: { curatorId: alias.id },
            data: { curatorId: primary.id },
          });
          log(`    Reassigned ${result.count} news item(s) to primary`);
        }

        // Merge profile fields: fill empty fields on primary from alias
        const profileFields = [
          "name", "website", "twitter", "discord", "email",
          "legalName", "entityType", "jurisdiction", "registeredState",
          "headquarters", "description", "foundedYear", "teamSize",
          "isRegulated", "regulatoryBody", "licenses", "logoUrl",
        ] as const;

        const updates: Record<string, unknown> = {};
        for (const field of profileFields) {
          const primaryVal = primary[field];
          const aliasVal = alias[field];
          if (
            (primaryVal === null || primaryVal === undefined || primaryVal === "") &&
            aliasVal !== null &&
            aliasVal !== undefined &&
            aliasVal !== ""
          ) {
            updates[field] = aliasVal;
          }
        }

        if (Object.keys(updates).length > 0) {
          await tx.curator.update({
            where: { id: primary.id },
            data: updates,
          });
          log(`    Merged profile fields: ${Object.keys(updates).join(", ")}`);
        }

        // Delete the now-empty alias curator
        await tx.curator.delete({ where: { id: alias.id } });
        log(`    Deleted alias curator ${alias.id}`);
      }

      // Recalculate vaultCount and totalAssetsManaged on primary
      const vaults = await tx.vault.findMany({
        where: { curatorId: primary.id },
        include: {
          snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
        },
      });

      const totalAssets = vaults.reduce((sum, v) => {
        return sum + (v.snapshots[0]?.totalAssetsUsd ?? 0);
      }, 0);

      await tx.curator.update({
        where: { id: primary.id },
        data: {
          vaultCount: vaults.length,
          totalAssetsManaged: totalAssets,
        },
      });

      log(`  Updated primary: vaultCount=${vaults.length}, totalAssetsManaged=$${totalAssets.toLocaleString()}`);
    }, { timeout: 300000, maxWait: 10000 });
  }

  log("\nMerge complete!");
}

main()
  .catch((e) => {
    console.error("Merge failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

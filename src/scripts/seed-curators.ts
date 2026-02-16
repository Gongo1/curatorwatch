/**
 * Seed curator profiles and news into the database
 * Run with: npx tsx src/scripts/seed-curators.ts
 */

import { prisma } from "@/lib/db";
import { CURATOR_PROFILES, CURATOR_NEWS } from "@/lib/curator-data";
import { ENRICHED_CURATORS } from "@/lib/curator-enrichment";

async function seedCurators() {
  console.log("Starting curator data seeding...\n");

  let curatorCount = 0;
  let newsCount = 0;
  let enrichedCount = 0;

  // Seed enriched curator profiles first
  console.log("Seeding enriched curator profiles...");
  for (const curator of ENRICHED_CURATORS) {
    try {
      const normalizedAddress = curator.address.toLowerCase();

      await prisma.curator.upsert({
        where: { address: normalizedAddress },
        update: {
          name: curator.name,
          website: curator.website || null,
          twitter: curator.twitter || null,
          discord: curator.discord || null,
          description: curator.description || null,
          entityType: curator.entityType || null,
          jurisdiction: curator.jurisdiction || null,
          headquarters: curator.headquarters || null,
          foundedYear: curator.foundedYear || null,
          teamSize: curator.teamSize || null,
          isRegulated: curator.isRegulated ?? false,
          regulatoryBody: curator.regulatoryBody || null,
          logoUrl: curator.logoUrl || null,
          updatedAt: new Date(),
        },
        create: {
          address: normalizedAddress,
          name: curator.name,
          website: curator.website || null,
          twitter: curator.twitter || null,
          discord: curator.discord || null,
          description: curator.description || null,
          entityType: curator.entityType || null,
          jurisdiction: curator.jurisdiction || null,
          headquarters: curator.headquarters || null,
          foundedYear: curator.foundedYear || null,
          teamSize: curator.teamSize || null,
          isRegulated: curator.isRegulated ?? false,
          regulatoryBody: curator.regulatoryBody || null,
          logoUrl: curator.logoUrl || null,
        },
      });

      console.log(`✓ Enriched: ${curator.name}`);
      enrichedCount++;
    } catch (error) {
      console.error(`✗ Failed to seed enriched curator ${curator.name}:`, error);
    }
  }

  // Seed curator profiles from CURATOR_PROFILES
  console.log("\nSeeding CURATOR_PROFILES...");
  for (const [address, profile] of Object.entries(CURATOR_PROFILES)) {
    try {
      const curator = await prisma.curator.upsert({
        where: { address: address.toLowerCase() },
        update: {
          name: profile.name,
          website: profile.website,
          twitter: profile.twitter,
          discord: profile.discord,
          email: profile.email,
          legalName: profile.legalName,
          entityType: profile.entityType,
          jurisdiction: profile.jurisdiction,
          registeredState: profile.registeredState,
          headquarters: profile.headquarters,
          description: profile.description,
          foundedYear: profile.foundedYear,
          teamSize: profile.teamSize,
          isRegulated: profile.isRegulated ?? false,
          regulatoryBody: profile.regulatoryBody,
          licenses: profile.licenses,
          logoUrl: profile.logoUrl,
          updatedAt: new Date(),
        },
        create: {
          address: address.toLowerCase(),
          name: profile.name,
          website: profile.website,
          twitter: profile.twitter,
          discord: profile.discord,
          email: profile.email,
          legalName: profile.legalName,
          entityType: profile.entityType,
          jurisdiction: profile.jurisdiction,
          registeredState: profile.registeredState,
          headquarters: profile.headquarters,
          description: profile.description,
          foundedYear: profile.foundedYear,
          teamSize: profile.teamSize,
          isRegulated: profile.isRegulated ?? false,
          regulatoryBody: profile.regulatoryBody,
          licenses: profile.licenses,
          logoUrl: profile.logoUrl,
        },
      });

      console.log(`✓ Curator: ${curator.name || address}`);
      curatorCount++;
    } catch (error) {
      console.error(`✗ Failed to seed curator ${address}:`, error);
    }
  }

  // Seed curator news
  for (const newsItem of CURATOR_NEWS) {
    try {
      // Find the curator
      const curator = await prisma.curator.findUnique({
        where: { address: newsItem.curatorAddress.toLowerCase() },
      });

      if (!curator) {
        console.warn(`  Skipping news - curator not found: ${newsItem.curatorAddress}`);
        continue;
      }

      // Check if news item already exists (by URL)
      const existingNews = await prisma.curatorNews.findFirst({
        where: {
          curatorId: curator.id,
          url: newsItem.url,
        },
      });

      if (existingNews) {
        console.log(`  Skipping existing news: ${newsItem.title.slice(0, 50)}...`);
        continue;
      }

      await prisma.curatorNews.create({
        data: {
          curatorId: curator.id,
          title: newsItem.title,
          summary: newsItem.summary,
          url: newsItem.url,
          source: newsItem.source,
          publishedAt: newsItem.publishedAt,
          sentiment: newsItem.sentiment,
          category: newsItem.category,
        },
      });

      console.log(`  ✓ News: ${newsItem.title.slice(0, 50)}...`);
      newsCount++;
    } catch (error) {
      console.error(`  ✗ Failed to seed news:`, error);
    }
  }

  // Link existing vaults to curators
  console.log("\nLinking vaults to curators...");

  const vaults = await prisma.vault.findMany({
    where: {
      curatorAddress: { not: null },
      curatorId: null,
    },
    select: {
      id: true,
      name: true,
      curatorAddress: true,
    },
  });

  let linkedCount = 0;
  for (const vault of vaults) {
    if (!vault.curatorAddress) continue;

    const curator = await prisma.curator.findUnique({
      where: { address: vault.curatorAddress.toLowerCase() },
    });

    if (curator) {
      await prisma.vault.update({
        where: { id: vault.id },
        data: { curatorId: curator.id },
      });
      console.log(`  ✓ Linked: ${vault.name} → ${curator.name}`);
      linkedCount++;
    }
  }

  // Update curator stats
  console.log("\nUpdating curator stats...");

  const curators = await prisma.curator.findMany();

  for (const curator of curators) {
    const stats = await prisma.vault.aggregate({
      where: { curatorId: curator.id },
      _count: { id: true },
    });

    // Get total assets from latest snapshots
    const vaultIds = await prisma.vault.findMany({
      where: { curatorId: curator.id },
      select: { id: true },
    });

    let totalAssets = 0;
    for (const { id } of vaultIds) {
      const snapshot = await prisma.vaultSnapshot.findFirst({
        where: { vaultId: id },
        orderBy: { timestamp: "desc" },
        select: { totalAssetsUsd: true },
      });
      if (snapshot) {
        totalAssets += snapshot.totalAssetsUsd;
      }
    }

    await prisma.curator.update({
      where: { id: curator.id },
      data: {
        vaultCount: stats._count.id,
        totalAssetsManaged: totalAssets,
      },
    });

    if (stats._count.id > 0) {
      console.log(`  ✓ ${curator.name}: ${stats._count.id} vaults, $${(totalAssets / 1e6).toFixed(2)}M TVL`);
    }
  }

  console.log("\n========================================");
  console.log(`Seeding complete!`);
  console.log(`  Enriched curators: ${enrichedCount}`);
  console.log(`  Profile curators: ${curatorCount}`);
  console.log(`  News items: ${newsCount}`);
  console.log(`  Vaults linked: ${linkedCount}`);
  console.log("========================================\n");
}

seedCurators()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

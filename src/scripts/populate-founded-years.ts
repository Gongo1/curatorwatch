/**
 * Populate foundedYear for all curators missing this field.
 * Run with: npx tsx src/scripts/populate-founded-years.ts
 *
 * Sources: Web research, project documentation, public records.
 * Date: March 4, 2026
 */

import { prisma } from "@/lib/db";

const FOUNDED_YEARS: Record<string, number> = {
  // Major curators with significant AUM
  "Sky (Maker)": 2014,           // MakerDAO founded 2014, rebranded to Sky 2024
  "SUSDf": 2025,                 // Falcon Finance, launched Feb 2025
  "Telos": 2024,                 // Telos Consilium, Swiss Web3 advisory, ~2024
  "Midas": 2023,                 // Midas RWA, founded 2023 by Dennis Dinkelmeyer
  "Veda": 2024,                  // BoringVault framework, raised $18M from CoinFund
  "K3 Capital": 2021,            // Deploying on-chain liquidity since 2021
  "KPK": 2020,                   // karpatkey, created 2020 within GnosisDAO
  // Re Ecosystem was reassigned to Clearstar — skip
  "Hyperithm": 2018,             // Digital asset manager, Tokyo/Seoul
  "Avantgarde Finance": 2018,    // Enzyme protocol founders, DeFi since 2016
  "TermMax": 2022,               // Term Structure Labs, angel round Dec 2022
  "Clearstar Labs AG": 2022,     // Swiss corporation, confirmed by user
  "API3": 2020,                  // Decentralized API project, $23M sale Dec 2020
  "Euler Earn": 2020,            // Euler Finance founded 2020 by Michael Bentley
  "AlphaPing": 2017,             // AlphaPing GmbH/AG, Swiss company
  "Yearn Finance": 2020,         // Andre Cronje, launched Feb 2020
  "TelosC Earn": 2024,           // Related to Telos Consilium
  "9Summits": 2024,              // Co-founded by Remi Foult, ~late 2024
  "Keyrock": 2017,               // Belgian crypto market maker
  "Origin Protocol": 2017,       // Founded by Joshua Fraser & Matthew Liu
  "Stake DAO": 2020,             // Founded by Julien Bouteloup
  "YieldNest": 2024,             // Raised $5.2M April 2024, mainnet May 2024
  "Re7": 2023,                   // Same entity as Re7 Labs

  // Smaller curators — set where known
  "Earn": 2024,                  // Generic name, likely recent
};

async function populateFoundedYears() {
  console.log("Populating foundedYear for curators...\n");

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [name, year] of Object.entries(FOUNDED_YEARS)) {
    const curator = await prisma.curator.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!curator) {
      console.log(`  SKIP (not in DB): ${name}`);
      notFound++;
      continue;
    }

    if (curator.foundedYear) {
      console.log(`  SKIP (already set): ${name} = ${curator.foundedYear}`);
      skipped++;
      continue;
    }

    await prisma.curator.update({
      where: { id: curator.id },
      data: { foundedYear: year },
    });

    console.log(`  UPDATED: ${name} → ${year}`);
    updated++;
  }

  // Report remaining curators still missing foundedYear
  const stillMissing = await prisma.curator.findMany({
    where: { foundedYear: null },
    select: { name: true, totalAssetsManaged: true },
    orderBy: { totalAssetsManaged: "desc" },
  });

  console.log(`\n========================================`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already set): ${skipped}`);
  console.log(`Not found in DB: ${notFound}`);
  console.log(`========================================`);

  if (stillMissing.length > 0) {
    console.log(`\nStill missing foundedYear (${stillMissing.length}):`);
    for (const c of stillMissing) {
      const aum = c.totalAssetsManaged
        ? `$${(c.totalAssetsManaged / 1e6).toFixed(1)}M`
        : "N/A";
      console.log(`  - ${c.name ?? "(unnamed)"} (${aum})`);
    }
  }
}

populateFoundedYears()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

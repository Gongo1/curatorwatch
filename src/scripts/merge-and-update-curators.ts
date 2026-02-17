import { prisma } from "../lib/db";

/**
 * Merge duplicate curators and update profiles with metadata.
 *
 * This script:
 * 1. Merges curators that represent the same entity (e.g., multiple Gauntlet addresses)
 * 2. Updates curator profiles with website, logo, regulatory info
 */

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Curator profile data - map curator names/patterns to profile info
// Keys are patterns to match against curator names (case insensitive)
const CURATOR_PROFILES: Record<
  string,
  {
    canonicalName: string;
    website?: string;
    twitter?: string;
    logoUrl?: string;
    entityType?: string;
    jurisdiction?: string;
    isRegulated?: boolean;
    description?: string;
  }
> = {
  gauntlet: {
    canonicalName: "Gauntlet",
    website: "https://gauntlet.network",
    twitter: "gaaboratory",
    logoUrl: "https://pbs.twimg.com/profile_images/1724820942432641024/bnbPVQxb_400x400.jpg",
    entityType: "Corporation",
    jurisdiction: "United States",
    isRegulated: false,
    description: "DeFi risk management and optimization platform",
  },
  steakhouse: {
    canonicalName: "Steakhouse Financial",
    website: "https://steakhouse.financial",
    twitter: "SteskhouseFi",
    logoUrl: "https://pbs.twimg.com/profile_images/1584206807756890112/J8Chzjkg_400x400.jpg",
    entityType: "DAO",
    jurisdiction: "Cayman Islands",
    isRegulated: false,
    description: "DeFi treasury and risk management",
  },
  "re7": {
    canonicalName: "Re7 Labs",
    website: "https://re7.capital",
    twitter: "Re7Capital",
    logoUrl: "https://pbs.twimg.com/profile_images/1626291169431977988/UZZvzqsy_400x400.jpg",
    entityType: "LLC",
    jurisdiction: "United States",
    isRegulated: false,
    description: "DeFi yield optimization and risk management",
  },
  kpk: {
    canonicalName: "KPK",
    website: "https://kpk.fi",
    twitter: "kpk_fi",
    entityType: "DAO",
    isRegulated: false,
  },
  sentora: {
    canonicalName: "Sentora",
    website: "https://sentora.xyz",
    twitter: "sentoraXYZ",
    entityType: "Corporation",
    isRegulated: false,
    description: "Institutional DeFi yield optimization",
  },
  august: {
    canonicalName: "August Digital",
    website: "https://august.digital",
    twitter: "augustdigital_",
    entityType: "Corporation",
    isRegulated: false,
  },
  yearn: {
    canonicalName: "Yearn Finance",
    website: "https://yearn.fi",
    twitter: "yeaboratory",
    logoUrl: "https://pbs.twimg.com/profile_images/1750600695538130944/AxWpOlBz_400x400.jpg",
    entityType: "DAO",
    isRegulated: false,
    description: "DeFi yield aggregator and optimization",
  },
  gtsy: {
    canonicalName: "Gtsy",
    entityType: "Individual",
    isRegulated: false,
  },
  avantgarde: {
    canonicalName: "Avantgarde Finance",
    website: "https://avantgarde.finance",
    twitter: "avaboratoryfi",
    entityType: "Corporation",
    jurisdiction: "Switzerland",
    isRegulated: false,
  },
  api3: {
    canonicalName: "API3",
    website: "https://api3.org",
    twitter: "API3DAO",
    entityType: "DAO",
    isRegulated: false,
    description: "Decentralized APIs for Web3",
  },
  clearstar: {
    canonicalName: "Clearstar",
    entityType: "Corporation",
    isRegulated: false,
  },
  "mev capital": {
    canonicalName: "MEV Capital",
    website: "https://mev.capital",
    twitter: "maboratoryital",
    entityType: "LLC",
    isRegulated: false,
  },
  "idle finance": {
    canonicalName: "Idle Finance",
    website: "https://idle.finance",
    twitter: "idlefinance",
    entityType: "DAO",
    isRegulated: false,
  },
  hashflow: {
    canonicalName: "Hashflow",
    website: "https://hashflow.com",
    twitter: "hashaboratory",
    entityType: "Corporation",
    isRegulated: false,
  },
  superform: {
    canonicalName: "Superform",
    website: "https://superform.xyz",
    twitter: "superaboratoryabs",
    entityType: "Corporation",
    isRegulated: false,
  },
  spark: {
    canonicalName: "Spark Protocol",
    website: "https://spark.fi",
    twitter: "SparkDAO",
    entityType: "DAO",
    isRegulated: false,
  },
  morpho: {
    canonicalName: "Morpho",
    website: "https://morpho.org",
    twitter: "morphoaboratorybs",
    logoUrl: "https://pbs.twimg.com/profile_images/1810286020266557441/IM7RH5MH_400x400.jpg",
    entityType: "DAO",
    jurisdiction: "France",
    isRegulated: false,
    description: "Decentralized lending protocol",
  },
  hyperithm: {
    canonicalName: "Hyperithm",
    entityType: "Corporation",
    isRegulated: false,
  },
  keyrock: {
    canonicalName: "Keyrock",
    website: "https://keyrock.eu",
    twitter: "KeyrockTrading",
    entityType: "Corporation",
    jurisdiction: "Belgium",
    isRegulated: true,
    description: "Digital asset market maker",
  },
  "stake dao": {
    canonicalName: "Stake DAO",
    website: "https://stakedao.org",
    twitter: "StakeDAOHQ",
    entityType: "DAO",
    isRegulated: false,
  },
  sky: {
    canonicalName: "Sky (Maker)",
    website: "https://sky.money",
    twitter: "SkyEcosystem",
    entityType: "DAO",
    isRegulated: false,
    description: "Decentralized stablecoin ecosystem",
  },
  alpha: {
    canonicalName: "Alpha Finance",
    entityType: "Corporation",
    isRegulated: false,
  },
  nuwealth: {
    canonicalName: "NuWealth",
    entityType: "Corporation",
    isRegulated: false,
  },
};

// Curators to merge - map secondary addresses to primary address
// Format: { secondaryAddress: primaryAddress }
// Primary is chosen based on highest AUM
const CURATOR_MERGES: Record<string, string> = {
  // Gauntlet - merge 0x1b0448bf ($0.76M) into 0x9e33faae ($193.62M)
  "0x1b0448bf6bd7ef8165a6350191d7338f5c2464f4":
    "0x9e33faae38ff641094fa68c65c2ce600b3410585",
  // Kpk - merge all into 0xc266b118 ($12.08M highest)
  "0xf8182e5827c06a47a985ec565a3bcd56437a97be":
    "0xc266b1181a80e84edc2c6596718e88e8115c1eaa",
  "0xd15f11b334e1e233127302e5f759c17da1260df5":
    "0xc266b1181a80e84edc2c6596718e88e8115c1eaa",
  "0x7e43df1c1c5a2245858b60d4655fda83704e4171":
    "0xc266b1181a80e84edc2c6596718e88e8115c1eaa",
  "0xe5aec7d0e795456f90cebefba56470f0e5dfc075":
    "0xc266b1181a80e84edc2c6596718e88e8115c1eaa",
  // Re7 - merge into Re7 Labs 0x72882eb5 ($38.26M)
  "0xe86399fe6d7007fdecb08a2ee1434ee677a04433":
    "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef",
  "0x1a0c993c6ea68e2c64a74a19c4e6ff4a2a98e70e":
    "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef",
  // Steakhouse - merge empty one into main
  "0x8bcf5b1e6b76e55e9b5db6b6e6f0e8b8e6d4e6c4":
    "0x827e86072b06674a077f592a531dce4590adecdb",
  // Idle Finance - merge into first one (both empty)
  "0xb27dc8b0e23d6a489fd52f8a37eb5a4a7c27c3b8":
    "0xfff5a9eb4806d3aaff945f757f4a98a7b39c0f3c",
  // MEV Capital - merge into first one (both empty)
  "0x6abfd6139c7c3cc270ee2ce132e309f59cadaaf6":
    "0x38989bba00bdf8181f4082995b3deae96163ac5d",
};

async function findMatchingProfile(
  curatorName: string | null
): Promise<(typeof CURATOR_PROFILES)[string] | null> {
  if (!curatorName) return null;

  const nameLower = curatorName.toLowerCase();
  for (const [pattern, profile] of Object.entries(CURATOR_PROFILES)) {
    if (nameLower.includes(pattern.toLowerCase())) {
      return profile;
    }
  }
  return null;
}

async function mergeCurators() {
  log("Starting curator merge process...");

  for (const [secondaryAddress, primaryAddress] of Object.entries(
    CURATOR_MERGES
  )) {
    const secondary = await prisma.curator.findUnique({
      where: { address: secondaryAddress.toLowerCase() },
      include: { vaults: true },
    });

    if (!secondary) {
      log(`  Secondary curator ${secondaryAddress.slice(0, 10)} not found, skipping`);
      continue;
    }

    const primary = await prisma.curator.findUnique({
      where: { address: primaryAddress.toLowerCase() },
    });

    if (!primary) {
      log(`  Primary curator ${primaryAddress.slice(0, 10)} not found, skipping`);
      continue;
    }

    // Move all vaults from secondary to primary
    if (secondary.vaults.length > 0) {
      await prisma.vault.updateMany({
        where: { curatorId: secondary.id },
        data: { curatorId: primary.id },
      });
      log(
        `  Moved ${secondary.vaults.length} vaults from ${secondary.name || secondary.address.slice(0, 10)} to ${primary.name || primary.address.slice(0, 10)}`
      );
    }

    // Delete secondary curator
    await prisma.curator.delete({
      where: { id: secondary.id },
    });
    log(`  Deleted duplicate curator: ${secondary.name || secondary.address.slice(0, 10)}`);
  }

  log("Curator merge complete");
}

async function updateCuratorProfiles() {
  log("Starting curator profile updates...");

  const curators = await prisma.curator.findMany({
    select: { id: true, name: true, address: true, website: true },
  });

  let updated = 0;

  for (const curator of curators) {
    const profile = await findMatchingProfile(curator.name);

    if (profile) {
      // Update curator with profile data
      await prisma.curator.update({
        where: { id: curator.id },
        data: {
          name: profile.canonicalName, // Use canonical name
          website: profile.website || curator.website,
          twitter: profile.twitter,
          logoUrl: profile.logoUrl,
          entityType: profile.entityType,
          jurisdiction: profile.jurisdiction,
          isRegulated: profile.isRegulated ?? false,
          description: profile.description,
        },
      });
      log(`  Updated: ${profile.canonicalName}`);
      updated++;
    }
  }

  log(`Updated ${updated} curator profiles`);
}

async function updateCuratorStats() {
  log("Updating curator statistics...");

  const curators = await prisma.curator.findMany({
    select: { id: true, name: true, address: true },
  });

  for (const curator of curators) {
    // Count vaults
    const vaultCount = await prisma.vault.count({
      where: { curatorId: curator.id },
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
        vaultCount,
        totalAssetsManaged: totalAssets,
      },
    });
  }

  log("Curator stats updated");
}

async function main() {
  log("=" .repeat(60));
  log("Curator Merge and Profile Update Script");
  log("=" .repeat(60));

  try {
    // Step 1: Merge duplicate curators
    await mergeCurators();

    // Step 2: Update curator profiles
    await updateCuratorProfiles();

    // Step 3: Recalculate curator stats
    await updateCuratorStats();

    log("=" .repeat(60));
    log("All updates complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

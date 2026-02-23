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
// Helper to generate logo URL from Twitter/X handle using unavatar.io
// This service dynamically fetches current profile images - URLs never go stale
function getTwitterLogo(handle: string): string {
  return `https://unavatar.io/x/${handle}`;
}

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
    twitter: "gauntlet_xyz",
    logoUrl: getTwitterLogo("gauntlet_xyz"),
    entityType: "Corporation",
    jurisdiction: "United States",
    isRegulated: false,
    description: "DeFi risk management and optimization platform",
  },
  steakhouse: {
    canonicalName: "Steakhouse Financial",
    website: "https://steakhouse.financial",
    twitter: "SteskhouseFi",
    logoUrl: getTwitterLogo("SteakhouseFi"),
    entityType: "DAO",
    jurisdiction: "Cayman Islands",
    isRegulated: false,
    description: "DeFi treasury and risk management",
  },
  "re7": {
    canonicalName: "Re7 Labs",
    website: "https://re7.capital",
    twitter: "Re7Capital",
    logoUrl: getTwitterLogo("Re7Capital"),
    entityType: "LLC",
    jurisdiction: "United States",
    isRegulated: false,
    description: "DeFi yield optimization and risk management",
  },
  kpk: {
    canonicalName: "KPK",
    website: "https://kpk.fi",
    twitter: "kpk_fi",
    logoUrl: getTwitterLogo("kpk_fi"),
    entityType: "DAO",
    isRegulated: false,
  },
  sentora: {
    canonicalName: "Sentora",
    website: "https://sentora.xyz",
    twitter: "SentoraHQ",
    logoUrl: getTwitterLogo("SentoraHQ"),
    entityType: "Corporation",
    isRegulated: false,
    description: "Institutional DeFi yield optimization",
  },
  august: {
    canonicalName: "August Digital",
    website: "https://august.digital",
    twitter: "augustdigital_",
    logoUrl: getTwitterLogo("augustdigital_"),
    entityType: "Corporation",
    isRegulated: false,
  },
  yearn: {
    canonicalName: "Yearn Finance",
    website: "https://yearn.fi",
    twitter: "yeaboratory",
    logoUrl: getTwitterLogo("yeaboratory"),
    entityType: "DAO",
    isRegulated: false,
    description: "DeFi yield aggregator and optimization",
  },
  gtsy: {
    canonicalName: "Gtsy",
    twitter: "gtsy__",
    logoUrl: getTwitterLogo("gtsy__"),
    entityType: "Individual",
    isRegulated: false,
  },
  avantgarde: {
    canonicalName: "Avantgarde Finance",
    website: "https://avantgarde.finance",
    twitter: "AvantGardeFi",
    logoUrl: getTwitterLogo("AvantGardeFi"),
    entityType: "Corporation",
    jurisdiction: "Switzerland",
    isRegulated: false,
  },
  api3: {
    canonicalName: "API3",
    website: "https://api3.org",
    twitter: "API3DAO",
    logoUrl: getTwitterLogo("API3DAO"),
    entityType: "DAO",
    isRegulated: false,
    description: "Decentralized APIs for Web3",
  },
  "re ecosystem": {
    canonicalName: "Re Ecosystem",
    entityType: "Corporation",
    isRegulated: false,
  },
  clearstar: {
    canonicalName: "Clearstar Labs AG",
    twitter: "ClearstarFi",
    logoUrl: getTwitterLogo("ClearstarFi"),
    entityType: "Corporation",
    jurisdiction: "Switzerland",
    isRegulated: false,
  },
  "mev capital": {
    canonicalName: "MEV Capital",
    website: "https://mev.capital",
    twitter: "MEVCapital",
    logoUrl: getTwitterLogo("MEVCapital"),
    entityType: "LLC",
    isRegulated: false,
  },
  "idle finance": {
    canonicalName: "Idle Finance",
    website: "https://idle.finance",
    twitter: "idlefinance",
    logoUrl: getTwitterLogo("idlefinance"),
    entityType: "DAO",
    isRegulated: false,
  },
  hashflow: {
    canonicalName: "Hashflow",
    website: "https://hashflow.com",
    twitter: "hashaboratory",
    logoUrl: getTwitterLogo("hashaboratory"),
    entityType: "Corporation",
    isRegulated: false,
  },
  superform: {
    canonicalName: "Superform",
    website: "https://superform.xyz",
    twitter: "superaboratoryabs",
    logoUrl: getTwitterLogo("superaboratoryabs"),
    entityType: "Corporation",
    isRegulated: false,
  },
  spark: {
    canonicalName: "Spark Protocol",
    website: "https://spark.fi",
    twitter: "sparkdotfi",
    logoUrl: getTwitterLogo("sparkdotfi"),
    entityType: "DAO",
    isRegulated: false,
  },
  morpho: {
    canonicalName: "Morpho",
    website: "https://morpho.org",
    twitter: "MorphoLabs",
    logoUrl: getTwitterLogo("MorphoLabs"),
    entityType: "DAO",
    jurisdiction: "France",
    isRegulated: false,
    description: "Decentralized lending protocol",
  },
  hyperithm: {
    canonicalName: "Hyperithm",
    twitter: "hyperithm",
    logoUrl: getTwitterLogo("hyperithm"),
    entityType: "Corporation",
    isRegulated: false,
  },
  keyrock: {
    canonicalName: "Keyrock",
    website: "https://keyrock.eu",
    twitter: "KeyrockTrading",
    logoUrl: getTwitterLogo("KeyrockTrading"),
    entityType: "Corporation",
    jurisdiction: "Belgium",
    isRegulated: true,
    description: "Digital asset market maker",
  },
  "stake dao": {
    canonicalName: "Stake DAO",
    website: "https://stakedao.org",
    twitter: "StakeDAOHQ",
    logoUrl: getTwitterLogo("StakeDAOHQ"),
    entityType: "DAO",
    isRegulated: false,
  },
  sky: {
    canonicalName: "Sky (Maker)",
    website: "https://sky.money",
    twitter: "SkyEcosystem",
    logoUrl: getTwitterLogo("SkyEcosystem"),
    entityType: "DAO",
    isRegulated: false,
    description: "Decentralized stablecoin ecosystem",
  },
  alpha: {
    canonicalName: "Alpha Finance",
    twitter: "alpaboratory",
    logoUrl: getTwitterLogo("alpaboratory"),
    entityType: "Corporation",
    isRegulated: false,
  },
  nuwealth: {
    canonicalName: "NuWealth",
    twitter: "NuWealthApp",
    logoUrl: getTwitterLogo("NuWealthApp"),
    entityType: "Corporation",
    isRegulated: false,
  },
  ousd: {
    canonicalName: "Origin Protocol",
    website: "https://originprotocol.com",
    twitter: "OriginProtocol",
    logoUrl: getTwitterLogo("OriginProtocol"),
    entityType: "Corporation",
    isRegulated: false,
    description: "Origin DeFi products including OUSD and OETH",
  },
  detrade: {
    canonicalName: "DeTrade",
    twitter: "DeTradeFund",
    logoUrl: getTwitterLogo("DeTradeFund"),
    entityType: "Corporation",
    isRegulated: false,
  },
  etherealm: {
    canonicalName: "Etherealm",
    twitter: "EtherealmFi",
    logoUrl: getTwitterLogo("EtherealmFi"),
    entityType: "Corporation",
    isRegulated: false,
  },
  maxshot: {
    canonicalName: "Maxshot",
    entityType: "Individual",
    isRegulated: false,
  },
  brrrstr: {
    canonicalName: "Brrrstr",
    entityType: "Individual",
    isRegulated: false,
  },
  yieldnest: {
    canonicalName: "YieldNest",
    website: "https://yieldnest.finance",
    twitter: "yaboratoryieldnest",
    logoUrl: getTwitterLogo("yaboratoryieldnest"),
    entityType: "Corporation",
    isRegulated: false,
  },
  haven: {
    canonicalName: "HavenFi",
    entityType: "Corporation",
    isRegulated: false,
  },
  kabu: {
    canonicalName: "Kabu",
    entityType: "Corporation",
    isRegulated: false,
  },
  ccm: {
    canonicalName: "CCM",
    entityType: "Corporation",
    isRegulated: false,
  },
  chip: {
    canonicalName: "Chip",
    entityType: "Individual",
    isRegulated: false,
  },
  "3f": {
    canonicalName: "3F",
    entityType: "Corporation",
    isRegulated: false,
  },
  grove: {
    canonicalName: "Grove",
    entityType: "Corporation",
    isRegulated: false,
  },
  "blue chip": {
    canonicalName: "Blue Chip",
    entityType: "Corporation",
    isRegulated: false,
  },
  "f(x)": {
    canonicalName: "f(x) Protocol",
    website: "https://fx.aladdin.club",
    twitter: "protocol_fx",
    logoUrl: getTwitterLogo("protocol_fx"),
    entityType: "DAO",
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

// Vaults that should be split from their on-chain curator into a separate entity.
// Maps vault address (lowercase) to the curator name key in CURATOR_PROFILES.
const VAULT_CURATOR_OVERRIDES: Record<string, string> = {
  // Clearstar vaults share Re7's curator address on-chain but are a separate entity
  "0xfa17f7aadbfac2c5d3c8125555404c1ae17df853": "clearstar", // Clearstar Yield USDC
  "0x69a238ae7ebeb3c53ff3b544e48b96a2142fc284": "clearstar", // Clearstar USDC Core
  "0xf3cc5c9a25508d8d959618fd48f6abc18ca4db49": "clearstar", // Clearstar Boring USDC
  "0x2b58132964f038461e3d8b56df582f49fecc8745": "clearstar", // Clearstar Boring USDT
  "0xae9a5aa54ae43bb8811435f02a29e9d2b43cdc7c": "clearstar", // Clearstar Reactor ETH
  // Re Ecosystem is a separate entity from Re7 Labs
  "0xd1e9242e075db4bdd3f3c721d7d5fd4180a94a7e": "re ecosystem", // Re Ecosystem Vault USDC
  // Kabu is a separate entity from API3
  "0x54210d3f1a066413891af9e17210e787d5c6e3f4": "kabu", // Kabu USDC
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

async function splitVaultOverrides() {
  log("Splitting vault curator overrides...");

  // Group overrides by target curator profile key
  const overridesByProfile: Record<string, string[]> = {};
  for (const [vaultAddress, profileKey] of Object.entries(VAULT_CURATOR_OVERRIDES)) {
    if (!overridesByProfile[profileKey]) overridesByProfile[profileKey] = [];
    overridesByProfile[profileKey].push(vaultAddress);
  }

  for (const [profileKey, vaultAddresses] of Object.entries(overridesByProfile)) {
    const profile = CURATOR_PROFILES[profileKey];
    if (!profile) {
      log(`  WARNING: No profile found for key "${profileKey}", skipping`);
      continue;
    }

    // Find or create the target curator
    const slugAddress = profileKey.replace(/\s+/g, "");
    const legacyAddress = `override-${profileKey}`;
    let targetCurator = await prisma.curator.findFirst({
      where: {
        OR: [
          { name: profile.canonicalName },
          { address: slugAddress },
          { address: legacyAddress },
        ],
      },
    });

    // Migrate legacy override- addresses to clean slugs
    if (targetCurator && targetCurator.address === legacyAddress) {
      targetCurator = await prisma.curator.update({
        where: { id: targetCurator.id },
        data: { address: slugAddress },
      });
      log(`  Migrated address: ${legacyAddress} → ${slugAddress}`);
    }

    if (!targetCurator) {
      // Create a new curator for this entity using a clean slug as the address
      targetCurator = await prisma.curator.create({
        data: {
          address: slugAddress,
          name: profile.canonicalName,
          website: profile.website,
          twitter: profile.twitter,
          logoUrl: profile.logoUrl,
          entityType: profile.entityType,
          jurisdiction: profile.jurisdiction,
          isRegulated: profile.isRegulated ?? false,
          description: profile.description,
        },
      });
      log(`  Created new curator: ${profile.canonicalName}`);
    }

    // Move matching vaults to the target curator (case-insensitive address match)
    let moved = 0;
    for (const vaultAddress of vaultAddresses) {
      const vault = await prisma.vault.findFirst({
        where: { address: { equals: vaultAddress, mode: "insensitive" } },
      });

      if (vault && vault.curatorId !== targetCurator.id) {
        await prisma.vault.update({
          where: { id: vault.id },
          data: { curatorId: targetCurator.id },
        });
        moved++;
      }
    }

    if (moved > 0) {
      log(`  Moved ${moved} vaults to ${profile.canonicalName}`);
    }
  }

  log("Vault curator overrides complete");
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

    // Step 2: Split vaults that share an address but are separate entities
    await splitVaultOverrides();

    // Step 3: Update curator profiles
    await updateCuratorProfiles();

    // Step 4: Recalculate curator stats
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

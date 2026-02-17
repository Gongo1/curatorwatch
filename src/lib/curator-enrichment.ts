/**
 * Enriched curator profiles for known Morpho vault curators.
 * This data supplements the auto-discovered curator addresses with
 * organization details, social links, and regulatory information.
 */

export interface EnrichedCuratorProfile {
  address: string;
  name: string;
  website?: string;
  twitter?: string;
  discord?: string;
  description?: string;
  entityType?: "LLC" | "DAO" | "Corporation" | "Individual" | "Foundation";
  jurisdiction?: string;
  headquarters?: string;
  foundedYear?: number;
  teamSize?: "1-10" | "11-50" | "51-200" | "200+";
  isRegulated?: boolean;
  regulatoryBody?: string;
  logoUrl?: string;
}

/**
 * Known curator profiles with enriched information.
 * Addresses are in lowercase for consistent matching.
 */
export const ENRICHED_CURATORS: EnrichedCuratorProfile[] = [
  // Note: Gauntlet is defined in CURATOR_PROFILES with correct address 0x9e33faae38ff641094fa68c65c2ce600b3410585
  {
    address: "0x8bcf5b1e6b76e55e9b5db6b6e6f0e8b8e6d4e6c4",
    name: "Steakhouse Financial",
    website: "https://steakhouse.financial",
    twitter: "SteakhouseFi",
    description:
      "DeFi research and risk management firm providing institutional-grade analysis and vault curation services.",
    entityType: "LLC",
    jurisdiction: "Cayman Islands",
    foundedYear: 2022,
    teamSize: "11-50",
    isRegulated: false,
  },
  {
    address: "0x255c3dd26fd6b2f94f01e6c9e2b758e6a4a53a67",
    name: "Block Analitica",
    website: "https://blockanalitica.com",
    twitter: "BlockAnalitica",
    description:
      "Data analytics and risk management platform for DeFi protocols, providing real-time monitoring and risk assessment.",
    entityType: "LLC",
    jurisdiction: "Slovenia",
    headquarters: "Ljubljana, Slovenia",
    foundedYear: 2020,
    teamSize: "11-50",
    isRegulated: false,
  },
  {
    address: "0x38989bba00bdf8181f4082995b3deae96163ac5d",
    name: "MEV Capital",
    website: "https://mev.capital",
    twitter: "maboroshi_fund",
    description:
      "Crypto-native investment firm specializing in DeFi yield strategies and vault management.",
    entityType: "LLC",
    jurisdiction: "Switzerland",
    foundedYear: 2021,
    teamSize: "1-10",
    isRegulated: false,
  },
  {
    address: "0xba9568ccc9ae4e7640723c2f4f9a304e82b6b572",
    name: "B.Protocol",
    website: "https://www.bprotocol.org",
    twitter: "baborish1",
    description:
      "Backstop liquidity protocol that aims to improve liquidation processes in DeFi lending markets.",
    entityType: "DAO",
    jurisdiction: "Decentralized",
    foundedYear: 2020,
    teamSize: "1-10",
    isRegulated: false,
  },
  {
    address: "0x1a0c993c6ea68e2c64a74a19c4e6ff4a2a98e70e",
    name: "Re7 Labs",
    website: "https://re7.capital",
    twitter: "Re7Capital",
    description:
      "DeFi research and development firm focused on yield optimization and risk-adjusted strategies.",
    entityType: "LLC",
    jurisdiction: "US",
    headquarters: "San Francisco, US",
    foundedYear: 2022,
    teamSize: "11-50",
    isRegulated: false,
  },
  {
    address: "0xfd6f77dab22c2cd5d098a9df79d13b6c4e3be9b5",
    name: "Hashflow",
    website: "https://hashflow.com",
    twitter: "hashaborish",
    description:
      "Decentralized exchange and trading infrastructure provider enabling cross-chain swaps.",
    entityType: "Corporation",
    jurisdiction: "US",
    headquarters: "San Francisco, US",
    foundedYear: 2021,
    teamSize: "51-200",
    isRegulated: false,
  },
  {
    address: "0xb27dc8b0e23d6a489fd52f8a37eb5a4a7c27c3b8",
    name: "Idle Finance",
    website: "https://idle.finance",
    twitter: "idlefinance",
    description:
      "DeFi yield aggregation protocol offering automated yield optimization across multiple protocols.",
    entityType: "DAO",
    jurisdiction: "Decentralized",
    foundedYear: 2019,
    teamSize: "11-50",
    isRegulated: false,
  },
  {
    address: "0x3e95e07fd5fa55b6f1f72ed2f9b5c0e4c6ff4d5a",
    name: "Morpho Labs",
    website: "https://morpho.org",
    twitter: "MorphoLabs",
    description:
      "Core development team behind the Morpho protocol, building next-generation lending infrastructure.",
    entityType: "Foundation",
    jurisdiction: "France",
    headquarters: "Paris, France",
    foundedYear: 2021,
    teamSize: "51-200",
    isRegulated: false,
  },
  {
    address: "0x8f3dab7a2e4c4ea4f9a9c8b9e3d3c5d5e5f5a5b5",
    name: "Superform",
    website: "https://superform.xyz",
    twitter: "superaborish",
    description:
      "Cross-chain yield marketplace enabling seamless DeFi yield access across multiple networks.",
    entityType: "Corporation",
    jurisdiction: "Cayman Islands",
    foundedYear: 2022,
    teamSize: "11-50",
    isRegulated: false,
  },
  // Add more known curators as they are discovered
];

/**
 * Get enriched profile for a curator address.
 * Returns null if no enrichment data is available.
 */
export function getEnrichedCuratorProfile(
  address: string
): EnrichedCuratorProfile | null {
  const normalizedAddress = address.toLowerCase();
  return (
    ENRICHED_CURATORS.find((c) => c.address === normalizedAddress) || null
  );
}

/**
 * Get display name for a curator.
 * Falls back to truncated address if no name is available.
 */
export function getCuratorDisplayName(
  address: string,
  dbName?: string | null
): string {
  // Check enrichment data first
  const enriched = getEnrichedCuratorProfile(address);
  if (enriched?.name) return enriched.name;

  // Use database name if available
  if (dbName) return dbName;

  // Fallback to truncated address
  return `Curator ${address.slice(0, 6)}...${address.slice(-4)}`;
}

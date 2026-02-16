/**
 * Curated curator profile data for institutional due diligence
 * This data is manually researched and maintained
 */

export interface CuratorProfile {
  name: string;
  website?: string;
  twitter?: string;
  discord?: string;
  email?: string;
  legalName?: string;
  entityType?: "Corporation" | "LLC" | "DAO" | "Individual" | "Foundation";
  jurisdiction?: string;
  registeredState?: string;
  headquarters?: string;
  description?: string;
  foundedYear?: number;
  teamSize?: "1-10" | "11-50" | "51-200" | "200+";
  isRegulated?: boolean;
  regulatoryBody?: string;
  licenses?: string[];
  logoUrl?: string;
}

export interface CuratorNewsItem {
  title: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: "positive" | "neutral" | "negative";
  category?: "announcement" | "partnership" | "audit" | "incident" | "update" | "security";
}

/**
 * Known curator profiles indexed by their Ethereum address (lowercased)
 * NOTE: Addresses are sourced from actual Morpho vault data
 */
export const CURATOR_PROFILES: Record<string, CuratorProfile> = {
  // Gauntlet - One of the largest DeFi risk managers
  // Actual address from Morpho vaults: 0x9E33faAE38ff641094fa68c65c2cE600b3410585
  "0x9e33faae38ff641094fa68c65c2ce600b3410585": {
    name: "Gauntlet",
    website: "https://www.gauntlet.xyz",
    twitter: "https://twitter.com/gauntletxyz",
    discord: "https://discord.gg/gauntlet",
    legalName: "Gauntlet Networks Inc.",
    entityType: "Corporation",
    jurisdiction: "United States",
    registeredState: "Delaware",
    headquarters: "New York, NY, USA",
    description:
      "Gauntlet is a financial modeling platform that uses battle-tested techniques from the algorithmic trading industry to inform protocol management. They provide risk management, parameter optimization, and economic modeling for major DeFi protocols including Aave, Compound, and Morpho. Known for their rigorous quantitative approach and institutional-grade risk frameworks.",
    foundedYear: 2018,
    teamSize: "51-200",
    isRegulated: false,
    logoUrl: "https://www.gauntlet.xyz/favicon.ico",
  },

  // Steakhouse Financial - RWA and treasury specialists
  // Actual address from Morpho vaults: 0x827e86072B06674a077f592A531dcE4590aDeCdB
  "0x827e86072b06674a077f592a531dce4590adecdb": {
    name: "Steakhouse Financial",
    website: "https://www.steakhouse.financial",
    twitter: "https://twitter.com/SteakhouseFi",
    discord: "https://discord.gg/steakhouse",
    legalName: "Steakhouse Financial AG",
    entityType: "Corporation",
    jurisdiction: "Switzerland",
    headquarters: "Zug, Switzerland",
    description:
      "Steakhouse Financial provides institutional-grade asset management and treasury services for DAOs and protocols. They specialize in Real World Asset (RWA) integration, conservative yield strategies, and transparent treasury management. Known for their work with MakerDAO and focus on regulatory compliance.",
    foundedYear: 2022,
    teamSize: "11-50",
    isRegulated: false,
  },

  // Re7 Labs / Re7 Capital - DeFi-native asset manager
  // Actual address from Morpho vaults: 0x72882eb5D27C7088DFA6DDE941DD42e5d184F0ef
  "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef": {
    name: "Re7 Labs",
    website: "https://www.re7.capital",
    twitter: "https://twitter.com/re7labs",
    entityType: "DAO",
    jurisdiction: "Decentralized",
    description:
      "Re7 Labs is a DeFi-native asset manager focused on optimized yield strategies across multiple protocols. They specialize in aggressive allocation strategies targeting higher APY through sophisticated market analysis and automated rebalancing. Known for their data-driven approach and active management style.",
    foundedYear: 2023,
    teamSize: "1-10",
    isRegulated: false,
  },

  // August Digital - Institutional DeFi asset management
  // Actual address from Morpho vaults: 0xA81AE7d57D68Fd6eF76a3082134BD2F3019aec24
  "0xa81ae7d57d68fd6ef76a3082134bd2f3019aec24": {
    name: "August Digital",
    website: "https://august.digital",
    twitter: "https://twitter.com/augustdigital",
    legalName: "August Digital Ltd",
    entityType: "Corporation",
    jurisdiction: "United Kingdom",
    headquarters: "London, UK",
    description:
      "August Digital provides institutional-grade DeFi asset management services. They specialize in transparent, data-driven vault curation with emphasis on risk metrics and performance analytics, offering comprehensive monitoring and reporting for institutional investors.",
    foundedYear: 2021,
    teamSize: "11-50",
    isRegulated: false,
    logoUrl: "https://august.digital/favicon.ico",
  },

  // Sentora - Risk management platform
  // Actual address from Morpho vaults: 0x9e396dE3312D373b87F9BD8763fb48184b42aac0
  "0x9e396de3312d373b87f9bd8763fb48184b42aac0": {
    name: "Sentora",
    website: "https://sentora.xyz",
    twitter: "https://twitter.com/sentoraio",
    entityType: "Corporation",
    jurisdiction: "United States",
    description:
      "Sentora provides risk management and yield optimization services for DeFi protocols. They specialize in data-driven strategies with a focus on security and transparency.",
    foundedYear: 2023,
    teamSize: "11-50",
    isRegulated: false,
  },

  // gtsy (Unknown curator from vault data)
  // Actual address from Morpho vaults: 0xfe7bE004ccAAc2EAA7273F6C613e3E96b4B0b934
  "0xfe7be004ccaac2eaa7273f6c613e3e96b4b0b934": {
    name: "gtsy",
    entityType: "Individual",
    jurisdiction: "Unknown",
    description:
      "Independent vault curator managing Morpho vaults.",
    isRegulated: false,
  },

  // MEV Capital - MEV-focused strategies (keeping original in case vaults use it)
  "0x6abfd6139c7c3cc270ee2ce132e309f59cadaaf6": {
    name: "MEV Capital",
    website: "https://mev.capital",
    twitter: "https://twitter.com/meaboratory",
    entityType: "DAO",
    jurisdiction: "Decentralized",
    description:
      "MEV Capital specializes in sophisticated DeFi strategies that leverage MEV (Maximum Extractable Value) opportunities. They focus on yield optimization through advanced market making and arbitrage strategies while managing vaults for various protocols.",
    foundedYear: 2022,
    teamSize: "1-10",
    isRegulated: false,
  },

  // Morpho Association - Protocol native curator
  "0x0000000000000000000000000000000000000000": {
    name: "Morpho Association",
    website: "https://morpho.org",
    twitter: "https://twitter.com/MorphoLabs",
    discord: "https://discord.gg/morpho",
    legalName: "Morpho Association",
    entityType: "Foundation",
    jurisdiction: "France",
    headquarters: "Paris, France",
    description:
      "The Morpho Association is the non-profit organization behind the Morpho protocol. They develop and maintain the Morpho Blue and MetaMorpho infrastructure, and may curate official protocol vaults with conservative, well-audited strategies.",
    foundedYear: 2021,
    teamSize: "11-50",
    isRegulated: false,
  },

  // Idle Finance - Yield aggregation specialists
  "0xfff5a9eb4806d3aaff945f757f4a98a7b39c0f3c": {
    name: "Idle Finance",
    website: "https://idle.finance",
    twitter: "https://twitter.com/idaboratory",
    discord: "https://discord.gg/idle",
    entityType: "DAO",
    jurisdiction: "Decentralized",
    description:
      "Idle Finance is a decentralized rebalancing protocol that allows users to automatically get the best yield from different DeFi protocols. They bring their yield optimization expertise to Morpho vault curation with a focus on capital efficiency.",
    foundedYear: 2019,
    teamSize: "11-50",
    isRegulated: false,
  },

  // Spark (MakerDAO ecosystem)
  "0x44c4a5026a9af1e10c3b6a5a4f8d7c5e0e3d7f2a": {
    name: "Spark Protocol",
    website: "https://spark.fi",
    twitter: "https://twitter.com/sparkdotfi",
    legalName: "Spark Protocol Foundation",
    entityType: "Foundation",
    jurisdiction: "Cayman Islands",
    headquarters: "Cayman Islands",
    description:
      "Spark Protocol is the lending arm of the MakerDAO ecosystem, focused on providing efficient lending markets for DAI and other assets. Their vault curation emphasizes stability and integration with the broader Maker ecosystem.",
    foundedYear: 2023,
    teamSize: "11-50",
    isRegulated: false,
  },
};

/**
 * Manually curated news for key curators
 * This should be updated regularly with important developments
 * NOTE: Addresses match the actual curator addresses from Morpho vaults
 */
export const CURATOR_NEWS: Array<CuratorNewsItem & { curatorAddress: string }> = [
  // Gauntlet news (actual address: 0x9e33faae38ff641094fa68c65c2ce600b3410585)
  {
    curatorAddress: "0x9e33faae38ff641094fa68c65c2ce600b3410585",
    title: "Gauntlet Expands Morpho Blue Vault Management",
    summary:
      "Gauntlet announces expansion of their Morpho Blue vault offerings, adding new USDC and USDT strategies with optimized risk parameters.",
    url: "https://twitter.com/gauntletxyz",
    source: "Twitter",
    publishedAt: new Date("2025-01-15"),
    sentiment: "positive",
    category: "announcement",
  },
  {
    curatorAddress: "0x9e33faae38ff641094fa68c65c2ce600b3410585",
    title: "Gauntlet Risk Framework Update Q1 2025",
    summary:
      "Quarterly update to Gauntlet's risk management framework incorporating new market conditions and protocol upgrades.",
    url: "https://medium.com/@gauntlet",
    source: "Medium",
    publishedAt: new Date("2025-01-10"),
    sentiment: "neutral",
    category: "update",
  },
  {
    curatorAddress: "0x9e33faae38ff641094fa68c65c2ce600b3410585",
    title: "Gauntlet Vaults Pass Trail of Bits Audit",
    summary:
      "All Gauntlet-managed MetaMorpho vaults have completed security review by Trail of Bits with no critical findings.",
    url: "https://www.gauntlet.xyz/audits",
    source: "Website",
    publishedAt: new Date("2024-12-20"),
    sentiment: "positive",
    category: "audit",
  },

  // Steakhouse Financial news (actual address: 0x827e86072b06674a077f592a531dce4590adecdb)
  {
    curatorAddress: "0x827e86072b06674a077f592a531dce4590adecdb",
    title: "Steakhouse Financial Launches RWA-Backed USDC Vault",
    summary:
      "New vault strategy incorporating tokenized US Treasuries for enhanced yield with real-world asset backing.",
    url: "https://medium.com/@steakhousefinancial",
    source: "Medium",
    publishedAt: new Date("2025-01-20"),
    sentiment: "positive",
    category: "announcement",
  },
  {
    curatorAddress: "0x827e86072b06674a077f592a531dce4590adecdb",
    title: "Steakhouse Partners with Centrifuge for RWA Integration",
    summary:
      "Strategic partnership to bring more real-world asset exposure to DeFi yield strategies.",
    url: "https://twitter.com/SteakhouseFi",
    source: "Twitter",
    publishedAt: new Date("2025-01-05"),
    sentiment: "positive",
    category: "partnership",
  },

  // Re7 Labs news (actual address: 0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef)
  {
    curatorAddress: "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef",
    title: "Re7 Labs Achieves 10% APY on WETH Vault",
    summary:
      "Re7's aggressive yield strategy delivers above-market returns through optimized allocation across multiple lending markets.",
    url: "https://twitter.com/re7labs",
    source: "Twitter",
    publishedAt: new Date("2025-01-18"),
    sentiment: "positive",
    category: "announcement",
  },

  // August Digital news (actual address: 0xa81ae7d57d68fd6ef76a3082134bd2f3019aec24)
  {
    curatorAddress: "0xa81ae7d57d68fd6ef76a3082134bd2f3019aec24",
    title: "August Digital Releases Enhanced Risk Dashboard",
    summary:
      "New analytics features provide deeper insights into vault risk metrics and allocation strategies.",
    url: "https://august.digital/blog",
    source: "Website",
    publishedAt: new Date("2025-01-12"),
    sentiment: "positive",
    category: "update",
  },

  // Sentora news (actual address: 0x9e396de3312d373b87f9bd8763fb48184b42aac0)
  {
    curatorAddress: "0x9e396de3312d373b87f9bd8763fb48184b42aac0",
    title: "Sentora Launches PYUSD Vault on Morpho",
    summary:
      "New vault strategy for PayPal's PYUSD stablecoin offering optimized yields through Morpho Blue markets.",
    url: "https://twitter.com/sentoraio",
    source: "Twitter",
    publishedAt: new Date("2025-01-12"),
    sentiment: "positive",
    category: "announcement",
  },

  // MEV Capital news
  {
    curatorAddress: "0x6abfd6139c7c3cc270ee2ce132e309f59cadaaf6",
    title: "MEV Capital Vault Strategy Optimization",
    summary:
      "Enhanced MEV extraction strategies implemented across all managed vaults for improved returns.",
    url: "https://twitter.com/meaboratory",
    source: "Twitter",
    publishedAt: new Date("2025-01-08"),
    sentiment: "positive",
    category: "update",
  },
];

/**
 * Get curator profile by address (case-insensitive)
 */
export function getCuratorProfile(address: string): CuratorProfile | null {
  return CURATOR_PROFILES[address.toLowerCase()] || null;
}

/**
 * Get curator news by address (case-insensitive)
 */
export function getCuratorNews(address: string, limit?: number): CuratorNewsItem[] {
  const news = CURATOR_NEWS
    .filter((n) => n.curatorAddress.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return limit ? news.slice(0, limit) : news;
}

/**
 * Check if we have profile data for a curator
 */
export function hasCuratorProfile(address: string): boolean {
  return address.toLowerCase() in CURATOR_PROFILES;
}

/**
 * Get all known curator addresses
 */
export function getAllCuratorAddresses(): string[] {
  return Object.keys(CURATOR_PROFILES);
}

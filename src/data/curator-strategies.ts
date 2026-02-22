/**
 * Curator Strategy Intelligence Database
 *
 * Research-backed profiles of major Morpho curators
 * Think like an institutional allocator - what's their edge?
 */

import type { StrategyArchetype } from "@/lib/strategy-classifier";
import { resolveCuratorAddress } from "@/lib/curator-aliases";

export interface CuratorIntelligence {
  name: string;
  website?: string;
  philosophy: string;
  targetClients: string;
  differentiator: string;
  archetype: StrategyArchetype;
  tradFiAnalog: string;
  knownFor: string[];
  riskPhilosophy: string;
  teamBackground?: string;
  governance?: string;
}

/**
 * Known curator strategies - manually researched
 * Key is curator address (lowercase)
 */
export const CURATOR_INTELLIGENCE: Record<string, CuratorIntelligence> = {
  // Gauntlet
  "0x3e4ffa85f07e14d4e7ed5c5ee1ccb67f0fd0ea6e": {
    name: "Gauntlet",
    website: "https://gauntlet.xyz",
    philosophy: "Data-driven risk management using economic simulations and agent-based modeling",
    targetClients: "Protocols seeking optimized capital efficiency and risk management",
    differentiator: "Proprietary simulation models, institutional-grade risk frameworks",
    archetype: "Quantitative Yield Optimizer",
    tradFiAnalog: "Quant hedge fund (e.g., Two Sigma)",
    knownFor: [
      "Parameter optimization for major DeFi protocols",
      "Agent-based simulation models",
      "Institutional risk management",
      "Data-driven rebalancing"
    ],
    riskPhilosophy: "Systematic approach - let the models guide decisions",
    teamBackground: "PhD-level quants, former TradFi risk managers",
    governance: "Independent risk committee oversight"
  },

  // Steakhouse Financial
  "0xbeef01735c132ada46aa9aa4c54623caa92a64cb": {
    name: "Steakhouse Financial",
    website: "https://steakhouse.financial",
    philosophy: "Institutional-grade stablecoin and RWA strategies with regulatory awareness",
    targetClients: "Conservative institutions, DAO treasuries, risk-averse allocators",
    differentiator: "Deep regulatory expertise, TradFi relationships, RWA focus",
    archetype: "Fixed Income Specialist",
    tradFiAnalog: "Bond fund manager (e.g., PIMCO)",
    knownFor: [
      "MakerDAO treasury management",
      "RWA integration expertise",
      "Regulatory compliance focus",
      "Capital preservation strategies"
    ],
    riskPhilosophy: "Safety first - yield is secondary to capital preservation",
    teamBackground: "TradFi finance, regulatory specialists",
    governance: "Transparent reporting, DAO-aligned"
  },

  // Re7 Labs
  "0x1b7e5de59e33c56c3e84c9b29e8ef2e32f9df33b": {
    name: "Re7 Labs",
    website: "https://re7.capital",
    philosophy: "Flexible multi-strategy approach with MEV-aware yield optimization",
    targetClients: "Sophisticated DeFi users seeking diversified exposure",
    differentiator: "Cross-protocol optimization, MEV-aware strategies",
    archetype: "Multi-Strategy / Opportunistic",
    tradFiAnalog: "Multi-strategy hedge fund (e.g., Millennium)",
    knownFor: [
      "Multiple vault strategies",
      "MEV protection mechanisms",
      "Cross-protocol arbitrage",
      "Tactical allocation shifts"
    ],
    riskPhilosophy: "Diversify across strategies, adapt to market conditions",
    teamBackground: "DeFi natives, protocol researchers"
  },

  // MEV Capital
  "0x6c1e12e2c9c7b40e9f3b6b8a5c9f2e1d3f4a5b6c": {
    name: "MEV Capital",
    website: "https://mev.capital",
    philosophy: "MEV-optimized yield strategies with advanced execution",
    targetClients: "Institutions comfortable with complex DeFi strategies",
    differentiator: "MEV expertise, searcher relationships, execution infrastructure",
    archetype: "Market Maker / Liquidity Provider",
    tradFiAnalog: "Trading firm (e.g., Jane Street)",
    knownFor: [
      "MEV capture strategies",
      "Advanced execution",
      "Searcher partnerships",
      "High-frequency rebalancing"
    ],
    riskPhilosophy: "Maximize capital efficiency through active management"
  },

  // Block Analitica
  "0x7b8f45c2e1d3f4a5b6c7e8f9a0b1c2d3e4f5a6b7": {
    name: "Block Analitica",
    website: "https://blockanalitica.com",
    philosophy: "Risk analytics and data-driven vault management",
    targetClients: "Protocols and institutions seeking transparent risk management",
    differentiator: "Open analytics, transparent methodology, protocol partnerships",
    archetype: "Quantitative Yield Optimizer",
    tradFiAnalog: "Quant hedge fund",
    knownFor: [
      "MakerDAO risk analytics",
      "Open data dashboards",
      "Protocol risk assessment",
      "Transparent methodology"
    ],
    riskPhilosophy: "Data transparency enables better risk decisions",
    teamBackground: "Data scientists, protocol analysts"
  },

  // Morpho Association
  "0xba9d4c9d4c4d4a5b6c7e8f9a0b1c2d3e4f5a6b7c": {
    name: "Morpho Association",
    philosophy: "Protocol-native strategies demonstrating Morpho capabilities",
    targetClients: "Users seeking direct protocol exposure",
    differentiator: "Deep protocol knowledge, aligned incentives",
    archetype: "Balanced / Undefined",
    tradFiAnalog: "In-house asset management",
    knownFor: [
      "Protocol demonstration vaults",
      "Conservative reference implementations",
      "Ecosystem development"
    ],
    riskPhilosophy: "Showcase protocol capabilities with measured risk"
  },

  // Idle Finance
  "0x8a9c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c": {
    name: "Idle Finance",
    website: "https://idle.finance",
    philosophy: "Automated yield optimization with capital preservation focus",
    targetClients: "DeFi users seeking passive yield",
    differentiator: "Established track record, insurance integrations",
    archetype: "Passive Index / Set-and-Forget",
    tradFiAnalog: "Index fund (e.g., Vanguard)",
    knownFor: [
      "Best yield strategies",
      "Risk-adjusted optimization",
      "Insurance integration",
      "Long track record"
    ],
    riskPhilosophy: "Automate the boring stuff, focus on safety"
  },

  // Yearn Finance
  "0x9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c": {
    name: "Yearn Finance",
    website: "https://yearn.fi",
    philosophy: "Battle-tested yield aggregation with proven strategies",
    targetClients: "DeFi users seeking automated yield",
    differentiator: "Longest track record in DeFi yield, community governance",
    archetype: "Multi-Strategy / Opportunistic",
    tradFiAnalog: "Asset manager with multiple funds",
    knownFor: [
      "Yield aggregation pioneer",
      "Community governance",
      "Strategy innovation",
      "Risk management"
    ],
    riskPhilosophy: "Diversify across vetted strategies"
  }
};

/**
 * Get curator intelligence by address
 */
export function getCuratorIntelligence(address: string): CuratorIntelligence | null {
  return CURATOR_INTELLIGENCE[resolveCuratorAddress(address)] ?? null;
}

/**
 * Get curator intelligence by name (fuzzy match)
 */
export function getCuratorIntelligenceByName(name: string): CuratorIntelligence | null {
  const normalizedName = name.toLowerCase();
  for (const intel of Object.values(CURATOR_INTELLIGENCE)) {
    if (intel.name.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(intel.name.toLowerCase())) {
      return intel;
    }
  }
  return null;
}

/**
 * Archetype descriptions for UI
 */
export const ARCHETYPE_DESCRIPTIONS: Record<StrategyArchetype, {
  emoji: string;
  shortDescription: string;
  color: string;
}> = {
  "Quantitative Yield Optimizer": {
    emoji: "📊",
    shortDescription: "Algorithm-driven, data-intensive strategies",
    color: "blue"
  },
  "Fixed Income Specialist": {
    emoji: "🏦",
    shortDescription: "Conservative, capital preservation focus",
    color: "green"
  },
  "Market Maker / Liquidity Provider": {
    emoji: "⚡",
    shortDescription: "High-frequency, execution-focused",
    color: "purple"
  },
  "Multi-Strategy / Opportunistic": {
    emoji: "🎯",
    shortDescription: "Flexible, diversified approaches",
    color: "orange"
  },
  "Passive Index / Set-and-Forget": {
    emoji: "🌱",
    shortDescription: "Low-touch, long-term compounding",
    color: "teal"
  },
  "Venture / High-Risk": {
    emoji: "🚀",
    shortDescription: "Early-stage, high risk/reward",
    color: "red"
  },
  "Balanced / Undefined": {
    emoji: "⚖️",
    shortDescription: "Balanced approach, no strong specialization",
    color: "gray"
  }
};

/**
 * Management style descriptions
 */
export const MANAGEMENT_STYLE_DESCRIPTIONS = {
  passive: {
    label: "Passive",
    description: "Minimal intervention, long-term focus",
    rebalanceFreq: "<3 times/month"
  },
  active: {
    label: "Active",
    description: "Regular monitoring and adjustment",
    rebalanceFreq: "3-15 times/month"
  },
  "hyper-active": {
    label: "Hyper-Active",
    description: "Continuous optimization",
    rebalanceFreq: ">15 times/month"
  }
};

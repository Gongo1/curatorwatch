// Collateral Risk Classification
// Used to assess counterparty and liquidation risk for vault lending strategies

export type CollateralRisk = "low" | "medium" | "high";

// Collateral risk classifications based on asset type and stability
const COLLATERAL_RISK_MAP: Record<string, CollateralRisk> = {
  // Stablecoins - Low risk (pegged to USD, minimal volatility)
  USDC: "low",
  USDT: "low",
  DAI: "low",
  FRAX: "low",
  LUSD: "low",
  sUSD: "low",
  GUSD: "low",
  BUSD: "low",
  TUSD: "low",
  USDP: "low",
  sNUSD: "low",
  upUSDC: "low",
  syzUSD: "low",
  crvUSD: "low",
  GHO: "low",
  PYUSD: "low",

  // Major ETH derivatives - Low to Medium risk
  WETH: "medium",
  ETH: "medium",
  stETH: "low",
  wstETH: "low",
  rETH: "low",
  cbETH: "medium",
  sfrxETH: "medium",
  mETH: "medium",
  swETH: "medium",
  ezETH: "medium",
  weETH: "medium",
  osETH: "medium",
  ankrETH: "medium",

  // Major BTC derivatives - Medium risk
  WBTC: "medium",
  cbBTC: "medium",
  tBTC: "medium",
  renBTC: "medium",
  sBTC: "medium",
  LBTC: "medium",
  eBTC: "medium",

  // DeFi blue chips - Medium risk
  LINK: "medium",
  UNI: "medium",
  AAVE: "medium",
  MKR: "medium",
  CRV: "medium",
  LDO: "medium",
  RPL: "medium",
  SNX: "medium",
  COMP: "medium",
  YFI: "medium",
  BAL: "medium",

  // Newer/Exotic assets - Higher risk
  AA_FalconXUSDC: "medium",
  syrupUSDC: "medium",
  RLP: "high",
  PT_tokens: "high",
  rsETH: "high",
  pufETH: "high",
  eETH: "high",

  // Real World Assets (RWA) - Medium risk due to regulatory uncertainty
  sDAI: "low",
  USDS: "low",
  SKY: "medium",
};

export function getCollateralRisk(symbol: string): CollateralRisk {
  // Check direct mapping
  if (COLLATERAL_RISK_MAP[symbol]) {
    return COLLATERAL_RISK_MAP[symbol];
  }

  // Pattern matching for common prefixes
  const upperSymbol = symbol.toUpperCase();

  // Wrapped tokens inherit base asset risk
  if (upperSymbol.startsWith("W") && COLLATERAL_RISK_MAP[upperSymbol.slice(1)]) {
    return COLLATERAL_RISK_MAP[upperSymbol.slice(1)];
  }

  // Staked/Liquid staking tokens
  if (
    upperSymbol.startsWith("ST") ||
    upperSymbol.startsWith("S") ||
    upperSymbol.endsWith("ETH")
  ) {
    return "medium";
  }

  // LP tokens are generally higher risk
  if (upperSymbol.includes("LP") || upperSymbol.includes("POOL")) {
    return "high";
  }

  // Pendle Principal Tokens
  if (upperSymbol.startsWith("PT-") || upperSymbol.startsWith("PT_")) {
    return "high";
  }

  // Yield-bearing tokens
  if (upperSymbol.startsWith("Y") || upperSymbol.startsWith("A")) {
    return "medium";
  }

  // Default unknown collateral to high risk
  return "high";
}

export function getCollateralRiskColor(risk: CollateralRisk): string {
  switch (risk) {
    case "low":
      return "text-accent-green";
    case "medium":
      return "text-accent-yellow";
    case "high":
      return "text-accent-red";
  }
}

export function getCollateralRiskBgColor(risk: CollateralRisk): string {
  switch (risk) {
    case "low":
      return "bg-accent-green/15 border-accent-green/20";
    case "medium":
      return "bg-accent-yellow/15 border-accent-yellow/20";
    case "high":
      return "bg-accent-red/15 border-accent-red/20";
  }
}

// LLTV Risk Classification
// Higher LLTV = higher liquidation risk for the vault
export type LLTVRisk = "low" | "medium" | "high";

export function getLLTVRisk(lltv: number): LLTVRisk {
  // LLTV is typically expressed as percentage (0-100) or decimal (0-1)
  const lltvPercent = lltv > 1 ? lltv : lltv * 100;

  if (lltvPercent >= 90) {
    return "high";
  } else if (lltvPercent >= 80) {
    return "medium";
  }
  return "low";
}

export function getLLTVRiskLabel(lltv: number): string {
  const risk = getLLTVRisk(lltv);
  const lltvPercent = lltv > 1 ? lltv : lltv * 100;

  switch (risk) {
    case "high":
      return `High (${lltvPercent.toFixed(0)}%)`;
    case "medium":
      return `Medium (${lltvPercent.toFixed(0)}%)`;
    case "low":
      return `Low (${lltvPercent.toFixed(0)}%)`;
  }
}

// Aggregate risk for a vault based on its collateral exposure
export interface CollateralExposure {
  symbol: string;
  address: string;
  exposureUsd: number;
  exposurePercent: number;
  risk: CollateralRisk;
  lltv?: number;
  lltvRisk?: LLTVRisk;
}

export function calculateAggregateCollateralRisk(
  exposures: CollateralExposure[]
): CollateralRisk {
  if (exposures.length === 0) return "low";

  // Weight by exposure percentage
  let highRiskWeight = 0;
  let mediumRiskWeight = 0;
  let lowRiskWeight = 0;

  for (const exp of exposures) {
    switch (exp.risk) {
      case "high":
        highRiskWeight += exp.exposurePercent;
        break;
      case "medium":
        mediumRiskWeight += exp.exposurePercent;
        break;
      case "low":
        lowRiskWeight += exp.exposurePercent;
        break;
    }
  }

  // If more than 30% in high risk, overall is high
  if (highRiskWeight > 30) return "high";

  // If more than 50% in medium or higher, overall is medium
  if (highRiskWeight + mediumRiskWeight > 50) return "medium";

  return "low";
}

// Oracle type risk assessment
export type OracleType =
  | "chainlink"
  | "morpho"
  | "uniswap"
  | "custom"
  | "unknown";

export function getOracleRisk(oracleType: OracleType): CollateralRisk {
  switch (oracleType) {
    case "chainlink":
      return "low";
    case "morpho":
      return "low";
    case "uniswap":
      return "medium";
    case "custom":
      return "high";
    case "unknown":
      return "high";
  }
}

// Get token icon color based on symbol (for visual distinction)
export function getTokenIconColor(symbol: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-orange-500",
  ];

  // Generate consistent color from symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

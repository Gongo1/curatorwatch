// API Response types for the frontend

export interface VaultAsset {
  address: string;
  symbol: string;
  decimals: number;
}

export interface VaultFees {
  performance: number;
  management: number;
}

export interface VaultYield {
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  annualizedYield: number;
  estimatedTotalYield: number;
  vaultAgeDays: number;
}

export interface VaultSnapshot {
  totalAssets: string;
  totalAssetsUsd: number;
  totalSupply: string;
  sharePrice: number;
  liquidity: string | null;
  liquidityUsd: number | null;
  apy: number | null;
  netApy: number | null;
  avgApy: number | null;
  avgNetApy: number | null;
  timestamp: string;
}

export interface VaultAdapter {
  address: string;
  type: string;
  assets: string;
  assetsUsd: number;
  allocationPct: number;
}

export interface VaultRiskSummary {
  overallRisk: "Low Risk" | "Moderate Risk" | "High Risk";
  overallScore: number;
}

export interface VaultData {
  id: string;
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  asset: VaultAsset;
  curatorAddress: string | null;
  curatorName?: string | null;
  fees: VaultFees;
  yield?: VaultYield;
  latestSnapshot: VaultSnapshot | null;
  adapters: VaultAdapter[];
  riskAssessment?: VaultRiskSummary;
  turtleId?: string | null;
  protocol: string;
  dataSource: string;
  chainName?: string | null;
  estTotalAPR?: number | null;
  netAPR?: number | null;
  aprBreakdown?: Array<{ source: string; apr: number; type: string }> | null;
  riskScore?: number | null;
  grade?: string | null;
  gradeFailures?: string[];
  updatedAt: string;
}

export interface VaultsApiResponse {
  success: boolean;
  data: VaultData[];
  count: number;
  error?: string;
}

// Extended adapter with snapshotTime for detail view
export interface VaultAdapterDetail extends VaultAdapter {
  snapshotTime: string;
}

// Snapshot history entry
export interface SnapshotHistoryEntry {
  totalAssetsUsd: number;
  sharePrice: number;
  avgNetApy: number | null;
  timestamp: string;
}

// Curator news for vault detail
export interface VaultCuratorNews {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: string | null;
  category: string | null;
}

// Other vaults by same curator
export interface CuratorOtherVault {
  id: string;
  address: string;
  name: string;
  symbol: string;
  dataSource: string;
  grade: string | null;
  gradeFailures?: string[];
  totalAssetsUsd: number;
  avgNetApy: number | null;
}

// Curator data included in vault detail
export interface VaultCurator {
  id: string;
  address: string;
  name: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  legalName: string | null;
  entityType: string | null;
  jurisdiction: string | null;
  registeredState: string | null;
  headquarters: string | null;
  description: string | null;
  foundedYear: number | null;
  teamSize: string | null;
  isRegulated: boolean;
  regulatoryBody: string | null;
  logoUrl: string | null;
  totalAssetsManaged: number;
  vaultCount: number;
  news: VaultCuratorNews[];
  otherVaults: CuratorOtherVault[];
}

// Risk assessment types
export interface RiskCategory {
  level: "Low Risk" | "Moderate Risk" | "High Risk";
  score: number;
  factors: string[];
  recommendations: string[];
}

export interface InstitutionalRiskAssessment {
  overallRisk: "Low Risk" | "Moderate Risk" | "High Risk";
  overallScore: number;
  categories: {
    smartContract: RiskCategory;
    oracle: RiskCategory;
    collateral: RiskCategory;
    lltv: RiskCategory;
    operational: RiskCategory;
  };
  lastUpdated: string;
}

// Full vault detail response
export interface VaultDetail extends VaultData {
  snapshotHistory: SnapshotHistoryEntry[];
  adapters: VaultAdapterDetail[];
  idleAssets: string;
  idleAssetsUsd: number;
  curator: VaultCurator | null;
  createdAt: string;
  riskAssessment: InstitutionalRiskAssessment;
  liquidations?: LiquidationEvent[];
  liquidationSummary?: {
    total: number;
    totalBadDebtUsd: number;
    totalSeizedUsd: number;
    totalRepaidUsd: number;
    recent30d: number;
  };
}

export interface VaultDetailApiResponse {
  success: boolean;
  data: VaultDetail;
  error?: string;
}

// Curator types
export interface CuratorProfile {
  id: string;
  address: string;
  name: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  email: string | null;
  legalName: string | null;
  entityType: string | null;
  jurisdiction: string | null;
  registeredState: string | null;
  headquarters: string | null;
  description: string | null;
  foundedYear: number | null;
  teamSize: string | null;
  isRegulated: boolean;
  regulatoryBody: string | null;
  licenses: string[] | null;
  logoUrl: string | null;
  totalAssetsManaged: number;
  vaultCount: number;
  createdAt: string;
  updatedAt: string;
  strategyType?: "Conservative" | "Moderate" | "Aggressive";
  riskScore?: "low" | "medium" | "high";
}

export interface CuratorNewsItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: string | null;
  category: string | null;
  createdAt: string;
}

export interface CuratorVaultSummary {
  id: string;
  address: string;
  name: string;
  symbol: string;
  asset: VaultAsset;
  performanceFee: number;
  protocol: string;
  dataSource: string;
  grade: string | null;
  gradeFailures?: string[];
  chainName: string | null;
  latestSnapshot: VaultSnapshot | null;
}

export interface CuratorDetailResponse {
  success: boolean;
  data: {
    curator: CuratorProfile;
    vaults: CuratorVaultSummary[];
    news: CuratorNewsItem[];
    liquidationSummary?: LiquidationSummary;
  };
  error?: string;
}

export interface CuratorsListResponse {
  success: boolean;
  data: CuratorProfile[];
  count: number;
  error?: string;
}

// Curator Dashboard types (curator-first view)
export interface AssetDistribution {
  symbol: string;
  amountUsd: number;
  percentage: number;
}

export interface CuratorDashboardItem {
  curatorId: string;
  curatorAddress: string;
  name: string | null;
  logoUrl: string | null;
  website: string | null;
  twitter: string | null;
  jurisdiction: string | null;
  entityType: string | null;
  isRegulated: boolean;
  totalAUM: number;
  vaultCount: number;
  avgApy: number;
  avgNetApy: number;
  assetDistribution: AssetDistribution[];
  protocols: string[];
  networks: string[];
  lastActive: string | null;
  riskScore: "low" | "medium" | "high";
  strategyType: "Conservative" | "Moderate" | "Aggressive";
  tvlChange30d: number;
  tvlChangePct30d: number;
}

export interface CuratorDashboardStats {
  totalCurators: number;
  totalAUM: number;
  totalVaults: number;
  avgApy: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CuratorDashboardResponse {
  success: boolean;
  data: {
    curators: CuratorDashboardItem[];
    stats: CuratorDashboardStats;
    pagination?: PaginationInfo;
  };
  error?: string;
}

// Curator vault for curator detail page
export interface CuratorVaultDetail {
  id: string;
  address: string;
  name: string;
  symbol: string;
  asset: VaultAsset;
  tvl: number;
  apy: number | null;
  netApy: number | null;
  riskScore: string | null;
  lastActive: string | null;
}

// Curator performance data
export interface CuratorPerformanceData {
  date: string;
  totalAUM: number;
  avgApy: number;
}

export interface CuratorPerformanceResponse {
  success: boolean;
  data: {
    history: CuratorPerformanceData[];
    bestVault: {
      name: string;
      apy: number;
    } | null;
    apyConsistency: number;
    netInflows30d: number;
  };
  error?: string;
}

// Curator activity item
export interface CuratorActivityItem {
  id: string;
  type: "transaction" | "reallocation" | "news";
  vaultName: string | null;
  vaultAddress: string | null;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CuratorActivityResponse {
  success: boolean;
  data: CuratorActivityItem[];
  count: number;
  error?: string;
}

// Liquidation types
export interface LiquidationEvent {
  txHash: string;
  timestamp: string;
  marketUniqueKey: string;
  borrower: string;
  liquidator: string;
  repaidAssetsUsd: number;
  seizedAssetsUsd: number;
  badDebtAssetsUsd: number;
}

export interface LiquidationSummary {
  total: number;
  totalBadDebtUsd: number;
  totalSeizedUsd: number;
  totalRepaidUsd: number;
  recent30d: number;
  events: LiquidationEvent[];
}

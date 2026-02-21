// Types for Morpho V2 Vault data from GraphQL API

export interface MorphoAsset {
  address: string;
  symbol: string;
  decimals: number;
}

export interface MorphoAdapter {
  address: string;
  type: string;
  assets: string; // BigInt as string
  assetsUsd: number;
}

export interface MorphoCurator {
  address: string;
}

export interface MorphoVaultV2 {
  address: string;
  name: string;
  symbol: string;
  totalAssets: string; // BigInt as string
  totalAssetsUsd: number;
  totalSupply: string; // BigInt as string
  sharePrice: number;
  liquidity: string | null; // BigInt as string - available for withdrawal
  apy: number | null;
  netApy: number | null;
  avgApy: number | null;
  avgNetApy: number | null;
  performanceFee: number;
  managementFee: number;
  asset: MorphoAsset;
  adapters: {
    items: MorphoAdapter[];
  };
  curator: MorphoCurator;
}

export interface VaultV2sResponse {
  vaultV2s: {
    items: MorphoVaultV2[];
  };
}

// Database types (matches Prisma schema)
export interface VaultRecord {
  id: string;
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  curatorAddress: string | null;
  performanceFee: number;
  managementFee: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultSnapshotRecord {
  id: string;
  vaultId: string;
  totalAssets: string;
  totalAssetsUsd: number;
  totalSupply: string;
  sharePrice: number;
  liquidity: string | null; // Raw liquidity in asset units
  liquidityUsd: number | null; // Liquidity in USD
  apy: number | null;
  netApy: number | null;
  avgApy: number | null;
  avgNetApy: number | null;
  timestamp: Date;
}

export interface AdapterAllocationRecord {
  id: string;
  vaultId: string;
  adapterAddress: string;
  adapterType: string;
  assets: string;
  assetsUsd: number;
  allocationPct: number;
  snapshotTime: Date;
}

// API response types
export interface VaultWithSnapshot extends VaultRecord {
  latestSnapshot: VaultSnapshotRecord | null;
  adapters: AdapterAllocationRecord[];
}

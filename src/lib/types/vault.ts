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

// Canonical curator identity from the Morpho API registry: one org id/name with
// its curator addresses across every chain. This is what lets a Base vault by
// Gauntlet resolve to the same Curator row as Gauntlet's Ethereum vaults.
export interface MorphoCanonicalCurator {
  id: string;
  name: string;
  addresses: { address: string; chainId: number }[];
}

export interface MorphoVaultWarning {
  type: string;
  level: string;
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
  warnings?: MorphoVaultWarning[];
  listed?: boolean;
  creationTimestamp?: string;  // BigInt as string from API
  pendingConfigs?: { items: Array<{ validAt: string; functionName: string; txHash: string }> };
  curator: MorphoCurator | null;
  curators?: { items: MorphoCanonicalCurator[] };
}

export interface VaultV2sResponse {
  vaultV2s: {
    items: MorphoVaultV2[];
  };
}

// Morpho V1 (MetaMorpho) vault as returned by the `vaults` query. V1 predates
// the adapter architecture: allocation goes straight to markets, and `state.fee`
// is the performance fee (there is no management fee).
export interface MorphoVaultV1 {
  address: string;
  name: string;
  symbol: string;
  listed?: boolean;
  creationTimestamp?: string;
  asset: MorphoAsset;
  state: {
    totalAssets: string | number;
    totalAssetsUsd: number | null;
    totalSupply: string | number;
    sharePriceNumber: number | null;
    apy: number | null;
    netApy: number | null;
    avgNetApy: number | null;
    fee: number | null;
    curator: string | null;
    curators?: MorphoCanonicalCurator[];
  } | null;
  warnings?: MorphoVaultWarning[];
}

export interface VaultsV1Response {
  vaults: {
    items: MorphoVaultV1[];
  };
}

/**
 * Normalize a V1 vault to the common MorphoVaultV2 shape so the collection
 * pipeline processes both generations identically. Returns null when the vault
 * has no state (nothing to snapshot). adapters is empty by construction —
 * callers must skip adapter-derived risk snapshots for V1.
 */
export function v1ToCommonShape(v: MorphoVaultV1): MorphoVaultV2 | null {
  const s = v.state;
  if (!s) return null;
  return {
    address: v.address,
    name: v.name,
    symbol: v.symbol,
    totalAssets: String(s.totalAssets ?? "0"),
    totalAssetsUsd: s.totalAssetsUsd ?? 0,
    totalSupply: String(s.totalSupply ?? "0"),
    sharePrice: s.sharePriceNumber ?? 0, // 0 → pipeline recomputes from totals
    liquidity: null,
    apy: s.apy,
    netApy: s.netApy,
    avgApy: null, // V1 state has no avgApy field
    avgNetApy: s.avgNetApy,
    performanceFee: s.fee ?? 0,
    managementFee: 0,
    asset: v.asset,
    adapters: { items: [] },
    warnings: v.warnings,
    listed: v.listed,
    creationTimestamp: v.creationTimestamp,
    pendingConfigs: { items: [] },
    curator: s.curator ? { address: s.curator } : null,
    curators: s.curators ? { items: s.curators } : undefined,
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

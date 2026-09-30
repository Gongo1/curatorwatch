import { gql } from "graphql-request";

// Fetch Morpho V2 vaults with pagination support.
// No avgApy: Morpho removed VaultV2.avgApy (queries failing since 2026-08-26,
// which silently froze every V2 vault). MorphoVaultV2.avgApy stays optional and
// is stored as null; avgNetApy is still served.
export const GET_VAULTS_V2_PAGINATED = gql`
  query GetVaultsV2Paginated($first: Int!, $skip: Int!, $chainId: Int!, $minTvl: Float!) {
    vaultV2s(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [$chainId], totalAssetsUsd_gte: $minTvl }
    ) {
      items {
        address
        name
        symbol
        totalAssets
        totalAssetsUsd
        totalSupply
        sharePrice
        liquidity
        apy
        netApy
        avgNetApy
        performanceFee
        managementFee
        asset {
          address
          symbol
          decimals
        }
        adapters {
          items {
            address
            type
            assets
            assetsUsd
          }
        }
        warnings {
          type
          level
        }
        listed
        creationTimestamp
        pendingConfigs {
          items {
            validAt
            functionName
            txHash
          }
        }
        curator {
          address
        }
      }
    }
  }
`;

// Canonical curator registry: every curator org with its addresses across all
// chains. Fetched once per collection run (inlining this on the paginated V2
// vault query blows the API's complexity budget), then joined locally by
// curator address.
export const GET_MORPHO_CURATORS = gql`
  query GetMorphoCurators($first: Int!, $skip: Int!) {
    curators(first: $first, skip: $skip) {
      items {
        id
        name
        addresses {
          address
          chainId
        }
      }
    }
  }
`;

// Fetch Morpho V1 (MetaMorpho) vaults with pagination support. V1 vaults are
// separate contracts from V2 — both generations coexist per chain and neither
// list contains the other. V1 has no adapters (it allocates straight to
// markets) and no separate management fee (state.fee is the performance fee).
export const GET_VAULTS_V1_PAGINATED = gql`
  query GetVaultsV1Paginated($first: Int!, $skip: Int!, $chainId: Int!, $minTvl: Float!) {
    vaults(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [$chainId], totalAssetsUsd_gte: $minTvl }
    ) {
      items {
        address
        name
        symbol
        listed
        creationTimestamp
        asset {
          address
          symbol
          decimals
        }
        state {
          totalAssets
          totalAssetsUsd
          totalSupply
          sharePriceNumber
          apy
          netApy
          avgNetApy
          fee
          curator
          curators {
            id
            name
            addresses {
              address
              chainId
            }
          }
        }
        warnings {
          type
          level
        }
      }
    }
  }
`;

// Legacy: Fetch top N Morpho V2 vaults by TVL (no pagination)
export const GET_TOP_VAULTS_V2 = gql`
  query GetTopVaultsV2($first: Int!, $chainId: Int!) {
    vaultV2s(
      first: $first
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [$chainId] }
    ) {
      items {
        address
        name
        symbol
        totalAssets
        totalAssetsUsd
        totalSupply
        sharePrice
        liquidity
        apy
        netApy
        avgNetApy
        performanceFee
        managementFee
        asset {
          address
          symbol
          decimals
        }
        adapters {
          items {
            address
            type
            assets
            assetsUsd
          }
        }
        warnings {
          type
          level
        }
        listed
        creationTimestamp
        pendingConfigs {
          items {
            validAt
            functionName
            txHash
          }
        }
        curator {
          address
        }
      }
    }
  }
`;

// Fetch a single vault by address
export const GET_VAULT_V2_BY_ADDRESS = gql`
  query GetVaultV2ByAddress($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      totalAssets
      totalAssetsUsd
      totalSupply
      sharePrice
      liquidity
      apy
      netApy
      avgNetApy
      performanceFee
      managementFee
      asset {
        address
        symbol
        decimals
      }
      adapters {
        items {
          address
          type
          assets
          assetsUsd
        }
      }
      warnings {
        type
        level
      }
      listed
      creationTimestamp
      pendingConfigs {
        items {
          validAt
          functionName
          txHash
        }
      }
      curator {
        address
      }
    }
  }
`;

// Fetch vault V2 transactions - note: no assets field available, only shares
export const GET_VAULT_V2_TRANSACTIONS = gql`
  query GetVaultV2Transactions($vaultAddress: String!, $first: Int!) {
    vaultV2transactions(
      first: $first
      where: { vaultAddress_in: [$vaultAddress] }
    ) {
      items {
        type
        shares
        timestamp
        txHash
        blockNumber
      }
    }
  }
`;

// Fetch vault reallocations - uses "hash" not "txHash"
export const GET_VAULT_REALLOCATES = gql`
  query GetVaultReallocates($vaultAddress: String!, $first: Int!) {
    vaultReallocates(
      first: $first
      where: { vaultAddress_in: [$vaultAddress] }
    ) {
      items {
        timestamp
        assets
        type
        blockNumber
        hash
        vault {
          address
        }
        market {
          marketId
        }
      }
    }
  }
`;

// Types for transaction responses
export interface VaultV2Transaction {
  type: string;
  shares: string | null;
  timestamp: string;
  txHash: string;
  blockNumber: number;
}

export interface VaultV2TransactionsResponse {
  vaultV2transactions: {
    items: VaultV2Transaction[];
  };
}

export interface VaultReallocate {
  timestamp: string;
  assets: string;
  type: string | null;
  blockNumber: number;
  hash: string | null;
  vault: {
    address: string;
  };
  market: {
    marketId: string;
  } | null;
}

export interface VaultReallocatesResponse {
  vaultReallocates: {
    items: VaultReallocate[];
  };
}

// Fetch vault positions (top depositors)
// Note: positions field doesn't support orderBy - we sort client-side
export const GET_VAULT_POSITIONS = gql`
  query GetVaultPositions($address: String!, $chainId: Int!, $first: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      totalAssets
      totalAssetsUsd
      positions(first: $first) {
        items {
          user {
            address
          }
          assets
          assetsUsd
          shares
        }
      }
    }
  }
`;

export interface VaultPosition {
  user: {
    address: string;
  };
  assets: string;
  assetsUsd: number;
  shares: string;
}

export interface VaultPositionsResponse {
  vaultV2ByAddress: {
    totalAssets: string;
    totalAssetsUsd: number;
    positions: {
      items: VaultPosition[];
    };
  } | null;
}

// Fetch market details by unique key
export const GET_MARKET_BY_KEY = gql`
  query GetMarketByKey($uniqueKey: String!, $chainId: Int!) {
    marketById(marketId: $uniqueKey, chainId: $chainId) {
      marketId
      loanAsset {
        address
        symbol
        decimals
      }
      collateralAsset {
        address
        symbol
        decimals
      }
      lltv
      oracle {
        address
        type
      }
      state {
        supplyAssets
        supplyAssetsUsd
        borrowAssets
        borrowAssetsUsd
        supplyApy
        borrowApy
        utilization
      }
    }
  }
`;

export interface MorphoMarket {
  marketId: string;
  loanAsset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralAsset: {
    address: string;
    symbol: string;
    decimals: number;
  } | null;
  lltv: string;
  oracle: {
    address: string;
    type: string | null;
  } | null;
  state: {
    supplyAssets: string;
    supplyAssetsUsd: number;
    borrowAssets: string;
    borrowAssetsUsd: number;
    supplyApy: number;
    borrowApy: number;
    utilization: number;
  } | null;
}

export interface MarketByKeyResponse {
  marketById: MorphoMarket | null;
}

// Fetch vault adapters (simplified - adapters don't expose market details directly)
export const GET_VAULT_ADAPTERS = gql`
  query GetVaultAdapters($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      totalAssets
      totalAssetsUsd
      adapters {
        items {
          address
          type
          assets
          assetsUsd
        }
      }
    }
  }
`;

export interface VaultAdapterSimple {
  address: string;
  type: string;
  assets: string;
  assetsUsd: number;
}

export interface VaultAdaptersResponse {
  vaultV2ByAddress: {
    address: string;
    name: string;
    totalAssets: string;
    totalAssetsUsd: number;
    adapters: {
      items: VaultAdapterSimple[];
    };
  } | null;
}

// Fetch user positions across all vaults
export const GET_USER_POSITIONS_ACROSS_VAULTS = gql`
  query GetUserPositionsAcrossVaults($userAddress: String!, $chainId: Int!) {
    vaultV2Positions(
      first: 100
      where: { userAddress_in: [$userAddress], chainId_in: [$chainId] }
    ) {
      items {
        assets
        assetsUsd
        shares
        vault {
          address
          name
          symbol
          totalAssets
          totalAssetsUsd
          curator {
            address
          }
          asset {
            symbol
          }
        }
      }
    }
  }
`;

export interface UserVaultPosition {
  assets: string;
  assetsUsd: number;
  shares: string;
  vault: {
    address: string;
    name: string;
    symbol: string;
    totalAssets: string;
    totalAssetsUsd: number;
    curator: {
      address: string;
    } | null;
    asset: {
      symbol: string;
    };
  };
}

export interface UserPositionsAcrossVaultsResponse {
  vaultV2Positions: {
    items: UserVaultPosition[];
  };
}

// Fetch market liquidation transactions, oldest-first from a timestamp floor.
// Amounts are raw token units (BigInt, serialized as number or string); the
// collector derives USD from asset decimals + price.usd.
export const GET_LIQUIDATION_TRANSACTIONS = gql`
  query GetLiquidationTransactions($first: Int!, $skip: Int!, $timestampGte: Int!) {
    marketTransactions(
      first: $first
      skip: $skip
      orderBy: Timestamp
      orderDirection: Asc
      where: { type_in: [Liquidation], timestamp_gte: $timestampGte }
    ) {
      pageInfo {
        countTotal
      }
      items {
        txHash
        timestamp
        market {
          marketId
          loanAsset {
            decimals
            price {
              usd
            }
          }
          collateralAsset {
            decimals
            price {
              usd
            }
          }
        }
        user {
          address
        }
        data {
          ... on MarketTransactionLiquidationData {
            liquidator
            repaidAssets
            seizedAssets
            badDebtAssets
          }
        }
      }
    }
  }
`;

type RawAmount = number | string;

export interface LiquidationAsset {
  decimals: number;
  price: { usd: number | null } | null;
}

export interface LiquidationTransactionData {
  liquidator: string;
  repaidAssets: RawAmount;
  seizedAssets: RawAmount;
  badDebtAssets: RawAmount;
}

export interface LiquidationTransaction {
  txHash: string;
  timestamp: RawAmount;
  market: {
    marketId: string;
    loanAsset: LiquidationAsset;
    collateralAsset: LiquidationAsset | null;
  } | null;
  user: {
    address: string;
  } | null;
  data: LiquidationTransactionData | null;
}

export interface LiquidationTransactionsResponse {
  marketTransactions: {
    pageInfo: { countTotal: number };
    items: LiquidationTransaction[];
  };
}
